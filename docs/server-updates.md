# Server updates without kicking players out

Matches live only in the game server's memory (one Render instance,
`render.yaml`). Before this change, every deploy ended the old process at
once (`io.close()` on `SIGTERM`), and every match in progress was lost.

## What happens on a deploy

Measured in production on 22 Nov 2026 (Render logs, six deploys):

1. Render builds the new version, starts it, and sends **new** connections
   to it once `/api/health` answers ("Your service is live"). Connections
   already open stay on the old server: a raid started there before the
   switch played on to its end 80 s after it, with no disconnect.
2. **The old server notices on its own** within about 15 s. It asks its
   public address (`RENDER_EXTERNAL_URL` + `/api/health`) every 15 s, and
   that answers from the new server, whose `server` id (one per process,
   `/api/health`) differs from its own. It is then **superseded**
   (`arena-superseded` in the log):
   - it tells every player (`server-update` `{ reconnect: true }`). Out of a
     room, or in a room's lobby, the game moves at once (it reconnects, and
     the new connection lands on the new server). In a match, a watched
     room or a result screen, it stays until the player is out of it, then
     moves; the player reads "A new version is ready. Finish your match,
     then you'll move to it.";
   - it **refuses new matches** ("A new version of the game is ready. Moving
     you to it…") and tells that player again to move: create and join a
     room, Quick Match, bot match, practice, Ready in a room lobby, rematch
     and raid retry. Reconnecting to a match in progress (`resume`) still
     works.
   Before this, the old server took new matches for those two minutes: a
   raid started on it 75 s after the switch was cut off at the deadline.
3. **Two minutes after the switch** (every deploy that day: live at 10:44:55,
   `SIGTERM` at 10:46:55), Render sends the old server `SIGTERM`. It
   **drains** (`apps/server/src/drain.ts`, `drain()` in `server.ts`):
   - it tells every player how long a match still has (`server-update`
     `{ reconnect, draining, left }`, `left` in ms). A player in a match
     reads "Update: the server restarts in about 5 min. Finish your match,
     then update.", and "The server restarts in under a minute: finish your
     match." a minute before the end;
   - matches already running carry on to the end; new ones are refused
     (`DRAIN_MESSAGE`);
   - once no match is live (briefing, countdown, playing, intermission or
     paused; practice does not count) and every database save has finished
     (match rewards, Spire floors, raid clears: every promise the storage
     provider returned), it closes and exits.
4. It never waits longer than `SHUTDOWN_DRAIN_MS` (285 seconds in
   `render.yaml`). Render's own limit is `maxShutdownDelaySeconds: 300`.
   After that Render ends the process with `SIGKILL`, so the drain stops
   first and leaves time to close. A player still in a match then reads "The
   server restarted for the update before your match ended. Moving you to
   the new version…" (`{ closing: true }`), not a bare connection error, and
   the game reconnects to the new server. A second `SIGTERM`, or `SIGINT`
   (Ctrl+C), stops at once.
5. On the client, `server-update` also makes the browser look for the new
   version right away. After the match, the player gets the Update now /
   Later prompt in the Lobby or the Plaza ([mobile/PWA](mobile-pwa.md#caching-and-updates)).

A match that started on the old server before the switch so has about
6¾ minutes (2 until `SIGTERM`, then 4¾) to finish; every new one starts on
the new server.

The server logs `arena-superseded` (which server took over, live matches),
`arena-drain` (live matches and saves when the drain starts) and
`arena-drain-done` (`finished`: true if everything ended in time).

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

- **About 6¾ minutes for a match in progress at the switch.** A round is
  180 seconds plus overtime, and the raids played on 22 Nov took 65–170 s,
  so most end in time. A long multi-round match, a Spire climb or a slow
  raid can run past it; those players are cut off with the message above.
  Deploy at a quiet hour, or check `arena-drain-done` in the logs.
- **Room lobbies move.** A room waiting in its lobby can't start on the old
  server; its players move to the new one and open or join the room again
  ("The game moved to its new version: open or join the room again.").
- **Noticing the switch needs the public address.** Without
  `RENDER_EXTERNAL_URL` (local, tests), or if the old server can't reach it,
  nothing is noticed early, and players move only once `SIGTERM` comes (as
  before). Whether Render answers the old server's request from the new
  server is to be confirmed in production: look for `arena-superseded`
  within about 15 s of "Your service is live".
- **`render.yaml` must be synced.** `maxShutdownDelaySeconds` and
  `SHUTDOWN_DRAIN_MS` take effect only if the service follows the Blueprint.
  If it was set up by hand, set the shutdown delay and the
  `SHUTDOWN_DRAIN_MS` environment variable in the Render dashboard instead. Without
  `SHUTDOWN_DRAIN_MS` the server drains for 0 seconds, the old behaviour.
- **Persistent disks** turn off Render's zero-downtime deploys. This service
  has none; keep it that way.

## Tests

- `tests/unit/server-drain.test.ts`: which rooms count as live, save
  tracking, the deadline, reading a newer server from `/api/health`.
- `tests/integration/server-drain.test.ts`: through real sockets, a match in
  progress keeps its room while new matches are refused and every player is
  told how long it has; the drain waits for a finished match's rewards to
  save; it gives up at the deadline and tells the players still in a match;
  a server whose public address answers with another id moves its players
  and refuses new matches (its own id, no id or no answer moves nothing).
- `tests/visual/server-update.spec.ts`: out of a room the game moves at
  once; in a raid it stays, and leaving moves it; the countdown and the
  cut-off toasts read in full on phones and desktop.
- `tests/unit/pwa-auto-update.test.ts` and the update tests in
  `tests/visual/shop-stability.spec.ts`: the client's prompt.
