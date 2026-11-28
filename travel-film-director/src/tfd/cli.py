"""Command-line entry point: `tfd <command>` (or `python -m tfd`)."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .config import get_settings
from .log import add_file_handler, get_logger

log = get_logger("cli")


def _ref_add(a):
    from .pipeline import analyse_reference
    ok = 0
    for url in a.urls:
        try:
            p = analyse_reference(url, a.creator, a.notes or "", use_claude=False if a.no_claude else None,
                                  transcript_file=Path(a.transcript_file) if a.transcript_file else None)
            ok += 1
            print(json.dumps({"video_id": p.video_id, "title": p.title, "scenes": len(p.scenes),
                              "style_mode_mix": p.style_mode_mix,
                              "est_cuts_per_min": p.editing_characteristics.get("est_cuts_per_min")}))
        except Exception as e:
            log.error("failed %s: %s", url, e)
    return 0 if ok == len(a.urls) else 1


def _ref_batch(a):
    """File with lines: creator<TAB or |>url[<TAB or |>notes]"""
    from .pipeline import analyse_reference
    rc = 0
    for line in Path(a.file).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.replace("\t", "|").split("|")]
        creator, url, notes = parts[0], parts[1], (parts[2] if len(parts) > 2 else "")
        try:
            p = analyse_reference(url, creator, notes, use_claude=False if a.no_claude else None)
            print(f"OK  {creator:15s} {p.video_id} {p.title[:60]}")
        except Exception as e:
            rc = 1
            print(f"ERR {creator:15s} {url}: {e}")
    return rc


def _deep(a):
    import shutil as _sh
    from .pipeline import deep_analyse, open_library, video_dir
    ids = a.video_ids or ([v["video_id"] for v in open_library().videos() if v["status"] == "done"] if a.all else [])
    if not ids:
        print("give video ids or --all"); return 2
    rc = 0
    for vid in ids:
        try:
            out = deep_analyse(vid, Path(a.file) if a.file else None, download=a.download)
            fr, au = out["full_rate"], out.get("audio", {})
            print(f"OK  {vid}: {fr['shots']} shots, {fr['cuts_per_min']} cuts/min, transitions {fr['transition_types']}, "
                  f"music {au.get('music_share')}, beat sync {((au.get('beat_sync') or {}).get('beat_sync_index'))}, "
                  f"graphics {out['graphics']['counts']}, filler {out['filler'].get('candidates')}")
            if a.delete_media:
                v = next(x for x in open_library().videos() if x["video_id"] == vid)
                _sh.rmtree(Path(v["profile_path"]).parent / "media", ignore_errors=True)
        except Exception as e:
            rc = 1
            print(f"ERR {vid}: {e}")
    return rc


def _stock(a):
    from .stock.search import download, search
    res = search(" ".join(a.query), min_duration=a.min_duration, per_page=a.n)
    for i, r in enumerate(res):
        print(f"[{i}] {r.provider}:{r.id} {r.duration:.0f}s {r.width}x{r.height} by {r.author}  {r.page_url}")
    if a.project and a.get:
        for i in a.get:
            print("saved", download(res[i], Path(a.project)))
    return 0


def _library(a):
    from .pipeline import open_library
    lib = open_library()
    for v in lib.videos():
        print(f"{v['creator']:15s} {v['video_id']} {v['status']:7s} {(v['title'] or '')[:70]}")
    return 0


def _compare(a):
    from .pipeline import open_library, refresh_creator_profiles
    s = get_settings()
    refresh_creator_profiles(s, open_library(s))
    print((s.library_dir / "comparison.md").read_text(encoding="utf-8"))
    return 0


def _search(a):
    from .pipeline import open_library
    for h in open_library().search(a.query, style_mode=a.mode, limit=a.limit):
        print(f"{h['creator']:15s} {h['timestamp']:>8s} [{h['kind']}] {h['name']}: {h['text'][:110]}  {h['link']}")
    return 0


def _ask(a):
    from .pipeline import ask_library
    print(ask_library(" ".join(a.question))["answer"])
    return 0


def _context(a):
    from .pipeline import library_context, open_library
    s = get_settings()
    print(library_context(s, open_library(s), " ".join(a.question or [])))
    return 0


def _annotate(a):
    from .pipeline import annotate
    target = Path(a.file) if a.file else None
    if a.video_id == "--all" or (target is None and Path(a.video_id).is_dir()):
        folder = target or Path(a.video_id)
        rc = 0
        for f in sorted(folder.glob("*.json")):
            try:
                p = annotate(f.stem, f)
                print(f"annotated {p.video_id}: {len(p.qualitative.get('observations', []))} observations")
            except KeyError:
                rc = 1
                print(f"skip {f.stem}: not in the library yet (run tfd ref batch first)")
        return rc
    p = annotate(a.video_id, target)
    print(f"annotated {p.video_id}: {len(p.qualitative.get('observations', []))} observations")
    return 0


def _footage(a):
    from .footage.ingest import ingest_folder
    s = get_settings()
    out = Path(a.out) if a.out else s.projects_dir / Path(a.folder).name
    report = ingest_folder(Path(a.folder), out, transcribe=a.transcribe)
    print(json.dumps(report["summary"], indent=2))
    return 0


def _relink(a):
    from .footage.ingest import relink_originals
    n = relink_originals(Path(a.project), [Path(r) for r in a.roots])
    print(json.dumps({"relinked": n}))
    return 0


def _direct(a):
    from .director.planner import plan_project
    from .editing.otio_export import export_timeline
    plan = plan_project(Path(a.project), target_minutes=a.minutes, direction=a.direction)
    paths = export_timeline(Path(a.project), plan)
    print(json.dumps({"plan": str(Path(a.project) / "plan.json"), **{k: str(v) for k, v in paths.items()}}, indent=2))
    return 0


def _render(a):
    from .editing.render import render_preview
    from .editing.qa import run_qa
    out = render_preview(Path(a.project))
    print(json.dumps({"render": str(out), "qa": run_qa(Path(a.project), out)}, indent=2, default=str))
    return 0


def _serve(a):
    import uvicorn
    print(f"Open http://{a.host}:{a.port}")
    uvicorn.run("tfd.web.app:app", host=a.host, port=a.port, log_level="info")
    return 0


def main(argv=None) -> int:
    s = get_settings()
    add_file_handler(s.data_dir / "tfd.log")
    p = argparse.ArgumentParser(prog="tfd", description="AI Travel Film Director")
    sub = p.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("ref", help="reference library: add YouTube videos")
    rs = r.add_subparsers(dest="refcmd", required=True)
    ra = rs.add_parser("add", help="analyse one or more YouTube URLs for a creator")
    ra.add_argument("--creator", required=True)
    ra.add_argument("--notes", default="")
    ra.add_argument("--no-claude", action="store_true")
    ra.add_argument("--transcript-file", help="SRT/VTT transcript you are entitled to use (when YouTube has no captions)")
    ra.add_argument("urls", nargs="+")
    ra.set_defaults(fn=_ref_add)
    rb = rs.add_parser("batch", help="analyse a file of 'creator | url | notes' lines")
    rb.add_argument("file")
    rb.add_argument("--no-claude", action="store_true")
    rb.set_defaults(fn=_ref_batch)

    rr = rs.add_parser("rebuild", help="recompute all profiles from cached data (no network)")
    rr.set_defaults(fn=lambda a: print("rebuilt:", ", ".join(__import__("tfd.pipeline", fromlist=["x"]).rebuild_profiles())) or 0)

    rl = rs.add_parser("local", help="full-frame-rate cut/transition/camera-move analysis of a local copy you are entitled to use")
    rl.add_argument("video_id")
    rl.add_argument("file")
    rl.set_defaults(fn=lambda a: print(json.dumps(__import__("tfd.pipeline", fromlist=["x"]).attach_full_rate(a.video_id, Path(a.file)), indent=2)) or 0)

    rd = rs.add_parser("deep", help="full analysis from the video itself: cuts, transitions, camera moves, audio/beat sync, "
                                     "motion graphics, stock/filler (downloads for personal use with --download)")
    rd.add_argument("video_ids", nargs="*", help="video ids (default with --all: every video in the library)")
    rd.add_argument("--all", action="store_true")
    rd.add_argument("--download", action="store_true", help="download the reference video (run on your own computer)")
    rd.add_argument("--file", help="use this local file (single video id)")
    rd.add_argument("--delete-media", action="store_true", help="delete the downloaded video after analysis")
    rd.set_defaults(fn=_deep)

    sub.add_parser("library", help="list analysed videos").set_defaults(fn=_library)
    sub.add_parser("compare", help="rebuild + print creator comparison").set_defaults(fn=_compare)
    se = sub.add_parser("search", help="full-text search of scenes/techniques")
    se.add_argument("query")
    se.add_argument("--mode", choices=["cinematic", "documentary", "personal"])
    se.add_argument("--limit", type=int, default=20)
    se.set_defaults(fn=_search)
    ak = sub.add_parser("ask", help="ask a question about the reference library")
    ak.add_argument("question", nargs="+")
    ak.set_defaults(fn=_ask)
    cx = sub.add_parser("context", help="print the library context (for Claude Code)")
    cx.add_argument("question", nargs="*")
    cx.set_defaults(fn=_context)
    an = sub.add_parser("annotate", help="merge a qualitative annotation JSON into a video profile "
                                         "(or pass a folder, e.g. examples/annotations, to import all)")
    an.add_argument("video_id", help="video id, or a folder of <video_id>.json files")
    an.add_argument("file", nargs="?")
    an.set_defaults(fn=_annotate)

    fo = sub.add_parser("footage", help="ingest a folder of your own clips (read-only)")
    fo.add_argument("folder")
    fo.add_argument("--out")
    fo.add_argument("--transcribe", action="store_true", help="speech-to-text with faster-whisper (optional extra)")
    fo.set_defaults(fn=_footage)
    rl = sub.add_parser("relink", help="point a proxy-only project at its full-resolution originals (matched by name)")
    rl.add_argument("project")
    rl.add_argument("roots", nargs="+", help="folders containing the originals (e.g. the camera card copy on your drive)")
    rl.set_defaults(fn=_relink)
    di = sub.add_parser("direct", help="plan a story + export an editable OTIO/FCP XML timeline")
    di.add_argument("project")
    di.add_argument("--minutes", type=float, default=8.0)
    di.add_argument("--direction", default="balanced", help="balanced | cinematic | documentary | personal")
    di.set_defaults(fn=_direct)
    re_ = sub.add_parser("render", help="render a preview MP4 from the plan and run QA")
    re_.add_argument("project")
    re_.set_defaults(fn=_render)

    sk = sub.add_parser("stock", help="search free stock footage (Pexels/Pixabay) and download into a project")
    sk.add_argument("query", nargs="+")
    sk.add_argument("--project")
    sk.add_argument("--get", type=int, nargs="*", help="result numbers to download into <project>/stock")
    sk.add_argument("--min-duration", type=float, default=4.0)
    sk.add_argument("-n", type=int, default=10)
    sk.set_defaults(fn=_stock)

    sv = sub.add_parser("serve", help="start the local web interface")
    sv.add_argument("--host", default="127.0.0.1")
    sv.add_argument("--port", type=int, default=8765)
    sv.set_defaults(fn=_serve)

    a = p.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
