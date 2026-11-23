// TEMPORARY diagnostic (not to merge): the running-jump test from
// plaza.spec.ts, repeated, with every animation frame logged, to find why it
// fails on some CI runners (max |bob| 3.99 and 1.04 on run 45137975302).
import { expect, test } from "@playwright/test";
import { openPlaza } from "./helpers";

for (let rep = 0; rep < 12; rep++)
  test(`diag ${rep}: a running jump, every frame logged`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors = await openPlaza(page);
    // Log every frame from here: what the test would read, and whether the
    // game drew you this frame (bodyPose sets bobT = the frame's time).
    await page.evaluate(() => {
      const w = window as any,
        P = w.__plaza.P,
        layer = document.querySelector(".plaza-layer") as HTMLElement;
      w.__diag = { frames: [] as any[], long: [] as any[], phase: "pre" };
      let img = P.img,
        imgSwaps = 0;
      try {
        new PerformanceObserver((l) => {
          for (const e of l.getEntries())
            w.__diag.long.push([Math.round(e.startTime), Math.round(e.duration)]);
        }).observe({ type: "longtask", buffered: true });
      } catch {
        /* no longtask observer */
      }
      const f = (now: number) => {
        if (P.img !== img) {
          img = P.img;
          imgSwaps++;
        }
        w.__diag.frames.push([
          w.__diag.phase,
          Math.round(now),
          Math.round(performance.now() - now),
          P.bobT === now / 1000 ? 1 : 0,
          P.img?.sprite ? 1 : 0,
          imgSwaps,
          Math.round(P.sp || 0),
          +(P.air || 0).toFixed(3),
          +(P.bob || 0).toFixed(2),
          +(P.wGround ?? -1).toFixed(3),
          Math.round(P.x),
          P.stun > 0 ? 1 : 0,
          layer?.dataset.frozen === "true" ? 1 : 0,
          layer?.dataset.graphics === "low" ? 1 : 0,
          document.hidden ? 1 : 0,
        ]);
        requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
    const tStart = Date.now();
    await page.evaluate(([x, y]) => (window as any).__plazaPosition(x, y), [
      2060, 760,
    ]);
    await page.waitForTimeout(500);
    await page.locator(".plaza-layer").focus();
    await page.evaluate(() => ((window as any).__diag.phase = "run"));
    await page.keyboard.down("d");
    await expect
      .poll(() => page.evaluate(() => (window as any).__plaza.P.sp), {
        timeout: 20_000,
      })
      .toBeGreaterThan(100);
    const tPoll = Date.now();
    const bobs: number[] = await page.evaluate(
      () =>
        new Promise((done) => {
          const w = window as any,
            P = w.__plaza.P,
            out: number[] = [],
            t0 = performance.now();
          w.__diag.phase = "air";
          w.__diag.t0 = Math.round(t0);
          P.air = 1e-4;
          P.airDur = 1.5;
          P.airH = 42;
          const loop = (now: number) => {
            if (!P.air || now - t0 > 8000) return done(out);
            if (now - t0 > 250) out.push(P.bob || 0);
            requestAnimationFrame(loop);
          };
          requestAnimationFrame(loop);
        }),
    );
    const tJump = Date.now();
    await page.keyboard.up("d");
    const diag = await page.evaluate(() => {
      const d = (window as any).__diag;
      d.phase = "done";
      return d;
    });
    const max = bobs.length ? Math.max(...bobs.map(Math.abs)) : -1;
    console.log(
      `DIAG ${rep} max=${max.toFixed(3)} n=${bobs.length} poll=${tPoll - tStart}ms jump=${tJump - tPoll}ms errors=${JSON.stringify(errors).slice(0, 600)}`,
    );
    // cols: phase, now, lag(perf.now-now), drew, sprite, imgSwaps, sp, air, bob, wGround, x, stun, frozen, low, hidden
    const keep = diag.frames.filter((r: any[]) => r[0] !== "pre");
    console.log(`DIAGT0 ${rep} ${diag.t0} long=${JSON.stringify(diag.long.slice(-40))}`);
    console.log(`DIAGF ${rep} ${JSON.stringify(keep.slice(-160))}`);
    expect(bobs.length).toBeGreaterThan(0);
    expect(max).toBeLessThan(0.5);
    expect(errors).toEqual([]);
  });
