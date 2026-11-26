/**
 * The daily gift (owner, 26 Nov 2026): open the game on a new Pacific day
 * and take a gift, a little more each day in a row, with a cosmetic on the
 * seventh. A reason to come back tomorrow that asks for nothing but
 * showing up: the mission streak's 300 coins need all six missions seven
 * days running, which only the keenest players reach.
 *
 * The database gives the gifts (migration 20261126150000_daily_gift.sql,
 * arena_daily_gift_claim); this table is what the client shows, and
 * tests/integration/daily-gift.test.ts holds the two together.
 *
 * Rules:
 * - One gift a Pacific day (the missions' day, arena_today()).
 * - The next day in a row is the next gift. A missed day is forgiven once
 *   in a row: two days after the last gift the row still goes on. Three or
 *   more days away, it starts again at day 1.
 * - After day 7 comes day 1 of the next week.
 * - The cosmetic is the first week's only (or coins, if you own it): from
 *   the second week on, day 7 pays coins, so the Shop's prices keep their
 *   meaning.
 */
import { z } from "zod";

export interface DailyGift {
  /** Coins this day gives. */
  coins?: number;
  /** Player XP this day gives (doubled by the Daily Spark like any XP). */
  xp?: number;
  /** A cosmetic, the first week only; `coins` is what the day pays instead. */
  item?: string;
}
/** Days 1 to 7, in order. */
export const DAILY_GIFTS: readonly DailyGift[] = [
  { coins: 50 },
  { xp: 100 },
  { coins: 75 },
  { xp: 150 },
  { coins: 100 },
  { xp: 200 },
  { item: "firefly-aura", coins: 200 },
];
export const DAILY_GIFT_DAYS = DAILY_GIFTS.length;
/** Days since the last gift at which the row still goes on (one missed day). */
export const DAILY_GIFT_GRACE = 2;

/** A player's place in the calendar, as the database reports it. */
export const dailyGiftStateSchema = z.object({
  /** The Pacific day this was read (YYYY-MM-DD). */
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Today's gift has been taken. */
  claimed: z.boolean(),
  /** The day (1–7) that today's gift is, taken or not. */
  day: z.number().int().min(1).max(7),
  /** Whole weeks finished: the cosmetic is week 0's. */
  weeks: z.number().int().min(0),
  /** The day-7 cosmetic is already yours (it pays its coins instead). */
  ownsItem: z.boolean(),
});
export type DailyGiftState = z.infer<typeof dailyGiftStateSchema>;
/** What a claim gave, with the calendar after it. */
export const dailyGiftClaimSchema = dailyGiftStateSchema.extend({
  given: z.object({
    day: z.number().int().min(1).max(7),
    coins: z.number().int().min(0),
    xp: z.number().int().min(0),
    item: z.string().nullable(),
  }),
});
export type DailyGiftClaim = z.infer<typeof dailyGiftClaimSchema>;

/**
 * The day (1–7) the next gift is, from the last one: the day after it when
 * it was yesterday or (one missed day) the day before; day 1 otherwise, or
 * after day 7. `daysSince` is null for a first gift.
 */
export function nextGiftDay(lastDay: number, daysSince: number | null) {
  if (daysSince === null || daysSince > DAILY_GIFT_GRACE || daysSince < 1)
    return 1;
  return lastDay >= DAILY_GIFT_DAYS ? 1 : lastDay + 1;
}
/** What a day gives this player: the cosmetic only in the first week, unowned. */
export function giftOn(
  day: number,
  state: Pick<DailyGiftState, "weeks" | "ownsItem">,
): { coins: number; xp: number; item: string | null } {
  const gift = DAILY_GIFTS[day - 1] ?? DAILY_GIFTS[0];
  const item =
    gift.item && state.weeks === 0 && !state.ownsItem ? gift.item : null;
  return {
    coins: item ? 0 : (gift.coins ?? 0),
    xp: gift.xp ?? 0,
    item,
  };
}
