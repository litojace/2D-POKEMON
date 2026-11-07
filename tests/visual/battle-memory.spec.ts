import { expect, test } from "@playwright/test";
import { openLobby, openPlayPanel, pushUntilBattle } from "./helpers";

// An older iPhone ends a page that holds too much memory (a white screen,
// then a reload). The battle keeps its budget small there: a 1.5× canvas,
// one floor at that density, no Phaser FX render targets, and its WebGL
// context handed back when the battle closes.
test.use({
  viewport: { width: 667, height: 375 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
});

test("an iPhone battle keeps a small memory budget and hands its WebGL context back", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);",
        "window.__memGame=gameInstance;gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);",
      ),
    });
  });
  await page.addInitScript(() => {
    const w = window as any;
    w.__gls = [];
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: any[]
    ) {
      const ctx = get.call(this, type as any, ...rest);
      if (ctx && /webgl/.test(type) && !w.__gls.includes(ctx))
        w.__gls.push(ctx);
      return ctx;
    } as any;
  });
  const errors = await openLobby(page);
  // Battle contexts only: Phaser also makes a 1×1 one to test for WebGL.
  const battleContextsLost = () =>
    page.evaluate(() =>
      (window as any).__gls
        .filter((g: any) => g.canvas.width > 1)
        .map((g: any) => g.isContextLost()),
    );
  for (const round of [1, 2]) {
    if (round === 1) {
      await page.evaluate(() =>
        (window as any).__room("pvp", { mode: "duel", phase: "playing" }),
      );
      await openPlayPanel(page);
      await page.click("#play-create");
    } else {
      // A rematch from the room lobby builds the battle renderer again.
      await page.evaluate(() => ((window as any).__snap.phase = "playing"));
    }
    await pushUntilBattle(page);
    const budget = await page.evaluate(() => {
      const g = (window as any).__memGame;
      const floors = g.textures
        .getTextureKeys()
        .filter((k: string) => k.startsWith("arena-floor-"))
        .map((k: string) => {
          const s = g.textures.get(k).source[0];
          return `${k} ${s.width}x${s.height}`;
        });
      return {
        canvas: `${g.canvas.width}x${g.canvas.height}`,
        css: `${g.canvas.clientWidth}x${g.canvas.clientHeight}`,
        floors,
        postFX: g.config.disablePostFX,
      };
    });
    // 1.5 canvas pixels per CSS pixel on an iPhone (the screen is 2×).
    const [cw] = budget.canvas.split("x").map(Number);
    const [sw] = budget.css.split("x").map(Number);
    expect(cw / sw).toBeCloseTo(1.5, 1);
    // One floor, the court on show, baked at that density (not 2× twice).
    expect(budget.floors).toEqual(["arena-floor-court-classic 2400x1350"]);
    expect(budget.postFX).toBe(true);
    await page.evaluate(() => {
      const w = window as any;
      w.__snap.phase = "lobby";
      w.__push();
    });
    await expect(page.locator("#battle")).toBeHidden({ timeout: 30_000 });
    // Phaser tears down on its next step; then the context is given back.
    await expect
      .poll(battleContextsLost, { timeout: 30_000 })
      .toEqual(round === 1 ? [true] : [true, true]);
  }
  // Handing the context back is not mistaken for a lost display.
  await expect(page.getByText("Restoring the arena display")).toHaveCount(0);
  expect(errors).toEqual([]);
});
