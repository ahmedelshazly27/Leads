"""Per-frame visual measurements (pure OpenCV/numpy, CPU only)."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np

from ..schemas import FrameObs


@lru_cache(maxsize=1)
def _face_cascade():
    path = Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"
    return cv2.CascadeClassifier(str(path))


def load_bgr(path: Path | str) -> np.ndarray:
    img = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"cannot read image {path}")
    return img


def colorfulness(bgr: np.ndarray) -> float:
    b, g, r = [c.astype(np.float32) for c in cv2.split(bgr)]
    rg, yb = r - g, 0.5 * (r + g) - b
    return float(np.sqrt(rg.std() ** 2 + yb.std() ** 2) + 0.3 * np.sqrt(rg.mean() ** 2 + yb.mean() ** 2))


def palette(bgr: np.ndarray, k: int = 5) -> list[str]:
    small = cv2.resize(bgr, (64, 36), interpolation=cv2.INTER_AREA).reshape(-1, 3).astype(np.float32)
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    _, labels, centers = cv2.kmeans(small, k, None, crit, 2, cv2.KMEANS_PP_CENTERS)
    counts = np.bincount(labels.flatten(), minlength=k)
    order = np.argsort(-counts)
    return ["#%02x%02x%02x" % tuple(int(v) for v in centers[i][::-1]) for i in order]


def sky_fraction(bgr: np.ndarray) -> float:
    top = bgr[: bgr.shape[0] // 3]
    hsv = cv2.cvtColor(top, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    blue = (h >= 90) & (h <= 130) & (s > 40) & (v > 90)
    overcast = (s < 30) & (v > 170)
    smooth = cv2.Laplacian(cv2.cvtColor(top, cv2.COLOR_BGR2GRAY), cv2.CV_32F)
    smooth = np.abs(smooth) < 12
    return float(((blue | overcast) & smooth).mean())


def text_likeness(gray: np.ndarray) -> float:
    grad = cv2.morphologyEx(gray, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8))
    _, bw = cv2.threshold(grad, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    bw = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (9, 1)))
    contours, _ = cv2.findContours(bw, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    H, W = gray.shape
    area = 0
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        if w > 3 * h and 0.03 * H < h < 0.2 * H and w > 0.1 * W:
            roi = bw[y:y + h, x:x + w]
            if 0.35 < roi.mean() / 255 < 0.9:
                area += w * h
    return float(min(1.0, area / (H * W) * 5))


def letterbox_rows(bgr: np.ndarray) -> tuple[int, int]:
    """Number of near-black bar rows at the top and bottom (cinematic letterboxing)."""
    g = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    dark = (g.mean(axis=1) < 14) & (g.std(axis=1) < 8)
    H = len(dark)
    top = 0
    while top < H // 3 and dark[top]:
        top += 1
    bot = 0
    while bot < H // 3 and dark[H - 1 - bot]:
        bot += 1
    if top + bot < 0.06 * H or min(top, bot) < 0.02 * H:  # need bars on both sides to call it letterbox
        return 0, 0
    return top, bot


def _is_neutral(hex_color: str) -> bool:
    r, g, b = (int(hex_color[i:i + 2], 16) for i in (1, 3, 5))
    return max(r, g, b) < 28 or min(r, g, b) > 235


def analyse_frame(path: Path | str, t: float, detect_faces: bool = True) -> FrameObs:
    bgr = load_bgr(path)
    top, bot = letterbox_rows(bgr)
    letterbox = (top + bot) / bgr.shape[0]
    if top or bot:
        bgr = bgr[top: bgr.shape[0] - bot]
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    edges = cv2.Canny(gray, 80, 160)
    faces, max_face = 0, 0.0
    if detect_faces:
        scale = 2.0 if gray.shape[0] < 400 else 1.0
        g = cv2.resize(gray, None, fx=scale, fy=scale) if scale != 1.0 else gray
        found = _face_cascade().detectMultiScale(cv2.equalizeHist(g), scaleFactor=1.1, minNeighbors=5,
                                                  minSize=(int(0.07 * g.shape[0]),) * 2)
        faces = len(found)
        if faces:
            max_face = float(max(h for (_, _, _, h) in found) / g.shape[0])
    b, g_, r = cv2.split(bgr.astype(np.float32))
    return FrameObs(
        t=round(float(t), 2),
        path=str(path),
        brightness=round(float(gray.mean() / 255), 4),
        contrast=round(float(gray.std() / 255), 4),
        saturation=round(float(hsv[..., 1].mean() / 255), 4),
        colorfulness=round(colorfulness(bgr), 2),
        warmth=round(float((r - b).mean() / 255), 4),
        sharpness=round(float(cv2.Laplacian(gray, cv2.CV_64F).var()), 2),
        edge_density=round(float((edges > 0).mean()), 4),
        faces=faces,
        max_face_frac=round(max_face, 3),
        sky_frac=round(sky_fraction(bgr), 3),
        text_like=round(text_likeness(gray), 3),
        palette=[c for c in palette(bgr) if not _is_neutral(c)] or palette(bgr)[:1],
        letterbox=round(letterbox, 3),
    )


def hist_signature(path: Path | str) -> np.ndarray:
    """HSV histogram + tiny grayscale thumbnail used for cut detection and near-duplicate search."""
    bgr = load_bgr(path)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    hist = cv2.calcHist([hsv], [0, 1, 2], None, [16, 4, 4], [0, 180, 0, 256, 0, 256]).flatten()
    hist /= hist.sum() + 1e-9
    thumb = cv2.resize(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY), (16, 9), interpolation=cv2.INTER_AREA).flatten() / 255.0
    return np.concatenate([hist, thumb.astype(np.float32)])


def frame_distance(a: np.ndarray, b: np.ndarray) -> float:
    """0 (identical) .. ~1 (unrelated). Mix of histogram intersection and thumbnail difference."""
    n = 16 * 4 * 4
    hist_d = 1.0 - float(np.minimum(a[:n], b[:n]).sum())
    thumb_d = float(np.abs(a[n:] - b[n:]).mean())
    return 0.6 * hist_d + 0.4 * min(1.0, thumb_d * 3)
