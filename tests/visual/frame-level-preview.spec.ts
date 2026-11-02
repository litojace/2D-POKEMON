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
  { width: 844, height: 280 },
]) {
  test(`boss frame levels are previews, with earned effects kept consistent (${size.width}x${size.height})`, async ({
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
              'window.__account=accountsUI;window.dispatchEvent(new Event("arena:ready"));',
            ),
          });
        },
      );
      await page.route(/\/fake-api\.ts(?:\?|$)/, async (route) => {
        const response = await route.fetch();
        await route.fulfill({
          response,
          body: `${await response.text()}
window.__clears=16;window.__frame=null;window.__equips=[];
const previousFrameLevelFetch=window.fetch.bind(window);
const frameLevelProgress=()=>({v:1,stats:{},unlocked:[],cosmetics:['conqueror'],earned:['conqueror'],bosses:{grumblecrag:{clears:window.__clears}},loadout:{frame:window.__frame}});
window.fetch=async(input,init)=>{
 const path=new URL(String(input),location.href).pathname;
 if(path==='/api/raids')return Response.json(frameLevelProgress());
 if(path==='/api/raids/equip'){const body=JSON.parse(init.body);window.__equips.push(body);window.__frame=body.item;return Response.json({progress:frameLevelProgress()});}
 const response=await previousFrameLevelFetch(input,init);
 if(path!=='/api/economy')return response;
 const body=await response.json();body.owned.push('galaxy-frame');return Response.json(body);
};`,
        });
      });
      const errors = await openTown(page);
      await page.evaluate(() => void (window as any).__account.showWardrobe());
      await page.click(".wardrobe-filters [data-wardrobe-slot=frame]");
      const art = page.locator(".wardrobe-frame-stage .raid-cosmetic-preview");
      await expect(art).toHaveAttribute("data-frame-stars", "1");
      await expect(page.locator("[data-wardrobe-frame-stars]")).toHaveCount(6);
      await expect(art.locator("svg,img")).toHaveCount(0);
      const baseTile = page.locator(
        "[data-wardrobe-preview=conqueror] .raid-cosmetic-preview",
      );
      await expect(baseTile).toHaveAttribute("data-tier", "epic");
      for (const [stars, tier] of [
        [0, "epic"],
        [1, "epic"],
        [2, "epic"],
        [3, "legendary"],
        [4, "legendary"],
        [5, "mythic"],
      ] as const) {
        await page.click(`[data-wardrobe-frame-stars="${stars}"]`);
        await expect(art).toHaveAttribute("data-tier", tier);
        await expect(art).toHaveAttribute("data-frame-stars", String(stars));
        await expect(
          page.locator(`[data-wardrobe-frame-stars="${stars}"]`),
        ).toBeFocused();
        await expect(page.locator(".wardrobe-frame-summary")).toContainText(
          "Your level: 1★",
        );
        await expect(baseTile).toHaveAttribute("data-frame-stars", "1");
      }
      await expect(page.locator(".wardrobe-frame-summary")).toContainText(
        "Unlock at 50 wins",
      );
      await expect(
        page.locator(".wardrobe-frame-stage .tier-rays"),
      ).toBeVisible();
      expect(await page.evaluate(() => (window as any).__equips)).toEqual([]);
      await page
        .locator(".wardrobe-showcase")
        .evaluate((el) => el.scrollTo({ top: 0 }));
      await snap(page, info, `frame-level-future-${size.width}x${size.height}`);
      // Saving the item never sends a preview star level to the server.
      await page.click("[data-wardrobe-save=conqueror]");
      expect(await page.evaluate(() => (window as any).__equips)).toEqual([
        { slot: "frame", item: "conqueror" },
      ]);
      const header = page.locator(
        "#account-profile [data-portrait-frame=conqueror]",
      );
      await expect(header).toHaveAttribute("data-frame-stars", "1");
      await expect(header).toHaveAttribute("data-tier", "epic");
      await page.click(".wardrobe-filters [data-wardrobe-slot=frame]");
      await expect(art).toHaveAttribute("data-frame-stars", "1");
      await page.click('[data-wardrobe-frame-stars="5"]');
      await page.click("[data-wardrobe-preview=galaxy-frame]");
      await expect(page.locator("[data-wardrobe-frame-stars]")).toHaveCount(0);
      await page.click("[data-wardrobe-preview=conqueror]");
      await expect(art).toHaveAttribute("data-frame-stars", "1");
      // Highest earned level uses the same label and visuals in all pickers.
      await closePanel(page);
      await page.evaluate(() => {
        (window as any).__clears = 50;
        void (window as any).__account.showWardrobe();
      });
      await page.click(".wardrobe-filters [data-wardrobe-slot=frame]");
      await expect(art).toHaveAttribute("data-tier", "mythic");
      const tile = page.locator("[data-wardrobe-preview=conqueror]");
      await expect(tile.locator(".wardrobe-frame-stars")).toHaveText(
        "★★★★★ Mythical",
      );
      await expect(tile.locator(".tier-chip")).toHaveText("Mythical");
      await expect(tile.locator(".raid-cosmetic-preview")).toHaveAttribute(
        "data-tier",
        "mythic",
      );
      await expect(header).toHaveAttribute("data-tier", "mythic");
      await closePanel(page);
      await page.evaluate(
        () =>
          void (window as any).__account.showRaidHub("grumblecrag", "rewards"),
      );
      const raidTile = page.locator("[data-raid-item=conqueror]");
      await expect(raidTile.locator(".tier-chip")).toHaveText("Mythical");
      await expect(raidTile.locator(".raid-cosmetic-preview")).toHaveAttribute(
        "data-frame-stars",
        "5",
      );
      await expect(raidTile.locator(".raid-cosmetic-preview")).toHaveAttribute(
        "data-tier",
        "mythic",
      );
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
