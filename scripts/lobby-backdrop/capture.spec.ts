import { test } from "@playwright/test";
import { openPlaza } from "../../tests/visual/helpers";

/**
 * The Lobby's backdrop (apps/client/public/assets/backgrounds/plaza-lobby.webp)
 * is a picture of the Plaza. Redraw it whenever the Plaza's map changes:
 *
 *   PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test \
 *     --config scripts/lobby-backdrop/playwright.config.ts --trace off
 *   python3 scripts/lobby-backdrop/encode.py
 *
 * It opens the real Plaza in the visual-test harness with the window the
 * size of the map (so the camera shows all of it), at midday, with the HUD
 * hidden, no townsfolk or pitch bots, the player tucked behind the top-left house (no townsfolk come near it) and an empty TOP DASH board, and
 * saves test-results/lobby-backdrop/plaza.png. encode.py crops it to the
 * backdrop's shape and writes the WebP.
 */
test.use({ viewport: { width: 2700, height: 1700 }, deviceScaleFactor: 1 });

test("draw the Plaza for the Lobby's backdrop", async ({ page }) => {
  await page.addInitScript(() => {
    // No made-up names on the TOP DASH board in a picture everyone sees.
    const w = window as any;
    const fix = () => {
      if (!w.__plazaProgress || !w.__plazaWorld) return setTimeout(fix, 0);
      w.__plazaProgress.board = [];
      w.__plazaProgress.bestLapMs = null;
      // An empty Plaza, as the backdrop always was: no townsfolk (the
      // harness runs the real PlazaWorld in the page) ...
      w.__plazaWorld.syncFolk = () => {};
    };
    fix();
  });
  await openPlaza(page);
  await page.addStyleTag({
    // Only the Plaza's canvas shows (a child can be visible inside a hidden parent).
    content:
      "body * { visibility: hidden !important; } #pz-cv { visibility: visible !important; }",
  });
  await page.evaluate(() => {
    const w = window as any;
    w.__plaza.setTod(0.42);
    // ... and no pitch bots (the ball waits on the centre spot).
    for (const c of w.__plazaWorld.copies.values()) c.bots = [];
    w.__plazaPosition(185, 268);
  });
  // Let the camera, the player's position and the ambient life settle.
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "test-results/lobby-backdrop/plaza.png" });
});
