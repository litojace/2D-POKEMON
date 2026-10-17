# Raid Roster — Design Spec (draft 1)

Status: **design only, nothing built yet.** Numbers are starting values to tune
with real play, using the same balance data Grumblecrag already records.

## 1. Goals

- Turn Boss Raid into a **Raid Hub**: a page of bosses, each with its own
  challenges, rewards and records.
- Every boss should teach a **different kind of teamwork**, not reskin the
  same fight:

| Boss | Element | Teamwork it asks for | Difficulty |
|---|---|---|---|
| Grumblecrag (existing) | Earth | Baiting and stacking | ★ |
| Tidewyrm | Water | Sharing safe ground and rescuing a trapped ally | ★★ |
| Gloomshade | Shadow | Reading tells and spreading out | ★★ |
| Emberwing | Fire | Being in several places at once | ★★★ |
| Storm Twins | Electric | Pairing up and timing two kills | ★★★ |

- Rewards stay **cosmetic only** (no stat bonuses), so veterans never make
  the raid easier for others.
- Rewards should take **weeks, not one evening**. That means per-boss ladders,
  challenge feats that need skill, and cross-boss goals.
- Every boss supports **1–4 players**, including solo at every Peril (see §3).
- All designs are original: cute but menacing, no Pokémon likenesses.

## 2. The Raid Hub

**Entry:** choosing *Boss Raid* on the Play panel opens the Hub instead of
going straight to a room.

**Hub page**

- **Header:** total rewards earned across all bosses (e.g. "23 / 62 rewards")
  and lifetime raid clears.
- **Raid of the Week banner:** one boss per week, with its trait, Peril 2, a
  separate weekly board and a small weekly-only title for the first clear.
  The boss rotates in a fixed order.
- **Boss cards** in a grid (one column on phones, swipeable like the
  champion roster). Each card shows:
  - Boss art (idle animation) and an element chip.
  - Difficulty stars.
  - The signature mechanic in one line ("Strand it on an island").
  - Your best Peril cleared as a badge (P1/P2/P3, with a no-downs mark).
  - Reward progress bar (e.g. 4/9).
  - A "NEW" ribbon until first played.

**Unlocks:** Grumblecrag is open from the start; it's the tutorial boss.
The other four unlock after **any Peril 1 clear of Grumblecrag**. Peril 2/3
unlock **per boss**, the same way they do today.

**Boss page** (tap a card) has four tabs:

1. **Overview:** a short flavour blurb, the three chapter names and goals,
   an illustration of the signature mechanic, and which champion tricks
   apply (§6).
2. **Attacks:** every attack with its warning shape, a tip, and
   *Practice this* (opens a practice room for that attack).
3. **Rewards:** the full ladder with exact progress, equip buttons, and
   previews of the cosmetics on your current champion.
4. **Records:** best time per party size, clears per Peril, the weekly
   board if it's that boss's week, and recent runs.

**Actions:** *Create raid room* (boss and Peril chosen here), *Join with
code*, *Play solo now*. Room codes carry the boss, so friends who join land
in the right fight. The raid lobby gets a small boss switcher for the host;
changing it un-readies everyone, like party rules do now.

**Also:** the existing Bestiary button becomes *Raid Hub*. Profile, results
and lobby links open the Hub on the relevant boss.

## 3. Solo rules (chosen: solo everything, harder)

- Every boss and every Peril can be played solo.
- **Peril 1–2 solo:** one self-revive, as today.
- **Peril 3 solo: no self-revive.** One down ends the run.
- Each team mechanic has a solo version (listed per boss) that's possible
  but asks more of one player.
- **Solo Peril 3 clear** is its own feat reward on every boss.
- **Open question:** apply "no self-revive at Peril 3 solo" to Grumblecrag
  too, for consistency? Rewards already earned are kept either way.

## 4. Shared rules (all bosses)

The same as Grumblecrag unless a boss says otherwise:

- Three HP-gated chapters, a rite pick between chapters, and the 8-minute
  combat limit.
- Peril damage ×1 / ×1.1 / ×1.2.
- Health locks at the starting party size.
- Stagger meter, downed/crawl/revive, team signals, practice drills,
  stand-in AI for disconnects, "what downed you" tips, contribution stats.
- Traits (one rolled per run, three per boss) and rare Gilded runs.
- **Team signals become per-boss:** the third key changes meaning.
  - Grumblecrag: "Bait here"
  - Tidewyrm: "Island here"
  - Gloomshade: "That's the real one"
  - Emberwing: "Take this brazier"
  - Storm Twins: "Pair with me"
- Rites: the six existing rites stay shared. Each boss adds **one themed
  rite** to its offer pool, listed per boss.

---

## 5. The bosses

Damage is before the Peril multiplier. For scale, champion health is 130–175
(Terradon 219) and Grumblecrag's hits do 18–28.

### 5.1 Tidewyrm — "The Rising Tide" (Water, ★★)

**Look:** a long, round-snouted sea serpent in seafoam and teal, with
ribbon fins, a glowing pearl on its forehead, pearl freckles and sleepy
eyes. It loops through ring-shaped splashes as it moves.

**Arena:** the Lagoon Court, a shallow pool floor with **4 raised islands**
(walkable platforms, about 150 px across). They work like Grumblecrag's
pillars, but you stand *on* them instead of behind them.

**Signature: Strand it.** Tidewyrm dives, and a ripple follows the marked
raider. When the ripple locks, it surfaces there.

- If it surfaces **on an island** (dry ground), it's **Stranded**: exposed
  for 5 seconds (7 on Peril 1).
- In water, it surfaces with a splash ring (damage) and dives again later.
- The island it lands on cracks. A cracked island sinks after two strands
  and rises again at the next chapter.

**Health:** 1350, +850 per extra raider.

| Attack | Warning | How to beat it | Dmg |
|---|---|---|---|
| **Dive & Surface** | Ripple follows one raider for 1.4 s, then locks for 0.8 s | Lead it onto an island, then step off | 26 (splash ring r 110) |
| **Tidal Wave** | A band sweeps across the arena from one edge | Low wave (ch. 1): jump it. High wave (ch. 2+): be on an island | 22 |
| **Bubble Barrage** | 7–9 slow bubbles in a fan | Dodge or pop them; a hit roots you 0.8 s | 10 each |
| **High Tide** (ch. 2+) | The water edge glows, then the floor floods for 5 s | Get on an island. Islands fit 2 comfortably; a third raider gets pushed off the edge | 7/s in water, +slow |
| **Undertow** (ch. 2+) | A whirlpool at the centre pulls everyone in for 3 s | Dash outward; touching the centre hurts | 24 at centre |
| **Bubble Prison** (ch. 2+) | One raider is sealed in a bubble that drifts toward the boss's mouth for 6 s | Teammates pop it (3 hits). Solo: mash attack to break out (8 presses). Reaching the mouth downs you | — |

**Chapters**

1. **Low Tide:** dives, low waves and bubbles. Teaches stranding.
2. **Turning Tide:** adds High Tide, Undertow and Bubble Prison. Island
   space becomes the puzzle.
3. **Storm Surge:** faster rhythm and combos (High Tide straight into a
   dive; Undertow into a wave). On Peril 3, one island sinks for good
   every 45 seconds, down to a minimum of two.

**Traits**

- *Murky:* ripples are harder to see, but strands last 1 s longer.
- *Rip Current:* stronger Undertow, but waves move slower.
- *Spring Tide:* High Tide lasts longer, but islands are bigger.

**Themed rite: Sure Footing.** Immune to Bubble Barrage roots; +15% speed
while in water.

**Solo versions**

- Bubble Prison becomes the mash escape.
- High Tide capacity doesn't matter.
- At Peril 3, islands sink faster to compensate.

**Practice drills:** Dive & Surface, Tidal Wave, High Tide, Undertow,
Bubble Prison.

### 5.2 Gloomshade — "Lights Out" (Shadow, ★★)

**Look:** a big floppy-eared puff of shadow with too many blinking eyes and
a long tail ending in a little lantern. Cute until it grins.

**Arena:** the Lantern Yard, with **4 lanterns** that make pools of light.
Outside the light, the screen edges dim (vision shrinks by about 25%, never
fully dark).

**Signature: find the real one.**

- From chapter 2, Gloomshade splits into 3 copies (4 on Peril 3).
- Only the real one **casts a shadow inside lantern light**, and its tail
  lantern flickers in time with the music.
- Hitting a decoy pops it into a Curse Puff on the hitter.
- Hitting the real one 6 times in a row **exposes** it: all decoys vanish
  and the core is open for 5 seconds.

**Health:** 1300, +870 per extra raider.

| Attack | Warning | How to beat it | Dmg |
|---|---|---|---|
| **Shadow Lunge** | A dark line from a shadow to one raider, 1.2 s | Sidestep. It comes from the nearest shadow, not the boss | 25 |
| **Grasping Hands** | A checkerboard of tiles darkens | Stand on a lit tile. The pattern shifts on Peril 2+ | 20 |
| **Lantern Snuff** | One lantern dims, then goes out | Hit it 2 times to relight. Unlit lanterns mean less light to find the real one | — |
| **Creeping Curse** (ch. 2+) | A purple mark on one raider; it spreads to anyone within 120 px for 2 s | Spread out. 3 stacks = Haunted (5 dmg/s for 6 s). Stand in lantern light for 2 s to cleanse | 5/s |
| **Mirror Split** (ch. 2+) | The boss blinks, then 3–4 copies appear | Find the shadow and the flickering lantern | — |
| **Nightmare Pulse** | A dark ring expands from *every* copy, but only the real one's hurts | Jump the real ring. It also reveals which one is real | 24 |

**Chapters**

1. **Dusk:** lunges, hands and snuffs. Teaches lantern light.
2. **Midnight:** decoys and curses.
3. **Witching Hour:** lanterns dim twice as fast, decoys come back after
   every exposure, and pulses come in pairs.

**Traits**

- *Moonlit:* brighter arena, but one extra decoy.
- *Restless Spirits:* hands come more often, but curses spread slower.
- *Hollow:* fewer decoys, but the real one's shadow is fainter.

**Themed rite: Lamplighter.** One hit relights a lantern, and standing in
light heals 1%/s.

**Solo versions**

- Curse spread has no one to infect, so the curse instead **grows** the
  longer you stand still.
- Decoys are reduced by one.

**Practice drills:** Shadow Lunge, Grasping Hands, Creeping Curse, Mirror
Split, Nightmare Pulse.

### 5.3 Emberwing — "Ground the Sky" (Fire, ★★★)

**Look:** a plump, fluffy fire-crested bird with stubby legs, a tiny beak,
a smug face, and ember-tipped tail feathers that drop sparks as it flaps.

**Arena:** the Sky Terrace, with **3 braziers** in a triangle and open
ground that slowly catches fire.

**Signature: ground it.**

- In chapters 2–3 it **takes flight**. While airborne:
  - It can't be hit by melee.
  - Ranged damage is halved.
  - It rains attacks from above.
- To bring it down, **all 3 braziers must burn at the same time**. A raider
  lights a brazier by standing on it for 1.5 s; a lit brazier stays lit for
  6 s.
- With all three lit, a firestorm knocks it out of the sky: **Grounded**,
  exposed for 6 s, and all burning ground shrinks.

**Health:** 1250, +830 per extra raider. Lower than the others because you
get less time to hit it.

| Attack | Warning | How to beat it | Dmg |
|---|---|---|---|
| **Dive Bomb** | A line marked from the air on one raider, 1.3 s | Sidestep. It leaves a burning line for 4 s | 26 |
| **Ember Rain** | Many small circles, staggered | Keep moving | 14 each |
| **Wing Gust** | An arrow cone; everyone in it gets pushed | Dash *into* the gust to hold ground. Don't get pushed into fire | 8 + push |
| **Flame Ring** | A ring expands outward from the boss | Jump as the edge passes | 22 |
| **Scorched Earth** (ch. 2+) | Glowing patches that grow every 10 s | Don't fight in them (6 dmg/s). They shrink when it's Grounded | 6/s |
| **Heat Mark** (ch. 2+) | 1–3 raiders marked; each explodes after 3 s (r 140) | **Spread out**: anyone else in the blast takes it too. The opposite of the Shared Meteor | 30 |

**Chapters**

1. **Takeoff:** grounded the whole time. Teaches Dive Bomb, Gust, Flame
   Ring and Ember Rain.
2. **High Flight:** airborne cycles and braziers. Heat Marks begin.
3. **Blazing Sky:** braziers stay lit for 4 s instead of 6, burning ground
   grows faster, and it must be grounded twice before its core stays open.

**Traits**

- *Updraft:* longer flights, but Grounded lasts 2 s longer.
- *Smouldering:* burning ground lingers, but less Ember Rain.
- *Molting:* drops feathers that give 10 ultimate charge, but dives come
  faster.

**Themed rite: Fireproof.** Take 50% less damage from burning ground, and
light braziers twice as fast.

**Solo version:** braziers stay lit for 12 s (8 s on Peril 3), so one raider
can run the triangle.

**Practice drills:** Dive Bomb, Wing Gust, Flame Ring, Heat Mark, Brazier
lighting.

**Engine note:** this boss needs an "airborne" state (no melee hits, ranged
damage halved, a drawn shadow on the ground). Its engine work is mid-sized.

### 5.4 Storm Twins, Fizz & Crackle — "Two Hearts, One Storm" (Electric, ★★★)

**Look:** two round floating thunder-jellies with little cloud caps.

- **Fizz** is fizzy, yellow and impatient.
- **Crackle** is blue, sleepy and grumpy.

They're tied together by a crackling ribbon of light.

**Arena:** the Conductor Ring, an open round arena with 4 copper posts that
redirect the beam.

**Signature: two kills, one timing.**

- The twins have **separate health bars**.
- When one falls, the other gets a **kill window**: 15 s on Peril 1, 12 s on
  Peril 2, 8 s on Peril 3. If the second twin isn't beaten in time, the first
  revives at 35% health.
- The team has to bring both down together, so it splits up and calls
  targets.

**Health:** 800 each (1600 total), +480 each per extra raider.

| Attack | Warning | How to beat it | Dmg |
|---|---|---|---|
| **Link Beam** | The ribbon between them brightens, then sweeps as they move | Jump over it; never stand on the line between them | 20 |
| **Chain Lightning** | One raider is marked; it jumps to anyone within 200 px | Spread out. Each jump does less | 24 → 16 → 10 |
| **Static Field** | A crackling zone (like Voltkit's Storm Grid) | Jump while crossing or avoid it; it slows | 5/s |
| **Twin Rush** | Both dash toward each other along marked lanes, making an X | Leave both lanes | 26 |
| **Polarity** (ch. 2+) | Every raider gets a + or − badge; it detonates after 4 s | Stand next to someone with the **opposite** sign to cancel. Same signs together take double damage | 28 |
| **Thunderclap** | A ring around the twin with *less* health | Jump it | 22 |

**Chapters** (based on combined health)

1. **Spark:** the twins stay close; the beam is short. Teaches beam,
   chain and rush.
2. **Storm:** they separate and orbit the arena. Polarity begins, and the
   posts bend the beam.
3. **Supercell:** faster rhythm. The kill window is now in play;
   combined health is set so both reach low health in this chapter.

**Traits**

- *Bickering:* they drift apart more, but the beam does less damage.
- *In Sync:* they attack together, but the kill window is 3 s longer.
- *Overloaded:* more Static Fields, but stagger fills 20% faster.

**Themed rite: Grounded.** Chain Lightning never jumps from you, and a
Polarity mismatch only does normal damage to you.

**Solo version:**

- Polarity becomes a **floor pad of the opposite sign**: stand on it to
  cancel.
- Chain Lightning has no one to jump to.
- Kill windows get 3 extra seconds.

**Practice drills:** Link Beam, Chain Lightning, Twin Rush, Polarity.

**Engine note:** this is the first fight with **two boss entities**. It
needs separate targeting, health, stagger and hit radius for each twin.
That's the biggest engine change in the roster, so it comes last.

---

## 6. Champion tricks across the roster

Every champion has at least two bosses where one of its skills is a special
answer. "Who should I bring?" becomes part of each boss.

| Champion | Grumblecrag | Tidewyrm | Gloomshade | Emberwing | Storm Twins |
|---|---|---|---|---|---|
| **Voltkit** | — | Static Lance on a *Stranded* boss adds +15 stagger (water conducts) | Ball Lightning's burst lights the area for 3 s and shows true shadows | — | Absorbs Chain Lightning: no jump, +15 ultimate charge |
| **Cindrake** | — | Magma Bomb pops a Bubble Prison in one hit | — | Blaze Whirl lights a brazier from range | — |
| **Tidefin** | — | Mirror Mist's clone can carry the dive ripple | — | Whirlpool puts out burning ground where it lands | — |
| **Auralynx** | Mirror Guard blocks the volley | — | — | Mirror Guard reflects a Dive Bomb: +20 stagger | Mirror Guard reflects the Link Beam into a twin: +20 stagger |
| **Lumoth** | Kindle: half a revive | — | Radiant Flare relights lanterns nearby and cleanses curse | Starfall Spray hits an airborne boss at full damage | — |
| **Mystowl** | Ward splits the meteor | — | Focus Ray passes through decoys and marks the real one | — | — |
| **Terradon** | Shell stops a charge | Tremor pops all bubbles nearby and frees a Prison | — | — | Hibernate grounds you: immune to Polarity |
| **Duskveil** | — | — | Curse Mark on the real one reveals it to everyone for 6 s | — | Void Orb pulls one twin toward the other |

Counts: Voltkit, Auralynx, Lumoth and Terradon have 3; Cindrake, Tidefin,
Mystowl and Duskveil have 2. Those four each get a third trick in a later
pass, as bosses beyond these five arrive.

## 7. Rewards

### 7.1 Per-boss ladder (the same shape on every boss)

| Goal | Reward | Slot |
|---|---|---|
| First clear | "[Boss]breaker"-style title | Title |
| 5 clears | Boss colours | Skin |
| 10 clears | Textured boss skin | Skin |
| Peril 2 clear | Themed entrance | Entrance |
| Peril 3 clear | Mastery title + portrait frame | Title + Frame |
| Peril 3, no downs | Themed aura | Aura |
| **Feat** (skill challenge) | Badge title | Title |
| **Speed** (Peril 2 under a target time, per party size) | Badge title | Title |
| **Solo Peril 3 clear** | "Lone [X]" title | Title |
| **Lifetime stat** (wins and losses) | Stat title | Title |

**Per boss**

- **Tidewyrm**
  - Titles: *Tidebreaker* (first clear), *Leviathan's Bane* (Peril 3).
  - Cosmetics: Seafoam colours, Pearlscale skin, Riptide entrance (a
    splash), Reef frame, Tidal aura.
  - Feat: strand it 4 times in one run.
  - Lifetime: 30 strands, *Shipwright*.
- **Gloomshade**
  - Titles: *Lightbringer* (first clear), *Night's End* (Peril 3).
  - Cosmetics: Dusk colours, Lanternlit skin (a soft glow on the edges),
    Shadowstep entrance, Lantern frame, Wisp aura.
  - Feat: clear without anyone hitting a decoy.
  - Lifetime: relight 50 lanterns, *Lamplighter*.
- **Emberwing**
  - Titles: *Skyfeller* (first clear), *Wingbreaker* (Peril 3).
  - Cosmetics: Ember colours, Cinderplume skin, Firefall entrance, Brazier
    frame, Ember aura.
  - Feat: ground it within 20 s of take-off, three times in a run.
  - Lifetime: light 60 braziers, *Torchbearer*.
- **Storm Twins**
  - Titles: *Stormsplitter* (first clear), *Eye of the Storm* (Peril 3).
  - Cosmetics: Static colours, Thundercell skin, Lightning-strike entrance,
    Conductor frame, Spark aura.
  - Feat: beat both twins within 2 s of each other.
  - Lifetime: 40 polarity pairs, *Perfect Pair*.
- **Grumblecrag** (back-filled so you have new things to chase)
  - Feat: every charge in a run hits a pillar.
  - Speed: Peril 2 solo under 3:30.
  - Solo Peril 3: *Lone Mountain*.

### 7.2 Cross-boss rewards

| Goal | Reward |
|---|---|
| Clear all 5 bosses (any Peril) | **Raid Veteran** title |
| Clear all 5 on Peril 3 | **Hall of Bosses** frame (animated, cycles each boss's crest) |
| Peril 3 no-downs on all 5 | **Unbroken** aura (prismatic) |
| 100 total raid clears | **Boss Hunter** title |
| Weekly boss, first clear each week | *Weekly Champion · week of …* (time-stamped, shown in profile history) |

**Totals:** 11 rewards per new boss (44), 13 for Grumblecrag (10 today plus
3 back-filled) and 5 cross-boss rewards, 62 in all. The Hub header shows
the count.

### 7.3 Equipping

- The four slots stay (skin, aura, entrance, frame), and they're
  **boss-agnostic**: you can wear Pearlscale with a Lantern frame.
- The Rewards tab previews each cosmetic on your current champion before
  you equip it.
- Titles keep using the profile title picker.

## 8. Engineering plan

**Shared (`packages/shared`)**

- Add `RaidBossDef` with:
  - id, name, element, stars, look notes
  - health, Peril damage, cadence, chapters, attacks and their numbers
  - `pattern(phase, peril, party)`
  - traits, themed rite, perks, signals
  - arena features
  - cosmetic and title definitions
- `RAID_BOSSES` registry. `GRUMBLECRAG` becomes its first entry.
- `RaidAttack` becomes a per-boss key union. `RaidState` gets:
  - `boss` (id)
  - `features` (pillars | islands | lanterns | braziers | posts)
  - `entities[]` (one boss, or two for the Twins)
  - `marks` (curse stacks, heat marks, polarity)

**Server (`apps/server/src/raid/`)**

- `core.ts`: chapters, downs and revives, stagger, rites, contributions,
  receipts, practice, stand-ins, solo rules.
- One module per boss implementing `startAttack`, `tick`, `hit rules`,
  `feature update`, and `standInHints` (e.g. "go to an island on High
  Tide", "spread on Heat Mark", "find an opposite partner").
- `RaidArena` delegates to the boss module.

**Client**

- Per-boss art and motion modules, like `raid-boss-art.ts` and
  `raid-boss-motion.ts` today.
- Warning renderers per attack and feature drawing.
- Guide scenes for the briefing.
- 16 new cosmetics in the rig: tint/texture skins, aura rings, entrance
  bursts, frames in the menu.
- The Hub page and boss page (tabs) in a new `raid-hub.ts`.

**Database (migration 009)**

- `arena_raid_rewards(id, boss, slot, kind, rule jsonb, name, description)`
  lists every reward and its rule. Rule kinds:
  - `clears >= n`
  - `peril >= n`
  - `flawless peril`
  - `time under (party)`
  - `solo peril`
  - `feat`
  - `lifetime stat`
  - `cross-boss`

  Progress and unlocks are computed from this table, so new bosses need
  rows, not new SQL functions.
- `arena_raid_players.feats jsonb` stores per-boss stats such as strands,
  lanterns, braziers and pairs.
- `arena_record_raid` accepts any boss in `arena_raid_rewards`.
- `arena_raid_progress()` returns **per-boss** progress plus cross-boss
  totals.
- The loadout check constraint is replaced by a lookup against the rewards
  table.
- Existing Grumblecrag rows keep working.

**Tests per boss:** attack patterns per Peril and party size, the
signature rule (strand / expose / ground / kill window), perks, solo
rules, stand-in hints, and database unlocks for every rule kind.

## 9. Build order and size

| Step | What | Size |
|---|---|---|
| 1 | Raid Hub + boss registry refactor + migration 009 + Grumblecrag back-fill rewards | Large |
| 2 | **Tidewyrm**: reuses the bait-to-a-feature idea, so it's the gentlest new boss | Large |
| 3 | **Gloomshade**: new reveal and curse systems, no engine changes | Large |
| 4 | **Emberwing**: needs the airborne state | Large |
| 5 | **Storm Twins**: needs two boss entities | Largest |

Each step is played with friends before the next starts; the balance data
(clears, time, downs by attack) decides the tuning.

## 10. Open questions

1. Apply the "no self-revive at Peril 3 solo" rule to Grumblecrag too?
2. Should the other bosses need a Grumblecrag clear first, or all be open
   from the start?
3. Are the boss names OK: Tidewyrm, Gloomshade, Emberwing, Storm Twins
   (Fizz & Crackle)?
4. Raid of the Week: one rotating boss (proposed), or every boss weekly?
5. Five slots or four: add a fifth cosmetic slot later (e.g. a victory pose
   or footstep trail)?
