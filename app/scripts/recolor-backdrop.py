"""Recolour the flat studio backdrop of generated photos to a new colour.

usage: python3 scripts/recolor-backdrop.py <hex> <image> [image...]
Finds the backdrop by flood-filling from the image border through pixels
close to the border's slate-blue tone, then shifts only those pixels to the
target colour, keeping the original light falloff. Images without a slate
border (e.g. full-frame skin crops) are skipped.
"""
import sys
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

def recolor(path, target):
    im = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    H, W, _ = im.shape
    border = np.concatenate([im[0], im[-1], im[:, 0], im[:, -1]])
    bluish = (border[:, 2] - border[:, 0] > 8) & (border.max(1) - border.min(1) < 70)
    if bluish.mean() < 0.08:
        return "skip (no slate border)"
    bg = np.median(border[bluish], 0)
    d = np.linalg.norm(im - bg, axis=2)
    lum = im.mean(2)
    blu = im[..., 2] - im[..., 0]
    # slate pixels: bluish, not too dark, low saturation; generous distance for floor gradients
    cand = (d < 75) & (blu > 3) & (lum > 45) & (im.max(2) - im.min(2) < 80)
    mask = np.zeros((H, W), bool)
    q = deque()
    for y in range(H):
        for x in (0, W - 1):
            if cand[y, x]:
                mask[y, x] = True; q.append((y, x))
    for x in range(W):
        for y in (0, H - 1):
            if cand[y, x] and not mask[y, x]:
                mask[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W and cand[ny, nx] and not mask[ny, nx]:
                mask[ny, nx] = True; q.append((ny, nx))
    # enclosed pockets (gaps between curls): nearly the exact backdrop colour anywhere
    mask = mask | ((d < 30) & (blu > 8))
    # grow 2 px into neighbouring bluish pixels to catch anti-aliased fringes (hair edges)
    grown = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    mask = mask | (grown & (blu > 0) & (lum > 35))
    m = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255
    out = im + m[..., None] * (np.array(target, np.float32) - bg)
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(path, quality=86, optimize=True)
    return f"ok ({mask.mean():.0%} backdrop)"

hexv = sys.argv[1].lstrip("#")
target = [int(hexv[i:i + 2], 16) for i in (0, 2, 4)]
for p in sys.argv[2:]:
    print(p.split("public/")[-1], recolor(p, target))
