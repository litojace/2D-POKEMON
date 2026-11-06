import type { RaidSlot } from "./raid.js";

export const MAX_PLAYER_LEVEL = 100;
/**
 * XP needed to go from `level` to the next one (0 at the cap).
 * Lv 1–49 keep the original curve, 100 + 25·(L−1). Lv 50–69 climb to about
 * 9,000 XP a level; from Lv 70 each level adds 75 more, so the top levels take
 * a regular player about a week each. Migration 035 stores the same steps.
 */
export function xpToNextLevel(level: number) {
  const l = Math.floor(level);
  if (!(l >= 1) || l >= MAX_PLAYER_LEVEL) return 0;
  if (l < 50) return 100 + 25 * (l - 1);
  if (l < 70)
    return Math.round((1300 + 7700 * ((l - 49) / 21) ** 1.3) / 50) * 50;
  return 9000 + 75 * (l - 69);
}
/** LEVEL_THRESHOLDS[L] is the total XP needed to enter level L (index 0 unused). */
const LEVEL_THRESHOLDS = Array.from({ length: MAX_PLAYER_LEVEL }).reduce<
  number[]
>(
  (all, _, i) => {
    if (i > 0) all.push(all[i] + xpToNextLevel(i));
    return all;
  },
  [0, 0],
);
/** Total XP needed to enter a level. XP never changes combat stats. */
export function levelThreshold(level: number) {
  const l = Number.isNaN(level) ? 1 : Math.floor(level);
  return LEVEL_THRESHOLDS[Math.max(1, Math.min(MAX_PLAYER_LEVEL, l))];
}
/** Coins for reaching a level: 30 up to Lv 49, then 100 for every level from Lv 50. */
export function levelCoins(level: number) {
  return level < 50 ? 30 : 100;
}
/** Coins for every level-up from `from` (exclusive) to `to` (inclusive). */
export function levelUpCoins(from: number, to: number) {
  let coins = 0;
  for (let l = Math.max(1, from) + 1; l <= Math.min(MAX_PLAYER_LEVEL, to); l++)
    coins += levelCoins(l);
  return coins;
}
/** Daily Spark: the first 500 XP each Pacific day count double. */
export const DAILY_SPARK_XP = 500;
export interface SeasonRules {
  tiers: number;
  tierXp: number;
  /** The tiers that give the season's frame, aura, colors and finale, in that order. */
  itemTiers: readonly [number, number, number, number];
}
/** Seasons up to November 2026: 20 tiers of 400 XP. */
export const LEGACY_SEASON_RULES: SeasonRules = {
  tiers: 20,
  tierXp: 400,
  itemTiers: [5, 10, 15, 20],
};
/** Seasons from the month after migration 035 runs: 30 tiers of 1,200 XP. */
export const SEASON_RULES: SeasonRules = {
  tiers: 30,
  tierXp: 1200,
  itemTiers: [5, 12, 20, 30],
};
export const SEASON_TIER_COINS = 50;
/**
 * The rules of the season the server reported. A database without migration
 * 035 sends none, and still runs the 20 × 400 season.
 */
export function seasonRules(season?: Partial<Journey["season"]>): SeasonRules {
  const tiers = season?.tiers,
    tierXp = season?.tierXp,
    items = season?.itemTiers;
  if (
    !Number.isInteger(tiers) ||
    !Number.isInteger(tierXp) ||
    !Array.isArray(items) ||
    items.length !== 4
  )
    return LEGACY_SEASON_RULES;
  return {
    tiers: tiers!,
    tierXp: tierXp!,
    itemTiers: items as unknown as SeasonRules["itemTiers"],
  };
}
export function playerLevel(xp: number) {
  const total = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  let level = 1;
  while (level < MAX_PLAYER_LEVEL && total >= levelThreshold(level + 1))
    level++;
  const floor = levelThreshold(level),
    ceiling = levelThreshold(level + 1);
  return {
    level,
    total,
    into: total - floor,
    needed: level === MAX_PLAYER_LEVEL ? 0 : ceiling - floor,
    percent:
      level === MAX_PLAYER_LEVEL
        ? 100
        : ((total - floor) / (ceiling - floor)) * 100,
  };
}
export const SEASON_THEMES = {
  aurora: {
    name: "Aurora Trails",
    color: "#9ff3d8",
    accent: "#b6a0ff",
    dark: "#25364d",
  },
  ember: {
    name: "Ember Festival",
    color: "#ffb980",
    accent: "#ffe39d",
    dark: "#422a38",
  },
  tide: {
    name: "Tidal Voyage",
    color: "#86deff",
    accent: "#b9f5e9",
    dark: "#20354d",
  },
  astral: {
    name: "Astral Carnival",
    color: "#d2b0ff",
    accent: "#ffb5da",
    dark: "#302a50",
  },
} as const;
export type SeasonTheme = keyof typeof SEASON_THEMES;
export function seasonTheme(season: string): SeasonTheme {
  const [year, month] = season.split("-").map(Number);
  return (
    (Object.keys(SEASON_THEMES) as SeasonTheme[])[
      (((year * 12 + month - 1) % 4) + 4) % 4
    ] ?? "aurora"
  );
}
export interface JourneyItem {
  id: string;
  name: string;
  slot: RaidSlot;
  description: string;
  color: string;
  accent: string;
}
const rewardItem = (
  id: string,
  name: string,
  slot: RaidSlot,
  description: string,
  color = "#9ff3d8",
  accent = "#ffd991",
): JourneyItem => ({ id, name, slot, description, color, accent });
export const LEVEL_ITEMS: JourneyItem[] = [
  rewardItem(
    "wayfarer-frame",
    "Wayfarer frame",
    "frame",
    "A compass crest framed in mint and gold",
  ),
  rewardItem(
    "comet-arrival",
    "Comet arrival",
    "entrance",
    "A falling comet breaks into a trail of golden stars",
  ),
  rewardItem(
    "trailblazer-aura",
    "Trailblazer aura",
    "aura",
    "Compass sparks orbit your feet",
  ),
  rewardItem(
    "aurora-colors",
    "Aurora colors",
    "skin",
    "Mint, lavender and warm starlight",
    "#9ff3d8",
    "#b6a0ff",
  ),
  rewardItem(
    "meteor-finale",
    "Meteor finale",
    "victory",
    "Three falling stars burst around your celebration",
  ),
  rewardItem(
    "champion-laurel",
    "Champion laurel",
    "frame",
    "Golden laurels around a royal blue crest",
    "#ffd991",
    "#8cbaff",
  ),
  rewardItem(
    "astral-aura",
    "Astral aura",
    "aura",
    "Violet diamonds travel along two crossing orbits",
    "#d2b0ff",
    "#ffb5da",
  ),
  // Lv 55–100: the endgame rewards. Mythical tier (cosmetic-tier.ts), each
  // with its own art rather than the shared journey ring and falling stars.
  rewardItem(
    "prism-frame",
    "Prism frame",
    "frame",
    "A faceted crystal ring that splits starlight into a rainbow",
    "#b9f6ff",
    "#ffd991",
  ),
  rewardItem(
    "nova-entrance",
    "Nova entrance",
    "entrance",
    "A star gathers into a point of light, then bursts into a nova",
    "#ffe7a3",
    "#b6a0ff",
  ),
  rewardItem(
    "starlit-colors",
    "Starlit colors",
    "skin",
    "Midnight blue scattered with golden stars",
    "#8fb4ff",
    "#ffe7a3",
  ),
  rewardItem(
    "solar-aura",
    "Solar aura",
    "aura",
    "A blazing sun ring with turning corona rays and orbiting flares",
    "#ffc85a",
    "#ff8a4c",
  ),
  rewardItem(
    "eclipse-finale",
    "Eclipse finale",
    "victory",
    "A dark moon crosses the sun and its corona flares into a diamond ring",
    "#ffd27a",
    "#b6a0ff",
  ),
  rewardItem(
    "prismatic-laurel",
    "Prismatic laurel",
    "frame",
    "Crystal laurels in every color around a golden crest",
    "#ffd991",
    "#b9f6ff",
  ),
  rewardItem(
    "element-master-frame",
    "Element Master frame",
    "frame",
    "A prismatic crown set with all eight element gems",
    "#fff1c4",
    "#b6a0ff",
  ),
];
export const SEASON_ITEMS: JourneyItem[] = (
  Object.entries(SEASON_THEMES) as [
    SeasonTheme,
    (typeof SEASON_THEMES)[SeasonTheme],
  ][]
).flatMap(([theme, p]) => [
  rewardItem(
    `season-${theme}-frame`,
    `${p.name} frame`,
    "frame",
    "An illuminated crest in this season’s colors",
    p.color,
    p.accent,
  ),
  rewardItem(
    `season-${theme}-aura`,
    `${p.name} aura`,
    "aura",
    "Orbiting diamonds and a two-tone halo",
    p.color,
    p.accent,
  ),
  rewardItem(
    `season-${theme}-colors`,
    `${p.name} colors`,
    "skin",
    "A complete color palette for every fighter",
    p.color,
    p.accent,
  ),
  rewardItem(
    `season-${theme}-victory`,
    `${p.name} finale`,
    "victory",
    "A constellation of falling stars",
    p.color,
    p.accent,
  ),
]);
export const JOURNEY_ITEMS = [...LEVEL_ITEMS, ...SEASON_ITEMS];
/**
 * Reward frames for owning every skin of a champion-skin collection: never
 * sold, granted by arena_collection_bonus (migrations 071 and 072). They share the
 * reward items' lookup with the Journey's.
 */
export const COLLECTION_FRAMES = [
  {
    ...rewardItem(
      "void-frame",
      "Void Knight frame",
      "frame",
      "Black steel, violet runes and crossed swords: own all sixteen Void Knights",
      "#b48cff",
      "#efe6ff",
    ),
    collection: "void" as const,
  },
  {
    ...rewardItem(
      "cyber-frame",
      "Cyber Mecha frame",
      "frame",
      "Chrome plates, neon circuits and a V-fin: own all sixteen Cyber Mechas",
      "#3ff0ff",
      "#dfe6f0",
    ),
    collection: "cyber" as const,
  },
  {
    ...rewardItem(
      "arcade-frame",
      "Arcade frame",
      "frame",
      "Neon tubes, a synthwave grid and a joystick: own all eight Arcade skins",
      "#ff4fd8",
      "#2ff3ff",
    ),
    collection: "arcade" as const,
  },
];
/** Every reward-only item: the Journey's and the collection frames. */
export const REWARD_ITEMS: JourneyItem[] = [
  ...JOURNEY_ITEMS,
  ...COLLECTION_FRAMES,
];
export const JOURNEY_ITEM_BY_ID: Record<string, JourneyItem> =
  Object.fromEntries(REWARD_ITEMS.map((i) => [i.id, i]));
export const LEVEL_MILESTONES = [
  { level: 5, title: "Rising Spark", item: null },
  { level: 10, title: null, item: "wayfarer-frame" },
  { level: 15, title: null, item: "comet-arrival" },
  { level: 20, title: null, item: "trailblazer-aura" },
  { level: 25, title: null, item: "aurora-colors" },
  { level: 30, title: "Arena Vanguard", item: null },
  { level: 35, title: null, item: "meteor-finale" },
  { level: 40, title: null, item: "champion-laurel" },
  { level: 45, title: null, item: "astral-aura" },
  { level: 50, title: "Elemental Legend", item: null },
  { level: 55, title: null, item: "prism-frame" },
  { level: 60, title: "Arena Veteran", item: null },
  { level: 65, title: null, item: "nova-entrance" },
  { level: 70, title: null, item: "starlit-colors" },
  { level: 75, title: "Mythic Champion", item: null },
  { level: 80, title: null, item: "solar-aura" },
  { level: 85, title: null, item: "eclipse-finale" },
  { level: 90, title: "Ascendant", item: null },
  { level: 95, title: null, item: "prismatic-laurel" },
  // The top level gives both a title and a frame.
  { level: 100, title: "Element Master", item: "element-master-frame" },
] as const;
export type LevelMilestone = (typeof LEVEL_MILESTONES)[number];
/** What a milestone gives, by name: its title, its cosmetic, or both. */
export function milestoneNames(m: LevelMilestone): string[] {
  const names: string[] = [];
  if (m.title) names.push(m.title);
  if (m.item) names.push(JOURNEY_ITEM_BY_ID[m.item]?.name ?? m.item);
  return names;
}
/** The level a journey cosmetic unlocks at (undefined for season pieces). */
export function itemLevel(id: string): number | undefined {
  return LEVEL_MILESTONES.find((m) => m.item === id)?.level;
}
export const WEEKLY_GOALS = [
  { id: "play", text: "Finish 5 matches or raid attempts", target: 5 },
  { id: "skills", text: "Use 50 skills", target: 50 },
  { id: "raids", text: "Clear 2 raids", target: 2 },
  { id: "arcade", text: "Finish 3 weekly arcade matches", target: 3 },
] as const;
export interface Journey {
  xp: number;
  /** Recently saved XP events let the results screen show the exact award. */
  recent: { ref: string; amount: number; source: string; at: string }[];
  season: {
    id: string;
    xp: number;
    week: string;
    goals: Record<string, number>;
    completed: string[];
    /** This season's rules (migration 035); absent means 20 × 400. */
    tiers?: number;
    tierXp?: number;
    itemTiers?: number[];
  };
  /** Daily Spark use on the current Pacific day (migration 035). */
  spark?: { day: string; used: number; limit: number };
  /** Cosmetics unlocked through account levels or any previous season. */
  unlocked: string[];
}
const SEASON_ITEM_SLOTS = ["frame", "aura", "colors", "victory"] as const;
export function seasonReward(
  tier: number,
  season: string,
  rules: SeasonRules = LEGACY_SEASON_RULES,
) {
  const suffix = SEASON_ITEM_SLOTS[rules.itemTiers.indexOf(tier)];
  return {
    coins: SEASON_TIER_COINS,
    item: suffix ? `season-${seasonTheme(season)}-${suffix}` : null,
  };
}
/** XP still doubled today by the Daily Spark. */
export function sparkLeft(j?: Pick<Journey, "spark">) {
  if (!j?.spark) return 0;
  return Math.max(0, Math.min(j.spark.limit, j.spark.limit - j.spark.used));
}
