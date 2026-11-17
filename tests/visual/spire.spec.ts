import { fileURLToPath } from "node:url";
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
import { layoutProblems, setInsets, ISLAND, type Insets } from "./ui-measure";
import { decodePng } from "./png";

// The Spire: its tile and page in the Raid Hub (locked until a Cragmuff
// clear), and a climb on the court: the Echoes, the elite, the blessing
// cards between floors and the results. The battles are real climbs run on
// the page (harness/rooms.ts "spire").
const SIZES: {
  name: string;
  width: number;
  height: number;
  phone: boolean;
  inset?: Insets;
}[] = [
  { name: "desktop", width: 1440, height: 900, phone: false },
  { name: "phone", width: 844, height: 390, phone: true },
  { name: "short-phone", width: 740, height: 340, phone: true },
  { name: "phone-island", width: 852, height: 393, phone: true, inset: ISLAND },
  { name: "small-phone", width: 667, height: 375, phone: true },
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
      if (size.inset) await setInsets(page, size.inset);
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
      expect(
        await layoutProblems(page, { phone: size.phone, inset: size.inset }),
      ).toEqual([]);
      // The whole ascent trail is visible before scrolling on mobile.
      if (size.phone) {
        const trail = await room.locator(".sp-route").boundingBox();
        const body = await room
          .locator('[data-raid-region="body"]')
          .boundingBox();
        expect(trail!.y).toBeGreaterThanOrEqual(body!.y);
        expect(trail!.y + trail!.height).toBeLessThanOrEqual(
          body!.y + body!.height,
        );
      }
      await snap(page, info, `spire-page-climb-${size.name}`);
      // Milestones preview floors, never change the actual checkpoint start.
      await expect(room.locator(".sp-preview")).toContainText(
        "Next uncleared · Floor 4",
      );
      await expect(room.locator(".sp-ascent progress")).toHaveAttribute(
        "value",
        "3",
      );
      const bossPreview = room.locator('[data-spire-preview="10"]');
      await bossPreview.scrollIntoViewIfNeeded();
      await bossPreview.click();
      await expect(room.locator(".sp-preview")).toContainText(
        "Ascendant Cragmuff",
      );
      await expect(room.locator(".sp-preview")).toContainText(
        "Earthshaker of the Spire",
      );
      await expect(bossPreview).toHaveAttribute("aria-pressed", "true");
      await expect(bossPreview).toBeFocused();
      await expect(room.locator("[data-raid-start]")).toHaveText(
        "Climb from floor 1",
      );
      const claimed = room.locator('[data-spire-preview="1"]');
      await claimed.scrollIntoViewIfNeeded();
      await claimed.click();
      await expect(room.locator(".sp-preview")).toContainText(
        "First-clear reward claimed",
      );
      const guide = room.locator(".sp-guide");
      await expect(guide).not.toHaveAttribute("open", "");
      await guide.locator("summary").click();
      await expect(guide).toHaveAttribute("open", "");
      await expect(guide).toContainText(
        "A new climb starts at the first floor",
      );

      await room.locator('[data-ui-spire-tab="floors"]').click();
      const floors = room.locator("[data-spire-floor]");
      // Zone 1's ten floors, then zones 2 to 5 (locked: checkpoint 1).
      await expect(floors).toHaveCount(50);
      await expect(room.locator('[data-spire-floor="11"]')).toHaveClass(
        /is-locked/,
      );
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
      expect(
        await layoutProblems(page, { phone: size.phone, inset: size.inset }),
      ).toEqual([]);
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
      expect(
        await layoutProblems(page, { phone: size.phone, inset: size.inset }),
      ).toEqual([]);
      await snap(page, info, `spire-page-blessings-${size.name}`);
      // Back to the list, on the Spire tile.
      await room.locator("[data-raid-back]").click();
      await expect(room.locator("[data-raid-spire]")).toBeFocused();
      expect(errors).toEqual([]);
      if (size.name === "phone-island") {
        // Stress future content layout without shipping or enabling any new floors.
        await room.locator("[data-raid-spire]").click();
        await page.evaluate(
          async ({ modelPath, fixturePath, records }) => {
            const { spireMarkup } = await import(modelPath);
            const { expandedSpire } = await import(fixturePath);
            const content = expandedSpire();
            const data = {
              progress: records,
              spire: {
                season: 0,
                highestFloor: 11,
                checkpoint: 11,
                attempts: 4,
                claimed: [11],
              },
              loading: false,
              me: { name: "tester", character: "voltkit" },
              party: [],
              leader: true,
              inRoom: false,
            };
            document.querySelector(".sp-room")!.outerHTML = spireMarkup(
              { play: "solo", status: "", spireFloor: 20 },
              data,
              content,
            );
          },
          {
            modelPath: `/@fs${fileURLToPath(new URL("../../apps/client/src/screens/spire-view.ts", import.meta.url))}`,
            fixturePath: `/@fs${fileURLToPath(new URL("../fixtures/spire-catalogue.ts", import.meta.url))}`,
            records: CLEARED,
          },
        );
        await expect(page.locator(".sp-zone-picker button")).toHaveCount(2);
        await expect(page.locator(".sp-milestone")).toHaveCount(10);
        await expect(page.locator(".sp-preview")).toContainText(
          "Pearl Cascade, Tidal Crown",
        );
        await expect(page.locator(".sp-preview")).not.toContainText(
          "Avalanche Charge",
        );
        await expect(page.locator("[data-raid-start]")).toHaveText(
          "Climb from floor 11",
        );
        expect(
          await layoutProblems(page, { phone: true, inset: size.inset }),
        ).toEqual([]);
        const targets = await page
          .locator(".sp-zone-picker button, .sp-milestone")
          .evaluateAll((els) =>
            els.every(
              (el) =>
                el.getBoundingClientRect().width >= 44 &&
                el.getBoundingClientRect().height >= 44,
            ),
          );
        expect(targets).toBe(true);
        await snap(page, info, "spire-expanded-phone-island");
      }
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
    // Zone 1 conquered: the checkpoint moves on to floor 11 (zone 2).
    await expect(results.locator(".rc-stat").nth(1)).toContainText("11");
    await expect(results.locator(".spire-conquered")).toContainText(
      "Zone 2 opens at floor 11",
    );
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

test("the next Spire milestone is revealed on mobile without moving the page", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 852, height: 393 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await withRecords(page, CLEARED, {
      ...CLIMB,
      highestFloor: 9,
      claimed: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    });
    await openHub(page);
    await setInsets(page, ISLAND);
    await page.click('.lobby-rail [data-lobby-action="raids"]');
    const card = page.locator("[data-raid-spire]");
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await expect(page.locator('[data-spire-preview="10"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const framing = await page
      .locator('[data-spire-preview="10"]')
      .evaluate((el) => {
        const r = el.getBoundingClientRect(),
          strip = el.parentElement!.getBoundingClientRect();
        return {
          contained: r.left >= strip.left && r.right <= strip.right,
          scrollLeft: el.parentElement!.scrollLeft,
          bodyScroll: document.querySelector('[data-raid-region="body"]')!
            .scrollTop,
        };
      });
    expect(framing.contained).toBe(true);
    expect(framing.bodyScroll).toBe(0);
    expect(framing.scrollLeft).toBeGreaterThan(0);
    expect(await layoutProblems(page, { phone: true, inset: ISLAND })).toEqual(
      [],
    );
    await snap(page, info, "spire-next-milestone-phone");
  } finally {
    await context.close();
  }
});

// ------------------------------------------------------------------ Zone 2
const CLEARED_BOTH = {
  ...CLEARED,
  bosses: {
    ...CLEARED.bosses,
    tidewyrm: { clears: 1, highestPeril: 3, bestSeconds: 260, runs: 2 },
  },
};
const CLIMB_ZONE2 = {
  season: 0,
  highestFloor: 12,
  checkpoint: 11,
  attempts: 5,
  claimed: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  clears: { grumblecrag: 2, tidewyrm: 1 },
};
const ZONE2_SIZES = [
  { name: "desktop", width: 1440, height: 900, phone: false },
  { name: "844x390", width: 844, height: 390, phone: true },
  { name: "667x375", width: 667, height: 375, phone: true },
];
for (const size of ZONE2_SIZES)
  test(`zone 2 (the Lagoon): the zone picker, its floors, the elite, the Ascendant Tidelotl and zone 2 conquered at ${size.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      await withRecords(page, CLEARED_BOTH, CLIMB_ZONE2);
      const errors = await openHub(page);
      await page.click('.lobby-rail [data-lobby-action="raids"]');
      const room = page.locator(".rh-room");
      await room.locator("[data-raid-spire]").click();
      await expect(room).toHaveAttribute("data-raid-mode", "spire");
      // The zone picker: zone 2 picked (checkpoint 11), zone 1 open too.
      const zone1 = room.locator('[data-ui-spire-zone="1"]'),
        zone2 = room.locator('[data-ui-spire-zone="2"]');
      await expect(zone2).toHaveAttribute("aria-pressed", "true");
      await expect(zone1).toBeEnabled();
      await expect(room.locator(".rh-foot-note")).toContainText(
        "zone 2 from floor 11",
      );
      for (const z of [zone1, zone2]) {
        const b = await z.boundingBox();
        expect(b!.height).toBeGreaterThanOrEqual(44);
      }
      await zone2.scrollIntoViewIfNeeded();
      await settle(page);
      expect(await layoutProblems(page, { phone: size.phone })).toEqual([]);
      await snap(page, info, `spire-z2-picker-${size.name}`);
      // Replay zone 1: the start follows the pick.
      await zone1.click();
      await expect(zone1).toHaveAttribute("aria-pressed", "true");
      await expect(room.locator(".rh-foot-note")).toContainText(
        "zone 1 from floor 1",
      );
      await zone2.click();
      await expect(zone2).toHaveAttribute("aria-pressed", "true");
      // The floors, zone by zone.
      await room.locator('[data-ui-spire-tab="floors"]').click();
      await expect(room.locator("[data-spire-floor]")).toHaveCount(50);
      await expect(room.locator('[data-spire-floor="12"]')).toHaveClass(
        /is-done/,
      );
      await expect(room.locator('[data-spire-floor="13"]')).toHaveClass(
        /is-next/,
      );
      await expect(room.locator('[data-spire-floor="20"]')).toContainText(
        "Ascendant Tidelotl",
      );
      const head2 = room.locator('[data-spire-zone-floors="2"] .sp-zone-head');
      await expect(head2).toContainText("Lagoon");
      // (After the tab's glide: scrolling mid-glide left a stale band in
      // software Chromium, as the Floors tab's own test notes.)
      await settle(page);
      await head2.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      expect(await layoutProblems(page, { phone: size.phone })).toEqual([]);
      await snap(page, info, `spire-z2-floors-${size.name}`);
      await page
        .locator(".rh-room [data-ui-close]")
        .click()
        .catch(() => {});

      // Floor 11: Water Echoes on the Spire's court.
      await climb(page, { floor: 11, seats: 2 });
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        /^Floor 11 · Wave 1\/3 · \d Echo(es)?$/,
      );
      await expect(page.locator('#raid-hud [data-hud="title"]')).toHaveText(
        "THE SPIRE · FLOOR 11",
      );
      const court = await page.evaluate(() => {
        const s = (window as any).__snap;
        return {
          zone: s.raid.spire.zone,
          boss: s.raid.boss,
          islands: s.raid.islands ?? null,
        };
      });
      expect(court).toEqual({ zone: 2, boss: "tidewyrm", islands: null });
      await page.evaluate(() => (window as any).__spireStep(0.5));
      await page.waitForTimeout(500);
      await snap(page, info, `spire-z2-floor11-${size.name}`);

      // Floor 15: the captain, with Tidelotl's bubble volleys.
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 15, stage: "playing" });
        w.__push();
      });
      await expect(page.locator('#raid-hud [data-hud="title"]')).toHaveText(
        "FLOOR 15 · ECHO CAPTAIN GLACELLE",
      );
      for (let i = 0; i < 20; i++) {
        const bubbles = await page.evaluate(() => {
          const w = window as any;
          w.__spireStep(0.4);
          return (w.__snap.raid.bubbles ?? []).length;
        });
        if (bubbles) break;
      }
      await expect
        .poll(() =>
          page.evaluate(
            () => ((window as any).__snap.raid.bubbles ?? []).length,
          ),
        )
        .toBeGreaterThan(0);
      await expect(page.locator("#raid-hud .raid-callout")).toHaveText(
        /bubble|Bubble|borrowed Tidelotl/,
      );
      await page.waitForTimeout(400);
      await snap(page, info, `spire-z2-elite-${size.name}`);

      // Floor 20: the Ascendant Tidelotl's briefing, in the lagoon.
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 20, stage: "briefing" });
        w.__push();
      });
      const brief = page.locator(".rc-card.is-briefing");
      await expect(brief.locator("h2")).toHaveText(
        "Floor 20 · Ascendant Tidelotl",
      );
      await expect(brief.locator(".spire-new-attacks li")).toHaveCount(2);
      await expect(brief.locator(".spire-new-attacks")).toContainText(
        "Breaker Wall",
      );
      await expect(brief).toContainText("Tidelotl, evolved");
      await expect(brief).toContainText("Tidelotl's raid, step by step");
      await expect(page.locator("#raid-instructions")).toBeInViewport();
      await settle(page);
      await snap(page, info, `spire-z2-boss-briefing-${size.name}`);

      // The fight: the lagoon court, the raid's bar, the floor and its clock.
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 20, stage: "playing" });
        w.__push();
      });
      await expect(page.locator('#raid-hud [data-hud="title"]')).toHaveText(
        /^ASCENDANT TIDELOTL/,
      );
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        "Floor 20 · Phase 1/3",
      );
      const fight = await page.evaluate(() => {
        const s = (window as any).__snap;
        return {
          arena: s.arena,
          variant: s.raid.variant,
          boss: s.players.find((p: any) => p.raidBoss)?.name,
          islands: (s.raid.islands ?? []).length,
        };
      });
      expect(fight).toEqual({
        arena: "lagoon",
        variant: "ascendant",
        boss: "Ascendant Tidelotl",
        islands: 4,
      });
      for (let i = 0; i < 20; i++) {
        const live = await page.evaluate(() => {
          const w = window as any;
          w.__spireStep(0.5);
          return w.__snap.raid.warnings.length;
        });
        if (live) break;
      }
      await page.waitForTimeout(400);
      await snap(page, info, `spire-z2-boss-fight-${size.name}`);

      // It falls: zone 2 conquered, floor 20's title.
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 20, stage: "finished" });
        w.__push();
      });
      const results = page.locator(".rc-card.is-results");
      await expect(results.locator("h2")).toHaveText("Zone 2 conquered!");
      await expect(results.locator(".spire-conquered")).toContainText(
        "Ascendant Tidelotl defeated",
      );
      await expect(results.locator(".spire-conquered")).toContainText(
        "Zone 3 opens at floor 21",
      );
      await expect(results.locator(".spire-rewards")).toContainText(
        "Tidecaller of the Spire",
      );
      await expect(results.locator("#raid-retry")).toBeInViewport();
      await settle(page);
      await snap(page, info, `spire-z2-results-${size.name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

// ------------------------------------------------------------------ Zone 3
const CLEARED_ALL = {
  ...CLEARED_BOTH,
  bosses: {
    ...CLEARED_BOTH.bosses,
    gloomshade: { clears: 1, highestPeril: 3, bestSeconds: 300, runs: 2 },
  },
};
const CLIMB_ZONE3 = {
  season: 0,
  highestFloor: 21,
  checkpoint: 21,
  attempts: 9,
  claimed: Array.from({ length: 21 }, (_, i) => i + 1),
  clears: { grumblecrag: 2, tidewyrm: 1, gloomshade: 1 },
};
const ZONE3_SIZES = [
  { name: "desktop", width: 1440, height: 900, phone: false },
  { name: "844x390", width: 844, height: 390, phone: true },
  { name: "667x375", width: 667, height: 375, phone: true },
];
for (const size of ZONE3_SIZES)
  test(`zone 3 (the Lantern Yard): the zone picker, its floors, the elite, the Ascendant Inkpurr and zone 3 conquered at ${size.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      await withRecords(page, CLEARED_ALL, CLIMB_ZONE3);
      const errors = await openHub(page);
      await page.click('.lobby-rail [data-lobby-action="raids"]');
      const room = page.locator(".rh-room");
      await room.locator("[data-raid-spire]").click();
      await expect(room).toHaveAttribute("data-raid-mode", "spire");
      // The zone picker: zone 3 picked (checkpoint 21), zones 1 and 2 open too.
      const zones = [1, 2, 3].map((z) =>
        room.locator(`[data-ui-spire-zone="${z}"]`),
      );
      await expect(zones[2]).toHaveAttribute("aria-pressed", "true");
      await expect(zones[0]).toBeEnabled();
      await expect(zones[1]).toBeEnabled();
      // (The picked zone is named once, beside the chips or over the milestones.)
      await expect(
        room.locator(".sp-zone-info, .sp-route-zone").locator("visible=true"),
      ).toContainText("Lantern Yard");
      await expect(room.locator(".rh-foot-note")).toContainText(
        "zone 3 from floor 21",
      );
      for (const z of zones) {
        const b = await z.boundingBox();
        expect(b!.height).toBeGreaterThanOrEqual(44);
      }
      await zones[2].scrollIntoViewIfNeeded();
      await settle(page);
      expect(await layoutProblems(page, { phone: size.phone })).toEqual([]);
      await snap(page, info, `spire-z3-picker-${size.name}`);
      // Replay zone 2: the start follows the pick.
      await zones[1].click();
      await expect(zones[1]).toHaveAttribute("aria-pressed", "true");
      await expect(room.locator(".rh-foot-note")).toContainText(
        "zone 2 from floor 11",
      );
      await zones[2].click();
      await expect(zones[2]).toHaveAttribute("aria-pressed", "true");
      // The floors, zone by zone.
      await room.locator('[data-ui-spire-tab="floors"]').click();
      await expect(room.locator("[data-spire-floor]")).toHaveCount(50);
      await expect(room.locator('[data-spire-floor="21"]')).toHaveClass(
        /is-done/,
      );
      await expect(room.locator('[data-spire-floor="22"]')).toHaveClass(
        /is-next/,
      );
      await expect(room.locator('[data-spire-floor="25"]')).toContainText(
        "Elite",
      );
      await expect(room.locator('[data-spire-floor="30"]')).toContainText(
        "Ascendant Inkpurr",
      );
      const head3 = room.locator('[data-spire-zone-floors="3"] .sp-zone-head');
      await expect(head3).toContainText("Lantern Yard");
      await expect(head3).toContainText("Shadow");
      await settle(page);
      await head3.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      expect(await layoutProblems(page, { phone: size.phone })).toEqual([]);
      await snap(page, info, `spire-z3-floors-${size.name}`);
      await page
        .locator(".rh-room [data-ui-close]")
        .click()
        .catch(() => {});

      // Floor 21: Shadow Echoes on the Spire's court (no lanterns, no night).
      await climb(page, { floor: 21, seats: 2 });
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        /^Floor 21 · Wave 1\/3 · \d Echo(es)?$/,
      );
      await expect(page.locator('#raid-hud [data-hud="title"]')).toHaveText(
        "THE SPIRE · FLOOR 21",
      );
      const court = await page.evaluate(() => {
        const s = (window as any).__snap;
        return {
          zone: s.raid.spire.zone,
          boss: s.raid.boss,
          arena: s.arena,
          lanterns: s.raid.lanterns ?? null,
          decoys: (s.raid.decoys ?? []).length,
        };
      });
      expect(court).toEqual({
        zone: 3,
        boss: "gloomshade",
        arena: "classic",
        lanterns: null,
        decoys: 0,
      });
      await page.evaluate(() => (window as any).__spireStep(0.5));
      await page.waitForTimeout(500);
      await snap(page, info, `spire-z3-floor21-${size.name}`);

      // Floor 25: the captain, with Inkpurr's Grasping Hands.
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 25, stage: "playing" });
        w.__push();
      });
      await expect(page.locator('#raid-hud [data-hud="title"]')).toHaveText(
        "FLOOR 25 · ECHO CAPTAIN DUSKVEIL",
      );
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        "Floor 25 · Elite",
      );
      for (let i = 0; i < 30; i++) {
        const hands = await page.evaluate(() => {
          const w = window as any;
          w.__spireStep(0.25);
          return w.__snap.raid.warnings.some((x: any) => x.kind === "hands");
        });
        if (hands) break;
      }
      await expect(page.locator("#raid-hud .raid-callout")).toHaveText(
        "Grasping Hands — step onto a lit tile!",
      );
      await page.evaluate(() => (window as any).__spireStep(0.6));
      await page.waitForTimeout(300);
      await snap(page, info, `spire-z3-elite-${size.name}`);

      // Floor 30: the Ascendant Inkpurr's briefing, in the Lantern Yard.
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 30, stage: "briefing" });
        w.__push();
      });
      const brief = page.locator(".rc-card.is-briefing");
      await expect(brief.locator("h2")).toHaveText(
        "Floor 30 · Ascendant Inkpurr",
      );
      const moves = brief.locator(".spire-new-attacks li");
      await expect(moves).toHaveCount(2);
      await expect(moves.nth(0)).toContainText("Nightfall");
      await expect(moves.nth(1)).toContainText("Shade Pounce");
      await expect(brief).toContainText("Inkpurr, evolved");
      await expect(brief).toContainText("Inkpurr's raid, step by step");
      await expect(page.locator("#raid-instructions")).toBeInViewport();
      await settle(page);
      await snap(page, info, `spire-z3-boss-briefing-${size.name}`);

      // The fight: the yard and its lanterns, the raid's bar, the floor.
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 30, stage: "playing" });
        w.__push();
      });
      await expect(page.locator('#raid-hud [data-hud="title"]')).toHaveText(
        /^ASCENDANT INKPURR/,
      );
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        "Floor 30 · Phase 1/3",
      );
      const fight = await page.evaluate(() => {
        const s = (window as any).__snap;
        return {
          arena: s.arena,
          variant: s.raid.variant,
          boss: s.players.find((p: any) => p.raidBoss)?.name,
          lanterns: (s.raid.lanterns ?? []).length,
        };
      });
      expect(fight).toEqual({
        arena: "lantern-yard",
        variant: "ascendant",
        boss: "Ascendant Inkpurr",
        lanterns: 4,
      });
      for (let i = 0; i < 20; i++) {
        const live = await page.evaluate(() => {
          const w = window as any;
          w.__spireStep(0.5);
          return w.__snap.raid.warnings.length;
        });
        if (live) break;
      }
      await page.waitForTimeout(400);
      await snap(page, info, `spire-z3-boss-fight-${size.name}`);

      // It falls: zone 3 conquered, floor 30's title.
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 30, stage: "finished" });
        w.__push();
      });
      const results = page.locator(".rc-card.is-results");
      await expect(results.locator("h2")).toHaveText("Zone 3 conquered!");
      await expect(results.locator(".spire-conquered")).toContainText(
        "Ascendant Inkpurr defeated",
      );
      await expect(results.locator(".spire-conquered")).toContainText(
        "Zone 4 opens at floor 31",
      );
      await expect(results.locator(".spire-rewards")).toContainText(
        "Lanternbane of the Spire",
      );
      await expect(results.locator("#raid-retry")).toBeInViewport();
      await settle(page);
      await snap(page, info, `spire-z3-results-${size.name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

// ------------------------------------------------------------------ Zone 4
const CLEARED_DREAM = {
  ...CLEARED_ALL,
  bosses: {
    ...CLEARED_ALL.bosses,
    somnara: { clears: 1, highestPeril: 3, bestSeconds: 320, runs: 2 },
  },
};
const CLIMB_ZONE4 = {
  season: 0,
  highestFloor: 31,
  checkpoint: 31,
  attempts: 12,
  claimed: Array.from({ length: 31 }, (_, i) => i + 1),
  clears: { grumblecrag: 2, tidewyrm: 1, gloomshade: 1, somnara: 1 },
};
const ZONE4_SIZES = [
  { name: "desktop", width: 1440, height: 900, phone: false },
  { name: "844x390", width: 844, height: 390, phone: true },
  { name: "667x375", width: 667, height: 375, phone: true },
];
for (const size of ZONE4_SIZES)
  test(`zone 4 (the Cloud Deck): the zone picker, its floors, the elite, the Ascendant Snoozaku and zone 4 conquered at ${size.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      await withRecords(page, CLEARED_DREAM, CLIMB_ZONE4);
      const errors = await openHub(page);
      await page.click('.lobby-rail [data-lobby-action="raids"]');
      const room = page.locator(".rh-room");
      await room.locator("[data-raid-spire]").click();
      await expect(room).toHaveAttribute("data-raid-mode", "spire");
      // The zone picker: zone 4 picked (checkpoint 31), zones 1 to 3 open too.
      const zones = [1, 2, 3, 4].map((z) =>
        room.locator(`[data-ui-spire-zone="${z}"]`),
      );
      await expect(zones[3]).toHaveAttribute("aria-pressed", "true");
      for (const z of zones.slice(0, 3)) await expect(z).toBeEnabled();
      await expect(
        room.locator(".sp-zone-info, .sp-route-zone").locator("visible=true"),
      ).toContainText("Cloud Deck");
      await expect(room.locator(".rh-foot-note")).toContainText(
        "zone 4 from floor 31",
      );
      for (const z of zones) {
        const b = await z.boundingBox();
        expect(b!.height).toBeGreaterThanOrEqual(44);
      }
      await zones[3].scrollIntoViewIfNeeded();
      await settle(page);
      expect(await layoutProblems(page, { phone: size.phone })).toEqual([]);
      await snap(page, info, `spire-z4-picker-${size.name}`);
      // Replay zone 3: the start follows the pick.
      await zones[2].click();
      await expect(zones[2]).toHaveAttribute("aria-pressed", "true");
      await expect(room.locator(".rh-foot-note")).toContainText(
        "zone 3 from floor 21",
      );
      await zones[3].click();
      await expect(zones[3]).toHaveAttribute("aria-pressed", "true");
      // The floors, zone by zone.
      await room.locator('[data-ui-spire-tab="floors"]').click();
      await expect(room.locator("[data-spire-floor]")).toHaveCount(50);
      await expect(room.locator('[data-spire-floor="31"]')).toHaveClass(
        /is-done/,
      );
      await expect(room.locator('[data-spire-floor="32"]')).toHaveClass(
        /is-next/,
      );
      await expect(room.locator('[data-spire-floor="35"]')).toContainText(
        "Elite",
      );
      await expect(room.locator('[data-spire-floor="40"]')).toContainText(
        "Ascendant Snoozaku",
      );
      const head4 = room.locator('[data-spire-zone-floors="4"] .sp-zone-head');
      await expect(head4).toContainText("Cloud Deck");
      await expect(head4).toContainText("Psychic");
      await settle(page);
      await head4.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      expect(await layoutProblems(page, { phone: size.phone })).toEqual([]);
      await snap(page, info, `spire-z4-floors-${size.name}`);
      await page
        .locator(".rh-room [data-ui-close]")
        .click()
        .catch(() => {});

      // Floor 31: Psychic Echoes on the Spire's court (no pads, no dream).
      await climb(page, { floor: 31, seats: 2 });
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        /^Floor 31 · Wave 1\/3 · \d Echo(es)?$/,
      );
      await expect(page.locator('#raid-hud [data-hud="title"]')).toHaveText(
        "THE SPIRE · FLOOR 31",
      );
      const court = await page.evaluate(() => {
        const s = (window as any).__snap;
        return {
          zone: s.raid.spire.zone,
          boss: s.raid.boss,
          arena: s.arena,
          dream: s.raid.dream ?? null,
          rings: (s.raid.dreamRings ?? []).length,
        };
      });
      expect(court).toEqual({
        zone: 4,
        boss: "somnara",
        arena: "classic",
        dream: null,
        rings: 0,
      });
      await page.evaluate(() => (window as any).__spireStep(0.5));
      await page.waitForTimeout(500);
      await snap(page, info, `spire-z4-floor31-${size.name}`);

      // Floor 35: the captain, with Snoozaku's Falling Stars.
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 35, stage: "playing" });
        w.__push();
      });
      await expect(page.locator('#raid-hud [data-hud="title"]')).toHaveText(
        "FLOOR 35 · ECHO CAPTAIN MYSTOWL",
      );
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        "Floor 35 · Elite",
      );
      for (let i = 0; i < 40; i++) {
        const stars = await page.evaluate(() => {
          const w = window as any;
          w.__spireStep(0.25);
          return w.__snap.raid.warnings.some(
            (x: any) => x.kind === "falling-stars",
          );
        });
        if (stars) break;
      }
      await expect(page.locator("#raid-hud .raid-callout")).toHaveText(
        "Falling Stars — step out of the star under you!",
      );
      await page.evaluate(() => (window as any).__spireStep(0.6));
      await page.waitForTimeout(300);
      await snap(page, info, `spire-z4-elite-${size.name}`);

      // Floor 40: the Ascendant Snoozaku's briefing, on the Cloud Deck.
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 40, stage: "briefing" });
        w.__push();
      });
      const brief = page.locator(".rc-card.is-briefing");
      await expect(brief.locator("h2")).toHaveText(
        "Floor 40 · Ascendant Snoozaku",
      );
      const moves = brief.locator(".spire-new-attacks li");
      await expect(moves).toHaveCount(2);
      await expect(moves.nth(0)).toContainText("Twin Dream");
      await expect(moves.nth(1)).toContainText("Dream Tide");
      await expect(brief).toContainText("Snoozaku, evolved");
      await expect(brief).toContainText("Snoozaku's raid, step by step");
      await expect(page.locator("#raid-instructions")).toBeInViewport();
      await settle(page);
      await snap(page, info, `spire-z4-boss-briefing-${size.name}`);

      // The fight: the Cloud Deck and its pads, the raid's bar, the floor.
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 40, stage: "playing" });
        w.__push();
      });
      await expect(page.locator('#raid-hud [data-hud="title"]')).toHaveText(
        /^ASCENDANT SNOOZAKU/,
      );
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        "Floor 40 · Phase 1/3",
      );
      const fight = await page.evaluate(() => {
        const s = (window as any).__snap;
        return {
          arena: s.arena,
          variant: s.raid.variant,
          boss: s.players.find((p: any) => p.raidBoss)?.name,
        };
      });
      expect(fight).toEqual({
        arena: "cloud-deck",
        variant: "ascendant",
        boss: "Ascendant Snoozaku",
      });
      for (let i = 0; i < 20; i++) {
        const live = await page.evaluate(() => {
          const w = window as any;
          w.__spireStep(0.5);
          return w.__snap.raid.warnings.length || (w.__snap.raid.dream ? 1 : 0);
        });
        if (live) break;
      }
      await page.waitForTimeout(400);
      await snap(page, info, `spire-z4-boss-fight-${size.name}`);

      // It falls: zone 4 conquered, floor 40's title.
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 40, stage: "finished" });
        w.__push();
      });
      const results = page.locator(".rc-card.is-results");
      await expect(results.locator("h2")).toHaveText("Zone 4 conquered!");
      await expect(results.locator(".spire-conquered")).toContainText(
        "Ascendant Snoozaku defeated",
      );
      await expect(results.locator(".spire-conquered")).toContainText(
        "Zone 5 opens at floor 41",
      );
      await expect(results.locator(".spire-rewards")).toContainText(
        "Dreambreaker of the Spire",
      );
      await expect(results.locator("#raid-retry")).toBeInViewport();
      await settle(page);
      await snap(page, info, `spire-z4-results-${size.name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

// ------------------------------------------------------------------ Zone 5
const CLEARED_LIGHT = {
  ...CLEARED_DREAM,
  bosses: {
    ...CLEARED_DREAM.bosses,
    prismatail: { clears: 1, highestPeril: 3, bestSeconds: 300, runs: 2 },
  },
};
const CLIMB_ZONE5 = {
  season: 0,
  highestFloor: 41,
  checkpoint: 41,
  attempts: 15,
  claimed: Array.from({ length: 41 }, (_, i) => i + 1),
  clears: {
    grumblecrag: 2,
    tidewyrm: 1,
    gloomshade: 1,
    somnara: 1,
    prismatail: 1,
  },
};
const ZONE5_SIZES = [
  { name: "desktop", width: 1440, height: 900, phone: false },
  { name: "844x390", width: 844, height: 390, phone: true },
  { name: "667x375", width: 667, height: 375, phone: true },
];
for (const size of ZONE5_SIZES)
  test(`zone 5 (the Sun Atrium): the zone picker, its floors, the elite, the Ascendant Prismell and zone 5 conquered at ${size.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      await withRecords(page, CLEARED_LIGHT, CLIMB_ZONE5);
      const errors = await openHub(page);
      await page.click('.lobby-rail [data-lobby-action="raids"]');
      const room = page.locator(".rh-room");
      await room.locator("[data-raid-spire]").click();
      await expect(room).toHaveAttribute("data-raid-mode", "spire");
      // The zone picker: zone 5 picked (checkpoint 41), zones 1 to 4 open
      // too, every chip in view (no sideways scrolling), named once beside.
      const zones = [1, 2, 3, 4, 5].map((z) =>
        room.locator(`[data-ui-spire-zone="${z}"]`),
      );
      await expect(zones[4]).toHaveAttribute("aria-pressed", "true");
      for (const z of zones.slice(0, 4)) await expect(z).toBeEnabled();
      // (Beside the chips, or in the milestones' heading on phones.)
      const info5 = room
        .locator(".sp-zone-info, .sp-route-zone")
        .locator("visible=true");
      await expect(info5).toHaveCount(1);
      await expect(info5).toContainText("Sun Atrium");
      await expect(info5).toContainText("Light");
      await expect(room.locator(".rh-foot-note")).toContainText(
        "zone 5 from floor 41",
      );
      const picker = room.locator(".sp-zone-picker");
      await picker.scrollIntoViewIfNeeded();
      await settle(page);
      const fit = await picker.evaluate((row) => {
        const r = row.getBoundingClientRect();
        const body = row.closest(".ui-split-main")!.getBoundingClientRect();
        return {
          overflow: row.scrollWidth - row.clientWidth,
          inside: [...row.querySelectorAll("button")].every((b) => {
            const c = b.getBoundingClientRect();
            return (
              c.left >= r.left - 1 &&
              c.right <= r.right + 1 &&
              c.left >= body.left &&
              c.right <= body.right &&
              c.width >= 44 &&
              c.height >= 44
            );
          }),
        };
      });
      expect(fit).toEqual({ overflow: 0, inside: true });
      expect(await layoutProblems(page, { phone: size.phone })).toEqual([]);
      await snap(page, info, `spire-z5-picker-${size.name}`);
      // Replay zone 4: the start and the line beside the chips follow it.
      await zones[3].click();
      await expect(zones[3]).toHaveAttribute("aria-pressed", "true");
      await expect(zones[3]).toBeFocused();
      await expect(info5).toContainText("Cloud Deck");
      await expect(room.locator(".rh-foot-note")).toContainText(
        "zone 4 from floor 31",
      );
      // Arrow keys move along the chips.
      await page.keyboard.press("ArrowRight");
      await expect(zones[4]).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(zones[4]).toHaveAttribute("aria-pressed", "true");
      // The floors, zone by zone.
      await room.locator('[data-ui-spire-tab="floors"]').click();
      await expect(room.locator("[data-spire-floor]")).toHaveCount(50);
      await expect(room.locator('[data-spire-floor="41"]')).toHaveClass(
        /is-done/,
      );
      await expect(room.locator('[data-spire-floor="42"]')).toHaveClass(
        /is-next/,
      );
      await expect(room.locator('[data-spire-floor="45"]')).toContainText(
        "Elite",
      );
      await expect(room.locator('[data-spire-floor="50"]')).toContainText(
        "Ascendant Prismell",
      );
      const head5 = room.locator('[data-spire-zone-floors="5"] .sp-zone-head');
      await expect(head5).toContainText("Sun Atrium");
      await expect(head5).toContainText("Light");
      await settle(page);
      await head5.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      expect(await layoutProblems(page, { phone: size.phone })).toEqual([]);
      await snap(page, info, `spire-z5-floors-${size.name}`);
      await page
        .locator(".rh-room [data-ui-close]")
        .click()
        .catch(() => {});

      // Floor 41: Light Echoes on the Spire's court (no mirrors, no skylight).
      await climb(page, { floor: 41, seats: 2 });
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        /^Floor 41 · Wave 1\/3 · \d Echo(es)?$/,
      );
      await expect(page.locator('#raid-hud [data-hud="title"]')).toHaveText(
        "THE SPIRE · FLOOR 41",
      );
      const court = await page.evaluate(() => {
        const s = (window as any).__snap;
        return {
          zone: s.raid.spire.zone,
          boss: s.raid.boss,
          arena: s.arena,
          mirrors: (s.raid.mirrors ?? []).length,
          links: (s.raid.lightLinks ?? []).length,
          // Prismell's touch buttons are its own floor's.
          prism: !!document.querySelector("#raid-prism-controls:not([hidden])"),
        };
      });
      expect(court).toEqual({
        zone: 5,
        boss: "prismatail",
        arena: "classic",
        mirrors: 0,
        links: 0,
        prism: false,
      });
      await page.evaluate(() => (window as any).__spireStep(0.5));
      await page.waitForTimeout(500);
      await snap(page, info, `spire-z5-floor41-${size.name}`);

      // Floor 45: the captain, with Prismell's Prism Lances.
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 45, stage: "playing" });
        w.__push();
      });
      await expect(page.locator('#raid-hud [data-hud="title"]')).toHaveText(
        "FLOOR 45 · ECHO CAPTAIN HALCYRA",
      );
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        "Floor 45 · Elite",
      );
      for (let i = 0; i < 40; i++) {
        const lances = await page.evaluate(() => {
          const w = window as any;
          w.__spireStep(0.25);
          return w.__snap.raid.warnings.some(
            (x: any) => x.kind === "prism-lance",
          );
        });
        if (lances) break;
      }
      await expect(page.locator("#raid-hud .raid-callout")).toHaveText(
        "Prism Lances — sidestep the red lane!",
      );
      await page.evaluate(() => (window as any).__spireStep(0.4));
      await page.waitForTimeout(300);
      await snap(page, info, `spire-z5-elite-${size.name}`);

      // Floor 50: the Ascendant Prismell's briefing, in the Sun Atrium.
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 50, stage: "briefing" });
        w.__push();
      });
      const brief = page.locator(".rc-card.is-briefing");
      await expect(brief.locator("h2")).toHaveText(
        "Floor 50 · Ascendant Prismell",
      );
      const moves = brief.locator(".spire-new-attacks li");
      await expect(moves).toHaveCount(2);
      await expect(moves.nth(0)).toContainText("Eclipse");
      await expect(moves.nth(1)).toContainText("Umbral Prism");
      await expect(brief).toContainText("Prismell, evolved");
      await expect(brief).toContainText("Prismell's raid, step by step");
      await expect(page.locator("#raid-instructions")).toBeInViewport();
      await settle(page);
      await snap(page, info, `spire-z5-boss-briefing-${size.name}`);

      // The fight: the Sun Atrium and its mirrors, the raid's bar, the floor.
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 50, stage: "playing" });
        w.__push();
      });
      await expect(page.locator('#raid-hud [data-hud="title"]')).toHaveText(
        /^ASCENDANT PRISMELL/,
      );
      await expect(page.locator('#raid-hud [data-hud="phase"]')).toHaveText(
        "Floor 50 · Phase 1/3",
      );
      const fight = await page.evaluate(() => {
        const s = (window as any).__snap;
        return {
          arena: s.arena,
          variant: s.raid.variant,
          boss: s.players.find((p: any) => p.raidBoss)?.name,
          mirrors: (s.raid.mirrors ?? []).length,
        };
      });
      expect(fight).toEqual({
        arena: "sun-atrium",
        variant: "ascendant",
        boss: "Ascendant Prismell",
        mirrors: 4,
      });
      for (let i = 0; i < 20; i++) {
        const live = await page.evaluate(() => {
          const w = window as any;
          w.__spireStep(0.5);
          return w.__snap.raid.warnings.length;
        });
        if (live) break;
      }
      await page.waitForTimeout(400);
      await snap(page, info, `spire-z5-boss-fight-${size.name}`);

      // It falls: zone 5 conquered, floor 50's title.
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 50, stage: "finished" });
        w.__push();
      });
      const results = page.locator(".rc-card.is-results");
      await expect(results.locator("h2")).toHaveText("Zone 5 conquered!");
      await expect(results.locator(".spire-conquered")).toContainText(
        "Ascendant Prismell defeated",
      );
      await expect(results.locator(".spire-conquered")).toContainText(
        "More floors are coming",
      );
      await expect(results.locator(".spire-rewards")).toContainText(
        "Sunbreaker of the Spire",
      );
      await expect(results.locator("#raid-retry")).toBeInViewport();
      await settle(page);
      await snap(page, info, `spire-z5-results-${size.name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
