import { expect, test, type Page } from "@playwright/test";
import { openPlaza } from "./helpers";
import { PLAZA_FOUNTAIN, PLAZA_WISH } from "../../packages/shared/src/plaza";

// What the wishing fountain's fireworks cost: the Plaza's frame rate at the
// fountain without them and during a show, on a phone-sized screen at High
// (the heaviest level). A frame-rate check: run it alone, on one worker.
// Measured on this container's software renderer, which exaggerates fill
// cost; phones pay less, in the same direction.
test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

/** Frame intervals (ms) the page drew over `ms`. */
const frames = (page: Page, ms: number) =>
  page.evaluate(
    (ms) =>
      new Promise<number[]>((done) => {
        const out: number[] = [];
        let last = performance.now();
        const start = last;
        const tick = (t: number) => {
          out.push(t - last);
          last = t;
          if (t - start < ms) requestAnimationFrame(tick);
          else done(out.slice(1));
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );
const median = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1];
const p95 = (a: number[]) =>
  [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)];

test("the fireworks keep the Plaza's frame rate (High, phone screen)", async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => localStorage.setItem("ea-graphics", "high"));
  const errors = await openPlaza(page);
  await page.evaluate(
    ([x, y]) => {
      (window as any).__plazaPosition(x, y);
      Object.assign((window as any).__plaza.P, { x, y });
    },
    [PLAZA_FOUNTAIN.x, PLAZA_FOUNTAIN.y + 110],
  );
  // Settle (camera, fonts, first paints), then the same spot without a show.
  await page.waitForTimeout(2500);
  const before = await frames(page, 4000);
  // Fill the meter: the show runs PLAZA_WISH.showMs.
  for (let i = 0; i < PLAZA_WISH.min; i++)
    await page.evaluate(() => (window as any).__plazaWish());
  await expect
    .poll(() => page.evaluate(() => (window as any).__plaza.fireworks().active))
    .toBe(true);
  const during = await frames(page, PLAZA_WISH.showMs - 500);
  const fw = await page.evaluate(() => (window as any).__plaza.fireworks());
  const result = {
    beforeFps: Math.round(1000 / median(before)),
    duringFps: Math.round(1000 / median(during)),
    beforeP95Ms: Math.round(p95(before)),
    duringP95Ms: Math.round(p95(during)),
    fireworksMsPerFrame: +(fw.cost.ms / Math.max(1, fw.cost.frames)).toFixed(3),
    fireworksMaxMs: +fw.cost.max.toFixed(2),
    peakSparks: fw.peak.sparks,
    peakFlashes: fw.peak.flashes,
    peakGlowScreens: +fw.peak.glowCover.toFixed(3),
  };
  console.log("plaza fireworks cost", JSON.stringify(result));
  info.annotations.push({
    type: "plaza-fireworks",
    description: JSON.stringify(result),
  });
  expect(fw.cost.frames).toBeGreaterThan(10);
  // The fireworks' own drawing stays small next to a frame…
  expect(result.fireworksMsPerFrame).toBeLessThan(2);
  // …the frame rate holds (a little room for run-to-run noise)…
  expect(result.duringFps).toBeGreaterThanOrEqual(result.beforeFps * 0.8);
  // …and the flashes stay a fraction of the screen.
  expect(result.peakGlowScreens).toBeLessThan(1);
  expect(errors).toEqual([]);
});
