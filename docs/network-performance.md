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
a fifth of the window's time spent in frames missing 30 fps), steps up after
five comfortable ones, and does not retry a level it had to leave twice. The
level is remembered per device. Manual High/Low always win; choosing Auto
again re-measures. Reduced motion keeps its own stricter limits at every
level.

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
  page and the scene stop growing, and at Low the glow budget holds
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
