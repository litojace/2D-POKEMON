"""Write the Lobby's backdrop from capture.spec.ts's picture (see that file).

The whole Plaza at half size (1350x850): the Lobby shows a blurred, darkened
copy (blur.py, run at the end) with background-size: cover, so more pixels
would only cost bytes.

The file's name carries a hash of its contents. The service worker precaches
everything under assets/ by URL alone (vite-plugin-pwa treats that folder as
already hashed), so a picture saved under an old name would never reach a
player who has the game installed. This script writes the new name, points
the CSS at it and deletes the old picture.
"""
import hashlib
import io
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parents[2]
src = root / "test-results/lobby-backdrop/plaza.png"
folder = root / "apps/client/public/assets/backgrounds"
# The Lobby itself shows a blurred, dimmed copy that blur.py makes (below).
css = [root / "apps/client/src/style.css"]

im = Image.open(src).convert("RGB")
assert im.size == (2700, 1700), f"expected the whole 2700x1700 map, got {im.size}"
buf = io.BytesIO()
im.resize((1350, 850), Image.LANCZOS).save(buf, "WEBP", quality=80, method=6)
data = buf.getvalue()
name = f"plaza-lobby-{hashlib.sha256(data).hexdigest()[:8]}.webp"
(folder / name).write_bytes(data)

pattern = re.compile(r"/assets/backgrounds/plaza-lobby(?:-[0-9a-f]{8})?\.webp")
for path in css:
    text = path.read_text()
    assert pattern.search(text), f"no backdrop reference in {path}"
    path.write_text(pattern.sub(f"/assets/backgrounds/{name}", text))
for old in folder.glob("plaza-lobby-*.webp"):
    if old.name != name:
        old.unlink()
print(name, len(data), "bytes")
# The Lobby's blurred, dimmed copy of the new picture.
subprocess.run([sys.executable, str(Path(__file__).with_name("blur.py"))], check=True)
