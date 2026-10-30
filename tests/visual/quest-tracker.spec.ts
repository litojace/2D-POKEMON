import { expect, test } from "@playwright/test";
import { box, openTown, snap } from "./helpers";

// The missions button under the player card in town: a gold "!" while some
// are left, a tap expands the whole list, its title opens the Missions screen.
const day = new Date().toISOString().slice(0, 10);
const m = (
  slot: number,
  id: string,
  tier: string,
  text: string,
  progress: number,
  target: number,
  coins: number,
) => ({
  day,
  slot,
  id,
  text,
  tier,
  progress,
  target,
  coins,
  done: progress >= target,
});
const MISSIONS = [
  m(0, "play-2", "easy", "Play 2 matches", 2, 2, 20),
  m(1, "skills-30", "easy", "Use 30 skills", 18, 30, 20),
  m(2, "win-1", "easy", "Win a match", 0, 1, 25),
  m(3, "bot-wins-3", "medium", "Win 3 matches against bots", 2, 3, 40),
  m(4, "raids-2", "medium", "Clear 2 raids", 1, 2, 45),
  m(5, "raid-p3", "hard", "Clear any raid on Peril 3", 0, 1, 80),
];
/** Every corner of the element is on top (nothing else covers it). */
const onTop = (page: import("@playwright/test").Page, selector: string) =>
  page.evaluate((selector) => {
    const el = document.querySelector(selector)!;
    const r = el.getBoundingClientRect();
    const points = [
      [r.left + 6, r.top + 6],
      [r.right - 6, r.top + 6],
      [r.left + 6, r.bottom - 6],
      [r.right - 6, r.bottom - 6],
    ];
    return points.every(([x, y]) =>
      el.contains(document.elementFromPoint(x, y)),
    );
  }, selector);

for (const [name, size] of [
  ["desktop", { width: 1440, height: 900 }],
  ["narrow-window", { width: 467, height: 555 }],
  ["phone", { width: 844, height: 390 }],
] as const) {
  test(`town has a missions button that expands today's list (${name})`, async ({
    page,
  }, info) => {
    await page.setViewportSize(size);
    await page.addInitScript(
      (missions) => ((window as any).__missions = missions),
      MISSIONS,
    );
    // Match the reported layout: an equipped avatar frame and a visible title.
    await page.route(/\/fake-api\.ts(?:\?|$)/, async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: `${await response.text()}
const missionFetch=window.fetch.bind(window);
window.fetch=(input,init)=>new URL(String(input),location.href).pathname==='/api/raids'
 ? Promise.resolve(Response.json({v:1,stats:{},unlocked:[],cosmetics:['conqueror'],earned:['conqueror'],loadout:{frame:'conqueror'}}))
 : missionFetch(input,init);`,
      });
    });
    await openTown(page);
    const tracker = page.locator("#quest-tracker");
    const toggle = tracker.locator(".quest-toggle");
    await expect(toggle).toBeVisible();
    await expect(tracker.locator(".quest-alert")).toBeVisible();
    await expect(tracker.locator(".quest-panel")).toHaveCount(0);
    const card = await box(page, "#account-profile");
    const button = await box(page, "#quest-tracker .quest-toggle");
    expect(button.y).toBeGreaterThanOrEqual(card.y + card.height + 20);
    expect(Math.abs(button.x - card.x)).toBeLessThanOrEqual(1);
    const alert = await box(page, "#quest-tracker .quest-alert");
    expect(alert.y).toBeGreaterThan(card.y + card.height);
    expect(await onTop(page, "#quest-tracker .quest-toggle")).toBe(true);
    await snap(page, info, `quest-button-${name}`);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(tracker.locator(".quest")).toHaveCount(6);
    await expect(tracker.locator(".quest-count")).toHaveText("1/6");
    // What's left first (closest to done), the finished one last.
    await expect(tracker.locator(".quest-text").first()).toHaveText(
      "Win 3 matches against bots",
    );
    await expect(tracker.locator(".quest").last()).toHaveClass(/is-done/);
    const panel = await box(page, "#quest-tracker .quest-panel");
    expect(panel.y + panel.height).toBeLessThanOrEqual(size.height);
    expect(await onTop(page, "#quest-tracker .quest-panel")).toBe(true);
    // The opening animation finishes first (slow here: the town renders on the CPU).
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((a) => (a as CSSAnimation).animationName === "quest-pop")
          .map((a) => a.finished),
      ),
    );
    await snap(page, info, `quest-list-${name}`);

    // A tap elsewhere folds it back.
    await page.mouse.click(size.width - 6, size.height / 2);
    await expect(tracker.locator(".quest-panel")).toHaveCount(0);

    // The title opens the full Missions screen.
    await toggle.click();
    await tracker.locator(".quest-title").click();
    await expect(page.locator("dialog[open]")).toBeVisible();
    await expect(tracker).toBeHidden();
  });
}

test("missions follow a resized player card and viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 700 });
  await page.addInitScript(
    (missions) => ((window as any).__missions = missions),
    MISSIONS,
  );
  await openTown(page);
  const gap = () =>
    page.evaluate(() => {
      const card = document
        .querySelector("#account-profile")!
        .getBoundingClientRect();
      const tracker = document
        .querySelector("#quest-tracker")!
        .getBoundingClientRect();
      return tracker.top - card.bottom;
    });
  await expect.poll(gap).toBeGreaterThanOrEqual(20);
  // Titles, fonts or appearance changes can grow the card without a window resize.
  await page
    .locator("#account-profile")
    .evaluate((el) => (el.style.minHeight = "120px"));
  await expect.poll(gap).toBeGreaterThanOrEqual(20);
  await expect.poll(gap).toBeLessThan(22);
  await page
    .locator("#account-profile")
    .evaluate((el) => el.style.removeProperty("min-height"));
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(gap).toBeGreaterThanOrEqual(20);
  await expect.poll(gap).toBeLessThan(22);
  expect(await onTop(page, "#quest-tracker .quest-toggle")).toBe(true);
});
