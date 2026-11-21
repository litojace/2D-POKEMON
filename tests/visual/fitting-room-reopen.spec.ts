import { expect, test } from "@playwright/test";
import { openHub } from "./helpers";

/**
 * A closed Shop or Wardrobe is kept for its next open once its leave has
 * ended (ui/hub-panel.ts park, screens/fitting-room.ts). Opened again while
 * the last one is still leaving, the new screen is built afresh, and the old
 * one must then be dropped, not kept beside it. It was kept (#270): hidden,
 * still marked leaving, with its stage in the page, so frame-level-preview
 * found two stage frames on CI (the old leave ended, by its 250 ms timer,
 * after the new Wardrobe opened there; here the open is usually slower).
 */
test("a screen reopened while the last is still leaving keeps one copy", async ({
  page,
}) => {
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const marker = 'window.dispatchEvent(new Event("arena:ready"));';
    expect(body).toContain(marker);
    await route.fulfill({
      response,
      body: body.replace(marker, "window.__account=accountsUI;" + marker),
    });
  });
  await page.setViewportSize({ width: 1280, height: 589 });
  await openHub(page);
  await page.evaluate(() => (window as any).__account.showWardrobe());
  const open = page.locator(".ui-panel-host:not([data-ui-leaving]) .fit-room");
  await expect(open).toHaveCount(1);
  // Close it and hold its leave (ui/motion.ts leave(): the animation, and
  // its 250 ms safety timer) until the Wardrobe has opened again, as on a
  // slow machine.
  await page.evaluate(() => {
    const w = window as any;
    const real = window.setTimeout;
    w.__held = [] as (() => void)[];
    (window as any).setTimeout = (
      fn: () => void,
      ms?: number,
      ...rest: any[]
    ) => (ms === 250 ? (w.__held.push(fn), 0) : real(fn, ms, ...rest));
    document.querySelector<HTMLElement>(".fit-room .ui-close")!.click();
    window.setTimeout = real;
    for (const a of document
      .querySelector<HTMLElement>(".ui-panel-host[data-ui-leaving] .fit-room")!
      .getAnimations())
      a.playbackRate = 0.01;
  });
  expect(await page.evaluate(() => (window as any).__held.length)).toBe(1);
  await page.evaluate(() => (window as any).__account.showWardrobe());
  await expect(open).toHaveCount(1);
  // The old leave ends now: that screen goes, it isn't parked beside the
  // open one.
  await page.evaluate(() => {
    for (const fn of (window as any).__held) fn();
  });
  await expect(page.locator(".ui-panel-host .fit-room")).toHaveCount(1);
  await expect(page.locator(".ui-panel-host[data-ui-parked]")).toHaveCount(0);
});
