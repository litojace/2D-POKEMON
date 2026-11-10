import { describe, expect, it } from "vitest";
import { BattlePerfMeter, perfMode } from "../../apps/client/src/battle-perf";
import { battlePerfSchema } from "../../packages/shared/src/connection";

function feed(
  m: BattlePerfMeter,
  seconds: number,
  step: (i: number) => number,
  live = true,
) {
  let t = (m as any).__t ?? 0;
  for (let i = 0, start = t; t - start < seconds * 1000; i++) {
    t += step(i);
    m.frame(t, live);
  }
  (m as any).__t = t;
}

describe("battle performance meter", () => {
  it("measures a smooth device", () => {
    const m = new BattlePerfMeter();
    feed(m, 20, () => 1000 / 60);
    const s = m.summary();
    expect(s.fps).toBeCloseTo(60, 0);
    expect(s.seconds).toBeCloseTo(20, 0);
    expect(s.jank).toBe(0);
  });

  it("counts the stutter after skills by time", () => {
    const m = new BattlePerfMeter();
    // Half a second of 25 fps every 2 s: a quarter of the time.
    let t = 0;
    feed(m, 20, () => {
      const step = t % 2000 < 500 ? 40 : 1000 / 60;
      t += step;
      return step;
    });
    const s = m.summary();
    expect(s.jank).toBeGreaterThan(0.2);
    expect(s.jank).toBeLessThan(0.3);
    expect(s.frameP95).toBe(40);
  });

  it("counts stalls, and leaves out pauses and anything outside live play", () => {
    const m = new BattlePerfMeter();
    // A 900 ms stall every 50 frames: counted, and in the stutter.
    feed(m, 10, (i) => (i % 50 === 0 ? 900 : 1000 / 60));
    const stalls = m.summary();
    expect(stalls.fps).toBeCloseTo(60, 0);
    expect(stalls.stalls).toBeGreaterThan(3);
    expect(stalls.jank).toBeGreaterThan(0.3);
    // A device that slept (a 30 s gap) and time outside live play: left out.
    m.reset();
    feed(m, 10, (i) => (i === 100 ? 30_000 : 1000 / 60));
    feed(m, 10, () => 100, false);
    const s = m.summary();
    expect(s.seconds).toBeLessThan(11);
    expect(s.stalls).toBe(0);
    expect(s.jank).toBe(0);
  });

  it("hears from the slowest phones too (4 fps)", () => {
    const m = new BattlePerfMeter();
    feed(m, 30, () => 260);
    const s = m.summary();
    expect(s.seconds).toBeGreaterThan(29);
    expect(s.fps).toBeCloseTo(3.8, 1);
    expect(s.stalls).toBe(s.frames);
    expect(s.jank).toBe(1);
  });

  it("shows the last second on its own (the overlay)", () => {
    const m = new BattlePerfMeter();
    feed(m, 10, () => 1000 / 60);
    feed(m, 2, () => 40);
    expect(m.summary(1000).fps).toBe(25);
    expect(m.summary().fps).toBeCloseTo(60, 0);
  });

  it("keeps bounded memory in a long match", () => {
    const m = new BattlePerfMeter();
    feed(m, 15 * 60, () => 1000 / 60);
    expect(m.summary().frames).toBeLessThanOrEqual(40_000);
    m.reset();
    expect(m.summary().frames).toBe(0);
  });

  it("produces a report the server accepts", () => {
    const m = new BattlePerfMeter();
    feed(m, 12, () => 20);
    const report = {
      ...m.summary(),
      quality: "low",
      setting: "auto",
      density: 1.5,
      memory: 2,
      cores: 8,
    };
    expect(battlePerfSchema.safeParse(report).success).toBe(true);
    // Nothing unexpected (like a name) gets through.
    expect(
      battlePerfSchema.safeParse({ ...report, name: "someone" }).success,
    ).toBe(false);
  });
});

describe("perf mode", () => {
  it("turns on with ?perf=1 only", () => {
    expect(perfMode("?perf=1")).toBe(true);
    expect(perfMode("?a=2&perf=1")).toBe(true);
    expect(perfMode("?perf=10")).toBe(false);
    expect(perfMode("")).toBe(false);
  });
});
