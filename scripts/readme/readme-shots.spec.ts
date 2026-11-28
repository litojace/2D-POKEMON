/**
 * The README's pictures: the App Store scenes (scripts/app-store/scenes.ts)
 * and the Lobby, in the look players have (Poster), at 844×390 (a notched
 * iPhone in landscape) and 2x. PNGs land in readme-shots/ (not committed);
 * scripts/readme/to-webp.py turns them into docs/readme/*.webp.
 *
 *   npx playwright test --config scripts/readme/playwright.config.ts
 *   SCENES=lobby,plaza npx playwright test --config scripts/readme/playwright.config.ts
 */
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { playersLook } from "../../tests/visual/players-look";
import { openLobby } from "../../tests/visual/helpers";
import {
  INSET,
  SCENES,
  middayZone,
  phone,
  player,
  type Scene,
} from "../app-store/scenes";

const OUT = "readme-shots";
// A notched iPhone in landscape (iPhone 14: 47 pt each side, 21 pt home bar).
Object.assign(INSET, { left: 47, right: 47, bottom: 21, top: 0 });

const lobby: Scene = {
  name: "lobby",
  caption: "",
  async capture(page) {
    await openLobby(page);
    await phone(page);
    await page.waitForTimeout(2500);
  },
};
/** The scenes the README shows (the roster and free-for-all are not used). */
const README = ["lobby", "duel", "teams", "raid", "plaza"];
const scenes = [lobby, ...SCENES].filter((s) => README.includes(s.name));
const only = process.env.SCENES?.split(",");

for (const scene of scenes.filter((s) => !only || only.includes(s.name)))
  test(`readme ${scene.name}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      timezoneId: middayZone(),
    });
    try {
      await playersLook(context);
      const page = await context.newPage();
      await player(page);
      await scene.capture(page);
      // The look players have, never the look underneath.
      expect(
        await page.evaluate(() => document.documentElement.dataset.ui),
      ).toBe("poster");
      mkdirSync(OUT, { recursive: true });
      await page.screenshot({ path: `${OUT}/${scene.name}.png` });
    } finally {
      await context.close();
    }
  });
