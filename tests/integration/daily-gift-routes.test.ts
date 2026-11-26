import { afterEach, beforeEach, expect, it } from "vitest";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";

// The daily gift's routes (migration 20261126150000): the server passes the
// database's answer on once it has the right shape, turns its refusal into
// a 400 with the message, and logs one arena-gift line per claim, with no
// account in it.
let server: ReturnType<typeof createArenaServer>,
  accounts: ReturnType<typeof fakeAccounts>,
  url: string,
  calls: string[],
  logs: [string, Record<string, unknown>][],
  answer: (name: string) => unknown;
const STATE = {
  today: "2026-11-26",
  claimed: false,
  day: 3,
  weeks: 0,
  ownsItem: false,
};
beforeEach(async () => {
  accounts = fakeAccounts();
  calls = [];
  logs = [];
  answer = (name) =>
    name === "arena_daily_gift"
      ? STATE
      : {
          ...STATE,
          claimed: true,
          given: { day: 3, coins: 75, xp: 0, item: null },
        };
  accounts.provider.rpc = async (_token, name) => {
    calls.push(name);
    return answer(name);
  };
  server = createArenaServer({
    accounts: accounts.provider,
    autoTick: false,
    connectionLog: (event, details) => logs.push([event, details]),
  });
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  if (!address || typeof address === "string") throw Error("No address");
  url = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => server.close());
const get = (token?: string) =>
  fetch(`${url}/api/gift`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
const claim = (token?: string) =>
  fetch(`${url}/api/gift/claim`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: "{}",
  });
const giftLogs = () => logs.filter(([event]) => event === "arena-gift");

it("needs a signed-in player", async () => {
  expect((await get()).status).toBe(401);
  expect((await claim()).status).toBe(401);
  expect(calls).toEqual([]);
});

it("reads where you are in the calendar, never cached", async () => {
  const { token } = accounts.add(false);
  const res = await get(token);
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(await res.json()).toEqual(STATE);
  expect(calls).toEqual(["arena_daily_gift"]);
  expect(giftLogs()).toEqual([]);
});

it("takes today's gift and logs it without the account", async () => {
  const { token, account } = accounts.add(false);
  const res = await claim(token);
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    claimed: true,
    given: { day: 3, coins: 75, xp: 0, item: null },
  });
  expect(calls).toEqual(["arena_daily_gift_claim"]);
  expect(giftLogs()).toEqual([
    ["arena-gift", { day: 3, weeks: 0, item: false }],
  ]);
  expect(JSON.stringify(logs)).not.toContain(account.id);
});

it("an answer of the wrong shape never reaches the client", async () => {
  const { token } = accounts.add(false);
  answer = () => ({ ...STATE, day: 9 });
  expect((await get(token)).status).toBeGreaterThanOrEqual(400);
  answer = () => ({ ...STATE, claimed: true });
  expect((await claim(token)).status).toBeGreaterThanOrEqual(400);
  expect(giftLogs()).toEqual([]);
});
