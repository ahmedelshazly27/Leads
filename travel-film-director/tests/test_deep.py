"""Deep analysis on a synthetic edit: graphics (lower third + card), archival filler, audio tempo and beat sync."""
import shutil
import subprocess
from pathlib import Path

import cv2
import numpy as np
import pytest

from tfd.analysis.audio import analyse_audio
from tfd.analysis.filler import find_filler
from tfd.analysis.graphics import detect_graphics
from tfd.analysis.local_video import analyse_video

_FONTS = ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
          "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
          "/Library/Fonts/Arial Unicode.ttf")
FONT = next((f for f in _FONTS if Path(f).exists()), _FONTS[0])


def _has_drawtext() -> bool:
    if not shutil.which("ffmpeg"):
        return False
    out = subprocess.run(["ffmpeg", "-hide_banner", "-filters"], capture_output=True, text=True).stdout
    return " drawtext " in out


# Homebrew's default ffmpeg bottle is built without libfreetype, so drawtext may be missing.
pytestmark = pytest.mark.skipif(not (_has_drawtext() and Path(FONT).exists()),
                                reason="ffmpeg with drawtext + a bold TTF font needed")


def _ff(*a):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *a], check=True)


def _tex(path, seed, gray=False):
    rng = np.random.default_rng(seed)
    img = np.full((720, 1280, 3), 90, np.uint8)
    for _ in range(500):
        x, y = int(rng.integers(0, 1260)), int(rng.integers(0, 700))
        cv2.circle(img, (x, y), int(rng.integers(5, 40)), tuple(int(c) for c in rng.integers(0, 255, 3)), -1)
    img = cv2.GaussianBlur(img, (3, 3), 0)
    cv2.imwrite(str(path), img)


@pytest.fixture(scope="module")
def deep_edit(tmp_path_factory):
    d = tmp_path_factory.mktemp("deep")
    for i in range(4):
        _tex(d / f"t{i}.png", 10 + i)
    enc = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "25", "-t", "4"]
    pan = "crop=960:540:x='t*40':y=90,scale=640:360"
    # 1) natural shot + lower third fading in at 1.0s
    _ff("-loop", "1", "-i", str(d / "t0.png"), "-vf",
        f"{pan},drawbox=x=40:y=270:w=330:h=50:color=black@0.6:t=fill:enable='gte(t,1)',"
        f"drawtext=fontfile={FONT}:text='ALMATY  KAZAKHSTAN':x=55:y=282:fontsize=24:fontcolor=white:alpha='if(lt(t,1),0,min(1,(t-1)/0.5))'",
        *enc, str(d / "s1.mp4"))
    # 2) full-frame title card
    _ff("-f", "lavfi", "-i", "color=c=0x1b1b1b:s=640x360:r=25", "-vf",
        f"drawtext=fontfile={FONT}:text='THE NEXT DAY':x=(w-tw)/2:y=(h-th)/2:fontsize=40:fontcolor=white", *enc, str(d / "s2.mp4"))
    # 3) archival: black & white, grainy, pillarboxed
    _ff("-loop", "1", "-i", str(d / "t2.png"), "-vf",
        "crop=960:720:x='t*30':y=0,scale=480:360,hue=s=0,noise=alls=40:allf=t,pad=640:360:80:0", *enc, str(d / "s3.mp4"))
    # 4) natural shot with a corner logo bug
    _ff("-loop", "1", "-i", str(d / "t3.png"), "-vf",
        f"{pan},drawbox=x=560:y=12:w=66:h=30:color=white@0.9:t=fill,drawtext=fontfile={FONT}:text='TV1':x=570:y=16:fontsize=20:fontcolor=red",
        *enc, str(d / "s4.mp4"))
    (d / "list.txt").write_text("".join(f"file '{d / f's{i}.mp4'}'\n" for i in range(1, 5)))
    _ff("-f", "concat", "-safe", "0", "-i", str(d / "list.txt"), "-c", "copy", str(d / "v.mp4"))
    # 120 BPM click track (beat every 0.5 s) -> cuts at 4/8/12 s fall on beats
    _ff("-i", str(d / "v.mp4"), "-f", "lavfi", "-i",
        "aevalsrc='0.8*sin(2*PI*880*t)*exp(-40*mod(t,0.5))+0.15*sin(2*PI*220*t)':s=44100:d=16",
        "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-shortest", str(d / "edit.mp4"))
    return d / "edit.mp4", d


def test_graphics(deep_edit):
    video, d = deep_edit
    g = detect_graphics(video, d / "gs")
    kinds = [(x["kind"], x["start"], x.get("entry", "")) for x in g["segments"]]
    lower = [x for x in g["segments"] if x["start"] < 4 and x["kind"] == "text overlay"]
    assert lower and "lower third" in lower[0]["position"], kinds
    assert lower[0]["entry"].startswith("fade-in"), kinds
    card = [x for x in g["segments"] if x["kind"].startswith("full-frame") and 3.5 < x["start"] < 6]
    assert card and card[0]["entry"] == "cut / pop-on", kinds
    assert g["sheets"] and Path(g["sheets"][0]).is_file()


def test_filler_and_audio(deep_edit):
    video, d = deep_edit
    full = analyse_video(video)
    f = find_filler(video, full["shots"], d / "fs")
    reasons = {round(c["start"]): c["reasons"] for c in f["candidates"]}
    arch = [c for c in f["candidates"] if 7.5 < c["start"] < 12.5]
    assert arch and arch[0]["kind"].startswith("archival"), reasons
    assert any("logo" in r for c in f["candidates"] if c["start"] > 11.5 for r in c["reasons"]), reasons
    cuts = [t["t"] for t in full["transitions"] if t["type"] == "hard cut"]
    a = analyse_audio(video, cuts + [2.0, 6.0, 10.0, 14.0])  # add on-beat points so the sync stat has enough samples
    assert abs(a["tempo_bpm"] - 120) < 6 or abs(a["tempo_bpm"] - 240) < 12, a["tempo_bpm"]
    assert a["beat_sync"] and a["beat_sync"]["beat_sync_index"] > 1.5, a["beat_sync"]
