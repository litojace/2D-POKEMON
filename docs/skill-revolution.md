# Skill revolution

The owner's brief, after playing all eighteen champions: some skills do
little for their champion. Tidefin's Undertow barely matters and Riptide
Wave often misses; Voltkit, Duskveil and Lumoth lean on skills that only
deal damage, and their ultimates only hurt up close (Overcharge is a 190 px
ring round Voltkit, Radiant Flare 260 px rays round Lumoth). Many others
are the same. The ultimate above all must be the scariest thing in a kit:
it says what the champion is about and makes the opponent afraid.

Ideas are borrowed from other games' mechanics, never their characters,
names or art, and every kit keeps a mechanic of its own
([unique-kits.md](unique-kits.md)).

## What the bots say

`scripts/balance/skill-usage.ts` plays the round robin on the real server
and counts, for every move, how often bots cast it, how many casts land,
and the damage it deals. Before this work (seed 120000, 8 games a pair, all
eighteen champions, Hard):

| Champion | Win (Hard / Normal) | Ultimate: lands, damage a cast, share of damage | Weakest skill                                      |
| -------- | ------------------- | ----------------------------------------------- | -------------------------------------------------- |
| Tidefin  | 40% / 43%           | Riptide Wave: 28%, 7.0, 4%                      | Undertow: 5 damage a cast, rarely moves anyone far |
| Voltkit  | 46% / 46%           | Overcharge: 41%, 10.7, 3%                       | Ball Lightning: only damage                        |
| Duskveil | 45% / 57%           | Void Orb: 45%, 13.6, 8%                         | Shade Crawl: lands 20% (it is jumped)              |
| Lumoth   | 51% / 48%           | Radiant Flare: 78%, 13.3, 3%                    | Eyespot Flash: cast 2.3 times a minute (reach 220) |
| Pyranda  | 51% / 48%           | Chestnut Storm: 31%, 10.5, 7%                   | Ember Curtain: 1% of damage; Mortar lands 11%      |
| Glacelle | 46% / 54%           | Whiteout: 86%, 15.0, 9%                         | Hailstone: lands 25%                               |
| Mossloth | 49% / 48%           | Overgrowth: 40%, 11.1, 6%                       | Seedling: lands 11%                                |
| Astrabun | 55% / 49%           | Full Moon: 99%, 32.9, 17%                       | Moon Gravity: lands 22%, 1% of damage              |
| Mystowl  | 55% / 50%           | Mind Maze: 73%, 17.5, 10%                       | Booming Hoot: cast 2.4 times a minute              |
| Cindrake | 42% / 39%           | Sunfire Pillar: 85%, 11.5, 7%                   | Magma Bomb: lands 23%                              |

What stands out: the melee champions' ultimates land and hurt (Full Moon
33 a cast, Kraken Grasp 29, Electromagnet 22), the ranged ones' do not
(Overcharge 11, Riptide Wave 7, Radiant Flare 13). A ranged champion's
ultimate either has to come close (Overcharge, Radiant Flare) or is one
narrow shot (Riptide Wave). That is what the owner felt.

## What other games do

- **The strongest effect has the most counterplay** (Riot's counterplay
  posts). A guaranteed or near-guaranteed hit is fine when it is loud,
  telegraphed and can be answered: Karthus's Requiem hits everyone after a
  visible channel; Zeus's Thundergod's Wrath (Dota) strikes every enemy;
  Jinx's and Ashe's arrows cross the map, and the answer is to step aside.
- **Lockdown you can still escape**: Zarya's Graviton Surge pulls enemies
  into a well (its length was cut in Overwatch 2 because there were fewer
  answers); Mordekaiser's realm can be won by the target.
- **A hero moment that doesn't decide the match** (Brawl Stars'
  Hypercharge), short (Smash's Final Smashes stay under ~5 s), and never
  more than about 1.5 s of hard control in a row.
- **Weak skills get one clear job, a floor and a ceiling, and a link to the
  rest of the kit** (Udyr's and Skarner's reworks; Torbjörn and Symmetra in
  Overwatch: numbers alone could not save them). A skill that only deals
  damage gets utility.

So for the ultimates here: long reach or the whole court, a clear warning,
a clear answer (jump it, step out of the mark, dash out of the pull, run
from the thing that hunts you), and a payoff no other skill in the kit has.

## Wave A: Tidefin, Voltkit, Duskveil, Lumoth

| Champion | Was                                                        | Now                                                                                                                                                                                                                                                                  | Borrowed from                                                        |
| -------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Tidefin  | **Undertow**: a current along the aim that sweeps enemies  | **River Dash** (9 s): Tidefin shoots 300 px along the aim on a jet of water, **through** enemies: each one it passes takes 12 and is Soaked. Pass through anyone and the cooldown drops to 2.5 s: dash in, dash out                                                  | dashes that reset on a hit (Irelia, Yasuo; Brawl Stars' Mortis)      |
| Tidefin  | **Riptide Wave** (ult): one 42 px wave that often missed   | **Riptide Wave** (ult): a **wall of water 380 px wide** rolls from Tidefin along the aim across the whole court, over cover. Enemies it reaches take 24 and are **carried** up to half a second; carried into a wall, 12 more and stunned. Jump over it              | map-wide lines (Jinx, Ashe), Nami's Tidal Wave, Harbor's High Tide   |
| Voltkit  | **Ball Lightning**: a slow orb that bursts                 | **Ball Lightning** (10 s): a slow orb that flies **through** enemies, zapping the nearest one within 150 px every 0.3 s (4), and bursts at the end of its flight for 16. Easy to land, keeps an area hot                                                             | Moira's Biotic Orb, chain lightning                                  |
| Voltkit  | **Overcharge** (ult): a 190 px ring round Voltkit          | **Thunderstorm** (ult): a storm over the whole court. **Three bolts on every enemy in sight**, 0.8 s apart: each marks the ground under it and strikes 0.65 s later (75 px, 14 and a short paralysis). Keep moving and you dodge them; stand still and eat all three | Zeus's Thundergod's Wrath (Dota), Karthus's Requiem, telegraph marks |
| Duskveil | **Shade Crawl**: a fast ground strike, jumped 80% of casts | **Shade Crawl** (8 s): the shadow crawls out and **binds** the first enemy's shadow: 16 and **rooted** 0.7 s (it can still attack). Not a ground move any more: sidestep it. Lit targets: 25% more and 1.1 s                                                         | skill-shot binds (Morgana, Lux)                                      |
| Duskveil | **Void Orb** (ult): a big slow orb                         | **Wraith Hunt** (ult): a wraith leaves the lantern and **hunts** the nearest enemy in sight for 5 s, through walls, a little slower than anyone walks. Its touch deals 7 every 0.4 s, and **reaps** an enemy under 25% health. Run from it, or stand and be taken    | executes (Pyke), being hunted (Fiddlesticks, Nocturne)               |
| Lumoth   | **Radiant Flare** (ult): rays turning round Lumoth         | **Radiant Flare** (ult): a flare shot up to 650 px away **hangs like a little sun** for 2 s. Enemies within 300 px are **drawn to the light** (150 px a second), then it bursts: 30 and stunned 0.6 s within 140 px. Dash out of the pull                            | Graviton Surge, Orianna's Shockwave; moths drawn to a flame          |

Kept as they were: Tidefin's Tide Needle, Gill Siphon and Tide Double;
Voltkit's Spark Dart, Static Lance and Static Glide; Duskveil's Lantern
Wisp, Ghostfire and Haunted Lantern; Lumoth's Glint, Wing Dust, Eyespot
Flash and Kindle. They work (Gill Siphon is a fifth of Tidefin's damage,
Wing Dust lands 81%) or are the kit's defence.

Why each is better:

- **River Dash** gives the "agile assassin" the dash it never had, ties
  into the Soaked combo (now River Dash → Riptide Wave), and rewards going
  through someone rather than hitting a button: two dashes in a row, in and
  out, if you take the risk.
- **Riptide Wave** can't be missed by aiming badly: it is as wide as a
  quarter of the court and crosses all of it. The answer is timing a jump,
  which every player has.
- **Ball Lightning** keeps hurting whoever stands near its path, so it
  zones as well as damages: a Voltkit can deny a corridor while kiting.
- **Thunderstorm** reaches anyone on the court, the Voltkit way: from a
  distance, and fast. It needs no aim and still has a clear answer (keep
  moving), and a stealthed Shadopus is safe from it.
- **Shade Crawl** becomes the setup the kit lacked: a rooted enemy stands
  in the Haunted Lantern's light and in front of the wraith.
- **Wraith Hunt** is the trickster's horror: it follows you through walls
  and the low-health threat is shown to the hunted, so it changes how the
  opponent plays for five seconds even when it never touches them.
- **Radiant Flare** reaches 650 px, and the pull then the burst is a
  combo in one button that anyone can see coming.

### New mechanics

- **Surf** (`kind: "surf"`): a dash at `speed` for `range` px along the aim
  (predicted on the client like Facet Guard's vault). Every enemy the body
  passes is hit once; if any was, the cooldown is set to `surf.refund`.
- **Wave** (`kind: "wave"`): a zone that starts at the caster and whose
  front moves at `speed` along `angle` until it has gone `range`. An enemy
  (not jumping) the front reaches is hit once and gets the `current` status
  (the drift Undertow used, so the client predicts it) at the wave's speed
  for up to `wave.carry` seconds; if the drift is blocked by a wall it is
  slammed (`wallSlam` of the damage, plus `status`).
- **Aura projectile** (`aura` on a projectile): it does not stop on
  enemies; every `aura.tick` it zaps the nearest enemy within `aura.radius`
  in sight for `aura.damage` (a `beam` event from the orb), and explodes at
  the end of its flight.
- **Storm** (`kind: "storm"`): `count` waves of bolts `tickInterval`
  apart. Each wave puts a bolt zone (radius `explosion`) under every enemy
  in sight of nothing (stealthed enemies are skipped), striking after
  `tickDelay`.
- **Root** (status, already Mossloth's): Shade Crawl uses it.
- **Hunt** (`kind: "hunt"`): a zone that moves at `hunt.speed` toward the
  nearest enemy that is not stealthed (through walls), hurting enemies it
  touches every `tickInterval`; an enemy (not a raid boss) under
  `hunt.execute` of its full health is knocked out by the touch.
- **Lure** (`kind: "lure"`): a zone at the aim; enemies within `radius`
  drift toward it at `lure.speed` (`current` again), and when it ends it
  bursts within `explosion` (damage and `status`).

## Later waves (proposals, to be measured first)

| Champion | Skill          | Problem (bots)                        | Idea                                                                                    | Borrowed from       |
| -------- | -------------- | ------------------------------------- | --------------------------------------------------------------------------------------- | ------------------- |
| Pyranda  | Chestnut Storm | lands 31%                             | a barrage that walks across the court in a line of strikes                              | Brimstone, Sova     |
| Pyranda  | Ember Curtain  | 1% of damage                          | a curtain you can walk through to gain speed (allies too)                               | Lúcio, wall buffs   |
| Mossloth | Overgrowth     | lands 40%, only up close              | a garden over a wide area that roots whoever stays on it                                | Viper's Pit         |
| Astrabun | Moon Gravity   | lands 22%, 1% of damage               | low gravity on Astrabun: it jumps far and lands with a pound                            | Pokémon UNITE jumps |
| Mystowl  | Booming Hoot   | rarely cast                           | Hush: a silence (no skills, 1 s) in a ring, the only one in the game                    | Sombra's hack       |
| Cindrake | Magma Bomb     | lands 23%                             | a bomb that sticks to whoever it hits and goes off a moment later, bigger with each hit | Tristana's charge   |
| Glacelle | Hailstone      | lands 25%                             | wider and slower, or splits on a wall                                                   | —                   |
| Coilemur | Electromagnet  | pulls like Lumoth's new Radiant Flare | polarity: pull or push depending on the charge left on the enemy                        | magnet games        |
| Others   | ultimates      | the melee ones already land and hurt  | checked once the waves above are in                                                     | —                   |

These are ideas, not decisions: each will be measured the same way before
and after, and shipped in its own wave.
