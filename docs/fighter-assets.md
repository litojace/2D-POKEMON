# Fighter assets

## Current roster art

| Fighter  | Element  | Design                                                                  |
| -------- | -------- | ----------------------------------------------------------------------- |
| Voltkit  | Electric | Sugar-glider kit; spark-tipped antennae, glider membranes, striped tail |
| Cindrake | Fire     | Magma newt; living flame crest, horn nubs, glowing cracks, ember tail   |
| Tidefin  | Water    | Axolotl duelist; gill fronds, headband, river sash, finned tail         |
| Auralynx | Aura     | Lynx monk; tufted ears, cheek ruff, crystal gauntlets, orbiting shards  |
| Lumoth   | Light    | Fluffy moth; fern antennae, star-dusted wings, white ruff               |
| Mystowl  | Psychic  | Floating owl; feather tufts, facial disc, third-eye gem, wing cloak     |
| Terradon | Earth    | Boulder tortoise; mossy rock shell, sleepy lids, sprout                 |
| Duskveil | Shadow   | Hooded lantern wisp; void face, ragged robe, lantern tail               |

All eight are original designs drawn in `apps/client/src/creature-design.ts` as
separately animated layers (head, ears, eyes, crest, arms, legs, body, tail,
wings, accessory) with front, back and side views. The shared rig
(`apps/client/src/animation/rig.ts`) animates them: walking legs, blinking,
casting poses, hover for Mystowl and Duskveil, wing flutter for Lumoth, heavy
steps for Terradon, orbiting shards for Auralynx.

`portrait.svg` and `selection.svg` in each fighter folder are exported from the
same designs (`npx tsx scripts/export-fighters.ts`).

### Cute style and trait auras

The roster uses chibi proportions: `PROPORTIONS` in `creature-design.ts` scales
the face parts (head, ears, eyes, crest) up from just above the chin and the
body and limbs down toward the feet. The scale is baked into every part, and
`animation/assets.ts` maps each part's crop box and pivot through the same
transform (`proportioned()`), so author new art in the original 200x190 space
and the rig stays attached. Faces share big sparkly eyes, small `:3` mouths and
blush (Duskveil keeps its void face with round glowing eyes).

Each fighter also has a trait aura built from its element:

- **Menus** (`trait-effects.ts`): the selected roster card, the detail portrait
  and the pre-match "How to play" card show an animated SVG aura (orbiting
  sparks, flame wall, water ring, hex barrier, sunburst, mind waves, boulders,
  spirit flames). With reduced motion it renders as a still frame.
- **Battle** (`battle-aura.ts`): a small ground effect at each fighter's feet,
  drawn with plain Phaser Graphics every frame (no filters). It is skipped with
  reduced motion and hidden for an opponent in stealth.

## Replacing a creature with frame artwork

Each fighter has `apps/client/public/assets/fighters/<id>/animations.json`. Switch
`kind` from `layered` to `frames`, `sheet` or `atlas` (schema:
`apps/client/src/animation/asset-schema.ts`). The game, selection screen and
`/animation-preview.html` all pick it up through the same pipeline
(`apps/client/src/animation/pipeline.ts`) — no code changes needed. Only use
artwork you have the rights to.

Animation keys are `<state>-<direction>`. `idle-up`, `idle-down`, `idle-left` and
`idle-right` are required; any missing state falls back to idle for that direction.

| State     | Loop | Suggested frames | Notes                                     |
| --------- | ---- | ---------------- | ----------------------------------------- |
| `idle`    | yes  | 6–8              | Include breathing                         |
| `blink`   | no   | 2–3              | Plays briefly over idle                   |
| `walk`    | yes  | 8                | Visible leg movement                      |
| `run`     | yes  | 6–8              |                                           |
| `basic`   | no   | 4–6              | ~220 ms; must read at the attack interval |
| `skill0`  | no   | 6                | ~360 ms (Ember Gust: 1.2 s channel)       |
| `skill1`  | no   | 6                | ~360 ms                                   |
| `skill2`  | no   | 6                | ~360 ms                                   |
| `skill3`  | no   | 8                | ~650 ms; also used for wind-ups           |
| `dash`    | no   | 3–4              | 180 ms                                    |
| `jump`    | no   | 6                | 650 ms airborne                           |
| `land`    | no   | 3                | 130 ms                                    |
| `hurt`    | no   | 3                | 160 ms                                    |
| `defeat`  | no   | 6                | Holds last frame                          |
| `victory` | no   | 12–16            | Up to 1.8 s                               |
| `wave`    | no   | 10–12            | Arm visibly waving                        |

Recommended source size: 256×256 per frame, transparent background, feet at
roughly 75% of the height (sprite origin `0.5, 0.75`). Pack one atlas per fighter
to keep texture memory low on phones.
