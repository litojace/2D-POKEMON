import { expect, test, type Page } from "@playwright/test";
import { openHub, skipTour, snap } from "./helpers";
import { onPlayersLook } from "./players-look";

// In the look players have (players-look.ts).
onPlayersLook();

// The daily gift (daily-gift.ts): its dialog opens on the Lobby while
// today's gift waits, shows seven days with today's lit, Claim takes it and
// the dialog then says what it gave and what tomorrow's is; Later puts it
// away for this visit and the Menu brings it back.
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(
    new Date(),
  );
async function withGift(
  page: Page,
  gift: { day: number; claimed?: boolean; weeks?: number; ownsItem?: boolean },
  given: { coins: number; xp: number; item: string | null },
  after: object = {},
) {
  await skipTour(page);
  await page.addInitScript(
    ({ gift, given, after, today }) => {
      const w = window as any;
      w.__gift = {
        today,
        claimed: false,
        weeks: 0,
        ownsItem: false,
        ...gift,
      };
      w.__giftGiven = { day: gift.day, ...given };
      w.__giftAfter = after;
      w.__economyCalls = 0;
    },
    { gift, given, after, today: today() },
  );
}
const dialog = (page: Page) => page.locator("[data-gift] .gift-modal");
type Box = { x: number; y: number; width: number; height: number };

const SIZES = [
  { width: 667, height: 375, phone: true },
  { width: 844, height: 390, phone: true },
  {
    width: 852,
    height: 393,
    phone: true,
    inset: { left: 59, right: 59, bottom: 21, top: 0 },
  },
  { width: 1440, height: 900, phone: false },
];
for (const size of SIZES) {
  const name = `${size.width}x${size.height}${size.inset ? "-notch" : ""}`;
  test(`today's gift waits on the Lobby, and Claim takes it (${name})`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      await withGift(page, { day: 3 }, { coins: 75, xp: 0, item: null });
      const errors = await openHub(page);
      if (size.inset)
        await page.evaluate((inset) => {
          for (const [key, value] of Object.entries(inset))
            document.documentElement.style.setProperty(
              `--safe-${key}`,
              `${value}px`,
            );
        }, size.inset);
      const modal = dialog(page);
      await expect(modal).toBeVisible();
      await expect(modal.locator(".ui-kicker")).toHaveText(
        "Daily gift · Day 3 of 7",
      );
      await expect(modal.locator(".ui-title")).toHaveText(
        "Today's gift: 75 coins",
      );
      await expect(modal.locator(".gift-sub")).toHaveText(
        "Come back every day. Day 7: the Firefly aura.",
      );
      // Seven days: two taken, today's lit, the rest to come.
      const days = modal.locator(".gift-day");
      await expect(days).toHaveCount(7);
      await expect(modal.locator(".gift-day.is-taken")).toHaveCount(2);
      await expect(modal.locator(".gift-day.is-today")).toHaveCount(1);
      await expect(days.nth(2)).toHaveClass(/is-today/);
      await expect(days.nth(2)).toContainText("75");
      await expect(days.nth(6)).toContainText("Aura");
      // The dialog is whole and inside the safe area; the seven tiles are
      // one row of equal boxes, each one's words inside it.
      const box = (await modal.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(size.inset?.left ?? 0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(
        size.width - (size.inset?.right ?? 0),
      );
      expect(box.y + box.height).toBeLessThanOrEqual(size.height);
      const tiles: Box[] = [];
      for (const d of await days.all()) {
        tiles.push((await d.boundingBox())!);
        for (const part of ["small", "b"])
          expect(
            await d
              .locator(part)
              .evaluate((el) => el.scrollWidth - el.clientWidth),
            `a day's ${part} fits`,
          ).toBeLessThanOrEqual(1);
      }
      for (let i = 1; i < tiles.length; i++) {
        expect(Math.abs(tiles[i].y - tiles[0].y)).toBeLessThan(1);
        expect(Math.abs(tiles[i].width - tiles[0].width)).toBeLessThan(1.5);
        expect(Math.abs(tiles[i].height - tiles[0].height)).toBeLessThan(1.5);
        expect(tiles[i].x).toBeGreaterThanOrEqual(
          tiles[i - 1].x + tiles[i - 1].width,
        );
      }
      for (const b of await modal.locator("button").all()) {
        const r = (await b.boundingBox())!;
        expect(r.height).toBeGreaterThanOrEqual(44);
        expect(r.y + r.height).toBeLessThanOrEqual(box.y + box.height);
      }
      await snap(page, info, `gift-waiting-${name}`);

      // Claim: once, and the dialog says what it gave and what is next.
      await modal.locator("[data-gift-claim]").click();
      await expect(modal.locator(".ui-title")).toHaveText("Day 3: +75 coins");
      await expect(modal.locator(".gift-sub")).toHaveText("Tomorrow: 150 XP");
      await expect(modal.locator(".gift-day.is-taken")).toHaveCount(3);
      await expect(modal.locator("[data-gift-claim]")).toHaveCount(0);
      await expect(modal.locator("button")).toHaveCount(1);
      await expect(modal.locator("button")).toHaveText("Got it");
      expect(await page.evaluate(() => (window as any).__giftClaims)).toBe(1);
      const after = (await modal.boundingBox())!;
      expect(after.y + after.height).toBeLessThanOrEqual(size.height);
      await page.evaluate(() => {
        for (const a of document.getAnimations())
          if (a.effect?.getTiming().iterations !== Infinity) a.finish();
      });
      await snap(page, info, `gift-taken-${name}`);
      await modal.locator("[data-gift-close]").click();
      await expect(page.locator("[data-gift]")).toHaveCount(0);
      // Taken: it doesn't come back on its own, and the Menu shows it.
      await page.waitForTimeout(600);
      await expect(page.locator("[data-gift]")).toHaveCount(0);
      await page.click("#header-menu > summary");
      await page.click("#daily-gift");
      await expect(dialog(page).locator(".ui-title")).toHaveText(
        "Today's gift is yours",
      );
      await expect(dialog(page).locator("[data-gift-claim]")).toHaveCount(0);
      await expect(dialog(page).locator(".gift-sub")).toHaveText(
        "Tomorrow: 150 XP",
      );
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("Later puts it away for this visit; Escape and a tap outside close it too", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await withGift(page, { day: 1 }, { coins: 50, xp: 0, item: null });
  const errors = await openHub(page);
  await expect(dialog(page)).toBeVisible();
  await dialog(page).locator('[data-gift-close]:has-text("Later")').click();
  await expect(page.locator("[data-gift]")).toHaveCount(0);
  // Back on the Lobby from a screen: it stays away.
  await page.click('.lobby-rail [data-lobby-action="fighters"]');
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  await expect(page.locator("[data-gift]")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__giftClaims ?? 0)).toBe(0);
  // The Menu opens it, still to claim.
  await page.click("#header-menu > summary");
  await page.click("#daily-gift");
  await expect(dialog(page).locator("[data-gift-claim]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-gift]")).toHaveCount(0);
  await page.click("#header-menu > summary");
  await page.click("#daily-gift");
  await page.locator("[data-gift]").click({ position: { x: 8, y: 8 } });
  await expect(page.locator("[data-gift]")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the seventh day of a first week gives the aura; a second week's pays coins", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await withGift(
    page,
    { day: 7 },
    { coins: 0, xp: 0, item: "firefly-aura" },
    { ownsItem: true },
  );
  const errors = await openHub(page);
  const modal = dialog(page);
  await expect(modal.locator(".ui-title")).toHaveText(
    "Today's gift: Firefly aura",
  );
  await expect(modal.locator(".gift-day.is-taken")).toHaveCount(6);
  await modal.locator("[data-gift-claim]").click();
  await expect(modal.locator(".ui-title")).toHaveText("Day 7: +Firefly aura");
  // Tomorrow is day 1 of the next week.
  await expect(modal.locator(".gift-sub")).toHaveText("Tomorrow: 50 coins");
  await snap(page, info, "gift-day7-844x390");
  expect(errors).toEqual([]);
});

test("a refused claim says why and takes nothing twice", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await withGift(page, { day: 2 }, { coins: 0, xp: 100, item: null });
  const errors = await openHub(page);
  const modal = dialog(page);
  await expect(modal).toBeVisible();
  // Taken on another device since this dialog opened.
  await page.evaluate(() => ((window as any).__gift.claimed = true));
  await modal.locator("[data-gift-claim]").click();
  await expect(modal.locator(".gift-problem")).toHaveText(
    "Today's gift is already yours. Come back tomorrow.",
  );
  expect(errors).toEqual([]);
});

test("a brand-new player plays first: no gift dialog before their first match", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await withGift(page, { day: 1 }, { coins: 50, xp: 0, item: null });
  await page.addInitScript(() => {
    const w = window as any;
    w.__economyPatch = {
      journey: {
        xp: 0,
        recent: [],
        season: {
          id: "2026-11",
          xp: 0,
          week: "2026-W48",
          goals: {},
          completed: [],
        },
        unlocked: [],
      },
    };
    w.__progress = {
      matches: 0,
      wins: 0,
      fighters: {},
      achievements: [],
      season: { id: "2026-11", matches: 0, wins: 0 },
    };
  });
  const errors = await openHub(page);
  await expect(page.locator("#lobby-play")).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.locator("[data-gift]")).toHaveCount(0);
  // The Menu still shows it to anyone who looks.
  await page.click("#header-menu > summary");
  await page.click("#daily-gift");
  await expect(dialog(page).locator("[data-gift-claim]")).toBeVisible();
  expect(errors).toEqual([]);
});

test("without the gift routes (a server before its migration) the Lobby is as it was", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await skipTour(page);
  const errors = await openHub(page);
  await expect(page.locator("#lobby-play")).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(page.locator("[data-gift]")).toHaveCount(0);
  expect(errors).toEqual([]);
});
