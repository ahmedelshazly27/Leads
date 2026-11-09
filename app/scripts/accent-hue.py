"""Re-hue the UI's slate-blue accent family, keeping each colour's lightness and saturation.

usage: python3 scripts/accent-hue.py <target-hue-degrees> [files...]
Only colours whose hue is in the slate/teal range (165-225°) with low-to-mid
saturation are changed; neutrals and strong status colours are left alone.
"""
import colorsys, glob, re, sys

TARGET = float(sys.argv[1]) / 360
files = sys.argv[2:] or [f for f in glob.glob("src/**/*", recursive=True) if f.endswith((".css", ".tsx", ".ts"))] + ["index.html", "public/favicon.svg"]

def shift(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    if not (165 / 360 <= h <= 225 / 360) or s < 0.04 or s > 0.45:
        return None
    r2, g2, b2 = colorsys.hls_to_rgb(TARGET, l, s)
    return round(r2 * 255), round(g2 * 255), round(b2 * 255)

def hexsub(m):
    v = m.group(1)
    out = shift(*(int(v[i:i + 2], 16) for i in (0, 2, 4)))
    if not out:
        return m.group(0)
    s = "#%02x%02x%02x" % out
    return s.upper() if v.isupper() else s

def rgbsub(m):
    out = shift(int(m.group(2)), int(m.group(3)), int(m.group(4)))
    if not out:
        return m.group(0)
    return f"{m.group(1)}({out[0]}, {out[1]}, {out[2]}"

n = 0
for f in files:
    s = open(f).read()
    t = re.sub(r"#([0-9a-fA-F]{6})\b", hexsub, s)
    t = re.sub(r"(rgba?)\((\d+),\s*(\d+),\s*(\d+)", rgbsub, t)
    if t != s:
        open(f, "w").write(t)
        n += 1
print(f"updated {n} files")
