"""The README's pictures: readme-shots/*.png to docs/readme/*.webp, at most
150 KB each (scripts/readme/readme-shots.spec.ts makes the PNGs).

    python3 scripts/readme/to-webp.py            # every PNG in readme-shots/
    python3 scripts/readme/to-webp.py lobby duel  # only these
"""
import os
import sys

from PIL import Image

names = sys.argv[1:] or [f[:-4] for f in os.listdir("readme-shots") if f.endswith(".png")]
for name in names:
    im = Image.open(f"readme-shots/{name}.png").convert("RGB")
    for width, quality in [(1280, 80), (1200, 74), (1100, 70), (1000, 68)]:
        out = f"docs/readme/{name}.webp"
        size = (width, round(im.height * width / im.width))
        im.resize(size, Image.LANCZOS).save(out, "WEBP", quality=quality, method=6)
        if os.path.getsize(out) <= 150_000:
            break
    print(f"{out}: {width} px wide, {os.path.getsize(out) // 1000} KB")
