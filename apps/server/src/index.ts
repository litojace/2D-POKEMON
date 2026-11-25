import "dotenv/config";
import { createArenaServer } from "./server.js";
const server = createArenaServer();
const port = Number(process.env.PORT ?? 3001);
server.http.listen(port, "0.0.0.0", () =>
  console.log(`Element Arena listening on http://localhost:${port}`),
);
// A promise nobody awaited that rejected (a save, a push, a lookup) is one
// failed job, not a broken server: log it and keep the matches running.
// Node's default ends the process. Exceptions thrown outside a promise
// still end it: the rooms' tick and the socket handlers catch their own
// (server.ts).
process.on("unhandledRejection", (reason) =>
  console.log(
    "arena-unhandled-rejection",
    JSON.stringify({
      error: (reason instanceof Error
        ? (reason.stack ?? reason.message)
        : String(reason)
      ).slice(0, 1200),
    }),
  ),
);
/**
 * How long a deploy lets running matches finish (docs/server-updates.md).
 * Keep it under Render's maxShutdownDelaySeconds (render.yaml), which ends
 * the process outright when it runs out.
 */
const drainMs = Number(process.env.SHUTDOWN_DRAIN_MS ?? 0);
let stopping: Promise<void> | undefined;
const stop = () => (stopping ??= server.close().then(() => process.exit(0)));
// A deploy (Render sends SIGTERM): finish the matches in progress first.
process.on("SIGTERM", () => {
  if (server.draining) return void stop();
  void server.drain(Date.now() + drainMs).then(stop, stop);
});
// Ctrl+C, or a second signal: stop now.
process.on("SIGINT", () => void stop());
