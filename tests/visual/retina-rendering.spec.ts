import { expect, test } from "@playwright/test";
import { openHub, openPlayPanel, pushUntilBattle } from "./helpers";

for (const mobile of [false, true])
  test(`${mobile ? "installed iPhone" : "Retina desktop"} smooths battle fighters`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 844, height: 390 }
        : { width: 1440, height: 900 },
      deviceScaleFactor: mobile ? 3 : 2,
      isMobile: mobile,
      hasTouch: mobile,
      ...(mobile
        ? {
            userAgent:
              "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
          }
        : {}),
    });
    try {
      const page = await context.newPage();
      if (mobile)
        await page.addInitScript(() =>
          Object.defineProperty(navigator, "standalone", { value: true }),
        );
      await page.route(
        /\/apps\/client\/src\/main\.ts(?:\?|$)/,
        async (route) => {
          const response = await route.fetch(),
            body = await response.text();
          const marker =
            "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);";
          expect(body).toContain(marker);
          await route.fulfill({
            response,
            body: body.replace(
              marker,
              "window.__densityBattle=gameInstance;" + marker,
            ),
          });
        },
      );
      const errors = await openHub(page);
      const audit = async () =>
        page.evaluate(async () => {
          const { renderingAudit } = await import("/render-audit.ts");
          return renderingAudit((window as any).__densityBattle);
        });
      const expectSmooth = (result: Awaited<ReturnType<typeof audit>>) => {
        expect(result.pixelArt).toBe(false);
        expect(result.antialias).toBe(true);
        expect(result.imageRendering).toBe("auto");
        expect(result.filters.length).toBeGreaterThan(40);
        expect(new Set(result.filters)).toEqual(new Set([9729])); // GL.LINEAR
      };
      await page.evaluate(() => (window as any).__room("practice"));
      await openPlayPanel(page);
      await page.click("#practice");
      await pushUntilBattle(page);
      expectSmooth(await audit());
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
