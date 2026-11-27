import { afterEach, beforeEach, expect, it } from "vitest";
import { createArenaServer } from "../../apps/server/src/server";
import type { SocialStore } from "../../apps/server/src/social";
import { fakeAccounts } from "../helpers/accounts";
import {
  friendsBoardSchema,
  matchHistorySchema,
  recentPlayersSchema,
} from "../../packages/shared/src/accounts";
import { AccountError } from "../../apps/server/src/accounts";

/**
 * The two read-only social endpoints (UI remodel step 6): they need a login,
 * read through the store and never call anything that writes.
 */
let server: ReturnType<typeof createArenaServer>,
  accounts: ReturnType<typeof fakeAccounts>,
  url: string,
  calls: string[];
const friend = "00000000-0000-4000-8000-0000000000aa";
const stranger = "00000000-0000-4000-8000-0000000000bb";
const store = (): SocialStore => ({
  async ratings(ids) {
    calls.push(`ratings:${ids.length}`);
    return [{ player_id: friend, rating: 1200, matches: 9 }];
  },
  async topRated() {
    return friend;
  },
  async monthResults() {
    return [{ player_id: friend, won: true }];
  },
  async myMatches(_me, since) {
    calls.push(`since:${since.slice(0, 4)}`);
    return [
      {
        match_id: "match-0001",
        team: 0,
        won: true,
        played_at: new Date().toISOString(),
      },
    ];
  },
  async matchPlayers(ids) {
    calls.push(`players:${ids.join(",")}`);
    return [
      {
        match_id: "match-0001",
        player_id: stranger,
        team: 1,
        character: "cindrake",
      },
    ];
  },
  async profiles(ids) {
    return ids.map((id) => ({ id, display_name: "Kai", suspended: false }));
  },
});
beforeEach(async () => {
  accounts = fakeAccounts();
  calls = [];
  accounts.provider.social = store();
  accounts.provider.rpc = async (_token, name) => {
    calls.push(`rpc:${name}`);
    if (name === "arena_friends")
      return {
        code: "AABBCCDD",
        friends: [{ id: friend, name: "Aria", title: null, titleColor: null }],
        incoming: [],
        outgoing: [],
      };
    if (name === "arena_my_rating")
      return {
        rating: 1000,
        matches: 0,
        rank: "Unranked",
        placementLeft: 5,
        next: null,
      };
    throw new Error(`unexpected ${name}`);
  };
  server = createArenaServer({ accounts: accounts.provider, autoTick: false });
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  if (!address || typeof address === "string") throw Error("No address");
  url = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  await server.close();
});

it("needs a login", async () => {
  expect((await fetch(`${url}/api/leaderboard/friends`)).status).toBe(401);
  expect((await fetch(`${url}/api/friends/recent`)).status).toBe(401);
});

it("ranks you with your friends", async () => {
  const { token } = accounts.add(false);
  const res = await fetch(`${url}/api/leaderboard/friends`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  const board = friendsBoardSchema.parse(await res.json());
  expect(board.rows.map((r) => [r.name, r.place, r.me])).toEqual([
    ["Aria", 1, false],
    ["Player 1", null, true],
  ]);
  expect(board.rows[0]).toMatchObject({
    rankName: "Flare I",
    wins: 1,
    matches: 1,
  });
  expect(board.rating?.rank).toBe("Unranked");
  expect(calls).toEqual([
    "rpc:arena_friends",
    "rpc:arena_my_rating",
    "ratings:2",
  ]);
});

it("lists recent players with whether they are friends", async () => {
  const { token } = accounts.add(false);
  const res = await fetch(`${url}/api/friends/recent`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status).toBe(200);
  const { players } = recentPlayersSchema.parse(await res.json());
  expect(players).toHaveLength(1);
  expect(players[0]).toMatchObject({
    id: stranger,
    name: "Kai",
    fighter: "cindrake",
    relation: "none",
    wins: 1,
    online: false,
  });
  expect(calls).toContain("players:match-0001");
});

it("says plainly when the server has no storage for them", async () => {
  const { token } = accounts.add(false);
  accounts.provider.social = undefined;
  const res = await fetch(`${url}/api/friends/recent`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status).toBe(503);
  expect((await res.json()).error).toMatch(/server storage/);
});

it("match history: yours by default, a friend's by id, a page at a time", async () => {
  const { token } = accounts.add(false);
  const args: Record<string, unknown>[] = [];
  accounts.provider.rpc = async (_token, name, body) => {
    calls.push(`rpc:${name}`);
    if (name !== "arena_match_history") throw new Error(`unexpected ${name}`);
    args.push(body as Record<string, unknown>);
    return { matches: [], more: false, people: {}, totals: null, rating: null };
  };
  const get = (q = "") =>
    fetch(`${url}/api/matches/history${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  expect((await fetch(`${url}/api/matches/history`)).status).toBe(401);
  const mine = await get();
  expect(mine.status).toBe(200);
  expect(mine.headers.get("cache-control")).toBe("no-store");
  expect(matchHistorySchema.parse(await mine.json())).toEqual({
    matches: [],
    next: null,
    totals: null,
    rating: null,
  });
  expect(args[0]).toMatchObject({
    p_before_at: null,
    p_before_id: null,
    p_limit: 10,
    p_kind: "all",
  });
  expect(typeof args[0].p_player).toBe("string");
  const at = "2026-11-20T09:00:00.000001+00:00";
  expect(
    (
      await get(
        `?player=${friend}&at=${encodeURIComponent(at)}&id=match-0002&kind=pvp`,
      )
    ).status,
  ).toBe(200);
  expect(args[1]).toEqual({
    p_player: friend,
    p_before_at: at,
    p_before_id: "match-0002",
    p_limit: 10,
    p_kind: "pvp",
  });
  // Nonsense is refused before the database is asked.
  for (const q of ["?player=nope", "?kind=raid", "?at=yesterday", "?limit=500"])
    expect((await get(q)).status, q).toBe(400);
  expect(args).toHaveLength(2);
});

it("match history: the database's refusal reaches the player", async () => {
  const { token } = accounts.add(false);
  accounts.provider.rpc = async () => {
    throw new AccountError(403, "Only friends can see each other's matches.");
  };
  const res = await fetch(`${url}/api/matches/history?player=${stranger}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status).toBe(403);
  expect((await res.json()).error).toMatch(/Only friends/);
});
