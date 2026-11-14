#!/usr/bin/env python3
"""
Turns one boss painting (3:2) into the three pictures the game uses
(apps/client/src/art/raid-splash/):

  <id>.webp           the splash, 1536x1024 (the boss page's stage)
  <id>-thumb.webp     320x213, framed on the whole boss (profile trophies)
  <id>-portrait.webp  600x900, framed on the whole boss (Raid Hall cards,
                      the room banner)

The boss is given as a box around everything that belongs to it (tails,
ribbons, tendrils, its puddle), in the painting's own pixels. The pictures
are cut so the whole box shows with a margin, never trimmed.

A Raid Hall card only shows the middle of the portrait: a 1:1.3 window
whose top sits 35% down the spare height (object-position: 50% 35% in
screens/raid-hall.css). The portrait is cut so that window holds the whole
boss. When the boss is too wide for a 2:3 cut of the painting's height, the
portrait reaches above or below the painting and that strip is filled with
a soft, blurred continuation of the painting's edge; most of it falls
outside the card's window.

A splash that is already a 1536x1024 WebP is copied as it is, so it is not
compressed twice.

Usage (from the repo root; needs Pillow):
  python3 docs/ui-remodel/tools/boss-art.py <id> <painting> x0 y0 x1 y1 [margin] [face-x]

margin (default 1.1) is how much wider than the box the cuts are; a boss that
fills the painting's width takes a smaller one (1.03) so less is filled.

face-x is where the boss's face is across the painting (for two bosses, the
point between their faces). The whole box always comes first; within the
room a cut has to spare, it slides toward the face so the face sits as near
the middle as it can without trimming the boss (owner's notes, 14 Nov).
"""
import shutil
import sys

from PIL import Image, ImageFilter

OUT = "apps/client/src/art/raid-splash"
W, H = 1536, 1024
CARD = 1.3  # a card's height over its width
CARD_Y = 0.35  # where the card's window sits in the portrait's spare height


def fill_edges(img, box):
    """Crop box (may reach outside img); outside rows are a blurred edge."""
    x0, y0, x1, y1 = (round(v) for v in box)
    cw, ch = x1 - x0, y1 - y0
    out = Image.new("RGB", (cw, ch))
    out.paste(img.crop((x0, max(0, y0), x1, min(img.height, y1))), (0, max(0, -y0)))
    top, bottom = max(0, -y0), max(0, y1 - img.height)
    for n, at_top in ((top, True), (bottom, False)):
        if not n:
            continue
        # The edge band mirrored outward, blurred harder the further it goes.
        band = min(img.height // 3, n)
        src = img.crop(
            (x0, 0, x1, band) if at_top else (x0, img.height - band, x1, img.height)
        ).transpose(Image.FLIP_TOP_BOTTOM)
        src = src.resize((cw, n))
        soft = src.filter(ImageFilter.GaussianBlur(10))
        softer = src.filter(ImageFilter.GaussianBlur(28))
        mask = Image.linear_gradient("L").resize((cw, n))
        if at_top:
            mask = mask.transpose(Image.FLIP_TOP_BOTTOM)
        strip = Image.composite(softer, soft, mask)
        out.paste(strip, (0, 0) if at_top else (0, ch - n))
    return out


def main():
    bid, path = sys.argv[1], sys.argv[2]
    bx0, by0, bx1, by1 = (float(v) for v in sys.argv[3:7])
    m = float(sys.argv[7]) if len(sys.argv) > 7 else 1.1
    fx = float(sys.argv[8]) if len(sys.argv) > 8 else None
    src = Image.open(path)
    if src.size != (W, H):
        # Cover 1536x1024 from the middle; the box follows.
        s = max(W / src.width, H / src.height)
        sw, sh = round(src.width * s), round(src.height * s)
        ox, oy = (sw - W) / 2, (sh - H) / 2
        src = src.convert("RGB").resize((sw, sh), Image.LANCZOS)
        src = src.crop((round(ox), round(oy), round(ox) + W, round(oy) + H))
        bx0, bx1 = bx0 * s - ox, bx1 * s - ox
        fx = None if fx is None else fx * s - ox
        by0, by1 = by0 * s - oy, by1 * s - oy
        src.save(f"{OUT}/{bid}.webp", quality=82, method=6)
    elif path.lower().endswith(".webp"):
        shutil.copyfile(path, f"{OUT}/{bid}.webp")
    else:
        src.convert("RGB").save(f"{OUT}/{bid}.webp", quality=82, method=6)
    img = src.convert("RGB")
    bw, bh = bx1 - bx0, by1 - by0
    cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2

    def toward_face(w):
        """The cut's middle: the face if the whole box still fits, else as near."""
        if fx is None:
            return cx
        pad = max(0, w - bw) / 4  # keep half the spare room as a margin
        lo, hi = bx1 + pad - w / 2, bx0 - pad + w / 2
        return min(max(fx, lo), hi) if lo <= hi else cx

    # Thumb: 3:2 around the box with the margin, kept inside the painting.
    tw = max(bw * m, bh * m * 1.5)
    tw = min(tw, W)
    th = tw / 1.5
    tx = min(max(toward_face(tw) - tw / 2, 0), W - tw)
    ty = min(max(cy - th / 2, 0), H - th)
    img.crop((round(tx), round(ty), round(tx + tw), round(ty + th))).resize(
        (320, 213), Image.LANCZOS
    ).save(f"{OUT}/{bid}-thumb.webp", quality=80, method=6)

    # Portrait: the card's 1:1.3 window holds the box with the margin.
    vw = max(bw * m, bh * m / CARD)
    vw = min(vw, W)
    vh = vw * CARD
    vx = min(max(toward_face(vw) - vw / 2, 0), W - vw)
    if vh <= H:  # keep the window inside the painting when it fits
        vy = min(max(cy - vh / 2, 0), H - vh)
    else:
        # Too tall: start at the painting's top, so the filled strip lands at
        # the card's foot, under its name and the dark fade behind it.
        vy = 0
    ph = vw * 1.5
    py = vy - CARD_Y * (ph - vh)
    if ph <= H:
        py = min(max(py, 0), H - ph)
    fill_edges(img, (vx, py, vx + vw, py + ph)).resize(
        (600, 900), Image.LANCZOS
    ).save(f"{OUT}/{bid}-portrait.webp", quality=82, method=6)
    print(
        f"{bid}: thumb {tw:.0f}x{th:.0f}+{tx:.0f}+{ty:.0f}, "
        f"portrait {vw:.0f}x{ph:.0f}+{vx:.0f}{py:+.0f} (card window from y {vy:.0f})"
    )


if __name__ == "__main__":
    main()
