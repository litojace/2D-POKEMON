import { describe, expect, it } from "vitest";
import {
  coinsTile,
  confettiMarkup,
  fighterHop,
  levelUpLine,
  masteryTile,
  rankTile,
  rewardTiles,
  rewardsMarkup,
  seasonTile,
  syncRewardMotion,
  xpBreakdown,
  xpTile,
} from "../../apps/client/src/result-rewards";
import { xpAward } from "../../apps/client/src/adventure-ui";
import { recordsMarkup } from "../../apps/client/src/match-recap";
import { levelThreshold } from "../../packages/shared/src/journey";

// The result sheet's rewards (result-rewards.ts): the numbers behind each
// tile. The sheet itself: tests/visual/result-rewards.spec.ts.
const AT = "2026-11-26T20:00:00Z";
const row = (ref: string, amount: number, source: string, at = AT) => ({
  ref,
  amount,
  source,
  at,
});
const journey = (xp: number, recent: ReturnType<typeof row>[], season = 900) =>
  ({
    xp,
    recent,
    season: {
      id: "2026-11",
      xp: season,
      week: "2026-W48",
      goals: {},
      completed: [],
      tiers: 30,
      tierXp: 800,
      itemTiers: [5, 12, 20, 30],
    },
    unlocked: [],
  }) as any;
const REF = "match:m1";
/** 75 for the match, a 50 XP mission, and the Daily Spark on both. */
const full = (xp = 260) =>
  journey(xp, [
    row(REF, 75, "match"),
    row("2026-11-26:1", 50, "mission"),
    row(`match:${REF}`, 75, "spark"),
    row("mission:2026-11-26:1", 50, "spark"),
  ]);
const style = (html: string, name: string) =>
  Number(new RegExp(`--${name}:([0-9.]+)`).exec(html)![1]);

describe("the XP a match earned", () => {
  it("adds the match, its missions and the Daily Spark, and finds the levels", () => {
    const a = xpAward(full(), REF)!;
    expect(a).toMatchObject({
      run: 75,
      firstWin: 0,
      missions: 50,
      spark: 125,
      gained: 250,
      xpBefore: 10,
      xpAfter: 260,
      before: 1,
      after: 3,
    });
    expect(xpBreakdown(a)).toBe("Match 75 · Missions 50 · Spark 125");
  });
  it("leaves out XP earned after the match", () => {
    const j = full(360);
    j.recent.push(row("raid:later", 100, "raid", "2026-11-26T21:00:00Z"));
    expect(xpAward(j, REF)).toMatchObject({ xpBefore: 10, xpAfter: 260 });
  });
  it("is nothing until the award has arrived", () => {
    expect(xpAward(journey(10, []), REF)).toBeNull();
    expect(xpAward(undefined, REF)).toBeNull();
    expect(xpAward(full(), undefined)).toBeNull();
  });
  it("a match with nothing else has no breakdown", () => {
    const a = xpAward(journey(2625, [row(REF, 25, "match")]), REF)!;
    expect(xpBreakdown(a)).toBe("");
    expect(xpTile(a).note).toBeUndefined();
  });
});

describe("the tiles", () => {
  it("XP: the bar runs from before to after, and wraps on a level-up", () => {
    const t = xpTile(xpAward(full(), REF)!);
    expect(t.burst).toBe("Level up");
    expect(t.gain).toBe("+250 XP");
    expect(t.value).toContain("Lv 3");
    expect(t.value).toContain("35 / 150 XP");
    expect(t.bar).toContain("is-wrap");
    expect(style(t.bar!, "from")).toBeCloseTo(10 / 100, 2);
    expect(style(t.bar!, "to")).toBeCloseTo(35 / 150, 2);
    // No level-up: the same bar, further along.
    const same = xpTile(
      xpAward(journey(levelThreshold(3) + 100, [row(REF, 50, "match")]), REF)!,
    );
    expect(same.burst).toBeUndefined();
    expect(same.bar).not.toContain("is-wrap");
    expect(style(same.bar!, "from")).toBeLessThan(style(same.bar!, "to"));
  });
  it("rank: the gain, the place between this rank and the next, a promotion", () => {
    const up = rankTile({
      rating: 1020,
      before: 1012,
      matches: 9,
      rank: "Spark III",
      next: { name: "Spark II", at: 1035 },
    })!;
    expect(up).toMatchObject({ gain: "+8", tone: "up", burst: undefined });
    expect(style(up.bar!, "from")).toBeCloseTo(12 / 35, 2);
    expect(style(up.bar!, "to")).toBeCloseTo(20 / 35, 2);
    expect(up.note).toBe("Spark II at 1,035");
    const down = rankTile({
      rating: 1004,
      before: 1012,
      matches: 9,
      rank: "Spark III",
      next: { name: "Spark II", at: 1035 },
    })!;
    expect(down).toMatchObject({ gain: "−8", tone: "down" });
    // A step up inside the tier.
    const promoted = rankTile({
      rating: 1037,
      before: 1030,
      matches: 9,
      rank: "Spark II",
      previousRank: "Spark III",
      next: { name: "Spark I", at: 1070 },
    })!;
    expect(promoted.burst).toBe("Rank up");
    expect(style(promoted.bar!, "from")).toBe(0);
    // A new tier reads louder: its title, coins and a shield came with it.
    const tierUp = rankTile({
      rating: 1002,
      before: 995,
      matches: 9,
      rank: "Spark III",
      previousRank: "Sprout I",
      next: { name: "Spark II", at: 1035 },
      shield: true,
    })!;
    expect(tierUp.burst).toBe("New tier");
    expect(style(tierUp.bar!, "from")).toBe(0);
    // A lost rank: the bar shows where you landed, with nothing to run.
    const demoted = rankTile({
      rating: 995,
      before: 1002,
      matches: 9,
      rank: "Sprout I",
      previousRank: "Spark III",
      next: { name: "Spark III", at: 1000 },
    })!;
    expect(demoted.burst).toBeUndefined();
    expect(style(demoted.bar!, "from")).toBe(style(demoted.bar!, "to"));
    // The top rank has no next.
    const top = rankTile({
      rating: 1760,
      before: 1750,
      matches: 99,
      rank: "Legend I",
      previousRank: "Legend I",
      next: null,
    })!;
    expect(style(top.bar!, "to")).toBe(1);
    expect(top.note).toBe("The highest rank");
  });
  it("rank: the shield that held a loss, placement and the first rank", () => {
    // The loss would have dropped them out of Flare: held on its first step.
    const held = rankTile({
      rating: 1105,
      before: 1108,
      matches: 30,
      rank: "Flare III",
      previousRank: "Flare III",
      next: { name: "Flare II", at: 1140 },
      shield: false,
      shielded: true,
    })!;
    expect(held).toMatchObject({
      gain: "−3",
      tone: "down",
      burst: "Shield",
      note: "Your shield held",
    });
    expect(held.value).toContain("Flare III");
    // Placement: the rating may cross a rank's line, but there is no rank yet.
    const placing = rankTile({
      rating: 1012,
      before: 992,
      matches: 3,
      rank: "Unranked",
      previousRank: "Unranked",
      placementLeft: 2,
      next: { name: "Spark II", at: 1035 },
    })!;
    expect(placing.burst).toBeUndefined();
    expect(placing.label).toBe("Rank · 2 placement left");
    // The match that ends placement gives the first rank.
    const first = rankTile({
      rating: 1112,
      before: 1090,
      matches: 5,
      rank: "Flare III",
      previousRank: "Unranked",
      placementLeft: 0,
      next: { name: "Flare II", at: 1140 },
    })!;
    expect(first.burst).toBe("Ranked");
    // Not a rated match (no rating before it): no tile.
    expect(rankTile({ rating: 1000, matches: 0, rank: "Unranked" })).toBeNull();
  });
  it("placements say how many are left", () => {
    expect(
      rankTile({
        rating: 1016,
        before: 1000,
        matches: 2,
        rank: "Specialist",
        placementLeft: 3,
      })!.label,
    ).toBe("Rank · 3 placement left");
  });
  it("season: the tier, and what is left to the next", () => {
    const j = full();
    const t = seasonTile(j, xpAward(j, REF)!);
    // 650 before, 900 after: tier 0 to tier 1.
    expect(t.burst).toBe("Tier up");
    expect(t.value).toContain("Tier 1");
    expect(t.note).toBe("100 / 800 to tier 2");
    expect(style(t.bar!, "from")).toBeCloseTo(650 / 800, 2);
    expect(style(t.bar!, "to")).toBeCloseTo(100 / 800, 2);
    const done = journey(260, full().recent, 30 * 800 + 50);
    expect(seasonTile(done, xpAward(done, REF)!).note).toBe(
      "Every tier reached",
    );
  });
  it("mastery: matches toward the next tier, and the tier just reached", () => {
    const early = masteryTile({ fighter: "Voltkit", matches: 2 });
    expect(early.value).toContain("Voltkit");
    expect(early.value).toContain("2 of 5");
    expect(early.note).toBe("Bronze at 5 matches");
    expect(style(early.bar!, "from")).toBeCloseTo(1 / 5, 2);
    expect(style(early.bar!, "to")).toBeCloseTo(2 / 5, 2);
    const bronze = masteryTile({ fighter: "Voltkit", matches: 5 });
    expect(bronze.burst).toBe("Bronze");
    expect(bronze.note).toBe("Silver at 15 matches");
    expect(
      masteryTile({ fighter: "Voltkit", matches: 6 }).burst,
    ).toBeUndefined();
    expect(masteryTile({ fighter: "Voltkit", matches: 80 }).note).toBe(
      "The top tier",
    );
  });
  it("coins", () => {
    expect(coinsTile(1250).value).toBe("+1,250");
  });
  it("shows only what the match has: a bot match has no rank", () => {
    const facts = {
      won: true,
      journey: full(),
      ref: REF,
      eligible: true,
      mastery: { fighter: "Voltkit", matches: 5 },
      coins: 95,
    };
    expect(rewardTiles(facts).map((t) => t.id)).toEqual([
      "xp",
      "season",
      "mastery",
      "coins",
    ]);
    expect(
      rewardTiles({
        ...facts,
        rating: {
          rating: 1020,
          before: 1012,
          matches: 9,
          rank: "Specialist",
        },
      }).map((t) => t.id),
    ).toEqual(["xp", "rank", "season", "mastery", "coins"]);
    // No coins moved, records not saved yet: neither tile.
    expect(
      rewardTiles({ ...facts, coins: 0, mastery: undefined }).map((t) => t.id),
    ).toEqual(["xp", "season"]);
  });
});

describe("the block", () => {
  it("says the level reached, its coins and what it opened", () => {
    const line = levelUpLine(xpAward(full(), REF)!);
    expect(line).toContain("Level 3");
    expect(line).toContain("+60 coins");
    expect(line).toContain("Unlocked: Boss Raids, Daily Missions");
    expect(
      levelUpLine(xpAward(journey(2625, [row(REF, 25, "match")]), REF)!),
    ).toBe("");
  });
  it("waits for the XP, and says why there is none", () => {
    const base = { won: true, journey: journey(10, []), ref: REF };
    expect(rewardsMarkup({ ...base, eligible: true })).toContain(
      "Updating your XP…",
    );
    expect(
      rewardsMarkup({ ...base, eligible: false, status: "saved" }),
    ).toContain("at least 20 seconds");
    expect(
      rewardsMarkup({ ...base, eligible: true, status: "unavailable" }),
    ).toContain("could not be saved");
    // No account, or no match id yet: nothing at all.
    expect(rewardsMarkup({ ...base, journey: undefined, eligible: true })).toBe(
      "",
    );
    expect(rewardsMarkup({ ...base, ref: undefined, eligible: true })).toBe("");
  });
  it("counts its tiles for the layout, and can stand still", () => {
    const html = rewardsMarkup({
      won: true,
      journey: full(),
      ref: REF,
      eligible: true,
      coins: 95,
      still: true,
    });
    expect(html).toContain('data-count="3"');
    expect(html).toContain('class="rw is-still"');
    expect(html.match(/class="rw-tile[ "]/g)).toHaveLength(3);
  });
  it("the same facts give the same markup (the sheet isn't drawn again)", () => {
    const facts = { won: true, journey: full(), ref: REF, eligible: true };
    expect(rewardsMarkup(facts)).toBe(rewardsMarkup(facts));
    expect(confettiMarkup()).toBe(confettiMarkup());
  });
  it("the fighter hops on a win only, and not when motion is off", () => {
    expect(fighterHop("<img>", true)).toContain("is-hopping");
    expect(fighterHop("<img>", false)).not.toContain("is-hopping");
    expect(fighterHop("<img>", true, true)).not.toContain("is-hopping");
  });
});

describe("drawn again, the celebration carries on", () => {
  const part = (id: string) => {
    const animations = [{ currentTime: 0 }, { currentTime: 0 }];
    return {
      dataset: { rw: id },
      getAnimations: () => animations,
      animations,
    };
  };
  const root = (parts: ReturnType<typeof part>[]) =>
    ({ querySelectorAll: () => parts }) as unknown as ParentNode;
  it("times each part from when it first appeared", () => {
    const xp = part("xp");
    syncRewardMotion(root([xp]), "room:1", 1000);
    // First seen: its animations start by themselves.
    expect(xp.animations.map((a) => a.currentTime)).toEqual([0, 0]);
    // Drawn again 700 ms later, with the rank now there too.
    const again = part("xp"),
      rank = part("rank");
    syncRewardMotion(root([again, rank]), "room:1", 1700);
    expect(again.animations.map((a) => a.currentTime)).toEqual([700, 700]);
    expect(rank.animations.map((a) => a.currentTime)).toEqual([0, 0]);
    const third = part("rank");
    syncRewardMotion(root([third]), "room:1", 2000);
    expect(third.animations[0].currentTime).toBe(300);
  });
  it("a new result starts over", () => {
    const first = part("xp");
    syncRewardMotion(root([first]), "room:5", 100);
    const next = part("xp");
    syncRewardMotion(root([next]), "room:6", 5000);
    expect(next.animations[0].currentTime).toBe(0);
  });
});

describe("the records line under it", () => {
  const record = {
    status: "done" as const,
    reply: {
      confirmed: true,
      records: [{ id: "kai", name: "Kai", wins: 2, losses: 1 }],
      achievements: [],
      rating: { rating: 1020, before: 1012, matches: 9, rank: "Specialist" },
    },
  };
  it("leaves out what the sheet shows elsewhere", () => {
    const all = recordsMarkup(record);
    expect(all).toContain("rating-change");
    expect(all).toContain("data-add-friend");
    const trimmed = recordsMarkup(record, new Set(), {
      rating: false,
      addFriend: false,
    });
    expect(trimmed).not.toContain("rating-change");
    expect(trimmed).not.toContain("data-add-friend");
    expect(trimmed).toContain("You vs Kai");
  });
});
