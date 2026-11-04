import { expect, test } from "@playwright/test";
import { openHub, snap, hubMenu } from "./helpers";

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
]) {
  test(`ordinary raids stay available without retired modes at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport,
      isMobile: viewport.width < 1000,
      hasTouch: viewport.width < 1000,
    });
    try {
      const page = await context.newPage();
      const errors = await openHub(page);
      await page.evaluate(() => {
        const fetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
          if (String(input).includes("/api/raids"))
            return new Response(
              JSON.stringify({
                clears: 1,
                highestPeril: 1,
                bestSeconds: 60,
                titles: [],
                cosmetics: [],
                weekly: [],
                earned: [],
                // Old stored fields must not revive removed UI.
                today: { day: "2026-10-28", cleared: true, board: [] },
                dailyClears: ["2026-10-28"],
              }),
              { headers: { "Content-Type": "application/json" } },
            );
          return fetch(input, init);
        };
      });
      await hubMenu(page, "raids");
      // The Raid Hall (UI remodel step 5): every boss, nothing retired.
      await expect(page.locator(".rh-room [data-raid-card]")).toHaveCount(7);
      await expect(
        page.locator(".raid-week, .raid-today, #raid-daily"),
      ).toHaveCount(0);
      await expect(page.locator(".rh-room")).not.toContainText(
        "Raid of the Day",
      );
      await snap(
        page,
        info,
        `regular-raid-hub-${viewport.width}x${viewport.height}`,
      );
      await page.click('[data-raid-card="grumblecrag"]');
      await expect(page.locator('[data-raid-start="solo"]')).toBeVisible();
      await expect(page.locator('[data-ui-raid-play="party"]')).toBeVisible();
      await page.click('[data-ui-raid-play="party"]');
      await expect(page.locator('[data-raid-start="party"]')).toBeVisible();
      await page.click('[data-ui-raid-tab="rewards"]');
      await expect(page.locator(".rh-room")).not.toContainText("Today's board");
      await page.click(".rh-room .ui-close");
      await hubMenu(page, "journey");
      await expect(page.locator("[data-ui-jtab]")).toHaveCount(3);
      await expect(page.locator(".journey-room")).not.toContainText(
        "Boss Rush",
      );
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
