import { expect, test, type Page } from "@playwright/test";
import { openHub } from "./helpers";
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
      await page.route(/\/fake-api\.ts(?:\?|$)/, async (route) => {
        const response = await route.fetch();
        await route.fulfill({
          response,
          body: `${await response.text()}
window.__shopBalance=2340;window.__shopOwned=[];
const previousShopFetch=window.fetch.bind(window);
window.fetch=async(input,init)=>{
 const path=new URL(String(input),location.href).pathname;
 if(path==='/api/shop/buy'){const id=JSON.parse(init.body).item;window.__shopOwned.push(id);window.__shopBalance-=500;const e=await previousShopFetch('/api/economy');const body=await e.json();body.owned.push(...window.__shopOwned);body.balance=window.__shopBalance;return Response.json({economy:body});}
 const response=await previousShopFetch(input,init);
 if(path!=='/api/economy')return response;
 const body=await response.json();body.balance=window.__shopBalance;body.owned.push(...window.__shopOwned);
 if(window.__delayShop){window.__delayShop=false;await new Promise(resolve=>window.__finishShop=resolve);}
 return Response.json(body);
};`,
        });
      });
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
        void (window as any).__account.showShop("champions");
      });
      await page.click("[data-shop-preview=tidefin-bubblegum]");
      await expect(page.locator(".shop-live-stage")).toHaveClass(/is-ready/);
      await page.evaluate(() => {
        const w = window as any;
        w.__stableStage = document.querySelector(".shop-live-stage");
        w.__stableCanvas = w.__stableStage.querySelector("canvas");
        w.__stableArt = document.querySelector(
          "[data-shop-preview=tidefin-bubblegum] img",
        );
        w.__stableBody = document.querySelector(".shop-body");
        document
          .querySelector<HTMLElement>("[data-shop-preview=tidefin-bubblegum]")!
          .focus();
      });
      await page.evaluate(async () => {
        for (let i = 0; i < 3; i++)
          await (window as any).__account.loadEconomy();
      });
      expect(
        await page.evaluate(() => {
          const w = window as any;
          return [
            w.__stableStage === document.querySelector(".shop-live-stage"),
            w.__stableCanvas ===
              document.querySelector(".shop-live-stage > canvas"),
            w.__stableArt ===
              document.querySelector(
                "[data-shop-preview=tidefin-bubblegum] img",
              ),
            w.__stableBody === document.querySelector(".shop-body"),
          ];
        }),
      ).toEqual([true, true, true, true]);
      await expect(
        page.locator("[data-shop-preview=tidefin-bubblegum]"),
      ).toBeFocused();
      await page.evaluate(async () => {
        (window as any).__shopBalance = 100;
        await (window as any).__account.loadEconomy();
      });
      await expect(page.locator(".shop-head .coin-chip b")).toHaveText("100");
      await expect(
        page.locator(".shop-preview [data-shop-buy=tidefin-bubblegum]"),
      ).toBeDisabled();
      expect(
        await page.evaluate(() => {
          const w = window as any;
          return [
            w.__stableStage === document.querySelector(".shop-live-stage"),
            w.__stableArt ===
              document.querySelector(
                "[data-shop-preview=tidefin-bubblegum] img",
              ),
          ];
        }),
      ).toEqual([true, true]);
      // Selecting the same skin again must not restart its renderer.
      await page.click("[data-shop-preview=tidefin-bubblegum]");
      expect(
        await page.evaluate(
          () =>
            (window as any).__stableStage ===
            document.querySelector(".shop-live-stage"),
        ),
      ).toBe(true);
      await page.evaluate(async () => {
        (window as any).__shopBalance = 2340;
        await (window as any).__account.loadEconomy();
      });
      const buy = page.locator(
        ".shop-preview [data-shop-buy=tidefin-bubblegum]",
      );
      await buy.click();
      await buy.click();
      await expect(
        page.locator(".shop-preview [data-shop-equip=tidefin-bubblegum]"),
      ).toBeEnabled();
      expect(
        await page.evaluate(
          () =>
            (window as any).__stableStage ===
            document.querySelector(".shop-live-stage"),
        ),
      ).toBe(true);
      await page.click("[data-shop-preview=tidefin-abyss]");
      await expect(page.locator(".shop-live-stage")).toHaveClass(/is-ready/);
      await expect(page.locator(".shop-live-stage")).toHaveAttribute(
        "data-preview-item",
        "tidefin-abyss",
      );
      await page.locator("[data-shop-rarity]").selectOption("rare");
      await page.click("[data-shop-ownership=owned]");
      await page.click("[data-shop-reset]");
      await expect(page.locator("[data-shop-rarity]")).toHaveValue("all");
      await page.click("[data-shop-tab=collections]");
      await expect(page.locator(".shop-body .fx-live").first()).toBeVisible();
      expect(
        await page.evaluate(() => (window as any).__cosmeticLives.size),
      ).toBeGreaterThan(0);
      // A late Shop request cannot replace a menu the player opened meanwhile.
      await closePanel(page);
      await page.evaluate(() => {
        const w = window as any;
        w.__delayShop = true;
        w.__pendingShop = w.__account.showShop();
      });
      await page.waitForFunction(() => !!(window as any).__finishShop);
      await page.evaluate(() => void (window as any).__account.showFriends());
      await expect(page.locator(".friends-screen")).toBeVisible();
      await page.evaluate(async () => {
        const w = window as any;
        w.__finishShop();
        await w.__pendingShop;
      });
      await expect(page.locator(".friends-screen")).toBeVisible();
      await expect(page.locator(".shop")).toHaveCount(0);
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
  await expect(page.locator(".shop")).toBeVisible();
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
  await closePanel(page);
  await expect
    .poll(() => page.evaluate(() => (window as any).__pwaReloads || 0))
    .toBe(1);
  expect(errors).toEqual([]);
});
