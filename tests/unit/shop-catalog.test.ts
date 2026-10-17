import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { missionsSql, shopItemsSql } from "../../scripts/shop-seed.ts";
import { CHARACTERS } from "@arena/shared";
import {
  AWAKENING,
  CHAMPION_SKINS,
  LOOK_ITEMS,
  MISSIONS,
  SHOP_BUNDLES,
  SKIN_PRICES,
  awakeningStage,
} from "../../packages/shared/src/shop";

const migration = readFileSync("supabase/migrations/010_shop.sql", "utf8");

describe("shop catalog", () => {
  it("is seeded into the database exactly as defined", () => {
    expect(migration).toContain(shopItemsSql);
    expect(migration).toContain(missionsSql);
  });

  it("has 7 skins for every champion: 3 Common, 2 Rare, 1 Epic, 1 Mythical", () => {
    for (const id of Object.keys(CHARACTERS)) {
      const mine = CHAMPION_SKINS.filter((s) => s.champion === id);
      const count = (r: string) => mine.filter((s) => s.rarity === r).length;
      expect([mine.length, count("common"), count("rare"), count("epic"), count("mythical")], id).toEqual([7, 3, 2, 1, 1]);
    }
    expect(CHAMPION_SKINS).toHaveLength(56);
  });

  it("uses unique ids across skins, collection pieces and bundles", () => {
    const ids = [...CHAMPION_SKINS, ...LOOK_ITEMS, ...SHOP_BUNDLES].map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has six collections of five pieces, one per appearance slot", () => {
    expect(LOOK_ITEMS).toHaveLength(30);
    for (const b of SHOP_BUNDLES) {
      const slots = b.items.map((id) => LOOK_ITEMS.find((i) => i.id === id)!.slot).sort();
      expect(slots).toEqual(["aura", "entrance", "frame", "skin", "victory"]);
    }
  });

  it("prices rarities so harder skins take longer", () => {
    expect(SKIN_PRICES.common).toBeLessThan(SKIN_PRICES.rare);
    expect(SKIN_PRICES.rare).toBeLessThan(SKIN_PRICES.epic);
    expect(SKIN_PRICES.epic).toBeLessThan(SKIN_PRICES.mythical);
  });

  it("offers missions in every tier, with valid champion filters", () => {
    for (const tier of ["easy", "medium", "hard"])
      expect(MISSIONS.filter((m) => m.tier === tier).length).toBeGreaterThanOrEqual(2);
    for (const m of MISSIONS)
      for (const c of m.champions ?? []) expect(Object.keys(CHARACTERS)).toContain(c);
  });

  it("awakens Mythicals at 25 wins, and fully at 75 wins plus a Peril 3 clear", () => {
    expect(awakeningStage(0, false)).toBe(1);
    expect(awakeningStage(AWAKENING.stage2Wins, false)).toBe(2);
    expect(awakeningStage(200, false)).toBe(2);
    expect(awakeningStage(AWAKENING.stage3Wins, true)).toBe(3);
  });
});
