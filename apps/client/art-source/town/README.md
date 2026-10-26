# Painted plaza fountain

`fountain.png` is the transparent production illustration of the approved
higher-view perspective study. The compact source export is
`src/art/town-fountain.webp`, exported at its full 1402×1122 resolution at WebP quality 94.
Vite gives the deployed file a content hash; `town-assets.ts` supplies this URL
to the actual town and the fountain review renderer. The paved ground uses
the same pipeline so both layers update with the approved perspective.

The source is 1402×1122. Its ground plinth anchor is (712, 738), below the water
surface near y=690. The scale is 114 / 437 world units per source pixel.
`paintedFountain` uses identical source pixels and placement for both passes:
the full monument behind the water and a masked column and bowls above rear
streams. Water trajectories and the animated crystal use the matching
`FOUNTAIN` coordinates. All bowl ellipses follow `WORLD_ART.groundY`.

Keep the source unchanged when exporting the smaller WebP. The two passes must
remain aligned, and the source anchor must describe the bottom plinth rather
than the centre of the upper water plane.

## Painted architecture

`architecture/` keeps the generated transparent production source illustrations:
`coliseum.png`, `raid-hall.png` and `small-buildings.png`. The small atlas contains
red and teal cottages, a plum cottage and market stall, then a tower and windmill
in a two-column, three-row grid. The facades face forward with horizontal front
steps; roof and canopy surfaces supply the higher viewpoint.

Export each complete source to the matching `src/art/town-*.webp` at quality 89
without resizing or stripping alpha. `packages/shared/src/town-building-layout.ts` records source crops,
front-step anchors and attachment points for flags, smoke, flames and sails.
Those coordinates depend on the original source dimensions. Animation moves
separate effects; it never slices or deforms the painted buildings. All three
exports use Vite content hashes and are included in the offline precache.

The shared source geometry also reserves the full visible bounds of each
building and storefront before trees and shrubs are generated. Reserve the
canopy, shrub picture and spinning sails rather than only collision centres.
`arenaGroundFoot` describes the painted base ring and is shared by the ground
apron, cast shadow and movement collision. Rebuild `town-ground.webp` with
`scripts/bake-town-ground.mjs` whenever layout or shadow placement changes.

## Current HD runtime

See `architecture-hd/README.md` for the separate native-texture architecture,
filtered zoom levels and the ivory/gold Champions’ Obelisk. The original atlas
masters and shared source coordinates remain as the geometry reference.
