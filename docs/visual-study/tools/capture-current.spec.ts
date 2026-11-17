// Captures today's Farm and Bistro by day at 844×390 ×2 and measures their
// per-frame draw cost the same way the prototype measures itself.
// To run: copy into tests/visual/ (it imports the harness helpers), then
//   VISUAL_SHOTS=<folder> PW_CHROMIUM=... npx playwright test --config tests/visual/playwright.config.ts tests/visual/capture-current.spec.ts --trace off --workers=1
// and delete the copy afterwards.
import { expect, test, type Page } from "@playwright/test";
import { openLobby } from "./helpers";
import { fakeFarm } from "./farm-fake";
import { fakeBistro } from "./bistro-fake";

const OUT = process.env.VISUAL_SHOTS ?? "/tmp/visual-study";
test.use({ deviceScaleFactor: 2 });

async function measure(page: Page, ms = 4000) {
  return page.evaluate(async (ms) => {
    const proto = CanvasRenderingContext2D.prototype as any;
    const names = ["drawImage", "fill", "stroke", "fillRect"] as const;
    const orig: Record<string, any> = {};
    const count: Record<string, number> = {};
    for (const n of names) {
      orig[n] = proto[n];
      count[n] = 0;
      proto[n] = function (...a: unknown[]) {
        count[n]++;
        return orig[n].apply(this, a);
      };
    }
    const raf = window.requestAnimationFrame;
    const times: number[] = [];
    (window as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
      raf((t) => {
        const t0 = performance.now();
        cb(t);
        // a 1-pixel read makes the frame's drawing finish before the clock stops
        for (const c of document.querySelectorAll("canvas"))
          if (
            (c as HTMLCanvasElement).width > 300 &&
            c.getBoundingClientRect().width > 0
          )
            (c as HTMLCanvasElement).getContext("2d")?.getImageData(0, 0, 1, 1);
        times.push(performance.now() - t0);
      });
    await new Promise((r) => setTimeout(r, ms));
    (window as any).requestAnimationFrame = raf;
    for (const n of names) proto[n] = orig[n];
    const frames = Math.max(1, times.length);
    const sorted = [...times].sort((a, b) => a - b);
    return {
      frames,
      msMedian: sorted[Math.floor(sorted.length / 2)] ?? 0,
      msP90: sorted[Math.floor(sorted.length * 0.9)] ?? 0,
      perFrame: Object.fromEntries(
        names.map((n) => [n, Math.round(count[n] / frames)]),
      ),
    };
  }, ms);
}

test("capture the current Farm by day", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await openLobby(page);
  await fakeFarm(page);
  await page.evaluate(() => {
    const f = (window as any).__fakeFarm;
    f.weather.now = "sun";
    f.weather.next = "sun";
  });
  await page.click('#hub-scenes [data-hub-scene="farm"]');
  await page.waitForFunction(() => (window as any).__farm?.F?.loaded);
  for (const [tod, name] of [
    [0.33, "morning"],
    [0.5, "noon"],
    [0.7, "evening"],
  ] as const) {
    await page.evaluate((t) => {
      const w = window as any;
      w.__farm.tod(t);
      w.__farm.F.weather.cur = "sun";
    }, tod);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/current-farm-${name}.png` });
  }
  await page.evaluate(() => (window as any).__farm.tod(0.5));
  const m = await measure(page);
  console.log("FARM", JSON.stringify(m));
  expect(m.frames).toBeGreaterThan(0);
});

test("capture the current Bistro by day", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await openLobby(page);
  await fakeBistro(page);
  await page.click('#hub-scenes [data-hub-scene="bistro"]');
  await expect(page.locator(".bistro-layer .bs-cv")).toBeVisible();
  await page.waitForFunction(() => (window as any).__bistro?.sync().ready);
  for (const [tod, name] of [
    [0.33, "morning"],
    [0.5, "noon"],
    [0.7, "evening"],
  ] as const) {
    await page.evaluate((t) => (window as any).__bistro.setTod(t), tod);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/current-bistro-${name}.png` });
  }
  await page.evaluate(() => (window as any).__bistro.setTod(0.5));
  const m = await measure(page);
  console.log("BISTRO", JSON.stringify(m));
  expect(m.frames).toBeGreaterThan(0);
});
