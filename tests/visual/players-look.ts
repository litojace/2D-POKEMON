import {
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

/**
 * The look players have, for the specs that measure what their phones pay
 * for (the battle and panel budgets).
 *
 * The harness pins the look underneath for the rest of the suite, which was
 * written against its sizes and places (harness/look-asked.ts). A budget
 * measured there says nothing about the game players run: every rule of the
 * look they have counts in battle (CLAUDE.md, "Keeping battles smooth"). So
 * a budget spec calls `playersLook(page)` before the page loads, and checks
 * `lookShown(page)` against `lookAsked()` once it has, so it can never pass
 * by measuring the other look without saying so.
 *
 * VISUAL_UI still wins (`?ui=`, helpers.ts): `VISUAL_UI=classic` measures
 * the look underneath, to compare the two on one machine.
 */

/**
 * The look every player gets: `DEFAULT_UI_THEME` in
 * apps/client/src/ui-theme.ts, or "classic" for the look underneath when
 * that is null. tests/unit/ui-theme.test.ts holds the two together, so a
 * change of the default (or its revert) says here what to change.
 */
export const PLAYERS_LOOK: string = "poster";

/** Before the page loads: no look pinned by the harness, as on a player's device. */
export const playersLook = (page: Page | BrowserContext) =>
  page.addInitScript(() => {
    (window as { __lookDefault?: boolean }).__lookDefault = true;
  });

/**
 * A spec moved to the look players have: call once at the top of the file.
 * Every page its tests open sees that look, the `page` fixture's and those
 * of contexts a test makes itself (`browser.newContext()`), so no test in
 * the file can measure the look underneath by being missed. The pin stays
 * for the specs not moved yet (harness/look-asked.ts); this file is not the
 * shared harness, so moving a spec keeps its pull request in the fast lane.
 */
export function onPlayersLook() {
  let restore: (() => void) | null = null;
  test.beforeEach(async ({ context, browser }) => {
    await playersLook(context);
    const b = browser as Browser & { newContext: Browser["newContext"] };
    const made = b.newContext;
    b.newContext = async (...args: Parameters<Browser["newContext"]>) => {
      const c = await made.apply(b, args);
      await playersLook(c);
      return c;
    };
    restore = () => (b.newContext = made);
  });
  test.afterEach(() => {
    restore?.();
    restore = null;
  });
}

/** The look this run is meant to measure. */
export const lookAsked = () => process.env.VISUAL_UI || PLAYERS_LOOK;

/** The look on the page ("classic": the look underneath, no attribute). */
export const lookShown = (page: Page) =>
  page.evaluate(() => document.documentElement.dataset.ui ?? "classic");
