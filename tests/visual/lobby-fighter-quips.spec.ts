import { expect, test, type Page } from "@playwright/test";
import { openLobby, settle, snap } from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";
import { CHAMPION_QUIPS } from "../../apps/client/src/lobby-quips";

// Tap your fighter in the Lobby (lobby-quips.ts): it moves and says a
// random line in a bubble over its head.
/**
 * The top of the fighter's ink in the Lobby (CSS px from the viewport's
 * top), within [x0, x1]: the figure shot with its art shown and hidden.
 */
export async function fighterInkTop(page: Page, x0?: number, x1?: number) {
  const fig = page.locator("#lobby-fighter");
  const hide = (v: string) =>
    page.evaluate((v) => {
      document.querySelector<HTMLElement>(
        "#lobby-fighter-art",
      )!.style.visibility = v;
    }, v);
  const box = (await fig.boundingBox())!;
  const shown = await page.screenshot({ clip: box, animations: "disabled" });
  await hide("hidden");
  const bare = await page.screenshot({ clip: box, animations: "disabled" });
  await hide("");
  return page.evaluate(
    async ({ a, b, top, left, x0, x1 }) => {
      const read = async (src: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${src}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, c.width, c.height);
      };
      const p = await read(a),
        q = await read(b);
      const dpr =
        p.width /
        document.querySelector("#lobby-fighter")!.getBoundingClientRect().width;
      const from =
        x0 === undefined ? 0 : Math.max(0, Math.floor((x0 - left) * dpr));
      const to =
        x1 === undefined
          ? p.width
          : Math.min(p.width, Math.ceil((x1 - left) * dpr));
      for (let y = 0; y < p.height; y++) {
        let n = 0;
        for (let x = from; x < to; x++) {
          const i = (y * p.width + x) * 4;
          const d =
            Math.abs(p.data[i] - q.data[i]) +
            Math.abs(p.data[i + 1] - q.data[i + 1]) +
            Math.abs(p.data[i + 2] - q.data[i + 2]);
          if (d > 90) n++;
        }
        if (n >= 2) return top + y / dpr;
      }
      return Infinity;
    },
    {
      a: shown.toString("base64"),
      b: bare.toString("base64"),
      top: box.y,
      left: box.x,
      x0,
      x1,
    },
  );
}

const art = "#lobby-fighter-art";
const tap = "#lobby-fighter-tap";
const bubble = "#lobby-emote-bubble";

/** The bubble inside the screen's safe area, clear of the rail, the cards and the top bar. */
async function bubbleFits(page: Page) {
  return page.evaluate((s) => {
    const b = document.querySelector(s)!.getBoundingClientRect();
    const css = getComputedStyle(document.documentElement);
    const inset = (v: string) => parseFloat(css.getPropertyValue(v)) || 0;
    const box = (sel: string) =>
      document.querySelector(sel)?.getBoundingClientRect();
    const hits = [
      ".lobby-rail",
      ".lobby-cards",
      ".hub-scenes",
      ".lobby-play",
      "#account-profile",
      "#account-coins > *",
      "#account-leaves > *",
    ]
      .map((sel) => [sel, box(sel)] as const)
      .filter(
        ([, r]) =>
          r &&
          r.width &&
          b.left < r.right &&
          b.right > r.left &&
          b.top < r.bottom &&
          b.bottom > r.top,
      )
      .map(([sel]) => sel);
    return {
      box: [b.left, b.top, b.right, b.bottom].map(Math.round),
      inside:
        b.left >= inset("--safe-left") &&
        b.top >= inset("--safe-top") &&
        b.right <= innerWidth - inset("--safe-right") &&
        b.bottom <= innerHeight,
      hits,
      lines: (() => {
        const st = getComputedStyle(document.querySelector(s)!);
        return Math.round(
          (b.height -
            parseFloat(st.paddingTop) -
            parseFloat(st.paddingBottom)) /
            parseFloat(st.lineHeight),
        );
      })(),
    };
  }, bubble);
}

for (const size of [
  { name: "1440x900", width: 1440, height: 900, phone: false },
  { name: "852x393-island", width: 852, height: 393, phone: true },
  { name: "667x375", width: 667, height: 375, phone: true },
  { name: "568x320", width: 568, height: 320, phone: true },
])
  test(`tapping the Lobby fighter plays a move and says a line, at ${size.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
      deviceScaleFactor: 2,
    });
    try {
      const page = await context.newPage();
      const errors = await openLobby(page);
      if (size.phone) await setInsets(page, ISLAND);
      await expect(page.locator(art)).toHaveClass(/is-ready/, {
        timeout: 30_000,
      });
      await expect(page.locator(bubble)).toBeHidden();
      const seen = new Set<string>();
      let last = "";
      for (let i = 0; i < 3; i++) {
        if (size.phone) await page.locator(tap).tap();
        else await page.locator(tap).click();
        await expect(page.locator(bubble)).toBeVisible();
        await expect(page.locator(bubble)).toHaveClass(/is-line/);
        const text = (await page.locator(bubble).textContent()) ?? "";
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toBe(last);
        last = text;
        seen.add(text);
        if (i === 0)
          // The rig plays the line's move.
          await expect
            .poll(() => page.locator(art).getAttribute("data-rig-state"), {
              timeout: 5_000,
            })
            .toMatch(/^(wave|victory|jump|hurt|basic|skill[0-3])$/);
        // Measured at its full size, once the pop has ended.
        await settle(page);
        const fit = await bubbleFits(page);
        expect(fit.inside, text + JSON.stringify(fit)).toBe(true);
        expect(fit.hits, text).toEqual([]);
        expect(fit.lines, text).toBeLessThanOrEqual(2);
        if (i === 0) {
          // This machine renders on the CPU: a 2x screenshot takes longer
          // than the bubble stays, so it is held while the picture is taken.
          await page.evaluate((s) => {
            const b = document.querySelector<HTMLElement>(s)!;
            const hold = new MutationObserver(() => (b.hidden = false));
            hold.observe(b, { attributes: true, attributeFilter: ["hidden"] });
            (window as unknown as { __hold: MutationObserver }).__hold = hold;
          }, bubble);
          await snap(page, info, `lobby-quip-${size.name}`);
          await page.evaluate(() =>
            (
              window as unknown as { __hold: MutationObserver }
            ).__hold.disconnect(),
          );
        }
        await page.waitForTimeout(800);
      }
      expect(seen.size).toBeGreaterThanOrEqual(2);
      // One of the longest lines (35 of the 36 characters any line has),
      // placed by the game: a pinned Math.random picks Voltkit's fourth.
      await expect(page.locator(art)).toHaveAttribute(
        "data-preview-champion",
        "voltkit",
      );
      // The pick's two draws, pinned only for the tap's own click: own
      // pool (under 2/3), then that line's place among the lines left once
      // the one just said is set aside.
      // Three seconds on: a fourth tap sooner is a poke (its own lines).
      await page.waitForTimeout(3100);
      const target = "Fully charged. One hundred percent.";
      const said = (await page.locator(bubble).textContent()) ?? "";
      const left = CHAMPION_QUIPS.voltkit
        .map((q) => q.text)
        .filter((t) => t !== said);
      const draws = [0.1, (left.indexOf(target) + 0.5) / left.length];
      await page.evaluate(
        ({ s, draws }) => {
          document.querySelector(s)!.addEventListener(
            "click",
            () => {
              const random = Math.random;
              const queue = [...draws];
              Math.random = () => queue.shift() ?? random();
              setTimeout(() => (Math.random = random));
            },
            { capture: true, once: true },
          );
        },
        { s: tap, draws },
      );
      if (size.phone) await page.locator(tap).tap();
      else await page.locator(tap).click();
      await expect(page.locator(bubble)).toHaveText(target);
      await settle(page);
      const long = await bubbleFits(page);
      expect(long.inside, JSON.stringify(long)).toBe(true);
      expect(long.hits).toEqual([]);
      expect(long.lines).toBeLessThanOrEqual(2);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("the Lobby fighter answers the keyboard, and Low graphics hops the artwork", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("ea-graphics", "low"));
  const errors = await openLobby(page);
  await expect(page.locator(art)).not.toHaveClass(/is-ready/);
  await page.locator(tap).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(bubble)).toBeVisible();
  await expect(page.locator(bubble)).toHaveClass(/is-line/);
  await expect(page.locator(art)).toHaveClass(/is-hopping/);
  // Many quick taps: it notices.
  const first = await page.locator(bubble).textContent();
  for (let i = 0; i < 4; i++) await page.keyboard.press("Enter");
  expect(await page.locator(bubble).textContent()).not.toBe(first);
  // An emote still shows as an emote, not a line.
  await page.click(".lobby-emote-toggle");
  await page.locator("[data-lobby-emote]").first().click();
  await expect(page.locator(bubble)).not.toHaveClass(/is-line/);
  expect(errors).toEqual([]);
});

test("reduced motion: a line, but the fighter stays still", async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    const errors = await openLobby(page);
    await page.waitForTimeout(1500);
    await page.locator(tap).click();
    await expect(page.locator(bubble)).toBeVisible();
    await expect(page.locator(art)).not.toHaveClass(/is-hopping/);
    await page.waitForTimeout(400);
    const state = await page.locator(art).getAttribute("data-rig-state");
    expect(state ?? "idle").toMatch(/^(idle|blink)$/);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

// Heads start anywhere from the top of the fighter's box (Cindrake's
// flames) to a third of the way down (Tidefin): the bubble's tail sits just
// above the drawn head, or, with no room above it, the bubble sits right
// under the top bar. Measured on pixels.
test("the bubble sits above each fighter's head, under the top bar", async ({
  browser,
}, info) => {
  test.setTimeout(300_000);
  const context = await browser.newContext({
    viewport: { width: 852, height: 393 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  try {
    const page = await context.newPage();
    const errors = await openLobby(page);
    await setInsets(page, ISLAND);
    for (const champion of ["voltkit", "cindrake", "tidefin", "auralynx"]) {
      for (let i = 0; i < 20; i++) {
        if (
          (await page.locator(art).getAttribute("data-preview-champion")) ===
          champion
        )
          break;
        await page.click('[data-lobby-step="1"]');
        await page.waitForTimeout(400);
      }
      await expect(page.locator(art)).toHaveAttribute(
        "data-preview-champion",
        champion,
      );
      await expect(page.locator(art)).toHaveClass(/is-ready/, {
        timeout: 30_000,
      });
      await page.waitForTimeout(1500);
      const fig = (await page.locator("#lobby-fighter").boundingBox())!;
      // The head, in the middle third the game reads (shop-preview.ts).
      const head = await fighterInkTop(
        page,
        fig.x + fig.width * 0.3,
        fig.x + fig.width * 0.7,
      );
      await page.locator(tap).tap();
      await expect(page.locator(bubble)).toBeVisible();
      await settle(page);
      const at = await page.evaluate((s) => {
        const b = document.querySelector(s)!.getBoundingClientRect();
        let limit = 6;
        for (const e of Array.from(
          document.querySelectorAll(
            ".hub-scenes, #account-profile, #account-coins, #account-leaves, #home-settings",
          ),
        )) {
          const r = e.getBoundingClientRect();
          if (r.width && r.left < b.right && r.right > b.left)
            limit = Math.max(limit, r.bottom + 6);
        }
        return { top: b.top, bottom: b.bottom, limit };
      }, bubble);
      const tailTip = at.bottom + 8;
      const clear = tailTip <= head + 1.5;
      const underBar = Math.abs(at.top - at.limit) <= 1;
      expect(
        clear || underBar,
        `${champion}: tail ${tailTip.toFixed(1)}, head ${head.toFixed(1)}, top ${at.top.toFixed(1)}, bar ${at.limit.toFixed(1)}`,
      ).toBe(true);
      // Close to the head when there is room: no more than 12 px above it.
      if (!underBar) expect(head - tailTip, champion).toBeLessThanOrEqual(12);
      await snap(page, info, `lobby-quip-head-${champion}`);
      // Wait for the bubble to go before the next fighter.
      await expect(page.locator(bubble)).toBeHidden({ timeout: 15_000 });
    }
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
