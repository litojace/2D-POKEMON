import { expect, test, type Page } from "@playwright/test";
import { RAID_BOSS_ORDER } from "../../packages/shared/src/raid-roster";
import {
  createRoom,
  openHub,
  openPlayPanel,
  pushUntilBattle,
  skipTour,
  snap,
} from "./helpers";
import { finger, sideways } from "./scroll-sweep";
import { ISLAND, setInsets } from "./ui-measure";

// The match's opening and closing sheets (the raid and Spire briefings,
// every mode's results) scroll up and down only. A raid's results once
// dragged sideways under a finger on an iPhone (owner's screenshot,
// 24 Nov 2026): Inkpurr's "Relights" header ran past its narrow column, two
// pixels wider than the panel, and a touch battle lets panels pan both ways
// (style.css, html.zoom-locked). Every boss's column names fit, nothing is
// wider than its scroller, and a sideways swipe moves nothing.
const SIZES = [
  { width: 667, height: 375, phone: true, island: false },
  { width: 844, height: 390, phone: true, island: false },
  { width: 852, height: 393, phone: true, island: true },
  { width: 1440, height: 900, phone: false, island: false },
];
const label = (size: (typeof SIZES)[number]) =>
  `${size.width}x${size.height}${size.island ? "-island" : ""}`;

const push = (page: Page, change: string) =>
  page.evaluate((change) => {
    const w = window as any;
    new Function("s", change)(w.__snap);
    w.__push();
  }, change);

/** The sheet's column headers that don't fit their column. */
const tightHeaders = (page: Page) =>
  page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>("#arena-overlay thead th"),
    )
      .filter((th) => th.scrollWidth > th.clientWidth)
      .map((th) => `${th.textContent} ${th.scrollWidth}>${th.clientWidth}`),
  );

/** Swipe the sheet's body left, then right: does anything in it move? */
async function swipeSideways(page: Page) {
  const body = page.locator("#arena-overlay :is(.rc-body, .panel-scroll)");
  const b = (await body.first().boundingBox())!;
  const at = () =>
    page.evaluate(() => {
      const body = document.querySelector<HTMLElement>(
        "#arena-overlay :is(.rc-body, .panel-scroll)",
      )!;
      const first = body.firstElementChild!.getBoundingClientRect();
      return { left: body.scrollLeft, x: Math.round(first.x) };
    });
  const before = await at();
  const y = Math.round(b.y + Math.min(b.height / 2, 120));
  await finger(page, Math.round(b.x + b.width * 0.8), y, -160, 0);
  const left = await at();
  await finger(page, Math.round(b.x + b.width * 0.2), y, 160, 0);
  const right = await at();
  return { before, left, right };
}

async function check(page: Page, what: string) {
  await page.waitForTimeout(500);
  expect(await sideways(page, "#arena-overlay"), `${what}: too wide`).toEqual(
    [],
  );
  expect(await tightHeaders(page), `${what}: headers`).toEqual([]);
  // Another phone's fonts can still run a word a little wide. The sheet
  // stays put under a sideways swipe even then: something 120 px too wide
  // put in its body (on the old CSS, the swipe dragged it 120 px).
  await page.evaluate(() => {
    const body = document.querySelector(
      "#arena-overlay :is(.rc-body, .panel-scroll)",
    )!;
    const wide = document.createElement("div");
    wide.dataset.testWide = "";
    wide.style.cssText = "flex:none;height:4px;width:calc(100% + 120px)";
    body.append(wide);
  });
  const s = await swipeSideways(page);
  await page.evaluate(() =>
    document.querySelector("[data-test-wide]")?.remove(),
  );
  expect(s.left, `${what}: swiped left`).toEqual(s.before);
  expect(s.right, `${what}: swiped right`).toEqual(s.before);
}

for (const size of SIZES)
  test(`the briefing and results don't move sideways at ${label(size)}`, async ({
    browser,
  }, info) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      await skipTour(page);
      const errors = await openHub(page);
      await page.evaluate(() =>
        (window as any).__room("raid", { boss: "gloomshade" }),
      );
      await openPlayPanel(page);
      await createRoom(page);
      await pushUntilBattle(page);
      if (size.island) await setInsets(page, ISLAND);
      // A touch battle: panels pan both ways under the zoom lock.
      if (size.phone)
        expect(
          await page.evaluate(() =>
            document.documentElement.classList.contains("zoom-locked"),
          ),
        ).toBe(true);
      for (const boss of RAID_BOSS_ORDER) {
        // The harness's party of two, every boss's own column names.
        await push(
          page,
          `s.raid.boss = "${boss}"; s.phase = "briefing"; s.raid.result = undefined;`,
        );
        await expect(page.locator(".rc-card.is-briefing")).toBeVisible();
        await check(page, `${boss} briefing`);
        await push(
          page,
          `s.phase = "finished"; s.raid.result = "defeat"; s.raid.rewardStatus = "saved";`,
        );
        await expect(page.locator(".rc-card.is-results")).toBeVisible();
        await check(page, `${boss} results`);
        if (boss === "gloomshade")
          await snap(page, info, `gloomshade-results-${label(size)}`);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

// The Spire's briefing and results, and PvP's results: the same sheet.
for (const size of SIZES)
  test(`the Spire's and PvP's sheets don't move sideways at ${label(size)}`, async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      await skipTour(page);
      const errors = await openHub(page);
      await page.evaluate(() =>
        (window as any).__room("spire", { floor: 4, stage: "briefing" }),
      );
      await openPlayPanel(page);
      await createRoom(page);
      await pushUntilBattle(page);
      if (size.island) await setInsets(page, ISLAND);
      await expect(page.locator(".rc-card.is-briefing")).toBeVisible();
      await check(page, "spire briefing");
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 4, stage: "finished" });
        w.__push();
      });
      await expect(page.locator(".rc-card.is-results")).toBeVisible();
      await check(page, "spire results");
      await page.goto("about:blank");
      await skipTour(page);
      errors.push(...(await openHub(page)));
      await page.evaluate(() =>
        (window as any).__room("pvp", { mode: "duel", phase: "playing" }),
      );
      await openPlayPanel(page);
      await createRoom(page);
      await pushUntilBattle(page);
      if (size.island) await setInsets(page, ISLAND);
      for (const change of [
        `s.phase = "finished"; s.winner = "me"; s.matchId = "m1"; s.scores = { me: 3, p2: 1 };`,
        `s.phase = "finished"; s.winner = "p2"; s.matchId = "m2"; s.scores = { me: 1, p2: 3 };`,
      ]) {
        await push(page, change);
        await expect(page.locator(".match-sheet")).toBeVisible();
        await check(
          page,
          `pvp ${change.includes('"me"; s.matchId') ? "win" : "loss"}`,
        );
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
