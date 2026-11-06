import { afterEach, beforeEach, expect, it } from "vitest";
import { createArenaServer } from "../../apps/server/src/server";
import { AccountError } from "../../apps/server/src/accounts";
import { fakeAccounts } from "../helpers/accounts";

// Changing your name (migration 066): the routes pass the name to the
// database, which owns the 14 days and the checks, and say its answer.
let server: ReturnType<typeof createArenaServer>,
  accounts: ReturnType<typeof fakeAccounts>,
  url: string,
  calls: [string, Record<string, unknown>][];
beforeEach(async () => {
  accounts = fakeAccounts();
  calls = [];
  accounts.provider.rpc = async (_token, name, args) => {
    calls.push([name, args]);
    if (name === "arena_name_status")
      return { changedAt: null, nextAt: null, now: "2026-11-06T00:00:00Z", days: 14 };
    if (name === "arena_change_name") {
      if (args.p_name === "Too Soon")
        throw new AccountError(400, "You can change your name again on November 20, 2026 at 03:00 UTC.");
      return { displayName: args.p_name, changedAt: "2026-11-06T00:00:00Z", nextAt: "2026-11-20T00:00:00Z", now: "2026-11-06T00:00:00Z", days: 14 };
    }
    throw new Error(`unexpected ${name}`);
  };
  server = createArenaServer({ accounts: accounts.provider, autoTick: false });
  await new Promise<void>((resolve) => server.http.listen(0, "127.0.0.1", resolve));
  const address = server.http.address();
  if (!address || typeof address === "string") throw Error("No address");
  url = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  await server.close();
});
const post = (token: string | null, body: unknown) =>
  fetch(`${url}/api/account/name`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

it("needs a login", async () => {
  expect((await fetch(`${url}/api/account/name`)).status).toBe(401);
  expect((await post(null, { name: "Ana" })).status).toBe(401);
  expect(calls).toEqual([]);
});

it("says when you can next change your name", async () => {
  const { token } = accounts.add(false);
  const res = await fetch(`${url}/api/account/name`, { headers: { Authorization: `Bearer ${token}` } });
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(await res.json()).toMatchObject({ nextAt: null, days: 14 });
});

it("passes the name to the database and says its answer", async () => {
  const { token } = accounts.add(false);
  const ok = await post(token, { name: "  Ana the Bold " });
  expect(ok.status).toBe(200);
  expect(await ok.json()).toMatchObject({ displayName: "  Ana the Bold ", nextAt: "2026-11-20T00:00:00Z" });
  expect(calls.at(-1)).toEqual(["arena_change_name", { p_name: "  Ana the Bold " }]);
  const soon = await post(token, { name: "Too Soon" });
  expect(soon.status).toBe(400);
  expect((await soon.json()).error).toMatch(/again on November 20/);
});

it("refuses a malformed request before the database", async () => {
  const { token } = accounts.add(false);
  for (const body of [{}, { name: 5 }, { name: "x".repeat(61) }, { name: "Ana", extra: true }])
    expect((await post(token, body)).status).toBe(400);
  expect(calls).toEqual([]);
});
