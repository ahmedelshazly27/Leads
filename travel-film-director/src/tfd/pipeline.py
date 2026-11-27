"""High-level operations used by both the CLI and the web UI."""
from __future__ import annotations

import json
from pathlib import Path

from .analysis.reference import build_profile
from .analysis import transcript as tx
from .config import Settings, get_settings
from .library.creators import compare, comparison_markdown, creator_profile
from .library.db import Library
from .log import get_logger
from .schemas import VideoProfile
from .util import fmt_ts, read_json, slug, write_json, youtube_id
from .youtube.ingest import ingest_reference

log = get_logger("pipeline")


def open_library(settings: Settings | None = None) -> Library:
    settings = settings or get_settings()
    return Library(settings.db_path)


def video_dir(settings: Settings, creator: str, video_id: str) -> Path:
    return settings.library_dir / slug(creator) / video_id


def analyse_reference(url: str, creator: str, notes: str = "", *, use_claude: bool | None = None,
                      transcript_file: Path | None = None,
                      settings: Settings | None = None, lib: Library | None = None) -> VideoProfile:
    settings = settings or get_settings()
    lib = lib or open_library(settings)
    vid = youtube_id(url)
    out = video_dir(settings, creator, vid)
    lib.mark_status(vid, creator, url, "running", notes=notes)
    try:
        previous = None
        if (out / "profile.json").is_file():  # keep qualitative notes / user notes across re-analysis
            previous = VideoProfile.model_validate_json((out / "profile.json").read_text(encoding="utf-8"))
        src = ingest_reference(url, out, settings, transcript_file)
        profile = build_profile(src, creator, out, notes or (previous.user_notes if previous else ""))
        if previous and previous.qualitative:
            profile.qualitative = previous.qualitative
            use_claude = False
        if use_claude is None:
            use_claude = settings.has_claude
        if use_claude:
            try:
                from .llm.claude import qualitative_analysis
                sample = "\n".join(f"[{fmt_ts(s.start)}] {s.text}" for s in src.transcript[:: max(1, len(src.transcript) // 300)])
                profile.qualitative = qualitative_analysis(profile.model_dump(), profile.contact_sheets, sample, settings)
            except Exception as e:  # never lose the local analysis because the optional API failed
                log.warning("Claude qualitative analysis skipped: %s", e)
                profile.limitations.append(f"Claude qualitative analysis not run: {e}")
        elif not profile.qualitative:
            profile.limitations.append("Claude qualitative analysis not run (no API key / disabled); "
                                       "run `tfd annotate` from Claude Code to add it.")
        path = out / "profile.json"
        write_json(path, profile.model_dump())
        lib.add_profile(profile, path)
        refresh_creator_profiles(settings, lib)
        return profile
    except Exception as e:
        lib.mark_status(vid, creator, url, "error", error=str(e)[:500])
        raise


def rebuild_profiles(settings: Settings | None = None) -> list[str]:
    """Recompute every profile from cached ingest data (after improving the analysers). Keeps user notes and
    qualitative annotations."""
    from .youtube.ingest import load_cached_source
    settings = settings or get_settings()
    lib = open_library(settings)
    done = []
    for v in lib.videos():
        if v["status"] != "done":
            continue
        out = Path(v["profile_path"]).parent
        if not (out / "source.json").is_file():
            log.warning("%s has no cached source (analysed by an older version) - re-run `tfd ref add`", v["video_id"])
            continue
        old = VideoProfile.model_validate_json(Path(v["profile_path"]).read_text(encoding="utf-8"))
        prof = build_profile(load_cached_source(out), old.creator, out, old.user_notes)
        prof.qualitative = old.qualitative
        if "full_rate" in old.editing_characteristics:
            prof.editing_characteristics["full_rate"] = old.editing_characteristics["full_rate"]
            prof.techniques = sorted(prof.techniques + [t for t in old.techniques if t.name.startswith("[full-rate]")],
                                     key=lambda t: t.start)
        if not prof.qualitative:
            prof.limitations.append("Claude qualitative analysis not run; run `tfd annotate` from Claude Code to add it.")
        write_json(Path(v["profile_path"]), prof.model_dump())
        lib.add_profile(prof, Path(v["profile_path"]))
        done.append(v["video_id"])
    refresh_creator_profiles(settings, lib)
    return done


def attach_full_rate(video_id: str, video_file: Path, settings: Settings | None = None) -> dict:
    """Analyse a local copy of a reference video at full frame rate (a file you are entitled to use) and merge
    exact shot/transition/camera-move data into its profile. The file itself is not copied or stored."""
    from .analysis.local_video import analyse_video
    from .schemas import Technique
    settings = settings or get_settings()
    lib = open_library(settings)
    row = next((v for v in lib.videos() if v["video_id"] == video_id), None)
    if not row:
        raise KeyError(f"{video_id} is not in the library - add its URL with `tfd ref add` first")
    path = Path(row["profile_path"])
    profile = VideoProfile.model_validate_json(path.read_text(encoding="utf-8"))
    res = analyse_video(Path(video_file))
    res.pop("file", None)  # don't record where the user keeps files
    write_json(path.parent / "full_rate.json", res)
    if profile.duration and abs(res["duration"] - profile.duration) > max(5.0, 0.03 * profile.duration):
        log.warning("local file is %.0fs but the YouTube video is %.0fs - is it the same edit?", res["duration"], profile.duration)
    profile.editing_characteristics["full_rate"] = res["summary"]
    profile.techniques = [t for t in profile.techniques if t.source != "user" or not t.name.startswith("[full-rate]")]
    for t in res["transitions"]:
        if t["type"] != "hard cut":
            profile.techniques.append(Technique(start=t.get("start", t["t"]), end=t.get("end", t["t"]), category="transition",
                                                name=f"[full-rate] {t['type']}", description="measured at full frame rate",
                                                confidence=0.8, source="user"))
    for sh in res["shots"]:
        if sh["camera_move"] not in ("static / locked-off", "unmeasured"):
            profile.techniques.append(Technique(start=sh["start"], end=sh["end"], category="visual",
                                                name=f"[full-rate] {sh['camera_move']}",
                                                description=f"{sh['duration']:.1f}s shot, {'handheld' if sh.get('handheld') else 'stabilised'}",
                                                confidence=0.8, source="user"))
    profile.techniques.sort(key=lambda t: t.start)
    profile.limitations = [l for l in profile.limitations if not l.startswith("Frames are YouTube storyboard")] + [
        "Cuts, transitions and camera moves come from a full-frame-rate analysis of a local file (see full_rate.json)."]
    write_json(path, profile.model_dump())
    lib.add_profile(profile, path)
    refresh_creator_profiles(settings, lib)
    return res["summary"]


def annotate(video_id: str, annotation_file: Path, settings: Settings | None = None) -> VideoProfile:
    """Merge qualitative observations (e.g. written by Claude Code after viewing contact sheets) into a profile."""
    settings = settings or get_settings()
    lib = open_library(settings)
    row = next((v for v in lib.videos() if v["video_id"] == video_id), None)
    if not row:
        raise KeyError(video_id)
    path = Path(row["profile_path"])
    profile = VideoProfile.model_validate_json(path.read_text(encoding="utf-8"))
    ann = read_json(annotation_file)
    ann.setdefault("source", "claude-code")
    profile.qualitative = ann
    profile.limitations = [l for l in profile.limitations if "qualitative analysis not run" not in l]
    write_json(path, profile.model_dump())
    lib.add_profile(profile, path)
    refresh_creator_profiles(settings, lib)
    return profile


def refresh_creator_profiles(settings: Settings, lib: Library) -> dict:
    creators = []
    for c in lib.creators():
        profs = lib.profiles(c["slug"])
        if not profs:
            continue
        cp = creator_profile(c["name"], profs, c["description"], c["weight"])
        write_json(settings.library_dir / c["slug"] / "creator_profile.json", cp)
        creators.append(cp)
    cmp = compare(creators) if creators else {}
    if creators:
        write_json(settings.library_dir / "comparison.json", cmp)
        (settings.library_dir / "comparison.md").write_text(comparison_markdown(cmp, creators), encoding="utf-8")
    return cmp


def library_context(settings: Settings, lib: Library, question: str = "", max_chars: int = 60000) -> str:
    """Compact text dump of the library for Claude (API or Claude Code)."""
    parts = []
    cmp_md = settings.library_dir / "comparison.md"
    if cmp_md.is_file():
        parts.append(cmp_md.read_text(encoding="utf-8"))
    for c in lib.creators():
        p = settings.library_dir / c["slug"] / "creator_profile.json"
        if p.is_file():
            cp = read_json(p)
            cp.pop("videos", None)
            parts.append(f"## Creator profile JSON: {c['name']}\n" + json.dumps(cp, default=str)[:8000])
    for prof in lib.profiles():
        scenes = "\n".join(f"- {fmt_ts(s.start)}-{fmt_ts(s.end)} {s.style_mode} | {s.shot_type} | {s.narrative_function} | "
                           f"{s.audio.description} | {', '.join(s.editing_techniques)}" for s in prof.scenes)
        parts.append(f"## Scenes: {prof.creator} - {prof.title} ({prof.url})\n{scenes}")
    if question:
        hits = lib.search(question, limit=20)
        if hits:
            parts.append("## Search hits for the question\n" + "\n".join(
                f"- {h['creator']} / {h['title']} @ {h['timestamp']}: {h['name']} - {h['text'][:200]}" for h in hits))
    return "\n\n".join(parts)[:max_chars]


def ask_library(question: str, settings: Settings | None = None) -> dict:
    settings = settings or get_settings()
    lib = open_library(settings)
    ctx = library_context(settings, lib, question)
    if settings.has_claude:
        from .llm.claude import ask
        try:
            return {"mode": "claude", "answer": ask(question, ctx, settings)}
        except Exception as e:
            log.warning("Claude ask failed, falling back to local answer: %s", e)
    cmp = read_json(settings.library_dir / "comparison.json") if (settings.library_dir / "comparison.json").is_file() else {}
    hits = lib.search(question, limit=12)
    lines = ["(Offline answer - set ANTHROPIC_API_KEY for a written answer, or ask Claude Code, which reads the same files.)", ""]
    if cmp.get("key_differences"):
        lines += ["Key measured differences:"] + [f"- {s}" for s in cmp["key_differences"][:10]] + [""]
    if hits:
        lines += ["Relevant timestamped examples:"] + [
            f"- {h['creator']} - {h['title']} @ {h['timestamp']}: {h['name']} ({h['style_mode'] or h['category']}) {h['link'] or ''}"
            for h in hits]
    return {"mode": "offline", "answer": "\n".join(lines), "hits": hits}
