"""Ingest a folder of the user's own clips. Read-only: originals are never modified, moved or re-encoded.

Per clip: ffprobe metadata (resolution, fps, orientation, codec, device hints), sampled frames, sharpness,
shake (frame-to-frame global motion jitter), exposure, scene changes (PySceneDetect when available),
contact sheet, optional speech transcription (faster-whisper), near-duplicate detection, quality ranking.
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import cv2
import numpy as np

from ..analysis.contact_sheet import build_contact_sheets
from ..analysis.frames import analyse_frame, frame_distance, hist_signature
from ..analysis import style
from ..log import get_logger
from ..util import write_json

log = get_logger("footage")
VIDEO_EXT = {".mp4", ".mov", ".m4v", ".mkv", ".avi", ".mts", ".m2ts", ".insv", ".lrv", ".mxf", ".webm"}


def _ffprobe(path: Path) -> dict:
    exe = shutil.which("ffprobe")
    if not exe:
        raise RuntimeError("ffprobe not found - install FFmpeg and put it on PATH")
    out = subprocess.run([exe, "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)],
                         capture_output=True, text=True, timeout=60)
    if out.returncode != 0:
        raise RuntimeError(out.stderr.strip()[:300])
    return json.loads(out.stdout)


def _rotation(vs: dict) -> int:
    rot = vs.get("tags", {}).get("rotate")
    if rot is not None:
        return int(rot) % 360
    for sd in vs.get("side_data_list", []) or []:
        if "rotation" in sd:
            return int(sd["rotation"]) % 360
    return 0


def device_guess(fmt_tags: dict, vs: dict, name: str) -> str:
    blob = " ".join(str(v) for v in list(fmt_tags.values()) + [vs.get("codec_name", ""), name]).lower()
    if "apple" in blob or "iphone" in blob:
        return "iPhone"
    if "osmo" in blob or "pocket" in blob:
        return "DJI Osmo Pocket"
    if "dji" in blob or name.upper().startswith("DJI_"):
        return "DJI (drone or gimbal)"
    if "gopro" in blob or name.upper().startswith(("GX", "GH", "GOPR")):
        return "GoPro"
    if "insta360" in blob or name.lower().endswith(".insv"):
        return "Insta360"
    return "unknown"


def probe(path: Path) -> dict:
    d = _ffprobe(path)
    vs = next((s for s in d["streams"] if s.get("codec_type") == "video"), None)
    if vs is None:
        raise RuntimeError("no video stream")
    aus = next((s for s in d["streams"] if s.get("codec_type") == "audio"), None)
    w, h = int(vs.get("width", 0)), int(vs.get("height", 0))
    rot = _rotation(vs)
    dw, dh = (h, w) if rot in (90, 270) else (w, h)
    num, _, den = (vs.get("avg_frame_rate") or vs.get("r_frame_rate") or "0/1").partition("/")
    fps = float(num) / float(den or 1) if float(den or 1) else 0.0
    tags = d.get("format", {}).get("tags", {})
    return {
        "duration": float(d["format"].get("duration") or vs.get("duration") or 0),
        "width": dw, "height": dh, "fps": round(fps, 3), "rotation": rot,
        "orientation": "vertical" if dh > dw else "horizontal" if dw > dh else "square",
        "codec": vs.get("codec_name"), "pix_fmt": vs.get("pix_fmt"),
        "hdr": vs.get("color_transfer") in ("smpte2084", "arib-std-b67"),
        "color_transfer": vs.get("color_transfer"),
        "has_audio": aus is not None,
        "creation_time": tags.get("creation_time"),
        "device": device_guess(tags, vs, path.name),
        "size_bytes": int(d["format"].get("size") or 0),
    }


def sample_frames(path: Path, out_dir: Path, duration: float, n: int = 8, width: int = 480) -> list[tuple[float, Path]]:
    out_dir.mkdir(parents=True, exist_ok=True)
    cap = cv2.VideoCapture(str(path))
    frames = []
    if not cap.isOpened():
        return frames
    for i in range(n):
        t = duration * (i + 0.5) / n
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ok, img = cap.read()
        if not ok:
            continue
        img = cv2.resize(img, (width, int(img.shape[0] * width / img.shape[1])))
        p = out_dir / f"{i:02d}_{t:07.2f}.jpg"
        cv2.imwrite(str(p), img)
        frames.append((t, p))
    cap.release()
    return frames


def motion_stats(path: Path, duration: float, seconds: float = 4.0) -> dict:
    """Global motion from sparse optical flow on a short window in the middle of the clip.
    shake = high-frequency jitter of the per-frame translation; pan = mean translation (camera movement)."""
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        return {}
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    cap.set(cv2.CAP_PROP_POS_MSEC, max(0.0, duration / 2 - seconds / 2) * 1000)
    prev, moves = None, []
    for _ in range(int(min(seconds, duration) * fps)):
        ok, img = cap.read()
        if not ok:
            break
        g = cv2.cvtColor(cv2.resize(img, (320, int(img.shape[0] * 320 / img.shape[1]))), cv2.COLOR_BGR2GRAY)
        if prev is not None:
            pts = cv2.goodFeaturesToTrack(prev, 150, 0.01, 8)
            if pts is not None and len(pts) >= 8:
                nxt, st, _ = cv2.calcOpticalFlowPyrLK(prev, g, pts, None)
                good = st.flatten() == 1
                if good.sum() >= 8:
                    m, _ = cv2.estimateAffinePartial2D(pts[good], nxt[good])
                    if m is not None:
                        moves.append((m[0, 2], m[1, 2], float(np.hypot(m[0, 0], m[1, 0]))))
        prev = g
    cap.release()
    if len(moves) < 3:
        return {}
    a = np.array(moves)
    jitter = float(np.mean(np.abs(np.diff(a[:, :2], axis=0))))
    dx, dy, sc = float(np.mean(a[:, 0])), float(np.mean(a[:, 1])), float(np.mean(a[:, 2]))
    mv = "static / locked-off"
    if abs(sc - 1) > 0.002:
        mv = "push-in" if sc > 1 else "pull-out"
    elif max(abs(dx), abs(dy)) > 0.6:
        mv = ("pan/track " + ("left" if dx > 0 else "right")) if abs(dx) >= abs(dy) else ("tilt " + ("up" if dy > 0 else "down"))
    return {"shake_px": round(jitter, 3), "mean_dx": round(dx, 3), "mean_dy": round(dy, 3), "zoom": round(sc, 4),
            "camera_movement": mv}


def scene_cuts(path: Path) -> list[float]:
    try:
        from scenedetect import ContentDetector, detect
        return [round(s[0].get_seconds(), 2) for s in detect(str(path), ContentDetector())][1:]
    except Exception as e:
        log.debug("scenedetect failed on %s: %s", path.name, e)
        return []


def transcribe(path: Path, model_size: str = "small") -> list[dict]:
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        log.warning("faster-whisper not installed: pip install -e .[transcribe]")
        return []
    global _WHISPER
    try:
        _WHISPER
    except NameError:
        _WHISPER = WhisperModel(model_size, device="auto", compute_type="int8")
    segs, _info = _WHISPER.transcribe(str(path), vad_filter=True)
    return [{"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()} for s in segs]


def quality_score(frames, motion: dict, meta: dict) -> tuple[float, list[str]]:
    flags = []
    sharp = float(np.median([f.sharpness for f in frames])) if frames else 0
    bright = float(np.mean([f.brightness for f in frames])) if frames else 0
    score = 1.0
    if sharp < 60:
        score -= 0.35; flags.append(f"soft/blurry (laplacian {sharp:.0f})")
    if bright < 0.04:
        score -= 0.8; flags.append("black / unusable")
    elif bright < 0.12:
        score -= 0.25; flags.append("very dark")
    elif bright > 0.88:
        score -= 0.25; flags.append("overexposed")
    shake = motion.get("shake_px", 0)
    if shake > 2.5:
        score -= 0.3; flags.append(f"shaky ({shake:.1f}px jitter)")
    if meta["duration"] < 1.5:
        score -= 0.3; flags.append("too short")
    score += 0.1 * min(1.0, meta["height"] / 2160) if meta["orientation"] == "horizontal" else 0
    return round(max(0.0, min(1.0, score)), 3), flags


def ingest_folder(folder: Path, out_dir: Path, transcribe_speech: bool = False, transcribe: bool | None = None) -> dict:
    if transcribe is not None:
        transcribe_speech = transcribe
    folder, out_dir = folder.resolve(), out_dir.resolve()
    if out_dir == folder or folder in out_dir.parents:
        raise ValueError("Output directory must be outside the footage folder (originals are never written to).")
    out_dir.mkdir(parents=True, exist_ok=True)
    clips = sorted(p for p in folder.rglob("*") if p.suffix.lower() in VIDEO_EXT and p.is_file())
    log.info("found %d clips in %s", len(clips), folder)
    records, sigs = [], []
    for i, path in enumerate(clips):
        cid = f"c{i:04d}"
        rec: dict = {"id": cid, "path": str(path), "name": path.name}
        try:
            meta = probe(path)
            fr_paths = sample_frames(path, out_dir / "frames" / cid, meta["duration"])
            frames = [analyse_frame(p, t) for t, p in fr_paths]
            motion = motion_stats(path, meta["duration"])
            q, flags = quality_score(frames, motion, meta)
            shot, conf, ev = style.shot_type(frames)
            rec.update(meta=meta, frames=[f.model_dump() for f in frames], motion=motion, quality=q, flags=flags,
                       shot_type=shot, visual_tags=style.visual_tags(frames), cuts=scene_cuts(path),
                       transcript=transcribe(path) if (transcribe_speech and meta["has_audio"]) else [])
            if "establishing" in shot and motion.get("shake_px", 9) < 1.0 and meta["height"] >= 1080 and \
                    "DJI" in meta["device"]:
                rec["visual_tags"].append("possible drone/aerial")
            sigs.append((cid, np.mean([hist_signature(p) for _, p in fr_paths], axis=0) if fr_paths else None))
            log.info("[%d/%d] %s q=%.2f %s", i + 1, len(clips), path.name, q, ", ".join(flags))
        except Exception as e:
            rec["error"] = str(e)
            log.warning("skip %s: %s", path.name, e)
        records.append(rec)
    # near-duplicates: keep the higher-quality clip as the representative
    by_id = {r["id"]: r for r in records}
    for a in range(len(sigs)):
        for b in range(a + 1, len(sigs)):
            (ia, sa), (ib, sb) = sigs[a], sigs[b]
            if sa is None or sb is None:
                continue
            if frame_distance(sa, sb) < 0.06:
                worse, better = sorted((by_id[ia], by_id[ib]), key=lambda r: r.get("quality", 0))
                worse.setdefault("duplicate_of", better["id"])
    usable = [r for r in records if "error" not in r]
    all_frames = [(f["t"] + 0.0, Path(f["path"])) for r in usable for f in r["frames"][:1]]
    sheets = build_contact_sheets(all_frames, out_dir / "contact_sheets", title=f"Footage: {folder.name}") if all_frames else []
    report = {
        "folder": str(folder), "clips": records,
        "summary": {
            "clips": len(records), "usable": sum(1 for r in usable if r["quality"] >= 0.5 and "duplicate_of" not in r),
            "errors": sum(1 for r in records if "error" in r),
            "duplicates": sum(1 for r in records if "duplicate_of" in r),
            "total_minutes": round(sum(r["meta"]["duration"] for r in usable) / 60, 2),
            "devices": sorted({r["meta"]["device"] for r in usable}),
            "contact_sheets": [str(p) for p in sheets],
        },
    }
    write_json(out_dir / "footage.json", report)
    return report
