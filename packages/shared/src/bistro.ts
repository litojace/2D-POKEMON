/*
 * Element Bistro: the catalog and the rules, shared by the client and the
 * tests. The rules that change coins, stoves, the counter, the staff and the
 * floor plan run in the database (supabase/migrations/068_bistro.sql), on the
 * server's clock; the client runs these same rules to show an action at once
 * and to animate, then takes the server's answer. Tests check the numbers and
 * the rules agree with the SQL (tests/integration/bistro.test.ts).
 *
 * A restaurant on an isometric grid: cook dishes on the stoves, plate them
 * onto the counter, and creatures come in, sit at your tables and eat. The
 * genre's familiar beats, in our own take: cook-and-serve with a
 * perfect-timing tap, a counter of ready servings, chairs that seat a
 * customer only next to a table, tips that grow with a serving streak, VIP
 * guests, a daily special and rush hours; staff who keep it open while you
 * are away.
 */

import { CHARACTERS } from "./index.js";

/** The starting dining room's grid (columns along x, rows along y). */
export const COLS = 11;
export const ROWS = 9;
export interface RoomSize {
  cols: number;
  rows: number;
}
/** Expanding the dining room: each step adds two columns and a row (the kitchen and the door stay). */
export const sizeOf = (lv: number): RoomSize => ({
  cols: COLS + 2 * lv,
  rows: ROWS + lv,
});
export const BASE_SIZE: RoomSize = sizeOf(0);
export const EXPAND_STEPS = [
  { level: 4, price: 800 },
  { level: 8, price: 2500 },
  { level: 12, price: 6000 },
  { level: 16, price: 12000 },
  { level: 20, price: 20000 },
] as const;
export const MAX_SIZE_LV = EXPAND_STEPS.length;
export const MAX_SIZE = sizeOf(MAX_SIZE_LV);
/** Where customers come in (a tile on the left wall's front end). */
export const DOOR = { x: 0, y: 7 } as const;
/** Stove slots along the back wall, the chef's lane in front of them. */
export const STOVE_TILES = [
  { x: 1, y: 0 },
  { x: 2, y: 0 },
  { x: 3, y: 0 },
  { x: 4, y: 0 },
] as const;
export const MAX_STOVES = STOVE_TILES.length;
/** The serving counter runs x 0..5 on row 2; dishes sit on x 1..4. */
export const COUNTER_ROW = 2;
export const COUNTER_X0 = 0;
export const COUNTER_X1 = 5;
export const COUNTER_SLOTS = 4;
/** Where a waiter stands to pick up the dish in counter slot i. */
export const pickupTile = (slot: number) => ({ x: 1 + slot, y: 3 });
/** The waiters' resting spot, by the counter's end. */
export const WAITER_HOME = { x: 6, y: 3 } as const;

export type DishId =
  | "goicuon"
  | "banhmi"
  | "pho"
  | "buncha"
  | "comtam"
  | "che"
  | "caphe"
  | "lau"
  | "banhxeo"
  | "miquang"
  | "chaca"
  | "flan"
  | "banhcanh"
  | "phoenix";
export interface Dish {
  id: DishId;
  name: string;
  /** A short line for the cook sheet. */
  blurb: string;
  level: number;
  /** Seconds on the stove. */
  seconds: number;
  /** Bistro coins to start it. */
  cost: number;
  servings: number;
  /** Coins a serving, before tips. */
  price: number;
  /** XP for cooking it (plated) — serving adds 1 each. */
  xp: number;
}
export const DISHES: readonly Dish[] = [
  {
    id: "goicuon",
    name: "Spring Rolls",
    blurb: "Fresh rice-paper rolls",
    level: 1,
    seconds: 15,
    cost: 10,
    servings: 6,
    price: 4,
    xp: 3,
  },
  {
    id: "banhmi",
    name: "Banh Mi",
    blurb: "Crusty filled baguette",
    level: 1,
    seconds: 30,
    cost: 18,
    servings: 8,
    price: 5,
    xp: 5,
  },
  {
    id: "pho",
    name: "Pho",
    blurb: "Slow broth, rice noodles",
    level: 2,
    seconds: 60,
    cost: 40,
    servings: 10,
    price: 8,
    xp: 9,
  },
  {
    id: "buncha",
    name: "Bun Cha",
    blurb: "Grilled pork and noodles",
    level: 3,
    seconds: 120,
    cost: 70,
    servings: 12,
    price: 11,
    xp: 14,
  },
  {
    id: "comtam",
    name: "Broken Rice",
    blurb: "Rice, grilled chop, egg",
    level: 4,
    seconds: 180,
    cost: 100,
    servings: 14,
    price: 13,
    xp: 20,
  },
  {
    id: "che",
    name: "Rainbow Sweet Cup",
    blurb: "Beans, jelly, coconut, ice",
    level: 5,
    seconds: 300,
    cost: 150,
    servings: 16,
    price: 17,
    xp: 28,
  },
  {
    id: "caphe",
    name: "Iced Milk Coffee",
    blurb: "Slow-drip coffee on ice",
    level: 6,
    seconds: 420,
    cost: 160,
    servings: 18,
    price: 16,
    xp: 34,
  },
  {
    id: "lau",
    name: "Elemental Hotpot",
    blurb: "Bubbling shared pot",
    level: 7,
    seconds: 600,
    cost: 300,
    servings: 20,
    price: 30,
    xp: 50,
  },
  // Later dishes (migration 100): something new to cook up to level 26.
  {
    id: "banhxeo",
    name: "Sizzling Crepe",
    blurb: "Crisp rice crepe, folded",
    level: 10,
    seconds: 240,
    cost: 180,
    servings: 18,
    price: 20,
    xp: 38,
  },
  {
    id: "miquang",
    name: "Turmeric Noodles",
    blurb: "Golden noodles, peanuts",
    level: 13,
    seconds: 480,
    cost: 260,
    servings: 20,
    price: 26,
    xp: 52,
  },
  {
    id: "chaca",
    name: "Dill Fish Grill",
    blurb: "Sizzling fish with dill",
    level: 16,
    seconds: 720,
    cost: 400,
    servings: 22,
    price: 36,
    xp: 70,
  },
  {
    id: "flan",
    name: "Caramel Flan",
    blurb: "Silky custard, dark caramel",
    level: 19,
    seconds: 360,
    cost: 300,
    servings: 24,
    price: 28,
    xp: 60,
  },
  {
    id: "banhcanh",
    name: "Crab Noodle Soup",
    blurb: "Thick noodles, rich broth",
    level: 22,
    seconds: 900,
    cost: 600,
    servings: 24,
    price: 50,
    xp: 95,
  },
  {
    id: "phoenix",
    name: "Phoenix Feast",
    blurb: "The house's grand platter",
    level: 26,
    seconds: 1200,
    cost: 900,
    servings: 26,
    price: 70,
    xp: 130,
  },
];
export const DISH_BY_ID: Record<DishId, Dish> = Object.fromEntries(
  DISHES.map((d) => [d.id, d]),
) as Record<DishId, Dish>;
export const isDish = (v: unknown): v is DishId =>
  typeof v === "string" && Object.hasOwn(DISH_BY_ID, v);

/* ───────────── ingredients and dish levels (docs/bistro-gdd.md §2) ─────────────
   Each dish has its own level, 1 to 10: cooking it builds mastery, and a
   level-up takes mastery, ingredients and coins. A level raises its price
   12% and adds a serving every three levels. Ingredients come from the
   Market, from the Farm's barn, from meals at friends' bistros, and with
   each bistro level. Gourmet points add up the dishes' levels. */
export type Ingredient =
  | "rice"
  | "flour"
  | "herbs"
  | "pork"
  | "egg"
  | "beans"
  | "coconut"
  | "coffee"
  | "milk"
  | "chili"
  | "spice";
/** The ten everyday ingredients, in a fixed order (Spice is rare). */
export const BASE_INGREDIENTS = [
  "rice",
  "flour",
  "herbs",
  "pork",
  "egg",
  "beans",
  "coconut",
  "coffee",
  "milk",
  "chili",
] as const satisfies readonly Ingredient[];
export const INGREDIENT_NAMES: Record<Ingredient, string> = {
  rice: "Rice",
  flour: "Flour",
  herbs: "Herbs",
  pork: "Pork",
  egg: "Eggs",
  beans: "Beans",
  coconut: "Coconut",
  coffee: "Coffee",
  milk: "Milk",
  chili: "Chili",
  spice: "Spice",
};
export const isIngredient = (v: unknown): v is Ingredient =>
  typeof v === "string" && Object.hasOwn(INGREDIENT_NAMES, v);
export const RECIPES: Record<DishId, readonly [Ingredient, Ingredient]> = {
  goicuon: ["rice", "herbs"],
  banhmi: ["flour", "pork"],
  pho: ["flour", "herbs"],
  buncha: ["flour", "pork"],
  comtam: ["rice", "egg"],
  che: ["beans", "coconut"],
  caphe: ["coffee", "milk"],
  lau: ["chili", "beans"],
  banhxeo: ["rice", "pork"],
  miquang: ["chili", "egg"],
  chaca: ["herbs", "chili"],
  flan: ["egg", "milk"],
  banhcanh: ["rice", "chili"],
  phoenix: ["pork", "coconut"],
};
export const DISH_MAX_LEVEL = 10;
export const PANTRY_MAX = 99;
/** Coins for a level-up from L (× the dish's cost), and Spice, by L. */
const DISHUP_COINS = [2, 5, 10, 16, 22, 30, 40, 50, 60] as const;
const DISHUP_SPICE = [0, 0, 0, 0, 1, 1, 2, 2, 3] as const;
export interface DishLevel {
  lv: number;
  /** Batches cooked toward the next level (a perfect one counts twice). */
  mastery: number;
}
export const dishLevel = (s: BistroState, dish: DishId) =>
  s.dishLv[dish]?.lv ?? 1;
export const masteryNeed = (lv: number) => 5 * lv;
/** What the next level of a dish takes (null at the top). */
export function dishUpCost(dish: DishId, lv: number) {
  if (lv >= DISH_MAX_LEVEL) return null;
  const d = DISH_BY_ID[dish];
  return {
    mastery: masteryNeed(lv),
    coins: d.cost * DISHUP_COINS[lv - 1],
    each: lv,
    spice: DISHUP_SPICE[lv - 1],
  };
}
/** A plate's price at a level (before specials and tips). */
export const priceAt = (dish: DishId, lv: number, stars = 0) =>
  // Whole numbers until the last step (the database rounds the same way).
  Math.round(
    (DISH_BY_ID[dish].price * (100 + 12 * (lv - 1)) * (10 + stars)) / 1000,
  );
export const servingsAt = (dish: DishId, lv: number) =>
  DISH_BY_ID[dish].servings + Math.floor((lv - 1) / 3);
/** Gourmet points: each level above 1, times the level the dish opens at. */
export const gourmetOf = (s: BistroState) =>
  DISHES.reduce((n, d) => n + (dishLevel(s, d.id) - 1) * d.level, 0);
export const GOURMET_RANKS = [
  { from: 0, name: "Street Cook" },
  { from: 20, name: "Home Chef" },
  { from: 60, name: "Bistro Chef" },
  { from: 120, name: "Master Chef" },
  { from: 200, name: "Grand Gourmet" },
] as const;
export const gourmetRank = (g: number) =>
  [...GOURMET_RANKS].reverse().find((r) => g >= r.from)!.name;
export function addIngredient(s: BistroState, id: Ingredient, n: number) {
  s.pantry[id] = Math.min(PANTRY_MAX, (s.pantry[id] ?? 0) + n);
}
/** A bistro level's gift: two of one ingredient and one of the next. */
export const levelIngredients = (level: number): [Ingredient, number][] => [
  [BASE_INGREDIENTS[(level * 3) % 10], 2],
  [BASE_INGREDIENTS[(level * 3 + 1) % 10], 1],
];
export function dishUp(s: BistroState, dish: DishId): Result {
  const d = DISH_BY_ID[dish];
  if (!d) return fail("Unknown dish.");
  if (d.level > s.level) return fail(`Opens at level ${d.level}.`);
  const lv = dishLevel(s, dish);
  const c = dishUpCost(dish, lv);
  if (!c) return fail(`${d.name} is at the top level.`);
  const m = s.dishLv[dish]?.mastery ?? 0;
  if (m < c.mastery)
    return fail(`Cook ${c.mastery - m} more batches of ${d.name} first.`);
  for (const ing of RECIPES[dish])
    if ((s.pantry[ing] ?? 0) < c.each)
      return fail(`You need ${c.each} ${INGREDIENT_NAMES[ing]}.`);
  if ((s.pantry.spice ?? 0) < c.spice)
    return fail(`You need ${c.spice} Spice.`);
  if (s.coins < c.coins) return fail(`You need ${c.coins} coins.`);
  s.coins -= c.coins;
  for (const ing of RECIPES[dish])
    s.pantry[ing] = (s.pantry[ing] ?? 0) - c.each;
  if (c.spice) s.pantry.spice = (s.pantry.spice ?? 0) - c.spice;
  s.dishLv[dish] = { lv: lv + 1, mastery: 0 };
  return { ok: true };
}
/* The Market: four ingredients every four hours (the same for everyone),
   20 to 60 coins each, up to 5 of each a Pacific day. */
export const MARKET_PERIOD_MS = 4 * 3600_000;
export const MARKET_DAILY = 5;
export function marketOffers(now: number): { id: Ingredient; price: number }[] {
  const slot = Math.floor(now / MARKET_PERIOD_MS);
  const start = slot % 10;
  const step = [1, 3, 7, 9][Math.floor(slot / 10) % 4];
  return [0, 1, 2, 3].map((j) => {
    const i = (start + j * step) % 10;
    return { id: BASE_INGREDIENTS[i], price: 20 + ((slot * 7 + i * 13) % 41) };
  });
}
/** When the Market changes next (ms). */
export const marketNext = (now: number) =>
  (Math.floor(now / MARKET_PERIOD_MS) + 1) * MARKET_PERIOD_MS;
/* The Farm's barn: three plain crops (or milk) make one ingredient, up to
   30 a Pacific day; never back the other way. */
export const FARM_TO_BISTRO: Record<string, Ingredient> = {
  wheat: "flour",
  mint: "herbs",
  pepper: "chili",
  lotus: "beans",
  milk: "milk",
};
export const FARM_PER_INGREDIENT = 3;
export const FARM_DAILY = 30;
/** Buy at the Market: `bought` is how many of it you bought today. */
export function buyIngredient(
  s: BistroState,
  id: Ingredient,
  qty: number,
  now: number,
  bought: number,
): Result {
  const o = marketOffers(now).find((x) => x.id === id);
  if (!o) return fail("That's not at the Market right now.");
  if (!Number.isInteger(qty) || qty < 1 || qty > MARKET_DAILY)
    return fail("Choose how many to buy.");
  if (bought + qty > MARKET_DAILY)
    return fail(`At most ${MARKET_DAILY} ${INGREDIENT_NAMES[id]} a day.`);
  if ((s.pantry[id] ?? 0) + qty > PANTRY_MAX)
    return fail("Your pantry can't hold more of that.");
  if (s.coins < o.price * qty) return fail(`You need ${o.price * qty} coins.`);
  s.coins -= o.price * qty;
  addIngredient(s, id, qty);
  return { ok: true };
}
/** Farm crops into the pantry: `have` plain ones in the barn, `sent` today. */
export function fromFarm(
  s: BistroState,
  crop: string,
  qty: number,
  have: number,
  sent: number,
): Result {
  const ing = Object.hasOwn(FARM_TO_BISTRO, crop) ? FARM_TO_BISTRO[crop] : null;
  if (!ing) return fail("That doesn't go in the bistro.");
  if (!Number.isInteger(qty) || qty < 1 || qty > FARM_DAILY)
    return fail("Choose how many to bring.");
  if (sent + qty > FARM_DAILY)
    return fail(`At most ${FARM_DAILY} ingredients a day from the Farm.`);
  if (have < qty * FARM_PER_INGREDIENT)
    return fail(`You need ${qty * FARM_PER_INGREDIENT} in the Farm's barn.`);
  if ((s.pantry[ing] ?? 0) + qty > PANTRY_MAX)
    return fail("Your pantry can't hold more of that.");
  addIngredient(s, ing, qty);
  return { ok: true };
}

/** The last part of the bar where a tap cooks it to perfection. */
export const PERFECT_FROM = 0.78;
export const PERFECT_TO = 0.96;
/** A perfect dish gives this many extra servings. */
export const PERFECT_BONUS = 2;

export type ItemKind =
  | "table"
  | "chair"
  | "plant"
  | "lamp"
  | "bonsai"
  | "luckycat"
  | "jukebox"
  | "aquarium"
  | "fountain"
  | "corner"
  | "pumpkin"
  | "haybale"
  | "lantern"
  | "blossom"
  | "trophy"
  | "rug";
export interface ItemDef {
  kind: ItemKind;
  name: string;
  price: number;
  level: number;
  /** Charm: makes customers patient and come more often. */
  charm: number;
  /** Rugs lie on the floor: walkable, and things stand on them. */
  floor?: boolean;
  /** Footprint in tiles (rugs are 2 × 2). */
  w?: number;
  h?: number;
  group: "furniture" | "decor";
  /** An event's item: bought with event tokens while the event is on. */
  event?: string;
  tokens?: number;
  /** Only given (a regular's thank-you), never sold. */
  gift?: boolean;
}
export const ITEMS: readonly ItemDef[] = [
  {
    kind: "table",
    name: "Round Table",
    price: 60,
    level: 1,
    charm: 0,
    group: "furniture",
  },
  {
    kind: "chair",
    name: "Cushioned Chair",
    price: 25,
    level: 1,
    charm: 0,
    group: "furniture",
  },
  {
    kind: "plant",
    name: "Potted Fern",
    price: 40,
    level: 1,
    charm: 2,
    group: "decor",
  },
  {
    kind: "rug",
    name: "Woven Rug",
    price: 70,
    level: 1,
    charm: 2,
    floor: true,
    w: 2,
    h: 2,
    group: "decor",
  },
  {
    kind: "lamp",
    name: "Paper Lantern",
    price: 80,
    level: 2,
    charm: 3,
    group: "decor",
  },
  {
    kind: "bonsai",
    name: "Bonsai Stand",
    price: 120,
    level: 3,
    charm: 4,
    group: "decor",
  },
  {
    kind: "luckycat",
    name: "Waving Cat",
    price: 150,
    level: 3,
    charm: 5,
    group: "decor",
  },
  {
    kind: "jukebox",
    name: "Jukebox",
    price: 250,
    level: 4,
    charm: 6,
    group: "decor",
  },
  {
    kind: "aquarium",
    name: "Aquarium",
    price: 300,
    level: 5,
    charm: 8,
    group: "decor",
  },
  {
    kind: "fountain",
    name: "Element Fountain",
    price: 420,
    level: 6,
    charm: 10,
    group: "decor",
  },
  {
    // Staff rest here: each of up to two takes a quarter off the drain.
    kind: "corner",
    name: "Staff Corner",
    price: 600,
    level: 5,
    charm: 1,
    group: "furniture",
  },
  // Event items (migration 100): tokens only, while their event is on.
  {
    kind: "pumpkin",
    name: "Pumpkin Lantern",
    price: 1,
    level: 1,
    charm: 4,
    group: "decor",
    event: "harvest",
    tokens: 30,
  },
  {
    kind: "haybale",
    name: "Hay Bale",
    price: 1,
    level: 1,
    charm: 3,
    group: "decor",
    event: "harvest",
    tokens: 20,
  },
  {
    kind: "lantern",
    name: "Red Lantern Stand",
    price: 1,
    level: 1,
    charm: 4,
    group: "decor",
    event: "lantern",
    tokens: 30,
  },
  {
    kind: "blossom",
    name: "Plum Blossom",
    price: 1,
    level: 1,
    charm: 5,
    group: "decor",
    event: "lantern",
    tokens: 40,
  },
  // A regular's thanks at the end of their story.
  {
    kind: "trophy",
    name: "Golden Plate",
    price: 1,
    level: 1,
    charm: 6,
    group: "decor",
    gift: true,
  },
];
export const ITEM_BY_KIND: Record<ItemKind, ItemDef> = Object.fromEntries(
  ITEMS.map((i) => [i.kind, i]),
) as Record<ItemKind, ItemDef>;
const isItemKind = (v: unknown): v is ItemKind =>
  typeof v === "string" && Object.hasOwn(ITEM_BY_KIND, v);

export const FLOORS = [
  { id: "checker", name: "Cream Checker", price: 0 },
  { id: "wood", name: "Honey Planks", price: 150 },
  { id: "teal", name: "Teal Tiles", price: 220 },
] as const;
export const WALLS = [
  { id: "butter", name: "Butter & Wainscot", price: 0 },
  { id: "mint", name: "Mint Stripes", price: 150 },
  { id: "brick", name: "Red Brick", price: 220 },
] as const;
export type FloorId = (typeof FLOORS)[number]["id"];
export type WallId = (typeof WALLS)[number]["id"];

/** Price of the next stove (the 3rd, then the 4th). */
export const STOVE_PRICES = [0, 0, 200, 450] as const;

/* Staff: cooks run a stove on their own (and keep cooking while you are
   away); waiters serve and clear. Each has a level that makes them faster. */
export type Role = "cook" | "waiter" | "janitor";
export const ROLES: readonly Role[] = ["cook", "waiter", "janitor"];
export interface Staff {
  id: number;
  /** A roster creature id (a friend's Lobby fighter for a friend). */
  char: string;
  role: Role;
  level: number;
  /** What a cook makes (cooks only). */
  dish: DishId;
  /** Energy as of the bistro's lastSeen (migration 073); full when left out. */
  energy?: number;
  /** When they last had a staff meal (ms), for the cooldown. */
  fedAt?: number;
  /** A friend working here (migration 073): their account and name. */
  friend?: { id: string; name: string };
}
export const STAFF_MAX_LEVEL = 10;
/** Hiring the n-th cook or waiter: the bistro level it opens at, and its price. */
export const HIRE_STEPS: Record<
  Role,
  readonly { level: number; price: number }[]
> = {
  cook: [
    { level: 2, price: 250 },
    { level: 5, price: 900 },
    { level: 9, price: 2000 },
  ],
  waiter: [
    { level: 1, price: 0 },
    { level: 3, price: 400 },
    { level: 6, price: 1000 },
  ],
  janitor: [
    { level: 4, price: 300 },
    { level: 8, price: 900 },
  ],
};
/** Each staff level after the first: 12% quicker. */
export const staffSpeed = (level: number) => 1 + 0.12 * (level - 1);

/* Energy (docs/bistro-gdd.md §1.4): one bar for hungry and tired. Work
   drains it by the hour (less with Staff Corners); a tired worker is
   slower, never stopped, so the bistro still runs while you are away. A
   staff meal (a serving from the counter) gives some back; so does the
   rest after a shift, and a friend's meal here fills their own bar. */
export const ENERGY_DRAIN: Record<Role, number> = {
  cook: 14,
  waiter: 12,
  janitor: 10,
};
/** Energy back an hour after the shift is over. */
export const ENERGY_REST = 15;
export const FEED_ENERGY = 50;
export const FEED_COOLDOWN_MS = 10 * 60_000;
/** Friends work 10% faster. */
export const FRIEND_BONUS = 1.1;
export const energyMax = (level: number) => 100 + 10 * (level - 1);
export const mood = (energy: number) =>
  energy >= 50 ? 1 : energy >= 20 ? 0.85 : 0.6;
export const moodName = (energy: number) =>
  energy >= 50 ? "Fresh" : energy >= 20 ? "Hungry" : "Exhausted";
/** Staff Corners that count (each takes a quarter off the drain). */
export const cornerCount = (items: readonly Item[]) =>
  Math.min(2, items.filter((i) => i.kind === "corner").length);
export const drainPerHour = (role: Role, corners: number) =>
  ENERGY_DRAIN[role] * (1 - 0.25 * corners);
/** Energy after `ms` of work from `e`. */
export const afterWork = (st: Staff, e: number, ms: number, corners: number) =>
  Math.max(0, e - (drainPerHour(st.role, corners) * ms) / 3_600_000);
/** Energy after `ms` of rest from `e`. */
export const afterRest = (st: Staff, e: number, ms: number) =>
  Math.min(energyMax(st.level), e + (ENERGY_REST * ms) / 3_600_000);
export const energyOf = (st: Staff) => st.energy ?? energyMax(st.level);
/** Energy now, the bistro open since `s.lastSeen` (what the server works out too). */
export const energyNow = (s: BistroState, st: Staff, now: number) =>
  afterWork(
    st,
    energyOf(st),
    Math.max(0, now - (s.lastSeen || now)),
    cornerCount(s.items),
  );
/** How fast someone works with this much energy (1 is a fresh level-1 creature). */
export const workSpeed = (st: Staff, energy: number) =>
  staffSpeed(st.level) * (st.friend ? FRIEND_BONUS : 1) * mood(energy);
export const staffUpgradePrice = (level: number) => 150 * level * level;
/** Kitchen upgrades: every dish cooks 10% faster per level. */
export const KITCHEN_PRICES = [300, 700, 1400] as const;
/** Longer shifts: how many hours the staff keep the bistro open while you are away. */
export const SHIFT_HOURS = [2, 4, 6, 8] as const;
export const SHIFT_PRICES = [300, 800, 1600] as const;
/** Offline, the bistro needs at least this long away to report anything. */
export const AWAY_MIN_MS = 60_000;
/** Fewer guests come while you are away than when you are there. */
export const AWAY_RATE = 0.5;
/** …and fewer the longer you are away: half for 2 h, then 40%, from 4 h 30%. */
export const awayRate = (ms: number) =>
  ms < 2 * 3600_000 ? 0.5 : ms < 4 * 3600_000 ? 0.4 : 0.3;
/** Cooks start a new batch only while the counter holds fewer servings than this. */
export const STOCK_CAP = 24;

export interface Item {
  id: number;
  kind: ItemKind;
  x: number;
  y: number;
  /** Facing, 0..3 (chairs pick the table they touch; this breaks ties). */
  rot: number;
}
export interface Stove {
  dish: DishId | null;
  /** When cooking started (ms since epoch). */
  start: number;
  perfect: boolean;
  /** How long it takes (ms), fixed when it starts (kitchen and cook levels). */
  dur?: number;
}
export interface CounterSlot {
  dish: DishId;
  servings: number;
  perfect: boolean;
}
export interface BistroState {
  v: 1;
  coins: number;
  xp: number;
  level: number;
  /** 0..5 stars, a running average of how customers left. */
  rating: number;
  served: number;
  items: Item[];
  /** Bought but not placed. */
  stored: Partial<Record<ItemKind, number>>;
  stoves: Stove[];
  counter: (CounterSlot | null)[];
  staff: Staff[];
  kitchenLv: number;
  shiftLv: number;
  /** The dining room's size step (0 is 11 × 9). */
  sizeLv: number;
  /** When the bistro was last open on this device (ms), for the time away. */
  lastSeen: number;
  floor: FloorId;
  wall: WallId;
  floors: FloorId[];
  walls: WallId[];
  nextId: number;
  /** Litter left on the floor while you were away (migration 073), 0..10. */
  trash: number;
  /** Each dish's level and mastery (migration 074); level 1 when left out. */
  dishLv: Partial<Record<DishId, DishLevel>>;
  /** Ingredients (migration 074). */
  pantry: Partial<Record<Ingredient, number>>;
  /** Branches opened (migration 100): each star adds 10% to every price. */
  stars: number;
  /** Event tokens (they reset when the next event starts). */
  tokens: number;
  /** How far each regular's story has gone. */
  regulars: Record<string, number>;
}

export function xpToNext(level: number): number {
  return Math.round(40 * Math.pow(level, 1.45));
}
export const MAX_LEVEL = 30;

export function defaultState(): BistroState {
  let id = 1;
  const item = (kind: ItemKind, x: number, y: number, rot = 0): Item => ({
    id: id++,
    kind,
    x,
    y,
    rot,
  });
  return {
    v: 1,
    coins: 150,
    xp: 0,
    level: 1,
    rating: 3,
    served: 0,
    items: [
      item("rug", 3, 5),
      item("table", 4, 5),
      item("chair", 3, 5, 1),
      item("chair", 5, 5, 3),
      item("table", 8, 4),
      item("chair", 8, 3, 2),
      item("chair", 8, 5, 0),
      item("table", 8, 7),
      item("chair", 7, 7, 1),
      item("chair", 9, 7, 3),
      item("plant", 10, 0),
      item("plant", 0, 8),
      item("plant", 6, 0),
    ],
    stored: {},
    stoves: [
      { dish: null, start: 0, perfect: false },
      { dish: null, start: 0, perfect: false },
    ],
    // A first batch of spring rolls, so the first guests come right away.
    counter: [
      { dish: "goicuon", servings: 6, perfect: false },
      null,
      null,
      null,
    ],
    staff: [
      { id: 1, char: "sunbara", role: "waiter", level: 1, dish: "goicuon" },
    ],
    kitchenLv: 0,
    shiftLv: 0,
    sizeLv: 0,
    lastSeen: 0,
    floor: "checker",
    wall: "butter",
    floors: ["checker"],
    walls: ["butter"],
    nextId: id,
    trash: 0,
    dishLv: {},
    pantry: {},
    stars: 0,
    tokens: 0,
    regulars: {},
  };
}

/** A saved state, checked field by field (old or edited saves can't break the scene). */
export function sanitize(raw: unknown): BistroState {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, d: number, lo = 0, hi = Number.MAX_SAFE_INTEGER) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.min(hi, Math.max(lo, v))
      : d;
  const s: BistroState = { ...base };
  s.coins = Math.floor(num(r.coins, base.coins));
  s.xp = Math.floor(num(r.xp, 0));
  s.level = Math.floor(num(r.level, 1, 1, MAX_LEVEL));
  s.rating = num(r.rating, 3, 0, 5);
  s.served = Math.floor(num(r.served, 0));
  s.kitchenLv = Math.floor(num(r.kitchenLv, 0, 0, KITCHEN_PRICES.length));
  s.sizeLv = Math.floor(num(r.sizeLv, 0, 0, MAX_SIZE_LV));
  s.shiftLv = Math.floor(num(r.shiftLv, 0, 0, SHIFT_PRICES.length));
  s.lastSeen = num(r.lastSeen, 0);
  s.trash = Math.floor(num(r.trash, 0, 0, TRASH_MAX));
  s.stars = Math.floor(num(Number(r.stars), 0, 0, MAX_STARS));
  s.tokens = Math.floor(num(Number(r.tokens), 0, 0, 1e6));
  s.regulars = {};
  if (r.regulars && typeof r.regulars === "object")
    for (const g of REGULARS) {
      const v = Number((r.regulars as Record<string, unknown>)[g.id]);
      if (v > 0) s.regulars[g.id] = Math.min(g.steps.length, Math.floor(v));
    }
  s.dishLv = {};
  if (r.dishLv && typeof r.dishLv === "object")
    for (const [k, v] of Object.entries(r.dishLv as Record<string, unknown>)) {
      if (!isDish(k) || !v || typeof v !== "object") continue;
      const o = v as Record<string, unknown>;
      s.dishLv[k] = {
        lv: Math.floor(num(Number(o.lv), 1, 1, DISH_MAX_LEVEL)),
        mastery: Math.floor(num(Number(o.mastery), 0, 0, 999)),
      };
    }
  s.pantry = {};
  if (r.pantry && typeof r.pantry === "object")
    for (const [k, v] of Object.entries(r.pantry as Record<string, unknown>))
      if (isIngredient(k)) {
        const n = Math.floor(num(Number(v), 0, 0, PANTRY_MAX));
        if (n > 0) s.pantry[k] = n;
      }
  if (Array.isArray(r.staff)) {
    const staff: Staff[] = [];
    for (const st of r.staff as Record<string, unknown>[]) {
      if (!st || !ROLES.includes(st.role as Role)) continue;
      const role = st.role as Role;
      if (typeof st.char !== "string" || !Object.hasOwn(CHARACTERS, st.char))
        continue;
      if (
        staff.filter((x) => x.role === role).length >= HIRE_STEPS[role].length
      )
        continue;
      const fr = st.friend as { id?: unknown; name?: unknown } | undefined;
      const friend =
        fr && typeof fr.id === "string" && typeof fr.name === "string"
          ? { id: fr.id, name: fr.name }
          : undefined;
      if (
        friend
          ? staff.some((x) => x.friend?.id === friend.id)
          : staff.some((x) => !x.friend && x.char === st.char)
      )
        continue;
      const level = Math.floor(num(st.level, 1, 1, STAFF_MAX_LEVEL));
      staff.push({
        id: staff.length + 1,
        char: st.char,
        role,
        level,
        dish: isDish(st.dish) ? st.dish : "goicuon",
        ...(typeof st.energy === "number" || typeof st.energy === "string"
          ? {
              energy: num(
                Number(st.energy),
                energyMax(level),
                0,
                energyMax(level),
              ),
            }
          : {}),
        ...(st.fedAt ? { fedAt: num(Number(st.fedAt), 0) } : {}),
        ...(friend ? { friend } : {}),
      });
    }
    if (!staff.some((x) => x.role === "waiter"))
      staff.unshift({ ...base.staff[0] });
    s.staff = staff.map((x, i) => ({ ...x, id: i + 1 }));
  } else if (num(r.waiters, 1) >= 2) {
    // Saves from before staff: the second waiter.
    s.staff = [
      ...base.staff,
      { id: 2, char: "astrabun", role: "waiter", level: 1, dish: "goicuon" },
    ];
  }
  if (Array.isArray(r.items)) {
    const items: Item[] = [];
    let maxId = 0;
    for (const it of r.items as Record<string, unknown>[]) {
      if (!it || !isItemKind(it.kind)) continue;
      const x = Math.floor(num(it.x, -1, -1, MAX_SIZE.cols));
      const y = Math.floor(num(it.y, -1, -1, MAX_SIZE.rows));
      const id = Math.floor(num(it.id, 0));
      const candidate: Item = {
        id: id > 0 ? id : 0,
        kind: it.kind,
        x,
        y,
        rot: Math.floor(num(it.rot, 0, 0, 3)),
      };
      if (canPlace(items, candidate.kind, x, y, -1, sizeOf(s.sizeLv)).ok) {
        items.push(candidate);
        maxId = Math.max(maxId, candidate.id);
      }
    }
    // Ids must be unique and positive.
    const seen = new Set<number>();
    for (const it of items) {
      if (it.id <= 0 || seen.has(it.id)) it.id = ++maxId;
      seen.add(it.id);
    }
    s.items = items;
    s.nextId = maxId + 1;
  }
  if (r.stored && typeof r.stored === "object") {
    s.stored = {};
    for (const [k, v] of Object.entries(r.stored as Record<string, unknown>))
      if (isItemKind(k) && num(v, 0) > 0) s.stored[k] = Math.floor(num(v, 0));
  }
  if (Array.isArray(r.stoves) && r.stoves.length >= 2) {
    s.stoves = (r.stoves as Record<string, unknown>[])
      .slice(0, MAX_STOVES)
      .map((st) => ({
        dish: st && isDish(st.dish) ? st.dish : null,
        start: num(st?.start, 0),
        perfect: st?.perfect === true,
        ...(num(st?.dur, 0) > 0 ? { dur: num(st?.dur, 0) } : {}),
      }));
  }
  if (Array.isArray(r.counter)) {
    s.counter = Array.from({ length: COUNTER_SLOTS }, (_, i) => {
      const c = (r.counter as Record<string, unknown>[])[i];
      if (!c || !isDish(c.dish)) return null;
      const servings = Math.floor(num(c.servings, 0, 0, 999));
      return servings > 0
        ? { dish: c.dish, servings, perfect: c.perfect === true }
        : null;
    });
  }
  const floorIds = FLOORS.map((f) => f.id) as string[];
  const wallIds = WALLS.map((w) => w.id) as string[];
  if (Array.isArray(r.floors))
    s.floors = [
      "checker",
      ...(r.floors as unknown[]).filter(
        (f): f is FloorId =>
          typeof f === "string" && floorIds.includes(f) && f !== "checker",
      ),
    ];
  if (Array.isArray(r.walls))
    s.walls = [
      "butter",
      ...(r.walls as unknown[]).filter(
        (w): w is WallId =>
          typeof w === "string" && wallIds.includes(w) && w !== "butter",
      ),
    ];
  s.floor = s.floors.includes(r.floor as FloorId)
    ? (r.floor as FloorId)
    : "checker";
  s.wall = s.walls.includes(r.wall as WallId) ? (r.wall as WallId) : "butter";
  return s;
}

/* ───────────── levels and coins ───────────── */

export function unlockedDishes(level: number): Dish[] {
  return DISHES.filter((d) => d.level <= level);
}
/** Add XP; returns how many levels were gained. */
export function addXp(s: BistroState, xp: number): number {
  let gained = 0;
  s.xp += Math.max(0, Math.round(xp));
  while (s.level < MAX_LEVEL && s.xp >= xpToNext(s.level)) {
    s.xp -= xpToNext(s.level);
    s.level++;
    gained++;
    // A level-up gift: a little cash to spend on the new things, and
    // a few ingredients.
    s.coins += levelGift(s.level);
    for (const [ing, n] of levelIngredients(s.level)) addIngredient(s, ing, n);
  }
  if (s.level >= MAX_LEVEL) s.xp = Math.min(s.xp, xpToNext(s.level));
  return gained;
}
export function levelGift(level: number): number {
  return 40 + level * 20;
}

/** Today's special, the same all day on this device (local date). */
export function todaySpecial(level: number, date = new Date()): DishId {
  const key =
    date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  let h = key;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h ^= h >>> 16;
  const pool = unlockedDishes(Math.max(level, 2));
  return pool[Math.abs(h) % pool.length].id;
}
export const SPECIAL_MULT = 1.5;
export const VIP_MULT = 2.5;
/** Serving within this many seconds of the last one keeps the streak. */
export const COMBO_SECONDS = 8;
export const COMBO_MAX = 5;
/** Rush hours come by the clock, the same for everyone: 35 s of every 4 minutes. */
export const RUSH_PERIOD = 240;
export const RUSH_SECONDS = 35;
export const inRush = (ms: number) =>
  Math.floor(ms / 1000) % RUSH_PERIOD < RUSH_SECONDS;
/** Seconds until the next rush hour starts (0 while one is on). */
export const rushIn = (ms: number) => {
  const s = Math.floor(ms / 1000) % RUSH_PERIOD;
  return s < RUSH_SECONDS ? 0 : RUSH_PERIOD - s;
};
/** Bistro coins for Gold Leaves: 100 coins → 20 leaves, up to 300 leaves a Pacific day. */
export const BISTRO_TRADE = {
  coins: 100,
  leaves: 20,
  dailyLeaves: 300,
} as const;
/** Eating at a friend's bistro: once a friend a Pacific day, up to 10 a day. */
export const DINE = {
  perDay: 10,
  ownerXp: 2,
  ownerTipPct: 50,
  dinerXp: 5,
  dinerCoins: 10,
} as const;
/** A like: once a friend a week. */
export const LIKE_XP = 2;
/** Online sales: guests a second each seat allows, plus a small burst. */
export const SALE_RATE_PER_SEAT = 0.1;
export const SALE_BURST = 4;
/** VIPs: at most about one guest in seven, with a burst of three. */
export const VIP_SHARE = 0.15;
export const VIP_BURST = 3;
/** Tips: +8% of the bill for each streak step after the first. */
export function payment(
  dish: DishId,
  o: {
    vip?: boolean;
    combo?: number;
    special?: boolean;
    quick?: boolean;
    rush?: boolean;
    hearts?: number;
    /** The dish's level (its price grows 12% a level). */
    level?: number;
    /** Branch stars: 10% each. */
    stars?: number;
  },
): { base: number; tip: number; total: number } {
  let base = priceAt(dish, o.level ?? 1, o.stars ?? 0);
  if (o.special) base *= SPECIAL_MULT;
  if (o.vip) base *= VIP_MULT;
  base = Math.round(base);
  // Whole percents, so the database (068_bistro.sql) rounds the same way.
  const combo = Math.min(COMBO_MAX, Math.max(1, Math.floor(o.combo ?? 1)));
  const hearts = Math.min(3, Math.max(1, Math.floor(o.hearts ?? 3)));
  let pct = (combo - 1) * 8 + (hearts - 1) * 5 + (o.quick ? 10 : 0);
  if (o.rush) pct *= 2;
  const tip = Math.round((base * pct) / 100);
  return { base, tip, total: base + tip };
}

/* ───────────── stoves and the counter ───────────── */

export function cookProgress(st: Stove, now: number): number {
  if (!st.dish) return 0;
  return Math.min(1, Math.max(0, (now - st.start) / stoveMs(st)));
}
/** How long the dish on a stove takes, in ms. */
export function stoveMs(st: Stove): number {
  return st.dur && st.dur > 0
    ? st.dur
    : st.dish
      ? DISH_BY_ID[st.dish].seconds * 1000
      : 1;
}
/** How long a dish takes with this kitchen (and this cook's level, if a cook makes it). */
/** `pace` is the cook's energy and friend bonus (1 for you, fresh). */
export function cookMs(
  s: BistroState,
  dish: DishId,
  cookLevel = 1,
  pace = 1,
): number {
  return Math.round(
    (DISH_BY_ID[dish].seconds * 1000 * (1 - 0.1 * s.kitchenLv)) /
      (staffSpeed(cookLevel) * pace),
  );
}
export function inPerfectWindow(st: Stove, now: number): boolean {
  const p = cookProgress(st, now);
  return !!st.dish && !st.perfect && p >= PERFECT_FROM && p < PERFECT_TO;
}
export type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

export function startCooking(
  s: BistroState,
  stove: number,
  dish: DishId,
  now: number,
  cookLevel = 1,
  pace = 1,
): Result {
  const st = s.stoves[stove];
  if (!st) return fail("No stove there.");
  if (st.dish) return fail("That stove is busy.");
  const d = DISH_BY_ID[dish];
  if (!d) return fail("Unknown dish.");
  if (d.level > s.level) return fail(`${d.name} opens at level ${d.level}.`);
  if (s.coins < d.cost) return fail(`You need ${d.cost} coins for ${d.name}.`);
  s.coins -= d.cost;
  s.stoves[stove] = {
    dish,
    start: now,
    perfect: false,
    dur: cookMs(s, dish, cookLevel, pace),
  };
  return { ok: true };
}
/** A tap in the golden part of the bar. */
export function stir(s: BistroState, stove: number, now: number): boolean {
  const st = s.stoves[stove];
  if (!st || !inPerfectWindow(st, now)) return false;
  st.perfect = true;
  return true;
}
/** Move a finished dish to the counter. */
export function plate(
  s: BistroState,
  stove: number,
  now: number,
): Result & { slot?: number; servings?: number; xp?: number; levels?: number } {
  const st = s.stoves[stove];
  if (!st?.dish) return fail("Nothing cooking there.");
  if (cookProgress(st, now) < 1) return fail("Not ready yet.");
  const d = DISH_BY_ID[st.dish];
  const lv = dishLevel(s, st.dish);
  const servings = servingsAt(st.dish, lv) + (st.perfect ? PERFECT_BONUS : 0);
  let slot = s.counter.findIndex((c) => c?.dish === st.dish);
  if (slot < 0) slot = s.counter.findIndex((c) => !c);
  if (slot < 0) return fail("The counter is full: serve some dishes first.");
  const c = s.counter[slot];
  s.counter[slot] = c
    ? {
        dish: c.dish,
        servings: c.servings + servings,
        perfect: c.perfect || st.perfect,
      }
    : { dish: st.dish, servings, perfect: st.perfect };
  // Mastery toward the dish's next level.
  const m = s.dishLv[d.id]?.mastery ?? 0;
  s.dishLv[d.id] = {
    lv,
    mastery: Math.min(masteryNeed(lv), m + (st.perfect ? 2 : 1)),
  };
  s.stoves[stove] = { dish: null, start: 0, perfect: false };
  const levels = addXp(s, d.xp);
  return { ok: true, slot, servings, xp: d.xp, levels };
}
/** Take one serving off the counter (a customer's order). */
export function takeServing(s: BistroState, dish: DishId): number {
  const slot = s.counter.findIndex((c) => c?.dish === dish && c.servings > 0);
  if (slot < 0) return -1;
  const c = s.counter[slot]!;
  c.servings--;
  if (c.servings <= 0) s.counter[slot] = null;
  return slot;
}
export function servingsLeft(s: BistroState): number {
  return s.counter.reduce((n, c) => n + (c?.servings ?? 0), 0);
}
/** What a customer orders: from what is on the counter (a VIP prefers the special). */
export function pickOrder(
  s: BistroState,
  rand: () => number,
  special: DishId | null,
  vip: boolean,
): DishId | null {
  const avail = s.counter.filter(
    (c): c is CounterSlot => !!c && c.servings > 0,
  );
  if (!avail.length) return null;
  if (
    special &&
    avail.some((c) => c.dish === special) &&
    (vip || rand() < 0.35)
  )
    return special;
  let total = 0;
  for (const c of avail) total += c.servings;
  let r = rand() * total;
  for (const c of avail) {
    r -= c.servings;
    if (r < 0) return c.dish;
  }
  return avail[avail.length - 1].dish;
}

/* ───────────── the floor plan ───────────── */

export const inKitchen = (x: number, y: number) =>
  x <= COUNTER_X1 && y <= COUNTER_ROW;
export const inGrid = (x: number, y: number, z: RoomSize = BASE_SIZE) =>
  x >= 0 && y >= 0 && x < z.cols && y < z.rows;
/** A grid's size, from the grid itself. */
const sizeOfGrid = (g: boolean[][]): RoomSize => ({
  cols: g.length,
  rows: g[0]?.length ?? 0,
});
const isPickup = (x: number, y: number) =>
  y === 3 && x >= 1 && x <= COUNTER_SLOTS;
/** Tiles the plan keeps clear: the door, its first step, the pickup spots. */
export const reservedTile = (x: number, y: number) =>
  (x === DOOR.x && y === DOOR.y) ||
  (x === DOOR.x + 1 && y === DOOR.y) ||
  isPickup(x, y) ||
  (x === WAITER_HOME.x && y === WAITER_HOME.y);

export function footprint(kind: ItemKind, x: number, y: number) {
  const def = ITEM_BY_KIND[kind];
  const out: { x: number; y: number }[] = [];
  for (let dx = 0; dx < (def.w ?? 1); dx++)
    for (let dy = 0; dy < (def.h ?? 1); dy++)
      out.push({ x: x + dx, y: y + dy });
  return out;
}
/** Tiles that block walking: furniture and kitchen fixtures (rugs don't). */
export function blockedGrid(
  items: readonly Item[],
  ignoreId = -1,
  z: RoomSize = BASE_SIZE,
): boolean[][] {
  const g = Array.from({ length: z.cols }, () =>
    Array<boolean>(z.rows).fill(false),
  );
  // The kitchen (stoves, the chef's lane, the counter) is the chef's alone.
  for (let x = COUNTER_X0; x <= COUNTER_X1; x++)
    for (let y = 0; y <= COUNTER_ROW; y++) g[x][y] = true;
  for (const it of items) {
    if (it.id === ignoreId || ITEM_BY_KIND[it.kind].floor) continue;
    for (const t of footprint(it.kind, it.x, it.y))
      if (inGrid(t.x, t.y, z)) g[t.x][t.y] = true;
  }
  return g;
}
const N4 = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
] as const;
/** Breadth-first path over free tiles; `to` itself may be blocked (a chair). */
export function findPath(
  blocked: boolean[][],
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number }[] | null {
  const z = sizeOfGrid(blocked);
  const W = z.cols;
  if (!inGrid(from.x, from.y, z) || !inGrid(to.x, to.y, z)) return null;
  const key = (x: number, y: number) => y * W + x;
  const prev = new Map<number, number>();
  const q: number[] = [key(from.x, from.y)];
  prev.set(q[0], -1);
  const goal = key(to.x, to.y);
  while (q.length) {
    const k = q.shift()!;
    if (k === goal) break;
    const x = k % W,
      y = (k / W) | 0;
    for (const [dx, dy] of N4) {
      const nx = x + dx,
        ny = y + dy;
      if (!inGrid(nx, ny, z)) continue;
      const nk = key(nx, ny);
      if (prev.has(nk)) continue;
      if (blocked[nx][ny] && nk !== goal) continue;
      prev.set(nk, k);
      q.push(nk);
    }
  }
  if (!prev.has(goal)) return null;
  const path: { x: number; y: number }[] = [];
  for (let k = goal; k !== -1; k = prev.get(k)!)
    path.push({ x: k % W, y: (k / W) | 0 });
  return path.reverse();
}
/** The facing (0 +x, 1 +y, 2 −x, 3 −y) from a tile toward a neighbour. */
export const dirTo = (dx: number, dy: number) =>
  dx > 0 ? 0 : dy > 0 ? 1 : dx < 0 ? 2 : 3;

export interface Seat {
  chair: Item;
  table: Item;
  /** Facing from the chair to its table. */
  dir: number;
}
/** Chairs that touch a table; each seats one customer (the chair's rot breaks ties). */
export function seats(items: readonly Item[]): Seat[] {
  const tables = items.filter((i) => i.kind === "table");
  const out: Seat[] = [];
  for (const c of items) {
    if (c.kind !== "chair") continue;
    let best: Seat | null = null;
    for (const t of tables) {
      const dx = t.x - c.x,
        dy = t.y - c.y;
      if (Math.abs(dx) + Math.abs(dy) !== 1) continue;
      const dir = dirTo(dx, dy);
      if (!best || dir === c.rot) best = { chair: c, table: t, dir };
    }
    if (best) out.push(best);
  }
  return out;
}
/** A free tile next to a target, reachable from `from` (the nearest by path). */
export function approach(
  blocked: boolean[][],
  from: { x: number; y: number },
  targets: { x: number; y: number }[],
): { x: number; y: number }[] | null {
  let best: { x: number; y: number }[] | null = null;
  for (const t of targets)
    for (const [dx, dy] of N4) {
      const nx = t.x + dx,
        ny = t.y + dy;
      if (!inGrid(nx, ny, sizeOfGrid(blocked)) || blocked[nx][ny]) continue;
      const p = findPath(blocked, from, { x: nx, y: ny });
      if (p && (!best || p.length < best.length)) best = p;
    }
  return best;
}

/* ───────────── the floor plan's walks ─────────────
   Steps from the door and from the counter's pickup spots to every tile
   (breadth-first, -1 where you can't get to). A seat's walks: the guest's
   from the door to the chair, the waiter's there and back from the counter
   to a free tile beside the chair or its table. They decide which seats
   guests pick, the waiters' jobs, the plan's grade, and how fast the staff
   serve while you are away. */
export const WAITER_TPS = 2.8;
export const GUEST_TPS = 2;
/** A waiter's time at the counter and at the table, a meal (seconds). */
export const SERVE_HANDLING = 5;
/** Clearing a table, when the waiters do it themselves (seconds). */
export const CLEAR_SECONDS = 1.2;
/** A seat's turn, besides the walk in and out: ordering, waiting, eating, clearing. */
export const SEAT_BASE = 20;
export function distField(
  blocked: boolean[][],
  sources: readonly { x: number; y: number }[],
): number[][] {
  const z = sizeOfGrid(blocked);
  const d = Array.from({ length: z.cols }, () =>
    Array<number>(z.rows).fill(-1),
  );
  const q: [number, number][] = [];
  for (const p of sources)
    if (inGrid(p.x, p.y, z) && !blocked[p.x][p.y] && d[p.x][p.y] < 0) {
      d[p.x][p.y] = 0;
      q.push([p.x, p.y]);
    }
  for (let h = 0; h < q.length; h++) {
    const [x, y] = q[h];
    for (const [dx, dy] of N4) {
      const nx = x + dx,
        ny = y + dy;
      if (!inGrid(nx, ny, z) || blocked[nx][ny] || d[nx][ny] >= 0) continue;
      d[nx][ny] = d[x][y] + 1;
      q.push([nx, ny]);
    }
  }
  return d;
}
export interface SeatWalk {
  chair: number;
  table: number;
  /** Steps from the door to the chair. */
  guest: number;
  /** Steps from the counter to the seat and back. */
  waiter: number;
}
/** The nearest of a field's values on the free tiles beside `targets` (-1 if none). */
function nearBy(
  d: number[][],
  blocked: boolean[][],
  targets: readonly { x: number; y: number }[],
): number {
  const z = sizeOfGrid(blocked);
  let best = -1;
  for (const t of targets)
    for (const [dx, dy] of N4) {
      const nx = t.x + dx,
        ny = t.y + dy;
      if (!inGrid(nx, ny, z) || blocked[nx][ny] || d[nx][ny] < 0) continue;
      if (best < 0 || d[nx][ny] < best) best = d[nx][ny];
    }
  return best;
}
/** Every seat you can get to, with its walks (in the order of `seats`). */
export function seatWalks(items: readonly Item[], z: RoomSize): SeatWalk[] {
  const b = blockedGrid(items, -1, z);
  const fromDoor = distField(b, [DOOR]);
  const fromCounter = distField(
    b,
    Array.from({ length: COUNTER_SLOTS }, (_, i) => pickupTile(i)),
  );
  const out: SeatWalk[] = [];
  for (const st of seats(items)) {
    const g = nearBy(fromDoor, b, [st.chair]);
    const w = nearBy(fromCounter, b, [st.chair, st.table]);
    if (g < 0 || w < 0) continue;
    out.push({
      chair: st.chair.id,
      table: st.table.id,
      guest: g + 1,
      waiter: 2 * w,
    });
  }
  return out;
}
export type LayoutGrade = "A" | "B" | "C" | "D" | "E";
export interface LayoutStats {
  seats: SeatWalk[];
  /** A waiter's average time a meal (seconds), walking and handling. */
  tMeal: number;
  grade: LayoutGrade | null;
}
/** The grade's upper bounds on tMeal (seconds): A below 7, … E from 10.5. */
export const LAYOUT_GRADES: readonly [LayoutGrade, number][] = [
  ["A", 7],
  ["B", 8],
  ["C", 9],
  ["D", 10.5],
];
export function layoutStats(items: readonly Item[], z: RoomSize): LayoutStats {
  const sw = seatWalks(items, z);
  if (!sw.length) return { seats: sw, tMeal: 0, grade: null };
  let sum = 0;
  for (const x of sw) sum += x.waiter;
  const tMeal = sum / sw.length / WAITER_TPS + SERVE_HANDLING;
  const grade = LAYOUT_GRADES.find(([, t]) => tMeal < t)?.[0] ?? "E";
  return { seats: sw, tMeal, grade };
}
/** A seat's colour on the plan: green, yellow or red by the waiter's walk. */
export const seatHeat = (waiter: number) =>
  waiter <= 8 ? "good" : waiter <= 14 ? "fair" : "far";

/** Whether an item can go on (x, y); `ignoreId` is the item being moved. */
export function canPlace(
  items: readonly Item[],
  kind: ItemKind,
  x: number,
  y: number,
  ignoreId = -1,
  z: RoomSize = BASE_SIZE,
): Result {
  const def = ITEM_BY_KIND[kind];
  for (const t of footprint(kind, x, y)) {
    if (!inGrid(t.x, t.y, z)) return fail("That's outside the restaurant.");
    if (inKitchen(t.x, t.y)) return fail("The kitchen stays clear.");
    if (!def.floor && reservedTile(t.x, t.y))
      return fail("Keep the doorway and the counter clear.");
    for (const it of items) {
      if (it.id === ignoreId) continue;
      const other = ITEM_BY_KIND[it.kind];
      if (!!other.floor !== !!def.floor) continue;
      if (
        footprint(it.kind, it.x, it.y).some((o) => o.x === t.x && o.y === t.y)
      )
        return fail("Something's already there.");
    }
  }
  return { ok: true };
}
/**
 * Whether the plan still works: from the door you can reach every pickup
 * spot, and every seat has a free tile next to its chair.
 */
export function planWorks(
  items: readonly Item[],
  z: RoomSize = BASE_SIZE,
): Result {
  const blocked = blockedGrid(items, -1, z);
  for (let i = 0; i < COUNTER_SLOTS; i++)
    if (!findPath(blocked, DOOR, pickupTile(i)))
      return fail("That would block the way to the counter.");
  for (const seat of seats(items))
    if (
      !findPath(blocked, DOOR, seat.chair) ||
      !approach(blocked, DOOR, [seat.chair])
    )
      return fail("That would block a seat.");
  return { ok: true };
}
/** Place, move or put away; returns the new list or an error. */
export function tryPlace(
  s: BistroState,
  kind: ItemKind,
  x: number,
  y: number,
  rot: number,
  moving?: Item,
): Result {
  const z = sizeOf(s.sizeLv);
  const ok = canPlace(s.items, kind, x, y, moving?.id ?? -1, z);
  if (!ok.ok) return ok;
  const next = s.items
    .filter((i) => i.id !== moving?.id)
    .concat({ id: moving?.id ?? s.nextId, kind, x, y, rot });
  const works = planWorks(next, z);
  if (!works.ok) return works;
  if (!moving) {
    const left = s.stored[kind] ?? 0;
    if (left <= 0) return fail("None in storage.");
    s.stored[kind] = left - 1;
    if (!s.stored[kind]) delete s.stored[kind];
    s.nextId++;
  }
  s.items = next;
  return { ok: true };
}
export function putAway(s: BistroState, id: number): Result {
  const it = s.items.find((i) => i.id === id);
  if (!it) return fail("Nothing there.");
  s.items = s.items.filter((i) => i.id !== id);
  s.stored[it.kind] = (s.stored[it.kind] ?? 0) + 1;
  return { ok: true };
}
export function charm(items: readonly Item[]): number {
  let n = items.reduce((n, i) => n + ITEM_BY_KIND[i.kind].charm, 0);
  // A full event set on the floor: a bonus.
  for (const e of EVENTS)
    if (e.items.every((k) => items.some((i) => i.kind === k)))
      n += EVENT_SET_CHARM;
  return n;
}
/* ───────────── popularity (0..50) ─────────────
   One number for how wanted the bistro is: how guests left (the rating),
   the decor (charm), the menu (gourmet), friends (likes, meals) and the
   mess. It sets how often guests come, how long a queue forms at the door
   and how many are VIPs. The database works it out the same way. */
export const POP_MAX = 50;
export interface PopInput {
  /** Likes this week (Monday on, Pacific). */
  likesWeek?: number;
  /** Friends who ate here today. */
  dinedToday?: number;
  /** Gourmet points (dish levels). */
  gourmet?: number;
  /** Litter on the floor. */
  trash?: number;
  /** Tables left dirty for more than DIRTY_SECONDS. */
  dirty?: number;
}
export interface Popularity {
  service: number;
  decor: number;
  gourmet: number;
  social: number;
  mess: number;
  /** 0..50, not rounded (the rules use it as it is). */
  total: number;
}
export const DIRTY_SECONDS = 30;
export function popularity(
  s: Pick<BistroState, "rating" | "items"> &
    Partial<Pick<BistroState, "dishLv">>,
  o: PopInput = {},
): Popularity {
  const service = s.rating * 6;
  const decor = Math.min(10, charm(s.items) / 3);
  const g = o.gourmet ?? (s.dishLv ? gourmetOf(s as BistroState) : 0);
  const gourmet = Math.min(6, g / 40);
  const social = Math.min(
    4,
    0.5 * (o.likesWeek ?? 0) + 0.5 * (o.dinedToday ?? 0),
  );
  const mess = Math.min(8, (o.trash ?? 0) + 0.5 * (o.dirty ?? 0));
  const total = Math.min(
    POP_MAX,
    Math.max(0, service + decor + gourmet + social - mess),
  );
  return { service, decor, gourmet, social, mess, total };
}
export const POP_TIERS = [
  { from: 0, name: "Quiet" },
  { from: 10, name: "Local Pick" },
  { from: 20, name: "Busy" },
  { from: 30, name: "Hot Spot" },
  { from: 40, name: "Legendary" },
] as const;
export const popTier = (pop: number) =>
  [...POP_TIERS].reverse().find((t) => Math.round(pop) >= t.from)!.name;
/** Seconds between guests: 9 s at no popularity, 2.2 s at 50; a rush hour more than doubles it. */
export function arrivalSeconds(pop: number, rush: boolean): number {
  return Math.max(2.2, 9 - 0.136 * pop) * (rush ? 0.45 : 1);
}
/** Guests who wait at the door for a seat. */
export const queueMax = (pop: number) =>
  Math.min(6, 1 + Math.floor(Math.max(0, pop) / 10));
/** How long they wait there before walking off (seconds). */
export const queuePatience = (pop: number) => 15 + 0.5 * pop;
/** The share of guests who are VIPs. */
export const vipShare = (pop: number, rush: boolean) =>
  (0.06 + 0.0016 * Math.min(POP_MAX, Math.max(0, pop))) * (rush ? 1.3 : 1);
/** How long a customer waits for food before leaving (seconds). */
export function patienceSeconds(charmPts: number, vip: boolean): number {
  return (32 + Math.min(40, charmPts) * 0.6) * (vip ? 0.7 : 1);
}
/** Hearts (1..3) from how long the food took against the patience. */
export function heartsFor(waited: number, patience: number): number {
  const f = waited / patience;
  return f < 0.35 ? 3 : f < 0.7 ? 2 : 1;
}
/** The rating moves a little toward each customer's verdict (0..5). */
export function rate(rating: number, verdict: number): number {
  return Math.min(5, Math.max(0, rating + (verdict - rating) * 0.08));
}

/* ───────────── the shop ───────────── */

export function buyItem(
  s: BistroState,
  kind: ItemKind,
  /** The event on now (event items are sold only then, for tokens). */
  eventId: string | null = null,
): Result {
  const def = ITEM_BY_KIND[kind];
  if (!def) return fail("Unknown item.");
  if (def.gift) return fail("That one is a gift from a regular.");
  if (def.level > s.level) return fail(`Opens at level ${def.level}.`);
  if (def.event) {
    if (def.event !== eventId) return fail("Only during its event.");
    if (s.tokens < def.tokens!) return fail(`You need ${def.tokens} tokens.`);
    s.tokens -= def.tokens!;
    s.stored[kind] = (s.stored[kind] ?? 0) + 1;
    return { ok: true };
  }
  if (s.coins < def.price) return fail(`You need ${def.price} coins.`);
  s.coins -= def.price;
  s.stored[kind] = (s.stored[kind] ?? 0) + 1;
  return { ok: true };
}
export function nextStovePrice(s: BistroState): number | null {
  return s.stoves.length < MAX_STOVES ? STOVE_PRICES[s.stoves.length] : null;
}
export function buyStove(s: BistroState): Result {
  const price = nextStovePrice(s);
  if (price === null) return fail("Every stove slot is in use.");
  if (s.coins < price) return fail(`You need ${price} coins.`);
  s.coins -= price;
  s.stoves.push({ dish: null, start: 0, perfect: false });
  return { ok: true };
}

/* ───────────── staff, upgrades and the time away ───────────── */

export const staffOf = (s: BistroState, role: Role) =>
  s.staff.filter((x) => x.role === role);
/** The next hire for a role (its level and price), or null when the team is full. */
export function nextHire(s: BistroState, role: Role) {
  return HIRE_STEPS[role][staffOf(s, role).length] ?? null;
}
export function hire(
  s: BistroState,
  role: Role,
  char: string,
  /** A friend (their Lobby fighter is `char`); the server checks the friendship. */
  friend?: { id: string; name: string },
): Result {
  const step = nextHire(s, role);
  if (!step) return fail(`You have every ${role} you can hire.`);
  if (s.level < step.level) return fail(`Hire at level ${step.level}.`);
  if (!Object.hasOwn(CHARACTERS, char)) return fail("Unknown creature.");
  if (
    friend
      ? s.staff.some((x) => x.friend?.id === friend.id)
      : s.staff.some((x) => !x.friend && x.char === char)
  )
    return fail("Already on your team.");
  if (s.coins < step.price) return fail(`You need ${step.price} coins.`);
  s.coins -= step.price;
  const best = unlockedDishes(s.level).slice(-1)[0].id;
  s.staff.push({
    id: Math.max(0, ...s.staff.map((x) => x.id)) + 1,
    char,
    role,
    level: 1,
    dish: role === "cook" ? best : "goicuon",
    ...(friend ? { friend } : {}),
  });
  return { ok: true };
}
/** The counter slot a meal comes from: the most servings, then the first. */
export function fullestSlot(s: BistroState): number {
  let slot = -1;
  s.counter.forEach((c, i) => {
    if (
      c &&
      c.servings > 0 &&
      (slot < 0 || c.servings > s.counter[slot]!.servings)
    )
      slot = i;
  });
  return slot;
}
/** A staff meal: a serving off the counter, +50 energy, once in 10 minutes. */
export function feedStaff(s: BistroState, id: number, now: number): Result {
  const st = s.staff.find((x) => x.id === id);
  if (!st) return fail("Not on your team.");
  if (st.fedAt && now - st.fedAt < FEED_COOLDOWN_MS)
    return fail("They just ate: try again in a few minutes.");
  const slot = fullestSlot(s);
  if (slot < 0) return fail("Nothing on the counter to eat.");
  takeServing(s, s.counter[slot]!.dish);
  const target = Math.min(
    energyMax(st.level),
    energyNow(s, st, now) + FEED_ENERGY,
  );
  // Kept as of lastSeen, like the rest (the server keeps it as of now).
  st.energy =
    target +
    (drainPerHour(st.role, cornerCount(s.items)) *
      Math.max(0, now - (s.lastSeen || now))) /
      3_600_000;
  st.fedAt = now;
  return { ok: true };
}
/** Litter: a guest's chance to drop some, the janitors' pace, the most kept. */
export const LITTER_RATE = 0.08;
export const SWEEPS_PER_HOUR = 30;
export const TRASH_MAX = 10;
export function sweepTrash(s: BistroState): Result {
  if (s.trash <= 0) return fail("Nothing to sweep.");
  s.trash--;
  return { ok: true };
}
export function upgradeStaff(s: BistroState, id: number): Result {
  const st = s.staff.find((x) => x.id === id);
  if (!st) return fail("Not on your team.");
  if (st.level >= STAFF_MAX_LEVEL) return fail("Already at the top level.");
  const price = staffUpgradePrice(st.level);
  if (s.coins < price) return fail(`You need ${price} coins.`);
  s.coins -= price;
  st.level++;
  return { ok: true };
}
export function setCookDish(s: BistroState, id: number, dish: DishId): Result {
  const st = s.staff.find((x) => x.id === id && x.role === "cook");
  if (!st) return fail("Not a cook.");
  if (DISH_BY_ID[dish].level > s.level)
    return fail(`Opens at level ${DISH_BY_ID[dish].level}.`);
  st.dish = dish;
  return { ok: true };
}
/** Three creatures looking for work today (not on the team, not the head chef). */
export function candidates(
  s: BistroState,
  chef: string,
  date = new Date(),
): string[] {
  const pool = Object.keys(CHARACTERS).filter(
    (c) => c !== chef && !s.staff.some((x) => x.char === c),
  );
  let h = date.getFullYear() * 400 + date.getMonth() * 32 + date.getDate();
  const out: string[] = [];
  while (out.length < 3 && pool.length) {
    h = (Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) + 0x9e3779b9) | 0;
    out.push(pool.splice(Math.abs(h) % pool.length, 1)[0]);
  }
  return out;
}
/** A bigger dining room (the next size step). */
export function buyExpand(s: BistroState): Result {
  const step = EXPAND_STEPS[s.sizeLv];
  if (!step) return fail("The dining room is as big as it gets.");
  if (s.level < step.level) return fail(`Expand at level ${step.level}.`);
  if (s.coins < step.price) return fail(`You need ${step.price} coins.`);
  s.coins -= step.price;
  s.sizeLv++;
  return { ok: true };
}
export function buyKitchen(s: BistroState): Result {
  const price = KITCHEN_PRICES[s.kitchenLv];
  if (price === undefined) return fail("The kitchen is fully upgraded.");
  if (s.coins < price) return fail(`You need ${price} coins.`);
  s.coins -= price;
  s.kitchenLv++;
  return { ok: true };
}
export function buyShift(s: BistroState): Result {
  const price = SHIFT_PRICES[s.shiftLv];
  if (price === undefined) return fail("Shifts are as long as they go.");
  if (s.coins < price) return fail(`You need ${price} coins.`);
  s.coins -= price;
  s.shiftLv++;
  return { ok: true };
}
/** The stove a cook runs: cooks take the stoves from the last one back. */
export function cookStove(s: BistroState, cookIndex: number): number {
  const i = s.stoves.length - 1 - cookIndex;
  return i >= 0 ? i : -1;
}
export type KitchenEvent =
  | { kind: "start"; stove: number; dish: DishId; cook: Staff }
  | {
      kind: "plate";
      stove: number;
      dish: DishId;
      slot: number;
      servings: number;
      levels: number;
      cook: Staff;
    };
/** The cooks' turn: plate what is done, start their dish on an empty stove. */
export function autoKitchen(
  s: BistroState,
  now: number,
  /** A cook's pace (energy, friend): by default as of now with the bistro open. */
  paceOf: (cook: Staff) => number = (c) =>
    (c.friend ? FRIEND_BONUS : 1) * mood(energyNow(s, c, now)),
): KitchenEvent[] {
  const out: KitchenEvent[] = [];
  staffOf(s, "cook").forEach((cook, i) => {
    const idx = cookStove(s, i);
    const st = s.stoves[idx];
    if (!st) return;
    if (st.dish && cookProgress(st, now) >= 1) {
      const dish = st.dish;
      const r = plate(s, idx, now);
      if (!r.ok) return; // the counter is full: wait
      out.push({
        kind: "plate",
        stove: idx,
        dish,
        slot: r.slot!,
        servings: r.servings!,
        levels: r.levels ?? 0,
        cook,
      });
    }
    if (!s.stoves[idx].dish && servingsLeft(s) < STOCK_CAP) {
      // Their dish, or the best one you can still pay for.
      const pick = [
        cook.dish,
        ...unlockedDishes(s.level)
          .map((d) => d.id)
          .reverse(),
      ].find(
        (d) => DISH_BY_ID[d].level <= s.level && DISH_BY_ID[d].cost <= s.coins,
      );
      if (pick && startCooking(s, idx, pick, now, cook.level, paceOf(cook)).ok)
        out.push({ kind: "start", stove: idx, dish: pick, cook });
    }
  });
  return out;
}
/**
 * Guests a second the staff can serve: the arrivals (popularity), the seats
 * (each turns over in SEAT_BASE plus the walk in and out) and the waiters
 * (each meal takes the plan's tMeal plus clearing), whichever is fewer.
 */
export interface ServiceParts {
  arrivals: number;
  seatRate: number;
  tMeal: number;
  seats: number;
  /** Clearing a table, for waiters with no janitor. */
  clear: number;
}
/** What doesn't change while you are away: the plan, the popularity. */
export function serviceParts(s: BistroState, pop: PopInput = {}): ServiceParts {
  const arrivals = 1 / arrivalSeconds(popularity(s, pop).total, false);
  const lay = layoutStats(s.items, sizeOf(s.sizeLv));
  let seatRate = 0;
  for (const x of lay.seats)
    seatRate += 1 / (SEAT_BASE + (2 * x.guest) / GUEST_TPS);
  return {
    arrivals,
    seatRate,
    tMeal: lay.tMeal,
    seats: lay.seats.length,
    clear: staffOf(s, "janitor").length ? 0 : CLEAR_SECONDS,
  };
}
/** Guests a second, with the waiters as tired as `energyAt` says. */
export function rateFrom(
  s: BistroState,
  p: ServiceParts,
  energyAt: (st: Staff) => number = energyOf,
): number {
  let speed = 0;
  for (const w of staffOf(s, "waiter")) speed += workSpeed(w, energyAt(w));
  const waiterRate = p.seats ? speed / (p.tMeal + p.clear) : 0;
  return Math.min(p.arrivals, p.seatRate, waiterRate);
}
export function serviceRate(
  s: BistroState,
  pop: PopInput = {},
  energyAt: (st: Staff) => number = energyOf,
): number {
  return rateFrom(s, serviceParts(s, pop), energyAt);
}
export interface AwayReport {
  /** Time the staff worked (capped by the shift), ms. */
  worked: number;
  away: number;
  capped: boolean;
  served: number;
  /** What guests paid. */
  coins: number;
  /** What the cooks spent on ingredients. */
  spent: number;
  batches: number;
  levels: number;
}
/**
 * The bistro while you were away: the cooks keep cooking, guests come at the
 * rate the seats and waiters allow and pay the plain price (no streaks, VIPs
 * or rush hours: those are for when you play). Stops when the shift ends.
 */
export function simulateAway(
  s: BistroState,
  from: number,
  to: number,
  /** Today's special (the server's pick); the local one when left out. */
  specialDish?: DishId,
  /** What else sets the popularity (likes, friends' meals…). */
  pop: PopInput = {},
): AwayReport | null {
  if (!from || to - from < AWAY_MIN_MS) return null;
  const cap = SHIFT_HOURS[s.shiftLv] * 3600_000;
  const end = Math.min(to, from + cap);
  const rep: AwayReport = {
    worked: end - from,
    away: to - from,
    capped: to - from > cap,
    served: 0,
    coins: 0,
    spent: 0,
    batches: 0,
    levels: 0,
  };
  const parts = serviceParts(s, { ...pop, trash: s.trash });
  const special = specialDish ?? todaySpecial(s.level, new Date(from));
  // Energy as of `from`, worn down by the work since.
  const corners = cornerCount(s.items);
  const e0 = new Map(s.staff.map((st) => [st.id, energyOf(st)]));
  const eAt = (st: Staff, t: number) =>
    afterWork(st, e0.get(st.id) ?? energyOf(st), t - from, corners);
  const STEP = 15_000;
  let acc = 0;
  let dirt = 0;
  let sweep = 0;
  for (let t = from; t < end; t += STEP) {
    const kitchen = autoKitchen(
      s,
      t,
      (c) => (c.friend ? FRIEND_BONUS : 1) * mood(eAt(c, t)),
    );
    for (const ev of kitchen) {
      if (ev.kind === "plate") {
        rep.batches++;
        rep.levels += ev.levels;
      } else rep.spent += DISH_BY_ID[ev.dish].cost;
    }
    const secs = Math.min(STEP, end - t) / 1000;
    acc += rateFrom(s, parts, (w) => eAt(w, t)) * awayRate(t - from) * secs;
    let servedNow = 0;
    while (acc >= 1) {
      const slot = fullestSlot(s);
      if (slot < 0) {
        acc = Math.min(acc, 1);
        break;
      }
      const dish = s.counter[slot]!.dish;
      takeServing(s, dish);
      const bill = payment(dish, {
        special: dish === special,
        hearts: 2,
        level: dishLevel(s, dish),
        stars: s.stars,
      });
      s.coins += bill.total;
      rep.coins += bill.total;
      rep.served++;
      s.served++;
      rep.levels += addXp(s, 1);
      servedNow++;
      acc--;
    }
    // Litter from the guests; the janitors sweep it up.
    dirt += LITTER_RATE * servedNow;
    while (dirt >= 1) {
      s.trash = Math.min(TRASH_MAX, s.trash + 1);
      dirt -= 1;
    }
    let jr = 0;
    for (const j of staffOf(s, "janitor")) jr += workSpeed(j, eAt(j, t));
    sweep += ((jr * SWEEPS_PER_HOUR) / 3600) * secs;
    while (sweep >= 1 && s.trash > 0) {
      s.trash--;
      sweep -= 1;
    }
    if (s.trash === 0) sweep = Math.min(sweep, 1);
  }
  // The shift's work, then rest for the rest of the time away.
  for (const st of s.staff) st.energy = afterRest(st, eAt(st, end), to - end);
  return rep;
}
export function buyStyle(
  s: BistroState,
  kind: "floor" | "wall",
  id: string,
): Result {
  const list = kind === "floor" ? FLOORS : WALLS;
  const def = list.find((f) => f.id === id);
  if (!def) return fail("Unknown style.");
  const owned: string[] = kind === "floor" ? s.floors : s.walls;
  if (!owned.includes(id)) {
    if (s.coins < def.price) return fail(`You need ${def.price} coins.`);
    s.coins -= def.price;
    owned.push(id);
  }
  if (kind === "floor") s.floor = id as FloorId;
  else s.wall = id as WallId;
  return { ok: true };
}

/* ───────────── the long game (migration 100) ─────────────
   Events through the year, catering orders, regulars with a story, a
   weekly league among friends, and new branches with stars. */
export interface BistroEvent {
  id: string;
  name: string;
  /** MM-DD, both days in (a range may wrap past the new year). */
  from: string;
  to: string;
  items: ItemKind[];
}
export const EVENTS: readonly BistroEvent[] = [
  {
    id: "harvest",
    name: "Harvest Moon",
    from: "09-15",
    to: "11-30",
    items: ["pumpkin", "haybale"],
  },
  {
    id: "lantern",
    name: "Lantern Festival",
    from: "12-15",
    to: "02-28",
    items: ["lantern", "blossom"],
  },
];
/** A full set of an event's items on the floor adds this much charm. */
export const EVENT_SET_CHARM = 6;
/** The event on a day (YYYY-MM-DD, Pacific), or null. */
export function eventOn(day: string): BistroEvent | null {
  const md = day.slice(5, 10);
  return (
    EVENTS.find((e) =>
      e.from <= e.to ? md >= e.from && md <= e.to : md >= e.from || md <= e.to,
    ) ?? null
  );
}

/* Branches: from level 30 open a new one. You start over (level 1, the
   first room; the furniture goes into storage) and keep your dishes'
   levels, the pantry, styles and regulars, and earn a star: +10% on every
   price, up to five. */
export const BRANCH_LEVEL = 30;
export const MAX_STARS = 5;
export const BRANCH_COINS = 500;
export function openBranch(s: BistroState): Result {
  if (s.level < BRANCH_LEVEL)
    return fail(`Open a new branch at level ${BRANCH_LEVEL}.`);
  if (s.stars >= MAX_STARS) return fail("Five stars: the most there are.");
  const d = defaultState();
  const stored = { ...s.stored };
  for (const it of s.items) stored[it.kind] = (stored[it.kind] ?? 0) + 1;
  s.level = 1;
  s.xp = 0;
  s.coins = BRANCH_COINS;
  s.rating = d.rating;
  s.items = d.items;
  s.nextId = d.nextId;
  s.stored = stored;
  s.stoves = d.stoves;
  s.counter = d.counter;
  s.staff = d.staff;
  s.kitchenLv = 0;
  s.shiftLv = 0;
  s.sizeLv = 0;
  s.trash = 0;
  s.stars++;
  return { ok: true };
}

/* Catering orders: the server posts them (dishes and amounts by your
   level); filling one takes the servings off the counter and pays 1.6
   times their price, with XP and, during an event, tokens. */
export interface CateringOrder {
  slot: number;
  dishes: { dish: DishId; qty: number }[] | null;
  coins: number;
  xp: number;
  tokens: number;
  /** When it goes (ms), or when the next one comes for an empty slot. */
  expires: number;
  next: number;
}
export const ORDER_PAY = 1.6;
export const orderSlots = (level: number) =>
  2 + (level >= 10 ? 1 : 0) + (level >= 20 ? 1 : 0);
export const onCounter = (s: BistroState, dish: DishId) =>
  s.counter.reduce((n, c) => n + (c?.dish === dish ? c.servings : 0), 0);
export function fillOrder(s: BistroState, o: CateringOrder): Result {
  if (!o.dishes) return fail("No order there yet.");
  for (const d of o.dishes)
    if (onCounter(s, d.dish) < d.qty)
      return fail(
        `You need ${d.qty} ${DISH_BY_ID[d.dish].name} on the counter.`,
      );
  for (const d of o.dishes)
    for (let i = 0; i < d.qty; i++) takeServing(s, d.dish);
  s.coins += o.coins;
  addXp(s, o.xp);
  s.tokens += o.tokens;
  return { ok: true };
}

/* Regulars: guests with a story in three visits, each asking for a dish
   in quantity; the last brings a Golden Plate. */
export interface Regular {
  id: string;
  /** A roster creature. */
  char: string;
  name: string;
  level: number;
  steps: { dish: DishId; qty: number; line: string }[];
}
export const REGULARS: readonly Regular[] = [
  {
    id: "mira",
    char: "astrabun",
    name: "Mira",
    level: 3,
    steps: [
      {
        dish: "goicuon",
        qty: 6,
        line: "My first day in town! Something fresh, please.",
      },
      {
        dish: "pho",
        qty: 8,
        line: "I brought my study group. Pho for everyone!",
      },
      {
        dish: "buncha",
        qty: 10,
        line: "We passed our exams! A feast to celebrate.",
      },
    ],
  },
  {
    id: "tobi",
    char: "wombolder",
    name: "Tobi",
    level: 6,
    steps: [
      { dish: "banhmi", qty: 10, line: "The builders next door are starving." },
      {
        dish: "comtam",
        qty: 10,
        line: "Lunch for the whole crew, it's a big job.",
      },
      {
        dish: "caphe",
        qty: 12,
        line: "The house is done! Coffee for the opening.",
      },
    ],
  },
  {
    id: "juno",
    char: "glacelle",
    name: "Juno",
    level: 10,
    steps: [
      { dish: "che", qty: 12, line: "A sweet treat for my dance class." },
      {
        dish: "banhxeo",
        qty: 12,
        line: "Our recital is tonight. Something crispy!",
      },
      {
        dish: "lau",
        qty: 10,
        line: "We won the regional cup. Hotpot for all!",
      },
    ],
  },
  {
    id: "rook",
    char: "tidefin",
    name: "Rook",
    level: 15,
    steps: [
      { dish: "miquang", qty: 14, line: "The fishing fleet is back early." },
      {
        dish: "chaca",
        qty: 12,
        line: "A storm's coming. The crew needs warming up.",
      },
      {
        dish: "banhcanh",
        qty: 14,
        line: "Biggest catch of the year! Let's celebrate.",
      },
    ],
  },
  {
    id: "sage",
    char: "lumoth",
    name: "Sage",
    level: 20,
    steps: [
      {
        dish: "flan",
        qty: 14,
        line: "I'm writing a food guide. Dessert first.",
      },
      { dish: "banhcanh", qty: 14, line: "Your soup made the second chapter." },
      {
        dish: "phoenix",
        qty: 12,
        line: "You're on the cover. The grand platter, please!",
      },
    ],
  },
];
export const REGULAR_BY_ID = Object.fromEntries(REGULARS.map((g) => [g.id, g]));
/** A visit's thanks: three times the plates' price (base), XP; the last a Golden Plate and 1,000 coins. */
export function regularReward(g: Regular, step: number) {
  const st = g.steps[step];
  const last = step === g.steps.length - 1;
  return {
    coins: st.qty * DISH_BY_ID[st.dish].price * 3 + (last ? 1000 : 0),
    xp: st.qty * 3,
    tokens: 3,
    trophy: last,
  };
}
export function fillRegular(
  s: BistroState,
  id: string,
  eventId: string | null,
): Result {
  const g = REGULAR_BY_ID[id];
  if (!g) return fail("Nobody by that name.");
  if (s.level < g.level) return fail(`${g.name} comes by at level ${g.level}.`);
  const step = s.regulars[id] ?? 0;
  if (step >= g.steps.length) return fail(`${g.name}'s story is complete.`);
  const st = g.steps[step];
  if (DISH_BY_ID[st.dish].level > s.level)
    return fail(
      `${DISH_BY_ID[st.dish].name} opens at level ${DISH_BY_ID[st.dish].level}.`,
    );
  if (onCounter(s, st.dish) < st.qty)
    return fail(
      `You need ${st.qty} ${DISH_BY_ID[st.dish].name} on the counter.`,
    );
  for (let i = 0; i < st.qty; i++) takeServing(s, st.dish);
  const r = regularReward(g, step);
  s.coins += r.coins;
  addXp(s, r.xp);
  if (eventId) s.tokens += r.tokens;
  if (r.trophy) s.stored.trophy = (s.stored.trophy ?? 0) + 1;
  s.regulars[id] = step + 1;
  return { ok: true };
}

/* The weekly league among friends: points for guests served (1), catering
   orders (10), a regular's visit (15) and meals at friends' (3). After the
   week, claim by your place among your friends (at least 50 points). */
export const LEAGUE_MIN = 50;
export function leagueReward(rank: number, points: number) {
  if (points < LEAGUE_MIN) return null;
  return rank === 1
    ? { coins: 2000, spice: 5 }
    : rank === 2
      ? { coins: 1200, spice: 3 }
      : rank === 3
        ? { coins: 800, spice: 2 }
        : { coins: 300, spice: 1 };
}
