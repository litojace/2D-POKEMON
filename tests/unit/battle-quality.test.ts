import { expect, it } from "vitest";
import {
  BATTLE_PROBE,
  BATTLE_QUALITY,
  BattleQualityGovernor,
  autoStartLevel,
  isAndroid,
  type BattleCeiling,
  type BattleQuality,
} from "../../apps/client/src/battle-quality";
import type { GraphicsSetting } from "../../apps/client/src/graphics-quality";

/** What the device remembers between battles (localStorage in the game). */
function device() {
  let ceiling: BattleCeiling | null = null;
  return {
    read: () => ceiling,
    write: (c: BattleCeiling | null) => {
      ceiling = c;
    },
  };
}
function governor(
  setting: GraphicsSetting = "auto",
  start: BattleQuality | null = null,
  store = device(),
  clock = () => 0,
) {
  const saved: BattleQuality[] = [];
  const g = new BattleQualityGovernor(
    () => setting,
    start,
    (l) => saved.push(l),
    () => "high",
    store,
    clock,
  );
  let now = 0;
  const run = (seconds: number, frameMs: number | ((i: number) => number)) => {
    const changes: BattleQuality[] = [];
    for (let i = 0, t = 0; t < seconds * 1000; i++) {
      const step = typeof frameMs === "number" ? frameMs : frameMs(i);
      now += step;
      t += step;
      const c = g.frame(now);
      if (c) changes.push(c);
    }
    return changes;
  };
  return { g, run, saved };
}

it("starts an older phone's first battle at Low, and climbs if it copes", () => {
  const saved: BattleQuality[] = [];
  // Nothing learned yet, 2 GB or less (or slow in the Plaza): Low at once.
  const g = new BattleQualityGovernor(
    () => "auto",
    null,
    (l) => saved.push(l),
    () => "low",
    device(),
  );
  expect(g.current()).toBe("low");
  // A device that turns out fine steps up after a comfortable stretch.
  let now = 0;
  const changes: BattleQuality[] = [];
  const stretch =
    BATTLE_PROBE.warmup + BATTLE_PROBE.window * BATTLE_PROBE.fastWindows + 1000;
  for (let t = 0; t < stretch * 2.2; t += 1000 / 60) {
    now += 1000 / 60;
    const c = g.frame(now);
    if (c) changes.push(c);
  }
  expect(changes).toEqual(["medium", "high"]);
  // What Auto learned wins over the hint; a manual High still wins too.
  expect(
    new BattleQualityGovernor(
      () => "auto",
      "medium",
      () => {},
      () => "low",
      device(),
    ).current(),
  ).toBe("medium");
  expect(
    new BattleQualityGovernor(
      () => "high",
      null,
      () => {},
      () => "low",
      device(),
    ).current(),
  ).toBe("high");
  // Where Auto starts before it has learned a device.
  expect(
    autoStartLevel(
      () => true,
      () => true,
    ),
  ).toBe("low");
  expect(
    autoStartLevel(
      () => false,
      () => true,
    ),
  ).toBe("medium");
  expect(
    autoStartLevel(
      () => false,
      () => false,
    ),
  ).toBe("high");
  expect(
    isAndroid({
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36",
    }),
  ).toBe(true);
  expect(
    isAndroid({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
    }),
  ).toBe(false);
});

it("leaves a device that keeps up at full quality", () => {
  const { g, run } = governor();
  expect(run(60, 1000 / 60)).toEqual([]);
  expect(g.current()).toBe("high");
  // 120 Hz phones and occasional hitches are fine too.
  expect(run(30, (i) => (i % 90 === 0 ? 60 : 1000 / 120))).toEqual([]);
});

it("steps down one level at a time after sustained slow frames", () => {
  const { g, run, saved } = governor();
  // Warm-up plus two slow windows before the first step.
  const window = BATTLE_PROBE.window / 1000;
  expect(run(BATTLE_PROBE.warmup / 1000 + window, 33)).toEqual([]);
  expect(run(window + 0.1, 33)).toEqual(["medium"]);
  expect(run(BATTLE_PROBE.warmup / 2000 + 2 * window + 0.2, 33)).toEqual([
    "low",
  ]);
  expect(g.current()).toBe("low");
  expect(saved).toEqual(["medium", "low"]);
  expect(run(60, 33)).toEqual([]);
});

it("does not blame the device for loading stalls, pauses or a brief spike", () => {
  const { g, run } = governor();
  // Long gaps (a loading hitch, a background tab) between good frames.
  expect(run(60, (i) => (i % 30 === 0 ? 900 : 16.7))).toEqual([]);
  // A menu open: the scene calls pause() each frame, nothing is counted.
  for (let t = 0; t < 30_000; t += 50) {
    g.pause();
    g.frame(t + 1e6);
  }
  expect(g.current()).toBe("high");
  // One second of heavy frames inside a good minute.
  expect(run(60, (i) => (i > 600 && i < 630 ? 40 : 16.7))).toEqual([]);
});

it("returns to a higher level after a long comfortable stretch, without bouncing", () => {
  const store = device();
  let now = 0;
  const { g, run } = governor("auto", "medium", store, () => now);
  expect(g.current()).toBe("medium");
  const seconds =
    (BATTLE_PROBE.warmup + BATTLE_PROBE.window * BATTLE_PROBE.fastWindows) /
      1000 +
    1;
  expect(run(seconds, 1000 / 60)).toEqual(["high"]);
  // High is too much after all: back down, and it stays down.
  const slow =
    (BATTLE_PROBE.window * (BATTLE_PROBE.slowWindows + 1)) / 1000 + 2;
  expect(run(slow, 33)).toEqual(["medium"]);
  expect(run(seconds * 3, 1000 / 60)).toEqual([]);
  expect(g.current()).toBe("medium");
  // Next session too: the device remembers it had to leave High...
  const next = governor("auto", null, store, () => now);
  expect(next.g.current()).toBe("medium");
  expect(next.run(seconds * 2, 1000 / 60)).toEqual([]);
  // ...for a week; then Auto tries High again.
  now += (BATTLE_PROBE.ceilingDays + 1) * 86_400_000;
  const later = governor("auto", "medium", store, () => now);
  expect(later.run(seconds, 1000 / 60)).toEqual(["high"]);
  // Picking Auto again in Settings forgets it at once.
  const fresh = governor("auto", null, store, () => now);
  fresh.run(slow + BATTLE_PROBE.warmup / 1000, 33);
  expect(fresh.g.current()).toBe("medium");
  fresh.g.reset(() => store.write(null));
  expect(fresh.g.current()).toBe("high");
});

it("does not call a window comfortable while it stutters", () => {
  // A 120 Hz phone: fast frames, but a hitch of 40 ms every half second
  // (about 8% of the time): not slow enough to step down, too jerky to
  // step up into.
  const { g, run } = governor("auto", "medium");
  expect(run(60, (i) => (i % 55 === 54 ? 40 : 1000 / 120))).toEqual([]);
  expect(g.current()).toBe("medium");
});

it("respects a manual High or Low and remembers nothing for them", () => {
  const high = governor("high", "low");
  expect(high.g.current()).toBe("high");
  expect(high.run(60, 50)).toEqual([]);
  expect(high.saved).toEqual([]);
  const low = governor("low");
  expect(low.g.current()).toBe("low");
  expect(low.run(60, 1000 / 60)).toEqual([]);
});

it("steps down for the stutter each skill causes on an older phone", () => {
  // 60 fps, but half a second of 25 fps after each skill, one every 2 s:
  // a quarter of the time stutters, though only an eighth of the frames.
  const stutter = (every: number, burst: number, slow: number) => {
    let t = 0,
      cast = -Infinity;
    return () => {
      if (t - cast >= every) cast = t;
      const step = t - cast < burst ? slow : 1000 / 60;
      t += step;
      return step;
    };
  };
  const phone = governor();
  const seconds =
    (BATTLE_PROBE.warmup + BATTLE_PROBE.window * BATTLE_PROBE.slowWindows) /
      1000 +
    1;
  expect(phone.run(seconds, stutter(2000, 500, 40))).toEqual(["medium"]);
  // A tenth of the time is enough (the reports' Android phone, at Low,
  // stuttered up to 18% of the time).
  const tenth = governor();
  expect(tenth.run(seconds, stutter(2000, 240, 40))).toEqual(["medium"]);
  // Skills that cost a frame or two now and then are fine.
  const fine = governor();
  expect(fine.run(60, stutter(2000, 60, 40))).toEqual([]);
  // So is a phone that holds 30 fps through its skills.
  const steady = governor();
  expect(steady.run(60, stutter(2000, 600, 33))).toEqual([]);
});

it("only trims decoration, and at Low draws fewer pixels", () => {
  for (const knobs of Object.values(BATTLE_QUALITY)) {
    expect(Object.keys(knobs).sort()).toEqual(
      [
        "density",
        "glowBudget",
        "mythicAmbient",
        "particles",
        "stillBackground",
        "trails",
      ].sort(),
    );
    expect(knobs.particles).toBeGreaterThan(0.3);
  }
  // High and Medium keep the screen's density (at most 2); Low draws at
  // most 1.5, as iPhones always do.
  expect(BATTLE_QUALITY.high.density).toBe(2);
  expect(BATTLE_QUALITY.medium.density).toBe(2);
  expect(BATTLE_QUALITY.low.density).toBe(1.5);
  // Only Low limits decorative glow light (warnings never shrink).
  expect(BATTLE_QUALITY.high.glowBudget).toBe(Infinity);
  expect(BATTLE_QUALITY.medium.glowBudget).toBe(Infinity);
  // Above one champion's heaviest cast (0.30 screens), so a duel at Low
  // never shrinks; below crowded fights' typical 0.66 screens.
  expect(BATTLE_QUALITY.low.glowBudget).toBeGreaterThan(0.45);
  expect(BATTLE_QUALITY.low.glowBudget).toBeLessThan(1);
});
