import { expect, test } from "@playwright/test";
import { box, inside, openTown, snap } from "./helpers";

const SCREENS = [
  { name: "desktop", viewport: { width: 1440, height: 900 }, touch: false },
  { name: "phone", viewport: { width: 844, height: 390 }, touch: true },
];

for (const s of SCREENS)
  test.describe(s.name, () => {
    test.use({ viewport: s.viewport, hasTouch: s.touch, isMobile: s.touch });

    test("Settings fits the screen with every action reachable", async ({ page }, info) => {
      const errors = await openTown(page);
      await page.evaluate(() => document.getElementById("settings")!.click());
      const dialog = page.locator("#dialog");
      await expect(dialog.locator(".settings-screen")).toBeVisible();
      const screen = { x: 0, y: 0, ...s.viewport };
      expect(inside(await box(page, "#dialog"), screen)).toBe(true);
      for (const id of ["#open-controls", "#settings-report", "#settings-credits"]) {
        await expect(dialog.locator(id)).toBeVisible();
        expect(inside(await box(page, id), screen)).toBe(true);
      }
      // Sliders say their value.
      await expect(dialog.locator('output[data-pref-for="music"]')).toHaveText(/^\d+%$/);
      await snap(page, info, `settings-${s.name}`);
      await dialog.locator("#settings-credits").click();
      await expect(dialog.locator(".credits-screen")).toBeVisible();
      await snap(page, info, `credits-${s.name}`);
      await dialog.locator("#credits-back").click();
      await expect(dialog.locator(".settings-screen")).toBeVisible();
      expect(errors).toEqual([]);
    });
  });
