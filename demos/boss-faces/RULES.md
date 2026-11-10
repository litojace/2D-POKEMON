# Gloomshade face rig: rule sheet

Code: `src/gloom-rig.js` (pure functions, no DOM). Demo: `gloomshade.html`.
Checks: `node tools/check-face.cjs`. Proof images: `proof/`.

## Frames and units

- Rig units are world pixels. Screen = `(x, -y + z * 0.65)`.
- Yaw 0 faces the camera, 90° faces screen right, 180° faces away (the same as `yawFor` in `boss-vector-grumble.ts`).
- The face is laid out in **head space**: `u` across, `v` down, origin at the head's centre. `A = 32` is the skull's half-width and the unit of every constant.
- Everything is worked out for a head turned to **screen right** (the canonical drawing) and mirrored for left turns.

## Constants (`GLOOM.FACE`)

| Name | Value | Meaning |
| --- | --- | --- |
| `gemLine` | −0.50 A | height of the brow gem |
| `browLine` | −0.30 A | height of the brows (an expression adds −2.4 to +2.6 units) |
| `eyeLine` | +0.06 A | the eye line |
| `noseLine` | +0.43 A | the nose; the mouth and muzzle are anchored to the same point |
| `eyeAz` | 42° | how far round from the centre line each eye sits |
| `eyeOrbit` | 0.62 A | radius of the circle the eyes ride |
| `lag` | 14° | how far the face trails the skull at three-quarter |
| `farLift` | 6° | fixed lift of the far eye's outer corner |
| `nod` | 0.45 A per radian | how far a nod slides the whole face |
| `margin` | 0.045 A | clear fur between a feature and the outline |
| eye half-widths | front 8, near 8, far 5.6, side 6.6 | half-height stays 8.6 (far 8.4) |
| iris radius | 5 (far 4.5, startled 3.8) | round in every view |

## How a feature's position is computed (`gloomFace`)

1. **View.** `|yaw| < 22.5°` front, `< 67.5°` three-quarter, `< 112.5°` side, otherwise no face (back three-quarter and back draw the head only).
2. **Face yaw.** `faceYaw = turn − lag × sin(2 × turn)`. It equals the skull's yaw at 0° and 90° and trails it by 14° at 45°.
3. **Height.** `v` is the feature's line. It is the same number in every view. A nod adds `pitch × nod` to all of them.
4. **Across.**
   - eyes: `u = eyeOrbit × sin(faceYaw ∓ eyeAz)` (near eye −, far eye +);
   - gem, nose, mouth, muzzle: `u = centreLine(v) × sin(faceYaw)`.
   `centreLine(v)` is the head's profile: forehead, the stop at the eye line, the short muzzle, the chin. The side view draws it as the outline, so centre-line features land exactly on the profile there.
5. **Containment.** `contain(view, u, halfWidth, vTop, vBottom)` clamps `u` to `skullEdge(view, v) ± (halfWidth + margin)`. The head pieces are drawn from the same `skullEdge`, so the test is exact for the drawn outline.
6. **Orientation.** Every piece's rotation is the head's roll. The far eye (and its brow) adds `farLift`. Nothing follows the curve of the head.
7. **Mirror.** For left turns `u`, the rotation offset and the piece's x-scale change sign. The highlight piece is never mirrored, so both eyes keep their highlight on the same side.

## Pieces per view

| Feature | Front | Three-quarter | Side |
| --- | --- | --- | --- |
| Head | `head_front` | `head_tq` | `head_side` (profile with muzzle) |
| Eyes | `eye_front_<look>` twice, one mirrored | `eye_near_<look>`, `eye_far_<look>` | `eye_side_<look>` |
| Brows | `brow_front_<kind>` twice | `brow_near_<kind>`, `brow_far_<kind>` | `brow_side_<kind>` |
| Gem | `gem_front` | `gem_tq` | `gem_side` (edge-on, on the profile) |
| Nose | `nose_front` | `nose_tq` | `nose_side` |
| Mouth | `mouth_front_<m>` | `mouth_tq_<m>` | `mouth_side_<m>` |
| Muzzle | `muzzle_front` (two whisker pads) | `muzzle_tq` (the occluder) | part of `head_side` |
| Back views | `head_backtq`, `head_back`, nothing else | | |

Looks: `idle`, `glare`, `wide`, `hurt`, `dizzy`, `closed` (a blink uses `closed`).
Brow kinds: `calm`, `angry`, `raised`, `pinch`. Mouths: `smile`, `open`, `o`, `grit`, `flat`.
Shared: `glint` (highlight), `glow_amber` (eye glow), `glow_gold` (gem, moon, core).

The eye is an ellipse cut by a thick, near-straight lid that slants down to the inner corner. Each view has its own ellipse width; line weights are in rig units, so no drawing is ever squeezed. The far eye is narrower in the white and the lid; its iris stays round.

## The occluder

`muzzle_tq` is built from `centreLine` as seen at 45°. Its far edge runs from above the brow, down the bridge, round the far whisker pad to the chin. It is filled with the same fur gradient as the head, is opaque over the full height of the far eye, and fades out on the near side and above the brow, so only its far edge is ever visible. That edge carries the one drawn line.

Draw order: head, far eye, far brow, muzzle, near eye, near brow, gem, mouth, nose, highlights.

At 45° the far eye's inner corner is tucked 1.5 units of its 11.2; the clear gap from the near eye to the bridge is 9.7 units. At 60° 6.8 units are tucked; at 30° the far eye stands 2.3 units clear of the bridge.

## Expressions by state (`gloomPose`)

| State | Eyes | Mouth |
| --- | --- | --- |
| idle | idle, blinks | smile |
| Shadow Lunge | glare | smile, then open on the cast |
| Grasping Hands | glare | open |
| Snuff | wide, then closed on the blow | o |
| Creeping Curse | glare, gem glows | smile |
| Split | wide | o |
| Moon Pulse | closed, then wide | smile, then open |
| phase roar | glare | open |
| hurt | hurt | grit |
| stagger | dizzy, head rolls | flat |
| exposed | wide | o |
| defeat | closed, head rolled | flat |

## Porting

- `Piece` and `Placement` have the fields of `boss-vector-tide.ts`, so `packPieces`, `paintPieces` and the loop in `boss-vector-tide-rig.ts` apply as they are. `Placement.face` is extra (the demo's head close-up uses it).
- `gloomPose(cue)`, `gloomPlacements(pose, yaw, phase)` and `gloomFace(head, expr)` keep no state. The 8-facing turn stays in the rig file (`nextFacing`, `turnToward`).
- Glow placements (`glow: true`) go in the additive container.
