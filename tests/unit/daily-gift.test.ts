import { describe, expect, it } from "vitest";
import {
  DAILY_GIFTS,
  DAILY_GIFT_DAYS,
  dailyGiftClaimSchema,
  dailyGiftStateSchema,
  giftOn,
  nextGiftDay,
  type DailyGiftState,
} from "../../packages/shared/src/daily-gifts";
import { LOOK_ITEM_BY_ID, MISSION_COINS } from "../../packages/shared/src/shop";
import {
  dayAfter,
  giftLabel,
  giftMarkup,
  tomorrowGift,
} from "../../apps/client/src/daily-gift";
import { rewardsMarkup } from "../../apps/client/src/result-rewards";

// The daily gift's rules (packages/shared/src/daily-gifts.ts) and its
// dialog's words. The database's side: tests/integration/daily-gift.test.ts.
const state = (extra: Partial<DailyGiftState> = {}): DailyGiftState => ({
  today: "2026-11-26",
  claimed: false,
  day: 1,
  weeks: 0,
  ownsItem: false,
  ...extra,
});

describe("the calendar", () => {
  it("is seven days, each with one thing, a little more as the days go", () => {
    expect(DAILY_GIFT_DAYS).toBe(7);
    for (const g of DAILY_GIFTS.slice(0, 6))
      expect(Number(!!g.coins) + Number(!!g.xp) + Number(!!g.item)).toBe(1);
    const coins = DAILY_GIFTS.flatMap((g) =>
      g.item ? [] : [g.coins ?? 0],
    ).filter(Boolean);
    const xp = DAILY_GIFTS.flatMap((g) => (g.xp ? [g.xp] : []));
    expect(coins).toEqual([...coins].sort((a, b) => a - b));
    expect(xp).toEqual([...xp].sort((a, b) => a - b));
  });
  it("ends on a cosmetic the Shop sells, with coins for whoever owns it", () => {
    const last = DAILY_GIFTS[6];
    expect(LOOK_ITEM_BY_ID[last.item!]).toBeTruthy();
    expect(last.coins).toBeGreaterThan(0);
    // Worth having: the cosmetic costs more than the coins it stands for.
    expect(LOOK_ITEM_BY_ID[last.item!].price).toBeGreaterThan(last.coins!);
  });
  it("is a small part of what playing pays", () => {
    // A week of gifts, from the second week on, against one day's six
    // missions at their cheapest.
    const week = DAILY_GIFTS.reduce((n, g) => n + (g.coins ?? 0), 0);
    expect(week / 7).toBeLessThan(MISSION_COINS.easy * 6 * 0.5);
  });
});

describe("which day is next", () => {
  it("a first gift is day 1", () => {
    expect(nextGiftDay(0, null)).toBe(1);
  });
  it("the day after yesterday's", () => {
    for (let d = 1; d <= 6; d++) expect(nextGiftDay(d, 1)).toBe(d + 1);
    expect(nextGiftDay(7, 1)).toBe(1);
  });
  it("one missed day is forgiven", () => {
    expect(nextGiftDay(3, 2)).toBe(4);
    expect(nextGiftDay(7, 2)).toBe(1);
  });
  it("three or more days away start over", () => {
    for (const gap of [3, 4, 30]) expect(nextGiftDay(5, gap)).toBe(1);
  });
});

describe("what a day gives", () => {
  it("the cosmetic in the first week, for a player who doesn't own it", () => {
    expect(giftOn(7, { weeks: 0, ownsItem: false })).toEqual({
      coins: 0,
      xp: 0,
      item: "firefly-aura",
    });
  });
  it("its coins from the second week on, or when it is owned", () => {
    for (const s of [
      { weeks: 1, ownsItem: true },
      { weeks: 3, ownsItem: false },
      { weeks: 0, ownsItem: true },
    ])
      expect(giftOn(7, s)).toEqual({ coins: 200, xp: 0, item: null });
  });
  it("coins or XP on the other days", () => {
    expect(giftOn(1, state())).toEqual({ coins: 50, xp: 0, item: null });
    expect(giftOn(2, state())).toEqual({ coins: 0, xp: 100, item: null });
    expect(giftOn(6, state())).toEqual({ coins: 0, xp: 200, item: null });
  });
});

describe("the dialog's words", () => {
  it("names a gift", () => {
    expect(giftLabel({ coins: 75, xp: 0, item: null })).toBe("75 coins");
    expect(giftLabel({ coins: 0, xp: 150, item: null })).toBe("150 XP");
    expect(giftLabel({ coins: 0, xp: 0, item: "firefly-aura" })).toBe(
      "Firefly aura",
    );
  });
  it("tomorrow follows today, and day 7 is followed by day 1", () => {
    expect(dayAfter(3)).toBe(4);
    expect(dayAfter(7)).toBe(1);
    expect(tomorrowGift(state({ day: 3 }))).toMatchObject({
      day: 4,
      xp: 150,
    });
    // The aura taken today: tomorrow is next week's day 1.
    expect(
      tomorrowGift(state({ day: 7, claimed: true, weeks: 1, ownsItem: true })),
    ).toMatchObject({ day: 1, coins: 50 });
  });
  it("waiting: today's gift, what the week ends on, Later and Claim", () => {
    const html = giftMarkup(state({ day: 3 }));
    expect(html).toContain("Daily gift · Day 3 of 7");
    expect(html).toContain("Today&#39;s gift: 75 coins");
    expect(html).toContain("Day 7: the Firefly aura.");
    expect(html).toContain("data-gift-claim");
    expect(html.match(/class="gift-day[ "]/g)).toHaveLength(7);
    expect(html.match(/is-taken/g)).toHaveLength(2);
    expect(html.match(/is-today/g)).toHaveLength(1);
    // A second week's seventh day is coins.
    expect(giftMarkup(state({ day: 2, weeks: 1, ownsItem: true }))).toContain(
      "Day 7: 200 coins.",
    );
  });
  it("taken: what it gave and what tomorrow's is, one button", () => {
    const html = giftMarkup(state({ day: 3, claimed: true }), {
      coins: 75,
      xp: 0,
      item: null,
    });
    expect(html).toContain("Day 3: +75 coins");
    expect(html).toContain("Tomorrow: 150 XP");
    expect(html).not.toContain("data-gift-claim");
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html.match(/is-taken/g)).toHaveLength(3);
    // Looked at again later that day.
    expect(giftMarkup(state({ day: 3, claimed: true }))).toContain(
      "Today&#39;s gift is yours",
    );
  });
  it("the aura just taken shows on its own tile", () => {
    const html = giftMarkup(
      state({ day: 7, claimed: true, weeks: 1, ownsItem: true }),
      { coins: 0, xp: 0, item: "firefly-aura" },
    );
    expect(html).toContain("Day 7: +Firefly aura");
    expect(html).toContain("Day 7: Firefly aura, taken");
    expect(html).toContain("Tomorrow: 50 coins");
  });
});

describe("what the server may send", () => {
  it("accepts a calendar and a claim, and nothing malformed", () => {
    expect(dailyGiftStateSchema.safeParse(state()).success).toBe(true);
    expect(dailyGiftStateSchema.safeParse(state({ day: 0 })).success).toBe(
      false,
    );
    expect(dailyGiftStateSchema.safeParse(state({ day: 8 })).success).toBe(
      false,
    );
    expect(
      dailyGiftStateSchema.safeParse({ ...state(), today: "today" }).success,
    ).toBe(false);
    expect(dailyGiftClaimSchema.safeParse(state()).success).toBe(false);
    expect(
      dailyGiftClaimSchema.safeParse({
        ...state({ claimed: true }),
        given: { day: 1, coins: 50, xp: 0, item: null },
      }).success,
    ).toBe(true);
  });
});

describe("on the result sheet", () => {
  it("one line under the rewards", () => {
    const facts = {
      won: true,
      journey: {
        xp: 2625,
        recent: [
          {
            ref: "match:m",
            amount: 25,
            source: "match",
            at: "2026-11-26T20:00:00Z",
          },
        ],
        season: { id: "2026-11", xp: 25, week: "w", goals: {}, completed: [] },
        unlocked: [],
      } as any,
      ref: "match:m",
      eligible: true,
    };
    expect(rewardsMarkup(facts)).not.toContain("rw-gift");
    expect(
      rewardsMarkup({ ...facts, gift: "Tomorrow's gift: 150 XP" }),
    ).toContain("Tomorrow&#39;s gift: 150 XP");
  });
});
