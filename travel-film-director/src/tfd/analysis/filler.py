"""Stock / archival / filler shot candidates in a local video.

Signals per shot (middle frames): black & white, film grain, inset 4:3 or pillarbox, a persistent corner logo
("bug") over changing content, no people, and a colour grade far from the video's own median look. Candidates get
a review sheet; nothing here can prove a clip is stock - it narrows down what to look at.
"""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

from .frames import _face_cascade


def _frames(cap, t0: float, t1: float, k: int = 5):
    out = []
    for t in np.linspace(t0 + 0.1 * (t1 - t0), t1 - 0.1 * (t1 - t0), k):
        cap.set(cv2.CAP_PROP_POS_MSEC, float(t) * 1000)
        ok, img = cap.read()
        if ok:
            out.append(cv2.resize(img, (480, int(img.shape[0] * 480 / img.shape[1]))))
    return out


def _corner_logo(frames) -> str | None:
    if len(frames) < 3:
        return None
    stack = np.stack([cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float32) for f in frames])
    tstd, mean = stack.std(axis=0), stack.mean(axis=0)
    H, W = mean.shape
    for name, (ys, xs) in {"top-left": (slice(0, H // 5), slice(0, W // 5)), "top-right": (slice(0, H // 5), slice(4 * W // 5, W)),
                           "bottom-left": (slice(4 * H // 5, H), slice(0, W // 5)), "bottom-right": (slice(4 * H // 5, H), slice(4 * W // 5, W))}.items():
        corner_static = (tstd[ys, xs] < 4).mean()
        edges = cv2.Canny(mean[ys, xs].astype(np.uint8), 60, 150).mean() / 255
        if corner_static > 0.08 and edges > 0.04 and tstd.mean() > 12:  # static detailed patch over moving content
            return name
    return None


def find_filler(video: Path, shots: list[dict], sheet_dir: Path | None = None) -> dict:
    cap = cv2.VideoCapture(str(video))
    feats = []
    for sh in shots:
        if sh["duration"] < 0.6:
            continue
        frs = _frames(cap, sh["start"], sh["end"])
        if not frs:
            continue
        mid = frs[len(frs) // 2]
        hsv = cv2.cvtColor(mid, cv2.COLOR_BGR2HSV)
        g = cv2.cvtColor(mid, cv2.COLOR_BGR2GRAY)
        grain = float(np.abs(g.astype(np.float32) - cv2.medianBlur(g, 3).astype(np.float32)).mean())
        cols = (g.mean(axis=0) < 12)
        pillar = cols[: len(cols) // 8].all() and cols[-len(cols) // 8:].all()
        faces = len(_face_cascade().detectMultiScale(cv2.equalizeHist(g), 1.1, 5, minSize=(24, 24)))
        feats.append({"shot": sh, "frames": frs, "sat": float(hsv[..., 1].mean() / 255),
                      "grade": np.array([hsv[..., 0].mean(), hsv[..., 1].mean(), hsv[..., 2].mean()]),
                      "grain": grain, "pillar": bool(pillar), "faces": faces, "logo": _corner_logo(frs)})
    if not feats:
        return {"candidates": [], "sheets": [], "summary": {}}
    med = np.median(np.stack([f["grade"] for f in feats]), axis=0)
    grain_med = float(np.median([f["grain"] for f in feats]))
    cands = []
    for f in feats:
        reasons = []
        if f["sat"] < 0.06:
            reasons.append("black & white")
        if f["pillar"]:
            reasons.append("pillarboxed / inset 4:3")
        if f["logo"]:
            reasons.append(f"static logo/bug {f['logo']}")
        if f["grain"] > 2.2 * grain_med and f["grain"] > 3:
            reasons.append("heavy grain/noise (archival look)")
        off = float(np.abs((f["grade"] - med) / np.array([30, 60, 60])).mean())
        if off > 0.6:
            reasons.append(f"grade differs from the film's look ({off:.2f})")
        if reasons:
            kind = "archival / broadcast" if any(r.startswith(("black", "pillar", "static logo", "heavy grain")) for r in reasons) \
                else "possible stock / filler"
            if f["faces"] == 0 or kind.startswith("archival"):
                cands.append({**{k: f["shot"][k] for k in ("start", "end", "duration")}, "kind": kind,
                              "reasons": reasons, "faces": f["faces"], "_frames": f["frames"]})
    sheets = []
    if sheet_dir and cands:
        sheet_dir.mkdir(parents=True, exist_ok=True)
        tw, th, per = 240, 135, 12
        for si in range(0, len(cands), per):
            chunk = cands[si:si + per]
            img = Image.new("RGB", (4 * (tw + 2), ((len(chunk) + 3) // 4) * (th + 30)), (18, 18, 18))
            d = ImageDraw.Draw(img)
            for i, c in enumerate(chunk):
                x, y = (i % 4) * (tw + 2), (i // 4) * (th + 30)
                fr = c["_frames"][len(c["_frames"]) // 2]
                img.paste(Image.fromarray(cv2.cvtColor(cv2.resize(fr, (tw, th)), cv2.COLOR_BGR2RGB)), (x, y))
                m, s = divmod(int(c["start"]), 60)
                d.text((x + 2, y + th + 1), f"#{si + i} {m}:{s:02d} {c['duration']:.1f}s {c['kind']}", fill=(255, 220, 90))
                d.text((x + 2, y + th + 14), "; ".join(c["reasons"])[:44], fill=(200, 200, 200))
            p = sheet_dir / f"filler_{si // per + 1:02d}.jpg"
            img.save(p, quality=85)
            sheets.append(str(p))
    cap.release()
    for c in cands:
        c.pop("_frames", None)
    total = sum(s["duration"] for s in shots) or 1
    return {"candidates": cands, "sheets": sheets,
            "summary": {"candidates": len(cands),
                        "archival_share": round(sum(c["duration"] for c in cands if c["kind"].startswith("archival")) / total, 3),
                        "possible_stock_share": round(sum(c["duration"] for c in cands if c["kind"].startswith("possible")) / total, 3)}}
