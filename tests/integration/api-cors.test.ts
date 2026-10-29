import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";

const origin = "https://twod-pokemon.onrender.com";
let server: ReturnType<typeof createArenaServer>;
let accounts: ReturnType<typeof fakeAccounts>;
let url: string;

beforeEach(async () => {
  vi.stubEnv("CLIENT_ORIGIN", origin);
  accounts = fakeAccounts();
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
  vi.unstubAllEnvs();
});

it("lets the static site probe readiness and preflight authenticated JSON requests", async () => {
  const health = await fetch(`${url}/api/health`, {
    headers: { Origin: origin },
  });
  expect((await health.json()).ok).toBe(true);
  expect(health.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  const preflight = await fetch(`${url}/api/account/title`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,content-type",
    },
  });
  expect(preflight.status).toBe(204);
  expect(preflight.headers.get("Access-Control-Allow-Headers")).toMatch(
    /Authorization, Content-Type/,
  );
  expect(preflight.headers.get("Access-Control-Allow-Methods")).toContain(
    "POST",
  );
  expect(preflight.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  expect(preflight.headers.get("Vary")).toContain("Origin");
});

it("returns CORS headers on successful and failed API responses without bypassing auth", async () => {
  const user = accounts.add(false);
  const profile = await fetch(`${url}/api/account`, {
    headers: { Origin: origin, Authorization: `Bearer ${user.token}` },
  });
  expect(profile.status).toBe(200);
  expect((await profile.json()).id).toBe(user.account.id);
  expect(profile.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  const unauthorized = await fetch(`${url}/api/account`, {
    headers: { Origin: origin },
  });
  expect(unauthorized.status).toBe(401);
  expect(unauthorized.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  const malformed = await fetch(`${url}/api/account/title`, {
    method: "POST",
    headers: {
      Origin: origin,
      Authorization: `Bearer ${user.token}`,
      "Content-Type": "application/json",
    },
    body: "{",
  });
  expect(malformed.status).toBeGreaterThanOrEqual(400);
  expect(malformed.headers.get("Access-Control-Allow-Origin")).toBe(origin);
});

it("rejects other origins and continues to accept same-origin and CLI requests", async () => {
  const denied = await fetch(`${url}/api/account`, {
    method: "OPTIONS",
    headers: { Origin: "https://untrusted.example" },
  });
  expect(denied.status).toBe(403);
  expect(denied.headers.get("Access-Control-Allow-Origin")).toBeNull();
  const user = accounts.add(false);
  const crossSite = await fetch(`${url}/api/account`, {
    headers: {
      Origin: "https://untrusted.example",
      Authorization: `Bearer ${user.token}`,
    },
  });
  expect(crossSite.status).toBe(403);
  for (const headers of [
    { Authorization: `Bearer ${user.token}` },
    { Authorization: `Bearer ${user.token}`, Origin: url },
  ]) {
    expect((await fetch(`${url}/api/account`, { headers })).status).toBe(200);
  }
});
