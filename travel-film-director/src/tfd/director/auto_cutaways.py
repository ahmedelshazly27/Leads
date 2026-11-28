"""Automatic cutaways: turn a vlog into a documentary by covering talking-head time with b-roll from the same
moment of the trip, the way Joe Hattab and Omar Farooq keep the place on screen while someone talks.

For each talking shot (sync sound, a face filling the frame) the speaker is shown first, then the rest is covered
with 4-5 s inserts separated by short returns to the speaker. Inserts come from unused, face-free, sharp, steady,
well-exposed moments of clips shot closest in time. Coverage stops when the presenter's share of the runtime
reaches the target. Nothing is reused: inserts never overlap footage already in the cut.
"""
from __future__ import annotations

import datetime as dt
import re

FACE_TALK, FACE_BROLL = 0.02, 0.008       # max_face_frac: talking head vs no faces at all
LEAD_IN, TAIL, INSERT, GAP = 2.5, 1.0, 4.5, 1.6
MAX_SHAKE, MIN_SHARP_RATIO = 2.0, 0.6
BRIGHT_RANGE = (0.12, 0.85)
MAX_GAP_HOURS = 12.0                      # only footage from the same day
MAX_USES_PER_CLIP = 3                     # variety: no long run of inserts from one clip
NEIGHBOUR_S = 12.0                        # sampled frames this close belong to the same stretch


def _when(name: str) -> dt.datetime | None:
    m = re.search(r"(\d{8})(\d{6})", name)
    return dt.datetime.strptime(m.group(1) + m.group(2), "%Y%m%d%H%M%S") if m else None


def _face(clip: dict, a: float, b: float) -> float:
    fr = [f for f in clip.get("frames", []) if a - 5 <= f["t"] <= b + 5] or clip.get("frames", [])
    return max((f.get("max_face_frac") or 0) for f in fr) if fr else 0.0


def _talk_items(plan: dict, footage: dict) -> list[dict]:
    return [it for it in plan["timeline"] if it.get("audio") == "sync" and it["clip"] in footage
            and _face(footage[it["clip"]], it["src_in"], it["src_out"]) > FACE_TALK]


def _covered(plan: dict, r0: float, r1: float) -> float:
    total = 0.0
    for cw in plan.get("cutaways", []):
        s = cw["record_in"]
        total += max(0.0, min(s + cw["src_out"] - cw["src_in"], r1) - max(s, r0))
    return total


def presenter_share(plan: dict, footage: dict) -> float:
    """Fraction of the runtime showing a talking face that no cutaway covers."""
    runtime = sum(it["src_out"] - it["src_in"] for it in plan["timeline"]) or 1.0
    talk = sum(it["record_out"] - it["record_in"] - _covered(plan, it["record_in"], it["record_out"])
               for it in _talk_items(plan, footage))
    return talk / runtime


def _used(plan: dict) -> dict[str, list[tuple[float, float]]]:
    used: dict[str, list[tuple[float, float]]] = {}
    for x in plan["timeline"] + plan.get("cutaways", []):
        used.setdefault(x["clip"], []).append((x["src_in"], x["src_out"]))
    return used


def _candidates(footage: dict, near: dt.datetime | None, exclude: set[str]) -> list[tuple[float, dict, dict]]:
    """(score, clip, frame) for clean b-roll moments, best first: closest in time, then sharpest."""
    out = []
    for c in footage.values():
        if c["id"] in exclude or "error" in c or (c.get("motion") or {}).get("shake_px", 0) > MAX_SHAKE:
            continue

        when = _when(c["name"])
        hours = abs((when - near).total_seconds()) / 3600 if when and near else 99
        if hours > MAX_GAP_HOURS:
            continue
        sharp = sorted(f.get("sharpness", 0) for f in c.get("frames", []))
        med = sharp[len(sharp) // 2] if sharp else 0
        frames = c.get("frames", [])
        for k, f in enumerate(frames):
            # the moment and its neighbouring samples must be face-free: one missed detection inside a selfie
            # stretch (an angled face) is not b-roll
            nbrs = [g for g in frames[max(0, k - 1):k + 2] if abs(g["t"] - f["t"]) <= NEIGHBOUR_S]
            if any((g.get("max_face_frac") or 0) > FACE_BROLL for g in nbrs):
                continue
            if not BRIGHT_RANGE[0] <= f.get("brightness", 0.5) <= BRIGHT_RANGE[1]:
                continue
            if f.get("sharpness", 0) < max(5.0, med * MIN_SHARP_RATIO):
                continue
            out.append((hours - f.get("sharpness", 0) / 1e4, c, f))
    return sorted(out, key=lambda x: x[0])


def _free_window(clip: dict, centre: float, used: list[tuple[float, float]]) -> tuple[float, float] | None:
    """A 4.5 s window around `centre` that isn't in the cut yet and has no speech (speech means a talking
    head even when face detection misses an angled selfie)."""
    d = clip["meta"]["duration"]
    a = max(0.0, min(d - INSERT, centre - INSERT / 2))
    b = a + INSERT
    speech = [(s["start"], s["end"]) for s in clip.get("transcript") or []]
    if b > d or any(min(b, ub) - max(a, ua) > 0 for ua, ub in used + speech):
        return None
    return round(a, 2), round(b, 2)


def auto_cutaways(plan: dict, footage: dict, target_share: float = 0.25) -> list[dict]:
    """Add cutaways to plan['cutaways'] until the presenter's on-screen share is at most `target_share`."""
    plan.setdefault("cutaways", [])
    used = _used(plan)
    added = []
    for it in sorted(_talk_items(plan, footage), key=lambda i: -(i["record_out"] - i["record_in"])):
        if presenter_share(plan, footage) <= target_share:
            break
        near = _when(footage[it["clip"]]["name"])
        cands = _candidates(footage, near, exclude={it["clip"]})
        t = it["record_in"] + LEAD_IN
        while t + INSERT <= it["record_out"] - TAIL and presenter_share(plan, footage) > target_share:
            if _covered(plan, t, t + INSERT) > 0:
                t += 0.5
                continue
            for _, c, f in cands:
                if sum(1 for x in plan["cutaways"] if x["clip"] == c["id"] and x.get("auto")) >= MAX_USES_PER_CLIP:
                    continue
                win = _free_window(c, f["t"], used.get(c["id"], []))
                if win:
                    cw = {"clip": c["id"], "src_in": win[0], "src_out": win[1], "record_in": round(t, 3),
                          "reason": f"auto b-roll from the same moment ({c['name']} @ {win[0]:.0f}s)", "auto": True}
                    plan["cutaways"].append(cw)
                    used.setdefault(c["id"], []).append(win)
                    added.append(cw)
                    break
            else:
                break  # nothing clean left near this moment
            t += INSERT + GAP
    plan["cutaways"].sort(key=lambda c: c["record_in"])
    return added
