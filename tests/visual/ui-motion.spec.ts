import { expect, test, type Page } from "@playwright/test";
import { openLobby } from "./helpers";

// The hub's UI motion (ui/motion.ts): a screen slides in from the rail and
// its contents arrive one after another; the Lobby's stage glides aside for
// a sheet and back; closing fades the screen away and removes it soon after.
// Nothing waits on motion: the layout changes at once.

/** Finite animations running now on `selector`'s elements. */
const running = (page: Page, selector: string) =>
  page.evaluate(
    (s) =>
      Array.from(document.querySelectorAll(s)).flatMap((el) =>
        el
          .getAnimations()
          .filter((a) => a.effect?.getTiming().iterations !== Infinity)
          .map((a) => a.playState),
      ),
    selector,
  );
const finishAll = (page: Page) =>
  page.evaluate(() =>
    document.getAnimations().forEach((a) => {
      if (a.effect?.getTiming().iterations !== Infinity) a.finish();
    }),
  );
const today = new Date().toISOString().slice(0, 10);
/** Today's missions, so the Missions sheet has rows to bring in. */
const MISSIONS = [
  ["play-2", "easy", "Play 2 matches", 1, 2, 40, false],
  ["skills-30", "easy", "Use 30 skills", 30, 30, 40, true],
  ["bot-wins-3", "medium", "Win 3 matches against bots", 1, 3, 70, false],
  ["raids-2", "medium", "Clear 2 raids", 0, 2, 70, false],
  ["raid-solo-1", "hard", "Clear a raid on your own", 0, 1, 120, false],
  ["hard-bot", "hard", "Beat a Hard bot", 0, 1, 120, false],
].map(([id, tier, text, progress, target, coins, done], slot) => ({
  day: today,
  slot,
  id,
  tier,
  text,
  progress,
  target,
  coins,
  done,
}));
const fighter = (page: Page) =>
  page.evaluate(() => {
    const b = document.getElementById("lobby-fighter")!.getBoundingClientRect();
    return { x: b.left + b.width / 2, w: b.width };
  });

test("a sheet slides in, its contents arrive, and the Lobby glides aside and back", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.addInitScript((m) => ((window as any).__missions = m), MISSIONS);
  const errors = await openLobby(page);
  await finishAll(page);
  const home = await fighter(page);
  // Click and look in the same moment, before the motion can end.
  const opened = await page.evaluate(() => {
    document
      .querySelector<HTMLElement>('.lobby-rail [data-lobby-action="missions"]')!
      .click();
    const panel = document.querySelector(".ui-panel")!,
      stage = document.querySelector(".lobby-stage")!,
      items = panel.querySelectorAll("*");
    const finite = (el: Element) =>
      el
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity).length;
    return {
      sheet: panel.classList.contains("ui-sheet"),
      panel: finite(panel),
      stage: finite(stage),
      items: Array.from(items).filter((el) => finite(el) > 0).length,
      // The layout already changed: the stage moved, only its picture glides.
      covered: document
        .querySelector(".lobby-layer")!
        .hasAttribute("data-ui-sheet"),
    };
  });
  expect(opened.sheet).toBe(true);
  expect(opened.panel).toBeGreaterThan(0);
  expect(opened.stage).toBeGreaterThan(0);
  expect(opened.covered).toBe(true);
  // Its contents arrive one after another, whenever they come (Missions
  // shows "Loading" first): the most items moving at once in the first second.
  const arriving = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let most = 0;
        const t0 = performance.now();
        const look = () => {
          const panel = document.querySelector(
            ".ui-panel:not([data-ui-leaving])",
          );
          const moving = panel
            ? Array.from(panel.querySelectorAll("*")).filter((el) =>
                el
                  .getAnimations()
                  .some((a) => a.effect?.getTiming().iterations !== Infinity),
              ).length
            : 0;
          most = Math.max(most, moving);
          if (performance.now() - t0 < 1000) requestAnimationFrame(look);
          else resolve(most);
        };
        look();
      }),
  );
  expect(Math.max(arriving, opened.items)).toBeGreaterThan(2);
  // Settled: the fighter stands right of the sheet, smaller, with nothing left
  // over (no transform stays on the stage).
  await finishAll(page);
  const aside = await fighter(page);
  expect(aside.x).toBeGreaterThan(home.x + 50);
  expect(aside.w).toBeLessThan(home.w);
  expect(
    await page.evaluate(
      () => getComputedStyle(document.querySelector(".lobby-stage")!).transform,
    ),
  ).toBe("none");
  // Close: out of reach at once, gone from the page soon after, and the
  // fighter glides home.
  await page.evaluate(() =>
    document.querySelector<HTMLElement>(".ui-panel [data-ui-close]")!.click(),
  );
  expect(
    await page.evaluate(
      () =>
        getComputedStyle(document.querySelector(".ui-panel-host")!)
          .pointerEvents,
    ),
  ).toBe("none");
  expect((await running(page, ".lobby-stage")).length).toBeGreaterThan(0);
  await expect(page.locator(".ui-panel")).toHaveCount(0, { timeout: 2000 });
  await finishAll(page);
  const back = await fighter(page);
  expect(Math.abs(back.x - home.x)).toBeLessThan(2);
  expect(Math.abs(back.w - home.w)).toBeLessThan(2);
  expect(errors).toEqual([]);
});

test("with reduced motion, screens open and close at once with no motion", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    const errors = await openLobby(page);
    await page.click('.lobby-rail [data-lobby-action="missions"]');
    await expect(page.locator(".ui-panel")).toBeVisible();
    expect(await running(page, ".ui-panel, .ui-panel *")).toEqual([]);
    expect(await running(page, ".lobby-stage")).toEqual([]);
    await page.click(".ui-panel [data-ui-close]");
    // Gone straight away: nothing to fade.
    expect(await page.locator(".ui-panel").count()).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
