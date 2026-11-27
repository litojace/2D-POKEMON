import { expect, test, type Page } from "@playwright/test";
import { box, inside, openHub, skipTour, snap } from "./helpers";

// The Showcase look (apps/client/src/themes/showcase/), on with `?ui=showcase`
// as it is before the owner turns it on: one sweep at the four sizes the
// game is checked at, of what the look itself promises. Each screen's own
// spec can also be run in the look (VISUAL_UI=showcase, helpers.ts).
//   - the look is on the page, in Rubik, and nothing is blurred;
//   - the Lobby's Raid card shows a boss from the roster, inside the screen,
//     clear of PLAY, and no other look shows it or downloads its painting;
//   - words read in full: the cards' lines, the widest fighter name, the
//     roster's names; the chosen tab is a white pill;
//   - nothing the look adds moves for ever.
const withQuery = (page: Page, query: string) =>
  page.addInitScript((q) => {
    if (!location.search) history.replaceState(null, "", `/${q}`);
  }, query);

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

/** Elements that still blur what is behind them. */
const blurred = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => {
        if (!el.getClientRects().length) return false;
        const s = getComputedStyle(el);
        const value =
          s.backdropFilter ||
          (s as unknown as Record<string, string>).webkitBackdropFilter;
        return !!value && value !== "none";
      })
      .map((el) => `${el.tagName.toLowerCase()}#${el.id}.${el.className}`),
  );
/** Text that is cut off inside its own box. */
const cut = (page: Page, selector: string) =>
  page.evaluate(
    (sel) =>
      [...document.querySelectorAll<HTMLElement>(sel)]
        .filter(
          (el) =>
            el.getClientRects().length && el.scrollWidth > el.clientWidth + 1,
        )
        .map((el) => el.textContent),
    selector,
  );

for (const size of SIZES) {
  const name = `${size.width}x${size.height}${size.inset ? "-notch" : ""}`;
  test(`Showcase: the Lobby, a panel and a dialog read in full, unblurred (${name})`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      await skipTour(page);
      await withQuery(page, "?ui=showcase");
      const errors = await openHub(page);
      if (size.inset)
        await page.evaluate((inset) => {
          for (const [key, value] of Object.entries(inset))
            document.documentElement.style.setProperty(
              `--safe-${key}`,
              `${value}px`,
            );
          dispatchEvent(new Event("resize"));
        }, size.inset);
      await expect(page.locator("#lobby-raid-card")).toBeVisible({
        timeout: 20_000,
      });

      // The look is on, its stylesheet is the one in the page, in Rubik.
      expect(
        await page.evaluate(() => document.documentElement.dataset.ui),
      ).toBe("showcase");
      await expect(page.locator("#ui-theme-css")).toHaveCount(1);
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(async () => {
          await document.fonts.load('900 20px "Rubik"');
          return (
            document.fonts.check('900 20px "Rubik"') &&
            getComputedStyle(
              document.querySelector(".lobby-name h2")!,
            ).fontFamily.startsWith("Rubik")
          );
        }),
      ).toBe(true);

      // The Raid card: a boss from the roster, its painting loaded, inside
      // the screen and its safe area, above PLAY's block.
      const safe = {
        x: size.inset?.left ?? 0,
        y: 0,
        width: size.width - (size.inset?.left ?? 0) - (size.inset?.right ?? 0),
        height: size.height - (size.inset?.bottom ?? 0),
      };
      const raid = await box(page, "#lobby-raid-card");
      expect(inside(raid, safe)).toBe(true);
      expect(raid.height).toBeGreaterThanOrEqual(44);
      await expect
        .poll(() =>
          page
            .locator("#lobby-raid-card img")
            .evaluate(
              (i) =>
                (i as HTMLImageElement).complete &&
                (i as HTMLImageElement).naturalWidth > 0,
            ),
        )
        .toBe(true);
      // The harness account has cleared no raid: Cragmuff, the first boss
      // (which one is shown after that: tests/unit/lobby-raid.test.ts).
      await expect(page.locator("#lobby-raid-card b")).toHaveText("Cragmuff");
      const play = await box(page, ".lobby-play");
      const cards = await page
        .locator(".lobby-cards > .lobby-card")
        .evaluateAll((els) =>
          els
            .filter((el) => el.getClientRects().length)
            .map((el) => {
              const r = el.getBoundingClientRect();
              return { id: el.id, top: r.top, bottom: r.bottom };
            }),
        );
      expect(cards.length).toBeGreaterThanOrEqual(2);
      for (const [i, card] of cards.entries()) {
        expect(card.bottom, card.id).toBeLessThanOrEqual(play.y);
        if (i) expect(card.top).toBeGreaterThanOrEqual(cards[i - 1].bottom);
      }
      // Every line on the cards and the mode's name read in full.
      expect(
        await cut(
          page,
          ".lobby-cards .lobby-card :is(.lobby-card-kicker, b), .lobby-mode-text b",
        ),
      ).toEqual([]);
      // The widest fighter name fits its plate at this size.
      expect(
        await page.evaluate(() => {
          const h = document.querySelector<HTMLElement>(".lobby-name h2")!;
          const was = h.textContent;
          h.textContent = "Wombolder";
          const fits = h.scrollWidth <= h.clientWidth + 1;
          h.textContent = was;
          return fits;
        }),
      ).toBe(true);
      // Nothing is blurred, and PLAY neither sweeps nor breathes.
      expect(await blurred(page)).toEqual([]);
      expect(
        await page.evaluate(() =>
          document
            .getAnimations()
            .filter(
              (a) =>
                (a.effect as KeyframeEffect | null)?.target?.closest?.(
                  ".lobby-play, .lobby-cards, .lobby-rail",
                ) && a.effect?.getComputedTiming().iterations === Infinity,
            )
            .map((a) => (a as CSSAnimation).animationName),
        ),
      ).toEqual([]);
      await snap(page, info, `showcase-lobby-${name}`);

      // A panel: the chosen tab is a white pill, the roster's names whole.
      await page.click('.lobby-rail [data-lobby-action="shop"]');
      const tab = page.locator('.ui-panel .ui-tabs > [aria-selected="true"]');
      await expect(tab.first()).toBeVisible();
      expect(
        await tab
          .first()
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      ).toBe("rgb(244, 243, 248)");
      expect(await blurred(page)).toEqual([]);
      await snap(page, info, `showcase-shop-${name}`);
      await page.click('.lobby-rail [data-lobby-action="fighters"]');
      await expect(page.locator(".roster-card-name").first()).toBeVisible();
      expect(await cut(page, ".roster-card-name")).toEqual([]);
      await snap(page, info, `showcase-fighters-${name}`);
      await page.click(".ui-panel:not([data-ui-leaving]) [data-ui-close]");

      // A dialog (Settings): solid, with nothing blurred behind it.
      await page.evaluate(() => document.getElementById("settings")!.click());
      await expect(page.locator("dialog[open]")).toBeVisible();
      expect(await blurred(page)).toEqual([]);
      expect(
        await page.evaluate(
          () =>
            getComputedStyle(
              document.querySelector("dialog[open]")!,
              "::backdrop",
            ).backdropFilter,
        ),
      ).toBe("none");
      await snap(page, info, `showcase-settings-${name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("Showcase's Raid card is the look's alone: hidden otherwise, its painting never fetched", async ({
  page,
}, info) => {
  await skipTour(page);
  const paintings: string[] = [];
  // The pictures themselves (the dev server also serves each one's module,
  // "...-lobby.webp?import", which is a script, not the painting).
  page.on("request", (r) => {
    if (
      r.resourceType() === "image" &&
      /raid-splash\/[a-z-]+-lobby\.webp/.test(r.url())
    )
      paintings.push(r.url());
  });
  const errors = await openHub(page);
  await expect(page.locator(".lobby-play-button")).toBeVisible({
    timeout: 20_000,
  });
  if (!process.env.VISUAL_UI) {
    expect(
      await page.evaluate(() => document.documentElement.dataset.ui ?? null),
    ).toBeNull();
    await expect(page.locator("#lobby-raid-card")).toBeHidden();
    // Time for a lazy picture to have started, had it been going to.
    await page.waitForTimeout(600);
    expect(paintings).toEqual([]);
  }
  await snap(page, info, "showcase-off-lobby");
  expect(errors).toEqual([]);
});
