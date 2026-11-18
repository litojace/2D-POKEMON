import { describe, expect, it } from "vitest";
import {
  TICK_CLOCK,
  TickClock,
  type TickClockTimers,
} from "../../apps/server/src/tick-clock";
import { simulateCorrections } from "../../scripts/perf/correction-sim";

/**
 * Timers the way Node's behave under load: a timeout fires on a whole
 * millisecond, never early, often a little late, and now and then the
 * event loop is busy for a while (a garbage collection, a CPU-throttled
 * instance).
 */
function nodeLikeTimers(seed = 7, stallEvery = 0, stallMs = 0) {
  let now = 0,
    random = seed;
  const rand = () => {
    random = (random * 1103515245 + 12345) % 2 ** 31;
    return random / 2 ** 31;
  };
  let next: { at: number; fn: () => void } | undefined;
  let fired = 0;
  const timers: TickClockTimers = {
    now: () => now,
    setTimeout(fn, ms) {
      let at = Math.ceil(now + Math.max(1, Math.trunc(ms))) + rand() * 2;
      if (stallEvery && ++fired % stallEvery === 0) at += stallMs;
      next = { at, fn };
      return next;
    },
    setImmediate(fn) {
      next = { at: now, fn };
      return next;
    },
    clearTimeout() {
      next = undefined;
    },
  };
  const runFor = (ms: number) => {
    const end = now + ms;
    while (next && next.at <= end) {
      const due = next;
      next = undefined;
      now = due.at;
      due.fn();
    }
    now = end;
  };
  return { timers, runFor };
}

describe("the combat loop's clock", () => {
  it("ticks exactly 30 times a second though its timers fire late", () => {
    const { timers, runFor } = nodeLikeTimers();
    let ticks = 0;
    const clock = new TickClock(() => ticks++, 30, timers);
    runFor(60_000);
    clock.stop();
    // setInterval(step, 1000 / 30) on the same timers runs about 30.1 to
    // 29.4 a second; this must land within a tick of 1800.
    expect(Math.abs(ticks - 1800)).toBeLessThanOrEqual(1);
    expect(clock.hz()).toBeCloseTo(30, 1);
  });

  it("makes up the ticks a busy event loop delayed", () => {
    // Every 20th timer fires 120 ms late (three and a half ticks).
    const { timers, runFor } = nodeLikeTimers(3, 20, 120);
    const bursts: number[] = [];
    let ticks = 0,
      inBurst = 0,
      last = -1;
    const clock = new TickClock(
      () => {
        ticks++;
        const t = timers.now();
        if (t === last) inBurst++;
        else {
          if (inBurst) bursts.push(inBurst + 1);
          inBurst = 0;
        }
        last = t;
      },
      30,
      timers,
    );
    runFor(60_000);
    clock.stop();
    expect(Math.abs(ticks - 1800)).toBeLessThanOrEqual(1);
    // The late ticks ran at once, a few at a time.
    expect(bursts.length).toBeGreaterThan(0);
    expect(Math.max(...bursts)).toBeLessThanOrEqual(TICK_CLOCK.maxCatchUp);
  });

  it("starts afresh after a long suspension instead of racing a backlog", () => {
    const { timers, runFor } = nodeLikeTimers(5, 100, 5_000);
    let most = 0,
      run = 0,
      last = -1;
    const clock = new TickClock(
      () => {
        const t = timers.now();
        run = t === last ? run + 1 : 1;
        last = t;
        most = Math.max(most, run);
      },
      30,
      timers,
    );
    runFor(30_000);
    clock.stop();
    expect(most).toBeLessThanOrEqual(TICK_CLOCK.maxCatchUp);
  });

  it("reports how late its ticks ran, for the match reports", () => {
    const calm = nodeLikeTimers(1);
    const a = new TickClock(() => {}, 30, calm.timers);
    calm.runFor(30_000);
    a.stop();
    const busy = nodeLikeTimers(1, 10, 60);
    const b = new TickClock(() => {}, 30, busy.timers);
    busy.runFor(30_000);
    b.stop();
    // Timers fire up to 3 ms late on whole milliseconds; every tenth also
    // waits 60 ms more (two ticks), and the ticks behind it run late too.
    expect(a.stats().tickLateP95).toBeLessThan(4);
    expect(b.stats().tickLateP95).toBeGreaterThan(20);
    expect(a.stats().serverHz).toBeCloseTo(30, 1);
    expect(b.stats().serverHz).toBeCloseTo(30, 1);
    expect(a.stats().tickMsP95).toBe(0);
  });

  it("stops", () => {
    const { timers, runFor } = nodeLikeTimers();
    let ticks = 0;
    const clock = new TickClock(() => ticks++, 30, timers);
    runFor(1_000);
    clock.stop();
    const at = ticks;
    runFor(1_000);
    expect(ticks).toBe(at);
  });

  // Why it matters: phones send exactly 30 inputs a second.
  it("a server slower than 30 Hz makes your fighter jump for no reason", () => {
    const other = (serverHz: number) =>
      simulateCorrections({
        seconds: 60,
        noBot: true,
        noSkill: true,
        noBasic: true,
        serverHz,
      }).corrections.filter((c) => c.cause === "other").length;
    expect(other(30)).toBe(0);
    // A throttled instance under setInterval ran slow: more inputs than
    // ticks, so some must be folded (the step credit stops a client moving
    // faster than a step a tick). A fast one is harmless now: its spare
    // ticks are held (Arena.drainInputs).
    expect(other(29.7)).toBeGreaterThan(0);
    expect(other(30.3)).toBe(0);
  });
});
