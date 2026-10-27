import { expect, test } from "@playwright/test";
import {
  box,
  inside,
  openTown,
  openTownMenu,
  pushUntilBattle,
  snap,
} from "./helpers";
for (const size of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
  { width: 844, height: 280 },
])
  test(`raid guide keeps three steps readable and start reachable at ${size.width}x${size.height}`, async ({
    browser,
  }, info) => {
    const mobile = size.width === 844,
      context = await browser.newContext({
        viewport: size,
        isMobile: mobile,
        hasTouch: mobile,
      });
    try {
      const page = await context.newPage(),
        errors = await openTown(page);
      await page.evaluate(() =>
        (window as any).__room("raid", { boss: "prismatail" }),
      );
      await openTownMenu(page);
      await page.click(".town-play");
      await page.click("#play-create");
      await pushUntilBattle(page);
      for (const boss of [
        "prismatail",
        "emberwing",
        "grumblecrag",
        "tidewyrm",
        "gloomshade",
        "somnara",
        "storm-twins",
      ]) {
        await page.evaluate((boss) => {
          const w = window as any;
          w.__room("raid", { boss });
          w.__snap.phase = "briefing";
          w.__push();
        }, boss);
        await expect(page.locator(".raid-guide-steps > li")).toHaveCount(3);
        await expect(page.locator(".raid-guide-goal")).toBeVisible();
        await expect(page.locator("#raid-instructions")).toBeEnabled();
        const card = await box(page, ".raid-briefing"),
          start = await box(page, "#raid-instructions");
        expect(inside(start, card)).toBe(true);
        expect(start.y + start.height).toBeLessThanOrEqual(size.height + 1);
        for (const title of await page
          .locator(".raid-guide-step-heading h3")
          .allTextContents())
          expect(title.length).toBeGreaterThan(5);
        if (["prismatail", "emberwing"].includes(boss)) {
          await page.locator(".raid-briefing").evaluate(async (el) => {
            await Promise.all(
              el.getAnimations().map((a) => a.finished.catch(() => {})),
            );
          });
          await snap(
            page,
            info,
            `raid-guide-${boss}-${size.width}x${size.height}`,
          );
        }
      }
      await page.locator("#raid-briefing-extra summary").click();
      await page
        .locator(".raid-briefing-body")
        .evaluate((e) => (e.scrollTop = e.scrollHeight));
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.instructionsReady = ["me"];
        w.__push();
      });
      await expect(page.locator("#raid-briefing-extra")).toHaveAttribute(
        "open",
        "",
      );
      await expect(page.locator("#raid-instructions")).toBeDisabled();
      expect(
        inside(
          await box(page, "#raid-instructions"),
          await box(page, ".raid-briefing"),
        ),
      ).toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
