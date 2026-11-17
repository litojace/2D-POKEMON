/**
 * The Bakery: the Farm's first processing chain. Crops and Storm Milk from
 * the barn bake into goods worth more than the raw crops, one at a time in
 * an oven with a queue. The database runs the rules
 * (supabase/migrations/20261117120000_farm_bakery.sql); this file mirrors
 * them for display, and tests/integration/farm-bakery.test.ts checks that
 * the two agree. Numbers and their reasons: docs/farm-bakery.md.
 */
import { BAKERY_GROUND, CROP_BY_ID, MILK } from "./farm.js";

/** Building it, its queue and where it stands on the farm. */
export const BAKERY = {
  /** Farm level it can be built at, its Gold Leaves price and the farm XP for building it. */
  level: 10,
  price: 1200,
  xp: 40,
  /** Queue slots when built, and at most. */
  startSlots: 2,
  maxSlots: 5,
  /** The price of the 3rd, 4th and 5th slot. */
  slotPrices: [600, 1200, 2400] as const,
  /** The middle of its front wall, on the ground (world px of the farm scene). */
  x: 1200,
  y: 925,
  /** The ground it takes: decorations can't stand here (DECOR_BLOCKS). */
  ground: BAKERY_GROUND,
} as const;

export interface BakeryRecipe {
  /** Also the good's id in the barn. */
  id: string;
  name: string;
  /** Farm level it unlocks at. */
  level: number;
  /** Oven time in real seconds (the server's clock). */
  seconds: number;
  /** Farm XP when collected. */
  xp: number;
  /** Gold Leaves each at the market (a fixed price). */
  sell: number;
  /** [good, count]: crops or Storm Milk, plain (no mutation). */
  items: readonly (readonly [string, number])[];
  /** Colours of its icon: main, shade and an accent. */
  color: string;
  shade: string;
  accent: string;
}

export const BAKERY_RECIPES: readonly BakeryRecipe[] = [
  {
    id: "bread",
    name: "Breeze Bread",
    level: 10,
    seconds: 10 * 60,
    xp: 6,
    sell: 24,
    items: [["wheat", 3]],
    color: "#e9a64f",
    shade: "#9c5a1f",
    accent: "#fff1c9",
  },
  {
    id: "berrytart",
    name: "Volt Berry Tart",
    level: 11,
    seconds: 30 * 60,
    xp: 12,
    sell: 40,
    items: [
      ["voltberry", 3],
      ["wheat", 2],
    ],
    color: "#f2c46a",
    shade: "#a86a24",
    accent: "#7a5cff",
  },
  {
    id: "milkbun",
    name: "Storm Milk Bun",
    level: 12,
    seconds: 45 * 60,
    xp: 16,
    sell: 105,
    items: [
      ["wheat", 2],
      ["milk", 1],
    ],
    color: "#f7dca8",
    shade: "#b98544",
    accent: "#4fb3ff",
  },
  {
    id: "carrotcake",
    name: "Carrot Cake",
    level: 14,
    seconds: 90 * 60,
    xp: 28,
    sell: 130,
    items: [
      ["carrot", 3],
      ["wheat", 2],
      ["milk", 1],
    ],
    color: "#d98a4a",
    shade: "#8a4a1f",
    accent: "#fff6ea",
  },
  {
    id: "pumpkinpie",
    name: "Lava Pumpkin Pie",
    level: 18,
    seconds: 3 * 3600,
    xp: 45,
    sell: 150,
    items: [
      ["pumpkin", 2],
      ["wheat", 2],
      ["milk", 1],
    ],
    color: "#ff8a3d",
    shade: "#a8481a",
    accent: "#f2d27a",
  },
  {
    id: "cornbread",
    name: "Twin Bolt Cornbread",
    level: 60,
    seconds: 6 * 3600,
    xp: 80,
    sell: 210,
    items: [
      ["boltcorn", 2],
      ["milk", 1],
    ],
    color: "#ffd65b",
    shade: "#b0841a",
    accent: "#4fb3ff",
  },
];
export const BAKERY_RECIPE_BY_ID: Readonly<Record<string, BakeryRecipe>> =
  Object.fromEntries(BAKERY_RECIPES.map((r) => [r.id, r]));
export const isBakedGood = (id: string) =>
  Object.hasOwn(BAKERY_RECIPE_BY_ID, id);

/** The name of anything the barn holds: a crop, Storm Milk or a baked good. */
export function goodName(id: string) {
  if (id === MILK.id) return MILK.name;
  return CROP_BY_ID[id]?.name ?? BAKERY_RECIPE_BY_ID[id]?.name ?? id;
}
/** The base price of a recipe's ingredients (crops' and milk's base prices). */
export function ingredientValue(r: BakeryRecipe, mult = 1, milkMult = mult) {
  return r.items.reduce(
    (a, [id, n]) =>
      a +
      n *
        (id === MILK.id
          ? MILK.sell * milkMult
          : (CROP_BY_ID[id]?.sell ?? 0) * mult),
    0,
  );
}
/** The price of the next queue slot, or null at the most. */
export function bakeSlotPrice(slots: number): number | null {
  const k = Math.floor(slots) - BAKERY.startSlots;
  return k >= 0 && k < BAKERY.slotPrices.length ? BAKERY.slotPrices[k] : null;
}

/** One thing in the oven's queue, as arena_farm_state reports it (ISO times). */
export interface BakeryQueueItem {
  slot: number;
  recipe: string;
  startedAt: string;
  readyAt: string;
}
export interface FarmBakery {
  owned: boolean;
  slots: number;
  /** In baking order (ready first). */
  queue: BakeryQueueItem[];
}

/**
 * The oven bakes one thing at a time: a new one starts when the last in the
 * queue is done, or now if the oven is idle. Times in ms.
 */
export function bakeStart(queue: readonly { readyAt: string }[], now: number) {
  return queue.reduce((t, q) => Math.max(t, Date.parse(q.readyAt)), now);
}
/** How far along one is at `now` (0 before it starts, 1 when ready). */
export function bakeProgress(
  q: { startedAt: string; readyAt: string },
  now: number,
) {
  const s = Date.parse(q.startedAt),
    e = Date.parse(q.readyAt);
  if (now >= e) return 1;
  if (now <= s || e <= s) return 0;
  return (now - s) / (e - s);
}
/** The lowest free slot, or -1 with the queue full. */
export function freeBakeSlot(
  queue: readonly { slot: number }[],
  slots: number,
) {
  for (let s = 0; s < slots; s++)
    if (!queue.some((q) => q.slot === s)) return s;
  return -1;
}
type BarnRow = { crop: string; mutation: string; qty: number };
/** Plain (no mutation) stock of a good in the barn. */
export const plainStock = (barn: readonly BarnRow[], id: string) =>
  barn
    .filter((b) => b.crop === id && b.mutation === "")
    .reduce((a, b) => a + b.qty, 0);

/** Why a recipe can't go in the oven now, or null when it can (the server's checks, in its order). */
export function bakeError(
  farm: { level: number; barn: readonly BarnRow[]; bakery?: FarmBakery | null },
  recipe: string,
): string | null {
  const b = farm.bakery,
    r = BAKERY_RECIPE_BY_ID[recipe];
  if (!b?.owned) return "Build the bakery first";
  if (!r) return "Unknown recipe";
  if (farm.level < r.level) return `Unlocks at farm level ${r.level}`;
  if (b.queue.length >= b.slots) return "The bakery queue is full";
  for (const [id, n] of r.items)
    if (plainStock(farm.barn, id) < n) return `You need ${n} ${goodName(id)}`;
  return null;
}
/** Why a slot can't be collected now, or null when it can. */
export function collectError(
  farm: {
    barn: readonly BarnRow[];
    barnCap: number;
    bakery?: FarmBakery | null;
  },
  slot: number,
  now: number,
): string | null {
  const q = farm.bakery?.queue.find((x) => x.slot === slot);
  if (!q) return "Nothing in that slot";
  if (Date.parse(q.readyAt) > now) return "Still baking";
  if (farm.barn.reduce((a, x) => a + x.qty, 0) + 1 > farm.barnCap)
    return "Your barn is full";
  return null;
}
