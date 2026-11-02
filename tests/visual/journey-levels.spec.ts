import { expect, test } from "@playwright/test";
import { openTown, openTownMenu, snap } from "./helpers";

// Levels 1–100, the Daily Spark and the 30-tier season (migration 035) in the
// Adventure dialog, on a desktop and on phones in landscape.
const journey = {
  xp: 61550 + 1200, // level 60, a little into the next level
  recent: [],
  season: {
    id: "2026-12",
    xp: 14600, // tier 12 of 30
    week: "2026-11-30",
    goals: { play: 3, skills: 50, raids: 1, arcade: 0 },
    completed: ["skills"],
    tiers: 30,
    tierXp: 1200,
    itemTiers: [5, 12, 20, 30],
  },
  spark: { day: "2026-12-01", used: 120, limit: 500 },
  unlocked: [],
};

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
  { width: 700, height: 390 },
]) {
  test(`Adventure shows levels to 100, the Daily Spark and 30 season tiers at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }, info) => {
    const phone = viewport.width < 1000;
    const context = await browser.newContext({
      viewport,
      isMobile: phone,
      hasTouch: phone,
    });
    try {
      const page = await context.newPage();
      const errors = await openTown(page);
      await page.evaluate((j) => {
        const fetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
          const response = await fetch(input, init);
          if (!String(input).includes("/api/economy")) return response;
          const body = await response.json();
          return new Response(JSON.stringify({ ...body, journey: j }), {
            headers: { "Content-Type": "application/json" },
          });
        };
      }, journey);
      await openTownMenu(page);
      await page.click('#town-menu-items [data-action="adventure"]');
      const dialog = page.locator("#dialog");
      await expect(dialog.locator(".journey-level-badge b")).toHaveText("60");
      await expect(dialog.locator(".journey-spark")).toContainText(
        "The next 380 XP today count double",
      );
      await expect(dialog).toContainText("100 coins from level 50 to 100");
      await expect(dialog).toContainText("Element Master");
      await snap(
        page,
        info,
        `journey-levels-${viewport.width}x${viewport.height}`,
      );

      await dialog.locator('[data-adventure-tab="season"]').click();
      await expect(dialog.locator(".season-tier")).toHaveCount(30);
      await expect(dialog.locator(".season-banner strong")).toContainText(
        "12 / 30 tiers",
      );
      await expect(dialog.locator(".journey-spark")).toBeVisible();
      await snap(
        page,
        info,
        `journey-season-${viewport.width}x${viewport.height}`,
      );

      // Nothing in the dialog is wider than the dialog, and the Spark text is
      // not cut off.
      const fit = await page.evaluate(() => {
        const box = document.querySelector("#dialog")!.getBoundingClientRect();
        const spark = document.querySelector<HTMLElement>(".journey-spark")!;
        const r = spark.getBoundingClientRect();
        return {
          inside: r.left >= box.left - 0.5 && r.right <= box.right + 0.5,
          sparkFits: spark.scrollWidth <= spark.clientWidth + 1,
          pageFits:
            document.documentElement.scrollWidth <= window.innerWidth + 1,
        };
      });
      expect(fit).toEqual({ inside: true, sparkFits: true, pageFits: true });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
