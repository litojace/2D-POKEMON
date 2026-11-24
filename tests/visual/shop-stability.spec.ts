import { expect, test, type Page } from "@playwright/test";
import {
  openHub,
  openPlayPanel,
  pushUntilBattle,
  snap,
  startPractice,
} from "./helpers";
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
      // (A closed Shop stays in the page, hidden, for its next open: ui/hub-panel.ts park.)
      await expect(
        page.locator(".fit-room:not([data-ui-leaving])"),
      ).toHaveCount(0);
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
/** The update worker, faked: onNeedRefresh on demand, counted applies and reloads. */
async function fakeUpdates(page: Page) {
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
}
/** Moves the page's clock past the Later snooze and lets the prompt re-check. */
const pastSnooze = (page: Page) =>
  page.evaluate(() => {
    const now = Date.now();
    Date.now = () => now + 11 * 60 * 1000;
    window.dispatchEvent(new Event("focus"));
  });
const counts = (page: Page) =>
  page.evaluate(() => [
    (window as any).__pwaApplies || 0,
    (window as any).__pwaReloads || 0,
  ]);
test("downloaded updates wait until the Shop closes, then ask first", async ({
  page,
}, info) => {
  await fakeUpdates(page);
  const errors = await openHub(page);
  await page.click("#account-coins");
  await expect(page.locator(".fit-room")).toBeVisible();
  await page.evaluate(() => (window as any).__pwaOptions.onNeedRefresh());
  expect(await counts(page)).toEqual([0, 0]);
  await expect(page.locator("#pwa-banner")).toContainText(
    "after closing menus",
  );
  await expect(page.locator("#pwa-takeover")).toBeHidden();
  await expect(page.locator("#pwa-update-now")).toBeHidden();
  await page.locator(".fit-room .ui-close").click();
  // Back in the hub: the first ask fills the screen; nothing applies yet.
  const takeover = page.locator("#pwa-takeover");
  await expect(takeover).toBeVisible();
  await expect(takeover).toContainText("New version");
  await expect(page.locator("#pwa-takeover-now")).toBeFocused();
  await expect(page.locator("#pwa-banner")).toBeHidden();
  await snap(page, info, "pwa-update-takeover");
  await page.waitForTimeout(500);
  expect(await counts(page)).toEqual([0, 0]);
  // Later: gone; asked again after the snooze, in the banner this time.
  await page.locator("#pwa-takeover-later").click();
  await expect(takeover).toBeHidden();
  await expect(page.locator("#pwa-banner")).toBeHidden();
  await pastSnooze(page);
  await expect(page.locator("#pwa-update-now")).toBeVisible();
  await expect(takeover).toBeHidden();
  await expect(page.locator("#pwa-banner")).toContainText("New version ready");
  await snap(page, info, "pwa-update-prompt");
  await page.locator("#pwa-update-now").click();
  await expect.poll(() => counts(page)).toEqual([1, 1]);
  expect(errors).toEqual([]);
});
test("Update now on the full-screen ask applies at once, and Escape means Later", async ({
  page,
}) => {
  await fakeUpdates(page);
  const errors = await openHub(page);
  await page.evaluate(() => (window as any).__pwaOptions.onNeedRefresh());
  await expect(page.locator("#pwa-takeover")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#pwa-takeover")).toBeHidden();
  expect(await counts(page)).toEqual([0, 0]);
  // A fresh page (the next session) asks full screen again.
  await page.reload();
  await page.evaluate(() => (window as any).__pwaOptions.onNeedRefresh());
  await page.locator("#pwa-takeover-now").click();
  await expect.poll(() => counts(page)).toEqual([1, 1]);
  expect(errors).toEqual([]);
});
for (const [width, height] of [
  [667, 375],
  [844, 390],
  [932, 430],
])
  test(`the update prompts fit a ${width}×${height} landscape phone`, async ({
    browser,
  }, info) => {
    const ctx = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await ctx.newPage();
      await fakeUpdates(page);
      const errors = await openHub(page);
      await page.evaluate(() => (window as any).__pwaOptions.onNeedRefresh());
      const inside = async (selector: string) => {
        const box = (await page.locator(selector).boundingBox())!;
        expect(box.x, selector).toBeGreaterThanOrEqual(0);
        expect(box.y, selector).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, selector).toBeLessThanOrEqual(width);
        expect(box.y + box.height, selector).toBeLessThanOrEqual(height);
        return box;
      };
      // The full-screen ask: everything on screen, touch-sized buttons.
      await expect(page.locator("#pwa-takeover-now")).toBeVisible();
      await snap(page, info, `pwa-update-takeover-${width}x${height}`);
      for (const id of [
        "#pwa-takeover h2",
        "#pwa-takeover p",
        "#pwa-takeover-now",
        "#pwa-takeover-later",
      ])
        await inside(id);
      for (const id of ["#pwa-takeover-now", "#pwa-takeover-later"])
        expect(
          (await page.locator(id).boundingBox())!.height,
        ).toBeGreaterThanOrEqual(44);
      // Both answers are the game's pill buttons (Later was once square).
      const radius = (id: string) =>
        page
          .locator(id)
          .evaluate((e) => parseFloat(getComputedStyle(e).borderTopLeftRadius));
      expect(await radius("#pwa-takeover-later")).toBe(
        await radius("#pwa-takeover-now"),
      );
      expect(await radius("#pwa-takeover-later")).toBeGreaterThanOrEqual(22);
      const size = (id: string) =>
        page.locator(id).evaluate((e) => getComputedStyle(e).fontSize);
      expect(await size("#pwa-takeover-later")).toBe(
        await size("#pwa-takeover-now"),
      );
      await page.locator("#pwa-takeover-later").tap();
      await expect(page.locator("#pwa-takeover")).toBeHidden();
      // The banner, after the snooze: beside PLAY, not over it.
      await pastSnooze(page);
      const now = page.locator("#pwa-update-now"),
        later = page.locator("#pwa-update-later");
      await expect(now).toBeVisible();
      await snap(page, info, `pwa-update-prompt-${width}x${height}`);
      const banner = await inside("#pwa-banner");
      for (const button of [now, later])
        expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      const play = (await page.locator("#lobby-play").boundingBox())!;
      expect(
        banner.x + banner.width <= play.x || banner.y + banner.height <= play.y,
        JSON.stringify({ banner, play }),
      ).toBe(true);
      await later.tap();
      await expect(page.locator("#pwa-banner")).toBeHidden();
      expect(errors).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
for (const [width, height] of [
  [568, 320],
  [844, 390],
])
  test(`in a battle, the update note sits at the bottom, over no control (${width}×${height})`, async ({
    browser,
  }, info) => {
    test.setTimeout(180_000);
    const ctx = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await ctx.newPage();
      await fakeUpdates(page);
      const errors = await openHub(page);
      await page.evaluate(() => (window as any).__room("practice"));
      await openPlayPanel(page);
      await startPractice(page);
      await pushUntilBattle(page);
      await page.evaluate(() => (window as any).__pwaOptions.onNeedRefresh());
      const note = page.locator("#pwa-banner");
      await expect(note).toContainText("Update after practice");
      await expect(page.locator("#pwa-takeover")).toBeHidden();
      await snap(page, info, `pwa-battle-note-${width}x${height}`);
      const rects = await page.evaluate(() => {
        const box = (e: Element) => {
          const r = e.getBoundingClientRect();
          return { x: r.left, y: r.top, r: r.right, b: r.bottom };
        };
        return {
          note: box(document.getElementById("pwa-banner")!),
          others: [
            ...document.querySelectorAll(
              // Every control and readout a battle shows, the chat
              // button and the battle menu included.
              ".touch-buttons button, .joystick, #hud, #chat-button, #battle-menu, #mobile-settings, .match-badge, #spectate",
            ),
          ]
            .filter((e) => e.getBoundingClientRect().width > 0)
            .map((e) => ({ name: e.className, ...box(e) })),
        };
      });
      // In the bottom part of the screen, and on it.
      expect(rects.note.y).toBeGreaterThan(height * 0.75);
      expect(rects.note.x).toBeGreaterThanOrEqual(0);
      expect(rects.note.r).toBeLessThanOrEqual(width);
      expect(rects.note.b).toBeLessThanOrEqual(height);
      const over = rects.others.filter(
        (o) =>
          rects.note.x < o.r &&
          o.x < rects.note.r &&
          rects.note.y < o.b &&
          o.y < rects.note.b,
      );
      expect(over.map((o) => o.name)).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
