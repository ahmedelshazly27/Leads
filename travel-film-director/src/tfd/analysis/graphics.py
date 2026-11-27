"""Motion-graphics detection in a local video: titles, lower thirds, place cards, maps, frames, counters.

Detection is heuristic (text-like regions + large flat synthetic areas); each detected segment gets a frame strip
(before / in / middle / out / after) for visual review, plus measured position, duration and entry/exit animation.
"""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw



def synthetic_score(bgr: np.ndarray) -> float:
    """Share of 16x16 blocks that are perfectly flat but not black: typical of graphics, maps, cards."""
    g = cv2.cvtColor(cv2.resize(bgr, (320, 180)), cv2.COLOR_BGR2GRAY).astype(np.float32)
    h, w = g.shape
    blocks = g[: h // 16 * 16, : w // 16 * 16].reshape(h // 16, 16, w // 16, 16).swapaxes(1, 2)
    std, mean = blocks.std(axis=(2, 3)), blocks.mean(axis=(2, 3))
    return float(((std < 2.0) & (mean > 20) & (mean < 245)).mean())


MODEL_URL = "https://huggingface.co/opencv/text_detection_ppocr/resolve/main/text_detection_en_ppocrv3_2023may.onnx"
_DET = None


def _detector():
    """OpenCV-zoo PP-OCRv3 text detector (Apache-2.0, 2.4 MB, CPU). Downloaded once into data/models/."""
    global _DET
    if _DET is None:
        from ..config import get_settings
        path = get_settings().data_dir / "models" / "text_detection_en_ppocrv3_2023may.onnx"
        if not path.is_file():
            import urllib.request
            path.parent.mkdir(parents=True, exist_ok=True)
            urllib.request.urlretrieve(MODEL_URL, path)
        det = cv2.dnn_TextDetectionModel_DB(str(path))
        det.setBinaryThreshold(0.3)
        det.setPolygonThreshold(0.5)
        det.setMaxCandidates(100)
        det.setUnclipRatio(2.0)
        det.setInputParams(1.0 / 255.0, (640, 352), (122.67891434, 116.66876762, 104.00698793))
        _DET = det
    return _DET


def text_boxes(bgr: np.ndarray) -> list[tuple[float, float, float, float]]:
    """Horizontal text boxes (normalised x0, y0, x1, y1) from a pretrained detector."""
    H, W = bgr.shape[:2]
    polys, _conf = _detector().detect(bgr)
    boxes = []
    for p in polys:
        p = np.array(p, dtype=np.float32)
        (cx, cy), (w, h), ang = cv2.minAreaRect(p)
        if w < h:
            w, h, ang = h, w, ang + 90
        ang = ((ang + 90) % 180) - 90
        if abs(ang) > 3 or h < 0.015 * H or h > 0.3 * H:  # overlays are level; skip specks and huge blobs
            continue
        x0, y0 = p[:, 0].min(), p[:, 1].min()
        x1, y1 = p[:, 0].max(), p[:, 1].max()
        boxes.append((float(x0 / W), float(y0 / H), float(x1 / W), float(y1 / H)))
    return boxes


def text_bbox(bgr: np.ndarray):
    boxes = text_boxes(bgr)
    if not boxes:
        return None
    return (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))


def text_score(bgr: np.ndarray) -> float:
    return float(min(1.0, sum((b[2] - b[0]) * (b[3] - b[1]) for b in text_boxes(bgr)) * 12))


def _position(b) -> str:
    cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
    v = "lower third" if cy > 0.68 else "top" if cy < 0.3 else "centre"
    hpos = "left" if cx < 0.38 else "right" if cx > 0.62 else "centre"
    return f"{v}, {hpos}" if v != "centre" or hpos != "centre" else "full-frame centre"


def _animation(cap, fps: float, t0: float, t1: float, box) -> str:
    """Classify how a graphic enters between t0 and t1 using the region where it ends up."""
    W = H = None
    stats = []
    for k in range(int(t0 * fps), int(t1 * fps) + 1):
        cap.set(cv2.CAP_PROP_POS_FRAMES, k)
        ok, img = cap.read()
        if not ok:
            break
        H, W = img.shape[:2]
        b = text_bbox(img)
        x0, y0, x1, y1 = (int(box[0] * W), int(box[1] * H), int(box[2] * W), int(box[3] * H))
        crop = img[max(y0, 0):max(y1, 0), max(x0, 0):max(x1, 0)]
        # A box on the frame edge can collapse to zero pixels; cvtColor rejects empty input.
        contrast = float(cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY).std()) if crop.size else 0.0
        stats.append((b, contrast))
    if len(stats) < 3:
        return "unknown"
    contrast = np.array([s[1] for s in stats])
    present = [s[0] is not None for s in stats]
    first = next((i for i, p in enumerate(present) if p), None)
    if first is None:
        return "unknown"
    ramp = contrast[-1] - contrast[0]
    if abs(ramp) > 1:
        change = np.abs(contrast - contrast[0])
        begin = int(np.argmax(change > 0.15 * abs(ramp)))
        full = int(np.argmax(change >= 0.85 * abs(ramp)))
        frames_to_full = max(0, full - begin)
    else:
        frames_to_full = 0
    fw, fh = box[2] - box[0], box[3] - box[1]

    def _same_graphic(b):  # similar size and near the final position: the same graphic, possibly still moving in
        bw_, bh_ = b[2] - b[0], b[3] - b[1]
        near = abs((b[0] + b[2]) / 2 - (box[0] + box[2]) / 2) < 0.25 and abs((b[1] + b[3]) / 2 - (box[1] + box[3]) / 2) < 0.2
        return near and 0.75 < bh_ / max(fh, 1e-6) < 1.33 and (bw_ / max(fw, 1e-6) > 0.25)

    boxes = [s[0] for s in stats if s[0] is not None and _same_graphic(s[0])]
    cxs = [(b[0] + b[2]) / 2 for b in boxes]
    cys = [(b[1] + b[3]) / 2 for b in boxes]
    widths = [b[2] - b[0] for b in boxes]
    if len(boxes) >= 3 and (max(cxs) - min(cxs) > 0.06 or max(cys) - min(cys) > 0.06):
        dx, dy = cxs[-1] - cxs[0], cys[-1] - cys[0]
        d = ("from left" if dx > 0 else "from right") if abs(dx) >= abs(dy) else ("from below" if dy < 0 else "from above")
        return f"slide/move {d}"
    if len(boxes) >= 3 and widths[0] < 0.7 * widths[-1]:
        return "reveal / wipe or scale-up"
    if frames_to_full >= max(3, int(0.15 * fps)):
        return f"fade-in (~{frames_to_full / fps:.2f}s)"
    return "cut / pop-on"


def detect_graphics(video: Path, sheet_dir: Path | None = None, sample_fps: float = 4.0) -> dict:
    cap = cv2.VideoCapture(str(video))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    step = max(1, int(round(fps / sample_fps)))
    samples = []
    for k in range(0, n, step):
        cap.set(cv2.CAP_PROP_POS_FRAMES, k)
        ok, img = cap.read()
        if not ok:
            break
        small = cv2.resize(img, (480, int(img.shape[0] * 480 / img.shape[1])))
        samples.append((k / fps, text_score(small), synthetic_score(small), text_bbox(small)))
    segs, cur = [], None

    def _changed(cur, syn, box):
        if (syn > 0.35) != (np.mean(cur["syn"][-2:]) > 0.35):
            return True  # switched between overlay and full-frame graphic
        if box and cur["boxes"]:
            pb = cur["boxes"][-1]
            return abs((box[1] + box[3]) / 2 - (pb[1] + pb[3]) / 2) > 0.12 or abs((box[0] + box[2]) / 2 - (pb[0] + pb[2]) / 2) > 0.2
        return False

    for t, txt, syn, box in samples:
        on = txt > 0.3 or syn > 0.35
        if on and cur is not None and _changed(cur, syn, box):
            segs.append(cur)
            cur = None
        if on:
            if cur is None:
                cur = {"start": t, "end": t, "txt": [], "syn": [], "boxes": []}
            cur["end"] = t
            cur["txt"].append(txt)
            cur["syn"].append(syn)
            if box:
                cur["boxes"].append(box)
        elif cur is not None:
            segs.append(cur)
            cur = None
    if cur:
        segs.append(cur)
    out = []
    for s in segs:
        dur = s["end"] - s["start"] + 1 / sample_fps
        if dur < 0.5:
            continue
        syn, txt = float(np.mean(s["syn"])), float(np.mean(s["txt"]))
        box = tuple(np.median(np.array(s["boxes"]), axis=0)) if s["boxes"] else None
        kind = "full-frame graphic (card / map / frame)" if syn > 0.35 else "text overlay"
        if kind == "text overlay" and box and box[1] > 0.8 and (box[3] - box[1]) < 0.12:
            kind = "subtitle / caption"
        rec = {"start": round(s["start"], 2), "end": round(s["end"] + 1 / sample_fps, 2), "duration": round(dur, 2),
               "kind": kind, "position": _position(box) if box else "n/a",
               "text_score": round(txt, 2), "synthetic_score": round(syn, 2)}
        if box and kind != "subtitle / caption":
            rec["entry"] = _animation(cap, fps, max(0, s["start"] - 0.5), s["start"] + 0.6, box)
        out.append(rec)
    # strips for review (skip subtitles; they are plentiful and uninteresting)
    sheets = []
    review = [g for g in out if g["kind"] != "subtitle / caption"]
    if sheet_dir and review:
        sheet_dir.mkdir(parents=True, exist_ok=True)
        rows_per_sheet = 8
        for si in range(0, len(review), rows_per_sheet):
            chunk = review[si:si + rows_per_sheet]
            tw, th = 240, 135
            img = Image.new("RGB", (5 * (tw + 2), len(chunk) * (th + 16)), (18, 18, 18))
            d = ImageDraw.Draw(img)
            for r, g in enumerate(chunk):
                ts = [max(0, g["start"] - 0.6), g["start"] + 0.15, (g["start"] + g["end"]) / 2, max(g["start"], g["end"] - 0.15), g["end"] + 0.6]
                for c, t in enumerate(ts):
                    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
                    ok, fr = cap.read()
                    if ok:
                        img.paste(Image.fromarray(cv2.cvtColor(cv2.resize(fr, (tw, th)), cv2.COLOR_BGR2RGB)), (c * (tw + 2), r * (th + 16)))
                m, s_ = divmod(int(g["start"]), 60)
                d.text((2, r * (th + 16) + th + 1), f"#{si + r} {m}:{s_:02d} {g['duration']}s {g['kind']} | {g['position']} | {g.get('entry', '')}", fill=(255, 220, 90))
            p = sheet_dir / f"graphics_{si // rows_per_sheet + 1:02d}.jpg"
            img.save(p, quality=85)
            sheets.append(str(p))
    cap.release()
    counts = {}
    for g in out:
        counts[g["kind"]] = counts.get(g["kind"], 0) + 1
    entries = {}
    for g in out:
        if "entry" in g:
            key = g["entry"].split(" (")[0]
            entries[key] = entries.get(key, 0) + 1
    return {"segments": out, "sheets": sheets,
            "summary": {"counts": counts, "entry_animations": entries,
                        "graphics_per_min": round(len(review) / max(1e-6, n / fps / 60), 2),
                        "subtitled_share": round(sum(g["duration"] for g in out if g["kind"] == "subtitle / caption") / max(1e-6, n / fps), 3)}}
