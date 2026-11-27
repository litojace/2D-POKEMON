import { expect, test, type Page } from "@playwright/test";
import { openHub, skipTour, snap } from "./helpers";
import { onPlayersLook } from "./players-look";

// In the look players have (players-look.ts).
onPlayersLook();

// Getting started (getting-started.ts): a new account's Lobby shows the
// guide in the Journey card's place; the sheet lists the steps; Go does a
// step; Hide puts the Journey back; the Menu brings the guide back.
// At level 2, as after a first win: the boss step is open (at level 1 it
// wears its padlock: tests/visual/feature-unlocks.spec.ts).
async function newPlayer(page: Page) {
  await skipTour(page);
  await page.addInitScript(() => {
    const w = window as any;
    w.__economyPatch = {
      journey: {
        xp: 100,
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
    // Nothing worn yet (the harness account wears a title).
    w.__accountPatch = { title: null, titleColor: null };
  });
}
const card = (page: Page) => page.locator("#lobby-journey-card");
const overlaps = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

for (const size of [
  { width: 1440, height: 900, phone: false },
  { width: 844, height: 390, phone: true },
])
  test(`a new player gets the Getting started guide (${size.width}x${size.height})`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      await newPlayer(page);
      const errors = await openHub(page);
      await expect(card(page)).toHaveAttribute("data-lobby-action", "guide");
      await expect(card(page)).toContainText("Getting started · 0 of 3");
      await expect(card(page)).toContainText("Play your first match");
      // The guide fits where the Journey card was: on screen, clear of PLAY.
      const play = (await page.locator(".lobby-play").boundingBox())!;
      await expect(card(page)).toBeVisible();
      for (const c of await page.locator(".lobby-cards .lobby-card").all()) {
        // A phone hides some cards; the ones shown must fit.
        const r = await c.boundingBox();
        if (!r) continue;
        expect(r.y + r.height).toBeLessThanOrEqual(size.height);
        expect(overlaps(r, play)).toBe(false);
      }
      await snap(page, info, `guide-card-${size.width}x${size.height}`);

      // The sheet: three steps, the first to act on.
      await card(page).click();
      const sheet = page.locator("[data-guide]");
      await expect(sheet).toBeVisible();
      await expect(sheet.locator(".guide-step")).toHaveCount(3);
      await expect(sheet.locator(".guide-step.is-next")).toContainText(
        "Play your first match",
      );
      // Every Go sits at its row's right edge (the phone hides the icons).
      for (const row of await sheet.locator(".guide-step").all()) {
        const r = (await row.boundingBox())!,
          go = await row.locator(".guide-step-act").boundingBox();
        if (go) expect(r.x + r.width - (go.x + go.width)).toBeLessThan(16);
      }
      const body = sheet.locator(".ui-panel-body");
      expect(
        await body.evaluate((el) => el.scrollWidth - el.clientWidth),
      ).toBeLessThanOrEqual(1);
      await snap(page, info, `guide-sheet-${size.width}x${size.height}`);

      // Go on "Defeat Cragmuff" opens its raid page.
      await sheet.locator('[data-guide-go="raid"]').click();
      await expect(page.locator(".rh-room")).toHaveAttribute(
        "data-raid-boss",
        "grumblecrag",
      );
      await page.locator(".rh-room .ui-close").click();

      // Hide: the Journey card is back.
      await card(page).click();
      await page.locator("[data-guide-hide]").click();
      await expect(card(page)).toHaveAttribute("data-lobby-action", "journey");
      await page.locator("[data-guide] .ui-close").click();
      await expect(page.locator("[data-guide]")).toHaveCount(0);

      // It stays hidden after a reload...
      await page.reload();
      await page.waitForFunction(() => !!(window as any).__sock);
      await page.evaluate(() => (window as any).__sock.fire("connect"));
      await expect(card(page)).toHaveAttribute("data-lobby-action", "journey");
      // ...and the Menu brings it back, nothing done yet.
      await page.click("#header-menu > summary");
      await page.click("#guide-open");
      await expect(page.locator("[data-guide]")).toBeVisible();
      await expect(page.locator(".guide-step.is-done")).toHaveCount(0);
      await expect(card(page)).toHaveAttribute("data-lobby-action", "guide");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("an older account keeps its Journey card", async ({ page }) => {
  const errors = await openHub(page);
  await expect(card(page)).toHaveAttribute("data-lobby-action", "journey");
  await expect(card(page)).not.toContainText("Getting started");
  expect(errors).toEqual([]);
});
