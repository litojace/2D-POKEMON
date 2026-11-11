import { expect, test, type Page } from "@playwright/test";
import { openLobby, openPlaza, snap } from "./helpers";
import { fakeBistro } from "./bistro-fake";
import { setInsets } from "./ui-measure";

// An iPad Pro 13" home-screen app held sideways (1376×1032): iPadOS keeps
// its status bar (the clock, the app's name, wifi, battery) over the top
// of the page, about 32 pt. The header row sat right against it, half lost
// in the soft fade iPadOS draws along its edge, and the rows below it
// (placed as if the header were 10px from the top) ran into the header
// (owner's screenshot, 11 Nov 2026). Now the header is 12px under the bar
// and every row below moves down with it; without a bar nothing moves.
const IPAD =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const HEADER = [
  "#account-profile",
  "#hub-scenes",
  "#account-coins > *",
  "#account-leaves > *",
  ".header-menu > summary",
  // The Bistro's and the Farm's badges take the player card's place.
  ".bs-badge",
  ".fm-badge",
];

/** Header boxes, and every placed box in the scene that runs into one (or into the bar). */
const measure = (page: Page, layer: string) =>
  page.evaluate(
    ({ layer, header }) => {
      const shown = (e: Element) => {
        const r = e.getBoundingClientRect();
        const s = getComputedStyle(e);
        return (
          r.width > 0 &&
          r.height > 0 &&
          s.visibility !== "hidden" &&
          s.display !== "none" &&
          s.opacity !== "0"
        );
      };
      const headEls = header
        .flatMap((sel) => Array.from(document.querySelectorAll(sel)))
        .filter(shown);
      const heads = headEls.map((e) => ({
        name: e.id || e.className.toString().slice(0, 20),
        r: e.getBoundingClientRect(),
      }));
      const root = document.querySelector(layer)!;
      const clashes: string[] = [];
      for (const e of Array.from(root.querySelectorAll("*"))) {
        const s = getComputedStyle(e);
        // The header's own boxes and what is inside them.
        if (headEls.some((h) => h.contains(e) || e.contains(h))) continue;
        if (
          !/fixed|absolute/.test(s.position) ||
          !shown(e) ||
          e.tagName === "CANVAS"
        )
          continue;
        if (s.pointerEvents === "none" && !e.textContent?.trim()) continue; // decoration
        const r = e.getBoundingClientRect();
        // Whole-screen layers and backdrops are not rows.
        if (r.width > innerWidth * 0.6 || r.height > innerHeight * 0.6)
          continue;
        for (const h of heads) {
          const gapX = Math.max(h.r.left - r.right, r.left - h.r.right);
          const gapY = Math.max(h.r.top - r.bottom, r.top - h.r.bottom);
          // Overlapping, or touching (closer than 4px) right under it.
          if (gapX < 0 && gapY < 4)
            clashes.push(
              `${(e.className || e.tagName).toString().slice(0, 30)} ${Math.round(r.top)}–${Math.round(r.bottom)} vs ${h.name} ${Math.round(h.r.top)}–${Math.round(h.r.bottom)}`,
            );
        }
      }
      return { top: Math.min(...heads.map((h) => h.r.top)), clashes };
    },
    { layer, header: HEADER },
  );

async function ipad(browser: import("@playwright/test").Browser) {
  return browser.newContext({
    viewport: { width: 1376, height: 1032 },
    isMobile: true,
    hasTouch: true,
    userAgent: IPAD,
  });
}

for (const bar of [32, 0])
  test(`the hub keeps its header clear of an iPad status bar of ${bar}px`, async ({
    browser,
  }, info) => {
    test.setTimeout(180_000);
    const context = await ipad(browser);
    try {
      const page = await context.newPage();
      const errors = await openLobby(page);
      await setInsets(page, { top: bar });
      const check = async (scene: string, layer: string) => {
        await page.waitForTimeout(600);
        const m = await measure(page, layer);
        // 12px under a bar; 10px from the top without one, as before.
        expect(m.top, `${scene}: header top`).toBeCloseTo(
          bar ? bar + 12 : 10,
          0,
        );
        expect(m.clashes, `${scene}: rows running into the header`).toEqual([]);
        await snap(page, info, `ipad-status-bar-${bar}-${scene}`);
      };
      await check("lobby", ".lobby-layer");
      await page.click('#hub-scenes [data-hub-scene="plaza"]');
      await expect(page.locator(".plaza-layer #pz-cv")).toBeVisible();
      await check("plaza", ".plaza-layer");
      await fakeBistro(page);
      await page.click('#hub-scenes [data-hub-scene="bistro"]');
      await page.waitForFunction(() => (window as any).__bistro?.sync().ready);
      await check("bistro", ".bistro-layer");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
