import { describe, expect, it } from "vitest";
import {
  CROWD,
  FRONTS,
  ROAD0,
  ROAD1,
  ZEBRA_HALF,
  canal,
  makeStreet,
  plaza,
  routes,
  bikeRoutes,
  seasonOf,
  stopY,
  BUS_LEN,
  updateStreet,
  zebraY,
} from "../../apps/client/src/bistro/bistro-town";
import { buildings } from "../../apps/client/src/bistro/bistro-city";
import {
  coversMovers,
  moverSamples,
  props,
  trees,
  hidesRoom,
} from "../../apps/client/src/bistro/bistro-props";
import { R, setRoomSize } from "../../apps/client/src/bistro/bistro-art";

/** A repeatable random sequence. */
const seeded =
  (seed = 1) =>
  () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
const SIZES = [
  { cols: 11, rows: 9 },
  { cols: 13, rows: 10 },
  { cols: 15, rows: 11 },
];
const inRoad = (x: number) => x > ROAD0 + 0.05 && x < ROAD1 - 0.05;

describe("bistro town: the season comes from the server's day", () => {
  it("northern seasons by month", () => {
    expect(seasonOf("2026-03-01")).toBe("spring");
    expect(seasonOf("2026-05-31")).toBe("spring");
    expect(seasonOf("2026-06-01")).toBe("summer");
    expect(seasonOf("2026-08-31")).toBe("summer");
    expect(seasonOf("2026-09-01")).toBe("autumn");
    expect(seasonOf("2026-11-17")).toBe("autumn");
    expect(seasonOf("2026-12-01")).toBe("winter");
    expect(seasonOf("2027-02-28")).toBe("winter");
  });
});

describe("bistro town: the layout", () => {
  it("shops stand across the road, never over the canal; the square and the stop clear of everything", () => {
    for (const size of SIZES) {
      setRoomSize(size);
      const c = canal();
      const shops = buildings().filter((b) => b.kind === "shop");
      expect(shops.length).toBeGreaterThan(8);
      for (const b of buildings())
        expect(b.y1 <= c.y0 || b.y0 >= c.y1).toBe(true);
      for (const s of shops) expect(s.x1).toBeLessThanOrEqual(FRONTS);
      expect(c.y0).toBeGreaterThan(R.rows + 1.6);
      const P = plaza();
      expect(P.x - P.r).toBeGreaterThan(R.cols + 1.4);
      // The bus stops before the bridge.
      expect(stopY() + BUS_LEN / 2).toBeLessThan(c.y0);
    }
    setRoomSize({ cols: 11, rows: 9 });
  });
  it("people keep to sidewalks and paths, crossing the road only at the zebra", () => {
    for (const r of [...routes().map((r) => r.pts), ...bikeRoutes()])
      for (let i = 1; i < r.length; i++) {
        const [ax, ay] = r[i - 1],
          [bx, by] = r[i];
        for (let u = 0; u <= 1; u += 0.02) {
          const x = ax + (bx - ax) * u,
            y = ay + (by - ay) * u;
          if (inRoad(x))
            expect(Math.abs(y - zebraY())).toBeLessThan(ZEBRA_HALF);
        }
      }
  });
  it("nobody walks through a lamp, a tree, a bench or a building", () => {
    for (const size of SIZES) {
      setRoomSize(size);
      // Benches are sat on, the shelter waited in, the footbridge walked over.
      const solid = props().filter(
        (p) =>
          !p.id.startsWith("bench") &&
          p.id !== "shelter" &&
          p.id !== "foot" &&
          !p.id.startsWith("fr"),
      );
      for (const s of moverSamples()) {
        if (s.h > 120 || s.h === 96) continue; // the road's vehicles
        const x = (s.x0 + s.x1) / 2,
          y = (s.y0 + s.y1) / 2;
        for (const p of solid) {
          const inside =
            x > p.x0 + 0.05 &&
            x < p.x1 - 0.05 &&
            y > p.y0 + 0.05 &&
            y < p.y1 - 0.05;
          if (inside)
            throw new Error(
              `a path at ${x.toFixed(2)},${y.toFixed(2)} runs through ${p.id}`,
            );
        }
      }
    }
    setRoomSize({ cols: 11, rows: 9 });
  });
  it("no building is ever in front of anything moving (they are baked under it)", () => {
    for (const size of SIZES) {
      setRoomSize(size);
      const samples = moverSamples();
      for (const p of props().filter((q) => q.building || q.bake))
        if (p.id !== "foot") expect(coversMovers(p, samples), p.id).toBe(false);
    }
    setRoomSize({ cols: 11, rows: 9 });
  });
  it("no tree stands in front of the bistro hiding it", () => {
    for (const size of SIZES) {
      setRoomSize(size);
      for (const [x, y, s] of trees()) expect(hidesRoom(x, y, s)).toBe(false);
    }
    setRoomSize({ cols: 11, rows: 9 });
  });
});

describe("bistro town: the street moves", () => {
  it("fewer people, bikes and pigeons on Low graphics", () => {
    const high = makeStreet(["voltkit", "emberpup"], false, seeded(3));
    const low = makeStreet(["voltkit", "emberpup"], true, seeded(3));
    const people = (s: typeof high) =>
      s.folk.filter((f) => f.kind !== "wait").length;
    expect(people(low)).toBeLessThan(people(high));
    expect(low.pigeons.length).toBe(CROWD.low.pigeons);
    expect(high.pigeons.length).toBe(CROWD.high.pigeons);
    for (let i = 0; i < 3000; i++) {
      updateStreet(high, 0.1);
      updateStreet(low, 0.1);
      const walkers = (s: typeof high) =>
        s.folk.filter((f) => f.kind === "walk" || f.kind === "dog").length;
      expect(walkers(high)).toBeLessThanOrEqual(CROWD.high.walkers + 2);
      expect(walkers(low)).toBeLessThanOrEqual(CROWD.low.walkers + 2);
    }
    expect(people(high)).toBeGreaterThan(0);
  });
  it("walkers wait at the curb while the road is busy, and cross when it is clear", () => {
    const s = makeStreet(["voltkit"], false, seeded(11));
    let busy = true,
      held = 0,
      crossed = 0;
    for (let i = 0; i < 6000; i++) {
      busy = Math.floor(i / 200) % 2 === 0;
      updateStreet(s, 0.05, () => !busy);
      for (const f of s.folk) {
        if (f.held) held++;
        if (inRoad(f.x)) {
          crossed++;
          expect(Math.abs(f.y - zebraY())).toBeLessThan(ZEBRA_HALF);
        }
      }
      if (busy && !s.crossing)
        for (const f of s.folk) expect(inRoad(f.x)).toBe(false);
    }
    expect(held).toBeGreaterThan(0);
    expect(crossed).toBeGreaterThan(0);
  });
  it("the bus stops at its stop, leaves, and comes back", () => {
    const s = makeStreet(["voltkit"], true, seeded(5));
    expect(s.bus.state).toBe("stop");
    const seen = new Set<string>();
    let stops = 0,
      was = s.bus.state;
    for (let i = 0; i < 4000; i++) {
      updateStreet(s, 0.05);
      seen.add(s.bus.state);
      if (s.bus.state === "stop" && was !== "stop") {
        stops++;
        expect(Math.abs(s.bus.y - stopY())).toBeLessThan(0.02);
      }
      was = s.bus.state;
    }
    expect([...seen].sort()).toEqual(["away", "drive", "stop"]);
    expect(stops).toBeGreaterThanOrEqual(1);
  });
});
