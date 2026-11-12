# Raid boss face rigs: rule sheet

One face system, six bosses. Every piece is drawn once per phase; each frame
only moves, turns, mirrors and re-sorts pieces.

| File | What it is |
| --- | --- |
| `all-bosses.html` | every boss in one demo, with a boss switcher |
| `<boss>.html` | the same demo for one boss; opens from disk, no build step |
| `src/kit.js` | the shared face construction (`KIT.makeFace`) and drawing helpers |
| `src/<boss>-rig.js` | one boss: its construction, pose, body and pieces (pure functions) |
| `src/tide-rig.js` | Tidewyrm: a bundle of the game's own `apps/client/src/boss-vector-tide.ts` |
| `tools/check-face.cjs` | checks the rules over every yaw, nod, roll, look and mouth |
| `tools/make-proofs.py`, `tools/proofs-one.py <boss>` | render `proof/<boss>/` |
| `build.py`, `tools/build-tide.sh` | rebuild the `.html` files and the Tidewyrm bundle |

## Frames

- Rig units are world pixels. Screen = `(x, -y + z * 0.65)`.
- Yaw 0 faces the camera, 90° faces screen right, 180° faces away.
- A face is laid out in **head space**: `u` across, `v` down, from the head's
  centre. `A` is half the head's width and the unit of every constant.
- Everything is worked out for a head turned to **screen right** and mirrored
  for left turns.

## How a feature is placed (`KIT.makeFace(spec).face(head, expr)`)

1. **View.** Under 22.5° front, under 67.5° three-quarter, under 112.5° side,
   otherwise the head alone (no face from behind). An optional `prevView`
   holds a view until the yaw is 4° past a line, so a swaying head cannot
   flicker between two drawings.
2. **Face yaw.** `faceYaw = turn - lag * sin(2 * turn)`: the skull's yaw at
   0° and 90°, trailing it most at 45°.
3. **Height.** `v` is the feature's line, the same number in every view. A nod
   adds `pitch * nod` to all of them.
4. **Across.**
   - eyes: `u = eyeOrbit * sin(faceYaw -+ eyeAz)` (near eye -, far eye +);
   - centre-line features (gem, nose, mouth, beak, muzzle):
     `u = centreLine(v) * sin(faceYaw)`, where `centreLine` is the head's own
     profile. The side view draws that profile as its outline.
5. **Far eye.** It may hide at most `tuckCap` of its width behind the bridge.
6. **Containment.** Each feature is clamped to
   `skullEdge(view, v) +- (halfWidth + margin)`. Head pieces are drawn from the
   same `skullEdge`, so the test is exact for the drawn outline.
7. **Orientation.** A piece's rotation is the head's roll. The far eye and its
   brow add `farLift`. Nothing follows the curve of the head.
8. **Mirror.** Left turns flip `u`, the rotation offset and the x-scale. The
   front view is one drawing and never flips; the highlight is never mirrored.
9. **Draw order.** Head, far eye, the occluder (`layer: "mid"`), near eye, the
   other features, highlights.

Each view's eye is its own drawing at its own width (`KIT.drawEye`): a round
or almond eye cut by a lid that runs from the outer corner down to the inner.
Line weights are in rig units, so nothing is squeezed.

## The bosses

| Boss | A | eyeAz | eyeOrbit | lag | farLift | tuckCap | Occluder at three-quarter |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Gloomshade | 32 | 42° | 0.62 A | 14° | 6° | 40% | `muzzle_tq`: bridge and far whisker pad |
| Emberwing | 26 | 36° | 0.66 A | 12° | 6° | 35% | `beak_tq`: the beak's base |
| Prismatail | 17 | 40° | 0.70 A | 12° | 6° | 35% | `beak_tq`: the beak's base |
| Somnara | 66 | 50° | 0.90 A | 10° | 4° | none | the whale's own outline |
| Storm Twins | 40 | 30° | 0.80 A | 10° | 5° | none | the bell's own outline |
| Tidewyrm | 30 | 42° | 0.64 A | 14° | 6° | 40% | `muzzle-tq`: the bridge and far side of the snout |

| Boss | Lines (from the head's centre, down is +) | Eye half-widths: front / near / far / side |
| --- | --- | --- |
| Gloomshade | gem -0.50 A, brow -0.30 A, eye +0.06 A, nose +0.43 A | 8 / 8 / 5.6 / 6.6 |
| Emberwing | brow -0.30 A, eye -0.03 A, beak +0.30 A | 6.2 / 6.2 / 4.2 / 5.4 |
| Prismatail | brow -0.34 A, eye -0.06 A, beak +0.27 A | 4.6 / 4.6 / 3.1 / 4.4 |
| Somnara | eye -0.06 A, mouth +0.17 A | 5.6 / 8 / 3.3 / 8.4 |
| Storm Twins | eye +0.04 A, mouth +0.30 A | 6.6 / 6.6 / 4.3 / 3.6 |
| Tidewyrm | pearl -0.64 A, brow -0.32 A, eye -0.06 A, nose +0.36 A | 7.4 / 7.4 / 5 / 6.4 |

Notes per boss:

- **Gloomshade.** Round amber eyes under a thick slanted lid; gem, nose and
  mouth on the centre line. `muzzle_tq` is fur-coloured, opaque over the full
  height of the far eye, and fades into the face on the near side, so only its
  far edge shows. The ear on the camera's side lies over the back of the skull
  once the head has turned; otherwise both ears tuck behind the head.
- **Emberwing's wings.** One drawn wing (an arm and three rows of round, overlapping feathers), turned along the line from shoulder to tip and never scaled below two thirds of its length. Near profile the near wing lies over the body and the far wing takes the near wing's line, a little more raised, behind the body; at three-quarter the far wing leans out to its own side.
- **Emberwing, Prismatail.** The beak is anchored where the centre line meets
  the beak line and has a front, a three-quarter and a profile drawing, closed
  and open. At three-quarter it is drawn under the near eye and over the far
  eye. Prismatail's crown rides the top of the head.
- **Somnara.** The body behind the head is 18 closely spaced discs in one flat colour, with a single outline behind them all and the light, shade and (side-on) belly band laid over them all at once, so it reads as one smooth shape and never as separate balls. The front of the whale is the head. The eyes sit far round on
  its sides: two narrow eyes from the front, one full eye in profile, and a
  sliver held against the far outline at three-quarter. The mouth is one line
  round the head, replotted per view from the same control points.
- **Storm Twins.** The bell is the head and looks the same from every side, so
  one bell piece serves all views. Fizz and Crackle share the construction and
  have their own eye and mouth drawings.
- **Tidewyrm.** Changed in the game. Its head is redrawn after the painted
  sprite: a rounded head with a short snout, sleepy slit eyes, pink ear fins
  and the pearl on its brow, one drawing per view, with the face built by
  `apps/client/src/boss-vector-face.ts` (the kit, in TypeScript). The antlers,
  beard and long whiskers are gone; two short barbels remain as thin lines. A
  stranded head lying on its side still shows its dizzy or shut eye from
  behind, in profile.

The method, with templates for drawing another boss this way, is in
`docs/boss-face-drawing.md`.

## Expressions

Looks: `idle`, `glare`, `wide`, `hurt`, `dizzy`, `closed` (a blink uses
`closed`). Tidewyrm keeps its own: `glare`, `wide`, `squint`, `shut`, `dizzy`.
Mouths: `smile`, `open`, `o`, `grit`, `flat`; the birds have `closed` and
`open`. Each boss's `<boss>Pose(cue)` maps the battle's state to a look and a
mouth: glare on a windup, open on a cast, hurt, dizzy when staggered, wide
when exposed, closed when defeated.

## Porting a boss into the game

- `Piece` and `Placement` have the fields of `boss-vector-tide.ts`, so
  `packPieces`, `paintPieces` and the loop in `boss-vector-tide-rig.ts` apply.
  `Placement.face` and `Placement.actor` are extras the demo uses.
- `kit.js` becomes one shared TypeScript module; each `<boss>-rig.js` becomes
  `boss-vector-<boss>.ts`. They keep no state: the 8-facing turn and the
  remembered view (`prevView`) stay in the Phaser rig file.
- Prismatail's legs are thin lines (`{ line, color, width, z }`), drawn the
  way Tidewyrm's whiskers are.
- Glow placements (`glow: true`) go in the additive container.

## Checks

`node tools/check-face.cjs`: 977,280 placements, 0 failures. For each boss it
checks that every piece exists, that there is no face from behind, that eyes
stay on the eye line and inside the outline, that nothing is tilted except the
far eye by its fixed lift, that the highlight is never mirrored, that the two
eyes never overlap, and that the far eye keeps its `tuckCap` at 45°.

Tidewyrm's rules are in the repo's own tests
(`tests/unit/boss-vector-tide.test.ts`, `tests/visual/vector-tide.spec.ts`).
