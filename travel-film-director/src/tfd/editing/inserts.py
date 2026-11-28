"""Reference inserts: trim a shot from another film into a muted clip with an on-screen credit, so a private study
cut can borrow b-roll (e.g. Joe Hattab's Afghanistan aerials) while always showing whose footage it is.
Never for anything shared: the footage belongs to its creator.
"""
from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

from .stills import _credit


def reference_insert(src: Path, a: float, b: float, out: Path, credit: str, width: int = 1920,
                     height: int = 1080) -> Path:
    """Shot src[a:b] scaled/cropped to the frame, audio removed, credit burned bottom right."""
    exe = shutil.which("ffmpeg")
    if not exe:
        raise RuntimeError("ffmpeg not found on PATH")
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        png = Path(tmp) / "credit.png"
        layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        _credit(layer, credit)
        layer.save(png)
        r = subprocess.run([exe, "-loglevel", "error", "-y", "-ss", f"{a:.3f}", "-t", f"{b - a:.3f}", "-i", str(src),
                            "-i", str(png), "-filter_complex",
                            f"[0:v]scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},"
                            f"setsar=1[v];[v][1:v]overlay=0:0,format=yuv420p[o]", "-map", "[o]", "-an",
                            "-c:v", "libx264", "-preset", "medium", "-crf", "16", str(out)], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr[-500:])
    return out
