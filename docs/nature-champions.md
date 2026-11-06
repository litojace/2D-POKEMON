# Nature champions: Pangrove and Mossloth

The ninth element, **Nature**, brings the roster to eighteen: two champions
per element again. Both are original creatures with original kits; each adds
something the other sixteen don't have.

| Champion | Role            | Creature                                                 | Signature mechanic                                            |
| -------- | --------------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| Pangrove | Drain bruiser   | Pangolin with living leaf scales and a sprout on its crown | **Life drain**: Sap Bite and Thornwheel heal it for part of the damage they deal |
| Mossloth | Root controller | Three-toed sloth with a moss garden on its back            | **Rooted**: Rootsnare and Wild Roots pin enemies in place      |

## Kits

Numbers are in `CHARACTERS` (`packages/shared/src/index.ts`); the tables below
are the shipped values.

**Pangrove** (melee) — health HEALTH_P, speed 245

| Slot     | Move        | Kind    | What it does                                                                                     |
| -------- | ----------- | ------- | ------------------------------------------------------------------------------------------------ |
| Basic    | Scale Swipe | melee   | 14 damage every INTERVAL_P ms, 150 px                                                            |
| 1 (9 s)  | Tongue Snag | beam    | 10 damage to the first enemy within 400 px, Rooted 0.9 s                                         |
| 2 (11 s) | Sap Bite    | melee   | 22 damage, heals Pangrove half of it                                                             |
| 3 (15 s) | Scale Curl  | barrier | 60% less damage for 1.4 s                                                                        |
| Ultimate | Thornwheel  | rush    | 0.25 s wind-up, rolls up to 560 px; 28 damage to the first enemy and everyone within 120 px of it, Rooted 1 s, heals half the damage |

Combo **Snagged**: Tongue Snag marks; Sap Bite deals 35% more to a Snagged
target (and drains from the bigger hit).

**Mossloth** (ranged) — health HEALTH_M, speed 240

| Slot     | Move          | Kind       | What it does                                                                  |
| -------- | ------------- | ---------- | ----------------------------------------------------------------------------- |
| Basic    | Seed Spit     | projectile | 8 damage every INTERVAL_M ms, 640 px                                          |
| 1 (9 s)  | Rootsnare     | projectile | 12 damage, Rooted 1.1 s                                                       |
| 2 (10 s) | Thorn Volley  | barrage    | four thorns of 8 damage                                                       |
| 3 (13 s) | Bramble Patch | zone       | a 125 px patch at the aim for 3 s: 4 damage every half second and slows (jump over it) |
| Ultimate | Wild Roots    | zone       | roots mark a 160 px circle at the aim, then burst 0.45 s later: 28 damage, Rooted 1.2 s |

Combo **Tangled**: Rootsnare marks; the first thorn of a Thorn Volley deals
30% more to a Tangled target.

Each has six rites (four minor, two major) in `RITES`, among them Greedy Sap
(Sap Bite drains all of its damage) and Deep Roots (Wild Roots 25% wider).

## New mechanics

Engine changes are in `packages/shared/src/index.ts`,
`apps/server/src/simulation.ts` and `apps/server/src/bot.ts`; tests in
`tests/unit/new-mechanics.test.ts`.

| Mechanic          | Fields               | How it works                                                                                                                                                                                                 |
| ----------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rooted            | status `root`        | Can't walk or dash (a dash press is refused, not spent) and a charge in progress stops; can still attack, cast, blink and jump. A harmful status (`DEBUFFS`), but no crowd-control immunity afterwards. On a raid boss it counts like a stun: 3 stagger, no root. Shown as bark roots round the feet. |
| Life drain        | `drain`              | The attacker heals `drain` × the damage the hit actually dealt (after shields, team-up and so on), never past full health; a `heal` event shows it.                                                       |
| Lifebloom (2v2)   | `ELEMENT_GIFTS.Nature` | A Nature partner close by makes your hits heal you 6% of the damage dealt.                                                                                                                                  |

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
- **Database**: [migration 067](../supabase/migrations/067_eighteen_champions.sql)
  (run after 066) adds them to the roster SQL checks (portrait, farmer, farm
  orders), their farm perks and their Shop skins. Without it, choosing one as
  your portrait or playing one (your Lobby fighter is your farmer) is
  refused.

## Balance

BALANCE_SECTION
