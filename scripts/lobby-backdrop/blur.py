"""Write the Lobby's backdrop, blurred and dimmed, from the Plaza picture.

The Lobby used to blur and dim plaza-lobby.webp with a CSS filter
(blur(5px) saturate(1.05) brightness(0.6)) on a full-screen layer, under the
live fighter that redraws every frame. This bakes the same look into its own
picture, so the phone composites a plain image instead (owner, iPhone 17 Pro
Max, 17 Nov 2026: the aura stuttered in the Lobby but not in the Shop, whose
panel covers the backdrop). A 6 px blur on the 1350 px picture matches the
CSS one on a landscape phone (956 x 440: about 1/255 apart on average).

Run after encode.py (which runs it for you). Like encode.py, the name
carries a hash of the contents: the service worker precaches assets/ by URL.
"""
import hashlib
import io
import re
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

root = Path(__file__).resolve().parents[2]
folder = root / "apps/client/public/assets/backgrounds"
css = root / "apps/client/src/lobby.css"

(src,) = folder.glob("plaza-lobby-*.webp")
im = Image.open(src).convert("RGB").filter(ImageFilter.GaussianBlur(6))
im = ImageEnhance.Color(im).enhance(1.05).point(lambda v: round(v * 0.6))
buf = io.BytesIO()
im.save(buf, "WEBP", quality=80, method=6)
data = buf.getvalue()
name = f"lobby-backdrop-{hashlib.sha256(data).hexdigest()[:8]}.webp"
(folder / name).write_bytes(data)

pattern = re.compile(r"/assets/backgrounds/lobby-backdrop-[0-9a-f]{8}\.webp")
text = css.read_text()
assert pattern.search(text), f"no backdrop reference in {css}"
css.write_text(pattern.sub(f"/assets/backgrounds/{name}", text))
for old in folder.glob("lobby-backdrop-*.webp"):
    if old.name != name:
        old.unlink()
print(name, len(data), "bytes")
