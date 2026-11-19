import { expect, test, type Browser } from "@playwright/test";
import { openLobby, openPlaza, snap } from "./helpers";

// The Plaza and the Farm fill the screen on any shape: an ultrawide monitor,
// a tall window, a desktop, a phone. When the map is smaller than the view,
// the scene zooms in rather than showing empty space past the map's edge.
// The Plaza's world goes on past its edge (the river, the woods, the farm:
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
// The farm's board (farm-scene.ts WX0..WX1, WY0..WY1).
const FARM = { x0: -360, y0: -180, x1: 2120, y1: 1280 };

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
    // Slow frames on CI: each corner waits for drawn frames, not seconds.
    test.setTimeout(180_000);
    const ctx = await context(browser, size);
    try {
      const page = await ctx.newPage();
      const errors = await openPlaza(page);
      // Frames drawn, for a failure to say whether the scene was moving.
      await page.evaluate(() => {
        const w = window as any;
        w.__fillFrames = 0;
        const t = () => {
          w.__fillFrames++;
          requestAnimationFrame(t);
        };
        requestAnimationFrame(t);
      });
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
        // held still for four readings in a row, with frames drawn between
        // them. Still readings with no frame between say nothing: CI's
        // runner drew 4 frames in all at 1440x900 and the camera, half-way
        // to the corner, read "still" for 2 s ("the woods west", 19 Nov).
        let last = "",
          same = 0,
          frames = -1;
        await expect
          .poll(
            async () => {
              const drawn = await page.evaluate(
                () => (window as any).__fillFrames as number,
              );
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
              if (now !== last) same = 0;
              else if (drawn >= frames + 2) same++;
              else return false;
              last = now;
              frames = drawn;
              return same >= 3;
            },
            { timeout: 30_000, intervals: [500] },
          )
          .toBe(true);
        const [ax, ay, bx, by, mx0, my0, mx1, my1] = JSON.parse(
          last,
        ) as number[];
        // Where you stand, the scene's state and its frames so far.
        const at = await page.evaluate(
          ([x, y]) => {
            const w = window as any,
              P = w.__plaza.P,
              layer = document.querySelector<HTMLElement>(".plaza-layer");
            return `at ${x},${y}: you at ${Math.round(P.x)},${Math.round(P.y)}, ${layer?.dataset.graphics ?? "?"} graphics, frozen ${layer?.dataset.frozen ?? "?"}, ${w.__fillFrames} frames`;
          },
          [x, y],
        );
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
        if (x < PLAZA.w / 2)
          expect(mx0, `the woods west ${at}`).toBeGreaterThan(0);
        else expect(mx1, `the woods east ${at}`).toBeLessThan(size.width);
        if (y < PLAZA.h / 2)
          expect(my0, `the river north ${at}`).toBeGreaterThan(0);
        else expect(my1, `the farm south ${at}`).toBeLessThan(size.height);
      }
      await snap(page, info, `plaza-fill-${size.name}`);
      expect(errors).toEqual([]);
    } finally {
      await ctx.close();
    }
  });

  test(`the Farm fills a ${size.width}x${size.height} screen at every edge of the board`, async ({
    browser,
  }, info) => {
    const ctx = await context(browser, size);
    try {
      const page = await ctx.newPage();
      const errors = await openLobby(page);
      await page.click('#hub-scenes [data-hub-scene="farm"]');
      await expect(page.locator(".farm-layer #fm-cv")).toBeVisible();
      await page.waitForTimeout(600);
      // The canvas covers the whole screen.
      const cv = await page
        .locator(".farm-layer #fm-cv")
        .evaluate((el) => el.getBoundingClientRect().toJSON());
      expect(cv.x).toBeLessThanOrEqual(0);
      expect(cv.y).toBeLessThanOrEqual(0);
      expect(cv.x + cv.width).toBeGreaterThanOrEqual(size.width);
      expect(cv.y + cv.height).toBeGreaterThanOrEqual(size.height);
      // Push the camera to each corner: the board still reaches every edge.
      for (const [x, y] of [
        [-1e4, -1e4],
        [1e4, -1e4],
        [-1e4, 1e4],
        [1e4, 1e4],
      ]) {
        const [ax, ay, bx, by] = await page.evaluate(
          ([x, y, b]) => {
            const f = (window as any).__farm;
            f.look(x, y);
            const a = f.worldClient(b.x0, b.y0),
              c = f.worldClient(b.x1, b.y1);
            return [a.x, a.y, c.x, c.y];
          },
          [x, y, FARM] as const,
        );
        expect(ax, `board left edge, camera ${x},${y}`).toBeLessThanOrEqual(
          0.5,
        );
        expect(ay, `board top edge, camera ${x},${y}`).toBeLessThanOrEqual(0.5);
        expect(bx, `board right edge, camera ${x},${y}`).toBeGreaterThanOrEqual(
          size.width - 0.5,
        );
        expect(
          by,
          `board bottom edge, camera ${x},${y}`,
        ).toBeGreaterThanOrEqual(size.height - 0.5);
      }
      // Back to the whole-farm view for the picture.
      await page.evaluate(() =>
        (
          document.querySelector('#fm-zoom [data-z="fit"]') as HTMLElement
        ).click(),
      );
      await page.waitForTimeout(400);
      await snap(page, info, `farm-fill-${size.name}`);
      expect(errors).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
}
