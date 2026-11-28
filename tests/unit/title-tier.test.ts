import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { LEGACY_RANKS, RANK_TIERS } from "../../packages/shared/src/accounts";
import { COSMETIC_TIERS } from "../../packages/shared/src/cosmetic-tier";
import { LEVEL_MILESTONES } from "../../packages/shared/src/journey";
import { PLAZA_FISH_TITLE } from "../../packages/shared/src/plaza";
import { RAID_REWARDS } from "../../packages/shared/src/raid";
import { SPIRE_REWARDS } from "../../packages/shared/src/spire";
import {
  TITLE_TIER_ROWS,
  titleKnown,
  titleTier,
  titleTierRank,
} from "../../packages/shared/src/title-tier";

/** Every title name a migration puts in arena_titles. */
function migrationTitles() {
  const dir = join(__dirname, "../../supabase/migrations");
  const names = new Set<string>();
  for (const file of readdirSync(dir)) {
    const sql = readFileSync(join(dir, file), "utf8");
    for (const block of sql.matchAll(
      /insert into public\.arena_titles\s*\([^)]*\)([\s\S]*?);/gi,
    )) {
      const body = block[1];
      // The admin's own "save a title" function: a name from its caller.
      if (/p_name/.test(body)) continue;
      const one = /^\s*select\s+'((?:[^']|'')+)'/i.exec(body);
      if (one) names.add(one[1].replace(/''/g, "'"));
      for (const row of body.matchAll(/\(\s*'((?:[^']|'')+)'\s*,/g))
        names.add(row[1].replace(/''/g, "'"));
    }
  }
  return [...names];
}

it("every title the game grants has a tier in the one table", () => {
  const granted = [
    ...RAID_REWARDS.filter((r) => r.slot === "title").map((r) => r.name),
    ...SPIRE_REWARDS.filter((r) => r.kind === "title").map((r) => r.item),
    ...LEVEL_MILESTONES.flatMap((m) => (m.title ? [m.title] : [])),
    ...RANK_TIERS.map((t) => t.name),
    ...LEGACY_RANKS.map((r) => r.name),
    PLAZA_FISH_TITLE.name,
  ];
  expect(granted.length).toBeGreaterThan(60);
  for (const name of granted) {
    expect(titleKnown(name), name).toBe(true);
    expect(COSMETIC_TIERS, name).toContain(titleTier(name));
  }
});

it("every title a migration adds has a tier (a new one fails here until it has)", () => {
  const names = migrationTitles();
  // The parser found them: the first titles, a quoted name, the newest.
  expect(names).toEqual(
    expect.arrayContaining([
      "First Victory",
      "Leviathan's Bane",
      "Elemental Botanist",
      "Rising Spark",
      "Master Angler",
      "Legend",
    ]),
  );
  expect(names.length).toBeGreaterThan(80);
  expect(names.filter((n) => !titleKnown(n))).toEqual([]);
});

it("no title is in the table twice", () => {
  const names = TITLE_TIER_ROWS.map((r) => r.name);
  expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
});

it("tiers follow how hard the goal is", () => {
  // Raids: first clear < 3 clears, timed solo < solo no downs, Gilded, 100.
  expect(titleTier("Cragbreaker")).toBe("rare");
  expect(titleTier("Mountain Conqueror")).toBe("epic");
  expect(titleTier("Pillar Breaker")).toBe("epic");
  expect(titleTier("Lone Mountain")).toBe("legendary");
  expect(titleTier("Avalanche")).toBe("epic");
  expect(titleTier("Moonrunner")).toBe("epic");
  expect(titleTier("Lone Lantern")).toBe("legendary");
  expect(titleTier("Gilded Cragbreaker")).toBe("legendary");
  expect(titleTier("Boss Hunter")).toBe("legendary");
  // The Spire climbs with its floors; only the summit is Mythical.
  const spire = SPIRE_REWARDS.filter((r) => r.kind === "title").sort(
    (a, b) => a.floor - b.floor,
  );
  const ranks = spire.map((r) => titleTierRank(r.item));
  expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  expect(titleTier("Echo Breaker")).toBe("rare");
  expect(titleTier("Stormbreaker of the Spire")).toBe("mythic");
  expect(spire.filter((r) => titleTier(r.item) === "mythic")).toHaveLength(1);
  // The Journey climbs with the level.
  expect(titleTier("Rising Spark")).toBe("common");
  expect(titleTier("Arena Vanguard")).toBe("rare");
  expect(titleTier("Elemental Legend")).toBe("epic");
  expect(titleTier("Mythic Champion")).toBe("legendary");
  expect(titleTier("Element Master")).toBe("legendary");
  // The rank road climbs with the tier.
  const road = RANK_TIERS.map((t) => titleTierRank(t.name));
  expect(road).toEqual([...road].sort((a, b) => a - b));
  expect(titleTier("Sprout")).toBe("common");
  expect(titleTier("Legend")).toBe("mythic");
  // The Fish book.
  expect(titleTier(PLAZA_FISH_TITLE.name)).toBe("legendary");
});

it("Mythical is the top of a ladder of skill only: no level, count or lucky drop", () => {
  expect(
    TITLE_TIER_ROWS.filter((r) => r.tier === "mythic")
      .map((r) => r.name)
      .sort(),
  ).toEqual(["Legend", "Legendary Grandmaster", "Stormbreaker of the Spire"]);
  // Nothing the Journey gives (levels are time played) is Mythical.
  for (const r of TITLE_TIER_ROWS.filter((r) => r.source === "journey"))
    expect(r.tier, r.name).not.toBe("mythic");
});

it("no title, or one made by hand, is Common", () => {
  expect(titleTier(null)).toBe("common");
  expect(titleTier(undefined)).toBe("common");
  expect(titleTier("")).toBe("common");
  expect(titleTier("Friend of the Owner")).toBe("common");
  expect(titleKnown("Friend of the Owner")).toBe(false);
});
