import { expect, test, type Page } from "@playwright/test";
import {
  openHub,
  openPlayPanel,
  pushUntilBattle,
  skipTour,
  snap,
  startPractice,
} from "./helpers";

// The result sheet's celebration (result-rewards.ts): after a match, tiles
// show what it gave you (XP with LEVEL UP, rank, season, mastery, coins),
// your fighter hops and confetti falls on a win, Rematch is the main button
// and Add friend sits beside it.
const AT = "2026-11-26T20:00:00Z";
/** A journey whose last match was `ref`: 250 XP, from level 1 to level 3. */
const journey = (ref: string, xp = 260) => ({
  xp,
  recent: [
    { ref, amount: 75, source: "match", at: AT },
    { ref: "2026-11-26:1", amount: 50, source: "mission", at: AT },
    { ref: `match:${ref}`, amount: 75, source: "spark", at: AT },
    { ref: "mission:2026-11-26:1", amount: 50, source: "spark", at: AT },
  ],
  season: {
    id: "2026-11",
    xp: 900,
    week: "2026-W48",
    goals: {},
    completed: [],
    tiers: 30,
    tierXp: 800,
    itemTiers: [5, 12, 20, 30],
  },
  spark: { day: "2026-11-26", used: 125, limit: 500 },
  unlocked: [],
});
async function prepare(page: Page, o: { xp?: number } = {}) {
  await skipTour(page);
  await page.addInitScript(
    ({ journey }) => {
      const w = window as any;
      // The account before the match: its XP arrives with the result.
      w.__economyPatch = {
        journey: { ...journey, xp: 10, recent: [] },
        balance: 120,
      };
      w.__after = { journey, balance: 215 };
      w.__progress = {
        matches: 5,
        wins: 3,
        fighters: { voltkit: { matches: 5, wins: 3 } },
        achievements: [],
        season: { id: "2026-11", matches: 5, wins: 3 },
      };
      try {
        // No "Unlocked" dialog over the Lobby afterwards.
        localStorage.setItem(
          "arena-unlocks:11111111-1111-4111-8111-111111111111",
          "9",
        );
      } catch {
        /* No storage. */
      }
    },
    { journey: journey("match:rw-test", o.xp) },
  );
}
/** A duel that just ended (the harness's practice room, made a match). */
async function finish(
  page: Page,
  o: { won: boolean; bot?: boolean; rated?: boolean; rating?: object },
) {
  await page.evaluate(() => (window as any).__room("practice"));
  await openPlayPanel(page);
  await startPractice(page);
  await pushUntilBattle(page);
  await page.evaluate((o) => {
    const w = window as any;
    const reply = w.__reply;
    // The server's answer to the match report: saved, with the rating.
    w.__reply = (ev: string, data: unknown) =>
      ev === "match-report"
        ? {
            ok: true,
            report: {
              confirmed: true,
              records: o.bot
                ? []
                : [{ id: "kai-id", name: "Kai", wins: 2, losses: 1 }],
              achievements: [],
              rating: o.rating
                ? o.rating
                : o.rated
                  ? {
                      rating: o.won ? 1020 : 1004,
                      before: 1012,
                      matches: 9,
                      rank: "Spark III",
                      previousRank: "Spark III",
                      next: { name: "Spark II", at: 1035 },
                    }
                  : undefined,
            },
          }
        : reply(ev, data);
    delete w.__snap.practice;
    const rival = w.__snap.players.find((p: any) => p.id !== "me");
    rival.name = "Kai";
    Object.assign(w.__snap, {
      phase: "finished",
      matchId: "rw-test",
      winner: o.won ? "me" : rival.id,
      vsBot: o.bot ? "easy" : null,
      activityStatus: "saved",
      scores: { me: o.won ? 3 : 1, [rival.id]: o.won ? 1 : 3 },
    });
    w.__push();
  }, o);
  await expect(page.locator(".action-overlay h2")).toBeVisible();
}
/** The server saved the match: the XP, the coins and the level arrive. */
async function saved(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__economyPatch = w.__after;
    w.__sock.fire("economy-changed");
  });
  await expect(page.locator('.rw-tile[data-rw="xp"]')).toBeVisible();
  await page.evaluate(() => (window as any).__push());
}
type Box = { x: number; y: number; width: number; height: number };
const SIZES = [
  { width: 667, height: 375, phone: true },
  { width: 844, height: 390, phone: true },
  {
    width: 852,
    height: 393,
    phone: true,
    inset: { left: 59, right: 59, bottom: 21, top: 0 },
  },
  { width: 1440, height: 900, phone: false },
];
for (const size of SIZES) {
  const name = `${size.width}x${size.height}${size.inset ? "-notch" : ""}`;
  test(`a rated win shows what it gave, tile by tile (${name})`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      await prepare(page);
      const errors = await openHub(page);
      if (size.inset)
        await page.evaluate((inset) => {
          for (const [key, value] of Object.entries(inset))
            document.documentElement.style.setProperty(
              `--safe-${key}`,
              `${value}px`,
            );
        }, size.inset);
      await finish(page, { won: true, rated: true });
      // Before the server has saved it: the sheet says so, no tiles yet.
      await expect(page.locator(".rw-pending")).toHaveText("Updating your XP…");
      await snap(page, info, `rewards-pending-${name}`);
      await saved(page);
      const tiles = page.locator(".rw-tile");
      await expect(tiles).toHaveCount(5);
      await expect(tiles.nth(0)).toContainText("+250 XP");
      await expect(tiles.nth(0)).toContainText("Lv 3");
      await expect(tiles.nth(0).locator(".rw-burst")).toHaveText("Level up");
      await expect(tiles.nth(1)).toContainText("Spark III");
      await expect(tiles.nth(1)).toContainText("+8");
      await expect(tiles.nth(2)).toContainText("Tier 1");
      await expect(tiles.nth(2).locator(".rw-burst")).toHaveText("Tier up");
      await expect(tiles.nth(3)).toContainText("Mastery");
      await expect(tiles.nth(3)).toContainText("Voltkit · 5");
      await expect(tiles.nth(3).locator(".rw-burst")).toHaveText("Bronze");
      await expect(tiles.nth(4)).toContainText("+95");
      await expect(page.locator(".rw-levelup")).toContainText(
        "Unlocked: Boss Raids, Daily Missions",
      );
      await expect(page.locator(".rw-levelup")).toContainText("+60 coins");
      // The rank is in its tile, not twice.
      await expect(page.locator(".rating-change")).toHaveCount(0);
      // Let the celebration run to its end, then look at it.
      await page.evaluate(() => {
        for (const a of document.getAnimations())
          if (a.effect?.getTiming().iterations !== Infinity) a.finish();
      });
      // Every tile is whole: nothing cut off, nothing over another.
      const boxes: Box[] = [];
      for (const t of await tiles.all()) {
        const r = (await t.boundingBox())!;
        boxes.push(r);
        for (const part of [".rw-label", ".rw-value"])
          expect(
            await t
              .locator(part)
              .evaluate((el) => el.scrollWidth - el.clientWidth),
            `${part} fits`,
          ).toBeLessThanOrEqual(1);
        // Its bar spans the tile, inside its padding.
        // (The coins tile has no bar.)
        if (await t.locator(".rw-bar").count()) {
          const bar = (await t.locator(".rw-bar").boundingBox())!;
          expect(bar.x).toBeGreaterThanOrEqual(r.x + 6);
          expect(bar.x + bar.width).toBeLessThanOrEqual(r.x + r.width - 6);
        }
      }
      for (let i = 0; i < boxes.length; i++)
        for (let k = i + 1; k < boxes.length; k++) {
          const a = boxes[i],
            b = boxes[k];
          expect(
            a.x + a.width <= b.x + 1 ||
              b.x + b.width <= a.x + 1 ||
              a.y + a.height <= b.y + 1 ||
              b.y + b.height <= a.y + 1,
            `tiles ${i} and ${k} apart`,
          ).toBe(true);
        }
      // Tiles in a row are the same height.
      for (let i = 1; i < boxes.length; i++)
        if (Math.abs(boxes[i].y - boxes[i - 1].y) < 2)
          expect(Math.abs(boxes[i].height - boxes[i - 1].height)).toBeLessThan(
            1.5,
          );
      await snap(page, info, `rewards-win-${name}`);
      // The middle's edges fade where more is hidden past them (audit
      // A06-A08: a line cut by the foot read as broken): taller than the
      // screen, its bottom fades at the top and its top at the bottom;
      // all showing, nothing fades.
      const middle = page.locator("#arena-overlay .panel-scroll");
      const edges = () =>
        middle.evaluate((el) => ({
          above: el.classList.contains("has-more-above"),
          below: el.classList.contains("has-more-below"),
          mask: getComputedStyle(el).maskImage,
          scrolls: el.scrollHeight > el.clientHeight + 1,
        }));
      const first = await edges();
      if (size.phone)
        expect(first.scrolls, "the phone's middle scrolls").toBe(true);
      if (first.scrolls) {
        expect(first).toMatchObject({ above: false, below: true });
        expect(first.mask).toContain("gradient");
        await middle.evaluate((el) => (el.scrollTop = el.scrollHeight));
        await expect.poll(edges).toMatchObject({ above: true, below: false });
        await middle.evaluate((el) => (el.scrollTop = 0));
        await expect.poll(edges).toMatchObject({ above: false, below: true });
      } else {
        expect(first).toMatchObject({
          above: false,
          below: false,
          mask: "none",
        });
      }

      // Rematch is the main button, the widest; Add friend sits beside it.
      const again = page.locator("#rematch"),
        add = page.locator(".result-actions [data-add-friend]");
      await expect(again).toHaveText("Rematch");
      await expect(add).toHaveText("Add friend");
      await expect(add).toHaveAttribute("aria-label", "Add Kai as a friend");
      const a = (await again.boundingBox())!,
        f = (await add.boundingBox())!;
      expect(a.width).toBeGreaterThan(f.width);
      expect(Math.abs(a.y - f.y)).toBeLessThan(2);
      expect(f.x).toBeGreaterThanOrEqual(a.x + a.width);
      for (const b of await page.locator(".result-actions button").all()) {
        const r = (await b.boundingBox())!;
        expect(r.height).toBeGreaterThanOrEqual(40);
        expect(r.x).toBeGreaterThanOrEqual(size.inset?.left ?? 0);
        expect(r.x + r.width).toBeLessThanOrEqual(
          size.width - (size.inset?.right ?? 0),
        );
        expect(r.y + r.height).toBeLessThanOrEqual(size.height);
        expect(
          await b.evaluate((el) => el.scrollWidth - el.clientWidth),
        ).toBeLessThanOrEqual(1);
      }
      // The note beside the buttons ("0/2 ready for a rematch") keeps to
      // two lines: in three, the taller foot left the table one row (B20).
      const note = await page
        .locator("#arena-overlay .sheet-note")
        .evaluate((el) => {
          if (getComputedStyle(el).display === "none") return 0;
          const lh = parseFloat(getComputedStyle(el).lineHeight);
          return Math.round(el.getBoundingClientRect().height / lh);
        });
      expect(note, "the note's lines").toBeLessThanOrEqual(2);
      // The records line keeps the head-to-head, without a second Add.
      await expect(page.locator(".records")).toContainText("You vs Kai");
      await expect(page.locator(".records [data-add-friend]")).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("drawn again, the celebration carries on instead of starting over", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepare(page);
  const errors = await openHub(page);
  await finish(page, { won: true, rated: true });
  await saved(page);
  const tile = page.locator('.rw-tile[data-rw="xp"]');
  const time = () =>
    tile.evaluate((el) =>
      Math.max(
        ...el
          .getAnimations({ subtree: true })
          .map((a) => Number(a.currentTime) || 0),
      ),
    );
  // Well into the celebration, by the animations' own clock: it runs
  // behind the wall clock on a slow renderer (CI's was at 266 ms after a
  // 900 ms wait), so the test waits for the animation, not for a time.
  await expect
    .poll(time, { timeout: 30_000, intervals: [100] })
    .toBeGreaterThan(500);
  const before = await time();
  // The opponent readies: the sheet's markup changes and is set again.
  await page.evaluate(() => {
    const w = window as any;
    w.__snap.players.find((p: any) => p.id !== "me").ready = true;
    w.__push();
  });
  await expect(page.locator(".sheet-note")).toContainText("1/2 ready");
  expect(await time()).toBeGreaterThanOrEqual(before);
  // Confetti is there on a win, takes no room, and sits outside the part
  // that scrolls: its falling pieces never make the sheet scroll further.
  expect(await page.locator(".rw-confetti i").count()).toBeGreaterThan(10);
  expect(
    await page
      .locator(".rw-confetti")
      .evaluate((el) => el.getBoundingClientRect().height),
  ).toBe(0);
  await expect(page.locator(".panel-scroll .rw-confetti")).toHaveCount(0);
  await expect(page.locator(".overlay-card > .rw-confetti")).toHaveCount(1);
  const scrollable = () =>
    page
      .locator(".panel-scroll")
      .evaluate((el) => el.scrollHeight - el.clientHeight);
  const during = await scrollable();
  await page.evaluate(() => {
    for (const a of document.getAnimations())
      if (a.effect?.getTiming().iterations !== Infinity) a.finish();
  });
  expect(await scrollable()).toBe(during);
  // The page itself never scrolls for it either.
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight + 1,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("a loss against a bot: no confetti, no rank, Play again", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await prepare(page);
    const errors = await openHub(page);
    await finish(page, { won: false, bot: true });
    await saved(page);
    await expect(page.locator(".rw-confetti")).toHaveCount(0);
    await expect(page.locator(".rw-fighter.is-hopping")).toHaveCount(0);
    await expect(page.locator('.rw-tile[data-rw="rank"]')).toHaveCount(0);
    await expect(page.locator('.rw-tile[data-rw="xp"]')).toBeVisible();
    await expect(page.locator("#rematch")).toHaveText("Play again");
    await expect(page.locator(".result-actions [data-add-friend]")).toHaveCount(
      0,
    );
    await page.evaluate(() => {
      for (const a of document.getAnimations())
        if (a.effect?.getTiming().iterations !== Infinity) a.finish();
    });
    await snap(page, info, "rewards-loss-bot-844x390");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

// The rank road (docs/rank-road.md): what a rated match did to your rank
// is said once, in the Rank tile and in a toast.
for (const [name, won, rating, burst, note, toast] of [
  [
    "shield",
    false,
    {
      rating: 1105,
      before: 1108,
      matches: 30,
      rank: "Flare III",
      previousRank: "Flare III",
      next: { name: "Flare II", at: 1140 },
      shield: false,
      shielded: true,
    },
    "Shield",
    "Your shield held",
    "Your shield held: you stay in Flare.",
  ],
  [
    "new-tier",
    true,
    {
      rating: 1112,
      before: 1098,
      matches: 30,
      rank: "Flare III",
      previousRank: "Spark I",
      next: { name: "Flare II", at: 1140 },
      shield: true,
    },
    "New tier",
    "Flare II at 1,140",
    "New tier: Flare! Its title, 150 coins and a shield are yours.",
  ],
] as const)
  test(`a rated match's rank news: ${name}`, async ({ browser }, info) => {
    const context = await browser.newContext({
      viewport: { width: 667, height: 375 },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      await prepare(page);
      const errors = await openHub(page);
      await finish(page, { won, rated: true, rating });
      await saved(page);
      const tile = page.locator('.rw-tile[data-rw="rank"]');
      await expect(tile).toContainText("Flare III");
      await expect(tile.locator(".rw-burst")).toHaveText(burst);
      await expect(tile.locator(".rw-note")).toHaveText(note);
      await expect(tile.locator(".rw-gain")).toHaveText(won ? "+14" : "−3");
      await expect(page.locator("#toast")).toHaveText(toast);
      await page.evaluate(() => {
        for (const a of document.getAnimations())
          if (a.effect?.getTiming().iterations !== Infinity) a.finish();
      });
      // The tile's words read in full on the smallest phone.
      expect(
        await tile.evaluate((t) =>
          Array.from(t.querySelectorAll<HTMLElement>(".rw-value, .rw-note"))
            .filter((e) => e.scrollWidth > e.clientWidth + 1)
            .map((e) => e.textContent),
        ),
      ).toEqual([]);
      await snap(page, info, `rewards-rank-${name}-667x375`);
      // The notice sits above the foot's buttons, clear of the title and
      // the score it covered at the top (audit A05).
      const toastBox = (await page.locator("#toast").boundingBox())!;
      const title = (await page
        .locator("#arena-overlay .result-score")
        .boundingBox())!;
      const foot = (await page
        .locator("#arena-overlay .overlay-card > .panel-actions")
        .boundingBox())!;
      expect(toastBox.y, "below the title and score").toBeGreaterThanOrEqual(
        title.y + title.height,
      );
      expect(
        toastBox.y + toastBox.height,
        "above the buttons",
      ).toBeLessThanOrEqual(foot.y);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("reduced motion shows the end state at once", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await prepare(page);
    const errors = await openHub(page);
    await finish(page, { won: true, rated: true });
    await saved(page);
    await expect(page.locator(".rw.is-still")).toBeVisible();
    await expect(page.locator(".rw-confetti")).toHaveCount(0);
    expect(
      await page
        .locator(".rw")
        .evaluate((el) => el.getAnimations({ subtree: true }).length),
    ).toBe(0);
    // The level-up still reads: its burst is there, the bar at its end.
    await expect(
      page.locator('.rw-tile[data-rw="xp"] .rw-burst'),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
