import sys
from PIL import Image, ImageDraw
d, out, names = sys.argv[1], sys.argv[2], sys.argv[3].split(",")
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 3
w = int(sys.argv[5]) if len(sys.argv) > 5 else 560
ims = []
for n in names:
    try:
        im = Image.open(f"{d}/{n}.png").convert("RGB")
    except Exception:
        continue
    im = im.resize((w, int(im.height * w / im.width)))
    ims.append((n, im))
h = ims[0][1].height + 16
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * w, rows * h), "white")
dr = ImageDraw.Draw(sheet)
for i, (n, im) in enumerate(ims):
    x, y = (i % cols) * w, (i // cols) * h
    sheet.paste(im, (x, y + 16)); dr.text((x + 4, y + 2), n, fill="black")
sheet.save(out, quality=78)
