import { expect, test } from "@playwright/test";
import { openTown, openTownMenu, pushUntilBattle } from "./helpers";

for (const mobile of [false, true])
  test(`${mobile ? "installed iPhone" : "Retina desktop"} smooths fighters and keeps zoomed nameplates sharp`, async ({
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
        /\/apps\/client\/src\/town\.ts(?:\?|$)/,
        async (route) => {
          const response = await route.fetch(),
            body = await response.text();
          await route.fulfill({
            response,
            body: body
              .replace(
                "this.scenery = new TownScenery(this, options.reduced);",
                "this.scenery = new TownScenery(this, options.reduced);window.__densityScene=this;",
              )
              .replace(
                "return body;",
                "window.__densityBody=body;return body;",
              ),
          });
        },
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
      const errors = await openTown(page);
      await page.waitForFunction(() => !!(window as any).__densityBody?.rig);
      await page.evaluate(() => {
        const w = window as any;
        w.__sock.fire("town-profiles", [
          {
            ...w.__densityBody.worn,
            title: "Mountain Conqueror",
            titleColor: "#ffd65b",
          },
        ]);
      });
      const audit = async (selector: string) =>
        page.evaluate(async (s) => {
          const { renderingAudit } = await import("/render-audit.ts");
          const w = window as any;
          return renderingAudit(
            s.startsWith("#game") ? w.__densityBattle : w.__densityScene.game,
          );
        }, selector);
      const expectSmooth = (result: Awaited<ReturnType<typeof audit>>) => {
        expect(result.pixelArt).toBe(false);
        expect(result.antialias).toBe(true);
        expect(result.imageRendering).toBe("auto");
        expect(result.filters.length).toBeGreaterThan(40);
        expect(new Set(result.filters)).toEqual(new Set([9729])); // GL.LINEAR
      };
      expectSmooth(await audit(".town-canvas canvas"));
      while (await page.locator("#town-zoom-in").isEnabled()) {
        await page.click("#town-zoom-in");
        await page.waitForTimeout(180);
      }
      await page.waitForTimeout(250);
      const labels = await page.evaluate(() => {
        const w = window as any,
          body = w.__densityBody,
          scene = w.__densityScene;
        return [body.name, body.title].map((label: any) => ({
          text: label.text,
          resolution: label.style.resolution,
          sourceStretch:
            (scene.cameras.main.zoom * label.scaleX) / label.style.resolution,
        }));
      });
      expect(labels[1].text).toBe("Mountain Conqueror");
      for (const label of labels) {
        expect(label.resolution).toBe(6);
        expect(label.sourceStretch).toBeLessThanOrEqual(1);
      }
      await openTownMenu(page);
      await page.evaluate(() => (window as any).__room("practice"));
      await page.click(".town-play");
      await page.click("#practice");
      await pushUntilBattle(page);
      expectSmooth(await audit("#game canvas"));
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
