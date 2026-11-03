# Eight new champions (design handoff)

Eight original champions designed and balanced in simulation, not yet in the
game. This folder holds everything a fresh session needs to implement them.
Each kit borrows a proven mechanic idea from another game (credited in
`NEW_INSPIRATION`), with original names, looks and numbers.

| Champion  | Element  | Role             | Creature          | Signature mechanic                               |
| --------- | -------- | ---------------- | ----------------- | ------------------------------------------------ |
| Coilemur  | Electric | Grappler         | Ring-tailed lemur | Magnet Lash pulls the first enemy hit to it      |
| Pyranda   | Fire     | Artillery        | Red panda         | Lobbed chestnut mortars, Toasted combo           |
| Glacelle  | Water    | Frost controller | Sea angel         | Slows, then freezes: the only true Freeze        |
| Halcyra   | Aura     | Marksman         | Kingfisher        | Up to 50% more damage at long range (`farBonus`) |
| Sunbara   | Light    | Support          | Capybara          | Healing springs: full to allies, half to itself  |
| Astrabun  | Psychic  | Blink duelist    | Moon rabbit       | Moon Hop blink, Moonlit self combo               |
| Wombolder | Earth    | Charger          | Wombat            | Burrow Rush charge, extra damage into walls      |
| Shadopus  | Shadow   | Stealth assassin | Octopus           | Ink Cloud stealth, first hit out of it +40%      |

## Files

- `prototype/new-champions.ts`: kits (`NEW_CHARACTERS`), combos, rites and the
  game inspirations, in the same shape as `CHARACTERS` / `COMBOS` / `RITES`
  in `packages/shared/src/index.ts`. Health and basic intervals here are the
  demo values; apply `tuned-factors.json` (below) when implementing.
- `prototype/register.ts`: registers the eight in `CHARACTERS`, `COMBOS` and
  `RITES` at runtime, for the balance tools until they ship. The mechanics
  they use are real (see [Engine](#engine) below); this replaced the
  simulation-only `engine-patch.ts`.
- `prototype/art.js`: front-view art for all eight in the idiom of
  `apps/client/src/creature-design.ts` (200×190 canvas, palettes, layers).
  Side and back views, the rig and portraits still need to be made.
- `prototype/tuned-factors.json`: auto-tune factors from the sixteen-champion
  balance pass (health × f, basic interval ÷ √f, rounded to 5 ms):

| Champion  | Health    | Basic attack (ms) |
| --------- | --------- | ----------------- |
| Coilemur  | 135 → 140 | 370 → 365         |
| Pyranda   | 145 → 149 | 430 → 425         |
| Glacelle  | 149 → 153 | 330 → 325         |
| Halcyra   | 145 → 143 | 365               |
| Sunbara   | 189 → 188 | 335               |
| Astrabun  | 132 → 133 | 415               |
| Wombolder | 166 → 172 | 545 → 535         |
| Shadopus  | 129 → 127 | 305               |

These were tuned in a sixteen-champion pool with the original eight's
creature remodel and the attack speed fix (see
[creature-remodel.md](../creature-remodel.md)), where all sixteen averaged
48–52% (bot round robin, 40 games per pairing per difficulty). The original
eight were then re-tuned on their own for release, so when these ship, re-run
the auto-tune with all sixteen together (below).

## Balance tools

`scripts/balance/` runs bot round robins on the real server `Arena` (run from
the repository root):

```sh
# Win rates for the champions in FIGHTER_IDS, factors left alone
npx tsx scripts/balance/tune.ts 1 40
# Auto-tune: 6 rounds, factors averaged over the last 3
npx tsx scripts/balance/tune.ts 6 40
# Until the new eight ship: register them from prototype/
npx tsx scripts/balance/tune.ts 1 40 --prototype --start docs/new-champions/prototype/tuned-factors.json
```

A factor f scales health by f and divides the basic interval by √f (rounded
to 5 ms); skills are not touched. Each round writes `balance-out/round-N.json`
(gitignored) with the factors, Hard and Normal win rates and the next
factors, and the run ends with the health and interval the averaged factors
give. With 4 processes, 16 champions at 40 games take about 8 minutes per
round. Use 40 games or more: in a 4-game test, win rates moved 10 to 25
points between rounds while no factor changed by more than 5%.

## Known issues to address while implementing

- 2v2: Sunbara's ally healing makes its teams win about 60%; Shadopus (35%)
  and Coilemur (40%) struggle when two enemies cover each other.
- Some bot matchups are lopsided (Wombolder beats Shadopus about 90%).

## Engine

The six mechanics are real (`packages/shared/src/index.ts`,
`apps/server/src/simulation.ts`, `apps/server/src/bot.ts`; tests in
`tests/unit/new-mechanics.test.ts`):

| Mechanic      | Fields                  | How it works                                                                                                                                                                                                                                                                                                                    |
| ------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pull          | `knockback < 0`         | Drags the target toward the caster, stopping 6 px short of touching (never past). Works on hits and zone ticks (Electromagnet).                                                                                                                                                                                                 |
| Blink         | kind `blink`            | Teleports toward the aim, up to `range`, stopping before the first wall (`blinkLanding`). With `damage`, a burst of `radius` where it lands. A `burst` event marks the landing (`tx`, `ty`: where it left).                                                                                                                     |
| Rush          | kind `rush`, `wallSlam` | A dash of `range` at `speed`; the caster can't act meanwhile. The first enemy touched takes the hit (and everyone within `explosion` of it); the charge stops. If the knockback would drive the target into a wall: `wallSlam` × damage and twice the stun (`burst` event with `slam`). A stun, freeze or dash ends the charge. |
| Veil, ambush  | kind `veil`, `ambush`   | Stealth for `duration` plus haste for `statusDuration`. Casting or taking damage reveals; the first hit within 0.8 s of a cast out of stealth deals `ambush` × damage (`hit` event with `ambush`).                                                                                                                              |
| Healing zones | zone `heal`, `selfHeal` | Each tick heals the caster's team inside by `heal`, the caster by `selfHeal` × `heal` (`heal` events). A pure spring does nothing to enemies; one with a `status` still applies it.                                                                                                                                             |
| Far bonus     | `farBonus`              | Up to `farBonus` more damage the farther the target is (`farMultiplier`): none up close, all of it at the ability's `range`.                                                                                                                                                                                                    |

Bots score each kind with its own rule in `chooseSkill`, ported from the
prototype's scoring: rushes and blinks once the target is within 90% of their
reach, the veil when the target is in sight within 520 px, a following spring
in the thick of a fight and a still one when hurt and under pressure, and
marksman shots by their far bonus. Bots no longer step out of a teammate's
zone or a harmless enemy spring. `riteValue` counts a spring's healing, a
veil's ambush, pull strength, the expected far bonus and wall slam, and how
often a pure utility skill comes back, so bots take the rites that use them.

## What implementing them involves

1. Engine: done (above). Adding the champion IDs to `FIGHTER_IDS` /
   `CharacterId` comes with the champions.
2. Champions: front, side and back art on the rig, portraits and selection
   art (`scripts/export-fighters.ts`), effects and illustrated icons for 40
   skills, fighter select, raid champion tricks, docs.
3. Skins: each original champion has 7 shop skins (`supabase/migrations`,
   `packages/shared/src/shop.ts`, `apps/client/src/skins/`), so matching that
   is 56 skins with art, effects and a migration.
