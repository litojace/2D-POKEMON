# Village ground and paving

The village now shares the warm limestone and painted surface detail of its
new buildings. Roads and courts use one consistent stone scale and texture
origin. Curving roads are offset in the ground plane before projection; plaza
stones rotate before projection, so the side courses no longer stand upright.

Raid Hall has a cream slab forecourt, the fountain has a slab compass court,
and all houses, the tower and windmill have small entrance courts aligned to
the actual painted doorstep anchors. Open borders connect courts to roads.
The old white line pickets and rectangular lawn overlays were removed.

Meadow grass is assembled from softly blended, wrapped source samples rather
than a mirrored repeating motif. Root collars ground trees and rocks. Packed
earth around the arena and training yard fades into the meadow rather than
using a solid dark oval border. Pond plants and fountain water remain animated.

The 3200 × 2000 ground is baked into the existing hashed WebP. The source atlas
is build-only; mobile loads one ground image with the same GPU dimensions as
before, with no new live terrain drawing loop or terrain source texture.

Actual client captures:

- [Overview](town-terrain-overview.webp)
- [Market and house entrances](town-terrain-market.webp)
- [Pond and east houses](town-terrain-pond.webp)
- [Mobile landscape](town-terrain-mobile.webp)

Validation: full shared/client/server build, 84 client tests, 16 town unit tests,
PWA verification, loaded ground bytes versus shipped source, material painting
browser check, seven actual village views, mobile landscape capture, and the
WebKit iOS Home Screen resume/battle-return check. Physical iPhone verification
still requires a device.
