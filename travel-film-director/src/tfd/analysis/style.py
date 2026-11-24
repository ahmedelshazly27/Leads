"""Heuristic shot-type, narrative-function and style-mode classification.

These rules are deliberately transparent: every label carries the evidence that produced it, so the
creative director (and the user) can see *why* a scene was treated as cinematic, documentary or personal.
Claude annotations (optional) can override them later.
"""
from __future__ import annotations

from ..schemas import FrameObs


def shot_type(fr: list[FrameObs]) -> tuple[str, float, list[str]]:
    if not fr:
        return "unknown", 0.0, []
    face_frames = [f for f in fr if f.faces]
    max_face = max((f.max_face_frac for f in fr), default=0.0)
    sky = sum(f.sky_frac for f in fr) / len(fr)
    edge = sum(f.edge_density for f in fr) / len(fr)
    bright = sum(f.brightness for f in fr) / len(fr)
    text = max(f.text_like for f in fr)
    face_share = len(face_frames) / len(fr)
    ev: list[str] = []
    if text > 0.45 and len(fr) <= 2:
        return "title / graphic card", 0.5, [f"text-like overlay score {text:.2f}"]
    if face_share >= 0.5 and max_face >= 0.33:
        return "close-up on a person (talking head / selfie)", 0.6, [f"faces in {face_share:.0%} of frames, max face {max_face:.0%} of frame height"]
    if face_share >= 0.4 and max_face >= 0.15:
        return "medium shot with people", 0.5, [f"faces in {face_share:.0%} of frames, max face {max_face:.0%}"]
    if bright < 0.2:
        ev.append(f"mean brightness {bright:.2f}")
        return "low-light / night shot", 0.45, ev
    if sky > 0.35 and edge < 0.12:
        return "wide establishing / landscape", 0.55, [f"sky in top third {sky:.0%}, edge density {edge:.2f}"]
    if edge > 0.16:
        return "busy street / detail-rich scene", 0.4, [f"edge density {edge:.2f}"]
    if face_frames:
        return "wide shot with people", 0.35, [f"small faces in {face_share:.0%} of frames"]
    return "general b-roll", 0.3, [f"sky {sky:.0%}, edges {edge:.2f}, no faces detected"]


def visual_tags(fr: list[FrameObs]) -> list[str]:
    if not fr:
        return []
    n = len(fr)
    sat = sum(f.saturation for f in fr) / n
    bri = sum(f.brightness for f in fr) / n
    con = sum(f.contrast for f in fr) / n
    warm = sum(f.warmth for f in fr) / n
    tags = []
    tags.append("warm tones" if warm > 0.06 else "cool tones" if warm < -0.02 else "neutral white balance")
    if sat > 0.45:
        tags.append("highly saturated")
    elif sat < 0.22:
        tags.append("muted / desaturated")
    if con > 0.26:
        tags.append("high contrast")
    elif con < 0.15:
        tags.append("flat / low contrast")
    if bri < 0.3:
        tags.append("low-key / dark")
    elif bri > 0.58:
        tags.append("bright / airy")
    if sum(1 for f in fr if f.letterbox > 0.06) >= max(1, n // 2):
        tags.append("letterboxed (cinematic aspect)")
    if any(f.text_like > 0.45 for f in fr):
        tags.append("on-screen text or title")
    return tags


def visual_only_scores(shot: str, face_share: float, sky: float) -> tuple[dict[str, float], list[str]]:
    """Fallback when no transcript exists: lower-confidence scores from framing alone."""
    cin = 0.2 + (0.5 if ("establishing" in shot or "landscape" in shot or "night" in shot) else 0) + 0.2 * min(1, sky * 2)
    per = 0.2 + (0.5 if "close-up" in shot else 0)
    doc = 0.2 + (0.35 if ("people" in shot or "street" in shot) else 0) + 0.15 * face_share
    tot = cin + per + doc
    return ({"cinematic": round(cin / tot, 3), "documentary": round(doc / tot, 3), "personal": round(per / tot, 3)},
            ["visual-only scoring (no transcript)", f"shot: {shot}"])


def style_scores(*, speech_cov: float, music: bool, wpm: float, lang: dict, dialogue: float,
                 shot: str, face_share: float, sky: float, colorfulness: float,
                 has_transcript: bool = True) -> tuple[dict[str, float], list[str]]:
    """Score how strongly a scene expresses each of the three storytelling modes (0-1 each, sums to 1)."""
    if not has_transcript:
        return visual_only_scores(shot, face_share, sky)
    ev = []
    cin = 0.0
    cin += 0.45 * (1 - speech_cov)
    if music:
        cin += 0.2; ev.append("music marker in captions")
    if "establishing" in shot or "landscape" in shot or "night" in shot:
        cin += 0.25; ev.append(f"shot: {shot}")
    cin += 0.1 * min(1.0, sky * 2) + 0.05 * min(1.0, colorfulness / 60)

    fp = lang.get("first_person_singular", 0) + 0.6 * lang.get("first_person_plural", 0) + 0.4 * lang.get("second_person", 0)
    per = 0.0
    per += min(0.45, fp * 4)
    per += min(0.2, lang.get("reflection", 0) * 6)
    if "close-up" in shot or "selfie" in shot:
        per += 0.25; ev.append("face close-up (to-camera)")
    per += 0.1 * dialogue
    per *= 0.4 + 0.6 * speech_cov

    doc = 0.0
    doc += min(0.45, lang.get("context_facts", 0) * 6)
    doc += 0.25 * dialogue * (1 if face_share > 0.3 else 0.5)
    if "medium shot with people" in shot or "busy street" in shot:
        doc += 0.15
    doc += 0.15 * speech_cov * (1 - min(1.0, fp * 5))
    doc *= 0.3 + 0.7 * speech_cov

    if fp > 0.05:
        ev.append(f"first-person language {fp:.0%} of words")
    if lang.get("context_facts", 0) > 0.04:
        ev.append(f"contextual/factual vocabulary {lang['context_facts']:.0%}")
    if speech_cov < 0.2:
        ev.append(f"little speech ({speech_cov:.0%} caption coverage)")
    if wpm > 170:
        ev.append(f"dense narration {wpm:.0f} wpm")

    raw = {"cinematic": max(cin, 0.01), "documentary": max(doc, 0.01), "personal": max(per, 0.01)}
    total = sum(raw.values())
    return {k: round(v / total, 3) for k, v in raw.items()}, ev


def pacing_label(cuts_per_min: float) -> str:
    if cuts_per_min <= 0:
        return "unknown"
    if cuts_per_min < 4:
        return "slow"
    if cuts_per_min < 10:
        return "medium"
    return "fast"
