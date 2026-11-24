import { expect, test } from "@playwright/test";
import { openHub, snap } from "./helpers";
for (const size of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
]) {
  test(`skin preview light: a glow and a lit disc under the fighter's feet (${size.width}x${size.height})`, async ({
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
          return {
            aspect: canvas.width / canvas.height,
            expected: box.width / box.height,
          };
        });
      // The light is the stage's own layer behind the canvas (owner's option
      // C, stage-light.ts), not a beam drawn on the canvas: a glow in the
      // element's colour and a lit disc that follows the camera, so it stays
      // under the fighter's feet at any stage size.
      const light = () =>
        stage.evaluate((el) => {
          const svg = el.querySelector(":scope > .stage-light");
          const still = el.querySelector(".shop-preview-fallback > svg");
          const disc = svg
            ?.querySelector(".stage-light-disc")
            ?.getBoundingClientRect();
          const box = el.getBoundingClientRect();
          const cx = disc ? disc.x + disc.width / 2 : -1,
            cy = disc ? disc.y + disc.height / 2 : -1;
          return {
            shown: !!svg && getComputedStyle(svg).display !== "none",
            follows:
              !!svg &&
              svg.getAttribute("viewBox") === still?.getAttribute("viewBox"),
            // Centred across the stage, in its lower half.
            underFeet:
              Math.abs(cx - (box.x + box.width / 2)) < box.width * 0.1 &&
              cy > box.y + box.height / 2 &&
              cy < box.bottom,
          };
        });
      const lit = { shown: true, follows: true, underFeet: true };
      await expect
        .poll(async () => {
          const a = await audit();
          return Math.abs(a.aspect - a.expected);
        })
        .toBeLessThan(0.01);
      await expect.poll(light).toEqual(lit);
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
        await expect.poll(light).toEqual(lit);
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
