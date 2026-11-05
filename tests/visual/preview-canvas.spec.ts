import { expect, test } from "@playwright/test";
import { openLobby } from "./helpers";
import { shopServer } from "./shop-server";

// WebKit can start Scene.create before Game.isRunning, after the host's
// only initial ResizeObserver notification. Check the very first model,
// before changing a skin could accidentally repair its distorted canvas.
test.describe.configure({ mode: "parallel" });
for (const size of [
  { width: 1440, height: 900, density: 2, phone: false },
  { width: 844, height: 390, density: 3, phone: true },
]) {
  for (const mode of ["shop", "wardrobe"] as const) {
    test(`first ${mode} preview preserves shape and detail at ${size.width}x${size.height}`, async ({
      browser,
    }, info) => {
      test.setTimeout(120_000);
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: size.density,
        isMobile: size.phone,
        hasTouch: size.phone,
      });
      try {
        const page = await context.newPage();
        // Cover both the original and an equipped Mythical on first open.
        await shopServer(page, { cleared: mode === "shop" ? ["voltkit"] : [] });
        const errors = await openLobby(page);
        await page.click(`.lobby-rail [data-lobby-action="${mode}"]`);
        const stage = page.locator(".fit-stage .shop-live-stage");
        await expect(stage).toHaveClass(/is-ready/, { timeout: 60_000 });
        await expect(stage).not.toHaveAttribute("aria-busy", "true");
        const pixels = await stage
          .locator(":scope > canvas")
          .evaluate((canvas: HTMLCanvasElement) => {
            const shown = canvas.getBoundingClientRect();
            return {
              width: canvas.width,
              height: canvas.height,
              shownWidth: shown.width,
              shownHeight: shown.height,
            };
          });
        const densityX = pixels.width / pixels.shownWidth;
        const densityY = pixels.height / pixels.shownHeight;
        const details = JSON.stringify(pixels);
        // A wide buffer stretched into a tall host compresses the fighter.
        expect(Math.abs(densityX / densityY - 1), details).toBeLessThan(0.01);
        // Matching aspect alone isn't enough: a tiny canvas is still blurry.
        expect(Math.min(densityX, densityY), details).toBeGreaterThan(1.5);
        await info.attach("preview-canvas.json", {
          body: details,
          contentType: "application/json",
        });
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
  }
}
