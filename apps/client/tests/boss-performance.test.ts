import { describe, expect, it } from "vitest";
import { createRaidArena } from "../../server/src/raid-bosses";
import { BossLife } from "../src/raid-boss-life";
import { bossSkinPoint, type BossWarp } from "../src/boss-soft-mesh";
const setup = () => {
  const arena = createRaidArena("ACT", "emberwing");
  arena.add("hero", "Hero");
  arena.start();
  arena.phase = "playing";
  const state = arena.snapshot(),
    boss = state.players.find((p) => p.raidBoss)!;
  state.raid!.warnings = [];
  return { state, boss, life: new BossLife() };
};
const warning = (id = 1) => ({
  id,
  kind: "flame-ring" as const,
  x: 800,
  y: 450,
  tx: 800,
  ty: 450,
  radius: 80,
  startedAt: 0,
  at: 1,
});
describe("boss attack performance", () => {
  it("gathers, commits one strike at the server deadline, then follows through", () => {
    const { state, boss, life } = setup();
    state.raid!.warnings = [warning()];
    state.time = 0.1;
    life.sample(state, boss, 0, false);
    state.time = 0.8;
    const gather = life.sample(state, boss, 0.05, false);
    expect(gather.action.gather).toBeGreaterThan(0.8);
    expect(gather.action.casts).toEqual([]);
    state.time = 1.01;
    state.raid!.warnings = [];
    const fire = life.sample(state, boss, 0.1, false);
    expect(fire.action.strike).toBe(1);
    expect(fire.action.casts).toHaveLength(1);
    state.time = 1.05;
    const recover = life.sample(state, boss, 0.15, false);
    expect(recover.action.strike).toBeLessThan(1);
    expect(recover.action.follow).toBeGreaterThan(0);
    expect(recover.action.casts).toHaveLength(1);
  });
  it.each(["removed", "staggered", "defeated"])(
    "does not fake a hit after a %s windup",
    (kind) => {
      const { state, boss, life } = setup();
      state.raid!.warnings = [warning()];
      state.time = 0.1;
      life.sample(state, boss, 0, false);
      state.time = 0.7;
      state.raid!.warnings = [];
      if (kind === "staggered") state.raid!.staggerUntil = 2;
      if (kind === "defeated") {
        state.raid!.result = "victory";
        boss.hp = 0;
      }
      life.sample(state, boss, 0.05, false);
      state.time = 1.1;
      expect(life.sample(state, boss, 0.1, false).action.casts).toEqual([]);
    },
  );
  it("ignores old warnings on reconnect and another twin's cast", () => {
    const { state, boss, life } = setup();
    state.time = 10;
    state.raid!.warnings = [
      { ...warning(), casterId: "another-twin" },
      warning(2),
    ];
    expect(life.sample(state, boss, 0, false).action.casts).toEqual([]);
    state.time = 10.1;
    state.raid!.warnings = [];
    expect(life.sample(state, boss, 0.05, false).action.casts).toEqual([]);
  });
  it("holds pose and impact age through a pause and resets on a retry", () => {
    const { state, boss, life } = setup();
    state.time = 0.1;
    state.raid!.warnings = [warning()];
    life.sample(state, boss, 0, false);
    state.time = 1.01;
    state.raid!.warnings = [];
    const impact = life.sample(state, boss, 0.05, false);
    state.phase = "paused";
    expect(life.sample(state, boss, 50, false)).toEqual(impact);
    state.phase = "playing";
    state.time = 1.1;
    const resumed = life.sample(state, boss, 50.02, false);
    expect(resumed.action.casts[0].age).toBeCloseTo(0.02);
    state.time = 0;
    expect(life.sample(state, boss, 50.04, false).action.casts).toEqual([]);
  });
  it("has no moving burst in reduced motion and never alters the snapshot", () => {
    const { state, boss, life } = setup();
    state.time = 0.8;
    state.raid!.warnings = [warning()];
    const before = JSON.stringify(state);
    const calm = life.sample(state, boss, 0, true);
    expect(calm.action.casts).toEqual([]);
    expect(calm.action.strike).toBe(0);
    expect(calm.move).toBe(0);
    expect(JSON.stringify(state)).toBe(before);
    state.time = 1.01;
    state.raid!.warnings = [];
    expect(life.sample(state, boss, 0.1, true).action.casts).toEqual([]);
  });
});
describe("continuous boss skin", () => {
  it.each(["x", "y"] as const)(
    "pins the entire %s joint while the tip flexes",
    (axis) => {
      const warp: BossWarp = { axis, bend: 0.13, flutter: 0.08, phase: 2.2 };
      for (const t of [0, 0.2, 0.5, 0.8, 1]) {
        const u = axis === "x" ? 0.85 : t,
          v = axis === "y" ? 0.15 : t;
        expect(bossSkinPoint(u, v, 0.85, 0.15, 400, 300, warp)).toEqual({
          x: (u - 0.85) * 400,
          y: (v - 0.15) * 300,
        });
      }
      const a = bossSkinPoint(0, 1, 0.85, 0.15, 400, 300, warp),
        b = bossSkinPoint(0, 1, 0.85, 0.15, 400, 300, { ...warp, phase: 3.1 });
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(10);
    },
  );
  it("does not invert a skin cell at the largest live tendril deformation", () => {
    for (let phase = 0; phase < 12; phase += 0.2)
      for (let y = 0; y < 6; y++)
        for (let x = 0; x < 6; x++) {
          const warp: BossWarp = {
            axis: "y",
            bend: 0.22,
            flutter: 0.065,
            phase,
          };
          const a = bossSkinPoint(x / 6, y / 6, 0.5, 0.06, 240, 400, warp),
            b = bossSkinPoint((x + 1) / 6, y / 6, 0.5, 0.06, 240, 400, warp),
            c = bossSkinPoint(x / 6, (y + 1) / 6, 0.5, 0.06, 240, 400, warp);
          const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
          expect(cross).toBeGreaterThan(0);
        }
  });
});
