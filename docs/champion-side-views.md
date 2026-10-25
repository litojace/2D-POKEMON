# Illustrated champion views

All eight champions use the approved illustrations for their left, right and
back views. Left and right are separate drawings. Front artwork stays unchanged.
Source sheets are archived under `apps/client/art-source/side-views/` and
`back-views/`; the importers record their checksums in the runtime JSON.

The illustrated facings now animate as one continuous textured surface. The
existing rig still supplies the poses, but softly weighted shared vertices keep
the head, goggles, fins, torso and limbs connected. Independently moving raster
cutouts previously exposed unpainted gaps during motion. Auralynx's detached
crystal orbit remains separate so it can rotate freely. Eyes change expression
without compressing a rectangular cutout through the face. Canvas-only devices
use a complete illustrated frame with subtle breathing and the normal root poses.

Skins, Colours, Awakening accessories, auras and ability effects remain driven by
the existing appearance system. Rear views have no front-facing eyes. Asset
chunks are split to stay within the offline cache's entry limit.

`tests/visual/champion-animation.spec.ts` runs the real Phaser rigs for all eight
champions in left/right/back views, across fourteen animation states, rare and
stage III Mythical skins, and removal of skins. It checks finite geometry,
identical shared vertices, and that cutout images are hidden, in both WebGL and
Canvas. The client art tests cover the imported rear artwork and its expressions.

Actual game renderings: [all eight views](champion-joined-views.png),
[walking](champion-joined-walk.png), and
[Mythical outfits](champion-joined-mythic.png).
