import { expect, test, type Page } from "@playwright/test";
import {
  createRoom,
  openHub,
  openPlayPanel,
  pushUntilBattle,
  settle,
  snap,
} from "./helpers";
import { ISLAND, layoutProblems, setInsets, type Insets } from "./ui-measure";

// The checkpoint after a zone's elite: the Spire page marks floor 6 as the
// checkpoint once floor 5 (zone 1's elite) is beaten, and a climb resumed
// there briefs the catch-up, deals the skipped floors' blessings one choice
// after another (a pip each), and its results say where the next climb
// starts. Small phones in landscape first (with and without the Dynamic
// Island), then desktop. The climb is a real one run on the page
// (harness/rooms.ts "spire"), resumed by the server's own call.
const SIDES: Insets = { left: 44, right: 44, bottom: 21, top: 0 };
const NONE: Insets = { left: 0, right: 0, bottom: 0, top: 0 };
const SIZES: {
  name: string;
  width: number;
  height: number;
  phone: boolean;
  inset: Insets;
}[] = [
  { name: "667x375", width: 667, height: 375, phone: true, inset: NONE },
  { name: "844x390", width: 844, height: 390, phone: true, inset: SIDES },
  {
    name: "852x393-island",
    width: 852,
    height: 393,
    phone: true,
    inset: ISLAND,
  },
  { name: "desktop", width: 1440, height: 900, phone: false, inset: NONE },
];
const RECORDS = {
  raids: {
    clears: 2,
    highestPeril: 3,
    bestSeconds: 200,
    titles: [],
    cosmetics: [],
    weekly: [],
    earned: [],
    bosses: {
      grumblecrag: { clears: 2, highestPeril: 3, bestSeconds: 200, runs: 3 },
    },
  },
  // Floors 1–6 cleared: zone 1's elite is beaten.
  spire: {
    season: 0,
    highestFloor: 6,
    checkpoint: 1,
    attempts: 3,
    claimed: [1, 2, 3, 4, 5, 6],
    clears: { grumblecrag: 2 },
  },
};
type Box = { x: number; y: number; right: number; bottom: number };
const boxOf = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
    });
const inside = (b: Box, o: Box) =>
  b.x >= o.x - 1 &&
  b.right <= o.right + 1 &&
  b.y >= o.y - 1 &&
  b.bottom <= o.bottom + 1;
function inSafe(b: Box, s: (typeof SIZES)[number], what: string) {
  expect(b.x, `${what} left`).toBeGreaterThanOrEqual(s.inset.left - 1);
  expect(b.right, `${what} right`).toBeLessThanOrEqual(
    s.width - s.inset.right + 1,
  );
  expect(b.y, `${what} top`).toBeGreaterThanOrEqual(s.inset.top - 1);
  expect(b.bottom, `${what} bottom`).toBeLessThanOrEqual(
    s.height - s.inset.bottom + 1,
  );
}
/** Run the page's climb on (0 s: just push its snapshot). */
const step = (page: Page, seconds = 0) =>
  page.evaluate((s) => (window as any).__spireStep(s), seconds);

/** The blessing screen's pips, kicker and cards, all whole and in the safe area. */
async function blessingsFit(page: Page, s: (typeof SIZES)[number]) {
  await settle(page);
  const cards = page.locator(".rites-screen [data-raid-rite]");
  await expect(cards).toHaveCount(3);
  inSafe(await boxOf(page, ".rites-screen .rites-head"), s, "heading");
  inSafe(await boxOf(page, ".rites-screen .raid-rite-options"), s, "cards");
  const title = await boxOf(page, ".rites-screen .rites-title");
  const pips = await boxOf(page, ".rites-screen .rites-pips");
  expect(inside(pips, title), "pips inside the title").toBe(true);
  // The kicker reads in full (no clipping, no ellipsis).
  const clipped = await page
    .locator(".rites-screen .rites-kicker")
    .evaluate((el) => el.scrollWidth > el.clientWidth + 1);
  expect(clipped, "kicker clipped").toBe(false);
  for (const c of await cards.all()) {
    await c.scrollIntoViewIfNeeded();
    const b = await c.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { h: r.height, clip: el.scrollWidth > el.clientWidth + 1 };
    });
    expect(b.h).toBeGreaterThanOrEqual(44);
    expect(b.clip).toBe(false);
  }
}
/** A whole-screen card (briefing, results): its parts in the safe area. */
async function cardFits(
  page: Page,
  s: (typeof SIZES)[number],
  card: string,
  action: string,
) {
  await settle(page);
  const sheet = await page
    .locator("#arena-overlay")
    .evaluate((o) => o.classList.contains("is-sheet"));
  const parts = sheet
    ? ["rc-head", "rc-body", "rc-foot"].map((p) => `${card} > .${p}`)
    : [card];
  for (const part of parts) inSafe(await boxOf(page, part), s, part);
  await expect(page.locator(action)).toBeInViewport({ ratio: 1 });
}

for (const s of SIZES)
  test(`the checkpoint after the elite at ${s.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({
      viewport: { width: s.width, height: s.height },
      isMobile: s.phone,
      hasTouch: s.phone,
    });
    try {
      const page = await context.newPage();
      await page.addInitScript((r) => {
        const w = window as any;
        w.__raids = r.raids;
        w.__spire = r.spire;
      }, RECORDS);
      const errors = await openHub(page);
      await setInsets(page, s.inset);

      // The Spire page: floor 6 is the checkpoint (its milestone too).
      await page.click('.lobby-rail [data-lobby-action="raids"]');
      const tile = page.locator(".rh-room [data-raid-spire]");
      await tile.scrollIntoViewIfNeeded();
      await tile.click();
      await page.locator('[data-ui-spire-tab="climb"]').click();
      await expect(page.locator(".sp-start-note")).toContainText(
        "Checkpoint 6",
      );
      await expect(
        page.locator('.sp-milestone.is-checkpoint[data-spire-preview="6"]'),
      ).toHaveCount(1);
      await page.locator(".sp-guide summary").click();
      await expect(page.locator(".sp-how")).toContainText(
        "A checkpoint after the elite.",
      );
      await page.locator(".sp-guide").scrollIntoViewIfNeeded();
      expect(
        await layoutProblems(page, { inset: s.inset, phone: s.phone }),
      ).toEqual([]);
      await snap(page, info, `spire-checkpoint-page-${s.name}`);

      // A climb the server resumed at floor 6: its briefing.
      await page
        .locator(".rh-room [data-ui-close]")
        .click()
        .catch(() => {});
      await page.evaluate(() =>
        (window as any).__room("spire", { stage: "playing", floor: 2 }),
      );
      await openPlayPanel(page);
      await createRoom(page);
      await pushUntilBattle(page);
      await setInsets(page, s.inset);
      await page.evaluate(() => {
        const a = (window as any).__spireArena;
        a.configureSpire({
          startFloor: 6,
          ceiling: 9,
          resumed: true,
          highest: [6],
        });
        a.start();
      });
      await step(page);
      await expect(page.locator(".rc-card.is-briefing")).toBeVisible();
      await expect(page.locator(".rc-card.is-briefing .rc-body")).toContainText(
        "first pick the 5 blessings of the floors before it",
      );
      await expect(page.locator(".rc-card.is-briefing .rc-body")).toContainText(
        "you start again from floor 6.",
      );
      await expect(page.locator(".rc-card.is-briefing")).toContainText(
        "Climbing from floor 6",
      );
      await cardFits(page, s, ".rc-card.is-briefing", "#raid-instructions");
      await snap(page, info, `spire-checkpoint-briefing-${s.name}`);

      // The first catch-up choice: five pips, none filled yet.
      await page.evaluate(() =>
        (window as any).__spireArena.acknowledgeInstructions("me"),
      );
      await step(page);
      await expect(page.locator(".rites-screen .rites-kicker")).toHaveText(
        "The Spire · Checkpoint · blessing 1 of 5",
      );
      await expect(page.locator(".rites-screen .rites-pips > i")).toHaveCount(
        5,
      );
      await expect(
        page.locator(".rites-screen .rites-pips > i.on"),
      ).toHaveCount(0);
      await expect(page.locator(".rites-screen .rites-foot")).toContainText(
        "for floor 2, which you skipped",
      );
      await blessingsFit(page, s);
      await snap(page, info, `spire-checkpoint-blessing-1-${s.name}`);

      // Chosen: the first pip fills; then the next floor's cards.
      await page.evaluate(() => {
        const a = (window as any).__spireArena;
        a.pickRite("me", a.raid.spire.offers.me[0]);
      });
      await step(page);
      await expect(
        page.locator(".rites-screen .rites-pips > i.on"),
      ).toHaveCount(1);
      await expect(page.locator(".rites-screen .rites-foot")).toContainText(
        "Blessing locked in",
      );
      await snap(page, info, `spire-checkpoint-chosen-${s.name}`);
      await step(page, 1.2);
      await expect(page.locator(".rites-screen .rites-kicker")).toHaveText(
        "The Spire · Checkpoint · blessing 2 of 5",
      );
      await expect(
        page.locator(".rites-screen .rites-pips > i.on"),
      ).toHaveCount(1);
      await expect(page.locator(".rites-screen [data-raid-rite]")).toHaveCount(
        3,
      );
      await expect(
        page.locator(".rites-screen [data-raid-rite].is-picked"),
      ).toHaveCount(0);
      await blessingsFit(page, s);
      await snap(page, info, `spire-checkpoint-blessing-2-${s.name}`);

      // The climb falls: the next one starts at floor 6 again.
      await page.evaluate(() => (window as any).__spireArena.forfeit("me"));
      await step(page);
      await expect(page.locator(".rc-card.is-results")).toBeVisible();
      await expect(page.locator(".rc-card.is-results .rc-meta")).toHaveText(
        "A new climb from floor 6 · 5 blessings to pick first",
      );
      await expect(
        page.locator(".rc-card.is-results .rc-stat", { hasText: "Checkpoint" }),
      ).toContainText("6");
      await cardFits(page, s, ".rc-card.is-results", "#raid-retry");
      await snap(page, info, `spire-checkpoint-results-${s.name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
