import { expect, test, type CDPSession, type Page } from "@playwright/test";
import { openHub } from "./helpers";

/**
 * Opening a screen again must not start it from scratch (the owner's
 * iPhone, Nov 2026: every tab and panel seemed to load again and the frame
 * jerked once while it filled in). On a repeat open, soon after the first:
 *
 * - no request goes to the server for what the screen already showed (each
 *   one used to come back as a second redraw of the screen);
 * - the screen is built once: nothing is rebuilt after it opened;
 * - the page's layout is read a few dozen times at most (each read after a
 *   change makes the browser lay the page out again then and there), and
 *   it is laid out only a few times;
 * - no canvas is made again for the screen (the Roster's portraits);
 * - and on a 4× slowed CPU no frame takes longer than LONG_FRAME_MS (more
 *   than the page's steady frame, where every frame was already long).
 *
 * A phone held sideways (956×440, an iPhone's landscape screen), touch.
 * Mostly counted, not timed: this machine draws on the CPU. The timed limit
 * is loose; what it guards against took two to three times as long.
 * On CI's runner every Lobby frame at 4× was a long one, 250-380 ms, before
 * anything opened (here they are not long at all), and the Profile's repeat
 * open had frames of 522-627 ms: its own work well within the limit, the
 * frame as a whole not (PR #237, 19 Nov). Where the page's frames are long
 * one after another, the limit counts from their median.
 * Frames are taken by when they started, after the tap: on a busy page the
 * browser reports a long frame up to seconds later, so taking those reported
 * while an open was measured counted the Lobby's frames from before the tap
 * and missed the open's own (the Shop's 470–630 ms frame read 0 here).
 */
const LONG_FRAME_MS = 450;
/**
 * How long PROBE takes on the 4× slowed page on an ordinary CI runner, the
 * runner LONG_FRAME_MS was set on. CI's runners are not all as fast: on
 * 22 Nov one ran every Lobby frame two to three times longer than usual,
 * and the Fighters' and the Raids' repeat opens read 584 and 682 ms with no
 * steady frame before the tap to count from (issue #338), while the same
 * code passed on the next run. So the limit grows with how much slower
 * than this the runner is at that moment, and never shrinks below
 * LONG_FRAME_MS.
 * An ordinary runner measured 94-104 ms (eight opens, run 45005564219,
 * 22 Nov 2026), so 110 holds it to LONG_FRAME_MS exactly. The probe times
 * script, not drawing: whether it also rises on a runner as slow as #338's
 * is not yet seen. Each open logs it ("probe"); check it when this fails.
 */
const PROBE_REF_MS = 110;
/**
 * The runner's speed, on the page as it is measured (same throttling): a
 * fixed piece of script, the median of three runs, in ms.
 */
const PROBE = () => {
  const once = () => {
    const t = performance.now();
    let x = 0;
    for (let i = 0; i < 2_000_000; i++) x = (x + Math.sqrt(i * 1.0001)) % 1e6;
    (window as any).__probeSink = x;
    return performance.now() - t;
  };
  const runs = [once(), once(), once()].sort((a, b) => a - b);
  return Math.round(runs[1]);
};
/** Layouts in the 1.5 s after a tap (the open, its entrance, settling). */
const MAX_LAYOUTS = 12;
/**
 * Reads of the page's layout (sizes, positions, scroll) in those 1.5 s.
 * The Shop read 53–55 and Missions 41–44 before their screens stopped
 * measuring on every open (Nov 2026); 20–34 since.
 */
const MAX_LAYOUT_READS = 40;
const SETTLE_MS = 1500;
/**
 * Item tiles' still effects (cosmetic-fx-preview.ts): two small canvases
 * per tile, each drawn once, a few per frame, never stalling one. Not
 * counted as a screen made again.
 */
const TILE_STILLS = ".raid-cosmetic-preview";

interface Panel {
  name: string;
  open: (page: Page) => Promise<unknown>;
  /** What it asks the server, after the server said records changed. */
  asks: string[];
  /** What else it shows from the server (comes with the news itself). */
  shows?: string[];
}
const rail = (action: string) => (page: Page) =>
  page.evaluate(
    (a) =>
      document
        .querySelector<HTMLElement>(`.lobby-rail [data-lobby-action="${a}"]`)!
        .click(),
    action,
  );
const PANELS: Panel[] = [
  {
    name: "profile",
    open: (page) => page.click("#account-profile"),
    asks: [
      "/api/progress",
      "/api/raids",
      "/api/account/name",
      "/api/matches/history",
    ],
  },
  {
    name: "raids",
    open: rail("raids"),
    asks: ["/api/raids", "/api/friends", "/api/spire"],
  },
  {
    name: "spire",
    open: (page) =>
      page.evaluate(() =>
        document.querySelector<HTMLElement>("#lobby-spire-card")!.click(),
      ),
    asks: ["/api/raids", "/api/spire"],
  },
  // (The economy itself comes fresh with the news that it changed.)
  {
    name: "shop",
    open: rail("shop"),
    asks: ["/api/raids"],
    shows: ["/api/economy"],
    // The Shop built its whole screen again on every open (about 1,500
    // elements) and took its live fighter back into it: 305-420 ms over
    // the steady frame on CI, 530-580 ms here, under its own 700 ms limit
    // (PR #237). It keeps its screen between opens now (ui/hub-panel.ts
    // park; 0-300 ms here) and is held to LONG_FRAME_MS like the rest
    // (issue #244, 20 Nov 2026).
  },
  {
    name: "missions",
    open: rail("missions"),
    asks: [],
    shows: ["/api/economy"],
  },
  { name: "friends", open: rail("friends"), asks: ["/api/friends"] },
  { name: "ranks", open: rail("ranks"), asks: ["/api/leaderboard"] },
  { name: "fighters", open: rail("fighters"), asks: [] },
];

/** Counters the page keeps while `__count.on` (see instrument). */
function instrument() {
  // Hosts whose insides effect code fills (an init script can't see the
  // module's constants).
  const EFFECT_OWNED = ".raid-cosmetic-preview, .shop-live-stage";
  // Layout reads (what forces a layout when the page has changed).
  const read = (proto: object, name: string) => {
    const d = Object.getOwnPropertyDescriptor(proto, name);
    if (!d) return;
    if (d.get)
      Object.defineProperty(proto, name, {
        ...d,
        get() {
          if (c.on) c.reads++;
          return d.get!.call(this);
        },
      });
    else if (typeof d.value === "function")
      Object.defineProperty(proto, name, {
        ...d,
        value(this: unknown, ...a: unknown[]) {
          if (c.on) c.reads++;
          return d.value.apply(this, a);
        },
      });
  };
  for (const n of ["offsetWidth", "offsetHeight", "offsetTop", "offsetLeft"])
    read(HTMLElement.prototype, n);
  for (const n of [
    "clientWidth",
    "clientHeight",
    "scrollWidth",
    "scrollHeight",
    "getBoundingClientRect",
    "getClientRects",
  ])
    read(Element.prototype, n);
  const c = ((window as any).__count = {
    on: false,
    asks: [] as string[],
    nodes: 0,
    late: 0,
    reads: 0,
    openedAt: 0,
    made: new WeakSet<Element>(),
  });
  new MutationObserver((list) => {
    if (!c.on) return;
    for (const r of list)
      for (const n of Array.from(r.addedNodes)) {
        const count =
          n.nodeType === 1
            ? 1 + (n as Element).getElementsByTagName("*").length
            : 0;
        c.nodes += count;
        // Built after the screen's first frame: a redraw when data came.
        // (Not what effect code adds to its own hosts: an item tile's
        // still effect, the live fighter's canvas moved into its stage.)
        if (
          performance.now() - c.openedAt > 250 &&
          (n as Element).closest?.(".ui-panel") &&
          !(n as Element).closest(EFFECT_OWNED)
        )
          c.late += count;
      }
  }).observe(document, { childList: true, subtree: true });
  const make = Document.prototype.createElement;
  Document.prototype.createElement = function (
    this: Document,
    tag: string,
    ...rest: any[]
  ) {
    const el = make.call(this, tag, ...rest) as HTMLElement;
    if (c.on && String(tag).toLowerCase() === "canvas") c.made.add(el);
    return el;
  } as typeof Document.prototype.createElement;
  (c as any).lastLong = 0;
  // The last long frames and what ran in them, for a failure to name
  // (and the ones of a measured open, for its longest-frame check).
  (c as any).longs = [] as string[];
  (c as any).all = [] as [number, number, string][];
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        // Busy: a long frame with work of the page's own in it. On CI's
        // runner every Lobby frame took 180-190 ms with no script at all
        // (its steady drawing there, PR #237, 19 Nov), so "no long frame
        // for 1.5 s" never came; here those frames stay under 50 ms.
        const own = ((e as any).scripts ?? []).reduce(
          (n: number, s: any) => n + (s.duration ?? 0),
          0,
        );
        if (own >= 30 || !("scripts" in e))
          (c as any).lastLong = e.startTime + e.duration;
        const scripts = ((e as any).scripts ?? []).slice(0, 3).map(
          (s: any) =>
            `${s.invoker} ${String(s.sourceURL ?? "")
              .split("/")
              .pop()}:${s.sourceFunctionName ?? ""} ${Math.round(s.duration)}`,
        );
        const longs = (c as any).longs as string[];
        longs.push(
          `${Math.round(e.startTime)} +${Math.round(e.duration)} ms [${scripts.join(", ")}]`,
        );
        if (longs.length > 30) longs.shift();
        // Every long frame by when it started: on a busy page the observer
        // hears of a frame up to seconds later (CI, PR #237: the Lobby's
        // frames from before a tap were reported during the open, and
        // none in the second before it), so frames are picked by start.
        const all = (c as any).all as [number, number, string][];
        all.push([e.startTime, e.duration, longs[longs.length - 1]]);
        if (all.length > 600) all.shift();
      }
    }).observe({ type: "long-animation-frame" });
  } catch {
    /* Not Chromium: no frame timings. */
  }
}
/** Count the client's own requests (after the harness's fake server). */
const watchRequests = (page: Page) =>
  page.evaluate(() => {
    const c = (window as any).__count;
    const f = window.fetch;
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
        location.href,
      );
      if (
        c.on &&
        url.pathname.startsWith("/api/") &&
        (init?.method ?? "GET") === "GET"
      )
        c.asks.push(url.pathname);
      return f(input, init);
    };
  });

async function layouts(cdp: CDPSession) {
  const { metrics } = await cdp.send("Performance.getMetrics");
  return metrics.find((m) => m.name === "LayoutCount")!.value;
}
const closePanel = (page: Page) =>
  page.evaluate(() =>
    document
      .querySelector<HTMLElement>(
        ".ui-panel:not([data-ui-leaving]) [data-ui-close]",
      )
      ?.click(),
  );

/**
 * Wait until nothing else keeps the page busy (fighter textures painted in
 * quiet moments, the Lobby redrawing after news): 1.5 s without a long
 * frame that ran 30 ms of script or more.
 */
const quiet = async (page: Page) => {
  // Nor pictures loading (fighter textures painted ahead decode one by one).
  await expect
    .poll(() => Date.now() - pictures.last, { timeout: 120_000 })
    .toBeGreaterThan(1500);
  await page
    .waitForFunction(
      () => performance.now() - (window as any).__count.lastLong > 1500,
      undefined,
      { timeout: 60_000, polling: 250 },
    )
    .catch(async (e) => {
      const longs = await page.evaluate(() => (window as any).__count.longs);
      throw new Error(
        `no 1.5 s without a long frame; the last ones:\n${longs.join("\n")}\n${e}`,
      );
    });
};
/** When the page last loaded a picture. */
const pictures = { last: 0 };
async function measure(
  page: Page,
  cdp: CDPSession,
  panel: Panel,
  o: { changed?: boolean } = {},
) {
  // The runner's speed now, before the wait for a quiet page (the probe is
  // a long frame of its own, which the wait then lets pass).
  const probe = await page.evaluate(PROBE);
  await quiet(page);
  // The server says records changed just before this open, not before the
  // wait: the Lobby's own friends check could ask again meanwhile, and the
  // open then showed that fresh copy without asking ("friends: asks for
  // /api/friends after a change", when the wait took a few seconds).
  if (o.changed)
    await page.evaluate(() => (window as any).__sock.fire("economy-changed"));
  // A second of the page as it is, for its steady frame (below).
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const c = (window as any).__count;
    Object.assign(c, {
      asks: [],
      nodes: 0,
      late: 0,
      reads: 0,
      made: new WeakSet(),
    });
    c.openedAt = performance.now();
    c.on = true;
  });
  const before = await layouts(cdp);
  const openAt = Date.now();
  // When the open's tap or click really came: Playwright may wait a while
  // for the button to hold still first on a slowed page.
  await page.evaluate(() => {
    const c = (window as any).__count;
    c.tapAt = undefined;
    const at = (e: Event) => {
      c.tapAt ??= e.timeStamp;
      document.removeEventListener("pointerdown", at, true);
      document.removeEventListener("click", at, true);
    };
    document.addEventListener("pointerdown", at, true);
    document.addEventListener("click", at, true);
  });
  await panel.open(page);
  await page.waitForTimeout(SETTLE_MS);
  const laidOut = (await layouts(cdp)) - before;
  const counted = await page.evaluate((stills) => {
    const c = (window as any).__count;
    c.on = false;
    return {
      asks: c.asks as string[],
      nodes: c.nodes as number,
      late: c.late as number,
      reads: c.reads as number,
      // Canvases made during this open that the screen shows (not the
      // background painting of fighter textures, nor one moved back in).
      canvases: Array.from(
        document.querySelectorAll(".ui-panel:not([data-ui-leaving]) canvas"),
      ).filter((el) => c.made.has(el) && !el.closest(stills)).length,
    };
  }, TILE_STILLS);
  await expect(page.locator(".ui-panel:not([data-ui-leaving])")).toBeVisible();
  await closePanel(page);
  await expect(
    page.locator(".ui-panel-host:not([data-ui-leaving])"),
  ).toHaveCount(0);
  const closedAt = Date.now();
  await page.waitForTimeout(800);
  // The open's frames: those that started from the tap through the settle
  // (all reported by now). The page's steady frame: where the second
  // before the tap was long frames one after another (over 70% of it),
  // their median; otherwise 0, and the limit is as it was.
  const frames = await page.evaluate(
    ({ settle }) => {
      const c = (window as any).__count;
      const tapAt = (c.tapAt as number | undefined) ?? Infinity;
      const all = c.all as [number, number, string][];
      // The frame with the tap in it, and those after it.
      const open = all.filter(([t, d]) => t + d > tapAt && t < tapAt + settle);
      const pre = all.filter(([t]) => t >= tapAt - 1000 && t < tapAt);
      const busy = pre.reduce((n, [, d]) => n + d, 0);
      const d = pre.map(([, d]) => d).sort((a, b) => a - b);
      return {
        tapped: c.tapAt !== undefined,
        worst: Math.round(Math.max(0, ...open.map(([, d]) => d))),
        steady: busy < 700 ? 0 : Math.round(d[d.length >> 1]),
        longs: [
          ...pre.map(([, , s]) => `before the tap: ${s}`),
          ...open.map(([, , s]) => s),
        ],
      };
    },
    { settle: SETTLE_MS },
  );
  return { ...counted, ...frames, laidOut, openAt, closedAt, probe };
}

test("a screen opened again shows what it had: no new requests, no rebuild, no long frame", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const context = await browser.newContext({
    viewport: { width: 956, height: 440 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  try {
    const page = await context.newPage();
    const requested: string[] = [];
    page.on("request", (r) => {
      requested.push(r.url());
      if (r.resourceType() !== "image") return;
      pictures.last = Date.now();
    });
    await page.addInitScript(() => {
      const w = window as any;
      // A player with raid records and a Spire climb (the Spire card shows).
      w.__raids = {
        loadout: {},
        clears: 2,
        highestPeril: 1,
        bestSeconds: 300,
        titles: [],
        cosmetics: [],
      };
      w.__spire = { best: 3, zones: [] };
    });
    await page.addInitScript(instrument);
    const errors = await openHub(page);
    await watchRequests(page);
    // Code the hub loads once in quiet moments after it opens (the other
    // worlds, the screens' own code): loaded before measuring, so a load
    // doesn't land in a measured open by chance.
    // (Waited for 30 s at most, in case one isn't loaded ahead.)
    await expect
      .poll(
        () =>
          [
            "plaza-screen",
            "screens/raid-hall",
            "screens/fitting-room",
            "screens/journey",
          ].every((n) => requested.some((u) => u.includes(n))),
        { timeout: 30_000 },
      )
      .toBe(true)
      .catch(() => undefined);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Performance.enable");
    const results: Record<string, unknown> = {};
    for (const panel of PANELS) {
      // The server says records changed (after a match, a raid, a
      // purchase): the next open asks for them again…
      const first = await measure(page, cdp, panel, { changed: true });
      for (const path of panel.asks)
        expect(
          first.asks,
          `${panel.name}: asks for ${path} after a change`,
        ).toContain(path);
      // …and again, on a phone-speed CPU.
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      const again = await measure(page, cdp, panel);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      results[panel.name] = { first, again };
      console.log(panel.name, JSON.stringify({ first, again }));
      // (The Lobby's own minute-long friends poll may land in the window.)
      expect(
        again.asks.filter((a) =>
          [...panel.asks, ...(panel.shows ?? [])].includes(a),
        ),
        `${panel.name}: requests for what it showed, on a repeat open`,
      ).toEqual([]);
      expect(
        again.asks.length,
        `${panel.name}: the same request twice on one open`,
      ).toBe(new Set(again.asks).size);
      expect(
        again.late,
        `${panel.name}: elements rebuilt after it opened`,
      ).toBe(0);
      expect(
        again.canvases,
        `${panel.name}: canvases made on a repeat open`,
      ).toBe(0);
      expect(
        again.laidOut,
        `${panel.name}: layouts on a repeat open, ${again.openAt - first.closedAt} ms after the first closed`,
      ).toBeLessThanOrEqual(MAX_LAYOUTS);
      expect(
        again.reads,
        `${panel.name}: layout reads on a repeat open`,
      ).toBeLessThanOrEqual(MAX_LAYOUT_READS);
      expect(again.tapped, `${panel.name}: the open's tap was seen`).toBe(true);
      // A runner slower than the one LONG_FRAME_MS was set on gets as much
      // more time (PROBE_REF_MS); a faster one is held to LONG_FRAME_MS.
      const slower = Math.max(1, again.probe / PROBE_REF_MS);
      const limit = Math.round(LONG_FRAME_MS * slower);
      expect(
        again.worst - again.steady,
        `${panel.name}: longest frame on a repeat open (ms) over the steady ${again.steady} ms, ${again.openAt - first.closedAt} ms after the first closed, limit ${limit} ms (runner probe ${again.probe} ms, ${slower.toFixed(2)}× the reference): ${again.longs.join("; ")}`,
      ).toBeLessThanOrEqual(limit);
    }
    console.log(JSON.stringify(results));
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
