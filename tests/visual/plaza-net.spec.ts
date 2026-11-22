import { expect, test, type Page } from "@playwright/test";
import { openPlaza } from "./helpers";

/*
 * The Plaza over a phone's network (plaza-net.ts): with 80 ms each way, the
 * ball you run into moves the same moment, ahead of you. It used to move a
 * network trip later (220–300 ms), after you had run into its middle.
 */
test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

async function addLatency(page: Page, ms: number) {
  await page.evaluate((ms) => {
    const w = window as any;
    const emit = w.__emit;
    w.__emit = (ev: string, data: any) => setTimeout(() => emit(ev, data), ms);
    const sock = w.__sock;
    const fire = sock.fire.bind(sock);
    sock.fire = (ev: string, data: any) => {
      const d = structuredClone(data);
      setTimeout(() => fire(ev, d), ms);
    };
  }, ms);
}

test("the ball you run into moves at once, ahead of you, on an 80 ms network", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = await openPlaza(page);
  await addLatency(page, 80);
  // Each trial: the ball at rest, no pitch bots, you 160 px to its left,
  // running right into it. The delay is counted in frames, from the frame
  // you touch it to the frame it has moved: the browser runs the ball, so
  // that is the same frame or the next, whatever the frame rate. Drawn from
  // the server alone (before), it waited a network trip and a snapshot
  // (over 260 ms here): 13–18 frames on this container, and still 3 or more
  // at a slow CI runner's 15 fps.
  type Run = {
    frames: number;
    ms: number;
    gap: number;
    step: number;
    touched: boolean;
  };
  const runs: Run[] = [],
    missed: Run[] = [];
  // A trial in which you never reached the ball (on a CI runner the Plaza
  // can take seconds to get going) says nothing about the ball: run another.
  for (let i = 0; runs.length < 4 && i < 10; i++) {
    await page.evaluate(() => {
      const w = window as any;
      const c = [...w.__plazaWorld.copies.values()][0];
      w.__bots ??= c.bots.splice(0);
      Object.assign(c.ball, {
        x: 2280,
        y: 1000,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        lock: 0,
      });
      w.__plazaPosition(2120, 1000);
      Object.assign(w.__plaza.P, { x: 2120, y: 1000 });
    });
    await page.waitForTimeout(800);
    await page.locator(".plaza-layer").dispatchEvent("keydown", { key: "d" });
    const r = await page.evaluate(
      () =>
        new Promise<Run>((done) => {
          const w = window as any;
          const P = w.__plaza.P,
            ball = w.__plaza.ball,
            start = { x: ball.x, y: ball.y };
          let touchAt = 0,
            touchFrame = -1,
            frame = 0,
            gap = 99,
            step = 0,
            last = { x: P.x, y: P.y };
          const t0 = performance.now();
          const tick = () => {
            const t = performance.now(),
              d = Math.hypot(P.x - ball.x, P.y - ball.y);
            step = Math.max(step, Math.hypot(P.x - last.x, P.y - last.y));
            last = { x: P.x, y: P.y };
            if (touchFrame < 0 && d < 43) {
              touchAt = t;
              touchFrame = frame;
            }
            if (touchFrame >= 0) gap = Math.min(gap, d);
            if (
              touchFrame >= 0 &&
              Math.hypot(ball.x - start.x, ball.y - start.y) > 6
            )
              return done({
                frames: frame - touchFrame,
                ms: t - touchAt,
                gap,
                step,
                touched: true,
              });
            if (t - t0 > 6000)
              return done({
                frames: 9999,
                ms: 9999,
                gap,
                step,
                touched: touchFrame >= 0,
              });
            frame++;
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
    );
    await page.locator(".plaza-layer").dispatchEvent("keyup", { key: "d" });
    (r.touched ? runs : missed).push(r);
    await page.waitForTimeout(400);
  }
  const all = JSON.stringify({ runs, missed });
  expect(runs.length, all).toBe(4);
  for (const r of runs) {
    // The touching frame or the next, never a network trip.
    expect(r.frames, all).toBeLessThanOrEqual(1);
    // Never into the ball's middle: at most one of your frame's steps
    // inside its edge (40 px), however long a frame is (before: 0–2 px).
    expect(r.gap, all).toBeGreaterThan(40 - r.step - 1);
    expect(r.gap, all).toBeGreaterThan(15);
  }
  expect(errors).toEqual([]);
});
