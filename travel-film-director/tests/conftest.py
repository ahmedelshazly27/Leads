import shutil
import subprocess
from pathlib import Path

import pytest

FFMPEG = shutil.which("ffmpeg")


@pytest.fixture(autouse=True)
def isolated_data(tmp_path, monkeypatch):
    monkeypatch.setenv("TFD_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    yield


def make_clip(path: Path, src: str, dur: float, size: str = "1280x720", audio: bool = True):
    args = ["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", f"{src}{":" if "=" in src else "="}size={size}:rate=25", "-t", str(dur)]
    if audio:
        args += ["-f", "lavfi", "-i", f"sine=frequency=330:duration={dur}", "-shortest", "-c:a", "aac"]
    args += ["-c:v", "libx264", "-pix_fmt", "yuv420p", str(path)]
    subprocess.run(args, check=True)
    return path


@pytest.fixture
def footage_dir(tmp_path):
    if not FFMPEG:
        pytest.skip("ffmpeg not installed")
    d = tmp_path / "raw"
    d.mkdir()
    make_clip(d / "DJI_0001.MP4", "testsrc2", 4)
    make_clip(d / "IMG_0002.MOV", "mandelbrot", 3, audio=False)
    make_clip(d / "GX010003.MP4", "color=c=black", 2, size="720x1280")
    shutil.copy(d / "DJI_0001.MP4", d / "DJI_0001_copy.MP4")
    return d
