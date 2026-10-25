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

// Every other raid on its own painted arena, with its scenery and boss.
for (const boss of ["tidewyrm", "gloomshade", "storm-twins", "emberwing", "prismatail", "somnara"] as const)
  test(`${boss} raid arena loads and fits its frame`, async ({ page }, info) => {
    const errors = await openTown(page);
    await page.evaluate((boss) => (window as any).__room("raid", { boss, pos: [500, 450, 700, 600] }), boss);
    await openTownMenu(page);
    await page.click(".town-play");
    await page.click("#play-create");
    await pushUntilBattle(page);
    await expect(page.locator("body")).toHaveClass(/battle-raid/);
    const game = await box(page, "#game");
    const canvas = await box(page, "#game canvas");
    expect(Math.abs(canvas.width - game.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(canvas.height - game.height)).toBeLessThanOrEqual(1);
    await snap(page, info, `raid-${boss}`);
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

// The stone you see is exactly the area that stops attacks: its picture fills
// the block's footprint and nothing behind it. A shot flying just behind a
// block shows on the open sand there and leaves the stone untouched (it used
// to be drawn over the stone's raised top, looking like it passed through).
test("a block's picture is exactly its solid area", async ({ page }, info) => {
  const errors = await openTown(page);
  // The top-left block's footprint is 490–580 × 240–370; the shot is just behind it.
  const shot: [number, number] = [535, 212];
  const enter = async (shots: [number, number][]) => {
    await page.evaluate(
      (shots) => (window as any).__room("practice", { arena: "classic", character: "tidefin", pos: [300, 760, 1300, 760], shots }),
      shots,
    );
  };
  await enter([shot]);
  await openTownMenu(page);
  await page.click(".town-play");
  await page.click("#practice");
  await pushUntilBattle(page);
  await page.waitForTimeout(1500);
  // World → screen: on desktop the court view shows x 0–1600, y −96–900.
  const canvas = await box(page, "#game canvas");
  const s = canvas.width / 1600;
  const clip = (x0: number, y0: number, x1: number, y1: number) => ({
    x: canvas.x + x0 * s,
    y: canvas.y + (y0 + 96) * s,
    width: (x1 - x0) * s,
    height: (y1 - y0) * s,
  });
  const stone = clip(495, 250, 575, 362);
  const behind = clip(510, 196, 560, 234);
  const withShot = { stone: await page.screenshot({ clip: stone }), behind: await page.screenshot({ clip: behind }) };
  await snap(page, info, "shot-behind-block");
  await enter([]);
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => (window as any).__push());
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1200);
  const without = { stone: await page.screenshot({ clip: stone }), behind: await page.screenshot({ clip: behind }) };
  expect(withShot.behind.equals(without.behind)).toBe(false);
  expect(withShot.stone.equals(without.stone)).toBe(true);
  expect(errors).toEqual([]);
});
