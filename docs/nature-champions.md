# Nature champions: Pangrove and Mossloth

The ninth element, **Nature**, brings the roster to eighteen: two champions
per element again. Both are original creatures, and their kits are built on
mechanics no other champion has. A first version (November 2026) repeated
other champions' skills (a damage barrier like Wing Cloak and Tail Wrap, a
rush like Wombolder's, fans of shots and slow zones like half the roster), so
both were rebuilt around new mechanics, borrowing proven ideas from other
games but none of their characters.

| Champion | Role            | Creature                                        | What no one else does                                                                                        |
| -------- | --------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Pangrove | Armoured roller | Pangolin with living leaf scales and a sprout   | **Armour plates** it spends as blades; a **ball you steer**; a **grappling tongue**; a **pinball** off walls |
| Mossloth | Time gardener   | Three-toed sloth with a moss garden on its back | **Moss** that grows while it stands still; **seeds that grow**; a **time bubble**; **swapping places**       |

## Kits

Numbers are in `CHARACTERS` (`packages/shared/src/index.ts`); the tables
below are the shipped values.

**Pangrove** (melee) — health 164, speed 245

| Slot     | Move           | What it does                                                                                                                                                                                                                  | Idea from                                      |
| -------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Passive  | Armour Plates  | Three leaf plates. A hit of 10 or more breaks one and only 40% of it gets through; after 2.5 s without taking damage they grow back, one every 2 s                                                                            | armour charges in hero shooters                |
| Basic    | Scale Swipe    | 15 damage every 450 ms, 150 px                                                                                                                                                                                                |                                                |
| 1 (8 s)  | Tongue Grapple | The tongue shoots 480 px: the first enemy it reaches takes 14 and is slowed 1.2 s, and Pangrove zips to it (following it if it moves); a wall pulls Pangrove to the wall                                                      | grappling hooks (Zelda, hero shooters)         |
| 2 (9 s)  | Scale Shrapnel | A 69° fan of blades (6 damage each): 3, plus 3 for each plate it has. Every plate is spent                                                                                                                                    | spending defence for offence                   |
| 3 (11 s) | Curl & Roll    | A ball you steer for up to 3.5 s (cast again to uncurl). Speed builds on straight lines toward 540 px/s; turning and walls cost momentum; a ram deals 10 to 34 (the faster the harder) and bounces off. 30% less damage taken | rolling-ball heroes in MOBAs and hero shooters |
| Ultimate | Pinball        | After a 0.2 s tuck, launch at 950 px/s and ricochet off up to 4 walls, 12% faster after each; every enemy on each stretch takes 22. Half damage taken meanwhile                                                               | pinball and bank shots                         |

Combo **Latched**: Tongue Grapple latches Pangrove on; Scale Shrapnel within
2.5 s deals 35% more.

**Mossloth** (ranged) — health 170, speed 240

| Slot     | Move       | What it does                                                                                                                                                                                                   | Idea from                               |
| -------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Passive  | Moss       | Standing still grows moss: a stack every 0.5 s, up to 5. Each takes 5% off damage and heals 0.6 health a second; moving sheds a stack every 0.3 s                                                              | stationary "turret mode" heroes         |
| Basic    | Seed Spit  | 9 damage every 345 ms, 640 px                                                                                                                                                                                  |                                         |
| 1 (5 s)  | Seedling   | Plant a seed at the aim (over cover). It grows a stage every 1.5 s: sprout, bud, bloom. The first enemy to step on it sets it off for 9 / 17 / 26 damage and a 0.5 / 0.8 / 1.3 s root. Up to 3; jump over them | growing plant traps (Plants vs Zombies) |
| 2 (14 s) | Sloth Time | A 150 px bubble at the aim for 3 s: enemies inside, and their shots, move at 35% speed                                                                                                                         | time-dilation fields (Dota 2)           |
| 3 (12 s) | Lazy Swap  | Swap places with the enemy (not a raid boss) or own seedling nearest the aim, up to 600 px away; a swapped enemy is slowed 1 s. Nothing there: the cooldown comes back to 1.5 s                                | position swaps (Dota 2's Nether Swap)   |
| Ultimate | Overgrowth | After a 0.3 s wind-up, vines erupt in 230 px: 28 damage, Rooted 1.2 s. Every seedling blooms at full growth wherever it is, and the moss grows full                                                            |                                         |

Combo **Timelocked**: a seedling set off by an enemy with any harmful status
(in Sloth Time, slowed by a swap, rooted by another seedling) deals 40% more.

Each has six rites (four minor, two major) in `RITES`: Pangrove's majors are
Spiked Ball (rams root for 0.8 s) and Bank Shot (6 bounces); Mossloth's are
Deep Roots (seedlings root 50% longer) and Long Nap (Sloth Time 4.5 s).

## Mechanics

Engine changes are in `packages/shared/src/index.ts` (kinds, statuses,
`PLATES`, `MOSS`, `ROLL`, and the movement in `advanceMovement`),
`apps/server/src/simulation.ts` and `apps/server/src/bot.ts`; tests in
`tests/unit/nature-kits.test.ts`.

| Mechanic    | Where                          | How it works                                                                                                                                                                                                                                                     |
| ----------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plates      | `PLATES`, `Fighter.plates`     | Applied last in `Arena.damage`, to hits from an ability (burn ticks and the ring don't break plates). Any damage delays regrowth.                                                                                                                                |
| Moss        | `MOSS`, `Fighter.moss`         | "Still" is under 25 px/s, not dashing or rolling. Reduction applies in `Arena.damage`; the regeneration runs each tick.                                                                                                                                          |
| Roll        | kind `roll`, `Fighter.roll`    | Steering, speed build-up, turn and wall losses run in the shared `advanceMovement`, so the client predicts your roll. No attacks or dash while curled; casting it again uncurls (allowed on cooldown); the ultimate launches straight out of it. A stun ends it. |
| Pinball     | kind `pinball`                 | The flight is a dash; wall bounces (and the speed-up) run in `advanceMovement`, so they are predicted too. The server hits each enemy once per stretch between walls. A root or stun ends it.                                                                    |
| Grapple     | kind `grapple`                 | The tongue is traced like a beam; the zip is a dash steered each tick toward its goal (an enemy is followed) and stopped dead just short of it.                                                                                                                  |
| Shrapnel    | kind `shrapnel`                | `count × (1 + plates)` projectiles spread evenly over `fan` radians.                                                                                                                                                                                             |
| Seedlings   | kind `seedling`, `Zone.born`   | `seedStage` (shared) gives the stage from when it was planted, for the server and the client's drawing. A jumping enemy doesn't set it off.                                                                                                                      |
| Time bubble | kind `timewarp`, status `warp` | Enemies inside get `warp` (0.35× movement, dashes and rolls, in `advanceMovement`); enemy projectiles inside move 0.35× as far each tick.                                                                                                                        |
| Swap        | kind `swap`                    | Picks the enemy or own seedling nearest the aim within `radius`; swaps positions (a seedling moves to where Mossloth stood).                                                                                                                                     |

Bots: they use every new skill. The Mossloth bot plants itself and fires
when nothing threatens it and it isn't standing in a hostile zone (so its moss
grows, as a person playing it would), puts seedlings down part of the way
toward the opponent, and swaps the opponent onto its seedlings. Seedlings and
bubbles count as hostile ground for other bots, which path around them.

## Everything else

- **Art**: the curled-up ball pose (`AnimationPose.ball`: the rig hides and
  a ball of leaf plates spins as it travels), new battle effects
  (`skill-fx-nature.ts`), eight illustrated skill icons (`skill-art.ts`), aim
  previews for the new kinds (`skill-preview.ts`), plate and moss pips under
  each fighter, and each passive explained on the roster's overview.
- **Raid tricks** (three each, `RAID_BOSS_PERKS`): curled up, Pangrove shrugs
  off Grumblecrag's Rock Volley and the Storm Twins' Polarity; its Tongue
  Grapple staggers a stranded Tidewyrm. A Mossloth seedling going off keeps a
  stranded Tidewyrm there 1 s longer, Overgrowth smothers Emberwing's fires,
  and allies in Sloth Time stay awake against Somnara. See
  [raid-roster-design.md](raid-roster-design.md) §6.
- **Shop, farm and database**: unchanged by the rebuild (eight skins each,
  Pangrove farms with Night Stalker and Mossloth with Early Sun; migrations
  [070](../supabase/migrations/070_eighteen_champions.sql) and
  [071](../supabase/migrations/071_nature_void_knights_and_cyber.sql)). No new
  migration: the kits live in code.

## Balance

Measured with the bot tools in `scripts/balance/` (Hard and Normal bots);
`--only <ids>` on `tune.ts` and `tune-teams.ts` (and `RR_ONLY` in
`round-robin.ts`) plays only the pairings or line-ups with these two.

**First draft → shipped kit.** The first draft lost most duels (Hard bots:
Pangrove 18.6%, Mossloth 14.7%). `duel-diag.ts` showed why: Scale Shrapnel's
120° fan landed about one blade per cast, plates broke on 6-damage chip shots,
and the Mossloth bot never stood still, so its moss never grew. Changes: a
69° fan, plates that only take hits of 10 or more and stop 60% of them, the
bot rule above (and its fix: not while standing in an enemy's zone, which had
left it at 8% against Pyranda's mortars), and numbers (Pangrove health 164,
Scale Swipe 15, Tongue Grapple 14 with a 1.2 s slow; Mossloth health 170,
Seed Spit 9 every 345 ms, seedlings 9 / 17 / 26, Overgrowth 28). Normal bots'
dazed share (`dazeBy`) was then calibrated so each does about as well against
Normal bots as against Hard ones: Pangrove 0.39, Mossloth 0.485.

**Duels** (40 games per pairing per difficulty, 680 duels each per
difficulty; the other sixteen run 46.5–53.1%). Seedlings landing over cover
and the last health changes moved Pangrove more than seed noise, so it was
checked on four unused seed sets in turn; the shipped kit is the last row.

| Seeds (`RR_SEED`) | Pangrove health | Pangrove Hard / Normal | Mossloth Hard / Normal |
| ----------------- | --------------- | ---------------------- | ---------------------- |
| 61000             | 164 (\*)        | 52.2% / 56.2%          | 52.4% / 53.4%          |
| 62000             | 161             | 44.7% / 50.9%          | 50.4% / 50.3%          |
| 63000             | 166             | 54.4% / 55.3%          | 52.8% / 49.6%          |
| 64000             | **164**         | **48.4% / 54.6%**      | **53.5% / 51.0%**      |

(\*) Before seedlings landed over cover. One seed set swings a champion by
about ±3 points, so 164 sits between the 161 and 166 results.

**2v2** (`TEAM_TUNING`, fair is 50%): three rounds of 2,000 random line-ups per
difficulty, fresh each round (Pangrove 50.8 → 52.8 → 47.5%, Mossloth 46.7 →
50.1 → 49.7% as the factors moved). Shipped Pangrove ×0.98, Mossloth ×1.035;
on unused line-ups (1,500 per difficulty) Pangrove 51.4% Hard / 50.0% Normal,
Mossloth 57.6% / 44.9% (51.3% averaged).

**Free-for-all, four players** (`FFA_TUNING`, fair is 25%): two rounds of
1,000 per difficulty (at ×1: Pangrove 21.5%, Mossloth 32.1%), interpolated
to Pangrove ×1.02, Mossloth ×0.94; on unused line-ups (1,200 per difficulty)
Pangrove 24.2% and Mossloth 23.7% averaged.

**Free-for-all, three players** (`FFA_THREE_TUNING`, fair is 33.3%): single
rounds are noisy here (Pangrove 25–32% and Mossloth 34–38% over three rounds
near ×1), but always off the same way. Shipped Pangrove ×1.07, Mossloth
×0.95; on unused line-ups (1,500 per difficulty) Pangrove 34.4% and Mossloth
33.1% averaged.

The team and free-for-all checks ran before Pangrove's final health: at 161
(2v2, four players) and 166 (three players) instead of 164, about a point
either way, within their noise.

**Known issues**

- Matchups are more polarised than the average suggests: Mossloth beats
  brawlers that must walk through its seedlings (Wombolder, Coilemur ~85–95%)
  and struggles against zone artillery (Pyranda) and Duskveil; Pangrove beats
  marksmen it can grapple onto (Halcyra, Pyranda) and struggles against
  Auralynx's counter.
- Bots avoid seedlings perfectly (they treat them as hostile ground), so
  seedlings deal little damage in bot matches; against people they will go off
  more, which bot balance can't measure.
- Raids use the champions' own health; the raid tricks are tested
  (`tests/unit/raid-champion-tricks.test.ts`) but raids were not re-measured.
