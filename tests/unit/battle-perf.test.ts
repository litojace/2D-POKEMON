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

describe("network meter", () => {
  it("summarises round trips, snapshot gaps, corrections and skill waits", async () => {
    const { NetMeter } = await import("../../apps/client/src/battle-perf");
    const m = new NetMeter();
    for (const ms of [40, 42, 45, 50, 120]) m.rtt(ms);
    // A minute of snapshots on time (every 67 ms), with one late in ten.
    let t = 0;
    for (let i = 0; i < 900; i++) {
      t += i % 10 === 0 ? 180 : 67;
      m.snapshot(t, true);
    }
    for (const px of [2, 3, 6, 12, 30]) m.correction(px);
    for (const ms of [90, 100, 110]) m.confirmed(ms);
    const s = m.summary();
    expect(s.rttP50).toBe(45);
    expect(s.rttP95).toBe(120);
    expect(s.snapLate).toBeCloseTo(0.1, 2);
    expect(s.snapGapP95).toBe(180);
    // Three corrections over 4 px in about 1.2 minutes.
    expect(s.corrections).toBeGreaterThan(2);
    expect(s.corrections).toBeLessThan(3);
    expect(s.correctionMax).toBe(30);
    expect(s.confirmP50).toBe(100);
  });

  it("ignores pauses and anything outside live play", async () => {
    const { NetMeter } = await import("../../apps/client/src/battle-perf");
    const m = new NetMeter();
    m.snapshot(0, true);
    m.snapshot(67, true);
    m.snapshot(10_000, true); // a background tab: not a late snapshot
    m.snapshot(10_067, false);
    m.snapshot(10_500, true);
    m.snapshot(10_567, true);
    expect(m.summary().snapLate).toBe(0);
    m.reset();
    expect(m.summary()).toEqual({
      rttP50: 0,
      rttP95: 0,
      snapGapP95: 0,
      snapLate: 0,
      corrections: 0,
      correctionMax: 0,
      confirmP50: 0,
      correctionsHit: 0,
      correctionsStatus: 0,
      correctionsMove: 0,
      correctionsOther: 0,
      hitsFar: 0,
      hitGapMax: 0,
    });
  });

  it("counts each correction's cause and the hits that looked like a miss", async () => {
    const { NetMeter, HIT_GAP_PX } =
      await import("../../apps/client/src/battle-perf");
    const m = new NetMeter();
    // One minute of live play.
    for (let t = 0; t <= 60_000; t += 67) m.snapshot(t, true);
    m.correction(30, "hit");
    m.correction(12, "status");
    m.correction(9, "other");
    m.correction(3, "other"); // under 4 px: not a correction
    m.hitGap(5);
    m.hitGap(HIT_GAP_PX + 1);
    m.hitGap(80);
    const s = m.summary();
    expect(s.corrections).toBeCloseTo(3, 0);
    expect(s.correctionsHit).toBeCloseTo(1, 0);
    expect(s.correctionsStatus).toBeCloseTo(1, 0);
    expect(s.correctionsOther).toBeCloseTo(1, 0);
    expect(s.correctionsMove).toBe(0);
    expect(s.hitsFar).toBe(2);
    expect(s.hitGapMax).toBe(80);
  });

  it("names the device coarsely and the build", async () => {
    const { deviceKind, BUILD } =
      await import("../../apps/client/src/battle-perf");
    const iphone =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1";
    expect(deviceKind(iphone, 5, true)).toEqual({ os: "ios", app: true });
    // An iPad says it is a Mac, but has a touch screen.
    const ipad =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15";
    expect(deviceKind(ipad, 5, false).os).toBe("ios");
    expect(deviceKind(ipad, 0, false).os).toBe("mac");
    expect(
      deviceKind("Mozilla/5.0 (Linux; Android 15; Pixel 9)", 5, false).os,
    ).toBe("android");
    expect(
      deviceKind("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", 0, false).os,
    ).toBe("windows");
    // Not built by Vite here: "dev".
    expect(BUILD).toMatch(/^[a-z0-9-]{1,16}$/);
  });

  it("is accepted by the server with or without the network numbers", async () => {
    const { NetMeter, BattlePerfMeter } =
      await import("../../apps/client/src/battle-perf");
    const perf = new BattlePerfMeter();
    let t = 0;
    for (let i = 0; i < 800; i++) perf.frame((t += 16.7), true);
    const base = {
      ...perf.summary(),
      quality: "high",
      setting: "auto",
      density: 1.5,
      cores: 4,
    };
    expect(battlePerfSchema.safeParse(base).success).toBe(true);
    expect(
      battlePerfSchema.safeParse({ ...base, ...new NetMeter().summary() })
        .success,
    ).toBe(true);
    // Everything main.ts sends at the end of a match.
    const full = {
      ...base,
      ...new NetMeter().summary(),
      ping: 65,
      lead: 205,
      os: "ios",
      app: true,
      build: "2f04ba3",
      errors: 0,
    };
    expect(battlePerfSchema.safeParse(full).success).toBe(true);
    // Unknown fields and odd builds are refused, as before.
    expect(battlePerfSchema.safeParse({ ...full, name: "Kai" }).success).toBe(
      false,
    );
    expect(
      battlePerfSchema.safeParse({ ...full, build: "<script>" }).success,
    ).toBe(false);
  });
});
