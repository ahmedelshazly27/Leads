"""Recolour the flat studio backdrop of generated photos to a new colour.

usage: python3 app/scripts/recolor-backdrop.py <hex> <image> [image...]
       --any-border: also recolour photos whose border is only partly backdrop
       --tight: strict colour match, for eye and brow close-ups
Finds the backdrop by flood-filling from the image border through pixels
close to the border's slate-blue tone. Colour is changed by scaling each
channel (pixel × target ÷ backdrop), so dark hair edges stay dark instead of
turning red, and only pixels connected to or right next to the backdrop are
touched, so reflections in eyes and skin are left alone.
"""
import sys
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

def dilate(mask, px):
    return np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(px * 2 + 1))) > 0

def recolor(path, target, any_border=False, tight=False):
    im = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    H, W, _ = im.shape
    border = np.concatenate([im[0], im[-1], im[:, 0], im[:, -1]])
    bluish = (border[:, 2] - border[:, 0] > 8) & (border.max(1) - border.min(1) < 70)
    if bluish.mean() < (0.02 if any_border else 0.08):
        return "skip (no slate border)"
    bg = np.median(border[bluish], 0)
    d = np.linalg.norm(im - bg, axis=2)
    lum = im.mean(2)
    blu = im[..., 2] - im[..., 0]
    # close-ups (--tight): the white of the eye is close to the backdrop tone, so stay strict
    cand = (d < (32 if tight else 75)) & (blu > 3) & (lum > 45) & (im.max(2) - im.min(2) < 80)
    mask = np.zeros((H, W), bool)
    q = deque()
    for y in range(H):
        for x in (0, W - 1):
            if cand[y, x] and not mask[y, x]:
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
    # enclosed backdrop (gap between arm and torso): large patches of backdrop colour
    # not touching the border. Small specks (eye reflections) are left alone.
    rest = cand & ~mask & (d < 40)
    seen = np.zeros((H, W), bool)
    for y0, x0 in zip(*np.nonzero(rest)):
        if seen[y0, x0]:
            continue
        comp = [(y0, x0)]; seen[y0, x0] = True; i = 0
        while i < len(comp):
            y, x = comp[i]; i += 1
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < H and 0 <= nx < W and rest[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; comp.append((ny, nx))
        if not tight and len(comp) > H * W * 0.004:
            ys, xs = map(list, zip(*comp))
            # real backdrop: same tone and no brighter (the white of an eye is brighter)
            if d[ys, xs].mean() < 22 and lum[ys, xs].mean() < bg.mean() + 8:
                mask[ys, xs] = True
    # near the backdrop (curl gaps, anti-aliased edges): any bluish, unsaturated pixel,
    # weighted by how blue it is so neutral hair and warm skin are left alone
    near = dilate(mask, max(6, W // 40))
    sat = im.max(2) - im.min(2)
    soft = near & ~mask & (sat < 90)
    w = np.clip((blu + 2) / 14, 0, 1) * soft
    m = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255
    m = np.maximum(m, w)
    ratio = np.array(target, np.float32) / np.maximum(bg, 1)
    out = im * (1 + m[..., None] * (ratio - 1))
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(path, quality=88, optimize=True)
    return f"ok ({mask.mean():.0%} backdrop)"

args = [a for a in sys.argv[1:] if not a.startswith("--")]
anyb = "--any-border" in sys.argv
tight = "--tight" in sys.argv
hexv = args[0].lstrip("#")
target = [int(hexv[i:i + 2], 16) for i in (0, 2, 4)]
for p in args[1:]:
    print(p.split("public/")[-1], recolor(p, target, anyb, tight))
