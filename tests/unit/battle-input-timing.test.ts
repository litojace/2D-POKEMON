import { expect, it } from "vitest";
import { NetMeter, BattlePerfMeter } from "../../apps/client/src/battle-perf";
import { blankInput } from "../../packages/shared/src/index";
import { battlePerfSchema } from "../../packages/shared/src/connection";
import { KEEP, toReport } from "../../scripts/perf/export-perf-reports.mjs";

it("measures the DOM delivery and input deadline apart from RTT and cast confirmation", () => {
  const meter = new NetMeter();
  for (let i = 0; i < 100; i++) {
    const event = i * 400;
    meter.press("basic", event, event + 150, 0);
    meter.input({ ...blankInput(), basic: true }, event + 170);
    meter.rtt(70);
    meter.confirmed(i < 95 ? 100 : 250);
  }
  expect(meter.summary()).toMatchObject({
    pressSamples: 100,
    pressToSendP50: 170,
    pressToSendP95: 170,
    pressToSendP99: 170,
    eventToHandlerP95: 150,
    handlerToSendP95: 20,
    sendGapP50: 400,
    sendGapP95: 400,
    sendGapP99: 400,
    sendGapMax: 400,
    rttP50: 70,
    confirmP50: 100,
    confirmP95: 250,
    confirmP99: 250,
  });
});

it("counts a quick tap once, accepts Safari epoch timestamps, and drops cancelled or stale edges", () => {
  const meter = new NetMeter();
  const origin = 1_800_000_000_000;
  meter.press("basic", origin + 10, 20, origin);
  meter.input({ ...blankInput(), basic: true }, 34);
  meter.input({ ...blankInput(), basic: true }, 67); // held repeat
  expect(meter.summary()).toMatchObject({
    pressSamples: 1,
    pressToSendP50: 24,
    eventToHandlerP95: 10,
  });
  for (const stamp of [undefined, NaN, -1, 1000])
    meter.press("dash", stamp, 100, 0);
  meter.input({ ...blankInput(), dash: true }, 101);
  meter.press("dash", 110, 111, 0);
  meter.clearPresses();
  meter.input({ ...blankInput(), dash: true }, 134);
  meter.press("skill0", 140, 141, 0);
  meter.pauseInput();
  meter.input({ ...blankInput(), skill: 0 }, 10_000);
  expect(meter.summary().pressSamples).toBe(1);
  expect(meter.summary().sendGapMax).toBe(34); // no background/reconnect gap
  meter.reset();
  expect(meter.summary().pressSamples).toBeUndefined();
  expect(meter.summary().sendGapMax).toBeUndefined();
});

it("keeps the optional bounded technical fields in reports without account/room data", () => {
  const meter = new NetMeter();
  meter.press("skill0", 5, 7, 0);
  meter.input({ ...blankInput(), skill: 0 }, 33);
  meter.input(blankInput(), 67);
  meter.confirmed(80);
  const summary = meter.summary();
  const report = {
    ...new BattlePerfMeter().summary(),
    ...summary,
    quality: "low",
    setting: "low",
    density: 1.25,
  };
  expect(battlePerfSchema.safeParse(report).success).toBe(true);
  for (const field of [
    "pressSamples",
    "pressToSendP50",
    "pressToSendP95",
    "pressToSendP99",
    "eventToHandlerP95",
    "handlerToSendP95",
    "sendGapP50",
    "sendGapP95",
    "sendGapP99",
    "sendGapMax",
    "confirmP95",
    "confirmP99",
  ]) {
    expect(KEEP["arena-perf"]).toContain(field);
  }
  const parsed = toReport({
    id: "sample",
    timestamp: "2026-11-24T00:00:00Z",
    message: `arena-perf ${JSON.stringify({ ...report, account: "private", room: "private" })}`,
  });
  expect(parsed).toMatchObject(summary);
  expect(parsed).not.toHaveProperty("account");
  expect(parsed).not.toHaveProperty("room");
  expect(
    battlePerfSchema.safeParse({ ...report, pressToSendP99: Infinity }).success,
  ).toBe(false);
});
