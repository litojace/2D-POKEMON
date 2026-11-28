import { expect, test, type Page } from "@playwright/test";
import {
  openHub,
  openPlayPanel,
  pushUntilBattle,
  skipTour,
  snap,
  startPractice,
} from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";
import { onPlayersLook } from "./players-look";

// In the look players have (players-look.ts).
onPlayersLook();

// The gear opens Settings (owner, 28 Nov 2026: its menu of nine went):
// four tabs on the masthead after the title, Game, Help, Account and About,
// each a finger tall; whichever is open, nothing scrolls, the dialog keeps
// its height and stays inside the safe area. In a match there is no
// Account (nor Getting started).
const SIZES = [
  { width: 667, height: 375, phone: true, island: false },
  { width: 844, height: 390, phone: true, island: false },
  { width: 852, height: 393, phone: true, island: true },
  { width: 1440, height: 900, phone: false, island: false },
];
const label = (s: (typeof SIZES)[number]) =>
  `${s.width}x${s.height}${s.island ? "-island" : ""}`;

const head = (page: Page) =>
  page.evaluate(() => {
    const r = (sel: string) => {
      const b = document.querySelector(sel)!.getBoundingClientRect();
      return { l: b.left, r: b.right, t: b.top, b: b.bottom, h: b.height };
    };
    const content = document.querySelector("#dialog .dialog-content")!;
    return {
      dialog: r("#dialog"),
      title: r("#dialog .dialog-toolbar > h2"),
      tabs: Array.from(
        document.querySelectorAll(
          "#dialog .dialog-toolbar [data-settings-tab]",
        ),
      ).map((t) => {
        const b = t.getBoundingClientRect();
        return {
          name: t.textContent,
          l: b.left,
          r: b.right,
          h: b.height,
          whole:
            (t as HTMLElement).scrollWidth <= (t as HTMLElement).clientWidth,
        };
      }),
      close: r("#dialog #close-dialog"),
      scroll: content.scrollHeight - content.clientHeight,
      sideways: content.scrollWidth - content.clientWidth,
    };
  });

for (const size of SIZES)
  test(`the gear opens Settings, its tabs whole on the masthead at ${label(size)}`, async ({
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
      const errors = await openHub(page);
      if (size.island) await setInsets(page, ISLAND);
      // One tap: no menu in between.
      await page.locator("#home-settings").click();
      await expect(page.locator("#dialog .settings-screen")).toBeVisible();
      await page.waitForTimeout(300);
      let height = 0;
      for (const tab of ["Game", "Help", "Account", "About"]) {
        await page
          .locator(`[data-settings-tab="${tab.toLowerCase()}"]`)
          .click();
        await page.waitForTimeout(150);
        const h = await head(page);
        expect(h.tabs.map((t) => t.name)).toEqual([
          "Game",
          "Help",
          "Account",
          "About",
        ]);
        // On the masthead, in order: the title, the tabs, Close; whole and
        // a finger tall.
        expect(h.tabs[0].l).toBeGreaterThanOrEqual(h.title.r - 1);
        expect(h.tabs[3].r).toBeLessThanOrEqual(h.close.l + 1);
        for (const t of h.tabs) {
          expect(t.h, `${t.name} tab height`).toBeGreaterThanOrEqual(44);
          expect(t.whole, `${t.name} tab's word whole`).toBe(true);
        }
        // Inside the screen and the island's inset; nothing scrolls.
        expect(h.dialog.l).toBeGreaterThanOrEqual(
          size.island ? ISLAND.left : 0,
        );
        expect(h.dialog.r).toBeLessThanOrEqual(
          size.width - (size.island ? ISLAND.right : 0),
        );
        expect(h.dialog.t).toBeGreaterThanOrEqual(0);
        expect(h.dialog.b).toBeLessThanOrEqual(size.height);
        expect(h.scroll, `${tab} scrolls`).toBeLessThanOrEqual(1);
        expect(h.sideways, `${tab} runs sideways`).toBeLessThanOrEqual(1);
        // The same height whichever tab is open.
        if (height)
          expect(Math.abs(h.dialog.h - height)).toBeLessThanOrEqual(1);
        height = h.dialog.h;
        if (tab === "About") {
          // Instagram's row shows Instagram's own mark in its own colours
          // (owner, 28 Nov): its gradient's id is the page's only one of
          // that name, and the mark isn't dimmed.
          const mark = await page.evaluate(() => {
            const svg = document.querySelector(
              "#settings-instagram .st-brand-icon",
            );
            return {
              gradients: document.querySelectorAll("#settings-ig-app").length,
              fill: svg?.querySelector("rect")?.getAttribute("fill") ?? "",
              opacity: svg ? getComputedStyle(svg).opacity : "",
            };
          });
          expect(mark).toEqual({
            gradients: 1,
            fill: "url(#settings-ig-app)",
            opacity: "1",
          });
        }
        await snap(
          page,
          info,
          `settings-tabs-${tab.toLowerCase()}-${label(size)}`,
        );
      }
      // The arrow keys move between the tabs.
      await page.locator('[data-settings-tab="about"]').focus();
      await page.keyboard.press("ArrowRight");
      await expect(page.locator('[data-settings-tab="game"]')).toBeFocused();
      await expect(page.locator('[data-settings-tab="game"]')).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(page.locator("#settings-game")).toBeVisible();
      await expect(page.locator("#settings-about")).toBeHidden();
      // Settings opens again on the tab last used.
      await page.locator('[data-settings-tab="help"]').click();
      await page.keyboard.press("Escape");
      await expect(page.locator("#dialog[open]")).toHaveCount(0);
      await page.locator("#home-settings").click();
      await expect(page.locator('[aria-selected="true"]')).toHaveText("Help");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("in a match Settings has no Account tab, nor Getting started", async ({
  browser,
}, info) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await skipTour(page);
    const errors = await openHub(page);
    await page.evaluate(() => (window as any).__room("practice"));
    await openPlayPanel(page);
    await startPractice(page);
    await pushUntilBattle(page);
    await page.locator("#battle-menu").click();
    await expect(page.locator("#dialog .settings-screen")).toBeVisible();
    await expect(page.locator("#dialog [data-settings-tab]")).toHaveText([
      "Game",
      "Help",
      "About",
    ]);
    await page.locator('[data-settings-tab="help"]').click();
    await expect(page.locator("#settings-guide")).toHaveCount(0);
    await expect(page.locator("#open-controls")).toBeVisible();
    const h = await head(page);
    expect(h.scroll).toBeLessThanOrEqual(1);
    await snap(page, info, "settings-tabs-match-help-844x390");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
