#!/usr/bin/env python3
"""The "Ways to play" card pictures: real moments from the game, not paintings.

    npx playwright test --config scripts/site-clips/playwright.config.ts scripts/site-clips/scenes.spec.ts
    python3 apps/site/tools/make-scenes.py             # from the repo root

The combat scenes are frames from scripts/site-clips/scenes.spec.ts (the
real client and server simulation, every fighter's ultimate going off),
picked by eye and cropped to the fight. The Plaza is its pond with a fish on
the line (scripts/site-clips/plaza.spec.ts). Writes apps/site/img/modes/<name>-480/800.webp/avif. Needs Pillow 11+.
(The skins' loops, the Shop spotlight's too, are make-skin-clips.py's.)
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
# The Plaza's picture: the pond, a friend beside the angler and the fish on
# the line (scripts/site-clips/plaza.spec.ts), the scene without its buttons.
# One capture for the mode card (16:9, in close on the dock) and the Plaza
# band (3:2, the whole pond).
POND = ROOT / "site-clips/plaza/bite-clean.png"
POND_OUT = ROOT / "apps/site/img/plaza"


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


def pond():
    im = Image.open(POND).convert("RGB")
    # The card: the friends, the angler and the bobber.
    save(crop(im, 0.34, 0.42, 0.56), "plaza")
    # The band: the path to the dock and the whole pond, 3:2.
    h = 0.95 * im.height
    w = h * 3 / 2
    x0, y0 = 0, 0.03 * im.height
    wide = im.crop((round(x0), round(y0), round(x0 + w), round(y0 + h)))
    POND_OUT.mkdir(parents=True, exist_ok=True)
    for px in (640, 1280):
        small = wide.resize((px, round(px * 2 / 3)), Image.LANCZOS)
        small.save(POND_OUT / f"pond-{px}.webp", "WEBP", quality=80, method=6)
        small.save(POND_OUT / f"pond-{px}.avif", "AVIF", quality=58)


def main():
    if POND.exists():
        pond()
    else:
        print(f"kept the Plaza pictures: {POND} missing", file=sys.stderr)
    if not SCENES.is_dir():
        print(f"kept the fights' pictures: {SCENES} missing", file=sys.stderr)
        return
    for name, (scene, frame, cx, cy, share) in PICKS.items():
        src = SCENES / scene / f"{frame:03d}.png"
        save(crop(Image.open(src).convert("RGB"), cx, cy, share), name)


if __name__ == "__main__":
    main()
