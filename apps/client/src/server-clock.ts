/**
 * The server's clock, as seen from this device. Every API answer carries
 * the server's time (`X-Server-Time`, apps/server/src/api-cors.ts); the hub's
 * countdowns (new daily picks and missions, the Daily Spark, weekly goals)
 * use serverNow() so a wrong device clock can't move them. Until the first
 * answer arrives it is the device clock. The farm keeps its own offset from
 * its `now` field, the same way.
 */
let offset = 0;
let known = false;

/**
 * Note the server's time from an answer. `sentAt`/`receivedAt` are this
 * device's clock around the request: the server stamped the answer
 * somewhere in between, so the midpoint is the best guess.
 */
export function noteServerTime(
  header: string | null,
  sentAt: number,
  receivedAt: number,
) {
  const server = Number(header);
  // Ignore anything that isn't a plausible time (missing header, 0, junk).
  if (!header || !Number.isFinite(server) || server < 1e12) return;
  offset = server - (sentAt + receivedAt) / 2;
  known = true;
}
/** Now, by the server's clock (ms since 1970). */
export const serverNow = () => Date.now() + offset;
/** Has any server answer told us its time yet? */
export const serverClockKnown = () => known;
/** For tests. */
export function resetServerClock() {
  offset = 0;
  known = false;
}
