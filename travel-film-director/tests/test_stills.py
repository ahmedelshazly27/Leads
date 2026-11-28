"""Archival stills -> short clips with a slow push/pan, blurred fill for portrait images and a source credit."""
import json
import subprocess

import numpy as np
from PIL import Image

from tfd.editing.stills import render_still_clip


def _probe(p):
    return json.loads(subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format",
                                      str(p)], capture_output=True, text=True).stdout)


def test_portrait_still_fills_frame_with_blur(tmp_path):
    src = tmp_path / "tall.png"
    arr = np.zeros((900, 500, 3), np.uint8)
    arr[:, :, 0] = np.linspace(40, 220, 500, dtype=np.uint8)[None, :]
    Image.fromarray(arr).save(src)
    out = render_still_clip(src, tmp_path / "s.mp4", seconds=1.0, move="in", credit="Photo: test · Public domain",
                            width=640, height=360, fps=10)
    info = _probe(out)
    assert (info["streams"][0]["width"], info["streams"][0]["height"]) == (640, 360)
    assert abs(float(info["format"]["duration"]) - 1.0) < 0.15
    frame = tmp_path / "f.png"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(out), "-frames:v", "1", str(frame)], check=True)
    f = np.array(Image.open(frame).convert("RGB")).astype(int)
    assert f[:, :40, 0].min() > 8  # the left edge is (darkened) blurred fill, not black bars
