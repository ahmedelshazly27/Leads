"""Automated QA of a rendered video: black frames, silence, abrupt loudness jumps, shot repetition, pacing."""
from __future__ import annotations

import re
import shutil
import subprocess
from collections import Counter
from pathlib import Path

from ..util import read_json, write_json


def _ffmpeg_filter_log(video: Path, vf: str | None = None, af: str | None = None) -> str:
    args = [shutil.which("ffmpeg") or "ffmpeg", "-hide_banner", "-nostats", "-i", str(video)]
    if vf:
        args += ["-vf", vf]
    else:
        args += ["-vn"]
    if af:
        args += ["-af", af]
    else:
        args += ["-an"]
    args += ["-f", "null", "-"]
    return subprocess.run(args, capture_output=True, text=True).stderr


def run_qa(project: Path, video: Path) -> dict:
    plan = read_json(project / "plan.json")
    issues = []
    black = _ffmpeg_filter_log(video, vf="blackdetect=d=0.4:pix_th=0.10")
    for m in re.finditer(r"black_start:([\d.]+) black_end:([\d.]+)", black):
        issues.append({"at": float(m.group(1)), "type": "black frames", "detail": f"until {float(m.group(2)):.2f}s"})
    sil = _ffmpeg_filter_log(video, af="silencedetect=n=-45dB:d=2")
    for m in re.finditer(r"silence_start: ([\d.]+)", sil):
        issues.append({"at": float(m.group(1)), "type": "silence", "detail": ">=2s below -45 dB"})
    ebu = _ffmpeg_filter_log(video, af="ebur128=metadata=1")
    st = [(float(t), float(s)) for t, s in re.findall(r"t:\s*([\d.]+)\s+TARGET.*?S:\s*(-?[\d.]+)", ebu)]
    for (t0, s0), (t1, s1) in zip(st, st[1:]):
        if s0 > -60 and s1 > -60 and abs(s1 - s0) > 12:
            issues.append({"at": t1, "type": "abrupt loudness change", "detail": f"{s0:.0f} -> {s1:.0f} LUFS (short-term)"})
    integrated = re.findall(r"I:\s*(-?[\d.]+) LUFS", ebu)
    uses = Counter(i["clip"] for i in plan["timeline"])
    for clip, n in uses.items():
        if n > 1:
            issues.append({"at": next(i["record_in"] for i in plan["timeline"] if i["clip"] == clip),
                           "type": "shot repetition", "detail": f"{clip} used {n} times"})
    lens = [i["record_out"] - i["record_in"] for i in plan["timeline"]]
    long_shots = [i for i in plan["timeline"] if i["audio"] != "sync" and i["record_out"] - i["record_in"] > 10]
    for i in long_shots:
        issues.append({"at": i["record_in"], "type": "pacing", "detail": "b-roll shot longer than 10s"})
    report = {"video": str(video), "integrated_lufs": float(integrated[-1]) if integrated else None,
              "shots": len(lens), "avg_shot_s": round(sum(lens) / len(lens), 2) if lens else None,
              "issues": sorted(issues, key=lambda x: x["at"]),
              "needs_human_review": [i for i in issues if i["type"] in ("black frames", "abrupt loudness change")]
              + plan.get("needs_review", [])}
    write_json(project / "qa_report.json", report)
    return report
