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

type Word = {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fg: [number, number, number, number];
  need: number;
};

/**
 * The words in view, with their colour and the contrast they need (WCAG
 * AA: 4.5:1, 3:1 for large text). As tests/visual/poster-contrast.spec.ts
 * does for the game: any colour syntax is painted to a pixel and read back.
 */
const wordsInView = (page: Page) =>
  page.evaluate(() => {
    const out: Word[] = [];
    const paint = document.createElement("canvas").getContext("2d", {
      willReadFrequently: true,
    })!;
    paint.canvas.width = paint.canvas.height = 1;
    const toRgba = (c: string) => {
      paint.clearRect(0, 0, 1, 1);
      paint.fillStyle = c;
      paint.fillRect(0, 0, 1, 1);
      const d = paint.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    };
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    const seen = new Set<Element>();
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      const el = t.parentElement;
      const text = t.textContent?.trim();
      if (!el || seen.has(el) || !text) continue;
      seen.add(el);
      if (el.closest("svg, [aria-hidden='true'], .vh, .skin-n")) continue;
      const range = document.createRange();
      range.selectNodeContents(t);
      const r = range.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (
        r.left < 0 ||
        r.top < 0 ||
        r.right > innerWidth ||
        r.bottom > innerHeight
      )
        continue;
      const cs = getComputedStyle(el);
      if (cs.visibility !== "visible") continue;
      let op = 1;
      for (let n: Element | null = el; n; n = n.parentElement)
        op *= Number(getComputedStyle(n).opacity);
      if (op < 0.05) continue;
      // Seen whole: the middle and all four corners land on this text, not
      // on something over it or past the edge of a box it scrolls in.
      const box = el.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) continue;
      const points = [
        [r.x + r.width / 2, r.y + r.height / 2],
        [r.left + 2, r.top + 2],
        [r.right - 2, r.top + 2],
        [r.left + 2, r.bottom - 2],
        [r.right - 2, r.bottom - 2],
      ];
      const whole = points.every(([x, y]) => {
        const hit = document.elementFromPoint(x, y);
        // The text's own element (a point on a dialog's backdrop hits the
        // dialog, which contains every word in it).
        return !!hit && el.contains(hit);
      });
      if (!whole) continue;
      const p = toRgba(cs.color);
      const size = parseFloat(cs.fontSize);
      const bold =
        Number(cs.fontWeight) >= 700 || cs.fontFamily.includes("Anton");
      out.push({
        name: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${typeof el.className === "string" && el.className ? `.${el.className.split(" ")[0]}` : ""} "${text.slice(0, 28)}"`,
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        fg: [p[0], p[1], p[2], (p[3] ?? 1) * op],
        need: size >= 24 || (bold && size >= 18.66) ? 3 : 4.5,
      });
    }
    return out;
  });

/**
 * Wait for every animation and transition that ends to have ended (a
 * colour caught half-way measures as neither).
 */
const settle = (page: Page) =>
  page.waitForFunction(
    () =>
      document
        .getAnimations()
        .every(
          (a) =>
            a.playState !== "running" ||
            a.effect?.getComputedTiming().endTime === Infinity,
        ),
    null,
    { timeout: 20_000, polling: 100 },
  );

/** Words in view under the contrast they need, measured on the pixels drawn under them. */
async function lowContrast(page: Page, where: string) {
  // No pointer resting on a control: a hover colour is not what a reader
  // sees by default.
  await page.mouse.move(1, 1);
  const list = await wordsInView(page);
  const hide = await page.addStyleTag({
    content:
      "*, *::before, *::after { color: transparent !important; text-shadow: none !important; -webkit-text-stroke: 0 !important; caret-color: transparent !important; transition: none !important; }",
  });
  const png = (await page.screenshot({ animations: "disabled" })).toString(
    "base64",
  );
  await hide.evaluate((s) => (s as Element).remove());
  return page.evaluate(
    async ({ png, list, where }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      const scale = img.width / innerWidth;
      const lum = (c: number[]) => {
        const f = (v: number) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
      };
      const out: string[] = [];
      for (const w of list) {
        const data = ctx.getImageData(
          Math.floor(w.x * scale),
          Math.floor(w.y * scale),
          Math.max(1, Math.floor(w.w * scale)),
          Math.max(1, Math.floor(w.h * scale)),
        ).data;
        // The backdrop's middle: the median pixel by brightness.
        const px: number[][] = [];
        for (let i = 0; i < data.length; i += 4)
          px.push([data[i], data[i + 1], data[i + 2]]);
        px.sort((a, b) => lum(a) - lum(b));
        const bg = px[px.length >> 1];
        const a = w.fg[3];
        const fg = [0, 1, 2].map((i) => w.fg[i] * a + bg[i] * (1 - a));
        const l1 = lum(fg);
        const l2 = lum(bg);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        if (ratio < w.need)
          out.push(
            `${where} ${w.name} ${ratio.toFixed(2)} < ${w.need} (fg rgb(${fg.map((v) => v | 0)}), bg rgb(${bg}))`,
          );
      }
      return out;
    },
    { png, list, where },
  );
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

  // The champion tape stood still after a panel opened from it closed: focus
  // went back to the name (:focus-within held it), and the click that
  // closed the panel left the mouse on it (owner, 27 Nov).
  const tapeState = (page: Page) =>
    page
      .locator(".ticker-run")
      .evaluate((el) => getComputedStyle(el).animationPlayState);
  /** The middle of a name on the tape that is well inside the screen. */
  const tickOnScreen = async (page: Page) => {
    await page.locator(".ticker").scrollIntoViewIfNeeded();
    return page.evaluate(() => {
      const t = [
        ...document.querySelectorAll(".ticker .tick:not([aria-hidden])"),
      ]
        .map((a) => a.getBoundingClientRect())
        .find((r) => r.left > 60 && r.right < innerWidth - 60)!;
      return { x: t.left + t.width / 2, y: t.top + t.height / 2 };
    });
  };

  test("the champion tape runs on after a panel opened from it closes, with a mouse", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openSite(page);
    await expect.poll(() => tapeState(page)).toBe("running");
    const tick = await tickOnScreen(page);
    await page.mouse.click(tick.x, tick.y);
    const dialog = page.locator("#champ");
    await expect(dialog).toHaveJSProperty("open", true);
    // Once the panel's entrance is over (a click during it lands on the
    // transition, not on the page).
    const html = page.locator("html");
    await expect(html).not.toHaveAttribute("data-vt", /./);
    // A click outside the panel (left of it), on the tape under it.
    const spot = await page.evaluate(() => {
      const tape = document.querySelector(".ticker")!.getBoundingClientRect();
      const panel = document.querySelector("#champ")!.getBoundingClientRect();
      return {
        x: (Math.max(tape.left, 0) + panel.left) / 2,
        y: tape.top + tape.height / 2,
      };
    });
    await page.mouse.click(spot.x, spot.y);
    await expect(dialog).toHaveJSProperty("open", false);
    await expect(html).not.toHaveAttribute("data-vt", /./);
    await expect.poll(() => tapeState(page)).toBe("running");
    // A mouse that comes to the tape still holds it, to pick a name.
    await page.mouse.move(spot.x, 5);
    await page.mouse.move(spot.x, spot.y);
    await expect.poll(() => tapeState(page)).toBe("paused");
    await page.mouse.move(spot.x, 5);
    await expect.poll(() => tapeState(page)).toBe("running");
    // So does the keyboard on one of its names.
    await page.locator(".ticker .tick:not([aria-hidden])").nth(1).focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect.poll(() => tapeState(page)).toBe("paused");
  });

  test("the champion tape runs on after a panel opened from it closes, on a phone", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      await openSite(page);
      await expect.poll(() => tapeState(page)).toBe("running");
      const tick = await tickOnScreen(page);
      await page.touchscreen.tap(tick.x, tick.y);
      const dialog = page.locator("#champ");
      await expect(dialog).toHaveJSProperty("open", true);
      await page.locator("#champ [data-close]").first().tap();
      await expect(dialog).toHaveJSProperty("open", false);
      await expect.poll(() => tapeState(page)).toBe("running");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
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

  test.describe("easy to read", () => {
    // The measure hides the words with a style of its own, which the live
    // CSP would refuse; the tests above check the CSP.
    test.use({ bypassCSP: true });
    // Customers read every word (owner, 28 Nov): each one keeps WCAG AA
    // contrast against what is really drawn under it, on the whole page at a
    // phone's and a desktop's size, in the champion panel in every element's
    // colour, and on every Shop piece.
    for (const [w, h] of [
      [390, 844],
      [1440, 900],
    ])
      test(`every word reads at AA contrast, ${w}x${h}`, async ({ page }) => {
        test.setTimeout(300_000);
        // Motion paused: nothing is caught half-way through an entrance.
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.setViewportSize({ width: w, height: h });
        await openSite(page);
        await page.evaluate(() => document.fonts.ready);
        const low: string[] = [];
        const height = await page.evaluate(
          () => document.documentElement.scrollHeight,
        );
        for (let y = 0; y < height; y += Math.round(h * 0.7)) {
          await page.evaluate((y) => scrollTo(0, y), y);
          await page.waitForTimeout(150);
          await settle(page);
          low.push(...(await lowContrast(page, `page@${y}`)));
        }
        // Every Shop piece (both rarities' colours).
        const picks = page.locator(".shop-pick");
        for (let i = 0; i < (await picks.count()); i++) {
          await picks.nth(i).click();
          await page.locator(".spot:not([hidden])").scrollIntoViewIfNeeded();
          await settle(page);
          low.push(...(await lowContrast(page, `shop#${i}`)));
        }
        // The champion panel in each element's colour, top and bottom.
        const ELEMENTS = [
          "voltkit",
          "cindrake",
          "tidefin",
          "auralynx",
          "lumoth",
          "mystowl",
          "terradon",
          "duskveil",
          "pangrove",
        ];
        for (const id of ELEMENTS) {
          await page.evaluate(
            (id) =>
              document
                .querySelector<HTMLElement>(`.roster [data-champion="${id}"]`)!
                .click(),
            id,
          );
          await expect(page.locator("#champ-name"), id).toHaveText(
            new RegExp(id, "i"),
          );
          await settle(page);
          low.push(...(await lowContrast(page, `${id}:top`)));
          await page.evaluate(() =>
            document.querySelector("#champ")!.scrollTo(0, 1e5),
          );
          low.push(...(await lowContrast(page, `${id}:end`)));
          await page.click(".champ-x");
          await expect(page.locator("#champ")).toHaveJSProperty("open", false);
        }
        expect(low).toEqual([]);
      });
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
