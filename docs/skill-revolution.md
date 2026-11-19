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

| Champion | Was                                                        | Now                                                                                                                                                                                                                                                                                                                       | Borrowed from                                                        |
| -------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Tidefin  | **Undertow**: a current along the aim that sweeps enemies  | **River Dash** (9 s): Tidefin shoots 300 px along the aim on a jet of water, **through** enemies: each one it passes takes 12 and is Soaked. Pass through anyone and the cooldown drops to 3 s: dash in, dash out                                                                                                         | dashes that reset on a hit (Irelia, Yasuo; Brawl Stars' Mortis)      |
| Tidefin  | **Riptide Wave** (ult): one 42 px wave that often missed   | **Riptide Wave** (ult): a **wall of water 380 px wide** rolls from Tidefin along the aim across the whole court, over cover. Enemies it reaches take 24 and are **carried** up to half a second; carried into a wall, 12 more and stunned. Jump over it                                                                   | map-wide lines (Jinx, Ashe), Nami's Tidal Wave, Harbor's High Tide   |
| Voltkit  | **Ball Lightning**: a slow orb that bursts                 | **Ball Lightning** (10 s): a slow orb that flies **through** enemies, zapping the nearest one within 150 px every 0.3 s (4), and bursts at the end of its flight for 12. Easy to land, keeps an area hot                                                                                                                  | Moira's Biotic Orb, chain lightning                                  |
| Voltkit  | **Overcharge** (ult): a 190 px ring round Voltkit          | **Thunderstorm** (ult): a storm over the whole court. **Three bolts on the enemy nearest the aim, wherever it is**, 0.8 s apart: each marks the ground where it is heading and strikes 0.55 s later (95 px, 16 and a short paralysis). Change direction and you dodge them; run straight or stand still and eat all three | Zeus's Thundergod's Wrath (Dota), Karthus's Requiem, telegraph marks |
| Duskveil | **Shade Crawl**: a fast ground strike, jumped 80% of casts | **Shade Crawl** (8 s): the shadow crawls out and **binds** the first enemy's shadow: 14 and **rooted** 0.4 s (it can still attack). Not a ground move any more: sidestep it. Lit targets: rooted 0.9 s                                                                                                                    | skill-shot binds (Morgana, Lux)                                      |
| Duskveil | **Void Orb** (ult): a big slow orb                         | **Wraith Hunt** (ult): a wraith leaves the lantern and **hunts** the nearest enemy in sight for 3 s, through walls, a little slower than anyone walks. Its touch deals 5 every 0.5 s, and **reaps** an enemy under 20% health. Run from it, or stand and be taken                                                         | executes (Pyke), being hunted (Fiddlesticks, Nocturne)               |
| Lumoth   | **Radiant Flare** (ult): rays turning round Lumoth         | **Radiant Flare** (ult): a flare shot up to 650 px away **hangs like a little sun** for 2 s. Enemies within 200 px are **drawn to the light** (190 px a second), then it bursts: 24 and stunned 0.6 s within 150 px. Dash out of the pull                                                                                 | Graviton Surge, Orianna's Shockwave; moths drawn to a flame          |

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
- **Storm** (`kind: "storm"`): `count` bolts `tickInterval` apart. Each
  puts a bolt zone (radius `explosion`) ahead of the enemy nearest the
  caster's aim (anywhere; a stealthed one is skipped), striking after
  `tickDelay`. It first struck every enemy, which grew with their number:
  in the Spire's waves a Voltkit raider cleared floor 19 23 times in 24
  (9 before).
- **Root** (status, already Mossloth's): Shade Crawl uses it.
- **Hunt** (`kind: "hunt"`): a zone that moves at `hunt.speed` toward the
  nearest enemy that is not stealthed (through walls), hurting enemies it
  touches every `tickInterval`; an enemy (not a raid boss) under
  `hunt.execute` of its full health is knocked out by the touch.
- **Lure** (`kind: "lure"`): a zone at the aim; enemies within `radius`
  drift toward it at `lure.speed` (`current` again), and when it ends it
  bursts within `explosion` (damage and `status`).

### Results

Bot duels, every pair both ways (32 games a pair): Hard Voltkit 50%,
Tidefin 56%, Lumoth 49%, Duskveil 55%; Normal 47%, 47%, 52%, 53% (Normal
`dazeBy` 0.24, 0.215, 0.19 for the first three; raids keep the old values).

## Wave B: Cindrake, Pyranda, Mossloth, Mystowl, Astrabun

| Champion | Was                                                           | Now                                                                                                                                                                                                                              | Borrowed from                                   |
| -------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Cindrake | **Magma Bomb**: a fireball that landed 23% of casts           | **Magma Leap** (13 s): leap up to 320 px toward the aim, **airborne** on the way (ground attacks miss), and land in an eruption: 16 and a burn within 110 px. The burst fighter's way in, and the Scorched combo's payoff        | leaps that land in a blast (Tristana, Pantheon) |
| Pyranda  | **Chestnut Storm** (ult): one big circle far away, 31% landed | **Chestnut Storm** (ult): a storm that **creeps along the aim**, over walls: five blasts 115 px wide from 160 px out to 760 px, 0.15 s apart, each marked 0.6 s before it lands (26, a burn, a shove). Step out of the line      | creeping barrages (Brimstone, artillery)        |
| Mossloth | **Overgrowth** (ult): vines round Mossloth only, 40% landed   | **Overgrowth** (ult): a **garden at the aim** (up to 560 px, 230 px wide) for 2.5 s: 5 every half second and a slow; whoever is still on it at the end takes 26 and is rooted 1.2 s. Seedlings bloom, moss grows full, as before | area denial (Viper's Pit)                       |
| Mystowl  | **Booming Hoot**: a knockback ring, rarely worth casting      | **Hush** (12 s): enemies within 200 px take 10, are pushed back a little and are **Silenced** for 1.2 s: no skills (they can still move, dash and attack). Sets up Mind Maze (Dazed). The only silence in the game               | silences and lockouts (Sombra's hack)           |
| Astrabun | **Moon Gravity**: a float patch, 1% of its damage             | **Sticky Mochi** (13 s): a ball of mochi; the first enemy hit takes 8 and is **Grounded** for 0.9 s: it can't dash or jump. A diver's answer to escapes                                                                          | "grounded" effects (anti-mobility)              |

### New mechanics

- **Leap** (`kind: "leap"`): a dash to the aim (up to `range`) at `speed`
  with `jumpUntil` set for its length; when it ends (`stepLeaps`) a burst
  event and the eruption. Predicted on the client like a vault.
- **Creep** (`kind: "creep"`): `count` plain zones along the aim, the first
  `creep.start` px out and each `creep.step` farther, marked `creep.gap`
  seconds apart and landing `tickDelay` after they are marked.
- **Garden** (`kind: "garden"`): a zone at the aim that hurts and slows on
  every tick and, when it ends, hits whoever is still on it with
  `garden.burst` and `status`.
- **Silence** (status): the server ignores the fighter's skill presses, and
  the client doesn't predict them.
- **Grounded** (status): no dash and no jump (server and prediction).

### Results

Bot duels, every pair of champions both ways (32 games a pair), against
the kits before the wave (wave B against wave A's):

| Champion | Hard: before → after | Normal: after |
| -------- | -------------------- | ------------- |
| Cindrake | 51% → 54%            | 53%           |
| Mystowl  | 43% → 51%            | 51%           |
| Pyranda  | 49% → 46%            | 52%           |
| Astrabun | 47% → 54%            | 52%           |
| Mossloth | 44% → 47%            | 50%           |

Normal bots play a little worse through `dazeBy` (`bot.ts`): Astrabun's
went to 0.3 and Cindrake's to 0.44. Raids and the Spire keep the old values
(`RAID_DAZE_BY`), so their tuning holds. Ascendant Lumiwick's fight
(Spire floor 60) needed two fixes for the new kits: its lane keeps clear
of the controls and the open heart can't be attacked under them.

### Effect budget

Cindrake was over the effect budget (`tests/visual/effect-budget.spec.ts`)
once its ultimate was measured, and much more on a fast phone than the
test showed here: a trail emits at most once a frame, and the harness
ticked the arena once a frame too, so at 12 fps it saw a fifth of Crest
Flare's flames and never saw the later casts at all (they landed in Crest
Flare's channel and were refused). The harness now keeps the arena on real
time and measures at High. Measured with trails at their full rate, it
was glow 1.30 and smoke 2.39 screens (the limits are 0.6 and 1), and is
now 0.39 and 0.67 at most: Crest Flare's flame stream is three flames every
0.06 s (it was four every frame), its smoke a small puff every 0.2 s;
Sunfire Pillar's column is slimmer, stops just above the top of the view,
and its strike flash is drawn once; Heat Cracks' and Magma Leap's flames
and smoke are lighter.

## Wave C: Glacelle, Halcyra, Sunbara, Coilemur, Shadopus, Auralynx

Bots first (seed 140000, 8 games a pair, Hard): only one skill here did
little. Glacelle's **Hailstone** landed 26% of casts for 5 damage a cast;
the others do their job (Electromagnet lands 95% and deals 22 a cast; it
pulls round Coilemur, not at range like Radiant Flare, so they don't
overlap), and Sunbara's heals and Shadopus's stealth don't show up as
damage.

| Champion | Was                                          | Now                                                                                                                                                                                                                                    | Borrowed from                     |
| -------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Glacelle | **Hailstone**: a slow skill shot, landed 26% | **Black Ice** (13 s): glaze the ground at the aim (600 px, 120 px wide) for 2 s: enemies on it **slide**, with almost no grip (they skid on when they let go and turn slowly), and take 3 every half second. The Chilled combo's setup | ice physics, slippery-floor games |

Black Ice uses the sliding status Moon Gravity had (wave B removed Moon
Gravity, so nothing used it): the only slippery ground in the game. Its
point is the kit around it: an enemy skidding on the ice can't step out of
Frost Bloom's delayed freeze or Whiteout's gusts. With bots (32 games a
pair, Hard), Frost Bloom deals 6.4 a cast with Black Ice in the kit against
5.4 with Hailstone; a first try (150 px wide, 3.5 s) lifted it to 62% landed
and Glacelle to 74%, so the ice is smaller and shorter now.

Kept: Halcyra is the Spire's play-test raider, so any change to its kit
moves every floor's clear rate. A wider Pinning Quill (18 px instead of 12) lifted it from 42% to 48% on Hard, but the raider then cleared floors
31, 39, 61 and 69 less often (69: 11 → 5 in 48), so it stays as it was.
Coilemur's Magnet Lash, wider and faster (20 px, 10 s), lifted Coilemur
from 47% to 51% but made a Coilemur Echo harder: zone 1's floor 9 went
from 14 to 9 clears in 48. It stays as it was too.

### Results

Bot duels, every pair both ways (seed 145000, 32 games a pair), before →
after:

| Champion | Hard      | Normal    |
| -------- | --------- | --------- |
| Glacelle | 45% → 49% | 52% → 54% |
| Halcyra  | 44% → 43% | 47% → 50% |
| Sunbara  | 53% → 51% | 45% → 52% |
| Coilemur | 47% → 46% | 51% → 50% |
| Shadopus | 46% → 46% | 51% → 51% |
| Auralynx | 48% → 49% | 50% → 49% |

Normal `dazeBy`: Glacelle 0.26 → 0.24, Halcyra 0.175 → 0.165, Sunbara
0.225 → 0.21 (raids and the Spire keep the old ones, `RAID_DAZE_BY`).
Halcyra stays a little under 45% on Hard, as it was before this wave; a
buff has to be measured against the Spire's floors (see above).

The Spire's floors clear as often as before (48 seeds each: floors 9, 31,
61 the same, 11 a little more often: 40 against 36). Zone 2's play-test
now plays 24 seeds, like the other zones: with 12, floors 11 and 19 tied
at 9 clears each, and on the kits before this wave 24 seeds gave floor 19
more clears than floor 11 (19 against 18), so 12 seeds had passed by luck.

## Wave D: Terradon, Wombolder, Pangrove (and Pyranda again)

Bots (seed 150000, 32 games a pair), Hard / Normal: Terradon 52% / 53%,
Wombolder 46% / 51%, Pangrove 55% / 50%, Pyranda 50% / 56%. Every skill of
the three does its job (Grudge Thump lands 93% of casts, Pinball 70%,
Scale Shrapnel 75%; Mud Mire and Shell Up are control and defence), so
their kits stay.

The two proposals left from the first survey were measured again and
dropped:

- **Ember Curtain** (Pyranda) deals 1% of Pyranda's damage, but its job is
  defence: it burns up enemy shots, which the damage count doesn't see,
  and Pyranda wins half its duels. Chestnut Mortar lands 10% of casts: its
  0.6 s mark is what makes it fair, and it zones more than it hits.
- **Electromagnet** (Coilemur) lands 95% of casts for 22 a cast, and pulls
  round Coilemur rather than at range like Radiant Flare: no overlap to
  fix.

Only Pyranda's Normal bot changed: `dazeBy` 0.36 → 0.375, which took it
from 56% and 53% (two seeds) to 50% and 49%. Raids and the Spire keep 0.36.

## Where every champion ends up

After the four waves every champion's skills each have a job. A round robin
of all eighteen on the final kits (seed 160000, 16 games a pair, about 540
duels each; one standard deviation is about 2 points):

| Bots   | Lowest                                   | Highest                                   |
| ------ | ---------------------------------------- | ----------------------------------------- |
| Hard   | Coilemur 44%, Auralynx 45%, Mossloth 46% | Terradon 54%, Duskveil 54%, Cindrake 56%  |
| Normal | Pangrove 44%, Voltkit 45%, Auralynx 46%  | Shadopus 56%, Wombolder 56%, Cindrake 56% |

Everyone else is between 46% and 54%. Halcyra, which the per-wave runs put
at 42%–44% on Hard, is at 50% here: the per-wave numbers are each against
one seed, and the wave's champions' opponents changed with every wave. The
next tuning pass should start from this table (Cindrake is the highest on
both), and Halcyra's numbers still go through the Spire's floors first.

Not covered here: the 2v2 and FFA tuning factors (`TEAM_TUNING`,
`FFA_TUNING`) were set before the new kits and should be measured again.

## Pangrove rework: Tunnel and Leaf Storm

The owner found Pangrove's curl-up skills weak: Curl & Roll (a ball you
steer) and Pinball (a ricochet off walls) did little that players noticed.
Both are replaced. Ideas come from other games' mechanics, never their
characters, names or art:

| Slot     | Was                                                       | Now                                                                                                                                                                                                                                                                                                                                                | Borrowed from                                                                         |
| -------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 3        | **Curl & Roll** (12 s): a ball you steer, 30% less damage | **Tunnel** (14 s): underground for up to 1 s, 10% faster. Nothing can hit it (no damage, status or knockback; enemy skills don't see it) and it can't attack, but its mound of dirt shows everyone where it is. Casting it again, or time running out, brings it up: 12 damage within 110 px, enemies flung 140 px, and an armour plate grows back | Rek'Sai's Burrow (League), Sand King's Burrowstrike (Dota 2), real pangolins' burrows |
| Ultimate | **Pinball**: ricochet off up to 4 walls, 22 a stretch     | **Leaf Storm**: for 2.5 s three blades of leaf plates circle 150 px out (5.2 radians a second). Pangrove walks at full speed and is Braced. Each blade sweeps from Pangrove out to its tip: 4 damage, a 0.4 s slow and a 30 px shove, at most once every 0.35 s. At the end the storm bursts: 20 damage within 300 px                              | Garen's Judgment (League), Bladestorm (Warcraft III), spinning brawlers (Brawl Stars) |

Unique mechanics ([unique-kits.md](unique-kits.md)): no other champion goes
untargetable (Shadopus's stealth is broken by any hit and can still be hit;
Halcyra's rewind and Astrabun's blinks are instant), and nothing else in the
game orbits blades round its caster (Lumoth's turning rays went in wave A;
Auralynx's crystal shards are only decoration). Counterplay: the mound is
always visible, so step away from where it will come up; the storm's reach
is drawn on the ground and its edge brightens before the burst, so walk out
of it.

Pairs: Tongue Grapple pulls Pangrove in, Leaf Storm can be cast straight
out of a tunnel (it surfaces first), and coming up regrows a plate for
Scale Shrapnel. Rites: Deep Tunnel (1.4 s), Upheaval (comes up over 150 px,
major) and Gale Force (4 blades, major) replace Long Roll, Spiked Ball and
Bank Shot.

### What the bots showed

The first version (Tunnel stunning 0.4 s and dealing 16, a storm of 6-damage
blades that hit only on a ring 150 px out, no basic attacks during it)
won 95% on Hard. Curl & Roll and Pinball had kept Pangrove from attacking
for about 30 seconds of every minute; Tunnel and the storm don't, and Scale
Swipe went from 42 casts a minute to 64. Taking skills away one at a time
(32 games a pair, Hard, an in-between version):

| Pangrove has                     | Hard  |
| -------------------------------- | ----- |
| neither (only Grapple, Shrapnel) | 25.7% |
| Leaf Storm only                  | 49.6% |
| Tunnel only                      | 66.5% |
| both                             | 86.4% |

The surfacing stun was most of Tunnel's weight: a 0.3 s stun alone was
worth about 25 points (it cancels wind-ups and opens the ultimate), so
coming up now flings enemies away instead (no stun, and the push takes them
out of Pangrove's own reach). Blades that hit only on their ring let melee
champions stand in the eye: Pangrove won 6% against Auralynx that way (16 games). Each blade now sweeps
its whole spoke. With Pangrove unable to attack during the storm it was worth
less than nothing (66% without it against 52% with it), so basic attacks
carry on. Then Pangrove's base stats, tuned for a kit that spent half its
time curled up, came down: health 164 → 140.

### Results

Bot duels against all seventeen others, 48 games a pair (816 duels per
row; one standard deviation is about 1.8 points):

| Kit                  | Seed   | Hard  | Normal | Hard: lowest / highest matchups                   |
| -------------------- | ------ | ----- | ------ | ------------------------------------------------- |
| Curl & Roll, Pinball | 170000 | 52.9% | 49.9%  | Terradon 27, Cindrake 27 / Pyranda 88, Halcyra 79 |
| Tunnel, Leaf Storm   | 170000 | 51.7% | 50.4%  | Auralynx 21, Mystowl 27 / Glacelle 83, Pyranda 96 |
| Tunnel, Leaf Storm   | 180000 | 50.2% | 51.0%  | Auralynx 10, Lumoth 15 / Glacelle 85, Pyranda 90  |

Normal's spread is narrower (27%–73% on both seeds), so its handicap
(`dazeBy` 0.393) stays. The matchups spread wider than before at both ends:
Auralynx's Facet Guard halves both Leaf Storm and Scale Swipe, and Lumoth's
Eyespot Flash and Glint wear a 140-health Pangrove down; Pyranda and Glacelle
can't kite a target they can't hit. Pyranda was already Pangrove's easiest
matchup (88%).

Per skill (`skill-usage.ts`, seed 170000, Hard; 16 games a pair before, 32
after), before → after:

| Skill                | Lands     | Damage a cast | Share of damage |
| -------------------- | --------- | ------------- | --------------- |
| Curl & Roll → Tunnel | 59% → 54% | 12.1 → 6.3    | 9% → 5%         |
| Pinball → Leaf Storm | 68% → 97% | 18.1 → 20.0   | 10% → 10%       |
| Scale Shrapnel       | 75% → 75% | 16.2 → 17.0   | 15% → 15%       |

Tunnel's damage is small on purpose: its job is the escape and the way in,
and an enemy flung away. Leaf Storm lands almost every cast and deals the
most of any cast in the kit.

**Spire.** Pangrove is an Echo on zone 1's floors 2-4 and 6-9 and on floors
32 and 62. Floors 1-4 and 6 play Easy Echoes (no daze), the rest Normal.
With the raid daze it had (0.405), zone 1's floor 9 cleared 9 times in 48
(Halcyra solo) against 12 before; `RAID_DAZE_BY.pangrove` is now 0.38: 11 in
48 on floor 9, and floor 7 35 against 34. Floor 3 (Easy Echoes, 48 seeds)
went from 17 to 13 clears, about 1.3 standard deviations: left as it is.

**2v2 and free-for-all** (`tune-teams.ts --only pangrove`, two rounds of
1,000 fresh line-ups per difficulty, then a check on unused line-ups,
`FRESH_BASE=7000`):

| Mode                  | Fair  | Tuning rounds | Check         | Factor        |
| --------------------- | ----- | ------------- | ------------- | ------------- |
| 2v2                   | 50%   | 49.3%, 48.4%  | 46.3% (0.948) | 0.948 → 0.965 |
| 4-player free-for-all | 25%   | 20.2%, 28.6%  | 24.3%         | 0.984 (same)  |
| 3-player free-for-all | 33.3% | 29.3%, 30.3%  | 34.9% (1.06)  | 1.02 → 1.06   |

**Effect budget** (`tests/visual/effect-budget.spec.ts`): Pangrove's heaviest
frame is 0.02 screens of glow and 0.08 of smoke (limits 0.6 and 1). The
blades are solid leaves drawn each frame (no glow), and the storm's edge is
drawn inside `fx.essential`, so Low graphics keep the warning.
