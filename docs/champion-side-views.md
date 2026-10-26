# Articulated champion views

All eight champions have complete left, right and rear anatomy drawn in the
same SVG style as their front view. The approved reference sheets remain as
visual references under `apps/client/art-source/side-views/` and `back-views/`.
Terradon now has a low tortoise dome, a projecting neck and four short legs in
every view. Game properties and hitboxes are unchanged.

Each facing contains thirteen independently rendered parts: torso, head, eyes,
near ears/gills, far ears, left/right arms, left/right legs, wings/shell, tail/lantern,
scarf/collar and crest/headwear. Empty anatomical slots remain empty. Heads,
limbs and accessories are full drawings, including the hidden areas beneath
neighbouring parts, rather than fragments cropped out of a complete painting.

`creature-profile.ts` authors the anatomy, joint pivots, draw order and particle
landmarks. It includes neck and shoulder underpainting and hip/tail overlap.
The far shoulder sits behind the torso and the far ear behind the head. Near
ear interiors remain visible; Cindrake’s crest sits behind its ears. Side
views retain a three-quarter chest and two paws. Terradon’s rounded shell
follows the torso rigidly; the rear shell covers the back. Right-hand views mirror the authored left anatomy,
with lighting compensated so the key light remains on the same screen side.

The Phaser rig uses the same individual sprites in WebGL and Canvas. Correct
neck, shoulder and hip pivots allow each limb to rotate; the torso carries its
attached parts. Local poses reset every frame to prevent accumulated drift.
Goggles, headbands and forehead gems stay attached to the head. Animated sparks
follow the transformed tail, crest or wings, rather than a fixed front-view
coordinate. Auralynx's crystal orbit stays independent. Its tucked paws and gentle hover
match the levitating menu pose in every direction; its muzzle has no white patch.
Lumoth hovers with a shorter bob and fluttering wings; it no longer steps.
Side cheeks retain each front view’s blush (including Mystowl’s deeper pink),
positioned behind the near eye. Far ears retain their full height and crystal
tips, with depth shown through overlap and a narrower silhouette.

Side heads are 8% wider with their eyes, ears, markings and accessories. The
texture bounds and particle landmarks follow the same transform. Duskveil's
side/rear lantern uses the front view's radial glow and bright core.

Duskveil uses approved option A: the round dark face is inset into the hood
and its eye, expressions and smile move together. The purple hood silhouette,
front/rear faces, hovering pose and lantern are preserved.

The former raster cutout JSON, whole-illustration deformation mesh and import
pipeline have been retired. No flattened body frame is used for animation.
Skins, Colours, Awakening stages and existing ability effects still apply to
their respective parts, and rear views have no front-facing eyes.

## Review

- [All eight: front, left, right and rear](champion-articulated-views.webp).
- [Duskveil's selected option A in all four views](duskveil-selected-a.webp).
- [Side head width: 100% versus 108%](champion-head-width-comparison.webp).
- [Terradon's tortoise anatomy and Duskveil's lantern](terradon-duskveil-review.webp).
- [Auralynx: clean muzzle and all four angles](auralynx-profile-review.webp).
- [Auralynx hovering above a fixed ground shadow](auralynx-hover.gif).
- [Lumoth hovering with fluttering wings](lumoth-hover.gif).
- [Voltkit, Cindrake, Tidefin and Auralynx in motion](champion-articulated-first-four.gif).
- [Lumoth, Mystowl, Terradon and Duskveil in motion](champion-articulated-last-four.gif).
- [Mythical outfits](champion-articulated-mythical.webp).

GIF columns are left / right / rear; each clip cycles through running,
casting and basic attacks using the actual game renderer.

The visual tests sample the actual texture alpha at neck, shoulder, hip and
tail joints to verify both the part and the torso contain painted overlap.
They run all 24 facings through fourteen states at five phases, validate
finite sprite transforms and no positional drift, and exercise rare and
stage III Mythical skins in WebGL and Canvas. Client art tests also check
expressions, palette/skin application, occlusion and symmetric side pivots.
