import { describe, expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation.js";
import {
  advanceMovement,
  blankInput,
  RULES,
  type MovementContext,
} from "../../packages/shared/src/index.js";
import { predictFighter } from "../../apps/client/src/predict-fighter.js";

describe("client fighter prediction", () => {
  it("matches authoritative movement for the same arena context", () => {
    const room = new Arena("PARITY");
    const p = room.add("one", "One");
    const predicted = structuredClone(p);
    const context: MovementContext = {
      obstacles: [{ x: 400, y: 380, w: 70, h: 140 }],
      speedScale: 1.6,
    };
    const input = {
      ...blankInput(),
      seq: 1,
      dx: 1,
      dy: 0.25,
      aimX: 800,
      aimY: 450,
    };
    for (let i = 0; i < 80; i++) {
      const time = (i + 1) / RULES.tick;
      advanceMovement(p, input, 1 / RULES.tick, time, context);
      predictFighter(predicted, input, time, false, context);
      expect(predicted.x).toBeCloseTo(p.x, 8);
      expect(predicted.y).toBeCloseTo(p.y, 8);
      expect(predicted.vx).toBeCloseTo(p.vx, 8);
      expect(predicted.vy).toBeCloseTo(p.vy, 8);
    }
  });
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
