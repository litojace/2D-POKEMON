import { expect, test } from "@playwright/test";
import { box, openTown, openTownMenu, pushUntilBattle } from "./helpers";

test("one corner gear opens Settings and the separate Practice panel on a short phone", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 280 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await openTown(page);
    await page.evaluate(() => (window as any).__room("practice"));
    await openTownMenu(page);
    await page.click(".town-play");
    await page.click("#practice");
    await pushUntilBattle(page);
    await expect(page.locator("#mobile-fullscreen")).toBeHidden();
    await expect(page.locator("#practice-settings > summary")).toBeHidden();
    const gear = await box(page, "#battle-menu");
    expect(gear.x).toBeGreaterThan(790);
    expect(gear.y).toBeLessThanOrEqual(8);
    expect(gear.width).toBeGreaterThanOrEqual(44);
    await page.click("#battle-menu");
    await expect(page.locator("#settings-fullscreen")).toHaveCount(0);
    await expect(page.locator("#exit-room")).toHaveCount(0);
    await page.click("#settings-practice");
    await expect(page.locator(".practice-panel")).toBeVisible();
    await expect(page.locator("#practice-exit")).toBeVisible();
    await page.click("#practice-close");
    await expect(page.locator(".practice-panel")).toBeHidden();
    await page.click("#battle-menu");
    await page.click("#settings-practice");
    await page.click("#practice-exit");
    await expect(page.locator("#town-menu-toggle")).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("desktop uses one round corner gear with the clock directly below it", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    isMobile: false,
    hasTouch: false,
  });
  try {
    const page = await context.newPage();
    const errors = await openTown(page);
    await page.evaluate(() =>
      (window as any).__room("raid", { boss: "prismatail" }),
    );
    await openTownMenu(page);
    await page.click(".town-play");
    await page.click("#play-create");
    await pushUntilBattle(page);
    const gear = await box(page, "#battle-menu"),
      clock = await box(page, ".raid-elapsed"),
      court = await box(page, "#game"),
      mechanics = await box(page, "#raid-prism-controls");
    expect(gear.width).toBe(44);
    expect(gear.height).toBe(44);
    expect(clock.y).toBeGreaterThan(gear.y + gear.height);
    expect(
      Math.abs(clock.x + clock.width / 2 - gear.x - gear.width / 2),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(mechanics.x + mechanics.width - court.x - court.width),
    ).toBeLessThanOrEqual(10);
    await expect(page.locator(".topbar")).toBeHidden();
    await page.click("#battle-menu");
    await expect(page.locator("#settings-fullscreen")).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
