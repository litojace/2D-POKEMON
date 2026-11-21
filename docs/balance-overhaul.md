# Champion balance overhaul (Nov 2026)

The owner's brief: a stealthed champion should vanish completely for its
opponents and be impossible to pick as a target; dashing out of Mossloth's
Sloth Time should free you at once; and the whole roster should be
rebalanced so every champion has a fair chance against every other, since
several kits had fallen behind.

## What other games do

- **Leon (Brawl Stars)**: his Super makes him fully invisible to enemies,
  not a faint outline. The answers to it are area damage, a reveal when he
  attacks or is hit, and staying close to teammates. Ink Cloud now works the
  same way: no outline, and taking damage or casting still reveals.
- **Overwatch 2**: at launch Blizzard set out to "decrease the reliance on
  hard counters" and to use fewer stuns. That is the yardstick here: fewer
  matchups that are close to unwinnable.
- **League of Legends**: Riot balances to a win-rate band and wants
  counterplay against every champion; their 2026 lead calls some counters
  "secret sauce", so not every lopsided matchup is a bug.

## Mechanics

- **Ink Cloud (stealth)**: an enemy in stealth is no longer drawn at all for
  its opponents: no rig, shadow, team ring, status dots or nameplate (it was
  at 12% opacity, with a full-strength shadow and ring). You and your allies
  still see it at half opacity. On the server, a stealthed enemy can't be
  locked on to by Gill Siphon, picked by Lazy Swap or shot by the Haunted
  Lantern, and going into stealth snaps a siphon already on it. Aim assist,
  target lock and the off-screen arrow already ignored stealth, and so did
  bots. To make up for the stronger stealth, the ambush bonus drops from 40%
  to 30%.
- **Sloth Time**: the `warp` status now carries its bubble (`tx`, `ty`,
  radius `amount`), and `advanceMovement` only slows a fighter while it is
  inside, so leaving frees you at once (and client prediction agrees).
  Dashes and charges are never slowed, so a dash (153 px) carries you out of
  the 165 px bubble from anywhere but its very middle; before, a dash inside covered about 54 px.
  Bots dash out of it. The bubble grew from 150 px to 165 px and its cooldown
  went from 14 s to 12 s, so it still matters.

## Kit changes

| Champion | Change                                                                                                                                     | Why                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Voltkit  | Health 153 → 157. Ball Lightning deals 30% more to an enemy with a harmful status                                                          | Weakest on Hard; pairs with Static Lance's paralysis                          |
| Cindrake | Cinder Snap 15 → 14, Magma Bomb 24 → 22                                                                                                    | Strongest on Hard (60%)                                                       |
| Auralynx | Facet Guard reflects 20% (was 30%). Prism Jab every 345 ms (was 335). Prism Shot 22 damage (was 20), 700 px/s (was 600)                    | Less of a wall against melee, more of a threat at range (fewer hard counters) |
| Lumoth   | Health 139 → 143. Kindle cooldown 15 → 13 s. Radiant Flare rays 6 → 7                                                                      | Weakest on Normal                                                             |
| Mystowl  | Third-Eye Ray 18 → 17. Booming Hoot knockback 260 → 230                                                                                    | Strongest on Normal                                                           |
| Terradon | Boulder Swipe every 600 ms (was 630). Shell Up regrows 30 (was 25)                                                                         | Below average on Hard                                                         |
| Duskveil | Shade Crawl 20 → 21. Haunted Lantern cooldown 18 → 15 s, wisps 4 → 5                                                                       | Below average on Hard                                                         |
| Pyranda  | Health 140 → 150. Chestnut Mortar 26 → 24                                                                                                  | Lost almost every game to divers; less punishing against other ranged         |
| Glacelle | Health 152 → 158. Hailstone a little bigger (16 px) and shatters for 35% more on a slowed or frozen enemy. Frost Breath cooldown 15 → 12 s | Weakest on Hard; an ice combo of its own                                      |
| Halcyra  | Focus Shot 26 → 25                                                                                                                         | Strong on Hard                                                                |
| Sunbara  | Yuzu Toss heals Sunbara for a fifth of the damage it deals                                                                                 | A support's poke that sustains                                                |
| Astrabun | Moon Hop 10 → 12 damage, cooldown 8 → 7 s                                                                                                  | Weakest on Normal                                                             |
| Pangrove | Health 164 → 168                                                                                                                           | Slipped a little after the others moved                                       |
| Shadopus | Ink Cloud ambush 40% → 30% (stealth is now total)                                                                                          | Compensates the stronger stealth                                              |
| Mossloth | Health 170 → 180. Seedling 26 → 28 at full bloom. Lazy Swap cooldown 12 → 11 s. Overgrowth 28 → 30. Sloth Time as above                    | Low already, and Sloth Time can now be escaped                                |

Rite texts that quoted a changed number were updated. Normal bots'
per-champion handicap (`dazeBy`, `apps/server/src/bot.ts`) was recalibrated
so each champion does about as well against Normal bots as against Hard.

A piercing Static Lance was tried and dropped: it changes nothing in a duel
(there is one enemy), but it made Spire floor 19 much easier for a solo
Voltkit (cleared on 5 of 12 seeds against 3), and 2v2 would have needed
retuning.

## Measurements

Bot round robin on the real server arena (`scripts/balance/round-robin.ts`):
every pair, 24 games, sides alternating, so each champion plays 408 games.
At that size a champion's rate moves by about ±2.5 points from one seed to
the next. "Hard counters" are pairs one side wins 80% or more of; at 24 games
a pair, this count is noisy.

| Run                  | Hard: lowest – highest | Hard: spread (sd) | Normal: lowest – highest | Normal: spread (sd) |
| -------------------- | ---------------------- | ----------------- | ------------------------ | ------------------- |
| Before (seed 92000)  | 42.6% – 60.3%          | 4.9               | 39.0% – 58.8%            | 4.9                 |
| After (seed 96000)   | 45.3% – 54.7%          | 2.5               | 43.3% – 60.3%            | 4.1                 |
| After (seed 97000)   | 43.4% – 55.6%          | 2.7               | 45.1% – 55.9%            | 3.2                 |
| After, final (98000) | 43.4% – 55.9%          | 3.5               | 44.4% – 56.6%            | 3.3                 |

Hard-counter pairs did not fall: 12 before and 7–13 after on Normal, 33
before and 32–39 after on Hard. Most of them are the same few styles meeting.
Auralynx's guard and Pyranda's artillery against melee divers, and Pyranda
against other ranged champions, still decide most of those games between
bots. Lowering those needs mechanics, not numbers, and is the next step.

Bots are not people: they always face their target, never wait out a
Facet Guard and don't read stealth, so these numbers say most about raw
numbers and least about stealth and Sloth Time. Watch the live win rates
after release.

2v2 and free-for-all factors (`TEAM_TUNING`, `FFA_TUNING`,
`FFA_THREE_TUNING`) were not retuned in this pass.

## Second pass: hard counters

Measured first with 48 games a pair (`RR_ONLY`), on Hard. Before this pass,
Auralynx won 85–96% against the melee divers (Coilemur, Astrabun,
Wombolder) and lost 85–98% to kiters (Mossloth, Voltkit, Halcyra,
Tidefin); Pyranda lost 92–96% to divers (Astrabun, Coilemur, Wombolder,
Pangrove) and won 88–98% against ranged champions.

**Auralynx** (shipped):

- Facet Guard refracts only what is not a strike up close: shots, beams,
  blasts and raid bosses' attacks come back at 20%, while melee strikes,
  pounds, clamps, throws, cones, charges, rolls, grapples, blinks and novas
  are only halved (`UNREFRACTED` in `simulation.ts`). Divers no longer lose
  health for hitting it.
- Facet Guard also gives 30% haste while it lasts: walk in behind the guard.
- Prism Shot slows for 1 s, so Auralynx can catch a kiter.
- Health 164 → 167. Normal handicap 0.285 → 0.3.

Auralynx's matchups went from 2–98% to 17–83% (24 games a pair) or 21–90%
(48 a pair), at 50–53% overall.

**Pyranda** (the tries, before the owner's call below):

| Try                                                                         | Pyranda overall | Against divers |
| --------------------------------------------------------------------------- | --------------- | -------------- |
| Ember Curtain knocks back (150) and a slower Mortar (0.6 s to land, 100 px) | 39.8%           | 0–8%           |
| Plus Hot Coals hops Pyranda 200 px back and drops the coals where it stood  | 26.0%           | 2–8%           |
| Ember Lob knockback 70, health 160                                          | 63.2%           | 13–19%         |
| Ember Lob knockback 60, health 144                                          | 47.9%           | 8–33%          |
| Ember Curtain 55 px out, knockback 180, health 150                          | 34.4%           | 0–4%           |

Only a stronger basic-attack knockback worked, and the roster has a rule
against it (`tests/unit/fighter-cards.test.ts`: a basic attack knocks back
at most 20, 25 in melee, "so brawlers can close in and chain hits"). That
choice was the owner's: see the third pass.

The whole roster after this pass (seed 102000):

| Difficulty | Lowest – highest | Spread (sd) | Hard-counter pairs |
| ---------- | ---------------- | ----------- | ------------------ |
| Hard       | 46.3% – 56.4%    | 2.5         | 26 (was 32–39)     |
| Normal     | 40.9% – 55.9%    | 3.1         | 14 (was 7–13)      |

Voltkit's Normal rate moves a lot between seeds (38–47%). Its Normal
handicap also drives the bot raider in the Spire's zone 2 play-test, and
0.17 instead of 0.18 made floor 19 easier than floor 11, so it stays at 0.18.

## Third pass: Pangrove's roll, Pyranda's Ember Lob

The owner found Curl & Roll too hard to steer onto an enemy. At full speed
(540 px/s) the ball turned 3.4 rad/s, a 160 px turning circle; every radian
turned cost 35% of its speed; a ram bounced it straight back at half speed,
and coming round again took most of a second; and a ram only counted with
the two bodies 6 px apart. Changes (`ROLL` in `packages/shared/src/index.ts`,
`stepRolls` in `simulation.ts`):

- It turns at 7 rad/s when slow, down to 3.4 at full speed (`turnSlow`), like
  a kart: tight after a ram, wide when it has built speed.
- Turning costs 20% of the speed per radian (was 35%).
- A ram rolls on through the enemy at 70% of its speed (`ramKeep`) instead
  of bouncing back at half, so it can swing round for another pass.
- A ram counts within 16 px between the bodies (was 6).
- Steering stays in `advanceMovement`, so the client still predicts it.
  There is no homing toward enemies, which prediction couldn't follow.

Rolling got much easier for bots: Pangrove went to 66.5%. To compensate,
rams deal 7 to 20 (was 10 to 34), the cooldown is 12 s (was 11), and health
is back to 164.

Pyranda (the owner chose the knockback): Ember Lob knocks back 65, the one
exception to the light-knockback rule (`tests/unit/fighter-cards.test.ts`).
Ember Curtain knocks back 150. Chestnut Mortar lands after 0.6 s (was 0.45)
in a 100 px circle (was 110): a ranged champion can now get out of it in
time. Health 146, Normal handicap 0.39 → 0.37. Voltkit fell to 42% on both
difficulties after this, so Static Lance goes from 18 to 20 (Spire zone 2's
play-test still passes).

| Champion | Before this pass (Hard / Normal) | After (Hard / Normal)           | Worst matchups after (Hard)           |
| -------- | -------------------------------- | ------------------------------- | ------------------------------------- |
| Pangrove | 52.0% / 47.3%                    | 51.2% / 45.8%                   | 17–21%                                |
| Pyranda  | 47.3% / 50.5% (0% vs 3 divers)   | 48.8% / 47.8%                   | 8–13% (Pangrove, Wombolder, Astrabun) |
| Voltkit  | 46.8% / 40.9%                    | 49.5% / 46.7% (48 games a pair) | 10–23%                                |

Whole roster after the pass (seed 105000, before the Static Lance change):
Hard 42.4% – 55.1%, spread 3.4, 23 hard-counter pairs; Normal 42.2% – 55.9%,
spread 3.4, 9 pairs.

## Fourth pass: hard counters with new mechanics

With the owner's go-ahead to change skills, not only numbers. First a
measurement with 48 games a pair on Hard (a pair's rate moves about ±7
points between seeds at that size): spread 2.2–2.6 points, and 30–33 pairs
won 80% or more one way. What they share is a rock-paper-scissors between
play styles: divers beat artillery and pokers, Auralynx beats divers, and
ranged champions beat Auralynx.

What decided each one, found by switching parts of a kit off (one champion
against the roster, 48 games a pair, a fixed seed):

- **Auralynx against divers** (Coilemur 96%, Astrabun 92%, Wombolder 92%):
  not its kit. With no Shatter Paw stun and knockback, or no Facet Guard,
  it still won 85–92%. It was health: 178 against 134–144 in a melee
  mirror, raised earlier to help it against kiters. League's split is
  juggernauts with stats and no mobility against divers with mobility and
  few stats, so Auralynx gets mobility instead of health:
  - **Facet Guard vaults** up to 240 px toward the aim behind the guard
    (`lunge`, 900 px/s), in place of the haste. Borrowed from Pantheon's
    Shield Vault (League) and Reinhardt's Charge (Overwatch); no other
    champion has it. Predicted on the client like a rush
    (`tests/unit/movement-skill-prediction.test.ts`).
  - It primes Shatter Paw only on what it refracts, not on strikes up close.
  - Health 178 → 170, Prism Jab 13 → 12, Prism Shot cooldown 8 → 6 s.
- **Pyranda against ranged champions** (Voltkit 92%, Lumoth 90%): Ember
  Lob's knockback pushed them out of their own reach. It now knocks back
  65 only within 260 px (`knockbackNear`), and a light 20 beyond that, like
  a point-blank shot. Chestnut Mortar 24 → 22. Health 150.
- **Mossloth** (Auralynx 96%, Terradon 90%): melee champions stood rooted
  on its seedlings. Roots now last 0.4 / 0.6 / 1 s (were 0.5 / 0.8 / 1.3).
- **Duskveil** (Lumoth 90%, Mossloth 90%): the lantern's wisps go back to 4
  (they had gone to 5 in the first pass), and health 152 → 154.

Tried and dropped: Spark Dart reaching 760 px (Voltkit's matchups got more
lopsided), and Tidefin at 148–150 health. Tidefin is an enemy in the Spire's
zone 2, so the extra health turned that play-test's order of difficulty
around; Tidefin stays at 146.

The whole roster after the pass (seed 109000; Hard with 48 games a pair,
Normal with 24):

| Difficulty | Lowest – highest | Spread (sd) | Pairs at 80%+  |
| ---------- | ---------------- | ----------- | -------------- |
| Hard       | 46.1% – 55.3%    | 2.4         | 24 (was 30–33) |
| Normal     | 45.3% – 62.5%    | 3.7         | 8              |

On Normal, Auralynx's vault took it to 62.5%. Its handicap went from 0.3
to 0.33 and Pyranda's from 0.37 to 0.36: both are now at 50% on Normal
(48 games a pair).

## 2v2 and free-for-all

After the duel passes, `TEAM_TUNING`, `FFA_TUNING` and `FFA_THREE_TUNING`
were retuned with `scripts/balance/tune-teams.ts`, one round per call so a
container restart loses only that round. There were four rounds of 1,000
fresh line-ups per difficulty in 2v2 and in 4-player free-for-all, and three
in 3-player. Each factor is the average of the last three rounds. A single
round is noisy: one champion is in about a fifth of the line-ups, and Glacelle
went 32%, 19%, 34%, 17% in four rounds of 4-player free-for-all.

Then a check on line-ups the tuning never played (`FRESH_BASE=7000`, 1,000
per difficulty):

| Mode                  | Fair  | Lowest – highest |
| --------------------- | ----- | ---------------- |
| 2v2                   | 50%   | 45.5% – 53.1%    |
| 4-player free-for-all | 25%   | 19.9% – 28.7%    |
| 3-player free-for-all | 33.3% | 26.6% – 42.3%    |

In 3-player free-for-all, Pangrove (42.3%), Duskveil (26.6%) and Voltkit
(27.1%) had followed one noisy first round. Their factors went back near
their earlier values: 1.07, 0.85 and 0.86.

## After the skill revolution

`docs/skill-revolution.md` changed every kit (waves A-D, PRs #201, #222 and
#223). Afterwards the whole balance was measured again and retuned, once,
with all four waves on `main`:

- **Duels on Hard** (seed 200000, 24 games a pair): 46.1% - 55.1%, spread
  2.7, so no kit changes.
- **Normal handicaps** (`dazeBy`): Voltkit and Tidefin were about 10 points
  below Hard, and Mystowl and Wombolder 6 above. After two rounds the range is
  42.9% - 57.1% with a spread of 3.3, the size of the noise between seeds.
  Every champion whose duel handicap moved keeps its old one in
  `RAID_DAZE_BY`, so raids and the Spire play the same.
- **2v2 and free-for-all**: four rounds in 2v2 and in 4-player FFA, three in
  3-player, with the last three rounds' factors averaged. Checked on unused
  line-ups (`FRESH_BASE=7000`): 2v2 47.0% - 53.6%, 4-player 20.9% - 31.4%,
  3-player 27.5% - 40.5%. In 3-player Pangrove (40.5%, and 42% in the
  previous check) goes to 1.02, Auralynx (38.5%) to 1.17 and Mossloth (27.5%)
  to 0.98. In 4-player Mossloth (31.4%) goes to 0.94.

## Fifth pass: after the smarter bots

The smarter Easy, Normal and Hard bots (#238, `docs/smarter-bots.md`) give
Hard the expert's counterplay (looking away from gazes, jumping seedlings,
dodging marked ground), so Hard and the expert with Hard's reactions and aim
now agree within noise (seed 300000: every champion within 4.4 points, most
within 2). Tuned on Hard, checked on three seeds (310000, 320000 and 330000,
24 games a pair each, 11,016 duels). One seed is not enough: on the code
before this pass, Halcyra was 8.8 points apart between two of these seeds.

Changes, kept small because health moves a duel a lot (Coilemur +6 health
and a 2-second shorter Magnet Lash went from 44% to 59%):

- **Mystowl** (57%): Mind Maze confuses for 2 seconds (was 2.2), Third-Eye
  Ray deals 15 (was 17).
- **Cindrake** (56%): health 148 (was 151). **Astrabun**: 132 (was 134).
- **Coilemur** (43.5%): health 148 (was 144), Magnet Lash every 11 seconds
  (was 12).
- **Mossloth** (45%, the bots now jump its seedlings): health 185 (was 180).
  One more point of Seed Spit damage instead took it to 61%.
- **Pyranda**: health 152 (was 150). **Halcyra**, **Lumoth**: 141 (was 138).
  **Shadopus**: 132 (was 129). **Terradon**: 196 (was 193).

Hard, the same 11,016 duels before and after:

| Champion  | Before | After |
| --------- | -----: | ----: |
| Pangrove  |  52.8% | 53.2% |
| Pyranda   |  49.3% | 52.7% |
| Halcyra   |  46.3% | 52.6% |
| Mossloth  |  45.0% | 51.7% |
| Duskveil  |  51.3% | 51.6% |
| Voltkit   |  51.6% | 51.1% |
| Terradon  |  48.5% | 51.1% |
| Coilemur  |  43.5% | 50.6% |
| Auralynx  |  52.0% | 50.2% |
| Wombolder |  49.4% | 49.6% |
| Shadopus  |  47.0% | 49.0% |
| Astrabun  |  52.7% | 48.8% |
| Cindrake  |  56.1% | 48.7% |
| Mystowl   |  56.9% | 48.2% |
| Glacelle  |  50.0% | 48.0% |
| Lumoth    |  46.2% | 47.9% |
| Tidefin   |  49.2% | 47.5% |
| Sunbara   |  52.2% | 47.5% |

Range 43.5% - 56.9% to 47.5% - 53.2%, spread (sd) 3.5 to 1.8, pairs won 80%
or more 23 to 21.

- **Normal** (seeds 310000 and 320000): 46.7% - 52.7%, spread 1.9, so
  `dazeBy` is unchanged, and `RAID_DAZE_BY` with it.
- **2v2 and free-for-all**: the mode factors of every champion whose health
  changed are scaled by old / new health, so its health in those modes stays
  what the factors were tuned for. Checked on unused line-ups
  (`FRESH_BASE=7000`, 1,000 matches per difficulty): 2v2 43.6% - 55.1%,
  4-player 21.2% - 30.3%, 3-player 27.8% - 39.8%, the same ranges as after
  the smarter bots (44.0% - 54.8%, 21.1% - 28.4%, 27.9% - 39.5%) within the
  check's noise (about ±3 points a champion).
- The Spire and raid tests pass unchanged.

## Sixth pass: for skilled players

The owner's players are skilled, so this pass looks at the expert bot as
well as Hard. Among experts the roster spreads far wider (three seeds,
11,016 duels each): Hard 47.5% - 53.2% (sd 1.8), expert 20.8% - 77.9%
(sd 13.2). Shooters that keep their distance gain (Mossloth 78%, Halcyra
65%, Mystowl 64%), champions that have to walk in lose (Tidefin 21%,
Cindrake 25%): against an expert Mossloth, Terradon spends 10% of the fight
in reach, against a Hard one 19%.

The target the owner chose: Hard within about 42% - 58% and expert within
about 35% - 65%, leaving the rest of the roster alone.

**What moves the two levels apart.** Each champion's basic interval,
health and every skill's cooldown were changed one at a time (12 games a
pair, two seeds, both levels; 108 levers). In logit units no lever leans
more than about 0.5 towards either level, while the gaps are 1.0 - 1.3.
Almost every buff helps Hard more than the expert, including new mechanics
tried for this: a slow on Cindrake's basic hit, bigger Tide Needles, less
moss regeneration, and a "Regrowth" passive for Tidefin (heal after 2.5 s
unhurt: +14 on Hard, +7 on expert). Health is the one lever that leans
towards experts for some champions (Voltkit, Cindrake, Mossloth, Halcyra).
So numbers can trade one level's balance for the other's but cannot close
a champion's gap, and kit changes of the kind tried move it little.

Changes:

- **Mossloth**: health 148 (was 185), Seed Spit every 300 ms (was 345),
  Sloth Time every 9 s (was 12).
- **Tidefin**: River Dash deals 20 (was 12; the Whitewater rite 26 instead
  of 16), Tide Needle radius 6 (was 8).
- **Cindrake**: health 158 (was 148), Cinder Snap every 500 ms (was 455).
- **Normal handicaps**: Cindrake 0.49 (0.46), Tidefin 0.29 (0.27),
  Mossloth 0.29 (0.31).
- **2v2 and free-for-all**: the three champions' factors from the check on
  unused line-ups. (Scaling them by old/new health first also scaled the
  basic interval, and Mossloth reached 74% in 2v2.)
- **Spire**: every floor with one of the three as an Echo was compared with
  `main` (a solo Normal Halcyra, as the play-tests). Floors 3, 14, 17, 39,
  59 and 61 moved by more than the noise on seeds 1-72 and their armour was
  set so each clears as often as before: 3 1.65 (1.69), 14 1.68 (1.62),
  17 1.50 (1.53), 39 1.55 (1.63), 59 2.92 (2.85), 61 5.63 (5.8). Clears
  out of 72, main / now: 30 / 34, 44 / 42, 46 / 47, 27 / 26, 34 / 30,
  43 / 44. Halcyra, the play-tests' raider, is unchanged.

Results (seeds 310000 - 330000, 24 games a pair, 11,016 duels a level;
the expert here is the one before its look-ahead, #243):

| Level  | Before                  | After                   |
| ------ | ----------------------- | ----------------------- |
| Hard   | 47.5% - 53.2% (sd 1.8)  | 42.0% - 56.7% (sd 3.3)  |
| Expert | 20.8% - 77.9% (sd 13.2) | 29.7% - 67.1% (sd 10.4) |
| Normal | 46.7% - 52.7% (#240)    | 45.7% - 56.0%           |

| Champion | Hard before → after | Expert before → after |
| -------- | ------------------: | --------------------: |
| Mossloth |       51.7% → 42.0% |         77.9% → 67.1% |
| Tidefin  |       47.5% → 56.7% |         20.8% → 29.7% |
| Cindrake |       48.7% → 55.3% |         25.0% → 32.3% |

The three still sit at the edges: each has a gap of about 25 points
between the levels that no change tried here closes. 2v2 and free-for-all
on unused line-ups (`FRESH_BASE=7000`): 2v2 44.5% - 55.5%, 4-player
20.9% - 29.0%, 3-player 28.8% - 42.0% (Halcyra, unchanged).

## Live Wire replaces Spark Trail (Coilemur)

Players found Spark Trail hard to use: opponents walk round the trail. The
trail was never its worth, though. Taken away for real (the bots never cast
it), Coilemur fell from 50% to 18% on Hard: its 30% speed burst is what lets
a grappler catch a shooter. (Switching a skill off with a very long cooldown,
as the levers in the sixth pass did, still lets it be cast once at the start
and after a refund; it reported Spark Trail as worth 1.2 points. Switch a
skill off by giving it a kind the bots never choose.)

**Live Wire** (11 s): after a quarter-second wind-up Coilemur runs 30%
faster for 3.5 s and locks a wire onto the enemy nearest the aim (380 px).
For 2.5 s the enemy takes 3 every half second; if it gets more than 250 px
away the wire yanks it 220 px back, deals 6 and paralyses it for half a
second, and snaps. Walls cut it. A wire that finds nobody keeps its full
cooldown (no refund, so the speed burst can't be spammed). The rite Long
Wire (3.5 s) replaces Long Trail. Spark Trail itself stays for the Spire's
Static Wake blessing (`SPARK_TRAIL`).

Coilemur health 150 (148). Two seeds, 24 games a pair: Hard 49.9% and expert
60.5% (with Spark Trail 50.0% / 62.3%); without Live Wire it would be 19.4% /
41.4%. Normal handicap 0.31 (0.357): Normal 52.9% (39.7% before). 2v2 44.8% -
55.2%, 4-player 21.6% - 28.1%, 3-player 28.8% - 42.6% on unused line-ups.

The Spire's Coilemur Echoes became harder for the play-tests' Halcyra (a
shooter the wire keeps yanking back). Armour, so each floor clears about as
often as before (seeds 1-72, main / now): 9 1.40 (1.35) 13 / 17, 16 1.66
(1.56) 30 / 31, 63 6.8 (6.6) 33 / 29, 65 0.64 (0.60) 38 / 39, 66 4.35 (4.1)
42 / 39, 69 2.35 (2.2) 13 / 14.

## Five weak skills reworked

A skill audit switched each of the 72 skills off in turn (its kind set to
one the bots never choose) and measured how much its champion's win rate
fell, on Hard and on the expert without look-ahead (two seeds, 12 games a
pair, 408 duels a row; a drop has an error of about 3.5 points). Five did
almost nothing, re-measured on `main` with the expert's good player's hands
(drop on expert / Hard):

| Skill                             | Drop before | Why                            |
| --------------------------------- | ----------: | ------------------------------ |
| Riptide Wave (Tidefin's ultimate) |   2.2 / 2.4 | one jump clears it             |
| Scale Shrapnel (Pangrove)         |   1.0 / 0.5 | 3 weak blades with no plates   |
| Frost Breath (Glacelle)           |  -2.7 / 5.7 | a small slow; walk out of it   |
| Crest Flare (Cindrake)            |   4.7 / 6.6 | step back out of the cone      |
| Shell Up (Terradon)               |  5.9 / 11.1 | 2.5 s standing still to be hit |

(A typical skill is worth 15 - 30 points; the strongest, Shell Bash,
Facet Guard and Kindle, over 40. The audit's own expert columns were first
measured with the look-ahead on, a near-perfect dodger the look-ahead
section above says not to tune with, and with the fast hands; the numbers
here are not.)

- **Riptide Wave:** two walls of water 0.9 s apart (`wave.second`), 18 each
  (24 before), the slam 9. A jump lasts 0.65 s and comes back after 2 s, so
  one jump can't clear both: jump one and step out of the other's lane.
  Tidefin health 136 (146) pays for it.
- **Scale Shrapnel:** 6 blades plus 2 a plate (`perPlate`; 3 plus 3 a plate
  before, the same 12 at full plates), 6 damage each.
- **Frost Breath:** 4 every 0.2 s and a slow, and four breaths in a row
  freeze for half a second (`cone.freeze`, once a breath): stand in it and
  you are frozen. Range 230 (210).
- **Crest Flare:** the flame reaches from 230 px out to 300 px over the
  breath (`cone.grow`; drawn growing), so a step back no longer saves you;
  5 a tick (6). Cindrake was already the experts' strongest champion.
- **Shell Up:** 1.5 s (2.5), regrows 21 HP (30), and the shell bursts open
  at the end, shoving away everyone within 140 px by 300 px (`burst`): no
  more free hits on a shell. Rite Thick Moss: 27 HP instead of 21.

Round robins, `main` / now (24 games a pair, seeds 310000, the expert
without look-ahead):

| Champion |                        Hard |                      Expert |                      Normal |
| -------- | --------------------------: | --------------------------: | --------------------------: |
| Tidefin  |               54.4% / 58.3% |               45.3% / 52.0% |               51.0% / 56.6% |
| Cindrake |               56.1% / 53.9% |               59.6% / 59.1% |               49.5% / 44.9% |
| Terradon |               53.2% / 53.2% |               58.8% / 58.8% |               53.2% / 51.5% |
| Glacelle |               49.3% / 52.2% |               52.2% / 57.1% |               49.3% / 51.7% |
| Pangrove |               51.5% / 53.7% |               54.2% / 54.9% |               53.7% / 55.9% |
| Range    | 43.6 - 56.1% / 43.1 - 58.3% | 33.6 - 59.6% / 32.4 - 59.1% | 44.6 - 55.9% / 42.4 - 56.6% |

Voltkit is still the expert's weakest (32.4%), as on `main`.

Normal handicaps: Tidefin 0.32 (0.29), Cindrake 0.45 (0.49), so each does
about as well against Normal bots as on `main` (two seeds, 12 games a pair:
Tidefin 50.7%, Cindrake 50.2%). On unused line-ups: 2v2 44.3% - 56.5%
(Glacelle the highest), 4-player 21.1% - 28.7%, 3-player 27.7% - 42.6% (with
Live Wire: 44.8% - 55.2%, 21.6% - 28.1%, 28.8% - 42.6%).

**Spire.** The five are Echoes on 38 floors. Played by the play-tests' solo
Normal Halcyra (seeds 1-72), most floors cleared about as often as on `main`
(within 5 of 72; on average 0.9 harder), measured after the healing orbs
moved onto open ground. Six moved more, and their armour was set so each
clears about as often as before (main / now, armour): 6 31 / 33 1.2 (1.05),
14 42 / 42 1.6 (1.68), 29 33 / 34 1.69 (1.65), 37 40 / 39 1.84 (1.74),
57 38 / 37 2.85 (2.95), 62 38 / 40 3.5 (2.85).
Raids are played with the same kits, so a Tidefin, Glacelle, Pangrove,
Cindrake or Terradon raider plays these skills there too.

## Also fixed

The raids' overlap rule (`spaceOverlap` in `apps/server/src/raid.ts`) now
checks for a safe spot with 0.1 s of slack, as the Ascendant bosses already
did: raiders keep moving through the rest of the tick, so a spot only just in
reach when an attack was planned could be out of reach a moment later
(`tests/unit/raid-fairness.test.ts` caught it on Emberwing and Ascendant
Tidewyrm once the raiders' kits changed).

Ascendant Lumiwick no longer dives with an open heart into the space under
a phone's touch controls: the dive lane ends short of them, pulled back along
itself (`raid-ascendant-lumiwick.ts`). Before, an open heart could land there
and sit for about half a second while it glided out
(`tests/unit/raid-ascendant-lumiwick.test.ts`, 2 raiders, once the raiders'
kits changed).

## An expert bot for measuring

The bot win rates above come from bots that miss some counterplay any
decent player knows, so some lopsided matchups could be the bots' fault
rather than the champions'. `expert` is a bot level for measuring only
(`EXPERT_PROFILE` in `apps/server/src/bot.ts`): the behaviours below, each
behind a flag (`ExpertFlags`), first on Hard's reaction time, aim and other
settings, then (last subsection) on sharper ones. Players can't reach it: rooms still take a
`BotDifficulty` (`BOT_DIFFICULTIES`, the server's schema and the client's
pickers are unchanged) and an expert brain reports itself, and picks rites,
as Hard. Easy, Normal and Hard replay match for match as before, so raids,
the Spire and their play-tests are untouched.

```bash
npx tsx scripts/balance/round-robin.ts - <shard> <shards> <games> expert <out.json>
EXPERT_OFF=lookAway,jumpSeeds npx tsx scripts/balance/round-robin.ts ...   # ablation
npx tsx scripts/balance/tune.ts 1 24 --levels expert,hard                  # tune.ts too
```

### Behaviours kept

Each was measured with the flag off and on (48 games a pair, seed 5000,
the champion's 17 pairings, everything else on; before #235, which only
moves Pyranda against Pangrove):

| Flag         | What the expert does                                                                                                                                                                              | Measured                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lookAway`   | While Lumoth's Eyespot Flash is ready and in reach, it faces away between attacks and turns back 0.15 s before each one.                                                                          | Lumoth 45.8% → 43.3% (vs Terradon 67% → 56%, Coilemur 54% → 38%).                                                                                       |
| `jumpSeeds`  | Hops an enemy seedling in its way from the near edge, or steps round it when the hop can't clear it; a dash that would cross one jumps too, or doesn't happen.                                    | Mossloth 56.1% → 46.7% (vs Cindrake 54% → 25%, Coilemur 75% → 42%, Astrabun 50% → 33%, Terradon 94% → 85%; Auralynx the other way, 85% → 96%).          |
| `dodgeMarks` | Sees a mark 0.15 s after it appears (mortar, Chestnut Storm's creeping marks, Thunderstorm's bolts, Radiant Flare's burst), tries 16 directions and walks out, or dashes when a walk is too slow. | Pyranda 51.3% → 38.0% (vs Voltkit 83% → 52%, Sunbara 77% → 42%, Duskveil 75% → 38%, Halcyra 63% → 27%). Lumoth 52.0% → 43.3% (its flare). Voltkit +4.8. |

### Behaviours dropped

The goal was closer to players, not just different, so a behaviour that
changed nothing, or made the champion using it weaker, was dropped:

- **Holding fire under Facet Guard** made Auralynx stronger, not weaker:
  45.8% with it off, 58.5% when opponents held fire and backed off, 58.2%
  when they held only the shots the guard refracts. Shooting into the guard
  still deals half damage for 20% back; holding fire for 1.6 s deals none.
  Against divers it helped a little (Coilemur 94% → 88%) but not overall.
- **Lumoth flashing only a target seen facing it** made Lumoth weaker
  (96% → 83% against Pangrove): the flash still hurts a target looking away.
- **Looking away in spells while holding fire** (the first version of
  `lookAway`) made Lumoth stronger (Cindrake 59% → 98%).
- **Saving escapes (Tunnel, Shell Up, Facet Guard, Static Glide, the dash)
  for the enemy's ultimate**, held or only used when it comes: within the
  noise for everyone (24 games a pair, ±4) except Auralynx, 5.6 points
  weaker when it held Facet Guard back.
- **Guessing a stealthed Shadopus's position** from its last heading:
  Shadopus 38.6% → 37.9% over its pairings.
- **Playing combos on purpose.** Casting the setup out of its reach (a bug
  in the first version) sent Cindrake to 75%: a Crest Flare lit while
  closing in is very strong, worth knowing. Holding the payoff for the
  setup and spending the ultimate on any debuff made the champions doing it
  weaker (Astrabun −6.5 and −4.5 points, Terradon −4.6). Self combos (Static
  Glide, Moon Hop: also escapes) made Voltkit −4.9 and Astrabun −6.9. Only
  setups that mark the target, when the payoff is ready: no change (±2,
  Wombolder +3).

A short look-ahead (cloning the arena to try actions) was not built: the
three behaviours already account for the matchups suspected of being bot
artefacts, and the round robin stays as fast as Hard's.

### Expert against Hard (counterplay only, Hard's reactions and aim)

Both 48 games a pair, seed 5000, 7,344 matches, every match finished, with
Ember Curtain burning off Tongue Grapple (#235; it only changes Pyranda
against Pangrove, which was played again for both tables). A champion's
rate moves about ±1.8 points between seeds, a pair's about ±7.

| Champion  |  Hard | Expert | Change |
| --------- | ----: | -----: | -----: |
| Mystowl   | 51.1% |  57.4% |   +6.3 |
| Voltkit   | 47.7% |  56.3% |   +8.6 |
| Duskveil  | 49.1% |  54.9% |   +5.8 |
| Cindrake  | 55.5% |  54.7% |   −0.9 |
| Tidefin   | 54.3% |  54.5% |   +0.2 |
| Astrabun  | 54.2% |  53.3% |   −0.9 |
| Halcyra   | 48.2% |  52.7% |   +4.5 |
| Glacelle  | 49.8% |  52.3% |   +2.6 |
| Sunbara   | 47.9% |  52.1% |   +4.2 |
| Pangrove  | 50.7% |  49.9% |   −0.9 |
| Shadopus  | 48.0% |  48.7% |   +0.6 |
| Auralynx  | 51.3% |  46.8% |   −4.5 |
| Mossloth  | 51.0% |  46.7% |   −4.3 |
| Coilemur  | 46.3% |  46.6% |   +0.2 |
| Wombolder | 47.4% |  46.2% |   −1.2 |
| Terradon  | 48.7% |  45.5% |   −3.2 |
| Lumoth    | 50.6% |  43.3% |   −7.4 |
| Pyranda   | 48.2% |  38.4% |   −9.8 |

Spread (sd) 2.5 on Hard, 4.9 on Expert; pairs one side wins 80% or more of:
26 on Hard, 25 on Expert. Hard is what the champions were tuned on, so a
wider spread on Expert is expected; what matters is who moved and why.

**Bot artefacts** (gone or much smaller once the bots play the counterplay):

- Pyranda over ranged champions: Voltkit 83% → 52%, Sunbara 77% → 42%,
  Duskveil 75% → 38%, Mystowl 67% → 42%, Halcyra 63% → 27%. Most of
  Voltkit's, Duskveil's, Sunbara's and Halcyra's rise is this one matchup.
- Mossloth over melee: Cindrake, Coilemur and Astrabun now beat it.

**Real** (they stay with the expert):

- Pyranda is weak: 38%, and 15% against Pangrove (23% on Hard). The
  "90–96% against Pangrove, Voltkit and Lumoth" seen earlier is out of date:
  on `main` Pyranda wins 23%, 83% and 75% of those on Hard, and 15%, 52%
  and 79% on Expert.
- Lumoth over melee: Cindrake 94%, Pangrove 77%, even with looking away.
  Lumoth's 43% comes from its Radiant Flare being walked out of, not from
  the flash.
- Auralynx over divers: Coilemur 94%, Astrabun 90%, Pangrove 81%,
  Wombolder 81%. Not because bots hit into Facet Guard (above).
- Mossloth over Auralynx (96%) and Terradon (85%): Seed Spit kiting (about
  875 of its damage a match against Terradon, against 62 from seedlings),
  not seedlings walked onto.

**Proposals (not applied; for the owner to decide):**

- Pyranda: a buff that doesn't come back in its marks, which are now
  dodged, e.g. strength factor ×1.08 (health and Ember Lob rate), then
  check Pangrove (15%) separately.
- Lumoth: move power from the melee matchup to the flare, e.g. Radiant
  Flare's pull a little stronger and Eyespot Flash's stun a little shorter
  (0.5 → 0.4 s), so it is less of a hard counter to melee and less weak
  against the rest.
- Voltkit (56%) and Mystowl (57%) are a little high; Voltkit's gain is
  mostly the Pyranda matchup, so recheck it after a Pyranda change before
  touching Voltkit.
- Auralynx against divers: a shorter Shatter Paw stun when primed
  (0.8 s) would soften those 80–94% matchups.
- Measure each change on Expert and on Hard: Hard is what Normal's
  `dazeBy`, `RAID_DAZE_BY` and the Spire were calibrated against.

### A sharper expert

The counterplay alone left the expert level with Hard head to head (50.7%
of 1,224 duels, `difficulty-gap.ts 8 expert hard`). Asked for the smartest
bot, each setting was then sharpened alone against Hard (612 duels each):

| Setting             | Hard → tried  | Expert beats Hard |
| ------------------- | ------------- | ----------------: |
| Reaction            | 0.25 → 0.15 s |             68.5% |
| Dodge chance        | 0.55 → 0.8    |             59.5% |
| Rest (holding fire) | 0.05 → 0      |             57.4% |
| Aim error           | 0.14 → 0.08   |             54.2% |
| Decisions           | 0.12 → 0.08 s |             52.5% |
| Skill use           | 0.9 → 1       |             50.3% |
| Fooled by clones    | 0.2 → 0.05    |             50.0% |
| Engage dashes       | 0.2 → 0.35    |             47.4% |
| Leading shots       | 0.85 → 1      |             45.3% |

The expert now has reaction 0.1 s, dodge 0.9, no rests, aim error 0.08 and
0.08 s decisions (leading and engaging stay at Hard's, as more of either
made it weaker). It beats Hard in **93.0% of 1,224 duels**, and in at least
82% with any champion (Cindrake 82%, the lowest). A 0.1 s reaction is a top
player's; anything quicker would measure a machine.

The counterplay still moves the right way with the sharper mechanics (48
games a pair): `lookAway` Lumoth 48.7% → 43.3%, `dodgeMarks` Pyranda 57.6% →
46.8%; `jumpSeeds` now changes little (Mossloth 80.1% → 79.0%), as sharper
bots already keep off seedlings most of the time.

Balance at this skill is very different (48 games a pair, seed 5000, every
match finished):

| Champion  |  Hard | Counterplay only | Sharp expert |
| --------- | ----: | ---------------: | -----------: |
| Mossloth  | 51.0% |            46.7% |        79.0% |
| Mystowl   | 51.1% |            57.4% |        69.7% |
| Halcyra   | 48.2% |            52.7% |        59.7% |
| Auralynx  | 51.3% |            46.8% |        58.5% |
| Sunbara   | 47.9% |            52.1% |        57.4% |
| Glacelle  | 49.8% |            52.3% |        57.2% |
| Wombolder | 47.4% |            46.2% |        54.9% |
| Terradon  | 48.7% |            45.5% |        52.1% |
| Duskveil  | 49.1% |            54.9% |        47.1% |
| Astrabun  | 54.2% |            53.3% |        47.1% |
| Pyranda   | 48.2% |            38.4% |        46.8% |
| Shadopus  | 48.0% |            48.7% |        44.7% |
| Pangrove  | 50.7% |            49.9% |        44.5% |
| Lumoth    | 50.6% |            43.3% |        43.3% |
| Voltkit   | 47.7% |            56.3% |        42.2% |
| Coilemur  | 46.3% |            46.6% |        41.5% |
| Tidefin   | 54.3% |            54.5% |        27.5% |
| Cindrake  | 55.5% |            54.7% |        27.0% |

Spread (sd) 12.6, and 52 pairs won 80% or more (26 on Hard). Champions that
kite and punish from range (Mossloth, Mystowl, Halcyra) gain the most from
good aim and dodging; brawlers that have to walk in (Cindrake, Tidefin) lose
the most: Mossloth now beats Cindrake 98% and Coilemur 96%.

This is how the roster would sit among very good players, not among most
players, so it is not a target to tune to on its own. Use it with Hard
(`tune.ts --levels expert,hard`) when a change should hold at the top as
well. A champion out of line on both expert tables is the clearest case
for a change: Mystowl is high on both (57%, 70%), Lumoth and Coilemur low
on both. The proposals above were made on the counterplay-only table:
with the sharp expert Pyranda is 46.8%, so its buff should be small, and
Voltkit (42%) should not be cut.

### Look-ahead: using and dodging mechanics the rules don't know

The expert's rules only cast a skill whose kind has a case in `chooseSkill`
and only dodge what they were written for, so a new champion with a new
mechanic would be measured with that mechanic never used. The look-ahead
(`apps/server/src/bot-lookahead.ts`, `ExpertFlags.lookAhead`, expert only)
closes that gap by trying actions instead of knowing them:

- **When:** at most every 0.25 s, when a skill is ready with the enemy
  within 900 px, or when a shot, an enemy zone or a wind-up threatens it.
  Not in raids, and not while the enemy is stealthed (the copy would give
  its position away).
- **How:** `cloneArena` copies the match (the same state, its own random
  numbers, nothing shared; a copy plays tick for tick like the match).
  Each candidate is played ahead on its own copy. The enemy is assumed to
  go on doing what it is doing: walking the same way, attacking, aiming at
  the bot. Marks the bot hasn't had time to notice (0.15 s) are left out of
  the copies, so it reacts no faster than its rules.
- **Skills (1.4 s ahead, long enough for blasts that land late):** the
  rules' choice, holding that skill back, or each other ready skill.
  The ultimate is considered too, at a price.
- **Ways out (0.8 s ahead, when threatened):** that choice as it stands,
  eight ways to walk, and a dash and a jump along the best walk.
- **Score:** the share of health the enemy lost minus its own, plus 0.15
  for each second the enemy spends disabled (minus its own), ±1 for a
  knockout, and a small cost for the cooldown spent (0.08 for the
  ultimate).

The enemy merely being close is not a threat: counted as one, brawlers
spent fights stepping back from every swing (Cindrake 38% with the
look-ahead against the rules alone).

**Against the rules alone** (`scripts/balance/lookahead-gap.ts 4`, 612
duels, champions and sides swapped): the look-ahead side wins **77.6%**,
with every champion above half (Mossloth 97%, Tidefin and Pangrove 56%).
Matches take about six times as long to simulate, so round robins with
the expert are slower.

**New mechanics.** `scripts/balance/new-mechanic.ts` hides one skill kind
from the rules (`Profile.unknownKinds`), as if it were new, and plays the
champion against the 17 others (4 games each, opponents on rules only).
Casts a match:

| Skill (kind hidden)              | Rules know it | New to the rules | New + look-ahead |
| -------------------------------- | ------------: | ---------------: | ---------------: |
| Eyespot Flash (Lumoth, gaze)     |           2.9 |                0 |              5.5 |
| Seedling (Mossloth)              |          19.7 |                0 |             14.5 |
| Tunnel (Pangrove)                |           4.0 |                0 |              3.9 |
| Leaf Storm (Pangrove's ultimate) |           2.8 |                0 |              2.1 |
| Chestnut Storm (Pyranda's ult.)  |           3.6 |                0 |              3.1 |
| Facet Guard (Auralynx, counter)  |           4.6 |                0 |              5.5 |
| Frost Bloom (Glacelle, zone)     |           7.3 |                0 |              7.6 |
| Riptide Wave (Tidefin, wave)     |           3.2 |                0 |              2.9 |

With the kind hidden the rules never cast it, as a new mechanic would be
today; the look-ahead casts each about as often as the rules that know it.
(Its win rates there also carry its other gains, so they are not shown.)
Dodging works the same way: with `dodgeMarks` off, opponents of Pyranda were
hit by 23% of its mortars and Chestnut Storm marks; with the look-ahead and
still no dodge rule, by 13%, fewer than the 17% of the hand-written rule.

What it does not cover: payoffs later than 1.4 s (a trap left for later, a
setup cashed in seconds after), a mechanic whose worth is not health or a
disabling status (a buff to allies, vision), and an enemy that changes what
it is doing. For those, rules are still worth writing; `new-mechanic.ts`
shows whether they are needed.

**Balance with it** (24 games a pair, `main` with #240, every match
finished):

| Champion  |  Hard | Expert, rules only | Expert + look-ahead |
| --------- | ----: | -----------------: | ------------------: |
| Auralynx  | 55.9% |              60.0% |               84.1% |
| Mossloth  | 52.2% |              79.7% |               82.4% |
| Astrabun  | 47.3% |              43.1% |               71.3% |
| Coilemur  | 53.4% |              47.1% |               67.2% |
| Cindrake  | 45.3% |              26.5% |               66.9% |
| Pangrove  | 50.5% |              43.1% |               64.2% |
| Shadopus  | 51.5% |              53.7% |               61.3% |
| Wombolder | 51.5% |              59.6% |               60.5% |
| Terradon  | 50.7% |              55.9% |               56.9% |
| Lumoth    | 46.8% |              46.6% |               53.4% |
| Voltkit   | 52.7% |              40.9% |               44.4% |
| Tidefin   | 49.3% |              21.3% |               38.5% |
| Sunbara   | 45.8% |              52.2% |               36.5% |
| Halcyra   | 51.5% |              60.5% |               34.1% |
| Mystowl   | 46.1% |              60.5% |               31.4% |
| Glacelle  | 46.8% |              51.0% |               27.5% |
| Duskveil  | 51.0% |              47.8% |               10.0% |
| Pyranda   | 51.7% |              50.5% |                9.6% |

Spread (sd) 2.9, 12.7 and 21.6; pairs won 80% or more: 30, 53 and 84 of 153. When both sides dodge nearly everything, champions whose damage
waits for a mistake (Pyranda's marks, long shots, Duskveil) lose most of
it, and immediate damage and guards (Auralynx, brawlers) win. Each
champion still does better with the look-ahead than without it (Pyranda's
look-ahead beats the rules alone 85%): the table is the matchups between
two near-perfect dodgers, a level above any player.

So this table is not for tuning champions. Use the look-ahead to check
that a new champion's mechanics are used and answered (`new-mechanic.ts`).
Measure balance on Hard and on the expert without it
(`EXPERT_OFF=lookAhead`), as before.

### Self-training: a learned way of playing each champion

The expert plays every champion by the same rules. The trainer
(`scripts/balance/train-expert.ts`) learns, per champion, a few numbers
that change how those rules play it (`Style` in `apps/server/src/bot.ts`,
written to `apps/server/src/expert-style.ts`, expert only): preferred
distance (`range` for shooters, `reach` and `closeIn` for brawlers), how
far it looks for openings (`sight`), circling (`circle`), when it dashes
in, backs off or kites (`engage`, `retreat`, `kite`), a weight on each
skill (`slots`) and the lowest score a skill must reach to be cast
(`floor`). A champion missing from the file plays by the rules as written.

**How it learns (evolution with honest checks).** For each champion in
turn, six variations of its current style (two or three numbers moved at
random, within limits; only numbers that mean something for it) play the
17 others, 8 games each, on the same seeds as the current style. The best
variation is played again on a second set of games and kept only if it
wins there too and by 3 points on average over both. Four passes over the
roster took about 1.5 hours on four processes (rules only, look-ahead off:
six times faster). Progress is saved after every step, so the same command
carries on after a restart.

**The training's own numbers flatter it.** The best of six variations is
partly the luckiest, so the training kept styles for 14 champions, but
against untrained opponents on fresh games most of them won nothing:

| Champion  | Fresh set A | Fresh set B | Confirming set | Kept |
| --------- | ----------: | ----------: | -------------: | ---- |
| Mossloth  |        +7.9 |       +11.8 |           +4.5 | yes  |
| Mystowl   |        +6.5 |        +0.9 |          +11.0 | yes  |
| Shadopus  |        +6.2 |        +6.5 |            0.0 | no   |
| Lumoth    |        +5.3 |        +5.6 |           +1.8 | no   |
| Wombolder |        +2.1 |        +1.5 |                | no   |
| Pyranda   |        +1.2 |        +1.5 |                | no   |
| Auralynx  |        +4.7 |         0.0 |                | no   |
| Pangrove  |        +2.4 |        −0.3 |                | no   |
| Tidefin   |        −0.9 |        +4.7 |                | no   |
| Halcyra   |        +0.6 |        −2.6 |                | no   |
| Duskveil  |        −1.8 |        +0.6 |                | no   |
| Sunbara   |        −0.6 |         0.0 |                | no   |
| Glacelle  |        −2.4 |        −1.8 |                | no   |
| Coilemur  |        −6.2 |        −1.2 |                | no   |

(Points of win rate over the same champion with no style; sets A and B
are 340 games a side, the confirming set 510.) Shadopus and Lumoth looked
good on A and B, the very sets they were chosen on, and not on the third;
the round robin below agrees. So the trainer now ends with this check
itself: each learned style must win on two fresh sets (both positive, 2
points on average), then on a third with more games that was not used to
choose (2 points again). Styles that fail are dropped from the file.
Running the trainer again on a finished state changes nothing.

**Round robin** (expert without look-ahead, 24 games a pair, the same
seeds as the table above):

| Champion | Untrained | Trained |
| -------- | --------: | ------: |
| Mossloth |     79.7% |   84.6% |
| Mystowl  |     60.5% |   67.6% |
| Shadopus |     53.7% |   53.2% |
| Lumoth   |     46.6% |   45.1% |

The others move only through their games against those two (all other
games are identical): by up to 4 points (Voltkit 40.9% to 37.0%, Duskveil
47.8% to 44.6%). Spread 12.8 to 14.2. The untrained
column is exactly the "Expert, rules only" column above. The trained
expert plays Mossloth and Mystowl better, so they are stronger than the
untrained expert showed: worth knowing when tuning them.

(Those styles and both tables are for the expert with a 0.1 s reaction,
before the sixth pass and Live Wire. The expert now has a good player's
hands, and was trained again: see the next section.)

**After adding or changing a champion:** delete
`balance-out/train-expert.json` (or pass a new `--state`), run
`npx tsx scripts/balance/train-expert.ts` (add `--only <ids>` to train
just the new champion against the current styles), run Prettier on
`expert-style.ts`, then measure as usual. Hard, Normal and Easy never read
a style (their round robins are byte-identical to `main`), and
`tests/unit/bot-style.test.ts` checks that a style is the expert's alone
and that no style plays exactly as the rules.

What it cannot learn: anything the rules have no number for. A new kind of
skill is still the look-ahead's job (or a new rule); the trainer only tunes
how the existing rules play each champion.

### A good player's hands

The expert reacted in 0.1 s and aimed within 0.08 rad: a top player at
best, and more than anyone manages on a phone. Those hands mostly measured
how well a bot lands quick shots. It now reacts in 0.2 s and aims within
0.12 (`EXPERT_PROFILE` in `apps/server/src/bot.ts`); its dodging,
counterplay and look-ahead are unchanged.

Expert without look-ahead, the current roster (after the sixth pass and
Live Wire), 24 games a pair, the same seeds in all three columns:

| Champion  | 0.1 s, 0.08 | 0.2 s, 0.12 | and the learned style |
| --------- | ----------: | ----------: | --------------------: |
| Mossloth  |       67.4% |       59.3% |                 59.8% |
| Mystowl   |       62.7% |       49.8% |                 48.5% |
| Halcyra   |       60.5% |       50.2% |                 53.4% |
| Wombolder |       58.8% |       55.1% |                 55.4% |
| Auralynx  |       57.6% |       53.7% |                 54.9% |
| Terradon  |       57.6% |       53.2% |                 54.4% |
| Sunbara   |       52.5% |       42.9% |                 43.1% |
| Shadopus  |       50.5% |       58.1% |                 55.1% |
| Glacelle  |       50.0% |       52.5% |                 52.2% |
| Lumoth    |       49.3% |       43.9% |                 45.3% |
| Pyranda   |       49.0% |       41.2% |                 41.4% |
| Duskveil  |       45.6% |       42.4% |                 41.9% |
| Coilemur  |       44.1% |       51.7% |                 51.5% |
| Astrabun  |       42.4% |       56.4% |                 54.7% |
| Pangrove  |       42.4% |       56.4% |                 55.6% |
| Tidefin   |       39.2% |       41.9% |                 42.4% |
| Voltkit   |       39.0% |       31.6% |                 31.6% |
| Cindrake  |       31.4% |       59.8% |                 58.6% |

Spread (sd) 9.2, 7.5 and 7.3 points. Champions that win by landing many
quick shots from range fall (Mystowl −13, Halcyra −10, Mossloth −8) and
those that have to walk in rise (Cindrake +28, Astrabun and Pangrove +14).
Against the owner's band for skilled players (expert within about 35% -
65%), the fast hands put Mossloth and Cindrake outside; a good player's
hands put only Voltkit outside (31.6%), the next one to look at. Every
expert table earlier in this file, the sixth pass's included, used the
fast hands.

**Still well above Hard.** The full expert (look-ahead on) against Hard,
every pair, 4 games a pair (`difficulty-gap.ts 4 expert hard`): it wins
89.1% of 612 duels and Hard takes 19.3% of rounds (with the fast hands
96.2% and 10.9%).

**Trained again for these hands** (`train-expert.ts --rounds 4 --mutants 6
--games 8`, from scratch, a few hours on four processes, on the roster
before the sixth pass). After the final check only one style was kept:
Halcyra casts Focus Shot less (weight 0.42) and Pinning Quill more (1.29),
kites less and skips weaker casts (`floor` 0.59). It won +9.1, +7.9 and
+10.2 points on the three check sets, and again +9.4, +7.6 and +7.3 on the
current roster. The 17 others won nothing that held up on fresh games, so
they play by the rules. In the round robin only games with Halcyra change
(171 of 3,672): it gains 3.2 points, most of it from Shadopus, which beat
it 22 of 24 times and now 10.

**Mossloth and Mystowl.** The sixth pass already took Mossloth to 42.0% on
Hard, the bottom of the owner's band (42% - 58%), and with a good player's
hands it is 59.3% for experts, inside 35% - 65%. A further nerf was tried
before that pass (Seed Spit 750 px/s instead of 780: Hard −2.6, expert
−3.5) and is not shipped, since it would take Hard below the band. Mystowl
is 49.8% for experts and 44.1% on Hard, inside both bands: nothing to
change for now. Hard on the current roster (24 games a pair, the seeds
above): 43.1% (Mossloth) - 56.6% (Auralynx), Mystowl 44.1%. Hard, Normal
and Easy never read the expert's hands or styles, so this branch leaves
their numbers as they are.
