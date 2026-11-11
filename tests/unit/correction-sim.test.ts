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
    const unexplained = corrections.filter((c) => c.cause === "unexplained");
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
});
