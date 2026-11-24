# Elemental impact flipbook

`elemental-flipbook.png` is the transparent source sheet for four elemental rows
(fire, water, arcane and lightning), each with ignition, eruption, expansion and
dissipation. Run `python scripts/export-boss-spells.py` with Pillow to export the
shared 1024 × 1024 WebP atlas. The client crossfades adjacent authored frames and
uses a bounded sprite pool. Warning geometry and damage timing remain controlled
by the server; interrupted casts have no cosmetic impact.
