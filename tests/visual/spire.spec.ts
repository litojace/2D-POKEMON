import { expect, test, type Page } from "@playwright/test";
import {
  box,
  inside,
  openHub,
  openPlayPanel,
  pushUntilBattle,
  settle,
  snap,
  createRoom,
} from "./helpers";
import { layoutProblems } from "./ui-measure";
import { decodePng } from "./png";

// The Spire: its tile and page in the Raid Hub (locked until a Cragmuff
// clear), and a climb on the court: the Echoes, the elite, the blessing
// cards between floors and the results. The battles are real climbs run on
// the page (harness/rooms.ts "spire").
const SIZES = [
  { name: "desktop", width: 1440, height: 900, phone: false },
  { name: "phone", width: 844, height: 390, phone: true },
  { name: "short-phone", width: 740, height: 340, phone: true },
];
const CLEARED = {
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
};
const CLIMB = {
  season: 0,
  highestFloor: 3,
  checkpoint: 1,
  attempts: 2,
  claimed: [1, 2, 3],
  clears: { grumblecrag: 2 },
};
async function withRecords(page: Page, raids: unknown, spire: unknown) {
  await page.addInitScript(
    ({ raids, spire }) => {
      const w = window as any;
      if (raids) w.__raids = raids;
      if (spire) w.__spire = spire;
    },
    { raids, spire },
  );
}

for (const size of SIZES)
  test(`the Spire tile and page at ${size.name}`, async ({ browser }, info) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      await withRecords(page, CLEARED, CLIMB);
      const errors = await openHub(page);
      await page.click('.lobby-rail [data-lobby-action="raids"]');
      const room = page.locator(".rh-room");
      // The last tile of the boss list, with your climb on it.
      const tiles = room.locator(".rh-grid > *");
      await expect(tiles).toHaveCount(8);
      await expect(tiles.last()).toHaveAttribute("data-raid-spire", "");
      const card = room.locator("[data-raid-spire]");
      await expect(card).not.toHaveClass(/is-locked/);
      await expect(card.locator(".rh-card-line")).toHaveText(
        size.phone ? /.*/ : "Floor 3 · Checkpoint 1",
      );
      await expect(card).toHaveAttribute(
        "aria-label",
        "The Spire, floor 3, checkpoint 1",
      );
      // Same size as the boss cards.
      const spire = await box(page, "[data-raid-spire]"),
        boss = await box(page, '[data-raid-card="grumblecrag"]');
      expect(Math.abs(spire.width - boss.width)).toBeLessThan(1);
      expect(Math.abs(spire.height - boss.height)).toBeLessThan(1);
      await card.scrollIntoViewIfNeeded();
      await snap(page, info, `spire-hall-${size.name}`);
      await card.click();
      await expect(room).toHaveAttribute("data-raid-mode", "spire");
      await expect(room.locator('[data-raid-start="solo"]')).toBeEnabled();
      await expect(room.locator(".sp-stat").first()).toContainText("3");
      await settle(page);
      expect(await layoutProblems(page, { phone: size.phone })).toEqual([]);
      await snap(page, info, `spire-page-climb-${size.name}`);
      await room.locator('[data-ui-spire-tab="floors"]').click();
      const floors = room.locator("[data-spire-floor]");
      await expect(floors).toHaveCount(10);
      await expect(room.locator('[data-spire-floor="1"]')).toHaveClass(
        /is-done/,
      );
      await expect(room.locator('[data-spire-floor="4"]')).toHaveClass(
        /is-next/,
      );
      await expect(room.locator('[data-spire-floor="5"]')).toContainText(
        "Elite",
      );
      await expect(room.locator('[data-spire-floor="10"]')).toHaveClass(
        /is-locked/,
      );
      expect(await layoutProblems(page, { phone: size.phone })).toEqual([]);
      // Row 1 is painted where it stands (no stale band over it: switching
      // tabs once left the old tab's picture there in Chromium).
      const row1 = await box(page, '[data-spire-floor="1"]');
      // (The whole screen, as a player sees it: a clipped shot repaints.)
      const shot = decodePng(await page.screenshot({ animations: "disabled" }));
      let bright = 0,
        all = 0;
      for (let y = Math.ceil(row1.y); y < row1.y + row1.height; y++)
        for (let x = Math.ceil(row1.x); x < row1.x + row1.width; x++) {
          const i = (y * shot.width + x) * 4;
          all++;
          if (shot.data[i] + shot.data[i + 1] + shot.data[i + 2] > 450)
            bright++;
        }
      expect(bright / all).toBeGreaterThan(0.004);
      await snap(page, info, `spire-page-floors-${size.name}`);
      await room.locator('[data-ui-spire-tab="blessings"]').click();
      await expect(room.locator("[data-spire-blessing-info]")).toHaveCount(10);
      expect(await layoutProblems(page, { phone: size.phone })).toEqual([]);
      await snap(page, info, `spire-page-blessings-${size.name}`);
      // Back to the list, on the Spire tile.
      await room.locator("[data-raid-back]").click();
      await expect(room.locator("[data-raid-spire]")).toBeFocused();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("the Spire is locked until a Cragmuff clear", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await withRecords(
      page,
      { ...CLEARED, clears: 0, bosses: {} },
      { ...CLIMB, highestFloor: 0, claimed: [], clears: {} },
    );
    const errors = await openHub(page);
    await page.click('.lobby-rail [data-lobby-action="raids"]');
    const card = page.locator(".rh-room [data-raid-spire]");
    await expect(card).toHaveClass(/is-locked/);
    await expect(card.locator(".ui-tag").first()).toHaveText(
      "Clear Cragmuff first",
    );
    await card.click();
    await expect(page.locator(".rh-room [data-raid-start]")).toBeDisabled();
    await expect(page.locator(".rh-room .rh-foot-note")).toHaveText(
      "Clear Cragmuff once to open the Spire.",
    );
    await snap(page, info, "spire-page-locked-phone");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

/** Into a climb on the court: a real Spire room run on the page. */
async function climb(
  page: Page,
  o: { floor?: number; stage?: string; seats?: number } = {},
) {
  await page.evaluate(
    (o) => (window as any).__room("spire", { stage: "playing", ...o }),
    o,
  );
  await openPlayPanel(page);
  await createRoom(page);
  await pushUntilBattle(page);
}

for (const size of SIZES.filter((s) => s.name !== "short-phone"))
  test(`a wave floor with Echoes, and the blessing cards, at ${size.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(150_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      const errors = await openHub(page);
      await climb(page, { floor: 2, seats: 2 });
      // The HUD line: the floor, the wave and the Echoes left.
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        /^Floor 2 · Wave 1\/2 · \d Echo(es)?$/,
      );
      await expect(page.locator('#raid-hud [data-hud="title"]')).toHaveText(
        "THE SPIRE · FLOOR 2",
      );
      // Echoes wear enemy nameplates; the teammate an ally's.
      const echo = await page.evaluate(() =>
        (window as any).__snap.players
          .filter((p: any) => p.echo && p.hp > 0)
          .map((p: any) => p.id),
      );
      expect(echo.length).toBeGreaterThan(0);
      for (const id of echo)
        await expect(
          page.locator(`.battle-nameplate[data-fighter="${id}"]`),
        ).toHaveClass(/team-enemy/);
      await expect(
        page.locator('.battle-nameplate[data-fighter="p2"]'),
      ).not.toHaveClass(/team-enemy/);
      await page.evaluate(() => (window as any).__spireStep(0.5));
      await page.waitForTimeout(500);
      await snap(page, info, `spire-wave-${size.name}`);

      // Between floors: three blessing cards; a tap asks for that one.
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 3, stage: "intermission" });
        w.__riteRequests = [];
        const previous = w.__emit;
        w.__emit = (event: string, data: unknown) => {
          if (event === "rite") w.__riteRequests.push(data);
          previous?.(event, data);
        };
        w.__push();
      });
      const cards = page.locator(".raid-draft [data-raid-rite]");
      await expect(cards).toHaveCount(3);
      const draft = await box(page, ".raid-draft");
      for (const c of await cards.all()) {
        const b = await c.boundingBox();
        expect(b && inside(b, draft)).toBe(true);
        const copy = await c.locator(".raid-rite-copy").boundingBox();
        expect(copy && b && inside(copy, b)).toBe(true);
      }
      await expect(page.locator(".raid-draft .eyebrow")).toHaveText(
        "The Spire · Floor 3",
      );
      await snap(page, info, `spire-blessings-${size.name}`);
      const first = await cards.first().getAttribute("data-raid-rite");
      await cards.first().click();
      await expect
        .poll(() => page.evaluate(() => (window as any).__riteRequests))
        .toEqual([{ id: first }]);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("the elite floor and the results", async ({ browser }, info) => {
  test.setTimeout(150_000);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  try {
    const page = await context.newPage();
    const errors = await openHub(page);
    await climb(page, { floor: 5 });
    // The captain keeps a boss bar, with its name.
    await expect(page.locator('#raid-hud [data-hud="title"]')).toHaveText(
      "FLOOR 5 · ECHO CAPTAIN WOMBOLDER",
    );
    await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
      "Floor 5 · Elite",
    );
    // Run on until its eruptions are on the court.
    for (let i = 0; i < 16; i++) {
      const live = await page.evaluate(() => {
        const w = window as any;
        w.__spireStep(0.5);
        return w.__snap.raid.warnings.length;
      });
      if (live) break;
    }
    await page.waitForTimeout(400);
    await snap(page, info, "spire-elite-desktop");
    // A defeat on floor 4: the results, saved floors and Climb again.
    await page.evaluate(() => {
      const w = window as any;
      w.__room("spire", { floor: 4, stage: "finished" });
      w.__push();
    });
    const results = page.locator(".rc-card.is-results");
    await expect(results).toBeVisible();
    await expect(results.locator(".ui-kicker").first()).toHaveText(
      "The Spire · Floor 4",
    );
    await expect(results).toContainText("The Echoes held floor 4");
    await expect(results.locator("#raid-retry")).toHaveText(/Climb again/);
    await expect(results.locator(".spire-rewards")).toContainText("25");
    await snap(page, info, "spire-results-desktop");
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(400);
    const card = await box(page, ".rc-card.is-results");
    expect(card.y).toBeGreaterThanOrEqual(0);
    expect(card.y + card.height).toBeLessThanOrEqual(391);
    await expect(results.locator("#raid-retry")).toBeInViewport();
    await snap(page, info, "spire-results-phone");
    // The briefing before the first floor.
    await page.evaluate(() => {
      const w = window as any;
      w.__room("spire", { floor: 1, stage: "briefing" });
      w.__push();
    });
    await expect(
      page.locator(".rc-card.is-briefing .spire-waves li"),
    ).toHaveCount(2);
    await expect(page.locator("#raid-instructions")).toBeEnabled();
    await snap(page, info, "spire-briefing-phone");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("floor 10: the Ascendant's briefing, the fight and zone 1 conquered", async ({
  browser,
}, info) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  try {
    const page = await context.newPage();
    const errors = await openHub(page);
    // The fight, in the climb's own room: the raid's boss bar, the floor.
    await climb(page, { floor: 10 });
    await expect(page.locator('#raid-hud [data-hud="title"]')).toHaveText(
      /^ASCENDANT CRAGMUFF/,
    );
    await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
      "Floor 10 · Phase 1/3",
    );
    await expect(page.locator("#raid-hud .raid-health-mark")).toHaveCount(2);
    await expect(
      page.locator(
        '#raid-hud .raid-elapsed[aria-label="Time left on this floor"]',
      ),
    ).toBeVisible();
    const snap0 = await page.evaluate(() => {
      const s = (window as any).__snap;
      return {
        variant: s.raid.variant,
        boss: s.players.find((p: any) => p.raidBoss)?.name,
        echoes: s.players.filter((p: any) => p.echo).length,
      };
    });
    expect(snap0).toEqual({
      variant: "ascendant",
      boss: "Ascendant Cragmuff",
      echoes: 0,
    });
    // On until its attacks are on the court.
    for (let i = 0; i < 20; i++) {
      const live = await page.evaluate(() => {
        const w = window as any;
        w.__spireStep(0.5);
        return w.__snap.raid.warnings.length;
      });
      if (live) break;
    }
    await page.waitForTimeout(400);
    await snap(page, info, "spire-boss-fight-desktop");

    // Its briefing: what is new, a clock, ready.
    await page.evaluate(() => {
      const w = window as any;
      w.__room("spire", { floor: 10, stage: "briefing" });
      w.__push();
    });
    const brief = page.locator(".rc-card.is-briefing");
    await expect(brief.locator("h2")).toHaveText(
      "Floor 10 · Ascendant Cragmuff",
    );
    await expect(brief.locator(".spire-new-attacks li")).toHaveCount(3);
    await expect(brief.locator(".spire-new-attacks")).toContainText(
      "Avalanche Charge",
    );
    await expect(brief.locator(".spire-new-attacks")).toContainText(
      "Twin Slam",
    );
    await expect(brief.locator(".spire-briefing-timer")).toHaveText(
      /^\d+ seconds?$/,
    );
    await expect(page.locator("#raid-instructions")).toBeEnabled();
    expect(await layoutProblems(page, { phone: false })).toEqual([]);
    await snap(page, info, "spire-boss-briefing-desktop");
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(400);
    const card = await box(page, ".rc-card.is-briefing");
    expect(card.y).toBeGreaterThanOrEqual(0);
    expect(card.y + card.height).toBeLessThanOrEqual(391);
    await expect(page.locator("#raid-instructions")).toBeInViewport();
    await snap(page, info, "spire-boss-briefing-phone");
    await page.setViewportSize({ width: 1440, height: 900 });

    // The Ascendant falls: zone 1 conquered, floor 10's title.
    await page.evaluate(() => {
      const w = window as any;
      w.__room("spire", { floor: 10, stage: "finished" });
      w.__push();
    });
    const results = page.locator(".rc-card.is-results");
    await expect(results).toBeVisible();
    await expect(results.locator("h2")).toHaveText("Zone 1 conquered!");
    await expect(results.locator(".spire-conquered")).toContainText(
      "Ascendant Cragmuff defeated",
    );
    // Floor 9's coins (35) and floor 10's (120), this climb.
    await expect(results.locator(".spire-rewards")).toContainText("155");
    await expect(results.locator(".spire-rewards")).toContainText(
      "Earthshaker of the Spire",
    );
    // No checkpoint at floor 11 until zone 2 exists.
    await expect(results.locator(".rc-stat").nth(1)).toContainText("1");
    await expect(results.locator(".rc-stat").first()).toContainText("10");
    await expect(results.locator("#raid-retry")).toHaveText(/Climb again/);
    await page.waitForTimeout(400);
    await snap(page, info, "spire-boss-results-desktop");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("Echoes fade from the court once the climb ends", async ({
  browser,
}, info) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  try {
    const page = await context.newPage();
    const errors = await openHub(page);
    await climb(page, { floor: 4 });
    await page.evaluate(() => {
      const w = window as any;
      w.__room("spire", { floor: 4, stage: "finished" });
      w.__push();
    });
    await expect(page.locator(".rc-card.is-results")).toBeVisible();
    const echoes: string[] = await page.evaluate(() =>
      (window as any).__snap.players
        .filter((p: any) => p.echo && p.hp > 0)
        .map((p: any) => p.id),
    );
    expect(echoes.length).toBeGreaterThan(0);
    // Their plates (and rigs) are gone after the fade.
    await page.waitForTimeout(1200);
    for (const id of echoes)
      await expect(
        page.locator(`.battle-nameplate[data-fighter="${id}"]`),
      ).toBeHidden();
    await snap(page, info, "spire-results-no-echoes");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
