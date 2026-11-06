# Fighter assets

## Current roster art

| Fighter   | Element  | Design                                                                                   |
| --------- | -------- | ---------------------------------------------------------------------------------------- |
| Voltkit   | Electric | Sugar-glider kit; spark-tipped antennae, glider membranes, striped tail                  |
| Cindrake  | Fire     | Magma newt; living flame crest, horn nubs, glowing cracks, ember tail                    |
| Tidefin   | Water    | Axolotl duelist; gill fronds, headband, river sash, finned tail                          |
| Auralynx  | Aura     | Lynx monk; tufted ears, cheek ruff, crystal gauntlets, orbiting shards                   |
| Lumoth    | Light    | Fluffy moth; fern antennae, star-dusted wings, white ruff                                |
| Mystowl   | Psychic  | Floating owl; feather tufts, facial disc, third-eye gem, wing cloak                      |
| Terradon  | Earth    | Boulder tortoise; mossy rock shell, sleepy lids, sprout                                  |
| Duskveil  | Shadow   | Hooded lantern wisp; void face, ragged robe, lantern tail                                |
| Coilemur  | Electric | Ring-tailed lemur; white face mask, copper-banded magnet tail, coil bracers, magnet clip |
| Pyranda   | Fire     | Red panda; white-rimmed ears, flame-tipped fluffy tail, chestnut bandolier               |
| Glacelle  | Water    | Sea angel; translucent floating body, glowing heart, frosted wing-flaps, ice horns       |
| Halcyra   | Aura     | Kingfisher; swept crest, long crystal beak, orange chest, focusing visor                 |
| Sunbara   | Light    | Capybara; boxy muzzle, glowing yuzu on its head, striped bath towel                      |
| Astrabun  | Psychic  | Moon rabbit; tall ears (one folded), crescent mark, mochi mallet, cotton tail            |
| Wombolder | Earth    | Wombat; broad nose, boulder-hard rump plate with moss, digging claws, pebble pouch       |
| Shadopus  | Shadow   | Midnight octopus; glowing-spotted mantle, ink bandit mask, tentacles                     |
| Pangrove  | Nature   | Pangolin; living leaf scales (cap, back and a curling tail), sap-gold nose, crown sprout  |
| Mossloth  | Nature   | Three-toed sloth; dark eye stripes, moss garden with flowers on its back and crown, claws |

All eighteen are original designs drawn in `apps/client/src/creature-design.ts` as
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
and the rig stays attached.

Every champion has its own face, so they read apart at a glance and not only by
colour. `EYE_STYLE` in `creature-design.ts` picks the eye shape and the `MOUTHS`
table the mouth; cheeks vary too. The side views reuse the same eye and a
matching mouth (`grin()` in `creature-profile.ts`).

| Fighter   | Personality | Face                                                                |
| --------- | ----------- | ------------------------------------------------------------------- |
| Voltkit   | Hyper       | Star-shaped catchlights, open grin with a tongue                    |
| Cindrake  | Cocky       | Lids tipped toward the nose, ember glint, fang smirk, blush slashes |
| Tidefin   | Chill       | Round eyes with a water-drop catchlight, wide smile, pink blush     |
| Auralynx  | Calm        | Diamond-shaped crystal catchlights, cat nose and `ω` mouth          |
| Lumoth    | Dreamy      | Dewy eyes with lashes and a lower shine, tiny `o` mouth             |
| Mystowl   | Mystic      | Concentric ring eyes over its beak                                  |
| Terradon  | Sleepy      | Drowsy half-lowered lids, soft smile, two pink cheeks               |
| Duskveil  | Spooky      | Void face with round glowing eyes                                   |
| Coilemur  | Cheeky      | A sideways glance (`glance`), dark eye patches, tongue out          |
| Pyranda   | Shy         | Eyes cast down (`shy`), wavy mouth, flushed cheeks and a sweat drop |
| Glacelle  | Serene      | Frosted lashes and an ice-diamond glint (`frost`), tiny smile       |
| Halcyra   | Focused     | A level brow over round eyes (`keen`); its beak is its mouth        |
| Sunbara   | Blissful    | Closed, contented eyes curved like 😌 (`content`), capybara muzzle  |
| Astrabun  | Starry      | Star-shaped pupils (`star`), rabbit nose and buck teeth             |
| Wombolder | Stubborn    | Small beady eyes under a heavy brow (`bead`), big wombat nose       |
| Shadopus  | Sly         | Half-lidded glowing eyes behind an ink mask (no blush)              |
| Pangrove  | Hungry      | Leaf-shaped catchlights (`leaf`), pointed snout with a pink tongue  |
| Mossloth  | Unhurried   | Flat lids at half mast (`lazy`) inside dark sloth eye stripes       |

The happy, hurt and dizzy moods still use the shared expression shapes, the
focus mood adds a brow over each champion's own eye (in side views it slopes
toward the snout, since those are drawn facing left), and blinking squashes the
eyes texture as before. Keep new eye details inside the eyes crop box
(`animation/assets.ts`: x 52–148, y 68–112 in the 200x190 space).

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
| `skill0`  | no   | 6                | ~360 ms (Crest Flare: 1.2 s channel)      |
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

## The newer eight (side and back views, rig)

Coilemur, Pyranda, Glacelle, Halcyra, Sunbara, Astrabun, Wombolder and
Shadopus started from the front-view prototypes in
`docs/new-champions/prototype/art.js`. Their side and rear anatomy is in
`creature-profile.ts` like the originals'. A few parts reach past the usual
crop boxes (`frontPartBounds` / `profilePartBounds`): Halcyra's beak hangs over
its chest and Astrabun's mallet rises past its paw. Glacelle's translucent body
skips the hidden neck and shoulder underpainting, which would show through.
In the rig, Glacelle floats (like Mystowl), Wombolder steps heavily (like
Terradon, its rump plate following the torso), Shadopus's tentacles sway, and
each has its own greeting and victory pose. Menu trait auras are in
`trait-effects.ts`.
