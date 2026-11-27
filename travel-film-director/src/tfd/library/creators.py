"""Aggregate many VideoProfiles into creator style profiles and compare creators."""
from __future__ import annotations

from collections import Counter

import numpy as np

from ..schemas import VideoProfile

METRICS = [
    # (key path, label, unit, higher means)
    ("editing_characteristics.est_cuts_per_min", "Estimated cuts per minute", "", "faster cutting"),
    ("editing_characteristics.median_sequence_s", "Median visual sequence length", "s", "longer sequences"),
    ("editing_characteristics.pacing_variability", "Pacing variability (std of cuts/min per minute)", "", "more tempo changes"),
    ("editing_characteristics.full_rate.cuts_per_min", "Cuts per minute (full-rate, exact)", "", "faster cutting"),
    ("editing_characteristics.full_rate.median_shot_s", "Median shot length (full-rate, exact)", "s", "longer shots"),
    ("editing_characteristics.full_rate.moving_shot_share", "Shots with camera movement (full-rate)", "%", "more camera movement"),
    ("editing_characteristics.full_rate.handheld_share", "Handheld shots (full-rate)", "%", "more handheld"),
    ("editing_characteristics.camera_motion.same_shot_pairs", "Sample pairs still in the same shot after 10 s (per video)", "", "longer-held shots"),
    ("editing_characteristics.moving_camera_share", "Moving camera (of measured same-shot pairs)", "%", "more camera movement"),
    ("editing_characteristics.push_pull_share", "Push-in / pull-out moves", "%", "more zoom/dolly moves"),
    ("editing_characteristics.pan_tilt_share", "Pan / tilt / track moves", "%", "more lateral moves"),
    ("editing_characteristics.orbit_roll_share", "Orbit / roll moves", "%", "more orbiting moves"),
    ("sound_design.speech_coverage", "Share of runtime with speech", "%", "more talking"),
    ("sound_design.non_speech_fraction", "Share of runtime without speech (music/ambience)", "%", "more breathing room"),
    ("sound_design.words_per_minute_overall", "Words per minute (whole video)", "", "denser narration"),
    ("storytelling.first_person_singular", "First-person singular language", "%", "more personal"),
    ("storytelling.second_person", "Direct address to viewer ('you')", "%", "more audience address"),
    ("storytelling.context_facts", "Contextual / factual vocabulary", "%", "more documentary context"),
    ("storytelling.reflection", "Reflective vocabulary", "%", "more introspection"),
    ("storytelling.closeup_frame_fraction", "Frames with face close-ups", "%", "more to-camera / people"),
    ("storytelling.face_frame_fraction", "Frames with any detected face", "%", "more human presence"),
    ("color_characteristics.mean_saturation", "Mean saturation", "", "more saturated"),
    ("color_characteristics.mean_contrast", "Mean contrast", "", "punchier"),
    ("color_characteristics.mean_warmth", "Mean warmth (R-B)", "", "warmer"),
    ("color_characteristics.mean_brightness", "Mean brightness", "", "brighter"),
    ("color_characteristics.letterboxed_frame_fraction", "Letterboxed (cinematic aspect) frames", "%", "more letterboxing"),
    ("style_mode_mix.cinematic", "Cinematic mode share", "%", "more cinematic"),
    ("style_mode_mix.documentary", "Documentary mode share", "%", "more documentary"),
    ("style_mode_mix.personal", "Personal mode share", "%", "more personal"),
    ("duration", "Video length", "min", "longer"),
]


def _get(p: VideoProfile, path: str):
    cur = p.model_dump()
    for part in path.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur


def creator_profile(name: str, profiles: list[VideoProfile], description: str = "", weight: float = 1.0) -> dict:
    metrics = {}
    for key, label, unit, _ in METRICS:
        speech_based = key.startswith("sound_design") or (key.startswith("storytelling") and "frame_fraction" not in key) \
            or key.startswith("style_mode_mix")
        usable = [p for p in profiles if not (speech_based and (p.sources.transcript == "none"
                                                                 or p.sources.transcript_quality == "suspect"))]
        vals = [v for v in (_get(p, key) for p in usable) if isinstance(v, (int, float))]
        if vals:
            metrics[key] = {"label": label, "mean": round(float(np.mean(vals)), 4), "min": round(min(vals), 4),
                            "max": round(max(vals), 4), "n": len(vals), "unit": unit}
        elif speech_based and key.startswith("style_mode_mix"):
            vis = [v for v in (_get(p, key) for p in profiles) if isinstance(v, (int, float))]
            if vis:
                metrics[key] = {"label": label + " (visual-only, low confidence)", "mean": round(float(np.mean(vis)), 4),
                                "min": round(min(vis), 4), "max": round(max(vis), 4), "n": len(vis), "unit": unit}
    techniques = Counter(t.name for p in profiles for t in p.techniques if t.name != "chapter")
    scene_tech = Counter(x for p in profiles for s in p.scenes for x in s.editing_techniques)
    shots = Counter()
    funcs = Counter()
    for p in profiles:
        for s in p.scenes:
            shots[s.shot_type] += s.duration
            funcs[s.narrative_function] += s.duration
    total = sum(shots.values()) or 1
    examples = []
    for p in profiles:
        for t in p.techniques:
            if t.name in ("speech-free montage", "talking to camera", "replay peak", "atmospheric non-speech sequence"):
                examples.append({"video_id": p.video_id, "title": p.title, "start": t.start, "end": t.end,
                                 "name": t.name, "description": t.description,
                                 "link": f"{p.url}&t={int(t.start)}s"})
    return {
        "creator": name,
        "description": description,
        "weight": weight,
        "videos": [{"video_id": p.video_id, "title": p.title, "duration": p.duration, "url": p.url,
                    "transcript": p.sources.transcript} for p in profiles],
        "data_gaps": [f"{p.title}: {p.sources.transcript_quality_note}" for p in profiles
                        if p.sources.transcript_quality == "suspect"],
        "metrics": metrics,
        "hook_patterns": [p.hook.get("pattern") for p in profiles],
        "shot_type_share": {k: round(v / total, 3) for k, v in shots.most_common()},
        "narrative_function_share": {k: round(v / total, 3) for k, v in funcs.most_common()},
        "signature_techniques": dict((techniques + scene_tech).most_common(10)),
        "grading_tags": dict(Counter(t for p in profiles for t in p.color_characteristics.get("grading_tags", [])).most_common()),
        "palette": [c for c, _ in Counter(c for p in profiles for c in p.color_characteristics.get("dominant_palette", [])).most_common(8)],
        "qualitative": [p.qualitative for p in profiles if p.qualitative],
        "timestamped_examples": examples[:40],
    }


def _fmt(v: float, unit: str) -> str:
    if unit == "%":
        return f"{v * 100:.1f}%" if abs(v) < 0.1 else f"{v * 100:.0f}%"
    if unit == "min":
        return f"{v / 60:.1f} min"
    if unit == "s":
        return f"{v:.0f}s"
    return f"{v:.2f}"


def compare(creators: list[dict]) -> dict:
    """Metric table + plain-language differences (largest relative gaps first)."""
    table = []
    statements = []
    for key, label, unit, meaning in METRICS:
        row = {"metric": key, "label": label, "values": {}}
        for c in creators:
            m = c["metrics"].get(key)
            if m:
                row["values"][c["creator"]] = m["mean"]
        table.append(row)
        vals = row["values"]
        if len(vals) >= 2 and key != "duration":
            hi = max(vals, key=vals.get)
            lo = min(vals, key=vals.get)
            a, b = vals[hi], vals[lo]
            spread = (a - b) / (abs(a) + abs(b) + 1e-9)
            meaningful = (a - b) > (0.005 if unit == "%" else 0.02)
            if spread > 0.15 and meaningful:
                statements.append((spread, f"{label}: {hi} {_fmt(a, unit)} vs {lo} {_fmt(b, unit)} - {hi} shows {meaning}."))
    statements.sort(key=lambda x: -x[0])
    dominant = {c["creator"]: max(("cinematic", "documentary", "personal"),
                                  key=lambda m: c["metrics"].get(f"style_mode_mix.{m}", {}).get("mean", 0)) for c in creators}
    return {"creators": [c["creator"] for c in creators], "table": table,
            "key_differences": [s for _, s in statements], "dominant_mode": dominant}


def comparison_markdown(cmp: dict, creators: list[dict]) -> str:
    names = cmp["creators"]
    lines = ["# Creator comparison", "", "Mean across each creator's videos, with the per-video range in brackets.", "",
             "| Metric | " + " | ".join(names) + " |", "|---|" + "---|" * len(names)]
    units = {k: u for k, _, u, _ in METRICS}
    by_name = {c["creator"]: c for c in creators}

    def cell(n, row):
        if n not in row["values"]:
            return "-"
        u = units[row["metric"]]
        m = by_name[n]["metrics"].get(row["metric"], {})
        rng = f" [{_fmt(m['min'], u)}–{_fmt(m['max'], u)}]" if m.get("n", 1) > 1 else ""
        return _fmt(row["values"][n], u) + rng

    for row in cmp["table"]:
        cells = [cell(n, row) for n in names]
        lines.append(f"| {row['label']} | " + " | ".join(cells) + " |")
    lines += ["", "Videos analysed: " + ", ".join(f"{c['creator']} {len(c['videos'])}" for c in creators)]
    lines += ["", "## Key differences", ""] + [f"- {s}" for s in cmp["key_differences"]]
    lines += ["", "## Dominant storytelling mode", ""] + [f"- **{k}**: {v}" for k, v in cmp["dominant_mode"].items()]
    for c in creators:
        lines += ["", f"## {c['creator']}", "",
                  f"- Videos: " + "; ".join(f"[{v['title']}]({v['url']})" for v in c["videos"]),
                  f"- Hook patterns: " + "; ".join(h for h in c["hook_patterns"] if h),
                  f"- Signature techniques: " + ", ".join(f"{k} ({v})" for k, v in c["signature_techniques"].items()),
                  f"- Shot mix: " + ", ".join(f"{k} {v:.0%}" for k, v in list(c["shot_type_share"].items())[:5]),
                  f"- Grading: " + ", ".join(c["grading_tags"]) + "; palette " + " ".join(c["palette"][:6])]
        lines += [f"- Data gap: {g}" for g in c.get("data_gaps", [])]
        for q in c.get("qualitative", []):
            if q.get("summary"):
                lines.append(f"- Claude's read: {q['summary']}")
    return "\n".join(lines) + "\n"
