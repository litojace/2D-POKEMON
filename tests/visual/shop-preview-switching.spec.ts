import { expect, test } from "@playwright/test";
import { openHub, snap } from "./helpers";

for (const size of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
]) {
  test(`Shop keeps the live portrait visible during skin and champion decoding at ${size.width}x${size.height}`, async ({
    browser,
  }, info) => {
    test.setTimeout(120000);
    const context = await browser.newContext({
      viewport: size,
      isMobile: size.width < 1000,
      hasTouch: size.width < 1000,
    });
    try {
      const page = await context.newPage();
      await page.route(
        /\/apps\/client\/src\/main\.ts(?:\?|$)/,
        async (route) => {
          const response = await route.fetch();
          await route.fulfill({
            response,
            body: (await response.text()).replace(
              'window.dispatchEvent(new Event("arena:ready"));',
              'window.__account=accountsUI;window.__chooseShop=(id)=>{selected=id;syncHomePresentation();};window.dispatchEvent(new Event("arena:ready"));',
            ),
          });
        },
      );
      await page.route(
        /\/apps\/client\/src\/shop-preview\.ts(?:\?|$)/,
        async (route) => {
          const response = await route.fetch(),
            body = await response.text();
          const marker = "const complete = () => {";
          expect(body).toContain(marker);
          // Model slow image decoding deterministically, after actual SVG assets load.
          await route.fulfill({
            response,
            body: body.replace(
              marker,
              marker +
                "if(placement === 'shop' && window.__holdPreviewSwap){window.__releasePreviewSwap=()=>{window.__holdPreviewSwap=false;complete();};return;}",
            ),
          });
        },
      );
      const errors = await openHub(page);
      await page.evaluate(() => {
        const w = window as any;
        w.__chooseShop("tidefin");
        void w.__account.showShop("champions");
      });
      await page.click('[data-shop-preview="tidefin-bubblegum"]');
      const stage = page.locator(".shop-live-stage");
      await expect(stage).toHaveClass(/is-ready/);
      await expect(stage).not.toHaveAttribute("aria-busy", "true");
      await page.evaluate(() => {
        const w = window as any;
        w.__initialPreviewCanvas = document.querySelector(
          ".shop-live-stage canvas",
        );
      });
      for (const target of [
        '[data-shop-preview="tidefin-abyss"]',
        '[data-shop-champion="auralynx"]',
      ]) {
        await page.evaluate(() => {
          const w = window as any;
          w.__releasePreviewSwap = undefined;
          w.__holdPreviewSwap = true;
        });
        await page.click(target);
        await page.waitForFunction(
          () => !!(window as any).__releasePreviewSwap,
        );
        await expect(stage).toHaveClass(/is-ready/);
        await expect(stage).toHaveAttribute("aria-busy", "true");
        await expect(stage.locator("canvas")).toBeVisible();
        await expect(stage.locator(".shop-preview-fallback")).toBeHidden();
        const comparison = page.locator("[data-preview-compare]");
        if (await comparison.count()) await expect(comparison).toBeDisabled();
        expect(
          await page.evaluate(() => {
            const canvas = document.querySelector<HTMLCanvasElement>(
              ".shop-live-stage canvas",
            )!;
            const pixels = canvas
              .getContext("2d")!
              .getImageData(0, 0, canvas.width, canvas.height).data;
            return {
              same: canvas === (window as any).__initialPreviewCanvas,
              painted: pixels.some((v, i) => i % 4 === 3 && v > 0),
            };
          }),
        ).toEqual({ same: true, painted: true });
        await snap(
          page,
          info,
          `shop-held-preview-${target.includes("abyss") ? "skin" : "champion"}-${size.width}x${size.height}`,
        );
        await page.evaluate(() => (window as any).__releasePreviewSwap());
        await expect(stage).not.toHaveAttribute("aria-busy", "true");
        if (await comparison.count()) await expect(comparison).toBeEnabled();
      }
      await expect(stage).toHaveAttribute("data-preview-champion", "auralynx");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
