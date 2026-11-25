import { expect, it } from "vitest";
import {
  CHAMPION_SKINS,
  COLLECTION_NAMES,
  LOOK_ITEMS,
} from "../../packages/shared/src/shop";
import { SHOP_ARRIVALS } from "../../apps/client/src/shop-arrivals";

/** A "New" mark names something the Shop sells, on a real calendar day. */
it("marks only real collections and items as new, by a valid date", () => {
  const ids = new Set([
    ...Object.keys(COLLECTION_NAMES),
    ...CHAMPION_SKINS.map((s) => s.id),
    ...LOOK_ITEMS.map((i) => i.id),
  ]);
  for (const [key, day] of Object.entries(SHOP_ARRIVALS)) {
    expect(ids.has(key), key).toBe(true);
    expect(day, key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isFinite(Date.parse(`${day}T00:00:00Z`)), key).toBe(true);
  }
});
