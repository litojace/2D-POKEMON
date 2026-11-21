/**
 * Graceful shutdown for deploys (docs/server-updates.md). Render starts the
 * new server, moves new connections to it, then sends the old one SIGTERM.
 * Matches live only in this process's memory, so the old server keeps the
 * matches already running until they end, refuses new ones, and waits for
 * the rewards they earned to reach the database before it exits.
 */

/** What players read when a new match is refused during an update. */
export const DRAIN_MESSAGE =
  "The server is updating. New matches open again in about a minute.";

/** A room whose players would lose a live match if the process ended. */
export function busyRoom(room: { phase: string; practice?: unknown }) {
  // Practice runs with no end; lobbies and results lose nothing that matters.
  return !room.practice && room.phase !== "lobby" && room.phase !== "finished";
}

/**
 * The same storage provider, keeping every promise it hands back in
 * `inflight` until it settles: match rewards, Spire floors and raid clears
 * are saved after the match ends, and must not die with the process.
 */
export function trackWrites<T extends object>(
  provider: T,
  inflight: Set<Promise<unknown>>,
): T {
  return new Proxy(provider, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const result = value.apply(target, args);
        if (result && typeof (result as Promise<unknown>).then === "function") {
          const promise = Promise.resolve(result as Promise<unknown>);
          const settled: Promise<unknown> = promise.then(
            () => inflight.delete(settled),
            () => inflight.delete(settled),
          );
          inflight.add(settled);
        }
        return result;
      };
    },
  });
}

/**
 * Resolves once nothing is busy and nothing is saving, or at the deadline,
 * whichever comes first. Says which, and what was still running.
 */
export async function waitForDrain(options: {
  busy: () => number;
  inflight: Set<Promise<unknown>>;
  deadline: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  every?: number;
}) {
  const now = options.now ?? Date.now;
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const every = options.every ?? 1000;
  for (;;) {
    const busy = options.busy(),
      saving = options.inflight.size;
    if (!busy && !saving) return { finished: true, busy, saving };
    const left = options.deadline - now();
    if (left <= 0) return { finished: false, busy, saving };
    await sleep(Math.min(every, left));
  }
}
