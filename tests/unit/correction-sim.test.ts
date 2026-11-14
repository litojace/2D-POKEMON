import { describe, expect, it } from "vitest";
import { simulateCorrections } from "../../scripts/perf/correction-sim";

// The real server, bot and client prediction over a 67 ms round trip.
describe("your fighter's corrections", () => {
  it("never happen while you only walk", () => {
    const { corrections } = simulateCorrections({
      seconds: 30,
      noBot: true,
      noSkill: true,
      noBasic: true,
    });
    expect(corrections).toEqual([]);
  });

  it("come from hits and statuses in a real fight, not from prediction", () => {
    const { corrections } = simulateCorrections({ seconds: 60 });
    expect(corrections.length).toBeGreaterThan(0);
    const unexplained = corrections.filter((c) => c.cause === "other");
    expect(unexplained).toEqual([]);
  });

  it("do not twitch you every snapshot while you stand in an Undertow", () => {
    const run = (noCarry: boolean) =>
      simulateCorrections({
        seconds: 60,
        me: "cindrake",
        bot: "tidefin",
        noCarry,
      }).corrections.filter(
        (c) => c.cause === "status" && c.detail.includes("current"),
      ).length;
    const before = run(true),
      after = run(false);
    // Measured: about 70 before, about 8 after (only entering and leaving).
    expect(before).toBeGreaterThan(30);
    expect(after).toBeLessThan(before / 3);
  });

  it("do not jump when Wi-Fi holds your inputs for a moment", () => {
    // A phone's uplink that holds 3% of its inputs for 120 ms (the match
    // reports' "unexplained" jumps, docs/network-performance.md section 12).
    const run = (noOwed: boolean) =>
      simulateCorrections({
        seconds: 60,
        noBot: true,
        noSkill: true,
        noBasic: true,
        jitter: 20,
        stallChance: 0.03,
        stallMs: 120,
        noOwed,
      }).corrections.length;
    const before = run(true),
      after = run(false);
    // Measured: about 80 a minute replayed as before, 8-10 with owed steps
    // (direction changes during a hold); the old server gave 63-73.
    expect(before).toBeGreaterThan(40);
    expect(after).toBeLessThan(before / 4);
  });
});
