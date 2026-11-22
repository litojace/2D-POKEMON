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
  const runs: { delay: number; gap: number }[] = [];
  for (let i = 0; i < 4; i++) {
    // The ball at rest, no pitch bots, you 160 px to its left.
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
        new Promise<{ delay: number; gap: number }>((done) => {
          const w = window as any;
          const P = w.__plaza.P,
            ball = w.__plaza.ball,
            start = { x: ball.x, y: ball.y };
          let touchAt = 0,
            gap = 99;
          const t0 = performance.now();
          const tick = () => {
            const t = performance.now(),
              d = Math.hypot(P.x - ball.x, P.y - ball.y);
            if (!touchAt && d < 43) touchAt = t;
            if (touchAt) gap = Math.min(gap, d);
            if (touchAt && Math.hypot(ball.x - start.x, ball.y - start.y) > 6)
              return done({ delay: t - touchAt, gap });
            if (t - t0 > 4000) return done({ delay: 9999, gap });
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
    );
    await page.locator(".plaza-layer").dispatchEvent("keyup", { key: "d" });
    runs.push(r);
    await page.waitForTimeout(400);
  }
  // A frame or two (this CPU renderer draws ~60 fps), never a network trip.
  for (const r of runs) {
    expect(r.delay, JSON.stringify(runs)).toBeLessThan(80);
    // Never into the ball's middle: at most a frame's step inside its edge.
    expect(r.gap, JSON.stringify(runs)).toBeGreaterThan(30);
  }
  expect(errors).toEqual([]);
});
