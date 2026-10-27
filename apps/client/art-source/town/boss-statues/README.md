# Raid Hall stone sculptures

The two unmodified transparent PNG masters contain seven generated sculptures
based on the existing boss crests. The ivory limestone, restrained gold inlays,
upper-left light and elevated frontal view match the HD Raid Hall and pedestal.

Sheet A: Grumblecrag, Tidewyrm, Gloomshade and Somnara, in reading order.
Sheet B: Prismatail, Emberwing and Storm Twins, with the last cell empty.
Flying creatures have integral carved wave/cloud/tentacle supports. Each asset
is a complete static sculpture; it is never sliced into animated body strips.

Run `python scripts/export-town-statues.py` with Pillow from the repository
root. The exporter trims transparent gutters and fits each illustration into a
512×512 power-of-two WebP at quality 94, keeping the masters unchanged. The
generated frame JSON records each image crop, opaque bottom contact centre and
support width. The runtime anchors that measured contact point to the existing
pedestal cap and fits its support within 68 world units. Sculptures stay within
the original 96×92 world envelope; roads, collision, plinths and name plaques
retain their previous placement.

Town preloads these images via content-hashed imports and reuses their source
textures directly with mip filtering. The previous asynchronous SVG-to-grey
canvas conversion is removed. All seven sculptures are available offline.
