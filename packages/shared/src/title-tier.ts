import { RANK_TIERS } from "./accounts.js";
import {
  COSMETIC_TIERS,
  tierRank,
  type CosmeticTier,
} from "./cosmetic-tier.js";
import { LEVEL_MILESTONES } from "./journey.js";
import { PLAZA_FISH_TITLE } from "./plaza.js";
import { RAID_REWARDS, type RaidRule } from "./raid.js";
import { SPIRE_REWARDS } from "./spire.js";

/**
 * How special a title is (owner, 27 Nov 2026: "the higher a title's rank,
 * the more special its effect"). A title is sent as its name and its colour
 * (the database's arena_titles), so the tier is worked out here from the
 * name, on the same five steps and names as cosmetics (cosmetic-tier.ts:
 * Common, Rare, Epic, Legendary, Mythical).
 *
 * Mythical is for the rarest and hardest only (owner, 28 Nov): the top of
 * a ladder that takes skill against players or the game's hardest fights,
 * never what time alone earns (levels, counted clears) or what luck hands
 * out (a Gilded boss, one raid in twenty). Those stop at Legendary.
 *
 * One table, filled by rule from the data that grants each title:
 *
 *  - Raid titles follow their goal: a first clear is Rare; 3 clears, a
 *    counted deed or a timed solo clear Epic; a solo clear without going
 *    down, a Gilded boss and 100 clears Legendary. (Timed solo clears were
 *    Legendary until the owner saw who holds what, 28 Nov: as many players
 *    held them as held first clears, and Legendary outnumbered Epic.)
 *  - Spire titles follow the floor: 5 and 10 Rare, 20 and 30 Epic, 40 to 60
 *    Legendary, the summit (70) Mythical.
 *  - Journey titles follow the level: 5 Common, from 10 Rare, from 50 Epic,
 *    from 75 Legendary. No level is Mythical.
 *  - Rank road titles follow the rating the tier starts at: under 1000
 *    Common, from 1000 Rare, from 1210 Epic, from 1450 Legendary, from 1600
 *    (Legend, the top) Mythical.
 *  - Titles whose goal is not in shared data (achievements, the ranks'
 *    first names, the Farm's, renamed raid titles) are named in
 *    NAMED_TITLE_TIERS: one line each.
 *
 * A title this table doesn't know (one an administrator made by hand) has
 * the tier the administrator chose for it (setStoredTitleTiers), Common
 * unless they chose another. A new title gets its tier by its
 * rule; tests/unit/title-tier.test.ts fails on one a migration adds that
 * has none.
 */
export type TitleTier = CosmeticTier;

/** Where a title comes from, for the table players and the owner read. */
export type TitleSource =
  "raid" | "spire" | "journey" | "rank" | "plaza" | "achievement" | "legacy";

export interface TitleTierRow {
  name: string;
  tier: TitleTier;
  source: TitleSource;
  /** What earns it, in a few words. */
  goal: string;
}

const raidTier = (rule: RaidRule): TitleTier => {
  switch (rule.kind) {
    case "clears":
      return rule.n >= 10 ? "legendary" : rule.n >= 3 ? "epic" : "rare";
    case "total-clears":
    case "gilded":
    case "solo":
    case "flawless":
    case "feat":
      return "legendary";
    case "peril":
      return rule.n >= 3 ? "legendary" : "epic";
    case "speed":
    case "stat":
      return "epic";
  }
};
const spireTier = (floor: number): TitleTier =>
  floor >= 70
    ? "mythic"
    : floor >= 40
      ? "legendary"
      : floor >= 20
        ? "epic"
        : "rare";
const journeyTier = (level: number): TitleTier =>
  level >= 75
    ? "legendary"
    : level >= 50
      ? "epic"
      : level >= 10
        ? "rare"
        : "common";
const ratingTier = (rating: number): TitleTier =>
  rating >= 1600
    ? "mythic"
    : rating >= 1450
      ? "legendary"
      : rating >= 1210
        ? "epic"
        : rating >= 1000
          ? "rare"
          : "common";

/**
 * Titles the database grants whose goal is not in shared data: one line
 * each, [name, tier, source, goal].
 */
export const NAMED_TITLE_TIERS: readonly [
  string,
  TitleTier,
  TitleSource,
  string,
][] = [
  // Achievements (migration 004).
  ["First Victory", "common", "achievement", "Win a match"],
  ["Seasoned Brawler", "rare", "achievement", "Win 10 matches"],
  ["Arena Legend", "epic", "achievement", "Win 50 matches"],
  ["Flawless", "rare", "achievement", "Win without dropping a round"],
  ["Comeback Kid", "epic", "achievement", "Win after losing two rounds"],
  ["Combo Artist", "rare", "achievement", "5 signature combos in a match"],
  ["Dynamic Duo", "rare", "achievement", "Win 10 team matches"],
  ["Bot Breaker", "rare", "achievement", "Beat a Hard bot"],
  ["Sworn Rivals", "rare", "achievement", "10 matches against one player"],
  ["Elemental Master", "epic", "achievement", "Win with every fighter"],
  // The ranks' first names (migration 006), by the rating each asked for.
  ["Newbie", "common", "legacy", "Old rank: under 950"],
  ["Pupil", "common", "legacy", "Old rank: 950"],
  ["Specialist", "rare", "legacy", "Old rank: 1000"],
  ["Expert", "rare", "legacy", "Old rank: 1075"],
  ["Candidate Master", "rare", "legacy", "Old rank: 1150"],
  ["Master", "epic", "legacy", "Old rank: 1225"],
  ["International Master", "epic", "legacy", "Old rank: 1300"],
  ["Grandmaster", "epic", "legacy", "Old rank: 1375"],
  ["International Grandmaster", "legendary", "legacy", "Old rank: 1450"],
  ["Legendary Grandmaster", "mythic", "legacy", "Old rank: 1550 and #1"],
  // Raid titles under their names before the bosses' new identities
  // (migration 020; 112 added the new names beside them).
  ["Wingbreaker", "epic", "legacy", "Old name of Wicksnuffer"],
  ["Lone Phoenix", "legendary", "legacy", "Old name of Lone Wick"],
  // The Farm (migrations 037 and 041; docs/removed-features.md).
  ["Green Thumb", "rare", "legacy", "Farm level 25"],
  ["Master Grower", "epic", "legacy", "Farm level 50"],
  ["Harvest Legend", "epic", "legacy", "Farm level 75"],
  ["Elemental Farmer", "legendary", "legacy", "Farm level 100"],
  ["Elemental Botanist", "epic", "legacy", "All 25 crops in the crop book"],
];

/** The Fish book's title: every fish, the Legendary ones too. */
export const PLAZA_FISH_TITLE_TIER: TitleTier = "legendary";

/** Every title the game grants, with its tier: the one table. */
export const TITLE_TIER_ROWS: readonly TitleTierRow[] = [
  ...RAID_REWARDS.filter((r) => r.slot === "title").map((r): TitleTierRow => ({
    name: r.name,
    tier: raidTier(r.rule),
    source: "raid",
    goal: r.goal,
  })),
  ...SPIRE_REWARDS.filter((r) => r.kind === "title").map((r): TitleTierRow => ({
    name: r.item,
    tier: spireTier(r.floor),
    source: "spire",
    goal: `Spire floor ${r.floor}`,
  })),
  ...LEVEL_MILESTONES.filter((m) => m.title).map((m): TitleTierRow => ({
    name: m.title as string,
    tier: journeyTier(m.level),
    source: "journey",
    goal: `Player level ${m.level}`,
  })),
  ...RANK_TIERS.map((t): TitleTierRow => ({
    name: t.name,
    tier: ratingTier(t.floors[0]),
    source: "rank",
    goal: t.floors[0] ? `Rank road: ${t.floors[0]} rating` : "Rank road",
  })),
  {
    name: PLAZA_FISH_TITLE.name,
    tier: PLAZA_FISH_TITLE_TIER,
    source: "plaza",
    goal: "Every fish in the Fish book",
  },
  ...NAMED_TITLE_TIERS.map(([name, tier, source, goal]): TitleTierRow => ({
    name,
    tier,
    source,
    goal,
  })),
];

const BY_NAME = new Map(TITLE_TIER_ROWS.map((r) => [r.name, r.tier]));

/**
 * Titles an administrator made, with the tier they chose for each (the
 * database's arena_titles.tier, read through arena_title_tiers). Only for
 * titles this table doesn't know: the game's own keep their rule.
 */
let stored = new Map<string, TitleTier>();
/** Take the administrators' tiers ({ name: tier }); anything else in it is dropped. */
export function setStoredTitleTiers(tiers: unknown) {
  const next = new Map<string, TitleTier>();
  if (tiers && typeof tiers === "object")
    for (const [name, tier] of Object.entries(tiers))
      if ((COSMETIC_TIERS as string[]).includes(tier as string))
        next.set(name, tier as TitleTier);
  stored = next;
}

/** Whether the table knows this title (an admin's hand-made one it doesn't). */
export const titleKnown = (name: string) => BY_NAME.has(name);

/**
 * A title's tier, by its name: the table's for the game's own titles, the
 * administrator's choice for one they made, Common for none and for one
 * nobody gave a tier.
 */
export function titleTier(name: string | null | undefined): TitleTier {
  return (name && (BY_NAME.get(name) ?? stored.get(name))) || "common";
}

/** 0 (Common) to 4 (Mythical). */
export const titleTierRank = (name: string | null | undefined) =>
  tierRank(titleTier(name));

export { COSMETIC_TIERS as TITLE_TIERS };
