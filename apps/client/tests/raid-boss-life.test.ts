import { describe, expect, it } from "vitest";
import { createRaidArena } from "../../server/src/raid-bosses";
import { BossLife } from "../src/raid-boss-life";
import { drawRaidBoss } from "../src/raid-boss-art";
import { drawTidewyrm } from "../src/raid-tidewyrm-art";
import { drawGloomshade } from "../src/raid-gloomshade-art";
import { drawSomnara } from "../src/raid-somnara-art";
import { drawPrismatail } from "../src/raid-prismatail-art";
import { drawEmberwing } from "../src/raid-emberwing-art";
import { drawStormTwins } from "../src/raid-storm-twins-art";
import type { RaidBossId } from "../../../packages/shared/src/raid";
const setup = (id: RaidBossId = "grumblecrag") => {
  const a = createRaidArena("ART", id);
  a.add("hero", "Hero");
  a.start();
  a.phase = "playing";
  a.raid.gilded = false;
  return { a, state: a.snapshot(), boss: a.boss()! };
};
describe("cosmetic boss clock", () => {
  it("is continuous across snapshots and phases, caps catch-up and resets on retry", () => {
    const { state, boss } = setup();
    const life = new BossLife();
    expect(life.sample(state, boss, 100, false).time).toBe(0);
    expect(life.sample(state, boss, 100.04, false).time).toBeCloseTo(0.04);
    state.raid!.phase = 2;
    expect(life.sample(state, boss, 100.08, false).time).toBeCloseTo(0.08);
    expect(life.sample(state, boss, 1000, false).time).toBeCloseTo(0.13);
    state.raid!.result = "victory";
    life.sample(state, boss, 1000.02, false);
    state.raid!.result = null;
    expect(life.sample(state, boss, 1000.04, false).time).toBe(0);
  });
  it("holds a casting pose through a pause and resumes without a leap", () => {
    const { state, boss } = setup();
    state.time = 0.7;
    state.raid!.warnings = [
      {
        id: 1,
        kind: "slam",
        startedAt: 0,
        at: 1,
        x: 800,
        y: 450,
        tx: 800,
        ty: 450,
        radius: 200,
      },
    ];
    const life = new BossLife();
    life.sample(state, boss, 0, false);
    const before = life.sample(state, boss, 0.04, false);
    state.phase = "paused";
    expect(life.sample(state, boss, 30, false)).toEqual(before);
    state.phase = "playing";
    expect(life.sample(state, boss, 30.02, false).time).toBeCloseTo(0.06);
  });
  it("uses only the relevant live telegraph and preserves the snapshot", () => {
    const { state, boss } = setup("storm-twins");
    state.time = 0.75;
    const base = {
      x: 800,
      y: 450,
      tx: 800,
      ty: 450,
      radius: 200,
      kind: "slam" as const,
      startedAt: 0,
      at: 1,
    };
    state.raid!.warnings = [
      { ...base, id: 1, casterId: "other-twin" },
      { ...base, id: 2, startedAt: 2, at: 3 },
      { ...base, id: 3, at: 0.5 },
    ];
    const life = new BossLife();
    expect(life.sample(state, boss, 0, false).windup).toBe(0);
    state.raid!.warnings.push({ ...base, id: 4, casterId: boss.id });
    const original = JSON.stringify(state);
    expect(life.sample(state, boss, 0.03, false).windup).toBe(0.75);
    expect(JSON.stringify(state)).toBe(original);
  });
  it("smooths gaze without spinning, blinks briefly, and supplies a static reduced-motion pose", () => {
    const { state, boss } = setup();
    const life = new BossLife();
    boss.angle = 0;
    life.sample(state, boss, 0, false);
    boss.angle = Math.PI;
    const turn = life.sample(state, boss, 0.02, false);
    expect(turn.lookX).toBeGreaterThan(-1);
    expect(turn.lookX).toBeLessThan(1);
    let blinkFrames = 0;
    for (let n = 1; n < 800; n++) {
      const p = life.sample(state, boss, n * 0.02, false);
      expect(p.blink).toBeGreaterThanOrEqual(0);
      expect(p.blink).toBeLessThanOrEqual(1);
      if (p.blink > 0) blinkFrames++;
    }
    expect(blinkFrames).toBeGreaterThan(0);
    expect(blinkFrames).toBeLessThan(70);
    const calm = life.sample(state, boss, 20, true);
    expect(calm).toMatchObject({
      time: 0,
      breath: 0,
      sway: 0,
      blink: 0,
      move: 0,
    });
    expect(life.sample(state, boss, 30, true)).toEqual(calm);
  });
});
const painters = [
  ["grumblecrag", drawRaidBoss],
  ["tidewyrm", drawTidewyrm],
  ["gloomshade", drawGloomshade],
  ["somnara", drawSomnara],
  ["prismatail", drawPrismatail],
  ["emberwing", drawEmberwing],
  ["storm-twins", drawStormTwins],
] as const;
const graphics = () => {
  let commands: [string, unknown[]][] = [];
  const g: any = new Proxy(
    {},
    {
      get: (_t, key) =>
        key === "then"
          ? undefined
          : (...args: unknown[]) => {
              commands.push([String(key), args]);
              return g;
            },
    },
  );
  return {
    g,
    flush: () => {
      const result = commands;
      commands = [];
      return result;
    },
  };
};
describe.each(painters)("%s body renderer", (id, draw) => {
  it("animates articulated parts without changing the world and freezes during a pause", () => {
    const { state } = setup(id),
      { g, flush } = graphics();
    const original = JSON.stringify(state);
    draw(g, state, false, 0);
    const first = flush();
    for (let n = 1; n <= 40; n++) {
      draw(g, state, false, n * 0.025);
      flush();
    }
    draw(g, state, false, 1.025);
    const moved = flush();
    expect(moved).not.toEqual(first);
    state.phase = "paused";
    draw(g, state, false, 2);
    flush();
    draw(g, state, false, 3);
    const paused = flush();
    draw(g, state, false, 4);
    expect(flush()).toEqual(paused);
    state.phase = "playing";
    expect(JSON.stringify(state)).toBe(original);
    expect(moved.filter((c) => c[0] === "save").length).toBe(
      moved.filter((c) => c[0] === "restore").length,
    );
  });
  it.each([false, true])(
    "has finite geometry and a static reduced-motion fallback (defeated=%s)",
    (dead) => {
      const { state } = setup(id);
      if (dead) {
        state.raid!.result = "victory";
        state.phase = "finished";
        for (const p of state.players) if (p.raidBoss) p.hp = 0;
      }
      const { g, flush } = graphics();
      draw(g, state, true, 0);
      flush();
      draw(g, state, true, 0.03);
      const first = flush();
      draw(g, state, true, 10);
      const next = flush();
      expect(next).toEqual(first);
      for (const [method, args] of next) {
        for (const n of args)
          if (typeof n === "number")
            expect(Number.isFinite(n), method).toBe(true);
        if (method === "fillEllipse")
          expect(
            args.slice(2).every((n) => Number(n) >= 0),
            method,
          ).toBe(true);
      }
    },
  );
});

it("holds Grumblecrag's charge stance when the room pauses", () => {
  const { state } = setup();
  const { g, flush } = graphics();
  drawRaidBoss(g, state, false, 0);
  flush();
  state.time += 0.05;
  state.players.find((p) => p.raidBoss)!.x += 20;
  drawRaidBoss(g, state, false, 0.05);
  const moving = flush();
  state.phase = "paused";
  drawRaidBoss(g, state, false, 10);
  expect(flush()).toEqual(moving);
});
