"""Cutaways: a second picture track (V2). Footage from another clip covers the main shot while the main shot's
sound and subtitles continue, the J/L-cut grammar Joe Hattab and Omar Farooq use to show the place while someone
talks. plan["cutaways"] = [{clip, src_in, src_out, record_in, reason}] in record (timeline) seconds.
"""
from __future__ import annotations

from pathlib import Path


def windows_for(item: dict, cutaways: list[dict]) -> list[dict]:
    """Cutaways overlapping a timeline item, clipped to it, in the item's local seconds (a..b), with the
    source in-point shifted by however much was clipped off the front."""
    r0, r1 = item["record_in"], item["record_out"]
    out = []
    for cw in cutaways:
        start = cw["record_in"]
        end = start + (cw["src_out"] - cw["src_in"])
        a, b = max(start, r0), min(end, r1)
        if b - a < 0.2:
            continue
        out.append({"clip": cw["clip"], "a": round(a - r0, 3), "b": round(b - r0, 3),
                    "src_in": round(cw["src_in"] + (a - start), 3)})
    return out


def cutaway_chain(windows: list[dict], plan: dict, first_input: int, vf: str) -> tuple[list[str], str, str]:
    """FFmpeg inputs and filters overlaying each cutaway (graded like its clip) on [base] -> [cw_last]."""
    from .grade import ffmpeg_filters
    grade = plan.get("grade") or {}
    inputs, chain, last = [], "", "base"
    for k, w in enumerate(windows):
        c = plan["clips"][w["clip"]]
        dur = w["b"] - w["a"]
        inputs += ["-ss", f"{w['src_in']:.3f}", "-t", f"{dur:.3f}", "-i", c["path"]]
        lut = (grade.get("luts") or {}).get(f"{grade.get('cutaway_intensity', 0.7):.1f}")
        gf = ffmpeg_filters((grade.get("corrections") or {}).get(w["clip"], {}), Path(lut) if lut else None)
        filt = (gf + "," + vf) if gf else vf
        idx = first_input + k
        chain += (f";[{idx}:v]{filt},setpts=PTS-STARTPTS+{w['a']}/TB[cw{k}]"
                  f";[{last}][cw{k}]overlay=0:0:eof_action=pass:enable='between(t,{w['a']},{w['b']})'[cwo{k}]")
        last = f"cwo{k}"
    return inputs, chain, last
