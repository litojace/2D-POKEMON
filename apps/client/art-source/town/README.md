# Painted plaza fountain

`fountain.png` is the transparent production illustration of the approved
higher-view perspective study. The deployed copy is
`public/assets/town/fountain.webp`, resized to 800 pixels wide at WebP quality 90.

The source is 1402×1122. Its ground plinth anchor is (712, 738), below the water
surface near y=690. The scale is 114 / 437 world units per source pixel.
`paintedFountain` uses identical source pixels and placement for both passes:
the full monument behind the water and a masked column and bowls above rear
streams. Water trajectories and the animated crystal use the matching
`FOUNTAIN` coordinates. All bowl ellipses follow `WORLD_ART.groundY`.

Keep the source unchanged when exporting the smaller WebP. The two passes must
remain aligned, and the source anchor must describe the bottom plinth rather
than the centre of the upper water plane.
