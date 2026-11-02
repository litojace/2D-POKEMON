import { expect, test, type Page } from "@playwright/test";
import { openTown, snap } from "./helpers";

async function closePanel(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const d = document.querySelector<HTMLDialogElement>("#dialog")!;
        d.addEventListener("close", () => resolve(), { once: true });
        document.querySelector<HTMLButtonElement>("#close-dialog")!.click();
      }),
  );
}

for (const size of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
]) {
  test(`cosmetic items and skin stages show the actual item at ${size.width}x${size.height}`, async ({
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
              'window.__account=accountsUI;window.__choose=(c)=>{selected=c;syncHomePresentation();};window.dispatchEvent(new Event("arena:ready"));',
            ),
          });
        },
      );
      await page.route(/\/fake-api\.ts(?:\?|$)/, async (route) => {
        const response = await route.fetch();
        await route.fulfill({
          response,
          body: `${await response.text()}
const oldCosmeticFetch=window.fetch.bind(window);
window.fetch=async(input,init)=>{
 const path=new URL(String(input),location.href).pathname;
 if(path==='/api/raids')return Response.json({v:1,stats:{},unlocked:[],cosmetics:['conqueror','mountain-aura','mountainborn','rockslide-flex'],earned:[],loadout:{}});
 const response=await oldCosmeticFetch(input,init);
 if(path!=='/api/economy')return response;
 const body=await response.json();
 body.owned.push('galaxy-aura','galaxy-entrance','galaxy-victory','galaxy-frame','galaxy-colours','tidefin-moontide','cindrake-sunforged');
 body.mythicTesting=true;
 return Response.json(body);
};`,
        });
      });
      const errors = await openTown(page);
      await page.evaluate(() => {
        (window as any).__choose("tidefin");
        void (window as any).__account.showShop("champions");
      });
      const stage = page.locator(".shop-live-stage");
      await expect(stage).toHaveClass(/is-ready/);
      await expect(stage.locator("canvas")).toHaveCount(1);
      await snap(page, info, `skin-stage-tidefin-${size.width}`);
      await page.click("[data-shop-tab=mythic]");
      await page.click("[data-shop-preview=tidefin-moontide]");
      await page.click('[data-shop-stage="2"]');
      await expect(stage).toHaveClass(/is-ready/);
      await snap(page, info, `mythic-depth-tidefin-${size.width}`);
      await page.click("[data-shop-preview=cindrake-sunforged]");
      await page.click('[data-shop-stage="2"]');
      await expect(stage).toHaveClass(/is-ready/);
      await snap(page, info, `mythic-depth-cindrake-${size.width}`);
      await page.click("[data-shop-tab=collections]");
      await page.click("[data-shop-collection=galaxy]");
      for (const suffix of ["aura", "entrance", "victory", "frame"]) {
        await page.click(`[data-shop-preview="galaxy-${suffix}"]`);
        if (suffix === "frame") {
          await expect(stage).toHaveClass(/is-item/);
          await expect(stage.locator(".portrait-disc svg")).toHaveCount(1);
          await expect(stage.locator(":scope > canvas")).toHaveCount(0);
        } else {
          await expect(stage).not.toHaveClass(/is-item/);
          await expect(stage).toHaveClass(/is-ready/);
          await expect(stage.locator(":scope > canvas")).toHaveCount(1);
          await expect(stage).toHaveAttribute(
            "data-preview-action",
            suffix === "aura" ? "idle" : suffix,
          );
        }
      }
      await page.click("[data-shop-preview=galaxy-aura]");
      await snap(page, info, `item-only-shop-${size.width}`);
      await page.click("[data-shop-preview=galaxy-colours]");
      await expect(stage).toHaveClass(/is-ready/);
      await expect(stage).not.toHaveClass(/is-item/);
      await closePanel(page);
      await page.evaluate(() => void (window as any).__account.showWardrobe());
      await expect(page.locator(".wardrobe")).toBeVisible();
      for (const suffix of ["aura", "entrance", "victory", "frame"]) {
        const tile = page.locator(
          `[data-wardrobe-preview="galaxy-${suffix}"] .wardrobe-item-art`,
        );
        await expect(tile).toHaveCount(1);
        await expect(tile.locator("svg, img")).toHaveCount(0);
      }
      await expect(
        page.locator(
          "[data-wardrobe-preview=galaxy-colours] .wardrobe-item-art img",
        ),
      ).toHaveCount(1);
      await expect(page.locator(".wardrobe .shop-live-stage")).toHaveClass(
        /is-ready/,
      );
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      await snap(page, info, `item-only-wardrobe-${size.width}`);
      await closePanel(page);
      await page.evaluate(
        () =>
          void (window as any).__account.showRaidHub("grumblecrag", "rewards"),
      );
      await expect(page.locator(".raid-equip")).toBeVisible();
      for (const id of [
        "conqueror",
        "mountain-aura",
        "mountainborn",
        "rockslide-flex",
      ]) {
        const tile = page.locator(
          `[data-raid-item="${id}"] .raid-cosmetic-preview`,
        );
        await expect(tile).toHaveCount(1);
        await expect(tile.locator("svg, img")).toHaveCount(0);
        if (id !== "conqueror")
          await expect(tile.locator(".fx-live")).toHaveCount(2);
      }
      await page
        .locator("[data-raid-item=mountain-aura]")
        .scrollIntoViewIfNeeded();
      await snap(page, info, `item-only-rewards-${size.width}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
