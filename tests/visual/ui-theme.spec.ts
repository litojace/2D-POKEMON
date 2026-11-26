import { expect, test, type Page } from "@playwright/test";
import { box, inside, openHub, skipTour, snap } from "./helpers";

// Choosing the game's look (ui-theme.ts, ui-theme-picker.ts): the dialog a
// player meets once on the Lobby, before the Lobby tour, and Settings →
// Display → Look. Both stay dark until two looks are ready; `?ui-preview=1`
// offers the looks in hand, which is how these tests see them.
const ACCOUNT = "11111111-1111-4111-8111-111111111111";
/** The page's address gains a query before the game reads it. */
const withQuery = (page: Page, query: string) =>
  page.addInitScript((q) => {
    if (!location.search) history.replaceState(null, "", `/${q}`);
  }, query);
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
  test(`a new player picks a look in one tap, before the tour, and changes it in Settings (${name})`, async ({
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
      await withQuery(page, "?ui-preview=1");
      const errors = await openHub(page);
      if (size.inset)
        await page.evaluate((inset) => {
          for (const [key, value] of Object.entries(inset))
            document.documentElement.style.setProperty(
              `--safe-${key}`,
              `${value}px`,
            );
        }, size.inset);
      // The picker comes first: the tour waits behind it.
      await expect(picker(page)).toBeVisible();
      await expect(page.locator(".hub-tour")).toHaveCount(0);
      expect(await look(page)).toBeNull();
      const cards = picker(page).locator(".look-card");
      await expect(cards).toHaveCount(2);
      // Both pictures are in before anyone is asked to compare them.
      await expect
        .poll(() =>
          cards
            .locator("img")
            .evaluateAll((imgs) =>
              imgs.every(
                (i) =>
                  (i as HTMLImageElement).complete &&
                  (i as HTMLImageElement).naturalWidth > 0,
              ),
            ),
        )
        .toBe(true);
      await snap(page, info, `look-picker-${name}`);
      // The dialog and both cards sit inside the screen and its safe area.
      const safe = {
        x: size.inset?.left ?? 0,
        y: 0,
        width: size.width - (size.inset?.left ?? 0) - (size.inset?.right ?? 0),
        height: size.height - (size.inset?.bottom ?? 0),
      };
      expect(inside(await box(page, ".look-modal"), safe)).toBe(true);
      const boxes = await cards.evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          const text = el.querySelector(".look-card-text")!;
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            // Name and line read in full: nothing cut off or spilling.
            spills:
              text.scrollWidth > text.clientWidth + 1 ||
              [...text.children].some((c) => c.scrollWidth > c.clientWidth + 1),
          };
        }),
      );
      for (const b of boxes) {
        expect(inside(b, await box(page, ".look-modal"))).toBe(true);
        expect(b.height).toBeGreaterThanOrEqual(44);
        expect(b.spills).toBe(false);
      }
      // Two cards the same size, side by side, with even margins.
      expect(Math.abs(boxes[0].width - boxes[1].width)).toBeLessThan(1);
      expect(Math.abs(boxes[0].height - boxes[1].height)).toBeLessThan(1);
      expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThan(1);
      const modal = await box(page, ".look-modal");
      const left = boxes[0].x - modal.x,
        right = modal.x + modal.width - (boxes[1].x + boxes[1].width);
      expect(Math.abs(left - right)).toBeLessThan(1.5);
      // Escape is not a way round the question.
      await page.keyboard.press("Escape");
      await expect(picker(page)).toBeVisible();

      // One tap: the look is on the page, kept, and the tour follows.
      await cards
        .nth(0)
        .tap?.()
        .catch(() => cards.nth(0).click());
      await expect(picker(page)).toHaveCount(0);
      await expect.poll(() => look(page)).toBe("poster");
      await expect(page.locator("#ui-theme-css")).toHaveCount(1);
      expect(
        await page.evaluate(
          (a) => [
            localStorage.getItem("ea-ui"),
            localStorage.getItem(`ea-ui-asked:${a}`),
          ],
          ACCOUNT,
        ),
      ).toEqual(["poster", "1"]);
      await expect(page.locator(".hub-tour")).toBeVisible({ timeout: 10_000 });
      await page.locator("[data-tour=skip]").click();
      await expect(page.locator(".hub-tour")).toHaveCount(0);
      await expect(picker(page)).toHaveCount(0);

      // Settings → Display → Look switches live.
      await page.evaluate(() => document.getElementById("settings")!.click());
      const dialog = page.locator("#dialog");
      const row = dialog.locator(".st-look");
      await expect(row).toBeVisible();
      await expect(row.locator('[data-look-set="poster"]')).toHaveAttribute(
        "aria-checked",
        "true",
      );
      await snap(page, info, `look-settings-${name}`);
      const screen = { x: 0, y: 0, width: size.width, height: size.height };
      expect(inside(await box(page, "#dialog"), screen)).toBe(true);
      expect(
        inside(await box(page, ".st-look"), await box(page, "#dialog")),
      ).toBe(true);
      // Settings still shows everything at once on a phone held sideways.
      const scroll = await dialog
        .locator(".dialog-content")
        .evaluate((el) => el.scrollHeight - el.clientHeight);
      expect(scroll).toBeLessThanOrEqual(1);
      // The Look and Graphics choices end on one edge, at one height, and
      // Look's two names share its width evenly.
      const choices = await dialog
        .locator(".st-graphics .prefs-choice")
        .evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect();
            return { right: r.right, width: r.width, height: r.height };
          }),
        );
      expect(choices).toHaveLength(2);
      expect(Math.abs(choices[0].right - choices[1].right)).toBeLessThan(1);
      const names = await row
        .locator("[data-look-set]")
        .evaluateAll((els) =>
          els.map((el) => el.getBoundingClientRect().width),
        );
      expect(Math.abs(names[0] - names[1])).toBeLessThan(1);
      expect(Math.abs(choices[0].height - choices[1].height)).toBeLessThan(1);
      await row.locator('[data-look-set="showcase"]').click();
      await expect.poll(() => look(page)).toBe("showcase");
      await expect(row.locator('[data-look-set="showcase"]')).toHaveAttribute(
        "aria-checked",
        "true",
      );
      await expect(row.locator('[data-look-set="poster"]')).toHaveAttribute(
        "aria-checked",
        "false",
      );
      // One theme's stylesheet in the page, never both.
      await expect(page.locator("#ui-theme-css")).toHaveCount(1);

      // The next visit: the same look, and no question.
      await page.reload();
      await page.waitForFunction(() => !!(window as any).__sock);
      await expect
        .poll(
          async () => {
            await page.evaluate(() => (window as any).__sock.fire("connect"));
            return page.locator("#lobby-play").isVisible();
          },
          { timeout: 30_000, intervals: [500, 1000] },
        )
        .toBe(true);
      await expect(page.locator("#server-startup")).toHaveCount(0, {
        timeout: 60_000,
      });
      expect(await look(page)).toBe("showcase");
      await page.waitForTimeout(1500);
      await expect(picker(page)).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test.describe("phone", () => {
  test.use({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  });

  test("until two looks are ready nobody is asked, Settings has no Look row and a saved look is ignored", async ({
    page,
  }) => {
    await newPlayer(page);
    await page.addInitScript(() => {
      try {
        localStorage.setItem("ea-ui", "poster");
      } catch {
        /* No storage. */
      }
    });
    const errors = await openHub(page);
    // The tour is a new player's first dialog, as before.
    await expect(page.locator(".hub-tour")).toBeVisible({ timeout: 10_000 });
    await expect(picker(page)).toHaveCount(0);
    expect(await look(page)).toBeNull();
    await expect(page.locator("#ui-theme-css")).toHaveCount(0);
    await page.locator("[data-tour=skip]").click();
    await page.evaluate(() => document.getElementById("settings")!.click());
    await expect(page.locator("#dialog .settings-screen")).toBeVisible();
    await expect(page.locator("#dialog .st-look")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("?ui= shows a look for one page load without asking, and ?ui=classic the look underneath", async ({
    page,
  }) => {
    await skipTour(page);
    await withQuery(page, "?ui=showcase");
    await page.addInitScript(() => {
      try {
        localStorage.setItem("ea-ui", "poster");
      } catch {
        /* No storage. */
      }
    });
    const errors = await openHub(page);
    expect(await look(page)).toBe("showcase");
    await page.waitForTimeout(1500);
    await expect(picker(page)).toHaveCount(0);
    // The address didn't change what is saved.
    expect(await page.evaluate(() => localStorage.getItem("ea-ui"))).toBe(
      "poster",
    );
    expect(errors).toEqual([]);
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
