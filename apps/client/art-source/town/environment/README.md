# Painted village environment

These transparent source illustrations were generated for the same elevated, front-facing fantasy village as the painted buildings. The complete source files remain here; production uses the compact, content-hashed WebP exports in `src/art/`.

- `nature.png`: 1254×1254, separate crowns, trunks, shrubs and mossy boulder. Export at quality 87.
- `props.png`: 1254×1254, well, lamp, notice board, sign, storage, mirror, pedestal, dummy and planter. Export at quality 88.
- `animals.png`: 1448×1086, mallard swim/dabble poses, hens, puppy poses and gull. Export at quality 88.

`town-environment-art.ts` records actual complete-object crops; the source objects do not strictly follow equal cell boundaries. Fit those objects within the existing clearance-safe frames and preserve their ground/water anchors. The notice board's bottom centre is transparent between its two complete feet; its clip excludes the separate mirror ornament below it in the atlas.

Tree crowns sway separately above their complete trunks. Swimming ducks use whole illustrated poses and independent feeding clocks. Never cut a moving illustration into arbitrary rectangular strips. The original source atlases are released from the GPU after the placed sprite textures have been baked.
