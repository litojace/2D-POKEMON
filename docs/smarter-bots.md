# Smarter player bots (Easy, Normal, Hard)

Players said the bots were too dumb. A Normal bot stood still for whole
seconds (its `dazeBy` handicap), an Easy or Normal bot stopped dead while it
"hesitated", and every level walked into corners, left a fight it was
winning to pick up an orb, and fired slow skill shots with the basic
attack's lead. The aim of this change: each level plays like a person of
that level. A weaker bot is slower to react, aims more loosely and uses
fewer skills; it does not do stupid things.

All of it is in `apps/server/src/bot.ts` and applies **outside raids only**
(`arena.mode !== "raid"`). Raider stand-ins and Spire Echoes keep the old
play exactly, with the same random draws in the same order: seeded Spire
floors in all five zones and three seeded raids replay step for step as
before (positions, health and damage of every fighter compared).

## What each level does now

| Behaviour                                                                 | Easy | Normal | Hard |
| ------------------------------------------------------------------------- | ---- | ------ | ---- |
| Never stands still in a daze: a lapse keeps it moving and out of hazards  | yes  | yes    | yes  |
| Hesitating lets a skill chance go by instead of freezing on the spot      | yes  | yes    | -    |
| A shooter facing a brawler keeps out of the corners (`kite`)              | 0.25 | 0.6    | 1    |
| Low and behind on health: a shooter backs off, everyone goes for healing  | 20%  | 30%    | 35%  |
| Never leaves an opponent it is about to finish to pick up an orb          | yes  | yes    | yes  |
| Brawlers dash in once the opponent's dash is spent (3× keener)            | yes  | yes    | yes  |
| Skill shots lead by their own speed (capped at 0.45 s)                    | yes  | yes    | yes  |
| Saves its ultimate for an opening (`pvpSmartUltimate`)                    | -    | yes    | yes  |
| 2v2: joins its teammate's target; FFA: finishes the nearly beaten one and picks on fighters already brawling (`focus`) | - | yes | yes |
| Share of seconds lapsed (`dazeBy`)                                        | none | 0.20–0.46 by champion | none |

Easy has no daze at all now: it is weaker than Normal through its slower
reactions (0.5 s), looser aim, rare dodges and fewer skills. Before, Easy
had no daze but Normal stood still for up to 47% of its seconds, so Easy
Pyranda beat Normal Pyranda 85% of the time.

### Tried and left out

Wider spacing against brawlers and a dash back out when one gets close
(stronger kiting) made shooters far too strong for the champions' balance,
which assumes the old footwork: Hard duels went from 44–56% to 32–67%
(Coilemur 32%, Glacelle 67%). The escape dash alone took Wombolder to 38%.
Only staying out of corners stayed inside the balance.

Leading slow skill shots fully (Ball Lightning at 360 px/s) missed bots
that change direction: Hard Voltkit fell to 43–45%. Capping the lead at
0.45 s brings it back to 49–51%.

## The difficulty curve

Mirror duels (`scripts/balance/difficulty-mirror.ts 40 <strong> <weak>`):
every champion against itself, 40 duels each, 720 in all, sides swapped.

| Pairing         | Before | After  |
| --------------- | ------ | ------ |
| Hard vs Normal  | 99.6%  | 99.3%  |
| Normal vs Easy  | 71.5%  | 87.3%  |
| Hard vs Easy    | 100%   | 99.7%  |

Before, Easy beat Normal with Pyranda (85%), Pangrove (62%) and Cindrake
(57%). After, Normal wins with every champion, from Pangrove 55% and
Cindrake and Wombolder 73% up to Sunbara 100%.

New bots against the old ones, same champion on both sides
(900 duels for Hard, 350 for the others):

| Pairing                 | New wins |
| ----------------------- | -------- |
| New Hard vs old Hard    | 50%      |
| New Normal vs old Normal| 67%      |
| New Easy vs old Easy    | 66%      |

Hard plays smarter rather than stronger in a mirror duel: its new habits
(corners, focus fire, orb timing) count against brawlers and in 2v2 and
free-for-all. The expert balance bot's behaviours (`claude/expert-balance-bot`)
are the next step for Hard.

## Champion balance

Bot round robins (`scripts/balance/round-robin.ts`, every pair, 24 games),
two seeds (5000 and 200000), 7,344 duels per level:

| Level  | Before (two seeds) | After         |
| ------ | ------------------ | ------------- |
| Hard   | 46.0% – 56.5%      | 45.7% – 55.0% |
| Normal | 45.8% – 55.1%      | 44.0% – 54.0% |

Normal's `dazeBy` was recalibrated (secant steps toward each champion's
Hard rate, clipped to 46–54%, then averaged over the last three steps).
The lapse costs a bot less than standing still did, so most shares are
about the same or a little higher. Raids keep the old values: Normal's
`raidDazeBy` is `RAID_DAZE_BY` over Normal's duel daze from before this
change (`NORMAL_DAZE_BEFORE_SMART_BOTS`), and `RAID_DAZE_BY` is unchanged.

## 2v2 and free-for-all

Checked on line-ups the tuning never played (`FRESH_BASE=7000`,
`tune-teams.ts 1 1000 --fresh`, 1,000 matches per difficulty):

TEAMS_TABLE_PLACEHOLDER

## Tools

- `scripts/balance/difficulty-mirror.ts <games> [strong] [weak] [shard shards out.json]`:
  the difficulty curve on equal terms (same champion on both sides).
- `npx vitest run tests/unit/bot-difficulty.test.ts tests/unit/bot-targeting.test.ts tests/unit/bot.test.ts`:
  raid daze unchanged, the PvP lapse, Easy and Hard never dazed, 2v2 focus
  fire, and Normal beating Easy with Pyranda (it failed 2 of 8 before).
