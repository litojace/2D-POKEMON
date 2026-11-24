import type { Page } from "@playwright/test";

/**
 * Where the source painting's face lands, as fractions of the stage;
 * and the painting's height relative to the stage (the effective zoom).
 */
export async function bossFraming(page: Page) {
  return page.locator(".rh-stage").evaluate((stage) => {
    const img = stage.querySelector<HTMLImageElement>(".rh-poster img")!;
    const s = stage.getBoundingClientRect(),
      r = img.getBoundingClientRect(),
      css = getComputedStyle(img);
    const px = Number(css.getPropertyValue("--fx")),
      py = Number(css.getPropertyValue("--fy"));
    return {
      x: (r.left + px * r.width - s.left) / s.width,
      y: (r.top + py * r.height - s.top) / s.height,
      zoom: r.height / s.height,
      ratio: r.width / r.height,
      // Inside the stage's 1 px border.
      covers:
        r.left <= s.left + 1.5 &&
        r.top <= s.top + 1.5 &&
        r.right >= s.right - 1.5 &&
        r.bottom >= s.bottom - 1.5,
    };
  });
}
