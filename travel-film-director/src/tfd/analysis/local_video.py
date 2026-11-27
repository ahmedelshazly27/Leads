"""Full-frame-rate editing analysis of a local video file.

Works on any file you are entitled to analyse (your own footage, a rough cut, a reference you have rights to).
Nothing is downloaded here. Outputs only derived data: shot list, transition types, camera moves, pacing.

Method (CPU, OpenCV):
  * Every frame is decoded at 320 px width. Consecutive-frame distance = HSV-histogram + thumbnail difference.
  * Hard cut: a single-frame spike in distance, well above the local baseline.
  * Gradual transition: frames W apart differ strongly while no single step does. A frame in the middle that is
    explained as a blend of the two ends is a cross-dissolve; near-black frames make it a dip to black / fade;
    a burst of large global translation is a whip pan.
  * Per-shot camera move: sparse optical flow + RANSAC similarity transform between frames 2 apart, accumulated
    over the shot -> total zoom, pan, tilt, roll; jitter of the per-step motion -> handheld vs stabilised.
"""
from __future__ import annotations

import math
from pathlib import Path

import cv2
import numpy as np

from ..log import get_logger

log = get_logger("local_video")


def _sig(bgr_small: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(bgr_small, cv2.COLOR_BGR2HSV)
    hist = cv2.calcHist([hsv], [0, 1, 2], None, [16, 4, 4], [0, 180, 0, 256, 0, 256]).flatten()
    hist /= hist.sum() + 1e-9
    thumb = cv2.resize(cv2.cvtColor(bgr_small, cv2.COLOR_BGR2GRAY), (32, 18), interpolation=cv2.INTER_AREA)
    return np.concatenate([hist, thumb.flatten().astype(np.float32) / 255.0])


def _dist(a: np.ndarray, b: np.ndarray) -> float:
    n = 256
    return 0.6 * (1.0 - float(np.minimum(a[:n], b[:n]).sum())) + 0.4 * min(1.0, float(np.abs(a[n:] - b[n:]).mean()) * 3)


def _flow_step(prev: np.ndarray, cur: np.ndarray):
    pts = cv2.goodFeaturesToTrack(prev, 200, 0.01, 6)
    if pts is None or len(pts) < 12:
        return None
    nxt, st, _ = cv2.calcOpticalFlowPyrLK(prev, cur, pts, None)
    good = st.flatten() == 1
    if good.sum() < 12:
        return None
    M, inl = cv2.estimateAffinePartial2D(pts[good], nxt[good], method=cv2.RANSAC, ransacReprojThreshold=2.0)
    if M is None or inl is None or inl.sum() < 10:
        return None
    s = math.hypot(M[0, 0], M[1, 0])
    r = math.degrees(math.atan2(M[1, 0], M[0, 0]))
    h, w = prev.shape
    return (float(M[0, 2] / w), float(M[1, 2] / h), float(s), float(r))


def _classify_shot(steps: list, duration: float) -> dict:
    if len(steps) < 3:
        return {"camera_move": "unmeasured", "handheld": None}
    a = np.array(steps)
    zoom = float(np.prod(a[:, 2]))
    pan, tilt, roll = float(a[:, 0].sum()), float(a[:, 1].sum()), float(a[:, 3].sum())
    jitter = float(np.mean(np.abs(np.diff(a[:, :2], axis=0)))) if len(a) > 3 else 0.0
    labels = []
    if zoom > 1.04:
        labels.append("push-in")
    elif zoom < 0.96:
        labels.append("pull-out")
    if abs(pan) > 0.08 and abs(pan) >= abs(tilt):
        labels.append("pan/track " + ("right" if pan < 0 else "left"))
    elif abs(tilt) > 0.08:
        labels.append("tilt " + ("down" if tilt < 0 else "up"))
    if abs(roll) > 6:
        labels.append("roll/orbit")
    return {"camera_move": " + ".join(labels) or "static / locked-off",
            "zoom_total": round(zoom, 3), "pan_total": round(pan, 3), "tilt_total": round(tilt, 3),
            "roll_total_deg": round(roll, 1),
            "speed_per_s": round(max(abs(pan), abs(tilt), abs(zoom - 1)) / max(duration, 1e-3), 3),
            "jitter": round(jitter, 4), "handheld": jitter > 0.004}


def analyse_video(path: Path, width: int = 320, max_minutes: float | None = None) -> dict:
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise ValueError(f"cannot open {path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    sigs, lumas, grays = [], [], []
    limit = int(max_minutes * 60 * fps) if max_minutes else None
    while True:
        ok, img = cap.read()
        if not ok or (limit and len(sigs) >= limit):
            break
        small = cv2.resize(img, (width, int(img.shape[0] * width / img.shape[1])), interpolation=cv2.INTER_AREA)
        sigs.append(_sig(small))
        g = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
        lumas.append(float(g.mean()) / 255)
        grays.append(cv2.resize(g, (160, int(160 * g.shape[0] / g.shape[1]))))
    cap.release()
    n = len(sigs)
    if n < 3:
        raise ValueError("video too short")
    duration = n / fps
    d = np.array([_dist(sigs[i], sigs[i + 1]) for i in range(n - 1)])

    # ---- hard cuts: spike vs local median
    cuts = []
    win = max(3, int(fps))
    for i in range(len(d)):
        lo, hi = max(0, i - win), min(len(d), i + win + 1)
        local = np.median(np.concatenate([d[lo:i], d[i + 1:hi]])) if hi - lo > 1 else 0
        neighbours = max(d[i - 1] if i else 0, d[i + 1] if i + 1 < len(d) else 0)
        if d[i] > 0.25 and d[i] > 4 * local + 0.05 and d[i] > 2.2 * neighbours:
            cuts.append(i + 1)

    # ---- gradual transitions: big change across W frames without a single spike
    W = max(4, int(0.6 * fps))
    gradual = []
    i = W
    while i < n - W:
        span = _dist(sigs[i - W], sigs[i + W])
        steps = d[i - W:i + W]
        if span > 0.35 and steps.max() < 0.22 and not any(i - W <= c <= i + W for c in cuts):
            j = i
            while j < n - W and _dist(sigs[j - W], sigs[j + W]) > 0.35 and d[j - W:j + W].max() < 0.22:
                j += 1
            a, b, mid = i - W, min(n - 1, j + W - 1), (i + j) // 2
            seg_l = min(lumas[a:b + 1])
            kind = "cross-dissolve"
            if seg_l < 0.04:
                kind = "dip to black / fade"
            else:
                # blend test on the middle frame
                # coarse scale so camera motion inside the incoming/outgoing shot doesn't break the blend fit
                fa, fb, fm = (cv2.resize(grays[k], (32, 18), interpolation=cv2.INTER_AREA).astype(np.float32).ravel() / 255
                              for k in (a, b, mid))
                dd = fa - fb
                alpha = float(np.clip(((fm - fb) @ dd) / max(1e-6, dd @ dd), 0, 1))
                r_blend = float(np.abs(fm - (alpha * fa + (1 - alpha) * fb)).mean())
                r_single = min(float(np.abs(fm - fa).mean()), float(np.abs(fm - fb).mean()))
                if not (0.15 < alpha < 0.85 and r_blend < 0.8 * r_single):
                    step = _flow_step(grays[mid - 1], grays[mid]) if mid > 0 else None
                    kind = "whip pan / fast move" if step and abs(step[0]) > 0.04 else "gradual change (light/move)"
            gradual.append({"start": round(a / fps, 3), "end": round(b / fps, 3), "t": round(mid / fps, 3),
                            "type": kind, "frame": mid})
            i = j + W
        else:
            i += 1
    # ---- pure black stretches between bright material (fade without gradual detection)
    k = 0
    while k < n:
        if lumas[k] < 0.03:
            e = k
            while e < n and lumas[e] < 0.03:
                e += 1
            if k > 0 and e < n and not any(g["start"] <= k / fps <= g["end"] for g in gradual):
                gradual.append({"start": round(k / fps, 3), "end": round(e / fps, 3), "t": round((k + e) / 2 / fps, 3),
                                "type": "dip to black / fade", "frame": (k + e) // 2})
            k = e
        k += 1

    # ---- a fade includes the whole luminance ramp down into and up out of the black frames
    for g in gradual:
        if g["type"] != "dip to black / fade":
            continue
        a = int(g["start"] * fps)
        b = min(n - 1, int(g["end"] * fps))
        while a > 0 and lumas[a - 1] > lumas[a] + 0.002 and lumas[a] < 0.5:
            a -= 1
        while b < n - 1 and lumas[b + 1] > lumas[b] + 0.002 and lumas[b] < 0.5:
            b += 1
        g["start"], g["end"] = round(a / fps, 3), round(b / fps, 3)

    # ---- drop "cuts" that are really steps inside a gradual transition or between near-black frames
    cuts = [c for c in cuts
            if not any(g["start"] - 0.25 <= c / fps <= g["end"] + 0.25 for g in gradual)
            and min(lumas[c - 1], lumas[c]) > 0.06]

    # ---- shots and per-shot camera movement
    bounds = sorted(set([0] + cuts + [g["frame"] for g in gradual] + [n]))
    bounds = [b for idx, b in enumerate(bounds) if idx == 0 or b - bounds[idx - 1] >= max(2, int(0.2 * fps))]
    if bounds[-1] != n:
        bounds.append(n)
    shots = []
    for s0, s1 in zip(bounds, bounds[1:]):
        steps = []
        for f in range(s0 + 2, s1 - 1, 2):
            st = _flow_step(grays[f - 2], grays[f])
            if st:
                steps.append(st)
        dur = (s1 - s0) / fps
        shots.append({"start": round(s0 / fps, 3), "end": round(s1 / fps, 3), "duration": round(dur, 3), **_classify_shot(steps, dur)})

    trans_types = {"hard cut": len(cuts)}
    for g in gradual:
        trans_types[g["type"]] = trans_types.get(g["type"], 0) + 1
    lens = [s["duration"] for s in shots]
    measured = [s for s in shots if s["camera_move"] != "unmeasured"]
    moves = {}
    for s in measured:
        key = s["camera_move"]
        moves[key] = moves.get(key, 0) + 1
    return {
        "file": str(path), "fps": round(fps, 3), "duration": round(duration, 2), "frames": n,
        "shots": shots,
        "transitions": [{"t": round(c / fps, 3), "type": "hard cut"} for c in cuts] +
                       [{"t": g["t"], "start": g["start"], "end": g["end"], "type": g["type"]} for g in gradual],
        "summary": {
            "shots": len(shots),
            "cuts_per_min": round((len(shots) - 1) / (duration / 60), 2) if duration else 0,
            "avg_shot_s": round(float(np.mean(lens)), 2), "median_shot_s": round(float(np.median(lens)), 2),
            "shot_length_p10_p90": [round(float(np.percentile(lens, 10)), 2), round(float(np.percentile(lens, 90)), 2)],
            "transition_types": trans_types,
            "camera_moves": dict(sorted(moves.items(), key=lambda kv: -kv[1])),
            "moving_shot_share": round(sum(1 for s in measured if s["camera_move"] != "static / locked-off") / len(measured), 3) if measured else None,
            "handheld_share": round(sum(1 for s in measured if s.get("handheld")) / len(measured), 3) if measured else None,
        },
    }
