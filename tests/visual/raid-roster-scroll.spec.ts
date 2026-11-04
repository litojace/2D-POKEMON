import { expect, test } from "@playwright/test";
import { openHub, snap, hubMenu } from "./helpers";

// The Raid Hall (UI remodel step 5) replaced the Raid Hub's boss rail: a
// lower boss opens from its card, and "‹ Raid Hall" comes back to that card,
// in view and focused, with the panel itself never scrolling. What the old
// rail test checked (the place you were stays, the pictures stay) holds for
// the hall's grid.
for (const viewport of [
  { width: 844, height: 390 },
  { width: 844, height: 280 },
  { width: 1440, height: 900 },
]) {
  test(`lower bosses open and come back to their card ${viewport.width}x${viewport.height}`, async ({
    browser,
  }, info) => {
    const mobile = viewport.width < 1000;
    const context = await browser.newContext({
      viewport,
      isMobile: mobile,
      hasTouch: mobile,
    });
    try {
      const page = await context.newPage();
      const errors = await openHub(page);
      await page.evaluate(() => {
        const fetch = window.fetch.bind(window);
        window.fetch = async (input, init) =>
          String(input).includes("/api/raids")
            ? new Response(
                JSON.stringify({
                  clears: 10,
                  highestPeril: 3,
                  totalClears: 35,
                  bestSeconds: 60,
                  bosses: Object.fromEntries(
                    [
                      "grumblecrag",
                      "tidewyrm",
                      "gloomshade",
                      "somnara",
                      "prismatail",
                      "emberwing",
                      "storm-twins",
                    ].map((id) => [
                      id,
                      { clears: 5, highestPeril: 2, bestSeconds: 90 },
                    ]),
                  ),
                  titles: [],
                  cosmetics: [],
                  weekly: [],
                  earned: [],
                  loadout: {},
                }),
                { headers: { "Content-Type": "application/json" } },
              )
            : fetch(input, init);
      });
      await hubMenu(page, "raids");
      const room = page.locator(".rh-room");
      await expect(room.locator("[data-raid-card]")).toHaveCount(7);
      for (const boss of ["storm-twins", "emberwing", "prismatail"]) {
        const card = room.locator(`[data-raid-card="${boss}"]`);
        await card.scrollIntoViewIfNeeded();
        await card.click();
        await expect(room).toHaveAttribute("data-raid-boss", boss);
        await room.locator('[data-ui-raid-tab="rewards"]').click();
        await expect(room.locator(".rh-reward").first()).toBeVisible();
        await room.locator("[data-raid-back]").click();
        await expect(room).toHaveAttribute("data-raid-mode", "hall");
        const back = room.locator(`[data-raid-card="${boss}"]`);
        await expect(back).toBeFocused();
        await expect(back).toBeInViewport({ ratio: 0.5 });
        // Only the hall's body scrolls; the panel and the page never do.
        expect(
          await page.evaluate(() => ({
            panel: document.querySelector(".rh-room")!.scrollTop,
            page: document.scrollingElement!.scrollTop,
          })),
        ).toEqual({ panel: 0, page: 0 });
      }
      await snap(
        page,
        info,
        `raid-hall-return-${viewport.width}x${viewport.height}`,
      );
      // Another screen replaces Raids; nothing of it stays behind.
      await page.click(".rh-room .ui-close");
      await page.evaluate(() => document.getElementById("settings")!.click());
      await expect(page.locator(".settings-screen")).toBeVisible();
      await expect(page.locator(".rh-room")).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
