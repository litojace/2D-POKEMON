import { expect, test } from "@playwright/test";
import { openHub, pushUntilBattle, hubMenu } from "./helpers";

// After a raid the hub comes back: closing Raids shows the Lobby, and its
// buttons work.
test("the hub comes back after leaving a raid and closing Raids", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await openHub(page);
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
  await hubMenu(page, "raids");
  await page.click('[data-raid-card="prismatail"]');
  await page.evaluate(() => (window as any).__room("raid", { boss: "prismatail" }));
  await page.click('[data-raid-start="solo"]');
  await pushUntilBattle(page);
  await page.click("#battle-menu");
  await page.click("#exit-room");
  // Back to the boss's page, inside the Lobby.
  await expect(
    page.locator('.rh-room[data-raid-mode="boss"][data-raid-boss="prismatail"]'),
  ).toBeVisible();
  await page.waitForTimeout(1200);
  await page.click(".rh-room .ui-close");
  await expect(page.locator(".rh-room")).toHaveCount(0);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page.locator("#lobby-play")).toBeVisible();
  // The hub still answers: the mode menu opens.
  await page.click("#lobby-mode");
  await expect(page.locator("#lobby-mode-menu")).toBeVisible();
});
