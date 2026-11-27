#!/usr/bin/env python3
"""The skins Reel and post 8's stills, from the fitting room recordings.

    npx playwright test --config scripts/instagram/playwright.config.ts
    python3 scripts/instagram/make-reel.py          # from the repo root
    npx tsx scripts/instagram/make-posts.mjs        # post 8 uses the stills

scripts/instagram/skins.spec.ts records each Mythical at Stage III in the
game's fitting room, in Poster, 30 frames a second: standing, then its
Entrance, Victory and Ultimate. This cuts each play to its effect, frames it
in Poster's look (docs/ui-themes.md: the fighter's colour with its
halftone, ink plates, a white clipping
with a hard shadow, Anton and Archivo), adds an end card, and writes:

- instagram/08-skins-reel.mp4: 1080 x 1920, 30 fps, H.264 (Instagram's
  Reel format), no sound: add a track from Instagram's library when posting.
- instagram/08-skins-reel-cover.jpg: the Reel's cover (the Ultimate's peak).
- instagram-clips/<skin>/still.jpg: each skin at its Ultimate's peak, the
  pictures on post 8 (make-posts.mjs).

Needs Pillow (with WOFF2 support, as Ubuntu's) and ffmpeg with libx264.
"""
from pathlib import Path
import json
import math
import shutil
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageStat

ROOT = Path(__file__).resolve().parents[2]
CLIPS = ROOT / "instagram-clips"
OUT = ROOT / "instagram"
FONTS = ROOT / "apps/client/public/assets/fonts"
ICON = ROOT / "apps/client/public/icons/arena-512.png"
W, H, FPS = 1080, 1920, 30
INK, WHITE, HOT = "#0d0d0f", "#ffffff", "#ff2e4d"
SKEW = math.tan(math.radians(10))  # Poster's plates lean 10 degrees

# The skins, in Reel order: [skin, name, fighter, the fighter's colour]. The
# names are the game's (packages/shared/src/shop.ts); the colour is the
# fighter's own, as the Lobby's --el (packages/shared/src/index.ts).
SKINS = [
    ("pyranda-harvest-moon", "Ashen Warlord", "Pyranda", "#ff8a3d"),
    ("tidefin-moontide", "Abyssal Reaver", "Tidefin", "#4fd6e6"),
    ("cindrake-sunforged", "Hellforge", "Cindrake", "#ff7a4f"),
]
# What of each recording goes in, in seconds from that play's press:
# [play, label, from, to]. The idle is the last half second before the
# Entrance, so the Reel opens on the fighter standing.
CUTS = [
    ("idle", None, 1.3, 1.8),
    ("entrance", "Entrance", 0.0, 2.4),
    ("victory", "Victory", 0.0, 2.4),
    ("ultimate", "Ultimate", 0.0, 3.0),
]
# The part of each 1200 x 1500 frame kept: the fighter, its rune circle,
# what rises above it and the ring on the ground (x0, y0, x1, y1).
CROP = (0, 280, 1200, 1480)
CLIP_W = 912  # the stage inside its white clipping, on the Reel
CLIP_TOP = 640
END_SECONDS = 2.5


def anton(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / "anton-latin-400-normal.woff2"), size)


def archivo(size: int, weight: int = 800) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONTS / "archivo-latin-wght-normal.woff2"), size)
    f.set_variation_by_axes([weight])
    return f


def halftone(colour: str, ink_dots=True) -> Image.Image:
    """Poster's ground: the colour with its dots, fading toward the middle."""
    img = Image.new("RGB", (W, H), colour)
    dots = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(dots)
    dot = (0, 0, 0, 41) if ink_dots else (255, 255, 255, 15)
    for y in range(0, H, 18):
        for x in range(0, W, 18):
            d.ellipse((x - 3, y - 3, x + 3, y + 3), fill=dot)
    fade = Image.new("L", (W, H), 255)
    ImageDraw.Draw(fade).ellipse((90, 520, 990, 1500), fill=0)
    fade = fade.filter(ImageFilter.GaussianBlur(160))
    img.paste(dots, (0, 0), Image.composite(dots.getchannel("A"), Image.new("L", (W, H), 0), fade))
    return img


def plate(img, x, y, text, fnt, fill, ink, pad=(28, 12), shadow=None):
    """A skewed block with upright words on it (the Lobby's tabs and PLAY)."""
    d = ImageDraw.Draw(img, "RGBA")
    l, t, r, b = d.textbbox((0, 0), text, font=fnt)
    w, h = r - l + 2 * pad[0], b - t + 2 * pad[1]
    off = h * SKEW
    poly = lambda dx, dy: [(x + off + dx, y + dy), (x + off + w + dx, y + dy), (x + w + dx, y + h + dy), (x + dx, y + h + dy)]
    if shadow:
        d.polygon(poly(*shadow[0]), fill=shadow[1])
    d.polygon(poly(0, 0), fill=fill)
    d.text((x + off / 2 + pad[0] - l, y + pad[1] - t), text, font=fnt, fill=ink)
    return x + w + off, y + h


def chip(img, x, y, text, fnt, fill, ink, pad=(16, 10)):
    d = ImageDraw.Draw(img)
    l, t, r, b = d.textbbox((0, 0), text, font=fnt)
    d.rectangle((x, y, x + r - l + 2 * pad[0], y + b - t + 2 * pad[1]), fill=fill)
    d.text((x + pad[0] - l, y + pad[1] - t), text, font=fnt, fill=ink)
    return x + r - l + 2 * pad[0], y + b - t + 2 * pad[1]


def logo(img, x, y, size=58, text_size=44):
    """The game's name in its skewed ink block, the icon in a white frame."""
    fnt = anton(text_size)
    d = ImageDraw.Draw(img, "RGBA")
    l, t, r, b = d.textbbox((0, 0), "ELEMENT ARENA", font=fnt)
    w, h = size + 16 + (r - l) + 40, size + 20
    off = h * SKEW
    poly = lambda dx: [(x + off + dx, y + dx), (x + off + w + dx, y + dx), (x + w + dx, y + h + dx), (x + dx, y + h + dx)]
    d.polygon(poly(8), fill=(0, 0, 0, 90))
    d.polygon(poly(0), fill=INK)
    icon = Image.open(ICON).convert("RGB").resize((size, size), Image.LANCZOS)
    ix, iy = int(x + off / 2 + 14), y + 10
    d.rectangle((ix - 3, iy - 3, ix + size + 2, iy + size + 2), fill=WHITE)
    img.paste(icon, (ix, iy))
    d.text((ix + size + 16 - l, y + (h - (b - t)) / 2 - t), "ELEMENT ARENA", font=fnt, fill=WHITE)


def card(skin) -> Image.Image:
    """The Reel's frame for one skin, in the fighter's colour."""
    _, name, fighter, colour = skin
    img = halftone(colour)
    logo(img, 84, 250)
    chip(img, 84, 362, "THE SHOP · MYTHICAL SKIN", archivo(28), INK, WHITE)
    _, bottom = plate(img, 84, 428, name.upper(), anton(92), INK, colour, pad=(30, 14), shadow=((10, 10), (0, 0, 0, 90)))
    x, _ = chip(img, 92, bottom + 18, fighter.upper(), archivo(24), WHITE, INK)
    chip(img, x + 10, bottom + 18, "STAGE III", archivo(24), INK, WHITE)
    # The white clipping the stage sits in: ink rim, hard shadow.
    top, side = CLIP_TOP, (W - CLIP_W) // 2
    d = ImageDraw.Draw(img, "RGBA")
    d.rectangle((side - 19 + 16, top - 19 + 16, side + CLIP_W + 18 + 16, top + CLIP_W + 18 + 16), fill=(0, 0, 0, 90))
    d.rectangle((side - 19, top - 19, side + CLIP_W + 18, top + CLIP_W + 18), fill=INK)
    d.rectangle((side - 14, top - 14, side + CLIP_W + 13, top + CLIP_W + 13), fill=WHITE)
    return img


def frames_of(skin_id: str):
    """[(label, play, frame path)] for one skin's cut, 30 a second."""
    rec = CLIPS / skin_id
    meta = json.loads((rec / "marks.json").read_text())
    fps, marks = meta["fps"], dict(meta["marks"])
    marks["idle"] = marks["entrance"]  # the idle cut counts back from the Entrance
    total = len(list(rec.glob("[0-9][0-9][0-9].jpg")))
    out = []
    for play, label, a, b in CUTS:
        base = marks[play] / 1000
        if play == "idle":
            base -= 1.8
        for i in range(round((base + a) * fps), round((base + b) * fps)):
            if 0 <= i < total:
                out.append((label, play, rec / f"{i:03d}.jpg"))
    return out


def peak(skin_id: str) -> Path:
    """The Ultimate's brightest frame: its rune flash at full strength."""
    rec = CLIPS / skin_id
    meta = json.loads((rec / "marks.json").read_text())
    start = round(meta["marks"][-1][1] / 1000 * meta["fps"])
    best, score = None, -1.0
    for i in range(start, start + 2 * meta["fps"]):
        p = rec / f"{i:03d}.jpg"
        if not p.exists():
            break
        stat = ImageStat.Stat(Image.open(p).convert("HSV").crop((300, 500, 900, 1300)))
        s = stat.mean[1] * stat.mean[2]  # saturated and bright: the effect
        if s > score:
            best, score = p, s
    return best


def end_card() -> Image.Image:
    """Ink, the slab's white stripe, the line and where to play."""
    gold = "#ffd84a"
    img = halftone(INK, ink_dots=False)
    d = ImageDraw.Draw(img, "RGBA")
    # A slab in the colour across the top, its slanted edge and white stripe.
    d.polygon([(0, 0), (W, 0), (W, 1060), (0, 1160)], fill=gold)
    d.polygon([(0, 1170), (W, 1070), (W, 1084), (0, 1184)], fill=WHITE)
    logo(img, 84, 300, size=70, text_size=54)
    y = 470
    for line in ("WALK IN", "A LEGEND."):
        d.text((84, y), line, font=anton(170), fill=INK)
        y += 170
    y = 1260
    for line in ("Their own entrance, victory and ultimate.", "All cosmetic, never stronger."):
        d.text((84, y), line, font=archivo(38, 600), fill="#d8d8de")
        y += 54
    plate(img, 84, y + 60, "PLAY FREE · LINK IN BIO", anton(58), gold, INK, pad=(40, 20), shadow=((14, 12), HOT))
    return img


def main():
    if not CLIPS.is_dir():
        sys.exit(f"{CLIPS} missing: run scripts/instagram/skins.spec.ts first")
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg missing")
    OUT.mkdir(exist_ok=True)
    work = CLIPS / "reel"
    shutil.rmtree(work, ignore_errors=True)
    work.mkdir()
    side = (W - CLIP_W) // 2
    n = 0
    cover = None
    for skin in SKINS:
        skin_id, colour = skin[0], skin[3]
        # The still for post 8: a square round the fighter at its peak.
        top = peak(skin_id)
        Image.open(top).crop((100, 400, 1100, 1400)).resize((720, 720), Image.LANCZOS).save(
            CLIPS / skin_id / "still.jpg", quality=92
        )
        base = card(skin)
        for label, play, path in frames_of(skin_id):
            frame = base.copy()
            clip = Image.open(path).convert("RGB").crop(CROP).resize((CLIP_W, CLIP_W), Image.LANCZOS)
            frame.paste(clip, (side, CLIP_TOP))
            if label:
                ult = play == "ultimate"
                plate(
                    frame, side + 24, CLIP_TOP + 24, label.upper(), anton(50),
                    INK, colour if ult else WHITE, pad=(26, 10),
                    shadow=((10, 8), HOT if ult else (0, 0, 0, 90)),
                )
            frame.save(work / f"{n:04d}.jpg", quality=93)
            if path == top and cover is None:
                cover = frame
            n += 1
    end = end_card()
    for _ in range(round(END_SECONDS * FPS)):
        end.save(work / f"{n:04d}.jpg", quality=93)
        n += 1
    (cover or end).save(OUT / "08-skins-reel-cover.jpg", quality=92)
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS),
            "-i", str(work / "%04d.jpg"),
            "-c:v", "libx264", "-preset", "slow", "-crf", "18",
            "-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart",
            str(OUT / "08-skins-reel.mp4"),
        ],
        check=True,
    )
    shutil.rmtree(work)
    size = (OUT / "08-skins-reel.mp4").stat().st_size
    print(f"08-skins-reel.mp4: {n} frames, {n / FPS:.1f} s, {size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
