import { describe, expect, it } from "vitest";
import {
  CROP_BY_ID,
  DECOR_AREA,
  DECOR_BLOCKS,
  LEAF_TRADE,
  MILK,
  PASTURE,
} from "../../packages/shared/src/farm";
import {
  BAKERY,
  BAKERY_RECIPES,
  bakeError,
  bakeProgress,
  bakeSlotPrice,
  bakeStart,
  collectError,
  freeBakeSlot,
  goodName,
  ingredientValue,
  isBakedGood,
  plainStock,
  type FarmBakery,
} from "../../packages/shared/src/farm-bakery";

const iso = (ms: number) => new Date(ms).toISOString();
const T0 = Date.parse("2026-11-17T10:00:00Z");

describe("the recipes", () => {
  it("use barn goods that are open by the recipe's level", () => {
    for (const r of BAKERY_RECIPES) {
      expect(r.level).toBeGreaterThanOrEqual(BAKERY.level);
      expect(r.items.length).toBeGreaterThan(0);
      for (const [id, n] of r.items) {
        expect(n).toBeGreaterThan(0);
        if (id === MILK.id) expect(PASTURE.level).toBeLessThanOrEqual(r.level);
        else expect(CROP_BY_ID[id].level).toBeLessThanOrEqual(r.level);
      }
      // A baked good is never also a crop or milk.
      expect(CROP_BY_ID[r.id]).toBeUndefined();
      expect(r.id).not.toBe(MILK.id);
      expect(isBakedGood(r.id)).toBe(true);
    }
    expect(BAKERY_RECIPES.length).toBeGreaterThanOrEqual(4);
    expect(BAKERY_RECIPES.length).toBeLessThanOrEqual(6);
    expect(new Set(BAKERY_RECIPES.map((r) => r.id)).size).toBe(
      BAKERY_RECIPES.length,
    );
  });

  it("are worth baking: more than selling the raw goods on an ordinary day", () => {
    // Crops sell at ×0.7–1.6 on an ordinary day (1.15 on average), Storm
    // Milk at ×0.85–1.35 (1.10); only a HOT crop (×1.6–1.9) can beat baking.
    for (const r of BAKERY_RECIPES) {
      const base = ingredientValue(r);
      expect(r.sell / ingredientValue(r, 1.15, 1.1)).toBeGreaterThanOrEqual(
        1.3,
      );
      expect(r.sell).toBeGreaterThanOrEqual(ingredientValue(r, 1.6, 1.35));
      // …but not so much it floods the farm with leaves.
      expect(r.sell / base).toBeLessThanOrEqual(1.6);
    }
  });

  it("take longer and give more as they unlock later", () => {
    const byLevel = [...BAKERY_RECIPES].sort((a, b) => a.level - b.level);
    for (let k = 1; k < byLevel.length; k++) {
      expect(byLevel[k].seconds).toBeGreaterThan(byLevel[k - 1].seconds);
      expect(byLevel[k].xp).toBeGreaterThan(byLevel[k - 1].xp);
      expect(byLevel[k].sell - ingredientValue(byLevel[k])).toBeGreaterThan(
        byLevel[k - 1].sell - ingredientValue(byLevel[k - 1]),
      );
    }
  });

  it("can't add more than a day's leaf trade from a full queue left overnight", () => {
    // Away 12 hours: at most a full queue is waiting. Its profit over the
    // raw goods stays far below what the daily trade cap turns into coins.
    const best = Math.max(
      ...BAKERY_RECIPES.map((r) => r.sell - ingredientValue(r, 1.15, 1.1)),
    );
    const cap = (LEAF_TRADE.dailyCoins / LEAF_TRADE.coins) * LEAF_TRADE.leaves;
    expect(best * BAKERY.maxSlots).toBeLessThan(cap / 4);
  });

  it("names every good the barn holds", () => {
    expect(goodName("wheat")).toBe("Breeze Wheat");
    expect(goodName("milk")).toBe(MILK.name);
    expect(goodName("bread")).toBe("Breeze Bread");
    expect(goodName("mystery")).toBe("mystery");
  });
});

describe("the building", () => {
  it("stands on ground decorations can't use, clear of the field and paths", () => {
    expect(DECOR_BLOCKS).toContainEqual({ k: "rect", ...BAKERY.ground });
    const g = BAKERY.ground;
    expect(g.x0).toBeGreaterThanOrEqual(DECOR_AREA.x0);
    expect(g.x1).toBeLessThanOrEqual(DECOR_AREA.x1);
    expect(g.y1).toBeLessThanOrEqual(DECOR_AREA.y1);
    expect(BAKERY.x).toBeGreaterThan(g.x0);
    expect(BAKERY.x).toBeLessThan(g.x1);
    expect(BAKERY.y).toBeGreaterThan(g.y0);
    expect(BAKERY.y).toBeLessThanOrEqual(g.y1);
    // No other rectangle block (field, lane, path, doghouse) overlaps it.
    for (const b of DECOR_BLOCKS) {
      if (b.k !== "rect" || b.x0 === g.x0) continue;
      expect(b.x0 < g.x1 && g.x0 < b.x1 && b.y0 < g.y1 && g.y0 < b.y1).toBe(
        false,
      );
    }
  });

  it("sells 3 more queue slots, each dearer", () => {
    expect(bakeSlotPrice(1)).toBeNull();
    expect(bakeSlotPrice(2)).toBe(600);
    expect(bakeSlotPrice(3)).toBe(1200);
    expect(bakeSlotPrice(4)).toBe(2400);
    expect(bakeSlotPrice(5)).toBeNull();
  });
});

describe("the queue", () => {
  const q = (slot: number, recipe: string, s: number, e: number) => ({
    slot,
    recipe,
    startedAt: iso(T0 + s * 1000),
    readyAt: iso(T0 + e * 1000),
  });

  it("bakes one at a time: the next starts after the last, or now", () => {
    expect(bakeStart([], T0)).toBe(T0);
    expect(bakeStart([q(0, "bread", -900, -300)], T0)).toBe(T0);
    expect(
      bakeStart([q(0, "bread", 0, 600), q(1, "berrytart", 600, 2400)], T0),
    ).toBe(T0 + 2400 * 1000);
  });

  it("shows progress from start to ready", () => {
    const item = q(0, "bread", 600, 1200);
    expect(bakeProgress(item, T0)).toBe(0);
    expect(bakeProgress(item, T0 + 900 * 1000)).toBeCloseTo(0.5);
    expect(bakeProgress(item, T0 + 1200 * 1000)).toBe(1);
    expect(bakeProgress(item, T0 + 99999 * 1000)).toBe(1);
  });

  it("fills the lowest free slot", () => {
    expect(freeBakeSlot([], 2)).toBe(0);
    expect(freeBakeSlot([q(0, "bread", 0, 1)], 2)).toBe(1);
    expect(freeBakeSlot([q(1, "bread", 0, 1)], 2)).toBe(0);
    expect(freeBakeSlot([q(0, "bread", 0, 1), q(1, "bread", 1, 2)], 2)).toBe(
      -1,
    );
  });

  it("says why a recipe can't start, in the server's order", () => {
    const bakery: FarmBakery = { owned: true, slots: 2, queue: [] };
    const barn = [
      { crop: "wheat", mutation: "", qty: 2 },
      { crop: "wheat", mutation: "gold", qty: 9 },
      { crop: "milk", mutation: "", qty: 1 },
    ];
    const f = { level: 12, barn, bakery };
    expect(bakeError({ ...f, bakery: undefined }, "bread")).toBe(
      "Build the bakery first",
    );
    expect(bakeError(f, "toast")).toBe("Unknown recipe");
    expect(bakeError(f, "carrotcake")).toBe("Unlocks at farm level 14");
    // Gold wheat doesn't count: only plain goods go in the oven.
    expect(plainStock(barn, "wheat")).toBe(2);
    expect(bakeError(f, "bread")).toBe("You need 3 Breeze Wheat");
    expect(bakeError(f, "milkbun")).toBeNull();
    expect(
      bakeError(
        {
          ...f,
          bakery: {
            ...bakery,
            queue: [q(0, "bread", 0, 600), q(1, "bread", 600, 1200)],
          },
        },
        "milkbun",
      ),
    ).toBe("The bakery queue is full");
  });

  it("collects only what's done, into a barn with room", () => {
    const bakery: FarmBakery = {
      owned: true,
      slots: 2,
      queue: [q(0, "bread", -600, 0), q(1, "bread", 0, 600)],
    };
    const f = {
      barn: [{ crop: "wheat", mutation: "", qty: 79 }],
      barnCap: 80,
      bakery,
    };
    expect(collectError(f, 0, T0)).toBeNull();
    expect(collectError(f, 1, T0)).toBe("Still baking");
    expect(collectError(f, 2, T0)).toBe("Nothing in that slot");
    expect(
      collectError(
        { ...f, barn: [{ crop: "wheat", mutation: "", qty: 80 }] },
        0,
        T0,
      ),
    ).toBe("Your barn is full");
  });
});
