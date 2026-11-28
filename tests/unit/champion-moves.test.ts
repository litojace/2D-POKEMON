import { describe, expect, it } from "vitest";
import {
  ENTRANCES,
  MAX_TURN,
  MIN_WIDTH,
  SETTLED,
  VICTORIES,
  keepHeadRigid,
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
    fade: () => {},
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
    it(`${name}: leans, never spins (the art is flat)`, () => {
      for (let t = 0; t <= 8; t += 1 / 60) {
        const o = play(move, t);
        expect(
          Math.abs(o.spin),
          `${name} at ${t.toFixed(2)}s`,
        ).toBeLessThanOrEqual(MAX_TURN);
        expect(o.sx, `${name} at ${t.toFixed(2)}s`).toBeGreaterThanOrEqual(
          MIN_WIDTH,
        );
      }
    });
    it(`${name}: never scales the head (the face keeps its shape)`, () => {
      for (let t = 0; t <= 8; t += 1 / 60) {
        const head = play(move, t).p.head;
        expect(
          [head.scaleX, head.scaleY],
          `${name} at ${t.toFixed(2)}s`,
        ).toEqual([0.5, 0.5]);
      }
    });
    it(`${name}: the legs move, and settle still under Reduce motion`, () => {
      let most = 0;
      for (let t = 0; t <= 3; t += 1 / 60) {
        const { legL, legR } = play(move, t).p;
        most = Math.max(
          most,
          Math.abs(legL.rotation) + Math.abs(legL.y) / 10,
          Math.abs(legR.rotation) + Math.abs(legR.y) / 10,
        );
      }
      expect(most, name).toBeGreaterThan(0.25);
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
  it("keeps the head its own size while the body squashes", () => {
    const part = (x: number, y: number) => {
      const q: MovePart = {
        x,
        y,
        rotation: 0.1,
        scaleX: 0.5,
        scaleY: 0.5,
        setScale(a, b = a) {
          q.scaleX = a;
          q.scaleY = b;
        },
      };
      return q;
    };
    const head = part(0, -20),
      eyes = part(3, -32);
    const [sx, sy] = [1.2, 0.74];
    keepHeadRigid([head, eyes], { x: head.x, y: head.y }, sx, sy);
    // On screen (the fighter is scaled by sx, sy) each part is its own size,
    for (const q of [head, eyes]) {
      expect(q.scaleX * sx).toBeCloseTo(0.5, 9);
      expect(q.scaleY * sy).toBeCloseTo(0.5, 9);
    }
    // the eyes sit where they sat on the head, and the neck rides the body.
    expect((eyes.x - head.x) * sx).toBeCloseTo(3, 9);
    expect((eyes.y - head.y) * sy).toBeCloseTo(-12, 9);
    expect([head.x, head.y]).toEqual([0, -20]);
  });
});
