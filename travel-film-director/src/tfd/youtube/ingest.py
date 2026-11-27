"""YouTube reference ingestion without downloading the video.

What we fetch (all things YouTube serves publicly to any viewer's player):
  * metadata (title, channel, duration, chapters, "most replayed" heatmap)
  * subtitles / auto-captions (json3)
  * storyboard sprite sheets - the low-res preview thumbnails the player shows while scrubbing

What we never fetch: the audio/video streams. No DRM or access control is bypassed; private,
members-only or age-gated videos simply fail with a clear error.
"""
from __future__ import annotations

import io
import json
import time
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from PIL import Image

from ..config import Settings
from ..log import get_logger
from ..schemas import Chapter, TranscriptSegment
from ..util import write_json, youtube_id

log = get_logger("youtube")


class YouTubeError(RuntimeError):
    pass


@dataclass
class ReferenceSource:
    video_id: str
    url: str
    meta: dict
    chapters: list[Chapter]
    heatmap: list[dict]
    transcript: list[TranscriptSegment]
    transcript_kind: str  # manual | auto | none
    transcript_language: str | None
    frames: list[tuple[float, Path]] = field(default_factory=list)
    frame_interval_s: float | None = None
    storyboard_label: str = "none"


def _ydl_opts(settings: Settings, player_client: str) -> dict:
    opts: dict = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
        "socket_timeout": 30,
    }
    if player_client != "default":
        opts["extractor_args"] = {"youtube": {"player_client": player_client.split(",")}}
    if settings.yt_cookies:
        opts["cookiefile"] = settings.yt_cookies
    if settings.yt_cookies_from_browser:
        opts["cookiesfrombrowser"] = (settings.yt_cookies_from_browser,)
    return opts


def _extract_info(url: str, settings: Settings):
    import yt_dlp

    last_err: Exception | None = None
    for client in settings.yt_player_clients:
        for attempt in range(2):
            try:
                ydl = yt_dlp.YoutubeDL(_ydl_opts(settings, client))
                info = ydl.extract_info(url, download=False)
                if info.get("_has_drm") or info.get("has_drm"):
                    raise YouTubeError("Video is DRM protected - refusing to analyse.")
                if info.get("availability") not in (None, "public", "unlisted"):
                    raise YouTubeError(f"Video availability is {info.get('availability')!r}; only public/unlisted videos are analysed.")
                log.info("metadata via player_client=%s", client)
                return ydl, info
            except YouTubeError:
                raise
            except Exception as e:  # yt-dlp raises DownloadError for bot checks, 429 etc.
                last_err = e
                msg = str(e)
                log.warning("yt-dlp (%s) attempt %d failed: %s", client, attempt + 1, msg.splitlines()[0][:200])
                if "429" in msg:
                    time.sleep(5 * (attempt + 1))
                else:
                    break
    hint = ""
    if last_err and "not a bot" in str(last_err):
        hint = (" YouTube asked for a sign-in check. Set TFD_YT_COOKIES (cookies.txt exported from your own"
                " browser) or TFD_YT_COOKIES_FROM_BROWSER=firefox|chrome and retry.")
    raise YouTubeError(f"Could not read video metadata: {last_err}.{hint}")


# ---------------------------------------------------------------- subtitles

def parse_json3(data: dict) -> list[TranscriptSegment]:
    segs: list[TranscriptSegment] = []
    for ev in data.get("events", []):
        if "segs" not in ev or ev.get("aAppend"):
            continue
        text = "".join(s.get("utf8", "") for s in ev["segs"]).replace("\n", " ").strip()
        if not text:
            continue
        start = ev.get("tStartMs", 0) / 1000.0
        dur = ev.get("dDurationMs", 0) / 1000.0
        segs.append(TranscriptSegment(start=start, end=start + dur, text=text))
    # auto captions overlap (rolling two-line display); clip each cue at the next start
    for a, b in zip(segs, segs[1:]):
        if a.end > b.start:
            a.end = max(a.start, b.start)
    return segs


def _pick_track(info: dict) -> tuple[str, str, dict] | None:
    """Prefer English (the storytelling vocabulary metrics are English), then the original language.

    Order: human English subs -> English auto captions (speech recognition for English videos, YouTube's
    machine translation for others) -> human original-language subs -> original-language auto captions.
    """
    orig = info.get("language") or ""
    manual = info.get("subtitles") or {}
    auto = info.get("automatic_captions") or {}
    order = [("manual", manual, ["en", "en-US", "en-GB"]),
             ("auto", auto, ["en-orig", "en", "en-US", "en-GB"]),
             ("manual", manual, [orig] if orig else []),
             ("auto", auto, [f"{orig}-orig", orig] if orig else [])]
    for kind, tracks, langs in order:
        for lang in langs:
            if lang and lang in tracks:
                for fmt in tracks[lang]:
                    if fmt.get("ext") == "json3":
                        if kind == "auto" and lang.startswith("en") and orig and not orig.startswith("en"):
                            kind = "auto-translated"
                        return kind, lang, fmt
    for lang, fmts in auto.items():
        if lang.endswith("-orig"):
            for fmt in fmts:
                if fmt.get("ext") == "json3":
                    return "auto", lang, fmt
    return None


def _try_track(ydl, info: dict, attempts: int = 3):
    pick = _pick_track(info)
    if not pick:
        return None
    kind, lang, fmt = pick
    for i in range(attempts):
        try:
            raw = ydl.urlopen(fmt["url"]).read()
            if raw.strip():
                segs = parse_json3(json.loads(raw))
                if segs:
                    return segs, kind, lang
            log.warning("subtitle track %s returned empty body (attempt %d)", lang, i + 1)
        except Exception as e:
            log.warning("subtitle download failed (%s, attempt %d): %s", lang, i + 1, e)
        time.sleep(2 * (i + 1))
    return None


def fetch_transcript(ydl, info: dict, settings: Settings | None = None) -> tuple[list[TranscriptSegment], str, str | None]:
    got = _try_track(ydl, info)
    if got:
        return got
    # YouTube sometimes serves an empty caption body for one client session; re-resolve with each client.
    if settings is not None:
        import yt_dlp
        for client in settings.yt_player_clients + ["web_embedded"]:
            try:
                ydl2 = yt_dlp.YoutubeDL(_ydl_opts(settings, client))
                info2 = ydl2.extract_info(info["webpage_url"], download=False)
                got = _try_track(ydl2, info2, attempts=2)
                if got:
                    log.info("subtitles via fresh %s session", client)
                    return got
            except Exception as e:
                log.warning("re-resolve with %s failed: %s", client, str(e).splitlines()[0][:150])
    # fallback: youtube-transcript-api (works on most residential connections)
    try:
        from youtube_transcript_api import YouTubeTranscriptApi

        fetched = YouTubeTranscriptApi().fetch(info["id"], languages=["en", info.get("language") or "en"])
        segs = [TranscriptSegment(start=s.start, end=s.start + s.duration, text=s.text) for s in fetched.snippets]
        return segs, ("auto" if fetched.is_generated else "manual"), fetched.language_code
    except Exception as e:
        log.warning("youtube-transcript-api fallback failed: %s", str(e).splitlines()[0][:200])
    return [], "none", None


# ---------------------------------------------------------------- storyboards

def _best_storyboard(info: dict) -> dict | None:
    sbs = [f for f in info.get("formats", []) if str(f.get("format_id", "")).startswith("sb") and f.get("fragments")]
    if not sbs:
        return None
    return max(sbs, key=lambda f: (f.get("width") or 0))


def _is_blank(tile: np.ndarray) -> bool:
    return float(tile.std()) < 2.0 and float(tile.mean()) < 8.0


def fetch_storyboard_frames(ydl, info: dict, out_dir: Path, max_frames: int = 400) -> tuple[list[tuple[float, Path]], float | None, str]:
    fmt = _best_storyboard(info)
    if not fmt:
        return [], None, "none"
    w, h = int(fmt["width"]), int(fmt["height"])
    rows, cols = int(fmt.get("rows") or 1), int(fmt.get("columns") or 1)
    fps = float(fmt.get("fps") or 0) or None
    duration = float(info.get("duration") or 0)
    per_sheet = rows * cols
    total_tiles = per_sheet * len(fmt["fragments"])
    interval = (1.0 / fps) if fps else (duration / max(1, total_tiles))
    out_dir.mkdir(parents=True, exist_ok=True)
    frames: list[tuple[float, Path]] = []
    idx = 0
    for frag in fmt["fragments"]:
        try:
            data = ydl.urlopen(frag["url"]).read()
            sheet = Image.open(io.BytesIO(data)).convert("RGB")
        except Exception as e:
            log.warning("storyboard sheet failed: %s", e)
            idx += per_sheet
            continue
        for r in range(rows):
            for c in range(cols):
                t = idx * interval
                idx += 1
                if duration and t >= duration:
                    continue
                box = (c * w, r * h, (c + 1) * w, (r + 1) * h)
                if box[2] > sheet.width or box[3] > sheet.height:
                    continue
                tile = sheet.crop(box)
                if _is_blank(np.asarray(tile)):
                    continue
                p = out_dir / f"f{len(frames):04d}_{t:08.1f}.jpg"
                tile.save(p, quality=90)
                frames.append((t, p))
    if len(frames) > max_frames:  # keep an even subsample for very long videos
        step = len(frames) / max_frames
        frames = [frames[int(i * step)] for i in range(max_frames)]
    label = f"YouTube storyboard {w}x{h}, one frame every {interval:.1f}s"
    return frames, interval, label


# ---------------------------------------------------------------- main entry

_META_KEYS = ("id", "title", "channel", "channel_id", "channel_url", "uploader", "upload_date", "duration",
              "view_count", "like_count", "comment_count", "categories", "tags", "description", "language",
              "availability", "webpage_url", "channel_follower_count")


def ingest_reference(url: str, work_dir: Path, settings: Settings, transcript_file: Path | None = None) -> ReferenceSource:
    vid = youtube_id(url)
    canonical = f"https://www.youtube.com/watch?v={vid}"
    ydl, info = _extract_info(canonical, settings)
    meta = {k: info.get(k) for k in _META_KEYS}
    write_json(work_dir / "metadata.json", meta)

    duration = float(info.get("duration") or 0)
    chapters = [Chapter(start=c["start_time"], end=c["end_time"], title=c.get("title") or "")
                for c in (info.get("chapters") or [])]
    heatmap = [{"start": h["start_time"], "end": h["end_time"], "value": h["value"]} for h in (info.get("heatmap") or [])]

    if transcript_file:
        from ..analysis.transcript import parse_subtitle_text
        transcript = parse_subtitle_text(Path(transcript_file).read_text(encoding="utf-8", errors="replace"))
        kind, lang = "manual", "user-supplied"
    else:
        transcript, kind, lang = fetch_transcript(ydl, info, settings)
    write_json(work_dir / "transcript.json", [s.model_dump() for s in transcript])
    log.info("%s: transcript %s (%s, %d cues)", vid, kind, lang, len(transcript))

    frames, interval, label = fetch_storyboard_frames(ydl, info, work_dir / "frames")
    log.info("%s: %d storyboard frames (%s)", vid, len(frames), label)
    if duration == 0 and transcript:
        duration = transcript[-1].end
    meta["duration"] = duration
    src = ReferenceSource(vid, canonical, meta, chapters, heatmap, transcript, kind, lang, frames, interval, label)
    write_json(work_dir / "source.json", {
        "video_id": vid, "url": canonical, "meta": meta, "chapters": [c.model_dump() for c in chapters],
        "heatmap": heatmap, "transcript_kind": kind, "transcript_language": lang,
        "frames": [[t, p.name] for t, p in frames], "frame_interval_s": interval, "storyboard_label": label})
    return src


def load_cached_source(work_dir: Path) -> ReferenceSource:
    """Rebuild a ReferenceSource from files saved by a previous ingest (no network)."""
    d = json.loads((work_dir / "source.json").read_text(encoding="utf-8"))
    tr = [TranscriptSegment(**x) for x in json.loads((work_dir / "transcript.json").read_text(encoding="utf-8"))]
    return ReferenceSource(d["video_id"], d["url"], d["meta"], [Chapter(**c) for c in d["chapters"]], d["heatmap"], tr,
                           d["transcript_kind"], d["transcript_language"],
                           [(t, work_dir / "frames" / n) for t, n in d["frames"]], d["frame_interval_s"], d["storyboard_label"])
