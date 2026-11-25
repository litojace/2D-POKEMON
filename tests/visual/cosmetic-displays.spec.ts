import { expect, test } from "@playwright/test";
import { openHub, snap } from "./helpers";

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
      const errors = await openHub(page);
      await page.evaluate(() => {
        (window as any).__choose("tidefin");
        void (window as any).__account.showShop("skins");
      });
      // The fitting room (UI remodel step 2): one stage for every item.
      const stage = page.locator(".fit-stage .shop-live-stage");
      await expect(stage).toHaveClass(/is-ready/);
      await expect(stage.locator("canvas")).toHaveCount(1);
      await snap(page, info, `skin-stage-tidefin-${size.width}`);
      await page.click("[data-ui-section=mythic]");
      await page.click(".fit-room [data-ui-item=tidefin-moontide]");
      await page.click('[data-fit-awaken="2"]');
      await expect(stage).toHaveClass(/is-ready/);
      await snap(page, info, `mythic-depth-tidefin-${size.width}`);
      // A phone's Mythic Hall shows one fighter at a time: pick Cindrake.
      const cindrake = page.locator(".fit-body [data-fit-fighter=cindrake]");
      if (await cindrake.count()) await cindrake.click();
      await page.click(".fit-room [data-ui-item=cindrake-sunforged]");
      await page.click('[data-fit-awaken="2"]');
      await expect(stage).toHaveClass(/is-ready/);
      await snap(page, info, `mythic-depth-cindrake-${size.width}`);
      await page.click("[data-ui-section=collections]");
      await page.click("[data-fit-collection=galaxy]");
      for (const suffix of ["aura", "entrance", "victory", "frame"]) {
        await page.click(`.fit-room [data-ui-item="galaxy-${suffix}"]`);
        if (suffix === "frame") {
          await expect(stage).toHaveClass(/is-item/);
          // Your avatar in the frame, as everyone sees you; not the
          // fighter (#306).
          await expect(
            stage.locator(".portrait-disc img.portrait-avatar"),
          ).toHaveCount(1);
          await expect(
            stage.locator(".portrait-disc svg[data-fighter]"),
          ).toHaveCount(0);
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
      await page.click(".fit-room [data-ui-item=galaxy-aura]");
      await snap(page, info, `item-only-shop-${size.width}`);
      await page.click(".fit-room [data-ui-item=galaxy-colours]");
      await expect(stage).toHaveClass(/is-ready/);
      await expect(stage).not.toHaveClass(/is-item/);
      // The Wardrobe: effect pieces show their own effect, Colors a fighter.
      await page.click('[data-ui-mode="wardrobe"]');
      await expect(
        page.locator('.fit-room[data-fit-mode="wardrobe"]'),
      ).toBeVisible();
      for (const suffix of ["aura", "entrance", "victory", "frame"]) {
        await page.click(`[data-fit-slot="${suffix}"]`);
        const tile = page.locator(
          `.fit-grid [data-ui-item="galaxy-${suffix}"] .ui-tile-art`,
        );
        await expect(tile).toHaveCount(1);
        await expect(tile.locator(".raid-cosmetic-preview")).toHaveCount(1);
        // The item itself is what shows. An effect is drawn round a dim
        // figure of the fighter, between its two canvases (25 Nov 2026: a
        // ring on an empty floor said little); a frame goes round your
        // portrait. No other fighter picture stands in for the item.
        await expect(
          tile.locator("svg, img:not(.fx-subject, .portrait-avatar)"),
        ).toHaveCount(0);
        if (suffix === "frame")
          await expect(
            tile.locator(".portrait-frame .portrait-avatar"),
          ).toHaveCount(1);
        else {
          const figure = tile.locator(".raid-cosmetic-preview > .fx-subject");
          await expect(figure).toHaveCount(1);
          expect(
            await figure.evaluate((el) => {
              const s = getComputedStyle(el);
              const back = el.parentElement!.querySelector(".fx-back")!,
                front = el.parentElement!.querySelector(".fx-front")!;
              return (
                Number(s.opacity) <= 0.6 &&
                !!(
                  back.compareDocumentPosition(el) &
                  Node.DOCUMENT_POSITION_FOLLOWING
                ) &&
                !!(
                  el.compareDocumentPosition(front) &
                  Node.DOCUMENT_POSITION_FOLLOWING
                )
              );
            }),
            `${suffix}: a dim figure between the effect's canvases`,
          ).toBe(true);
        }
      }
      await page.click('[data-fit-slot="skin"]');
      await expect(
        page.locator(
          ".fit-grid [data-ui-item=galaxy-colours] .ui-tile-art img",
        ),
      ).toHaveCount(1);
      await expect(stage).toHaveClass(/is-ready/);
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      await snap(page, info, `item-only-wardrobe-${size.width}`);
      await page.locator(".fit-room .ui-close").click();
      // A boss's Rewards tab (UI remodel step 5): every reward as a card
      // with the game's own picture.
      await page.evaluate(
        () =>
          void (window as any).__account.showRaids("grumblecrag", "rewards"),
      );
      await expect(page.locator(".rh-rewards.is-all")).toBeVisible();
      for (const id of [
        "conqueror",
        "mountain-aura",
        "mountainborn",
        "rockslide-flex",
      ]) {
        const tile = page.locator(
          `[data-raid-reward="${id}"] .raid-cosmetic-preview`,
        );
        await expect(tile).toHaveCount(1);
        await expect(tile.locator("svg, img")).toHaveCount(0);
        if (id !== "conqueror")
          await expect(tile.locator(".fx-live")).toHaveCount(2);
      }
      await page
        .locator("[data-raid-reward=mountain-aura]")
        .scrollIntoViewIfNeeded();
      await snap(page, info, `item-only-rewards-${size.width}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
