#!/usr/bin/env python3
"""The "Ways to play" card pictures: real moments from the game, not paintings.

    npx playwright test --config scripts/site-clips/playwright.config.ts scripts/site-clips/scenes.spec.ts
    python3 apps/site/tools/make-scenes.py             # from the repo root

The combat scenes are frames from scripts/site-clips/scenes.spec.ts (the
real client and server simulation, every fighter's ultimate going off),
picked by eye and cropped to the fight. The Plaza is the App Store capture
(scripts/app-store). Writes apps/site/img/modes/<name>-480/800.webp/avif. Needs Pillow 11+.
(The Shop spotlight's loops are make-shop.py's.)
"""
from pathlib import Path
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SCENES = ROOT / "site-clips/scenes"
OUT = ROOT / "apps/site/img/modes"
# name: (source, frame, centre x, centre y, crop width), as shares of the capture.
PICKS = {
    "duels": ("duels", 14, 0.53, 0.47, 0.42),
    "teams": ("teams", 14, 0.50, 0.36, 0.56),
    "ffa": ("ffa", 16, 0.57, 0.40, 0.46),
    "raids": ("raids", 14, 0.50, 0.50, 0.58),
    "spire": ("spire", 16, 0.47, 0.61, 0.48),
}
PLAZA = ROOT / "app-store-screenshots/raw/iphone-medium/6-plaza.png"


def crop(im: Image.Image, cx: float, cy: float, share: float) -> Image.Image:
    """A 16:9 box `share` of the picture wide, centred on (cx, cy), kept inside it."""
    w = share * im.width
    h = w * 9 / 16
    x0 = min(max(0, cx * im.width - w / 2), im.width - w)
    y0 = min(max(0, cy * im.height - h / 2), im.height - h)
    return im.crop((round(x0), round(y0), round(x0 + w), round(y0 + h)))


def save(im: Image.Image, name: str):
    OUT.mkdir(parents=True, exist_ok=True)
    for w in (480, 800):
        small = im.resize((w, round(w * im.height / im.width)), Image.LANCZOS)
        small.save(OUT / f"{name}-{w}.webp", "WEBP", quality=78, method=6)
        small.save(OUT / f"{name}-{w}.avif", "AVIF", quality=56)


def main():
    if not SCENES.is_dir():
        sys.exit(f"{SCENES} missing: run scripts/site-clips/scenes.spec.ts first")
    for name, (scene, frame, cx, cy, share) in PICKS.items():
        src = SCENES / scene / f"{frame:03d}.png"
        save(crop(Image.open(src).convert("RGB"), cx, cy, share), name)
    if PLAZA.exists():
        # The square and its players, clear of the banner and the buttons.
        save(crop(Image.open(PLAZA).convert("RGB"), 0.5, 0.62, 0.5), "plaza")
    else:
        print(f"kept the Plaza picture: {PLAZA} missing", file=sys.stderr)

if __name__ == "__main__":
    main()
