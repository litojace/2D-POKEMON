#!/usr/bin/env python3
"""The skins Reel and post 8's stills, from the fitting room recordings.

    npx playwright test --config scripts/instagram/playwright.config.ts
    python3 scripts/instagram/make-reel.py          # from the repo root
    node scripts/instagram/make-posts.mjs           # post 8 uses the stills

scripts/instagram/skins.spec.ts records each Mythical at Stage III in the
game's fitting room, 30 frames a second: standing, then its Entrance,
Victory and Ultimate. This cuts each play to its effect, frames it under the
skin's name with the play named in a chip, adds an end card, and writes:

- instagram/08-skins-reel.mp4: 1080 x 1920, 30 fps, H.264 (Instagram's
  Reel format), no sound: add a track from Instagram's library when posting.
- instagram/08-skins-reel-cover.jpg: the Reel's cover (the Ultimate's peak).
- instagram-clips/<skin>/still.jpg: each skin at its Ultimate's peak, the
  pictures on post 8 (make-posts.mjs).

Needs Pillow (with WOFF2 support, as Ubuntu's) and ffmpeg with libx264.
"""
from pathlib import Path
import json
import shutil
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageStat

ROOT = Path(__file__).resolve().parents[2]
CLIPS = ROOT / "instagram-clips"
OUT = ROOT / "instagram"
FONTS = ROOT / "apps/site/fonts"
ICON = ROOT / "apps/client/public/icons/arena-512.png"
W, H, FPS = 1080, 1920, 30
NAVY, GOLD, INK, WHITE, MUTED = "#0b1020", "#ffd65b", "#2a1a00", "#ffffff", "#dfe6f7"

# The skins, in Reel order: [skin, name, fighter, element colour]. The names
# are the game's (apps/site/data/champions.json).
SKINS = [
    ("pyranda-harvest-moon", "Ashen Warlord", "Pyranda", "#ff8a3d"),
    ("tidefin-moontide", "Abyssal Reaver", "Tidefin", "#4fd1ff"),
    ("cindrake-sunforged", "Hellforge", "Cindrake", "#ff5a3c"),
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
CLIP_TOP = 540  # where the clip sits on the Reel (its faded top under the words)
END_SECONDS = 2.5


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    name = {
        "800": "barlow-condensed-latin-800-normal.woff2",
        "700": "barlow-condensed-latin-700-normal.woff2",
        "body": "dm-sans-latin-600-normal.woff2",
    }[weight]
    return ImageFont.truetype(str(FONTS / name), size)


def spaced(draw, xy, text, fnt, fill, tracking=0.0):
    """Text with letter-spacing (a share of the size), as the posts' eyebrows."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + tracking * fnt.size
    return x


def logo(img: Image.Image, x: int, y: int, size=64, text_size=42):
    icon = Image.open(ICON).convert("RGBA").resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size, size), radius=size // 4.5, fill=255)
    img.paste(icon, (x, y), mask)
    d = ImageDraw.Draw(img)
    spaced(d, (x + size + 16, y + (size - text_size) // 2 - 6), "ELEMENT ARENA", font("800", text_size), WHITE, 0.03)


def pill(draw, x, y, text, fnt, fill, ink, pad=(26, 14)):
    w = draw.textlength(text, font=fnt) + 0.05 * fnt.size * len(text)
    box = (x, y, x + w + 2 * pad[0], y + fnt.size + 2 * pad[1])
    draw.rounded_rectangle(box, radius=(box[3] - box[1]) // 2, fill=fill)
    spaced(draw, (x + pad[0], y + pad[1] - fnt.size * 0.12), text, fnt, ink, 0.05)
    return box


def card(skin) -> Image.Image:
    """The Reel's frame for one skin: the words round a window for the clip."""
    _, name, fighter, colour = skin
    img = Image.new("RGB", (W, H), NAVY)
    d = ImageDraw.Draw(img)
    logo(img, 84, 250)
    spaced(d, (84, 350), "THE SHOP · MYTHICAL SKIN", font("700", 32), GOLD, 0.12)
    d.text((84, 388), name.upper(), font=font("800", 104), fill=WHITE)
    spaced(d, (88, 512), f"{fighter.upper()} · STAGE III", font("700", 30), colour, 0.1)
    return img


def fade_mask(w: int, h: int, edge: int) -> Image.Image:
    """Opaque in the middle, fading out over `edge` pixels at top and bottom."""
    m = Image.new("L", (w, h), 255)
    d = ImageDraw.Draw(m)
    for i in range(edge):
        a = round(255 * i / edge)
        d.line((0, i, w, i), fill=a)
        d.line((0, h - 1 - i, w, h - 1 - i), fill=a)
    return m


def frames_of(skin_id: str):
    """[(label, frame path)] for one skin's cut, 30 a second."""
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
    img = Image.new("RGB", (W, H), NAVY)
    glow = Image.new("RGB", (W, H), NAVY)
    ImageDraw.Draw(glow).ellipse((90, 520, 990, 1400), fill="#3b2a12")
    img = Image.blend(img, glow.filter(ImageFilter.GaussianBlur(160)), 1.0)
    d = ImageDraw.Draw(img)
    logo(img, 84, 300, size=88, text_size=56)
    y = 560
    for line in ("WALK IN", "A LEGEND."):
        d.text((84, y), line, font=font("800", 150), fill=WHITE)
        y += 150
    for line in ("Costumes with their own entrance,", "victory and ultimate.", "All cosmetic, never stronger."):
        d.text((84, y + 40), line, font=font("body", 40), fill=MUTED)
        y += 56
    pill(d, 84, y + 110, "PLAY FREE · LINK IN BIO", font("800", 48), GOLD, INK)
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
    cw = CROP[2] - CROP[0]
    scale = W / cw
    ch = round((CROP[3] - CROP[1]) * scale)
    mask = fade_mask(W, ch, 90)
    chip_font = font("800", 40)
    n = 0
    cover = None
    for skin in SKINS:
        skin_id = skin[0]
        # The still for post 8: a square round the fighter at its peak.
        top = peak(skin_id)
        Image.open(top).crop((100, 400, 1100, 1400)).resize((720, 720), Image.LANCZOS).save(
            CLIPS / skin_id / "still.jpg", quality=92
        )
        base = card(skin)
        for label, play, path in frames_of(skin_id):
            frame = base.copy()
            clip = Image.open(path).convert("RGB").crop(CROP).resize((W, ch), Image.LANCZOS)
            frame.paste(clip, (0, CLIP_TOP), mask)
            if label:
                d = ImageDraw.Draw(frame)
                pill(d, 84, CLIP_TOP + 60, label.upper(), chip_font, GOLD if play == "ultimate" else WHITE, INK)
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
