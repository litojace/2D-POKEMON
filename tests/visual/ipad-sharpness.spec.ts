import { expect, test } from "@playwright/test";
import { openLobby, openPlayPanel, pushUntilBattle } from "./helpers";
import { fakeBistro } from "./bistro-fake";

// A large iPad (long side 1180 pt or more, 4 GB or more) draws the hub's
// scenes and battles at its screen's 2x, as a desktop does; iPhones and
// smaller iPads keep the smaller budgets (render-budget.ts). On an iPad Pro
// 13" the Bistro was drawn at about 1.2x and looked soft (owner, 11 Nov 2026).
const IPAD =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const DEVICES = [
  { name: "iPad Pro 13", width: 1376, height: 1032, scene: 2, battle: 2 },
  // An iPad 9 (1080x810, 3 GB): within the 2-million-pixel budget, 1.5x in battle.
  {
    name: "iPad 9",
    width: 1080,
    height: 810,
    scene: Math.sqrt(2_000_000 / (1080 * 810)),
    battle: 1.5,
  },
];
for (const d of DEVICES)
  test(`${d.name} draws its scenes at ${d.scene.toFixed(2)}x and battles at ${d.battle}x`, async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({
      viewport: { width: d.width, height: d.height },
      screen: { width: d.width, height: d.height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent: IPAD,
    });
    try {
      const page = await context.newPage();
      // iPadOS reports five touch points (Chromium's touch emulation, one).
      await page.addInitScript(() =>
        Object.defineProperty(Navigator.prototype, "maxTouchPoints", {
          get: () => 5,
        }),
      );
      const errors = await openLobby(page);
      const density = (sel: string) =>
        page.evaluate((sel) => {
          const c = document.querySelector(sel) as HTMLCanvasElement;
          return c.width / c.getBoundingClientRect().width;
        }, sel);
      await fakeBistro(page);
      await page.click('#hub-scenes [data-hub-scene="bistro"]');
      await page.waitForFunction(() => (window as any).__bistro?.sync().ready);
      await expect
        .poll(() => density(".bistro-layer .bs-cv"))
        .toBeCloseTo(d.scene, 1);
      await page.click('#hub-scenes [data-hub-scene="plaza"]');
      await expect(page.locator(".plaza-layer #pz-cv")).toBeVisible();
      await expect
        .poll(() => density(".plaza-layer #pz-cv"))
        .toBeCloseTo(d.scene, 1);
      await page.click('#hub-scenes [data-hub-scene="lobby"]');
      await page.evaluate(() => (window as any).__room("practice"));
      await openPlayPanel(page);
      await page.click("#practice");
      await pushUntilBattle(page);
      await expect.poll(() => density("#game canvas")).toBeCloseTo(d.battle, 1);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
