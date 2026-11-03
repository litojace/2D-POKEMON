import { expect, test } from "@playwright/test";
import { openHub } from "./helpers";
import { exposeAccount, shopServer } from "./shop-server";

// The fitting room (UI remodel step 2) refreshes in place: a fresh copy of
// your coins and items must not restart the live fighter, reload pictures,
// lose focus or scroll.
for (const size of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
]) {
  test(`Shop refreshes retain preview, images and focus (${size.width}x${size.height})`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: size,
      isMobile: size.width < 1000,
      hasTouch: size.width < 1000,
    });
    try {
      const page = await context.newPage();
      await exposeAccount(page);
      await shopServer(page, { balance: 2340, cost: 500 });
      await page.route(
        /\/apps\/client\/src\/cosmetic-fx-preview\.ts(?:\?|$)/,
        async (route) => {
          const response = await route.fetch();
          await route.fulfill({
            response,
            body: (await response.text()).replace(
              /const lives =[^;]+;/,
              "$&window.__cosmeticLives=lives;",
            ),
          });
        },
      );
      const errors = await openHub(page);
      await page.evaluate(() => {
        (window as any).__choose("tidefin");
        void (window as any).__account.showShop("skins");
      });
      const tile = '.fit-room [data-ui-item="tidefin-bubblegum"]';
      const stage = page.locator(".fit-stage .shop-live-stage");
      await page.click(tile);
      await expect(stage).toHaveClass(/is-ready/);
      await page.evaluate((tile) => {
        const w = window as any;
        w.__stableStage = document.querySelector(".fit-stage .shop-live-stage");
        w.__stableCanvas = w.__stableStage.querySelector("canvas");
        w.__stableArt = document.querySelector(`${tile} img`);
        w.__stableBody = document.querySelector("[data-fit-region=body]");
        document.querySelector<HTMLElement>(tile)!.focus();
      }, tile);
      const same = () =>
        page.evaluate((tile) => {
          const w = window as any;
          return [
            w.__stableStage ===
              document.querySelector(".fit-stage .shop-live-stage"),
            w.__stableCanvas ===
              document.querySelector(".fit-stage .shop-live-stage > canvas"),
            w.__stableArt === document.querySelector(`${tile} img`),
            w.__stableBody === document.querySelector("[data-fit-region=body]"),
          ];
        }, tile);
      await page.evaluate(async () => {
        for (let i = 0; i < 3; i++)
          await (window as any).__account.loadEconomy();
      });
      expect(await same()).toEqual([true, true, true, true]);
      await expect(page.locator(tile)).toBeFocused();
      // A lower balance from the server: the HUD and Buy follow it at once.
      await page.evaluate(async () => {
        (window as any).__shop.balance = 100;
        await (window as any).__account.loadEconomy();
      });
      await expect(page.locator("#account-coins .coin-chip b")).toHaveText(
        "100",
      );
      await expect(
        page.locator('[data-fit-buy="tidefin-bubblegum"]'),
      ).toBeDisabled();
      expect((await same()).slice(0, 3)).toEqual([true, true, true]);
      // Selecting the same skin again must not restart its renderer.
      await page.click(tile);
      expect((await same())[0]).toBe(true);
      await page.evaluate(async () => {
        (window as any).__shop.balance = 2340;
        await (window as any).__account.loadEconomy();
      });
      // Buy without wearing it: Equip is offered, the renderer stays.
      await page.click('[data-fit-buy="tidefin-bubblegum"]');
      await page.locator("[data-ui-confirm] [data-fit-wear]").uncheck();
      await page.click("[data-ui-confirm-ok]");
      await expect(
        page.locator('[data-fit-equip="tidefin-bubblegum"]'),
      ).toBeEnabled();
      expect((await same())[0]).toBe(true);
      await page.click('.fit-room [data-ui-item="tidefin-abyss"]');
      await expect(stage).toHaveClass(/is-ready/);
      await expect(stage).toHaveAttribute("data-preview-item", "tidefin-abyss");
      // Filters: a combination with no match offers a way out.
      await page.click('[data-ui-rarity="mythical"]');
      await page.click('[data-ui-own="owned"]');
      await page.click("[data-fit-reset]");
      await expect(page.locator('[data-ui-rarity="all"]')).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(page.locator('[data-ui-own="all"]')).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await page.click('[data-ui-section="collections"]');
      await expect(
        page.locator("[data-fit-region=body] .fit-grid .fx-live").first(),
      ).toBeVisible();
      expect(
        await page.evaluate(() => (window as any).__cosmeticLives.size),
      ).toBeGreaterThan(0);
      // Closing releases every effect it started.
      await page.locator(".fit-room .ui-close").click();
      await expect(page.locator(".fit-room")).toHaveCount(0);
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              Array.from((window as any).__cosmeticLives.values()).filter(
                (live: any) => !live.el.isConnected,
              ).length,
          ),
        )
        .toBe(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
test("downloaded updates wait until the Shop closes", async ({ page }) => {
  await page.route(/\/stubs\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        /export function registerSW\(\) \{[\s\S]*?\n\}/,
        "export function registerSW(options){window.__pwaOptions=options;return async()=>{window.__pwaApplies=(window.__pwaApplies||0)+1;options.onNeedReload();};}",
      ),
    });
  });
  await page.route(/\/apps\/client\/src\/pwa\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        "reload: () => location.reload()",
        "reload: () => {window.__pwaReloads=(window.__pwaReloads||0)+1;}",
      ),
    });
  });
  const errors = await openHub(page);
  await page.click("#account-coins");
  await expect(page.locator(".fit-room")).toBeVisible();
  await page.evaluate(() => (window as any).__pwaOptions.onNeedRefresh());
  expect(
    await page.evaluate(() => [
      (window as any).__pwaApplies || 0,
      (window as any).__pwaReloads || 0,
    ]),
  ).toEqual([0, 0]);
  await expect(page.locator("#pwa-banner")).toContainText(
    "after closing menus",
  );
  await page.locator(".fit-room .ui-close").click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__pwaReloads || 0))
    .toBe(1);
  expect(errors).toEqual([]);
});
