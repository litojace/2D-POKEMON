import { describe, expect, it } from "vitest";
import {
  TOWN,
  TOWN_OBSTACLES,
  TOWN_PLAZA_ROAD,
  TOWN_PLAZA_LAMPS,
} from "../../../packages/shared/src/town";
import { FOUNTAIN } from "../src/town-art";

describe("central plaza fountain", () => {
  const f = TOWN_OBSTACLES.find((o) => o.kind === "fountain")!;
  it("centres the basin inside the eight elemental markers", () => {
    const stones = TOWN_OBSTACLES.filter((o) => o.kind === "stone");
    expect(stones).toHaveLength(8);
    expect(f.x).toBe(TOWN.plaza.x);
    expect(f.y).toBe(TOWN.plaza.y);
    for (let i = 0; i < 4; i++) {
      expect((stones[i].x + stones[i + 4].x) / 2).toBeCloseTo(f.x);
      expect((stones[i].y + stones[i + 4].y) / 2).toBeCloseTo(f.y);
    }
  });
  it("keeps all eight element stones clear of the basin", () => {
    if (f.shape !== "round")
      throw new Error("Fountain requires an elliptical footprint");
    const stones = TOWN_OBSTACLES.filter((o) => o.kind === "stone");
    expect(stones).toHaveLength(8);
    for (const stone of stones) {
      if (stone.shape !== "round")
        throw new Error("Element stone requires a round footprint");
      expect(
        Math.hypot(
          (stone.x - f.x) / (f.rx + stone.rx),
          (stone.y - f.y) / (f.ry + stone.ry),
        ),
      ).toBeGreaterThan(1);
    }
  });

  it("frames the full fountain within the circular road", () => {
    const top = f.y + FOUNTAIN.crystal.dy - FOUNTAIN.crystal.ry;
    const bottom = f.y + FOUNTAIN.basin.ry + FOUNTAIN.basin.wall;
    const above = top - (TOWN_PLAZA_ROAD.y - TOWN_PLAZA_ROAD.ry);
    const below = TOWN_PLAZA_ROAD.y + TOWN_PLAZA_ROAD.ry - bottom;
    expect(above).toBeGreaterThan(0);
    expect(below).toBeGreaterThan(0);
    expect(Math.abs(above - below)).toBeLessThan(32);
    // The independent paving centre must not move the basin or tag circle.
    expect(f.y).toBe(1080);
    for (const stone of TOWN_OBSTACLES.filter((o) => o.kind === "stone")) {
      expect(
        Math.hypot(
          (stone.x - TOWN_PLAZA_ROAD.x) / (TOWN_PLAZA_ROAD.rx - 16),
          (stone.y - TOWN_PLAZA_ROAD.y) / (TOWN_PLAZA_ROAD.ry - 12),
        ),
      ).toBeLessThan(1);
    }
  });

  it("keeps the perimeter lamps outside the shifted paving", () => {
    for (const lamp of TOWN_PLAZA_LAMPS) {
      expect(
        Math.hypot(
          (lamp.x - TOWN_PLAZA_ROAD.x) / (TOWN_PLAZA_ROAD.rx + 22),
          (lamp.y - TOWN_PLAZA_ROAD.y) / (TOWN_PLAZA_ROAD.ry + 22 * 0.78),
        ),
      ).toBeGreaterThan(1);
    }
  });
});
