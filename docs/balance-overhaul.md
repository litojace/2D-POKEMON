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
