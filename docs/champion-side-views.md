# Copied reference side views

The eight champions' left and right profiles now use the actual illustrations
from the approved reference sheets. They replace the previous SVG redraws.
Both directions are extracted separately; the right view is not a mirrored left
view. Front and back artwork remains unchanged.

The unmodified source sheets are in `apps/client/art-source/side-views/`.
`apps/client/scripts/import-side-references.mjs` removes the sheet backgrounds,
copies the native pixels into joint layers, and records source checksums in
`apps/client/src/art/reference-profiles.json`. A one-pixel overlap prevents
sampling seams. Hidden eye and shoulder paint covers the spaces exposed by
blinks and arm movements. The visible default art comes from the source pixels.

The existing rig still drives expressions, movement, attacks, tails, wings,
accessories and effects. The imported art keeps its original proportions;
side poses do not receive the front artwork's extra head/body scaling or default
arm rotations. Crops and static view boxes include the long reference tails.
Equipped skins use colour filters over the copied art, followed by the existing
patterns, equipment and Awakening accessories. Reduced motion remains supported.

Reference data has its own build chunk so each offline-cache entry stays below
the existing size limit. The reference sheets themselves are not deployed.

Checks cover every base part's crop, all 24 front/left/right rigs, 14 animation
states, rare and Mythical skins, removal of skins, and desktop/landscape-phone
town and practice. All 1,760 front/back comparisons remain identical.

Review the actual game rigs: [original looks](champion-side-views.png),
[stage III Mythical looks](champion-side-views-mythic.png).

The matching [back-view study](champion-back-views-study.png) is generated for
review only. It is not installed as runtime artwork.
