import { describe, expect, it } from "vitest";
import {
  DECOR_AREA,
  DECOR_GRID,
  FARM_DECOR,
  decorBox,
  decorCap,
  decorFits,
  nearestDecorSpot,
  type FarmDecorPiece,
} from "../../packages/shared/src/farm";

// Decorations anywhere on the farm (20261116120000_farm_free_decor.sql).
describe("decorations on the farm's land", () => {
  it("has a size, a price and a level for every decoration", () => {
    expect(new Set(FARM_DECOR.map((d) => d.id)).size).toBe(FARM_DECOR.length);
    for (const d of FARM_DECOR) {
      expect(d.w).toBeGreaterThan(0);
      expect(d.d).toBeGreaterThan(0);
      expect(d.price).toBeGreaterThan(0);
      expect(d.charm).toBeGreaterThan(0);
    }
  });
  it("grows the room for decorations with the farm, up to 60", () => {
    expect(decorCap(1)).toBe(11);
    expect(decorCap(20)).toBe(30);
    expect(decorCap(50)).toBe(60);
    expect(decorCap(100)).toBe(60);
  });
  it("takes free grass on the grid, not the field, buildings or pond", () => {
    expect(decorFits("rock", 100, 900, [])).toBeNull();
    expect(decorFits("rock", 105, 900, [])).toBe("Choose a spot on the farm");
    expect(decorFits("rock", 0, 900, [])).toBe("Choose a spot on the farm");
    // The field, the barn's row, the pond, the gate's path, a farm tree.
    for (const [x, y] of [
      [800, 500],
      [1250, 300],
      [250, 990],
      [880, 950],
      [640, 1040],
    ])
      expect(decorFits("rock", x, y, []), `${x},${y}`).toBe(
        "Something is in the way",
      );
  });
  it("keeps decorations apart, except the one being moved", () => {
    // Right of the Chicken Coop's ground, below the doghouse.
    const placed: FarmDecorPiece[] = [
      { id: 1, item: "bench", x: 1500, y: 900 },
    ];
    expect(decorFits("rock", 1540, 900, placed)).toBe(
      "Too close to another decoration",
    );
    expect(decorFits("bench", 1510, 900, placed, 1)).toBeNull();
    // Right beside it is fine: the boxes don't overlap.
    const b = decorBox("bench", 1500, 900),
      r = decorBox("rock", 1580, 900);
    expect(r.x0).toBeGreaterThan(b.x1);
    expect(decorFits("rock", 1580, 900, placed)).toBeNull();
  });
  it("finds the nearest free spot for a new decoration", () => {
    const spot = nearestDecorSpot("tower", 800, 500, []);
    expect(spot).not.toBeNull();
    expect(decorFits("tower", spot!.x, spot!.y, [])).toBeNull();
    expect(spot!.x % DECOR_GRID).toBe(0);
    // A farm full of rocks: still somewhere, until there's nowhere near.
    expect(nearestDecorSpot("plum", 880, 950, [], undefined, 30)).toBeNull();
  });
  it("keeps the old 8 spots on the land", () => {
    for (const [x, y] of [
      [80, 830],
      [230, 870],
      [530, 870],
      [1240, 870],
      [70, 540],
      [1700, 880],
      [1390, 890],
      [390, 890],
    ]) {
      expect(x).toBeGreaterThanOrEqual(DECOR_AREA.x0);
      expect(y).toBeLessThanOrEqual(DECOR_AREA.y1);
    }
  });
});
