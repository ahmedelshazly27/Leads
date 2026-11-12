"""Build public/og.jpg (1200x630 social preview) from the sample photos.
usage: python3 scripts/make-og.py   (run from app/)"""
from PIL import Image, ImageDraw, ImageFont
W, H = 1200, 630
im = Image.new("RGB", (W, H), (91, 43, 53)); d = ImageDraw.Draw(im)
F = "/usr/share/fonts/opentype/inter/"
big = ImageFont.truetype(F + "Inter-Light.otf", 46); mid = ImageFont.truetype(F + "Inter-Regular.otf", 20); small = ImageFont.truetype(F + "Inter-Medium.otf", 14)
PW, PH = 262, 350
def photo(path, x, label):
    p = Image.open(path).convert("RGB"); w, h = p.size
    c = p.crop((int(w * .12), int(h * .02), int(w * .88), int(h * .02) + int((w * .76) * 4 / 3))).resize((PW, PH), Image.LANCZOS)
    m = Image.new("L", c.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, PW - 1, PH - 1), 18, fill=255)
    im.paste(c, (x, 120), m)
    d.rounded_rectangle((x + 12, 132, x + 12 + d.textlength(label, font=small) + 20, 158), 12, fill=(255, 255, 255))
    d.text((x + 22, 137), label, font=small, fill=(66, 32, 42))
photo("public/sample/face.jpg", 600, "Before")
photo("public/sample/face_after.jpg", 878, "AI illustration · 12 months")
cx, cy, r = 82, 112, 17
d.pieslice((cx - r, cy - r, cx + r, cy + r), 90, 270, fill=(255, 255, 255)); d.pieslice((cx - r, cy - r, cx + r, cy + r), 270, 90, fill=(173, 140, 148))
d.text((64, 190), "See where you stand,", font=big, fill=(255, 255, 255))
d.text((64, 246), "measured, not guessed.", font=big, fill=(214, 190, 196))
for i, t in enumerate(["48 measurements of face and body,", "compared with published norms and", "reviewed by a person. Then a 12-month", "plan. No surgery."]):
    d.text((64, 340 + i * 30), t, font=mid, fill=(235, 220, 224))
d.text((64, 540), "UAE · SAUDI ARABIA", font=small, fill=(214, 190, 196))
d.text((600, 488), "Synthetic sample person. After image is an AI illustration, not a result.", font=small, fill=(214, 190, 196))
im.save("public/og.jpg", quality=88)
