# Boss Raid

Open **Raids** from the town menu. The Hub offers all seven bosses, with ordinary
solo and 1–4-player co-op raids. Open a boss for chapters, attacks, rewards and
records, then **Create raid room** and invite friends, or **Play solo now**.
New bosses unlock after a first Grumblecrag clear. Boss Rush and Raid of the Day
have been retired; apply migration 028 after 027. Earned rewards remain owned.

In a raid room Every human readies up, confirms the illustrated boss introduction, and chooses a starting rite. Solo needs no AI partner. Against ★ and ★★ bosses a solo raider gets one automatic self-revive (8 s down, back with 30% / 25% health); against ★★★ bosses there is none, so one down ends a solo run (`raidSoloRevive(boss)` in `packages/shared/src/raid.ts` tells the client which). Existing champion selection, custom controls, touch joystick, camera and Socket.IO reconnection remain in use.

## Difficulty: the star tiers

Every raid runs at Peril 3 (since migration 030). A boss's stars (`RAID_BOSSES[boss].stars`) pick one row of `RAID_TIERS` (`packages/shared/src/raid.ts`), so one table tunes every boss:

| Setting | ★ Grumblecrag | ★★ Tidewyrm, Gloomshade, Somnara | ★★★ Prismatail, Emberwing, Storm Twins |
|---|---|---|---|
| Boss health × (on top of the Peril 3 formula) | 1.15 | 1.25 | 1.35 |
| Boss damage × (replaces Peril 3's 1.5) | 1.75 | 1.95 | 2.15 |
| Time between attacks × | 0.85 | 0.78 | 0.72 |
| Most damaging attacks live at once, chapters 1 / 2 / 3 | 1 / 2 / 2 | 2 / 2 / 2 | 2 / 2 / 3 |
| Telegraphs of 1.4 s or more × (never under 0.9 s) | 0.95 | 0.88 | 0.82 |
| Predictive aim: share of a run led / most it leads | 55% / 110 px | 70% / 140 px | 80% / 160 px |
| Exposure, strand and grounded windows × | 0.90 | 0.80 | 0.72 |
| Soft enrage from (seconds of combat) | 270 | 300 | 330 |
| Solo self-revive | 8 s, 30% health | 8 s, 25% health | none |
| Revive time / immunity after it | 3.5 s / 1.5 s | 4 s / 1.25 s | 4.5 s / 1 s |
| Party pressure (3+ raiders) | chapter 2+ | chapter 2+ | every chapter |

Parties also face a quicker rhythm: the time between attacks × (1 − 0.05 per raider after the first), so four raiders get ×0.85. Past the enrage time the boss **grows furious** (announced in the callout line, and *FURIOUS* in the boss bar): every 30 s, up to four times, it attacks 6% faster and hits 8% harder. Telegraphs never get shorter for it.

Peril 1 and 2 still exist for tests and the old rules (the boss keeps a fixed attack rotation there, and solo always gets a 6 s self-revive), but players never reach them.

## How bosses think

The shared brain lives in `apps/server/src/raid.ts` (`RaidArena`) with its pure helpers in `apps/server/src/raid-ai.ts`. Every boss gets it; a boss tunes it through hooks.

- **An attack deck, not a loop.** Each chapter's pattern is shuffled into a deck from the run's seed: never the same attack twice in a row, and the signature attack (charge, dive, split, dream, relay, brazier, polarity) at least once in every four. Chapter 1 first plays its cards in the authored (teaching) order.
- **Reactions.** A boss can jump an attack ahead of the deck when the fight calls for it (at most every other attack): Grumblecrag slams raiders who camp in melee (2.5 s, or two at once), throws a volley at a party keeping its distance in the open, and drops eruptions on a stack of three; Gloomshade pulses when two or more crowd the real one; Somnara tail-splashes a raider lingering at its side and stars a crowd. Hook: `reactions(situation)`.
- **Target choice** weighs, besides recent damage dealt and revivers: low health, fragile champions (under 145 health), and, for lane attacks, a raider whose dash is on cooldown. Never the same raider three times running. Floor blasts (debris, eruptions, stars) land on the middle of a stack.
- **Predictive aim.** A raider running in a straight line (same heading for 0.3 s, over 120 px/s) is led by the tier's share of their run, capped. Standing still, slowing or weaving is never led. A following shape (charge, lunge) is only re-aimed as it locks when a raider who sees the lock 0.45 s late can still walk out of it at the slowest speed; Tidewyrm's splash circle is never led.
- **Overlapping attacks.** A new attack can start while another is live, up to the tier's limit, if it is a different shape (circle, lane, cone, ring), is never a second jump, its impacts land at least 0.5 s from the others, and every raider still has a reachable safe spot. Otherwise it waits until the others have landed. Whole-floor and signature attacks never overlap.
- **Party pressure.** In a party of three or more, single-target attacks (volley, eruption, lance, dive-bomb, curse, chain lightning, tail splash, static field) go at a second raider 0.35 s later.
- **Less idle time.** Attacks resume 1.2 s into a chapter (was 2), 0.4 s after a stagger (was 1). Bosses that freeze while exposed thrash once halfway (Somnara: one softer lullaby ring; Tidewyrm: a tail sweep round the island as a strand ends).

### Fair warnings (the honesty rules)

`tests/unit/raid-fairness.test.ts` holds every boss to these, solo and in a party, and the server enforces them as warnings are placed (`settleWarnings`):

1. Every damaging hit falls inside a warning that was on screen for at least **0.9 s of server time** (phones lose some of it to interpolation and a slow connection). Follow-ups announced by an attack already on screen (eruption chains, the second slam, combos) are the only exception.
2. A shape that follows a raider freezes at least **0.6 s** before it lands (long enough to walk out of a circle at 222 px/s) and never moves again.
3. A predicted aim point is drawn where it lands. The server never hits outside the drawn shape.
4. No more than the tier's number of attacks live at once, impacts at least 0.5 s apart, and a reachable safe spot for every raider.
5. Attacks dodged by jumping that cover the same ground land at least the jump cooldown + 0.3 s apart (Gloomshade's paired pulses and Somnara's lullaby rings are spaced that way on live raids).

A scripted dodger that reacts 0.45 s late at the slowest champion's speed must take no damage from single attacks, standing still or running straight into them.

### Measuring it

`npx tsx scripts/balance/raid-sim.ts [runs] [bosses] [sizes] [reactions]` plays whole raids with the stand-in bots and prints, per boss, party size and reaction time (0.35 s typical, 0.15 s near-perfect): win rate, time-outs, time per chapter, clear time, downs and their causes, incoming damage per raider per minute, time under threat and free-damage time. Stand-ins are a proxy: compare with `arena_raid_balance()` from real runs.

## The encounter

Grumblecrag is a separate boss entity with a larger hit radius and custom artwork. Everyone is on one team; friendly fire is disabled. Its health scales with the starting party size and is locked for the run, so leaving cannot lower its health.

The encounter has three HP-gated chapters. Attacks cannot bypass a chapter with burst damage or reflection. Between chapters, pick another raid rite; previous rites remain. Chapter changes rebuild the pillars. An eight-minute active-combat limit bounds a run; drafting and reconnect pauses do not count toward the clear timer. The pacing target is roughly four to six minutes for a successful run; actual clear lengths and difficulty still need human multiplayer balance testing. All of Grumblecrag's numbers (health, damage, sizes, timings, attack order) live in one data block, `GRUMBLECRAG` in `packages/shared/src/raid.ts`, so tuning or adding a second boss is mostly data.

- **Charge:** a long ground warning follows the marked player, then locks for a 0.6-second dodge window (it watches 0.15 s longer from the third pillar it breaks in a chapter, so baiting needs cleaner timing). A crosshair and party status identify the target. It runs at 700 px/s. Bait it into a pillar to break armor and expose the core for 7 s (× the tier's windows), with a 2 s pause. From chapter 2 (chapter 3 alone), a charge that misses every pillar turns and comes back at its target (a 0.9 s warning). In chapter 1 the charge never leads its target.
- **Ground slam:** a circular warning tells everyone to jump. Jumping avoids its damage. Chapters two and three add a second slam 2.3 seconds after the first, allowing the two-second jump cooldown to recover. Stagger and chapter transitions cancel follow-ups.
- **Falling debris:** leave the marked circles before they detonate.
- **Rock volley:** a red cone of stones towards one raider. Leave the cone or put an unbroken pillar between you and the boss.
- **Chasing eruption:** orange vents erupt under one raider (or in the middle of a stack around them) two or three times in a row, each where they now stand. Keep running, and away from your team.
- **Shared meteor:** a gold circle follows a marked raider. Its damage is split between everyone standing in it when it lands, so gather on them; pips above the circle show how many are sharing. Alone (or the last raider standing), it turns red and locks in place shortly before landing, so it can be dodged instead.
- **Stagger:** armor breaks and player attacks fill a shared meter. At full stagger, the boss stops attacking for six seconds and takes amplified damage. Save ultimates for this opening.

Chapter one teaches charges, slams, volleys and debris. Chapter two adds the double slam, chasing eruptions and the shared meteor. Chapter three keeps the core cracked (×1.2 damage; a pillar still opens it to ×1.6) and attacks about 15% faster, chaining attacks together: the double slam into debris, a volley straight into eruptions, and a shared meteor into eruptions on the stack's middle ("stack, then scatter"). Its closing ring shrinks 2.5 px/s and burns 9 a second outside it. The boss sheds a shoulder plate in chapter two and both plates in chapter three; final-phase fragments orbit its enlarged core. Breaking a pillar throws off glowing armor fragments.

Contextual combat prompts shorten after the first two uses of each attack. Downed teammates have a green rescue marker and progress ring. Each chapter's objective is shown during the upgrade break. Every rite choice allows 15 seconds, and all choices confirmed ends the break early. Landscape screens show three choices side by side; the team build details can be expanded below them.

Normal crowd control adds stagger rather than stun-locking the boss. The boss cannot be pushed around by ordinary knockback. Downed teammates can crawl; standing nearby revives them. Being hit interrupts the rescuer, but progress is retained. A solo run against a ★ or ★★ boss gets one self-revive; another down ends it. Against a ★★★ boss solo has no self-revive: one down ends the run. A wiped co-op team loses.

## Tidewyrm

A sleepy sea serpent fought in the **Lagoon Court**: shallow water with four raised islands you can stand on (no walls). Its numbers live in `TIDEWYRM` and its attack order in `tidewyrmPattern` (`packages/shared/src/raid.ts`); the fight is `TidewyrmArena` in `apps/server/src/raid-tidewyrm.ts`, which reuses the raid core (chapters, rites, downs, stagger, practice, stand-ins).

- **Dive & Surface (signature):** it dives (can't be hit under water) and a ripple follows one raider for 1.4 s, then locks for 0.7 s. It surfaces there with a splash ring. It goes after raiders out in the water, away from the islands (never one already on an island), so the team has to carry the ripple onto one; stranded on the same island twice running, it stops chasing raiders near it. Alone, the splash freezes 0.8 s before it lands. Surfacing **on an island strands it**: exposed for 4.25 s (× the tier's windows; 7 on Peril 1), stagger, and a strand counted for the raider it chased. As a strand runs out it sweeps its tail round the island: jump it or stand clear. An island sinks after two strands until the next chapter. Tidefin's Tide Double clone carries the ripple.
- **Tidal Wave:** a band sweeps across from the edge nearest the raiders in the water. Chapter 1 waves are low (jump them); from chapter 2 they're high (only an island is safe). In chapter 3 a low wave is followed 2.3 s later by a high one from a side edge.
- **Bubble Barrage:** 9–11 bubbles in a fan at a party, 7–9 at a lone raider; from chapter 2 a party of three or more gets a second fan at another raider. A hit roots you for 0.8 s; attacks pop them; Terradon's Tremor clears them.
- **High Tide** (ch. 2+): the floor floods for 5 s; off the islands you take damage and slow down. Two raiders fit on an island; a third is pushed off (solo: no limit).
- **Undertow** (ch. 2+): a whirlpool at the centre pulls everyone in for 3 s; its centre hurts. Dash outward.
- **Bubble Prison** (ch. 2+): the raider farthest from their teammates is sealed and drifts to the boss's mouth over 5.5 s. Teammates pop it with three hits (Cindrake's Magma Bomb in one, Terradon's Tremor frees it, Pyranda's Chestnut Storm pops it with every bubble where it lands, and Coilemur's Magnet Lash yanks the raider out to Coilemur's side); the trapped raider can mash attack (12 presses) to break out. Reaching the mouth downs you.
- **Champion tricks:** Voltkit's Static Lance on a stranded Tidewyrm adds stagger; Tidefin's Tide Double carries the ripple; Glacelle's Frost Bloom on a stranded Tidewyrm keeps it there 2 s longer; the prison breakers above.
- **Storm Surge** (ch. 3): faster rhythm; High Tide leads straight into a dive at whoever is in the water farthest from a free island, and the Undertow into a wave. On Peril 3 an island sinks for good every 40 s (32 s solo), down to two. High Tide burns 9 a second; the Undertow pulls harder.
- **Traits:** Murky (fainter ripples, strands last 1 s longer), Rip Current (stronger Undertow, slower waves), Spring Tide (longer High Tide, bigger islands). **Themed rite:** Sure Footing (no bubble roots, 15% faster in water). **Signal:** the third key is "Island here".
- **Rewards** (migration 012): Tidebreaker (first clear), Seafoam colors (5 clears), Pearlscale skin (10), Riptide entrance (Peril 2), Leviathan's Bane title + Reef frame (Peril 3), Tidal aura (Peril 3, no downs), Splashdown victory (feat: strand it 4 times in one run), Flash Flood (Peril 2 solo under 4:00), Lone Current (Peril 3 solo), Shipwright (30 strands, wins and losses).

## Gloomshade

A floppy-eared puff of shadow with a crescent-moon tail, fought in the **Lantern Yard**: a moonlit courtyard with four lanterns that make pools of light (no walls). The edges of the yard dim as lanterns go out, but it never goes fully dark. Its numbers live in `GLOOMSHADE` and its attack order in `gloomshadePattern` (`packages/shared/src/raid.ts`); the fight is `GloomshadeArena` in `apps/server/src/raid-gloomshade.ts`. Health: 1050, +1000 per extra raider (more of it comes with each raider than for the other bosses, because finding the real one costs a solo raider more time).

- **Mirror Split (signature, ch. 2+):** it splits into 3 copies (4 on Peril 3; one fewer solo, one more with three or more raiders; Moonlit +1, Hollow −1). Each copy drifts to its own spot on its own clock. Only the real one **casts a shadow in lantern light**, and only its moon tail flickers. Hitting a copy pops it and gives the hitter a curse stack. **Six hits in a row** on the real one (while copies are out, with no gap over a second) make the copies vanish and expose its core for 4.5 s (× the tier's windows). In chapter 1 there are no copies: fill the stagger bar instead.
- **Shadow Lunge:** a lane from the nearest shadow (a copy, or a lantern that's gone out) to one raider; it follows them, then locks 0.65 s before it lands. Sidestep it. From chapter 2 a second lane comes from the next-nearest shadow half a second later (a cross), and a party of three or more gets a second lunge at another raider.
- **Grasping Hands:** half the floor's tiles (an 8 × 5 checkerboard that matches the flagstones) darken: the half most raiders stand on; stand on a lit tile. The board flips once (always from chapter 2): the tiles flicker just before, at least 0.6 s before the hands close.
- **Lantern Snuff:** the lantern a cursed raider needs (else the one most raiders use) dims and goes out with a burst that hurts everyone in its light. Two hits relight it (a shot or a swing aimed at it). In chapter 3 it goes out faster.
- **Creeping Curse** (ch. 2+): a stack on the raider with the most friends close by. Anyone within 120 px of a cursed raider for 2 s (3 s with Restless Spirits) gets a stack too. Three stacks = **Haunted**: 8 damage a second for 6 s. Two seconds in lantern light cleanses it. Solo, the curse instead grows if you stand still for 2.5 s.
- **Nightmare Pulse:** a ring expands from every copy, but only the real one's hurts: jump it. The real ring marks the real one for a moment. In chapter 3 pulses come in pairs, 2.3 s apart so both can be jumped.
- **Champion tricks:** Voltkit's Ball Lightning lights its landing spot for 3 s; Lumoth's Radiant Flare relights lanterns and cleanses curses nearby; Mystowl's Third-Eye Ray, aimed at the real one, marks it for 4 s; Duskveil's Haunted Lantern on the real one reveals it for 6 s; Pyranda's Chestnut Mortar relights a dark lantern it lands on; Sunbara's Warm Spring and Sanctuary cleanse curses from allies inside; Wombolder's Landslide on the real one shakes off every copy until it splits again; Shadopus hidden in Ink Cloud is never picked as a target (alone and hidden, Gloomshade waits).
- **Traits:** Moonlit (wider lantern light, one extra copy), Restless Spirits (more Grasping Hands, slower curse spread), Hollow (fewer copies, fainter shadow). **Themed rite:** Lamplighter (one hit relights a lantern; lantern light heals 1% a second). **Signal:** the third key is "That's the real one".
- **Rewards** (migration 013): Lightbringer (first clear), Dusk colors (5 clears), Moonlit skin (10), Shadowstep entrance (Peril 2), Night's End title + Crescent frame (Peril 3), Nightmote aura (Peril 3, no downs), Crescent Bow victory (feat: nobody hits a copy all run, with at least one split), Moonrunner (Peril 2 solo under 4:00), Lone Lantern (Peril 3 solo), Lamplighter (50 lanterns relit, wins and losses; a run counts at most 20).

## Somnara

A sleepy lavender sky whale carries a cottage on its back above the **Cloud Deck**. Four pads show Circle, Star, Moon and Wave. The camera keeps the complete deck visible so teams can coordinate.

- **Dream Sequence:** only the Dreamer receives the sequence. Call runes with **1–4** or the touch rune bar, then enter the matching pads in order. Numeric skill aliases temporarily become calls for the Dreamer; Q/E/R/F still cast skills. A wrong pad or timeout causes a 26-damage Nightmare that leaves everyone a Drowsy stack, and gives a fresh sequence to another living raider. A correct sequence exposes Somnara for six seconds (× the tier's windows); halfway through it sends out one softer lullaby ring. Leave a pad before entering it again. **Somnara keeps attacking while a dream runs**, a little slower: only lullabies, bubbles and tail splashes in chapter 1, anything but Whale Song later. It swats a raider lingering at its side with its tail, and drops stars on a crowd of three. Stars never land on a pad, the Dreamer on a pad is never the target, and dream bubbles chase whoever is closest to the next right pad.
- **Solo:** always the Dreamer, one fewer rune, twelve seconds instead of a team's nine. Chapter one teaches short sequences; later chapters scale to Peril. Final Peril 3 dreams can display backwards: read right to left.
- **Lullaby Rings:** jump the expanding rings (12 damage each; on live raids they are 2.3 s apart, so every ring can be jumped). Rings and drifting **Dream Bubbles** (four with three or more raiders) add Drowsy; three stacks put you to sleep for 2.5 seconds. Attacks pop bubbles. Allies can hit sleeping teammates awake without friendly damage; this does not cancel Terradon's own Shell Up.
- **Tail Splash:** leave the marked lane (it aims where a runner is heading). **Falling Stars** (chapter two onward) land on constellation points around the middle of the party; stand between them. **Whale Song** channels for four seconds, hurting anyone outside the moving teal Quiet Zone, which opens 300–450 px from the party (still in reach of the slowest champion).
- **Traits:** Deep Slumber adds a rune but extends exposure by two seconds. Restless Dream sends more bubbles but shortens sequences. Starry Night adds stars and enlarges the Quiet Zone. **Lucid** prevents bubble Drowsy and privately shows the first rune even to non-Dreamers.
- **Champion tricks:** Crest Flare wakes allies throughout its cone; Tide Double's double can enter a rune pad; Silent Swoop reveals the current sequence to the team; Shade Crawl leaves bubble-blocking trails; Sunbara's Warm Spring wakes sleepers and keeps allies inside from going Drowsy; Astrabun's Moon Hop landing on (or within 90 px of) a rune pad counts as stepping on it; Shadopus can't go Drowsy or fall asleep while hidden in Ink Cloud. Stand-ins follow actual rune calls or their own private view.
- **Eleven rewards:** Dreamwaker, Twilight colors, Starlit skin, Dreamdrift entrance, Lucid Legend, Moonglass frame, Lullaby aura, Sweet Dreams victory, Daydream Dash, Lone Dreamer and Dream Weaver. Sweet Dreams requires a solved sequence and no wrong runes/timeouts; Dream Weaver counts 60 correct rune entries across wins and losses. The shared feature counter stores rune entries for this boss; it does not stop at the older twenty-pillar limit.

Migration **015_somnara.sql** enables Somnara's stored records, titles and cosmetics. Its sequence stays out of public/spectator snapshots; Lucid's one-rune hint and Silent Swoop's team reveal are sent to the appropriate authenticated seats only.

## Replay variety

Each run rolls a visible trait with a benefit and a drawback:

- Restless attacks faster but exposes a more vulnerable core.
- Fractured adds falling debris but armor breaks last longer.
- Ancient has slower charges and wider shockwaves.

Live raids always run at Peril 3, tuned per boss by the star tiers ("Difficulty" above); the rest of this paragraph describes the legacy Peril steps that tests still use. Peril 1 teaches the encounter. Clearing it unlocks Peril 2: extra debris, longer eruption chains, volley-into-eruption combinations and 10% more boss damage. Peril 3 adds eruptions to chapter one, gradually closes a safe circle in the final chapter and deals 20% more damage. The boss health bar is the same at every Peril. A rare non-weekly run rolls Gilded: golden appearance, 12% more health and a bonus title. Guaranteed cosmetics never require a rare encounter.

Six raid-only rites offer dash wards, shared ultimate energy, extra exposed-core damage, faster revives, low-health damage and ultimate-triggered healing. All champions can contribute; no dedicated healer is required. Offers vary by party seat, remain deterministic for weekly runs, and exclude owned rites. The upgrade panel shows everyone’s current build. These upgrades disappear after the run and do not change PvP loadouts.

## Champion tricks

Some champions' skills answer Grumblecrag's attacks; the briefing lists the party's:

- **Auralynx · Facet Guard** blocks the rock volley completely and adds stagger.
- **Mystowl · Wing Cloak** up inside a shared meteor cuts the damage for everyone sharing it by 35%.
- **Terradon** stops a charge head-on with its shell, taking half damage and staggering the boss.
- **Lumoth · Kindle** cast beside a fallen ally fills half of their revive at once (and earns revive credit).
- **Coilemur · Magnet Lash** drags the first fallen ally it passes over (before it reaches the boss) to Coilemur's side.
- **Sunbara · Warm Spring** revives a fallen ally inside it twice as fast.
- **Astrabun · Mochi Pound** adds 15 stagger.
- **Wombolder · Burrow Rush and Landslide** add 25 stagger when the charge would drive Grumblecrag into a pillar (the engine's wall slam).

The other bosses' tricks are listed in their sections above and in [raid-roster-design.md §6](raid-roster-design.md#6-champion-tricks-across-the-roster); every champion has tricks on at least three bosses.

## Teamwork tools

- **Team signals:** *Stack on me*, *Revive me* and *Bait here*, from the buttons on the left of the arena or the **Z**, **X** and **C** keys (when those keys aren't bound to anything). A marker appears over your head for a few seconds and teammates see it in the callout line. One signal per second.
- **What downed you:** the downed banner names the attack that downed you and how to avoid it. A lost run's result screen gives the tip for the attack that downed the team most.
- **Stand-ins:** if a raider disconnects mid-run while at least one other player is still connected, an AI plays their champion (dodging telegraphs, stacking for meteors, reviving allies) until they reconnect, instead of pausing everyone. A solo raid still pauses. If they don't return in time, their seat is dropped as before.
- **Practice:** in the raid lobby, the host can open *Practice the boss's attacks*. The boss repeats one chosen attack; nobody is hurt and the boss can't be damaged, and a bar counts hits and dodges. The host can switch attacks or leave practice for the lobby. Practice is never saved.

## Rewards and records

Rewards are defined as rules (`RAID_REWARDS` in `packages/shared/src/raid.ts`, seeded identically into `arena_raid_rewards` by migration 009; a test keeps them in step). The database decides what you've earned from your saved runs. Grumblecrag's ladder:

| Goal | Reward |
|---|---|
| First clear | **Cragbreaker** title |
| 5 clears | **Cragbound** colors (skin) |
| 10 clears | **Cragstone** skin |
| Clear Peril 2 | **Mountainborn** entrance |
| Clear Peril 3 | **Mountain Conqueror** title + **Conqueror** frame |
| Peril 3, no downs | **Mountain aura** |
| Feat: every charge in a run hits a pillar (3 or more charges) | **Rockslide Flex** victory |
| Peril 2 solo in under 3:30 | **Avalanche** title |
| Peril 3 solo (no self-revive) | **Lone Mountain** title |
| Rare Gilded clear | **Gilded Cragbreaker** title |
| 25 pillars baited (wins and losses) | **Pillar Breaker** title |
| 20 revives helped (wins and losses) | **Mountain Guardian** title |
| 100 clears across every boss | **Boss Hunter** title |

Solo Peril 3 clears from before migration 009 (when a self-revive was still possible) count for Lone Mountain only if nobody went down.

Skin, aura, entrance, frame and **victory** are separate slots, equipped independently on a boss's Rewards tab in the Raid Hub, for all fighters. A Victory replaces your champion's own celebration when you win a round or a raid (Rockslide Flex: a pile of rocks rises under you and you flex on top while pebbles bounce away). Every reward is cosmetic: no stat bonuses, so experienced players never make the raid easier. The Bestiary lists every reward with its exact progress.

Results show actual boss damage, revive assists, and pillar baits per player, alongside team totals, plus a role for whoever led each: Heavy Hitter, Medic and Bait Master. Everyone who contributed to a completed rescue receives revive credit; solo self-revives appear only in the team total. Damage excludes overkill and phase-gated damage. Pillars credit the marked player whose charge broke them. Contribution counters reset on retry and are not a competitive leaderboard.

After the server confirms reward storage, the result screen fetches the player's saved progress and shows the next milestone. Failed storage never displays invented progress. Run again keeps the party, champions and challenge, skips the already-seen introduction, and opens fresh starting rites after everyone confirms. Changing champion or difficulty returns the party to the lobby.

The Raid Hub boss page shows boss information, clears, highest Peril, best active-combat time, reward goals and cosmetic equipment. It is available from the home screen, raid lobby, result screen and player profile. Only the server's verified equipped cosmetic is sent to opponents. Cosmetic choices affect appearance, not combat stats.

**Raid of the Day** is optional and replaces Raid of the Week. Each day has a featured boss: Sun Prismatail, Mon Gloomshade, Tue Emberwing, Wed Somnara, Thu Storm Twins, Fri Tidewyrm, Sat Grumblecrag. Until a boss is built, a built boss stands in on its day. The day changes at **midnight Pacific time** (daylight saving included); the server decides the day, so everyone agrees. All rooms that day share the same seed, trait and Peril 2 challenge, and solo, duo, trio and four-player clears have separate daily boards. The host ticks *Raid of the Day* in the lobby (or presses *Raid today's boss* in the Hub). If midnight passes while a party waits in the lobby, the run simply becomes a normal run. Raid wins never enter the PvP match ledger or Elo rating system.

## Required deployment setup

1. Run `supabase/migrations/007_raids.sql` in Supabase after migrations 001–006, then `supabase/migrations/008_raid_progress.sql`, then `supabase/migrations/009_raid_hub.sql`, then the Shop's `010_shop.sql` and `011_collection_bonus.sql`, then `012_tidewyrm.sql` (it switches Tidewyrm on and seeds its rewards), then `013_gloomshade.sql` (the same for Gloomshade), then `014_missions.sql` (daily missions), then `015_somnara.sql` (Somnara and its rewards). 010 also updates the appearance functions so Shop pieces can be equipped; if you ever re-run an older raid migration, run 009–015 again afterwards, in order.
2. Set **SUPABASE_SERVICE_ROLE_KEY** in the **server's** hosting environment alongside its existing SUPABASE_URL. Never use a VITE_ prefix or put this key in browser configuration. It enables the server-only `arena_record_raid` function.
3. Redeploy the server and client together, since snapshots now support the raid mode.

Core Peril 1 raids work without reward storage, but clears cannot be persisted or higher Perils unlocked until the migration and server credential are configured. The result screen explicitly reports storage failures. A server restart before saving an unavailable reward is not a durable queue; do the setup before inviting players to earn rewards.

Migration 008 also saves real attempts that were lost (20 seconds or more of combat; practice never), with the chapter reached, per-player stats and which attacks downed people. Losses never count as clears or reach the weekly board. To see it, run this in Supabase's SQL Editor:

```sql
-- How far runs get, by Peril and party size.
select peril, party_size, result, phase_reached, count(*), round(avg(seconds)) as avg_seconds
from arena_raid_runs group by 1, 2, 3, 4 order by 1, 2, 3, 4;
-- Which attacks down people most.
select key as attack, sum(value::int) as downs
from arena_raid_runs, jsonb_each_text(down_causes) group by 1 order by 2 desc;
```

(Signed-in admins can also call `arena_raid_balance()`, which returns the same summary.)

Tables have RLS and no direct player write access. Only the service role can submit clears. The database records each run once, grants titles, checks cosmetic ownership, and exposes authenticated progress reads. No new HTTP endpoint accepts client-submitted raid wins.

## Developer validation

`/raid-preview.html` is a local Vite playtest using the actual simulation, boss renderer, UI, floor and champion rig. It has phase/down test buttons and makes no account changes. Like other preview pages, it is not included in the production build or PWA precache.

Run `npm test`, `npm run typecheck`, `npm run build`, and `node scripts/verify-pwa.mjs`. Tests cover solo/four-player sessions, HP phase gates, friendly fire, pillar collision and exposure, stagger, revives and interruption, packet-spam crawling, raid rites, weekly seeds, Peril unlock enforcement, disconnect behavior, verified reward writes, ownership, idempotency and Elo isolation.

The first release deliberately has one boss with procedural artwork. Additional boss artwork, enemy families, optional AI partners and further Peril tiers are future expansions. This is not a claim of tested competitive balance or of finished animated cinematic artwork.
