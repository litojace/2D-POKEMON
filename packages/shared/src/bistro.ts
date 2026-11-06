/*
 * Element Bistro: the catalog and the rules, shared by the client and the
 * tests. The rules that change coins, stoves, the counter, the staff and the
 * floor plan run in the database (supabase/migrations/067_bistro.sql), on the
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
  "goicuon" | "banhmi" | "pho" | "buncha" | "comtam" | "che" | "caphe" | "lau";
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
];
export const DISH_BY_ID: Record<DishId, Dish> = Object.fromEntries(
  DISHES.map((d) => [d.id, d]),
) as Record<DishId, Dish>;
export const isDish = (v: unknown): v is DishId =>
  typeof v === "string" && Object.hasOwn(DISH_BY_ID, v);

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
export type Role = "cook" | "waiter";
export interface Staff {
  id: number;
  /** A roster creature id. */
  char: string;
  role: Role;
  level: number;
  /** What a cook makes (cooks only). */
  dish: DishId;
}
export const STAFF_MAX_LEVEL = 5;
/** Hiring the n-th cook or waiter: the bistro level it opens at, and its price. */
export const HIRE_STEPS: Record<
  Role,
  readonly { level: number; price: number }[]
> = {
  cook: [
    { level: 2, price: 250 },
    { level: 5, price: 900 },
  ],
  waiter: [
    { level: 1, price: 0 },
    { level: 3, price: 400 },
    { level: 6, price: 1000 },
  ],
};
/** Each staff level after the first: 12% quicker. */
export const staffSpeed = (level: number) => 1 + 0.12 * (level - 1);
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
  if (Array.isArray(r.staff)) {
    const staff: Staff[] = [];
    for (const st of r.staff as Record<string, unknown>[]) {
      if (!st || (st.role !== "cook" && st.role !== "waiter")) continue;
      if (typeof st.char !== "string" || !Object.hasOwn(CHARACTERS, st.char))
        continue;
      if (
        staff.filter((x) => x.role === st.role).length >=
        HIRE_STEPS[st.role].length
      )
        continue;
      if (staff.some((x) => x.char === st.char)) continue;
      staff.push({
        id: staff.length + 1,
        char: st.char,
        role: st.role,
        level: Math.floor(num(st.level, 1, 1, STAFF_MAX_LEVEL)),
        dish: isDish(st.dish) ? st.dish : "goicuon",
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
    // A level-up gift: a little cash to spend on the new things.
    s.coins += levelGift(s.level);
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
  },
): { base: number; tip: number; total: number } {
  const d = DISH_BY_ID[dish];
  let base = d.price;
  if (o.special) base *= SPECIAL_MULT;
  if (o.vip) base *= VIP_MULT;
  base = Math.round(base);
  // Whole percents, so the database (067_bistro.sql) rounds the same way.
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
export function cookMs(s: BistroState, dish: DishId, cookLevel = 1): number {
  return Math.round(
    (DISH_BY_ID[dish].seconds * 1000 * (1 - 0.1 * s.kitchenLv)) /
      staffSpeed(cookLevel),
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
    dur: cookMs(s, dish, cookLevel),
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
  const servings = d.servings + (st.perfect ? PERFECT_BONUS : 0);
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
  return items.reduce((n, i) => n + ITEM_BY_KIND[i.kind].charm, 0);
}
/** Seconds between customers: faster with stars, charm and a rush hour. */
export function arrivalSeconds(
  rating: number,
  charmPts: number,
  rush: boolean,
): number {
  const base = 9 - rating * 0.9 - Math.min(30, charmPts) * 0.08;
  return Math.max(2.2, base) * (rush ? 0.45 : 1);
}
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

export function buyItem(s: BistroState, kind: ItemKind): Result {
  const def = ITEM_BY_KIND[kind];
  if (!def) return fail("Unknown item.");
  if (def.level > s.level) return fail(`Opens at level ${def.level}.`);
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
export function hire(s: BistroState, role: Role, char: string): Result {
  const step = nextHire(s, role);
  if (!step) return fail(`You have every ${role} you can hire.`);
  if (s.level < step.level) return fail(`Hire at level ${step.level}.`);
  if (!Object.hasOwn(CHARACTERS, char)) return fail("Unknown creature.");
  if (s.staff.some((x) => x.char === char))
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
  });
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
export function autoKitchen(s: BistroState, now: number): KitchenEvent[] {
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
      if (pick && startCooking(s, idx, pick, now, cook.level).ok)
        out.push({ kind: "start", stove: idx, dish: pick, cook });
    }
  });
  return out;
}
/** Guests a second the staff can serve: the arrivals, the seats and the waiters, whichever is fewer. */
export function serviceRate(s: BistroState): number {
  const arrivals = 1 / arrivalSeconds(s.rating, charm(s.items), false);
  const seatRate = seats(s.items).length / 28;
  const waiterRate =
    staffOf(s, "waiter").reduce((n, w) => n + staffSpeed(w.level), 0) / 10;
  return Math.min(arrivals, seatRate, waiterRate);
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
  const rate = serviceRate(s) * AWAY_RATE;
  const special = specialDish ?? todaySpecial(s.level, new Date(from));
  const STEP = 15_000;
  let acc = 0;
  for (let t = from; t < end; t += STEP) {
    for (const ev of autoKitchen(s, t)) {
      if (ev.kind === "plate") {
        rep.batches++;
        rep.levels += ev.levels;
      } else rep.spent += DISH_BY_ID[ev.dish].cost;
    }
    acc += rate * (Math.min(STEP, end - t) / 1000);
    while (acc >= 1) {
      let slot = -1;
      s.counter.forEach((c, i) => {
        if (
          c &&
          c.servings > 0 &&
          (slot < 0 || c.servings > s.counter[slot]!.servings)
        )
          slot = i;
      });
      if (slot < 0) {
        acc = Math.min(acc, 1);
        break;
      }
      const dish = s.counter[slot]!.dish;
      takeServing(s, dish);
      const bill = payment(dish, { special: dish === special, hearts: 2 });
      s.coins += bill.total;
      rep.coins += bill.total;
      rep.served++;
      s.served++;
      rep.levels += addXp(s, 1);
      acc--;
    }
  }
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
