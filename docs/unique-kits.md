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
| 3    | Slow zones and zone ultimates          | About five                                                                            |

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
| Lumoth   | **Eyespot Flash**: a stun strike in front  | **Eyespot Flash** (12 s): the eyespots flash; every enemy within 260 px takes 8, and those **looking at Lumoth** (aiming within 0.5 rad of it) are stunned for 0.5 s. Look away to dodge it | gaze attacks                   |
| Lumoth   | **Radiant Flare**: a blast ring            | **Radiant Flare** (ultimate): Lumoth glows like a **lighthouse** for 2.4 s; three rays 260 px long turn round it (a turn every 1.2 s) and each enemy a ray sweeps takes 6                   | rotating beams                 |
| Coilemur | **Static Clamp**: a stun strike            | **Static Clamp** (12 s): clamps a **charge** on the enemy in front; 0.9 s later it goes off (28 and paralysis) and **arcs** to every enemy within 200 px of it for half                     | time bombs and chain lightning |
| Astrabun | **Mochi Pound**: a stun strike             | **Mochi Pound** (12 s): a **chain of three pounds**, each cast again within 1.4 s: 10, 13, then 20 that stuns and knocks back. The cooldown starts after the last                           | recast combos                  |
| Shadopus | **Kraken Grasp**: a stun strike (ultimate) | **Kraken Grasp** (ultimate): **seizes** the enemy in front, holds it 0.5 s (aim while you hold it), then **hurls** it 380 px: 30, half again into a wall; enemies where it lands take half  | grabs and throws               |
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
