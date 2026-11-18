#!/usr/bin/env python3
"""
Import new library avatars (docs/avatar-prompts.md) into the game.

Usage: python3 scripts/import-avatars.py <folder> [--check]

<folder> holds the generated pictures, any of PNG, JPEG or WebP, each named
after the avatar it replaces (ea-avatar-027.png ...). Each is cut to its
middle square, made 256 x 256 and saved as WebP (quality lowered until it is
at most 20 KB) over apps/client/public/assets/avatars/<id>.webp.

--check only reports what it would do. Needs Pillow (pip install pillow).
"""
import io
import re
import sys
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "apps/client/public/assets/avatars"
SIZE = 256
MAX_BYTES = 20 * 1024
NAME = re.compile(r"^(ea-avatar-0(?:0[1-9]|[1-4][0-9]|5[0-2]))\.(png|jpe?g|webp)$", re.I)


def webp(img: Image.Image) -> bytes:
    for quality in (88, 82, 76, 70, 62, 54):
        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=quality, method=6)
        if buf.tell() <= MAX_BYTES:
            return buf.getvalue()
    raise SystemExit(f"could not make it {MAX_BYTES} bytes or less")


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    check = "--check" in sys.argv
    if len(args) != 1:
        raise SystemExit(__doc__)
    folder = Path(args[0])
    files = sorted(p for p in folder.iterdir() if p.is_file())
    found, skipped = {}, []
    for p in files:
        m = NAME.match(p.name)
        if not m:
            skipped.append(p.name)
            continue
        if m.group(1) in found:
            raise SystemExit(f"two pictures for {m.group(1)}")
        found[m.group(1)] = p
    if not found:
        raise SystemExit("no ea-avatar-XXX pictures in " + str(folder))
    for avatar, p in sorted(found.items()):
        img = Image.open(p)
        w, h = img.size
        if min(w, h) < SIZE:
            raise SystemExit(f"{p.name}: {w}x{h} is smaller than {SIZE}px")
        if abs(w - h) > 0.1 * max(w, h):
            print(f"note: {p.name} is {w}x{h}, its middle square is used")
        side = min(w, h)
        img = img.convert("RGBA").crop(
            ((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2)
        ).resize((SIZE, SIZE), Image.LANCZOS)
        data = webp(img)
        print(f"{avatar}: {p.name} {w}x{h} -> {len(data) // 1024} KB")
        if not check:
            (OUT / f"{avatar}.webp").write_bytes(data)
    if skipped:
        print("skipped (not named ea-avatar-001 ... 052):", ", ".join(skipped))
    print(f"{len(found)} avatar(s) {'checked' if check else 'imported'}")


if __name__ == "__main__":
    main()
