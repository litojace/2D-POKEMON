#!/usr/bin/env python3
"""The Shop spotlight's loops, from the fitting room recorded by
scripts/site-clips/shop.spec.ts (docs/website.md, "The Shop spotlight").

    python3 apps/site/tools/make-shop.py            # from the repo root

Each piece's frames are cut to a square round the fighter and its effect,
and saved as a looping animated WebP with the recorded timing
(apps/site/img/shop/<name>.webp), plus a still (<name>-still.webp, the
picker's thumbnail and the reduced-motion picture). Needs Pillow 11+.
"""
from pathlib import Path
import json
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
FRAMES = ROOT / "site-clips/shop"
OUT = ROOT / "apps/site/img/shop"
SIZE = 400
# name: (centre x, centre y, width) as shares of the stage, picked by eye.
# The victory rises above the fighter, so its square sits higher and wider.
CROPS = {
    "cinder-medic": (0.5, 0.45, 0.62),
    "storm-corsair": (0.5, 0.45, 0.62),
    "sun-sovereign": (0.5, 0.45, 0.62),
    "hellforge": (0.5, 0.45, 0.62),
    "abyssal-reaver": (0.5, 0.45, 0.62),
    "sky-curtain": (0.5, 0.38, 0.78),
}


def main():
    if not FRAMES.is_dir():
        sys.exit(f"{FRAMES} missing: run scripts/site-clips/shop.spec.ts first")
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for name, (cx, cy, share) in CROPS.items():
        src = FRAMES / name
        box = json.loads((src / "box.json").read_text())
        times = json.loads((src / "times.json").read_text())
        side = share * box["width"]
        x0 = box["x"] + cx * box["width"] - side / 2
        y0 = box["y"] + cy * box["height"] - side / 2
        crop = tuple(round(v) for v in (x0, y0, x0 + side, y0 + side))
        frames = [
            Image.open(src / f"{i:03d}.jpg").convert("RGB").crop(crop).resize((SIZE, SIZE), Image.LANCZOS)
            for i in range(len(times))
        ]
        durations = [max(20, b - a) for a, b in zip(times, times[1:])] + [60]
        out = OUT / f"{name}.webp"
        frames[0].save(
            out, "WEBP", save_all=True, append_images=frames[1:],
            duration=durations, loop=0, quality=52, method=6,
        )
        frames[len(frames) // 3].save(OUT / f"{name}-still.webp", "WEBP", quality=78, method=6)
        total += out.stat().st_size
        print(f"{name}: {len(frames)} frames, {out.stat().st_size // 1024} KB")
    print(f"loops: {total / 1024:.0f} KB")


if __name__ == "__main__":
    main()
