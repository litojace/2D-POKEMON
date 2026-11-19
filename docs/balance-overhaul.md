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
(`EXPERT_PROFILE` in `apps/server/src/bot.ts`): Hard's reaction time, aim
error and every other setting, plus the behaviours below, each behind a
flag (`ExpertFlags`). Players can't reach it: rooms still take a
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
the champion's 17 pairings, everything else on):

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

### Expert against Hard

Both 48 games a pair, seed 5000, 7,344 matches, every match finished. A
champion's rate moves about ±1.8 points between seeds, a pair's about ±7.

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
| Pangrove  | 52.1% |  50.2% |   −1.8 |
| Shadopus  | 48.0% |  48.7% |   +0.6 |
| Auralynx  | 51.3% |  46.8% |   −4.5 |
| Mossloth  | 51.0% |  46.7% |   −4.3 |
| Coilemur  | 46.3% |  46.6% |   +0.2 |
| Wombolder | 47.4% |  46.2% |   −1.2 |
| Terradon  | 48.7% |  45.5% |   −3.2 |
| Lumoth    | 50.6% |  43.3% |   −7.4 |
| Pyranda   | 46.8% |  38.0% |   −8.8 |

Spread (sd) 2.6 on Hard, 5.0 on Expert; pairs one side wins 80% or more of:
27 on Hard, 25 on Expert. Hard is what the champions were tuned on, so a
wider spread on Expert is expected; what matters is who moved and why.

**Bot artefacts** (gone or much smaller once the bots play the counterplay):

- Pyranda over ranged champions: Voltkit 83% → 52%, Sunbara 77% → 42%,
  Duskveil 75% → 38%, Mystowl 67% → 42%, Halcyra 63% → 27%. Most of
  Voltkit's, Duskveil's, Sunbara's and Halcyra's rise is this one matchup.
- Mossloth over melee: Cindrake, Coilemur and Astrabun now beat it.

**Real** (they stay with the expert):

- Pyranda is weak: 38%, and 8% against Pangrove (0% on Hard). The
  "90–96% against Pangrove, Voltkit and Lumoth" seen earlier is out of date
  since the Pangrove rework (#233): on `main` it is 0%, 83% and 75% on Hard,
  and 8%, 52% and 79% on Expert.
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
  check Pangrove (8%) separately.
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
