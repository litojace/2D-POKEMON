import { expect, test, type Browser } from "@playwright/test";
import { openPlaza, snap } from "./helpers";

// The Plaza fills the screen on any shape: an ultrawide monitor,
// a tall window, a desktop, a phone. When the map is smaller than the view,
// the scene zooms in rather than showing empty space past the map's edge.
// The Plaza's world goes on past its edge (the river, the woods, the fields:
// plaza-surround.ts): at a corner the camera looks a little way out there,
// never past what is built.
const SIZES = [
  { width: 3440, height: 1440, name: "ultrawide" },
  { width: 2560, height: 1080, name: "wide" },
  { width: 1720, height: 1392, name: "tall" },
  { width: 1440, height: 900, name: "desktop" },
  { width: 844, height: 390, name: "phone" },
];
const PLAZA = { w: 2700, h: 1700 };
// How far past each edge the Plaza's camera may look (PLAZA_OUT).
const OUT = { n: 240, s: 220, w: 200, e: 200 };

async function context(browser: Browser, size: (typeof SIZES)[number]) {
  const phone = size.width < 1000;
  return browser.newContext({
    viewport: { width: size.width, height: size.height },
    isMobile: phone,
    hasTouch: phone,
  });
}

for (const size of SIZES) {
  test(`the Plaza fills a ${size.width}x${size.height} screen at every edge of the map`, async ({
    browser,
  }, info) => {
    const ctx = await context(browser, size);
    try {
      const page = await ctx.newPage();
      const errors = await openPlaza(page);
      // Walk (teleport) to each corner: the camera follows to the map's edge.
      const corners: [number, number][] = [
        [60, 130],
        [PLAZA.w - 60, 130],
        [60, PLAZA.h - 60],
        [PLAZA.w - 60, PLAZA.h - 60],
      ];
      for (const [x, y] of corners) {
        await page.evaluate(
          ([x, y]) => (window as any).__plazaPosition(x, y),
          [x, y],
        );
        await expect
          .poll(
            () =>
              page.evaluate(
                ([x, y]) => {
                  const P = (window as any).__plaza.P;
                  return Math.hypot(P.x - x, P.y - y);
                },
                [x, y],
              ),
            { timeout: 15_000 },
          )
          .toBeLessThan(200);
        // The camera eases, and this CPU-drawn browser may manage only a few
        // frames a second at these sizes: wait until the map's corners have
        // held still for four readings in a row (2 s), then measure.
        let last = "",
          same = 0;
        await expect
          .poll(
            async () => {
              const now = JSON.stringify(
                await page.evaluate(
                  ([w, h, o]) => {
                    const p = (window as any).__plaza,
                      a = p.worldClient(-o.w, -o.n),
                      b = p.worldClient(w + o.e, h + o.s),
                      m0 = p.worldClient(0, 0),
                      m1 = p.worldClient(w, h);
                    return [a.x, a.y, b.x, b.y, m0.x, m0.y, m1.x, m1.y].map(
                      (v) => Math.round(v),
                    );
                  },
                  [PLAZA.w, PLAZA.h, OUT] as const,
                ),
              );
              same = now === last ? same + 1 : 0;
              last = now;
              return same >= 3;
            },
            { timeout: 30_000, intervals: [500] },
          )
          .toBe(true);
        const [ax, ay, bx, by, mx0, my0, mx1, my1] = JSON.parse(
          last,
        ) as number[];
        // Never past what is built...
        expect(ax, `built left edge at ${x},${y}`).toBeLessThanOrEqual(0);
        expect(ay, `built top edge at ${x},${y}`).toBeLessThanOrEqual(0);
        expect(bx, `built right edge at ${x},${y}`).toBeGreaterThanOrEqual(
          size.width,
        );
        expect(by, `built bottom edge at ${x},${y}`).toBeGreaterThanOrEqual(
          size.height,
        );
        // ...but out past the Plaza's own edge by the corner you stand at.
        if (x < PLAZA.w / 2) expect(mx0, "the woods west").toBeGreaterThan(0);
        else expect(mx1, "the woods east").toBeLessThan(size.width);
        if (y < PLAZA.h / 2) expect(my0, "the river north").toBeGreaterThan(0);
        else expect(my1, "the fields south").toBeLessThan(size.height);
      }
      await snap(page, info, `plaza-fill-${size.name}`);
      expect(errors).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
}
