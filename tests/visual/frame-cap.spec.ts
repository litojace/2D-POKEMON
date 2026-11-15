import { expect, test } from "@playwright/test";
import { openHub, openPlayPanel, pushUntilBattle } from "./helpers";

// A 120 Hz phone: the battle draws about 60 frames a second (frame-cap.ts).
// The browser here refreshes at 60 Hz, so a 120 Hz screen is faked: every
// animation frame is called on an 8.33 ms grid, stamped with its refresh
// time, as a 120 Hz browser does. Frames drawn are counted as the battle
// canvas's WebGL clears (Phaser clears once per frame it draws).
test("a 120 Hz screen draws the battle at about 60 frames a second", async ({
  browser,
}) => {
  // A small screen at 1×, so this machine's software renderer could draw
  // faster than 60 if it were let.
  const context = await browser.newContext({
    viewport: { width: 640, height: 360 },
    deviceScaleFactor: 1,
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => {
      const w = window as any;
      const refresh = 1000 / 120;
      let id = 0;
      const timers = new Map<number, ReturnType<typeof setTimeout>>();
      w.__rafCalls = 0;
      w.requestAnimationFrame = (cb: FrameRequestCallback) => {
        const handle = ++id;
        const now = performance.now();
        const at = Math.ceil((now + 0.5) / refresh) * refresh;
        timers.set(
          handle,
          setTimeout(() => {
            timers.delete(handle);
            w.__rafCalls++;
            cb(at);
          }, at - now),
        );
        return handle;
      };
      w.cancelAnimationFrame = (handle: number) => {
        clearTimeout(timers.get(handle));
        timers.delete(handle);
      };
      w.__clears = 0;
      for (const proto of [
        WebGLRenderingContext.prototype,
        WebGL2RenderingContext.prototype,
      ]) {
        const clear = proto.clear;
        proto.clear = function (this: WebGLRenderingContext, mask: number) {
          if ((this.canvas as HTMLCanvasElement).parentElement?.id === "game")
            w.__clears++;
          return clear.call(this, mask);
        };
      }
    });
    const errors = await openHub(page);
    await page.evaluate(() => (window as any).__room("practice"));
    await openPlayPanel(page);
    await page.click("#practice");
    await pushUntilBattle(page);
    // Let the cap learn the screen, then count three seconds.
    await page.waitForTimeout(1500);
    const count = () =>
      page.evaluate(() => ({
        raf: (window as any).__rafCalls as number,
        drawn: (window as any).__clears as number,
        at: performance.now(),
      }));
    const a = await count();
    await page.waitForTimeout(3000);
    const b = await count();
    const seconds = (b.at - a.at) / 1000;
    const raf = (b.raf - a.raf) / seconds,
      drawn = (b.drawn - a.drawn) / seconds;
    console.log(
      `fake 120 Hz: ${raf.toFixed(1)} animation frames/s, ${drawn.toFixed(1)} battle frames drawn/s`,
    );
    // The page really ran at 120 Hz (this machine's timers allowing)...
    expect(raf).toBeGreaterThan(95);
    // ...and drew about half of those frames, never more than ~60.
    expect(drawn).toBeGreaterThan(30);
    expect(drawn).toBeLessThan(64);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
