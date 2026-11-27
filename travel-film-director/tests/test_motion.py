"""Camera-move and transition detection on frames with known geometry."""
import cv2
import numpy as np
import pytest

from tfd.analysis.motion import classify_move, dissolve_score, estimate_move


@pytest.fixture(scope="module")
def texture(tmp_path_factory):
    rng = np.random.default_rng(1)
    img = np.zeros((1800, 2400, 3), np.uint8)
    for _ in range(900):  # random rectangles + circles = plenty of corners for ORB
        x, y = int(rng.integers(0, 2350)), int(rng.integers(0, 1750))
        col = tuple(int(c) for c in rng.integers(0, 255, 3))
        if rng.random() < 0.5:
            cv2.rectangle(img, (x, y), (x + int(rng.integers(10, 80)), y + int(rng.integers(10, 80))), col, -1)
        else:
            cv2.circle(img, (x, y), int(rng.integers(5, 40)), col, -1)
    return img, tmp_path_factory.mktemp("mv")


def _crop(tex, cx, cy, w, name):
    img, d = tex
    h = int(w * 9 / 16)
    x, y = int(cx - w / 2), int(cy - h / 2)
    p = str(d / (name.replace("/", "_").replace(" ", "_") + ".jpg"))
    cv2.imwrite(p, cv2.resize(img[y:y + h, x:x + w], (320, 180), interpolation=cv2.INTER_AREA))
    return p


@pytest.mark.parametrize("a,b,expected", [
    ((1200, 900, 900), (1200, 900, 800), "push-in"),
    ((1200, 900, 800), (1200, 900, 900), "pull-out"),
    ((1100, 900, 800), (1200, 900, 800), "pan/track right"),
    ((1200, 900, 800), (1100, 900, 800), "pan/track left"),
    ((1200, 850, 800), (1200, 950, 800), "tilt down"),
    ((1200, 900, 800), (1200, 900, 800), "static / locked-off"),
])
def test_camera_moves(texture, a, b, expected):
    m = estimate_move(_crop(texture, *a, f"{expected}_a"), _crop(texture, *b, f"{expected}_b"))
    assert m is not None
    assert classify_move(m)[0] == expected


def test_unrelated_frames_do_not_match(texture):
    assert estimate_move(_crop(texture, 600, 500, 700, "u1"), _crop(texture, 1800, 1300, 700, "u2")) is None


def test_dissolve(texture):
    a = _crop(texture, 700, 600, 700, "A")
    c = _crop(texture, 1700, 1300, 700, "C")
    blend = str(texture[1] / "B.jpg")
    cv2.imwrite(blend, (0.5 * cv2.imread(a).astype(float) + 0.5 * cv2.imread(c).astype(float)).astype(np.uint8))
    assert dissolve_score(a, blend, c) > 0.8
    assert dissolve_score(a, a, c) == 0.0
