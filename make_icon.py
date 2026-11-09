#!/usr/bin/env python3
"""Buat ikon aplikasi dari foto.  Pakai:  python3 make_icon.py foto.png
Tanpa argumen = ikon bawaan (tema gelap). Hasil masuk app/src/main/res/mipmap-*/"""
import sys, os
from PIL import Image, ImageDraw, ImageOps

SIZES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
BASE = 736  # resolusi sumber, supaya downscale sekali saja (lebih tajam)

def default_icon():
    im = Image.new("RGBA", (BASE, BASE), (15, 17, 21, 255))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((96, 150, 416, 400), 60, fill=(91, 140, 255, 255))   # kepala bot
    d.rectangle((246, 90, 266, 150), fill=(91, 140, 255, 255))               # antena
    d.ellipse((226, 66, 286, 126), fill=(62, 207, 142, 255))
    d.ellipse((168, 222, 238, 292), fill=(15, 17, 21, 255))                   # mata
    d.ellipse((274, 222, 344, 292), fill=(15, 17, 21, 255))
    d.rounded_rectangle((196, 328, 316, 354), 13, fill=(15, 17, 21, 255))     # mulut
    return im

def from_photo(path):
    im = Image.open(path).convert("RGBA")
    return ImageOps.fit(im, (BASE, BASE), Image.LANCZOS, centering=(0.5, 0.3))  # crop persegi

src = from_photo(sys.argv[1]) if len(sys.argv) > 1 else default_icon()
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app/src/main/res")
for name, px in SIZES.items():
    out = os.path.join(root, "mipmap-" + name)
    os.makedirs(out, exist_ok=True)
    sq = src.resize((px, px), Image.LANCZOS)
    r = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    m = Image.new("L", (px * 4, px * 4), 0)
    ImageDraw.Draw(m).ellipse((0, 0, px * 4 - 1, px * 4 - 1), fill=255)
    r.paste(sq, (0, 0), m.resize((px, px), Image.LANCZOS))
    # ikon kotak dengan sudut membulat + versi bulat
    box = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    bm = Image.new("L", (px * 4, px * 4), 0)
    ImageDraw.Draw(bm).rounded_rectangle((0, 0, px * 4 - 1, px * 4 - 1), px * 4 // 5, fill=255)
    box.paste(sq, (0, 0), bm.resize((px, px), Image.LANCZOS))
    box.save(os.path.join(out, "ic_launcher.png"))
    r.save(os.path.join(out, "ic_launcher_round.png"))
print("Ikon dibuat di", root)
