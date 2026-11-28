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


TITLE_FADE_S = 0.3   # place cards fade in/out; subtitles and hook words cut on the beat
GRAIN = "noise=c0s=3:c0f=t"  # fine temporal luma grain: hides banding from stretched 8-bit log proxies


def _overlay_chain(events: list[dict], i: int, tmp: Path, width: int, height: int,
                   first_input: int = 2, start: str = "base") -> tuple[list[str], str, str]:
    """FFmpeg inputs and filter chain overlaying each text event's PNG on [start] for its time window."""
    from .captions import render_text_png
    inputs, chain, last = [], "", start
    for k, ev in enumerate(events):
        png = render_text_png(ev["text"], tmp / f"t{i:04d}_{k:02d}.png", width, height, ev["kind"])
        a, b = ev["a"], ev["b"]
        inputs += ["-loop", "1", "-t", f"{b + 0.1:.3f}", "-i", str(png)]
        src = f"[{k + first_input}:v]"
        if ev["kind"] == "title":
            fd = min(TITLE_FADE_S, (b - a) / 3)
            chain += (f";{src}format=rgba,fade=t=in:st={a}:d={fd:.3f}:alpha=1,"
                      f"fade=t=out:st={b - fd:.3f}:d={fd:.3f}:alpha=1[f{k}]")
            src = f"[f{k}]"
        chain += f";[{last}]{src}overlay=0:0:enable='between(t,{a},{b})'[o{k}]"
        last = f"o{k}"
    return inputs, chain, last


def _render_item(i: int, item: dict, plan: dict, cues: list, tmp: Path, vf: str, venc: list, width: int, height: int) -> Path:
    from .captions import overlays_for
    from .grade import ffmpeg_filters
    c = plan["clips"][item["clip"]]
    grade = plan.get("grade") or {}
    dur = item["src_out"] - item["src_in"]
    lut = (grade.get("luts") or {}).get(f"{item.get('grade_intensity', 0.8):.1f}")
    gf = ffmpeg_filters((grade.get("corrections") or {}).get(item["clip"], {}), Path(lut) if lut else None)
    vf_item = (gf + "," + vf) if gf else vf
    from .cutaways import cutaway_chain, windows_for
    cw_inputs, cw_chain, cw_last = cutaway_chain(windows_for(item, plan.get("cutaways", [])), plan, 2, vf)
    events = overlays_for(item["record_in"], item["record_out"], cues, plan.get("titles", []))
    png_inputs, chain, last = _overlay_chain(events, i, tmp, width, height,
                                             first_input=2 + len(cw_inputs) // 6, start=cw_last)
    video, vmap = f"[0:v]{vf_item}[base]{cw_chain}{chain}", f"[{last}]"
    part = tmp / f"p{i:04d}.mp4"
    gain = "0" if item["audio"] == "sync" else str(plan["audio_rules"].get("ambient_db", -14))
    inputs = ["-ss", f"{item['src_in']:.3f}", "-t", f"{dur:.3f}", "-i", c["path"],
              "-f", "lavfi", "-t", f"{dur:.3f}", "-i", "anullsrc=r=48000:cl=stereo", *cw_inputs, *png_inputs]
    try:
        _ff([*inputs, "-filter_complex",
             f"{video};[0:a]aresample=48000,aformat=channel_layouts=stereo,volume={gain}dB[a0];"
             f"[a0][1:a]amix=inputs=2:duration=longest:normalize=0,atrim=0:{dur:.3f}[a]",
             "-map", vmap, "-map", "[a]", "-t", f"{dur:.3f}", *venc, "-c:a", "aac", "-b:a", "192k", str(part)])
    except RuntimeError:  # clip without audio stream
        _ff([*inputs, "-filter_complex", video, "-map", vmap, "-map", "1:a", "-t", f"{dur:.3f}",
             *venc, "-c:a", "aac", str(part)])
    return part


def render_preview(project: Path, width: int = 1920, height: int = 1080, fps: int = 25,
                   until: float | None = None) -> Path:
    """Render plan.json to renders/preview.mp4, or with `until` only the items starting before that many seconds
    to renders/sample.mp4 (to judge the look, text and pacing before a full render)."""
    plan = read_json(project / "plan.json")
    out_dir = project / "renders"
    out_dir.mkdir(parents=True, exist_ok=True)
    vf = (f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,"
          f"setsar=1,fps={fps},format=yuv420p,{GRAIN}")
    venc = video_encoder()
    log.info("video encoder: %s", venc[1])
    from .captions import caption_cues, load_transcripts
    cues = caption_cues(plan, load_transcripts(project)) if plan.get("burn_subtitles", True) else []
    items = [it for it in plan["timeline"] if until is None or it["record_in"] < until]
    with tempfile.TemporaryDirectory(dir=out_dir) as tmp:
        parts = [_render_item(i, it, plan, cues, Path(tmp), vf, venc, width, height) for i, it in enumerate(items)]
        lst = Path(tmp) / "list.txt"
        lst.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf-8")
        joined = Path(tmp) / "joined.mp4"
        _ff(["-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(joined)])
        out = safe_output_path(out_dir / ("sample.mp4" if until is not None else "preview.mp4"))
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
