import { describe, expect, it } from "vitest";
import { createRaidArena } from "../../server/src/raid-bosses";
import { BossFacing, bossView } from "../src/boss-facing";
import { BossLife } from "../src/raid-boss-life";
import {
  BOSS_DIRECTIONS,
  bossDirectionalFrame,
  type BossArtMode,
} from "../src/boss-directions";
import type { RaidBossId } from "../../../packages/shared/src/raid-roster";
const setup = () => {
  const arena = createRaidArena("TURN", "emberwing");
  arena.add("hero", "Hero");
  arena.start();
  arena.phase = "playing";
  const state = arena.snapshot(),
    boss = state.players.find((p) => p.raidBoss)!;
  boss.angle = Math.PI / 2;
  const facing = new BossFacing();
  facing.reset(boss, state.time);
  return { state, boss, facing };
};
describe("boss heading", () => {
  it.each([
    [0, 1, "front"],
    [0, -1, "back"],
    [-1, 0, "left"],
    [1, 0, "right"],
  ] as const)("maps screen-space (%s,%s) to %s", (x, y, view) =>
    expect(bossView(x, y)).toBe(view),
  );
  it("holds the previous view near a diagonal and has a zero-vector fallback", () => {
    expect(bossView(1, -1.01, "right")).toBe("right");
    expect(bossView(1, -1.5, "right")).toBe("back");
    expect(bossView(0, 0, "left")).toBe("left");
    expect(bossView(0, 0)).toBe("front");
  });
  it("travels away with its back visible, then aims the whole body for a cast", () => {
    const { state, boss, facing } = setup();
    state.time += 0.1;
    boss.y -= 8;
    expect(facing.sample(state, boss, false)).toBe("back");
    state.time += 0.2;
    expect(facing.sample(state, boss, true)).toBe("front");
  });
  it("does not flicker on repeated render frames or a short turn boundary", () => {
    const { state, boss, facing } = setup();
    state.time += 0.1;
    boss.x += 8;
    expect(facing.sample(state, boss, false)).toBe("right");
    for (let i = 0; i < 20; i++)
      expect(facing.sample(state, boss, false)).toBe("right");
    state.time += 0.03;
    boss.y -= 8;
    expect(facing.sample(state, boss, false)).toBe("right");
    state.time += 0.1;
    boss.y -= 8;
    expect(facing.sample(state, boss, false)).toBe("back");
  });
  it("freezes in pause/death, ignores teleports, and resets for a new run", () => {
    const { state, boss, facing } = setup();
    state.phase = "paused";
    boss.angle = Math.PI;
    state.time += 2;
    expect(facing.sample(state, boss, true)).toBe("front");
    state.phase = "playing";
    boss.hp = 0;
    expect(facing.sample(state, boss, true)).toBe("front");
    boss.hp = 100;
    boss.angle = 0;
    boss.y -= 400;
    state.time += 0.1;
    expect(facing.sample(state, boss, false)).toBe("right");
    boss.angle = -Math.PI / 2;
    facing.reset(boss, 0);
    state.time = 0;
    expect(facing.sample(state, boss, false)).toBe("back");
  });
  it("keeps the heading informational in reduced motion without changing combat state", () => {
    const { state, boss } = setup(),
      life = new BossLife();
    life.sample(state, boss, 0, true);
    boss.x -= 10;
    state.time += 0.1;
    const before = JSON.stringify(state);
    expect(life.sample(state, boss, 0.1, true).view).toBe("left");
    expect(JSON.stringify(state)).toBe(before);
  });
});
it("faces the real locked cone even while the server's body angle steers elsewhere", () => {
  const { state, boss, facing } = setup();
  boss.angle = 0;
  state.time = 0.2;
  state.raid!.warnings = [
    {
      id: 1,
      kind: "wing-gust",
      startedAt: 0,
      at: 1,
      x: boss.x,
      y: boss.y,
      tx: boss.x,
      ty: boss.y - 200,
      radius: 400,
      spread: 0.6,
    },
  ];
  const before = JSON.stringify(state);
  expect(facing.sample(state, boss, true)).toBe("back");
  expect(JSON.stringify(state)).toBe(before);
  state.time = 1.1;
  state.raid!.warnings = [];
  expect(facing.sample(state, boss, true)).toBe("back");
  state.time = 1.5;
  expect(facing.sample(state, boss, false)).toBe("right");
});

describe("whole-creature directional artwork", () => {
  it.each(Object.keys(BOSS_DIRECTIONS) as RaidBossId[])(
    "has all animated directions for %s",
    (id) => {
      const data = BOSS_DIRECTIONS[id];
      expect(data.size[0]).toBeLessThanOrEqual(4096);
      expect(data.size[1]).toBeLessThanOrEqual(4096);
      for (const mode of Object.keys(data.modes) as BossArtMode[])
        for (const view of ["front", "back", "left", "right"] as const)
          for (let action = 0; action < 4; action++) {
            const f = bossDirectionalFrame(id, mode, view, action);
            expect(f.view).toBe(view);
            expect(f.pose).toBeDefined();
            expect(f.pose.scale).toBeGreaterThan(0);
            expect(f.pose.anchor.every(Number.isFinite)).toBe(true);
            expect(f.pose.core.every(Number.isFinite)).toBe(true);
            expect(f.pose.rect[2]).toBeGreaterThan(100);
            expect(f.pose.rect[3]).toBeGreaterThan(100);
            if (mode !== "stranded")
              expect(data.modes[mode]![view].poses).toHaveLength(4);
          }
    },
  );
  it("never substitutes a frontal phoenix for its rear or side while flying or grounded", () => {
    for (const mode of ["body", "ground"] as const)
      for (let action = 0; action < 4; action++) {
        const front = bossDirectionalFrame("emberwing", mode, "front", action);
        const back = bossDirectionalFrame("emberwing", mode, "back", action);
        const right = bossDirectionalFrame("emberwing", mode, "right", action);
        const left = bossDirectionalFrame("emberwing", mode, "left", action);
        expect(back.atlas).toBe("directions");
        expect(right.atlas).toBe("directions");
        expect(back.signature).not.toBe(front.signature);
        expect(right.index).not.toBe(back.index);
        expect(left.index).toBe(right.index);
        expect(left.flip).not.toBe(right.flip);
      }
  });
});
