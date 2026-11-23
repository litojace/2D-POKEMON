import { expect, test, type Page } from "@playwright/test";
import { openPlaza } from "./helpers";
import { PLAZA_FOUNTAIN, PLAZA_WISH } from "../../packages/shared/src/plaza";

// What the wishing fountain's fireworks cost: the Plaza's frame rate at the
// fountain without them and during a show, on a phone-sized screen at High
// (the heaviest level). A frame-rate check: run it alone, on one worker.
// Measured on this container's software renderer, which exaggerates fill
// cost; phones pay less, in the same direction.
test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

/**
 * Frame intervals (ms) the page drew over `ms`, counted from its first drawn
 * frame and at least 60 of them (up to 3 × `ms`). Main's scheduled run once
 * got an empty or one-frame sample (beforeFps NaN) when a busy runner held
 * the page still for the whole window; a stall now only lengthens it.
 */
const frames = (page: Page, ms: number) =>
  page.evaluate(
    (ms) =>
      new Promise<number[]>((done) => {
        const out: number[] = [];
        let last = 0,
          start: number | undefined;
        const tick = (t: number) => {
          if (start === undefined) {
            start = last = t;
            requestAnimationFrame(tick);
            return;
          }
          out.push(t - last);
          last = t;
          const elapsed = t - start;
          if ((elapsed < ms || out.length < 60) && elapsed < ms * 3)
            requestAnimationFrame(tick);
          else done(out);
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );
const median = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1];
/**
 * A frame this long is the runner pausing the page, not drawing: the
 * fireworks' own drawing tops out near 4 ms. On a CI runner the Plaza's first
 * seconds hold frames of 3-6 s while it loads (22 Nov: 12 of 16 CI runs had
 * one in the "before" window, so their frame rate read 0 or nothing).
 */
const STALL_MS = 1000;
/** One frame at 60 Hz: frame intervals come in steps of it. */
const VSYNC_MS = 1000 / 60;
/** Wait until the page has drawn 1.5 s with no stall (up to 30 s). */
const steady = (page: Page) =>
  expect
    .poll(
      async () => {
        const f = await frames(page, 1500);
        return f.length >= 5 && Math.max(...f) < STALL_MS;
      },
      { timeout: 30_000, intervals: [0] },
    )
    .toBe(true);
const p95 = (a: number[]) =>
  [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)];

test("the fireworks keep the Plaza's frame rate (High, phone screen)", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => localStorage.setItem("ea-graphics", "high"));
  const errors = await openPlaza(page);
  await page.evaluate(
    ([x, y]) => {
      (window as any).__plazaPosition(x, y);
      Object.assign((window as any).__plaza.P, { x, y });
    },
    [PLAZA_FOUNTAIN.x, PLAZA_FOUNTAIN.y + 110],
  );
  // Settle (camera, fonts, first paints) until the page draws without
  // stalls, then the same spot without a show. A window that still caught a
  // stall is measured again: it would compare the show against a pause.
  let before: number[] = [];
  for (let tries = 0; tries < 3; tries++) {
    await steady(page);
    before = await frames(page, 4000);
    if (before.length >= 10 && Math.max(...before) < STALL_MS) break;
  }
  expect(
    before.length >= 10 && Math.max(...before) < STALL_MS,
    "the page kept stalling before the show",
  ).toBe(true);
  expect(before.length, "frames drawn before the show").toBeGreaterThan(30);
  // Fill the meter: the show runs PLAZA_WISH.showMs.
  for (let i = 0; i < PLAZA_WISH.min; i++)
    await page.evaluate(() => (window as any).__plazaWish());
  await expect
    .poll(() => page.evaluate(() => (window as any).__plaza.fireworks().active))
    .toBe(true);
  const during = await frames(page, PLAZA_WISH.showMs - 500);
  expect(during.length, "frames drawn during the show").toBeGreaterThan(30);
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
  // …the frame rate holds: the show's middle frame at most a quarter longer
  // than without it, plus one 60 Hz step, since intervals come in whole
  // steps of it (at 10-15 fps one step is 10-25% by itself)…
  expect(median(during)).toBeLessThanOrEqual(median(before) * 1.25 + VSYNC_MS);
  // …and the flashes stay a fraction of the screen.
  expect(result.peakGlowScreens).toBeLessThan(1);
  expect(errors).toEqual([]);
});
