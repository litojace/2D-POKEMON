import { expect, test, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The website (apps/site, docs/website.md): static files apart from the
// game. The harness serves the game, so these tests serve the site from the
// repo by routing an address of its own to the files on disk.
const SITE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../apps/site",
);
const HOME = "https://site.test/";
/** The live site's Content-Security-Policy (docs/website.md, "Hosting"). */
const CSP =
  "default-src 'self'; img-src 'self' data:; style-src 'self'; style-src-attr 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
};

/** Script errors and CSP refusals on the page under test. */
let errors: string[] = [];

async function openSite(page: Page, hash = "") {
  errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // Anything the live headers would block (a style, script or video), and
  // any file the page asks for that is not there.
  page.on("console", (m) => {
    if (
      /Content Security Policy|Refused to|Failed to load resource/i.test(
        m.text(),
      )
    )
      errors.push(m.text());
  });
  await page.route(`${HOME}**`, async (route) => {
    const url = new URL(route.request().url());
    let file = path.join(SITE, decodeURIComponent(url.pathname));
    if (file.endsWith("/")) file = path.join(file, "index.html");
    if (!file.startsWith(SITE) || !existsSync(file))
      return route.fulfill({ status: 404, body: "" });
    await route.fulfill({
      path: file,
      headers: {
        "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
        "content-security-policy": CSP,
      },
    });
  });
  await page.goto(HOME + hash);
}

test.describe("website", () => {
  test.afterEach(() => expect(errors).toEqual([]));

  test("a champion opens with the loop of each look in the strip", async ({
    page,
  }) => {
    await openSite(page);
    await page.locator("#champions").scrollIntoViewIfNeeded();
    await page.click('.roster [data-champion="voltkit"]');
    const dialog = page.locator("#champ");
    await expect(dialog).toHaveJSProperty("open", true);
    await expect(page.locator("#champ-name")).toHaveText("Voltkit");
    const video = page.locator("#champ-video");
    // The Classic look first, its poster shown until the loop plays.
    await expect(video).toHaveAttribute("src", "media/skins/voltkit.mp4");
    await expect(video).toHaveAttribute("poster", "img/skins/voltkit.webp");
    // Classic and the four featured skins, rarest first.
    const looks = page.locator("#champ-skins button");
    await expect(looks).toHaveCount(5);
    await looks.nth(1).click();
    await expect(video).toHaveAttribute(
      "src",
      "media/skins/voltkit-stormcrown.mp4",
    );
    await expect(looks.nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#champ-look")).toContainText("Mythical");
    // Next: the next champion, back on their Classic look.
    await page.click('[data-step="1"]');
    await expect(page.locator("#champ-name")).toHaveText("Coilemur");
    await expect(video).toHaveAttribute("src", "media/skins/coilemur.mp4");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveJSProperty("open", false);
  });

  test("a link to a champion opens their panel", async ({ page }) => {
    await openSite(page, "#champion-pangrove");
    await expect(page.locator("#champ-name")).toHaveText("Pangrove");
  });

  test("a device asking for less motion starts paused; the switch plays", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openSite(page);
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-motion", "paused");
    // The spotlight's loop waits on its poster.
    const loop = page.locator(".spot:not([hidden]) video");
    await loop.scrollIntoViewIfNeeded();
    await expect(loop).toHaveJSProperty("paused", true);
    const toggle = page.locator(".spot:not([hidden]) [data-motion-toggle]");
    await expect(toggle).toHaveAttribute("aria-label", "Play motion");
    await toggle.click();
    await expect(html).toHaveAttribute("data-motion", "on");
    await expect(toggle).toHaveAttribute("aria-label", "Pause motion");
    // Kept for the next visit on this device.
    expect(
      await page.evaluate(() => localStorage.getItem("ea-site-motion")),
    ).toBe("on");
  });

  for (const [w, h] of [
    [390, 844],
    [667, 375],
    [852, 393],
  ])
    test(`fits a ${w}x${h} phone: no sideways scroll, controls 44 px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: w, height: h });
      await openSite(page);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(0);
      await page.locator("#champions").scrollIntoViewIfNeeded();
      await page.click('.roster [data-champion="halcyra"]');
      await expect(page.locator("#champ-name")).toHaveText("Halcyra");
      const small = await page.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLElement>(
            ".bar a, #champ button, #champ a",
          ),
        ]
          .filter((el) => el.offsetParent)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {
              what: el.getAttribute("aria-label") || el.textContent?.trim(),
              w: Math.round(r.width),
              h: Math.round(r.height),
            };
          })
          .filter((b) => b.w < 44 || b.h < 44),
      );
      expect(small).toEqual([]);
    });
});
