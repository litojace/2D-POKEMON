/**
 * Quick Match (docs/pvp-plan.md, item 1): a 1v1 queue for players with no
 * friend online. Two players waiting at once are paired straight away;
 * a lone player never waits without end, because the client offers a
 * clearly labelled bot after QUICK_MATCH_FALLBACK_MS (packages/shared).
 *
 * Pure and synchronous, so tests drive it without sockets or timers: the
 * server owns the sockets and rooms, this owns who waits and who meets.
 */
export interface QueueEntry {
  socketId: string;
  accountId: string;
  /** Wall-clock ms when the player joined (for the wait in the log). */
  since: number;
}

export type QueueLeave = "cancel" | "bot" | "disconnect" | "replaced";

export class QuickQueue<E extends QueueEntry = QueueEntry> {
  private waiting: E[] = [];
  /**
   * @param canMeet false for two accounts that must never be paired (one
   *   blocked the other). The same account never meets itself.
   */
  constructor(
    private readonly canMeet: (a: string, b: string) => boolean = () => true,
  ) {}

  get size() {
    return this.waiting.length;
  }

  has(socketId: string) {
    return this.waiting.some((e) => e.socketId === socketId);
  }

  /**
   * Queue a player. Returns the opponent they meet now (removed from the
   * queue, the joiner is not added), or null when they wait. An account
   * already waiting on another socket is replaced by this one.
   */
  join(entry: E): E | null {
    this.waiting = this.waiting.filter(
      (e) => e.socketId !== entry.socketId && e.accountId !== entry.accountId,
    );
    const i = this.waiting.findIndex(
      (e) =>
        this.canMeet(e.accountId, entry.accountId) &&
        this.canMeet(entry.accountId, e.accountId),
    );
    if (i < 0) {
      this.waiting.push(entry);
      return null;
    }
    return this.waiting.splice(i, 1)[0];
  }

  /** Take a player out of the queue; returns their entry if they were in it. */
  leave(socketId: string): E | null {
    const i = this.waiting.findIndex((e) => e.socketId === socketId);
    return i < 0 ? null : this.waiting.splice(i, 1)[0];
  }
}

/**
 * 2v2 and Free-for-all (docs/pvp-plan.md, "Bots fill in"): players searching
 * the same mode gather here. A full group plays at once; a group that isn't
 * full by the time one of its players asks (`fill`: the client asks after
 * QUICK_FILL_MS, or when the player presses Start) plays with bots in the
 * empty seats, so nobody waits for three more people on a quiet evening.
 *
 * Pure and synchronous, like QuickQueue.
 */
export class GroupQueue<E extends QueueEntry = QueueEntry> {
  private waiting: E[] = [];
  /**
   * @param size seats in a match (4).
   * @param canMeet false for two accounts that must never share a match
   *   (one blocked the other).
   */
  constructor(
    readonly size: number,
    private readonly canMeet: (a: string, b: string) => boolean = () => true,
  ) {}

  get length() {
    return this.waiting.length;
  }

  has(socketId: string) {
    return this.waiting.some((e) => e.socketId === socketId);
  }

  /** The earliest waiting players `entry` can play with, each with each other. */
  private company(entry: E, seats: number) {
    const ok = (a: E, b: E) =>
      this.canMeet(a.accountId, b.accountId) &&
      this.canMeet(b.accountId, a.accountId);
    const group: E[] = [];
    for (const e of this.waiting) {
      if (group.length >= seats) break;
      if (e.socketId === entry.socketId || e.accountId === entry.accountId)
        continue;
      if (ok(e, entry) && group.every((g) => ok(g, e))) group.push(e);
    }
    return group;
  }
  private remove(group: E[]) {
    this.waiting = this.waiting.filter((e) => !group.includes(e));
  }

  /**
   * Queue a player. Returns the whole group (longest wait first, the joiner
   * last) once it is full, all removed from the queue; null while they
   * wait. An account already waiting on another socket is replaced.
   */
  join(entry: E): E[] | null {
    this.waiting = this.waiting.filter(
      (e) => e.socketId !== entry.socketId && e.accountId !== entry.accountId,
    );
    const others = this.company(entry, this.size - 1);
    if (others.length < this.size - 1) {
      this.waiting.push(entry);
      return null;
    }
    this.remove(others);
    return [...others, entry];
  }

  /**
   * A waiting player won't wait longer: they and the others they can play
   * with (longest wait first), all removed. Bots take the seats left.
   * Empty if `socketId` isn't waiting.
   */
  fill(socketId: string): E[] {
    const entry = this.waiting.find((e) => e.socketId === socketId);
    if (!entry) return [];
    const group = [entry, ...this.company(entry, this.size - 1)];
    this.remove(group);
    return group;
  }

  /** Take a player out of the queue; returns their entry if they were in it. */
  leave(socketId: string): E | null {
    const i = this.waiting.findIndex((e) => e.socketId === socketId);
    return i < 0 ? null : this.waiting.splice(i, 1)[0];
  }
}
