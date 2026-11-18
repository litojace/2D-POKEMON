# Avatar prompts: the next 52 library avatars

> **Outcome (19 Nov):** the owner kept 25 of the batch made from this
> page: Set 2's 001 to 025, with Set 1's front-facing Mystowl (032) as 006
> and Halcyra (038) as 012. 025 is the Storm Twins together. The rest
> left the library (`RETIRED_AVATARS` in `packages/shared/src/avatars.ts`
> shows each as its character's new avatar). The prompts stay here for
> the next batch.

The owner's brief (19 Nov): keep the anime look of the current Anime 2D set,
but redraw the library as two anime sets of the same 26 characters (the 18
champions and the 8 raid bosses):

- **Set 1 · Face to face** (`ea-avatar-027` … `052`, replaces Anime 2D):
  looking straight at you, each character with an expression of its own.
- **Set 2 · Angles** (`ea-avatar-001` … `026`, replaces Soft 3D): the same
  characters, each seen from a different angle.

The avatar ids stay the same, so every player keeps the avatar they chose:
it is just redrawn (no migration). The pictures are made in ChatGPT; this
page is what to paste. Once they are made: name each file after its id
(`ea-avatar-027.png` …), put them in one folder, and run

```bash
python3 scripts/import-avatars.py <folder> --check
```

then without `--check` to write them over
`apps/client/public/assets/avatars/`. The picker's two style names change in
`packages/shared/src/avatars.ts` at the same time (`AVATAR_STYLES`).

## How to make them in ChatGPT

1. Start a new chat. Paste the **style block** once.
2. For each avatar: attach the **reference** (the current anime avatar of
   that character, `apps/client/public/assets/avatars/<reference>.webp`) and
   paste its line. The reference keeps the character's design (colours,
   markings, accessories); the line changes its pose and expression.
3. Download it as `<id>.png`. If a picture drifts from the style, say "same
   style as the first ones, redo it" rather than starting over.

Make a few of Set 1 first and look at them together before making the
rest: it is cheaper to fix the style block than 52 pictures.

## Style block (paste once, at the start)

```text
You are making avatar portraits for a mobile game, Element Arena. Every
picture follows these rules exactly:

- Style: the same as the reference picture I attach each time. Cute 2D
  anime creature art: clean bold dark outlines, soft cel shading with gentle
  gradients, glossy oversized eyes with two white highlights, a soft rim
  light, saturated but not neon colours.
- Keep the character's design from its reference picture: body shape,
  colours, markings, accessories. Only the pose, the angle and the
  expression change.
- Square 1024 x 1024 picture. The character fills it as a head-and-
  shoulders portrait (a bust), centred. Everything that matters (eyes,
  mouth, ears, crest, accessory) is inside the middle 80% circle: the game
  cuts the picture to a circle and puts a frame around it.
- Background: a smooth radial gradient in the character's element colour,
  lighter in the middle, with a few soft sparkles at most. No scenery.
- No text, no letters, no numbers, no border, no frame, no circle drawn
  around it, no watermark, no signature.

Reply with the picture only. I will send one character at a time.
```

## Set 1 · Face to face (`ea-avatar-027` … `052`)

Paste: `Set 1, face to face: looking straight at the viewer, head and body
facing forward, symmetrical. ` and then the character's line.

| Save as       | Reference     | Character (element)                                                                            | Expression                                                                                    |
| ------------- | ------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| ea-avatar-027 | ea-avatar-027 | Voltkit, a sugar-glider kit that stores static in its antennae (Electric, yellow)              | A cheeky grin with one little fang, eyes bright, tiny sparks crackling off its antennae       |
| ea-avatar-028 | ea-avatar-028 | Cindrake, a stout magma newt with a living flame crest (Fire, orange-red)                      | A fierce, confident smirk, brows down, its flame crest flaring up                             |
| ea-avatar-029 | ea-avatar-029 | Tidefin, an axolotl duelist in a river sash (Water, teal)                                      | A playful wink with the tip of its tongue out                                                 |
| ea-avatar-030 | ea-avatar-030 | Auralynx, a crystal-fisted lynx monk (Aura, lavender blue)                                     | Calm and serene: eyes closed, a small knowing smile, as in meditation                         |
| ea-avatar-031 | ea-avatar-031 | Lumoth, a fluffy moth that sheds glowing dust (Light, mint green)                              | Wide-eyed wonder, a little round "oh!" mouth, glowing dust floating around                    |
| ea-avatar-032 | ea-avatar-032 | Mystowl, a floating three-eyed owl (Psychic, magenta)                                          | Mysterious: half-closed eyes, a faint smile, its third eye wide open and glowing              |
| ea-avatar-033 | ea-avatar-033 | Terradon, a sleepy boulder tortoise (Earth, brown)                                             | Drowsy: one eye half open, mid-yawn                                                           |
| ea-avatar-034 | ea-avatar-034 | Duskveil, a hooded lantern wisp (Shadow, violet)                                               | A spooky-playful "boo!" grin, eyes glowing under the hood                                     |
| ea-avatar-035 | ea-avatar-035 | Coilemur, a ring-tailed lemur whose tail is a living electromagnet (Electric, grey and yellow) | Determined: a gritted-teeth grin, ready to pounce                                             |
| ea-avatar-036 | ea-avatar-036 | Pyranda, a shy red panda with a flame at its tail's tip (Fire, red-orange)                     | Shy: blushing cheeks, a tiny nervous smile, paws held together under its chin                 |
| ea-avatar-037 | ea-avatar-037 | Glacelle, a floating sea angel from the ice shelf (Water, icy blue)                            | Cool and aloof: a small pout, a puff of frosty breath                                         |
| ea-avatar-038 | ea-avatar-038 | Halcyra, a kingfisher with a crystal beak (Aura, royal blue)                                   | Focused: narrowed eyes, sharp and steady, as if taking aim                                    |
| ea-avatar-039 | ea-avatar-039 | Sunbara, a capybara with a glowing yuzu on its head (Light, warm gold)                         | Blissful: eyes closed in a big content smile, rosy cheeks                                     |
| ea-avatar-040 | ea-avatar-040 | Astrabun, a moon rabbit with a mochi mallet (Psychic, lilac)                                   | Excited: a big open-mouthed laugh, ears straight up                                           |
| ea-avatar-041 | ea-avatar-041 | Wombolder, a wombat with a rump like a boulder (Earth, brown and stone grey)                   | Stubborn: a grumpy frown, puffed-out cheeks                                                   |
| ea-avatar-042 | ea-avatar-042 | Shadopus, a midnight octopus that vanishes in its own ink (Shadow, deep purple)                | Sly: a sideways smirk, one eye hidden behind its bandana                                      |
| ea-avatar-043 | ea-avatar-043 | Pangrove, a pangolin whose scales are living leaves (Nature, leaf green)                       | Cheerful: a wide toothy beam                                                                  |
| ea-avatar-044 | ea-avatar-044 | Mossloth, a three-toed sloth with a moss garden on its back (Nature, moss green)               | Dreamy: a slow, lazy, half-asleep smile                                                       |
| ea-avatar-045 | ea-avatar-045 | Cragmuff, a stone ram with curled horns (Earth, raid boss)                                     | Angry: a snort with puffs of steam from its nostrils                                          |
| ea-avatar-046 | ea-avatar-046 | Tidelotl, a giant axolotl with feathery gills (Water, raid boss)                               | Goofy surprise: jaw dropped, eyes wide                                                        |
| ea-avatar-047 | ea-avatar-047 | Inkpurr, a shadow cat with a crescent moon (Shadow, raid boss)                                 | Smug: a wide cat grin, half-lidded eyes                                                       |
| ea-avatar-048 | ea-avatar-048 | Snoozaku, a sleepy dream creature in a starry nightcap (Psychic, raid boss)                    | Fast asleep: eyes closed, a little snot bubble, a floating "z" drawn as a shape, not a letter |
| ea-avatar-049 | ea-avatar-049 | Prismell, a snail with a crystal heart shell (Light, raid boss)                                | Sparkling joy: star-shaped highlights in its eyes, the heart in its shell glowing             |
| ea-avatar-050 | ea-avatar-050 | Lumiwick, a living candle lantern with a flame on its head (Fire, raid boss)                   | Mischievous: a cackling laugh, its flame flickering high                                      |
| ea-avatar-051 | ea-avatar-051 | Fizz, a golden jelly, one of the Storm Twins (Electric, raid boss)                             | Giggling: eyes squeezed into happy crescents                                                  |
| ea-avatar-052 | ea-avatar-052 | Crackle, a blue storm-cloud jelly, the other Storm Twin (Electric, raid boss)                  | Scowling: a sulky glare, brows knitted                                                        |

## Set 2 · Angles (`ea-avatar-001` … `026`)

Paste: `Set 2, a different angle: keep the head and shoulders filling the
picture and inside the middle 80% circle. ` and then the character's line.
Each angle is used once, so the set reads as varied side by side.

| Save as       | Reference     | Character | Angle and pose                                                                                               |
| ------------- | ------------- | --------- | ------------------------------------------------------------------------------------------------------------ |
| ea-avatar-001 | ea-avatar-027 | Voltkit   | Three-quarter view from the left, gliding toward the viewer, membranes spread at the edges, a confident grin |
| ea-avatar-002 | ea-avatar-028 | Cindrake  | Low angle, looking down at the viewer with its crest blazing above, proud                                    |
| ea-avatar-003 | ea-avatar-029 | Tidefin   | Over-the-shoulder: seen from behind on the right, turning its head back to the viewer with a smile           |
| ea-avatar-004 | ea-avatar-030 | Auralynx  | Three-quarter view from the right, one crystal fist raised beside its face, steady eyes                      |
| ea-avatar-005 | ea-avatar-031 | Lumoth    | High angle: looking up at the viewer from below, wings open behind it, dust falling like snow                |
| ea-avatar-006 | ea-avatar-032 | Mystowl   | Head tilted almost sideways, the owl's curious tilt, third eye on the viewer                                 |
| ea-avatar-007 | ea-avatar-033 | Terradon  | Peeking out of its shell from the lower half of the picture, only head and shell rim showing                 |
| ea-avatar-008 | ea-avatar-034 | Duskveil  | Side profile facing left, holding its lantern up so its light falls on its face                              |
| ea-avatar-009 | ea-avatar-035 | Coilemur  | Upside down, hanging by its tail from the top of the picture, grinning                                       |
| ea-avatar-010 | ea-avatar-036 | Pyranda   | Curled in its tail, peeking at the viewer over the fluffy tail with the flame tip glowing                    |
| ea-avatar-011 | ea-avatar-037 | Glacelle  | Three-quarter view from below, floating, its fins trailing frost                                             |
| ea-avatar-012 | ea-avatar-038 | Halcyra   | Side profile facing right, beak pointed like an arrow, one eye on the viewer                                 |
| ea-avatar-013 | ea-avatar-039 | Sunbara   | Seen slightly from above, lying back in warm water, the yuzu on its head catching the light                  |
| ea-avatar-014 | ea-avatar-040 | Astrabun  | Mid-hop, tilted diagonally (a Dutch angle), mallet over its shoulder                                         |
| ea-avatar-015 | ea-avatar-041 | Wombolder | Three-quarter view from behind on the left, looking back over its boulder rump, smug                         |
| ea-avatar-016 | ea-avatar-042 | Shadopus  | Close-up leaning toward the viewer out of a cloud of ink, one tentacle raised                                |
| ea-avatar-017 | ea-avatar-043 | Pangrove  | Rolled half into a leafy ball, face peeking out at the viewer                                                |
| ea-avatar-018 | ea-avatar-044 | Mossloth  | Hanging upside down from a branch at the top, sleepy smile, moss trailing down                               |
| ea-avatar-019 | ea-avatar-045 | Cragmuff  | Low three-quarter view, head lowered to charge, horns forward                                                |
| ea-avatar-020 | ea-avatar-046 | Tidelotl  | Rising from water at the bottom of the picture, three-quarter view, droplets flying                          |
| ea-avatar-021 | ea-avatar-047 | Inkpurr   | Side profile facing left, sitting tall, tail curled into a crescent                                          |
| ea-avatar-022 | ea-avatar-048 | Snoozaku  | Floating on its back seen from above, nightcap trailing                                                      |
| ea-avatar-023 | ea-avatar-049 | Prismell  | Three-quarter view from the right, shell catching a rainbow of light                                         |
| ea-avatar-024 | ea-avatar-050 | Lumiwick  | High angle: looking up at the viewer, its flame leaning toward the camera                                    |
| ea-avatar-025 | ea-avatar-051 | Fizz      | Tilted happily to the left, bouncing, tendrils swaying                                                       |
| ea-avatar-026 | ea-avatar-052 | Crackle   | Tilted to the right, arms crossed with its curls, glaring sideways                                           |

## Checklist before importing

- 52 files, `ea-avatar-001` … `052`, one each.
- Every picture square (1024 × 1024 is best) with no text or frame in it.
- Side by side, each set reads as one style; no character's colours
  changed from its reference.
- The important parts are inside the middle circle (the game crops it).
