import { expect, test, type Page } from "@playwright/test";
import { onPlayersLook } from "./players-look";

/**
 * Every Lobby panel is ready the moment the curtain lifts (owner, 28 Nov:
 * "tapping any tile never shows a wait, not even a short second"). The
 * loading screen asks for each panel's data and loads their code; a panel
 * then opens on that copy and asks again behind it.
 *
 * With every answer from the server held back (API_DELAY_MS, a slow
 * phone connection's round trip), a fresh start, and a tap on each panel
 * the moment the curtain starts to fade, no panel may show a loading
 * state ("Loading…", "One moment…", aria-busy) at any frame, nor build its
 * contents again after its first frame (a blank-then-filled panel).
 *
 * LOBBY_READY_MEASURE=1 instead measures, and judges nothing: startup time,
 * each panel's tap-to-complete time, and memory, at 844×390 with the CPU
 * slowed 4× and at desktop, on a slow and a quick connection. What the PR
 * reports came from it.
 */
onPlayersLook();

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
/** A slow phone connection's round trip, for each API answer. */
const API_DELAY_MS = 600;

interface Panel {
  name: string;
  /** Click what opens it (in the page). */
  open: string;
}
const rail = (a: string) =>
  `document.querySelector('.lobby-rail [data-lobby-action="${a}"]').click()`;
const PANELS: Panel[] = [
  { name: "fighters", open: rail("fighters") },
  { name: "shop", open: rail("shop") },
  { name: "raids", open: rail("raids") },
  { name: "missions", open: rail("missions") },
  { name: "ranks", open: rail("ranks") },
  { name: "friends", open: rail("friends") },
  { name: "profile", open: `document.querySelector('#account-profile').click()` },
  {
    name: "journey",
    open: `document.querySelector('#lobby-journey-card').click()`,
  },
];

/**
 * Before the page: every GET to the account API answers `delay` ms late
 * (the harness's fake replaces window.fetch; this wraps whatever it sets),
 * and the moments the curtain starts to fade and is gone are noted.
 */
async function prepare(page: Page, delay: number) {
  await page.addInitScript(
    ({ delay, account }) => {
      try {
        localStorage.setItem(`arena-tour:${account}`, "done");
        localStorage.setItem("ea-hub-scene", "lobby");
        if (localStorage.getItem("ea-graphics") === null)
          localStorage.setItem("ea-graphics", "high");
      } catch {
        /* No storage. */
      }
      performance.setResourceTimingBufferSize(5000);
      const w = window as any;
      w.__asks = [] as string[];
      const native = window.fetch.bind(window);
      let inner: typeof fetch | undefined;
      const slow: typeof fetch = async (input, init) => {
        const url = String(input instanceof Request ? input.url : input);
        if (/\/api\//.test(url) && (init?.method ?? "GET") === "GET") {
          w.__asks.push(url.replace(/^.*?\/api\//, "/api/"));
          if (delay) await new Promise((r) => setTimeout(r, delay));
        }
        return inner!(input, init);
      };
      Object.defineProperty(window, "fetch", {
        configurable: true,
        get: () => (inner ? slow : native),
        set: (v) => (inner = v),
      });
      new MutationObserver(() => {
        const c = document.getElementById("server-startup");
        if (c?.classList.contains("is-leaving")) w.__curtainLifts ??= performance.now();
        if (w.__curtainSeen && !c) w.__curtainGone ??= performance.now();
        if (c) w.__curtainSeen = true;
      }).observe(document, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
      });
    },
    { delay, account: ACCOUNT },
  );
}

/** Start the game and wait for the curtain to start lifting. */
async function start(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).__sock);
  // The client listens for "connect" once its account has loaded.
  await page.evaluate(() => {
    const t = setInterval(() => {
      if (document.querySelector("#lobby-play")) clearInterval(t);
      (window as any).__sock.fire("connect");
    }, 50);
  });
  await page.waitForFunction(() => (window as any).__curtainLifts, null, {
    timeout: 60_000,
    polling: 16,
  });
}

/**
 * Tap the panel and watch it every frame for `settle` ms: when it first
 * shows, when it is complete (no loading text, nothing busy, its pictures
 * in), whether a loading state ever showed, and how many elements were
 * built inside it after its first frame.
 */
async function openAndWatch(page: Page, panel: Panel, settle: number) {
  return page.evaluate(
    ({ open, settle }) =>
      new Promise<{
        shownMs: number;
        completeMs: number;
        loading: string;
        late: number;
        kind: string;
        picturesMs: number;
        pictures: number;
      }>((resolve) => {
        const lifts = (window as any).__curtainLifts as number;
        const t0 = performance.now();
        let shownAt = 0;
        let completeAt = 0;
        let loading = "";
        let late = 0;
        let kind = "";
        // On screen pictures (lazy ones too): when all are drawn.
        let picturesAt = 0;
        let pictureCount = 0;
        const find = () =>
          Array.from(
            document.querySelectorAll<HTMLElement>(
              ".ui-panel:not([data-ui-leaving])",
            ),
          ).at(-1);
        new MutationObserver((list) => {
          if (!shownAt) return;
          const p = find();
          for (const r of list)
            for (const n of Array.from(r.addedNodes))
              if (
                n.nodeType === 1 &&
                p?.contains(n) &&
                // What effect code fills in its own hosts is not a redraw.
                !(n as Element).closest(
                  ".raid-cosmetic-preview, .shop-live-stage, .fighter-rig-stage, canvas",
                ) &&
                performance.now() - shownAt > 120
              )
                late += 1 + (n as Element).getElementsByTagName("*").length;
        }).observe(document.body, { childList: true, subtree: true });
        const frame = () => {
          const now = performance.now();
          const p = find();
          if (p && p.getClientRects().length) {
            shownAt ||= now;
            kind ||= p.className;
            const text = p.innerText;
            // (The Shop's live fighter is busy while its rig is built, over
            // its still picture: that is the live rig, not a wait for data.)
            const busy = Array.from(
              p.querySelectorAll('[aria-busy="true"]'),
            ).find((b) => !b.closest(".shop-live-stage, .fighter-rig-stage"));
            const wait =
              /Loading|One moment/i.exec(text)?.[0] ??
              (busy ? `aria-busy ${busy.className}` : "");
            const pictures = Array.from(p.querySelectorAll("img")).every(
              (i) => i.loading === "lazy" || (i.complete && i.naturalWidth > 0),
            );
            if (wait && !loading) loading = `${wait} at ${Math.round(now - t0)} ms`;
            if (!wait && pictures) completeAt ||= now;
            else completeAt = 0;
            const seen = Array.from(p.querySelectorAll("img")).filter((i) => {
              const r = i.getBoundingClientRect();
              return (
                r.width > 0 &&
                r.bottom > 0 &&
                r.right > 0 &&
                r.top < innerHeight &&
                r.left < innerWidth
              );
            });
            pictureCount = seen.length;
            if (seen.every((i) => i.complete && i.naturalWidth > 0))
              picturesAt ||= now;
            else picturesAt = 0;
          }
          if (now - t0 < settle) requestAnimationFrame(frame);
          else
            resolve({
              shownMs: shownAt ? Math.round(shownAt - t0) : -1,
              completeMs: completeAt ? Math.round(completeAt - t0) : -1,
              loading,
              late,
              picturesMs: picturesAt ? Math.round(picturesAt - t0) : -1,
              pictures: pictureCount,
              kind: `${kind} (tapped ${Math.round(t0 - lifts)} ms after the lift)`,
            });
        };
        new Function(open)();
        requestAnimationFrame(frame);
      }),
    { open: panel.open, settle },
  );
}

const MEASURE = !!process.env.LOBBY_READY_MEASURE;

test.describe("every Lobby panel is ready when the curtain lifts", () => {
  test.skip(MEASURE, "LOBBY_READY_MEASURE: measuring instead");
  for (const panel of PANELS)
    test(`${panel.name}: no wait on a slow connection`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 844, height: 390 });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await prepare(page, API_DELAY_MS);
      await start(page);
      const seen = await openAndWatch(page, panel, 2500);
      console.log(panel.name, JSON.stringify(seen));
      expect(seen.shownMs, "the panel opened").toBeGreaterThanOrEqual(0);
      expect(seen.loading, "a loading state showed").toBe("");
      expect(seen.late, "elements built after the first frame").toBe(0);
      expect(seen.completeMs, "complete").toBeGreaterThanOrEqual(0);
      expect(errors).toEqual([]);
    });
});

test.describe("measure", () => {
  test.skip(!MEASURE, "set LOBBY_READY_MEASURE=1");
  const SETUPS = [
    { name: "phone-4x-slow", w: 844, h: 390, cpu: 4, delay: API_DELAY_MS },
    { name: "phone-4x-quick", w: 844, h: 390, cpu: 4, delay: 60 },
    { name: "desktop-quick", w: 1440, h: 900, cpu: 1, delay: 60 },
  ];
  // The Lobby's frames in the 8 s after the curtain starts to lift, no
  // tap: anything still loading then competes with the Lobby's fighter.
  for (const s of SETUPS.filter((s) => s.cpu > 1))
    test(`${s.name} lobby frames after the lift`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: s.w, height: s.h });
      await prepare(page, s.delay);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: s.cpu });
      await start(page);
      const frames = await page.evaluate(
        () =>
          new Promise<{ fps: number; longest: number; over50: number }>(
            (resolve) => {
              const t0 = performance.now();
              let last = t0;
              let n = 0;
              let longest = 0;
              let over50 = 0;
              const f = (t: number) => {
                const d = t - last;
                last = t;
                n++;
                longest = Math.max(longest, d);
                if (d > 50) over50++;
                if (t - t0 < 8000) requestAnimationFrame(f);
                else
                  resolve({
                    fps: Math.round((n / ((t - t0) / 1000)) * 10) / 10,
                    longest: Math.round(longest),
                    over50,
                  });
              };
              requestAnimationFrame(f);
            },
          ),
      );
      console.log(`MEASURE ${JSON.stringify({ setup: s.name, panel: "lobby-frames", ...frames })}`);
    });
  const ONLY = process.env.LOBBY_READY_ONLY?.split(",");
  for (const s of SETUPS)
    for (const panel of PANELS) {
      if (ONLY && !ONLY.includes(panel.name)) continue;
      test(`${s.name} ${panel.name}`, async ({ page }) => {
        test.setTimeout(180_000);
        await page.setViewportSize({ width: s.w, height: s.h });
        if (process.env.LOBBY_READY_LOW)
          await page.addInitScript(() =>
            localStorage.setItem("ea-graphics", "low"),
          );
        await prepare(page, s.delay);
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: s.cpu });
        await start(page);
        const startup = await page.evaluate(() => ({
          lifts: Math.round((window as any).__curtainLifts),
        }));
        const seen = await openAndWatch(page, panel, 6000);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
        await cdp.send("HeapProfiler.collectGarbage");
        const heap = await cdp.send("Runtime.getHeapUsage");
        const images = await page.evaluate(() => {
          const imgs = performance
            .getEntriesByType("resource")
            .filter((e) =>
              /\.(png|webp|jpe?g|svg|avif)(\?|$)/.test(e.name),
            ) as PerformanceResourceTiming[];
          const decoded = Array.from(document.images).filter(
            (i) => i.complete && i.naturalWidth > 0,
          );
          return {
            fetched: imgs.length,
            inPage: decoded.length,
            inPageMB:
              Math.round(
                (decoded.reduce(
                  (n, i) => n + i.naturalWidth * i.naturalHeight * 4,
                  0,
                ) /
                  1048576) *
                  10,
              ) / 10,
          };
        });
        const row = {
          setup: s.name,
          panel: panel.name,
          liftMs: startup.lifts,
          ...seen,
          heapMB: Math.round((heap.usedSize / 1048576) * 10) / 10,
          ...images,
          asks: await page.evaluate(() => (window as any).__asks.length),
        };
        console.log(`MEASURE ${JSON.stringify(row)}`);
      });
    }
});
