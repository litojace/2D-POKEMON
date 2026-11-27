import { expect, test } from "@playwright/test";
import { openHub, settle, snap } from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";
import { exposeAccount, shopServer } from "./shop-server";
import { onPlayersLook } from "./players-look";

// In the look players have (players-look.ts).
onPlayersLook();
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

// A Legendary stands in a gold halo, the same light as a Legendary tile's
// backdrop: it replaced a fan of rays that looked busy (owner, 26 Nov). The
// halo sits behind the head, centred and above the feet, whole inside the
// stage, and lights it: the stage looks different with the halo hidden.
for (const size of [
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
])
  test(`a Legendary stands in a gold halo (${size.width}x${size.height})`, async ({
    browser,
  }, info) => {
    const phone = size.width < 1000;
    const context = await browser.newContext({
      viewport: size,
      isMobile: phone,
      hasTouch: phone,
    });
    try {
      const page = await context.newPage();
      await exposeAccount(page);
      await shopServer(page, { balance: 2340, cost: 500 });
      const errors = await openHub(page);
      await page.evaluate(() => {
        (window as any).__choose("pyranda");
        void (window as any).__account.showShop("skins");
      });
      await page.click('.fit-room [data-ui-item="pyranda-nova-vanguard"]');
      const stage = page.locator(".fit-stage");
      await expect(stage).toHaveAttribute("data-rarity", "legendary");
      await expect(stage.locator(".shop-live-stage")).toHaveClass(/is-ready/);
      await expect(stage.locator(".stage-light-rays")).toHaveCount(0);
      const halo = stage.locator(".stage-light-halo circle");
      await expect(halo).toBeVisible();
      const b = (await stage.boundingBox())!;
      const h = (await halo.boundingBox())!;
      const ring = (await stage.locator(".stage-light-ring").boundingBox())!;
      // Centred on the fighter, above the feet, whole inside the stage.
      expect(
        Math.abs(h.x + h.width / 2 - (ring.x + ring.width / 2)),
      ).toBeLessThan(2);
      expect(h.y + h.height / 2).toBeLessThan(ring.y);
      expect(h.y).toBeGreaterThanOrEqual(b.y);
      expect(h.x).toBeGreaterThanOrEqual(b.x);
      expect(h.x + h.width).toBeLessThanOrEqual(b.x + b.width);
      const shot = () => page.screenshot({ clip: h, animations: "disabled" });
      const lit = await shot();
      await snap(page, info, `legendary-halo-${size.width}`);
      await page.addStyleTag({
        content: ".stage-light-halo{visibility:hidden!important}",
      });
      const dark = await shot();
      expect(lit.equals(dark), "the halo lights the stage").toBe(false);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

// An entrance or a victory reaches the stage's top edge on a phone, and all
// of it fits (owner, 26 Nov: Trophy victory stopped in a straight line 34 px
// below the top, where the canvas began, and its trophy rose out of view).
// The canvas now covers the stage from its top; the camera keeps the
// fighter below the Entrance and Victory buttons' band
// (shop-preview-layout.ts shopPreviewCamera, tested in
// tests/unit/shop-preview-layout.test.ts).
for (const size of [
  { width: 844, height: 390, island: false },
  { width: 852, height: 393, island: true },
])
  test(`a victory draws from the stage's top edge on a phone (${size.width}x${size.height})`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      await exposeAccount(page);
      await shopServer(page, { balance: 5526, cost: 500 });
      const errors = await openHub(page);
      if (size.island) await setInsets(page, ISLAND);
      await page.evaluate(() => {
        (window as any).__choose("auralynx");
        void (window as any).__account.showShop("collections");
      });
      await page.click('[data-fit-collection="singles"]');
      await page.click('.fit-room [data-ui-item="trophy-victory"]');
      const host = page.locator(".fit-stage .shop-live-stage");
      await expect(host).toHaveAttribute("data-preview-action", "victory");
      await expect(host).toHaveClass(/is-ready/, { timeout: 60_000 });
      await settle(page);
      const at = await page.evaluate(() => {
        const stage = document
          .querySelector(".fit-stage")!
          .getBoundingClientRect();
        const canvas = document
          .querySelector(".fit-stage .shop-live-stage > canvas")!
          .getBoundingClientRect();
        const disc = document
          .querySelector(".fit-stage .stage-light-disc")!
          .getBoundingClientRect();
        return {
          gap: canvas.top - stage.top,
          // The light's disc still sits in the stage's lower half.
          discLow: disc.top + disc.height / 2 > stage.top + stage.height / 2,
        };
      });
      expect(at.gap).toBeLessThanOrEqual(1.5);
      expect(at.discLow).toBe(true);
      await page.waitForTimeout(900);
      await snap(page, info, `shop-victory-top-${size.width}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
