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
  SKIN_BUNDLES,
  SKIN_PRICES,
  shopPrice,
  awakeningStage,
} from "../../packages/shared/src/shop";

/**
 * 010 seeds the first catalog; 053 and 054 add the second eight champions'
 * skins; 069 the Cyber Mecha Epics; 070 and 071 the two Nature champions'.
 */
const migration =
  readFileSync("supabase/migrations/010_shop.sql", "utf8") +
  readFileSync("supabase/migrations/053_new_champion_skins.sql", "utf8") +
  readFileSync("supabase/migrations/054_new_champion_mythicals.sql", "utf8") +
  readFileSync("supabase/migrations/069_cyber_mecha_epics.sql", "utf8") +
  readFileSync("supabase/migrations/070_eighteen_champions.sql", "utf8") +
  readFileSync(
    "supabase/migrations/071_nature_void_knights_and_cyber.sql",
    "utf8",
  ) +
  readFileSync(
    "supabase/migrations/20261117170000_fashion_collections.sql",
    "utf8",
  ) +
  readFileSync(
    "supabase/migrations/20261117170001_distinct_epic_collections.sql",
    "utf8",
  ) +
  readFileSync("supabase/migrations/20261117170002_nova_vanguard.sql", "utf8") +
  // Nova Vanguard becomes Legendary, and the full-roster skin sets.
  readFileSync(
    "supabase/migrations/20261118100000_legendary_skins_and_skin_sets.sql",
    "utf8",
  );
/** Missions are re-seeded (with the solo flag) by 014. */
const missionMigration = readFileSync(
  "supabase/migrations/014_missions.sql",
  "utf8",
);

describe("shop catalog", () => {
  it("is seeded into the database exactly as defined", () => {
    // 031 (collection tiers) re-prices the premium and showcase sets in
    // place: compare against the 010 seed with those rows as 031 sets them.
    const tiers = readFileSync(
      "supabase/migrations/031_collection_tiers.sql",
      "utf8",
    );
    const updated = new Map(
      [
        ...tiers.matchAll(
          /set rarity = '([a-z]+)', price = (\d+) where id = '([a-z-]+)';/g,
        ),
      ].map(([, rarity, price, id]) => [id, { rarity, price: Number(price) }]),
    );
    const names = new Map(
      [
        ...readFileSync(
          "supabase/migrations/032_colors_spelling.sql",
          "utf8",
        ).matchAll(/set name = '([^']+)' where id = '([a-z-]+)';/g),
      ].map(([, name, id]) => [id, name]),
    );
    // 067 turns every Mythical into a Void Knight in place (same id, new
    // name and collection).
    // 071 does the same for the two Nature champions (070 sold them as
    // Celestial Mythicals).
    const voidKnights = new Map(
      [
        ...(
          readFileSync(
            "supabase/migrations/067_void_knight_mythicals.sql",
            "utf8",
          ) +
          readFileSync(
            "supabase/migrations/071_nature_void_knights_and_cyber.sql",
            "utf8",
          )
        ).matchAll(
          /set name = '([^']+)', collection = 'void' where id = '([a-z-]+)';/g,
        ),
      ].map(([, name, id]) => [id, name]),
    );
    expect(voidKnights.size).toBe(18);
    for (const line of shopItemsSql.split("\n")) {
      const knight = line.match(/^ {2}\('([a-z-]+)', 'champion'/)?.[1];
      if (knight && voidKnights.has(knight)) {
        expect(line).toContain(
          `'${voidKnights.get(knight)}', 'mythical', 'void'`,
        );
        expect(migration).toContain(`('${knight}', 'champion'`);
        continue;
      }
      const id = line.match(/^ {2}\('([a-z-]+)', 'look'/)?.[1];
      const change = id ? updated.get(id) : undefined;
      // 032 renames the Colors pieces (American spelling) in place.
      const renamed = id ? names.get(id) : undefined;
      const seedLine = renamed
        ? line.replace(
            `'${renamed}'`,
            `'${renamed.replace(" colors", " colours")}'`,
          )
        : line;
      if (!change) {
        // The last row of a migration's insert has no trailing comma.
        expect(migration).toContain(seedLine.replace(/,$/, ""));
        continue;
      }
      expect(line).toContain(`'${change.rarity}'`);
      expect(line).toContain(`, ${change.price}, null)`);
    }
    // The retirement migration changes one existing mission without rewriting history.
    for (const line of missionsSql
      .split("\n")
      .filter(
        (l) =>
          !["'daily-1'", "'raid-p3'", "'raid-solo-p2'"].some((id) =>
            l.includes(id),
          ),
      ))
      expect(missionMigration).toContain(line);
    // 030 (one-difficulty raids) gives the two Peril missions new goals.
    const oneDifficulty = readFileSync(
      "supabase/migrations/030_one_difficulty_raids.sql",
      "utf8",
    );
    expect(oneDifficulty).toContain(
      "set text = 'Clear 2 raids on your own', metric = 'raid-solo', target = 2",
    );
    expect(oneDifficulty).toContain(
      "set text = 'Clear 2 raids with no downs', metric = 'raid-flawless', target = 2",
    );
    const retired = readFileSync(
      "supabase/migrations/028_retire_raid_modes.sql",
      "utf8",
    );
    expect(retired).toContain("Clear a raid as Voltkit or Auralynx");
  });

  it("gives solo players plenty of missions in every tier, and counts every metric", () => {
    for (const tier of ["easy", "medium", "hard"] as const)
      expect(
        MISSIONS.filter((m) => m.tier === tier && m.solo).length,
        tier,
      ).toBeGreaterThanOrEqual(7);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
    // Missions that need other people are flagged.
    for (const id of [
      "pvp-wins-2",
      "pvp-wins-5",
      "revives-3",
      "teams-unharmed",
      "raid-party",
      "ffa-win",
    ])
      expect(MISSIONS.find((m) => m.id === id)?.solo, id).toBe(false);
    // Every metric is bumped by the database's activity report.
    for (const m of MISSIONS)
      expect(missionMigration, m.metric).toContain(`'${m.metric}'`);
  });

  it("has 14 skins for every champion: 3 Common, 5 Rare, 4 Epic, 1 Legendary, 1 Mythical", () => {
    for (const id of Object.keys(CHARACTERS)) {
      const mine = CHAMPION_SKINS.filter((s) => s.champion === id);
      const count = (r: string) => mine.filter((s) => s.rarity === r).length;
      expect(
        [
          mine.length,
          count("common"),
          count("rare"),
          count("epic"),
          count("legendary"),
          count("mythical"),
        ],
        id,
      ).toEqual([14, 3, 5, 4, 1, 1]);
    }
    expect(CHAMPION_SKINS).toHaveLength(14 * Object.keys(CHARACTERS).length);
    // Each champion has one Cyber Mecha Epic.
    for (const id of Object.keys(CHARACTERS))
      expect(
        CHAMPION_SKINS.filter(
          (s) => s.champion === id && s.collection === "cyber",
        ),
        id,
      ).toHaveLength(1);
    // Every Mythical belongs to the Void Knight collection.
    for (const s of CHAMPION_SKINS.filter((s) => s.rarity === "mythical"))
      expect(s.collection, s.id).toBe("void");
  });

  it("uses unique ids across skins, collection pieces and bundles", () => {
    const ids = [
      ...CHAMPION_SKINS,
      ...LOOK_ITEMS,
      ...SHOP_BUNDLES,
      ...SKIN_BUNDLES,
    ].map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has six collections of five pieces, one per appearance slot", () => {
    expect(LOOK_ITEMS).toHaveLength(30);
    for (const b of SHOP_BUNDLES) {
      const slots = b.items
        .map((id) => LOOK_ITEMS.find((i) => i.id === id)!.slot)
        .sort();
      expect(slots).toEqual(["aura", "entrance", "frame", "skin", "victory"]);
    }
  });

  it("prices rarities so harder skins take longer", () => {
    expect(SKIN_PRICES.common).toBeLessThan(SKIN_PRICES.rare);
    expect(SKIN_PRICES.rare).toBeLessThan(SKIN_PRICES.epic);
    expect(SKIN_PRICES.epic).toBeLessThan(SKIN_PRICES.legendary);
    expect(SKIN_PRICES.legendary).toBeLessThan(SKIN_PRICES.mythical);
  });

  it("sells full-roster skin sets: one design, one rarity, every champion, never a Mythical", () => {
    const champions = Object.keys(CHARACTERS).sort();
    expect(SKIN_BUNDLES).toHaveLength(7);
    for (const b of SKIN_BUNDLES) {
      const skins = b.items.map((id) =>
        CHAMPION_SKINS.find((s) => s.id === id)!,
      );
      expect(skins.every(Boolean), b.id).toBe(true);
      expect(skins.map((s) => s.champion).sort(), b.id).toEqual(champions);
      expect(new Set(skins.map((s) => s.collection)), b.id).toEqual(
        new Set([b.collection]),
      );
      expect(new Set(skins.map((s) => s.rarity)).size, b.id).toBe(1);
      // A set would skip each champion's Mythic Trial.
      expect(
        skins.some((s) => s.rarity === "mythical"),
        b.id,
      ).toBe(false);
    }
    // Nova Vanguard is the Legendary set.
    expect(
      SKIN_BUNDLES.find((b) => b.collection === "nova-vanguard")!.items.every(
        (id) => CHAMPION_SKINS.find((s) => s.id === id)!.rarity === "legendary",
      ),
    ).toBe(true);
  });

  it("prices a skin set at 80% of the skins you don't own, as the database does", () => {
    const wayfarer = SKIN_BUNDLES.find((b) => b.id === "wayfarer-skins")!;
    const nova = SKIN_BUNDLES.find((b) => b.id === "nova-vanguard-skins")!;
    expect(shopPrice(wayfarer.id, [], null)).toBe(18 * 1500 * 0.8);
    expect(shopPrice(nova.id, [], null)).toBe(18 * 5500 * 0.8);
    // Pieces you own come off; a complete set has no price.
    expect(shopPrice(wayfarer.id, wayfarer.items.slice(0, 5), null)).toBe(
      13 * 1500 * 0.8,
    );
    expect(shopPrice(wayfarer.id, wayfarer.items, null)).toBeNull();
    // Today's deal never stacks on a set.
    expect(shopPrice(wayfarer.id, [], wayfarer.id)).toBe(18 * 1500 * 0.8);
  });

  it("offers missions in every tier, with valid champion filters", () => {
    for (const tier of ["easy", "medium", "hard"])
      expect(
        MISSIONS.filter((m) => m.tier === tier).length,
      ).toBeGreaterThanOrEqual(2);
    for (const m of MISSIONS)
      for (const c of m.champions ?? [])
        expect(Object.keys(CHARACTERS)).toContain(c);
  });

  it("awakens Mythicals at 25 wins, and fully at 75 wins plus a raid clear", () => {
    expect(awakeningStage(0, false)).toBe(1);
    expect(awakeningStage(AWAKENING.stage2Wins, false)).toBe(2);
    expect(awakeningStage(200, false)).toBe(2);
    expect(awakeningStage(AWAKENING.stage3Wins, true)).toBe(3);
  });
});
