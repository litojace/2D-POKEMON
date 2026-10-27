# Complete living boss poses

These transparent PNG masters replace the earlier articulated-part renderer. Every
pose contains a complete creature: heads, necks, shoulders and limbs are drawn
connected in the same painting. No anatomical part is cropped out or independently
rotated at runtime.

Each standard sheet contains four complete poses, in reading order: ready,
anticipation, strike and recovery. Emberwing has separate flying and grounded
sheets; its flight cycle also uses the raised/lowered wing drawings. Tidewyrm has
a separate low, fully connected stranded pose. Storm Twins has four gold poses on
the first row and four blue poses on the second row. Gloomshade is included.

Run `python scripts/export-whole-bosses.py` from the repository root with Pillow,
numpy and scipy installed. It extracts each connected **whole character**, assigns
soft alpha fringes to the nearest whole silhouette and packs padded WebP atlases
with measured foot, core and moon anchors in `raid-whole-frames.json`. Source
pixels remain native resolution except the extra-wide grounded Tidewyrm, which
is downsampled to fit the 2048-pixel atlas width. Display scale compensates for
that reduction. Re-running the exporter produces all seven runtime atlases.

The client follows server warning deadlines for anticipation, strike and recovery,
with a 65 ms whole-frame blend. Breathing and secondary motion deform one
continuous surface; the head and neck cannot be detached. The phoenix's central
face is excluded from wing flex and the complete sprite remains level. Motion
pauses with combat; reduced motion holds a whole authored pose. The renderer loads
only the current encounter's atlas and evicts old encounter textures. Old vector
painters remain an asset-failure fallback.

The source sheets are development assets and are not included in the shipped app.
`apps/client/boss-animation-preview.html` is a local-only review screen. Browser
checks in `tests/visual/boss-painted.spec.ts` exercise the real battle renderer,
whole silhouettes, confirmed/interrupted casts, pause, reduced motion, stale actor
cleanup, texture changes and actual desktop/iPhone raid scenes. See
`docs/whole-bosses.md` for review captures.
