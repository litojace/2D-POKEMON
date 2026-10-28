import type { RaidSlot } from "./raid.js";

export const MAX_PLAYER_LEVEL = 50;
export const LEVEL_COINS = 30;
export const SEASON_TIERS = 20;
export const SEASON_TIER_XP = 400;
/** Total XP needed to enter a level. XP never changes combat stats. */
export function levelThreshold(level: number) {
  const n = Math.max(0, Math.min(MAX_PLAYER_LEVEL, Math.floor(level)) - 1);
  return n * 100 + (n * (n - 1) * 25) / 2;
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
export const JOURNEY_ITEM_BY_ID: Record<string, JourneyItem> =
  Object.fromEntries(JOURNEY_ITEMS.map((i) => [i.id, i]));
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
] as const;
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
  };
  /** Cosmetics unlocked through account levels or any previous season. */
  unlocked: string[];
}
export function seasonReward(tier: number, season: string) {
  const suffix = (
    { 5: "frame", 10: "aura", 15: "colors", 20: "victory" } as Record<
      number,
      string
    >
  )[tier];
  return {
    coins: 50,
    item: suffix ? `season-${seasonTheme(season)}-${suffix}` : null,
  };
}
