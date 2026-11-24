# Every kit its own

Eighteen champions, seventy-two skills. Some of those skills were the same
skill twice: a second damage barrier, a second counter, a second decoy, two
plain fans of shots, two shots that only slowed. This is the plan, and the
record, of giving each copy a mechanic no other champion has. The original
stays with the champion it fits best; the copy changes. Ideas are borrowed
from other games' mechanics, never their characters.

It ships in waves, one pull request each:

| Wave | What                                   | Skills                                                                                |
| ---- | -------------------------------------- | ------------------------------------------------------------------------------------- |
| 1    | Exact copies                           | Gill Spray, Tail Wrap, Mirage Perch, Pebble Spray, Rump Block, Pinning Quill, Ink Jet |
| 2    | Melee stun strikes and knockback novas | Six stun strikes (two stay, four change) and four novas (two stay, two change)        |
| 3    | Slow zones and zone ultimates          | Eddy, Moon Gravity, Spark Tether, Sunfire Pillar, Silent Swoop                        |

## Wave 1: exact copies

| Champion  | Was                                                    | Copy of                | Now                                                                                                                                                                                                                   | Borrowed from                       |
| --------- | ------------------------------------------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Tidefin   | **Gill Spray**: three droplets in a fan                | Wing Dust, Ghostfire   | **Gill Siphon** (10 s): a stream locks onto the enemy nearest the aim (380 px) for 2.1 s, 3 damage every 0.3 s, half drunk back; snaps past 430 px or out of sight. Nobody in reach gives the cooldown back but 1.5 s | life-drain beams                    |
| Pyranda   | **Tail Wrap**: 60% less damage for 3 s                 | Mystowl's Wing Cloak   | **Ember Curtain** (10 s): a 240 px curtain of embers across the aim, 90 px out, for 3 s. Enemy shots that touch it burn up; enemies on it take 7 every half second and catch fire                                     | projectile-eating walls             |
| Halcyra   | **Mirage Perch**: a decoy that eats a shot, plus speed | Tidefin's Tide Double  | **Halcyon Rewind** (17 s): dive back to where Halcyra was 2 s ago and win back 40% of the health lost since (at most 18)                                                                                              | time-rewind escapes                 |
| Halcyra   | **Pinning Quill**: a shot that slows                   | half the roster        | **Pinning Quill** (8 s): pins on a 110 px **leash** for 1.4 s; it can fight but can't leave the circle                                                                                                                | tethers that hold a target in place |
| Wombolder | **Pebble Spray**: five pebbles in a fan                | Wing Dust, Ghostfire   | **Bush Boomerang** (8 s): flies out 460 px (or to the first wall) and comes back to Wombolder through walls, hitting on the way out and again on the way back                                                         | boomerangs                          |
| Wombolder | **Rump Block**: half damage and bounce 30% back        | Auralynx's Facet Guard | **Grudge Thump** (14 s): 8 damage round Wombolder (240 px); enemies hit are **taunted** for 1.1 s (they walk at it, though they can still attack) and Wombolder is **braced** for 1.5 s (no knockback)                | taunts                              |
| Shadopus  | **Ink Jet**: a shot that slows                         | half the roster        | **Ink Jet** (9 s): **blinds** for 0.75 s: the target's basic attacks miss (skills still land). A blinded player sees ink over the screen                                                                              | blinds                              |

### New mechanics

- **Tether** (`kind: "tether"`): the fighter keeps a `tether` (target, until,
  next tick). The server ticks it every `tether.tick`, and drops it when the
  target dies, leaves `breakRange`, goes out of sight, or the caster is
  stunned. Clients draw the stream from the caster to the target.
- **Screen** (`kind: "screen"`): a zone drawn as a line (`angle` is the line's
  direction, `radius` half its length). Each tick, enemy projectiles that
  touch it are destroyed (`screened()`); every `tickInterval` it hurts and
  sets on fire non-jumping enemies on it.
- **Rewind** (`kind: "rewind"`): the server keeps 3 s of each fighter's
  positions and health (`trail`, cleared on knockouts and resets). Casting
  teleports to the oldest point within `rewind.seconds` and heals
  `min(max, lost × heal)`.
- **Leash** (status): the anchor (`tx`, `ty`) and length (`amount`) live on the
  status. `advanceMovement` clamps the fighter back onto the circle after
  every move, so client prediction agrees with the server.
- **Boomerang** (`boomerang: true` on a projectile): it flies out until its
  range runs out or it meets a wall, then homes in on its owner through walls.
  It hits each enemy once per pass (`hit` is cleared on the turn).
- **Taunt** (status): `advanceMovement` points a taunted fighter's movement at
  the taunter (refreshed every tick; it ends if the taunter goes) until the
  two touch. Attacks and skills still work.
- **Brace** (status): no knockback.
- **Blind** (status): a blinded fighter's basic attacks deal nothing and show
  a MISS.

### Everything else

- **Bots** know each new skill: the curtain when threatened or a ranged enemy
  is in sight past 220 px, the taunt with enemies in reach, the rewind when
  threatened under 65% health, the siphon when an enemy is in sight and reach;
  boomerangs score 1.6× (they hit twice).
- **Combos**: Pelted is now set up by Bush Boomerang; the Pinned and Inked
  texts describe the leash and the blind.
- **Rites**: Deep Siphon (3 s), Thirsty Gills (drinks it all back), Long
  Curtain (4.5 s), Heavy Quill (2.2 s), Quick Rewind (12 s), Heavy Boomerang
  (14 damage), Long Grudge (taunt 1.6 s), Thick Ink (1.2 s).
- **Raid trick**: on the Storm Twins, a braced Wombolder stops Twin Rush
  completely and adds 15 stagger to that twin (it was Rump Block).
- **Client**: new illustrated icons, battle effects (the siphon stream, the
  curtain of embers, the dive back, the spinning boomerang, the thump), the
  leash line and circle, the TAUNTED / BRACED / PINNED / BLINDED labels, ink
  over a blinded player's screen and a MISS over blinded basics.

### Balance

Bots played every new kit against the whole roster (`round-robin.ts` with
`RR_ONLY` set to the five changed champions: each against all seventeen
others, Hard and Normal; fair is 50%). Seeds change who meets whom and when,
and move a champion's rate by several points, so every change was checked
on a fresh seed, and the old kits were measured the same way for reference.

| Champion  | Before wave 1 (seed 71000) | First version (seed 70000) | Shipped (seed 73000) | Shipped (seed 74000) |
| --------- | -------------------------- | -------------------------- | -------------------- | -------------------- |
| Tidefin   | 50.4% / 54.9%              | 52.5% / 58.7%              | 52.1% / 52.1%        | 47.6% / 56.5%        |
| Pyranda   | 47.1% / 52.4%              | 39.0% / 56.3%              | 46.2% / 54.0%        | 45.3% / 51.4%        |
| Halcyra   | 52.9% / 48.8%              | 67.1% / 53.8%              | 54.0% / 53.5%        | 51.6% / 48.0%        |
| Wombolder | 46.2% / 47.4%              | 51.8% / 51.2%              | 51.5% / 51.3%        | 54.7% / 54.1%        |
| Shadopus  | 47.4% / 50.9%              | 60.4% / 54.4%              | 52.2% / 58.1%        | 55.7% / 56.7%        |

(Hard / Normal. The two "shipped" runs have the final kits; their Normal
column was played before the last change to the Normal handicap below,
which raised Tidefin's and Shadopus's.) What moved on the way:

- **Gill Siphon** was far too strong at first (4 damage every 0.25 s for
  2.5 s): now 3 every 0.3 s for 2.1 s, and it snaps at 430 px instead of 470.
- **Ember Curtain** did nothing for Pyranda against brawlers: it is now 240 px
  wide (was 200) and hurts (7 every half second), on a 10 s cooldown (was 13).
- **Halcyon Rewind** won back 60% of the health lost (at most 30) on a 15 s
  cooldown: now 40% (at most 18) on 17 s. **Pinning Quill**: 12 damage (was 14) and a 1.4 s leash (was 2).
- **Ink Jet**'s blind hurt bots a lot (they keep swinging): 0.7 s (was 1.5),
  9 damage (was 12), 11 s cooldown (was 8).
- Normal bots' handicap (`dazeBy` in `apps/server/src/bot.ts`): Tidefin
  0.15 → 0.18, Pyranda 0.34 → 0.38, Halcyra 0.2 → 0.19, Shadopus 0.3 → 0.32.

Pyranda's Hard rate sits where it was before (it struggles against
Astrabun, Wombolder and Pangrove, as it did). Shadopus ends a few points
above its old kit on Hard: the blind is its strongest tool against bots.

**2v2 and free-for-all** (`TEAM_TUNING`, `FFA_TUNING`, `FFA_THREE_TUNING`:
health and attack speed per mode, duels untouched), tuned with
`tune-teams.ts --only` on fresh random line-ups (two rounds of 1,000 per
difficulty in each mode), then checked once more on unused line-ups:

| Champion  | 2v2 factor   | 2v2 check (fair 50%) | FFA factor    | FFA check (fair 25%) | 3-player FFA factor |
| --------- | ------------ | -------------------- | ------------- | -------------------- | ------------------- |
| Tidefin   | 1 → 1.037    | 52.3%                | 0.881 → 0.85  | 22.8%                | 0.835 (same)        |
| Pyranda   | 0.915 → 0.93 | 52.4%                | 0.899 → 0.876 | 25.0%                | 0.852 → 0.855       |
| Halcyra   | 1.008 → 1    | 51.7%                | 0.863 → 0.845 | 23.9%                | 0.788 → 0.78        |
| Wombolder | 1.006 → 1.01 | 45.0% (at 0.993)     | 1.11 → 1.054  | 24.9%                | 1.161 → 1.16        |
| Shadopus  | 1.047 → 1.02 | 48.5%                | 1.089 → 1.06  | 20.5% (at 1.045)     | 1.144 → 1.13        |

These line-up runs are noisy (a champion is in about a fifth of the games,
so a round moves it by ±3 points): the factors are set from all the rounds
together rather than the last one. In 3-player free-for-alls all five were
already within 31–36% (fair 33.3%) and barely moved.

## Wave 2: melee stun strikes and knockback novas

Six skills were a strike in front that stuns (Shatter Paw, Eyespot Flash,
Shell Bash, Static Clamp, Mochi Pound, Kraken Grasp), and four ultimates a
ring that blasts everyone away (Overcharge, Shard Nova, Radiant Flare,
Tremor). Shatter Paw (Auralynx's crystal palm) and Shell Bash (Terradon's
shell) stay; Overcharge (it paralyses) and Tremor (a ground quake you jump)
stay. The others change:

| Champion | Was                                        | Now                                                                                                                                                                                         | Borrowed from                  |
| -------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Lumoth   | **Eyespot Flash**: a stun strike in front  | **Eyespot Flash** (12 s): the eyespots flash; every enemy within 220 px takes 8, and those **looking at Lumoth** (aiming within 0.5 rad of it) are stunned for 0.5 s. Look away to dodge it | gaze attacks                   |
| Lumoth   | **Radiant Flare**: a blast ring            | **Radiant Flare** (ultimate): Lumoth glows like a **lighthouse** for 2 s; three rays 260 px long turn round it (a turn every 1.2 s) and each enemy a ray sweeps takes 6                     | rotating beams                 |
| Coilemur | **Static Clamp**: a stun strike            | **Static Clamp** (12 s): clamps a **charge** on the enemy in front; 0.9 s later it goes off (28 and paralysis) and **arcs** to every enemy within 200 px of it for half                     | time bombs and chain lightning |
| Astrabun | **Mochi Pound**: a stun strike             | **Mochi Pound** (12 s): a **chain of three pounds**, each cast again within 1.4 s: 10, 13, then 20 that stuns and knocks back. The cooldown starts after the last                           | recast combos                  |
| Shadopus | **Kraken Grasp**: a stun strike (ultimate) | **Kraken Grasp** (ultimate): **seizes** the enemy in front, holds it 0.5 s (aim while you hold it), then **hurls** it 380 px: 32, half again into a wall; enemies where it lands take half  | grabs and throws               |
| Auralynx | **Shard Nova**: a blast ring (ultimate)    | **Crystal Cage** (ultimate): crystal spires rise in a 180 px **ring** round Auralynx for 2.5 s; nobody can cross it and no shot gets through. Enemies caught inside take 10                 | arena-locking ultimates        |

### New mechanics

- **Gaze** (`kind: "gaze"`): an enemy is caught when the direction it aims is
  within `gaze` radians of the caster.
- **Clamp** (`kind: "clamp"`, status `clamp`): the charge is a status on the
  target (`by` = the clamper). When it runs out the server fires it
  (`fireClamp`): the hit, then a `beam` event and a hit for each enemy it arcs
  to. A combo-primed (Magnetised) target goes off at once.
- **Throw** (`kind: "throw"`): the thrower keeps `grab` (target, when). While
  it holds, the target is kept in front of it (and stunned); then it is
  moved `throw` px along the thrower's aim at that moment, with the rush's
  wall-slam test.
- **Pound** (`kind: "pound"`): the fighter keeps `pound` (step, until, the
  cooldown's end). A strike that is not the last puts the cooldown at a
  quarter second; if the chain lapses, the cooldown counted from the first
  strike comes back. Each burst event carries its `step`.
- **Cage** (`kind: "cage"`, status `cage`): every fighter gets a `cage`
  status with the centre, radius and which side it was on. `advanceMovement`
  ends with `holdInCage`, so client prediction agrees; shots that would cross
  the ring this tick are destroyed. Bots don't treat a cage as a hazard.
- **Lighthouse** (`kind: "lighthouse"`): a zone that follows the caster and
  turns (`angle`); an enemy within a ray's width is hit, at most once per ray
  passing, through nothing solid.

### Everything else

- **Bots** use each one: the flash with enemies near, the clamp, throw and
  pound in melee reach (the pound again while its chain lasts), the cage up
  close, the rays with enemies in reach.
- **Combos**: Magnetised (Magnet Lash) now makes Static Clamp go off at once,
  35% harder, and stun; Moonlit adds 35% to the first pound after a Moon
  Hop; Kindled gives Radiant Flare 25% longer rays.
- **Rites**: Wide Wings (Eyespot Flash 20% wider), Dazzle (stuns 0.9 s),
  Long Cage (4 s and 18 damage), Tight Clamp (32); the others carry over.
- **Raid trick**: on Grumblecrag only the last pound of a chain adds 15
  stagger. Radiant Flare keeps its Gloomshade and Prismatail tricks (they
  happen on cast).
- **Client**: new or redrawn icons (Crystal Cage, Radiant Flare, Static
  Clamp's fuse, Kraken Grasp's throw, Mochi Pound's three pounds), battle
  effects (the flash ring, the turning rays, the crackling charge ring that
  tightens as it runs out and its arcs, the tentacle holding its catch, the
  ink splash where it lands, each pound's puff and "×2" / "POUND!", the ring
  of spires), CHARGED and CAGED labels.

### Balance

Measured like wave 1: round robin against all seventeen others, Hard / Normal,
on fresh seeds, with the wave 1 build as the reference.

| Champion | Before wave 2 (seed 75000) | First version (seed 75000) | Shipped kit (latest fresh seed) |
| -------- | -------------------------- | -------------------------- | ------------------------------- |
| Lumoth   | 53.5% / 48.6%              | 64.9% / 56.9%              | 49.4% / 45.9% (seed 80000)      |
| Coilemur | 52.5% / 51.6%              | 43.5% / 46.1%              | 47.3% / 49.0% (seed 80000)      |
| Astrabun | 47.6% / 50.6%              | 41.8% / 40.6%              | 51.0% / 54.1% (seed 79000)      |
| Shadopus | 48.8% / 46.1%              | 53.3% / 50.8%              | 51.8% / 57.3% (seed 80000)      |
| Auralynx | 50.8% / 51.0%              | 61.4% / 56.1%              | 54.7% / 47.6% (seed 79000)      |

What moved on the way:

- **Lumoth** was the strongest by far: bots always face their target, so
  every Eyespot Flash stunned. The flash now reaches 220 px (was 300) and
  stuns for 0.5 s (was 0.8) within 0.5 rad (was 0.6); Radiant Flare's rays
  hit for 6 (was 8) for 2 s (was 2.4).
- **Crystal Cage** shut ranged champions in with a melee duelist: 180 px (was
  230), 2.5 s (was 3), 10 damage (was 24).
- **Static Clamp** waited too long: it goes off after 0.9 s (was 1.5) for 28
  (was 22). **Mochi Pound**: 10, 13 and 20 (was 8, 10 and 16), with 1.4 s
  to follow up (was 1.2). **Kraken Grasp**: 32 (was 34).
- Normal handicaps (`dazeBy`): Astrabun 0.36 → 0.32, Shadopus 0.32 → 0.28.

Coilemur ends a few points under its old kit on Hard (Lumoth's flash
counters it hard); Auralynx a few over.

**2v2 and free-for-all**: two rounds of 1,000 fresh line-ups per difficulty
in 2v2 and 4-player free-for-all, one in 3-player, then a check on unused
line-ups (Lumoth's factors were raised after its last nerf):

| Champion | 2v2 factor   | 2v2 check (fair 50%) | FFA factor    | FFA check (fair 25%) | 3-player FFA factor |
| -------- | ------------ | -------------------- | ------------- | -------------------- | ------------------- |
| Lumoth   | 0.997 → 1    | 42.6% (at 0.97)      | 0.919 → 0.9   | 23.9%                | 0.864 → 0.87        |
| Coilemur | 1.006 → 1    | 53.5%                | 1.178 → 1.19  | 25.9%                | 1.242 → 1.26        |
| Astrabun | 1.008 → 0.99 | 49.1%                | 1.026 → 1.06  | 27.4%                | 1.106 → 1.16        |
| Shadopus | 1.02 → 1.04  | 53.9%                | 1.06 (same)   | 28.0%                | 1.13 → 1.12         |
| Auralynx | 0.97 → 0.95  | 48.6%                | 1.055 → 1.065 | 24.4%                | 1.127 → 1.15        |

## Wave 3: slow zones and zone ultimates

Four skills were a patch of ground that slows (Eddy, Mud Mire, Spark Tether
round Coilemur, Moon Gravity), and three ultimates a big circle that lands at
the aim a moment later (Sunfire Pillar, Silent Swoop, Chestnut Storm). Mud
Mire (Terradon's mud) stays the slow; Chestnut Storm stays with Pyranda, whose
whole kit is artillery. The others change:

| Champion | Was                                          | Now                                                                                                                                                                                 | Borrowed from                |
| -------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Tidefin  | **Eddy**: a slowing patch at the aim         | **Undertow** (12 s): a current 420 px long from Tidefin along the aim for 3.5 s; enemies in it are **swept along** at 200 px/s and take 3 every half second. Jumping gets out of it | conveyor and current hazards |
| Astrabun | **Moon Gravity**: a slowing patch            | **Moon Gravity** (15 s): low gravity at the aim for 2.5 s; enemies in it **float**, keeping almost no grip, so they slide on and barely turn                                        | low-gravity and ice physics  |
| Coilemur | **Spark Tether**: a slowing ring round it    | **Spark Trail** (15 s): for 3.5 s Coilemur runs 30% faster and leaves a **trail** that lasts 2 s; enemies who touch it take 6 and are paralysed for a moment                        | light-cycle trails           |
| Cindrake | **Sunfire Pillar**: a blast at the aim (ult) | **Sunfire Pillar** (ultimate): the pillar rises at the aim and **follows your aim** at 200 px/s for 3 s, hitting for 6 every half second and burning                                | steerable area spells        |
| Mystowl  | **Silent Swoop**: a blast at the aim (ult)   | **Mind Maze** (ultimate): a psychic maze closes over the aim (150 px): 24 damage and **Confused** for 2.2 s, every way it walks reversed                                            | confusion effects            |

### New mechanics

- **Current** (`kind: "current"`, status `current`): enemies in the lane get a
  `current` status holding the drift velocity (`tx`, `ty`), refreshed every
  tick; `advanceMovement` adds the drift after the fighter's own movement
  (not while jumping), so client prediction agrees.
- **Float** (status `float`): the fighter's acceleration is multiplied by
  `STATUS_RULES.floatGrip` (0.12) in `advanceMovement`.
- **Trail** (`kind: "trail"`): the zone keeps `points` (where the caster has
  been, with when) and sends them to clients; points older than
  `trail.fade` drop, and an enemy within `radius` of any point is hit at most
  once every `tickInterval`.
- **Steer** (`kind: "steer"`): a zone that moves toward the caster's live aim
  at `steer.speed`, then hits like any zone.
- **Confuse** (status `confuse`): `advanceMovement` reverses the direction
  the fighter is trying to walk.

### Everything else

- **Bots** use the current with a target in reach, the trail when circling a
  close target, and the pillar with a target in range (they keep aiming at
  it, so it follows). They keep out of a current's lane.
- **Combos**: Soaked is now set up by Undertow; Dazed pays off with Mind Maze.
- **Rites**: Wide Undertow, Maelstrom (5 a tick, 4.5 s), Light Moon (Moon
  Gravity 20% wider), Long Trail (4.5 s), Deep Maze (35% wider).
- **Raid tricks**: on Emberwing, Undertow puts out fire patches and dive
  trails all along its current; on Somnara, Mind Maze reveals the dream to the
  whole team (as Silent Swoop did). Sunfire Pillar keeps its Prismatail relay.
- **Client**: new icons (Undertow, Spark Trail, Mind Maze; Moon Gravity's
  chevrons now point up), the current's lane with racing foam and chevrons,
  the crackling trail, question marks round a confused fighter and a hover
  ring under a floating one, and SWEPT AWAY / FLOATING / CONFUSED labels.

### Balance

Measured like the other waves (round robin against all seventeen others,
Hard / Normal, fresh seeds; the wave 2 build as the reference):

| Champion | Before wave 3 (seed 81000) | First version (seed 81000) | Shipped (seed 84000) |
| -------- | -------------------------- | -------------------------- | -------------------- |
| Tidefin  | 48.6% / 46.5%              | 52.0% / 46.9%              | 51.4% / 45.5%        |
| Astrabun | 53.1% / 52.0%              | 50.6% / 51.4%              | 50.2% / 56.7%        |
| Coilemur | 47.3% / 57.8%              | 28.4% / 44.3%              | 53.7% / 53.5%        |
| Cindrake | 60.2% / 50.0%              | 64.5% / 58.2%              | 53.7% / 54.3%        |
| Mystowl  | 51.4% / 47.3%              | 51.4% / 45.5%              | 54.7% / 44.3%        |

(The shipped Normal column was played before the last change to the Normal
handicaps below.) What moved on the way:

- **Spark Trail** at first only hurt enemies who walked onto it, and bots
  standing toe to toe rarely did: Coilemur fell to 28%. It now also makes
  Coilemur 30% faster while it lays the trail (so it runs rings round its
  target), and the trail is wider (28 px, was 22) and lasts 2 s (was 1.6),
  hitting every 0.4 s (was 0.5). A try with 8 damage and a 2.5 s trail went
  to 61%; it ships at 6.
- **Sunfire Pillar** followed bots' aim too well (they always aim at their
  target): 200 px/s (was 240) and 6 a tick (was 7).
- Normal handicaps (`dazeBy`): Cindrake 0.41 → 0.44, Tidefin 0.18 → 0.15,
  Mystowl 0.18 → 0.14, Coilemur 0.32 → 0.34, Astrabun 0.32 → 0.35.

**2v2 and free-for-all**: two rounds of 1,000 fresh line-ups per difficulty
in 2v2 and 4-player free-for-all, one in 3-player, then a check on unused
line-ups:

| Champion | 2v2 factor    | 2v2 check (fair 50%) | FFA factor    | FFA check (fair 25%) | 3-player FFA factor |
| -------- | ------------- | -------------------- | ------------- | -------------------- | ------------------- |
| Tidefin  | 1.037 → 1.035 | 52.0%                | 0.85 → 0.82   | 29.2% (at 0.84)      | 0.835 → 0.83        |
| Astrabun | 0.99 → 1.005  | 48.0%                | 1.06 → 1.09   | 22.9%                | 1.16 → 1.19         |
| Coilemur | 1 → 0.975     | 49.7%                | 1.19 → 1.2    | 25.6%                | 1.26 → 1.25         |
| Cindrake | 0.993 (same)  | 50.9%                | 1.159 → 1.126 | 24.3%                | 1.189 → 1.195       |
| Mystowl  | 1.006 → 0.985 | 52.1%                | 0.872 → 0.85  | 24.5%                | 0.838 → 0.835       |
