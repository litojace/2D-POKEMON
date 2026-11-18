import { expect, test, type Page } from "@playwright/test";
import { openLobby, settle } from "./helpers";
import { decodePng } from "./png";

// Skin thumbnails painted once (skin-thumbnails.ts): a thumbnail starts as
// its SVG and, once shown, is drawn into a bitmap in a quiet moment, which
// the next build of the screen shows at once. The bitmap must look the
// same: same place and size, no smaller than shown, no softer.

/** Mean |Laplacian| of the luminance: drops when a picture goes soft. */
function sharpness(png: Buffer) {
  const { width: w, height: h, data } = decodePng(png);
  const lum = (i: number) =>
    0.3 * data[i * 4] + 0.59 * data[i * 4 + 1] + 0.11 * data[i * 4 + 2];
  let sum = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      sum += Math.abs(
        4 * lum(i) - lum(i - 1) - lum(i + 1) - lum(i - w) - lum(i + w),
      );
    }
  return sum / (w * h);
}
/** Share of channel values more than `by` apart. */
function differing(a: Buffer, b: Buffer, by = 24) {
  const A = decodePng(a).data,
    B = decodePng(b).data;
  let n = 0;
  for (let i = 0; i < A.length; i++) if (Math.abs(A[i] - B[i]) > by) n++;
  return n / A.length;
}

const thumbs = (page: Page) =>
  page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLImageElement>(".roster-looks img"),
      (img) => {
        const r = img.getBoundingClientRect();
        // object-fit: contain draws it in the frame's shape (212:216).
        const shown = Math.min(r.width / 212, r.height / 216) * 216;
        return {
          src: img.getAttribute("src")!.slice(0, 5),
          box: [r.x, r.y, r.width, r.height].map((v) => v.toFixed(2)).join(),
          fit: getComputedStyle(img).objectFit,
          ready: img.complete && img.naturalHeight > 0,
          tall: img.naturalHeight,
          needed: Math.ceil(shown * devicePixelRatio),
        };
      },
    ),
  );

for (const dpr of [2, 3])
  test(`Roster skins become bitmaps that look the same at ${dpr}×`, async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: dpr,
    });
    try {
      const page = await context.newPage();
      const errors = await openLobby(page);
      await page.click('.lobby-rail [data-lobby-action="fighters"]');
      await page.click('[data-roster-card="tidefin"]');
      await page.click('[data-roster-card="cindrake"]');
      await page.click("[data-roster-details]");
      await page.click('[data-ui-rtab="skins"]');
      const grid = page.locator(".roster-looks");
      await expect(grid).toBeVisible();
      await expect
        .poll(async () => (await thumbs(page)).every((t) => t.ready))
        .toBe(true);
      await settle(page);
      const svg = await thumbs(page);
      expect(svg.length).toBeGreaterThan(5);
      expect(svg.every((t) => t.src === "data:")).toBe(true);
      const clip = (await grid.boundingBox())!;
      clip.height = Math.min(clip.height, 390 - clip.y);
      const svgShot = await page.screenshot({ clip });

      // Painted in quiet moments, then shown in place.
      await expect
        .poll(
          async () =>
            (await thumbs(page)).filter((t) => t.src === "blob:").length,
          { timeout: 120_000 },
        )
        .toBe(svg.length);
      await expect
        .poll(async () => (await thumbs(page)).every((t) => t.ready))
        .toBe(true);
      await settle(page);
      const bitmaps = await thumbs(page);
      // Laid out exactly as the SVGs were, and never smaller than shown.
      expect(bitmaps.map((t) => t.box)).toEqual(svg.map((t) => t.box));
      for (const t of bitmaps) {
        expect(t.fit).toBe("contain");
        expect(t.tall).toBeGreaterThanOrEqual(t.needed);
      }
      const bitmapShot = await page.screenshot({ clip });
      // As sharp as the SVGs (1.5× bitmaps measured within 1% at 2× and 3×;
      // bitmaps at their shown size were 2–4% softer), and the same picture.
      expect(sharpness(bitmapShot) / sharpness(svgShot)).toBeGreaterThan(0.98);
      expect(differing(svgShot, bitmapShot)).toBeLessThan(0.002);

      // Built again (another tab and back), the screen takes the bitmaps at
      // once: already decoded, in the same task as the tap.
      await page.click('[data-ui-rtab="overview"]');
      const again = await page.evaluate(() => {
        document.querySelector<HTMLElement>('[data-ui-rtab="skins"]')!.click();
        return Array.from(
          document.querySelectorAll<HTMLImageElement>(".roster-looks img"),
          (img) =>
            `${img.getAttribute("src")!.slice(0, 5)}${img.complete ? "" : " loading"}`,
        );
      });
      expect(again).toEqual(svg.map(() => "blob:"));
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
