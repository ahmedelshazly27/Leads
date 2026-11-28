"""Export plan.json as an editable OpenTimelineIO timeline (imports natively into DaVinci Resolve 18.5+,
File > Import > Timeline). Original media is referenced in place - never copied or re-encoded."""
from __future__ import annotations

from pathlib import Path

import opentimelineio as otio

from ..log import get_logger
from ..util import safe_output_path

log = get_logger("otio")


def _rt(sec: float, rate: float) -> otio.opentime.RationalTime:
    return otio.opentime.RationalTime(round(sec * rate), rate)


def build_timeline(plan: dict, rate: float = 25.0) -> otio.schema.Timeline:
    tl = otio.schema.Timeline(name=Path(plan["project"]).name + " - AI director cut")
    tl.global_start_time = otio.opentime.RationalTime(0, rate)
    v1 = otio.schema.Track(name="V1 picture", kind=otio.schema.TrackKind.Video)
    a1 = otio.schema.Track(name="A1 sync/ambient", kind=otio.schema.TrackKind.Audio)
    for i, item in enumerate(plan["timeline"]):
        c = plan["clips"][item["clip"]]
        crate = c["fps"] or rate
        media = c.get("original_path") or c["path"]  # full-res original when relinked; the preview renders from path
        ref = otio.schema.ExternalReference(
            target_url=Path(media).resolve().as_uri(),
            available_range=otio.opentime.TimeRange(_rt(0, crate), _rt(c["duration"], crate)))
        rng = otio.opentime.TimeRange(_rt(item["src_in"], crate), _rt(item["src_out"] - item["src_in"], crate))
        meta = {"tfd": {k: item.get(k) for k in ("section", "mode", "reference", "audio", "reason", "sequence",
                                                    "technique", "grade_intensity")}}
        corr = ((plan.get("grade") or {}).get("corrections") or {}).get(item["clip"])
        if corr:
            meta["tfd"]["colour_correction"] = corr
        clip = otio.schema.Clip(name=f"{i:03d} {Path(media).name}", media_reference=ref, source_range=rng, metadata=meta)
        clip.markers.append(otio.schema.Marker(name=item["reason"][:200], marked_range=otio.opentime.TimeRange(rng.start_time, _rt(0, crate)),
                                               color=otio.schema.MarkerColor.BLUE))
        v1.append(clip)
        aclip = otio.schema.Clip(name=clip.name, media_reference=otio.schema.ExternalReference(target_url=ref.target_url,
                                 available_range=ref.available_range), source_range=rng, metadata=meta)
        a1.append(aclip)
    tl.tracks.extend([v1, a1])
    if plan.get("cutaways"):  # V2: picture-only inserts over the main track (its sound continues)
        v2 = otio.schema.Track(name="V2 cutaways", kind=otio.schema.TrackKind.Video)
        pos = 0.0
        for cw in sorted(plan["cutaways"], key=lambda c: c["record_in"]):
            c = plan["clips"][cw["clip"]]
            crate = c["fps"] or rate
            if cw["record_in"] > pos + 1e-3:
                v2.append(otio.schema.Gap(source_range=otio.opentime.TimeRange(_rt(0, rate), _rt(cw["record_in"] - pos, rate))))
            media = c.get("original_path") or c["path"]
            dur = cw["src_out"] - cw["src_in"]
            v2.append(otio.schema.Clip(
                name=f"cutaway {Path(media).name}", metadata={"tfd": {"reason": cw.get("reason", "")}},
                media_reference=otio.schema.ExternalReference(target_url=Path(media).resolve().as_uri(),
                    available_range=otio.opentime.TimeRange(_rt(0, crate), _rt(c["duration"], crate))),
                source_range=otio.opentime.TimeRange(_rt(cw["src_in"], crate), _rt(dur, crate))))
            pos = cw["record_in"] + dur
        tl.tracks.insert(1, v2)
    if plan.get("music"):
        a2 = otio.schema.Track(name="A2 music", kind=otio.schema.TrackKind.Audio)
        for m in plan["music"][:1]:
            a2.append(otio.schema.Clip(name=Path(m).name, media_reference=otio.schema.ExternalReference(target_url=Path(m).resolve().as_uri()),
                                       source_range=otio.opentime.TimeRange(_rt(0, rate), _rt(plan["planned_seconds"], rate))))
        tl.tracks.append(a2)
    for t in plan.get("titles", []):
        tl.tracks.markers.append(otio.schema.Marker(name=f"TITLE: {t['text']}", marked_range=otio.opentime.TimeRange(
            _rt(t["at"], rate), _rt(t["duration"], rate)), color=otio.schema.MarkerColor.YELLOW))
    for r in plan.get("needs_review", []):
        tl.tracks.markers.append(otio.schema.Marker(name=f"REVIEW: {r['issue']}"[:250], marked_range=otio.opentime.TimeRange(
            _rt(r["at"], rate), _rt(0, rate)), color=otio.schema.MarkerColor.RED))
    g = plan.get("grade")
    if g:
        tl.tracks.markers.append(otio.schema.Marker(
            name=f"GRADE: apply LUT {Path(g['luts']['1.0']).name} ({g['look']}) - see plan.json grade.how_to_use",
            marked_range=otio.opentime.TimeRange(_rt(0, rate), _rt(0, rate)), color=otio.schema.MarkerColor.GREEN))
    tl.metadata["tfd"] = {"decisions": plan.get("decisions", []), "audio_rules": plan.get("audio_rules", {}),
                          "grade": {k: g[k] for k in ("look", "reason", "luts", "how_to_use")} if g else None}
    return tl


def export_timeline(project: Path, plan: dict) -> dict:
    out_dir = project / "timelines"
    out_dir.mkdir(parents=True, exist_ok=True)
    tl = build_timeline(plan)
    paths = {}
    p = safe_output_path(out_dir / "director_cut.otio")
    otio.adapters.write_to_file(tl, str(p))
    paths["otio"] = p
    try:  # FCP7 XML, if the adapter plugin is installed (pip install otio-fcp-adapter)
        x = safe_output_path(out_dir / "director_cut.xml")
        otio.adapters.write_to_file(tl, str(x), adapter_name="fcp_xml")
        paths["fcp_xml"] = x
    except Exception as e:
        log.info("FCP XML not written (%s); the .otio file imports directly into Resolve 18.5+", type(e).__name__)
    try:  # Final Cut Pro X/11 FCPXML (pip install otio-fcpx-xml-adapter)
        fx = safe_output_path(out_dir / "director_cut.fcpxml")
        otio.adapters.write_to_file(tl, str(fx), adapter_name="fcpx_xml")
        paths["fcpxml"] = fx
    except Exception as e:
        log.info("FCPXML not written (%s: %s)", type(e).__name__, str(e)[:200])
    from .captions import caption_cues, load_transcripts, write_srt
    cues = caption_cues(plan, load_transcripts(project))
    if cues:  # Resolve: File > Import > Subtitle; Final Cut: File > Import > Captions
        paths["srt"] = write_srt(cues, safe_output_path(out_dir / "director_cut.srt"))
    return paths


def reexport(project: Path) -> dict:
    """Re-export a hand-edited plan.json (the CLAUDE.md flow: review and improve the plan, then export).

    Recomputes record positions from the trims, adds any clip from footage.json the planner had skipped (with its
    colour correction), fills grade intensities, and writes the OTIO/FCPXML/SRT timelines."""
    from ..util import read_json, write_json
    from .grade import INTENSITY_BY_MODE, _probe_log, clip_correction
    plan = read_json(project / "plan.json")
    footage = {c["id"]: c for c in read_json(project / "footage.json")["clips"]}
    grade = plan.setdefault("grade", {})
    corrections = grade.setdefault("corrections", {})
    def register(cid: str) -> dict:
        gen = plan["clips"].get(cid, {})
        if gen.get("generated"):  # maps/cards made by tfd: no footage record, never graded
            if not Path(gen["path"]).is_file():
                raise FileNotFoundError(f"generated clip {cid} missing: {gen['path']}")
            corrections.pop(cid, None)
            return {"meta": {"duration": gen["duration"]}}
        if cid not in footage:
            raise KeyError(f"plan uses unknown clip {cid}")
        c = footage[cid]
        if cid not in plan["clips"]:
            plan["clips"][cid] = {"path": c["path"], **({"original_path": c["original_path"]} if c.get("original_path") else {}),
                                  "fps": c["meta"]["fps"], "duration": c["meta"]["duration"],
                                  "width": c["meta"]["width"], "height": c["meta"]["height"],
                                  "category": c.get("category", "hand-picked")}
        if cid not in corrections:
            meta = c["meta"] if "log_profile" in c["meta"] else {**c["meta"], "log_profile": _probe_log(c["path"])}
            corrections[cid] = clip_correction([f["path"] for f in c.get("frames", [])], meta)
        return c

    for cw in plan.get("cutaways", []):
        c = register(cw["clip"])
        if cw["src_out"] <= cw["src_in"] or cw["src_out"] > c["meta"]["duration"] + 0.05:
            raise ValueError(f"bad cutaway trim for {cw['clip']}: {cw['src_in']}-{cw['src_out']}")
    rec = 0.0
    for item in plan["timeline"]:
        cid = item["clip"]
        c = register(cid)
        dur = float(item["src_out"]) - float(item["src_in"])
        if dur <= 0 or item["src_out"] > c["meta"]["duration"] + 0.05:
            raise ValueError(f"bad trim for {cid}: {item['src_in']}-{item['src_out']} (clip {c['meta']['duration']:.2f}s)")
        item.setdefault("grade_intensity", INTENSITY_BY_MODE.get(item.get("mode"), 0.8))
        item.setdefault("reason", "hand edit")
        item["record_in"] = round(rec, 3)
        rec += dur
        item["record_out"] = round(rec, 3)
    plan["planned_seconds"] = round(rec, 3)
    write_json(project / "plan.json", plan)
    return export_timeline(project, plan)
