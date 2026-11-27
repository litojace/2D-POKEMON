import { describe, expect, it } from "vitest";
import {
  BattleInputClock,
  INPUT_CLOCK,
  type InputClockTimers,
} from "../../apps/client/src/battle-input-clock";
import { compareInputClock } from "../../scripts/perf/input-clock-comparison";

function timerHarness() {
  let now = 0;
  const jobs: { at: number; fn: () => void; cancelled?: boolean }[] = [];
  const timers: InputClockTimers = {
    now: () => now,
    setTimeout: (fn, ms) => {
      const job = { at: now + Math.max(1, ms), fn };
      jobs.push(job);
      return job;
    },
    clearTimeout: (handle) => {
      (handle as (typeof jobs)[number]).cancelled = true;
    },
  };
  const advance = (to: number) => {
    while (true) {
      jobs.sort((a, b) => a.at - b.at);
      const next = jobs[0];
      if (!next || next.at > to) break;
      jobs.shift();
      if (next.cancelled) continue;
      now = Math.max(now, next.at);
      next.fn();
    }
    now = to;
  };
  return {
    timers,
    jobs,
    advance,
    stall: (ms: number) => {
      now += ms;
    },
  };
}

describe("battle input deadlines", () => {
  it.each([20, 5])(
    "keeps input at 30 Hz when rendering is only %i Hz and the thread is available",
    (renderHz) => {
      const before = compareInputClock(0, true, 7, renderHz);
      const after = compareInputClock(0, false, 7, renderHz);
      expect(after.inputs).toBeGreaterThanOrEqual(1799);
      expect(after.pressToSendMs.p95).toBeLessThan(before.pressToSendMs.p95);
      expect(after.sentPresses).toBe(after.acceptedPresses);
    },
  );
  it.each([0, 50, 150, 250])(
    "keeps 30 Hz through %i ms stalls with real Phaser smoothing and timer jitter",
    (hitch) => {
      const after = compareInputClock(hitch, false);
      expect(after.inputs).toBeGreaterThanOrEqual(1799);
      expect(after.inputs).toBeLessThanOrEqual(1800);
      expect(after.sentPresses).toBe(after.acceptedPresses);
      const before = compareInputClock(hitch, true);
      if (hitch === 250) expect(before.inputHz).toBeLessThan(28);
      expect(after.pressToSendMs.p95).toBeLessThanOrEqual(
        before.pressToSendMs.p95 + 2,
      );
    },
  );

  it("never buys a step from repeated frame/action sync calls", () => {
    const h = timerHarness();
    let sent = 0;
    const clock = new BattleInputClock(
      () => sent++,
      () => true,
      30,
      h.timers,
    );
    for (let t = 0; t < 1000; t++) {
      clock.sync();
      h.advance(t);
    }
    h.advance(1000);
    expect(sent).toBeGreaterThanOrEqual(29);
    expect(sent).toBeLessThanOrEqual(30);
    h.advance(1001);
    expect(sent).toBe(30);
    clock.stop();
    h.advance(2000);
    expect(sent).toBe(30);
  });

  it("yields after three overdue steps and retains a 250 ms hitch's debt", () => {
    const h = timerHarness();
    const at: number[] = [];
    const clock = new BattleInputClock(
      () => at.push(h.timers.now()),
      () => true,
      30,
      h.timers,
    );
    clock.sync();
    h.stall(250);
    h.advance(250);
    expect(at).toHaveLength(INPUT_CLOCK.perWake);
    h.advance(255);
    expect(at).toHaveLength(7);
    expect(
      Math.max(...at.map((t) => at.filter((v) => v === t).length)),
    ).toBeLessThanOrEqual(3);
    h.advance(1001);
    expect(at).toHaveLength(30);
    clock.stop();
  });

  it("discards a long suspension instead of flooding old steps", () => {
    const h = timerHarness();
    let sent = 0;
    const clock = new BattleInputClock(
      () => sent++,
      () => true,
      30,
      h.timers,
    );
    clock.sync();
    h.stall(5000);
    h.advance(5000);
    expect(sent).toBe(1);
    h.advance(5100);
    expect(sent).toBeLessThanOrEqual(4);
    clock.stop();
  });

  it("revokes an already queued callback across pause and restart", () => {
    const h = timerHarness();
    let ready = true,
      sent = 0;
    const clock = new BattleInputClock(
      () => sent++,
      () => ready,
      30,
      h.timers,
    );
    clock.sync();
    const staleCallback = h.jobs[0].fn;
    ready = false;
    h.advance(1000);
    expect(sent).toBe(0);
    ready = true;
    clock.sync();
    staleCallback(); // from the previous lifecycle: cannot send or schedule
    h.advance(1033);
    expect(sent).toBe(0);
    h.advance(1034);
    expect(sent).toBe(1);
    clock.stop();
  });
});
