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
