import type { Page } from "@playwright/test";

/**
 * Where a boss's framing point lands (its body on a tall stage, its face on
 * a phone), as fractions of the stage; and how many stage heights tall the
 * painting is drawn (more than one on a phone: zoomed in on the face).
 */
export async function bossFraming(page: Page) {
  return page.locator(".rh-stage").evaluate((stage) => {
    const img = stage.querySelector<HTMLImageElement>(".rh-poster img")!;
    const s = stage.getBoundingClientRect(),
      r = img.getBoundingClientRect(),
      css = getComputedStyle(img);
    const px = Number(css.getPropertyValue("--px")),
      py = Number(css.getPropertyValue("--py"));
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
