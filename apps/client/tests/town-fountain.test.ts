import { describe, expect, it } from "vitest";
import { TOWN, TOWN_OBSTACLES } from "../../../packages/shared/src/town";
import { FOUNTAIN } from "../src/town-art";

describe("central plaza fountain", () => {
  const f = TOWN_OBSTACLES.find((o) => o.kind === "fountain")!;
  it("centres the entire monument's silhouette on the paving", () => {
    const top = f.y + FOUNTAIN.crystal.dy - FOUNTAIN.crystal.ry;
    const bottom = f.y + FOUNTAIN.basin.ry + FOUNTAIN.basin.wall;
    expect(f.x).toBe(TOWN.plaza.x);
    expect(Math.abs((top + bottom) / 2 - TOWN.plaza.y)).toBeLessThan(2);
  });
  it("keeps all eight element stones clear of the moved basin", () => {
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
});
