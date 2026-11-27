import { expect, test, type Page } from "@playwright/test";
import { openHub, skipTour } from "./helpers";

// The game's look (ui-theme.ts). Since 27 Nov 2026 every player gets Poster;
// Showcase, the picker and Settings' Look row are gone from the code (the
// checks for them below guard against their return). The rest of
// the suite runs on the look underneath, which the harness pins
// (harness/look-asked.ts); these tests undo that with `__lookDefault` to see
// what a player sees. Poster itself: poster.spec.ts.
/** The page's address gains a query before the game reads it. */
const withQuery = (page: Page, query: string) =>
  page.addInitScript((q) => {
    if (!location.search) history.replaceState(null, "", `/${q}`);
  }, query);
/** As a player's device: no look pinned by the harness. */
const asPlayer = (page: Page) =>
  page.addInitScript(() => ((window as any).__lookDefault = true));
async function newPlayer(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.__economyPatch = {
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
    w.__accountPatch = { title: null, titleColor: null };
  });
}
const picker = (page: Page) => page.locator("[data-look-picker]");
const look = (page: Page) =>
  page.evaluate(() => document.documentElement.dataset.ui ?? null);

test.describe("phone", () => {
  test.use({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  });

  test("a new player gets Poster from the first frame: nobody is asked, and the tour is still their first dialog", async ({
    page,
  }) => {
    await newPlayer(page);
    await asPlayer(page);
    // The look is on the page before the game draws anything: read it the
    // moment the game's markup first appears.
    await page.addInitScript(() => {
      const seen: (string | null)[] = [];
      (window as any).__lookSeen = seen;
      new MutationObserver(() => {
        if (document.querySelector(".topbar") && !seen.length)
          seen.push(document.documentElement.dataset.ui ?? null);
      }).observe(document, { childList: true, subtree: true });
    });
    const errors = await openHub(page);
    expect(await page.evaluate(() => (window as any).__lookSeen)).toEqual([
      "poster",
    ]);
    expect(await look(page)).toBe("poster");
    await expect(page.locator("#ui-theme-css")).toHaveCount(1);
    await expect(page.locator(".hub-tour")).toBeVisible({ timeout: 30_000 });
    await expect(picker(page)).toHaveCount(0);
    await page.locator("[data-tour=skip]").click();
    await page.waitForTimeout(1500);
    await expect(picker(page)).toHaveCount(0);
    // One look: Settings has nothing to choose.
    await page.evaluate(() => document.getElementById("settings")!.click());
    await expect(page.locator("#dialog .settings-screen")).toBeVisible();
    await expect(page.locator("#dialog .st-look")).toHaveCount(0);
    // Nothing was saved for it: the default is the game's, not the device's.
    expect(await page.evaluate(() => localStorage.getItem("ea-ui"))).toBeNull();
    expect(errors).toEqual([]);
  });

  test("an account that was here before gets Poster too, with no dialog; a saved look that is gone falls to it", async ({
    page,
  }) => {
    await skipTour(page);
    await asPlayer(page);
    await page.addInitScript(() => {
      try {
        localStorage.setItem("ea-ui", "showcase");
      } catch {
        /* No storage. */
      }
    });
    const errors = await openHub(page);
    expect(await look(page)).toBe("poster");
    await page.waitForTimeout(1500);
    await expect(picker(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("the suite's own Lobby keeps the look underneath, and ?ui= still shows either for one page load", async ({
    page,
    browser,
  }) => {
    await skipTour(page);
    const errors = await openHub(page);
    expect(await look(page)).toBeNull();
    await expect(page.locator("#ui-theme-css")).toHaveCount(0);
    expect(errors).toEqual([]);
    for (const [query, want] of [
      ["?ui=classic", null],
      ["?ui=poster", "poster"],
    ] as const) {
      const context = await browser.newContext({
        viewport: { width: 844, height: 390 },
        isMobile: true,
        hasTouch: true,
      });
      try {
        const other = await context.newPage();
        await skipTour(other);
        // ?ui=classic over a player's default; ?ui=poster over the pin.
        if (want === null) await asPlayer(other);
        await withQuery(other, query);
        const more = await openHub(other);
        expect(await look(other), query).toBe(want);
        expect(more).toEqual([]);
      } finally {
        await context.close();
      }
    }
  });

  test("--el follows the Lobby fighter's element colour, and coins stay gold", async ({
    page,
  }) => {
    await skipTour(page);
    const errors = await openHub(page);
    const colours = () =>
      page.evaluate(() => ({
        el: document.documentElement.style.getPropertyValue("--el"),
        fighter: document
          .getElementById("lobby-fighter")!
          .style.getPropertyValue("--element"),
      }));
    const first = await colours();
    expect(first.el).toMatch(/^#[0-9a-f]{6}$/i);
    expect(first.el).toBe(first.fighter);
    await page.evaluate(() =>
      document
        .querySelector<HTMLElement>('.lobby-step[data-lobby-step="1"]')!
        .click(),
    );
    await expect.poll(async () => (await colours()).el).not.toBe(first.el);
    const next = await colours();
    expect(next.el).toBe(next.fighter);
    // A look may re-point the accent; the coin in the top bar doesn't follow.
    const coin = () =>
      page.evaluate(() => {
        const icon = document.querySelector(".coin-chip .button-icon");
        return icon ? getComputedStyle(icon).color : null;
      });
    const gold = await coin();
    expect(gold).toBe("rgb(255, 214, 91)");
    await page.evaluate(() =>
      document.documentElement.style.setProperty("--ui-accent", "#3aa0ff"),
    );
    expect(await coin()).toBe(gold);
    expect(errors).toEqual([]);
  });
});
