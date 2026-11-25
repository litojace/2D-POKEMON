import { expect, it } from "vitest";
import {
  NetMeter,
  BattlePerfMeter,
  drawnGap,
  hitDrawTime,
} from "../../apps/client/src/battle-perf";
import { Arena } from "../../apps/server/src/simulation";
import { blankInput, packSnapshot } from "../../packages/shared/src/index";
import { battlePerfSchema } from "../../packages/shared/src/connection";
import { KEEP, toReport } from "../../scripts/perf/export-perf-reports.mjs";

it("timestamps the hit's simulation moment before a later snapshot packs it", () => {
  const a = new Arena("TRACE");
  a.add("one", "One", "cindrake");
  a.add("two", "Two", "pyranda");
  a.start();
  a.time = 10;
  a.event("hit", { x: 240, y: 0 }, 0xffffff);
  a.time = 10.1;
  const packed = packSnapshot(a.snapshot());
  expect(packed.events.at(-1)).toMatchObject({ kind: "hit", at: 10 });
  expect(packed.time).toBe(10.1);
});

it("keeps eight worst input samples rather than losing their pairing in p95s", () => {
  const m = new NetMeter();
  for (let i = 0; i < 30; i++) {
    const event = i * 1000;
    m.press("dash", event, event + 100 + i, 0);
    m.input({ ...blankInput(), dash: true }, event + 130 + i);
  }
  const traces = (m.summary() as any).slowInputs;
  expect(traces).toHaveLength(8);
  expect(traces[0]).toMatchObject({
    action: "dash",
    deliveryMs: 129,
    deadlineMs: 30,
    totalMs: 159,
  });
  expect(traces[7].totalMs).toBe(152);
  m.reset();
  expect((m.summary() as any).slowInputs).toBeUndefined();
});

it("exports only bounded technical trace fields and accepts old aggregate reports", () => {
  const m = new NetMeter();
  m.press("basic", 0, 160, 0);
  m.input({ ...blankInput(), basic: true }, 180);
  const base = {
    ...new BattlePerfMeter().summary(),
    quality: "low",
    setting: "low",
    density: 1.25,
  };
  expect(battlePerfSchema.safeParse(base).success).toBe(true);
  const report = { ...base, ...m.summary() };
  expect(battlePerfSchema.safeParse(report).success).toBe(true);
  expect(KEEP["arena-perf"]).toContain("slowInputs");
  const exported = toReport({
    id: "sample",
    timestamp: "2026-11-25T00:00:00Z",
    message: `arena-perf ${JSON.stringify(report)}`,
  });
  expect(exported.slowInputs).toEqual((report as any).slowInputs);
  expect(
    battlePerfSchema.safeParse({
      ...report,
      slowInputs: Array(9).fill((report as any).slowInputs?.[0]),
    }).success,
  ).toBe(false);
  expect(
    battlePerfSchema.safeParse({
      ...report,
      slowInputs: [{ ...(report as any).slowInputs?.[0], account: "private" }],
    }).success,
  ).toBe(false);
});

it("matches an earlier hit inside a bundled snapshot without hiding a real gap", () => {
  const frames = Array.from({ length: 101 }, (_, i) => ({
    t: i * 10,
    x: i * 3,
    y: 0,
  }));
  const at = hitDrawTime(1000, 100, 10.1, { at: 10 });
  expect(at).toBeCloseTo(800);
  expect(drawnGap(frames, at!, 240, 0)).toBe(0);
  expect(drawnGap(frames, at!, 200, 0)).toBe(40);
});

it("excludes misses, rejects invalid event times, and supports older servers", () => {
  expect(hitDrawTime(1000, 100, 10.1, { at: 10, miss: true })).toBeUndefined();
  for (const at of [NaN, Infinity, -1, 11])
    expect(hitDrawTime(1000, 100, 10.1, { at })).toBeUndefined();
  expect(hitDrawTime(1000, 100, 10.1, {})).toBe(900);
  expect(hitDrawTime(1000, 100, 10.1, { at: 10.1004 })).toBe(900);
});

it("pairs a slow touch with frame history, distinguishes pauses, and clears history", () => {
  for (const blocked of [false, true]) {
    const m = new NetMeter();
    for (const t of blocked
      ? [0, 16, 32, 200]
      : Array.from({ length: 14 }, (_, i) => i * 16))
      m.frame(t);
    m.press("basic", 50, 210, 0, "touch-controls");
    m.input({ ...blankInput(), basic: true }, 230);
    expect(m.summary().slowInputs?.[0]).toEqual({
      action: "basic",
      source: "touch-controls",
      deliveryMs: 160,
      deadlineMs: 20,
      totalMs: 180,
      frameGapMs: blocked ? 168 : 16,
    });
    m.pauseInput();
    m.press("jump", 300, 500, 0);
    m.input({ ...blankInput(), jump: true }, 520);
    expect(m.summary().slowInputs?.[0].frameGapMs).toBeUndefined();
    m.reset();
    expect(m.summary().slowInputs).toBeUndefined();
  }
});

it("bounds hit context and does not alias summaries or retain previous-match samples", () => {
  const m = new NetMeter();
  m.hitGap(10, { eventAgeMs: 0, leadMs: 100, timed: true });
  for (let i = 0; i < 20; i++)
    m.hitGap(25 + i, { eventAgeMs: 100, leadMs: 100, timed: true });
  const report = m.summary();
  expect(report.farHits).toHaveLength(8);
  expect(report.farHits?.[0]).toEqual({
    gap: 44,
    eventAgeMs: 100,
    leadMs: 100,
    timed: true,
  });
  expect(report.hitsFar).toBe(20);
  m.reset();
  expect(m.summary().farHits).toBeUndefined();
  expect(report.farHits).toHaveLength(8);
});

it("strips unknown nested fields from exported traces and caps raw log rows", () => {
  const row = {
    action: "dash",
    source: "touch-controls",
    totalMs: 150,
    deliveryMs: 120,
    deadlineMs: 30,
    account: "private",
    timestamp: "private",
  };
  const report = toReport({
    id: "sample",
    timestamp: "2026-11-25T00:00:00Z",
    message: `arena-perf ${JSON.stringify({ slowInputs: Array(20).fill(row), farHits: [{ gap: 40, eventAgeMs: 10, leadMs: 100, timed: true, account: "private" }] })}`,
  });
  expect(report.slowInputs).toHaveLength(8);
  expect(JSON.stringify(report)).not.toContain("private");
  expect(report.farHits).toEqual([
    { gap: 40, eventAgeMs: 10, leadMs: 100, timed: true },
  ]);
});
