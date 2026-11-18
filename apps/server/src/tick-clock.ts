import { performance } from "node:perf_hooks";

/**
 * The combat loop at exactly `hz` ticks a second, on average, whatever the
 * timers do.
 *
 * Phones send one input per tick on their own clock (exactly 30 a second),
 * and the server steps one input per tick. `setInterval(step, 1000 / 30)`
 * is not 30 a second: Node runs it about 30.1 times a second on an idle
 * machine (timers fire on whole milliseconds), and a busy or CPU-throttled
 * instance skips ticks it never makes up. Either way the input queue drifts
 * against the phone: a faster server runs dry and repeats your last input
 * (a step the phone did not predict), a slower one piles inputs up and
 * folds them into one tick (a step lost). Both read as "unexplained" jumps
 * of one step (~9 px) in the match reports: in scripts/perf/correction-sim.ts
 * a server at 30.1 Hz gives 4-10 a minute, at 29.5 Hz 13-15, at 30.0 none
 * (docs/network-performance.md, section 15).
 *
 * So the next tick is due a fixed period after the last one was due, not
 * after it ran, and a tick that came late (a garbage collection, a busy
 * event loop) is made up straight away. Each make-up tick waits only for
 * `setImmediate`, which runs after Node has read the sockets: the inputs
 * that arrived during the hold are queued first, and then step one per
 * tick, as the phones predicted. More than `maxCatchUp` ticks behind (the
 * process was suspended), the clock starts afresh rather than racing
 * through a backlog.
 */
export const TICK_CLOCK = {
  /** At most this many late ticks are made up; further behind, start afresh. */
  maxCatchUp: 10,
  /** Seconds the measured rate (`hz()`) covers. */
  window: 60,
};

export interface TickClockTimers {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  /** After pending I/O (Node's setImmediate). */
  setImmediate(fn: () => void): unknown;
  clearTimeout(handle: unknown): void;
}

const realTimers: TickClockTimers = {
  now: () => performance.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  setImmediate: (fn) => setImmediate(fn),
  clearTimeout: (handle) => {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
    clearImmediate(handle as ReturnType<typeof setImmediate>);
  },
};

export class TickClock {
  private due: number;
  private handle: unknown;
  private stopped = false;
  /** When recent ticks ran (ms), for `hz()`. */
  private ran: number[] = [];
  private readonly period: number;
  constructor(
    private readonly step: () => void,
    hz: number,
    private readonly timers: TickClockTimers = realTimers,
  ) {
    this.period = 1000 / hz;
    this.due = timers.now() + this.period;
    this.schedule();
  }
  private schedule() {
    if (this.stopped) return;
    const wait = this.due - this.timers.now();
    this.handle =
      wait > 0
        ? this.timers.setTimeout(() => this.run(), wait)
        : this.timers.setImmediate(() => this.run());
  }
  private run() {
    if (this.stopped) return;
    const now = this.timers.now();
    if (now < this.due) return this.schedule();
    if (now - this.due > TICK_CLOCK.maxCatchUp * this.period)
      // Suspended or stalled far beyond a hiccup: start afresh.
      this.due = now;
    this.due += this.period;
    this.note(now);
    // A throw ends the process, as it did under setInterval.
    this.step();
    this.schedule();
  }
  private note(now: number) {
    this.ran.push(now);
    const from = now - TICK_CLOCK.window * 1000;
    let drop = 0;
    while (drop < this.ran.length && this.ran[drop] < from) drop++;
    if (drop) this.ran.splice(0, drop);
  }
  /**
   * Ticks a second over the last minute (two decimals), as the match
   * reports log it (`serverHz`); undefined until it has run 10 seconds.
   */
  hz(): number | undefined {
    const now = this.timers.now();
    const from = now - TICK_CLOCK.window * 1000;
    const recent = this.ran.filter((t) => t >= from);
    if (recent.length < 2) return;
    const span = Math.max(recent.at(-1)! - recent[0], 0);
    if (span < 10_000) return;
    return Math.round(((recent.length - 1) / span) * 1000 * 100) / 100;
  }
  stop() {
    this.stopped = true;
    if (this.handle !== undefined) this.timers.clearTimeout(this.handle);
  }
}
