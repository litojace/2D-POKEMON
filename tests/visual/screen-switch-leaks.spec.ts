import { expect, test, type Page } from "@playwright/test";
import { openLobby } from "./helpers";

// Switching Lobby → Plaza for a while must not pile anything
// up: each screen stops and lets go of what it started when it is left.
// An iPhone (440 × 956, dpr 3) went slower the longer it was played, until
// Auto chose Low for good (owner, 19 Nov 2026). The Plaza made and kept a new
// picture for every hurdle in view on every frame (two a frame where you
// start, never let go), and Auto counted each return to a screen as slow
// play (graphics-quality.ts, tests/unit/graphics-quality.test.ts).
test.use({
  viewport: { width: 956, height: 440 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
});

/** Counts what the page holds: animation-frame callbacks, intervals,
 *  window and document listeners, canvases and WebGL contexts. */
function track() {
  const w = window as any;
  const raf = window.requestAnimationFrame.bind(window);
  const caf = window.cancelAnimationFrame.bind(window);
  let ran = 0,
    frames = 0;
  window.requestAnimationFrame = (cb) =>
    raf((t) => {
      ran++;
      cb(t);
    });
  window.cancelAnimationFrame = caf;
  const count = () => {
    frames++;
    raf(count);
  };
  raf(count);
  const si = window.setInterval.bind(window);
  const ci = window.clearInterval.bind(window);
  const intervals = new Set<unknown>();
  (window as any).setInterval = (...a: Parameters<typeof setInterval>) => {
    const id = si(...a);
    intervals.add(id);
    return id;
  };
  (window as any).clearInterval = (id: number) => {
    intervals.delete(id);
    ci(id);
  };
  // Phaser 3.90 adds a "visibilitychange" listener for each game and never
  // takes it away (core/VisibilityHandler.js): a no-op once its game is
  // destroyed, so it is left out of the count.
  const listeners = new Map<string, number>();
  for (const [name, target] of [
    ["window", window],
    ["document", document],
  ] as const) {
    const add = target.addEventListener.bind(target);
    const rem = target.removeEventListener.bind(target);
    const held = new WeakMap<object, Set<string>>();
    const keyOf = (type: string, opt: unknown) =>
      `${name}:${type}:${typeof opt === "boolean" ? opt : !!(opt as AddEventListenerOptions)?.capture}`;
    target.addEventListener = (type: string, fn: any, opt?: any) => {
      if (fn && type !== "visibilitychange") {
        const k = keyOf(type, opt);
        let set = held.get(fn);
        if (!set) held.set(fn, (set = new Set()));
        if (!set.has(k)) {
          set.add(k);
          listeners.set(k, (listeners.get(k) ?? 0) + 1);
        }
      }
      add(type, fn, opt);
    };
    target.removeEventListener = (type: string, fn: any, opt?: any) => {
      const k = keyOf(type, opt);
      if (fn && held.get(fn)?.delete(k))
        listeners.set(k, listeners.get(k)! - 1);
      rem(type, fn, opt);
    };
  }
  const canvases: WeakRef<HTMLCanvasElement>[] = [];
  let made = 0;
  const create = Document.prototype.createElement;
  Document.prototype.createElement = function (
    this: Document,
    tag: string,
    ...rest: unknown[]
  ) {
    const e = create.call(this, tag, ...(rest as []));
    if (String(tag).toLowerCase() === "canvas") {
      made++;
      canvases.push(new WeakRef(e as HTMLCanvasElement));
    }
    return e;
  } as typeof Document.prototype.createElement;
  const contexts: WeakRef<WebGLRenderingContext>[] = [];
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    type: string,
    ...rest: unknown[]
  ) {
    const ctx = get.call(this, type as "2d", ...(rest as []));
    if (ctx && /webgl/.test(type))
      contexts.push(new WeakRef(ctx as unknown as WebGLRenderingContext));
    return ctx;
  } as typeof HTMLCanvasElement.prototype.getContext;
  w.__held = {
    start() {
      ran = frames = made = 0;
    },
    read() {
      const live = canvases
        .map((r) => r.deref())
        .filter((c): c is HTMLCanvasElement => !!c && c.width * c.height > 1);
      return {
        /** Callbacks run per page frame (each running loop adds one). */
        perFrame: Math.round((ran / Math.max(1, frames)) * 10) / 10,
        made,
        canvases: live.length,
        megapixels:
          Math.round(live.reduce((n, c) => n + c.width * c.height, 0) / 1e5) /
          10,
        contexts: contexts
          .map((r) => r.deref())
          .filter((g) => g && !g.isContextLost()).length,
        intervals: intervals.size,
        listeners: [...listeners.values()].reduce((a, b) => a + b, 0),
      };
    },
  };
}

type Held = {
  perFrame: number;
  made: number;
  canvases: number;
  megapixels: number;
  contexts: number;
  intervals: number;
  listeners: number;
};

async function go(page: Page, scene: string) {
  await page.click(`#hub-scenes [data-hub-scene="${scene}"]`);
  const shown = {
    lobby: "#lobby-play",
    plaza: ".plaza-layer #pz-cv",
  }[scene]!;
  await expect(page.locator(shown)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(300);
}

/** What the page holds after a full garbage collection, over `ms` on this screen. */
async function held(page: Page, ms = 1500): Promise<Held> {
  const cdp = await page.context().newCDPSession(page);
  for (let i = 0; i < 3; i++) await cdp.send("HeapProfiler.collectGarbage");
  await cdp.detach();
  await page.evaluate(() => (window as any).__held.start());
  await page.waitForTimeout(ms);
  return page.evaluate(() => (window as any).__held.read());
}

test("switching Lobby and Plaza many times piles nothing up", async ({
  page,
}, info) => {
  test.setTimeout(300_000);
  await page.addInitScript(track);
  const errors = await openLobby(page);
  await page.evaluate(() => localStorage.setItem("ea-plaza-help", "1"));
  const round = async () => {
    for (const s of ["plaza", "lobby"]) await go(page, s);
  };
  // Two rounds first: every screen opened, its caches warm.
  await round();
  await round();
  const before = await held(page);
  // Standing on the Plaza (seen before) makes no pictures frame after frame.
  await go(page, "plaza");
  const plaza = await held(page, 2500);
  await go(page, "lobby");
  for (let i = 0; i < 8; i++) await round();
  const after = await held(page);
  info.annotations.push({
    type: "held",
    description: JSON.stringify({ before, plaza, after }),
  });
  expect(plaza.made, "canvases made in 2.5 s on the Plaza").toBeLessThanOrEqual(
    4,
  );
  // Only the Lobby's loops run behind the Lobby, as many as before.
  expect(after.perFrame).toBeLessThanOrEqual(before.perFrame);
  expect(after.intervals).toBe(before.intervals);
  expect(after.listeners).toBe(before.listeners);
  expect(after.contexts).toBe(before.contexts);
  // Kept pictures are capped caches (the fighters'
  // layers painted in quiet moments): small ones fill over the rounds
  // (about 1.3 Mpx in 8), never a pile. (With every hurdle picture kept,
  // about 2.8 Mpx a round.)
  expect(after.megapixels).toBeLessThanOrEqual(before.megapixels + 4);
  expect(after.canvases).toBeLessThanOrEqual(before.canvases + 150);
  expect(errors).toEqual([]);
});
