"""Full-frame-rate analyser on a synthetic edit with known cuts, transitions and camera moves."""
import shutil
import subprocess

import cv2
import numpy as np
import pytest

from tfd.analysis.local_video import analyse_video

pytestmark = pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg required")


def _texture(path, seed):
    rng = np.random.default_rng(seed)
    img = np.full((1080, 1920, 3), int(rng.integers(40, 200)), np.uint8)
    for _ in range(700):
        x, y = int(rng.integers(0, 1900)), int(rng.integers(0, 1060))
        col = tuple(int(c) for c in rng.integers(0, 255, 3))
        cv2.rectangle(img, (x, y), (x + int(rng.integers(8, 60)), y + int(rng.integers(8, 60))), col, -1)
    cv2.imwrite(str(path), img)


def _ff(*args):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *args], check=True)


@pytest.fixture(scope="module")
def edit(tmp_path_factory):
    d = tmp_path_factory.mktemp("edit")
    for i in range(4):
        _texture(d / f"t{i}.png", i)
    enc = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "25"]
    # shot A static 2s | hard cut | shot B static 2s | 1s dissolve | shot C push-in 3s | fade via black | shot D pan 3s
    _ff("-loop", "1", "-t", "2", "-i", str(d / "t0.png"), "-vf", "scale=640:360", *enc, str(d / "a.mp4"))
    _ff("-loop", "1", "-t", "3", "-i", str(d / "t1.png"), "-vf", "scale=640:360", *enc, str(d / "b.mp4"))
    _ff("-loop", "1", "-t", "3", "-i", str(d / "t2.png"), "-vf",
        "scale=1920:1080,zoompan=z='1+0.004*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=75:s=640x360:fps=25", *enc, str(d / "c.mp4"))
    _ff("-loop", "1", "-t", "3", "-i", str(d / "t3.png"), "-vf",
        "crop=960:540:x='min(900,t*300)':y=200,scale=640:360", *enc, str(d / "dd.mp4"))
    _ff("-i", str(d / "a.mp4"), "-i", str(d / "b.mp4"), "-i", str(d / "c.mp4"), "-i", str(d / "dd.mp4"), "-filter_complex",
        "[0:v]fps=25,settb=AVTB,format=yuv420p[a];[1:v]fps=25,settb=AVTB,format=yuv420p[b];"
        "[2:v]fps=25,settb=AVTB,format=yuv420p[c];[3:v]fps=25,settb=AVTB,format=yuv420p[e];"
        "[a][b]concat=n=2:v=1,settb=AVTB[ab];[ab][c]xfade=transition=dissolve:duration=1:offset=4[abc];"
        "[abc][e]xfade=transition=fadeblack:duration=1:offset=6[v]", "-map", "[v]", *enc, str(d / "edit.mp4"))
    return analyse_video(d / "edit.mp4")


def test_transitions_found(edit):
    types = [(round(t["t"], 1), t["type"]) for t in edit["transitions"]]
    assert any(t == "hard cut" and abs(x - 2.0) < 0.2 for x, t in types), types
    assert any(t == "cross-dissolve" and 3.6 < x < 4.8 for x, t in types), types
    assert any(t == "dip to black / fade" and 5.8 < x < 7.2 for x, t in types), types


def test_shots_and_moves(edit):
    moves = [s["camera_move"] for s in edit["shots"]]
    assert any("push-in" in m for m in moves), edit["shots"]
    assert any("pan/track right" in m for m in moves), edit["shots"]
    assert edit["shots"][0]["camera_move"] == "static / locked-off"
    assert 4 <= edit["summary"]["shots"] <= 6


def test_attach_full_rate_to_profile(edit, tmp_path):
    """The library merge path: a profile gets exact shot data and full-rate techniques."""
    import json
    from tfd.config import get_settings
    from tfd.library.db import Library
    from tfd.pipeline import attach_full_rate
    from tests.test_reference_pipeline import _synthetic_source
    from tfd.analysis.reference import build_profile
    src = _synthetic_source(tmp_path / "v")
    prof = build_profile(src, "Tester", tmp_path / "v")
    path = tmp_path / "v" / "profile.json"
    path.write_text(prof.model_dump_json(), encoding="utf-8")
    Library(get_settings().db_path).add_profile(prof, path)
    summary = attach_full_rate(prof.video_id, edit["file"])
    assert summary["shots"] == 4
    merged = json.loads(path.read_text())
    assert merged["editing_characteristics"]["full_rate"]["transition_types"]["cross-dissolve"] == 1
    assert any(t["name"].startswith("[full-rate]") for t in merged["techniques"])
    assert "file" not in json.loads((tmp_path / "v" / "full_rate.json").read_text())
