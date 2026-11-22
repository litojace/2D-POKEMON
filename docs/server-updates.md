# Server updates without kicking players out

Matches live only in the game server's memory (one Render instance,
`render.yaml`). Before this change, every deploy ended the old process at
once (`io.close()` on `SIGTERM`), and every match in progress was lost.

## What happens on a deploy

1. Render builds the new version, starts it, and sends new connections to it
   once `/api/health` answers.
2. Render sends the old server `SIGTERM`. The old server **drains**
   (`apps/server/src/drain.ts`, `drain()` in `server.ts`):
   - it tells every connected player (`server-update` event). A player in a
     match reads "A server update is waiting. Your match continues; the
     update follows it." Everyone else reads "The server is updating. New
     matches open again in about a minute.";
   - matches already running carry on to the end;
   - it **refuses new matches** with that same message: create and join a
     room, Quick Match, bot match, practice, Ready in a room lobby, rematch
     and raid retry. Reconnecting to a match in progress (`resume`) still works;
   - once no match is live (briefing, countdown, playing, intermission or
     paused; practice does not count) and every database save has finished
     (match rewards, Spire floors, raid clears: every promise the storage
     provider returned), it closes and exits.
3. It never waits longer than `SHUTDOWN_DRAIN_MS` (285 seconds in
   `render.yaml`). Render's own limit is `maxShutdownDelaySeconds: 300`.
   After that Render ends the process with `SIGKILL`, so the drain stops
   first and leaves time to close. A second `SIGTERM`, or `SIGINT` (Ctrl+C),
   stops at once.
4. On the client, `server-update` also makes the browser look for the new
   version right away. After the match, the player gets the Update now /
   Later prompt in the Lobby or the Plaza ([mobile/PWA](mobile-pwa.md#caching-and-updates)).

The server logs `arena-drain` (live matches and saves when the drain starts)
and `arena-drain-done` (`finished`: true if everything ended in time).

## The start script must use `exec`

Render runs `npm run start` and sends `SIGTERM` to npm. With a plain
`node …` start script, npm quits on the signal at once and the server under
it never hears it: no `arena-drain` line, and every match dies when Render
removes the old instance. Until 22 Nov 2026 no deploy ever drained for this
reason (a raid on the old instance was cut off a minute after the new one
went live, with no `arena-drain` in the logs). `exec node …` makes the
server take the shell's place, so npm passes it the signal and waits for it
to exit. `tests/unit/start-signal.test.ts` runs the real start script
through npm and fails without it. (`exec` needs a Unix shell; `npm start` is
for production on Linux, `npm run dev` for local work.)

## Limits

- **Five minutes at most.** A round is 180 seconds plus overtime, so most
  matches end in time. A long multi-round match, a Spire climb or a raid
  can run past the deadline. Those players are disconnected, as before.
  Deploy at a quiet hour, or check `arena-drain-done` in the logs.
- **Room lobbies are lost.** A room still waiting in its lobby when the old
  server exits is gone. Its players reconnect to the new server and open a
  new room.
- **Open WebSockets after the switch.** This relies on Render keeping
  connections that are already open on the old instance until it exits.
  Render's documentation says the old instance keeps running until the
  shutdown delay ends. The tests do not cover it (they run one process), so
  check it once in production: start a bot match, deploy, and see that the
  match plays to the end.
- **`render.yaml` must be synced.** `maxShutdownDelaySeconds` and
  `SHUTDOWN_DRAIN_MS` take effect only if the service follows the Blueprint.
  If it was set up by hand, set the shutdown delay and the
  `SHUTDOWN_DRAIN_MS` environment variable in the Render dashboard instead. Without
  `SHUTDOWN_DRAIN_MS` the server drains for 0 seconds, the old behaviour.
- **Persistent disks** turn off Render's zero-downtime deploys. This service
  has none; keep it that way.

## Tests

- `tests/unit/server-drain.test.ts`: which rooms count as live, save
  tracking, the deadline.
- `tests/integration/server-drain.test.ts`: through real sockets, a match in
  progress keeps its room while new matches are refused and every player is
  told; the drain waits for a finished match's rewards to save; it gives up
  at the deadline.
- `tests/unit/pwa-auto-update.test.ts` and the update tests in
  `tests/visual/shop-stability.spec.ts`: the client's prompt.
