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
/** Grow times are in minutes: quick early crops for active play, overnight ones late. */
const UNIT = 60;
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
      2,
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
      5,
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
      10,
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
      20,
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
      15,
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
      30,
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
      45,
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
      60,
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
      75,
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
      120,
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
      90,
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
      180,
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
      150,
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
      120,
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
      210,
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
      270,
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
      330,
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
      300,
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
      240,
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
      360,
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
      420,
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
      540,
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
      480,
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
      600,
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
      720,
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
/** Tools bought once with Gold Leaves (migration 044). */
export type FarmToolId =
  "scarecrow" | "can2" | "net2" | "sickle" | "can3" | "sprinkler";
export const FARM_TOOLS: readonly {
  id: Exclude<FarmToolId, "sprinkler">;
  name: string;
  icon: string;
  text: string;
  price: number;
  level: number;
}[] = [
  {
    id: "scarecrow",
    name: "Scarecrow",
    icon: "scarecrow",
    text: "50% fewer bugs",
    price: 300,
    level: 4,
  },
  {
    id: "can2",
    name: "Copper Can",
    icon: "can2",
    text: "Waters 3 plots in a row",
    price: 600,
    level: 8,
  },
  {
    id: "net2",
    name: "Big Net",
    icon: "net",
    text: "Catches bugs in a 3×3 area",
    price: 700,
    level: 10,
  },
  {
    id: "sickle",
    name: "Sickle",
    icon: "sickle",
    text: "Harvests a 3×3 area at once",
    price: 1200,
    level: 14,
  },
  {
    id: "can3",
    name: "Gold Can",
    icon: "can3",
    text: "Waters a 3×3 area",
    price: 4000,
    level: 30,
  },
];
/** Sprinklers, one a row from the top: what the 1st…5th costs and needs. */
export const SPRINKLER_PRICES = [1500, 2200, 3000, 3800, 4500] as const;
export const SPRINKLER_LEVELS = [18, 26, 34, 42, 50] as const;
/** Bugs (migration 044): chance a second for each growing plot while you are on the farm. */
export const BUG_RATE = 0.00005;
/** Each bug slows its crop by this much; a plot holds at most BUG_MAX from nature. */
export const BUG_SLOW = 0.2;
export const BUG_MAX = 2;
/** The plots a tool reaches: 1 that plot, 2 three in its row, 3 the 3×3 around it. */
export function farmArea(plot: number, size: number): number[] {
  const out: number[] = [],
    r = Math.floor(plot / 10),
    c = plot % 10;
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if ((size < 3 && dr) || (size < 2 && dc)) continue;
      const rr = r + dr,
        cc = c + dc;
      if (rr >= 0 && rr < 5 && cc >= 0 && cc < 10) out.push(rr * 10 + cc);
    }
  return out;
}
/** Guard dogs (migration 045), hired by the day. Every dog keeps crows away. */
export type FarmDogId = "gold" | "black" | "cream";
export const FARM_DOGS: readonly {
  id: FarmDogId;
  name: string;
  text: string;
  level: number;
  /** Gold Leaves for 1 day and for 3 days. */
  price1: number;
  price3: number;
  /** Gifts dug up a day. */
  gifts: number;
}[] = [
  {
    id: "gold",
    name: "Goldie",
    text: "Keeps crows away · digs up 1 gift a day",
    level: 3,
    price1: 60,
    price3: 150,
    gifts: 1,
  },
  {
    id: "black",
    name: "Inky",
    text: "Keeps crows away · 30% fewer bugs",
    level: 20,
    price1: 180,
    price3: 450,
    gifts: 0,
  },
  {
    id: "cream",
    name: "Fluffy",
    text: "Keeps crows away · digs up 2 gifts a day · Gold odds ×1.5",
    level: 40,
    price1: 300,
    price3: 750,
    gifts: 2,
  },
];
/**
 * Farmer perks (migration 046): your farmer is the Lobby fighter you had
 * when you last opened the farm. Active perks are used with a tap, each
 * once a Pacific day.
 */
export type FarmPerkActive = "zap" | "downpour" | "warmth";
export const FARM_PERKS: Record<
  string,
  { name: string; text: string; active?: FarmPerkActive }
> = {
  voltkit: { name: "Zap", text: "Clears every bug on the farm", active: "zap" },
  tidefin: {
    name: "Downpour",
    text: "Waters the whole farm",
    active: "downpour",
  },
  cindrake: { name: "Warmth", text: "No bugs for 4 hours", active: "warmth" },
  lumoth: { name: "Early Sun", text: "Crops grow 20% faster" },
  terradon: { name: "Rich Soil", text: "+1 crop per harvest" },
  auralynx: { name: "Shield", text: "Friends can't drop bugs on you" },
  mystowl: { name: "Foresight", text: "See one more weather forecast" },
  duskveil: { name: "Night Stalker", text: "+1 crop for every bug you catch" },
};
/**
 * The champion whose perk a farmer has: the eight newest champions farm with
 * the perk of the original of their element (migration 055,
 * arena_farm_perk_of), the two Nature champions with the perk that suits
 * them (067). The originals have their own.
 */
export const FARM_PERK_OF: Record<string, string> = {
  coilemur: "voltkit",
  pyranda: "cindrake",
  glacelle: "tidefin",
  halcyra: "auralynx",
  sunbara: "lumoth",
  astrabun: "mystowl",
  wombolder: "terradon",
  shadopus: "duskveil",
  // Nature has no original champion: the pangolin hunts bugs (Night Stalker)
  // and the gardener sloth grows crops faster (Early Sun). Migration 067.
  pangrove: "duskveil",
  mossloth: "lumoth",
};
/** Whose perk this farmer farms with (itself for the original eight). */
export const farmPerkOf = (farmer: string) => FARM_PERK_OF[farmer] ?? farmer;
/** A farmer's perk, or null when it has none. */
export const farmPerk = (farmer: string | null | undefined) =>
  farmer ? (FARM_PERKS[farmPerkOf(farmer)] ?? null) : null;
/** Decorations (migration 048): 8 spots; every 2 Charm is +1% farm XP, up to 25%. */
export const FARM_DECOR: readonly {
  id: string;
  name: string;
  price: number;
  charm: number;
  level: number;
  icon: string;
}[] = [
  {
    id: "rock",
    name: "Mossy Rock",
    price: 300,
    charm: 1,
    level: 1,
    icon: "rock",
  },
  {
    id: "bush6",
    name: "Rose Bush",
    price: 450,
    charm: 1,
    level: 3,
    icon: "rose",
  },
  {
    id: "bush7",
    name: "Fern Bush",
    price: 550,
    charm: 1,
    level: 5,
    icon: "fern",
  },
  {
    id: "crates",
    name: "Crates",
    price: 950,
    charm: 1,
    level: 8,
    icon: "crate",
  },
  {
    id: "lamp",
    name: "Street Lamp",
    price: 1350,
    charm: 2,
    level: 12,
    icon: "lamp",
  },
  {
    id: "planter",
    name: "Flower Planter",
    price: 2250,
    charm: 3,
    level: 16,
    icon: "flower",
  },
  {
    id: "pine",
    name: "Pine Tree",
    price: 3200,
    charm: 2,
    level: 22,
    icon: "pine",
  },
  {
    id: "apple",
    name: "Apple Tree",
    price: 4200,
    charm: 4,
    level: 30,
    icon: "apple",
  },
  {
    id: "tower",
    name: "Gazebo",
    price: 6050,
    charm: 10,
    level: 45,
    icon: "gazebo",
  },
  {
    id: "plum",
    name: "Guest Cottage",
    price: 8550,
    charm: 12,
    level: 60,
    icon: "house",
  },
  {
    id: "statue",
    name: "Golden Voltkit Statue",
    price: 30000,
    charm: 15,
    level: 75,
    icon: "statue",
  },
];
export const DECOR_SLOTS = 8;
export const charmBonus = (charm: number) =>
  Math.min(25, Math.floor(charm / 2));
/** The Cow Pasture (migration 049; milk times from 064). */
export const PASTURE = {
  level: 9,
  price: 900,
  /** Farm XP for opening it, and for each milking. */
  xp: 30,
  milkXp: 8,
  /** Storm Milk per milking, and how long the cow takes (seconds). */
  milk: 2,
  milkSeconds: 2 * 3600,
  /** The first milk after the pasture opens. */
  firstMilkSeconds: 20 * 60,
} as const;
/** Storm Milk: a barn good, not a crop. Its price of the day is 0.85–1.35×. */
export const MILK = {
  id: "milk",
  name: "Storm Milk",
  sell: 60,
  multMin: 0.85,
  multMax: 1.35,
} as const;
export const milkPrice = (mult: number) =>
  Math.max(1, Math.round(MILK.sell * mult));
/** A crow eats its crop this many seconds after landing unless shooed. */
export const CROW_SECONDS = 8;
/**
 * Giant crops (migration 050): when a 3×3 square of one of these crops is
 * all ripe, the server rolls once (from a secret salt and the 9 plantings)
 * whether it merges into one giant crop. Each of its 9 crops then gives
 * twice its harvest, with its own mutation, for twice the XP.
 */
export const GIANT = {
  crops: ["carrot", "duskcap", "pumpkin", "melon"] as readonly string[],
  /** The chance for each full square. */
  chance: 0.1,
  /** A square's side, in plots. */
  size: 3,
  /** Each of its crops gives this many times its normal harvest, and XP. */
  harvestMult: 2,
  xpMult: 2,
} as const;
export const canGrowGiant = (crop: string | null | undefined) =>
  !!crop && GIANT.crops.includes(crop);
/** The 9 plots of the square whose top-left plot is `i` (null past the field's edge). */
export function giantPlots(i: number): number[] | null {
  const c = i % FARM_COLS,
    r = Math.floor(i / FARM_COLS);
  if (c + GIANT.size > FARM_COLS || r + GIANT.size > FARM_ROWS) return null;
  const out: number[] = [];
  for (let dr = 0; dr < GIANT.size; dr++)
    for (let dc = 0; dc < GIANT.size; dc++)
      out.push((r + dr) * FARM_COLS + c + dc);
  return out;
}
/**
 * Crops a giant gives: each of its 9 crops twice its harvest (`perHarvest`:
 * 2, or 3 with Rich Soil), less one for each crop a friend snuck.
 */
export const giantYield = (perHarvest: number, snuck = 0) =>
  GIANT.size * GIANT.size * GIANT.harvestMult * perHarvest - snuck;
/** Farm XP for a giant (before Charm): twice its 9 crops' XP. */
export const giantXp = (cropXp: number) =>
  GIANT.size * GIANT.size * GIANT.xpMult * cropXp;
/** Farm weather (migration 039): one per 4-hour UTC window, the same for everyone. */
export type FarmWeatherId =
  "sun" | "rain" | "storm" | "moon" | "frost" | "rainbow";
export const FARM_WEATHERS: readonly {
  id: FarmWeatherId;
  name: string;
  icon: string;
  color: string;
  text: string;
  /** Chance weight (they add up to 100). */
  weight: number;
  /** Growth speed while it lasts. */
  speed: number;
}[] = [
  {
    id: "sun",
    name: "Sunny",
    icon: "sun",
    color: "#ffd65b",
    text: "Crops grow 10% faster",
    weight: 30,
    speed: 1.1,
  },
  {
    id: "rain",
    name: "Rain",
    icon: "rain",
    color: "#4fb3ff",
    text: "Waters every plot · 30% Wet ×1.5",
    weight: 22,
    speed: 1,
  },
  {
    id: "storm",
    name: "Thunderstorm",
    icon: "storm",
    color: "#9fd0ff",
    text: "25% Shocked ×3",
    weight: 14,
    speed: 1,
  },
  {
    id: "moon",
    name: "Moonlit Night",
    icon: "moon",
    color: "#c9a3ff",
    text: "25% Moonlit ×2.5",
    weight: 14,
    speed: 1,
  },
  {
    id: "frost",
    name: "Frost",
    icon: "snow",
    color: "#dff6ff",
    text: "25% Frozen ×2 · crops grow 15% slower",
    weight: 12,
    speed: 0.85,
  },
  {
    id: "rainbow",
    name: "Rainbow",
    icon: "rainbow",
    color: "#ff9bd2",
    text: "Gold odds ×3 · Rainbow odds ×10",
    weight: 8,
    speed: 1,
  },
];
export const FARM_WEATHER_BY_ID = Object.fromEntries(
  FARM_WEATHERS.map((w) => [w.id, w]),
) as Record<FarmWeatherId, (typeof FARM_WEATHERS)[number]>;
/** A weather window lasts 4 hours. */
export const FARM_WEATHER_SECONDS = 4 * 3600;
/** Mutations a ripe crop can have, and what they do to its sell price. */
export const MUTATIONS: readonly { id: string; name: string; mult: number }[] =
  [
    { id: "gold", name: "Gold", mult: 5 },
    { id: "rainbow", name: "Rainbow", mult: 15 },
    { id: "shock", name: "Shocked", mult: 3 },
    { id: "moon", name: "Moonlit", mult: 2.5 },
    { id: "frost", name: "Frozen", mult: 2 },
    { id: "wet", name: "Wet", mult: 1.5 },
  ];
/** The sell multiplier of a mutation key ("" or names joined by "+"). */
export function mutationMultiplier(key: string) {
  return key
    ? key
        .split("+")
        .reduce((x, m) => x * (MUTATIONS.find((v) => v.id === m)?.mult ?? 1), 1)
    : 1;
}
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
  /** Bugs on the plot (migration 044; absent before it). */
  pests?: number;
}
/** Tools a farm owns (migration 044). */
export interface FarmTools {
  /** 1 Wood, 2 Copper (3 in a row), 3 Gold (3×3). */
  can: 1 | 2 | 3;
  bigNet: boolean;
  sickle: boolean;
  scarecrow: boolean;
  /** Rows with a sprinkler, counted from the top. */
  sprinklers: number;
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
  /** Migration 044; absent before it. */
  tools?: FarmTools;
  barn: { crop: string; mutation: string; qty: number }[];
  barnCap: number;
  barnUpgrades: number;
  /** Today's market multiplier per crop, and the HOT crop. */
  market: { day: string; mult: Record<string, number>; hot: string };
  /** Seed stock this restock window: crop → seeds left for you. */
  shop: { window: string; restockAt: string; stock: Record<string, number> };
  /** Harvests per crop (the crop book). */
  harvests: Record<string, number>;
  /** The order board (migration 040; absent before it). */
  orders?: FarmOrder[];
  /** The dog on guard (migration 045): since and until are ISO times. */
  dog?: { type: FarmDogId; since: string; until: string } | null;
  /** The last gifts dogs dug up, newest first (migration 045). */
  dogGifts?: {
    at: string;
    dog: FarmDogId;
    kind: "seeds" | "leaves" | "super";
    crop: string | null;
    qty: number;
  }[];
  /** Crows on plots: plot index → when it landed (migration 045). */
  crows?: Record<string, string>;
  /** Decorations in the 8 spots, Charm and free decorations (migration 048). */
  decor?: { slot: number; item: string }[];
  charm?: number;
  decorCredits?: Record<string, number>;
  /** The Cow Pasture, when its milk is ready and Storm Milk's price today (migration 049). */
  pasture?: boolean;
  milkAt?: string | null;
  milkMult?: number;
  /** Friends who visited lately, newest first (migration 047). */
  visits?: FarmVisitEvent[];
  /** Giant crops on the farm, and how many of each crop grew giant (migration 050). */
  giants?: FarmGiant[];
  giantsGrown?: Record<string, number>;
  /** Your farmer, the active perks used today and Warmth's end (migration 046). */
  farmer?: string;
  perksUsed?: FarmPerkActive[];
  warmUntil?: string | null;
  /** The weather now and the forecast (migration 039; absent before it). */
  weather?: {
    now: FarmWeatherId | "none";
    next: FarmWeatherId | "none";
    later: FarmWeatherId | "none";
    until: string;
  };
  leaves: number;
}
/** A giant crop (migration 050): its square's top-left plot, its 9 plots, when it formed. */
export interface FarmGiant {
  i: number;
  crop: string;
  plots: number[];
  formedAt: string;
}
/** Friends' farms (migration 047). */
export interface FarmVisitEvent {
  id: number;
  at: string;
  name: string;
  kind: "water" | "catch" | "sneak" | "caught" | "prank";
  crop: string | null;
  /** For "caught": the fine paid to you. */
  n: number;
}
export interface FarmFriend {
  id: string;
  name: string;
  fighter: string;
  level: number;
  dog: FarmDogId | null;
  /** Bugs on their farm, and ripe plots you can still try to sneak from. */
  bugs: number;
  ripe: number;
}
export interface FarmVisit {
  id: string;
  name: string;
  fighter: string;
  level: number;
  farmer: string;
  now: string;
  plots: (Omit<FarmPlot, "fertilizer"> & { sneak: boolean })[];
  dog: FarmDogId | null;
  scarecrow: boolean;
  sprinklers: number;
  /** Migration 049: they have a Cow Pasture. */
  pasture?: boolean;
  /** Migration 050: their giant crops. */
  giants?: FarmGiant[];
  /** What you did on friends' farms today. */
  today: { helpXp: number; sneaks: number; pranks: number };
}
export type FarmVisitAction = {
  a: "water" | "catch" | "sneak" | "prank";
  plot: number;
};
export interface FarmVisitResult {
  farm: FarmVisit;
  results: (
    | {
        ok: true;
        xp?: number;
        crop?: string;
        qty?: number;
        mutation?: string;
        caught?: FarmDogId;
        fine?: number;
        pranksLeft?: number;
      }
    | { ok: false; error: string }
  )[];
  xp?: number;
  leaves?: number;
  repeated?: boolean;
}
/** One action in a farm request (arena_farm_act). */
export type FarmAction =
  | { a: "plant"; plot: number; crop: string }
  | { a: "water" | "dig" | "buy-land"; plot: number }
  | { a: "harvest"; plot: number; tool?: "sickle" }
  /** Any plot of a giant crop (migration 050). */
  | { a: "harvest-giant"; plot: number }
  | { a: "catch"; plot: number; tool?: "net" }
  | { a: "buy-tool"; tool: FarmToolId }
  | { a: "hire-dog"; dog: FarmDogId; days: 1 | 3 }
  | { a: "shoo"; plot: number }
  | { a: "farmer"; id: string }
  | { a: "perk" }
  | { a: "decor"; slot: number; item: string }
  | { a: "decor-remove"; slot: number }
  | { a: "fertilize"; plot: number; kind: FertilizerKind }
  | { a: "buy-seeds"; crop: string; qty: number }
  | { a: "sell"; crop: string; mutation: string; qty: number }
  | { a: "buy-fertilizer"; kind: FertilizerKind }
  | { a: "upgrade-barn" };
export interface FarmActResult {
  farm: FarmState;
  results: (
    | {
        ok: true;
        crop?: string;
        qty?: number;
        xp?: number;
        leaves?: number;
        mutation?: string;
        /** Water with a bigger can: the plots it watered. */
        watered?: number[];
        /** Bugs caught. */
        caught?: number;
        /** The Sickle: each plot it harvested; barnFull when it stopped early. */
        harvested?: {
          plot: number;
          crop: string;
          qty: number;
          xp: number;
          mutation: string;
        }[];
        barnFull?: boolean;
        /** A giant crop's harvest: its top-left plot (the crops are in `harvested`). */
        giant?: number;
        tool?: FarmToolId;
        cost?: number;
      }
    | { ok: false; error: string }
  )[];
  combo?: number;
  xp?: number;
  /** The same request id was already applied; nothing changed. */
  repeated?: boolean;
}
/** One slot of the order board: an order, or a wait for the next one. */
export interface FarmOrder {
  slot: number;
  /** [[crop, count], …], or null while the slot waits. */
  items: [string, number][] | null;
  leaves: number | null;
  xp: number | null;
  bonus: FertilizerKind | null;
  who: string | null;
  face: string | null;
  waitUntil: string | null;
}
export interface FarmOrderResult {
  farm: FarmState;
  ok: boolean;
  error?: string | null;
  repeated?: boolean;
  gained?: {
    leaves: number;
    xp: number;
    bonus: FertilizerKind | null;
    who: string;
  } | null;
}

/** Friendship levels (migration 057): friendship days needed for each. */
export const FARM_BONDS = [
  { name: "Sprout", days: 0 },
  { name: "Bud", days: 3 },
  { name: "Bloom", days: 7 },
  { name: "Grove", days: 30 },
  { name: "Evergreen", days: 90 },
] as const;
/** Farm invite rewards: invites that reached farm level 10. */
export const FARM_INVITE_STEPS = [
  { invites: 1, reward: "200 Gold Leaves" },
  { invites: 3, reward: "300 Gold Leaves + a Gold Fertilizer" },
  { invites: 5, reward: "1,000 Gold Leaves" },
] as const;
/** What the person you invite gets when they reach farm level 10. */
export const FARM_INVITE_WELCOME = 200;
/** Gift parcels you can open in a Pacific day. */
export const FARM_GIFT_OPEN_CAP = 20;
export interface FarmGiftFriend {
  id: string;
  name: string;
  fighter: string | null;
  level: number;
  /** Friendship days (a day a parcel between you was opened). */
  days: number;
  /** Index into FARM_BONDS. */
  bond: number;
  /** You sent them today's parcel. */
  sent: boolean;
  /** Parcels from them waiting to be opened. */
  waiting: number;
}
export interface FarmGiftsState {
  day: string;
  openedToday: number;
  openCap: number;
  friends: FarmGiftFriend[];
  invites: {
    code: string;
    joined: number;
    counted: number;
    claimed: number[];
    invitedBy: string | null;
  };
}
export interface FarmGiftResult {
  ok: boolean;
  error?: string;
  crop?: string;
  qty?: number;
  state: FarmGiftsState;
}

/** The Supply Balloon (migration 058). */
export const BALLOON = {
  crates: 6,
  /** Crates you can ask friends for, per balloon. */
  ask: 3,
  /** Launch pays this × the crates' market value. */
  pay: 1.6,
  /** A helper earns this × the crate's market value… */
  help: 1.2,
  /** …up to this many leaves a Pacific day. */
  helpCap: 600,
  /** Minutes until the next balloon. */
  nextMinutes: 60,
} as const;
export interface FarmCrate {
  crop: string;
  qty: number;
  state: "open" | "asked" | "done";
  /** The friend who filled it, if a friend did. */
  by: string | null;
}
export interface FarmBalloon {
  crates: FarmCrate[] | null;
  arrivesAt: string | null;
  launches: number;
  leaves: number | null;
  xp: number | null;
  helperStars: number;
  helperLeavesToday: number;
  helperCap: number;
  /** Helper id → name. */
  helpers: Record<string, string>;
}
export interface FarmBalloonResult {
  balloon: FarmBalloon;
  ok: boolean;
  error?: string | null;
  repeated?: boolean;
  gained?: { leaves: number; xp: number; bonus: string } | null;
}
export interface FarmHelpRequest {
  friend: string;
  name: string;
  fighter: string | null;
  slot: number;
  crop: string;
  qty: number;
  reward: number;
  have: number;
}
export interface FarmHelpList {
  requests: FarmHelpRequest[];
  helperStars: number;
  helperLeavesToday: number;
  helperCap: number;
}
export interface FarmHelpResult {
  help: FarmHelpRequest[];
  ok: boolean;
  error?: string | null;
  repeated?: boolean;
  gained?: { leaves: number; star: number } | null;
}

/** The Farm Stall (migration 059). */
export const STALL = {
  shelves: 6,
  maxQty: 10,
  /** A shelf's price: this range × what the Market pays you today. */
  minPrice: 0.5,
  maxPrice: 1.5,
  /** The stall keeps 10% of each sale. */
  fee: 0.1,
  /** Stall sales pay at most this many leaves a Pacific day. */
  earnCap: 3000,
  /** Shelves you can buy a Pacific day. */
  buyCap: 10,
} as const;
/** The price band for a shelf of `qty` at a unit Market price. */
export function stallPriceRange(unit: number, qty: number) {
  return {
    min: Math.ceil(unit * qty * STALL.minPrice),
    max: Math.floor(unit * qty * STALL.maxPrice),
  };
}
export interface FarmStallShelf {
  slot: number;
  crop: string;
  mutation: string;
  qty: number;
  price: number;
  sold: boolean;
  buyer: string | null;
  /** What collecting pays (price less the fee), once sold. */
  collect: number | null;
}
export interface FarmPaperItem {
  seller: string;
  name: string;
  fighter: string | null;
  slot: number;
  crop: string;
  mutation: string;
  qty: number;
  price: number;
  /** What the Market would pay you for the same crops today. */
  market: number;
}
export interface FarmStall {
  shelves: FarmStallShelf[];
  earnedToday: number;
  boughtToday: number;
  earnCap: number;
  buyCap: number;
  paper: FarmPaperItem[];
}
export interface FarmStallResult extends FarmStall {
  ok: boolean;
  error?: string | null;
  repeated?: boolean;
  gained?: Record<string, unknown> | null;
}
export interface FarmStallAction {
  kind: "list" | "unlist" | "collect" | "buy";
  slot: number;
  crop?: string;
  mutation?: string;
  qty?: number;
  price?: number;
  seller?: string;
}

/** Live visits and Harvest Parties (migration 061). */
export const PARTY = {
  /** Extra crops a harvest gives during a party. */
  bonus: 1,
  /** Party minutes a farm gets a Pacific day. */
  minutes: 60,
} as const;
export const FARM_EMOTES = {
  wave: "👋",
  heart: "❤️",
  party: "🎉",
  laugh: "😄",
} as const;
export type FarmEmote = keyof typeof FARM_EMOTES;
export interface FarmHere {
  owner: string;
  present: {
    id: string;
    name: string;
    fighter: string | null;
    /** This one owns the farm. */
    owner: boolean;
    emote: FarmEmote | null;
    emoteAt: string | null;
  }[];
  party: boolean;
  /** Party seconds left today on this farm. */
  partyLeft: number;
}
export interface FarmTourEntry {
  id: string;
  name: string;
  fighter: string | null;
  level: number;
  me: boolean;
  likes: number;
  liked: boolean;
  /** The owner is on their farm now. */
  here: boolean;
}
export interface FarmLikeResult {
  ok: boolean;
  error?: string | null;
  tour: FarmTourEntry[];
}
