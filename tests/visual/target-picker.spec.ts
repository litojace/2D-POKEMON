import { expect, test, type Page } from "@playwright/test";
import { openTown, openTownMenu, pushUntilBattle, snap } from "./helpers";

// Phones aim at the nearest enemy; with two or more enemies the player can
// lock on to another one (a target row, or a tap on the fighter).
async function ffa(page: Page) {
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch(),
      body = await response.text();
    const marker = "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);";
    expect(body).toContain(marker);
    await route.fulfill({ response, body: body.replace(marker, "window.__targetGame=gameInstance;" + marker) });
  });
  const errors = await openTown(page);
  await page.evaluate(() => {
    const w = window as any;
    w.__events = [];
    w.__emit = (event: string, data: unknown) => w.__events.push({ event, data });
    w.__room("pvp", { mode: "ffa", phase: "playing" });
  });
  await openTownMenu(page);
  await page.click(".town-play");
  await page.click("#play-create");
  await pushUntilBattle(page);
  // Spread the fighters out (all on a phone's screen): Kai nearest to you,
  // Rae and Mina farther.
  await page.evaluate(() => {
    const w = window as any,
      at: Record<string, [number, number]> = { me: [500, 380], p2: [650, 380], p3: [1000, 200], p4: [900, 330] };
    w.__snap.remaining = 90;
    for (const p of w.__snap.players) [p.x, p.y] = at[p.id];
    w.__push();
  });
  return errors;
}
const lastAim = (page: Page) =>
  page.evaluate(() => {
    const inputs = (window as any).__events.filter((e: any) => e.event === "input");
    const last = inputs.at(-1)?.data;
    return last ? { x: last.aimX as number, y: last.aimY as number } : undefined;
  });
const aimNear = async (page: Page, x: number, y: number) =>
  expect
    .poll(async () => {
      const a = await lastAim(page);
      return a ? Math.hypot(a.x - x, a.y - y) : Infinity;
    }, { timeout: 8000 })
    .toBeLessThan(2);

for (const size of [
  { width: 844, height: 390 },
  { width: 844, height: 280 },
]) {
  test(`phones can pick who to aim at with several enemies (${size.width}x${size.height})`, async ({ browser }, info) => {
    const context = await browser.newContext({ viewport: size, isMobile: true, hasTouch: true });
    try {
      const page = await context.newPage();
      const errors = await ffa(page);
      const picker = page.locator("#target-picker");
      await expect(picker).toBeVisible();
      await expect(picker.locator("button")).toHaveCount(3);
      // It fits on screen and clear of every touch control.
      const rows = await page.evaluate(() => {
        const r = (el: Element) => {
          const b = el.getBoundingClientRect();
          return { x: b.x, y: b.y, right: b.right, bottom: b.bottom };
        };
        return {
          picker: [...document.querySelectorAll("#target-picker button")].map(r),
          controls: [...document.querySelectorAll("#mobile-controls button, #mobile-controls .joystick, #battle-menu, #battle-menu .ping-badge")].map(r),
          hud: [...document.querySelectorAll("#hud > *")].filter((el) => el.getClientRects().length).map(r),
        };
      });
      for (const b of rows.picker) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.right).toBeLessThanOrEqual(size.width);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.bottom).toBeLessThanOrEqual(size.height);
        for (const c of [...rows.controls, ...rows.hud])
          expect(b.right <= c.x || c.right <= b.x || b.bottom <= c.y || c.bottom <= b.y).toBe(true);
      }
      // Automatic: the nearest enemy (Kai).
      await aimNear(page, 650, 380);
      // Lock on to Rae from the row.
      await picker.locator('button[data-target-id="p3"]').tap();
      await expect(picker.locator('button[data-target-id="p3"]')).toHaveAttribute("aria-pressed", "true");
      await aimNear(page, 1000, 200);
      await snap(page, info, `target-row-${size.width}x${size.height}`);
      // Tap again: back to automatic aiming.
      await picker.locator('button[data-target-id="p3"]').tap();
      await expect(picker.locator('button[data-target-id="p3"]')).toHaveAttribute("aria-pressed", "false");
      await aimNear(page, 650, 380);
      // A tap on Mina herself on the court locks her.
      const screen = await page.evaluate(() => {
        const cam = (window as any).__targetGame.scene.getScene("arena").cameras.main;
        const canvas = document.querySelector("#game canvas")!.getBoundingClientRect();
        const v = cam.worldView;
        return { x: canvas.left + ((900 - v.x) / v.width) * canvas.width, y: canvas.top + ((330 - v.y) / v.height) * canvas.height };
      });
      await page.touchscreen.tap(screen.x, screen.y);
      await expect(picker.locator('button[data-target-id="p4"]')).toHaveAttribute("aria-pressed", "true");
      await aimNear(page, 900, 330);
      // A defeated target cannot be picked; aim returns to the nearest.
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.players.find((p: any) => p.id === "p4").hp = 0;
        w.__push();
      });
      await expect(picker.locator('button[data-target-id="p4"]')).toBeDisabled();
      await aimNear(page, 650, 380);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("the target row is for touch play only", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await ffa(page);
  await page.waitForTimeout(500);
  await expect(page.locator("#target-picker")).toBeHidden();
});
