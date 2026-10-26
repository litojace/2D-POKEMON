# Whole-pose village animal animation

The original transparent generated sheets are preserved unchanged:

- `dog.png` — 1448×1086, eight walk poses, standing, lowered sniff, half-raised sniff, sitting.
- `hens.png` — 1448×1086, white and brown coats, each with four walk poses and four feeding/standing poses.
- `gull.png` — 1774×887, eight wingbeat poses, all facing right in side profile.

`python scripts/bake-town-animal-motion.py` (Pillow + numpy) exports the compact
1536×800 runtime `src/art/town-animal-motion.webp` with 36 complete silhouettes.
Actual source illustrations extend beyond equal grid cells, so the exporter
isolates whole connected animals and retains their antialiased edges. It does
not slice them into moving body fragments. Original source art is untouched.

Fixed species scales and authored feet/body anchors keep paws on the same
baseline and bird bodies stable as wings lift/lower. Runtime code never fits
the changing pose bounds to a new size on every frame. Atlas cells are 192×160;
dogs use the first 128 pixels of cell height, with feet at y125; hens have feet
at y157; birds have a body pivot at (96,80).

Order: puppy frames 0–11, white hens 12–19, brown hens 20–27, gulls 28–35.
The source atlas is removed from the GPU after the small animation textures
have been baked. Existing duck art and waterline anchors are retained.
