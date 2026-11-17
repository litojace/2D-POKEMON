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
  henLevel,
  henPrice,
  henState,
  nextCow,
} from "../../packages/shared/src/farm";
import { FARM_TO_BISTRO } from "../../packages/shared/src/bistro";

// The Chicken Coop and more cows (20261117100000_farm_coop_cows.sql).
describe("the Chicken Coop", () => {
  it("opens at level 14 with 3 hens; each more hen has its own level", () => {
    expect(COOP.level).toBe(14);
    expect(FARM_UNLOCKS).toContainEqual([14, "Chicken Coop"]);
    expect(COOP.henPrices).toHaveLength(COOP.maxHens - COOP.hens);
    expect(COOP.henLevels).toHaveLength(COOP.maxHens - COOP.hens);
    expect(henPrice(0)).toBeNull();
    expect([henLevel(3), henPrice(3)]).toEqual([17, 500]);
    expect([henLevel(8), henPrice(8)]).toEqual([36, 1500]);
    expect(henPrice(9)).toBeNull();
    expect(henLevel(9)).toBeNull();
    // Each hen comes later and costs more than the last.
    for (let k = 1; k < COOP.henPrices.length; k++) {
      expect(COOP.henPrices[k]).toBeGreaterThan(COOP.henPrices[k - 1]);
      expect(COOP.henLevels[k]).toBeGreaterThan(COOP.henLevels[k - 1]);
    }
    expect(COOP.henLevels[0]).toBeGreaterThan(COOP.level);
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
    // Three eggs make the Bistro's Eggs, like milk.
    expect(FARM_TO_BISTRO.egg).toBe("egg");
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
    expect(decorFits("rock", 1140, 990, [])).toBe("Something is in the way");
    // The cherry tree felled for its wider ground left free grass beside it.
    expect(decorFits("rock", 1490, 1050, [])).toBeNull();
    expect(decorFits("rock", 1420, 1000, [])).toBe("Something is in the way");
  });
});
describe("more cows", () => {
  it("adds a 2nd to 5th cow at levels 32, 42, 55 and 68, and no more", () => {
    expect(nextCow(0)).toBeNull();
    expect(nextCow(1)).toEqual({ level: 32, price: 4000 });
    expect(nextCow(2)).toEqual({ level: 42, price: 6000 });
    expect(nextCow(3)).toEqual({ level: 55, price: 9000 });
    expect(nextCow(4)).toEqual({ level: 68, price: 13000 });
    expect(nextCow(5)).toBeNull();
    expect(PASTURE.maxCows).toBe(1 + PASTURE.cowLevels.length);
    // Each cow comes later and costs more than the one before, and the 2nd
    // waits until the coop is almost full (docs/farm-coop.md).
    for (let k = 1; k < PASTURE.cowLevels.length; k++) {
      expect(PASTURE.cowLevels[k]).toBeGreaterThan(PASTURE.cowLevels[k - 1]);
      expect(PASTURE.cowPrices[k]).toBeGreaterThan(PASTURE.cowPrices[k - 1]);
    }
    expect(PASTURE.cowLevels[0]).toBeGreaterThanOrEqual(COOP.henLevels.at(-2)!);
  });
  it("the taller pasture keeps decorations off, with its two trees felled", () => {
    expect(decorFits("rock", 1600, 360, [])).toBe("Something is in the way");
    expect(decorFits("rock", 1600, 410, [])).toBe("Something is in the way");
    expect(
      DECOR_BLOCKS.some((b) => b.k === "oval" && b.x === 1480 && b.y === 340),
    ).toBe(false);
    expect(
      DECOR_BLOCKS.some((b) => b.k === "oval" && b.x === 1700 && b.y === 330),
    ).toBe(false);
  });
});
