import { describe, expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation.js";
import {
  blankInput,
  RULES,
  type MovementContext,
} from "../../packages/shared/src/index.js";
import { predictFighter } from "../../apps/client/src/predict-fighter.js";

describe("client fighter prediction", () => {
  it("uses room-specific obstacles and speed settings", () => {
    const room = new Arena("CTX001");
    room.add("one", "One");
    const p = room.players[0];
    const q = structuredClone(p);
    const input = {
      ...blankInput(),
      seq: 1,
      dx: 1,
      aimX: p.x + 200,
      aimY: p.y,
    };
    const wall = [
      { x: p.x + 40, y: p.y - 60, w: 80, h: 120 },
    ];
    const standard: MovementContext = {
      obstacles: wall,
      speedScale: 1,
    };
    const accelerated: MovementContext = {
      obstacles: [],
      speedScale: 1.5,
    };

    for (let i = 0; i < 60; i++) {
      const time = i / RULES.tick;
      predictFighter(p, input, time, false, standard);
      predictFighter(q, input, time, false, accelerated);
    }

    expect(p.x).toBeLessThan(wall[0].x);
    expect(p.x).toBeLessThan(q.x);
  });
});
