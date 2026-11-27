"""Colour grading: looks, LUT files, per-clip correction, FFmpeg application (incl. HDR and paths with spaces)."""
import shutil
import subprocess

import cv2
import numpy as np
import pytest

from tfd.editing.grade import LOOKS, apply_look, clip_correction, ffmpeg_filters, read_cube, write_cube


def _rgb(*c):
    return np.array([c], dtype=np.float64)


def test_cube_file_and_identity(tmp_path):
    p = write_cube(tmp_path / "x.cube", LOOKS["joe-teal"], intensity=0.0, size=17)
    lut = read_cube(p)
    assert lut.shape == (17, 17, 17, 3)
    g = np.linspace(0, 1, 17)
    assert np.allclose(lut[3, 5, 7], [g[7], g[5], g[3]], atol=1e-5)  # [b][g][r] -> (r,g,b), intensity 0 = identity


def test_joe_teal_character():
    sky = _rgb(0.35, 0.55, 0.8)
    out = apply_look(sky, LOOKS["joe-teal"])
    assert (out.max() - out.min()) > (sky.max() - sky.min())  # more saturated
    shadow = apply_look(_rgb(0.15, 0.15, 0.15), LOOKS["joe-teal"])[0]
    assert shadow[2] > shadow[0]  # teal/blue shadows


def test_omar_lifted_low_contrast_warm():
    lk = LOOKS["omar-warm-film"]
    black, white, mid = (apply_look(_rgb(v, v, v), lk)[0] for v in (0.0, 1.0, 0.5))
    assert black.min() > 0.02 and white.max() < 1.0
    assert mid[0] > mid[2]  # warm


def test_skin_is_protected():
    lk = LOOKS["joe-teal"]
    skin, sky = _rgb(0.78, 0.56, 0.45), _rgb(0.35, 0.55, 0.8)
    d_skin = np.abs(apply_look(skin, lk) - skin).sum()
    d_sky = np.abs(apply_look(sky, lk) - sky).sum()
    assert d_skin < d_sky


def test_clip_correction(tmp_path):
    blue = np.full((90, 160, 3), (150, 120, 115), np.uint8)  # BGR: blue cast on a grey scene
    dark = np.full((90, 160, 3), 35, np.uint8)
    cv2.imwrite(str(tmp_path / "b.jpg"), blue)
    cv2.imwrite(str(tmp_path / "d.jpg"), dark)
    c = clip_correction([str(tmp_path / "b.jpg")], {"hdr": False})
    assert c["gains"][2] < 1.0 < c["gains"][0]  # pull blue down, red up
    d = clip_correction([str(tmp_path / "d.jpg")], {"hdr": True})
    assert d["exposure_stops"] > 0 and d["hdr_tonemap"]


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg required")
def test_ffmpeg_applies_lut_in_path_with_spaces(tmp_path):
    folder = tmp_path / "AI Travel Film Director" / "grade"
    lut = write_cube(folder / "omar-warm-film_100.cube", LOOKS["omar-warm-film"], 1.0)
    src, out = tmp_path / "in.mp4", tmp_path / "out.png"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=0x808080:s=320x180:d=1",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", str(src)], check=True)
    vf = ffmpeg_filters({"gains": [1, 1, 1], "exposure_stops": 0}, lut)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-vf", vf, "-frames:v", "1", str(out)], check=True)
    b, g, r = cv2.imread(str(out)).reshape(-1, 3).mean(0)
    assert r > b + 3  # grey became warm


def _has_zscale() -> bool:
    if not shutil.which("ffmpeg"):
        return False
    out = subprocess.run(["ffmpeg", "-hide_banner", "-filters"], capture_output=True, text=True).stdout
    return " zscale " in out


# Homebrew's default ffmpeg bottle is built without libzimg, so zscale may be missing.
@pytest.mark.skipif(not _has_zscale(), reason="ffmpeg with zscale (libzimg) required")
def test_hdr_tonemap_chain_runs(tmp_path):
    src = tmp_path / "hlg.mp4"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=320x180:d=1", "-c:v", "libx264",
                    "-pix_fmt", "yuv420p10le", "-color_primaries", "bt2020", "-color_trc", "arib-std-b67",
                    "-colorspace", "bt2020nc", str(src)], check=True)
    vf = ffmpeg_filters({"hdr_tonemap": True, "gains": [1, 1, 1], "exposure_stops": 0}, None)
    r = subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-vf", vf, "-frames:v", "1",
                        str(tmp_path / "o.png")], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr


def _flat_log_frame(path, seed=0):
    """Synthetic log-looking frame: luma squeezed into 0.15-0.6, almost no saturation."""
    rng = np.random.default_rng(seed)
    base = rng.uniform(0, 1, (90, 160, 1))
    rgb = 0.15 + 0.45 * np.concatenate([base, base * 0.98, base * 0.96], axis=2)
    cv2.imwrite(str(path), cv2.cvtColor((rgb * 255).astype(np.uint8), cv2.COLOR_RGB2BGR))
    return str(path)


def test_detect_log_profile():
    from tfd.editing.grade import log_profile_from_tags
    assert log_profile_from_tags({"com.dji.camera.ColorGammaSxS": "D-Log2"}) == "D-Log2"
    assert log_profile_from_tags({"com.apple.quicktime.model": "iPhone 15 Pro"}) is None
    assert log_profile_from_tags({"com.dji.camera.ColorGammaSxS": "Normal"}) is None


def test_log_clip_gets_levels_and_saturation(tmp_path):
    frames = [_flat_log_frame(tmp_path / f"{i}.jpg", i) for i in range(3)]
    corr = clip_correction(frames, {"hdr": False, "log_profile": "D-Log2"})
    lg = corr["log_to_709"]
    assert 0.12 < lg["black"] < 0.2 and 0.55 < lg["white"] < 0.65 and lg["saturation"] > 1.3
    assert corr["exposure_stops"] == 0.0  # levels already place exposure
    normal = clip_correction(frames, {"hdr": False})
    assert "log_to_709" not in normal


def test_log_stretch_is_bounded_for_dark_clips(tmp_path):
    from tfd.editing.grade import log_to_709_params
    p = log_to_709_params(np.array([0.05, 0.06, 0.07, 0.08] * 100))
    assert p["white"] - p["black"] >= 0.35  # never stretch a dark clip into noise


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg required")
def test_log_chain_expands_contrast(tmp_path):
    """Runs on a 10-bit video, like real camera log footage (a 10-bit path once produced black frames)."""
    png = tmp_path / "log.png"
    _flat_log_frame(png)
    src = tmp_path / "log10.mp4"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-loop", "1", "-i", str(png), "-t", "1", "-c:v", "libx264",
                    "-pix_fmt", "yuv420p10le", str(src)], check=True)
    corr = clip_correction([str(png)], {"hdr": False, "log_profile": "D-Log2"})
    out = tmp_path / "o.png"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-vf", ffmpeg_filters(corr, None),
                    "-frames:v", "1", str(out)], check=True)
    a, b = cv2.imread(str(png)), cv2.imread(str(out))
    assert b.mean() > 40 and b.std() > a.std() * 1.5
