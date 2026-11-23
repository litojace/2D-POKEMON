import { afterEach, beforeEach, expect, it } from "vitest";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";

// The Admin panel's player tools (migration 20261122100000): admins only,
// and the server checks what is sent before the database sees it.
let server: ReturnType<typeof createArenaServer>,
  accounts: ReturnType<typeof fakeAccounts>,
  url: string,
  calls: [string, Record<string, unknown>][];
const NOVA = "22222222-2222-4222-8222-222222222222";
const REF = "33333333-3333-4333-8333-333333333333";
beforeEach(async () => {
  accounts = fakeAccounts();
  calls = [];
  accounts.provider.rpc = async (_token, name, args) => {
    calls.push([name, args]);
    if (name === "arena_admin_player_status")
      return { balance: 40, chatUntil: null, chatReason: null, coins: [] };
    if (name === "arena_admin_adjust_coins")
      return { applied: args.p_amount, balance: 540 };
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
const status = (token: string, id: string) =>
  fetch(`${url}/api/admin/players/${id}/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
const coins = (token: string, body: unknown) =>
  fetch(`${url}/api/admin/coins`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

it("is for admins only", async () => {
  const { token } = accounts.add(false);
  expect((await status(token, NOVA)).status).toBe(403);
  expect(
    (
      await coins(token, {
        playerId: NOVA,
        amount: 5,
        reason: "gift",
        ref: REF,
      })
    ).status,
  ).toBe(403);
  expect(calls).toEqual([]);
});

it("reads a player's status", async () => {
  const { token } = accounts.add(true);
  const response = await status(token, NOVA);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ balance: 40 });
  expect(calls).toEqual([["arena_admin_player_status", { p_player: NOVA }]]);
  expect((await status(token, "not-an-id")).status).toBe(400);
  expect(calls).toHaveLength(1);
});

it("adds coins and checks the request first", async () => {
  const { token } = accounts.add(true);
  const response = await coins(token, {
    playerId: NOVA,
    amount: 500,
    reason: "  Raid bug refund ",
    ref: REF,
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ applied: 500, balance: 540 });
  expect(calls).toEqual([
    [
      "arena_admin_adjust_coins",
      {
        p_player: NOVA,
        p_amount: 500,
        p_reason: "Raid bug refund",
        p_ref: REF,
      },
    ],
  ]);
  for (const bad of [
    { playerId: NOVA, amount: 0, reason: "zero", ref: REF },
    { playerId: NOVA, amount: 100001, reason: "too much", ref: REF },
    { playerId: NOVA, amount: 1.5, reason: "half", ref: REF },
    { playerId: NOVA, amount: 5, reason: "x", ref: REF },
    { playerId: NOVA, amount: 5, reason: "no ref" },
    { playerId: "nope", amount: 5, reason: "bad id", ref: REF },
    { playerId: NOVA, amount: 5, reason: "extra", ref: REF, admin: true },
  ])
    expect((await coins(token, bad)).status, JSON.stringify(bad)).toBe(400);
  expect(calls).toHaveLength(1);
});
