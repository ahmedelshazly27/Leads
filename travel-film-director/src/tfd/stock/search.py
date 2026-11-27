"""Free stock footage search + download (Pexels, Pixabay) for filler shots in your own edits.

Keys (free): PEXELS_API_KEY (https://www.pexels.com/api/) and PIXABAY_API_KEY (https://pixabay.com/api/docs/).
Both libraries allow free use, including commercial, without attribution; credit is recorded anyway in
<project>/stock/stock_manifest.json. Downloads never overwrite files.
"""
from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path

from ..log import get_logger
from ..util import read_json, safe_output_path, write_json

log = get_logger("stock")


@dataclass
class StockClip:
    provider: str
    id: str
    page_url: str
    duration: float
    width: int
    height: int
    preview: str
    download_url: str
    author: str
    license: str
    tags: str = ""


def _get_json(url: str, headers: dict | None = None) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "travel-film-director/0.4", **(headers or {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def _best_file(files: list[dict], max_height: int) -> dict | None:
    ok = [f for f in files if (f.get("height") or 0) <= max_height and f.get("link") or f.get("url")]
    return max(ok, key=lambda f: (f.get("height") or 0) * (f.get("width") or 0)) if ok else None


def search_pexels(query: str, per_page: int = 15, orientation: str = "landscape", max_height: int = 2160) -> list[StockClip]:
    key = os.environ.get("PEXELS_API_KEY")
    if not key:
        raise RuntimeError("PEXELS_API_KEY not set (free key: https://www.pexels.com/api/)")
    q = urllib.parse.urlencode({"query": query, "per_page": per_page, "orientation": orientation})
    data = _get_json(f"https://api.pexels.com/videos/search?{q}", {"Authorization": key})
    out = []
    for v in data.get("videos", []):
        f = _best_file(v.get("video_files", []), max_height)
        if not f:
            continue
        out.append(StockClip("pexels", str(v["id"]), v.get("url", ""), float(v.get("duration", 0)), int(f.get("width") or 0),
                             int(f.get("height") or 0), v.get("image", ""), f["link"], (v.get("user") or {}).get("name", ""),
                             "Pexels License (free to use, no attribution required)"))
    return out


def search_pixabay(query: str, per_page: int = 15, max_height: int = 2160) -> list[StockClip]:
    key = os.environ.get("PIXABAY_API_KEY")
    if not key:
        raise RuntimeError("PIXABAY_API_KEY not set (free key: https://pixabay.com/api/docs/)")
    q = urllib.parse.urlencode({"key": key, "q": query, "per_page": max(3, per_page), "video_type": "film"})
    data = _get_json(f"https://pixabay.com/api/videos/?{q}")
    out = []
    for v in data.get("hits", []):
        sizes = [dict(link=s.get("url"), **s) for s in (v.get("videos") or {}).values() if s.get("url")]
        f = _best_file(sizes, max_height)
        if not f:
            continue
        out.append(StockClip("pixabay", str(v["id"]), v.get("pageURL", ""), float(v.get("duration", 0)), int(f.get("width") or 0),
                             int(f.get("height") or 0), f.get("thumbnail", ""), f["link"], v.get("user", ""),
                             "Pixabay Content License (free to use, no attribution required)", v.get("tags", "")))
    return out


def search(query: str, providers: tuple[str, ...] = ("pexels", "pixabay"), min_duration: float = 4.0, **kw) -> list[StockClip]:
    results, errors = [], []
    for p in providers:
        try:
            results += (search_pexels if p == "pexels" else search_pixabay)(query, **kw)
        except Exception as e:
            errors.append(f"{p}: {e}")
            log.warning("%s search failed: %s", p, e)
    if not results and errors:
        raise RuntimeError("; ".join(errors))
    return [r for r in results if r.duration >= min_duration]


def download(clip: StockClip, project: Path) -> Path:
    out_dir = project / "stock"
    out_dir.mkdir(parents=True, exist_ok=True)
    dest = safe_output_path(out_dir / f"{clip.provider}_{clip.id}.mp4")
    req = urllib.request.Request(clip.download_url, headers={"User-Agent": "travel-film-director/0.4"})
    with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    man_path = out_dir / "stock_manifest.json"
    manifest = read_json(man_path) if man_path.is_file() else []
    manifest.append({**asdict(clip), "file": dest.name})
    write_json(man_path, manifest)
    log.info("stock %s:%s -> %s", clip.provider, clip.id, dest.name)
    return dest
