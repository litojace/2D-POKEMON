import { describe, expect, it } from "vitest";
import type {
  FriendsBoard,
  Leaderboard,
  Rating,
} from "../../packages/shared/src/accounts";
import {
  boardRow,
  everyoneRows,
  friendRows,
  rankCard,
  rankProgress,
  ranksMarkup,
  ratedSeasonCountdown,
  ratedSeasonEndsAt,
} from "../../apps/client/src/screens/ranks-view";

// Ranks (UI remodel step 6): your rank card, the board with your row pinned
// whatever your position, and the season's end on the server's clock.
const expert: Rating = {
  rating: 1110,
  matches: 62,
  peak: 1140,
  rank: "Expert",
  placementLeft: 0,
  next: { name: "Candidate Master", at: 1150 },
};
const board = (extra: Partial<Leaderboard> = {}): Leaderboard => ({
  season: "2026-11",
  rows: ["Aria", "Bram", "Cleo", "Dax"].map((name, i) => ({
    rank: i + 1,
    name,
    title: null,
    titleColor: null,
    rating: 1600 - i * 20,
    rankName: "Grandmaster",
    wins: 10,
    matches: 15,
    me: false,
  })),
  unranked: [{ name: "Mae", left: 2 }],
  me: { rank: 23, wins: 36, matches: 62 },
  rating: expert,
  ...extra,
});

describe("your rank", () => {
  it("measures progress from your rank's floor to the next rank", () => {
    expect(rankProgress(expert)).toEqual({
      value: 35,
      max: 75,
      text: "40 more for Candidate Master",
    });
  });
  it("counts placement matches while you place", () => {
    expect(
      rankProgress({
        rating: 1012,
        matches: 2,
        rank: "Unranked",
        placementLeft: 3,
      }),
    ).toEqual({ value: 2, max: 5, text: "3 placement matches to go" });
    expect(
      rankProgress({
        rating: 1012,
        matches: 4,
        rank: "Unranked",
        placementLeft: 1,
      }).text,
    ).toBe("1 placement match to go");
  });
  it("asks for #1 past the Legendary rating, and knows the top", () => {
    expect(
      rankProgress({
        rating: 1600,
        matches: 50,
        rank: "International Grandmaster",
        placementLeft: 0,
        next: { name: "Legendary Grandmaster", at: 1550 },
      }).text,
    ).toBe("Reach #1 to become Legendary Grandmaster");
    expect(
      rankProgress({
        rating: 1700,
        matches: 50,
        rank: "Legendary Grandmaster",
        placementLeft: 0,
        next: null,
      }).text,
    ).toBe("Top of the ladder");
  });
  it("shows the badge, rating, best and the ladder with yours lit", () => {
    const html = rankCard(expert);
    expect(html).toContain('<b class="rk-rank">Expert</b>');
    expect(html).toContain("1,110");
    expect(html).toContain("40 more for Candidate Master · best 1,140");
    expect(html.match(/<li /g)?.length ?? 0).toBeGreaterThanOrEqual(10);
    expect(html).toMatch(
      /class="is-cur"[^>]*aria-current="true"><i aria-hidden="true"><\/i><span>Expert</,
    );
    expect(html).toContain("How ranks work");
    // Placing: no rank lit yet.
    expect(
      rankCard({
        rating: 1012,
        matches: 2,
        rank: "Unranked",
        placementLeft: 3,
      }),
    ).not.toContain("is-cur");
  });
});

describe("the board", () => {
  it("pins your row with your rank when you're outside the top 20", () => {
    const e = everyoneRows(board(), "tester");
    expect(e.rows).toHaveLength(4);
    expect(e.me).toMatchObject({
      place: 23,
      name: "tester",
      rankName: "Expert",
      rating: 1110,
      wins: 36,
      matches: 62,
      me: true,
    });
    expect(e.placing).toBe("Placing: Mae (2 to go)");
  });
  it("pins your row when you're in it too", () => {
    const b = board({
      rows: [
        {
          rank: 1,
          name: "tester",
          title: null,
          titleColor: null,
          rating: 1300,
          rankName: "Master",
          wins: 5,
          matches: 6,
          me: true,
        },
      ],
      me: { rank: 1, wins: 5, matches: 6 },
    });
    expect(everyoneRows(b, "tester").me).toMatchObject({
      place: 1,
      name: "tester",
    });
  });
  it("says you're placing, or how to join, without a place", () => {
    const placing = everyoneRows(
      board({
        rows: [],
        me: null,
        rating: {
          rating: 1012,
          matches: 2,
          rank: "Unranked",
          placementLeft: 3,
        },
      }),
      "tester",
    );
    expect(placing.me).toMatchObject({ place: null, sub: "Placing · 3 to go" });
    // Before ratings (migration 006) the board ranks by wins.
    const old = everyoneRows(board({ rating: undefined, me: null }), "tester");
    expect(old.me.sub).toBe("Win a match against a player to join");
    expect(old.rows[0].rating).toBe(10);
  });
  it("ranks you among your friends", () => {
    const fb: FriendsBoard = {
      season: "2026-11",
      rows: [
        {
          id: "k",
          place: 1,
          name: "Kai",
          rating: 1388,
          rankName: "Grandmaster",
          placementLeft: 0,
          wins: 14,
          matches: 22,
          me: false,
        },
        {
          id: "me",
          place: 2,
          name: "tester",
          rating: 1110,
          rankName: "Expert",
          placementLeft: 0,
          wins: 36,
          matches: 62,
          me: true,
        },
        {
          id: "r",
          place: null,
          name: "Rae",
          rating: 1020,
          rankName: "Unranked",
          placementLeft: 3,
          wins: 2,
          matches: 2,
          me: false,
        },
      ],
    };
    const f = friendRows(fb);
    expect(f.me).toMatchObject({ place: 2, name: "tester" });
    expect(f.rows[2]).toMatchObject({ place: null, sub: "Placing · 3 to go" });
  });
  it("draws medals for the top three, a dash while placing, and shrinks long numbers", () => {
    const row = (place: number | null, wins = 1, matches = 2) =>
      boardRow({
        place,
        name: "N",
        rankName: "Master",
        rating: 1,
        wins,
        matches,
        me: false,
      });
    expect(row(1)).toContain('<i class="rk-medal is-1" aria-label="#1">1</i>');
    expect(row(3)).toContain("rk-medal is-3");
    expect(row(4)).not.toContain("rk-medal");
    expect(row(null)).toContain('<span class="rk-place ui-num">—</span>');
    expect(row(12345)).toContain(
      '<span class="rk-place ui-num is-long">12,345</span>',
    );
    expect(row(5, 9999, 19999)).toContain(
      '<span class="rk-wl ui-num is-long">9999–10000</span>',
    );
    expect(row(5, 9, 20)).toContain('<span class="rk-wl ui-num">9–11</span>');
  });
  it("escapes names", () => {
    expect(
      boardRow({
        place: 1,
        name: "<b>x</b>",
        rankName: "Master",
        rating: 1,
        wins: 0,
        matches: 0,
        me: false,
      }),
    ).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});

describe("the panel", () => {
  const data = { board: board(), friends: null, me: { name: "tester" } };
  it("switches Everyone / Friends and loads Friends when picked", () => {
    const html = ranksMarkup({ scope: "everyone" }, data);
    expect(html).toContain('aria-pressed="true" data-ui-scope="everyone"');
    expect(html.match(/rk-medal/g)).toHaveLength(3);
    expect(html).toContain('class="rk-pin"');
    expect(ranksMarkup({ scope: "friends" }, data)).toContain(
      "Loading your friends&#39; ranks",
    );
    expect(
      ranksMarkup({ scope: "friends" }, { ...data, friendsProblem: "No." }),
    ).toContain("data-ranks-retry");
  });
  it("offers Friends when you have nobody to compare with", () => {
    const friends: FriendsBoard = {
      season: "2026-11",
      rows: [
        {
          id: "me",
          place: null,
          name: "tester",
          rating: 1000,
          rankName: "Unranked",
          placementLeft: 5,
          wins: 0,
          matches: 0,
          me: true,
        },
      ],
    };
    const html = ranksMarkup({ scope: "friends" }, { ...data, friends });
    expect(html).toContain("No friends to compare yet");
    expect(html).toContain("data-ranks-friends");
    expect(html).toContain('class="rk-pin"');
  });
  it("shows loading and a retry before the board arrives", () => {
    expect(
      ranksMarkup(
        { scope: "everyone" },
        { board: null, friends: null, me: { name: "t" } },
      ),
    ).toContain("Loading ranks");
    expect(
      ranksMarkup(
        { scope: "everyone" },
        { board: null, friends: null, problem: "Down.", me: { name: "t" } },
      ),
    ).toContain("data-ranks-retry");
  });
});

describe("the season's end, on the server's clock", () => {
  it("ends at midnight UTC on the first of next month", () => {
    const now = Date.parse("2026-11-06T18:00:00Z");
    expect(new Date(ratedSeasonEndsAt("2026-11", now)).toISOString()).toBe(
      "2026-12-01T00:00:00.000Z",
    );
    expect(new Date(ratedSeasonEndsAt("2026-12", now)).toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
    expect(ratedSeasonCountdown("2026-11", now)).toBe("24 d 6 h");
    // An ended season or a bad id never counts backwards.
    expect(ratedSeasonEndsAt("2026-10", now)).toBe(now);
    expect(ratedSeasonEndsAt("junk", now)).toBe(now);
  });
});
