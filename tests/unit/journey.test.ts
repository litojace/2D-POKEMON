import { describe, it, expect } from "vitest";
import {
  levelThreshold,
  playerLevel,
  MAX_PLAYER_LEVEL,
  JOURNEY_ITEMS,
  JOURNEY_ITEM_BY_ID,
  LEVEL_MILESTONES,
  seasonReward,
  seasonTheme,
  SEASON_THEMES,
} from "../../packages/shared/src/journey";
import { arcadeWeek, ARCADE_IDS } from "../../packages/shared/src/arcade";
import { expeditionRoute } from "../../packages/shared/src/expedition";
import { RAID_BOSSES, featuredOn } from "../../packages/shared/src/raid";
import { adventureMarkup, resultXp } from "../../apps/client/src/adventure-ui";
describe("player levels", () => {
  for (let level = 2; level <= MAX_PLAYER_LEVEL; level++)
    it(`enters level ${level} at its exact threshold`, () => {
      const xp = levelThreshold(level);
      expect(playerLevel(xp).level).toBe(level);
      expect(playerLevel(xp - 1).level).toBe(level - 1);
      expect(playerLevel(xp).percent).toBe(level === 50 ? 100 : 0);
    });
  it("bounds invalid input and retains XP at the cap", () => {
    for (const xp of [-1, NaN, Infinity]) expect(playerLevel(xp).level).toBe(1);
    expect(playerLevel(1e6)).toMatchObject({
      level: 50,
      total: 1e6,
      needed: 0,
      percent: 100,
    });
    expect(levelThreshold(50)).toBe(34300);
  });
  it("provides ten distinct milestone rewards and a valid cosmetic catalog", () => {
    expect(LEVEL_MILESTONES).toHaveLength(10);
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
  it("returns three built bosses for every expedition route without affecting the daily raid", () => {
    const seen = new Set();
    for (let n = 1; n <= 28; n++) {
      const day = `2026-10-${String(n).padStart(2, "0")}`,
        route = expeditionRoute(day);
      expect(route).toHaveLength(3);
      expect(new Set(route).size).toBe(3);
      route.forEach((id) => {
        expect(RAID_BOSSES[id].playable).toBe(true);
        seen.add(id);
      });
      expect(RAID_BOSSES[featuredOn(day).boss].playable).toBe(true);
    }
    expect(seen.size).toBe(7);
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
    }
    expect(seen.size).toBe(4);
  });
});
it("renders unavailable storage honestly and offers every new mode", () => {
  for (const tab of ["levels", "season", "arcade", "expedition"] as const) {
    const html = adventureMarkup({ tab }, undefined, "voltkit");
    expect(html).not.toMatch(/NaN|undefined/);
    expect(html).toContain('data-adventure-tab="season"');
  }
  expect(adventureMarkup({ tab: "arcade" }, undefined, "voltkit")).toContain(
    "arcade-bot",
  );
  expect(
    adventureMarkup({ tab: "expedition" }, undefined, "voltkit"),
  ).toContain("expedition-solo");
  expect(resultXp(undefined, "x")).toBe("");
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
  expect(resultXp(j, "unknown", "saved")).toContain("Updating your XP");
  expect(resultXp(j, "unknown", "saved", false)).toContain("No XP earned");
  expect(resultXp(j, "unknown", "unavailable")).toContain("could not be saved");
});
