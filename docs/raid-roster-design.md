# Raid Roster, Shop & Missions — Design Spec (approved)

Status: **approved Oct 17. Step 1 (Raid Hub, Raid of the Day, Victory slot, migration 009) shipped Oct 17. Step 2 (coins, daily missions and the Shop with the whole catalog, migrations 010–011) shipped Oct 17. Step 3 (Tidewyrm, migration 012) shipped Oct 18; next is a play session, then step 4, Gloomshade.** See §11 for what step 2 draws and what's still simplified. In step 1 the Victory plays in the arena on round and raid wins; showing it on the results card and in the menu preview is still to do. Numbers are starting values to tune
with real play, using the same balance data Grumblecrag already records.

Decisions so far (Oct 17):

1. Solo Peril 3 has no self-revive, on every boss including Grumblecrag.
2. New bosses unlock after clearing Grumblecrag.
3. Boss names approved.
4. A featured boss **every day** (Raid of the Day).
5. A fifth cosmetic slot: **Victory**.
6. **Seven bosses, one for each day of the week.**
7. A **Shop** that sells cosmetics for coins earned from daily missions and
   boss raids (§10), with **56 champion skins in four rarities**, including
   Mythicals that awaken as you play.

The full list, with later decisions, is in §12.

## 1. Goals

- Turn Boss Raid into a **Raid Hub**: a page of seven bosses, each with its
  own challenges, rewards and records, and one featured each day.
- Every boss teaches a **different kind of teamwork**, not a reskin of the
  same fight:

| Day | Boss | Element | Teamwork it asks for | Difficulty |
|---|---|---|---|---|
| Sat | Grumblecrag (existing) | Earth | Baiting and stacking | ★ |
| Fri | Tidewyrm | Water | Sharing safe ground, rescuing a trapped ally | ★★ |
| Mon | Gloomshade | Shadow | Reading tells, spreading out | ★★ |
| Wed | Somnara | Psychic | Calling out what only one of you can see | ★★ |
| Sun | Prismatail | Light | Forming a relay chain | ★★★ |
| Tue | Emberwing | Fire | Being in several places at once | ★★★ |
| Thu | Storm Twins | Electric | Pairing up, timing two kills | ★★★ |

The days follow the old planet names of the week: Sun's day for light,
Moon's day for shadow, Mars (Tuesday) for fire, Mercury (Wednesday) for the
mind, Thor's day for thunder, Venus (born of the sea) for water, and Saturn
for stone.

- Rewards stay **cosmetic only** (no stat bonuses), so veterans never make
  the raid easier for others.
- Rewards take **weeks, not one evening**: per-boss ladders, skill feats,
  daily play and cross-boss goals.
- Every boss supports **1–4 players**, solo at every Peril (see §3).
- All designs are original: cute but menacing, no Pokémon likenesses.

## 2. The Raid Hub

**Entry:** choosing *Boss Raid* on the Play panel opens the Hub instead of
going straight to a room.

**Hub page, top to bottom**

1. **Header:** rewards earned across all bosses (e.g. "23 / 84 rewards"),
   lifetime clears, and the current Grand Tour progress (§2.1).
2. **This week strip:** seven small day tiles, Sun → Sat, each with its
   boss's crest. Today's tile is large and lit.
   - Past days you cleared get a check mark; missed days are dimmed.
   - Tapping a tile opens that boss.
3. **Raid of the Day card:** today's boss, its trait, Peril 2, today's board
   (top 10 per party size), a countdown to the next boss, and *Raid today's
   boss*.
4. **Boss cards** for all seven, in a grid (one column on phones, swipeable
   like the champion roster). Each card shows:
   - Boss art (idle animation), element chip and its day.
   - Difficulty stars.
   - The signature mechanic in one line ("Strand it on an island").
   - Your best Peril cleared (P1/P2/P3, with a no-downs mark).
   - Reward progress (e.g. 4/11).
   - A "NEW" ribbon until first played.
   - A lock with "Clear Grumblecrag to unlock" when locked.

**Unlocks**

- Grumblecrag is open from the start; it's the tutorial boss.
- The other six unlock after **any clear of Grumblecrag**.
- Peril 2 and 3 unlock **per boss**, the same way they do today.

**Boss page** (tap a card) has four tabs:

1. **Overview:** a flavour blurb, the three chapters and their goals, an
   illustration of the signature mechanic, and the champion tricks that
   apply (§6).
2. **Attacks:** every attack with its warning shape, a tip, and *Practice
   this*.
3. **Rewards:** the full ladder with exact progress, equip buttons, and a
   preview of each cosmetic on your current champion.
4. **Records:** best time per party size, clears per Peril, today's board
   (if it's that boss's day), and recent runs.

**Actions:** *Create raid room* (boss and Peril chosen here), *Join with
code*, *Play solo now*.

- Room codes carry the boss, so friends who join land in the right fight.
- The host gets a boss switcher in the raid lobby; changing it un-readies
  everyone, like party rules do now.
- The Bestiary button becomes *Raid Hub*. Profile, results and lobby links
  open the Hub on the relevant boss.

### 2.1 Raid of the Day (replaces Raid of the Week)

- **One featured boss per day** on the fixed schedule above. Everyone
  gets the same seed and trait, at Peril 2.
- **The day changes at midnight Pacific time.** That's where the group
  plays, and it avoids a 5 pm switch in the middle of an evening. The
  server decides the day, so everyone agrees.
- **Today's board:** top 10 per party size (solo, duo, trio, four). It
  resets daily; past days are kept in history.
- Open to anyone who has cleared Grumblecrag, even without that boss's
  Peril 2 unlock (like the weekly works now). Saturday (Grumblecrag) is
  open to everyone.
- **Grand Tour:** clear each day's boss *on its day*, all seven within one
  Sunday–Saturday week. The reward is the *Seven Suns* victory (§7). The
  Hub shows the tour as seven checks.
- **Until all seven bosses exist:** the days of unbuilt bosses feature the
  built ones in turn, and the Grand Tour starts once all seven are out.

## 3. Solo rules (decided)

- Every boss and every Peril can be played solo.
- **Peril 1–2 solo:** one self-revive.
- **Peril 3 solo: no self-revive**, on every boss including Grumblecrag.
  One down ends the run.
  - This makes Grumblecrag's existing "Peril 3, no downs" reward harder
    solo; teams are unaffected. Rewards already earned are kept.
- Each team mechanic has a solo version (listed per boss) that's possible
  but asks more of one player.
- **Solo Peril 3 clear** is its own reward on every boss.

## 4. Shared rules (all bosses)

The same as Grumblecrag unless a boss says otherwise:

- Three HP-gated chapters, a rite pick between chapters, and the 8-minute
  combat limit.
- Peril damage ×1 / ×1.1 / ×1.2.
- Health locks at the starting party size.
- Stagger meter, downed/crawl/revive, team signals, practice drills,
  stand-in AI for disconnects, "what downed you" tips, contribution stats.
- Traits (one rolled per run, three per boss) and rare Gilded runs.
- **Team signals:** the third key changes meaning per boss.
  - Grumblecrag: "Bait here"
  - Tidewyrm: "Island here"
  - Gloomshade: "That's the real one"
  - Somnara: rune calls (see §5.5)
  - Prismatail: "Relay to me"
  - Emberwing: "Take this brazier"
  - Storm Twins: "Pair with me"
- **Rites:** the six existing rites stay shared, and each boss adds one
  themed rite to its offer pool.

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
a long tail ending in a glowing crescent moon. Cute until it grins. (It
carries no lantern, so it never looks like Duskveil, the champion who is a
hooded lantern wisp.)

**Arena:** the Lantern Yard, with **4 lanterns** that make pools of light.
Outside the light, the screen edges dim (vision shrinks by about 25%, never
fully dark).

**Signature: find the real one.**

- From chapter 2, Gloomshade splits into 3 copies (4 on Peril 3).
- Only the real one **casts a shadow inside lantern light**, and its
  crescent tail flickers in time with the music.
- Hitting a decoy pops it into a Curse Puff on the hitter.
- Hitting the real one 6 times in a row **exposes** it: all decoys vanish
  and the core is open for 5 seconds.

**Health:** 1050, +1000 per extra raider (changed from 1300 + 870 after the
bot check in §11.3).

| Attack | Warning | How to beat it | Dmg |
|---|---|---|---|
| **Shadow Lunge** | A dark line from a shadow to one raider, 1.2 s | Sidestep. It comes from the nearest shadow, not the boss | 25 |
| **Grasping Hands** | A checkerboard of tiles darkens | Stand on a lit tile. The pattern shifts on Peril 2+ | 20 |
| **Lantern Snuff** | One lantern dims, then goes out | Hit it 2 times to relight. Unlit lanterns mean less light to find the real one | — |
| **Creeping Curse** (ch. 2+) | A purple mark on one raider; it spreads to anyone within 120 px for 2 s | Spread out. 3 stacks = Haunted (5 dmg/s for 6 s). Stand in lantern light for 2 s to cleanse | 5/s |
| **Mirror Split** (ch. 2+) | The boss blinks, then 3–4 copies appear | Find the shadow and the flickering crescent | — |
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

### 5.5 Somnara, the Dream Whale — "Only the Dreamer Knows" (Psychic, ★★)

**Look:** a huge, sleepy sky whale, lavender and starry, with a nightcap of
cloud. Its back is a tiny floating island with a little house on it. It
hums in its sleep, and the music notes it hums are its attacks.

**Arena:** the Cloud Deck, with **4 rune pads** near the corners (Circle,
Star, Moon, Wave) and soft cloud floor.

**Signature: the Dream Sequence.**

- Somnara hums a sequence of 3 runes (4 on Peril 2, 5 on Peril 3).
- **Only one raider, the Dreamer, sees it.** It shows above their head on
  their own screen only.
- The team has 10 s to step on the pads in that order; any raider can
  step on any pad.
- **Right order:** Somnara wakes with a jolt, **exposed** for 6 s.
- **Wrong pad:** a Nightmare burst hits everyone for 18 and the sequence
  restarts with a new Dreamer.
- The Dreamer calls the runes with four quick signals (keys **1–4**, or a
  rune bar on touch). Teammates see the calls as rune icons over the
  Dreamer's head, so no voice chat is needed.
- From chapter 3 on Peril 3, some sequences are shown **backwards** (an
  arrow says so), and the Dreamer has to call them in reverse.

**Health:** 1050, +1000 per extra raider (changed from 1300 + 870 after the
bot check in §11.3).

| Attack | Warning | How to beat it | Dmg |
|---|---|---|---|
| **Lullaby Rings** | Soft rings ripple out from the whale | Each ring that touches you adds a Drowsy stack; 3 stacks = asleep for 2 s, unless a teammate taps you awake (any hit wakes you, harmlessly) | 6 + Drowsy |
| **Tail Splash** | A wide rectangle beside the whale | Leave it | 26 |
| **Dream Bubbles** | Floating orbs drift toward the nearest raider | Pop them (one hit) or outrun them; touching one adds Drowsy | Drowsy |
| **Falling Stars** (ch. 2+) | A constellation flashes for 1.5 s, then stars land on its points | Remember the shape, then stand between the stars | 22 each |
| **Whale Song** (ch. 2+) | A 4 s channel; the whole arena hurts except a moving Quiet Zone | **Everyone into the Quiet Zone**: a stack mechanic. It shrinks on higher Perils | 30 |
| **Nightmare** | Only after a wrong rune | Get the order right | 18 |

**Chapters**

1. **Dozing:** lullabies, tail splashes and bubbles. Short 3-rune
   sequences teach the rune pads.
2. **Deep Sleep:** stars and Whale Song begin, and sequences get longer.
3. **Waking Dream:** faster rhythm, sequences while other attacks
   continue, and backwards sequences on Peril 3.

**Traits**

- *Deep Slumber:* longer sequences, but exposure lasts 2 s longer.
- *Restless Dream:* more bubbles, but sequences are one rune shorter.
- *Starry Night:* more Falling Stars, but a bigger Quiet Zone.

**Themed rite: Lucid.** Immune to Drowsy from bubbles. You also see the
first rune of every sequence, even when you're not the Dreamer.

**Solo version:**

- You're always the Dreamer.
- You get 14 s to step the sequence.
- Sequences are one rune shorter than a team's.

**Practice drills:** Lullaby Rings, Falling Stars, Whale Song, Dream
Sequence.

**Engine note:**
- The Dreamer-only sequence must be sent privately to that one player, not
  in the shared snapshot everyone receives, so others can't peek.
- Drowsy is a new status type.
- No new movement physics are needed.

### 5.6 Prismatail — "Carry the Light" (Light, ★★★)

**Look:** a crystal peacock with a puffed-out chest and a sunny, proud face.
Its tail fan is a ring of prism feathers that throws rainbows on the floor.
A glowing crystal heart sits behind a clear shield.

**Arena:** the Sun Atrium, a bright hall with a **skylight** that drops a
sunbeam, and **4 mirror posts**.

**Signature: the Light Relay.**

- The crystal heart is shielded.
- When the skylight opens, a sunbeam lands at one spot and shoots toward
  the **nearest raider** within 300 px.
- A raider standing in a beam **passes it on** to the nearest *other*
  raider or mirror post within 300 px. The chain keeps going until it
  reaches the boss (within 260 px of it).
- When it arrives, the shield shatters: **exposed** for 6 s.
- Standing in a beam is bright: 3 damage/s to whoever holds it.
- The boss keeps walking away from the skylight, so longer chains, and
  more raiders in a line, are needed as it goes.

**Health:** 1350, +880 per extra raider.

| Attack | Warning | How to beat it | Dmg |
|---|---|---|---|
| **Prism Lance** | A thin line locks onto one raider for 1.1 s | Step out of the line | 25 |
| **Fan Display** | The tail opens into 6 coloured cones; the crest on its head glows **one colour** | Only cones of the crest's colour fire. Read the crest and stand in another colour | 24 |
| **Glare** | The crest flashes white for 1 s | **Face away**: anyone aiming toward the boss when it flashes is blinded (screen whites out for 1.5 s) | — |
| **Refraction** (ch. 2+) | Prism Lances bounce off mirror posts; the bounce lines are shown | Read the bounces, not just the first line | 25 |
| **Halo Crush** (ch. 2+) | A ring of light closes in on one raider, with one gap | Dash out through the gap | 28 |
| **Split Light** (ch. 3) | **Two** sunbeams at once | Both chains must reach the heart within 3 s of each other | — |

**Chapters**

1. **Dawn:** lances, fans and glare. One short relay, the boss stays near
   the skylight.
2. **High Noon:** refraction and halos; the boss wanders further, so
   chains get longer.
3. **Solar Crown:** faster rhythm and Split Light. Teams of 3–4 split into
   two chains.

**Traits**

- *Dazzling:* more Glare, but relay range is +60.
- *Overcast:* a dimmer beam needs one more link, but fewer lances.
- *Kaleidoscope:* the fan has 8 cones, but the shield breaks for 1 s
  longer.

**Themed rite: Polished.** Holding a beam doesn't hurt you, and your relay
range is +60.

**Solo version:**

- Mirror posts are hit-to-rotate. Each hit turns a post 45°, and the posts
  plus you make the chain.
- Split Light becomes one beam that must be held for 2 s.

**Practice drills:** Prism Lance, Fan Display, Glare, Halo Crush, Light
Relay.

**Engine note:**
- Beam chains are line-segment geometry rebuilt each tick, a new system.
- "Facing" uses the existing aim direction.
- On touch, aim follows the opponent, so Glare must turn auto-aim *away*
  from the boss during the flash. Otherwise touch players can't dodge it.
  This needs testing on phones.

---

## 6. Champion tricks across the roster

Every champion has **at least three bosses** where one of its skills is a
special answer, so "who should I bring?" is part of each boss.

**Voltkit** (3)
- **Tidewyrm:** Static Lance on a Stranded boss adds +15 stagger (water
  conducts).
- **Gloomshade:** Ball Lightning's burst lights the area for 3 s and shows
  true shadows.
- **Storm Twins:** absorbs Chain Lightning: no jump, +15 ultimate charge.

**Cindrake** (4)
- **Tidewyrm:** Magma Bomb pops a Bubble Prison in one hit.
- **Emberwing:** Blaze Whirl lights a brazier from range.
- **Somnara:** Ember Gust wakes sleeping allies in its cone at once.
- **Prismatail:** Sunfire Pillar counts as a relay point for 4 s.

**Tidefin** (3)
- **Tidewyrm:** Mirror Mist's clone can carry the dive ripple.
- **Emberwing:** Whirlpool puts out burning ground where it lands.
- **Somnara:** Mirror Mist's clone can step on a rune pad.

**Auralynx** (3)
- **Grumblecrag:** Mirror Guard blocks the volley.
- **Emberwing:** Mirror Guard reflects a Dive Bomb: +20 stagger.
- **Storm Twins:** Mirror Guard reflects the Link Beam into a twin: +20
  stagger.

**Lumoth** (4)
- **Grumblecrag:** Kindle fills half a revive.
- **Gloomshade:** Radiant Flare relights lanterns nearby and cleanses
  curse.
- **Emberwing:** Starfall Spray hits an airborne boss at full damage.
- **Prismatail:** Radiant Flare relays a beam it touches to *every* raider
  in range at once.

**Mystowl** (4)
- **Grumblecrag:** Ward splits the meteor.
- **Gloomshade:** Focus Ray passes through decoys and marks the real one.
- **Somnara:** Thoughtstrike shows the current sequence to the whole team.
- **Prismatail:** Ward blocks Glare for allies inside it.

**Terradon** (3)
- **Grumblecrag:** its shell stops a charge.
- **Tidewyrm:** Tremor pops all bubbles nearby and frees a Prison.
- **Storm Twins:** Hibernate grounds it: immune to Polarity.

**Duskveil** (4)
- **Gloomshade:** Curse Mark on the real one reveals it for 6 s.
- **Storm Twins:** Void Orb pulls one twin toward the other.
- **Somnara:** Shade Crawl leaves a trail that blocks Dream Bubbles.
- **Prismatail:** Void Orb swallows a Prism Lance.

Every boss has four champion tricks.

## 7. Rewards

### 7.1 Slots

**Five boss-agnostic slots:** you can mix pieces from any boss.

| Slot | What it is |
|---|---|
| Skin | Colours or a textured look on your fighter |
| Aura | A ring or effect beneath your fighter |
| Entrance | How you arrive each round |
| Frame | Your portrait border in lobbies and results |
| **Victory** *(new)* | A 2-second celebration when you win a round, a match or a raid. It also plays on your results card and in the menu preview |

The Rewards tab previews every item on your current champion before you
equip it. Titles keep using the profile title picker.

### 7.2 Per-boss ladder (the same shape on every boss)

| Goal | Reward |
|---|---|
| First clear | Title |
| 5 clears | Colours (skin) |
| 10 clears | Textured skin |
| Peril 2 clear | Entrance |
| Peril 3 clear | Mastery title + frame |
| Peril 3, no downs | Aura |
| **Feat** (a skill challenge) | **Victory** |
| **Speed** (Peril 2 under a target time, per party size) | Title |
| **Solo Peril 3** | "Lone …" title |
| **Lifetime stat** (wins and losses) | Title |

**Per boss**

- **Grumblecrag**
  - Existing: Cragbreaker, Cragbound colours, Cragstone skin, Mountainborn
    entrance, Mountain Conqueror + Conqueror frame, Mountain aura, Gilded
    Cragbreaker, Pillar Breaker, Mountain Guardian.
  - **New:** *Rockslide Flex* victory (feat: every charge in a run hits a
    pillar), *Avalanche* title (Peril 2 solo under 3:30), *Lone
    Mountain* (solo Peril 3).
- **Tidewyrm**
  - Titles: *Tidebreaker* (first clear), *Leviathan's Bane* (Peril 3).
  - Cosmetics: Seafoam colours, Pearlscale skin, Riptide entrance, Reef
    frame, Tidal aura.
  - **Splashdown** victory (feat: strand it 4 times in one run).
  - Lifetime: 30 strands, *Shipwright*.
- **Gloomshade**
  - Titles: *Lightbringer* (first clear), *Night's End* (Peril 3).
  - Cosmetics: Dusk colours, Moonlit skin, Shadowstep entrance, Crescent
    frame, Nightmote aura.
  - **Crescent Bow** victory (feat: nobody hits a decoy).
  - Lifetime: relight 50 lanterns, *Lamplighter*.
- **Somnara**
  - Titles: *Dreamwaker* (first clear), *Lucid Legend* (Peril 3).
  - Cosmetics: Twilight colours, Starlit skin (twinkling flecks), Dreamdrift
    entrance (bubbles), Moonglass frame, Lullaby aura (floating notes).
  - **Sweet Dreams** victory (feat: a run with no wrong runes).
  - Lifetime: 60 runes stepped, *Dream Weaver*.
- **Prismatail**
  - Titles: *Prismbreaker* (first clear), *Sunshatter* (Peril 3).
  - Cosmetics: Dawn colours, Prismatic skin (rainbow edges), Sunburst
    entrance, Stained-glass frame, Halo aura.
  - **Rainbow Fan** victory (feat: shatter the shield within 8 s of the
    beam, 3 times).
  - Lifetime: 80 relays, *Lightkeeper*.
- **Emberwing**
  - Titles: *Skyfeller* (first clear), *Wingbreaker* (Peril 3).
  - Cosmetics: Ember colours, Cinderplume skin, Firefall entrance, Brazier
    frame, Ember aura.
  - **Feather Fall** victory (feat: ground it within 20 s of take-off, 3
    times).
  - Lifetime: light 60 braziers, *Torchbearer*.
- **Storm Twins**
  - Titles: *Stormsplitter* (first clear), *Eye of the Storm* (Peril 3).
  - Cosmetics: Static colours, Thundercell skin, Lightning-strike entrance,
    Conductor frame, Spark aura.
  - **Twin Spark** victory (feat: both twins down within 2 s of each
    other).
  - Lifetime: 40 polarity pairs, *Perfect Pair*.

Each speed target is set after the first week of real clear times. A
guessed number would be either trivial or impossible.

### 7.3 Cross-boss and daily rewards

| Goal | Reward |
|---|---|
| Clear all 7 bosses (any Peril) | **Raid Veteran** title |
| Clear all 7 on Peril 3 | **Hall of Bosses** frame (cycles each boss's crest) |
| Peril 3 no-downs on all 7 | **Unbroken** aura (prismatic) |
| 100 total raid clears | **Boss Hunter** title |
| **Grand Tour**: each day's boss on its day, all 7 in one week | **Seven Suns** victory (seven elemental orbs) |

Days with a Raid of the Day clear are shown as a streak on your profile;
the streak is a record, not a reward.

**Totals**

| Group | Count |
|---|---|
| 6 new bosses × 11 | 66 |
| Grumblecrag (10 today + 3 new) | 13 |
| Cross-boss and Grand Tour | 5 |
| **Total** | **84** |

## 8. Engineering plan

**Shared (`packages/shared`)**

- Add `RaidBossDef` with:
  - id, name, element, day, stars
  - health, Peril damage, cadence, chapters, attacks and their numbers
  - `pattern(phase, peril, party)`
  - traits, themed rite, perks, signals
  - arena features
  - cosmetic and title definitions
- `RAID_BOSSES` registry; `GRUMBLECRAG` becomes its first entry.
- `raidDay(date)` → { day, boss, seed, trait }, using the Pacific calendar
  day.
- `RaidAttack` becomes a per-boss key union. `RaidState` gets:
  - `boss` (id)
  - `features`: pillars, islands, lanterns, rune pads, mirror posts,
    braziers or copper posts
  - `entities[]`: one boss, or two for the Twins
  - `marks`: curse, heat, polarity, drowsy
  - `beams`: Prismatail's relay chains
- `RaidLoadout` gains the `victory` slot.

**Server (`apps/server/src/raid/`)**

- `core.ts`: chapters, downs and revives, stagger, rites, contributions,
  receipts, practice, stand-ins, solo rules (including no Peril 3 solo
  self-revive).
- One module per boss implementing `startAttack`, `tick`, hit rules,
  feature updates and `standInHints`. Examples of hints: "island on High
  Tide", "spread on Heat Mark", "find an opposite partner", "go stand in
  the Quiet Zone", "step the called rune", "join the relay line".
- A private per-player event for Somnara's Dreamer sequence.
- `RaidArena` delegates to the boss module.

**Client**

- **Per boss:** art and motion modules (like `raid-boss-art.ts` and
  `raid-boss-motion.ts` today), warning renderers, feature drawing, and
  guide scenes.
- **New cosmetics:** six bosses × five slots, plus Grumblecrag's victory
  and the cross-boss items.
- **Victory slot:** a short rig animation plus a particle burst, played at
  round wins, raid wins and on the results card.
- **Hub and boss pages** (with tabs) in a new `raid-hub.ts`, including the
  week strip.

**Database (migration 009)**

- **Rewards table:** `arena_raid_rewards(id, boss, slot, kind, rule jsonb,
  name, description)` lists every reward and its rule. Rule kinds:
  - `clears >= n`
  - `peril >= n`
  - `flawless peril`
  - `time under (party)`
  - `solo peril`
  - `feat`
  - `lifetime stat`
  - `cross-boss`
  - `grand tour`

  Progress and unlocks are computed from this table, so each new boss
  needs **rows, not new SQL functions**.
- `arena_raid_players.feats jsonb` stores per-boss stats such as strands,
  lanterns, runes, relays, braziers and pairs.
- `arena_raid_runs` gains `daily boolean` and `day date`. The server
  supplies the day, and the daily board reads from them. The old weekly
  columns stay for history.
- `arena_record_raid` accepts any boss listed in the rewards table.
- `arena_raid_progress()` returns per-boss progress, cross-boss totals,
  today's board and Grand Tour state.
- **Loadouts:** a `victory` column; the hard-coded check constraint is
  replaced by a lookup in the rewards table.
- Existing Grumblecrag rows keep working.

**Tests per boss:**
- attack patterns per Peril and party size
- the signature rule (strand / expose / sequence / relay / ground / kill
  window)
- perks and solo rules
- stand-in hints
- database unlocks for every rule kind
- the daily rollover at Pacific midnight, including daylight-saving days

## 9. Build order and size

| Step | What | Size |
|---|---|---|
| 1 | Raid Hub, week strip, Raid of the Day, boss registry refactor, Victory slot, migration 009, Grumblecrag's new rewards and the Peril 3 solo change | Large |
| 2 | **Tidewyrm**: reuses the bait-to-a-feature idea, the gentlest new boss | Large |
| 3 | **Gloomshade**: reveal and curse systems, no engine changes | Large |
| 4 | **Somnara**: private Dreamer info, Drowsy, rune pads | Large |
| 5 | **Prismatail**: relay beams, facing check | Large |
| 6 | **Emberwing**: the airborne state | Large |
| 7 | **Storm Twins**: two boss entities | Largest |

Each step is played with friends before the next starts; the balance data
(clears, time, downs by attack) decides the tuning. Until all seven exist,
the Raid of the Day rotates through the bosses that are built.

## 10. Shop, coins and daily missions

### 10.1 Principles

- **Coins are earned in play only.** There's no real-money purchasing.
- **Everything in the shop is cosmetic.** Nothing bought changes combat.
- **Boss rewards can't be bought.** They stay proof you beat that boss.
  The shop sells its **own** collection, so buying never cheapens a raid
  reward, and raids stay the way to get raid looks.
- **Coins can't be farmed:** daily caps, no coins from practice, and
  reduced coins from bot matches (§10.3).

### 10.2 Earning coins

| Source | Coins |
|---|---|
| Each daily mission (3 per day) | 40 / 70 / 120 (easy / medium / hard) |
| All 3 daily missions done | +50 bonus |
| Raid clear | 30 at Peril 1, 45 at Peril 2, 60 at Peril 3 |
| Raid of the Day, first clear today | +50 |
| First raid reward of a new kind (title, skin…) | +25 |
| PvP match | 15 for a win, 6 for a loss |

### 10.3 Limits

- **Per day:**
  - Raid clears pay coins up to **5 times per day**; after that they
    still count for rewards.
  - PvP pays up to **10 matches per day**.
- **Bots:**
  - Bot matches pay only through missions that ask for them (e.g. "Beat a
    Hard bot").
  - Practice and drills pay nothing.
- **Mostly-idle matches** (under 20 s of active play) pay nothing.

Rough pace: a typical evening earns about **500 coins**:

| Source | Coins |
|---|---|
| 3 missions (40 + 70 + 120) + 50 bonus | ~280 |
| 3 Peril 2 raid clears + Raid of the Day bonus | ~185 |
| 4 PvP matches | ~40 |

At the prices below (§10.5.1), that works out to:

- A Common skin in about **one evening**.
- A Rare in **3–4 evenings**.
- An Epic in about **a week**.
- A Mythical in about **3 weeks**.
- A full collection in about **8 evenings**.

### 10.4 Daily missions

- **Three missions** each day: one easy, one medium, one hard. They
  refresh at the same Pacific midnight as the Raid of the Day.
- Picked from a pool by a daily seed, so friends get the **same three**
  and can do them together.
- **One free re-roll per day** for a mission you can't do (e.g. it needs a
  champion you don't like).
- **Example pool**
  - **Easy:** "Play 2 matches", "Clear any raid", "Land 30 skill hits",
    "Use your ultimate 3 times".
  - **Medium:**
    - "Win 2 PvP matches"
    - "Clear today's boss"
    - "Revive 3 allies"
    - "Win a match as an Earth or Water champion"
    - "Beat a Hard bot"
  - **Hard:**
    - "Clear any raid on Peril 3"
    - "Clear a raid with no downs"
    - "Win a 2v2 without being knocked out"
    - "Complete a boss feat"
- Missions are checked **on the server** from the same match and raid
  results that already exist, so they can't be faked from the browser.

### 10.5 The shop

**Where:** a *Shop* item in the menu (with an icon), and a coin balance
next to your name in the header.

**Layout**

- **Today's Picks:** 4 items that rotate daily (seeded, the same for
  everyone). One Common, Rare or Epic item is 20% off; Mythicals are never
  discounted.
- **Mythic Hall:** its own tab showing all eight Mythicals, each with a
  preview of its three Awakening stages (§10.5.1) and your progress toward
  unlocking it.
- **Catalog:** everything for sale, filtered by champion, rarity,
  collection and slot.
- **Previews:** every item has a live preview on its champion: idle, dash,
  skills, entrance and victory. Then *Buy* and *Equip*.
- **Owned items** show *Owned* and go straight into the loadout.

**What's sold**

1. **Champion skins:** 7 per champion, 56 in all (§10.6). This is the
   heart of the shop.
2. **All-fighter collections** for the Skin / Aura / Entrance / Frame /
   Victory slots, styled so they never look like boss rewards (§10.7).
3. **Later:** seasonal items for a limited time (e.g. a Halloween set),
   which return in later years.

### 10.5.1 Rarity

| Rarity | Border | What you get | Price | About how long |
|---|---|---|---|---|
| **Common** | Grey | A new palette on the champion's art | **500** | 1 evening |
| **Rare** | Blue | Palette + pattern + one small accessory + a matching dash trail | **1,500** | 3–4 evenings |
| **Epic** | Purple | All of Rare + recoloured skill effects, custom hit sparks, custom KO poof, one animated detail | **3,500** | ~1 week |
| **Mythical** | Animated gold-to-rainbow | All of Epic + animated body texture, ambient particles, its own entrance and victory, custom ultimate, and **three Awakening stages** | **8,000** + a Mythic Trial | ~3 weeks, then more to awaken it fully |

**Mythic Trial (to unlock the purchase):** win **30 matches or raid clears
with that champion**. The Mythic Hall shows the count, e.g. "Voltkit
18/30". Coins alone can't buy a Mythical; you have to be good with that
champion first.

**Awakening:** a Mythical grows as you play in it.

- **Stage I (on purchase):** the new look, skill effects, entrance and
  victory.
- **Stage II:** 25 wins wearing it. Adds the ambient effect (e.g.
  Voltkit's little rain cloud) and animated details.
- **Stage III:** 75 wins wearing it **and** a Peril 3 raid clear with that
  champion. Adds the full ultimate effect, a footstep trail, nameplate
  flair, and an animated frame for that champion's portrait.
- You can show any stage you've reached; it doesn't have to be the
  highest.

**Collection bonus:** own every skin in a collection (e.g. all *Winter*
skins) to earn that collection's frame for free.

**Fairness rules for every skin** (enforced in code review and tests):

- **Gameplay stays the same:**
  - Hitboxes, size, speed, timing and warning shapes never change.
  - Skill effects change colour and particles only, never shape or reach.
  - Every enemy skill keeps a readable outline in the game's standard
    enemy colour, so opponents can always read your attacks.
- **Nothing gets in the way:**
  - Screen-wide flourishes (like a sky darkening on an ultimate) only
    show on the **wearer's own screen**, and last under 0.5 s.
  - Ambient particles are faint and capped, and they turn off with
    reduced motion and on slower devices.
- **Entrances and victories:** entrances play only at round start;
  victories only after the round is decided.

### 10.5.2 Champion skins vs the all-fighter Skin slot

- A champion skin replaces that champion's look.
- An all-fighter skin (like Cragstone) styles whatever champion you play.
- If both are equipped, the **champion skin wins**, and the all-fighter
  skin applies to your other champions.
- The Shop and the Rewards tab both explain this in one line.

### 10.6 Champion skin catalog (56 skins)

Every champion gets **3 Common, 2 Rare, 1 Epic and 1 Mythical**. Skins also
belong to **collections** shared across champions:

- **Winter** (frost, snow and scarves)
- **Festival** (lanterns, paper and ribbons)
- **Garden** (petals, moss and blossoms)
- **Arcade** (neon and pixels)
- **Celestial** (all eight Mythicals: stars, suns and eclipses)

#### Voltkit (sugar-glider kit, Electric)

| Rarity | Skin | Look and effects |
|---|---|---|
| Common | Midnight | Navy fur, cyan cheeks |
| Common | Peach Fizz | Peach and pink, soft-drink bubbles on its tail tip |
| Common | Mint Static | Mint and white |
| Rare · Winter | **Snowcap** | Frosty blue fur, earmuffs; dash leaves snowflake sparks |
| Rare · Festival | **Kite Runner** | Paper-kite wing pattern, a tail ribbon that trails; dash leaves confetti |
| Epic · Arcade | **Neon Arcade** | Synthwave grid fur in pink and cyan. Skills turn neon magenta, hit sparks are pixel bursts, KO is a pixel "poof", and its antennae pulse like LEDs |
| **Mythical · Celestial** | **Stormcrown** | **I:** storm-grey fur with gold lightning veins; Spark Dart leaves a gold zig-zag; arrives in a lightning strike; victory is a thunderclap with a floating crown. **II:** a tiny rain cloud follows overhead, and lightning crawls up the antennae. **III:** Overcharge bursts into a lightning crown with branching bolts, footsteps crackle, and its name flickers with static |

#### Cindrake (magma newt, Fire)

| Rarity | Skin | Look and effects |
|---|---|---|
| Common | Ashen | Charcoal body with ember-orange crest |
| Common | Coral | Coral pink and cream |
| Common | Lime Flame | Green flame crest |
| Rare · Garden | **Chili Pepper** | Glossy red with a green stem cap; dash puffs spice dust |
| Rare · Winter | **Blue Flame** | Cool blue fire crest, white-hot skills |
| Epic · Festival | **Volcano Forge** | Blacksmith apron and goggles, molten-metal skin. Magma Bomb becomes a glowing ingot, hits throw anvil sparks, KO is a puff of forge smoke, and its crest pulses like bellows |
| **Mythical · Celestial** | **Sunforged** | **I:** obsidian body with sun-gold cracks; skills burn gold-white; arrives as a falling meteor; victory: its crest erupts in a sunburst. **II:** its crest becomes a small sun with orbiting flares. **III:** Sunfire Pillar becomes a solar column ringed by rotating sigils, footsteps leave brief golden glyphs, and its name glows like a corona |

#### Tidefin (axolotl duelist, Water)

| Rarity | Skin | Look and effects |
|---|---|---|
| Common | Bubblegum | Classic pink axolotl, magenta gills |
| Common | Abyss | Deep navy with teal gills |
| Common | Sandbar | Sand and sea-green |
| Rare · Garden | **Koi Pond** | Orange-and-white koi spots, a koi-scale sash; dash leaves lily pads |
| Rare · Festival | **Corsair** | Tricorn hat and striped sash; splashes scatter gold coins |
| Epic · Winter | **Glacier** | See-through ice-crystal body. Skills become ice, Whirlpool swirls with snow, hits shatter into shards, and its gills frost over and thaw |
| **Mythical · Celestial** | **Moontide** | **I:** a deep-sea body speckled with glowing dots; skills shimmer moonlit silver; it rises out of a ripple pool; victory is a ring of glowing bubbles. **II:** its gills glow like deep-sea lights, and soft ripples spread wherever it stands. **III:** Mirror Mist's clones become ghostly jellyfish, Riptide Wave carries a moon's reflection, and its name ripples |

#### Auralynx (crystal-fisted lynx monk, Aura)

| Rarity | Skin | Look and effects |
|---|---|---|
| Common | Snowshoe | White fur, ice-blue fists |
| Common | Desert | Tan fur, amber fists |
| Common | Twilight | Purple fur, rose fists |
| Rare · Garden | **Cherry Blossom** | Pink robe; petals drift down on dash |
| Rare · Festival | **Jade Temple** | Jade fists, red tassels; hits ring like a small bell |
| Epic · Arcade | **Stained Glass** | Fists and robe made of stained-glass panels. Prism Shot fires coloured glass, hits shatter into sparkles, Mirror Guard looks like a rose window, and light glints across it |
| **Mythical · Celestial** | **Celestial Sage** | **I:** fur full of slowly drifting stars; galaxy-crystal fists; steps through a star portal; victory: a meditative float with orbiting stars. **II:** a halo of floating stones orbits it. **III:** Mirror Guard becomes a turning mandala shield, Nova Burst blooms into a small supernova, footsteps leave fading stars, and its name twinkles |

#### Lumoth (fluffy moth, Light)

| Rarity | Skin | Look and effects |
|---|---|---|
| Common | Lunar | Silver-white fluff |
| Common | Peachy | Peach and cream |
| Common | Dusk | Lilac and navy |
| Rare · Garden | **Rosy Maple** | Pink and buttery yellow, like the real rosy maple moth; soft yellow dust puffs on dash |
| Rare · Festival | **Paper Lantern** | Wings like warm paper lanterns that glow from inside |
| Epic · Winter | **Aurora** | Wings ripple through northern-lights colours. Its dust becomes aurora ribbons, hits sparkle green-violet, and KO fades like dawn |
| **Mythical · Celestial** | **Starweaver** | **I:** wings woven from starlight with drifting constellations; arrives by unfurling from a cocoon of light; victory: spreads its wings and paints a star. **II:** glowing threads trail from its wings. **III:** Kindle sparks become shooting stars, Radiant Flare draws a constellation shaped like Lumoth, and its name shimmers |

#### Mystowl (three-eyed owl, Psychic)

| Rarity | Skin | Look and effects |
|---|---|---|
| Common | Snowy | White feathers, gold eyes |
| Common | Barn | Tan, heart-shaped face |
| Common | Midnight | Dark blue, silver eyes |
| Rare · Festival | **Scholar** | A tiny graduation cap and scarf (all three eyes stay visible); pages flutter on dash |
| Rare · Garden | **Witch's Familiar** | A pointed hat, potion-bubble dash trail |
| Epic · Arcade | **Clockwork** | Brass gears and rivets, ticking eye. Focus Ray becomes a golden clock-hand beam, Ward shows a clock face, and gears spin on its back |
| **Mythical · Celestial** | **Oracle** | **I:** its third eye opens onto a galaxy; it materializes from a blink; victory: all three eyes flare. **II:** original rune cards orbit it. **III:** Focus Ray becomes a galaxy beam, Ward shows a turning eye sigil, and its name has a faint third-eye glyph |

#### Terradon (boulder tortoise, Earth)

| Rarity | Skin | Look and effects |
|---|---|---|
| Common | Mossy | Green moss on the shell |
| Common | Sandstone | Red-orange layered stone |
| Common | Granite | Speckled grey |
| Rare · Garden | **Bonsai** | A tiny bonsai tree on its shell; leaves fall on dash |
| Rare · Winter | **Snowball** | Snow-covered shell, knitted scarf; puffs of snow on hits |
| Epic · Arcade | **Geode** | Shell cracks show glowing amethyst. Tremor bursts with crystal shards, hits sparkle violet, and the crystals pulse while it sleeps |
| **Mythical · Celestial** | **World-Shell** | **I:** a tiny floating island on its shell, with trees, a waterfall and clouds; it rises from the ground like a mountain; victory: tiny fireworks from the shell's village. **II:** little birds circle and the waterfall flows. **III:** Hibernate lights up a sleeping village, Tremor makes flowers spring up, and its name has a tiny leaf |

#### Duskveil (hooded lantern wisp, Shadow)

| Rarity | Skin | Look and effects |
|---|---|---|
| Common | Ember | Orange flame, charcoal hood |
| Common | Ghost White | Pale hood, blue flame |
| Common | Teal Spirit | Teal flame, navy hood |
| Rare · Festival | **Pumpkin Lantern** | A carved-pumpkin lantern; autumn leaves on dash |
| Rare · Festival | **Paper Lantern** | A red paper lantern with tassels |
| Epic · Garden | **Candlelight** | A melting-candle hood with wax drips. Ghostfire becomes candle flames, hits puff smoke, and KO is a blown-out wick |
| **Mythical · Celestial** | **Eclipse** | **I:** the hood becomes a total eclipse with a dark sun and a bright ring; it fades in like an eclipse; victory: the ring blooms. **II:** the ring flares and shadow wisps drift. **III:** Curse Mark becomes an eclipse sigil, Void Orb a tiny black sun, and its name has a ring |

### 10.7 All-fighter collections

Sold per piece (slot prices below) or as a bundle at 20% off. Rarity
applies here too.

| Collection | Colours (Common 300) | Aura (Rare 900) | Entrance (Rare 1,000) | Frame (Rare 800) | Victory (Epic 1,800) |
|---|---|---|---|---|---|
| **Candy** | Pastel swirl | Sprinkle ring | Pops out of a gift box | Frosted cookie | Confetti cake burst |
| **Galaxy** | Deep-space tint | Slow nebula ring | Warps in through a star tunnel | Planet-ring border | Supernova pose |
| **Retro Pixel** | 8-bit palette | Pixel heart ring | "Player 1" pixel spawn | Cartridge border | "LEVEL UP!" pixel burst |
| **Festival** | Lantern red-gold | Floating paper lanterns | Firecracker pop | Knot-and-tassel border | Fireworks finale |
| **Garden** | Spring green | Petal ring | Blooms from a flower | Vine border | Flower shower |
| **Winter** | Frost tint | Snowflake ring | Arrives in a snow flurry | Icicle border | Snowglobe shake |

Each collection costs about 3,900 coins as a bundle.

### 10.8 Coin sink and pace

| Item | Coins | At ~500 coins an evening |
|---|---|---|
| One champion's full skin line (3 Common + 2 Rare + Epic + Mythical) | 16,000 | ~5 weeks |
| Every champion skin | 128,000 | Long-term: a goal for the most dedicated |
| Every collection | ~23,400 | ~7 weeks |

To keep this motivating rather than a grind, harder play pays more:

- **Peril 3 clears** pay double.
- **The hard daily mission** pays 120 (up from 80).
- **Grand Tour** completion pays **+600**.
- **A 7-day mission streak** pays **+300**.
- **A missed day** can be made up once a week (decided). The make-up clear
  counts for the Grand Tour but not for the daily board.

### 10.9 Engineering

**Database (migration 010)**

- `arena_wallets(player_id, balance)`.
- `arena_coin_ledger(id, player_id, amount, reason, ref, created_at)`:
  **append-only**, with a unique `ref` per grant, so a retried save never
  pays twice. The balance is checked against the ledger in tests.
- `arena_shop_items(id, kind, slot, champion, name, price, set, active,
  available_from, available_to)`.
- `arena_owned_items(player_id, item_id, acquired_at)`.
- `arena_daily_missions(day, slot, mission)`, seeded and the same for
  everyone, plus `arena_mission_progress(player_id, day, mission,
  progress, done, rerolled)`.

**Rules**

- **Who grants coins:** only the game server's service role, through a
  `security definer` function, the same as raid records today.
- **Who spends coins:** the player, through `arena_buy_item(item_id)`.
  In one transaction it:
  1. Checks the item is on sale.
  2. Checks the player doesn't already own it.
  3. Checks the balance.
  4. Writes the ledger entry and ownership.
- **Loadouts** accept owned shop items alongside earned raid rewards.
  Champion skins get a per-champion loadout row:
  `arena_champion_looks(player_id, champion, skin_id, stage)`. `stage` is
  the Awakening stage the player chose to show, up to the highest
  reached.
- **Rarity and gates:** `arena_shop_items` gains `rarity`, `collection`,
  and for Mythicals `trial_wins` (30). `arena_buy_item` checks the Mythic
  Trial from **server-recorded wins** with that champion (PvP match
  ledger + raid clears). It never takes a count from the browser.
- **Awakening:** wins wearing a Mythical are counted when results are
  saved (`arena_skin_progress(player_id, skin_id, wins, peril3)`). Stages
  are computed, never stored as claims.

**Server:** mission progress updates when a match or raid result is saved,
and coin grants ride on the same receipts.

**Client:**
- The Shop page and coin chip.
- Mission cards on the home screen (progress bars, re-roll).
- The champion-skin rendering path in the rig, built in layers so each
  rarity reuses the one below:
  1. **Palette:** per-part colour remap of the existing art (cached
     textures, like Cragstone today).
  2. **Pattern:** spots, stripes, stars or panels painted onto parts
     (source-atop, like Cragstone's cracks).
  3. **Accessories:** small extra rig parts on anchor points (head, back,
     tail).
  4. **Effects:** skill colour sets, hit sparks, KO poofs, dash trails.
  5. **Mythical:** animated textures (a few pre-baked frames per part),
     ambient emitters, entrance and victory sequences, and stage flags.
- **Effect budget:** at most two Mythical ambient emitters on screen,
  capped particles, and all off under reduced motion.
- **Fairness tests:** skill shapes, sizes and timing are identical with
  and without every skin.

**Tests:**
- grant idempotency
- daily caps
- buying with too few coins
- double-buy
- ownership checks on equip
- mission completion from real results
- the daily rollover

## 11. Overall build order

| Step | What |
|---|---|
| 1 | Raid Hub + Raid of the Day + Victory slot + migration 009 (§9 step 1) |
| 2 | **Coins, daily missions and the Shop** (migration 010) with the **whole catalog at once** (decided): all 56 champion skins, the Mythic Hall with Awakening, and the six collections. Coins start flowing from the raids and PvP that already exist |
| 3–8 | The six new bosses, in the §9 order, each adding its rewards |

**Step 2 is the biggest single step in the plan:** 56 skins, 8 of them
Mythicals with three stages each, plus 30 collection pieces. It's built in
the layer order of §10.9 (palettes → patterns → accessories → effects →
Mythicals), so one shared system draws all of them. It still ships as one
release.

### 11.1 Step 2 as built

- **Champion skins** re-draw the champion's own vector art: a new palette,
  then (Rare+) a pattern masked to each body part and small accessories
  placed per facing, a dash trail; (Epic+) a skill colour for casts,
  projectiles, zones and hit sparks, a looping detail and a KO poof;
  (Mythical) its own entrance and victory bursts, an ambient effect per
  Awakening stage, permanent theme-specific additions at stages II and III
  visible in both Shop previews and battle (including reduced motion),
  and a stage-3 ultimate ring. Each stage has its own rig texture keys.
  Rig textures for a skin load the first time someone
  wearing it appears.
- **Simplified for now:** Epic "custom hit sparks" are the standard sparks
  in the skin's colour; Mythical "animated body textures" are animated
  effects drawn around the fighter rather than pre-baked texture frames;
  the stage-3 footstep trail and nameplate flair are not drawn yet.
- **Effect budget:** Mythical ambient effects for at most two fighters on
  screen (yours first); nothing animated under reduced motion.
- **Fairness tests:** every skin keeps each rig part's size, pivot and
  placement identical to the champion's own (tests/unit/skin-art.test.ts).
- **Collections:** Colours recolour the rig textures (eyes untouched), auras
  draw under the fighter, entrances burst at the round greeting, victories
  play around the champion's own celebration, frames are portrait borders.
- **Live Shop preview:** a single lazy-loaded Canvas scene shares the battle
  rig, skin textures, collection auras, entrance bursts and victory effects.
  Players can choose four facings and idle/run/dash/entrance/victory motion;
  frames use their actual portrait border. Motion starts paused with reduced
  motion enabled, and the pause choice survives item changes. Offscreen or
  background previews stop updating; switching tabs or closing destroys the
  preview. Facing and motion controls never call purchase/equip APIs.
- **Collection bonus** (migration 011): owning every champion skin in a
  collection (Winter, Festival, Garden) gives that collection's frame.

### 11.2 Step 3 as built (Tidewyrm)

- Built as designed in §5.1, on the shared raid core: `RaidArena` now has
  hooks (arena setup, attack start/resolve, per-tick boss step, chapter
  reset, stand-in hints) and `TidewyrmArena` overrides them.
- **Choices made while building** (easy to change): the stranded boss
  starts no new attacks until it swims home; Tidewyrm surfaced in water
  lingers 2.5 s, then returns to the centre under water (can't be hit);
  a sealed raider takes no other damage; the solo mash is 8 presses in a
  party too; chapter 3 keeps its armour (only strands and stagger expose
  it, unlike Grumblecrag's always-open last chapter); the speed title is
  Peril 2 solo under 4:00 (*Flash Flood*) and the solo Peril 3 title is
  *Lone Current* (names not in the original spec).
- **Bot check:** AI stand-in teams clear every Peril; solo runs take about
  80–90 s against Grumblecrag's 70 s (bots play far better than people,
  so only the comparison matters). Real tuning waits for the play session.

### 11.3 Step 4 as built (Gloomshade)

- Built as designed in §5.2 on the same hooks, as `GloomshadeArena`. One
  new hook: `worldStep` runs every tick even while the boss is staggered,
  so lanterns, curses and healing don't freeze during a stagger.
- **Choices made while building** (easy to change):
  - Six hits in a row only count **while copies are out**: in chapter 1
    the stagger bar exposes it. (Counting them with no copies let parties
    expose it every couple of seconds.) Hits from one raider count at most
    every 0.2 s; any hit on a copy resets the count.
  - The flicker is an irregular shimmer, not timed to the music, and the
    real one's moon has a faint halo.
  - The edges dim as lanterns go out (darker the more are out) instead of
    shrinking the view by 25%.
  - Shadow Lunge follows its target for half its warning, then locks.
  - Relighting: a shot that reaches the lantern, or a fresh attack press
    aimed at it from within 140 px. Radiant Flare reaches 240 px.
  - The real ring of a Nightmare Pulse marks the real one for 1.5 s.
  - Witching Hour re-splits as soon as an exposure ends.
  - Names not in the spec: *Moonrunner* (Peril 2 solo under 4:00) and
    *Lone Lantern* (Peril 3 solo).
- **Bot check** (5 seeds each): solo ≈ 91 s (Tidewyrm ≈ 84 s), three
  raiders ≈ 68 s (74 s), four ≈ 61 s (63 s), no downs. Bots play far
  better than people, so only the comparison matters.

## 12. Decisions log

| Date | Decision |
|---|---|
| Oct 17 | No self-revive at Peril 3 solo (all bosses) |
| Oct 17 | New bosses unlock after a Grumblecrag clear |
| Oct 17 | Boss names approved |
| Oct 17 | Seven bosses, one per day; Raid of the Day |
| Oct 17 | Fifth slot: Victory |
| Oct 17 | Shop with coins from daily missions and raids |
| Oct 17 | Daily changeover at midnight Pacific |
| Oct 17 | Grand Tour bosses must be cleared on their own day |
| Oct 17 | One make-up clear per week for a missed day |
| Oct 17 | Rarity tiers (Common / Rare / Epic / Mythical) with Mythic Trials and Awakening |
| Oct 17 | PvP coins only from matches against people |
| Oct 17 | All champion skins and collections ship together |
| Oct 17 | Mythical price confirmed: 8,000 coins + 30-win trial |
| Oct 17 | Opponents see a Mythical's Awakening stage |
| Oct 17 | Skin names and themes approved |

## 13. Open questions

None right now. Steps 1–4 are shipped; after a play session, step 5 (Somnara) is next.
