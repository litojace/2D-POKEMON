import { expect, test, type Page } from "@playwright/test";
import { openLobby, settle } from "./helpers";
import { decodePng } from "./png";

// Skin thumbnails and the Original look painted once (skin-thumbnails.ts):
// a picture starts as its SVG and, once shown, is drawn into a bitmap in a
// quiet moment, which the next build of the screen shows at once. The bitmap
// must look the same: same place and size, no smaller than shown, no softer.

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

/**
 * Largest difference of 8×8 block averages (0–255): blind to the half-pixel
 * shift of edges between inline SVG and any picture of it (the browser's own
 * picture of the Original look measured 15.5), not to a missing part.
 */
function blockDiff(a: Buffer, b: Buffer, n = 8) {
  const A = decodePng(a),
    B = decodePng(b);
  let max = 0;
  for (let by = 0; by + n <= A.height; by += n)
    for (let bx = 0; bx + n <= A.width; bx += n)
      for (let k = 0; k < 3; k++) {
        let d = 0;
        for (let y = by; y < by + n; y++)
          for (let x = bx; x < bx + n; x++) {
            const i = (y * A.width + x) * 4 + k;
            d += A.data[i] - B.data[i];
          }
        max = Math.max(max, Math.abs(d) / (n * n));
      }
  return max;
}

/** The Original look card: inline SVG, or its emptied <svg> with a bitmap. */
const LOOK = ".roster-look:first-child .roster-look-art > svg";
const look = (page: Page) =>
  page.locator(LOOK).evaluate((svg) => {
    const r = svg.getBoundingClientRect();
    return {
      fighter: svg.getAttribute("data-fighter"),
      inline: svg.childElementCount > 0,
      bitmap: /url\("?blob:/.test((svg as SVGElement).style.backgroundImage),
      box: [r.x, r.y, r.width, r.height].map((v) => v.toFixed(2)).join(),
    };
  });

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

// On a computer (a mouse): phones keep the SVG (the last test below).
for (const dpr of [2, 3])
  test(`Roster skins become bitmaps that look the same at ${dpr}×`, async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      deviceScaleFactor: dpr,
    });
    try {
      const page = await context.newPage();
      const errors = await openLobby(page);
      await page.click('.lobby-rail [data-lobby-action="fighters"]');
      await page.click('[data-roster-card="tidefin"]');
      await page.click('[data-roster-card="cindrake"]');
      await page.click("[data-roster-details]");
      // Hold the quiet moments bitmaps are painted in (svg-raster.ts idle)
      // until the SVGs have been looked at.
      await page.evaluate(() => {
        const w = window as any;
        const held: (() => void)[] = [];
        const own = w.requestIdleCallback;
        w.requestIdleCallback = (cb: () => void) => (held.push(cb), 0);
        w.__releaseIdle = () => {
          w.requestIdleCallback = own;
          held.splice(0).forEach((cb) => cb());
        };
      });
      await page.click('[data-ui-rtab="skins"]');
      const grid = page.locator(".roster-looks");
      await expect(grid).toBeVisible();
      // The Original look, inline as it was.
      await settle(page);
      const lookTile = (await page
        .locator(".roster-look:first-child .roster-look-art")
        .boundingBox())!;
      const inlineLook = await look(page);
      const inlineShot = await page.screenshot({ clip: lookTile });
      expect(inlineLook).toMatchObject({ inline: true, bitmap: false });
      await expect
        .poll(async () => (await thumbs(page)).every((t) => t.ready))
        .toBe(true);
      const svg = await thumbs(page);
      expect(svg.length).toBeGreaterThan(5);
      expect(svg.every((t) => t.src === "data:")).toBe(true);
      const clip = (await grid.boundingBox())!;
      clip.height = Math.min(clip.height, 390 - clip.y);
      const svgShot = await page.screenshot({ clip });
      await page.evaluate(() => (window as any).__releaseIdle());

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
      // The Original look: its own <svg> (same box, same clipping), emptied,
      // the bitmap behind; as sharp as inline (1.75× measured 0.99–1.04 of
      // inline over every fighter) and the same picture.
      await expect.poll(() => look(page)).toMatchObject({ bitmap: true });
      await page.waitForTimeout(200);
      expect(await look(page)).toEqual({
        ...inlineLook,
        inline: false,
        bitmap: true,
      });
      const lookShot = await page.screenshot({ clip: lookTile });
      expect(sharpness(lookShot) / sharpness(inlineShot)).toBeGreaterThan(0.97);
      expect(blockDiff(inlineShot, lookShot)).toBeLessThan(24);
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
      expect(await look(page)).toMatchObject({ inline: false, bitmap: true });

      // The next fighter: its own art straight away, never the last one's
      // bitmap behind it (the screen patches in markup that knows nothing of
      // the bitmap), checked in the frame the tap paints.
      const next = await page.evaluate(
        () =>
          new Promise<string>((resolve) => {
            document.querySelector<HTMLElement>(".roster-next")!.click();
            requestAnimationFrame(() => {
              const svg = document.querySelector<SVGElement>(
                ".roster-look:first-child .roster-look-art > svg",
              )!;
              resolve(
                `${svg.getAttribute("data-fighter")} inline:${svg.childElementCount > 0} background:${svg.style.backgroundImage || "none"}`,
              );
            });
          }),
      );
      expect(next).toMatch(/^(?!cindrake)\w+ inline:true background:none$/);
      // …and in time its own bitmap.
      await expect
        .poll(() => look(page), { timeout: 60_000 })
        .toMatchObject({ inline: false, bitmap: true });
      expect((await look(page)).fighter).not.toBe("cindrake");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

// A phone (a touch screen) keeps every picture as its SVG, which the browser
// paints on its own threads: drawing a bitmap rasterized it on the page's
// own thread, one frame of 650–830 ms per thumbnail on a 3× phone at 4× CPU,
// to save 15–30 ms when a screen was built again (Nov 2026).
test("a phone keeps its skin pictures as SVG: none drawn into bitmaps", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({
    viewport: { width: 956, height: 440 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    // The painter's work in a long frame: its own file's (the bitmap drawn
    // once the SVG decoded, its size observer). Not svg-raster.ts's: its
    // idle() wakes the screens' preload and the fighters' prepaint too, and
    // on CI those land in long frames (#591's first run).
    await page.addInitScript(() => {
      const w = window as any;
      w.__painter = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as any[])
          for (const s of e.scripts ?? [])
            if (/skin-thumbnails/.test(String(s.sourceURL ?? "")))
              w.__painter.push(
                `${s.invoker} ${s.sourceFunctionName} ${Math.round(s.duration)} ms`,
              );
      }).observe({ type: "long-animation-frame" });
    });
    const errors = await openLobby(page);
    const pictures = () =>
      page.evaluate(() =>
        Array.from(
          document.querySelectorAll<Element>(
            "img.skin-thumb, .roster-look-art > svg",
          ),
          (el) =>
            el instanceof HTMLImageElement
              ? `${el.getAttribute("src")!.slice(0, 5)}${el.complete && el.naturalWidth ? "" : " not shown"}`
              : `inline:${el.childElementCount > 0} ${(el as SVGElement).style.backgroundImage || "no background"}`,
        ),
      );
    // The Shop's catalogue, then the Roster's looks: given the time a
    // computer takes to paint them (8 s each, at full speed).
    await page.click('.lobby-rail [data-lobby-action="shop"]');
    await page.click('[data-ui-section="skins"]');
    await expect(page.locator("img.skin-thumb").first()).toBeVisible();
    await page.waitForTimeout(8000);
    const shop = await pictures();
    expect(shop.length).toBeGreaterThan(5);
    expect(new Set(shop)).toEqual(new Set(["data:"]));
    await page
      .locator(".ui-panel-host:not([data-ui-parked]) [data-ui-close]")
      .first()
      .click();
    await page.click('.lobby-rail [data-lobby-action="fighters"]');
    await page.click('[data-roster-card="cindrake"]');
    await page.click("[data-roster-details]");
    await page.click('[data-ui-rtab="skins"]');
    await expect(page.locator(".roster-looks")).toBeVisible();
    await page.waitForTimeout(8000);
    const roster = await pictures();
    expect(roster.length).toBeGreaterThan(5);
    expect(new Set(roster)).toEqual(
      new Set(["data:", "inline:true no background"]),
    );
    expect(await page.evaluate(() => (window as any).__painter)).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
