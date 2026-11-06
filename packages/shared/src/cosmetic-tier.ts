import { COLLECTION_FRAMES, JOURNEY_ITEM_BY_ID, itemLevel } from "./journey.js";
import { RAID_REWARDS } from "./raid.js";
import { LOOK_ITEM_BY_ID, type Rarity } from "./shop.js";

/**
 * How grand a cosmetic's effects are. Higher tiers add more on top of the
 * item's own look (a glow, a shimmer, light beams, a prismatic edge), the
 * way rarity reads at a glance in games like League of Legends or Fortnite.
 *
 *  - Shop pieces follow their rarity (Mythical = mythic), which follows price.
 *  - Boss rewards follow how hard they are: first clear Rare, 3 or 5 clears
 *    Epic, 10 clears, a no-downs clear or the boss feat Legendary. A boss
 *    frame climbs with its stars: Legendary at 3 stars, Mythic at 5.
 *  - Journey rewards follow the level they unlock at (Lv 55–100 are Mythic);
 *    season pieces are Epic.
 */
export type CosmeticTier = "common" | "rare" | "epic" | "legendary" | "mythic";
export const COSMETIC_TIERS: CosmeticTier[] = [
  "common",
  "rare",
  "epic",
  "legendary",
  "mythic",
];
export const TIER_NAMES: Record<CosmeticTier, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythic: "Mythical",
};
/** Rarity colours (grey, blue, purple, gold, crimson), as games use them. */
export const TIER_COLORS: Record<CosmeticTier, string> = {
  common: "#a7b3c6",
  rare: "#4fa8ff",
  epic: "#b56bff",
  legendary: "#ffbf3c",
  mythic: "#ff4f7b",
};
export const tierRank = (t: CosmeticTier) => COSMETIC_TIERS.indexOf(t);

const SHOP_TIER: Record<Rarity, CosmeticTier> = {
  common: "common",
  rare: "rare",
  epic: "epic",
  mythical: "mythic",
};

export function cosmeticTier(id: string | null | undefined, stars = 0): CosmeticTier {
  if (!id) return "common";
  const shop = LOOK_ITEM_BY_ID[id];
  if (shop) return SHOP_TIER[shop.rarity];
  const reward = RAID_REWARDS.find((r) => r.id === id);
  if (reward) {
    const rule = reward.rule;
    if (reward.slot === "frame")
      return stars >= 5 ? "mythic" : stars >= 3 ? "legendary" : "epic";
    switch (rule.kind) {
      case "clears":
        return rule.n >= 10 ? "legendary" : rule.n >= 3 ? "epic" : "rare";
      case "flawless":
      case "feat":
      case "solo":
      case "speed":
        return "legendary";
      case "gilded":
        return "mythic";
      default:
        return "epic";
    }
  }
  // Collection frames take their set's rarity: Void Knights are Mythical.
  const setFrame = COLLECTION_FRAMES.find((f) => f.id === id);
  if (setFrame) return setFrame.collection === "void" ? "mythic" : "epic";
  const journey = JOURNEY_ITEM_BY_ID[id];
  if (journey) {
    const level = itemLevel(id);
    if (level === undefined) return "epic"; // seasonal journey piece
    // Lv 55–100 are the endgame rewards: the top tier.
    return level >= 55
      ? "mythic"
      : level >= 40
        ? "legendary"
        : level >= 25
          ? "epic"
          : "rare";
  }
  return "common";
}
