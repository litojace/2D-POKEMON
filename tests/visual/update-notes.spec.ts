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
// control: in the Lobby, in a fight, or over a whole-screen sheet (the
// Reveal, the break, the results, a raid's briefing and rites), where the
// note waits and the toast sits at the top.
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

/**
 * Before the page loads: what the toast and the update note cover, as
 * `__covered(controls)` in the page, and `__toastLog`, every time the toast
 * shows, hides or changes its words, with the page's clock. A failure
 * prints the log, so a toast that went early says when and with what.
 */
async function watchNotes(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    const log: string[] = (w.__toastLog = []);
    const watch = () => {
      const t = document.getElementById("toast");
      if (!t) return void setTimeout(watch, 50);
      new MutationObserver(() =>
        log.push(
          `${Math.round(performance.now())} ${t.classList.contains("show") ? "shown" : "hidden"} "${(t.textContent ?? "").slice(0, 24)}"`,
        ),
      ).observe(t, {
        attributes: true,
        attributeFilter: ["class"],
        childList: true,
      });
    };
    watch();
    w.__covered = (controls: string) => {
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
      return {
        out,
        shown: notes.map((n) => n.id),
        log: [...log.slice(-6), `${Math.round(performance.now())} measured`],
      };
    };
  });
}
/** Which controls the toast or the update note covers, by name. */
const covered = (page: Page, controls: string) =>
  page.evaluate(
    (controls) =>
      (window as any).__covered(controls) as {
        out: string[];
        shown: string[];
        log: string[];
      },
    controls,
  );

/**
 * The deploy's last word, a toast that shows in any state, and what it
 * covers where it comes to rest. Fired, its rise brought to its end and
 * measured in one go in the page, with no frame in between. Waiting for
 * the rise lost the toast on CI's slower runners (#678): it stays 4.5 s
 * (toast() in main.ts), and a CSS transition only ends on a drawn frame.
 * Over a raid's briefing, with the court drawn in software, the log read
 * "10921 shown / 15426 hidden / 15601 measured": no frame for 4.5 s, the
 * timer on time, the toast gone before its rise ended (#651's run).
 */
async function aToast(page: Page, controls: string) {
  const r = await page.evaluate((controls) => {
    const w = window as any;
    w.__sock.fire("server-update", { closing: true });
    const t = document.getElementById("toast")!;
    // Read where it starts from in the same task: every place sets the
    // toast from its middle (left, then -50% of its width), so moving
    // between places (the Reveal to the fight) only animates its rise.
    // Placed by insets in the fight, its transform went from -50% to none
    // and it slid across the joystick and the gear, on CI's slow renderer
    // (25 Nov 2026). Reading its style also starts the rise's transitions.
    const x = new DOMMatrix(getComputedStyle(t).transform).m41;
    const sideways = Math.abs(x + t.offsetWidth / 2);
    const shows = t.classList.contains("show");
    // Measured where it comes to rest: its rise taken to its end now,
    // as a drawn frame would at its end (finish() needs no frame).
    for (const a of t.getAnimations()) a.finish();
    return { sideways, shows, ...w.__covered(controls) } as {
      sideways: number;
      shows: boolean;
      out: string[];
      shown: string[];
      log: string[];
    };
  }, controls);
  expect(r.sideways, "the toast moves sideways").toBeLessThan(1);
  expect(r.shows, `the toast shows: ${r.log.join(" / ")}`).toBe(true);
  return r;
}
/** Everything a player can press on a whole-screen sheet. */
const SHEET_CONTROLS =
  "#arena-overlay button, #arena-overlay a, #arena-overlay [data-raid-rite], #chat-button, #battle-menu, #mobile-settings";

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
      await watchNotes(page);
      await skipTour(page);
      const errors = await openHub(page);
      if (size.island) await setInsets(page, ISLAND);
      const note = page.locator("#pwa-banner");
      const toast = page.locator("#toast");

      // The Lobby.
      const lobby = await aToast(
        page,
        ".lobby-layer button, .lobby-card, .hub-scenes button, #account-nav button, #home-settings",
      );
      await snap(page, info, `update-notes-lobby-${label(size)}`);
      expect(lobby.shown, lobby.log.join(" / ")).toEqual(["toast"]);
      expect(lobby.out).toEqual([]);

      await page.evaluate(() =>
        (window as any).__room("pvp", { mode: "duel", phase: "playing" }),
      );
      await openPlayPanel(page);
      await createRoom(page);
      await pushUntilBattle(page);
      if (size.island) await setInsets(page, ISLAND);
      await page.evaluate(() => (window as any).__pwaOptions.onNeedRefresh());
      const overlay = page.locator("#arena-overlay");

      // The Reveal: the note waits, the toast keeps off the cards.
      await push(page, `s.phase = "briefing";`);
      await expect(overlay).toHaveClass(/\bis-reveal\b/);
      const reveal = await aToast(page, SHEET_CONTROLS);
      await snap(page, info, `update-notes-reveal-${label(size)}`);
      expect(reveal.shown, reveal.log.join(" / ")).toEqual(["toast"]);
      expect(reveal.out).toEqual([]);
      await push(page, `s.phase = "playing";`);
      await expect(overlay).not.toHaveClass(/\bis-reveal\b/);

      // In the fight: between the joystick and the skills.
      await restartSoon(page);
      await expect(toast).toHaveClass(/\bshow\b/);
      await expect(note).toContainText("Update after this match");
      const fight = await covered(
        page,
        ".touch-buttons button, .joystick, #chat-button, #battle-menu, #mobile-settings",
      );
      await snap(page, info, `update-notes-fight-${label(size)}`);
      expect(fight.shown, fight.log.join(" / ")).toEqual([
        "toast",
        "pwa-banner",
      ]);
      expect(fight.out).toEqual([]);

      // The break between rounds, with rites on offer: the cards clear.
      await push(
        page,
        `s.phase = "intermission"; s.remaining = 12; s.roundWinner = "me"; s.players.find((p) => p.id === "me").riteOffer = ["voltkit-quick-lance", "voltkit-tailwind"];`,
      );
      await expect(overlay).toHaveClass(/\bis-break\b/);
      await expect(overlay.locator("[data-rite]")).toHaveCount(2);
      const roundBreak = await aToast(
        page,
        `${SHEET_CONTROLS}, #arena-overlay [data-rite]`,
      );
      await snap(page, info, `update-notes-break-${label(size)}`);
      expect(roundBreak.shown, roundBreak.log.join(" / ")).toEqual(["toast"]);
      expect(roundBreak.out).toEqual([]);

      // The results: every button of the sheet clear.
      await push(
        page,
        `s.phase = "finished"; s.winner = "me"; s.matchId = "m1"; s.scores = { me: 3, p2: 1 };`,
      );
      await expect(overlay).toHaveClass(/\bis-sheet\b/);
      const results = await aToast(page, SHEET_CONTROLS);
      await snap(page, info, `update-notes-results-${label(size)}`);
      expect(results.shown, results.log.join(" / ")).toEqual(["toast"]);
      expect(results.out).toEqual([]);
      // Back in a fight, the note is back.
      await push(page, `s.phase = "playing";`);
      await expect(note).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

// A raid opens with its briefing ("I'm ready") and stops between chapters
// for the rites: whole screens with their buttons, like the results.
for (const size of SIZES)
  test(`over a raid's briefing and rites the toast covers no control at ${label(size)}`, async ({
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
      await watchNotes(page);
      await skipTour(page);
      const errors = await openHub(page);
      await page.evaluate(() =>
        (window as any).__room("raid", { boss: "prismatail" }),
      );
      await openPlayPanel(page);
      await createRoom(page);
      await pushUntilBattle(page);
      if (size.island) await setInsets(page, ISLAND);
      await page.evaluate(() => (window as any).__pwaOptions.onNeedRefresh());
      const overlay = page.locator("#arena-overlay");

      await push(page, `s.phase = "briefing";`);
      await expect(overlay.locator(".rc-card.is-briefing")).toBeVisible();
      await expect(overlay).toHaveClass(/\bis-sheet\b/);
      const briefing = await aToast(page, SHEET_CONTROLS);
      await snap(page, info, `update-notes-raid-briefing-${label(size)}`);
      expect(briefing.shown, briefing.log.join(" / ")).toEqual(["toast"]);
      expect(briefing.out).toEqual([]);

      await push(
        page,
        `s.phase = "intermission"; s.remaining = 12; s.raid.offers.me = ["shelter", "sharing", "core", "rescue", "courage", "mending"];`,
      );
      await expect(overlay).toHaveClass(/\bis-rites\b/);
      await expect(page.locator("[data-raid-rite]")).toHaveCount(6);
      const rites = await aToast(page, SHEET_CONTROLS);
      await snap(page, info, `update-notes-rites-${label(size)}`);
      expect(rites.shown, rites.log.join(" / ")).toEqual(["toast"]);
      expect(rites.out).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
