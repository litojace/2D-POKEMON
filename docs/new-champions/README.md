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
```

A factor f scales health by f and divides the basic interval by √f (rounded
to 5 ms); skills are not touched. Each round writes `balance-out/round-N.json`
(gitignored) with the factors, Hard and Normal win rates and the next
factors, and the run ends with the health and interval the averaged factors
give. With 4 processes, 16 champions at 40 games take about 8 minutes per
round. Use 40 games or more: in a 4-game test, win rates moved 10 to 25
points between rounds while no factor changed by more than 5%.

## Shipped balance (sixteen champions)

When the eight shipped, the auto-tune ran with all sixteen together (six
rounds of 40 games per pairing per difficulty, factors averaged over the last
three) and its factors went to every champion, old and new. Win rates are the
average of Hard and Normal bots, sixteen champions, 1,200 matches each (before:
the original eight as on main plus the new eight at the values above; after:
the tuned numbers, a fresh round robin). Wombolder's Rump Bump knockback went
from 30 to 25 first, to keep melee basics within the game's limit.

| Champion  | Factor | Health    | Basic attack (ms) | Win rate before | After |
| --------- | ------ | --------- | ----------------- | --------------- | ----- |
| Voltkit   | ×1.020 | 153 → 156 | 275 → 270         | 46.3%           | 50.5% |
| Cindrake  | ×0.971 | 141 → 137 | 475 → 480         | 55.4%           | 51.4% |
| Tidefin   | ×1.029 | 146 → 150 | 245 → 240         | 44.9%           | 51.4% |
| Auralynx  | ×0.953 | 177 → 169 | 320 → 330         | 59.8%           | 50.2% |
| Lumoth    | ×1.001 | 140       | 305               | 49.9%           | 50.4% |
| Mystowl   | ×1.000 | 142       | 380               | 49.4%           | 49.8% |
| Terradon  | ×0.964 | 199 → 192 | 625 → 635         | 57.5%           | 49.0% |
| Duskveil  | ×1.043 | 139 → 145 | 365 → 355         | 42.5%           | 50.2% |
| Coilemur  | ×0.992 | 140 → 139 | 365               | 51.1%           | 52.4% |
| Pyranda   | ×1.004 | 149 → 150 | 425               | 49.1%           | 49.0% |
| Glacelle  | ×1.001 | 153       | 325               | 50.2%           | 51.1% |
| Halcyra   | ×0.998 | 143       | 365               | 50.6%           | 49.5% |
| Sunbara   | ×1.012 | 188 → 190 | 335               | 46.9%           | 47.1% |
| Astrabun  | ×0.996 | 133 → 132 | 415               | 51.5%           | 50.1% |
| Wombolder | ×1.005 | 172 → 173 | 535               | 48.0%           | 50.4% |
| Shadopus  | ×1.005 | 127 → 128 | 305               | 46.9%           | 47.2% |

All sixteen now win 47–52% in duels (before: 42–60%).

### 2v2

Random 2v2 teams (1,200 matches per difficulty, about 300 appearances per
champion each), with the tuned numbers:

| Team win rate | Champions                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| 55–63%        | Auralynx 62.8, Astrabun 62.8, Shadopus 60.0, Coilemur 59.1, Cindrake 57.8, Terradon 55.7, Wombolder 55.3 |
| 47–49%        | Glacelle 49.1, Sunbara 48.9, Pyranda 47.7                                                                |
| 32–44%        | Tidefin 43.7, Duskveil 42.6, Halcyra 42.0, Mystowl 40.7, Lumoth 38.2, Voltkit 32.5                       |

Sunbara's teams no longer win about 60% (its springs heal only Sunbara at
half rate, and bots no longer step out of a teammate's spring or an enemy's
harmless one). Shadopus and Coilemur went from weak to strong. The pattern is
champions with a melee basic beating ranged ones, and it is older than the new
eight: the original eight alone show it on main before these changes
(Auralynx 66%, Cindrake 63%, Terradon 62% down to Voltkit 38%) and after them
(61–63% down to 38%). Duel numbers are tuned and 2v2 uses the same ones, so
fixing it means a 2v2-specific change (bot spacing and focus, or the team-up
rules), not the kits.

## Known issues

- 2v2 favours melee basics (above).
- Bot win rates still split by difficulty for some champions: Cindrake (30%
  Hard, 73% Normal), Mystowl (69% / 31%), Duskveil (36% / 64%) and Pyranda
  (62% / 37%).

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

1. Engine: done (above).
2. Champions: done. Kits in `packages/shared/src/index.ts`; art in
   [fighter-assets.md](../fighter-assets.md); raid tricks in
   [raid-roster-design.md](../raid-roster-design.md) §6; migration 052 lets
   them be portraits and farmers (no farm perk yet). The list as planned: front, side and back art on the rig, portraits and selection
   art (`scripts/export-fighters.ts`), effects and illustrated icons for 40
   skills, fighter select, raid champion tricks, docs.
3. Skins: 48 of 56 done. Each has 3 Common, 2 Rare and 1 Epic
   (`packages/shared/src/shop.ts`, art in `apps/client/src/skins/skin-art.ts`,
   shop rows in migration 053; the catalog is in
   [raid-roster-design.md](../raid-roster-design.md) §10.6). Still to do: one
   Mythical each, with three Awakening stages.
