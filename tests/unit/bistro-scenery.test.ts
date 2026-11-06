import { describe, expect, it } from "vitest";
import {
  carFade,
  carGlows,
  HORIZON,
  updateCars,
} from "../../apps/client/src/bistro/bistro-scenery";
import { iso } from "../../apps/client/src/bistro/bistro-art";

describe("bistro street: cars stay on the ground", () => {
  it("a car beyond the horizon is not drawn, a near one fully", () => {
    for (const v of [2.8, -3]) {
      expect(carFade({ y: -26, v, col: "#fff", kind: 0 })).toBe(0);
      expect(carFade({ y: 12, v, col: "#fff", kind: 0 })).toBe(1);
    }
  });
  it("wherever a car is along the road, it is drawn only below the horizon", () => {
    for (let y = -30; y <= 34; y += 0.25)
      for (const v of [2.8, -3]) {
        const car = { y, v, col: "#fff", kind: 0 };
        const lane = v > 0 ? -5.6 + 0.6 : -3.3 - 0.6;
        if (carFade(car) > 0) expect(iso(lane, y).y).toBeGreaterThan(HORIZON);
      }
  });
  it("no headlights in the sky", () => {
    const cars = [
      { y: -26, v: 2.8, col: "#fff", kind: 0 },
      { y: 8, v: -3, col: "#fff", kind: 1 },
    ];
    expect(carGlows(cars)).toHaveLength(1);
    for (const [, y] of carGlows(cars)) expect(y).toBeGreaterThan(HORIZON - 20);
  });
  it("cars come and go along the road", () => {
    let cars = updateCars([], 1, 0);
    expect(cars).toHaveLength(1);
    for (let i = 0; i < 400; i++) cars = updateCars(cars, 0.1, 1);
    expect(cars).toHaveLength(0);
  });
});

describe("bistro street: houses and trees stand on the ground", () => {
  it("nothing is planted beyond the horizon", async () => {
    const { onGround } =
      await import("../../apps/client/src/bistro/bistro-scenery");
    // The far end of the road (behind the bistro) meets the horizon.
    expect(onGround(-8.6, -3.5)).toBe(false);
    expect(onGround(-8.6, 3)).toBe(true);
  });
  it("a car fades out while still behind the bistro's wall", () => {
    // The left wall's top over the road's far lane is about 25 px below the horizon.
    for (let y = -30; y <= 34; y += 0.25)
      for (const v of [2.8, -3]) {
        const car = { y, v, col: "#fff", kind: 0 };
        const lane = v > 0 ? -5.6 + 0.6 : -3.3 - 0.6;
        if (carFade(car) > 0)
          expect(iso(lane, y).y).toBeGreaterThan(HORIZON + 50);
      }
  });
});
