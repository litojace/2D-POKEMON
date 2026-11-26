#!/usr/bin/env python3
"""Skill clips for the champion panel, from the frames scripts/site-clips captures.

    npx playwright test --config scripts/site-clips/playwright.config.ts
    python3 apps/site/tools/make-clips.py          # from the repo root

Each clip is the court around the two fighters (the HUD hidden), cropped and
scaled down, saved as a looping animated WebP in apps/site/clips/<id>/<move>.webp,
plus a still poster (its middle frame) for reduced motion. Needs Pillow 11+.
"""
from pathlib import Path
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
FRAMES = ROOT / "site-clips"
OUT = ROOT / "apps/site/clips"
# The crop in CSS pixels of the 874 x 402 phone view (the follow camera keeps
# the caster in the same place), scaled by the capture's pixel ratio.
CROP_CSS = (311, 150, 695, 366)  # 384 x 216, 16:9
SIZE = (480, 270)
MS_PER_FRAME = 66  # two ticks at 30 Hz


def main():
    if not FRAMES.is_dir():
        sys.exit(f"{FRAMES} missing: run scripts/site-clips first")
    total = 0
    for champ in sorted(p for p in FRAMES.iterdir() if p.is_dir() and not p.name.startswith(".")):
        for move in sorted(p for p in champ.iterdir() if p.is_dir()):
            files = sorted(move.glob("*.png"))
            if not files:
                continue
            first = Image.open(files[0])
            ratio = first.width / 874
            box = tuple(round(v * ratio) for v in CROP_CSS)
            frames = [
                Image.open(f).convert("RGB").crop(box).resize(SIZE, Image.LANCZOS)
                for f in files
            ]
            dest = OUT / champ.name
            dest.mkdir(parents=True, exist_ok=True)
            out = dest / f"{move.name}.webp"
            frames[0].save(
                out,
                "WEBP",
                save_all=True,
                append_images=frames[1:],
                duration=MS_PER_FRAME,
                loop=0,
                quality=60,
                method=6,
            )
            frames[len(frames) // 2].save(dest / f"{move.name}-still.webp", "WEBP", quality=70, method=6)
            total += out.stat().st_size
    print(f"clips: {total / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
