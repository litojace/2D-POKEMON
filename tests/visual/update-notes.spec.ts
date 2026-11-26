import { expect, test, type Page } from "@playwright/test";
import {
  createRoom,
  openHub,
  openPlayPanel,
  pushUntilBattle,
  skipTour,
  snap,
} from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";

// A deploy during a match (docs/server-updates.md): the game's toast says the
// server restarts soon, and the update note says "Update after this match".
// On a phone both sat at the bottom middle, which in a fight is the gap
// between the joystick and the skills, but on the results is the row of
// buttons: they covered Change fighter and Share result, and half of Rematch
// and Back to menu (play., 844x390, 25 Nov 2026). Neither may cover a
// control, in a fight, on the results or in the Lobby.
const SIZES = [
  { width: 667, height: 375, island: false },
  { width: 844, height: 390, island: false },
  { width: 852, height: 393, island: true },
];
const label = (size: (typeof SIZES)[number]) =>
  `${size.width}x${size.height}${size.island ? "-island" : ""}`;

/** The update note on: the service worker says a new build is waiting. */
async function fakeUpdates(page: Page) {
  await page.route(/\/stubs\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        /export function registerSW\(\) \{[\s\S]*?\n\}/,
        "export function registerSW(options){window.__pwaOptions=options;return async()=>{};}",
      ),
    });
  });
}
const push = (page: Page, change: string) =>
  page.evaluate((change) => {
    const w = window as any;
    new Function("s", change)(w.__snap);
    w.__push();
  }, change);
/** The server's deploy notice, as a match in progress gets it. */
const restartSoon = (page: Page) =>
  page.evaluate(() =>
    (window as any).__sock.fire("server-update", {
      draining: true,
      left: 120_000,
    }),
  );

/** Which controls the toast or the update note covers, by name. */
const covered = (page: Page, controls: string) =>
  page.evaluate((controls) => {
    const box = (e: Element) => e.getBoundingClientRect();
    const notes = ["#toast.show", "#pwa-banner:not([hidden])"]
      .map((s) => document.querySelector(s))
      .filter((e): e is Element => !!e && box(e).width > 0);
    const out: string[] = [];
    for (const c of document.querySelectorAll(controls)) {
      const b = box(c);
      if (!b.width || getComputedStyle(c).visibility === "hidden") continue;
      for (const n of notes) {
        const r = box(n);
        if (
          r.left < b.right &&
          b.left < r.right &&
          r.top < b.bottom &&
          b.top < r.bottom
        )
          out.push(
            `${n.id} over ${(c.textContent || c.getAttribute("aria-label") || c.className).trim().slice(0, 30)}`,
          );
      }
    }
    return { out, shown: notes.map((n) => n.id) };
  }, controls);

for (const size of SIZES)
  test(`the update toast and note cover no control at ${label(size)}`, async ({
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      await fakeUpdates(page);
      await skipTour(page);
      const errors = await openHub(page);
      await page.evaluate(() =>
        (window as any).__room("pvp", { mode: "duel", phase: "playing" }),
      );
      await openPlayPanel(page);
      await createRoom(page);
      await pushUntilBattle(page);
      if (size.island) await setInsets(page, ISLAND);
      await page.evaluate(() => (window as any).__pwaOptions.onNeedRefresh());
      const note = page.locator("#pwa-banner");
      const toast = page.locator("#toast");

      // In the fight: between the joystick and the skills.
      await restartSoon(page);
      await expect(toast).toHaveClass(/\bshow\b/);
      await expect(note).toContainText("Update after this match");
      const fight = await covered(
        page,
        ".touch-buttons button, .joystick, #chat-button, #battle-menu, #mobile-settings",
      );
      await snap(page, info, `update-notes-fight-${label(size)}`);
      expect(fight.shown).toEqual(["toast", "pwa-banner"]);
      expect(fight.out).toEqual([]);

      // The results: every button of the sheet clear.
      await push(
        page,
        `s.phase = "finished"; s.winner = "me"; s.matchId = "m1"; s.scores = { me: 3, p2: 1 };`,
      );
      const overlay = page.locator("#arena-overlay");
      await expect(overlay).toHaveClass(/\bis-sheet\b/);
      // A toast while the results are up (the deploy's last word, which
      // always shows; the restart notice above is said once a match).
      await page.evaluate(() =>
        (window as any).__sock.fire("server-update", { closing: true }),
      );
      await expect(toast).toHaveClass(/\bshow\b/);
      await page.waitForTimeout(400);
      const results = await covered(
        page,
        "#arena-overlay button, #arena-overlay a, #chat-button",
      );
      await snap(page, info, `update-notes-results-${label(size)}`);
      expect(results.shown).toContain("toast");
      expect(results.out).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
