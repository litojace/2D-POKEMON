import { afterEach, beforeEach, expect, it } from "vitest";
import { createArenaServer } from "../../apps/server/src/server";
import type { SocialStore } from "../../apps/server/src/social";
import { fakeAccounts } from "../helpers/accounts";
import {
  friendsBoardSchema,
  recentPlayersSchema,
} from "../../packages/shared/src/accounts";

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
    rankName: "Candidate Master",
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
