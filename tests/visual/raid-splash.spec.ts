import { test, expect } from "@playwright/test";
import { box, inside, openTown, openTownMenu, snap } from "./helpers";
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
  { width: 844, height: 280 },
]) {
  test(`boss splash art stays readable and controls work at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }, info) => {
    test.setTimeout(120000);
    const context = await browser.newContext({
      viewport,
      isMobile: viewport.width < 1000,
      hasTouch: viewport.width < 1000,
    });
    try {
      const page = await context.newPage();
      const errors = await openTown(page);
      await openTownMenu(page);
      await page.click('[data-action="raids"]');
      // The Hub may open directly on the last selected boss.
      if (await page.locator(".raid-boss-card").count()) {
        await expect(page.locator(".raid-card-art img")).toHaveCount(7);
        await page.click('[data-raid-boss="grumblecrag"]');
      }
      await expect(page.locator(".raid-roster-card")).toHaveCount(7);
      await expect(page.locator(".raid-roster-art img")).toHaveCount(7);
      for (const boss of [
        "grumblecrag",
        "tidewyrm",
        "gloomshade",
        "somnara",
        "prismatail",
        "emberwing",
        "storm-twins",
      ]) {
        if (boss !== "grumblecrag")
          await page.click(`.raid-roster-card[data-raid-boss="${boss}"]`);
        await expect(page.locator("[data-hub-practice]")).toHaveCount(6);
        const art = page.locator(".raid-showcase-splash > img");
        await expect(art).toBeVisible();
        await art.evaluate(async (img: HTMLImageElement) => {
          await img.decode();
        });
        expect(
          await art.evaluate((img: HTMLImageElement) => img.naturalWidth),
        ).toBeGreaterThanOrEqual(1200);
        const stage = await box(page, ".raid-showcase-splash");
        expect(inside(stage, { x: 0, y: 0, ...viewport })).toBe(true);
        if (viewport.width < 1000) {
          const actions = page
            .locator(".raid-hub-actions [data-raid-start]")
            .first();
          if (await actions.isVisible()) {
            const footer = await box(
              page,
              ".raid-hub-actions [data-raid-start]",
            );
            expect(stage.y + stage.height).toBeLessThanOrEqual(footer.y + 1);
          }
        }
        expect(
          await page
            .locator(".raid-boss-showcase")
            .evaluate((el) => el.scrollWidth - el.clientWidth),
        ).toBeLessThanOrEqual(1);
        expect(
          await art.evaluate((img: HTMLImageElement) => {
            if (getComputedStyle(img).objectFit === "contain") return 1;
            const r = img.getBoundingClientRect(),
              scale = Math.max(
                r.width / img.naturalWidth,
                r.height / img.naturalHeight,
              );
            return Math.min(
              r.width / (img.naturalWidth * scale),
              r.height / (img.naturalHeight * scale),
            );
          }),
        ).toBeGreaterThanOrEqual(0.9);
        await expect(page.locator(".splash-caption")).toHaveCount(0);
        if (boss === "grumblecrag" || boss === "storm-twins")
          await snap(
            page,
            info,
            `splash-${boss}-${viewport.width}x${viewport.height}`,
          );
      }
      await page.click('.raid-roster-card[data-raid-boss="grumblecrag"]');
      await expect(page.locator("[data-hub-practice]").first()).toBeEnabled();
      await page.click('[data-raid-tab="rewards"]');
      await expect(page.locator('[data-raid-tab="rewards"]')).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
