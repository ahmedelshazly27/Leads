"""On-screen text design for the preview burn-in: subtitles, place/time cards and one-word hook titles.

Modelled on the restraint of the reference creators (GRAPHICS_AND_STOCK.md): small clean white subtitles with a
soft shadow (no hard outline, no box), place cards as a small tracked label over a large condensed name, and hook
words in heavy condensed caps. Neutral designs of our own: no creator's colours or templates.
All renders are full-frame transparent PNGs so FFmpeg can overlay them without libass/drawtext.
"""
from __future__ import annotations

import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

_ARABIC = re.compile(r"[؀-ۿݐ-ݿ]")
_FONTS = {
    "latin": ("/System/Library/Fonts/SFNS.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
              "/Library/Fonts/Arial Unicode.ttf", "DejaVuSans-Bold.ttf"),
    "arabic": ("/System/Library/Fonts/SFArabic.ttf", "/System/Library/Fonts/GeezaPro.ttc",
               "/Library/Fonts/Arial Unicode.ttf", "DejaVuSans-Bold.ttf"),
}
WHITE = (255, 255, 255, 255)
LABEL = (255, 255, 255, 215)
SUB_SIZE, SUB_LINE, SUB_BOTTOM = 0.036, 0.050, 0.915   # fractions of frame height
CARD_X, CARD_Y, LABEL_SIZE, NAME_SIZE = 0.06, 0.075, 0.026, 0.115
WORD_SIZE, WORD_MAX_W = 0.30, 0.62


def is_rtl(text: str) -> bool:
    return bool(_ARABIC.search(text))


def font(text: str, size: int, weight: str = "Semibold") -> ImageFont.FreeTypeFont:
    """System font for the script, at a named weight when the font is variable (SF Pro / SF Arabic)."""
    for name in _FONTS["arabic" if is_rtl(text) else "latin"]:
        try:
            f = ImageFont.truetype(name, max(8, size))
        except OSError:
            continue
        for w in (weight, weight.split()[-1]):  # 'Compressed Black' -> 'Black' on fonts without widths
            try:
                f.set_variation_by_name(w)
                break
            except (OSError, ValueError, AttributeError):
                continue
        return f
    return ImageFont.load_default(size)


def _shadowed(img: Image.Image, draw_fn, tight: tuple[int, int], soft: tuple[int, int], dy: int) -> None:
    """Draw text twice as shadow (a tight one for legibility on bright skies, a soft one for depth), then the text."""
    for alpha, blur in (tight, soft):
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        draw_fn(ImageDraw.Draw(layer), (0, 0, 0, alpha), dy)
        img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))
    draw_fn(ImageDraw.Draw(img), None, 0)


def _tracked(d: ImageDraw.ImageDraw, xy: tuple[float, float], text: str, f, fill, tracking: float) -> None:
    """Letter-spaced Latin text (Pillow has no tracking); `tracking` is in ems."""
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=f, fill=fill)
        x += d.textlength(ch, font=f) + tracking * f.size


def _subtitle(img: Image.Image, text: str, width: int, height: int) -> None:
    from .captions import split_lines
    rtl = is_rtl(text)
    f = font(text, int(height * SUB_SIZE), "Semibold")
    lines = split_lines(text)
    line_h = int(height * SUB_LINE)
    top = int(height * SUB_BOTTOM) - line_h * len(lines)
    direction = "rtl" if rtl else None

    def draw(d, shadow, dy):
        for k, line in enumerate(lines):
            w = d.textlength(line, font=f, direction=direction)
            d.text(((width - w) / 2, top + k * line_h + dy), line, font=f, fill=shadow or WHITE, direction=direction)
    _shadowed(img, draw, tight=(230, 2), soft=(130, max(6, height // 90)), dy=max(1, height // 400))


def _card(img: Image.Image, text: str, width: int, height: int) -> None:
    """'DAY 1 · KABUL' -> small tracked 'DAY 1' over a large condensed 'KABUL'; text without ' · ' is the name."""
    label, _, name = text.rpartition(" · ")
    if not name:
        label, name = "", text
    x, y = int(width * CARD_X), int(height * CARD_Y)
    lf = font(label, int(height * LABEL_SIZE), "Semibold")
    nf = font(name, int(height * NAME_SIZE), "Compressed Black")
    name_txt = name if is_rtl(name) else name.upper()
    name_y = y + (int(height * LABEL_SIZE * 1.6) if label else 0)

    def draw(d, shadow, dy):
        if label:
            _tracked(d, (x, y + dy), label.upper(), lf, shadow or LABEL, tracking=0.28)
        d.text((x, name_y + dy), name_txt, font=nf, fill=shadow or WHITE, direction="rtl" if is_rtl(name) else None)
    _shadowed(img, draw, tight=(150, 2), soft=(110, max(8, height // 70)), dy=max(1, height // 300))


def _word(img: Image.Image, text: str, width: int, height: int) -> None:
    rtl = is_rtl(text)
    word = text if rtl else text.upper()
    direction = "rtl" if rtl else None
    probe = ImageDraw.Draw(img)
    size = int(height * WORD_SIZE)
    f = font(word, size, "Compressed Black")
    while size > 20 and probe.textlength(word, font=f, direction=direction) > width * WORD_MAX_W:
        size = int(size * 0.94)
        f = font(word, size, "Compressed Black")
    x0, y0, x1, y1 = probe.textbbox((0, 0), word, font=f, direction=direction)
    x, y = (width - (x1 - x0)) / 2 - x0, (height - (y1 - y0)) / 2 - y0

    def draw(d, shadow, dy):
        d.text((x, y + dy), word, font=f, fill=shadow or WHITE, direction=direction)
    _shadowed(img, draw, tight=(120, 3), soft=(140, max(10, height // 45)), dy=max(2, height // 180))


HIST_Y, HIST_DATE, HIST_CAPTION = 0.56, 0.085, 0.034


def _history(img: Image.Image, text: str, width: int, height: int) -> None:
    """'MARCH 2001 · Taliban destroy the Buddhas' -> a large condensed date over a one-line caption, lower left,
    above the subtitle zone (the dated history card of Joe Hattab's context sections, in our own design)."""
    date, _, caption = text.partition(" · ")
    x, y = int(width * CARD_X), int(height * HIST_Y)
    df = font(date, int(height * HIST_DATE), "Compressed Black")
    cf = font(caption, int(height * HIST_CAPTION), "Semibold")
    cap_y = y + int(height * HIST_DATE * 1.12)
    rtl = is_rtl(caption)

    def draw(d, shadow, dy):
        d.text((x, y + dy), date.upper(), font=df, fill=shadow or WHITE)
        if caption:
            d.text((x, cap_y + dy), caption, font=cf, fill=shadow or LABEL, direction="rtl" if rtl else None)
    _shadowed(img, draw, tight=(170, 2), soft=(130, max(8, height // 60)), dy=max(1, height // 300))


def render_text_png(text: str, out: Path, width: int, height: int, kind: str = "subtitle") -> Path:
    """Full-frame transparent PNG for one text event: 'subtitle', 'title' (place/time card), 'word' or 'history'."""
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    {"title": _card, "word": _word, "history": _history}.get(kind, _subtitle)(img, text, width, height)
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out)
    return out
