# Drawing a boss's head and face: the method, with templates

This is a recipe. Follow it top to bottom to give a 2.5D vector raid boss a
head and face that turn through the 8 facings without warping. It was worked
out on six bosses; Tidewyrm's head in `apps/client/src/boss-vector-tide.ts` is
the reference to copy from, and `demos/boss-faces/` holds a demo, a checker
and proof images for all six.

| File                                    | Use it for                                                        |
| --------------------------------------- | ----------------------------------------------------------------- |
| `apps/client/src/boss-vector-face.ts`   | the shared construction: `makeFace`, `headView`, `drawEye`        |
| `apps/client/src/boss-vector-tide.ts`   | a complete worked example in the game (search for `THE HEAD`)     |
| `demos/boss-faces/src/kit.js`           | the same construction in plain JS, for prototyping a boss quickly |
| `demos/boss-faces/src/<boss>-rig.js`    | five more worked examples (cat, whale, two birds, jellyfish)      |
| `demos/boss-faces/tools/check-face.cjs` | the rule checker                                                  |
| `demos/boss-faces/tools/shots.cjs`      | renders close-ups to look at                                      |

## The one idea

A head is a few **drawings**, one per view. A face is a set of small drawings
placed on the head by **construction lines**. Each frame only moves, turns,
mirrors and re-sorts those drawings. Nothing is ever redrawn per frame and
nothing is ever squeezed to fake a turn.

Rig units are world pixels. Screen = `(x, -y + z * 0.65)`. Yaw 0 faces the
camera, 90° faces screen right, 180° faces away. Head space is `u` across and
`v` down from the head's centre, worked out for a head turned to **screen
right** and mirrored for left turns.

## What goes wrong, and the rule that prevents it

| Failure                                                                    | Rule                                                                                                                                         |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| A front-view eye squeezed sideways: uneven lines, oval highlights          | Every feature has its own drawing for front, three-quarter (near and far) and side. Scale is 1 or -1 only.                                   |
| Eyes tilted along the curve of the head: near eye droops, far eye cocks up | Features turn with the head's roll only. The far eye adds one fixed lift (4° to 6°).                                                         |
| Features at different heights in different views                           | A feature's height is one number, its line, used in every view.                                                                              |
| Far eye outside the head                                                   | Clamp every feature inside the drawn outline of the current view by its own half-width.                                                      |
| Far eye crowding the near eye, or a pasted "bridge" patch                  | Order: near eye, a clear gap, the bridge, the far eye. The occluder is part of the creature (muzzle, snout, beak) or the head's own outline. |
| Eye shape unlike the painted character                                     | Look at the painted art first and copy its eye: shape, lid, iris, expression.                                                                |
| A head that is a ball with a face on it                                    | The head's outline is drawn per view from a profile function, so a muzzle or beak is part of the silhouette.                                 |
| A body of visible stacked balls                                            | Many closely spaced discs in one flat colour, one outline behind them all, light and shade laid over them all.                               |

## Step 1. Study the painted character

Open `apps/client/src/art/raid-whole-<boss>.webp`,
`raid-directions-<boss>.webp` and `raid-splash/<boss>*.webp`. Crop the head and
enlarge it. Write down, before any code:

- the head's shape from the front and in profile (how far the muzzle or beak
  stands out, where the chin is);
- the eye: round or almond, how the upper lid runs, iris colour, pupil shape,
  where the highlight sits;
- what sits on the centre line (gem, nose, mouth, beak) and at what height;
- what would hide the far eye's inner corner at three-quarter;
- the expressions: idle, attacking, startled, hurt, dizzy, defeated.

Measure positions as fractions of `A`, half the head's width. Then remove
clutter: keep the three or four things that make the character, and bake small
details (ear fins, cheek tufts, nostrils) into a drawing instead of adding
separate moving parts.

## Step 2. Write the construction

Copy this and fill in the numbers. All lengths are in units of `A`.

```ts
const A = 30; // half the head's width
const TOP = -0.9 * A,
  BOT = 0.84 * A;
const gauss = (x: number, s: number) => Math.exp(-(x * x) / (s * s));

/** The skull's roundness at height v: 1 at its widest, 0 at crown and chin. */
const se = (v: number) => {
  const t = clamp(Math.abs((v + 0.03 * A) / (0.87 * A)));
  const e = v > -0.03 * A ? 2 : 2.5; // a broad crown, a narrower jaw
  return Math.pow(1 - Math.pow(t, e), 1 / e);
};

/** THE CENTRE LINE: the profile. Skull, plus a bump for the muzzle or snout,
 *  minus a small dip (the stop) at the eye line. */
const centreLine = (v: number) =>
  0.9 * A * se(v) +
  0.56 * A * gauss(v - 0.4 * A, (v > 0.4 * A ? 0.3 : 0.2) * A) -
  0.04 * A * gauss(v - 0.02 * A, 0.12 * A);

/** The drawn outline of a view at height v: [left, right]. */
function skullEdge(view: FaceView, v: number): [number, number] {
  const w = 0.99 * A * se(v);
  if (view === "side") return [-A * se(v), centreLine(v)]; // the profile itself
  if (view === "tq")
    return [
      -w,
      Math.max(0.95 * A * se(v), centreLine(v) * TQ_SIN + snoutHalf(v)),
    ];
  return [-w, w]; // front and back
}
```

Starting values that have worked:

| Constant          | Range used                                              | Meaning                                                                                 |
| ----------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| eye line          | -0.06 A to +0.06 A                                      | a little off the head's middle                                                          |
| brow line         | 0.24 A to 0.36 A above the eye line                     |                                                                                         |
| nose or beak line | +0.27 A to +0.43 A                                      | the mouth hangs from the same point                                                     |
| `eyeAz`           | 30° to 50°                                              | how far round from the centre line an eye sits. Wide for eyes on the sides of the head. |
| `eyeOrbit`        | 0.62 A to 0.9 A                                         | radius of the circle the eyes ride. Front spacing is `eyeOrbit * sin(eyeAz)`.           |
| `lag`             | 10° to 14°                                              | the face trails the skull by this at 45°                                                |
| `farLift`         | 4° to 6°                                                | fixed lift of the far eye's outer corner                                                |
| `tuckCap`         | 0.35 to 0.4                                             | the most of the far eye the bridge may hide                                             |
| `margin`          | 0.045 A                                                 | clear space inside the outline                                                          |
| eye half-widths   | near = front; far = 0.6 to 0.7 of it; side = 0.8 to 0.9 | each is its own drawing; height stays the same                                          |

Check the numbers by hand at 45° before drawing anything. With
`faceYaw = 45° - lag`:

- near eye centre: `eyeOrbit * sin(faceYaw - eyeAz)`
- bridge: `centreLine(eyeLine) * sin(faceYaw)`
- far eye centre: `eyeOrbit * sin(faceYaw + eyeAz)`

You want: near eye's inner edge well left of the bridge (a gap of about one
eye half-width), the far eye's inner edge at or just behind the bridge, and
the far eye's outer edge inside `skullEdge("tq", eyeLine)[1] - margin`.

## Step 3. Give the spec to `makeFace`

```ts
export const SPEC = {
  A,
  top: TOP,
  bot: BOT,
  lines: { brow: -0.32 * A, eye: -0.06 * A, nose: 0.36 * A },
  eyeAz: 42 * DEG,
  eyeOrbit: 0.64 * A,
  lag: 14 * DEG,
  farLift: 6 * DEG,
  nod: 0.4 * A,
  margin: 0.045 * A,
  tuckCap: 0.4,
  bridgeHalf: 1,
  eye: {
    front: { hw: 7.4, hh: 7.2 },
    near: { hw: 7.4, hh: 7.2 },
    far: { hw: 5, hh: 7 },
    side: { hw: 6.4, hh: 7.2 },
  },
  centreLine,
  skullEdge,
  headPiece: (view) => `head-${view}`,
  eyePiece: (view, e) => `eye-${view}-${e.look}`,
  glint: (view, e) => ({ piece: "eye-glint", x: -2.4, y: -2.2 }), // never mirrored
  brow: (view, e) => ({ piece: `brow-${view}-${e.brow}`, dx: 0.5 }),
  centre: [
    // "mid" is drawn between the far and the near eye: this is the occluder
    {
      id: "muzzle",
      anchor: "nose",
      layer: "mid",
      piece: (v) => (v === "side" ? null : `muzzle-${v}`),
    },
    { id: "mouth", anchor: "nose", piece: (v, e) => `mouth-${v}-${e.mouth}` },
    {
      id: "nose",
      line: 0.36 * A,
      hw: { front: 9, tq: 6 },
      vspan: [0, 7],
      sideInset: 1,
      piece: (v) => `nose-${v}`,
    },
  ],
};
export const FACE = makeFace(SPEC);
```

Each frame:

```ts
const built = FACE.face(
  { x, y, z, yaw, pitch, roll, prevView }, // the head on screen
  { look: "glare", brow: "angry", mouth: "open" }, // the expression
);
for (const p of built.placements) show(p); // move, turn, mirror, sort
```

`makeFace` does the rest: it picks the view, places each feature, applies the
tuck cap and the clamp, mirrors for left turns, and returns the placements
back to front.

## Step 4. Draw the pieces, once

Draw at a scale of `k` pixels per unit into the atlas. One drawing per row of
this table, per look or kind:

| Piece                  | Front                                      | Three-quarter               | Side                | From behind                |
| ---------------------- | ------------------------------------------ | --------------------------- | ------------------- | -------------------------- |
| head                   | `head-front`                               | `head-tq`                   | `head-side`         | `head-backtq`, `head-back` |
| eye                    | `eye-front-*` (mirrored for the other eye) | `eye-near-*`, `eye-far-*`   | `eye-side-*`        | none                       |
| brow                   | `brow-front-*`                             | `brow-near-*`, `brow-far-*` | `brow-side-*`       | none                       |
| nose, mouth, gem, beak | `*-front`                                  | `*-tq`                      | `*-side`            | none                       |
| occluder               | optional soft pad                          | `muzzle-tq` or `beak-tq`    | part of `head-side` | none                       |
| highlight              | one `eye-glint`                            |                             |                     |                            |

**Head.** Build its outline from `skullEdge(view, v)` for `v` from `TOP` to
`BOT`, so the clamp is exact. Stroke, then fill with **one vertical
gradient**. Add fur tufts, fins or a crest as extra shapes in the same path.
Keep the face area clean: put scales, fur strokes and spots only outside an
ellipse round the eyes and muzzle.

**Eyes.** Use `drawEye`. It draws a round or almond eye cut by a lid that runs
from the outer corner down to the inner corner, with the inner corner at +x:

```ts
if (view === "far") c.scale(-1, 1);        // the far eye's inner corner is on the other side
drawEye(c, {
  hw, hh,                                  // this view's half-width and half-height
  look: "open",                            // or "closed", "dizzy"
  lid: [-0.66, -0.16],                     // outer y, inner y, in half-heights; omit for wide open
  sclera: ["#ffffff", "#f1fdff", "#bfe7ee"],
  iris: { x: 1 * way, y: 1.1, r: 4.5, stops: [...], ring: dark, slit: 1.35 },
  ink: line, weight: 2.1,
});
```

- Line weights are in rig units. A narrow far eye gets the same line as a wide
  near one because it is a different drawing, not a scaled one.
- The iris stays round in every view; only the white and the lid narrow.
- Push every iris the way the head faces, so both eyes look the same way.
- Looks to draw: idle, glare (lid lower, steeper), wide (no lid, smaller
  iris), hurt (`>`), dizzy (spiral), closed (a curve).

**The occluder at three-quarter.** Build it from `centreLine`, as seen at 45°:

```ts
const mid = (v) => (centreLine(v) - centreLine(NOSE)) * TQ_SIN; // the centre line, from the nose
const edge = (v) => mid(v) + halfThickness(v); // the bridge, then the muzzle's far side
```

Fill everything on the near side of that edge with **the head's own gradient**
(shifted by the nose line, so the colours match), opaque over the whole height
of the far eye. Then fade it out on the near side, above the brow and under
the lip (`destination-out` gradients). Stroke only the far edge. The far eye
is drawn before it and so slips behind it; the near eye is drawn after. If the
creature has a beak, the beak's base does this job and no extra piece is
needed. If it has neither, the head's own outline holds the far eye.

**Mouth.** Anchor it to the nose point so the two never drift apart. Draw the
front version from control points; for three-quarter, replot the same points
with the far half shortened (`x > 0 ? x * 0.5 : x * 1.15`). Replotting keeps
the stroke's weight; scaling the picture would not. Draw the profile version
separately.

**Highlight.** One piece for both eyes, placed last and never mirrored, so the
highlights sit on the same side of both eyes.

## Step 5. The body, briefly

- A limb, tail or neck is a chain of discs. Use many, closely spaced (a
  spacing of about a fifth of the radius), in **one flat colour**.
- Put every disc's outline behind every disc's fill (one sort bias for the
  whole chain). That leaves a single outline round the shape.
- Lay light and shade over the whole chain as soft blobs after the fills, not
  as a gradient inside each disc.
- A long flat part (wing, ear, fin) is one drawn piece laid along the line
  from its root to its tip. Never scale it below about two thirds of its
  length; a wing seen end-on is drawn broadside.

## Step 6. Check

1. `node demos/boss-faces/tools/check-face.cjs` (or the same checks as a unit
   test, as in `tests/unit/boss-vector-tide.test.ts`). It sweeps every half
   degree of yaw, the extremes of nod and roll, and every look and mouth, and
   fails if:
   - a piece is missing;
   - a face shows from behind;
   - an eye leaves the eye line or the outline;
   - anything is tilted other than the far eye by its fixed lift;
   - a highlight is mirrored;
   - the two eyes overlap;
   - the far eye is hidden beyond its cap at 45°.
2. Render close-ups at 0, 30, 45, 60, 90 and 315°, at three moments of the
   idle sway, and during each attack. **Look at them.** The checker cannot see
   an ugly drawing.
3. Render the model sheet (0/45/90/135/180°) with the eye line, the top of the
   head and the chin as dashed guides. The eye line must be one straight line
   across all the heads.

Then fix what looks wrong and render again. Expect three or four rounds.

## Checklist before calling a head done

- [ ] It reads as the species in every view, including from behind.
- [ ] 45°: near eye, clear gap, bridge, far eye; far eye narrower, lifted, its
      inner corner tucked.
- [ ] 315° is the mirror of 45°, with the highlights unmirrored.
- [ ] 90°: one eye; nose and mouth on the profile, inside the outline.
- [ ] The eye matches the painted character.
- [ ] Nothing pokes out of the head during the sway, a nod or an attack.
- [ ] Every expression is readable at game size (the head is 30 to 70 px wide).
- [ ] The checker and the game's tests pass.
