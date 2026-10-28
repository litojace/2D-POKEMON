import { expect, test } from "@playwright/test";
import { openTown, openTownMenu, snap } from "./helpers";

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
      const errors = await openTown(page);
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
      await openTownMenu(page);
      await page.click('#town-menu-items [data-action="raids"]');
      await expect(page.locator(".raid-roster-card")).toHaveCount(7);
      await expect(
        page.locator(".raid-week, .raid-today, #raid-daily"),
      ).toHaveCount(0);
      await expect(page.locator(".raid-hub")).not.toContainText(
        "Raid of the Day",
      );
      await snap(
        page,
        info,
        `regular-raid-hub-${viewport.width}x${viewport.height}`,
      );
      await page.click('[data-raid-boss="grumblecrag"]');
      await expect(page.locator('[data-raid-start="room"]')).toBeVisible();
      await expect(page.locator('[data-raid-start="solo"]')).toBeVisible();
      await page.click("#raid-tab-rewards");
      await expect(page.locator(".raid-hub")).not.toContainText(
        "Today's board",
      );
      await page.click("#close-dialog");
      await openTownMenu(page);
      await page.click('#town-menu-items [data-action="adventure"]');
      await expect(page.locator("[data-adventure-tab]")).toHaveCount(3);
      await expect(page.locator(".adventure")).not.toContainText("Boss Rush");
      expect(
        await page.evaluate(async () => {
          const { TOWN_SPOTS } = await import("/rooms.ts");
          return TOWN_SPOTS.some((s: any) => s.id === "boss-rush");
        }),
      ).toBe(false);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
