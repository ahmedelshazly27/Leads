"""Rule-based creative director: classify clips, build a story, choose a storytelling mode per sequence,
pick the closest reference creator for that mode, and emit an explainable timeline plan.

It never invents events: titles and narration come only from the user's `trip_notes.md` (optional) or
are emitted as `needs_input` placeholders for the user. Claude Code can rewrite `plan.json` before export.
"""
from __future__ import annotations

import datetime as dt
import json
import re
from pathlib import Path

from ..analysis import transcript as tx
from . import playbook
from ..config import get_settings
from ..log import get_logger
from ..util import fmt_ts, read_json, write_json

log = get_logger("director")
TRANSPORT = {"train", "flight", "plane", "airport", "bus", "car", "drive", "driving", "taxi", "boat", "ferry", "station", "road"}


def classify(clip: dict) -> tuple[str, list[str]]:
    shot = clip.get("shot_type", "")
    words = " ".join(s["text"] for s in clip.get("transcript", []))
    lang = tx.language_stats(words) if words else {}
    speech = sum(s["end"] - s["start"] for s in clip.get("transcript", [])) / max(1e-6, clip["meta"]["duration"])
    motion = clip.get("motion", {})
    ev = [f"shot: {shot}", f"speech {speech:.0%}"]
    fp = lang.get("first_person_singular", 0) + lang.get("first_person_plural", 0)
    if speech > 0.3 and "close-up" in shot and fp > 0.03:
        return "first-person / to-camera", ev + [f"first-person words {fp:.0%}"]
    if speech > 0.3 and tx.dialogue_score([tx.TranscriptSegment(**s) for s in clip["transcript"]]) > 0.3:
        return "conversation", ev
    if speech > 0.4 and ("people" in shot or "close-up" in shot):
        return "interview", ev
    if words and set(tx.words(words)) & TRANSPORT or re.search(r"(train|flight|plane|bus|car|boat)", clip["name"], re.I):
        return "transport / journey", ev
    if "possible drone/aerial" in clip.get("visual_tags", []) or ("establishing" in shot and clip["meta"]["height"] >= 2160):
        return "establishing", ev
    if "establishing" in shot or "landscape" in shot:
        return "landscape", ev
    if motion.get("shake_px", 0) > 2.0 and motion.get("camera_movement", "").startswith("pan"):
        return "action", ev + [f"motion {motion}"]
    if "people" in shot or "street" in shot:
        return "cultural / street life", ev
    return "cinematic b-roll", ev


MODE_FOR_CATEGORY = {
    "first-person / to-camera": "personal", "conversation": "documentary", "interview": "documentary",
    "transport / journey": "personal", "establishing": "cinematic", "landscape": "cinematic",
    "action": "cinematic", "cultural / street life": "documentary", "cinematic b-roll": "cinematic",
}

DEFAULT_SHOT_LEN = {"cinematic": 3.5, "documentary": 4.5, "personal": 6.0}


def _creator_for_mode(mode: str, creators: list[dict]) -> tuple[str | None, dict]:
    best, best_score, params = None, -1.0, {}
    for c in creators:
        share = c["metrics"].get(f"style_mode_mix.{mode}", {}).get("mean", 0) * c.get("weight", 1.0)
        if share > best_score:
            best, best_score = c, share
    if not best:
        return None, {"shot_len": DEFAULT_SHOT_LEN[mode]}
    cpm = best["metrics"].get("editing_characteristics.est_cuts_per_min", {}).get("mean", 0)
    shot_len = max(2.0, min(8.0, 60 / cpm if cpm else DEFAULT_SHOT_LEN[mode]))
    return best["creator"], {"shot_len": round(shot_len, 2),
                             "non_speech_share": best["metrics"].get("sound_design.non_speech_fraction", {}).get("mean")}


def _sequences(clips: list[dict], gap_min: float = 45) -> list[list[dict]]:
    def ts(c):
        t = c["meta"].get("creation_time")
        try:
            return dt.datetime.fromisoformat(t.replace("Z", "+00:00")).timestamp() if t else None
        except ValueError:
            return None
    ordered = sorted(clips, key=lambda c: (ts(c) or 0, c["name"]))
    seqs, cur, last = [], [], None
    for c in ordered:
        t = ts(c)
        if cur and t is not None and last is not None and t - last > gap_min * 60:
            seqs.append(cur); cur = []
        cur.append(c)
        last = t if t is not None else last
    if cur:
        seqs.append(cur)
    return seqs


def _best_window(clip: dict, length: float) -> tuple[float, float]:
    d = clip["meta"]["duration"]
    if clip.get("transcript"):
        s = clip["transcript"][0]["start"]
        e = min(d, max(clip["transcript"][-1]["end"], s + length))
        return round(s, 2), round(e, 2)
    frames = clip.get("frames", [])
    if frames:
        best = max(frames, key=lambda f: f["sharpness"])
        c = best["t"]
    else:
        c = d / 2
    s = max(0.0, min(d - length, c - length / 2))
    return round(s, 2), round(min(d, s + length), 2)


def plan_project(project: Path, target_minutes: float = 8.0, direction: str = "balanced") -> dict:
    footage = read_json(project / "footage.json")
    notes_path = project / "trip_notes.md"
    notes = notes_path.read_text(encoding="utf-8") if notes_path.is_file() else ""
    settings = get_settings()
    creators = []
    for p in settings.library_dir.glob("*/creator_profile.json"):
        creators.append(read_json(p))
    clips = [c for c in footage["clips"] if "error" not in c and "duplicate_of" not in c and c.get("quality", 0) >= 0.4]
    if not clips:
        raise ValueError("No usable clips (all failed, duplicates, or below quality threshold).")
    for c in clips:
        c["category"], c["category_evidence"] = classify(c)
        mode = MODE_FOR_CATEGORY[c["category"]]
        if direction in ("cinematic", "documentary", "personal") and c["category"] in ("cinematic b-roll", "cultural / street life"):
            mode = direction
        c["mode"] = mode

    target = target_minutes * 60
    items, decisions = [], []
    hook_key = playbook.choose_hook([c["category"] for c in clips], any(c.get("transcript") for c in clips), direction)
    hook_from, hook_recipe = playbook.HOOK_FORMULAS[hook_key]
    decisions.append(f"Hook formula: {hook_from} - {hook_recipe}.")
    # 1. hook: the strongest cinematic shot(s) + the strongest spoken moment, if any
    cine = sorted([c for c in clips if c["mode"] == "cinematic"], key=lambda c: -c["quality"])[:3]
    voice = sorted([c for c in clips if c.get("transcript")], key=lambda c: -c["quality"])[:1]
    used: set[str] = set()
    t = 0.0
    hook_creator, hook_p = _creator_for_mode("cinematic", creators)
    for c in cine:
        s, e = _best_window(c, hook_p["shot_len"])
        items.append({"clip": c["id"], "src_in": s, "src_out": e, "section": "hook", "mode": "cinematic",
                      "reference": hook_creator, "audio": "music", "reason":
                      f"Hook: highest-quality {c['category']} shot (q={c['quality']}); speech-free opening modelled on "
                      f"{hook_creator or 'default cinematic pacing'} ({hook_p['shot_len']}s shots)."})
        used.add(c["id"])
    for c in voice:
        s, e = _best_window(c, 8)
        items.append({"clip": c["id"], "src_in": s, "src_out": min(e, s + 12), "section": "hook", "mode": "personal",
                      "audio": "sync", "reason": "Hook line: first spoken moment from your own footage (no invented dialogue)."})
        used.add(c["id"])
    decisions.append("Opening hook = best visuals with music, then a real spoken line from the footage.")

    # 2. body: chronological sequences, each opened by an establishing/landscape shot when one exists
    seqs = _sequences([c for c in clips if c["id"] not in used])
    bridges = []
    prev_cats = None
    for si, seq in enumerate(seqs):
        cats = [c["category"] for c in seq]
        new_loc = any(c in ("establishing",) for c in cats) and si > 0
        b_tech, b_from = playbook.bridge_for(prev_cats, cats, new_loc)
        bridges.append({"sequence": si + 1, "technique": b_tech, "borrowed_from": b_from})
        prev_cats = cats
        modes = [c["mode"] for c in seq]
        mode = max(set(modes), key=modes.count)
        ref, params = _creator_for_mode(mode, creators)
        seq_sorted = sorted(seq, key=lambda c: (0 if c["category"] in ("establishing", "landscape") else 1))
        decisions.append(f"Sequence {si + 1}: {len(seq)} clips, mostly {mode} -> pacing from {ref or 'defaults'} "
                         f"(~{params['shot_len']}s per b-roll shot).")
        for c in seq_sorted:
            spoken = bool(c.get("transcript"))
            length = params["shot_len"] if not spoken else min(20.0, c["meta"]["duration"])
            s, e = _best_window(c, length)
            if e - s < 1.0:
                continue
            section = "establishing" if c["category"] in ("establishing", "landscape") and c is seq_sorted[0] else "body"
            tech, tech_from, tip = playbook.SCENE_RULES.get(c["category"], ("", "", ""))
            items.append({"clip": c["id"], "src_in": s, "src_out": e, "section": section, "sequence": si + 1,
                          "mode": c["mode"], "reference": ref, "audio": "sync" if spoken else "ambient+music",
                          "technique": tech, "technique_from": tech_from, "technique_tip": tip,
                          "reason": f"{c['category']} ({', '.join(c['category_evidence'][:2])}); q={c['quality']}; "
                                    f"approach: {tech} [{tech_from}]"})
    # 3. trim to target duration: drop lowest-quality non-speech body shots first
    qual = {c["id"]: c["quality"] for c in clips}
    total = sum(i["src_out"] - i["src_in"] for i in items)
    while total > target and any(i["section"] == "body" and i["audio"] != "sync" for i in items):
        worst = min((i for i in items if i["section"] == "body" and i["audio"] != "sync"), key=lambda i: qual[i["clip"]])
        items.remove(worst)
        total -= worst["src_out"] - worst["src_in"]
        decisions.append(f"Cut {worst['clip']} (lowest quality b-roll) to approach the {target_minutes:.0f} min target.")
    # timeline positions + review markers
    rec = 0.0
    for i in items:
        i["record_in"] = round(rec, 2)
        rec += i["src_out"] - i["src_in"]
        i["record_out"] = round(rec, 2)
    review = []
    if not notes:
        review.append({"at": 0, "issue": "No trip_notes.md - location titles and narration were not generated. "
                       "Add facts (places, dates, people's names you have permission to use) to enable them."})
    narration = []
    for line in notes.splitlines():
        m = re.match(r"\s*-\s*narration\s*\((\w+)\)\s*:\s*(.+)", line, re.I)
        if m:
            narration.append({"sequence": m.group(1), "text": m.group(2).strip(), "source": "trip_notes.md"})
    titles = []
    for line in notes.splitlines():
        m = re.match(r"\s*-\s*location\s*\((\d+)\)\s*:\s*(.+)", line, re.I)
        if m:
            seq_no = int(m.group(1))
            first = next((i for i in items if i.get("sequence") == seq_no), None)
            if first:
                titles.append({"at": first["record_in"] + 0.5, "duration": 3.0, "text": m.group(2).strip()})
    for b in bridges:
        first = next((i for i in items if i.get("sequence") == b["sequence"]), None)
        if first and not any(abs(t["at"] - first["record_in"] - 0.5) < 0.01 for t in titles):
            review.append({"at": first["record_in"], "issue": f"Sequence {b['sequence']}: {b['technique']} "
                           f"[{b['borrowed_from']}] - add the place name in trip_notes.md (- location ({b['sequence']}): ...)"})
    locations = {}
    for line in notes.splitlines():
        m = re.match(r"\s*-\s*location\s*\((\d+)\)\s*:\s*(.+)", line, re.I)
        if m:
            locations[int(m.group(1))] = m.group(2).strip()
    stock_suggestions = []
    for si, seq in enumerate(seqs):
        if not any(c["category"] in ("establishing", "landscape") for c in seq):
            place = locations.get(si + 1)
            stock_suggestions.append({
                "sequence": si + 1, "need": "establishing / aerial shot to open the sequence (map-bridge grammar: Joe, Omar)",
                "query": f"{place} aerial drone" if place else None,
                "how": (f"tfd stock search \"{place} aerial drone\" --project <project>" if place else
                        "add '- location (N): <place>' to trip_notes.md to get a search query")})
    music = sorted(str(p) for p in (project / "music").glob("*") if p.suffix.lower() in (".mp3", ".wav", ".m4a", ".flac")) \
        if (project / "music").is_dir() else []
    if not music:
        review.append({"at": 0, "issue": "No music in <project>/music - music track left empty (add licensed tracks)."})
    plan = {
        "project": str(project), "created": dt.datetime.now().isoformat(timespec="seconds"),
        "target_seconds": target, "planned_seconds": round(rec, 2), "direction": direction,
        "clips": {c["id"]: {"path": c["path"], "fps": c["meta"]["fps"], "duration": c["meta"]["duration"],
                            "width": c["meta"]["width"], "height": c["meta"]["height"], "category": c["category"]}
                  for c in clips},
        "hook_formula": {"from": hook_from, "recipe": hook_recipe}, "bridges": bridges,
        "stock_suggestions": stock_suggestions,
        "timeline": items, "titles": titles, "narration": narration, "music": music,
        "audio_rules": {"dialogue_lufs": -16, "music_under_speech_db": -18, "music_alone_db": -8, "ambient_db": -14},
        "decisions": decisions, "needs_review": review,
    }
    write_json(project / "plan.json", plan)
    log.info("plan: %d items, %s planned vs %s target", len(items), fmt_ts(rec), fmt_ts(target))
    return plan
