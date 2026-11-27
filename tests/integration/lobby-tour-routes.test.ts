import { afterEach, beforeEach, expect, it } from "vitest";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";

// How your Lobby tour ended (migration 20261121090000): the server checks
// what the client sends before the database sees it, and logs one
// arena-tour line per ending, with no account in it.
let server: ReturnType<typeof createArenaServer>,
  accounts: ReturnType<typeof fakeAccounts>,
  url: string,
  calls: [string, Record<string, unknown>][],
  logs: [string, Record<string, unknown>][],
  stored: unknown;
beforeEach(async () => {
  accounts = fakeAccounts();
  calls = [];
  logs = [];
  stored = null;
  accounts.provider.rpc = async (_token, name, args) => {
    calls.push([name, args]);
    if (name === "arena_my_tour") return stored;
    if (name === "arena_save_tour") {
      stored = args.p_result;
      return null;
    }
    throw new Error(`unexpected ${name}`);
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
afterEach(async () => {
  await server.close();
});
const get = (token: string | null) =>
  fetch(`${url}/api/account/tour`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
const post = (token: string | null, body: unknown) =>
  fetch(`${url}/api/account/tour`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
const tourLogs = () => logs.filter(([event]) => event === "arena-tour");

it("needs a login", async () => {
  expect((await get(null)).status).toBe(401);
  expect(
    (await post(null, { result: "done", reached: 6, steps: 6, replay: false }))
      .status,
  ).toBe(401);
  expect(calls).toEqual([]);
  expect(tourLogs()).toEqual([]);
});

it("saves how the tour ended, gives it back, and logs it without the account", async () => {
  const { token, account } = accounts.add(false);
  const before = await get(token);
  expect(before.headers.get("cache-control")).toBe("no-store");
  expect(await before.json()).toEqual({ tour: null });
  const end = { result: "skipped", reached: 2, steps: 6, replay: false };
  expect((await post(token, end)).status).toBe(200);
  expect(calls.at(-1)).toEqual([
    "arena_save_tour",
    { p_result: "skipped", p_reached: 2 },
  ]);
  expect(await (await get(token)).json()).toEqual({ tour: "skipped" });
  expect(tourLogs()).toEqual([["arena-tour", end]]);
  expect(JSON.stringify(tourLogs())).not.toContain(account.id);
});

it("refuses what isn't a tour ending before the database", async () => {
  const { token } = accounts.add(false);
  for (const body of [
    {},
    { result: "finished", reached: 1, steps: 6, replay: false },
    { result: "done", reached: -1, steps: 6, replay: false },
    { result: "done", reached: 7, steps: 6, replay: false },
    { result: "done", reached: 2.5, steps: 6, replay: false },
    { result: "done", reached: 6, steps: 6, replay: "no" },
    { result: "done", reached: 6, steps: 6, replay: false, account: "x" },
  ])
    expect((await post(token, body)).status).toBe(400);
  expect(calls).toEqual([]);
  expect(tourLogs()).toEqual([]);
});

it("gives back null for anything the database holds that isn't an ending", async () => {
  const { token } = accounts.add(false);
  stored = "something else";
  expect(await (await get(token)).json()).toEqual({ tour: null });
});
