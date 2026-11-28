import { expect, test } from "@playwright/test";
import { openHub, skipTour, snap } from "./helpers";
import { playersLook } from "./players-look";

// How to play's pictures in the look players have
// (themes/poster/help-pictures.css): an ink court with a faint grid, no
// glow on the buttons or the EX mark, square flat meters. They were a navy
// court with a blue glow and rounded gradient meters.
for (const size of [
  { width: 844, height: 390 },
  { width: 667, height: 375 },
])
  test(`How to play's pictures in Poster at ${size.width}x${size.height}`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: size,
      isMobile: true,
      hasTouch: true,
    });
    try {
      await playersLook(context);
      const page = await context.newPage();
      await skipTour(page);
      const errors = await openHub(page);
      await page.locator("#home-settings").click();
      await page.locator('[data-settings-tab="help"]').click();
      await page.locator("#settings-howto").click();
      await page
        .locator('.htp-tabs [role="tab"]', { hasText: "Battle" })
        .click();
      await expect(page.locator(".htp .guide-charge.is-ex")).toBeVisible();
      const look = await page.evaluate(() => {
        const cs = (s: string) =>
          getComputedStyle(document.querySelector(`.htp ${s}`)!);
        return {
          court: cs(".guide-scene").backgroundColor,
          glows: [
            cs(".guide-move").boxShadow,
            cs(".guide-ultimate").boxShadow,
            cs(".guide-charge.is-ex .guide-move").boxShadow,
            cs(".guide-ex").textShadow,
          ],
          meter: [
            cs(".guide-charge-bar").borderTopLeftRadius,
            cs(".guide-charge-bar i").borderTopLeftRadius,
            cs(".guide-charge.is-ult .guide-charge-bar i").backgroundImage,
            cs(".guide-charge.is-ult .guide-charge-bar i").backgroundColor,
          ],
        };
      });
      expect(look.court).toBe("rgb(21, 21, 24)");
      expect(look.glows).toEqual(["none", "none", "none", "none"]);
      expect(look.meter).toEqual(["0px", "0px", "none", "rgb(255, 214, 91)"]);
      await snap(
        page,
        info,
        `help-pictures-poster-${size.width}x${size.height}`,
      );
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
