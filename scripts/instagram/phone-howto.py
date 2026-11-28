#!/usr/bin/env python3
"""The home-screen how-to's pictures, from the owner's real iPhone screenshots.

    python3 scripts/instagram/phone-howto.py      # from the repo root
    npx tsx scripts/instagram/make-posts.mjs     # builds the carousel and stories

The owner asked for real phone screenshots, never drawings (27 Nov). They
are theirs, taken on their own iPhone, and show their contacts and apps, so
they never go in the repo: they live in instagram-clips/phone/ (ignored),
named as the phone named them (IMG_4228.png ...). This script makes what the
posts use from them:

- every region that shows other people (the share sheet's row of
  contacts) is pixelated and blurred for good before anything is cropped;
- only Safari's steps and the icon come from the phone: the game itself is
  shown from our own captures of big moves (make-posts.mjs), never the
  owner's battle or Lobby screenshots (the owner, 28 Nov; they also show
  their player name and coins);
- each step is cropped to the part that matters;
- instagram-clips/phone/steps.json: each crop's file, its size, and the
  rings to draw (as shares of the crop), for make-posts.mjs.

Coordinates are shares of the screenshot (x of its width, y of its height),
so a screenshot from another iPhone size lands in the same place. A new
iOS that moves a button needs new numbers: check them with --preview, which
writes steps-preview.jpg with the rings drawn on.
"""
from pathlib import Path
import json
import sys

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
PHONE = ROOT / "instagram-clips/phone"

# Regions that show other people, per screenshot: (x0, y0, x1, y1) shares.
PRIVATE = {
    "IMG_4230": [(0.0, 0.545, 1.0, 0.70)],
    "IMG_4231": [(0.0, 0.225, 1.0, 0.365)],
}
# The steps: file, crop (x0, y0, x1, y1) and rings (x0, y0, x1, y1), all as
# shares of the whole screenshot; the rings are turned into shares of the
# crop below.
STEPS = [
    ("IMG_4228", (0.0, 0.78, 1.0, 1.0), [(0.215, 0.918, 0.300, 0.962)]),
    ("IMG_4229", (0.0, 0.41, 1.0, 0.975), [(0.250, 0.540, 0.462, 0.585)]),
    ("IMG_4230", (0.0, 0.38, 1.0, 0.995), [(0.745, 0.858, 0.905, 0.982)]),
    ("IMG_4231", (0.0, 0.525, 1.0, 0.985), [(0.080, 0.905, 0.570, 0.955)]),
    (
        "IMG_4232",
        (0.0, 0.062, 1.0, 0.415),
        [(0.805, 0.308, 0.960, 0.350), (0.805, 0.083, 0.960, 0.134)],
    ),
]
# The home screen: the game's icon and its name only.
ICON = ("IMG_4233", (0.060, 0.655, 0.265, 0.765))


def scrub(im: Image.Image, regions) -> Image.Image:
    """Pixelate, then blur, each region: nothing in it can be read back."""
    im = im.copy()
    w, h = im.size
    for x0, y0, x1, y1 in regions:
        box = tuple(round(v) for v in (x0 * w, y0 * h, x1 * w, y1 * h))
        part = im.crop(box)
        small = part.resize((max(1, part.width // 40), max(1, part.height // 40)), Image.BILINEAR)
        part = small.resize(part.size, Image.NEAREST).filter(ImageFilter.GaussianBlur(30))
        im.paste(part, box)
    return im


def main():
    if not PHONE.is_dir():
        sys.exit(f"{PHONE} missing: put the owner's screenshots there")
    out = {"steps": []}
    shots = {}
    for name, crop, rings in STEPS:
        im = Image.open(PHONE / f"{name}.png").convert("RGB")
        im = scrub(im, PRIVATE.get(name, []))
        w, h = im.size
        x0, y0, x1, y1 = crop
        box = tuple(round(v) for v in (x0 * w, y0 * h, x1 * w, y1 * h))
        part = im.crop(box)
        file = f"step-{len(out['steps']) + 1}.jpg"
        part.save(PHONE / file, quality=92)
        shots[file] = part
        out["steps"].append({
            "file": file,
            "size": part.size,
            "rings": [
                [(a - x0) / (x1 - x0), (b - y0) / (y1 - y0), (c - x0) / (x1 - x0), (d - y0) / (y1 - y0)]
                for a, b, c, d in rings
            ],
        })
    name, (x0, y0, x1, y1) = ICON
    im = Image.open(PHONE / f"{name}.png").convert("RGB")
    w, h = im.size
    icon = im.crop(tuple(round(v) for v in (x0 * w, y0 * h, x1 * w, y1 * h)))
    icon.save(PHONE / "icon.jpg", quality=92)
    out["icon"] = {"file": "icon.jpg", "size": icon.size}
    (PHONE / "steps.json").write_text(json.dumps(out, indent=1))
    if "--preview" in sys.argv:
        tiles = []
        for s in out["steps"]:
            im = shots[s["file"]].copy()
            d = ImageDraw.Draw(im)
            for a, b, c, e in s["rings"]:
                d.rectangle((a * im.width, b * im.height, c * im.width, e * im.height), outline="red", width=8)
            im.thumbnail((400, 700))
            tiles.append(im)
        sheet = Image.new("RGB", (400 * len(tiles), 700), "gray")
        for k, t in enumerate(tiles):
            sheet.paste(t, (k * 400, 0))
        sheet.save(PHONE / "steps-preview.jpg", quality=85)
    print(f"{len(out['steps'])} steps, icon -> {PHONE}")


if __name__ == "__main__":
    main()
