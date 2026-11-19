import { expect, test, type Page } from "@playwright/test";
import {
  openLobby,
  openPlayPanel,
  pushUntilBattle,
  createRoom,
} from "./helpers";

// An older iPhone (2–3 GB) ends a page that holds too much memory: a white
// screen, then a reload. Canvases are the hub's biggest holdings, so on an
// iPhone the Plaza's painted ground (30 MB, with the world around it) is
// let go while it waits behind another tab and painted again on return,
// and a raid gives its canvases and WebGL context back once it closes.
test.use({
  viewport: { width: 667, height: 375 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
});

/** Every canvas the page makes (weakly held) and every WebGL context. */
function trackCanvases() {
  const w = window as any;
  const canvases: WeakRef<HTMLCanvasElement>[] = [];
  const contexts: WeakRef<WebGLRenderingContext>[] = [];
  const create = Document.prototype.createElement;
  Document.prototype.createElement = function (
    this: Document,
    tag: string,
    ...rest: unknown[]
  ) {
    const e = create.call(this, tag, ...(rest as []));
    if (String(tag).toLowerCase() === "canvas")
      canvases.push(new WeakRef(e as HTMLCanvasElement));
    return e;
  } as typeof Document.prototype.createElement;
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    type: string,
    ...rest: unknown[]
  ) {
    const ctx = get.call(this, type as "2d", ...(rest as []));
    if (ctx && /webgl/.test(type) && this.width > 1)
      contexts.push(new WeakRef(ctx as unknown as WebGLRenderingContext));
    return ctx;
  } as typeof HTMLCanvasElement.prototype.getContext;
  w.__canvasSizes = () =>
    canvases
      .map((r) => r.deref())
      .filter((c): c is HTMLCanvasElement => !!c && c.width * c.height > 1)
      .map((c) => [c.width, c.height]);
  w.__liveContexts = () =>
    contexts.map((r) => r.deref()).filter((g) => g && !g.isContextLost())
      .length;
}

/** Canvases still alive after a full garbage collection, by size. */
async function liveCanvases(page: Page, closed = false) {
  // Development builds hand the open worlds to tests through globals; the
  // shipped game has none, and they would keep a closed world alive.
  if (closed)
    await page.evaluate(() => {
      for (const k of ["__plaza"])
        delete (window as any)[k];
    });
  const cdp = await page.context().newCDPSession(page);
  for (let i = 0; i < 3; i++) await cdp.send("HeapProfiler.collectGarbage");
  await cdp.detach();
  return page.evaluate(() => (window as any).__canvasSizes() as number[][]);
}
const big = (sizes: number[][]) =>
  sizes.filter(([w, h]) => w * h >= 2_000_000).map(([w, h]) => `${w}x${h}`);

test("an iPhone lets the hidden Plaza's ground go, and a raid's canvases", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.addInitScript(trackCanvases);
  const errors = await openLobby(page);
  await page.evaluate(() => localStorage.setItem("ea-plaza-help", "1"));
  await page.click('#hub-scenes [data-hub-scene="plaza"]');
  await expect(page.locator(".plaza-layer #pz-cv")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__plaza.groundAt(1350, 300)[3]),
    )
    .toBe(255);
  expect(big(await liveCanvases(page))).toEqual(["3300x2300"]);
  await page.click('#hub-scenes [data-hub-scene="lobby"]');
  await expect(page.locator("#lobby-play")).toBeVisible();
  // Behind the Lobby its ground is not kept (the scene is, paused).
  await expect
    .poll(async () => big(await liveCanvases(page)), { timeout: 20_000 })
    .toEqual([]);
  // Back on the Plaza its ground is painted again, the same as before.
  await page.click('#hub-scenes [data-hub-scene="plaza"]');
  await expect(page.locator(".plaza-layer #pz-cv")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__plaza.groundAt(1350, 300)[3]),
    )
    .toBe(255);
  expect(big(await liveCanvases(page))).toEqual(["3300x2300"]);

  // A raid: its floor, boss and map canvases and its WebGL context are let
  // go once it closes.
  await page.click('#hub-scenes [data-hub-scene="lobby"]');
  await page.evaluate(() =>
    (window as any).__room("raid", { boss: "tidewyrm" }),
  );
  await openPlayPanel(page);
  await createRoom(page);
  await pushUntilBattle(page);
  expect(await page.evaluate(() => (window as any).__liveContexts())).toBe(1);
  await page.evaluate(() => {
    const w = window as any;
    w.__snap.phase = "lobby";
    w.__push();
  });
  await expect(page.locator("#battle")).toBeHidden({ timeout: 30_000 });
  await expect
    .poll(
      async () => ({
        canvases: big(await liveCanvases(page, true)),
        contexts: await page.evaluate(() => (window as any).__liveContexts()),
      }),
      { timeout: 45_000, intervals: [2000] },
    )
    .toEqual({ canvases: [], contexts: 0 });
  expect(errors).toEqual([]);
});
