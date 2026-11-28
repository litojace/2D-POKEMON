import { describe, expect, it } from "vitest";
import {
  RANK_TIERS,
  type FriendsBoard,
  type Leaderboard,
  type Rating,
} from "../../packages/shared/src/accounts";
import {
  boardRow,
  everyoneRows,
  friendRows,
  rankCard,
  rankProgress,
  ranksMarkup,
  ranksView,
  roadMarkup,
  roadTiers,
  ratedSeasonCountdown,
  ratedSeasonEndsAt,
} from "../../apps/client/src/screens/ranks-view";

// Ranks (UI remodel step 6): your rank card, the board with your row pinned
// whatever your position, and the season's end on the server's clock.
const expert: Rating = {
  rating: 1110,
  matches: 62,
  peak: 1140,
  rank: "Flare III",
  placementLeft: 0,
  next: { name: "Flare II", at: 1140 },
};
const board = (extra: Partial<Leaderboard> = {}): Leaderboard => ({
  season: "2026-11",
  rows: ["Aria", "Bram", "Cleo", "Dax"].map((name, i) => ({
    rank: i + 1,
    name,
    title: null,
    titleColor: null,
    rating: 1600 - i * 20,
    rankName: "Legend III",
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
      value: 5,
      max: 35,
      text: "30 more for Flare II",
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
  it("knows the top of the road", () => {
    expect(
      rankProgress({
        rating: 1700,
        matches: 50,
        rank: "Legend II",
        placementLeft: 0,
        next: { name: "Legend I", at: 1750 },
      }),
    ).toEqual({ value: 25, max: 75, text: "50 more for Legend I" });
    expect(
      rankProgress({
        rating: 1800,
        matches: 50,
        rank: "Legend I",
        placementLeft: 0,
        next: null,
      }).text,
    ).toBe("Top of the road");
  });
  it("shows the badge, rating, best, and the shield when you hold one", () => {
    const html = rankCard(expert);
    expect(html).toContain('<b class="rk-rank">Flare III</b>');
    expect(html).toContain("1,110");
    expect(html).toContain("30 more for Flare II · best 1,140");
    expect(html).toContain("How ranks work");
    expect(html).not.toContain('class="rk-shield"');
    expect(rankCard({ ...expert, shield: true })).toContain(
      'class="rk-shield"',
    );
    // Placing: no shield to show, whatever the reply says.
    expect(
      rankCard({
        rating: 1012,
        matches: 2,
        rank: "Unranked",
        placementLeft: 3,
        shield: true,
      }),
    ).not.toContain('class="rk-shield"');
  });
});

describe("the rank road", () => {
  it("marks your tier and step, and every tier under it as earned", () => {
    const tiers = roadTiers(expert);
    expect(tiers.map((t) => t.name)).toEqual(RANK_TIERS.map((t) => t.name));
    expect(tiers.map((t) => t.earned)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(tiers.filter((t) => t.current).map((t) => [t.name, t.step])).toEqual(
      [["Flare", 0]],
    );
    expect(tiers.map((t) => [t.from, t.coins])).toEqual(
      RANK_TIERS.map((t) => [t.floors[0], t.coins]),
    );
  });
  it("keeps a tier reached once ticked: its title is still yours", () => {
    const tiers = roadTiers(expert, ["Tempest", "Pupil"]);
    expect(tiers.filter((t) => t.earned).map((t) => t.name)).toEqual([
      "Sprout",
      "Spark",
      "Flare",
      "Tempest",
    ]);
    // Still standing in Flare.
    expect(tiers.find((t) => t.current)?.name).toBe("Flare");
  });
  it("stands nowhere while placing or unrated", () => {
    for (const r of [
      undefined,
      { rating: 1300, matches: 2, rank: "Unranked", placementLeft: 3 },
    ]) {
      const tiers = roadTiers(r);
      expect(tiers.some((t) => t.current || t.earned)).toBe(false);
      expect(roadMarkup(r)).not.toContain("is-cur");
    }
  });
  it("draws the road highest tier first, yours lit, with each reward", () => {
    const html = roadMarkup({ ...expert, rating: 1150, rank: "Flare II" });
    const names = [...html.matchAll(/class="rk-tier-name"><b>([^<]+)</g)].map(
      (m) => m[1],
    );
    expect(names).toEqual([...RANK_TIERS].reverse().map((t) => t.name));
    expect(html.match(/<li class="rk-tier/g)).toHaveLength(7);
    expect(html).toMatch(
      /<li class="rk-tier is-cur is-earned"[^>]*aria-current="true">.*?<b>Flare<\/b><span class="ui-tag is-mark">You<\/span>/,
    );
    // Flare II: steps III and II lit, II yours; every step under Flare lit.
    const flare = html.slice(html.indexOf("<b>Flare</b>"));
    const marks = [...flare.matchAll(/<i class="([^"]*)"><b>(I+)<\/b>/g)]
      .slice(0, 6)
      .map((m) => [m[2], m[1]]);
    expect(marks).toEqual([
      ["III", "is-on"],
      ["II", "is-on is-you"],
      ["I", ""],
      ["III", "is-on"],
      ["II", "is-on"],
      ["I", "is-on"],
    ]);
    // Every tier's coins, and the first tier's title alone.
    for (const t of RANK_TIERS)
      if (t.coins)
        expect(html).toContain(
          `${t.coins.toLocaleString("en-US")}<span class="sr-only"> coins`,
        );
    expect(html.match(/rk-reward-title/g)).toHaveLength(7);
    expect(html.match(/aria-label="Earned"/g)).toHaveLength(3);
  });
});

describe("the board", () => {
  it("pins your row with your rank when you're outside the top 20", () => {
    const e = everyoneRows(board(), "tester");
    expect(e.rows).toHaveLength(4);
    expect(e.me).toMatchObject({
      place: 23,
      name: "tester",
      rankName: "Flare III",
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
          rankName: "Tempest III",
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
          rankName: "Legend III",
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
          rankName: "Flare III",
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
        rankName: "Tempest III",
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
        rankName: "Tempest III",
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
  it("opens on the road, which needs no board to show", () => {
    expect(ranksView()).toEqual({ scope: "road" });
    const html = ranksMarkup({ scope: "road" }, data);
    expect(html).toContain('aria-pressed="true" data-ui-scope="road"');
    expect(html).toContain("data-ranks-road");
    expect(html).not.toContain("rk-pin");
    expect(html).toContain('<b class="rk-rank">Flare III</b>');
    // Before the board arrives: the road, nobody standing on it yet.
    const early = ranksMarkup(
      { scope: "road" },
      { board: null, friends: null, me: { name: "t" } },
    );
    expect(early).toContain("data-ranks-road");
    expect(early).not.toContain("is-cur");
    expect(early).not.toContain("Loading ranks");
    // A tier reached before stays ticked from your titles.
    expect(
      ranksMarkup(
        { scope: "road" },
        { ...data, me: { name: "tester", titles: ["Nova"] } },
      ).match(/aria-label="Earned"/g),
    ).toHaveLength(4);
  });
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
