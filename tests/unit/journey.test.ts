import { describe, it, expect } from "vitest";
import {
  levelThreshold,
  levelUpCoins,
  playerLevel,
  xpToNextLevel,
  MAX_PLAYER_LEVEL,
  SEASON_RULES,
  seasonRules,
  JOURNEY_ITEMS,
  JOURNEY_ITEM_BY_ID,
  LEVEL_MILESTONES,
  seasonReward,
  seasonTheme,
  SEASON_THEMES,
} from "../../packages/shared/src/journey";
import { arcadeWeek, ARCADE_IDS } from "../../packages/shared/src/arcade";
import { resultXp } from "../../apps/client/src/adventure-ui";
import {
  arcadeNow,
  defaultPick,
  itemSource,
  itemState,
  journeyMarkup,
  journeyView,
  nextMilestones,
  seasonRoad,
  type JourneyTab,
} from "../../apps/client/src/screens/journey-view";
// The Journey panel (UI remodel step 4): one tab's markup.
const journeyHtml = (tab: JourneyTab, e: any, selected: string | null = null) =>
  journeyMarkup(
    { ...journeyView(tab), selected },
    { economy: e ?? null, look: {}, champion: "voltkit" },
  );
describe("player levels", () => {
  for (let level = 2; level <= MAX_PLAYER_LEVEL; level++)
    it(`enters level ${level} at its exact threshold`, () => {
      const xp = levelThreshold(level);
      expect(playerLevel(xp).level).toBe(level);
      expect(playerLevel(xp - 1).level).toBe(level - 1);
      expect(playerLevel(xp).percent).toBe(
        level === MAX_PLAYER_LEVEL ? 100 : 0,
      );
    });
  it("bounds invalid input and retains XP at the cap", () => {
    for (const xp of [-1, NaN, Infinity]) expect(playerLevel(xp).level).toBe(1);
    expect(playerLevel(1e6)).toMatchObject({
      level: 100,
      total: 1e6,
      needed: 0,
      percent: 100,
    });
    expect(levelThreshold(50)).toBe(34300);
    expect(levelThreshold(100)).toBe(431625);
    expect(xpToNextLevel(100)).toBe(0);
  });
  it("keeps levels 1–50 exactly as they were before levels went to 100", () => {
    for (let level = 1; level <= 50; level++) {
      const n = level - 1;
      expect(levelThreshold(level)).toBe(n * 100 + (n * (n - 1) * 25) / 2);
    }
  });
  it("never asks for less XP than the level before", () => {
    for (let level = 2; level < MAX_PLAYER_LEVEL; level++)
      expect(xpToNextLevel(level)).toBeGreaterThanOrEqual(
        xpToNextLevel(level - 1),
      );
  });
  it("matches the tuning table in the hub redesign handoff (NUMBERS.md)", () => {
    const rows: [number, number, number][] = [
      [1, 100, 0],
      [10, 325, 1800],
      [20, 575, 6175],
      [30, 825, 13050],
      [40, 1075, 22425],
      [49, 1300, 33000],
      [50, 1450, 34300],
      [55, 2800, 44000],
      [60, 4600, 61550],
      [65, 6700, 88700],
      [69, 8550, 118200],
      [70, 9075, 126750],
      [80, 9825, 220875],
      [90, 10575, 322500],
      [99, 11250, 420375],
    ];
    for (const [level, next, total] of rows) {
      expect(xpToNextLevel(level)).toBe(next);
      expect(levelThreshold(level)).toBe(total);
    }
    // 30 coins for each of Lv 2–49, 100 for each of Lv 50–100.
    expect(levelUpCoins(1, 100)).toBe(48 * 30 + 51 * 100);
    expect(levelUpCoins(49, 50)).toBe(100);
  });
  it("provides distinct milestone rewards and a valid cosmetic catalog", () => {
    // Every five levels; Lv 100 gives a title and a frame together.
    expect(LEVEL_MILESTONES.map((m) => m.level)).toEqual(
      Array.from({ length: 20 }, (_, i) => 5 * (i + 1)),
    );
    expect(new Set(JOURNEY_ITEMS.map((i) => i.id)).size).toBe(
      JOURNEY_ITEMS.length,
    );
    for (const m of LEVEL_MILESTONES)
      if (m.item) expect(JOURNEY_ITEM_BY_ID[m.item]).toBeDefined();
  });
});
describe("calendar rotations", () => {
  it("keeps a weekly mode stable Monday through Sunday and rotates through all three", () => {
    const ids = [];
    for (const day of ["2026-10-19", "2026-10-20", "2026-10-25"])
      expect(arcadeWeek(day)).toEqual(arcadeWeek("2026-10-19"));
    for (const day of ["2026-10-19", "2026-10-26", "2026-11-02"])
      ids.push(arcadeWeek(day).id);
    expect(new Set(ids)).toEqual(new Set(ARCADE_IDS));
    expect(arcadeWeek("2026-10-26").week).toBe("2026-10-26");
  });
  it("resolves all season themes and four valid cosmetic milestones without a purchase gate", () => {
    const seen = new Set();
    for (let month = 1; month <= 12; month++) {
      const season = `2026-${String(month).padStart(2, "0")}`,
        theme = seasonTheme(season);
      seen.add(theme);
      expect(SEASON_THEMES[theme]).toBeDefined();
      for (const tier of [5, 10, 15, 20])
        expect(
          JOURNEY_ITEM_BY_ID[seasonReward(tier, season).item!],
        ).toBeDefined();
      expect(seasonReward(1, season)).toEqual({ coins: 50, item: null });
      // The 30-tier season moves the same four cosmetics to tiers 5, 12, 20 and 30.
      expect(
        [5, 10, 12, 15, 20, 30].map(
          (t) => seasonReward(t, season, SEASON_RULES).item,
        ),
      ).toEqual([
        `season-${theme}-frame`,
        null,
        `season-${theme}-aura`,
        null,
        `season-${theme}-colors`,
        `season-${theme}-victory`,
      ]);
    }
    expect(seen.size).toBe(4);
  });
  it("reads the season rules the server sends and falls back to 20 × 400", () => {
    expect(seasonRules(undefined)).toEqual({
      tiers: 20,
      tierXp: 400,
      itemTiers: [5, 10, 15, 20],
    });
    expect(
      seasonRules({ tiers: 30, tierXp: 1200, itemTiers: [5, 12, 20, 30] }),
    ).toEqual(SEASON_RULES);
    expect(seasonRules({ tiers: 30, tierXp: 1200 })).toEqual({
      tiers: 20,
      tierXp: 400,
      itemTiers: [5, 10, 15, 20],
    });
  });
});
it("renders unavailable storage honestly and offers every new mode", () => {
  for (const tab of ["levels", "season", "arcade"] as const) {
    const html = journeyHtml(tab, undefined);
    expect(html).not.toMatch(/NaN|undefined/);
    expect(html).toContain('data-ui-jtab="season"');
    expect(html.match(/data-ui-jtab=/g)).toHaveLength(3);
  }
  expect(journeyHtml("arcade", undefined)).toContain("arcade-bot");
  // A database without migration 022 says so; the arcade still plays.
  expect(journeyHtml("season", { balance: 0, owned: [] })).toContain(
    "022_player_journey.sql",
  );
  expect(resultXp(undefined, "x")).toBe("");
});
it("shows the Daily Spark and a 30-tier season when the server sends them", () => {
  const journey = {
    xp: 900,
    recent: [],
    season: {
      id: "2026-12",
      xp: 6100,
      week: "2026-11-30",
      goals: {},
      completed: [],
      tiers: 30,
      tierXp: 1200,
      itemTiers: [5, 12, 20, 30],
    },
    spark: { day: "2026-12-01", used: 120, limit: 500 },
    unlocked: [],
  };
  const e = { journey, balance: 0, owned: [] } as any;
  const season = journeyHtml("season", e);
  expect(season).toContain("Tier 5 / 30");
  expect(season).toContain('aria-label="Tier 30:');
  expect(season).not.toContain('aria-label="Tier 31:');
  expect(season.match(/class="journey-tier[ "]/g)).toHaveLength(30);
  // Cosmetic tiers are the large ones: the season's four.
  expect(season.match(/journey-tier is-big/g)).toHaveLength(4);
  // Tier 6 is the next to earn; 36,000 XP completes the road.
  expect(season).toContain("journey-tier is-next");
  expect(season).toContain("100 / 1,200 XP to tier 6");
  expect(season).toContain("380 XP");
  expect(season).toContain("left today at ×2");
  expect(season).toMatch(/Ends in \d+ d \d+ h/);
  expect(season).toMatch(/Resets in (\d+ d \d+ h|\d+ h \d+ min|\d+ min)/);
  const levels = journeyHtml("levels", e);
  expect(levels).toContain("100 coins from level 50 to 100");
  expect(levels).not.toMatch(/NaN|undefined/);
});
it("shows mission XP, level-ups and the actual coin reward together on the result card", () => {
  const j = {
    xp: 125,
    recent: [
      {
        ref: "match:test",
        source: "match",
        amount: 75,
        at: "2026-10-20T00:00:00Z",
      },
      {
        ref: "2026-10-20:0",
        source: "mission",
        amount: 50,
        at: "2026-10-20T00:00:00Z",
      },
    ],
    season: {
      id: "2026-10",
      xp: 125,
      week: "2026-10-19",
      goals: {},
      completed: [],
    },
    unlocked: [],
  };
  const html = resultXp(j, "match:test", "saved");
  expect(html).toContain("+125 XP");
  expect(html).toContain("LEVEL UP · 1 → 2");
  expect(html).toContain("+30 coins");
  expect(html).toContain("50 from daily missions");
  const spark = resultXp(
    {
      ...j,
      xp: 250,
      recent: [
        ...j.recent,
        {
          ref: "match:match:test",
          source: "spark",
          amount: 75,
          at: "2026-10-20T00:00:00Z",
        },
        {
          ref: "mission:2026-10-20:0",
          source: "spark",
          amount: 50,
          at: "2026-10-20T00:00:00Z",
        },
      ],
    },
    "match:test",
    "saved",
  );
  expect(spark).toContain("+250 XP");
  expect(spark).toContain(
    "75 from this run · 50 from daily missions · 125 Daily Spark bonus",
  );
  expect(spark).toContain("LEVEL UP · 1 → 3");
  expect(spark).toContain("+60 coins");
  expect(resultXp(j, "unknown", "saved")).toContain("Updating your XP");
  expect(resultXp(j, "unknown", "saved", false)).toContain("No XP earned");
  expect(resultXp(j, "unknown", "unavailable")).toContain("could not be saved");
});
describe("the Journey panel's rewards", () => {
  const season = (xp: number) => ({
    id: "2026-12",
    xp,
    week: "2026-11-30",
    goals: { play: 3, skills: 50 },
    completed: ["skills"],
    tiers: 30,
    tierXp: 1200,
    itemTiers: [5, 12, 20, 30],
  });
  const econ = (xp: number, seasonXp: number, owned: string[] = []) =>
    ({
      balance: 0,
      owned,
      journey: { xp, recent: [], season: season(seasonXp), unlocked: [] },
    }) as any;
  it("picks the next reward to earn on each tab", () => {
    // Tier 6 of 30: the season's next cosmetic is tier 12's aura.
    expect(defaultPick("season", econ(0, 7200))).toBe("season-astral-aura");
    // Level 60: the next level cosmetic is Lv 65's Nova entrance.
    expect(defaultPick("levels", econ(levelThreshold(60), 0))).toBe(
      "nova-entrance",
    );
    // Everything earned: the last one stays picked.
    expect(defaultPick("levels", econ(levelThreshold(100), 0))).toBe(
      "element-master-frame",
    );
    expect(defaultPick("season", econ(0, 36000))).toBe("season-astral-victory");
  });
  it("lights the next tier and ticks the earned ones", () => {
    const road = seasonRoad(econ(0, 7200).journey);
    expect(road.filter((t) => t.state === "got")).toHaveLength(6);
    expect(road.find((t) => t.state === "next")?.tier).toBe(7);
    expect(road.filter((t) => t.item).map((t) => t.tier)).toEqual([
      5, 12, 20, 30,
    ]);
    expect(nextMilestones(60).map((m) => m.level)).toEqual([65, 70, 75, 80]);
  });
  it("names where a reward comes from", () => {
    const j = econ(0, 0).journey;
    expect(itemSource("prism-frame", j).label).toBe("Level 55");
    expect(itemSource("season-astral-aura", j).label).toBe("Season tier 12");
  });
  it("equips only what you own, and says when you wear it", () => {
    const e = econ(levelThreshold(60), 0, ["prism-frame"]);
    const foot = (selected: string, look = {}) =>
      journeyMarkup(
        { ...journeyView("levels"), selected },
        { economy: e, look, champion: "voltkit" },
      );
    expect(foot("prism-frame")).toMatch(
      /data-journey-equip="prism-frame"(?![^>]*disabled)/,
    );
    expect(foot("prism-frame")).toContain("Level 55 · In your collection");
    expect(foot("prism-frame", { frame: "prism-frame" })).toContain(
      "Wearing it",
    );
    expect(foot("prism-frame", { frame: "prism-frame" })).toMatch(
      /disabled[^>]*data-journey-equip="prism-frame"/,
    );
    // Not owned: Locked, and how to earn it.
    expect(foot("solar-aura")).toContain("Locked");
    expect(foot("solar-aura")).toContain("Level 80 · Keep levelling up");
    expect(
      itemState("prism-frame", { economy: e, look: {}, champion: "voltkit" }),
    ).toMatchObject({ owned: true, worn: false });
    // Two equal buttons in the action bar, the main one last.
    expect(foot("prism-frame")).toMatch(
      /<div class="ui-actions"><button[^>]*data-journey-wardrobe[\s\S]*data-journey-equip/,
    );
  });
  it("starts this week's arcade from the action bar", () => {
    const html = journeyMarkup(journeyView("arcade"), {
      economy: null,
      look: {},
      champion: "voltkit",
    });
    for (const mode of ["arcade-duel", "arcade-teams", "arcade-bot"])
      expect(html).toContain(`data-journey-play="${mode}"`);
    expect(html).toContain("This week's arcade");
    expect(arcadeNow(Date.parse("2026-11-04T20:00:00Z")).id).toBe(
      arcadeWeek("2026-11-04").id,
    );
  });
});
