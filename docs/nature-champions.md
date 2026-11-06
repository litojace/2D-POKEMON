# Nature champions: Pangrove and Mossloth

The ninth element, **Nature**, brings the roster to eighteen: two champions
per element again. Both are original creatures with original kits; each adds
something the other sixteen don't have.

| Champion | Role            | Creature                                                   | Signature mechanic                                                               |
| -------- | --------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Pangrove | Drain bruiser   | Pangolin with living leaf scales and a sprout on its crown | **Life drain**: Sap Bite and Thornwheel heal it for part of the damage they deal |
| Mossloth | Root controller | Three-toed sloth with a moss garden on its back            | **Rooted**: Rootsnare and Wild Roots pin enemies in place                        |

## Kits

Numbers are in `CHARACTERS` (`packages/shared/src/index.ts`); the tables below
are the shipped values.

**Pangrove** (melee) — health 150, speed 245

| Slot     | Move        | Kind    | What it does                                                                                                                         |
| -------- | ----------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Basic    | Scale Swipe | melee   | 14 damage every 450 ms, 150 px                                                                                                       |
| 1 (9 s)  | Tongue Snag | beam    | 10 damage to the first enemy within 400 px, Rooted 0.9 s                                                                             |
| 2 (11 s) | Sap Bite    | melee   | 22 damage, heals Pangrove half of it                                                                                                 |
| 3 (15 s) | Scale Curl  | barrier | 60% less damage for 1.4 s                                                                                                            |
| Ultimate | Thornwheel  | rush    | 0.25 s wind-up, rolls up to 560 px; 28 damage to the first enemy and everyone within 120 px of it, Rooted 1 s, heals half the damage |

Combo **Snagged**: Tongue Snag marks; Sap Bite deals 35% more to a Snagged
target (and drains from the bigger hit).

**Mossloth** (ranged) — health 150, speed 240

| Slot     | Move          | Kind       | What it does                                                                            |
| -------- | ------------- | ---------- | --------------------------------------------------------------------------------------- |
| Basic    | Seed Spit     | projectile | 8 damage every 360 ms, 640 px                                                           |
| 1 (9 s)  | Rootsnare     | projectile | 12 damage, Rooted 1.1 s                                                                 |
| 2 (10 s) | Thorn Volley  | barrage    | four thorns of 8 damage                                                                 |
| 3 (13 s) | Bramble Patch | zone       | a 125 px patch at the aim for 3 s: 4 damage every half second and slows (jump over it)  |
| Ultimate | Wild Roots    | zone       | roots mark a 160 px circle at the aim, then burst 0.45 s later: 28 damage, Rooted 1.2 s |

Combo **Tangled**: Rootsnare marks; the first thorn of a Thorn Volley deals
30% more to a Tangled target.

Each has six rites (four minor, two major) in `RITES`, among them Greedy Sap
(Sap Bite drains all of its damage) and Deep Roots (Wild Roots 25% wider).

## New mechanics

Engine changes are in `packages/shared/src/index.ts`,
`apps/server/src/simulation.ts` and `apps/server/src/bot.ts`; tests in
`tests/unit/new-mechanics.test.ts`.

| Mechanic        | Fields                 | How it works                                                                                                                                                                                                                                                                                          |
| --------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rooted          | status `root`          | Can't walk or dash (a dash press is refused, not spent) and a charge in progress stops; can still attack, cast, blink and jump. A harmful status (`DEBUFFS`), but no crowd-control immunity afterwards. On a raid boss it counts like a stun: 3 stagger, no root. Shown as bark roots round the feet. |
| Life drain      | `drain`                | The attacker heals `drain` × the damage the hit actually dealt (after shields, team-up and so on), never past full health; a `heal` event shows it.                                                                                                                                                   |
| Lifebloom (2v2) | `ELEMENT_GIFTS.Nature` | A Nature partner close by makes your hits heal you 6% of the damage dealt.                                                                                                                                                                                                                            |

Bots: a rooted bot doesn't start a charge; rooted enemies count as an opening
(like a stun) for combos and the ultimate; rites value `root` (0.6) and
drain (its healing counts at 70% of damage).

## Everything else

- **Art**: front, side and back views on the shared rig
  (`creature-design.ts`, `creature-profile.ts`), eye styles `leaf` and
  `lazy`, portraits from `scripts/export-fighters.ts`, ten illustrated skill
  icons (`skill-art.ts`, Nature theme) and battle effects
  (`skill-fx-nature.ts`).
- **Raid tricks** (three bosses each, `RAID_BOSS_PERKS`): see
  [raid-roster-design.md](raid-roster-design.md) §6.
- **Shop**: seven skins each, Mythicals Evergrove and Moonbloom
  ([raid-roster-design.md](raid-roster-design.md) §10.6).
- **Farm**: Nature has no original champion, so Pangrove farms with Night
  Stalker (it hunts bugs) and Mossloth with Early Sun (crops grow faster).
- **Database**: [migration 070](../supabase/migrations/070_eighteen_champions.sql)
  (run after 069) adds them to the roster SQL checks (portrait, farmer, farm
  orders), their farm perks and their Shop skins. Without it, choosing one as
  your portrait or playing one (your Lobby fighter is your farmer) is
  refused.

## Balance

Balanced with the bot tools in `scripts/balance/` (Hard and Normal bots
averaged). New for this: `--only <ids>` on `tune.ts` and `tune-teams.ts`
plays only the pairings or line-ups that include those champions and tunes
only them, so the other sixteen keep their shipped numbers.

**First draft → shipped kit.** The first draft's duels ran Pangrove 75.6% and
Mossloth 14.4% (Hard bots, 20 games per pairing). `duel-diag.ts` showed why:
Pangrove's drain and a 1.8 s Scale Curl kept it alive, and Mossloth's slow
seeds were dodged while its ultimate landed one cast in ten (a ground zone
with half a second of warning: bots jumped it). Changes: Pangrove health 165 →
150, Sap Bite drain 60% → 50%, Scale Curl 1.8 s / 14 s → 1.4 s / 15 s;
Mossloth speed 225 → 240, Seed Spit 380 → 360 ms and faster (720 → 780 px/s),
Rootsnare faster and wider, Bramble Patch 3 → 4 a tick, Wild Roots no longer a
ground attack (0.45 s warning, 160 px, 28 damage, Rooted 1.2 s; it now lands
about seven casts in ten). Normal bots' dazed share (`dazeBy`) was then
calibrated so each does as well against Normal bots as against Hard ones:
Pangrove 0.335, Mossloth 0.23.

**Duels** (fresh seeds `RR_SEED=60000`, 40 games per pairing per difficulty,
680 duels each per difficulty; the other sixteen run 46.5–53.1%):

| Champion | Win rate | Hard / Normal | Factor           |
| -------- | -------- | ------------- | ---------------- |
| Pangrove | 51.5%    | 51.5% / 51.5% | ×1 (none needed) |
| Mossloth | 52.1%    | 51.0% / 53.2% | ×1 (none needed) |

**2v2** (`TEAM_TUNING`): five rounds of 2,000 random line-ups per difficulty,
fresh each round; round-to-round noise is about ±4 points. Averaged factors:
Pangrove ×0.975, Mossloth ×0.993 (both 47–55% across the rounds).

**Free-for-all, four players** (`FFA_TUNING`, fair is 25%): like the other
melee champions Pangrove does worse in a free-for-all than in a duel and
Mossloth, ranged, better (at ×1: 20.8% and 32.1%). Checked on line-ups no
tuning round used (`FFA_SEED=31337`, 3,000 matches per difficulty): at ×1.03
Pangrove wins 25.5%, at ×0.95 Mossloth 22.9%; Mossloth ships at ×0.965.

**Free-for-all, three players** (`FFA_THREE_TUNING`, fair is 33.3%), 2,500
matches per difficulty on line-ups no tuning used: at ×1.04 / ×0.95 Pangrove
won 27.1% and Mossloth 39.5% (`FFA_SEED=31337`); at ×1.12 / ×0.87, 35.9% and
31.3% (`FFA_SEED=31339`; the other sixteen run 29.8–38.0%). They ship at the
factors between the two that give 33%: Pangrove ×1.10, Mossloth ×0.89.

**Known issues**

- The 2v2 and free-for-all numbers have more noise than the duels (each
  line-up has only one or two of the new champions): about ±2 points in a
  free-for-all and ±4 per 2v2 round.
- Raids use the champions' own health; the Nature champions' raid tricks are
  tested (`tests/unit/raid-champion-tricks.test.ts`) but raids were not
  re-measured with them.
