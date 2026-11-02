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

| Level  | Burst particles | Trail sparks | Mythical ambient motes | Stands' crowd |
| ------ | --------------- | ------------ | ---------------------- | ------------- |
| High   | all             | normal       | 2 fighters (you first) | animated      |
| Medium | 60%             | 1.6× sparser | 1 (you)                | animated      |
| Low    | 35%             | 2.5× sparser | none                   | still         |

Only decoration changes. Fighters, portraits, text, HUD, telegraphs, danger
zones, projectiles, status markers and every skill's shapes and colours are
identical at every level and at full resolution. Low reuses the particle
density reduced motion already uses, so it is an existing, reviewed look.

Auto watches frame times during live play only: it ignores a 3 s warm-up,
frame gaps over 250 ms (loading, stalls, background tabs) and every frame
while a menu or dialog is open or the round is not being played. It steps
down after two consecutive slow 4 s windows (median slower than ~45 fps, or
20% of frames missing 30 fps), steps up after five comfortable ones, and does
not retry a level it had to leave twice. The level is remembered per device.
Manual High/Low always win; choosing Auto again re-measures. Reduced motion
keeps its own stricter limits at every level.

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

RESULTS_PLACEHOLDER
