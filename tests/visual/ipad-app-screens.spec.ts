import { expect, test, type Page } from "@playwright/test";
import { hubMenu, openHub, openPlaza, snap } from "./helpers";

// The iOS app runs full screen on iPads too (docs/ios-app.md), always
// landscape. iPadOS's web view says it is a Mac with five touch points, as
// Safari does. The four screen sizes: iPad mini and 9.7" (1024 × 768),
// iPad Air (1180 × 820), iPad Pro 11" (1194 × 834), iPad Pro 13" (1366 × 1024).
const IPAD =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const SIZES = [
  [1024, 768],
  [1180, 820],
  [1194, 834],
  [1366, 1024],
] as const;

const box = (page: Page, sel: string) =>
  page.locator(sel).first().boundingBox();
const inside = (
  b: { x: number; y: number; width: number; height: number } | null,
  w: number,
  h: number,
) => !!b && b.x >= 0 && b.y >= 0 && b.x + b.width <= w && b.y + b.height <= h;

for (const [w, h] of SIZES) {
  test(`an iPad at ${w}×${h} shows the Lobby, Shop, Fighters and Plaza whole`, async ({
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      viewport: { width: w, height: h },
      hasTouch: true,
      isMobile: false,
      userAgent: IPAD,
    });
    try {
      const page = await context.newPage();
      await page.addInitScript(() =>
        Object.defineProperty(Navigator.prototype, "maxTouchPoints", {
          get: () => 5,
        }),
      );
      const errors = await openHub(page);
      await expect(page.locator("#rotate-gate")).toBeHidden();
      expect(inside(await box(page, "#lobby-play"), w, h)).toBe(true);
      const overflow = () =>
        page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(await overflow()).toBeLessThanOrEqual(0);
      await snap(page, info, `ipad-${w}-lobby`);

      // The Shop's deal of the day: its tags and its countdown share a row,
      // and the countdown wraps under the tags rather than covering
      // "20% off today" (it did at 1024 px, pinned to the card's corner).
      await hubMenu(page, "shop");
      const deal = page.locator(".fit-deal");
      await expect(deal).toBeVisible();
      const clash = await deal.evaluate((d) => {
        const timer = d
          .querySelector(".fit-deal-timer")!
          .getBoundingClientRect();
        return [...d.querySelectorAll(".fit-row > :not(.fit-deal-timer)")]
          .map((t) => t.getBoundingClientRect())
          .some(
            (r) =>
              r.left < timer.right &&
              timer.left < r.right &&
              r.top < timer.bottom &&
              timer.top < r.bottom,
          );
      });
      expect(clash).toBe(false);
      expect(await overflow()).toBeLessThanOrEqual(0);
      await snap(page, info, `ipad-${w}-shop`);
      await page.keyboard.press("Escape");

      await hubMenu(page, "fighters");
      await expect(page.locator("[data-roster-details]").first()).toBeVisible();
      expect(await overflow()).toBeLessThanOrEqual(0);
      await snap(page, info, `ipad-${w}-fighters`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("the Plaza's buttons sit inside the largest iPad's screen", async ({
  browser,
}, info) => {
  const [w, h] = SIZES[SIZES.length - 1];
  const context = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: true,
    isMobile: false,
    userAgent: IPAD,
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(() =>
      Object.defineProperty(Navigator.prototype, "maxTouchPoints", {
        get: () => 5,
      }),
    );
    const errors = await openPlaza(page);
    for (const sel of ["#pz-jump", ".plaza-layer .pz-actions"])
      expect(inside(await box(page, sel), w, h), sel).toBe(true);
    await snap(page, info, `ipad-${w}-plaza`);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
