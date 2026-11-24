# Raid arenas matched to the boss posters

Each of the seven bosses now fights on an overhead floor illustration inspired by
its Raid Hub poster. These are wide, flat playfields rather than cinematic posters
placed under the characters. The centers stay open; architecture, vegetation,
waterfalls, crystals and lava light sit around the perimeter.

| Boss | Floor |
| --- | --- |
| Grumblecrag | Warm ruined mountain coliseum, amber crystals and weathered stone |
| Tidewyrm | Turquoise water over a drowned temple, coral around the edge |
| Gloomshade | Violet moonlit flagstones, ivy and lantern-lit ruins |
| Somnara | Lavender dream marble, clouds and golden star trim |
| Prismatail | Ivory marble, gold inlays and reflected stained-glass light |
| Emberwing | Dark basalt in a volcanic coliseum with lava beyond the rim |
| Storm Twins | Rain-wet slate with gold/cyan storm light and copper trim |

`raid-arena-art.ts` maps floor ids to optimized 1600×900 WebP assets. Only the selected
floor is decoded. The existing procedural floor appears immediately; once the image
loads, it is painted into the same canvas and that texture is refreshed once. The
source Image is not retained in a global cache. There is no new full-screen drawing
or image decoding in the frame loop. The existing high-density canvas bake remains.

Gameplay landmarks are drawn over the illustration at world coordinates: the Hands
checkerboard uses the shared gameplay rows/columns, and whirlpool, skylight, conductor
and dream rings retain their existing coordinates. Live warning, mirror, rune-pad,
island, lantern and brazier rendering stays above the floor. A restrained color wash
reduces glare under white/cyan warnings. No server collision geometry changes.

Grumblecrag has a separate `raid-coliseum` floor key so a raid cannot replace the PvP
Coliseum texture. Its rubble images are transparent; there is no rectangular patch of
old sand to expose when a pillar breaks or the illustrated background finishes
loading. Five small ground shadows follow the intact pillars and disappear when
those pillars break. Original procedural fallback remains usable offline.

Validation covers lazy floor loading and failure handling, the checkerboard against
actual Hands tile parity, all seven canvas textures loading in the real game, broken
pillar transparency, texture reuse, live warning screenshots on PC/mobile, and a
return to the separate practice/PvP court texture.
