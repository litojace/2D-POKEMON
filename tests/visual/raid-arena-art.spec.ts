import { test, expect } from "@playwright/test";
import { openTown, openTownMenu, pushUntilBattle, snap } from "./helpers";
const floors = {
  grumblecrag: "raid-coliseum",
  tidewyrm: "lagoon",
  gloomshade: "lantern-yard",
  somnara: "cloud-deck",
  prismatail: "sun-atrium",
  emberwing: "sky-terrace",
  "storm-twins": "conductor-ring",
};
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
]) {
  test(`illustrated raid maps and warning layers load at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }, info) => {
    test.setTimeout(150000);
    const context = await browser.newContext({
      viewport,
      isMobile: viewport.width < 1000,
      hasTouch: viewport.width < 1000,
    });
    try {
      const page = await context.newPage();
      await page.route(
        /\/apps\/client\/src\/main\.ts(?:\?|$)/,
        async (route) => {
          const response = await route.fetch(),
            body = await response.text(),
            marker =
              "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);";
          expect(body).toContain(marker);
          await route.fulfill({
            response,
            body: body.replace(
              marker,
              "window.__raidArtGame=gameInstance;" + marker,
            ),
          });
        },
      );
      const requests: string[] = [];
      page.on("request", (r) => {
        if (r.resourceType() === "image" && r.url().includes("/raid-arenas/"))
          requests.push(r.url());
      });
      const errors = await openTown(page);
      await page.evaluate(() =>
        (window as any).__room("raid", { boss: "grumblecrag", broken: [0, 4] }),
      );
      await openTownMenu(page);
      await page.click(".town-play");
      await page.click("#play-create");
      await pushUntilBattle(page);
      for (const [boss, floor] of Object.entries(floors)) {
        if (boss !== "grumblecrag")
          await page.evaluate((boss) => {
            const w = window as any;
            w.__room("raid", { boss });
            w.__push();
          }, boss);
        await expect
          .poll(() =>
            page.evaluate(() => {
              const scene = (window as any).__raidArtGame.scene.getScene(
                "arena",
              );
              return scene.floor.texture.getSourceImage().dataset?.raidArtwork;
            }),
          )
          .toBe(floor);
        if (boss === "grumblecrag") {
          expect(requests.every((r) => r.includes("grumblecrag.webp"))).toBe(
            true,
          );
          const rubble = await page.evaluate(() => {
            const scene = (window as any).__raidArtGame.scene.getScene("arena"),
              c = scene.textures.get("court-rubble-0").getSourceImage();
            return {
              alpha: c.getContext("2d").getImageData(0, 0, 1, 1).data[3],
              shadow: scene.raidPillarShadows[0].visible,
            };
          });
          expect(rubble).toEqual({ alpha: 0, shadow: false });
        }
        // Red live warnings remain a separate layer over the static materials.
        await page.evaluate(() => {
          const w = window as any,
            s = w.__snap;
          s.raid.warnings = [
            {
              id: 900,
              kind: "charge",
              startedAt: s.time,
              at: s.time + 2,
              lockAt: s.time + 1,
              targetId: "me",
              x: 1100,
              y: 450,
              tx: 500,
              ty: 450,
              radius: 80,
            },
          ];
          w.__push();
        });
        await page.waitForTimeout(150);
        await snap(
          page,
          info,
          `arena-${boss}-${viewport.width}x${viewport.height}`,
        );
      }
      const before = requests.length;
      await page.evaluate(() => {
        const w = window as any;
        w.__room("raid", { boss: "grumblecrag" });
        w.__push();
      });
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as any).__raidArtGame.scene
                .getScene("arena")
                .floor.texture.getSourceImage().dataset?.raidArtwork,
          ),
        )
        .toBe("raid-coliseum");
      expect(requests.length).toBe(before);
      expect(new Set(requests).size).toBe(7);
      await page.evaluate(() => {const w=window as any;w.__room("practice");w.__push();});
      await expect.poll(() => page.evaluate(() => (window as any).__raidArtGame.scene.getScene("arena").floor.texture.key)).toBe("arena-floor-court-classic");
      expect(await page.evaluate(() => (window as any).__raidArtGame.scene.getScene("arena").raidPillarShadows.every((s:any)=>!s.visible))).toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
