import { test, expect, type Page } from "@playwright/test";
import { openHub, pushUntilBattle, snap, openPlayPanel } from "./helpers";
import { decodePng } from "./png";

/*
 * Prismatail turns the mirrors that carried the light when an exposure
 * ends (apps/server/src/raid-prismatail.ts). Before one turns, the client
 * must flash it: a pink ring and halo, and a ghost arrow where it will
 * point, so a phone player sees the board change coming.
 */
const MIRROR = { x: 600, y: 300 };

/** How many flash-pink pixels are drawn around the first mirror. */
async function pinkAroundMirror(page: Page) {
  const clip = await page.evaluate(({ x, y }) => {
    const w = window as any,
      scene = w.__scrambleGame.scene.getScene("arena"),
      c = scene.cameras.main,
      rect = w.__scrambleGame.canvas.getBoundingClientRect(),
      k = rect.width / scene.scale.width;
    const sx = rect.x + (x - c.worldView.x) * c.zoomX * k,
      sy = rect.y + (y - c.worldView.y) * c.zoomY * k,
      half = 95 * c.zoomX * k;
    return {
      x: Math.max(0, sx - half),
      y: Math.max(0, sy - half),
      width: half * 2,
      height: half * 2,
    };
  }, MIRROR);
  const { data, width, height } = decodePng(
    await page.screenshot({ clip, animations: "disabled" }),
  );
  let pink = 0;
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4],
      g = data[i * 4 + 1],
      b = data[i * 4 + 2];
    if (r > 200 && g < 175 && b > 110 && b < 210 && r - g > 70) pink++;
  }
  return pink;
}

test("a mirror about to scramble flashes and shows where it will point", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch(),
      body = await response.text(),
      marker =
        "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);";
    expect(body).toContain(marker);
    await route.fulfill({
      response,
      body: body.replace(
        marker,
        "window.__scrambleGame=gameInstance;" + marker,
      ),
    });
  });
  const errors = await openHub(page);
  await page.evaluate(() =>
    (window as any).__room("raid", {
      boss: "prismatail",
      pos: [300, 700, 380, 760],
    }),
  );
  await openPlayPanel(page);
  await page.click("#play-create");
  await pushUntilBattle(page);
  const set = (scramble: boolean) =>
    page.evaluate((scramble) => {
      const w = window as any,
        m = w.__snap.raid.mirrors[0];
      w.__snap.raid.warnings = [];
      if (scramble) {
        m.scrambleAt = w.__snap.time + 30;
        m.scrambleTurns = 2;
      } else {
        delete m.scrambleAt;
        delete m.scrambleTurns;
      }
      w.__push();
    }, scramble);
  await set(false);
  await page.waitForTimeout(400);
  const quiet = await pinkAroundMirror(page);
  await snap(page, info, "prisma-scramble-quiet");
  await set(true);
  await page.waitForTimeout(400);
  const flashing = await pinkAroundMirror(page);
  await snap(page, info, "prisma-scramble-flash");
  // The flash is plainly there, and gone again once the mirror has turned.
  expect(flashing).toBeGreaterThan(quiet + 400);
  await set(false);
  await page.waitForTimeout(400);
  expect(await pinkAroundMirror(page)).toBeLessThan(quiet + 100);
  // The cue line says it too.
  await set(true);
  await expect(page.locator("#raid-hud")).toContainText("Mirrors flashing");
  expect(errors).toEqual([]);
});
