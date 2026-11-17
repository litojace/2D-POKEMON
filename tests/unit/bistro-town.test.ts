import { describe, expect, it } from "vitest";
import {
  BUS_LEN,
  CROWD,
  FRONTS,
  HORIZON,
  ROAD0,
  ROAD1,
  WALK,
  canal,
  groundFade,
  laneOf,
  makeStreet,
  plaza,
  routes,
  seasonOf,
  shops,
  stopY,
  updateStreet,
} from "../../apps/client/src/bistro/bistro-town";
import { updateCars } from "../../apps/client/src/bistro/bistro-scenery";
import { R, iso, setRoomSize } from "../../apps/client/src/bistro/bistro-art";

/** A repeatable random sequence. */
const seeded =
  (seed = 1) =>
  () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

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
  it("shops stand across the road, never over the canal", () => {
    for (const size of [
      { cols: 11, rows: 9 },
      { cols: 13, rows: 10 },
      { cols: 15, rows: 11 },
    ]) {
      setRoomSize(size);
      const c = canal();
      const list = shops();
      expect(list.length).toBeGreaterThan(5);
      for (const s of list) {
        expect(s.y1 <= c.y0 || s.y0 >= c.y1).toBe(true);
        expect(s.y1 - s.y0).toBeGreaterThan(2);
      }
      // The canal runs in front of the room's front sidewalk.
      expect(c.y0).toBeGreaterThan(R.rows + 1.6);
      // The square sits beside the room, off its side sidewalk.
      const P = plaza();
      expect(P.x - P.r).toBeGreaterThan(R.cols + 1.6);
      // The bus stops beside the near sidewalk, before the bridge.
      expect(stopY() + BUS_LEN / 2).toBeLessThan(c.y0);
    }
    setRoomSize({ cols: 11, rows: 9 });
  });
  it("people walk on sidewalks and paths, never in the road", () => {
    for (const r of routes())
      for (const [x] of r.pts) {
        const inRoad = x > ROAD0 && x < ROAD1;
        expect(inRoad).toBe(false);
        // Across the road only on the far sidewalk, in front of the shops.
        if (x < ROAD0) expect(x).toBeGreaterThan(FRONTS);
      }
  });
  it("vehicles keep to their lanes", () => {
    expect(laneOf(1)).toBeGreaterThan(ROAD0);
    expect(laneOf(-1)).toBeLessThan(ROAD1);
    expect(laneOf(1)).toBeLessThan(laneOf(-1));
    expect(WALK).toBeGreaterThan(ROAD1);
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
    // A few minutes later the crowd stays within its number.
    for (let i = 0; i < 3000; i++) {
      updateStreet(high, 0.1);
      updateStreet(low, 0.1);
      const walkers = (s: typeof high) =>
        s.folk.filter((f) => f.kind === "walk" || f.kind === "dog").length;
      // Someone getting off the bus may walk beside the usual crowd.
      expect(walkers(high)).toBeLessThanOrEqual(CROWD.high.walkers + 2);
      expect(walkers(low)).toBeLessThanOrEqual(CROWD.low.walkers + 2);
    }
    expect(people(high)).toBeGreaterThan(0);
  });
  it("nobody walks in the sky past the horizon", () => {
    const s = makeStreet(["voltkit"], false, seeded(7));
    for (let i = 0; i < 2000; i++) {
      updateStreet(s, 0.1);
      for (const f of s.folk)
        if (groundFade(f.x, f.y) > 0)
          expect(iso(f.x, f.y).y).toBeGreaterThan(HORIZON);
    }
  });
  it("the bus stops at its stop, leaves, and comes back", () => {
    const s = makeStreet(["voltkit"], true, seeded(5));
    expect(s.bus.state).toBe("stop");
    const seen = new Set<string>();
    let stops = 0,
      was = s.bus.state;
    for (let i = 0; i < 2400; i++) {
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
  it("cars queue behind the bus at its stop instead of driving through it", () => {
    const bus = { y: stopY(), speed: 0, state: "stop" as const, t: 5 };
    let cars = [{ y: stopY() + 6, v: -3, col: "#fff", kind: 0 }];
    for (let i = 0; i < 60; i++) cars = updateCars(cars, 0.05, 1, { bus });
    expect(cars[0].y).toBeGreaterThanOrEqual(stopY() + (BUS_LEN + 0.95) / 2);
    // The far lane drives past.
    let far = [{ y: stopY() - 2, v: 3, col: "#fff", kind: 0 }];
    for (let i = 0; i < 20; i++) far = updateCars(far, 0.05, 1, { bus });
    expect(far[0].y).toBeGreaterThan(stopY() + 0.5);
  });
  it("a faster car slows behind a slower one", () => {
    let cars = [
      { y: 0, v: 2.4, col: "#fff", kind: 0 },
      { y: -2, v: 4, col: "#fff", kind: 1 },
    ];
    for (let i = 0; i < 40; i++) cars = updateCars(cars, 0.05, 1);
    const [slow, fast] = cars;
    expect(slow.y - fast.y).toBeGreaterThanOrEqual((0.95 + 1.25) / 2);
  });
});
