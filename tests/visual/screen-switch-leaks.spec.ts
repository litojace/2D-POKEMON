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
  /** Where this window's canvases were made (a failure lists them). */
  let from: string[] = [];
  const create = Document.prototype.createElement;
  Document.prototype.createElement = function (
    this: Document,
    tag: string,
    ...rest: unknown[]
  ) {
    const e = create.call(this, tag, ...(rest as []));
    if (String(tag).toLowerCase() === "canvas") {
      // The fighters' rig layers painted ahead in quiet moments
      // (fighter-prepaint.ts) are a cache that warms one layer every few
      // seconds (still going 25 s into this test with the CPU slowed 3×),
      // whatever screen is shown: not this screen's pictures. They still
      // count as held.
      const at = new Error().stack?.split("\n").slice(2, 4).join(" ") ?? "";
      // A fighter look's Plaza sprite, baked once the first time that look
      // is seen (plaza-sprite.ts), counted to wait for the baking to end.
      if (at.includes("plaza-sprite")) w.__sprites = (w.__sprites ?? 0) + 1;
      if (!at.includes("fighter-prepaint")) {
        made++;
        from.push(at.replace(/\s+/g, " ").trim());
      }
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
      from = [];
    },
    read() {
      const live = canvases
        .map((r) => r.deref())
        .filter((c): c is HTMLCanvasElement => !!c && c.width * c.height > 1);
      return {
        /** Callbacks run per page frame (each running loop adds one). */
        perFrame: Math.round((ran / Math.max(1, frames)) * 10) / 10,
        made,
        from,
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
  from: string[];
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

/**
 * Behind the Lobby an iPhone's Plaza lets go of its painted ground (3300 x
 * 2300, 7.6 Mpx) once the page is idle, within requestIdleCallback's 3 s
 * timeout (plaza-scene.ts hide()). Measured sooner, on a slow runner it was
 * still held: 17.8 Mpx against 9.9 (CI, 19 Nov 2026), a pending release,
 * not a pile.
 */
const GROUND_RELEASE_MS = 3200;

/**
 * Loops running behind this screen: callbacks per page frame, over three
 * 1.5 s windows, each window's highest or lowest (`pick`). A loop left
 * running shows in every window. A slow CI runner sometimes read one
 * window wrong (#422, #429): 0 "before" (the Lobby's two loops not running
 * that moment, or no frame drawn) against a normal 2 after, or a few
 * one-shot callbacks over one or two frames read as 5. Locally the Lobby
 * reads 2 in every window (Phaser's step, home-navigation's poll).
 */
async function loops(page: Page, pick: "most" | "least") {
  const reads: number[] = [];
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => (window as any).__held.start());
    await page.waitForTimeout(1500);
    reads.push(
      await page.evaluate(() => (window as any).__held.read().perFrame),
    );
  }
  return {
    value: pick === "most" ? Math.max(...reads) : Math.min(...reads),
    reads,
  };
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
  await page.waitForTimeout(GROUND_RELEASE_MS);
  const before = await held(page);
  // The Lobby's own loops: the most any window saw.
  const beforeLoops = await loops(page, "most");
  // Standing on the Plaza (seen before) makes no pictures frame after frame.
  await go(page, "plaza");
  // Each townsfolk look is baked into a sprite (two canvases, full and
  // flat) once, the first time it is seen: 13 looks over this test. On a
  // slow runner the last of those first bakes were still landing here (8
  // canvases, all plaza-sprite.ts bakeSprite, CI 19 Nov 2026); a look seen
  // before is never baked again. Wait for them to end, then measure.
  const sprites = () => page.evaluate(() => (window as any).__sprites ?? 0);
  await expect
    .poll(
      async () => {
        const from = await sprites();
        await page.waitForTimeout(1500);
        return (await sprites()) - from;
      },
      {
        timeout: 60_000,
        intervals: [0],
        message: "Plaza sprites still baking",
      },
    )
    .toBe(0);
  const plaza = await held(page, 2500);
  await go(page, "lobby");
  for (let i = 0; i < 8; i++) await round();
  await page.waitForTimeout(GROUND_RELEASE_MS);
  const after = await held(page);
  // Loops that never stop: the fewest any window saw.
  const afterLoops = await loops(page, "least");
  info.annotations.push({
    type: "held",
    description: JSON.stringify({
      before,
      plaza,
      after,
      loops: { before: beforeLoops.reads, after: afterLoops.reads },
    }),
  });
  expect(
    plaza.made,
    `canvases made in 2.5 s on the Plaza (${plaza.from.join("; ")})`,
  ).toBeLessThanOrEqual(4);
  // Only the Lobby's loops run behind the Lobby, as many as before. A loop
  // left running adds a whole callback to every frame; a one-shot callback
  // (a fade, a row's edge mark) adds a fraction, the more so where frames
  // are slow: CI's 1.5 s window holds a few frames, and read 2 before and
  // 2.3 after with no loop left over. So whole loops are compared, and a
  // leaked one must show in every window after (loops()).
  expect(
    Math.floor(afterLoops.value),
    `loops per frame behind the Lobby (before ${beforeLoops.reads.join(", ")}; after ${afterLoops.reads.join(", ")})`,
  ).toBeLessThanOrEqual(Math.floor(beforeLoops.value));
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
