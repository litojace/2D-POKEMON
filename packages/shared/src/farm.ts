/**
 * Elemental Farm: the catalog and curves shared by the client and the tests
 * (hub redesign phases 4–5). The rules that change wallets, plots and timers
 * run in the database (supabase/migrations/037_farm.sql and later); this file
 * mirrors its numbers for display, and tests check the two agree. Values come
 * from the approved prototype (docs/hub-redesign/prototype/app/farm.js).
 */
export type CropRarity = "common" | "uncommon" | "rare" | "legendary";
export interface Crop {
  id: string;
  name: string;
  element: string;
  /** Main and accent colours for the crop art. */
  color: string;
  accent: string;
  shape: string;
  /** Real seconds from planting to ripe (dry, unfertilized). */
  growSeconds: number;
  seedCost: number;
  /** Gold Leaves per crop at the base market price. */
  sell: number;
  xp: number;
  level: number;
  rarity: CropRarity;
}
/** The prototype counts time in units of 4 real minutes. */
const UNIT = 240;
const rarityFor = (level: number): CropRarity =>
  level >= 60
    ? "legendary"
    : level >= 35
      ? "rare"
      : level >= 15
        ? "uncommon"
        : "common";
export const CROPS: readonly Crop[] = (
  [
    [
      "wheat",
      "Breeze Wheat",
      "Aura",
      "#f2d27a",
      "#c9952f",
      "grain",
      15,
      5,
      5,
      3,
      1,
    ],
    [
      "carrot",
      "Earth Carrot",
      "Earth",
      "#ff8a3d",
      "#c4520f",
      "root",
      20,
      5,
      5,
      4,
      1,
    ],
    [
      "voltberry",
      "Volt Berry",
      "Electric",
      "#ffd84a",
      "#e09a00",
      "berry",
      25,
      5,
      5,
      5,
      2,
    ],
    [
      "pepper",
      "Ember Pepper",
      "Fire",
      "#ff4b2b",
      "#b0180a",
      "pepper",
      30,
      5,
      5,
      5,
      4,
    ],
    [
      "mint",
      "Spirit Mint",
      "Aura",
      "#7fe7ff",
      "#1f9fb8",
      "herb",
      28,
      5,
      5,
      5,
      3,
    ],
    [
      "lotus",
      "Tide Lotus",
      "Water",
      "#ff9bd2",
      "#e0559a",
      "lotus",
      35,
      5,
      6,
      6,
      6,
    ],
    [
      "lumen",
      "Lumen Bloom",
      "Light",
      "#fff1a8",
      "#f2b62a",
      "flower",
      40,
      10,
      9,
      7,
      8,
    ],
    [
      "duskcap",
      "Dusk Cap",
      "Shadow",
      "#8a6bff",
      "#3f2aa8",
      "mushroom",
      45,
      10,
      9,
      7,
      10,
    ],
    [
      "plum",
      "Mind Plum",
      "Psychic",
      "#c47dff",
      "#6a2fb8",
      "tree",
      50,
      10,
      9,
      8,
      12,
    ],
    [
      "pumpkin",
      "Lava Pumpkin",
      "Fire",
      "#ff8a1a",
      "#c0400a",
      "gourd",
      60,
      15,
      13,
      11,
      17,
    ],
    [
      "grape",
      "Thunder Grape",
      "Electric",
      "#7a8cff",
      "#3340c8",
      "vine",
      55,
      15,
      13,
      10,
      15,
    ],
    [
      "yam",
      "Crystal Yam",
      "Earth",
      "#c3adff",
      "#6f55d6",
      "crystal",
      70,
      15,
      14,
      12,
      25,
    ],
    [
      "cactus",
      "Sun Cactus",
      "Light",
      "#ff8fb8",
      "#e04a86",
      "cactus",
      65,
      15,
      14,
      12,
      22,
    ],
    [
      "kelp",
      "Star Kelp",
      "Water",
      "#5ff0e0",
      "#13909a",
      "kelp",
      60,
      15,
      13,
      11,
      19,
    ],
    [
      "poppy",
      "Dream Poppy",
      "Psychic",
      "#ff6fae",
      "#9b3fd8",
      "flower",
      75,
      15,
      14,
      13,
      28,
    ],
    [
      "melon",
      "Storm Melon",
      "Electric",
      "#57c04e",
      "#1f6b25",
      "melon",
      90,
      25,
      22,
      18,
      35,
    ],
    [
      "orange",
      "Phoenix Orange",
      "Fire",
      "#ffad1f",
      "#e0480f",
      "tree",
      100,
      25,
      23,
      19,
      42,
    ],
    [
      "pearl",
      "Pearl Pea",
      "Water",
      "#f4f8ff",
      "#8fc4f0",
      "pod",
      95,
      25,
      23,
      19,
      38,
    ],
    [
      "halotea",
      "Halo Tea",
      "Light",
      "#d8ff8a",
      "#7fbf3a",
      "herb",
      85,
      20,
      18,
      14,
      31,
    ],
    [
      "cotton",
      "Void Cotton",
      "Shadow",
      "#efe8ff",
      "#8a6bff",
      "boll",
      110,
      25,
      24,
      21,
      46,
    ],
    [
      "ginseng",
      "Stone Ginseng",
      "Earth",
      "#f0cf9a",
      "#a8743a",
      "root",
      120,
      30,
      27,
      22,
      50,
    ],
    [
      "starfruit",
      "Rainbow Starfruit",
      "Light",
      "#ffe27a",
      "#ff7ab8",
      "star",
      150,
      45,
      41,
      32,
      66,
    ],
    [
      "boltcorn",
      "Twin Bolt Corn",
      "Electric",
      "#ffd65b",
      "#5a74ff",
      "corn",
      140,
      40,
      37,
      31,
      60,
    ],
    [
      "emberlily",
      "Dragon Lily",
      "Fire",
      "#ff8a4f",
      "#ffd65b",
      "bigflower",
      160,
      45,
      42,
      34,
      72,
    ],
    [
      "dreamshroom",
      "Dreamwhale Shroom",
      "Psychic",
      "#c9a3ff",
      "#4fd6ff",
      "glowshroom",
      180,
      50,
      46,
      37,
      80,
    ],
  ] as const
).map(
  ([
    id,
    name,
    element,
    color,
    accent,
    shape,
    units,
    seedCost,
    sell,
    xp,
    level,
  ]) => ({
    id,
    name,
    element,
    color,
    accent,
    shape,
    growSeconds: units * UNIT,
    seedCost,
    sell,
    xp,
    level,
    rarity: rarityFor(level),
  }),
);
export const CROP_BY_ID: Readonly<Record<string, Crop>> = Object.fromEntries(
  CROPS.map((c) => [c.id, c]),
);

/** The field: 10 × 5 plots; the 15 in the top-left 5 × 3 are yours from the start. */
export const FARM_COLS = 10;
export const FARM_ROWS = 5;
export const FARM_PLOTS = FARM_COLS * FARM_ROWS;
export const START_PLOTS = 15;
export const isStartPlot = (i: number) =>
  i % FARM_COLS < 5 && Math.floor(i / FARM_COLS) < 3;
/** Plot k (0-based, after the 15 starters): farm level needed and its price. */
export const LAND_LEVEL = [
  3, 5, 7, 9, 11, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 37, 39, 41, 43,
  45, 47, 49, 51, 53, 56, 58, 60, 62, 64, 66, 68, 70, 72, 74,
] as const;
export const LAND_PRICE = [
  350, 400, 500, 600, 650, 800, 1150, 1200, 1250, 1400, 1450, 1500, 1550, 1600,
  1700, 1750, 1800, 1850, 1900, 1950, 2000, 2050, 2100, 2200, 2250, 2300, 2350,
  2450, 2500, 2550, 2600, 2700, 2750, 2800, 2850,
] as const;
/** A locked plot can be bought when it touches one you own. */
export function touchesOwned(owned: readonly boolean[], i: number) {
  const c = i % FARM_COLS,
    r = Math.floor(i / FARM_COLS);
  return [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([dc, dr]) => {
    const cc = c + dc,
      rr = r + dr;
    return (
      cc >= 0 &&
      cc < FARM_COLS &&
      rr >= 0 &&
      rr < FARM_ROWS &&
      owned[rr * FARM_COLS + cc]
    );
  });
}

/** Farm levels 1–100: XP from a level to the next. */
export const MAX_FARM_LEVEL = 100;
export function farmXpToNext(level: number) {
  const l = Math.floor(level);
  if (!(l >= 1) || l >= MAX_FARM_LEVEL) return 0;
  return Math.round((40 + 2.418 * l ** 2.1) / 10) * 10;
}
/** Gold Leaves for reaching a farm level. */
export const farmLevelLeaves = (level: number) => 40 + 10 * level;
export function farmLevel(xp: number) {
  let level = 1,
    into = Math.max(0, Math.floor(xp));
  while (level < MAX_FARM_LEVEL && into >= farmXpToNext(level)) {
    into -= farmXpToNext(level);
    level++;
  }
  const needed = farmXpToNext(level);
  return { level, into: needed ? into : 0, needed };
}
/** What each farm level opens besides crops, land and dogs. */
export const FARM_UNLOCKS: readonly [number, string][] = [
  [4, "Scarecrow"],
  [6, "Super Fertilizer"],
  [8, "Copper Can"],
  [9, "Cow Pasture"],
  [10, "Big Net"],
  [14, "Sickle"],
  [18, "Sprinkler"],
  [24, "Gold Fertilizer"],
  [30, "Gold Can"],
  [40, "Crop Mastery"],
];

/** Each harvest gives two crops. */
export const HARVEST_YIELD = 2;
/** Growth speed: watered ×1.35, fertilized ×1.4; Super Fertilizer adds 50% at once. */
export const WET_SPEED = 1.35;
export const FERTILIZER_SPEED = 1.4;
export const SUPER_FERTILIZER_BOOST = 0.5;
export const BARN_START = 80;
export const BARN_STEP = 40;
export const barnUpgradePrice = (upgrades: number) => 250 * (upgrades + 1);
/** A new farm: 15 plots, a few seeds and fertilizer, and a welcome gift. */
export const FARM_STARTER = {
  seeds: { wheat: 10, carrot: 6 } as Record<string, number>,
  fertilizer: { norm: 3, super: 1, gold: 0 },
  leaves: 100,
} as const;
export type FertilizerKind = "norm" | "super" | "gold";
export const FERTILIZERS: Record<
  FertilizerKind,
  { name: string; price: number; amount: number; level: number; text: string }
> = {
  norm: {
    name: "Fertilizer",
    price: 60,
    amount: 3,
    level: 1,
    text: "Crop grows 40% faster until ripe",
  },
  super: {
    name: "Super Fertilizer",
    price: 90,
    amount: 1,
    level: 6,
    text: "Instantly adds 50% growth",
  },
  gold: {
    name: "Gold Fertilizer",
    price: 200,
    amount: 1,
    level: 24,
    text: "Gold mutation odds ×3 for that crop",
  },
};
/** 100 Gold Leaves trade for 5 coins, up to 40 coins a day (migration 036). */
export const LEAF_TRADE = { leaves: 100, coins: 5, dailyCoins: 40 } as const;

/** The stage of the crop art (0 seed … 4 ripe) at a growth fraction. */
export function cropStage(progress: number) {
  return progress >= 1
    ? 4
    : progress > 0.66
      ? 3
      : progress > 0.33
        ? 2
        : progress > 0.05
          ? 1
          : 0;
}
/** "1h 20m", "45m", "30s": a duration in real seconds. */
export function farmDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds)),
    m = Math.floor(s / 60);
  if (m >= 60) return `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`;
  return m >= 1 ? `${m}m` : `${s}s`;
}

/** The farm as the server reports it (arena_farm()). */
export interface FarmPlot {
  i: number;
  owned: boolean;
  crop: string | null;
  /** Growth 0–1 at `now`. */
  progress: number;
  /** When the crop is ripe (ISO time), or null. */
  ripeAt: string | null;
  wet: boolean;
  fertilizer: FertilizerKind | null;
  mutation: string | null;
}
export interface FarmState {
  /** Server time when this was read (ISO). The client counts from it. */
  now: string;
  level: number;
  xp: number;
  plots: FarmPlot[];
  landBought: number;
  seeds: Record<string, number>;
  fertilizer: Record<FertilizerKind, number>;
  barn: { crop: string; mutation: string; qty: number }[];
  barnCap: number;
  barnUpgrades: number;
  /** Today's market multiplier per crop, and the HOT crop. */
  market: { day: string; mult: Record<string, number>; hot: string };
  /** Seed stock this restock window: crop → seeds left for you. */
  shop: { window: string; restockAt: string; stock: Record<string, number> };
  /** Harvests per crop (the crop book). */
  harvests: Record<string, number>;
  leaves: number;
}
/** One action in a farm request (arena_farm_act). */
export type FarmAction =
  | { a: "plant"; plot: number; crop: string }
  | { a: "water" | "harvest" | "dig" | "buy-land"; plot: number }
  | { a: "fertilize"; plot: number; kind: FertilizerKind }
  | { a: "buy-seeds"; crop: string; qty: number }
  | { a: "sell"; crop: string; mutation: string; qty: number }
  | { a: "buy-fertilizer"; kind: FertilizerKind }
  | { a: "upgrade-barn" };
export interface FarmActResult {
  farm: FarmState;
  results: (
    | { ok: true; crop?: string; qty?: number; xp?: number; leaves?: number }
    | { ok: false; error: string }
  )[];
  combo?: number;
  xp?: number;
  /** The same request id was already applied; nothing changed. */
  repeated?: boolean;
}
