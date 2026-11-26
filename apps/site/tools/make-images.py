#!/usr/bin/env python3
"""Make the landing page's images from the game's own art (docs/website.md).

    python3 apps/site/tools/make-images.py            # from the repo root

Reads the game's art (loading art, raid splash, fighter portraits, app icon)
and the real gameplay captures that `scripts/app-store` writes to
`app-store-screenshots/raw/iphone-medium/`, and writes small WebP/AVIF copies
under apps/site/img/. Needs Pillow 11+ (WebP and AVIF). Run it again when the
game's art changes; the outputs are committed, so the site has no build step.
"""
from pathlib import Path
import shutil
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "apps/client/src/art"
PUBLIC = ROOT / "apps/client/public"
OUT = ROOT / "apps/site/img"
SHOTS = ROOT / "app-store-screenshots/raw/iphone-medium"

# The hero art at the top of the page.
HEROES = {"hero-dusk": ART / "loading-art/startup-art-duel-skyline-lance.webp"}
BOSSES = ["grumblecrag", "tidewyrm", "gloomshade", "somnara", "prismatail", "emberwing", "storm-twins"]
# Each way to play, from the game's own art (16:9 card pictures).
MODES = {
    "duels": (ART / "loading-art/startup-art-duel-corsairs.webp", 0.5),
    "teams": (ART / "loading-art/startup-art-ffa-shifting-ruins.webp", 0.55),
    "ffa": (ART / "loading-art/startup-art-ffa-ember-forge.webp", 0.5),
    "raids": (ART / "raid-splash/storm-twins-lower.webp", 0.45),
    "spire": (ART / "spire/tower-portrait.webp", 0.3),
    "plaza": (ART / "loading-art/startup-art-rest-market.webp", 0.5),
    "friends": (ART / "loading-art/startup-art-rest-ring-toss.webp", 0.5),
}
# Real gameplay captures (docs/app-store-screenshots.md), in page order.
SCREENS = ["1-raid", "2-duel", "3-roster", "4-teams", "5-ffa", "6-plaza"]


def save(im: Image.Image, path: Path, webp_q=78, avif_q=55):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path.with_suffix(".webp"), "WEBP", quality=webp_q, method=6)
    im.save(path.with_suffix(".avif"), "AVIF", quality=avif_q)


def fit_width(im: Image.Image, w: int) -> Image.Image:
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)


def crop_16x9(im: Image.Image, y: float) -> Image.Image:
    """The widest 16:9 band of a picture, centred at y (0 top, 1 bottom)."""
    w = im.width
    h = round(w * 9 / 16)
    if h > im.height:
        h = im.height
        w = round(h * 16 / 9)
    x0 = (im.width - w) // 2
    y0 = round(min(max(0, im.height * y - h / 2), im.height - h))
    return im.crop((x0, y0, x0 + w, y0 + h))


def main():
    for name, src in HEROES.items():
        im = Image.open(src).convert("RGB")
        for w in (960, 1536):
            save(fit_width(im, w) if w != im.width else im, OUT / f"{name}-{w}")

    for boss in BOSSES:
        im = Image.open(ART / f"raid-splash/{boss}-portrait.webp").convert("RGB")
        im = im.resize((400, 600), Image.LANCZOS)
        (OUT / "bosses").mkdir(parents=True, exist_ok=True)
        im.save(OUT / f"bosses/{boss}.webp", "WEBP", quality=74, method=6)
        # The raid week's wide splash: only the boss on show is downloaded.
        wide = Image.open(ART / f"raid-splash/{boss}-lower.webp").convert("RGB")
        for w in (768, 1280):
            save(fit_width(wide, w), OUT / f"raids/{boss}-{w}", webp_q=72, avif_q=50)

    for name, (src, y) in MODES.items():
        band = crop_16x9(Image.open(src).convert("RGB"), y)
        for w in (480, 800):
            save(fit_width(band, w), OUT / f"modes/{name}-{w}", webp_q=74, avif_q=52)

    creatures = OUT / "creatures"
    creatures.mkdir(parents=True, exist_ok=True)
    for d in sorted((PUBLIC / "assets/fighters").iterdir()):
        shutil.copyfile(d / "portrait.svg", creatures / f"{d.name}.svg")

    if SHOTS.is_dir():
        (OUT / "shots").mkdir(parents=True, exist_ok=True)
        for name in SCREENS:
            im = Image.open(SHOTS / f"{name}.png").convert("RGB")
            for w in (720, 1280):
                fit_width(im, w).save(OUT / f"shots/{name}-{w}.webp", "WEBP", quality=74, method=6)
    else:
        print(f"skipped screenshots: {SHOTS} missing (run scripts/app-store first)", file=sys.stderr)

    icon = Image.open(PUBLIC / "icons/arena-512.png").convert("RGBA")
    icon.resize((32, 32), Image.LANCZOS).save(OUT.parent / "favicon-32.png")
    icon.resize((192, 192), Image.LANCZOS).save(OUT.parent / "icon-192.png")
    icon.save(OUT.parent / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    shutil.copyfile(PUBLIC / "icons/apple-touch-icon.png", OUT.parent / "apple-touch-icon.png")


if __name__ == "__main__":
    main()
