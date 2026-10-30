import { expect, test } from "@playwright/test";
import { box, openTown, snap } from "./helpers";

// The quest tracker under the player card in town: today's missions at a
// glance, closest to done first, and a tap opens the Missions screen.
const day = new Date().toISOString().slice(0, 10);
const m = (slot: number, id: string, tier: string, text: string, progress: number, target: number, coins: number) => ({
  day, slot, id, text, tier, progress, target, coins, done: progress >= target,
});
const MISSIONS = [
  m(0, "play-2", "easy", "Play 2 matches", 2, 2, 20),
  m(1, "skills-30", "easy", "Use 30 skills", 18, 30, 20),
  m(2, "win-1", "easy", "Win a match", 0, 1, 25),
  m(3, "bot-wins-3", "medium", "Win 3 matches against bots", 2, 3, 40),
  m(4, "raids-2", "medium", "Clear 2 raids", 1, 2, 45),
  m(5, "raid-p3", "hard", "Clear any raid on Peril 3", 0, 1, 80),
];

for (const [name, size, rows] of [
  ["desktop", { width: 1440, height: 900 }, 3],
  ["phone", { width: 844, height: 390 }, 2],
] as const) {
  test(`town shows today's missions under the player card (${name})`, async ({ page }, info) => {
    await page.setViewportSize(size);
    await page.addInitScript((missions) => ((window as any).__missions = missions), MISSIONS);
    await openTown(page);
    const tracker = page.locator("#quest-tracker");
    await expect(tracker).toBeVisible();
    await expect(tracker.locator(".quest-count")).toHaveText("1/6");
    await expect(tracker.locator(".quest-alert")).toBeVisible();
    await expect(tracker.locator(".quest:not(.is-complete)")).toHaveCount(rows);
    // Closest to done first: 2/3 bots, then 1/2 raids.
    await expect(tracker.locator(".quest-text").first()).toHaveText("Win 3 matches against bots");

    const card = await box(page, "#account-profile");
    const panel = await box(page, "#quest-tracker");
    expect(panel.y).toBeGreaterThanOrEqual(card.y + card.height);
    expect(panel.x).toBeLessThan(card.x + 24);
    expect(panel.y + panel.height).toBeLessThan(size.height);
    // Nothing else in the town's corner sits over it.
    const clear = await page.evaluate(() => {
      const r = document.getElementById("quest-tracker")!.getBoundingClientRect();
      const points = [[r.left + 10, r.top + 10], [r.right - 10, r.top + 10], [r.left + 10, r.bottom - 10], [r.right - 10, r.bottom - 10]];
      return points.every(([x, y]) => document.getElementById("quest-tracker")!.contains(document.elementFromPoint(x, y)));
    });
    expect(clear).toBe(true);
    await snap(page, info, `quest-tracker-${name}`);

    await tracker.locator(".quest-open").click();
    await expect(page.locator("dialog[open]")).toBeVisible();
    await expect(tracker).toBeHidden();
  });
}

test("the quest tracker folds to its header and remembers it", async ({ page }) => {
  await page.addInitScript((missions) => ((window as any).__missions = missions), MISSIONS);
  await openTown(page);
  await page.click("#quest-tracker .quest-fold");
  await expect(page.locator("#quest-tracker .quest-list")).toHaveCount(0);
  await expect(page.locator("#quest-tracker .quest-title")).toBeVisible();
  await page.reload();
  await openTown(page);
  await expect(page.locator("#quest-tracker")).toHaveClass(/is-folded/);
});
