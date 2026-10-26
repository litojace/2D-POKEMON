# Native-pixel village architecture

These PNG masters are faithful generated redraws of the previous architecture,
with the original facade direction and material palette. The cottages, stall,
tower and windmill are separate large illustrations rather than small cells in
one atlas. `obelisk.png` is the new ivory/gold/amethyst Champions' Obelisk.

Run `python scripts/export-town-hd.py` (Pillow) from the repository root to
export the nine hashed runtime WebPs. All buildings use the original shared
crop/doorstep coordinates. The exporter fits each complete illustration to
that canonical rectangle; world placement, reserved scenery bounds, routes,
shadows and collision stay tied to the shared geometry.

GPU storage uses power-of-two rectangles so Phaser can create filtered mip
levels on WebGL 1 as well as newer devices. These storage rectangles can have
a different aspect ratio from the illustration. The renderer restores the
canonical world rectangle with separate X/Y scales. A 2048px texture storage
width does not imply 2048px of newly authored detail in the master.

The runtime reuses each source texture directly across its placed instances.
It does not bake a second, smaller canvas per building. Tree and street-prop
crops also reuse their native atlas pixels. The fountain now uses its full
1402×1122 master; its two passes share one GPU source, with a geometry mask
preserving the original upper-column/water layering.
