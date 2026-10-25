# Champion side-view redesign

All eight champions now have authored left/right anatomy, replacing the old
compressed front-facing torso and face. The approved concept direction is drawn
as layered SVG art in `apps/client/src/creature-profile.ts`, so the existing game
rig can still animate limbs, eyes, ears, tails, wings and accessories separately.

Each profile uses one properly positioned eye and a species-specific face edge:
short glider/newt/cat muzzles, an axolotl lip, a moth face, an owl beak, a tortoise
jaw, and a crescent hood opening for Duskveil. Turned bellies, overlapping far
limbs, folded moth wings, the tortoise shell, gills, gauntlets and the lantern
retain the roster's identities. Left-facing geometry is reflected per part before
proportions, skin masks and accessories; the whole animated character is never
flipped. The far shoulder sorts behind the torso in both complete SVGs and Phaser.
Side tails pivot at the rear hip, wings at the back, and the left blade's crop
follows Tidefin's facing.

The shared renderer supplies these profiles to battles, practice and town, as
well as any directional previews. Front/back artwork is unchanged. Existing
skin palettes, patterns, accessories, Awakening stages, expressions and reduced
motion remain in use. No server, database, gameplay values, hitboxes or timings
were changed.

Validation includes comparison of 1,760 front/back drawings against the previous
renderer; a pixel-bound check of every base side part against its texture crop;
live Phaser rigs for all eight champions in both directions across movement,
attacks, four skills, reactions, victory and wave; rare and stage III Mythical
skins and their removal; desktop and landscape-phone town/practice checks; and
unit tests for profile faces, expressions, equipment, skin stages and joint
symmetry.

Review the actual rendered game rigs: [original looks](champion-side-views.png),
[stage III Mythical looks](champion-side-views-mythic.png).
