"""Colour: per-clip correction (HDR -> SDR, white balance, exposure) plus a creative look exported as .cube LUTs.

Looks are parametric and derived from the measured reference grades (see STYLE_SYNTHESIS.md / creator profiles):
  joe-teal            Joe Hattab   - saturated, cyan/teal push in shadows & skies, warm protected skin, punchy contrast
  omar-warm-film      Omar Farooq  - restrained saturation, low contrast, lifted creamy blacks, warm, olive greens
  daniel-natural-warm Daniel Dalen - natural, mildly warm, gentle contrast
  yusufa-amber        Yusufa Sey   - warm amber, deeper shadows, moderate contrast
  neutral                          - clean Rec.709 with a touch of contrast
The same LUTs are used for the preview render and exported for DaVinci Resolve / Final Cut Pro, so the grade stays
editable: apply the .cube on a timeline node (Resolve) or with the Custom LUT effect (Final Cut), then adjust.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path

import cv2
import numpy as np


@dataclass(frozen=True)
class Look:
    name: str
    creator: str
    description: str
    contrast: float = 0.0        # S-curve strength (-0.3..0.4)
    saturation: float = 1.0
    warmth: float = 0.0          # + warmer (R up, B down)
    black_lift: float = 0.0      # raise blacks (filmic) / negative crushes
    highlight_rolloff: float = 0.0
    shadow_tint: tuple[float, float, float] = (0.0, 0.0, 0.0)
    highlight_tint: tuple[float, float, float] = (0.0, 0.0, 0.0)
    green_to_olive: float = 0.0  # shift greens toward yellow/olive
    skin_protect: float = 0.6


LOOKS: dict[str, Look] = {
    "joe-teal": Look("joe-teal", "Joe Hattab", "saturated travel-commercial look: teal shadows/skies, warm skin, punchy",
                     contrast=0.18, saturation=1.25, warmth=-0.01, shadow_tint=(-0.025, 0.01, 0.035),
                     highlight_tint=(0.02, 0.005, -0.02), skin_protect=0.7),
    "omar-warm-film": Look("omar-warm-film", "Omar Farooq", "restrained filmic warmth: low contrast, creamy lifted blacks, olive greens",
                           contrast=-0.06, saturation=0.9, warmth=0.025, black_lift=0.035, highlight_rolloff=0.12,
                           green_to_olive=0.35, highlight_tint=(0.015, 0.008, -0.01)),
    "daniel-natural-warm": Look("daniel-natural-warm", "Daniel Dalen", "natural daylight, mildly warm, gentle contrast",
                                contrast=0.05, saturation=1.0, warmth=0.03, black_lift=0.01),
    "yusufa-amber": Look("yusufa-amber", "Yusufa Sey", "warm amber with deeper shadows",
                         contrast=0.12, saturation=1.05, warmth=0.04, black_lift=-0.01, highlight_tint=(0.025, 0.01, -0.025)),
    "neutral": Look("neutral", "-", "clean Rec.709, slight contrast", contrast=0.04),
}


def _luma(rgb: np.ndarray) -> np.ndarray:
    return rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722


def apply_look(rgb: np.ndarray, look: Look) -> np.ndarray:
    """rgb: float array [...,3] in 0..1 (display-referred Rec.709)."""
    x = np.clip(rgb.astype(np.float64), 0, 1)
    orig = x.copy()
    # white balance shift
    x = np.clip(x + np.array([look.warmth, look.warmth * 0.2, -look.warmth]), 0, 1)
    # tone: black lift, S-curve contrast around 0.5, highlight roll-off
    x = look.black_lift + x * (1 - look.black_lift)
    if look.contrast:
        s = np.clip(x, 0, 1)
        curve = s + look.contrast * (s - 0.5) * (1 - np.abs(2 * s - 1)) * 2
        x = curve
    if look.highlight_rolloff:
        k = look.highlight_rolloff
        x = np.where(x > 0.75, 0.75 + (x - 0.75) * (1 - k), x)
    # split toning by luminance
    y = _luma(np.clip(x, 0, 1))[..., None]
    x = x + (1 - y) ** 2 * np.array(look.shadow_tint) + y ** 2 * np.array(look.highlight_tint)
    # saturation
    y = _luma(np.clip(x, 0, 1))[..., None]
    x = y + (x - y) * look.saturation
    # greens toward olive
    if look.green_to_olive:
        g_dom = np.clip((orig[..., 1] - np.maximum(orig[..., 0], orig[..., 2])) * 4, 0, 1)[..., None]
        x = x + g_dom * look.green_to_olive * np.array([0.06, -0.01, -0.04])
    # protect skin: blend toward a contrast-only version where hue/sat look like skin
    if look.skin_protect:
        hsv = cv2.cvtColor(orig.astype(np.float32).reshape(-1, 1, 3), cv2.COLOR_RGB2HSV).reshape(orig.shape)
        h, sat = hsv[..., 0], hsv[..., 1]
        skin = (((h >= 5) & (h <= 45)) & (sat > 0.15) & (sat < 0.65)).astype(np.float64)[..., None]
        base = orig + look.contrast * (orig - 0.5) * (1 - np.abs(2 * orig - 1)) * 2 + np.array([look.warmth * 0.5, 0, -look.warmth * 0.5])
        x = x * (1 - look.skin_protect * skin) + base * (look.skin_protect * skin)
    return np.clip(x, 0, 1)


def write_cube(path: Path, look: Look, intensity: float = 1.0, size: int = 33) -> Path:
    """3D LUT in .cube format (red index fastest), blended with identity by `intensity`."""
    g = np.linspace(0, 1, size)
    b, gg, r = np.meshgrid(g, g, g, indexing="ij")  # r varies fastest when flattened
    ident = np.stack([r, gg, b], axis=-1).reshape(-1, 3)
    out = ident + (apply_look(ident, look) - ident) * intensity
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="ascii") as f:
        f.write(f'TITLE "{look.name} {int(intensity * 100)}%"\n')
        f.write(f"# Travel Film Director look inspired by {look.creator}: {look.description}\n")
        f.write(f"LUT_3D_SIZE {size}\nDOMAIN_MIN 0.0 0.0 0.0\nDOMAIN_MAX 1.0 1.0 1.0\n")
        for v in out:
            f.write(f"{v[0]:.6f} {v[1]:.6f} {v[2]:.6f}\n")
    return path


def read_cube(path: Path) -> np.ndarray:
    rows = [l.split() for l in Path(path).read_text().splitlines() if l and l[0].isdigit() or l[:1] == "-"]
    data = np.array([[float(v) for v in r] for r in rows if len(r) == 3])
    n = round(len(data) ** (1 / 3))
    return data.reshape(n, n, n, 3)  # [b][g][r]


LOG_SATURATION = 1.6
LOG_CONTRAST = 0.35  # filmic S-curve strength after the levels stretch
LOG_MIN_RANGE = 0.35  # minimum black-to-white span: dark clips are not stretched into noise


def log_profile_from_tags(tags: dict) -> str | None:
    """Camera log gamma from container tags (DJI writes com.dji.camera.ColorGammaSxS, e.g. 'D-Log2', 'D-Log M').
    The files themselves are tagged BT.709, so the colour tags alone don't reveal log footage."""
    for k, v in (tags or {}).items():
        if "gamma" in k.lower() and "log" in str(v).lower():
            return str(v)
    return None


def log_to_709_params(luma: np.ndarray) -> dict:
    """Adaptive log -> display conversion for one clip: levels from the clip's own black/white points, then a
    filmic S-curve and a saturation boost. Pooled over the clip so every shot in it gets the same transform."""
    black = float(min(np.percentile(luma, 0.5), 0.2))
    white = float(max(np.percentile(luma, 99.5), black + LOG_MIN_RANGE))
    return {"black": round(black, 3), "white": round(min(white, 1.0), 3), "contrast": LOG_CONTRAST,
            "saturation": LOG_SATURATION}


def clip_correction(frame_paths: list[str], meta: dict) -> dict:
    """Gentle, bounded normalisation so clips from different cameras match before the look is applied."""
    pix = []
    for p in frame_paths:
        img = cv2.imread(p)
        if img is None:
            continue
        rgb = cv2.cvtColor(cv2.resize(img, (160, 90)), cv2.COLOR_BGR2RGB).reshape(-1, 3).astype(np.float64) / 255
        pix.append(rgb)
    corr = {"hdr_tonemap": bool(meta.get("hdr")), "gains": [1.0, 1.0, 1.0], "exposure_stops": 0.0, "notes": []}
    if not pix:
        return corr
    if corr["hdr_tonemap"]:
        corr["notes"].append("HDR (HLG/PQ) tone-mapped to SDR Rec.709")
    rgb = np.concatenate(pix)
    y = _luma(rgb)
    sat = rgb.max(1) - rgb.min(1)
    neutral = rgb[(y > 0.15) & (y < 0.85) & (sat < 0.25)]
    if len(neutral) > 200:
        m = neutral.mean(0)
        target = m.mean()
        gains = np.clip(1 + 0.5 * (target / np.maximum(m, 1e-3) - 1), 0.88, 1.12)  # half-strength, max +-12%
        corr["gains"] = [round(float(v), 3) for v in gains]
        if np.abs(gains - 1).max() > 0.03:
            corr["notes"].append("white balance neutralised (half strength, keeps golden-hour intent)")
    if meta.get("log_profile"):
        corr["log_to_709"] = log_to_709_params(y)
        corr["notes"].append(f"{meta['log_profile']} log footage converted to Rec.709 (adaptive levels, S-curve, saturation)")
        return corr
    med = float(np.median(y))
    if 0.06 < med < 0.3 or med > 0.62:
        stops = float(np.clip(np.log2(0.42 / max(med, 1e-3)) * 0.5, -0.6, 0.6))
        corr["exposure_stops"] = round(stops, 2)
        corr["notes"].append(f"exposure {stops:+.2f} stops toward mid-grey")
    return corr


def _probe_log(path: str) -> str | None:
    """For projects ingested before log detection existed: read the container tags directly."""
    import json
    import shutil
    import subprocess
    exe = shutil.which("ffprobe")
    if not exe or not Path(path).is_file():
        return None
    r = subprocess.run([exe, "-v", "error", "-print_format", "json", "-show_entries", "format_tags:stream_tags", path],
                       capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        return None
    d = json.loads(r.stdout or "{}")
    tags = dict(d.get("format", {}).get("tags", {}))
    for st in d.get("streams", []):
        tags.update(st.get("tags", {}))
    return log_profile_from_tags(tags)


def _q(path: Path | str) -> str:
    """Quote a path for an FFmpeg filtergraph (spaces, colons, quotes)."""
    return "'" + str(path).replace("\\", "/").replace("'", r"'\''") + "'"


def ffmpeg_filters(corr: dict, lut: Path | None) -> str:
    parts = []
    if corr.get("hdr_tonemap"):
        parts.append("zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,"
                     "zscale=t=bt709:m=bt709:r=tv,format=yuv420p")
    lg = corr.get("log_to_709")
    if lg:
        lo, hi, c = lg["black"], lg["white"], lg["contrast"]
        q1, q3 = 0.25 + c * (0.15625 - 0.25), 0.75 + c * (0.84375 - 0.75)  # x + c*(smoothstep(x) - x)
        # gbrp16le: FFmpeg 8 colorlevels returns black frames when it negotiates 10-bit planar RGB (gbrp10le)
        parts.append(f"format=gbrp16le,colorlevels=rimin={lo}:gimin={lo}:bimin={lo}:rimax={hi}:gimax={hi}:bimax={hi},"
                     f"curves=all='0/0 0.25/{q1:.4f} 0.5/0.5 0.75/{q3:.4f} 1/1',eq=saturation={lg['saturation']}")
    g = corr.get("gains", [1, 1, 1])
    k = 2 ** corr.get("exposure_stops", 0.0)
    if any(abs(v - 1) > 1e-3 for v in g) or abs(k - 1) > 1e-3:
        parts.append(f"colorchannelmixer=rr={g[0] * k:.4f}:gg={g[1] * k:.4f}:bb={g[2] * k:.4f}")
    if lut:
        parts.append(f"lut3d=file={_q(lut)}")
    return ",".join(parts)


def choose_look(direction: str, hook_creator: str | None, notes: str = "") -> tuple[str, str]:
    import re
    m = re.search(r"^\s*-\s*grade\s*:\s*([\w-]+)", notes, re.I | re.M)
    if m and m.group(1).lower() in LOOKS:
        return m.group(1).lower(), "chosen in trip_notes.md"
    by_dir = {"cinematic": "joe-teal", "documentary": "omar-warm-film", "personal": "daniel-natural-warm"}
    if direction in by_dir:
        return by_dir[direction], f"direction '{direction}'"
    by_creator = {"Joe Hattab": "joe-teal", "Omar Farooq": "omar-warm-film", "Daniel Dalen": "daniel-natural-warm",
                  "Yusufa Sey": "yusufa-amber"}
    if hook_creator in by_creator:
        return by_creator[hook_creator], f"matches the hook formula ({hook_creator})"
    return "neutral", "default"


INTENSITY_BY_MODE = {"cinematic": 1.0, "documentary": 0.8, "personal": 0.6}


def build_grade(project: Path, plan: dict, clips: list[dict], notes: str = "") -> dict:
    look_name, why = choose_look(plan.get("direction", "balanced"), (plan.get("hook_formula") or {}).get("from"), notes)
    look = LOOKS[look_name]
    lut_dir = project / "grade"
    luts = {f"{k:.1f}": str(write_cube(lut_dir / f"{look_name}_{int(k * 100)}.cube", look, k)) for k in sorted(set(INTENSITY_BY_MODE.values()))}
    by_id = {c["id"]: c for c in clips}
    corrections = {}
    for cid in plan["clips"]:
        c = by_id.get(cid)
        if c:
            meta = c["meta"] if "log_profile" in c["meta"] else {**c["meta"], "log_profile": _probe_log(c["path"])}
            corrections[cid] = clip_correction([f["path"] for f in c.get("frames", [])], meta)
    for item in plan["timeline"]:
        item["grade_intensity"] = INTENSITY_BY_MODE.get(item.get("mode"), 0.8)
    return {"look": look_name, "look_details": asdict(look), "reason": why, "luts": luts, "corrections": corrections,
            "how_to_use": {"resolve": "Color page > right-click a timeline node > LUT > browse to the .cube (use the 100% file); "
                                      "per-clip corrections are listed here and in clip metadata",
                           "final_cut": "Effects > Color > Custom LUT on an adjustment layer, choose the .cube",
                           "override": "add '- grade: <look>' to trip_notes.md (looks: " + ", ".join(LOOKS) + ")"}}
