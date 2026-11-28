import { expect, test, type Page } from "@playwright/test";
import { snap } from "./helpers";
import { onPlayersLook } from "./players-look";
import { ISLAND, setInsets } from "./ui-measure";

// In the look players have (players-look.ts).
onPlayersLook();

/**
 * Open beta (owner, 28 Nov 2026; open-beta.ts, docs/open-beta.md): the web
 * build puts a small BETA sticker beside the ELEMENT ARENA wordmark on the
 * loading curtain, the title screen and the sign-in screen. Here: it is
 * there, whole on screen, clear of the name's letters (and the kicker
 * above it), and white on the hot red, at the phone sizes and a desktop.
 * The store build's absence is tests/unit/open-beta.test.ts.
 */
const SIZES = [
  { name: "667x375", width: 667, height: 375, phone: true },
  { name: "844x390", width: 844, height: 390, phone: true },
  {
    name: "852x393-island",
    width: 852,
    height: 393,
    phone: true,
    island: true,
  },
  { name: "1440x900", width: 1440, height: 900, phone: false },
];

/**
 * The tag's box, and whether it reaches into a letter it must not touch:
 * "text", each text run's own boxes (a heading's box is wider than its
 * words); "boxes", the elements' line boxes (the curtain's name, one span a
 * line at line-height 0.95, hugging Anton's capitals, where a text run's box
 * is the font's whole em, past the ink block).
 */
async function tagFits(
  page: Page,
  scope: string,
  clearOf: string,
  how: "text" | "boxes" = "text",
) {
  return page.evaluate(
    ([scope, clearOf, how]) => {
      const tag = document.querySelector<HTMLElement>(`${scope} .beta-tag`)!;
      const t = tag.getBoundingClientRect();
      const letters: DOMRect[] = [];
      for (const el of document.querySelectorAll(clearOf)) {
        if (how === "boxes") {
          letters.push(el.getBoundingClientRect());
          continue;
        }
        const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = walk.nextNode(); n; n = walk.nextNode()) {
          if (tag.contains(n) || !n.textContent?.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(n);
          letters.push(...range.getClientRects());
        }
      }
      const hits = letters.filter(
        (r) =>
          r.width > 0 &&
          t.left < r.right - 0.5 &&
          t.right > r.left + 0.5 &&
          t.top < r.bottom - 0.5 &&
          t.bottom > r.top + 0.5,
      ).length;
      const style = getComputedStyle(tag);
      return {
        text: tag.textContent,
        shown: style.display !== "none" && t.width > 0,
        inside:
          t.left >= 0 &&
          t.top >= 0 &&
          t.right <= innerWidth &&
          t.bottom <= innerHeight,
        hits,
        color: style.color,
        background: style.backgroundColor,
      };
    },
    [scope, clearOf, how] as const,
  );
}

/** A painting for the curtain (as startup-curtain.spec.ts: the paintings
 * themselves are not in the repository, so a stand-in picture). */
async function withPainting(page: Page, id: string) {
  await page.route(/\/loading-art\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    expect(body).toContain("export const LOADING_ART");
    await route.fulfill({
      response,
      body: `${body}\nLOADING_ART.length = 0;\nLOADING_ART.push({ ...LOADING_SCENES.find((s) => s.id === ${JSON.stringify(id)}), src: "/assets/backgrounds/elemental-horizon.webp" });`,
    });
  });
}

const expectFits = (got: Awaited<ReturnType<typeof tagFits>>) => {
  expect(got.text).toBe("Beta");
  expect(got.shown).toBe(true);
  expect(got.inside).toBe(true);
  expect(got.hits).toBe(0);
  // White on the hot red fill: 4.85:1.
  expect(got.color).toBe("rgb(255, 255, 255)");
  expect(got.background).toBe("rgb(224, 20, 58)");
};

for (const size of SIZES)
  test(`the BETA tag beside the wordmark at ${size.name}`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      // The title screen.
      const page = await context.newPage();
      await page.addInitScript(() => {
        (window as any).__showTitle = true;
        try {
          localStorage.setItem("ea-hub-scene", "lobby");
        } catch {
          /* No storage. */
        }
      });
      await page.goto("/");
      await expect(page.locator("[data-title-card]")).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.locator("#server-startup")).toHaveCount(0, {
        timeout: 60_000,
      });
      // The island once the page is in (a blank page's inset goes with it).
      if (size.island) await setInsets(page, ISLAND);
      await page.evaluate(() => document.fonts.ready);
      expectFits(
        await tagFits(page, "#title-heading", ".title-brand, .title-who"),
      );
      await snap(page, info, `open-beta-title-${size.name}`);

      // The sign-in screen: signed out.
      const out = await context.newPage();
      await out.route("**/stubs.ts*", async (route) => {
        const response = await route.fetch();
        await route.fulfill({
          response,
          body: (await response.text()).replace(
            "getSession: async () => ({ data: { session } })",
            "getSession: async () => ({ data: { session: null } })",
          ),
        });
      });
      await out.goto("/");
      await expect(out.locator(".auth-panel")).toBeVisible();
      await expect(out.locator("#server-startup")).toHaveCount(0);
      if (size.island) await setInsets(out, ISLAND);
      await out.evaluate(() => document.fonts.ready);
      expectFits(await tagFits(out, "#gate-title", ".gate-heading"));
      await snap(out, info, `open-beta-signin-${size.name}`);
    } finally {
      await context.close();
    }
  });

// The loading curtain while the server wakes, plain and over a painting,
// on the shortest phone and a desktop.
for (const art of ["", "duel-storm-vs-forge"] as const)
  for (const size of [
    { width: 844, height: 280 },
    { width: 667, height: 375 },
    { width: 1440, height: 900 },
  ])
    test(`the BETA tag on the loading curtain${art ? ", painting" : ""}, ${size.width}x${size.height}`, async ({
      page,
    }, info) => {
      await page.setViewportSize(size);
      await page.addInitScript((a) => {
        if (a) localStorage.setItem("ea-next-art", a);
      }, art);
      if (art) await withPainting(page, art);
      // The server never answers: the curtain stays.
      await page.route(/\/fake-api\.ts(?:\?|$)/, async (route) => {
        const response = await route.fetch();
        await route.fulfill({
          response,
          body: `${await response.text()}
const openBetaFetch = window.fetch.bind(window);
window.fetch = (input, init) =>
  new URL(String(input), location.href).pathname === "/api/health"
    ? new Promise(() => {})
    : openBetaFetch(input, init);`,
        });
      });
      await page.goto("/");
      await expect(page.locator("#server-startup .beta-tag")).toBeVisible();
      if (art)
        await expect(page.locator("#server-startup")).toHaveClass(/has-art/, {
          timeout: 15_000,
        });
      await page.evaluate(() => document.fonts.ready);
      await snap(
        page,
        info,
        `open-beta-curtain${art ? "-art" : ""}-${size.width}x${size.height}`,
      );
      expectFits(
        await tagFits(
          page,
          "#server-startup .server-startup-brand",
          "#server-startup .server-startup-brand h1 > span",
          "boxes",
        ),
      );
    });
