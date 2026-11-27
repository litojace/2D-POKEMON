/** Browser input deadlines use monotonic wall time, independently of rendering. */
export const INPUT_CLOCK = {
  /** A wake may send at most three steps, yielding before any remaining debt. */
  perWake: 3,
  /** Beyond ten overdue steps (~333 ms), discard the suspension's debt. */
  maxBehind: 10,
};

export interface InputClockTimers {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}
const browserTimers: InputClockTimers = {
  now: () => performance.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) =>
    clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * One deadline per simulation step. Timers can still wait for a blocked main
 * thread, but Phaser's smoothed delta and skipped render frames cannot slow
 * this clock. Short stalls retain their deadlines; catch-up yields in small
 * batches. A long suspension starts afresh. Neither an action nor a render
 * frame can buy an extra input/step.
 *
 * `sync` starts/stops on lifecycle changes. `ready` is also checked at every
 * wake and before every send, so a queued timer cannot buffer stale commands
 * into Socket.IO during a disconnect, hidden page or destroyed scene.
 */
export class BattleInputClock {
  private due = 0;
  private handle: unknown;
  private running = false;
  private epoch = 0;
  private readonly period: number;
  constructor(
    private readonly send: () => void,
    private readonly ready: () => boolean,
    hz: number,
    private readonly timers: InputClockTimers = browserTimers,
  ) {
    this.period = 1000 / hz;
  }
  sync() {
    if (!this.ready()) return this.stop();
    if (this.running) return;
    this.running = true;
    this.due = this.timers.now() + this.period;
    this.schedule();
  }
  private schedule() {
    if (!this.running) return;
    const epoch = this.epoch;
    // Ceil avoids repeatedly asking for a fractional millisecond that the
    // browser truncates. Never run early; preserve the original deadline.
    this.handle = this.timers.setTimeout(
      () => {
        if (epoch === this.epoch) this.run();
      },
      Math.max(0, Math.ceil(this.due - this.timers.now())),
    );
  }
  private run() {
    if (!this.running) return;
    this.handle = undefined;
    if (!this.ready()) return this.stop();
    const now = this.timers.now();
    const epoch = this.epoch;
    if (now - this.due > INPUT_CLOCK.maxBehind * this.period) this.due = now;
    let sent = 0;
    while (
      this.running &&
      epoch === this.epoch &&
      this.due <= now &&
      sent < INPUT_CLOCK.perWake
    ) {
      if (!this.ready()) return this.stop();
      this.due += this.period;
      sent++;
      this.send();
    }
    if (epoch === this.epoch) this.schedule();
  }
  stop() {
    this.running = false;
    this.epoch++;
    if (this.handle !== undefined) this.timers.clearTimeout(this.handle);
    this.handle = undefined;
  }
}
