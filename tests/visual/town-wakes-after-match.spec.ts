import { expect, test, type Page } from "@playwright/test";
import { openTown, openTownMenu, pushUntilBattle } from "./helpers";

// After a match the town comes back alive: it may sleep while a panel
// covers it, but wakes once nothing does, and you can walk again.
const townState = (page: Page) =>
  page.evaluate(() => ({
    frozen: document.getElementById("town-canvas")?.dataset.frozen,
    visible: document.body.classList.contains("town-active"),
  }));
async function walks(page: Page) {
  // The town client sends its walking direction to the server.
  await page.evaluate(() => {
    const w = window as any;
    w.__events = [];
    const sim = w.__emit; // the harness's own town simulation
    w.__emit = (event: string, data: unknown) => {
      w.__events.push({ event, data });
      return sim?.(event, data);
    };
  });
  await page.keyboard.down("KeyD");
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          (window as any).__events.some((e: any) => e.event === "town-input" && e.data?.dx > 0),
        ),
      { timeout: 15_000 },
    )
    .toBe(true);
  await page.keyboard.up("KeyD");
}

test("the town wakes after leaving a raid and closing the Raid Hub", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await openTown(page);
  await page.evaluate(() => {
    const fetch = window.fetch.bind(window);
    window.fetch = (input, init) =>
      String(input).includes("/api/raids")
        ? Promise.resolve(
            Response.json({
              clears: 1,
              highestPeril: 1,
              bosses: { grumblecrag: { clears: 1, highestPeril: 1 } },
              titles: [],
              cosmetics: [],
              earned: [],
              weekly: [],
              loadout: {},
            }),
          )
        : fetch(input, init);
  });
  await openTownMenu(page);
  await page.click('[data-action="raids"]');
  await page.click('.raid-roster-card[data-raid-boss="prismatail"]');
  await page.evaluate(() => (window as any).__room("raid", { boss: "prismatail" }));
  await page.click('[data-raid-start="solo"]');
  await pushUntilBattle(page);
  await page.click("#battle-menu");
  await page.click("#exit-room");
  // Back to the Raid Hub over the town: the town may sleep under it.
  await expect(page.locator("dialog[open] .raid-boss-page")).toBeVisible();
  await page.waitForTimeout(1200);
  await page.click("#close-dialog");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect.poll(async () => (await townState(page)).frozen, { timeout: 5000 }).not.toBe("true");
  expect((await townState(page)).visible).toBe(true);
  await walks(page);
});
