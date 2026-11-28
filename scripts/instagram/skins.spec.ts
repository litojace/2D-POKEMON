/**
 * The Instagram skins Reel (docs/instagram.md): each Mythical tried on in
 * the game's own fitting room at Stage III, its stage recorded while it
 * stands, then plays its Entrance, Victory and Ultimate, the effects as the
 * game draws them.
 *
 *   npx playwright test --config scripts/instagram/playwright.config.ts
 *   python3 scripts/instagram/make-reel.py
 *
 * Writes instagram-clips/<skin>/NNN.jpg (30 a second, the stage round the
 * fighter) and marks.json (when each play was pressed, ms).
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { openHub } from "../../tests/visual/helpers";
import { exposeAccount, shopServer } from "../../tests/visual/shop-server";
import { lookShown, onPlayersLook } from "../../tests/visual/players-look";

// The look players have (Poster), not the one the harness pins for older specs.
onPlayersLook();

const OUT = "instagram-clips";
const FPS = 30;
/**
 * The game time each frame moves on, in ms. Playwright's fake clock fires
 * requestAnimationFrame every 16 ms, so a step of 1000 / 30 let three
 * frames' time through every eighth step (the stage's data-animation-time
 * moved 32, 32 ... 48): a hitch several times a second. Two whole rAF ticks
 * per frame keep every step equal; the Reel plays 4% slow, which no one sees.
 */
const STEP = 32;
/** The part of the 2000 x 2500 window kept: the fighter, its circle and
 * what rises above it, clear of the Lobby bar at the top (CSS pixels). */
const CLIP = { x: 400, y: 200, width: 1200, height: 1500 };
/** The skins on the Reel: [skin, its fighter], as on post 8. */
export const SKINS: [skin: string, champion: string][] = [
  ["pyranda-harvest-moon", "pyranda"],
  ["tidefin-moontide", "tidefin"],
  ["cindrake-sunforged", "cindrake"],
];
/** What the stage plays, and how long each is recorded (ms). */
const PLAYS: [play: string | null, ms: number][] = [
  [null, 1800],
  ["entrance", 3000],
  ["victory", 3000],
  ["ultimate", 3600],
];

async function open(page: Page, champion: string) {
  await exposeAccount(page);
  // mythicTesting: every Awakening stage can be shown, as on a test account.
  await shopServer(page, { balance: 2340, cost: 500, mythicTesting: true });
  await openHub(page);
  await page.evaluate((c) => {
    (window as any).__choose(c);
    void (window as any).__account.showShop("skins");
  }, champion);
  await expect(page.locator(".fit-stage .shop-live-stage")).toHaveClass(
    /is-ready/,
  );
  expect(await lookShown(page)).toBe("poster");
}

for (const [skin, champion] of SKINS)
  test(`skin ${skin}`, async ({ browser }) => {
    const context = await browser.newContext({
      // A tall stage drawn big: the fitting room's stage fills this window
      // (below), and the canvas draws at its shown size up to its budget.
      // (The screencast sends CSS pixels, so the window itself is big.)
      viewport: { width: 2000, height: 2500 },
      deviceScaleFactor: 1,
    });
    try {
      const page = await context.newPage();
      await page.clock.install();
      await open(page, champion);
      const item = page.locator(`.fit-room [data-ui-item="${skin}"]`);
      await item.scrollIntoViewIfNeeded();
      await item.click();
      await page.click('[data-fit-awaken="3"]');
      await expect(page.locator('[data-fit-awaken="3"]')).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      // The stage alone, filling the window; its buttons stay clickable.
      await page.addStyleTag({
        content: `.fit-stage { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; max-width: none !important; max-height: none !important; margin: 0 !important; border-radius: 0 !important; z-index: 2147483000 !important; }
.fit-plays, .fit-stage-foot, .fit-stage-info { opacity: 0 !important; }`,
      });
      await page.waitForTimeout(1200);
      const dir = `${OUT}/${skin}`;
      mkdirSync(dir, { recursive: true });
      // Frame by frame on the page's own clock (requestAnimationFrame and
      // performance.now follow it): smooth 30 fps whatever the machine, and
      // the same frames every run. A live screencast of a window this big
      // manages about five a second.
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
      const marks: [string, number][] = [];
      let f = 0;
      for (const [play, ms] of PLAYS) {
        marks.push([play ?? "idle", Math.round((f * 1000) / FPS)]);
        // Sent to the button itself: in this big window the hidden Entrance
        // button sits under the Lobby bar's coin chip, which takes a click
        // at its place.
        if (play)
          await page
            .locator(`[data-fit-play="${play}"]`)
            .dispatchEvent("click");
        for (let n = 0; n < (ms * FPS) / 1000; n++) {
          await page.clock.runFor(STEP);
          await page.screenshot({
            path: `${dir}/${String(f++).padStart(3, "0")}.jpg`,
            type: "jpeg",
            quality: 92,
            clip: CLIP,
          });
        }
      }
      writeFileSync(`${dir}/marks.json`, JSON.stringify({ fps: FPS, marks }));
    } finally {
      await context.close();
    }
  });
