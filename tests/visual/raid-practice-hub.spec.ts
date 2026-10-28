import { expect, test } from "@playwright/test";
import { openTown, openTownMenu, box, pushUntilBattle } from "./helpers";
test("illustrated practice lives in Raid Hub and the court picker stays collapsed", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await openTown(page);
    await page.evaluate(() => {
      const w = window as any;
      w.__events = [];
      w.__emit = (event: string, data: any) => w.__events.push({ event, data });
      w.__room("raid", { boss: "grumblecrag" });
    });
    await openTownMenu(page);
    await page.click('[data-action="raids"]');
    await expect(page.locator("#raid-join-code")).toHaveCount(0);
    await page.click('[data-raid-boss="grumblecrag"]');
    await page.click('[data-raid-tab="attacks"]');
    const attack = page.locator("[data-hub-practice]").first();
    await expect(attack).toBeVisible();
    await expect(
      page.locator(".raid-attack-picture svg").first(),
    ).toBeVisible();
    await attack.click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as any).__events.some((e: any) => e.event === "raid-drill"),
        ),
      )
      .toBe(true);
    await page.evaluate(() => {
      const w = window as any;
      w.__snap.raid.drill = "charge";
      w.__snap.raid.drillStats = { hits: 0, dodges: 0 };
      w.__push();
    });
    await pushUntilBattle(page);
    await expect(page.locator(".raid-drill-options")).toBeHidden();
    const panel = await box(page, "#raid-drill");
    expect(panel.height).toBeLessThan(90);
    await page.click(".raid-drill-picker > summary");
    await expect(page.locator(".raid-drill-options")).toBeVisible();
    await page.evaluate(() => {
      const w = window as any;
      w.__snap.raid.drillStats.hits++;
      w.__push();
    });
    await expect(page.locator(".raid-drill-options")).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
