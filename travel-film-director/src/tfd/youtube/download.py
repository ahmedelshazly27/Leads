"""Download reference videos for private, personal analysis (run this on your own computer).

Videos are stored under data/library/<creator>/<video_id>/media/ (never committed). From a home connection yt-dlp
downloads normally; set TFD_YT_COOKIES_FROM_BROWSER=safari|chrome|firefox if YouTube asks for a sign-in check.
Cloud/datacenter IPs are usually refused (HTTP 403) - that is expected, run it locally.
"""
from __future__ import annotations

from pathlib import Path

from ..config import Settings, get_settings
from ..log import get_logger
from .ingest import _ydl_opts

log = get_logger("download")


class DownloadError(RuntimeError):
    pass


def fetch_video(video_id: str, out_dir: Path, settings: Settings | None = None, max_height: int = 720) -> Path:
    import yt_dlp
    settings = settings or get_settings()
    out_dir.mkdir(parents=True, exist_ok=True)
    existing = [p for p in out_dir.glob("video.*") if p.suffix in (".mp4", ".mkv", ".webm")]
    if existing:
        return existing[0]
    fmt = (f"bv*[height<={max_height}][ext=mp4]+ba[ext=m4a]/bv*[height<={max_height}]+ba/"
           f"b[height<={max_height}]/b")
    last = None
    for client in ["default"] + settings.yt_player_clients:
        opts = _ydl_opts(settings, client)
        opts.update({"skip_download": False, "format": fmt, "merge_output_format": "mp4",
                     "outtmpl": str(out_dir / "video.%(ext)s"), "retries": 3, "continuedl": True})
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([f"https://www.youtube.com/watch?v={video_id}"])
            got = [p for p in out_dir.glob("video.*") if p.suffix in (".mp4", ".mkv", ".webm")]
            if got:
                log.info("downloaded %s (%s, %.0f MB)", video_id, client, got[0].stat().st_size / 1e6)
                return got[0]
        except Exception as e:
            last = e
            log.warning("download via %s failed: %s", client, str(e).splitlines()[0][:160])
    raise DownloadError(f"could not download {video_id}: {last}. On a cloud server this is expected (YouTube "
                        "refuses datacenter IPs); run `tfd ref deep` on your own Mac.")
