import { expect, it } from "vitest";
import {
  cosmeticTier,
  tierRank,
} from "../../packages/shared/src/cosmetic-tier";
import { LOOK_ITEMS } from "../../packages/shared/src/shop";

it("shop pieces follow their rarity, and pricier sets rank higher", () => {
  expect(cosmeticTier("candy-colours")).toBe("common");
  expect(cosmeticTier("candy-frame")).toBe("rare");
  expect(cosmeticTier("winter-frame")).toBe("epic");
  expect(cosmeticTier("galaxy-frame")).toBe("mythic");
  // Within a slot, a higher tier always costs more.
  for (const slot of ["frame", "aura", "entrance", "victory", "skin"]) {
    const pieces = LOOK_ITEMS.filter((i) => i.slot === slot);
    for (const a of pieces)
      for (const b of pieces)
        if (tierRank(cosmeticTier(a.id)) > tierRank(cosmeticTier(b.id)))
          expect(a.price, `${a.id} vs ${b.id}`).toBeGreaterThan(b.price);
  }
});

it("boss rewards follow how hard they are, and boss frames climb with stars", () => {
  expect(cosmeticTier("mountainborn")).toBe("rare"); // first clear
  expect(cosmeticTier("cragbound")).toBe("epic"); // 5 clears
  expect(cosmeticTier("cragstone")).toBe("legendary"); // 10 clears
  expect(cosmeticTier("mountain-aura")).toBe("legendary"); // no downs
  expect(cosmeticTier("rockslide-flex")).toBe("legendary"); // feat
  expect(cosmeticTier("conqueror")).toBe("epic");
  expect(cosmeticTier("conqueror", 3)).toBe("legendary");
  expect(cosmeticTier("conqueror", 5)).toBe("mythic");
});

it("journey rewards follow their level; season pieces are Epic", () => {
  expect(cosmeticTier("wayfarer-frame")).toBe("rare"); // level 10
  expect(cosmeticTier("aurora-colors")).toBe("epic"); // level 25
  expect(cosmeticTier("astral-aura")).toBe("legendary"); // level 45
  expect(cosmeticTier("season-ember-frame")).toBe("epic");
  expect(cosmeticTier("unknown")).toBe("common");
});
