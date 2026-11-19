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
 * - and on a 4× slowed CPU no frame takes longer than LONG_FRAME_MS.
 *
 * A phone held sideways (956×440, an iPhone's landscape screen), touch.
 * Mostly counted, not timed: this machine draws on the CPU. The timed limit
 * is loose; what it guards against took two to three times as long.
 */
const LONG_FRAME_MS = 450;
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
    asks: ["/api/progress", "/api/raids", "/api/account/name"],
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
    frames: [] as number[],
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
  // The last long frames and what ran in them, for a failure to name.
  (c as any).longs = [] as string[];
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (c.on) c.frames.push(e.duration);
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
 * quiet moments, the Lobby redrawing after news): 1.5 s without a long frame.
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
  await quiet(page);
  // The server says records changed just before this open, not before the
  // wait: the Lobby's own friends check could ask again meanwhile, and the
  // open then showed that fresh copy without asking ("friends: asks for
  // /api/friends after a change", when the wait took a few seconds).
  if (o.changed)
    await page.evaluate(() => (window as any).__sock.fire("economy-changed"));
  await page.evaluate(() => {
    const c = (window as any).__count;
    Object.assign(c, {
      asks: [],
      nodes: 0,
      late: 0,
      reads: 0,
      made: new WeakSet(),
      frames: [],
    });
    c.openedAt = performance.now();
    c.on = true;
  });
  const before = await layouts(cdp);
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
      worst: Math.round(Math.max(0, ...(c.frames as number[]))),
    };
  }, TILE_STILLS);
  await expect(page.locator(".ui-panel:not([data-ui-leaving])")).toBeVisible();
  await closePanel(page);
  await expect(
    page.locator(".ui-panel-host:not([data-ui-leaving])"),
  ).toHaveCount(0);
  await page.waitForTimeout(800);
  return { ...counted, laidOut };
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
        weekly: [],
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
        `${panel.name}: layouts on a repeat open`,
      ).toBeLessThanOrEqual(MAX_LAYOUTS);
      expect(
        again.reads,
        `${panel.name}: layout reads on a repeat open`,
      ).toBeLessThanOrEqual(MAX_LAYOUT_READS);
      expect(
        again.worst,
        `${panel.name}: longest frame on a repeat open (ms)`,
      ).toBeLessThanOrEqual(LONG_FRAME_MS);
    }
    console.log(JSON.stringify(results));
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
