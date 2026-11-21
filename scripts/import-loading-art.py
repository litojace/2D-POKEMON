#!/usr/bin/env python3
"""
Import loading-screen paintings (docs/loading-art-prompts.md) into the game.

Usage: python3 scripts/import-loading-art.py <folder> [--check]

<folder> holds the paintings, any of PNG, JPEG or WebP, each named after its
scene in apps/client/src/loading-art.ts (duel-storm-vs-forge.png ...). Each
must be landscape (at least 1536 px wide, between 4:3 and 21:9). It is made
at most 1920 px wide and saved as WebP (quality lowered until it is at most
360 KB) at apps/client/src/art/loading-art/startup-art-<id>.webp, where the
game picks it up by itself (the scene starts showing on the next build).

--check only reports what it would do. Needs Pillow (pip install pillow).
"""
import io
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SCENES = ROOT / "apps/client/src/loading-art.ts"
OUT = ROOT / "apps/client/src/art/loading-art"
MIN_WIDTH = 1536
MAX_WIDTH = 1920
MAX_BYTES = 360 * 1024
NAME = re.compile(r"^([a-z0-9-]+)\.(png|jpe?g|webp)$", re.I)


def scene_ids() -> list[str]:
    source = SCENES.read_text(encoding="utf-8")
    block = source.split("export const LOADING_SCENES", 1)[1].split("\n];", 1)[0]
    return re.findall(r'^    id: "([a-z0-9-]+)"', block, re.M)


def webp(img: Image.Image) -> bytes:
    for quality in (86, 82, 78, 74, 70, 66, 62, 58):
        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=quality, method=6)
        if buf.tell() <= MAX_BYTES:
            return buf.getvalue()
    raise SystemExit(f"could not make it {MAX_BYTES // 1024} KB or less")


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    check = "--check" in sys.argv
    if len(args) != 1:
        raise SystemExit(__doc__)
    ids = scene_ids()
    if not ids:
        raise SystemExit(f"no scenes found in {SCENES}")
    folder = Path(args[0])
    found, skipped = {}, []
    for p in sorted(folder.iterdir()):
        m = NAME.match(p.name) if p.is_file() else None
        if not m or m.group(1) not in ids:
            skipped.append(p.name)
            continue
        if m.group(1) in found:
            raise SystemExit(f"two paintings for {m.group(1)}")
        found[m.group(1)] = p
    if skipped:
        print("not a scene, skipped: " + ", ".join(skipped))
        print("scenes: " + ", ".join(ids))
    if not found:
        raise SystemExit("no paintings named after a scene in " + str(folder))
    OUT.mkdir(parents=True, exist_ok=True)
    for scene, p in sorted(found.items()):
        img = Image.open(p).convert("RGB")
        w, h = img.size
        if w < MIN_WIDTH:
            raise SystemExit(f"{p.name}: {w}x{h} is narrower than {MIN_WIDTH}px")
        if not (4 / 3 - 0.01 <= w / h <= 21 / 9 + 0.01):
            raise SystemExit(f"{p.name}: {w}x{h} is not landscape (4:3 to 21:9)")
        if w > MAX_WIDTH:
            img = img.resize((MAX_WIDTH, round(h * MAX_WIDTH / w)), Image.LANCZOS)
        data = webp(img)
        target = OUT / f"startup-art-{scene}.webp"
        verb = "would write" if check else "wrote"
        if not check:
            target.write_bytes(data)
        print(f"{verb} {target.relative_to(ROOT)} {img.size[0]}x{img.size[1]} "
              f"{len(data) // 1024} KB")
    missing = [i for i in ids if i not in found and
               not (OUT / f"startup-art-{i}.webp").exists()]
    if missing:
        print("scenes still without a painting: " + ", ".join(missing))


if __name__ == "__main__":
    main()
