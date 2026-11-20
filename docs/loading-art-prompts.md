# Loading-screen paintings: what to paste in ChatGPT

The owner's brief (20 Nov): the startup curtain's background is a
hand-painted picture, made in ChatGPT, of champions wearing **Legendary and
Mythical skins from the Shop** fighting in the game's PvP modes; the tip
stands on the right. Every start shows one of them at random, each with the
same chance (never the same one twice in a row). How the curtain uses them:
[loading-screens.md](loading-screens.md).

The scenes (which champions, which skins, which mode) are listed in
`apps/client/src/loading-art.ts` (`LOADING_SCENES`); the table below is the
same list. A scene starts showing once its painting is imported.

## How to make them

1. Make the reference pictures, one per skin, drawn by the game itself:

   ```bash
   PW_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node scripts/loading-art/export-references.mjs loading-art-references
   ```

   (`PW_CHROMIUM` only where Playwright's own Chromium isn't installed.)

2. Start a new chat in ChatGPT and paste the **style block** once.
3. For each scene: attach the reference pictures of its skins (listed in its
   row) and paste its line. The references keep every skin exactly as players
   buy it; the line sets the fight.
4. Look at it against the references before keeping it: same outfit, same
   colours, same props, same character. A skin drawn differently from the
   one in the Shop misleads buyers, so ask again ("the Storm Revenant's crown
   and gorget must match the reference") rather than keep a near miss.
5. Download it as `<scene id>.png` (`duel-storm-vs-forge.png` ...).
6. Import them:

   ```bash
   python3 scripts/import-loading-art.py <folder> --check
   python3 scripts/import-loading-art.py <folder>
   ```

   It checks each is landscape and at least 1536 px wide, makes it at most
   1920 px wide and 360 KB, and writes
   `apps/client/src/art/loading-art/startup-art-<id>.webp`. The game picks it
   up by itself; `npx vitest run tests/unit/loading-art.test.ts` checks
   every painting has its scene.

Make two or three first and look at them on the curtain before making the
rest (import them, open the game, set
`localStorage["ea-next-art"] = "<scene id>"` in the console and reload): it
is cheaper to fix the style block than eight paintings.

## Style block (paste once, at the start)

```text
You are painting loading-screen artwork for a mobile game, Element Arena:
cute elemental creatures battle in real time in an arena. Every picture
follows these rules exactly:

- Style: hand-painted fantasy illustration, rich painterly brushwork, warm
  cinematic light, deep colour, a sense of motion. The creatures keep the
  look of the reference pictures I attach: chibi proportions, big glossy
  eyes, clean shapes, their exact colours, outfits and props.
- Each creature wears exactly the outfit in its reference picture: do not
  add, remove or change pieces, colours, symbols or props.
- Landscape, 1536 x 1024. The action fills the LEFT 60% of the picture; the
  RIGHT 40% is calmer and darker (sky, arena wall, shadow) because the
  game's tips are shown there. Keep every creature, face and important
  effect inside the middle band (not in the top or bottom 15%), because phone
  screens cut the top and bottom.
- The setting is the game's arena: an elemental coliseum court of carved
  stone with glowing element runes, seen from slightly above.
- Elemental skill effects (lightning, fire, water, light, shadow, earth,
  nature, psychic, aura) match each creature's element and stay readable.
- No text, letters, numbers, logos, UI, health bars or watermarks anywhere.
- Original creatures only: they must not look like characters from any
  other game, film or brand.
```

## Scenes

Attach the references named in each row (from the folder made in step 1),
then paste the line.

| Scene id              | Mode         | References to attach                                                                                                 |
| --------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------- |
| `duel-storm-vs-forge` | 1v1          | `voltkit-stormcrown.png`, `cindrake-sunforged.png`                                                                   |
| `duel-corsairs`       | 1v1          | `voltkit-sky-pirates.png`, `tidefin-sky-pirates.png`                                                                 |
| `duel-vanguard`       | 1v1          | `terradon-nova-vanguard.png`, `glacelle-nova-vanguard.png`                                                           |
| `duel-eclipse`        | 1v1          | `duskveil-eclipse.png`, `lumoth-starweaver.png`                                                                      |
| `teams-hon-viet`      | 2v2          | `cindrake-hon-viet.png`, `voltkit-hon-viet.png`, `mossloth-hon-viet.png`, `lumoth-hon-viet.png`                      |
| `teams-stars-stripes` | 2v2          | `voltkit-stars-stripes.png`, `cindrake-stars-stripes.png`, `shadopus-stars-stripes.png`, `pyranda-stars-stripes.png` |
| `ffa-mythicals`       | Free-for-all | `duskveil-eclipse.png`, `halcyra-starfletch.png`, `auralynx-celestial-sage.png`, `terradon-world-shell.png`          |
| `ffa-sky-pirates`     | Free-for-all | `astrabun-sky-pirates.png`, `sunbara-sky-pirates.png`, `wombolder-sky-pirates.png`                                   |

**duel-storm-vs-forge**

```text
A 1v1 duel. Voltkit, an electric mouse in its Mythical skin "Storm
Revenant" (black steel crackling with violet lightning, a crown of bolts),
leaps in from the left hurling a violet lightning bolt. Cindrake, a fire
dragon in its Mythical skin "Hellforge" (black-iron horns, a crest of black
hellfire), answers with a wave of black-and-orange fire. The two attacks
clash in the middle of the left side in a burst of sparks.
```

**duel-corsairs**

```text
A 1v1 duel between two sky-pirate captains. Voltkit in its Legendary skin
"Storm Corsair" (tricorne and captain's coat) swings in on a rope with
lightning on its cutlass; Tidefin in its Legendary skin "Tide Admiral" fires
a water cannon blast back. Torn sails and rope float through the arena air.
```

**duel-vanguard**

```text
A 1v1 duel between two heroes in hero suits. Terradon in its Legendary skin
"Bulwark Grove" raises a wall of stone and roots; Glacelle in its Legendary
skin "Frost Weaver" spins a spiral of ice shards toward it. Dust and frost
mix where they meet.
```

**duel-eclipse**

```text
A 1v1 duel of light against shadow. Duskveil in its Mythical skin "Crimson
Sovereign" (horned black hood, crimson eyes, rune gorget) sends shadow hands
creeping across the floor; Lumoth in its Mythical skin "Fallen Lightbringer"
(tarnished armour, a crown of blades, a gold rune glow) answers with a beam
of golden light. Half the arena is in deep shadow, half in gold.
```

**teams-hon-viet**

```text
A 2v2 team battle at a festival night. Blue team: Cindrake in its Legendary
skin "Thánh Gióng" and Voltkit in its Legendary skin "Đèn Ông Sao". Red
team: Mossloth in its Legendary skin "Ông Đồ" and Lumoth in its Legendary
skin "Đèn Lồng Hội An". Each wears its Vietnamese heritage costume and props
exactly as in its reference, with glowing embroidery; lanterns hang over
the arena. The two teams charge each other with their elements.
```

**teams-stars-stripes**

```text
A 2v2 team battle under fireworks. Blue team: Voltkit in its Legendary skin
"Space Ranger" and Cindrake in its Legendary skin "Hot-Rod Racer". Red team:
Shadopus in its Legendary skin "Times Square DJ" and Pyranda in its
Legendary skin "Ace Pitcher". Each wears its costume exactly as in its
reference, with glowing pieces; fireworks burst over the arena wall.
```

**ffa-mythicals**

```text
A four-way free-for-all, everyone against everyone, each in a Mythical
skin: Duskveil "Crimson Sovereign", Halcyra "Nightfeather" (midnight
plumage, a crown of blades, a rune-lit monocle), Auralynx "Spectral Warden"
(night-blue plate, a crown of spectral blades over its gem) and Terradon
"Obsidian Bulwark" (ram horns, obsidian crystals, a spiked shell). They
face the middle from four sides, their attacks crossing at the centre.
```

**ffa-sky-pirates**

```text
A three-way free-for-all of sky pirates. Astrabun in its Legendary skin
"Moonsail Bosun", Sunbara in its Legendary skin "Sunset Skipper" and
Wombolder in its Legendary skin "Anchor Warden", each in its tricorne and
coat exactly as in its reference, scramble for a treasure chest in the
middle of the arena, attacks flying in every direction.
```

## Adding a scene

Add it to `LOADING_SCENES` (Legendary or Mythical skins only, from
`CHAMPION_SKINS`; the unit test checks), add its row and line here, export
the references again, make and import the painting.
