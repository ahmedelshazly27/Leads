"""FFmpeg preview render of plan.json (the editable master is the OTIO timeline; this is for review/QA).
Conforms every clip to 1920x1080 (or the requested size) at 25 fps with letterbox/pillarbox, loudness-normalises
dialogue, and ducks music under sync sound with sidechain compression."""
from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

from ..log import get_logger
from ..util import read_json, safe_output_path

log = get_logger("render")


def _ff(args: list[str]) -> None:
    exe = shutil.which("ffmpeg")
    if not exe:
        raise RuntimeError("ffmpeg not found on PATH")
    r = subprocess.run([exe, "-hide_banner", "-loglevel", "error", "-y", *args], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip()[-800:])


def video_encoder() -> list[str]:
    """Hardware H.264 (VideoToolbox) on macOS when FFmpeg has it, else libx264. Override: TFD_VIDEO_ENCODER."""
    import os
    import platform
    forced = os.environ.get("TFD_VIDEO_ENCODER")
    exe = shutil.which("ffmpeg") or "ffmpeg"
    if forced == "libx264" or (not forced and platform.system() != "Darwin"):
        return ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20"]
    encs = subprocess.run([exe, "-hide_banner", "-encoders"], capture_output=True, text=True).stdout
    if "h264_videotoolbox" in encs and forced in (None, "", "h264_videotoolbox"):
        return ["-c:v", "h264_videotoolbox", "-b:v", "16M", "-allow_sw", "1"]
    return ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20"]


def render_preview(project: Path, width: int = 1920, height: int = 1080, fps: int = 25) -> Path:
    plan = read_json(project / "plan.json")
    out_dir = project / "renders"
    out_dir.mkdir(parents=True, exist_ok=True)
    vf = (f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,"
          f"setsar=1,fps={fps},format=yuv420p")
    venc = video_encoder()
    log.info("video encoder: %s", venc[1])
    with tempfile.TemporaryDirectory(dir=out_dir) as tmp:
        parts = []
        for i, item in enumerate(plan["timeline"]):
            c = plan["clips"][item["clip"]]
            dur = item["src_out"] - item["src_in"]
            part = Path(tmp) / f"p{i:04d}.mp4"
            gain = "0" if item["audio"] == "sync" else str(plan["audio_rules"].get("ambient_db", -14))
            args = ["-ss", f"{item['src_in']:.3f}", "-t", f"{dur:.3f}", "-i", c["path"],
                    "-f", "lavfi", "-t", f"{dur:.3f}", "-i", "anullsrc=r=48000:cl=stereo",
                    "-filter_complex",
                    f"[0:v]{vf}[v];[0:a]aresample=48000,aformat=channel_layouts=stereo,volume={gain}dB[a0];"
                    f"[a0][1:a]amix=inputs=2:duration=longest:normalize=0,atrim=0:{dur:.3f}[a]",
                    "-map", "[v]", "-map", "[a]", *venc,
                    "-c:a", "aac", "-b:a", "192k", str(part)]
            try:
                _ff(args)
            except RuntimeError:  # clip without audio stream
                _ff(["-ss", f"{item['src_in']:.3f}", "-t", f"{dur:.3f}", "-i", c["path"],
                     "-f", "lavfi", "-t", f"{dur:.3f}", "-i", "anullsrc=r=48000:cl=stereo",
                     "-filter_complex", f"[0:v]{vf}[v]", "-map", "[v]", "-map", "1:a",
                     *venc, "-c:a", "aac", "-shortest", str(part)])
            parts.append(part)
        lst = Path(tmp) / "list.txt"
        lst.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf-8")
        joined = Path(tmp) / "joined.mp4"
        _ff(["-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(joined)])
        out = safe_output_path(out_dir / "preview.mp4")
        if plan.get("music"):
            mdb = plan["audio_rules"]["music_alone_db"]
            _ff(["-i", str(joined), "-stream_loop", "-1", "-i", plan["music"][0], "-filter_complex",
                 f"[1:a]volume={mdb}dB[m];[m][0:a]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[duck];"
                 f"[0:a][duck]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]",
                 "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(out)])
        else:
            _ff(["-i", str(joined), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", str(out)])
    log.info("rendered %s", out)
    return out
