# Creature remodel of the original eight

The first eight kits were built when the roster was Pikachu, Charizard,
Greninja, Lucario, Eevee, Mewtwo, Snorlax and Gengar. The art has been
original for a while, but several kits still played like those Pokémon. This
pass rebuilds the kits around each creature's real animal and tests them,
including against the eight new champions being designed.

## Where the old kits came from

| Fighter  | Echoed    | Old skills that gave it away                                                                                |
| -------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| Terradon | Snorlax   | Shell Slam (Body Slam), Hibernate (Rest), Dust Cloud's Drowsy combo (Yawn), Tremor (Earthquake)             |
| Duskveil | Gengar    | Curse Mark (Hex: double damage on any status), Ghostfire (Will-O-Wisp)                                      |
| Tidefin  | Greninja  | Ripple Stars ("water shurikens", Water Shuriken), Whirlpool (an exact move name), Mirror Mist (Double Team) |
| Auralynx | Lucario   | Prism Shot ("aura projectile", Aura Sphere), Shatter Palm (Force Palm), Mirror Guard (Counter)              |
| Mystowl  | Mewtwo    | Thoughtstrike (Future Sight), Ward (Barrier)                                                                |
| Voltkit  | Pikachu   | Static Lance (paralysing bolt), Ball Lightning (Electro Ball), Overcharge (Discharge); mild and generic     |
| Lumoth   | Eevee     | Dust Strike ("a powerful bite", on a moth), Starfall Spray (Swift)                                          |
| Cindrake | Charizard | Ember Gust (two move names, Ember + Gust), Blaze Whirl (Fire Spin); otherwise a generic fire kit            |

Names were checked against the full Pokémon move list (PokéAPI, 937 moves):
only Whirlpool was an exact move name. The new names match none.

## The new kits

| Fighter  | Skill 1       | Skill 2                 | Skill 3                   | Ultimate                | Combo                                |
| -------- | ------------- | ----------------------- | ------------------------- | ----------------------- | ------------------------------------ |
| Voltkit  | Static Lance  | Ball Lightning          | **Static Glide** (new)    | Overcharge              | Charged: Static Glide → Static Lance |
| Cindrake | Crest Flare   | Magma Bomb              | Heat Cracks               | Sunfire Pillar (faster) | Scorched: Crest Flare → Magma Bomb   |
| Tidefin  | Gill Spray    | Eddy                    | **Tide Double** (regrows) | Riptide Wave            | Soaked: Eddy → Riptide Wave          |
| Auralynx | Prism Shot    | Shatter Paw             | Facet Guard               | Shard Nova              | Primed: Facet Guard → Shatter Paw    |
| Lumoth   | Wing Dust     | **Eyespot Flash** (new) | Kindle                    | Radiant Flare           | Kindled: Kindle → Radiant Flare      |
| Mystowl  | Third-Eye Ray | Booming Hoot            | Wing Cloak                | Silent Swoop (faster)   | Dazed: Booming Hoot → Silent Swoop   |
| Terradon | Shell Bash    | **Shell Up** (new)      | Mud Mire                  | Tremor                  | Mired: Mud Mire → Shell Bash         |
| Duskveil | Shade Crawl   | Ghostfire               | **Haunted Lantern** (new) | Void Orb                | Lit: Ghostfire → Shade Crawl         |

- **Static Glide** (Voltkit, a sugar glider): takes off with a static pop (8
  damage, shoves enemies within 150 px away and slows them), then 1.4 s
  airborne (ground attacks miss) and 30% faster. Gliding builds static: a
  Static Lance thrown within 2.5 s stuns. Replaces Storm Grid.
- **Shell Up** (Terradon, a tortoise): 2.5 s in the shell, unable to move or
  act, taking 45% less damage and regrowing 25 HP. Replaces Hibernate (sleep
  to heal, taking more damage), the clearest Pokémon tell in the game.
- **Tide Double** (Tidefin, an axolotl): the decoy and speed burst as before,
  plus 4 HP of regrowth (axolotls famously regenerate).
- **Eyespot Flash** (Lumoth, a moth): 12 damage, a 0.4 s stun and a push in a
  half circle in front; moths flash eyespots to startle predators. Replaces
  the bite.
- **Haunted Lantern** (Duskveil, a lantern wisp): hung at the aim point, it
  shoots a wisp (4 damage) at the nearest enemy within 330 px every 1.3 s for
  4 s. Replaces Curse Mark (Hex).
- **Sunfire Pillar** and **Silent Swoop** land sooner (0.4 s and 0.55 s): the
  slower versions were worth little against the new champions, because targets
  walked out before they hit.

The full proposal, with sources and the per-skill value test, is the
"Element Arena Skill Remodel" page shared in the pull request.

## Engine changes

- **Attack speed:** the server only acts on its 30 Hz ticks and scheduled the
  next basic attack from the tick it fired on, so every interval was rounded
  up to a whole tick (240 ms played as 267 ms, 335 ms as 367 ms). Fighters
  got 90–100% of their stated attack speed, unevenly. While the button is
  held, the next attack is now scheduled from when the last one was due.
- `buff` abilities can grant another status than empower (`status`), keep the
  caster airborne (`glide`) and burst on cast (`pop`).
- `rest` abilities can rest in a `shell` status instead of sleep:
  `STATUS_RULES.shellReduction` (0.55) instead of `sleepVulnerability`.
  `DISABLING_STATUSES` lists everything that stops moving and acting.
- `clone` abilities can heal on cast (`heal`).
- `zone` abilities with a `turret` shoot projectiles at the nearest enemy in
  range instead of hurting what stands inside.
- A self combo whose payoff is a projectile (Static Lance) carries the mark on
  the shot (`selfPrimed`), since the cast spends it before the shot lands.
- Free practice drops its own `PRACTICE_GRID` instead of borrowing Storm Grid.

## Balance

Tuned with bot round robins on the real server code. The kits were first
tested among the eight, then in a sixteen-champion pool with the eight new
champions (40 games per pairing per difficulty). That is where the per-skill
value test (each skill switched off in turn) showed Static Glide, Sunfire
Pillar and Silent Swoop barely mattered, which led to the pop and the faster
ultimates. Health and attack speed were then auto-tuned for the eight that
ship today (six rounds, last three averaged):

| Fighter  | Health    | Basic attack (ms) | Win rate before | After |
| -------- | --------- | ----------------- | --------------- | ----- |
| Voltkit  | 146 → 153 | 270 → 275         | 45.5%           | 48.4% |
| Cindrake | 144 → 141 | 470 → 475         | 49.5%           | 48.1% |
| Tidefin  | 154 → 146 | 240 → 245         | 46.0%           | 50.8% |
| Auralynx | 171 → 177 | 325 → 320         | 50.8%           | 48.0% |
| Lumoth   | 142 → 140 | 300 → 305         | 50.2%           | 49.8% |
| Mystowl  | 148 → 142 | 375 → 380         | 50.2%           | 51.6% |
| Terradon | 195 → 199 | 635 → 625         | 54.1%           | 53.8% |
| Duskveil | 138 → 139 | 365               | 53.8%           | 49.6% |

Win rates are the average of Hard and Normal bots, eight fighters only, 2,240
matches each (before: today's main; after: this change). With the attack
speed fix, the intervals now play at their stated speed, so several fighters
attack faster than before even where the number moved up.

When the eight new champions ship, re-run the auto-tune with all sixteen: in
that pool the brawlers (Terradon, Auralynx, Cindrake) beat the new divers and
the ranged fighters struggle against them, so the best numbers differ.

Known limits: bots don't dodge turret shots well, and divers keep attacking
into Facet Guard, so some matchups look more lopsided than they would with
players. Cindrake still splits hard by bot skill (28% against Hard bots, 70%
against Normal).
