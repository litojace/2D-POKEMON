import { expect, test } from "@playwright/test";
import { openHub, snap, hubMenu } from "./helpers";

// The illustrated skill icons sit inside their rows and the large skill card
// at every size (they once spilled out of the shorter phone tiles). The
// roster's fighter detail, UI remodel step 3.
for (const size of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
  { width: 844, height: 280 },
]) {
  test(`roster skill icons fit their rows at ${size.width}x${size.height}`, async ({
    browser,
  }, info) => {
    const mobile = size.width < 1000;
    const context = await browser.newContext({
      viewport: size,
      isMobile: mobile,
      hasTouch: mobile,
    });
    try {
      const page = await context.newPage();
      await openHub(page);
      await hubMenu(page, "fighters");
      await page.click("[data-roster-details]");
      await expect(
        page.locator(".roster-stage .fighter-rig-stage"),
      ).toHaveClass(/is-ready/);
      await expect(page.locator(".roster-skill")).toHaveCount(5);
      const fits = await page.evaluate(() => {
        const out: string[] = [];
        const inside = (a: DOMRect, b: DOMRect) =>
          a.left >= b.left - 0.5 &&
          a.right <= b.right + 0.5 &&
          a.top >= b.top - 0.5 &&
          a.bottom <= b.bottom + 0.5;
        for (const art of document.querySelectorAll<SVGElement>(
          ".roster-skill .skill-art, .roster-skill-art .skill-art",
        )) {
          const box = art.getBoundingClientRect();
          if (!box.width) continue;
          const holder = art
            .closest(".roster-skill, .roster-skill-art")!
            .getBoundingClientRect();
          if (!inside(box, holder))
            out.push(
              `${art.dataset.skillArt}: ${Math.round(box.height)} in ${Math.round(holder.height)}`,
            );
          if (box.width < 22)
            out.push(
              `${art.dataset.skillArt}: too small (${Math.round(box.width)}px)`,
            );
        }
        return out;
      });
      expect(fits).toEqual([]);
      await snap(page, info, `roster-skill-icons-${size.width}x${size.height}`);
    } finally {
      await context.close();
    }
  });
}
