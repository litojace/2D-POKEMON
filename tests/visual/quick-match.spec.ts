import { expect, test, type Page } from "@playwright/test";
import { openHub, skipTour, snap } from "./helpers";

// Quick Match (quick-match.ts, docs/pvp-plan.md item 1): for a player past
// the coached first match, PLAY defaults to Quick Match; the search sheet
// fits a phone in landscape, Cancel leaves the queue, and after the wait it
// offers a labelled bot that starts by itself.
const SIZES = [
  { width: 956, height: 440, deviceScaleFactor: 3 },
  { width: 844, height: 390, deviceScaleFactor: 2 },
];

/** Answer quick-join as the server does for a lone searcher; record emits. */
async function lonelyQueue(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__emitted = [];
    w.__emit = (ev: string, data: unknown) => w.__emitted.push({ ev, data });
    const base = w.__reply;
    w.__reply = (ev: string, data: unknown) =>
      ev === "quick-join"
        ? { ok: true, queued: true, online: 2 }
        : ev === "quick-leave"
          ? { ok: true }
          : base?.(ev, data);
  });
}
const sent = (page: Page) =>
  page.evaluate(() => (window as any).__emitted.map((e: any) => e.ev));

for (const size of SIZES)
  test(`Quick Match search sheet at ${size.width}x${size.height}`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: size.deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      await page.clock.install();
      const errors = await openHub(page);
      await expect(page.locator("#lobby-mode")).toContainText("Quick Match");
      await lonelyQueue(page);
      await page.locator("#lobby-play").tap();
      const sheet = page.locator("#quick-search");
      await expect(sheet).toBeVisible();
      await expect(sheet).toContainText("Searching for an opponent");
      await expect(sheet).toContainText("2 other players online");
      expect(await sent(page)).toContain("quick-join");
      const box = (await sheet.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
      expect(box.y + box.height).toBeLessThanOrEqual(size.height);
      for (const b of await sheet.locator("button").all())
        expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await snap(page, info, `quick-search-${size.width}`);

      // The wait runs out: the offer names the bot as a bot.
      await page.clock.fastForward(21_000);
      await expect(sheet).toHaveAttribute("data-state", "offer");
      await expect(sheet).toContainText("No one is free right now");
      await expect(sheet).toContainText("(Bot)");
      const offer = (await sheet.boundingBox())!;
      expect(offer.y + offer.height).toBeLessThanOrEqual(size.height);
      await snap(page, info, `quick-offer-${size.width}`);
      // Keep searching goes back to the timer; Cancel leaves the queue.
      await sheet.locator("[data-quick-keep]").tap();
      await expect(sheet).toHaveAttribute("data-state", "searching");
      await sheet.locator("[data-quick-cancel]").tap();
      await expect(sheet).toHaveCount(0);
      await expect.poll(() => sent(page)).toContain("quick-leave");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("an unanswered offer starts a Quick Match bot by itself", async ({
  page,
}) => {
  await page.setViewportSize({ width: 956, height: 440 });
  await page.clock.install();
  const errors = await openHub(page);
  await lonelyQueue(page);
  await page.locator("#lobby-play").click();
  await expect(page.locator("#quick-search")).toBeVisible();
  await page.clock.fastForward(21_000);
  await expect(page.locator("#quick-search")).toHaveAttribute(
    "data-state",
    "offer",
  );
  await page.clock.fastForward(7_000);
  await expect(page.locator("#quick-search")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).__emitted.find((e: any) => e.ev === "bot-match")
            ?.data,
      ),
    )
    .toMatchObject({ quick: true, difficulty: "easy" });
  expect(errors).toEqual([]);
});

test("a new player's PLAY is still the coached Easy bot, not Quick Match", async ({
  page,
}) => {
  await skipTour(page);
  await page.addInitScript(() => {
    (window as any).__economyPatch = {
      journey: {
        xp: 0,
        recent: [],
        season: {
          id: "2026-10",
          xp: 0,
          week: "2026-W43",
          goals: {},
          completed: [],
        },
        unlocked: [],
      },
    };
  });
  await page.setViewportSize({ width: 956, height: 440 });
  await openHub(page);
  await expect(page.locator("#lobby-mode")).toContainText("Easy");
});
