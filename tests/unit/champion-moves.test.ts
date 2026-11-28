import { describe, expect, it } from "vitest";
import {
  ENTRANCES,
  SETTLED,
  VICTORIES,
  type Move,
  type MovePart,
  type MovePartName,
  type MoveStage,
} from "../../apps/client/src/animation/champion-moves";

/**
 * Each champion's own entrance and victory (champion-moves.ts) keeps the
 * rules written at the top of that file. The rig clamps the head and a
 * prop arm on top (rig.ts); these are the rules a move must keep itself.
 */
const PARTS: MovePartName[] = [
  "head",
  "body",
  "armL",
  "armR",
  "legL",
  "legR",
  "tail",
  "wings",
  "flame",
  "ears",
  "scarf",
];
function play(move: Move, t: number, calm = false, before = -1) {
  const p = Object.fromEntries(
    PARTS.map((name) => {
      const part: MovePart = {
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 0.5,
        scaleY: 0.5,
        setScale(x, y = x) {
          part.scaleX = x;
          part.scaleY = y;
        },
      };
      return [name, part];
    }),
  ) as Record<MovePartName, MovePart>;
  const out = { dx: 0, dy: 0, sx: 1, sy: 1, spin: 0, accents: 0, p };
  const stage: MoveStage = {
    t,
    calm,
    facing: "right",
    side: 1,
    p,
    move: (dx, dy) => {
      out.dx += dx;
      out.dy += dy;
    },
    squash: (x, y) => {
      out.sx *= x;
      out.sy *= y;
    },
    spin: (a) => {
      out.spin += a;
    },
    mood: () => {},
    shut: () => {},
    sway: (speed, phase = 0) => (calm ? 0 : Math.sin(t * speed + phase)),
    passed: (at) => !calm && before < at && t >= at,
    accent: (_kind, count) => {
      out.accents += count;
    },
  };
  move(stage);
  return out;
}
const numbers = (o: ReturnType<typeof play>) => [
  o.dx,
  o.dy,
  o.sx,
  o.sy,
  o.spin,
  ...PARTS.flatMap((n) => {
    const q = o.p[n];
    return [q.x, q.y, q.rotation, q.scaleX, q.scaleY];
  }),
];
const MOVES = [
  ...Object.entries(ENTRANCES).map(
    ([id, m]) => [`${id} entrance`, m!] as const,
  ),
  ...Object.entries(VICTORIES).map(([id, m]) => [`${id} victory`, m!] as const),
];

describe("champion moves", () => {
  it("has the pilot champions", () => {
    expect(Object.keys(ENTRANCES)).toEqual(Object.keys(VICTORIES));
    expect(MOVES.length).toBeGreaterThanOrEqual(6);
  });
  for (const [name, move] of MOVES) {
    it(`${name}: starts where the fighter stands, with finite numbers`, () => {
      const start = play(move, 0);
      expect(Math.abs(start.dx)).toBeLessThan(1.5);
      expect(Math.abs(start.dy)).toBeLessThan(1.5);
      for (let t = 0; t <= 8; t += 1 / 60)
        for (const n of numbers(play(move, t)))
          expect(Number.isFinite(n), `${name} at ${t.toFixed(2)}s`).toBe(true);
    });
    it(`${name}: never sinks below the ground or strays far`, () => {
      for (let t = 0; t <= 8; t += 1 / 60) {
        const o = play(move, t);
        expect(o.dy, `${name} at ${t.toFixed(2)}s`).toBeLessThanOrEqual(0.5);
        expect(Math.abs(o.dx)).toBeLessThanOrEqual(40);
        expect(o.dy).toBeGreaterThanOrEqual(-60);
      }
    });
    it(`${name}: the head never lifts off the neck`, () => {
      for (let t = 0; t <= 8; t += 1 / 60)
        expect(
          play(move, t).p.head.y,
          `${name} at ${t.toFixed(2)}s`,
        ).toBeGreaterThanOrEqual(-0.01);
    });
    it(`${name}: settles into a held pose that is still under Reduce motion`, () => {
      const a = numbers(play(move, SETTLED, true)),
        b = numbers(play(move, SETTLED + 0.37, true));
      a.forEach((v, i) => expect(b[i]).toBeCloseTo(v, 6));
      // Calm: no one-off particles.
      expect(play(move, SETTLED, true).accents).toBe(0);
    });
    it(`${name}: at most a few particles`, () => {
      let total = 0,
        last = -1;
      for (let t = 0; t <= 8; t += 1 / 60) {
        total += play(move, t, false, last).accents;
        last = t;
      }
      expect(total).toBeLessThanOrEqual(16);
    });
  }
});
