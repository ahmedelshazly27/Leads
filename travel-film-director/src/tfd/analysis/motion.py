"""Camera movement and transition evidence from sparsely sampled frames (storyboards, ~10 s apart).

What can and cannot be recovered at this sampling rate:
  * Camera moves: when two consecutive samples belong to the same shot, the geometric change between them
    (estimated with ORB features + RANSAC similarity transform) reveals slow, sustained moves such as drone
    push-ins, pull-outs, pans/tracks, tilts and orbits/rolls. Fast or short moves are invisible.
  * Transitions are only seen when a sample happens to land inside one: a frame that is a blend of its
    neighbours (cross-dissolve), a near-black frame between bright ones (dip to black / fade), a near-white
    frame (flash), or a strongly directional motion-blurred frame (whip pan / fast move).
Every detection carries a confidence and is reported as *evidence*, not a complete count.
"""
from __future__ import annotations

import math

import cv2
import numpy as np

from .frames import load_bgr

_ORB = None


def _orb():
    global _ORB
    if _ORB is None:
        _ORB = cv2.ORB_create(nfeatures=600, fastThreshold=10)
    return _ORB


def _prep(path: str) -> np.ndarray:
    g = cv2.cvtColor(load_bgr(path), cv2.COLOR_BGR2GRAY)
    if g.shape[1] < 400:  # upscale tiny storyboard tiles so ORB finds enough keypoints
        g = cv2.resize(g, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    return cv2.equalizeHist(g)


def _people_mask(g: np.ndarray) -> np.ndarray:
    """255 = usable background; 0 = faces and the body region below them."""
    from .frames import _face_cascade
    mask = np.full(g.shape, 255, np.uint8)
    for (x, y, w, h) in _face_cascade().detectMultiScale(g, 1.1, 5, minSize=(int(0.06 * g.shape[0]),) * 2):
        x0, x1 = max(0, int(x - 0.9 * w)), min(g.shape[1], int(x + 1.9 * w))
        mask[max(0, int(y - 0.4 * h)):, x0:x1] = 0
    return mask


def estimate_move(path_a: str, path_b: str) -> dict | None:
    """Similarity transform from frame a to frame b, using background features only.
    Returns None if the frames don't match well enough."""
    a, b = _prep(path_a), _prep(path_b)
    ma, mb = _people_mask(a), _people_mask(b)
    if (ma == 0).mean() > 0.3 or (mb == 0).mean() > 0.3:
        return None  # frame is mostly people: camera motion can't be separated from subject motion
    ka, da = _orb().detectAndCompute(a, ma)
    kb, db = _orb().detectAndCompute(b, mb)
    if da is None or db is None or len(ka) < 25 or len(kb) < 25:
        return None
    matches = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True).match(da, db)
    if len(matches) < 20:
        return None
    pa = np.float32([ka[m.queryIdx].pt for m in matches])
    pb = np.float32([kb[m.trainIdx].pt for m in matches])
    M, inl = cv2.estimateAffinePartial2D(pa, pb, method=cv2.RANSAC, ransacReprojThreshold=4.0)
    if M is None or inl is None:
        return None
    inliers = int(inl.sum())
    ratio = inliers / len(matches)
    if inliers < 15 or ratio < 0.25:
        return None
    scale = float(math.hypot(M[0, 0], M[1, 0]))
    rot = float(math.degrees(math.atan2(M[1, 0], M[0, 0])))
    h, w = a.shape
    # translation of the image centre, as a fraction of frame size (image content motion)
    cx, cy = w / 2, h / 2
    nx = M[0, 0] * cx + M[0, 1] * cy + M[0, 2]
    ny = M[1, 0] * cx + M[1, 1] * cy + M[1, 2]
    return {"scale": round(scale, 4), "rot_deg": round(rot, 2), "dx": round(float((nx - cx) / w), 4),
            "dy": round(float((ny - cy) / h), 4), "inliers": inliers, "inlier_ratio": round(float(ratio), 3)}


def classify_move(m: dict) -> tuple[str, float]:
    """Translate image motion into camera-move vocabulary. Content moving left => camera panning right."""
    s, r, dx, dy = m["scale"], m["rot_deg"], m["dx"], m["dy"]
    labels = []
    if m["inlier_ratio"] < 0.45:  # weak geometric agreement: don't name a move
        return "uncertain", round(float(m["inlier_ratio"]), 2)
    if s > 1.08:
        labels.append("push-in")
    elif s < 0.93:
        labels.append("pull-out")
    if abs(r) > 7.0:
        labels.append("orbit/roll")
    if abs(dx) > 0.06 and abs(dx) >= abs(dy):
        labels.append("pan/track " + ("right" if dx < 0 else "left"))
    elif abs(dy) > 0.06:
        labels.append("tilt " + ("down" if dy < 0 else "up"))
    magnitude = max(abs(s - 1) * 4, abs(r) / 15, abs(dx) * 3, abs(dy) * 3)
    if not labels:
        return ("static / locked-off" if magnitude < 0.08 else "slight drift"), round(float(min(1.0, m["inlier_ratio"])), 2)
    return " + ".join(labels), round(float(min(1.0, m["inlier_ratio"] * (0.6 + min(0.4, magnitude)))), 2)


def blur_anisotropy(path: str) -> tuple[float, float]:
    """(sharpness, anisotropy). Directional motion blur keeps edges along one axis only."""
    g = cv2.cvtColor(load_bgr(path), cv2.COLOR_BGR2GRAY).astype(np.float32)
    gx = cv2.Sobel(g, cv2.CV_32F, 1, 0)
    gy = cv2.Sobel(g, cv2.CV_32F, 0, 1)
    ex, ey = float((gx ** 2).mean()) + 1e-6, float((gy ** 2).mean()) + 1e-6
    sharp = float(cv2.Laplacian(g, cv2.CV_32F).var())
    return sharp, max(ex, ey) / min(ex, ey)


def dissolve_score(pa: str, pb: str, pc: str) -> float:
    """How much better frame b is explained as a blend of a and c than by either alone (0..1)."""
    def small(p):
        return cv2.resize(cv2.cvtColor(load_bgr(p), cv2.COLOR_BGR2GRAY), (64, 36)).astype(np.float32).ravel() / 255
    a, b, c = small(pa), small(pb), small(pc)
    d = a - c
    denom = float(d @ d)
    if denom < 1e-3:  # a and c nearly identical: a blend can't be told apart
        return 0.0
    alpha = float(np.clip(((b - c) @ d) / denom, 0, 1))
    blend = alpha * a + (1 - alpha) * c
    r_blend = float(np.abs(b - blend).mean())
    r_single = min(float(np.abs(b - a).mean()), float(np.abs(b - c).mean()))
    if r_single < 0.06 or not 0.2 < alpha < 0.8:  # b is just one of its neighbours, or not mid-transition
        return 0.0
    return round(max(0.0, 1 - r_blend / r_single), 3)


def analyse_sequence(frames, interval: float, same_shot_threshold: float, dists: list[float]) -> dict:
    """frames: list of FrameObs (with .t, .path, .brightness); dists: frame_distance between consecutive frames."""
    moves, transitions = [], []
    n = len(frames)
    for i in range(n - 1):
        if dists[i] > same_shot_threshold:
            continue  # different shots: no geometric relation to measure
        m = estimate_move(frames[i].path, frames[i + 1].path)
        if not m:
            continue
        label, conf = classify_move(m)
        moves.append({"start": frames[i].t, "end": frames[i + 1].t, "move": label, "confidence": conf, **m})
    for i in range(1, n - 1):
        f, prev, nxt = frames[i], frames[i - 1], frames[i + 1]
        # Only near-pure black/white frames are reported. Cross-dissolve detection (dissolve_score) is NOT applied
        # to storyboards: in manual review of 12 flagged frames none was a real dissolve (10 s sampling almost never
        # lands inside a transition). Use analysis/local_video.py on a full-frame-rate file for transitions.
        if f.brightness < 0.02 and f.contrast < 0.02 and prev.brightness > 0.12 and nxt.brightness > 0.12:
            transitions.append({"t": f.t, "type": "dip to black / fade", "confidence": 0.5})
        elif f.brightness > 0.95 and f.contrast < 0.03 and prev.brightness < 0.8 and nxt.brightness < 0.8:
            transitions.append({"t": f.t, "type": "flash / white frame", "confidence": 0.5})
        # Whip-pan detection via directional blur is NOT applied: on 320x180 storyboards it mostly fired on smooth
        # landscapes (sky, sea, haze) in manual review. blur_anisotropy() is kept for full-resolution footage.
    hours = max(1e-6, (frames[-1].t - frames[0].t) / 3600) if n > 1 else 1.0
    same_shot_pairs = sum(1 for d in dists if d <= same_shot_threshold)
    moving = [m for m in moves if m["move"] not in ("static / locked-off", "slight drift", "uncertain")]
    named = [m for m in moves if m["move"] != "uncertain"]
    dist = {}
    for m in named:
        for part in m["move"].split(" + "):
            key = part.split(" ")[0] if part.startswith(("pan", "tilt")) else part
            dist[key] = dist.get(key, 0) + 1
    by_type = {}
    for t in transitions:
        by_type[t["type"]] = by_type.get(t["type"], 0) + 1
    return {
        "camera_moves": moves,
        "transitions": transitions,
        "summary": {
            "same_shot_pairs": same_shot_pairs,
            "measured_pairs": len(named),
            "uncertain_pairs": len(moves) - len(named),
            "moving_share": round(len(moving) / len(named), 3) if named else None,
            "move_distribution": dict(sorted(dist.items(), key=lambda kv: -kv[1])),
            "transitions_seen": by_type,
            "transitions_per_hour_seen": {k: round(v / hours, 1) for k, v in by_type.items()},
            "note": (f"Moves are measured only between samples {interval:.0f} s apart inside the same shot (slow, "
                     "sustained moves). Transitions are counted only when a sample lands inside one, so counts "
                     "are a lower bound."),
        },
    }
