# Fighter assets and art status

## Current status

| Fighter   | In-game art                      | Status                     |
| --------- | -------------------------------- | -------------------------- |
| Pikachu   | Existing articulated vector rig  | Unchanged from before      |
| Charizard | Existing articulated vector rig  | Unchanged from before      |
| Greninja  | Existing articulated vector rig  | Unchanged from before      |
| Lucario   | Existing articulated vector rig  | Unchanged from before      |
| Eevee     | Generic slate placeholder figure | **Needs licensed artwork** |
| Mewtwo    | Generic slate placeholder figure | **Needs licensed artwork** |
| Snorlax   | Generic slate placeholder figure | **Needs licensed artwork** |
| Gengar    | Generic slate placeholder figure | **Needs licensed artwork** |

The placeholders are deliberately generic (same body for all four, element-coloured
eyes) and are labelled "PLACEHOLDER ART" on the selection screen and in the
animation studio. They still animate through the shared rig — walking legs, blinking,
casting poses, hover for Mewtwo and Gengar, tail wag for Eevee, heavy steps for
Snorlax — so the game is fully playable while artwork is outstanding.

Only add artwork you have the rights to use. Private or noncommercial distribution
does not by itself grant permission to use protected characters or art.

## Dropping in frame artwork

Each fighter has `apps/client/public/assets/fighters/<id>/animations.json`. Switch
`kind` from `layered` to `frames`, `sheet` or `atlas` (schema:
`apps/client/src/animation/asset-schema.ts`). The game, selection screen and
`/animation-preview.html` all pick it up through the same pipeline
(`apps/client/src/animation/pipeline.ts`) — no code changes needed.

Animation keys are `<state>-<direction>`. `idle-up`, `idle-down`, `idle-left` and
`idle-right` are required; any missing state falls back to idle for that direction.

### Frames needed per fighter

States (directions: `up`, `down`, `left`, `right` → 4 variants each):

| State     | Loop | Suggested frames | Notes                                     |
| --------- | ---- | ---------------- | ----------------------------------------- |
| `idle`    | yes  | 6–8              | Include breathing                         |
| `blink`   | no   | 2–3              | Plays briefly over idle                   |
| `walk`    | yes  | 8                | Visible leg movement                      |
| `run`     | yes  | 6–8              |                                           |
| `basic`   | no   | 4–6              | ~220 ms; must read at the attack interval |
| `skill0`  | no   | 6                | ~360 ms (Fire Breath: 1.2 s channel)      |
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

Recommended source size: 256×256 per frame with a transparent background, feet at
roughly 75% of the height (the sprite origin is `0.5, 0.75`). Pack into one atlas
per fighter to keep texture memory low on phones.

Also supply `portrait` and `selection` images (PNG or WebP, transparent) for the
character select screen.
