from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from ..util import fmt_ts


def _font(size: int):
    for name in ("DejaVuSans.ttf", "arial.ttf", "Arial.ttf", "segoeui.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def build_contact_sheets(frames: list[tuple[float, Path]], out_dir: Path, title: str = "", cols: int = 6,
                         per_sheet: int = 48, tile_w: int = 320) -> list[Path]:
    """Timestamped grid images. Returns the written paths."""
    out_dir.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    font, hfont = _font(14), _font(18)
    for sheet_i in range(0, len(frames), per_sheet):
        chunk = frames[sheet_i:sheet_i + per_sheet]
        first = Image.open(chunk[0][1])
        tile_h = int(first.height * tile_w / first.width)
        rows = (len(chunk) + cols - 1) // cols
        header = 34
        sheet = Image.new("RGB", (cols * tile_w + (cols + 1) * 4, header + rows * (tile_h + 4) + 4), (16, 16, 18))
        draw = ImageDraw.Draw(sheet)
        draw.text((8, 8), f"{title}  [{sheet_i // per_sheet + 1}]", fill=(235, 235, 235), font=hfont)
        for i, (t, p) in enumerate(chunk):
            im = Image.open(p).convert("RGB").resize((tile_w, tile_h))
            x = 4 + (i % cols) * (tile_w + 4)
            y = header + (i // cols) * (tile_h + 4)
            sheet.paste(im, (x, y))
            label = fmt_ts(t)
            draw.rectangle((x, y + tile_h - 20, x + 8 + 9 * len(label), y + tile_h), fill=(0, 0, 0))
            draw.text((x + 4, y + tile_h - 19), label, fill=(255, 255, 255), font=font)
        p_out = out_dir / f"contact_{sheet_i // per_sheet + 1:02d}.jpg"
        sheet.save(p_out, quality=85)
        paths.append(p_out)
    return paths
