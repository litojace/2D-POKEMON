import { expect, test } from "@playwright/test";
import { openHub, openPlayPanel, openPlaza, pushUntilBattle, snap } from "./helpers";

// Settings → Graphics (Auto / High / Low) and Auto's own switch.
const canvas = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const c = document.querySelector(".plaza-layer #pz-cv") as HTMLCanvasElement;
    return { width: c.width, css: c.clientWidth };
  });

test("Auto switches a slow device to Low and remembers it", async ({ browser }) => {
  // This machine draws on the CPU at a few frames a second: a slow device.
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => ((window as any).__graphicsAuto = true));
    const errors = await openPlaza(page);
    const host = page.locator(".plaza-layer");
    await expect(host).toHaveAttribute("data-graphics", "high");
    await expect(host).toHaveAttribute("data-graphics", "low", { timeout: 30_000 });
    expect(await page.evaluate(() => localStorage.getItem("ea-graphics-auto"))).toBe("low");
    // The canvas drops to 1× (one pixel per CSS pixel).
    await expect.poll(async () => { const c = await canvas(page); return c.width / c.css; }).toBeCloseTo(1, 1);
    // Next visit starts Low straight away.
    await page.reload();
    await page.waitForFunction(() => !!(window as any).__sock);
    await expect.poll(async () => { await page.evaluate(() => (window as any).__sock.fire("connect")); return page.locator("#lobby-play").isVisible(); }, { timeout: 30_000 }).toBe(true);
    await page.click('#hub-scenes [data-hub-scene="plaza"]');
    await expect(page.locator(".plaza-layer")).toHaveAttribute("data-graphics", "low");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("Settings picks the Plaza's graphics; the Plaza reloads at once", async ({ page }, info) => {
  await page.setViewportSize({ width: 1024, height: 700 });
  const errors = await openPlaza(page);
  await expect(page.locator(".plaza-layer")).toHaveAttribute("data-graphics", "high");
  await page.evaluate(() => document.getElementById("settings")!.click());
  const choice = page.locator(".prefs-choice");
  await expect(choice).toBeVisible();
  await expect(choice.locator('[data-graphics="high"]')).toHaveAttribute("aria-checked", "true");
  await choice.locator('[data-graphics="low"]').click();
  await expect(choice.locator('[data-graphics="low"]')).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".prefs-graphics-note")).toContainText("30 fps");
  await snap(page, info, "settings-graphics-low");
  await expect(page.locator(".plaza-layer")).toHaveAttribute("data-graphics", "low", { timeout: 30_000 });
  expect(await page.evaluate(() => localStorage.getItem("ea-graphics"))).toBe("low");
  await choice.locator('[data-graphics="high"]').click();
  await expect(page.locator(".plaza-layer")).toHaveAttribute("data-graphics", "high", { timeout: 30_000 });
  expect(errors).toEqual([]);
});

test("Low draws an Android battle at 1.5×, High at 2×, switching mid-battle", async ({ browser }, info) => {
  // An Android phone (no iPhone user agent) with a 3× screen.
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  try {
    const page = await context.newPage();
    const errors = await openHub(page);
    await page.evaluate(() => (window as any).__room("practice"));
    await openPlayPanel(page);
    await page.click("#practice");
    await pushUntilBattle(page);
    const battle = () =>
      page.evaluate(() => {
        const c = document.querySelector("#game canvas") as HTMLCanvasElement;
        const box = document.getElementById("game")!;
        return { density: c.width / c.clientWidth, css: c.clientWidth, frame: box.clientWidth };
      });
    const density = async () => (await battle()).density;
    // High (the harness's default): the screen's density, capped at 2.
    await expect.poll(density).toBeCloseTo(2, 1);
    const high = await battle();
    // Low, picked in the middle of the battle: 1.5 from the next frames on.
    await page.evaluate(() => localStorage.setItem("ea-graphics", "low"));
    await expect.poll(density, { timeout: 20_000 }).toBeCloseTo(1.5, 1);
    const low = await battle();
    // Still fills the same box: only the pixels per CSS pixel change.
    expect(low.css).toBe(high.css);
    expect(Math.abs(low.css - low.frame)).toBeLessThanOrEqual(1);
    await snap(page, info, "battle-low-android");
    // And back to High.
    await page.evaluate(() => localStorage.setItem("ea-graphics", "high"));
    await expect.poll(density, { timeout: 20_000 }).toBeCloseTo(2, 1);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
