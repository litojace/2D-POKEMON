import { expect, test, type Page } from "@playwright/test";
import { openLobby, settle, snap } from "./helpers";
import { shopServer } from "./shop-server";

// Poster on a desktop (audit A22, A23, C36, 27 Nov 2026):
// - the Shop's Skins filters: the rarity chips were squeezed beside
//   ownership and the order to "All rarities · Common · Rar…", with the
//   count over the cut edge;
// - the masthead's quiet words (a raid boss's line, the Fighters' "Sort")
//   were the old look's pale grey on the element colour;
// - the Fighters' order was the old look's rounded grey field.
const SIZES = [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
];

async function open(page: Page) {
  await page.addInitScript(() => {
    if (!location.search) history.replaceState(null, "", "/?ui=poster");
  });
  await shopServer(page);
  return openLobby(page);
}

/** WCAG contrast of an element's text on the masthead behind it. */
const contrastOnHead = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const rgba = (s: string) => s.match(/[\d.]+/g)!.map(Number);
      const head = el.closest(".ui-panel-head") as HTMLElement;
      const [br, bg, bb] = rgba(getComputedStyle(head).backgroundColor);
      const [r, g, b, a = 1] = rgba(getComputedStyle(el).color);
      const mix = [
        r * a + br * (1 - a),
        g * a + bg * (1 - a),
        b * a + bb * (1 - a),
      ];
      const lum = (c: number[]) => {
        const [x, y, z] = c.map((v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * x + 0.7152 * y + 0.0722 * z;
      };
      const l1 = lum(mix),
        l2 = lum([br, bg, bb]);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    });

for (const size of SIZES)
  test(`Poster on a desktop: the Skins filters read whole, the masthead's quiet words read (${size.width}x${size.height})`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({ viewport: size });
    try {
      const page = await context.newPage();
      const errors = await open(page);

      // The Shop's Skins: the rarity chips on a row of their own, every
      // chip whole, the count clear of them.
      await page.click('.lobby-rail [data-lobby-action="shop"]');
      await page.click('[data-ui-section="skins"]');
      await expect(page.locator(".fit-filters .ui-chips")).toBeVisible();
      await settle(page);
      const filters = await page.evaluate(() => {
        const chips = document.querySelector<HTMLElement>(
          ".fit-filters .ui-chips",
        )!;
        const count = document
          .querySelector(".fit-filters .fit-count")!
          .getBoundingClientRect();
        const row = chips.getBoundingClientRect();
        const others = [
          ...document.querySelectorAll(".fit-filters > .ui-seg"),
        ].map((e) => e.getBoundingClientRect());
        return {
          hidden: chips.scrollWidth - chips.clientWidth,
          ownRow: others.every((o) => o.bottom <= row.top + 1),
          countClear: count.bottom <= row.top + 1 || count.right <= row.left,
        };
      });
      expect(
        filters.hidden,
        "rarity chips hidden past the edge",
      ).toBeLessThanOrEqual(1);
      expect(filters.ownRow, "the chips on their own row").toBe(true);
      expect(filters.countClear, "the count clear of the chips").toBe(true);
      await snap(page, info, `poster-skins-filters-${size.width}`);
      await page.keyboard.press("Escape");

      // The Fighters: "Sort" reads on the masthead; the order is a square
      // ink box.
      await page.click('.lobby-rail [data-lobby-action="fighters"]');
      await expect(page.locator(".roster-sort select")).toBeVisible();
      await settle(page);
      expect(
        await contrastOnHead(page, ".roster-sort > span"),
        '"Sort" on the masthead',
      ).toBeGreaterThanOrEqual(4.5);
      const select = await page
        .locator(".roster-sort select")
        .evaluate((el) => ({
          radius: getComputedStyle(el).borderTopLeftRadius,
          bg: getComputedStyle(el).backgroundColor,
        }));
      // A square block of the masthead's lighter ink (tokens.css,
      // --head-box), as the close button beside it.
      expect(select).toEqual({ radius: "0px", bg: "rgb(42, 42, 48)" });
      await snap(page, info, `poster-fighters-head-${size.width}`);
      await page.keyboard.press("Escape");

      // A raid boss: its line reads whole under the tabs (it was cut with
      // "…" on the masthead: tests/visual/raid-room-lede.spec.ts).
      await page.click('.lobby-rail [data-lobby-action="raids"]');
      await page.click('[data-raid-card="grumblecrag"]');
      await expect(page.locator(".rh-body .rh-lede")).toBeVisible();
      await expect(page.locator(".rh-head .rh-hint")).toHaveCount(0);
      await settle(page);
      await snap(page, info, `poster-boss-head-${size.width}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
