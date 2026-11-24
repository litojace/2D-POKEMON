"""Export a small, aligned four-element effect flipbook (Pillow)."""
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
source=root/'apps/client/art-source/bosses/spells/elemental-flipbook.png'
im=Image.open(source).convert('RGBA')
im.resize((1024,1024),Image.Resampling.LANCZOS).save(root/'apps/client/src/art/raid-spell-flipbook.webp',quality=94,method=6)
