import { describe, expect, it } from "vitest";
import {
  buildMatchHistory,
  historyEntry,
  type MatchHistoryRow,
} from "../../apps/server/src/match-history";
import { matchHistorySchema } from "../../packages/shared/src/accounts";

// Match history from the side of the player whose history it is
// (docs/match-history.md).
const ana = "00000000-0000-4000-8000-0000000000a1";
const ben = "00000000-0000-4000-8000-0000000000b2";
const gone = "00000000-0000-4000-8000-0000000000c3";
const row = (o: Partial<MatchHistoryRow> = {}): MatchHistoryRow => ({
  id: "match-0001",
  playedAt: "2026-11-20T10:00:00.123456+00:00",
  mode: "duel",
  arena: "classic",
  vsBot: false,
  team: 1,
  won: false,
  character: "tidefin",
  ratingBefore: 1000,
  ratingAfter: 988,
  summary: {
    v: 1,
    mode: "duel",
    arena: "classic",
    bot: null,
    winnerTeam: 0,
    rounds: [0, 1, null, 0],
    players: [
      {
        account: ana,
        name: "Ana",
        character: "voltkit",
        team: 0,
        dealt: 900,
        kos: 3,
        combos: 2,
      },
      {
        account: ben,
        name: "Ben old",
        character: "tidefin",
        team: 1,
        dealt: 500,
        kos: 1,
        combos: 0,
      },
    ],
  },
  ...o,
});
const people = {
  [ana]: { name: "Ana", avatar: "soft-01" },
  [ben]: { name: "Ben", avatar: null },
};

describe("historyEntry", () => {
  it("reads the match from the owner's side", () => {
    const e = historyEntry(row(), ben, people)!;
    expect(e.result).toBe("loss");
    expect(e.rounds).toEqual(["loss", "win", "draw", "loss"]);
    expect([e.dealt, e.kos, e.combos]).toEqual([500, 1, 0]);
    expect(e.rating).toEqual({ before: 1000, after: 988 });
    expect(e.bot).toBeNull();
    // Your side first; current names, not the ones saved in the summary.
    expect(e.players.map((p) => [p.name, p.owner, p.mvp])).toEqual([
      ["Ben", true, false],
      ["Ana", false, true],
    ]);
    expect(e.players[1].avatar).toBe("soft-01");
  });

  it("the same match from the winner's side", () => {
    const e = historyEntry(row({ team: 0, won: true }), ana, people)!;
    expect(e.result).toBe("win");
    expect(e.rounds).toEqual(["win", "loss", "draw", "win"]);
    expect(e.players[0]).toMatchObject({ name: "Ana", owner: true, mvp: true });
  });

  it("a draw, a bot and no rating", () => {
    const base = row();
    const e = historyEntry(
      row({
        vsBot: true,
        team: 0,
        ratingBefore: null,
        ratingAfter: null,
        summary: {
          ...base.summary,
          bot: "hard",
          winnerTeam: null,
          players: [
            base.summary.players[0],
            {
              account: null,
              name: "Hard bot",
              character: "cindrake",
              team: 1,
              dealt: 900,
              kos: 3,
              combos: 0,
            },
          ],
        },
      }),
      ana,
      people,
    )!;
    expect(e.result).toBe("draw");
    expect(e.bot).toBe("hard");
    expect(e.rating).toBeNull();
    expect(e.players[1]).toMatchObject({
      id: null,
      bot: true,
      name: "Hard bot",
    });
    // A tie on damage and knock-outs: the first one keeps MVP.
    expect(e.players.filter((p) => p.mvp)).toHaveLength(1);
  });

  it("a deleted account stays nameless and can't be opened", () => {
    const base = row();
    const e = historyEntry(
      row({
        summary: {
          ...base.summary,
          players: [
            { ...base.summary.players[0], account: gone, name: "" },
            base.summary.players[1],
          ],
        },
      }),
      ben,
      people,
    )!;
    expect(e.players[1]).toMatchObject({
      id: null,
      name: "Deleted player",
      bot: false,
    });
  });

  it("a player who deleted their account (migration 109) is no bot", () => {
    const base = row();
    const e = historyEntry(
      row({
        summary: {
          ...base.summary,
          players: [
            {
              ...base.summary.players[0],
              account: null,
              name: "Deleted player",
            },
            base.summary.players[1],
          ],
        },
      }),
      ben,
      people,
    )!;
    expect(e.players[1]).toMatchObject({
      id: null,
      name: "Deleted player",
      bot: false,
    });
  });

  it("nobody is MVP when no one landed a hit", () => {
    const base = row();
    const e = historyEntry(
      row({
        summary: {
          ...base.summary,
          players: base.summary.players.map((p) => ({
            ...p,
            dealt: 0,
            kos: 0,
          })),
        },
      }),
      ben,
      people,
    )!;
    expect(e.players.some((p) => p.mvp)).toBe(false);
  });

  it("skips a summary it can't read", () => {
    expect(
      historyEntry(row({ summary: null as never }), ben, people),
    ).toBeNull();
    expect(historyEntry(row({ mode: "raid" }), ben, people)).toBeNull();
  });
});

describe("buildMatchHistory", () => {
  it("pages from the last match exactly as the database wrote its time", () => {
    const page = buildMatchHistory(
      {
        matches: [
          row(),
          row({
            id: "match-0002",
            playedAt: "2026-11-20T09:00:00.000001+00:00",
          }),
        ],
        more: true,
        people,
        totals: { matches: 2, wins: 0, fighters: {} },
        rating: { rating: 988, matches: 7, rank: "Pupil" },
      },
      ben,
    );
    expect(page.next).toEqual({
      at: "2026-11-20T09:00:00.000001+00:00",
      id: "match-0002",
    });
    expect(page.rating?.rank).toBe("Pupil");
    expect(matchHistorySchema.parse(page)).toEqual(page);
  });

  it("the last page has no next one, and later pages no totals", () => {
    const page = buildMatchHistory(
      { matches: [row()], more: false, people, totals: null, rating: null },
      ben,
    );
    expect(page.next).toBeNull();
    expect(page.totals).toBeNull();
    expect(page.rating).toBeNull();
  });
});
