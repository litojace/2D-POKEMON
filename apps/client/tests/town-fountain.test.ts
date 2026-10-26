import { describe, expect, it } from "vitest";
import {
  TOWN,
  TOWN_OBSTACLES,
  TOWN_PLAZA_ROAD,
  TOWN_PLAZA_LAMPS,
} from "../../../packages/shared/src/town";

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

  it("keeps the road, inner circle, markers and basin concentric", () => {
    expect(TOWN_PLAZA_ROAD.x).toBe(f.x);
    expect(TOWN_PLAZA_ROAD.y).toBe(f.y);
    const radii: number[] = [];
    for (const stone of TOWN_OBSTACLES.filter((o) => o.kind === "stone")) {
      radii.push(
        Math.hypot(
          (stone.x - TOWN_PLAZA_ROAD.x) / TOWN_PLAZA_ROAD.rx,
          (stone.y - TOWN_PLAZA_ROAD.y) / TOWN_PLAZA_ROAD.ry,
        ),
      );
      expect(
        Math.hypot(
          (stone.x - TOWN_PLAZA_ROAD.x) / (TOWN_PLAZA_ROAD.rx - 16),
          (stone.y - TOWN_PLAZA_ROAD.y) / (TOWN_PLAZA_ROAD.ry - 12),
        ),
      ).toBeLessThan(1);
    }
    expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(1e-10);
  });

  it("keeps the perimeter lamps outside the paving", () => {
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
