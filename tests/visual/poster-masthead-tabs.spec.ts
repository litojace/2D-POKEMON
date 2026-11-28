import { expect, test, type Page } from "@playwright/test";
import { hubMenu, openHub, skipTour, snap } from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";

// Poster's chosen tab is a slanted ink block. Two things the owner saw in
// the Shop's masthead (27 Nov 2026):
// - The block's slanted edge ended in an upright stub. The tab was skewed
//   about its middle, so its foot reached 3 px left of its box and its top
//   3 px right (5 px on a desktop's taller tabs); a masthead's tab row has
//   no padding and cuts what leaves it, so the first tab lost its foot's
//   corner (TODAY, the Profile's OVERVIEW) and the last its top corner
//   (COLLECTIONS on a tablet, where that corner also made the row scroll
//   by 4 px and fade its right edge).
// - On a tablet, where the Shop's head is two rows, the masthead's left
//   edge stepped in by 1 px below the first row.
const SIZES = [
  { width: 667, height: 375, phone: true },
  { width: 844, height: 390, phone: true },
  { width: 852, height: 393, phone: true, inset: ISLAND },
  { width: 1024, height: 768, phone: false },
];

const withPoster = (page: Page) =>
  page.addInitScript(() => {
    if (!location.search) history.replaceState(null, "", "/?ui=poster");
  });

/** The screen on top: tab rows are looked for inside it. */
const TOP = ".ui-panel-host:not([data-ui-parked]) > .ui-panel";

/**
 * Choose the first or the last tab of the top screen's tab row, bring it to
 * its end of the row, and measure the chosen tab's box on screen (slant
 * included) against the row's.
 */
async function chosenTab(page: Page, which: "first" | "last") {
  const tabs = page.locator(`${TOP} .ui-tabs > button[role="tab"]`);
  await (which === "first" ? tabs.first() : tabs.last()).click();
  await expect(which === "first" ? tabs.first() : tabs.last()).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.waitForTimeout(450);
  await page.evaluate(
    ([top, which]) => {
      const row = document.querySelector<HTMLElement>(`${top} .ui-tabs`)!;
      row.scrollLeft = which === "first" ? 0 : row.scrollWidth;
    },
    [TOP, which],
  );
  // The row's edges are marked in the next frame (ui/scroll-rows.ts).
  await page.waitForTimeout(150);
  return page.evaluate((top) => {
    const row = document.querySelector<HTMLElement>(`${top} .ui-tabs`)!;
    const tab = row.querySelector<HTMLElement>(
      ':scope > button[aria-selected="true"]',
    )!;
    const r = row.getBoundingClientRect(),
      t = tab.getBoundingClientRect();
    return {
      name: tab.textContent!.trim(),
      slanted: getComputedStyle(tab).transform !== "none",
      left: +(t.left - r.left).toFixed(2),
      right: +(r.right - t.right).toFixed(2),
      // How far the row scrolls sideways.
      over: row.scrollWidth - row.clientWidth,
      fadeRight: row.classList.contains("has-more-right"),
      fadeLeft: row.classList.contains("has-more-left"),
    };
  }, TOP);
}

async function closeTop(page: Page) {
  await page.locator(`${TOP}:not([data-ui-leaving]) .ui-close`).last().click();
  await page.waitForTimeout(400);
}

/** Colours of a screenshot's pixels, read through a canvas in the page. */
async function pixels(page: Page, points: [number, number][]) {
  const shot = (await page.screenshot()).toString("base64");
  return page.evaluate(
    async ([b64, pts]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0);
      return (pts as [number, number][]).map(([x, y]) =>
        [...g.getImageData(x, y, 1, 1).data].slice(0, 3).join(","),
      );
    },
    [shot, points] as const,
  );
}

for (const size of SIZES) {
  const name = `${size.width}x${size.height}${size.inset ? "-island" : ""}`;
  test(`Poster: the chosen tab's slanted block stays whole in its row (${name})`, async ({
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      await skipTour(page);
      await withPoster(page);
      const errors = await openHub(page);
      if (size.inset) await setInsets(page, size.inset);
      await page.evaluate(() => document.fonts.ready);

      const screens: [string, () => Promise<unknown>][] = [
        ["shop", () => hubMenu(page, "shop")],
        ["profile", () => page.click("#account-profile")],
        ["journey", () => hubMenu(page, "journey")],
        [
          "fighter",
          async () => {
            await hubMenu(page, "fighters");
            await page.click('[data-roster-card="cindrake"]');
            await page.click("[data-roster-details]");
          },
        ],
      ];
      for (const [screen, open] of screens) {
        await open();
        await expect(page.locator(`${TOP} .ui-tabs`).last()).toBeVisible();
        await page.waitForTimeout(700);
        for (const which of ["first", "last"] as const) {
          const tab = await chosenTab(page, which);
          const where = `${screen}, ${which} tab (${tab.name}): ${JSON.stringify(tab)}`;
          expect(tab.slanted, where).toBe(true);
          // The whole block, slant included, inside the row that cuts it.
          expect(tab.left, where).toBeGreaterThanOrEqual(-0.5);
          expect(tab.right, where).toBeGreaterThanOrEqual(-0.5);
          // The room for the slant costs the row none: every row that
          // showed all its tabs still does. Not the Shop's on a phone: it
          // fits to the pixel at 852 x 393 with the Dynamic Island here, but
          // CI's renderer sets its labels a little wider and the row
          // scrolls by 9 px there, as it does on main (the lean room adds
          // as much to the row's box as to its content, so it never changes
          // how far a row scrolls).
          if (!(screen === "shop" && size.phone))
            expect(tab.over, where).toBeLessThanOrEqual(1);
          // No faded "more this way" edge on the side the chosen tab ends
          // at: the slant's corner used to count as more to scroll to.
          expect(which === "first" ? tab.fadeLeft : tab.fadeRight, where).toBe(
            false,
          );
          await snap(page, info, `poster-tab-${screen}-${which}-${name}`);
        }
        if (screen === "shop") {
          // The masthead's left edge is one line from its top to its foot:
          // the pixel beside it is the same colour beside both rows.
          const head = await page.locator(".fit-head").evaluate((el) => {
            const r = el.getBoundingClientRect();
            return { left: r.left, top: r.top, bottom: r.bottom };
          });
          const x = Math.round(head.left) - 1;
          const [high, low, inside] = await pixels(page, [
            [x, Math.round(head.top) + 6],
            [x, Math.round(head.bottom) - 6],
            [x + 2, Math.round(head.top) + 6],
          ]);
          expect(low, `beside the head's foot (${name})`).toBe(high);
          // And that line is not the masthead's own colour running on.
          expect(high, `beside the head (${name})`).not.toBe(inside);
        }
        if (screen !== "fighter") await closeTop(page);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
