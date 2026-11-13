# Multiplayer networking and battle performance

This pass targeted the two things players reported: delayed or jerky
multiplayer movement, and choppy rendering when several fighters and effects
are on screen. Everything below was measured before and after under the same
conditions; the scripts that produced the numbers are in `scripts/perf/` and
`tests/visual/battle-performance.spec.ts`, and can be re-run.

The game's rules are unchanged: the server still simulates at 30 ticks a
second, sends battle snapshots at 15 a second, and decides movement, damage,
cooldowns and outcomes. Clients still send one input per tick.

## What changed

### 1. One network input per server tick (biggest smoothness win)

The server used to apply "the latest input wins" between ticks. Because the
client's 30 Hz input clock and the server's 30 Hz tick are not phase-locked,
two inputs often arrived in one tick (one step of movement lost) and none in
the next (one step repeated). Each snapshot then disagreed with the client's
prediction by one step of running (about 9 px), so your own fighter twitched
even on a perfect connection.

Inputs now go through a small queue (`Arena.enqueue` / `Arena.drainInputs`,
`apps/server/src/simulation.ts`), applied one per tick, so each acknowledged
input stands for exactly one simulated step, exactly as the client predicts:

- A burst after a stall is applied at once (merged as before), so stale
  movement never piles up; at most 2 inputs (67 ms) are left waiting.
- A queue that stays two deep for a second is shortened by one, so no
  standing latency builds.
- A flood can never queue more than 8.
- Every skill press, dash, jump and Basic press still reaches `submit()`,
  which keeps all existing validation (cooldowns, knockouts, raid crawling,
  Tidewyrm prisons and so on). Bots are unaffected.
- If a client's inputs stop for 0.5 s (a silent mobile drop), its fighter
  stops walking instead of running on its last input until Socket.IO notices
  the disconnect (which can take tens of seconds).
- Queued inputs are dropped on disconnect, resume and between rounds, so a
  reconnect never replays a stale cast or stale movement.
- Activity ("participated") counts when an input arrives, even if the match
  ends before the next tick.
- A tick with nothing queued runs your last input again; that step is owed
  and the late inputs are folded in when they arrive, and the phone is told
  (`Fighter.owed`) so it predicts the same steps (section 12).

### 2. Adaptive, never-jumping remote playback

`apps/client/src/networking/interpolation.ts` now:

- measures how irregularly snapshots arrive (95th percentile lateness over
  the last ~4 s) and plays other fighters about one snapshot interval plus
  that lateness behind the server, bounded to **80–200 ms** (it was a fixed
  100 ms). Steady connections get a shorter delay; jittery ones get enough
  buffer not to freeze. The 200 ms ceiling protects aiming at opponents.
- moves its playhead at 0.8–1.6× real time towards where it should be,
  instead of jumping, so after a stall an opponent fast-forwards briefly
  rather than teleporting. A gap over 0.5 s resynchronises immediately
  (e.g. returning from the background), never rewinding.
- when the newest snapshot runs out, keeps an opponent moving along its own
  reported velocity for up to 50 ms / 14 px, then holds.

### 3. Smaller battle snapshots

Names, titles, title colours, mastery flair, equipped skins/collections and
boss clears made up about a third of every snapshot, 15 times a second, for
every fighter. They now travel as a versioned appearance block
(`packages/shared/src/snapshot-meta.ts`):

- The server sends the block only when an appearance changes (equip,
  unequip, profile refresh, join/leave), and whenever a socket joins, resumes
  or starts watching. Each snapshot carries the current `metaRev`.
- The client caches the block (`MetaCache`) and merges it back into each
  fighter, so the rest of the client is unchanged. If it ever sees a
  revision it does not have (a missed block), it asks once with
  `snapshot-meta` and is answered with the full current block.
- Change detection compares field identity each broadcast and re-verifies
  everything with a full comparison every 30 broadcasts, in case an object
  is ever edited in place.
- Values are always the server's own verified copies; nothing comes from
  clients. Equipment synchronization, frames and the Shop/Wardrobe previews
  are unaffected.
- Other fighters' `lastInput` is reduced to the aim point (the only part the
  client draws) and facing/aim/ultimate meter are rounded for display.
  Positions, velocities, dash vectors and all times stay exact: rounding a
  position by 0.005 px measurably flipped how prediction slid around pillar
  corners, so it was reverted.
- Old-format (full) snapshots are still understood, so the visual test
  harness and any older code path keep working.

### 4. Backpressure without losing events

If a player's WebSocket has more than 16 KB waiting for the network (or
Engine.IO has queued 4 messages behind an unfinished write), sending more
15 Hz snapshots only makes that player later. The server now skips that
socket, remembers the last event it received, and the first snapshot after
it drains carries every gameplay event it missed (from the room's 80-event
history) plus the appearance block. Other sockets in the room are
unaffected, nothing is volatile, and the event cursor logic is unchanged.
This needs the steady 15 Hz loop, so tests that step the server by hand
leave it off unless they ask for it (`createArenaServer({ backpressure })`).

### 5. Adaptive battle graphics

`apps/client/src/battle-quality.ts` extends Settings → Graphics to battles:

| Level  | Burst particles | Trail sparks | Mythical ambient motes | Stands' crowd | Canvas density |
| ------ | --------------- | ------------ | ---------------------- | ------------- | -------------- |
| High   | all             | normal       | 2 fighters (you first) | animated      | screen, ≤ 2×   |
| Medium | 60%             | 1.6× sparser | 1 (you)                | animated      | screen, ≤ 2×   |
| Low    | 35%             | 2.5× sparser | none                   | still         | ≤ 1.5×         |

Fighters, portraits, text, HUD, telegraphs, danger zones, projectiles,
status markers and every skill's shapes and colours are identical at every
level. Low reuses the particle density reduced motion already uses, so it is
an existing, reviewed look. Low also draws the battle at 1.5 canvas pixels
per CSS pixel at most, as iPhones do at every level (`rendererDensity`):
slightly softer, and it is what stops older Android phones lagging when
skills go off (owner's decision, 10 Nov 2026). A level change mid-battle
resizes the canvas on the next frame; the court keeps the density it was
baked at.

Why the density: in a duel against the AI bot, for each of the 18
champions, casting a skill every 0.7 s cost 19% of the frame rate on average
and 36–38% for the heaviest kits (Cindrake, Terradon). Drawing at 1.5×
instead of 2× gave 45% more frames while casting (516 against 355 frames
over the six heaviest kits, two runs each). One champion's effects cover at
most 0.3 screens of glow light, so the cost is drawing the whole court,
fighters and effects per pixel, and fewer pixels is what helps. These were
measured on this container's software renderer, which exaggerates fill
cost, so phones gain less, in the same direction.

(Corrected 10 Nov 2026. The first measurement swapped a new arena in for
each champion without carrying on its event numbering, so the client
skipped most casts after the first champion of each group: it reported 13%
and 50%, and a JavaScript cost that was not measured again.)

Low also holds decorative glow light to 0.75 screens a frame
(`glowBudget`): a duel never reaches it, and four fighters casting at once
(0.66 screens typically, about 1.4 at peak) lose about half their glow fill
at the busiest moments. Every decorative glow of the frame shrinks alike,
at once when a big effect starts and back over about 0.3 s, never below
half its size. Warnings never shrink: wind-ups and a boss's glows are drawn
inside `fx.essential`.

Auto watches frame times during live play only: it ignores a 3 s warm-up,
frame gaps over 250 ms (loading, stalls, background tabs) and every frame
while a menu or dialog is open or the round is not being played. It steps
down after two consecutive slow 4 s windows (median slower than ~45 fps, or
a tenth of the window's time spent in frames missing 30 fps) and steps up
after five comfortable ones (90% of frames at ~58 fps or better and at most
2% of the time stuttering). A level it had to leave is not tried again on
that device for a week. The level is remembered per device. Before it has
learned a device, Auto starts at Low when the device reports 2 GB of memory
or less, or Auto already found it slow in the Plaza (the Plaza's own rule,
`autoChoosesLow`), so an older phone's first battle does not lag while Auto
measures; at Medium on Android; at High otherwise. It steps up after a
comfortable stretch if the device copes. Manual High/Low always win;
choosing Auto again forgets what it learned and re-measures. Reduced motion
keeps its own stricter limits at every level.

Made more careful on 13 Nov 2026, from the match reports' one Android phone
(10 cores, 8 GB, a 120 Hz screen): at Low it ran at 61–107 fps and spent
1–18% of the time in frames missing 30 fps, and its player had set Low by
hand. Auto would not have helped: a fifth of the time was its threshold for
"slow", so it would have stayed at High, and a window counted as
comfortable on pace alone, however much it stuttered, so a 120 Hz phone
could step up into a level that stutters. Retrying a level it had left, once
or twice every session, meant a lagging battle each time. Android starts at
Medium because its graphics chips vary the most and Medium looks almost the
same as High; a phone that copes is at High within its first battle. The
frame cap (section 13) also makes frame times on a 120 Hz screen comparable
with everyone else's.

The "fifth of the time" was "a fifth of the frames" until 10 Nov 2026. A
phone that runs at 60 fps but drops to 25 fps for half a second after each
skill, one every 2 s, stutters a quarter of the time, yet those slow frames
are only an eighth of the frames, so Auto never stepped down for it.

### 6. Diagnostics (optional, off by default)

`ARENA_DIAGNOSTICS=60` on the server logs one JSON line a minute
(`arena-diagnostics {...}`): rooms, sockets, combat tick and broadcast
durations (p50/p95/p99/max), event-loop delay, CPU as a percentage of one
core (Render's 0.5 CPU plan is 50), RSS/heap, outgoing bytes and messages per
second, and congested-socket skips. When unset, every hook is a no-op.

## How to measure

```bash
# Prediction/interpolation quality under modelled latency, jitter and stalls
npx tsx scripts/perf/net-sim.ts 120
```

```bash
# Many concurrent rooms of real Socket.IO clients against a server child process
npx tsx scripts/perf/server-load.ts --rooms 24 --mix pvp2,pvp4,raid4 --seconds 20
```

```bash
# Memory soak: rooms are created, fight and are left, repeatedly
npx tsx scripts/perf/server-load.ts --rooms 8 --cycles 10 --seconds 12
```

```bash
# Browser scenarios (Chromium; SwiftShader WebGL in CI/containers)
npx playwright test --config tests/visual/playwright.config.ts battle-performance
```

To approximate Render's $7 instance (0.5 CPU, 512 MB) on Linux with cgroup
v1, create a group with a 50 ms per 100 ms CPU quota and a 512 MB memory
limit and pass its name as `CGROUP=<name>`; the load script moves only the
server child into it. Results depend on the host CPU: Render's cores may be
faster or slower than the machine used here.

### 7. Closed battles no longer stay in memory

The browser soak found that every battle you left stayed in memory with its
whole Phaser game and WebGL renderer: about 6 MB per battle, so a long
session kept growing. The cause was Phaser's `Graphics.generateTexture`,
which draws through one static camera shared by every game
(`Graphics.TargetCamera`). Each bake (the court floor, town artwork) pushed
its Graphics onto that camera's render list, which nothing empties, and the
camera kept the last scene, so every closed battle and town stayed
reachable. Bakes now go through `generateGraphicsTexture`
(`apps/client/src/graphics-bake.ts`), which empties the list and detaches
the scene afterwards. The soak test now fails if memory keeps growing.

### 8. Keeping new champions and features light

Three changes from this work also make every battle lighter now:

- **Effects age in real time down to 5 fps.** The effects engine capped
  each frame's step at 50 ms, so on a phone at 5–20 fps particles and
  marks outlived their design (twice as long at 10 fps) while new casts
  kept coming at the game's pace: more on screen, slower frames, longer
  lives again. The cap is now 200 ms, Phaser's own floor (`FX_MAX_STEP`).
  In a four-player fight most particles come from spammed basic attacks
  (about 375 a second asked for here), so at 10 fps this halves what is on
  screen; this container renders below 5 fps there, so it cannot show it.
- **Circles cost less to draw.** Battles draw hundreds of filled and
  outlined circles a frame; each one had Phaser compute every outline point
  with cos/sin and make new objects. `circlePoints` (battle-curves.ts)
  reuses one table and one point list per point count, giving exactly the
  same points: in a four-player profile, `CircumferencePoint` went from
  about 100–114 ms to 36–38 ms per 10 s and `fillEllipse` from 129–169 to
  45 ms (what remains is code that draws ellipses directly).
- **An older phone's first battle starts at Low** (see Auto in section 5).

Three checks run in CI with the visual suite, and two numbers come back
from players' phones:

- **Effect budget** (`tests/visual/effect-budget.spec.ts`): every champion
  casts its four skills and its ultimate at a still training dummy, with
  `Math.random` seeded, and its heaviest frame is judged by the effects
  engine's own counts (`FxFrameStats`): glow cover, smoke cover and live
  particles. The limits are about twice the heaviest kit seen (glow 0.30
  screens, smoke 0.52, particles 218), because which frame a run catches
  moves a peak by up to about 40%. `EFFECT_BUDGET_MEASURE=1` prints every
  champion's numbers.
- **A real match** (`tests/visual/match-flow-budget.spec.ts`, at High and at
  Low): dressed fighters from the first snapshot, the briefing, then the
  fight. No fighter art may load mid-fight (512 textures before and after),
  the game's own layout reads stay near zero a frame (measured: none;
  Phaser's own canvas size check, on a 500 ms timer, is counted apart), the
  page does not grow, nothing leaks (once the match is over and its effects
  have played out, the scene less its pooled effect sprites is back to its
  size; judged then because under 5 fps Phaser slows game time and effects
  pile up while the fight lasts), and at Low the glow budget holds
  decorative light to 0.75 screens (measured 0.74 at the 90th percentile,
  against about 1 at High).
- **Effect rules** (`tests/unit/effect-rules.test.ts`): skill effect files
  never add their own scene objects; they draw through the effects engine,
  so the graphics levels and the counts above see everything.
- **From players' phones:** at the end of each match the client sends
  `battle-perf` and the server logs `arena-perf`: seconds of play, frames,
  median fps, 95th percentile frame time, share of time in frames that
  missed 30 fps, frames over 250 ms (stalls), graphics level and setting,
  canvas density, device memory and cores, plus the mode, players, bots,
  raid boss and champion. No account or name. Slow frames are kept (only
  gaps over 2 s are left out), so the slowest phones report too.
- **`?perf=1`** shows the same numbers over the battle (last second's fps,
  slowest frames, stutter, level and density, glow, smoke and particles),
  for a player to screenshot.

### 9. Shots and wind-ups on your own timeline

Players on phones reported (10 Nov 2026) that skills stuttered when cast,
and that stepping out of a skill still got them hit. The `arena-perf` lines
from those PvP matches showed the phones drawing at a steady 58.8 fps with
almost no slow frames (`jank` 0–0.002), so the cause was not the GPU.

Two things were drawn on the wrong clock:

- **Shots sat where the last snapshot had them.** Snapshots come 15 times
  a second, so a 900 px/s shot jumped about 60 px every fourth frame at
  60 fps: the stutter when a skill goes off.
- **Your own fighter is predicted, shots were not.** You are drawn where
  the server will have you once it has run every input it has not
  answered yet (`pending` in main.ts: about one round trip plus its input
  queue). Shots, wind-up rings and zone timers were drawn from the last
  snapshot, a round trip plus the snapshot's age in the past. On good Wi-Fi
  (60 ms round trip) that is about 0.13 s: a spark dart (860 px/s) was
  drawn about 110 px short of where the server had it relative to you,
  more than four fighter radii. You saw yourself clear it; the server,
  where the shot was further along, hit you.

`apps/client/src/networking/timeline-lead.ts` now puts them on your
timeline. `LocalTimeline` is how far past the last snapshot your fighter is
drawn: the unanswered inputs (one tick each) plus the time since the
snapshot arrived, running smoothly between snapshots and easing over 0.1 s
when a snapshot changes it, capped at 0.3 s (beyond that it is a stall,
not latency). Each shot is drawn that far along its straight path, stopped
by cover and the court's edge the way the server stops it
(`projectileContact`, now in `packages/shared`), never past its range, and
slowed inside an opposing time bubble. Boomerangs, which turn back, stay
where the snapshot had them. Your own shots go on the timeline at once
(your cast already played on the press); an opponent's eases in over
0.2 s so it leaves its caster's hand instead of appearing ahead of it.
Wind-up rings and zone timers count down on the same clock, so a wind-up
shows the time you really have to get out.

Hits, damage and every rule stay the server's. The trade-off: a shot you
fire at an opponent, who is drawn about 0.1 s in the past (section 2), now
looks a little further along than that opponent when it lands.

`tests/unit/timeline-lead.test.ts` checks a real shot from the server's
`Arena` against the drawn position tick by tick;
`tests/visual/shot-timeline.spec.ts` checks in the browser that shots run
on smoothly from their snapshot and within the cap. `arena-perf` now also
carries `ping` (the badge's smoothed round trip, ms) and `lead` (the
average lead over the match, ms), so the lag players feel can be read from
the log.

### 10. Match reports on GitHub

The `arena-perf` and `arena-disconnect` lines from Render's log are copied
to the `perf-reports` branch every three hours
(`.github/workflows/perf-reports.yml`, or Actions → Match reports → Run
workflow for an update now): `README.md` lists the latest matches (ping,
lead, frame rate, stutter, graphics level, device) and sums up each day,
and `reports/<day>.jsonl` keeps every report. Render keeps logs for a few
days only, so the branch is the long-term record. It needs a
`RENDER_API_KEY` repository secret. The repository is public, so only the
fields listed in `KEEP` (`scripts/perf/export-perf-reports.mjs`) are
written: never an account, a name or a room code
(`tests/unit/perf-reports.test.ts`).

The README opens with **Needs attention**: each recent match with
something a player would notice (slow connection, late updates, slow
drawing, freezes, unexplained jumps, hits that landed while you were drawn
elsewhere, script errors, slow skill confirms, a phone on an old build),
each with where to start; it ends with a table from symptom to tool. To
make that possible each report also carries, from the device: corrections
a minute by cause (`correction-cause.ts`: hit, status, own move, other),
`hitsFar` and `hitGapMax` (hits on you that landed over 24 px from where
you were drawn), `errors`, `build` (the commit, stamped at build time from
`RENDER_GIT_COMMIT`) and `os`/`app` (system family, installed or not);
and from the server: `opponents` (champions only), `botLevel`, and
`match`, a random tag new at each match start so both players' rows read
together.

### 11. Why your own fighter jumps

The first matches with the network fields (an iPhone on school Wi-Fi
against the bot, 11 Nov 2026) showed a steady 65–73 ms ping, on-time
snapshots (0–0.2% late) and 58.8 fps, yet 56–205 corrections over 4 px a
minute, the largest 130–380 px. `scripts/perf/correction-sim.ts` replays
such a duel (the real Arena, input queue and bot brain, the wire packing
and the client's reconciliation, 33 ms each way) and names the cause of
every correction from the server's own state:

- Walking alone: none.
- In a fight: 30–50 a minute, every one a knockback or a status that just
  landed (stun, slow, root...). The phone cannot know a hit is coming, so
  the server's push shows up a lead later. Knockbacks go up to 600 px
  (Magnet Lash), so a 380 px correction is a hit, not a fault.
- Standing in Tidefin's Undertow added about 70 a minute of ~7 px: a
  twitch 15 times a second. The server refreshes the `current` status to
  `CURRENT_HOLD` (0.15 s) every tick you are in the lane, but inputs are
  replayed about 0.2 s past the snapshot, so the last of them lost the
  drift and every snapshot pulled you back. `carryCurrent`
  (predict-fighter.ts) keeps a freshly refreshed current through the
  replay; what is left is entering and leaving the lane (about 70 → 8 a
  minute). One reported match (205 a minute, none over 33 px) looks like
  this case.

`tests/unit/correction-sim.test.ts` holds all three: no corrections from
walking, none unexplained in a fight, and the Undertow twitch gone (it
fails without `carryCurrent`). The match reports on the `perf-reports`
branch (section 10) now also show the round trip p50/p95, late snapshots,
corrections a minute (and the largest) and the wait from a skill press to
its confirmation.

### 12. Late inputs: the "unexplained" jumps in Hard-bot fights

On 11–13 Nov 2026 the reports' Android phone (10 cores, 8 GB, Wi-Fi,
always against the Hard bot) showed 8–37 "unexplained" corrections a
minute on build 7c17f1d and 28–74 on ea78f6e, up to 120–400 px apart from
where hits landed. Nothing in the bot, prediction or movement code changed
between those builds. Across all 30 reports, the unexplained rate followed
the **lead** (correlation 0.78; lead 213–224 ms on the first build,
234–254 ms on the second, round trips about 12 ms longer) and not the
frame rate (0.22). The lead counts your unanswered inputs, so it grows when
inputs wait on the way or in the server's queue.

`scripts/perf/correction-sim.ts` reproduces it when the phone's uplink
holds packets now and then (Wi-Fi power saving does this on phones:
`STALL_CHANCE`, `STALL_MS`). With 3% of inputs held for 120 ms while just
walking: 63–73 corrections a minute, all "other", 8–28 px, and the lead up
from 133 ms (no holds) to 177–188 ms. Raising the bot to Hard (`BOT_LEVEL=hard`) or the
frame rate to 120 (`FPS=120`) adds hits and statuses, not unexplained
corrections, and steady jitter alone (in order, as over TCP) adds almost
none.

The cause: on a tick with none of your inputs queued, the server runs your
last input again (it is late, not lost), so it takes a step the phone had
not predicted, while `ack` stands still. Every snapshot during the hold put
the phone one step further ahead, and catching up (a burst, or the
once-a-second trim of a standing queue) pulled it back, or lost a step for
good. Both read as "other".

The fix keeps one step per input, on both sides:

- The server counts each repeated tick as owed and, when the late inputs
  arrive, folds that many into one tick (merged, as a burst always was).
  After `staleTicks` with nothing (a pause or a hidden tab, not a hiccup)
  it forgets the debt, and so it does when a burst is used up and part of
  the debt is still unpaid two ticks later: then the phone itself froze,
  its input clock (which catches up at most 100 ms) skipped those ticks,
  and no inputs are coming for them. Kept, that debt would have had the
  phone predict every later input a step short. The fighter carries the count (`Fighter.owed`, only
  while it is above 0).
- The phone replays its pending inputs as the server will step them
  (`serverSteps` and `newestStep`, predict-fighter.ts): the owed inputs take
  no step of their own and go in with the next one.

Same simulator, same holds: walking 63–73 → 8–10 corrections a minute
(what is left: a direction change during a hold), a Hard fight's
unexplained 48 → 15 a minute, and the lead 185 → 139 ms (133 without holds).
A phone on an older build (no `owed`) against the new server does slightly
worse than before (about 80 a minute walking) until it updates.
`tests/unit/correction-sim.test.ts` and `tests/unit/input-queue.test.ts`
hold this; both fail without it.

The same reports showed "hit while drawn far away" (`hitsFar`, up to
400 px). Some may come from the same holds (you were drawn steps from
where the server had you), but that is not measured; the largest are
knockbacks, which no prediction can show in advance (section 11). The
next reports will tell.

### 13. 60 frames a second on fast screens

Phones with 90–144 Hz screens call the game's animation loops that often.
The game looks no smoother past 60 (the server moves everything 30 times a
second), but a 120 Hz phone draws twice the pixels a second, and its
graphics chip heats up and slows down. The reports' Android phone ran
battles at 61–107 fps with frameP95 19–33 ms: fast frames mixed with slow
ones.

`frame-cap.ts` holds the battle (wrapping Phaser's step from `postBoot`),
the Plaza, the Farm and the Bistro to about 60 fps on screens of 100 Hz or
more, on every system (iPhones with ProMotion too, where the browser runs
pages at 120). It learns the refresh from the frames themselves and draws
once about 1/60 s has passed since the last frame drawn: every other
refresh at 120 Hz, never two skipped in a row, and a late frame at once.
Skipped frames' time goes to the next frame drawn, so the game's clocks
(inputs, animation) keep real time. A 90 Hz screen is left alone: a cap
there means 45 fps or an uneven 60. Low in the Plaza, Farm and Bistro keeps
its 30 fps. Reports now carry the screen's refresh rate (`hz`), shown
under Device, so a capped 120 Hz phone can be told from a 60 Hz one.

## Results

All measurements were taken on one Linux container (Intel Xeon 2.8 GHz). The
server child ran in a cgroup capped at 0.5 CPU and 512 MB to approximate
the $7 Render instance, while the simulated players ran outside it.
"Before" is the untouched `main` commit with the same, sampled diagnostics
added, so the two differ only in the changes above.

### Movement feel (net-sim, 120 s per link, seeded)

Local correction = how far your own fighter jumps when a snapshot reconciles
it. "Starved" = frames where a moving opponent is drawn standing still.
"Behind" = how far behind the server's present the opponent is drawn
(including the one-way latency).

| Link (one-way latency, jitter)         | Corrections > 4 px | Worst correction | Opponent starved | Opponent behind (p50) |
| -------------------------------------- | ------------------ | ---------------- | ---------------- | --------------------- |
| Good Wi-Fi (15 ms, ±4)                 | 32.4% → **0%**     | 28 → **0** px    | 0% → 0.2%        | 100 → **77** ms       |
| Mobile 4G (45 ms, ±30, spikes)         | 23.2% → **6.8%**   | 36 → 18 px       | 1.7% → **0.2%**  | 133 → 127 ms          |
| Congested (90 ms, ±70, spikes)         | 42.9% → **17.7%**  | 54 → 36 px       | 13.1% → **1.5%** | 183 → 267 ms          |
| Wi-Fi stalls (350 ms freeze every 4 s) | 23.1% → **7.2%**   | 209 → 175 px     | 6.6% → **3.5%**  | 117 → 201 ms          |

On bad links the adaptive buffer trades about 80 ms more opponent delay for
nearly freeze-free movement; the 200 ms ceiling bounds that trade.

### Server (real Socket.IO clients; rooms mix 1v1, 4-player FFA, 4-hero raid)

Two runs each, 20 s after a 5 s warm-up, every fighter fully dressed.

| Rooms (players)                    | CPU, % of one core | Combat ticks (of 600) | Snapshot p50     | Per player, downstream   | Server egress        |
| ---------------------------------- | ------------------ | --------------------- | ---------------- | ------------------------ | -------------------- |
| 24 (80)                            | 23–24 → 26         | 601 → 592–599         | 9.1 → **5.2 KB** | 129 → **75 KB/s**        | 10.3 → **6.0 MB/s**  |
| 48 (160)                           | 41–42 → 41–43      | 555–579 → 556–573     | 9.2 → **5.3 KB** | 120–124 → **70–72 KB/s** | 19.5 → **11.4 MB/s** |
| 72 (240), single instrumented runs | 50 (capped) both   | 444 → 426             | 9.1 → 5.1 KB     | 94 → 52 KB/s             | 22 → 13 MB/s         |

- Bandwidth fell by about 42%. CPU did not change within run-to-run
  noise: a profile shows the server's time going to fixed per-message
  Socket.IO work (30 inputs in and 15 snapshots out per player per second)
  and the simulation, not to payload size.
- At 24 rooms (80 players) ticks stayed on time (p95 9–10 ms against a
  33 ms budget).
- At 48 rooms (160 players) the 0.5 CPU quota was reached: CFS throttling
  dropped 4–7% of ticks, snapshots slowed to 14/s and the tick p99 reached
  60–70 ms.
- At 72 rooms the simulation fell to about 74% of real time. That is not
  playable.
- Memory is not the constraint: RSS stayed at 145–175 MB. Over ten soak
  cycles of creating, fighting in and leaving 8 rooms, the heap after GC
  went from 25.4 to 26.4 MB, and rooms and sessions returned to zero after
  every cycle.

### Browser client (Chromium, phone viewport 844×390 at 2×)

Measurements here are for main-thread JavaScript only. The container renders
WebGL in software (SwiftShader, 3–5 fps), so these are not phone frame
rates.

| Scenario                          | Snapshot size p50 | Snapshot handling p50 | Scene update p50 |
| --------------------------------- | ----------------- | --------------------- | ---------------- |
| 1v1                               | 3.5 → **1.8 KB**  | 0.9 → 1.0 ms          | 2.2 → 2.8 ms     |
| 4-player FFA, simultaneous skills | 6.9 → **3.4 KB**  | 1.2 → 1.3 ms          | 5.8 → 5.6 ms     |
| 4-hero Emberwing raid             | 9.5 → **5.8 KB**  | 3.2 → 3.5 ms          | 4.7 → 5.0 ms     |

Handling and update times are unchanged within noise. Memory across six
battle → Town → Shop → Wardrobe cycles (heap after GC):

| Cycle  | 0    | 1    | 2    | 3    | 4    | 5       |
| ------ | ---- | ---- | ---- | ---- | ---- | ------- |
| Before | 29.5 | 37.3 | 43.6 | 50.3 | 56.0 | 61.0 MB |
| After  | 31.0 | 31.9 | 30.7 | 31.6 | 31.7 | 31.1 MB |

## Capacity: the $7 instance versus a larger one

This recommendation is measured on this host only. Render's CPUs may be
faster or slower, Town visitors were not part of the load, and the
simulated players fight non-stop, which is harsher than real matches with
menus and intermissions.

- **0.5 CPU / 512 MB is enough for roughly 80–100 people in battles at
  once** with comfortable headroom. It starts to degrade around 150 and
  fails around 240. Memory is far from its limit.
- Start on the $7 instance with `ARENA_DIAGNOSTICS=60`. Move to a larger
  (1+ CPU) instance when, at peak, `cpuPercent` stays above about 35, the
  tick p99 exceeds about 33 ms, or the event-loop delay p99 exceeds about
  20 ms. A full core roughly doubles headroom. More memory alone would not
  help.
- Bandwidth is now about 75 KB/s per player in battle (about 270 MB per
  player-hour, down from about 465). Check this against the plan's included
  outbound transfer.

## Remaining bottlenecks and limits

- Server CPU per player is dominated by Socket.IO message overhead. Further
  gains would need fewer messages (for example batching two inputs per
  packet). That trades latency and prediction timing, so it was not done
  here.
- Raid clients redraw arena scenery into Graphics objects every frame.
  Caching the static parts would mean splitting the per-boss art functions.
  That should be profiled on a real phone GPU first; it was not changed here.
- Corrections on poor links come from inputs arriving bunched or late,
  which no client can predict. The input queue keeps them to one step per
  event instead of one per snapshot.
- Not tested on physical devices: iPhone/Android frame rates and thermal
  behaviour, the Auto quality governor on real GPUs, iOS Safari and the
  installed PWA's background/resume over a real mobile network. Lifecycle
  logic is covered by unit tests (governor pauses, interpolation resync,
  server stale-input stop) and the existing Chromium touch-recovery and
  iOS-app checks.
