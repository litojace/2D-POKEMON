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

  it("do not twitch you every snapshot while a drift pulls you (Radiant Flare)", () => {
    const run = (noCarry: boolean) =>
      simulateCorrections({
        seconds: 60,
        me: "cindrake",
        bot: "lumoth",
        fullUlt: true,
        noCarry,
      }).corrections.filter(
        (c) => c.cause === "status" && c.detail.includes("lure"),
      ).length;
    const before = run(true),
      after = run(false);
    // Measured with a Lumoth casting Radiant Flare whenever it can: about 430
    // before, about 40 after (only entering and leaving the pull).
    expect(before).toBeGreaterThan(30);
    expect(after).toBeLessThan(before / 3);
  });

  it("do not jump when Wi-Fi holds your inputs for a moment", () => {
    // A phone's uplink that holds 3% of its inputs for 120 ms while you walk
    // and turn (the match reports' "unexplained" jumps, sections 12 and 16).
    // The server used to run your last input again on the held ticks and
    // fold the late ones afterwards: about 8-10 a minute were left, every
    // one a turn during a hold. Now every input is its own step.
    for (const seed of [11, 12, 13]) {
      const { corrections } = simulateCorrections({
        seconds: 60,
        noBot: true,
        noSkill: true,
        noBasic: true,
        jitter: 20,
        stallChance: 0.03,
        stallMs: 120,
        seed,
      });
      expect(corrections).toEqual([]);
    }
  });

  it("do not jump in a free-for-all over held Wi-Fi either", () => {
    const { corrections } = simulateCorrections({
      seconds: 60,
      mode: "ffa",
      bots: 2,
      level: "hard",
      jitter: 20,
      stallChance: 0.03,
      stallMs: 120,
    });
    expect(corrections.length).toBeGreaterThan(0);
    expect(corrections.filter((c) => c.cause === "other")).toEqual([]);
  });
});
