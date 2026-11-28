"""Animated route maps (the map-bridge grammar of Joe Hattab and Omar Farooq), in a restrained design of our own.

Outlines come from Natural Earth (public domain). A clip shows the country with its neighbours muted, draws the
route between the stops with eased motion, pops each stop with an English label and its Arabic name, and pushes in
slowly. Rendered with Pillow frame by frame and piped to FFmpeg, so no GIS or 3D stack is needed.
"""
from __future__ import annotations

import json
import math
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

from .typography import font

BG = (14, 17, 21)
LAND_OTHER = (34, 39, 46)
LAND_MAIN = (62, 70, 80)
EDGE = (120, 132, 145)
ROUTE = (240, 200, 120)
TEXT = (245, 245, 240)
SUBTEXT = (200, 200, 195)


def ease(t: float) -> float:
    """Smooth ease-in-out on 0..1."""
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


class Projection:
    """Equirectangular projection with cos(latitude) scaling, fitted to a lon/lat bbox inside the frame."""

    def __init__(self, bbox: tuple[float, float, float, float], width: int, height: int, margin: float = 0.12,
                 zoom: float = 1.0):
        lon0, lat0, lon1, lat1 = bbox
        self.cx, self.cy = (lon0 + lon1) / 2, (lat0 + lat1) / 2
        self.k = math.cos(math.radians(self.cy))
        span_x, span_y = (lon1 - lon0) * self.k, lat1 - lat0
        self.scale = min(width * (1 - 2 * margin) / span_x, height * (1 - 2 * margin) / span_y) * zoom
        self.w, self.h = width, height

    def __call__(self, lonlat: tuple[float, float]) -> tuple[float, float]:
        lon, lat = lonlat
        return (self.w / 2 + (lon - self.cx) * self.k * self.scale, self.h / 2 - (lat - self.cy) * self.scale)


def partial_route(points: list[tuple[float, float]], t: float) -> list[tuple[float, float]]:
    """The first fraction t (0..1) of a polyline, by length."""
    if t <= 0 or len(points) < 2:
        return points[:1]
    segs = [math.dist(a, b) for a, b in zip(points, points[1:])]
    target, out = sum(segs) * min(t, 1.0), [points[0]]
    for (a, b), d in zip(zip(points, points[1:]), segs):
        if target >= d:
            out.append(b)
            target -= d
            continue
        f = target / d if d else 0
        out.append((a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f))
        break
    return out


def _chaikin(ring: list[tuple[float, float]], rounds: int = 2) -> list[tuple[float, float]]:
    """Corner-cutting smoothing: Natural Earth 110m outlines are angular at full-frame size."""
    for _ in range(rounds):
        out = []
        for a, b in zip(ring, ring[1:] + ring[:1]):
            out += [(0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]), (0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1])]
        ring = out
    return ring


def _rings(feature: dict) -> list[list[tuple[float, float]]]:
    g = feature["geometry"]
    polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
    return [[tuple(p) for p in poly[0]] for poly in polys]


def _load(geojson: Path, country: str) -> tuple[list, list, tuple[float, float, float, float]]:
    feats = json.loads(Path(geojson).read_text(encoding="utf-8"))["features"]
    main = next(f for f in feats if f["properties"].get("ADMIN") == country)
    rings = _rings(main)
    xs = [p[0] for r in rings for p in r]
    ys = [p[1] for r in rings for p in r]
    bbox = (min(xs), min(ys), max(xs), max(ys))
    pad = 6.0
    others = [r for f in feats if f is not main for r in _rings(f)
              if any(bbox[0] - pad < p[0] < bbox[2] + pad and bbox[1] - pad < p[1] < bbox[3] + pad for p in r)]
    return rings, others, bbox


def _route_bbox(stops, bbox, width: int, height: int) -> tuple[float, float, float, float]:
    """Region around the stops, padded and widened to the frame's aspect, never larger than the country."""
    lons, lats = [s[2] for s in stops], [s[3] for s in stops]
    cx, cy = (min(lons) + max(lons)) / 2, (min(lats) + max(lats)) / 2
    k = math.cos(math.radians(cy))
    half_w = max((max(lons) - min(lons)) / 2 * k * 2.1, 2.0)  # wide enough to keep borders and context in frame
    half_h = max((max(lats) - min(lats)) / 2 * 2.1, 1.2)
    half_w = max(half_w, half_h * width / height)
    half_h = max(half_h, half_w * height / width)
    full_w, full_h = (bbox[2] - bbox[0]) / 2 * k, (bbox[3] - bbox[1]) / 2
    half_w, half_h = min(half_w, full_w), min(half_h, full_h)
    return (cx - half_w / k, cy - half_h, cx + half_w / k, cy + half_h)


def _lerp_box(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def _place_label(d, x, y, rad, size_main, size_ar, name, name_ar, lf, af, taken):
    """Right of the pin by default; left, below or above when that collides with an earlier label."""
    w = max(d.textlength(name, font=lf), d.textlength(name_ar, font=af, direction="rtl") if name_ar else 0)
    h = size_main + size_ar + 6
    for dx, dy in ((rad * 3.2, -size_main), (-rad * 3.2 - w, -size_main), (rad * 3.2, size_main * 0.6),
                   (rad * 3.2, -size_main * 2.6), (-rad * 3.2 - w, size_main * 0.6)):
        box = (x + dx, y + dy, x + dx + w, y + dy + h)
        if not any(box[0] < t[2] and box[2] > t[0] and box[1] < t[3] and box[3] > t[1] for t in taken):
            taken.append(box)
            return box[0], box[1]
    return x + rad * 3.2, y - size_main


def _frame(t: float, seconds: float, rings, others, bbox, stops, width: int, height: int,
           country_label: str = "") -> Image.Image:
    # camera: whole country, then ease into the route region, then a slow push while the route draws
    zoom_t = ease((t - 0.15 * seconds) / (0.35 * seconds))
    view = _lerp_box(bbox, _route_bbox(stops, bbox, width, height), zoom_t)
    pr = Projection(view, width, height, margin=0.10, zoom=1.0 + 0.05 * ease(t / seconds))
    img = Image.new("RGBA", (width, height), (*BG, 255))
    d = ImageDraw.Draw(img)
    for r in others:
        d.polygon([pr(p) for p in r], fill=LAND_OTHER, outline=(48, 54, 62))
    main = [[pr(p) for p in _chaikin(r)] for r in rings]
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    for pts in main:
        ImageDraw.Draw(glow).line(pts + pts[:1], fill=(*EDGE, 150), width=max(3, width // 240))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(width / 320)))
    d = ImageDraw.Draw(img)
    for r in rings:  # raw outline underneath: no gaps where smoothing pulls away from the neighbours
        d.polygon([pr(p) for p in r], fill=LAND_OTHER)
    for pts in main:
        d.polygon(pts, fill=LAND_MAIN)
        d.line(pts + pts[:1], fill=EDGE, width=max(1, width // 900))
    # country name on the wide shot, fading as the camera moves in
    name_a = 1.0 - zoom_t
    if name_a > 0.02 and country_label:
        nf = font("A", int(height * 0.06), "Compressed Black")
        cx, cy = pr(((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2 + 0.6))
        w = sum(d.textlength(ch, font=nf) + 0.35 * nf.size for ch in country_label) - 0.35 * nf.size
        x = cx - w / 2
        for ch in country_label:
            d.text((x, cy), ch, font=nf, fill=tuple(int(c * name_a + b * (1 - name_a)) for c, b in zip((200, 205, 210), LAND_MAIN)))
            x += d.textlength(ch, font=nf) + 0.35 * nf.size
    # route draws after the zoom settles; stops pop as the line reaches them
    route = [pr((lon, lat)) for _, _, lon, lat in stops]
    start, span = 0.42 * seconds, max(0.1, 0.33 * seconds)  # route done by 75%, then hold
    drawn = partial_route(route, ease((t - start) / span))
    if len(drawn) > 1:
        rg = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(rg).line(drawn, fill=(*ROUTE, 170), width=max(6, width // 160), joint="curve")
        img.alpha_composite(rg.filter(ImageFilter.GaussianBlur(width / 400)))
        d = ImageDraw.Draw(img)
        d.line(drawn, fill=ROUTE, width=max(3, width // 320), joint="curve")
    seg = [0.0] + [math.dist(a, b) for a, b in zip(route, route[1:])]
    total, reached, taken = sum(seg) or 1.0, 0.0, []
    size_main, size_ar = int(height * 0.046), int(height * 0.034)
    lf, af = font("A", size_main, "Bold"), font("ا", size_ar, "Semibold")
    for k, (name, name_ar, lon, lat) in enumerate(stops):
        reached += seg[k]
        appear = start + span * (reached / total) if k else 0.35 * seconds
        a = ease((t - appear) / 0.3)
        if a <= 0:
            continue
        x, y = pr((lon, lat))
        rad = max(4, width // 240) * (0.6 + 0.4 * a)
        d.ellipse((x - rad * 2.3, y - rad * 2.3, x + rad * 2.3, y + rad * 2.3), outline=ROUTE, width=max(2, width // 800))
        d.ellipse((x - rad, y - rad, x + rad, y + rad), fill=TEXT)
        lx, ly = _place_label(d, x, y, rad, size_main, size_ar, name, name_ar, lf, af, taken)
        col = tuple(int(c * a + b * (1 - a)) for c, b in zip(TEXT, BG))
        d.text((lx, ly), name, font=lf, fill=col)
        if name_ar:
            d.text((lx, ly + size_main * 1.05), name_ar, font=af, fill=tuple(int(c * a + b * (1 - a)) for c, b in zip(SUBTEXT, BG)),
                   direction="rtl")
    return img.convert("RGB")


def render_map_clip(out: Path, geojson: Path, country: str, stops: list[tuple[str, str, float, float]],
                    seconds: float = 6.0, width: int = 1920, height: int = 1080, fps: int = 25) -> Path:
    """Render an animated route map to an H.264 MP4 (no audio). stops = [(label, arabic_label, lon, lat), ...]."""
    exe = shutil.which("ffmpeg")
    if not exe:
        raise RuntimeError("ffmpeg not found on PATH")
    rings, others, bbox = _load(geojson, country)
    out.parent.mkdir(parents=True, exist_ok=True)
    proc = subprocess.Popen([exe, "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
                             "-s", f"{width}x{height}", "-r", str(fps), "-i", "-", "-c:v", "libx264", "-preset", "medium",
                             "-crf", "16", "-pix_fmt", "yuv420p", str(out)], stdin=subprocess.PIPE)
    for i in range(int(round(seconds * fps))):
        proc.stdin.write(_frame(i / fps, seconds, rings, others, bbox, stops, width, height, country.upper()).tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError(f"ffmpeg failed rendering {out}")
    return out
