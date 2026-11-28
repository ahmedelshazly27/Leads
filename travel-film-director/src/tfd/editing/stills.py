"""Archival stills as clips: a slow push or pan over the photo (the treatment Joe Hattab gives archive images),
with a blurred, darkened fill behind photos that don't match the frame, and a small source credit (required by
CC BY / BY-SA and good practice for public-domain sources). Rendered with Pillow and piped to FFmpeg.
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

from .typography import font

OVERSCAN = 1.12  # the canvas is larger than the frame so the camera can move inside it
MOVES = ("in", "out", "left", "right")


def _ease(t: float) -> float:
    return t * t * (3 - 2 * t)


def _canvas(src: Path, width: int, height: int) -> Image.Image:
    """Photo on an overscanned canvas: covers the frame when the aspect is close, else contained over a blurred fill."""
    cw, ch = int(width * OVERSCAN), int(height * OVERSCAN)
    img = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    ratio = (img.width / img.height) / (cw / ch)
    if 0.8 < ratio < 1.25:
        return ImageOps.fit(img, (cw, ch), Image.LANCZOS)
    bg = ImageOps.fit(img, (cw // 4, ch // 4), Image.BILINEAR).filter(ImageFilter.GaussianBlur(12))
    bg = ImageEnhance.Brightness(bg.resize((cw, ch), Image.BILINEAR)).enhance(0.45)
    fg = ImageOps.contain(img, (int(cw * 0.94), int(ch * 0.94)), Image.LANCZOS)
    shadow = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    x, y = (cw - fg.width) // 2, (ch - fg.height) // 2
    ImageDraw.Draw(shadow).rectangle((x + 10, y + 14, x + fg.width + 10, y + fg.height + 14), fill=(0, 0, 0, 150))
    bg = Image.alpha_composite(bg.convert("RGBA"), shadow.filter(ImageFilter.GaussianBlur(18))).convert("RGB")
    bg.paste(fg, (x, y))
    return bg


def _window(t: float, move: str, cw: int, ch: int, width: int, height: int) -> tuple[float, float, float, float]:
    """Crop box on the canvas at time fraction t for the camera move."""
    e = _ease(t)
    if move in ("in", "out"):
        z = (1.0 - 0.10 * e) if move == "in" else (0.90 + 0.10 * e)  # fraction of the canvas visible
        w, h = cw * z, ch * z
        return ((cw - w) / 2, (ch - h) / 2, (cw + w) / 2, (ch + h) / 2)
    w, h = width * 1.0, height * 1.0
    x = (cw - w) * (e if move == "right" else 1 - e)
    return (x, (ch - h) / 2, x + w, (ch + h) / 2)


def _credit(frame: Image.Image, text: str) -> None:
    d = ImageDraw.Draw(frame)
    f = font(text, max(12, int(frame.height * 0.02)), "Medium")
    w = d.textlength(text, font=f)
    x, y = frame.width - w - frame.width * 0.03, frame.height * 0.955 - f.size
    d.text((x + 1, y + 1), text, font=f, fill=(0, 0, 0))
    d.text((x, y), text, font=f, fill=(225, 225, 225))


def render_still_clip(src: Path, out: Path, seconds: float = 5.0, move: str = "in", credit: str | None = None,
                      width: int = 1920, height: int = 1080, fps: int = 25) -> Path:
    """Render a still photo to an H.264 MP4 (no audio) with a slow camera move and an optional credit line."""
    if move not in MOVES:
        raise ValueError(f"move must be one of {MOVES}")
    exe = shutil.which("ffmpeg")
    if not exe:
        raise RuntimeError("ffmpeg not found on PATH")
    canvas = _canvas(Path(src), width, height)
    out.parent.mkdir(parents=True, exist_ok=True)
    proc = subprocess.Popen([exe, "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{width}x{height}",
                             "-r", str(fps), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "16",
                             "-pix_fmt", "yuv420p", str(out)], stdin=subprocess.PIPE)
    n = max(1, int(round(seconds * fps)))
    for i in range(n):
        frame = canvas.crop(_window(i / max(1, n - 1), move, *canvas.size, width, height)).resize((width, height), Image.BILINEAR)
        if credit:
            _credit(frame, credit)
        proc.stdin.write(frame.tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError(f"ffmpeg failed rendering {out}")
    return out
