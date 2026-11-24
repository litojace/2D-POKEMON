import type { AccountProvider } from "./accounts.js";

interface Seen {
  at: string;
  token: string;
  attempted: number;
  pending?: Promise<void>;
  again: boolean;
}
/** Saved sightings supplement live sockets; never infer online from a timestamp. */
export class PresenceHistory {
  private entries = new Map<string, Seen>();
  constructor(
    private accounts: Pick<AccountProvider, "rpc">,
    private now = Date.now,
  ) {}
  lastOnline(id: string) {
    return this.entries.get(id)?.at;
  }
  touch(id: string, token: string, force = false): Promise<void> {
    const now = this.now();
    const entry = this.entries.get(id) ?? {
      at: "",
      token,
      attempted: -Infinity,
      again: false,
    };
    entry.at = new Date(now).toISOString();
    entry.token = token;
    this.entries.delete(id);
    this.entries.set(id, entry);
    if (entry.pending) {
      if (force) entry.again = true;
      return entry.pending;
    }
    if (!force && now - entry.attempted < 60000) {
      entry.token = "";
      this.prune();
      return Promise.resolve();
    }
    entry.pending = Promise.resolve()
      .then(async () => {
        do {
          entry.again = false;
          entry.attempted = this.now();
          try {
            // No account id or client clock is accepted by the database function.
            await this.accounts.rpc(entry.token, "arena_touch_presence", {});
          } catch {
            // A network failure or unapplied migration must not interrupt play.
            // The bounded local sighting still helps friends on this server.
          }
        } while (entry.again);
      })
      .finally(() => {
        entry.pending = undefined;
        if (entry.again) void this.touch(id, entry.token, true);
        else entry.token = "";
        this.prune();
      });
    this.prune();
    return entry.pending;
  }
  /** Await final disconnect writes when the server shuts down cleanly. */
  async flush() {
    while ([...this.entries.values()].some((e) => e.pending))
      await Promise.all([...this.entries.values()].map((e) => e.pending));
  }
  private prune() {
    if (this.entries.size <= 5000) return;
    for (const [id, entry] of this.entries) {
      if (!entry.pending) this.entries.delete(id);
      if (this.entries.size <= 5000) break;
    }
  }
}
