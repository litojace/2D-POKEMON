import { afterEach, beforeEach, expect, it } from "vitest";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";

// Your fighter kept with your account (migration 108): the server checks
// the id against the roster before the database sees it.
let server: ReturnType<typeof createArenaServer>,
  accounts: ReturnType<typeof fakeAccounts>,
  url: string,
  calls: [string, Record<string, unknown>][],
  stored: unknown;
beforeEach(async () => {
  accounts = fakeAccounts();
  calls = [];
  stored = null;
  accounts.provider.rpc = async (_token, name, args) => {
    calls.push([name, args]);
    if (name === "arena_saved_fighter") return stored;
    if (name === "arena_save_fighter") {
      stored = args.p_fighter;
      return null;
    }
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
const get = (token: string | null) =>
  fetch(`${url}/api/account/fighter`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
const post = (token: string | null, body: unknown) =>
  fetch(`${url}/api/account/fighter`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

it("needs a login", async () => {
  expect((await get(null)).status).toBe(401);
  expect((await post(null, { fighter: "voltkit" })).status).toBe(401);
  expect(calls).toEqual([]);
});

it("saves a fighter and gives it back, never cached", async () => {
  const { token } = accounts.add(false);
  const before = await get(token);
  expect(before.headers.get("cache-control")).toBe("no-store");
  expect(await before.json()).toEqual({ fighter: null });
  expect((await post(token, { fighter: "pangrove" })).status).toBe(200);
  expect(calls.at(-1)).toEqual([
    "arena_save_fighter",
    { p_fighter: "pangrove" },
  ]);
  expect(await (await get(token)).json()).toEqual({ fighter: "pangrove" });
});

it("refuses an id that isn't on the roster before the database", async () => {
  const { token } = accounts.add(false);
  for (const body of [
    {},
    { fighter: "pikachu" },
    { fighter: 3 },
    { fighter: "voltkit", extra: 1 },
  ])
    expect((await post(token, body)).status).toBe(400);
  expect(calls).toEqual([]);
});

it("answers null for a saved id the roster no longer has", async () => {
  const { token } = accounts.add(false);
  stored = "retiredmon";
  expect(await (await get(token)).json()).toEqual({ fighter: null });
});
