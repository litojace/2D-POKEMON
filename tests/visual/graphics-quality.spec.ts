import { expect, test } from "@playwright/test";
import { openTown, snap } from "./helpers";

// Settings → Graphics (Auto / High / Low) and Auto's own switch.
const canvas = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const c = document.querySelector("#town-canvas canvas") as HTMLCanvasElement;
    return { width: c.width, css: c.clientWidth };
  });

test("Auto switches a slow device to Low and remembers it", async ({ browser }) => {
  // This machine draws on the CPU at a few frames a second: a slow device.
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => ((window as any).__graphicsAuto = true));
    const errors = await openTown(page);
    const host = page.locator("#town-canvas");
    await expect(host).toHaveAttribute("data-graphics", "high");
    await expect(host).toHaveAttribute("data-graphics", "low", { timeout: 30_000 });
    expect(await page.evaluate(() => localStorage.getItem("ea-graphics-auto"))).toBe("low");
    // The canvas drops to 1× (one pixel per CSS pixel).
    await expect.poll(async () => { const c = await canvas(page); return c.width / c.css; }).toBeCloseTo(1, 1);
    // Next visit starts Low straight away.
    await openTown(page);
    await expect(page.locator("#town-canvas")).toHaveAttribute("data-graphics", "low", { timeout: 30_000 });
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("Settings picks the town's graphics; the town reloads at once", async ({ page }, info) => {
  await page.setViewportSize({ width: 1024, height: 700 });
  const errors = await openTown(page);
  await expect(page.locator("#town-canvas")).toHaveAttribute("data-graphics", "high");
  await page.evaluate(() => document.getElementById("settings")!.click());
  const choice = page.locator(".prefs-choice");
  await expect(choice).toBeVisible();
  await expect(choice.locator('[data-graphics="high"]')).toHaveAttribute("aria-checked", "true");
  await choice.locator('[data-graphics="low"]').click();
  await expect(choice.locator('[data-graphics="low"]')).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".prefs-graphics-note")).toContainText("30 fps");
  await snap(page, info, "settings-graphics-low");
  await expect(page.locator("#town-canvas")).toHaveAttribute("data-graphics", "low", { timeout: 30_000 });
  expect(await page.evaluate(() => localStorage.getItem("ea-graphics"))).toBe("low");
  await choice.locator('[data-graphics="high"]').click();
  await expect(page.locator("#town-canvas")).toHaveAttribute("data-graphics", "high", { timeout: 30_000 });
  expect(errors).toEqual([]);
});
