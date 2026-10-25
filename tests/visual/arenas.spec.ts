import { expect, test } from "@playwright/test";
import { box, inside, openTown, openTownMenu, pushUntilBattle, snap } from "./helpers";

const COURTS = ["classic", "tide-pools", "ember-forge", "shifting-ruins"] as const;
const SIZES = [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
];

for (const size of SIZES)
  for (const arena of COURTS)
    test(`${arena} court fits its frame at ${size.width}×${size.height}`, async ({ page }, info) => {
      await page.setViewportSize(size);
      const errors = await openTown(page);
      await page.evaluate((arena) => (window as any).__room("practice", { arena, pos: [535, 226, 1065, 676] }), arena);
      await openTownMenu(page);
      await page.click(".town-play");
      await page.click("#practice");
      await pushUntilBattle(page);
      await expect(page.locator("body")).toHaveClass(/court-view/);
      const game = await box(page, "#game");
      const canvas = await box(page, "#game canvas");
      // The canvas fills the arena exactly: no overflow, no gap.
      expect(Math.abs(canvas.width - game.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(canvas.height - game.height)).toBeLessThanOrEqual(1);
      expect(inside(await box(page, ".arena-frame"), await box(page, ".arena-stage"))).toBe(true);
      // Nothing scrolls the page.
      expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(0);
      await snap(page, info, `${arena}-${size.width}`);
      expect(errors).toEqual([]);
    });

test("Grumblecrag raid plays on the court with broken pillars", async ({ page }, info) => {
  const errors = await openTown(page);
  await page.evaluate(() => (window as any).__room("raid", { boss: "grumblecrag", broken: [0, 4], pos: [535, 226, 700, 700] }));
  await openTownMenu(page);
  await page.click(".town-play");
  await page.click("#play-create");
  await pushUntilBattle(page);
  await expect(page.locator("body")).toHaveClass(/battle-raid/);
  // Raids show no stands strip, so the frame keeps its 16:9 layout.
  await expect(page.locator("body")).not.toHaveClass(/court-view/);
  await snap(page, info, "grumblecrag-court");
  expect(errors).toEqual([]);
});
