import { expect, test } from "@playwright/test";
import { hubMenu, openHub, skipTour } from "./helpers";

// Numbers in Poster line up. Anton has no tabular figures (its 1 is about a
// third narrower than its other digits, with or without tabular-nums), so
// numbers in columns or that change in place take Archivo's tabular
// figures (themes/poster/kit.css, "numbers"). The Ranks road's "From"
// column has 1,600 and 1,210 and 1,105: in Anton those were three widths.
test("Poster: numbers in columns line up", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await skipTour(page);
  await page.addInitScript(() => {
    if (!location.search) history.replaceState(null, "", "/?ui=poster");
  });
  const errors = await openHub(page);
  await page.evaluate(() => document.fonts.ready);
  // The coins in the header change in place.
  const coin = await page
    .locator("body.hub-active #account-coins .coin-chip b")
    .evaluate((b) => {
      const cs = getComputedStyle(b);
      return [
        cs.fontFamily.split(",")[0].replace(/"/g, ""),
        cs.fontVariantNumeric,
      ];
    });
  expect(coin).toEqual(["Archivo", "tabular-nums"]);

  await hubMenu(page, "ranks");
  const from = page.locator(".rk-road .rk-from.ui-num");
  await expect(from.first()).toBeVisible();
  const cells = await from.evaluateAll((els) =>
    els.map((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        text: el.textContent!.trim(),
        width: r.width,
        right: el.getBoundingClientRect().right,
        font: cs.fontFamily.split(",")[0].replace(/"/g, ""),
      };
    }),
  );
  const four = cells.filter((c) => /^\d,\d{3}$/.test(c.text));
  // The figures that differ (1 against 6, 4, 3, 2, 0) are all there.
  expect(four.map((c) => c.text)).toEqual(
    expect.arrayContaining(["1,600", "1,210", "1,105"]),
  );
  for (const c of cells) expect(c.font, c.text).toBe("Archivo");
  const widths = four.map((c) => c.width);
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(0.5);
  // A right-aligned column: every number ends on the same line.
  const rights = cells.map((c) => c.right);
  expect(Math.max(...rights) - Math.min(...rights)).toBeLessThan(0.5);
  expect(errors).toEqual([]);
});
