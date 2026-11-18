import { describe, expect, it } from "vitest";
import {
  PLAZA_FOUNTAIN,
  PLAZA_HOUSES,
  PLAZA_POND,
  plazaBody,
  plazaStep,
} from "../../packages/shared/src/plaza";
import {
  pathGridStats,
  plazaPath,
  standable,
} from "../../apps/client/src/plaza/plaza-path";

type P = { x: number; y: number };
/**
 * Walk as the Plaza does after a click: the shared movement step (the
 * server's own), steering at each point of the way in turn. Straight
 * (`smart` false) is how a click walked before: right at the spot.
 */
function walk(from: P, to: P, smart: boolean, seconds = 30) {
  const b = plazaBody(from.x, from.y);
  const way = smart ? plazaPath(from, to) : [to];
  let trips = 0;
  for (let t = 0; t < seconds && way.length; t += 1 / 30) {
    const at = way[0],
      dx = at.x - b.x,
      dy = at.y - b.y,
      d = Math.hypot(dx, dy);
    if (d < (way.length > 1 ? 18 : 10)) {
      way.shift();
      continue;
    }
    if (plazaStep(b, { x: dx / d, y: dy / d }, 1 / 30).tripped) trips++;
  }
  return {
    at: { x: b.x, y: b.y },
    left: Math.hypot(b.x - to.x, b.y - to.y),
    trips,
  };
}

describe("Plaza: a click finds its way", () => {
  it("the grid follows the server's collision", () => {
    const g = pathGridStats();
    expect(g.free).toBeGreaterThan(g.cols * g.rows * 0.5);
    expect(standable(PLAZA_POND.x, PLAZA_POND.y)).toBe(false);
    expect(standable(PLAZA_FOUNTAIN.x, PLAZA_FOUNTAIN.y)).toBe(false);
    expect(standable(1350, 1090)).toBe(true);
  });

  const trips: [string, P, P][] = [
    [
      "across the pond",
      { x: PLAZA_POND.x - PLAZA_POND.rx - 60, y: PLAZA_POND.y },
      { x: PLAZA_POND.x + PLAZA_POND.rx + 60, y: PLAZA_POND.y },
    ],
    [
      "through the fountain",
      { x: PLAZA_FOUNTAIN.x, y: PLAZA_FOUNTAIN.y + 140 },
      { x: PLAZA_FOUNTAIN.x, y: PLAZA_FOUNTAIN.y - 140 },
    ],
    [
      "behind a house",
      { x: PLAZA_HOUSES[1].x + 14, y: PLAZA_HOUSES[1].y + 40 },
      { x: PLAZA_HOUSES[1].x + 14, y: PLAZA_HOUSES[1].y - 150 },
    ],
  ];
  for (const [name, from, to] of trips)
    it(`gets there ${name}, where walking straight got stuck`, () => {
      expect(standable(from.x, from.y), "start").toBe(true);
      expect(standable(to.x, to.y), "goal").toBe(true);
      expect(walk(from, to, false).left, "straight").toBeGreaterThan(60);
      const r = walk(from, to, true);
      expect(r.left).toBeLessThan(12);
    });

  it("goes round the hurdles rather than tripping over them", () => {
    // From outside the dash track's east side to its infield, past the -30° hurdle.
    const from = { x: 990, y: 760 },
      to = { x: 640, y: 900 };
    const r = walk(from, to, true);
    expect(r.left).toBeLessThan(12);
    expect(r.trips).toBe(0);
  });

  it("a click on something you can't stand on walks to the nearest spot", () => {
    const way = plazaPath(
      { x: PLAZA_POND.x - PLAZA_POND.rx - 60, y: PLAZA_POND.y },
      PLAZA_POND,
    );
    expect(way.length).toBeGreaterThan(0);
    const end = way[way.length - 1];
    expect(standable(end.x, end.y)).toBe(true);
    expect(Math.hypot(end.x - PLAZA_POND.x, end.y - PLAZA_POND.y)).toBeLessThan(
      PLAZA_POND.rx + 40,
    );
  });

  it("is quick enough for a click", () => {
    plazaPath({ x: 100, y: 200 }, { x: 2600, y: 1550 });
    const t0 = performance.now();
    for (let i = 0; i < 10; i++)
      plazaPath({ x: 100, y: 200 }, { x: 2600, y: 1550 });
    expect((performance.now() - t0) / 10).toBeLessThan(40);
  });
});
