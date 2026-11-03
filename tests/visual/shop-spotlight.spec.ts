import { expect, test } from "@playwright/test";
import { openHub, snap } from "./helpers";
for (const size of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
]) {
  test(`skin preview light fills the stage from the upper right (${size.width}x${size.height})`, async ({
    browser,
  }, info) => {
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
              'window.__account=accountsUI;window.__choose=(id)=>{selected=id;syncHomePresentation();};window.dispatchEvent(new Event("arena:ready"));',
            ),
          });
        },
      );
      await page.route(
        /\/apps\/client\/src\/shop-preview\.ts(?:\?|$)/,
        async (route) => {
          const response = await route.fetch();
          await route.fulfill({
            response,
            body: (await response.text()).replace(
              "scene = this;",
              "scene = this;window.__spotlightScene=this;",
            ),
          });
        },
      );
      const errors = await openHub(page);
      await page.evaluate(() => {
        (window as any).__choose("auralynx");
        void (window as any).__account.showShop("skins");
      });
      // The fitting room's stage (UI remodel step 2): the rig's own light.
      const stage = page.locator(".fit-stage .shop-live-stage");
      await expect(stage).toHaveClass(/is-ready/);
      const audit = () =>
        stage.evaluate((el) => {
          const canvas =
            el.querySelector<HTMLCanvasElement>(":scope > canvas")!;
          const box = el.getBoundingClientRect();
          const ctx = canvas.getContext("2d")!;
          const alpha = (x: number) =>
            ctx.getImageData(
              Math.round(canvas.width * x),
              Math.round(canvas.height * 0.04),
              1,
              1,
            ).data[3];
          return {
            aspect: canvas.width / canvas.height,
            expected: box.width / box.height,
            right: alpha(0.94),
            left: alpha(0.06),
          };
        });
      await expect
        .poll(async () => {
          const a = await audit();
          return Math.abs(a.aspect - a.expected);
        })
        .toBeLessThan(0.01);
      await expect
        .poll(async () => {
          const a = await audit();
          return a.right - a.left;
        })
        .toBeGreaterThan(10);
      // Advance the real idle through its fully settled float. The software
      // renderer is too slow to wait for several seconds of animation time.
      await page.evaluate(() => {
        const s = (window as any).__spotlightScene;
        for (let i = 0; i < 110; i++) s.update(i * 50, 50);
      });
      await expect
        .poll(async () =>
          Number(await stage.getAttribute("data-animation-time")),
        )
        .toBeGreaterThan(5000);
      await snap(page, info, `shop-spotlight-${size.width}`);
      if (size.width > 1000) {
        await stage.evaluate((el) => {
          (el as HTMLElement).style.setProperty("height", "420px", "important");
        });
        await expect
          .poll(async () => {
            const a = await audit();
            return Math.abs(a.aspect - a.expected);
          })
          .toBeLessThan(0.01);
        await expect
          .poll(async () => {
            const a = await audit();
            return a.right - a.left;
          })
          .toBeGreaterThan(10);
        await snap(page, info, "shop-spotlight-tall");
        // A late resize while asleep still renders one correctly fitted frame.
        await page.emulateMedia({ reducedMotion: "reduce" });
        await stage.evaluate((el) => {
          (el as HTMLElement).style.setProperty("height", "300px", "important");
        });
        await expect
          .poll(async () => {
            const a = await audit();
            return Math.abs(a.aspect - a.expected);
          })
          .toBeLessThan(0.01);
      }
      // The same renderer must still yield to item-only frame previews.
      await page.click("[data-ui-section=collections]");
      await page.click(".fit-room [data-ui-item=candy-frame]");
      await expect(stage).toHaveClass(/is-frame/);
      await expect(stage.locator(":scope > canvas")).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
