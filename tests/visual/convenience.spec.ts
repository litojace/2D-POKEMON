import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  openHub,
  openLobby,
  openPlayPanel,
  pushUntilBattle,
  snap,
  startPractice,
} from "./helpers";
import { ISLAND, layoutProblems, setInsets } from "./ui-measure";
import { KAI, KAI_FRIEND, kaiHistory, myHistory } from "./history-fixture";
import { CHARACTERS } from "../../packages/shared/src/index";

// Five conveniences (22 Nov 2026): Change fighter and a losing-streak note
// on a bot match's results, Your skills in Settings, Solo test's switches
// remembered, and Play the … bot again from match history.
const SIZES = [
  { name: "844x390", width: 844, height: 390, phone: true },
  {
    name: "852x393-island",
    width: 852,
    height: 393,
    phone: true,
    island: true,
  },
  { name: "667x375", width: 667, height: 375, phone: true },
  { name: "1440x900", width: 1440, height: 900, phone: false },
];
type Size = (typeof SIZES)[number];

async function context(browser: Browser, size: Size) {
  return browser.newContext({
    viewport: { width: size.width, height: size.height },
    isMobile: size.phone,
    hasTouch: size.phone,
  });
}
/** Every request the page sends, in order. */
async function recordSent(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__sent = [];
    const before = w.__emit;
    w.__emit = (ev: string, data: unknown) => {
      w.__sent.push([ev, data]);
      before?.(ev, data);
    };
  });
}
const sent = (page: Page, event: string) =>
  page.evaluate(
    (event) =>
      (window as any).__sent
        .filter(([ev]: [string]) => ev === event)
        .map(([, d]: [string, unknown]) => d),
    event,
  );
/** A Solo test room, then the battle on screen. */
async function practice(page: Page) {
  await page.evaluate(() => (window as any).__room("practice"));
  await recordSent(page);
  await openPlayPanel(page);
  await startPractice(page);
  await pushUntilBattle(page);
}

for (const size of SIZES)
  test(`a lost bot match offers Change fighter and, the third loss in a row, practice at ${size.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const ctx = await context(browser, size);
    try {
      const page = await ctx.newPage();
      // Two losses to bots already.
      await page.addInitScript(() =>
        localStorage.setItem(
          "arena-bot-losses",
          JSON.stringify({ streak: 2, last: "earlier" }),
        ),
      );
      const errors = await openHub(page);
      if (size.island) await setInsets(page, ISLAND);
      await practice(page);
      await page.evaluate(() => {
        const w = window as any;
        delete w.__snap.practice;
        const bot = w.__snap.players.find((p: any) => p.id !== "me");
        Object.assign(w.__snap, {
          phase: "finished",
          matchId: "convenience-loss",
          winner: bot.id,
          vsBot: "hard",
          scores: { me: 1, [bot.id]: 3 },
        });
        w.__push();
      });
      await expect(page.locator("#rematch")).toBeVisible();
      const coach = page.locator(".result-coach");
      await expect(coach).toContainText("3 losses in a row");
      await expect(page.locator("#coach-practice")).toContainText("Practice");
      await expect(page.locator("#coach-easier")).toContainText("Try Normal");
      await expect(page.locator("#change-fighter")).toBeVisible();
      await coach.scrollIntoViewIfNeeded();
      expect(
        await layoutProblems(page, {
          inset: size.island ? ISLAND : undefined,
          phone: size.phone,
        }),
      ).toEqual([]);
      await snap(page, info, `results-coach-${size.name}`);
      // Change fighter: a pick is the rematch, with that fighter.
      await page.locator("#change-fighter").click();
      const tiles = page.locator("#dialog .fp-tile");
      await expect(tiles).toHaveCount(Object.keys(CHARACTERS).length);
      await expect(
        page.locator('#dialog .fp-tile[aria-pressed="true"]'),
      ).toHaveCount(1);
      await snap(page, info, `fighter-picker-${size.name}`);
      await page.locator('#dialog [data-fp-pick="tidefin"]').click();
      await expect(page.locator("#dialog")).not.toHaveAttribute("open", "");
      expect(await sent(page, "rematch")).toEqual([{ character: "tidefin" }]);
      expect(errors).toEqual([]);
    } finally {
      await ctx.close();
    }
  });

test("the losing-streak note's Practice leaves the bot room for Solo test", async ({
  browser,
}) => {
  const ctx = await context(browser, SIZES[0]);
  try {
    const page = await ctx.newPage();
    await page.addInitScript(() =>
      localStorage.setItem(
        "arena-bot-losses",
        JSON.stringify({ streak: 5, last: "earlier" }),
      ),
    );
    const errors = await openHub(page);
    await practice(page);
    await page.evaluate(() => {
      const w = window as any;
      delete w.__snap.practice;
      const bot = w.__snap.players.find((p: any) => p.id !== "me");
      Object.assign(w.__snap, {
        phase: "finished",
        matchId: "convenience-loss-2",
        winner: bot.id,
        vsBot: "easy",
        scores: { me: 0, [bot.id]: 3 },
      });
      w.__push();
    });
    // At Easy there is no easier bot: only Practice.
    await expect(page.locator(".result-coach")).toContainText("6 losses");
    await expect(page.locator("#coach-easier")).toHaveCount(0);
    await page.evaluate(() => ((window as any).__sent = []));
    await page.locator("#coach-practice").click();
    await expect.poll(() => sent(page, "leave")).toHaveLength(1);
    await expect.poll(() => sent(page, "practice")).toHaveLength(1);
    expect(errors).toEqual([]);
  } finally {
    await ctx.close();
  }
});

for (const size of SIZES)
  test(`Settings → Your skills lists the fighter's skills at ${size.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const ctx = await context(browser, size);
    try {
      const page = await ctx.newPage();
      const errors = await openHub(page);
      if (size.island) await setInsets(page, ISLAND);
      await practice(page);
      await page.click("#battle-menu");
      await expect(page.locator("#settings-skills")).toBeVisible();
      await snap(page, info, `settings-match-${size.name}`);
      await page.click("#settings-skills");
      const rows = page.locator("#dialog .sk-row");
      // The basic attack, three skills and the ultimate.
      await expect(rows).toHaveCount(5);
      await expect(rows.nth(1)).toContainText("cooldown");
      await expect(rows.nth(4)).toContainText("Ultimate");
      expect(
        await layoutProblems(page, {
          inset: size.island ? ISLAND : undefined,
          phone: size.phone,
        }),
      ).toEqual([]);
      await snap(page, info, `skills-${size.name}`);
      await page.click("#skills-back");
      await expect(page.locator("#dialog .settings-screen")).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await ctx.close();
    }
  });

test("Solo test starts with the switches left on last time", async ({
  browser,
}) => {
  const ctx = await context(browser, SIZES[0]);
  try {
    const page = await ctx.newPage();
    await page.addInitScript(() =>
      localStorage.setItem(
        "ea-practice",
        JSON.stringify({
          unlimitedCooldowns: true,
          targetAttacks: false,
          ex: true,
        }),
      ),
    );
    const errors = await openHub(page);
    await practice(page);
    await expect
      .poll(() => sent(page, "practice-options"))
      .toEqual([{ unlimitedCooldowns: true, targetAttacks: false }]);
    await page.click("#battle-menu");
    await page.click("#settings-practice");
    await expect(page.locator("#practice-ex")).toBeChecked();
    // A change is kept for next time.
    await page.locator('label[for="practice-attacks"]').click();
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("ea-practice")!),
      ),
    ).toMatchObject({ targetAttacks: true, ex: true });
    expect(errors).toEqual([]);
  } finally {
    await ctx.close();
  }
});

for (const size of [SIZES[2], SIZES[3]])
  test(`your bot match in history offers that bot again at ${size.name}`, async ({
    browser,
  }, info) => {
    const ctx = await context(browser, size);
    try {
      const page = await ctx.newPage();
      await page.addInitScript(
        ({ mine, kai, friend, KAI }) => {
          const w = window as any;
          w.__history = { me: mine, [KAI]: kai };
          w.__friends = {
            code: "ABCDEF12",
            friends: [friend],
            incoming: [],
            outgoing: [],
          };
        },
        { mine: myHistory(), kai: kaiHistory(), friend: KAI_FRIEND, KAI },
      );
      const errors = await openLobby(page);
      await recordSent(page);
      await page.click("#account-profile");
      const panel = page.locator(".profile-panel");
      await panel.locator('[data-ui-profile-tab="matches"]').click();
      const bot = panel
        .locator(".mh-row")
        .filter({ hasText: "vs Hard bot" })
        .first();
      await bot.locator(".mh-sum").click();
      const again = bot.locator("[data-history-replay]");
      await expect(again).toHaveText("Play the Hard bot again");
      await again.scrollIntoViewIfNeeded();
      await snap(page, info, `history-replay-${size.name}`);
      await again.click();
      await expect(panel).toHaveCount(0);
      await expect
        .poll(() => sent(page, "bot-match"))
        .toEqual([expect.objectContaining({ difficulty: "hard" })]);
      expect(errors).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
