"""Export the seven complete sculptures without changing the PNG masters.

Pillow only. Transparent gutters are trimmed, then each sculpture is fitted
into a filtered 512px POT texture. Pixel contact bounds drive the world anchor.
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'apps/client/art-source/town/boss-statues'
OUT = ROOT / 'apps/client/src/art'
CELLS = {
    'grumblecrag': ('a', (0, 0, 650, 655)),
    'tidewyrm': ('a', (650, 0, 1254, 655)),
    'gloomshade': ('a', (0, 655, 650, 1254)),
    'somnara': ('a', (650, 655, 1254, 1254)),
    'prismatail': ('b', (0, 0, 650, 690)),
    'emberwing': ('b', (650, 0, 1254, 690)),
    'storm-twins': ('b', (0, 690, 650, 1254)),
}
frames = {}
for name, (sheet, cell) in CELLS.items():
    image = Image.open(SOURCE / f'sheet-{sheet}.png').convert('RGBA').crop(cell)
    bounds = image.getchannel('A').point(lambda a: 255 if a >= 8 else 0).getbbox()
    image = image.crop(bounds)
    ratio = min(496 / image.width, 496 / image.height)
    image = image.resize((round(image.width * ratio), round(image.height * ratio)), Image.Resampling.LANCZOS)
    alpha = image.getchannel('A')
    solid = alpha.point(lambda a: 255 if a >= 128 else 0)
    _, _, _, bottom = solid.getbbox()
    band = max(4, round(image.height * 0.015))
    left, _, right, _ = solid.crop((0, bottom - band, image.width, bottom)).getbbox()
    canvas = Image.new('RGBA', (512, 512))
    x, y = (512 - image.width) // 2, (512 - image.height) // 2
    canvas.alpha_composite(image, (x, y))
    canvas.save(OUT / f'town-statue-{name}.webp', quality=94, method=6)
    frames[name] = {
        'crop': [x, y, image.width, image.height],
        'foot': [(left + right) / 2, bottom],
        'contactWidth': right - left,
    }
    print(name, frames[name])
(OUT / 'town-statue-frames.json').write_text(json.dumps(frames, indent=2) + '\n')
