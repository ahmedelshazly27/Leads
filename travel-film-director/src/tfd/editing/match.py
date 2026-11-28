"""Reference grade matching: build a 3D LUT that moves our footage's colour statistics onto a reference creator's
(e.g. Joe Hattab's saturated, cool travel look), measured from their actual frames rather than eyeballed.

Statistics are taken in CIE Lab per luminance band (shadows / mids / highlights): mean a*, b* (the tint, e.g. teal
shadows and warm highlights) and the chroma spread (how much colour). The LUT maps lightness by matching
percentiles, shifts each band's tint to the reference, scales chroma toward the reference spread, and protects
skin tones so faces don't go teal or orange.
"""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

BANDS = {"shadow": (0.0, 35.0), "mid": (35.0, 70.0), "high": (70.0, 100.0)}
CENTERS = {"shadow": 20.0, "mid": 52.0, "high": 82.0}
L_PCTS = (2, 10, 25, 50, 75, 90, 98)
CHROMA_GAIN = (0.85, 1.7)   # bounds on how much colour can be added or removed
SKIN_PROTECT = 0.55


def _to_lab(rgb: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(rgb.reshape(-1, 1, 3).astype(np.float32), cv2.COLOR_RGB2LAB).reshape(-1, 3)


def _to_rgb(lab: np.ndarray) -> np.ndarray:
    return np.clip(cv2.cvtColor(lab.reshape(-1, 1, 3).astype(np.float32), cv2.COLOR_LAB2RGB).reshape(-1, 3), 0, 1)


def lab_stats(rgb: np.ndarray) -> dict:
    """Lab statistics of RGB samples (float 0..1, shape (n, 3)): lightness percentiles and per-band tint/chroma."""
    lab = _to_lab(rgb)
    L, a, b = lab[:, 0], lab[:, 1], lab[:, 2]
    chroma = np.hypot(a, b)
    out = {"L": [float(np.percentile(L, p)) for p in L_PCTS], "chroma": float(chroma.mean())}
    for name, (lo, hi) in BANDS.items():
        m = (L >= lo) & (L < hi)
        if m.sum() < 20:
            m = np.ones_like(L, bool)
        out[name] = {"a": float(a[m].mean()), "b": float(b[m].mean()), "chroma": float(chroma[m].mean()) + 1e-3}
    return out


def _band_weights(L: np.ndarray) -> dict[str, np.ndarray]:
    """Smooth (triangular) weights so the LUT has no seams between bands."""
    w = {k: np.clip(1 - np.abs(L - c) / 32.0, 0, None) for k, c in CENTERS.items()}
    total = sum(w.values()) + 1e-6
    return {k: v / total for k, v in w.items()}


def match_lut_fn(ours: dict, ref: dict, strength: float = 1.0, tint: float = 1.0):
    """A function RGB->RGB (arrays (n,3) in 0..1) moving `ours` statistics toward `ref`, blended by strength.
    `tint` scales the per-band colour-cast shift separately: part of a reference's average tint is its content
    (green fields, teal sea), so matching it fully would tint other landscapes."""
    src_L, dst_L = np.array(ours["L"]), np.array(ref["L"])
    src_L = np.maximum.accumulate(src_L + np.arange(len(src_L)) * 1e-3)  # strictly increasing for np.interp

    def fn(rgb: np.ndarray) -> np.ndarray:
        lab = _to_lab(rgb)
        L, a, b = lab[:, 0], lab[:, 1], lab[:, 2]
        L2 = np.interp(L, np.r_[0, src_L, 100], np.r_[0, dst_L, 100])
        w = _band_weights(L)
        a2, b2 = np.zeros_like(a), np.zeros_like(b)
        for band, wb in w.items():
            o, r = ours[band], ref[band]
            k = float(np.clip(r["chroma"] / o["chroma"], *CHROMA_GAIN))
            ta, tb = o["a"] + (r["a"] - o["a"]) * tint, o["b"] + (r["b"] - o["b"]) * tint
            a2 += wb * ((a - o["a"]) * k + ta)
            b2 += wb * ((b - o["b"]) * k + tb)
        hue = np.degrees(np.arctan2(b, a))
        chroma = np.hypot(a, b)
        skin = ((hue > 20) & (hue < 75) & (chroma > 8) & (chroma < 45) & (L > 25)).astype(np.float32) * SKIN_PROTECT
        a2 = a2 * (1 - skin) + (a * 1.08) * skin   # faces: keep their own hue, just a touch richer
        b2 = b2 * (1 - skin) + (b * 1.08) * skin
        out = np.stack([L + (L2 - L) * strength, a + (a2 - a) * strength, b + (b2 - b) * strength], axis=1)
        return _to_rgb(out)
    return fn


def write_match_cube(path: Path, fn, title: str, size: int = 33) -> Path:
    g = np.linspace(0, 1, size)
    b, gg, r = np.meshgrid(g, g, g, indexing="ij")  # red fastest in .cube order
    ident = np.stack([r, gg, b], axis=-1).reshape(-1, 3)
    out = fn(ident)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="ascii") as f:
        f.write(f'TITLE "{title}"\nLUT_3D_SIZE {size}\nDOMAIN_MIN 0.0 0.0 0.0\nDOMAIN_MAX 1.0 1.0 1.0\n')
        for v in out:
            f.write(f"{v[0]:.6f} {v[1]:.6f} {v[2]:.6f}\n")
    return path


def sample_frames(video: Path, every_s: float = 12.0, skip_s: float = 60.0, size=(160, 90)) -> np.ndarray:
    """RGB pixel samples from a video (one small frame every `every_s` seconds), dropping black/graphic-heavy frames."""
    cap = cv2.VideoCapture(str(video))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    pix = []
    t = skip_s
    while t * fps < n - skip_s * fps:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(t * fps))
        ok, img = cap.read()
        t += every_s
        if not ok:
            continue
        small = cv2.cvtColor(cv2.resize(img, size), cv2.COLOR_BGR2RGB).astype(np.float32) / 255
        y = small.mean(axis=2)
        if y.mean() < 0.06 or (y > 0.97).mean() > 0.3:
            continue
        pix.append(small.reshape(-1, 3))
    cap.release()
    return np.concatenate(pix) if pix else np.zeros((0, 3), np.float32)


def apply_reference_grade(plan: dict, project: Path, ours: dict, ref: dict, name: str, tint: float = 0.5,
                          strengths: dict[str, float] | None = None) -> dict:
    """Make `name` the plan's look: one .cube per strength, items keyed by mode (scenery full, talk 80%)."""
    strengths = strengths or {"cinematic": 1.0, "documentary": 0.8, "personal": 0.8}
    grade = plan.setdefault("grade", {})
    luts = {}
    for s in sorted(set(strengths.values()) | {1.0}):
        luts[f"{s:.1f}"] = str(write_match_cube(project / "grade" / f"{name}_{int(s * 100)}.cube",
                                                 match_lut_fn(ours, ref, strength=s, tint=tint), f"{name} {int(s * 100)}%"))
    grade.update(look=name, luts=luts, cutaway_intensity=1.0,
                 reason=f"measured match to reference frames (Lab per luminance band, tint x{tint}, skin protected)")
    for item in plan["timeline"]:
        item["grade_intensity"] = strengths.get(item.get("mode"), 0.8)
    return grade
