# Smarter player bots (Easy, Normal, Hard)

Players said the bots were too dumb. A Normal bot stood still for whole
seconds (its `dazeBy` handicap), an Easy or Normal bot stopped dead while it
"hesitated", and every level walked into corners, left a fight it was
winning to pick up an orb, fired slow skill shots with the basic attack's
lead, and in 2v2 each bot fought whoever was nearest. The aim of this change: each level plays like a person of
that level. A weaker bot is slower to react, aims more loosely and uses
fewer skills; it does not do stupid things.

All of it is in `apps/server/src/bot.ts` and applies **outside raids only**
(`arena.mode !== "raid"`). Raider stand-ins and Spire Echoes keep the old
play exactly, with the same random draws in the same order: seeded Spire
floors in all five zones and three seeded raids replay step for step as
before (positions, health and damage of every fighter compared).

## What each level does now

| Behaviour                                                                                                              | Easy                  | Normal                | Hard  |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------- | --------------------- | ----- |
| A lapse (see below) keeps it moving and out of hazards; it never freezes                                               | yes                   | yes                   | -     |
| Hesitating lets a skill chance go by instead of freezing on the spot                                                   | yes                   | yes                   | -     |
| A shooter facing a brawler keeps out of the corners (`kite`)                                                           | 0.25                  | 0.6                   | 1     |
| Low and behind on health: a shooter backs off, everyone goes for healing                                               | < 20%                 | < 30%                 | < 35% |
| Never leaves an opponent it is about to finish to pick up an orb                                                       | yes                   | yes                   | yes   |
| Brawlers dash in once the opponent's dash is spent (3× keener)                                                         | yes                   | yes                   | yes   |
| Skill shots lead by their own speed (at most 0.45 s ahead)                                                             | yes                   | yes                   | yes   |
| Saves its ultimate for an opening (`pvpSmartUltimate`)                                                                 | -                     | yes                   | yes   |
| 2v2: joins its teammate's target; FFA: finishes the nearly beaten one and picks on fighters already brawling (`focus`) | -                     | yes                   | yes   |
| Plans its way out of marked blasts (`dodgeMarks`), after `markReaction`                                                | 0.9 s                 | 0.75 s                | 0.6 s |
| Hops or steps round enemy seedlings (`jumpSeeds`)                                                                      | -                     | yes                   | yes   |
| Looks away from a ready Eyespot Flash between attacks (`lookAway`)                                                     | -                     | -                     | yes   |
| Share of seconds lapsed (`dazeBy`)                                                                                     | brawlers only, ≤ 0.21 | 0.20–0.46 by champion | none  |

The last four rows are the expert balance bot's counterplay
(`ExpertFlags`, PR #236), reused as it is: each level has some of it, in
PvP only. The expert reads a mark 0.15 s after it appears; a player level
takes its `markReaction`, and until then walks out of the mark as bots
always did. An instant read took Hard Pyranda (a kit of marks) to 41%, and
0.5 s to 44%; at 0.6 s it is at 51%.

**Lapses instead of dazes.** Normal's per-champion handicap (`dazeBy`) used
to freeze it for whole seconds. Now a dazed second is a lapse of attention:
it keeps walking (and out of hazards), but attacks, casts and dodges
nothing. A lapse costs a bot less than standing still did, so the shares
were recalibrated. Easy lapses 0.25 less than Normal on the same champion
(`EASY_DAZE_GAP`), so only with brawlers (Cindrake 0.21, Duskveil 0.11,
Pangrove 0.11, Coilemur 0.11, Wombolder 0.09, Shadopus 0.08, Mossloth 0.06,
the rest 0.04 or less). Before, Easy had no daze and Normal froze for up
to 47% of its seconds, so Easy Pyranda beat Normal Pyranda 85% of the time.

### Tried and left out

Wider spacing against brawlers and a dash back out when one gets close
(stronger kiting) made shooters far too strong for the champions' balance,
which assumes the old footwork: Hard duels went from 44–56% to 32–67%
(Coilemur 32%, Glacelle 67%). The escape dash alone took Wombolder to 38%.
Only staying out of corners stayed inside the balance.

Leading slow skill shots fully (Ball Lightning at 360 px/s) missed bots
that change direction: Hard Voltkit fell to 43–45%. Capping the lead at
0.45 s brings it back to 49–51%.

An Easy with no lapse at all lost to Normal with Pangrove (55%) and only
just beat it with Cindrake and Wombolder (73%): slow reactions and loose
aim cost a brawler little.

## The difficulty curve

Mirror duels (`scripts/balance/difficulty-mirror.ts 40 <strong> <weak>`):
every champion against itself, 40 duels each, 720 in all, sides swapped.

| Pairing        | Before | After |
| -------------- | ------ | ----- |
| Hard vs Normal | 99.6%  | 99.3% |
| Normal vs Easy | 71.5%  | 91.7% |
| Hard vs Easy   | 100%   | 100%  |

Before, Easy beat Normal with Pyranda (85%), Pangrove (62%) and Cindrake
(57%). After, Normal wins with every champion: Pangrove 68%, Coilemur 75%,
Duskveil, Wombolder and Shadopus 88%, the rest 90–100%.

The new bots against the old ones (the code before this change), the same
champion on both sides, two seeds of 10 duels per champion:

| Pairing                  | New wins       |
| ------------------------ | -------------- |
| New Hard vs old Hard     | 47.8% (of 360) |
| New Normal vs old Normal | 68.6% (of 351) |
| New Easy vs old Easy     | 56.4% (of 348) |

Normal and Easy are stronger than before through playing better, not
through fewer handicaps. Hard plays smarter but no stronger in a mirror
duel (47.8% is within the noise of 50%): its new habits pay off against
particular kits (marks, seedlings, the gaze, brawlers in corners) and in
2v2 and free-for-all, and Hard's duel balance leaves no room to make it
stronger across the board (see "Tried and left out").

## Champion balance

Bot round robins (`scripts/balance/round-robin.ts`, every pair, 24 games),
two seeds (5000 and 200000), 7,344 duels per level ("before" is the code
before this change, just before the Pangrove rework, #235):

| Level  | Before        | After         |
| ------ | ------------- | ------------- |
| Hard   | 46.0% – 56.5% | 46.0% – 53.3% |
| Normal | 45.7% – 53.8% | 45.2% – 54.4% |
| Easy   | 16.1% – 89.1% | 23.9% – 71.8% |

Normal's `dazeBy` was recalibrated: secant steps toward each champion's
Hard rate (clipped to 46–54%), the last three averaged, then small steps
for Glacelle, Auralynx, Sunbara and Coilemur. Easy was never calibrated per
champion and still is not: Easy brawlers beat Easy shooters (Cindrake 72%,
Mystowl 24%), less than before (89% and 16%).

Raids keep the old values: Normal's `raidDazeBy` is `RAID_DAZE_BY` over
Normal's duel daze from before this change (`NORMAL_DAZE_BEFORE_SMART_BOTS`),
and `RAID_DAZE_BY` is unchanged. In raids only a level with `raidDazeBy`
(Normal) is dazed, so Easy Echoes never are.

## 2v2 and free-for-all

Checked on line-ups the tuning never played (`FRESH_BASE=7000`,
`tune-teams.ts 1 1000 --fresh`, 1,000 matches per difficulty):

| Mode                  | Fair  | Old bots      | New bots, old factors | New bots, retuned |
| --------------------- | ----- | ------------- | --------------------- | ----------------- |
| 2v2                   | 50%   | 45.2% – 53.0% | 41.0% – 61.1%         | 44.0% – 54.8%     |
| 4-player free-for-all | 25%   | 22.4% – 29.8% | 17.9% – 31.5%         | 21.1% – 28.4%     |
| 3-player free-for-all | 33.3% | -             | 27.9% – 39.5%         | (not retuned)     |

Focus fire moved 2v2 the most (Auralynx, Terradon and Wombolder gained ten
points, Tidefin, Lumoth and Halcyra lost five to ten). `TEAM_TUNING` was
retuned with four rounds of 1,000 fresh line-ups per difficulty
(`FRESH_BASE` 5010–5040, one round per call) and the last three rounds'
factors averaged; `FFA_TUNING` with three rounds, starting from the check's
suggestion. Three-player free-for-all stayed inside its earlier range
(27.5% – 40.5%), so `FFA_THREE_TUNING` is unchanged. (The 2v2 "new bots,
old factors" check ran before the expert's counterplay was added.)

## Second round: every level a step up (2026-11-22)

Real matches showed Hard falling behind. In duels against bots
(`arena_matches`, `vs_bot`, 4–22 November), the players who play often won
55–82% of their Hard duels, and more each week; Easy and Normal won nearly
every time. So each level moved up a step, measured against the level it
replaces in bot duels (`difficulty-gap.ts 4`, every pair, 612 duels):

| New level vs the old one | New wins | Old takes of rounds |
| ------------------------ | -------- | ------------------- |
| Hard                     | 73.2%    | 35.5%               |
| Normal                   | 72.1%    | 37.2%               |
| Easy                     | 69.1%    | 38.7%               |

(The Normal and Easy rows are the candidates' numbers before Normal's
`dazeBy` was recalibrated.)

| Setting                       | Easy          | Normal        | Hard          |
| ----------------------------- | ------------- | ------------- | ------------- |
| Reaction                      | 0.5 → 0.47 s  | 0.36 → 0.33 s | 0.25 → 0.2 s  |
| Aim spread                    | 0.27 → 0.26   | 0.215 → 0.19  | 0.14 → 0.12   |
| Dodges                        | 10 → 18%      | 43 → 47%      | 55 → 80%      |
| Decides every                 | 0.45 → 0.38 s | 0.19 → 0.17 s | 0.12 → 0.08 s |
| Holds fire (`rest`)           | 42 → 36%      | 12 → 10%      | 5 → 0%        |
| Uses a good skill chance      | 35 → 38%      | 42 → 52%      | 90%           |
| Leads moving targets          | 0 → 5%        | 20 → 40%      | 85%           |
| Looks away from Eyespot Flash | -             | - → yes       | yes           |
| Reads marks after             | 0.9 → 0.88 s  | 0.75 → 0.72 s | 0.6 s         |

Hard now has the balance expert's reaction, aim and decisions (a good
player's hands, not a machine's) without its look-ahead. Three of the
expert's other edges stayed out, each measured in a Hard round robin:

- Dodging 90% of shots took the slower shooters down (Voltkit 39.5%,
  Pyranda 39.2%); 75% let Halcyra's learned style take it to 64%; 80%
  without styles is the middle.
- The expert's instant read of marks sank Pyranda, whose kit is marks
  (37.5%); Hard keeps its 0.6 s.
- The learned styles (`expert-style.ts`, only Halcyra's is kept) are tuned
  for the expert's hands; on Hard's, Halcyra rose to 64%.

A "steady lead" (leading a shot by how the opponent moved over the last
0.3 s, against players who jink left and right) was tried for Normal and
Hard and taken out: it cost Voltkit six points in Hard duels (39.5% →
33.3%), and what it gains against jinking players can't be measured with
bots, which change direction rarely.

**Sunbara**, the support, was the one champion the new Hard left behind
(38.2%): its damage is projectiles, and a better dodger slips its slow
Yuzu Toss. Yuzu Toss now flies at 760 px/s (was 650) with a 7 s cooldown
(was 8): 40.9% → 46.1% in a 408-duel probe. Its Spire Echo made floor 49
harder (68 clears in 144 against 85), so floor 49's armour is 3.25 (was
3.05; 88 clears). The other ten floors with a Sunbara Echo (12, 41–48, 68)
stayed within the noise of 72 seeds.

**Raids and the Spire play as before.** Raider stand-ins and Spire Echoes
keep the levels they were tuned with (`RAID_BOT_PROFILES`: a brain swaps
to them on its first think in raid mode), and the balance-only expert is
still built on the old Hard. Ten seeded Spire floors in all seven zones
gave the same clear counts on main and on this branch before Sunbara's
change.

| Round robin (24 games a pair, 3,672 duels) | Before (main) | After         |
| ------------------------------------------ | ------------- | ------------- |
| Hard                                       | 42.9% – 58.3% | 43.4% – 57.8% |
| Normal (`dazeBy` recalibrated)             | 43.1% – 54.4% | 43.9% – 54.9% |
| Easy (never calibrated per champion)       | 23.9% – 71.8% | 22.3% – 72.8% |

Normal's `dazeBy` was recalibrated toward each champion's Hard rate
(clipped to 46–54%): three full steps, which overshot (the win rate moves
150–250 points per unit of daze), a least-squares fit through those three,
then two steps at 0.4 gain. The gaps between the levels stay as they were:
Hard beats Normal in 99.7% of duels (99.7% on main), Normal beats Easy in
91.7% (93.1%).

**2v2 and free-for-all.** The sharper bots moved both (checked on
line-ups no tuning played, `FRESH_BASE=7000`, 1,000 matches per level):
2v2 to 40.9% – 62.0% (Mossloth 62%), four-player free-for-all to 20.3% –
34.6%. `TEAM_TUNING` was retuned with four fresh rounds (`FRESH_BASE`
5010–5040) and `FFA_TUNING` with five (5010–5050), the last three rounds'
factors averaged. Three-player free-for-all stayed inside its range
(27.4% – 41.1%), so `FFA_THREE_TUNING` is unchanged.

| Mode (fresh line-ups) | Before (main) | New bots, old factors | Retuned       |
| --------------------- | ------------- | --------------------- | ------------- |
| 2v2                   | 41.9% – 55.8% | 40.9% – 62.0%         | 45.7% – 55.8% |
| 4-player free-for-all | 21.4% – 29.1% | 20.3% – 34.6%         | 20.4% – 28.9% |
| 3-player free-for-all | 27.7% – 41.5% | 27.4% – 41.1%         | (unchanged)   |

## Tools

- `scripts/balance/difficulty-mirror.ts <games> [strong] [weak] [shard shards out.json]`:
  the difficulty curve on equal terms (same champion on both sides).
- `npx vitest run tests/unit/bot-difficulty.test.ts tests/unit/bot-targeting.test.ts tests/unit/bot.test.ts`:
  raid daze unchanged, the PvP lapse, Easy and Hard never dazed, 2v2 focus
  fire, and Normal beating Easy with Pyranda (it failed 2 of 8 before).
