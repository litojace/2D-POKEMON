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
 // Today's deal is an effect here (the shared fake's is a skin), so the
 // deal card shows the tile the owner asked about (25 Nov 2026).
 body.picks.items.push('borealis-victory');
 body.picks.deal='borealis-victory';
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
      // The Shop's tiles that sell an effect show the effect alone, no
      // fighter inside (the owner, 25 Nov 2026); the stage above tries it
      // on yours. A frame's tile keeps your portrait.
      for (const suffix of ["aura", "entrance", "victory"]) {
        const art = page.locator(
          `.fit-room [data-ui-item="galaxy-${suffix}"] .raid-cosmetic-preview`,
        );
        await expect(art).toHaveCount(1);
        await expect(art.locator("img, svg")).toHaveCount(0);
      }
      await expect(
        page.locator(
          '.fit-room [data-ui-item="galaxy-frame"] .portrait-avatar',
        ),
      ).toHaveCount(1);
      // Today's deal card, when the deal is an effect: the effect alone.
      await page.click("[data-ui-section=today]");
      const deal = page.locator(
        '.fit-room .fit-deal[data-ui-item="borealis-victory"] .fit-deal-art',
      );
      await expect(deal.locator(".raid-cosmetic-preview")).toHaveCount(1);
      await expect(deal.locator("img, svg")).toHaveCount(0);
      await expect(
        deal.locator(".raid-cosmetic-preview > canvas.fx-back"),
      ).toHaveCount(1);
      await expect(
        deal.locator(".raid-cosmetic-preview > canvas.fx-front"),
      ).toHaveCount(1);
      await snap(page, info, `deal-effect-${size.width}`);
      await page.click("[data-ui-section=collections]");
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
        // The item itself is what shows: an effect alone, filling its
        // tile (the owner, 25 Nov 2026: no fighter inside the tiles that
        // sell effects; the stage tries it on yours); a frame goes round
        // your portrait. No fighter picture stands in for the item.
        await expect(
          tile.locator("svg, img:not(.portrait-avatar)"),
        ).toHaveCount(0);
        if (suffix === "frame")
          await expect(
            tile.locator(".portrait-frame .portrait-avatar"),
          ).toHaveCount(1);
        else {
          await expect(
            tile.locator(".raid-cosmetic-preview > :not(canvas)"),
          ).toHaveCount(0);
          await expect(
            tile.locator(".raid-cosmetic-preview > canvas.fx-back"),
          ).toHaveCount(1);
          await expect(
            tile.locator(".raid-cosmetic-preview > canvas.fx-front"),
          ).toHaveCount(1);
        }
        if (suffix === "aura")
          await snap(page, info, `item-only-wardrobe-aura-${size.width}`);
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
