import { expect, test } from "@playwright/test";
import {
  createRoom,
  openHub,
  openPlayPanel,
  pushUntilBattle,
  snap,
} from "./helpers";

test("Low expires cosmetic particles by elapsed time and shows a fresh burst after a hitch", async ({
  browser,
}, info) => {
  test.setTimeout(150_000);
  const context = await browser.newContext({
    viewport: { width: 896, height: 414 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem("ea-graphics", "low"));
    await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
      const response = await route.fetch(),
        body = await response.text();
      const marker =
        "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);";
      expect(body).toContain(marker);
      await route.fulfill({
        response,
        body: body.replace(marker, "window.__fxGame=gameInstance;" + marker),
      });
    });
    const errors = await openHub(page);
    await page.evaluate(() =>
      (window as any).__room("pvp", { mode: "ffa", phase: "playing" }),
    );
    await openPlayPanel(page);
    await createRoom(page);
    await pushUntilBattle(page);
    const result = await page.evaluate(async (root) => {
      const { fxFor } = await import(
        `/@fs${root}/apps/client/src/fx-engine.ts`
      );
      const w = window as any,
        game = w.__fxGame,
        scene = game.scene.getScene("arena"),
        fx = fxFor(scene);
      game.loop.sleep();
      let time = performance.now() + 5000;
      // Drain any entrance effect before the isolated, real-engine probe.
      game.step(time, 1000 / 60);
      game.step((time += 5000), 1000 / 60);
      const samples: number[] = [];
      const frame = (ms: number, emit: boolean) => {
        if (emit)
          scene.events.once("preupdate", () =>
            fx.burst({
              x: 800,
              y: 450,
              count: 100,
              kind: "spark",
              color: 0xffd65b,
              speed: [10, 20],
              life: [1, 1],
              size: [2, 2],
            }),
          );
        // The real rendered timestamps advance; Phaser's smoothed animation
        // delta remains 16.7 ms, as during warm-up or a severe stall.
        game.step((time += ms), 1000 / 60);
        samples.push(fx.stats.particles);
      };
      for (let i = 0; i < 12; i++) frame(250, true);
      const stream = samples.slice();
      frame(1500, true);
      const fresh = fx.stats.particles;
      frame(1100, false);
      const expired = fx.stats.particles;
      const canvas = game.canvas;
      return {
        stream,
        fresh,
        expired,
        density: canvas.width / canvas.clientWidth,
      };
    }, process.cwd());
    expect(Math.max(...result.stream)).toBeLessThanOrEqual(175);
    expect(result.fresh).toBe(35);
    expect(result.expired).toBe(0);
    expect(result.density).toBeCloseTo(1.25, 1);
    await info.attach("fx-clock", {
      body: JSON.stringify(result, null, 2),
      contentType: "application/json",
    });
    await snap(page, info, "fx-clock-low");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
