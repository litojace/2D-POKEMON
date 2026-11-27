import { expect, test, type Page } from "@playwright/test";
import { openLobby, snap } from "./helpers";

// The Shop on Poster on a tablet held sideways (an iPad: a touch screen
// taller than a phone, so the phone hit areas of ui/phone-fit.css don't
// apply). Two bugs at 1024×768:
// - the four Anton tabs didn't fit beside Shop | Wardrobe, and Collections
//   sat hidden under the close button;
// - the stage's buttons (Entrance / Victory / Ultimate, Hold to compare, the
//   Awakening stages I / II / III) and Shop | Wardrobe were 32-34 px tall.
// Every control is probed through elementFromPoint, so a hit area counts.
const SIZES = [
  { width: 1024, height: 768 },
  { width: 1180, height: 820 },
];

async function openShop(page: Page) {
  await page.addInitScript(() => {
    if (!location.search) history.replaceState(null, "", "/?ui=poster");
  });
  const errors = await openLobby(page);
  await page.click('.lobby-rail [data-lobby-action="shop"]');
  await expect(page.locator(".fit-room[data-fit-mode='shop']")).toBeVisible();
  await page.waitForTimeout(600);
  return errors;
}

for (const size of SIZES)
  test(`the tablet Shop: all four tabs show and every control takes a finger at ${size.width}x${size.height}`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: size,
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      const errors = await openShop(page);
      await expect(page.locator(".fit-awaken .ui-btn")).toHaveCount(3);
      const report = await page.evaluate(() => {
        const close = document
          .querySelector(".fit-head .ui-close")!
          .getBoundingClientRect();
        const tabs = [
          ...document.querySelectorAll<HTMLElement>(
            ".fit-head .ui-tabs > button[role='tab']",
          ),
        ].map((t) => {
          const r = t.getBoundingClientRect();
          const e = document.elementFromPoint(
            r.left + r.width / 2,
            r.top + r.height / 2,
          );
          return {
            name: t.textContent!.trim(),
            reachable: e === t || t.contains(e),
            clearOfClose: r.right <= close.left || r.top >= close.bottom,
          };
        });
        const reach = [
          ...document.querySelectorAll<HTMLElement>(
            ".fit-head .ui-seg > button, .fit-head .ui-tabs > button, .fit-plays .ui-btn, .fit-stage-tools .ui-btn",
          ),
        ].map((b) => {
          const r = b.getBoundingClientRect(),
            cx = r.left + r.width / 2,
            cy = r.top + r.height / 2;
          const hits = (x: number, y: number) => {
            const e = document.elementFromPoint(x, y);
            return e === b || b.contains(e);
          };
          let down = 0,
            across = 0;
          for (let y = r.top - 20; y < r.bottom + 20; y++)
            if (hits(cx, y)) down++;
          for (let x = r.left - 20; x < r.right + 20; x++)
            if (hits(x, cy)) across++;
          return { name: b.textContent!.trim(), down, across };
        });
        return { tabs, reach };
      });
      expect(report.tabs.map((t) => t.name)).toEqual([
        expect.stringContaining("Today"),
        "Skins",
        "Mythic Hall",
        "Collections",
      ]);
      for (const t of report.tabs) {
        expect(t.reachable, `${t.name} takes a tap`).toBe(true);
        expect(t.clearOfClose, `${t.name} clear of the close button`).toBe(
          true,
        );
      }
      expect(report.reach.length).toBeGreaterThanOrEqual(10);
      for (const r of report.reach) {
        expect(r.down, `${r.name} hit area down`).toBeGreaterThanOrEqual(44);
        expect(r.across, `${r.name} hit area across`).toBeGreaterThanOrEqual(
          44,
        );
      }
      await snap(page, info, `poster-shop-tablet-${size.width}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
