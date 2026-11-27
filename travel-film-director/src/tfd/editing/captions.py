"""Captions from the footage's own speech (never invented): transcript segments of sync-sound timeline items are
mapped to record time, filtered for Whisper hallucinations, written as SRT (Resolve: File > Import > Subtitle;
Final Cut: File > Import > Captions) and rendered as transparent PNGs for the preview burn-in.

Burned-in subtitles are shared grammar across all four reference creators (STYLE_SYNTHESIS.md)."""
from __future__ import annotations

import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

MAX_CHARS = 42
MIN_CUE_S = 0.4
_HALLUCINATIONS = re.compile(
    r"(thank(s| you) for watching|subtitles? by|amara\.org|please subscribe|like and subscribe|"
    r"transcribed by|translated by|www\.|\.com\b|اشتركوا في القناة|ترجمة نانسي)", re.I)
_FONTS = {
    "latin": ("/System/Library/Fonts/SFNS.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
              "/Library/Fonts/Arial Unicode.ttf", "DejaVuSans-Bold.ttf"),
    "arabic": ("/System/Library/Fonts/SFArabic.ttf", "/System/Library/Fonts/GeezaPro.ttc",
               "/Library/Fonts/Arial Unicode.ttf", "DejaVuSans-Bold.ttf"),
}
_ARABIC = re.compile(r"[؀-ۿݐ-ݿ]")


def is_hallucination(text: str) -> bool:
    """Whisper invents stock phrases on silence/music and loops single words; drop those cues."""
    t = text.strip()
    if not t or _HALLUCINATIONS.search(t):
        return True
    words = re.findall(r"\w+", t.lower())
    return len(words) >= 4 and len(set(words)) <= max(1, len(words) // 4)


def caption_cues(plan: dict, transcripts: dict[str, list[dict]]) -> list[dict]:
    """Cues in record (timeline) seconds for every sync-sound item, clipped to its trim."""
    cues: list[dict] = []
    for item in plan["timeline"]:
        if item.get("audio") != "sync":
            continue
        s_in, s_out, r_in = item["src_in"], item["src_out"], item["record_in"]
        for seg in transcripts.get(item["clip"], []):
            a, b = max(seg["start"], s_in), min(seg["end"], s_out)
            if b - a < MIN_CUE_S or is_hallucination(seg["text"]):
                continue
            cues.append({"start": round(r_in + a - s_in, 3), "end": round(r_in + b - s_in, 3),
                         "text": seg["text"].strip(), "clip": item["clip"]})
    return sorted(cues, key=lambda c: c["start"])


def split_lines(text: str, max_chars: int = MAX_CHARS) -> list[str]:
    """Up to two balanced lines; longer text keeps wrapping (caller should keep cues short)."""
    if len(text) <= max_chars:
        return [text]
    words, best = text.split(), None
    for i in range(1, len(words)):
        a, b = " ".join(words[:i]), " ".join(words[i:])
        score = max(len(a), len(b))
        if best is None or score < best[0]:
            best = (score, [a, b])
    if best and best[0] <= max_chars:
        return best[1]
    lines, cur = [], ""
    for w in words:
        if cur and len(cur) + 1 + len(w) > max_chars:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    return lines + ([cur] if cur else [])


def _srt_ts(sec: float) -> str:
    ms = int(round(sec * 1000))
    h, rem = divmod(ms, 3_600_000)
    m, rem = divmod(rem, 60_000)
    s, ms = divmod(rem, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def write_srt(cues: list[dict], path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    blocks = [f"{i}\n{_srt_ts(c['start'])} --> {_srt_ts(c['end'])}\n{chr(10).join(split_lines(c['text']))}\n"
              for i, c in enumerate(cues, 1)]
    path.write_text("\n".join(blocks) + ("\n" if blocks else ""), encoding="utf-8")
    return path


def _font(text: str, size: int) -> ImageFont.FreeTypeFont:
    for name in _FONTS["arabic" if _ARABIC.search(text) else "latin"]:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default(size)


def render_text_png(text: str, out: Path, width: int, height: int, kind: str = "subtitle") -> Path:
    """Full-frame transparent PNG: subtitles bottom-centre (white, black outline); titles as a bold
    upper-left place/time card (clear of the subtitle zone) (the Daniel/Yusufa grammar, in a neutral design of your own)."""
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rtl = bool(_ARABIC.search(text))
    if kind == "title":
        f = _font(text, int(height * 0.075))
        x0, y0, x1, y1 = d.textbbox((0, 0), text.upper() if not rtl else text, font=f)
        pad, x, y = int(height * 0.025), int(width * 0.06), int(height * 0.08)
        d.rectangle((x - pad, y - pad + y0, x + (x1 - x0) + pad, y + y1 + pad), fill=(0, 0, 0, 200))
        d.text((x, y), text.upper() if not rtl else text, font=f, fill=(255, 255, 255, 255),
               direction="rtl" if rtl else None)
    else:
        f = _font(text, int(height * 0.045))
        lines = split_lines(text)
        line_h = int(height * 0.058)
        y = int(height * 0.90) - line_h * len(lines)
        for line in lines:
            w = d.textlength(line, font=f, direction="rtl" if rtl else None)
            d.text(((width - w) / 2, y), line, font=f, fill=(255, 255, 255, 255), stroke_width=max(2, height // 270),
                   stroke_fill=(0, 0, 0, 255), direction="rtl" if rtl else None)
            y += line_h
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out)
    return out


def load_transcripts(project: Path) -> dict[str, list[dict]]:
    """Clip id -> transcript segments, from the project's footage.json (empty if not transcribed)."""
    from ..util import read_json
    fj = project / "footage.json"
    if not fj.is_file():
        return {}
    return {c["id"]: c.get("transcript") or [] for c in read_json(fj)["clips"]}


def overlays_for(start: float, end: float, cues: list[dict], titles: list[dict]) -> list[dict]:
    """Text events (subtitles and title cards) visible in [start, end) of the record timeline, in local seconds."""
    events = [{"text": c["text"], "kind": "subtitle", "a": c["start"], "b": c["end"]} for c in cues]
    events += [{"text": t["text"], "kind": "title", "a": t["at"], "b": t["at"] + t["duration"]} for t in titles]
    return [{**e, "a": round(max(e["a"], start) - start, 3), "b": round(min(e["b"], end) - start, 3)}
            for e in events if e["b"] > start and e["a"] < end and min(e["b"], end) - max(e["a"], start) >= 0.2]
