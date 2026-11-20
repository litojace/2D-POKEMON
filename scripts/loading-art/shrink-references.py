#!/usr/bin/env python3
"""
Make the committed skin reference pictures (docs/loading-art-references/)
from the full-size ones export-references.mjs writes: each is cropped to the
fighter, made at most 512 px and saved as a 256-colour PNG (about 30 KB).

Usage: python3 scripts/loading-art/shrink-references.py <exported-folder>
Needs Pillow (pip install pillow).
"""
import sys
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parents[2] / "docs/loading-art-references"


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    files = sorted(Path(sys.argv[1]).glob("*.png"))
    if not files:
        raise SystemExit("no PNG pictures in " + sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    for p in files:
        img = Image.open(p).convert("RGBA")
        img = img.crop(img.getbbox())
        img.thumbnail((512, 512), Image.LANCZOS)
        target = OUT / p.name
        img.quantize(colors=256, method=Image.FASTOCTREE).save(
            target, "PNG", optimize=True
        )
        print(f"{target.relative_to(OUT.parents[1])} {target.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
