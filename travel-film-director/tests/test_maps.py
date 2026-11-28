"""Animated route maps rendered from Natural Earth (public domain) outlines."""
import json
import subprocess
from pathlib import Path

import pytest

from tfd.editing.maps import Projection, ease, partial_route, render_map_clip

GEO = Path("data/assets/natural_earth/ne_110m_admin_0_countries.geojson")


def test_projection_keeps_aspect_and_bounds():
    pr = Projection((60.0, 29.0, 75.0, 39.0), 1920, 1080, margin=0.1)
    x0, y0 = pr((60.0, 39.0))
    x1, y1 = pr((75.0, 29.0))
    assert 0 <= x0 < x1 <= 1920 and 0 <= y0 < y1 <= 1080
    cx, cy = pr((67.5, 34.0))
    assert abs(cx - 960) < 40 and abs(cy - 540) < 40


def test_route_draws_progressively():
    pts = [(0.0, 0.0), (10.0, 0.0), (10.0, 10.0)]
    assert partial_route(pts, 0.0) == [(0.0, 0.0)]
    half = partial_route(pts, 0.5)
    assert half[-1] == pytest.approx((10.0, 0.0))
    assert partial_route(pts, 1.0)[-1] == pytest.approx((10.0, 10.0))
    assert ease(0) == 0 and ease(1) == 1 and 0.4 < ease(0.5) < 0.6


@pytest.mark.skipif(not GEO.is_file(), reason="Natural Earth data not downloaded")
def test_render_map_clip(tmp_path):
    out = render_map_clip(tmp_path / "m.mp4", GEO, "Afghanistan",
                          stops=[("KABUL", "كابل", 69.2075, 34.5553), ("BAMIYAN", "باميان", 67.8273, 34.8211)],
                          seconds=1.0, width=640, height=360, fps=10)
    info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams",
                                      "-show_format", str(out)], capture_output=True, text=True).stdout)
    v = info["streams"][0]
    assert (v["width"], v["height"]) == (640, 360) and abs(float(info["format"]["duration"]) - 1.0) < 0.15
