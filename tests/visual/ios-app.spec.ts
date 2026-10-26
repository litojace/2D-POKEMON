import { expect, test } from "@playwright/test";
import { openTown, openTownMenu, pushUntilBattle, snap } from "./helpers";

const iphone = {
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
};
async function installed(page: import("@playwright/test").Page) {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "standalone", {
      value: true,
      configurable: true,
    }),
  );
}
test("iOS Home Screen resumes Town and releases the old battle canvas on return", async ({
  browser,
}, info) => {
  const context = await browser.newContext(iphone),
    page = await context.newPage();
  try {
    await installed(page);
    const errors = await openTown(page);
    await expect(page.locator(".town-canvas canvas")).toBeVisible();
    expect(
      await page
        .locator(".town-canvas canvas")
        .evaluate((c: HTMLCanvasElement) => c.width),
    ).toBe(1266);
    await page.evaluate(() => {
      (window as any).__keepApp = true;
      dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
      dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });
    await openTownMenu(page);
    await expect(page.locator(".town-play")).toBeVisible();
    await page.evaluate(() => (window as any).__room("practice"));
    await page.click(".town-play");
    await page.click("#practice");
    await pushUntilBattle(page);
    await expect(page.locator("#game canvas")).toHaveCount(1);
    await page.evaluate(() => {
      const w = window as any;
      delete w.__snap.practice;
      w.__snap.phase = "finished";
      w.__snap.winner = "me";
      w.__snap.vsBot = true;
      w.__push();
    });
    await page.locator("#return").tap();
    await expect(page.locator("#town-menu-toggle")).toBeVisible();
    await expect(page.locator("#game canvas")).toHaveCount(0);
    await expect(
      page.locator("#battle .player-nameplate,#battle .enemy-bearing"),
    ).toHaveCount(0);
    await expect(page.locator(".town-canvas canvas")).toBeVisible();
    await expect(page.locator("#app-boot,#renderer-recovery")).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__keepApp)).toBe(true);
    await snap(page, info, "ios-home-screen-town");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("a lost drawing context shows recovery and restores without navigation", async ({
  browser,
  browserName,
}, info) => {
  test.skip(
    browserName !== "chromium",
    "GPU loss is injected through Chromium's WebGL extension.",
  );
  const context = await browser.newContext(iphone),
    page = await context.newPage();
  try {
    await installed(page);
    const errors = await openTown(page);
    await page.waitForTimeout(1500);
    const supported = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        ".town-canvas canvas",
      )!;
      const gl = canvas.getContext("webgl") ?? canvas.getContext("webgl2");
      const ext = gl?.getExtension("WEBGL_lose_context");
      (window as any).__lostGL = ext;
      return !!ext;
    });
    expect(supported).toBe(true);
    await page.evaluate(() => (window as any).__lostGL.loseContext());
    await expect(page.locator("#renderer-recovery")).toBeVisible();
    await page.evaluate(() => (window as any).__lostGL.restoreContext());
    await expect(page.locator("#renderer-recovery")).toHaveCount(0);
    await openTownMenu(page);
    await expect(page.locator(".town-play")).toBeVisible();
    await snap(page, info, "ios-drawing-context-restored");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
