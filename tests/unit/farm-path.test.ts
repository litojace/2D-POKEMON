import { describe, expect, it } from "vitest";
import {
  DOG_SPOTS,
  blocked,
  clearLine,
  dogRoute,
  gateOf,
  inField,
  walkPath,
  type PathWorld,
  type Point,
} from "../../apps/client/src/farm/farm-path";

// The farm's layout (farm-scene.ts): a 10×5 field of 96×62 plots from (360, 380).
const OX = 360,
  OY = 380,
  FW = 10 * 96 + 9 * 10,
  FH = 5 * 62 + 4 * 10;
const world = (extra: Partial<PathWorld> = {}): PathWorld => ({
  field: { x0: OX - 36, x1: OX + FW + 36, y0: OY - 32, y1: OY + FH + 30 },
  pasture: { x0: 1480, x1: 1720, y0: 420, y1: 664 },
  pond: { x: 250, y: 990, rx: 150, ry: 56 },
  well: { x: 150, y: 700 },
  doghouse: { x: 1600, y: 810 },
  scarecrow: null,
  decor: [],
  gateX: OX + FW / 2,
  width: 1760,
  height: 1080,
  ...extra,
});
/** Every point along the route, 2 px apart, from `from`. */
const along = (from: Point, path: Point[]) => {
  const out: Point[] = [];
  let a = from;
  for (const b of path) {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
    for (let k = 1; k <= n; k++)
      out.push([
        a[0] + ((b[0] - a[0]) * k) / n,
        a[1] + ((b[1] - a[1]) * k) / n,
      ]);
    a = b;
  }
  return out;
};

describe("where farm animals can walk", () => {
  const w = world();
  it("keeps them off the field, the pasture, the pond, the well and the doghouse", () => {
    expect(blocked(w, OX + 100, OY + 100)).toBe(true);
    expect(blocked(w, OX + 100, OY + 100, true)).toBe(false);
    expect(blocked(w, 1600, 540)).toBe(true);
    expect(blocked(w, 250, 990)).toBe(true);
    expect(blocked(w, 150, 700)).toBe(true);
    expect(blocked(w, 1600, 800)).toBe(true);
    expect(blocked(w, 1100, 900)).toBe(false);
  });
  it("adds the scarecrow and placed decorations", () => {
    expect(blocked(w, 288, 562)).toBe(false);
    expect(blocked(world({ scarecrow: [288, 562] }), 288, 562)).toBe(true);
    expect(blocked(w, 900, 960)).toBe(false);
    expect(blocked(world({ decor: [[900, 960]] }), 900, 960)).toBe(true);
  });
  it("has free spots for the dog to sit", () => {
    const free = DOG_SPOTS.filter(([x, y]) => !blocked(w, x, y));
    expect(free.length).toBeGreaterThanOrEqual(8);
  });
});

describe("the guard dog's routes", () => {
  const w = world({ decor: [[1100, 840]], scarecrow: [288, 562] });
  const outside: Point[] = [
    [1520, 860],
    [460, 830],
    [250, 780],
    [900, 960],
    [100, 900],
    [1700, 1000],
    [620, 940],
  ];
  it("walks around obstacles, never through them", () => {
    for (const a of outside)
      for (const b of outside) {
        if (a === b) continue;
        const path = walkPath(w, a, b);
        expect(path.at(-1)).toEqual(b);
        for (const [x, y] of along(a, path))
          expect(blocked(w, x, y), `${a} → ${b} at ${x},${y}`).toBe(false);
      }
  });
  it("goes around the pond rather than across it", () => {
    // Just left and just right of the pond.
    const a: Point = [40, 990],
      b: Point = [470, 990];
    expect(blocked(w, ...a)).toBe(false);
    expect(blocked(w, ...b)).toBe(false);
    expect(clearLine(w, a, b)).toBe(false);
    const path = walkPath(w, a, b);
    expect(path.length).toBeGreaterThan(1);
    for (const [x, y] of along(a, path)) expect(blocked(w, x, y)).toBe(false);
  });
  it("enters and leaves the field only through the gate", () => {
    const g = gateOf(w),
      plot: Point = [OX + 96 * 2 + 48, OY + 62 + 66];
    const check = (from: Point, path: Point[]) => {
      const pts = along(from, path);
      for (let k = 1; k < pts.length; k++) {
        const was = inField(w, ...pts[k - 1]),
          is = inField(w, ...pts[k]);
        // Crossing the fence line: only in the gate's gap.
        if (was !== is) expect(Math.abs(pts[k][0] - g.out[0])).toBeLessThan(42);
      }
    };
    for (const from of outside) {
      const inn = dogRoute(w, from, plot, true);
      expect(inn.at(-1)).toEqual(plot);
      check(from, inn);
      const out = dogRoute(w, plot, from, false);
      expect(out.at(-1)).toEqual(from);
      check(plot, out);
    }
  });
  it("steps out of the doghouse first", () => {
    const path = dogRoute(w, [1600, 800], [460, 830], false);
    expect(path[0]).toEqual([1520, 844]);
    for (const [x, y] of along(path[0], path.slice(1)))
      expect(blocked(w, x, y)).toBe(false);
  });
});
