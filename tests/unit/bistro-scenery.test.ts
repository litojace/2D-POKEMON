import { describe, expect, it } from "vitest";
import {
  carGlows,
  updateCars,
} from "../../apps/client/src/bistro/bistro-scenery";
import {
  CAR_SIZE,
  carBox,
  carLen,
  carPose,
} from "../../apps/client/src/bistro/bistro-vehicles";
import {
  BUS_LEN,
  LANE,
  ROAD0,
  ROAD1,
  busBox,
  laneOf,
  roadEnds,
  shelter,
  stopY,
  zebraY,
} from "../../apps/client/src/bistro/bistro-town";
import {
  depthSort,
  order,
  spot,
  type Drawable,
} from "../../apps/client/src/bistro/bistro-depth";

describe("bistro street: vehicles at the creatures' scale", () => {
  // A creature stands about 75 px tall on the street.
  it("cars are about a creature tall, vans and the bus taller, all fit their lane", () => {
    for (const k of [0, 2, 3]) {
      expect(CAR_SIZE[k].h).toBeGreaterThan(55);
      expect(CAR_SIZE[k].h).toBeLessThan(80);
      expect(CAR_SIZE[k].len).toBeGreaterThan(2);
    }
    expect(CAR_SIZE[1].h).toBeGreaterThan(CAR_SIZE[0].h);
    for (const k of [0, 1, 2, 3])
      expect(CAR_SIZE[k].wid).toBeLessThan(LANE * 2 - 0.4);
    expect(BUS_LEN).toBeGreaterThan(CAR_SIZE[1].len * 1.6);
  });
  it("cars stay in their lanes, inside the road", () => {
    for (const v of [3, -3]) {
      const b = carBox(carPose({ y: 0, v, col: "#fff", kind: 1 }), 1);
      expect(b.x0).toBeGreaterThan(ROAD0);
      expect(b.x1).toBeLessThan(ROAD1);
    }
    expect(laneOf(1)).toBeLessThan(laneOf(-1));
  });
  it("the bus stops beside its shelter, in the road, never on it", () => {
    const b = busBox({ y: stopY(), speed: 0, state: "stop", t: 5 });
    const s = shelter();
    expect(b.x1).toBeLessThan(ROAD1);
    expect(b.x1).toBeLessThan(s.x0);
    // Alongside it.
    expect(b.y0).toBeLessThan(s.y0);
    expect(b.y1).toBeGreaterThan(s.y1);
  });
});

describe("bistro street: traffic", () => {
  it("cars come and go along the road", () => {
    let cars = updateCars([], 1, 0);
    expect(cars).toHaveLength(1);
    for (let i = 0; i < 600; i++) cars = updateCars(cars, 0.1, 1);
    expect(cars).toHaveLength(0);
    const e = roadEnds();
    expect(e.y0).toBeLessThan(-20);
  });
  it("cars queue behind the bus at its stop instead of driving through it", () => {
    const bus = { y: stopY(), speed: 0, state: "stop" as const, t: 5 };
    let cars = [{ y: stopY() + 9, v: -3, col: "#fff", kind: 0 }];
    for (let i = 0; i < 80; i++) cars = updateCars(cars, 0.05, 1, { bus });
    expect(cars[0].y).toBeGreaterThanOrEqual(
      stopY() + (BUS_LEN + carLen(cars[0])) / 2,
    );
    // The far lane drives past.
    let far = [{ y: stopY() - 2, v: 3, col: "#fff", kind: 0 }];
    for (let i = 0; i < 20; i++) far = updateCars(far, 0.05, 1, { bus });
    expect(far[0].y).toBeGreaterThan(stopY() + 0.5);
  });
  it("cars stop before the zebra while someone crosses, then drive on", () => {
    const Z = zebraY();
    let cars = [
      { y: Z - 8, v: 3, col: "#fff", kind: 0 },
      { y: Z + 8, v: -3, col: "#fff", kind: 1 },
    ];
    for (let i = 0; i < 80; i++) cars = updateCars(cars, 0.05, 1, { zebra: Z });
    const [down, up] = cars;
    expect(down.y + carLen(down) / 2).toBeLessThan(Z - 0.75);
    expect(up.y - carLen(up) / 2).toBeGreaterThan(Z + 0.75);
    for (let i = 0; i < 40; i++)
      cars = updateCars(cars, 0.05, 1, { zebra: null });
    expect(cars[0].y).toBeGreaterThan(Z);
  });
  it("a faster car slows behind a slower one, and is never pushed back", () => {
    let cars = [
      { y: 0, v: 2.4, col: "#fff", kind: 0 },
      { y: -2.7, v: 4, col: "#fff", kind: 1 },
    ];
    let last = cars[1].y;
    for (let i = 0; i < 40; i++) {
      cars = updateCars(cars, 0.05, 1);
      expect(cars[1].y).toBeGreaterThanOrEqual(last - 1e-9);
      last = cars[1].y;
    }
    const [slow, fast] = cars;
    expect(slow.y - fast.y).toBeGreaterThanOrEqual(
      (carLen(slow) + carLen(fast)) / 2,
    );
  });
  it("headlights at night, one per car", () => {
    const cars = [
      { y: -6, v: 2.8, col: "#fff", kind: 0 },
      { y: 8, v: -3, col: "#fff", kind: 1 },
    ];
    expect(carGlows(cars)).toHaveLength(2);
  });
});

describe("bistro street: what is drawn over what", () => {
  const box = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    h: number,
    name: string,
    log: string[],
  ): Drawable => ({
    x0,
    y0,
    x1,
    y1,
    h,
    draw: () => log.push(name),
  });
  it("a long bus is drawn behind the shelter it stops beside, whatever their middles", () => {
    const log: string[] = [];
    // The bus's middle is nearer the viewer (x + y) than the shelter's, yet it stands behind it.
    const bus = box(-5.3, 9, -3.6, 18, 120, "bus", log);
    const sh = box(-2.4, 12.5, -1, 14.5, 100, "shelter", log);
    expect(order(bus, sh)).toBe(-1);
    for (const d of depthSort([sh, bus])) d.draw();
    expect(log).toEqual(["bus", "shelter"]);
  });
  it("someone behind a lamp is drawn first, someone in front after", () => {
    const log: string[] = [];
    const lamp = spot(0, 0, 0.12, 160, () => log.push("lamp"));
    const behind = spot(-0.5, -0.4, 0.22, 90, () => log.push("behind"));
    const front = spot(0.4, 0.5, 0.22, 90, () => log.push("front"));
    for (const d of depthSort([front, lamp, behind])) d.draw();
    expect(log).toEqual(["behind", "lamp", "front"]);
  });
});
