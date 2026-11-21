import "dotenv/config";
import { createArenaServer } from "./server.js";
const server = createArenaServer();
const port = Number(process.env.PORT ?? 3001);
server.http.listen(port, "0.0.0.0", () =>
  console.log(`Element Arena listening on http://localhost:${port}`),
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
