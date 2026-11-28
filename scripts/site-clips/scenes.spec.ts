/**
 * Combat stills for the website's "Ways to play" cards (docs/website.md):
 * the real client drawing the real server simulation, stepped tick by tick,
 * with every fighter firing its ultimate within a few ticks of the others.
 * Each scene writes one frame per tick to site-clips/scenes/<name>/;
 * apps/site/tools/pick-scenes.py keeps the busiest frame of each.
 *
 *   npx playwright test --config scripts/site-clips/playwright.config.ts scenes
 */
import { test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  createRoom,
  openHub,
  openPlayPanel,
  pushUntilBattle,
} from "../../tests/visual/helpers";
import { CLEAN, SCENES, TICKS, stage, step } from "./scenes";

const OUT = "site-clips/scenes";

for (const s of SCENES)
  test(`scene ${s.name}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 874, height: 402 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    // The Spire's painted court (as tests/visual/spire-court.spec.ts sets).
    await context.addInitScript(() =>
      localStorage.setItem(
        "arena-controls",
        JSON.stringify({ raidCourt: true }),
      ),
    );
    try {
      const page = await context.newPage();
      await openHub(page);
      await page.evaluate((args) => (window as any).__room(...args), s.room);
      await openPlayPanel(page);
      await createRoom(page);
      await pushUntilBattle(page);
      await page.addStyleTag({ content: CLEAN });
      await stage(page, s);
      // Let the fighters' art settle before anyone casts.
      await page.evaluate(() => ((window as any).__shot.tick = -60));
      for (let i = 0; i < 30; i++) await step(page, 2, true);
      const dir = `${OUT}/${s.name}`;
      mkdirSync(dir, { recursive: true });
      const court = page.locator("#game canvas").first();
      for (let f = 0; f <= TICKS; f++) {
        await step(page, 1, true);
        writeFileSync(
          `${dir}/${String(f).padStart(3, "0")}.png`,
          await court.screenshot(),
        );
      }
    } finally {
      await context.close();
    }
  });
