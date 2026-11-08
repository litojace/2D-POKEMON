import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createArenaServer } from "../../apps/server/src/server";
import { AccountError, rpcError } from "../../apps/server/src/accounts";
import { fakeAccounts } from "../helpers/accounts";

// A failed database call: the rules' refusals stay the player's (400/403, no
// log); a failure of the database itself is a 503 to retry, and goes to the
// log. A bistro once timed out on every load (PostgREST's 500, SQLSTATE 57014)
// and the API answered 400 and logged nothing.
it("tells the database's failures from the rules' refusals", () => {
  const timeout = rpcError(
    "arena_bistro",
    { code: "57014", message: "canceling statement due to statement timeout" },
    500,
  );
  expect(timeout.status).toBe(503);
  expect(timeout.message).toMatch(/try again/);
  expect(timeout.detail).toBe(
    "arena_bistro: 57014 · canceling statement due to statement timeout",
  );
  for (const [code, status] of [
    ["08006", 503],
    ["40P01", 409],
    ["53300", 503],
    ["XX000", 500],
    ["", 502],
  ] as const)
    expect(rpcError("f", { code, message: "x" }, status).status).toBe(503);
  // Supabase unreachable: no code, no status.
  expect(rpcError("f", { message: "TypeError: fetch failed" }).status).toBe(
    503,
  );
  const missing = rpcError(
    "arena_new",
    { code: "PGRST202", message: "not found" },
    404,
  );
  expect(missing.status).toBe(503);
  expect(missing.message).toMatch(/needs an update \(missing arena_new\)/);
  // The rules: a plpgsql raise (P0001) is the player's, with its message.
  const refused = rpcError(
    "arena_bistro_act",
    { code: "P0001", message: "Login required" },
    400,
  );
  expect([refused.status, refused.message, refused.detail]).toEqual([
    400,
    "Login required",
    undefined,
  ]);
  expect(rpcError("f", { code: "42501", message: "no" }, 403).status).toBe(403);
});

let server: ReturnType<typeof createArenaServer>,
  accounts: ReturnType<typeof fakeAccounts>,
  url: string;
beforeEach(async () => {
  accounts = fakeAccounts();
  accounts.provider.rpc = async (_token, name) => {
    if (name === "arena_bistro")
      throw new AccountError(
        503,
        "The server is busy right now. Please try again in a moment.",
        "arena_bistro: 57014 · canceling statement",
      );
    if (name === "arena_bistro_friends")
      throw new AccountError(400, "Not friends");
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
  vi.restoreAllMocks();
  await server.close();
});

it("logs every 5xx with its reason, and no refusal", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const { token } = accounts.add(false);
  const get = (path: string) =>
    fetch(`${url}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const busy = await get("/api/bistro");
  expect(busy.status).toBe(503);
  expect(await busy.json()).toEqual({
    error: "The server is busy right now. Please try again in a moment.",
  });
  expect(log).toHaveBeenCalledWith(
    "[api] GET /api/bistro failed (503):",
    "arena_bistro: 57014 · canceling statement",
  );
  log.mockClear();
  expect((await get("/api/bistro/friends")).status).toBe(400);
  expect(log).not.toHaveBeenCalled();
});
