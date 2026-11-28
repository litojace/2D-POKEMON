import { expect, test, type Page } from "@playwright/test";
import { askReducedMotion, hubMenu, openHub, skipTour } from "./helpers";
import { onPlayersLook } from "./players-look";

onPlayersLook();

// Poster's glint on the two calls to action that matter, the Lobby's PLAY
// and the title's "Tap to start" (owner, 27 Nov 2026: "give the important
// buttons a light sheen again", then: for as long as the button shows): a
// hard-edged bar of light crossing the button behind its word.
// - It is the second motion in Poster that never ends, and it is not a CSS
//   animation that runs for ever: glint.ts puts .is-glinting on the button
//   for one sweep about every 5 s, and between sweeps nothing animates
//   (tests/unit/ui-theme.test.ts still allows `infinite` once, on the
//   title cover).
// - Only transform and opacity move.
// - The bar never leaves its button: its width and its run add up to the
//   button's width.
// - No sweeps while the Lobby is covered or the page is hidden, with the
//   player's Reduce motion, or on Low graphics.

/** Count each time `selector` gets .is-glinting, from now on. */
const countSweeps = (page: Page, selector: string) =>
  page.evaluate((selector) => {
    const host = document.querySelector<HTMLElement>(selector)!;
    const log: number[] = ((window as any).__sweeps = []);
    let on = host.classList.contains("is-glinting");
    new MutationObserver(() => {
      const now = host.classList.contains("is-glinting");
      if (now && !on) log.push(performance.now());
      on = now;
    }).observe(host, { attributes: true, attributeFilter: ["class"] });
  }, selector);
const sweeps = (page: Page) =>
  page.evaluate(() => (window as any).__sweeps as number[]);
const nextSweep = async (page: Page, after: number, timeout = 8_000) => {
  await expect
    .poll(async () => (await sweeps(page)).length, {
      timeout,
      intervals: [40],
    })
    .toBeGreaterThan(after);
};

/** The glint on `selector`'s ::after, as the page has it now. */
const glint = (page: Page, selector: string) =>
  page.evaluate((selector) => {
    const host = document.querySelector<HTMLElement>(selector)!;
    const bar = getComputedStyle(host, "::after");
    const running = document
      .getAnimations()
      .filter(
        (a) =>
          (a.effect as KeyframeEffect | null)?.target === host &&
          (a.effect as KeyframeEffect).pseudoElement === "::after",
      );
    const frames = running.flatMap((a) =>
      (a.effect as KeyframeEffect).getKeyframes(),
    );
    const moved = new Set(
      frames.flatMap((f) =>
        Object.keys(f).filter(
          (k) =>
            !["offset", "easing", "composite", "computedOffset"].includes(k),
        ),
      ),
    );
    // How far the bar travels, in its own widths (translateX(N%)).
    const run = Math.max(
      0,
      ...frames.map((f) => {
        const m = /translateX\(([\d.]+)%\)/.exec(String(f.transform ?? ""));
        return m ? Number(m[1]) / 100 : 0;
      }),
    );
    const width = parseFloat(bar.width);
    return {
      on: host.classList.contains("is-glinting"),
      name: bar.animationName,
      times: bar.animationIterationCount,
      running: running.length,
      moved: [...moved].sort(),
      // The bar's far edge at the end of its run, as a share of the button.
      reach: (parseFloat(bar.left) + width * (1 + run)) / host.clientWidth,
      opacity: bar.opacity,
    };
  }, selector);

/** One sweep is a single short run of transform and opacity, in the box. */
const expectOneSweep = async (page: Page, selector: string, name: string) => {
  const during = await glint(page, selector);
  expect(during.on).toBe(true);
  expect(during.name).toBe(name);
  expect(during.times).toBe("1");
  expect(during.running).toBe(1);
  expect(during.moved).toEqual(["opacity", "transform"]);
  expect(during.reach).toBeGreaterThan(0.9);
  expect(during.reach).toBeLessThanOrEqual(1.005);
  // And then rest: the class is gone, nothing runs, the bar is unseen.
  await expect
    .poll(async () => (await glint(page, selector)).on, {
      timeout: 3_000,
      intervals: [40],
    })
    .toBe(false);
  const rest = await glint(page, selector);
  expect(rest.name).toBe("none");
  expect(rest.running).toBe(0);
  expect(rest.opacity).toBe("0");
};

test("Poster: PLAY glints about every 5 s while it shows, one short sweep inside the button, and rests between", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await skipTour(page);
    const errors = await openHub(page);
    const PLAY = ".lobby-play-button";
    await countSweeps(page, PLAY);
    await nextSweep(page, 0);
    await expectOneSweep(page, PLAY, "poster-glint");
    // It comes again, a period later: for as long as PLAY shows.
    await nextSweep(page, 1);
    const [first, second] = await sweeps(page);
    expect(second - first).toBeGreaterThan(4_300);
    expect(second - first).toBeLessThan(6_500);

    // A panel over the Lobby: the clock rests (no sweep in more than a
    // period), and starts again when the Lobby shows.
    await hubMenu(page, "fighters");
    await expect(page.locator(".lobby-layer")).toHaveClass(/is-covered/);
    await page.waitForTimeout(900);
    const covered = (await sweeps(page)).length;
    await page.waitForTimeout(6_000);
    expect((await sweeps(page)).length).toBe(covered);
    await page.keyboard.press("Escape");
    await expect(page.locator(".lobby-layer")).not.toHaveClass(/is-covered/);
    await nextSweep(page, covered, 4_000);

    // The page hidden (another tab, the phone locked): the same.
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(900);
    const hidden = (await sweeps(page)).length;
    await page.waitForTimeout(6_000);
    expect((await sweeps(page)).length).toBe(hidden);
    await page.evaluate(() => {
      delete (document as any).hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await nextSweep(page, hidden, 4_000);

    // The player's Reduce motion switch: no more sweeps, and the look
    // would not run one either; turning it off brings them back.
    await askReducedMotion(page, true);
    await page.waitForTimeout(900);
    const reduced = (await sweeps(page)).length;
    await page.waitForTimeout(6_000);
    expect((await sweeps(page)).length).toBe(reduced);
    await page.evaluate(() =>
      document
        .querySelector(".lobby-play-button")!
        .classList.add("is-glinting"),
    );
    expect((await glint(page, PLAY)).name).toBe("none");
    await page.evaluate(() =>
      document
        .querySelector(".lobby-play-button")!
        .classList.remove("is-glinting"),
    );
    await askReducedMotion(page, false);
    await nextSweep(page, reduced + 1, 4_000);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("Poster: PLAY does not glint on Low graphics", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await skipTour(page);
    await page.addInitScript(() => localStorage.setItem("ea-graphics", "low"));
    await openHub(page);
    await countSweeps(page, ".lobby-play-button");
    await page.waitForTimeout(6_500);
    expect(await sweeps(page)).toEqual([]);
    // The look agrees: a sweep asked for by hand does not run.
    await page.evaluate(() =>
      document
        .querySelector(".lobby-play-button")!
        .classList.add("is-glinting"),
    );
    expect((await glint(page, ".lobby-play-button")).name).toBe("none");
  } finally {
    await context.close();
  }
});

test("Poster: Tap to start glints while the title waits for the tap, inside its block, and not with Reduce motion or Low graphics", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => {
      (window as any).__showTitle = true;
    });
    await page.goto("/");
    await page.evaluate(() => (window as any).__sock.fire("connect"));
    await expect(page.locator(".title-prompt")).toBeVisible();
    await expect(page.locator(".title-tap")).toBeEnabled();
    const TAP = ".title-prompt";
    await countSweeps(page, TAP);
    await nextSweep(page, 0);
    await expectOneSweep(page, TAP, "poster-glint-prompt");
    await nextSweep(page, 1);
    const [first, second] = await sweeps(page);
    expect(second - first).toBeGreaterThan(4_300);
    expect(second - first).toBeLessThan(6_500);

    // Low graphics and Reduce motion: the look runs no sweep.
    await page.evaluate(() => {
      document.documentElement.dataset.uiEffects = "light";
      document.querySelector(".title-prompt")!.classList.add("is-glinting");
    });
    expect((await glint(page, TAP)).name).toBe("none");
    await page.evaluate(() => {
      document.documentElement.dataset.uiEffects = "full";
      document.querySelector(".title-prompt")!.classList.remove("is-glinting");
    });
    await askReducedMotion(page, true);
    await page.waitForTimeout(900);
    const reduced = (await sweeps(page)).length;
    await page.waitForTimeout(6_000);
    expect((await sweeps(page)).length).toBe(reduced);
  } finally {
    await context.close();
  }
});
