import { describe, expect, it } from "vitest";
import {
  COOP,
  DECOR_AREA,
  DECOR_BLOCKS,
  EGG,
  FARM_UNLOCKS,
  PASTURE,
  decorFits,
  eggPrice,
  henPrice,
  henState,
} from "../../packages/shared/src/farm";

// The Chicken Coop (20261117100000_farm_coop.sql).
describe("the Chicken Coop", () => {
  it("opens at level 14 with 3 hens, and holds 9", () => {
    expect(COOP.level).toBe(14);
    expect(FARM_UNLOCKS).toContainEqual([14, "Chicken Coop"]);
    expect(COOP.henPrices).toHaveLength(COOP.maxHens - COOP.hens);
    expect(henPrice(0)).toBeNull();
    expect(henPrice(3)).toBe(300);
    expect(henPrice(8)).toBe(1200);
    expect(henPrice(9)).toBeNull();
    // Each hen costs more than the last.
    for (let k = 1; k < COOP.henPrices.length; k++)
      expect(COOP.henPrices[k]).toBeGreaterThan(COOP.henPrices[k - 1]);
  });
  it("tells a hungry hen, a laying one and one with an egg apart", () => {
    const now = Date.parse("2026-11-17T10:00:00Z");
    expect(henState(null, now)).toBe("hungry");
    expect(henState("2026-11-17T10:00:01Z", now)).toBe("laying");
    expect(henState("2026-11-17T10:00:00Z", now)).toBe("egg");
    expect(henState(now - 1, now)).toBe("egg");
  });
  it("pays more for an egg than for the wheat it eats, less than milk", () => {
    expect(eggPrice(1)).toBe(EGG.sell);
    expect(eggPrice(EGG.multMin)).toBeGreaterThan(COOP.feedQty * 5);
    expect(EGG.sell).toBeLessThan(60);
    expect(eggPrice(0)).toBe(1);
    expect(COOP.laySeconds).toBe(PASTURE.milkSeconds);
  });
  it("stands on the farm's free land, where no decoration can go", () => {
    expect(COOP.x0).toBeGreaterThanOrEqual(DECOR_AREA.x0);
    expect(COOP.x1).toBeLessThanOrEqual(DECOR_AREA.x1);
    expect(COOP.y1).toBeLessThanOrEqual(DECOR_AREA.y1);
    expect(DECOR_BLOCKS).toContainEqual({
      k: "rect",
      x0: COOP.x0,
      x1: COOP.x1,
      y0: COOP.y0,
      y1: COOP.y1,
    });
    // It doesn't sit on any other block (the lane, the gate's path, a tree).
    const others = DECOR_BLOCKS.filter(
      (b) => !(b.k === "rect" && b.x0 === COOP.x0 && b.y0 === COOP.y0),
    );
    for (let x = COOP.x0 + 5; x < COOP.x1; x += 10)
      for (let y = COOP.y0 + 5; y < COOP.y1; y += 10)
        for (const b of others)
          expect(
            b.k === "rect"
              ? x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1
              : ((x - b.x) / b.rx) ** 2 + ((y - b.y) / b.ry) ** 2 < 1,
            `${x},${y}`,
          ).toBe(false);
    expect(decorFits("rock", 1140, 900, [])).toBe("Something is in the way");
    expect(decorFits("rock", 1140, 990, [])).toBeNull();
  });
});
