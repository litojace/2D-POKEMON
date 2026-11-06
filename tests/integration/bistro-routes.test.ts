import { afterEach, beforeEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";

// The Bistro's routes (migration 067): checked, then passed to the database,
// which owns the rules and the clock.
let server: ReturnType<typeof createArenaServer>,
  accounts: ReturnType<typeof fakeAccounts>,
  url: string,
  calls: [string, Record<string, unknown>][];
beforeEach(async () => {
  accounts = fakeAccounts();
  calls = [];
  accounts.provider.rpc = async (_token, name, args) => {
    calls.push([name, args]);
    return { ok: true, name };
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
const send = (token: string | null, path: string, body?: unknown) =>
  fetch(`${url}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

it("needs a login", async () => {
  expect((await send(null, "/api/bistro")).status).toBe(401);
  expect(
    (
      await send(null, "/api/bistro/act", {
        request: randomUUID(),
        actions: [{ a: "sync" }],
      })
    ).status,
  ).toBe(401);
  expect(calls).toEqual([]);
});

it("passes the bistro, its actions and friends' visits to the database", async () => {
  const { token } = accounts.add(false);
  const friend = randomUUID();
  const request = randomUUID();
  const actions = [
    { a: "cook", stove: 0, dish: "pho" },
    { a: "serve", dish: "pho", vip: true, combo: 3, hearts: 2, quick: true },
    { a: "place", kind: "plant", x: 9, y: 3, rot: 0, id: 11 },
    { a: "hire", role: "cook", char: "pyranda" },
    { a: "chef", id: "voltkit" },
    { a: "trade", lots: 2 },
    { a: "expand" },
  ];
  expect((await send(token, "/api/bistro")).status).toBe(200);
  expect(
    (await send(token, "/api/bistro/act", { request, actions })).status,
  ).toBe(200);
  expect((await send(token, "/api/bistro/friends")).status).toBe(200);
  expect((await send(token, `/api/bistro/visit/${friend}`)).status).toBe(200);
  expect(
    (
      await send(token, "/api/bistro/visit/act", {
        request,
        friend,
        kind: "dine",
      })
    ).status,
  ).toBe(200);
  expect(calls).toEqual([
    ["arena_bistro", {}],
    ["arena_bistro_act", { p_request: request, p_actions: actions }],
    ["arena_bistro_friends", {}],
    ["arena_bistro_friend", { p_friend: friend }],
    [
      "arena_bistro_friend_act",
      { p_request: request, p_friend: friend, p_kind: "dine" },
    ],
  ]);
});

it("refuses malformed requests before the database", async () => {
  const { token } = accounts.add(false);
  const request = randomUUID();
  for (const actions of [
    [],
    [{ a: "steal" }],
    [{ a: "cook", stove: 9, dish: "pho" }],
    [{ a: "serve", dish: "pho", combo: 6 }],
    [{ a: "hire", role: "boss", char: "pyranda" }],
    [{ a: "hire", role: "cook", char: "nobody" }],
    [{ a: "trade", lots: 99 }],
    [{ a: "sync", extra: 1 }],
    Array.from({ length: 41 }, () => ({ a: "sync" })),
  ])
    expect(
      (await send(token, "/api/bistro/act", { request, actions })).status,
    ).toBe(400);
  expect((await send(token, "/api/bistro/visit/not-a-uuid")).status).toBe(400);
  expect(
    (
      await send(token, "/api/bistro/visit/act", {
        request,
        friend: randomUUID(),
        kind: "steal",
      })
    ).status,
  ).toBe(400);
  expect(calls).toEqual([]);
});
