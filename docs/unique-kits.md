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

BALANCE_PLACEHOLDER
