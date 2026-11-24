import { describe, expect, it } from "vitest";
import {
  buildFriendsBoard,
  buildRecentPlayers,
  rankName,
  RECENT_PLAYERS,
  seasonBounds,
  seasonOf,
} from "../../apps/server/src/social";
import { RANKS } from "../../packages/shared/src/accounts";

const me = { id: "me", name: "Tess" };

describe("rank names (as arena_rank_name in migration 006)", () => {
  it("is Unranked during placement and follows the ladder after", () => {
    expect(rankName(1300, 4, false)).toBe("Unranked");
    expect(rankName(900, 5, false)).toBe("Newbie");
    for (const r of RANKS.slice(0, -1))
      expect(rankName(r.min, 5, false)).toBe(r.name);
  });
  it("needs the #1 spot for Legendary Grandmaster", () => {
    expect(rankName(1600, 9, false)).toBe("International Grandmaster");
    expect(rankName(1600, 9, true)).toBe("Legendary Grandmaster");
    expect(rankName(1400, 9, true)).toBe("Grandmaster");
  });
});

describe("seasons", () => {
  it("names the UTC month and its bounds", () => {
    const at = Date.parse("2026-11-30T23:30:00-08:00"); // Dec 1 in UTC
    expect(seasonOf(at)).toBe("2026-12");
    expect(seasonBounds("2026-12")).toEqual({
      from: "2026-12-01T00:00:00.000Z",
      to: "2027-01-01T00:00:00.000Z",
    });
  });
});

describe("friends' board", () => {
  const board = (over: Partial<Parameters<typeof buildFriendsBoard>[0]> = {}) =>
    buildFriendsBoard({
      me,
      friends: [
        { id: "a", name: "Aria", title: "Flawless", titleColor: "#ffffff" },
        { id: "b", name: "Bram" },
        { id: "c", name: "Cleo" },
        { id: "d", name: "Dax" },
      ],
      ratings: [
        { player_id: "me", rating: 1110, matches: 30 },
        { player_id: "a", rating: 1620, matches: 80 },
        { player_id: "b", rating: 1110, matches: 12 },
        { player_id: "c", rating: 1040, matches: 3 },
      ],
      top: "a",
      month: [
        { player_id: "me", won: true },
        { player_id: "me", won: false },
        { player_id: "me", won: true },
        { player_id: "a", won: true },
      ],
      season: "2026-11",
      ...over,
    });

  it("ranks you and your friends by rating, ties sharing a place", () => {
    const rows = board().rows;
    expect(rows.map((r) => [r.name, r.place])).toEqual([
      ["Aria", 1],
      ["Bram", 2],
      ["Tess", 2],
      ["Cleo", null],
      ["Dax", null],
    ]);
  });
  it("names ranks, placement and this month's record", () => {
    const rows = board().rows;
    const by = (n: string) => rows.find((r) => r.name === n)!;
    expect(by("Aria")).toMatchObject({
      rankName: "Legendary Grandmaster",
      wins: 1,
      matches: 1,
      title: "Flawless",
      me: false,
    });
    expect(by("Tess")).toMatchObject({
      rankName: "Expert",
      wins: 2,
      matches: 3,
      me: true,
      placementLeft: 0,
    });
    // Played 3 of 5 placement matches; never played: 1000 and 5 to go.
    expect(by("Cleo")).toMatchObject({
      rankName: "Unranked",
      placementLeft: 2,
    });
    expect(by("Dax")).toMatchObject({
      rating: 1000,
      rankName: "Unranked",
      placementLeft: 5,
      wins: 0,
      matches: 0,
    });
  });
  it("keeps Legendary for the global #1 only", () => {
    const rows = board({ top: "someone-else" }).rows;
    expect(rows[0].rankName).toBe("International Grandmaster");
  });
  it("always has your row, even with no friends", () => {
    const rows = board({ friends: [], ratings: [] }).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ me: true, place: null, placementLeft: 5 });
  });
});

describe("recent players", () => {
  const mine = [
    { match_id: "m1", team: 0, won: true, played_at: "2026-11-05T10:00:00Z" },
    { match_id: "m2", team: 0, won: false, played_at: "2026-11-05T12:00:00Z" },
    { match_id: "m3", team: 1, won: true, played_at: "2026-11-04T09:00:00Z" },
  ];
  const others = [
    { match_id: "m1", player_id: "kai", team: 1, character: "cindrake" },
    { match_id: "m2", player_id: "kai", team: 1, character: "tidefin" },
    { match_id: "m2", player_id: "rae", team: 0, character: "lumoth" },
    { match_id: "m3", player_id: "oz", team: 0, character: "voltkit" },
    { match_id: "m3", player_id: "bad", team: 0, character: "voltkit" },
    { match_id: "zz", player_id: "lost", team: 0, character: "voltkit" },
  ];
  const profiles = [
    { id: "kai", display_name: "Kai", suspended: false },
    { id: "rae", display_name: "Rae", suspended: false },
    { id: "oz", display_name: "Oz", suspended: false },
    { id: "bad", display_name: "Bad", suspended: true },
    { id: "lost", display_name: "Lost", suspended: false },
  ];
  const list = buildRecentPlayers({
    mine,
    others,
    profiles,
    friends: {
      friends: [{ id: "rae", name: "Rae" }],
      incoming: [{ id: "oz", name: "Oz" }],
      outgoing: [],
    },
    presence: (id) => ({ online: id === "kai" }),
  });

  it("lists who you met, newest first, without suspended or unknown matches", () => {
    expect(list.map((p) => p.name)).toEqual(["Kai", "Rae", "Oz"]);
  });
  it("keeps the latest fighter, the meetings and your record against them", () => {
    expect(list[0]).toMatchObject({
      fighter: "tidefin",
      lastPlayed: "2026-11-05T12:00:00Z",
      matches: 2,
      together: 0,
      wins: 1,
      losses: 1,
      relation: "none",
      online: true,
    });
    expect(list[1]).toMatchObject({
      together: 1,
      wins: 0,
      losses: 0,
      relation: "friend",
    });
    expect(list[2]).toMatchObject({
      relation: "received",
      together: 0,
      wins: 1,
    });
  });
  it("keeps at most twenty players", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      match_id: `m${i}`,
      team: 0,
      won: true,
      played_at: new Date(Date.UTC(2026, 10, 1, i)).toISOString(),
    }));
    const people = buildRecentPlayers({
      mine: many,
      others: many.map((m, i) => ({
        match_id: m.match_id,
        player_id: `p${i}`,
        team: 1,
        character: "voltkit",
      })),
      profiles: many.map((_, i) => ({
        id: `p${i}`,
        display_name: `P${i}`,
        suspended: false,
      })),
      friends: { friends: [], incoming: [], outgoing: [] },
    });
    expect(people).toHaveLength(RECENT_PLAYERS);
    expect(people[0].name).toBe("P29");
  });
});
