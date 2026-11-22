import { describe, expect, it } from "vitest";
import { simulateCorrections } from "../../scripts/perf/correction-sim";
import { HIT_GAP_PX } from "../../apps/client/src/battle-perf";

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
        // (Terradon walks into the flares' pull often; a 0.5 s Crest Flare
        // left Cindrake out of it in this replay.)
        me: "terradon",
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

// battle-perf hitsFar: "I dodged but still got hit". The phone compared the
// hit with where it drew you one eased lead earlier; that lead still carried
// the previous snapshot's age, so it looked 66-99 ms too far back and most
// hits on a moving fighter read as far (match reports, 20 Nov 2026: about
// 20 a minute in every PvP match).
describe("hits on you as the match report counts them", () => {
  it("are far only when you really were drawn far away", () => {
    for (const [me, bot] of [
      ["mystowl", "coilemur"],
      ["astrabun", "shadopus"],
    ] as const) {
      const { hits } = simulateCorrections({
        seconds: 40,
        latency: 25,
        me,
        bot,
        level: "hard",
      });
      const far = (k: "gap" | "aligned") =>
        hits.filter((h) => h[k] > HIT_GAP_PX).length;
      expect(hits.length).toBeGreaterThan(40);
      // Measured: 0-4 far either way over 120 s; the eased lead read
      // 90-130 of the same hits as far.
      expect(far("gap")).toBeLessThanOrEqual(far("aligned") + 3);
      expect(far("gap")).toBeLessThan(hits.length / 20);
    }
  });
});
