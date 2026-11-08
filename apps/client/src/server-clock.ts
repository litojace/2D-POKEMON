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

/**
 * A server's clock from the times in its answers (the Bistro's and the
 * Farm's `now`, stamped while the request runs). Each answer bounds the
 * offset (server minus this device): at least `now - got` (the stamp came
 * before the answer arrived), at most `now - sent` (and after it was sent).
 * The clock goes by the tightest lower bound so far, so it doesn't jump with
 * each answer's delay (a slow answer would set it back, and every timer on
 * screen with it), and never runs ahead of the server. An answer that
 * doesn't fit the others (this device's clock was changed, or drifted)
 * starts it again.
 */
export class ClockBounds {
  private b: { lo: number; hi: number } | null = null;
  /** The offset after an answer stamped `server`, got at `got` and sent at `sent` (if known). */
  note(server: number, got: number, sent?: number): number {
    const lo = server - got,
      hi = sent === undefined ? Infinity : Math.max(lo, server - sent);
    const c = this.b;
    const lo2 = c ? Math.max(c.lo, lo) : lo,
      hi2 = c ? Math.min(c.hi, hi) : hi;
    this.b = lo2 <= hi2 ? { lo: lo2, hi: hi2 } : { lo, hi };
    return this.b.lo;
  }
}
