import { expect, test, type Page } from "@playwright/test";
import { openLobby, settle, snap } from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";

// Tap your fighter in the Lobby (lobby-quips.ts): it moves and says a
// random line in a bubble over its head.
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
    const hits = [".lobby-rail", ".lobby-cards", ".hub-scenes", ".lobby-play"]
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
      // The longest line fits too.
      await page.evaluate((s) => {
        const b = document.querySelector<HTMLElement>(s)!;
        b.textContent = "Personal space! ...Okay, fine. Okay, fine!!";
        b.hidden = false;
      }, bubble);
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
