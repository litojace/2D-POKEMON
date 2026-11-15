import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createArenaServer } from "../../apps/server/src/server";
import { setAppleFetch } from "../../apps/server/src/apple";
import type { AppleToken } from "../../apps/server/src/accounts";
import { fakeAccounts } from "../helpers/accounts";

// The iPhone app's Sign in with Apple on the server (migration 111): the
// one-time code becomes a kept refresh token, revoked when the account is
// deleted.
let server: ReturnType<typeof createArenaServer>;
let accounts: ReturnType<typeof fakeAccounts>;
let url: string;
let kept: Map<string, AppleToken>;
let subjects: Map<string, string>;
let apple: { url: string; form: Record<string, string> }[];
let appleAnswers: { token: () => Response; revoke: () => Response };
const idToken = (sub: string) =>
  `x.${Buffer.from(JSON.stringify({ sub })).toString("base64url")}.y`;

beforeEach(async () => {
  const { privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  vi.stubEnv("APPLE_TEAM_ID", "TEAM123456");
  vi.stubEnv("APPLE_KEY_ID", "KEY1234567");
  vi.stubEnv(
    "APPLE_PRIVATE_KEY",
    privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  );
  vi.stubEnv("APPLE_APP_BUNDLE_ID", "com.example.arena");
  accounts = fakeAccounts();
  kept = new Map();
  subjects = new Map();
  accounts.provider.apple = {
    subjectOf: async (token) => subjects.get(token) ?? null,
    save: async (id, t) => void kept.set(id, t),
    tokenOf: async (id) => kept.get(id) ?? null,
  };
  accounts.provider.rpc = async (token, name) => {
    if (name === "arena_delete_my_account") accounts.users.delete(token);
    return null;
  };
  apple = [];
  appleAnswers = {
    token: () =>
      Response.json({
        refresh_token: "refresh-1",
        id_token: idToken("sub-ana"),
      }),
    revoke: () => new Response(null, { status: 200 }),
  };
  setAppleFetch((async (input: unknown, init?: RequestInit) => {
    const u = String(input);
    apple.push({
      url: u,
      form: Object.fromEntries(new URLSearchParams(String(init?.body))),
    });
    return u.endsWith("/auth/token")
      ? appleAnswers.token()
      : appleAnswers.revoke();
  }) as typeof fetch);
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
  setAppleFetch((...a) => fetch(...a));
});
const post = (path: string, token: string, body: unknown) =>
  fetch(`${url}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

it("keeps Apple's refresh token for the player signed in with that Apple account", async () => {
  const ana = accounts.add(false);
  subjects.set(ana.token, "sub-ana");
  expect((await post("/api/account/apple", ana.token, {})).status).toBe(400);
  const reply = await post("/api/account/apple", ana.token, { code: "c-1" });
  expect(reply.status).toBe(200);
  expect(kept.get(ana.account.id)).toEqual({
    sub: "sub-ana",
    clientId: "com.example.arena",
    refreshToken: "refresh-1",
  });
  expect(apple[0].form).toMatchObject({
    code: "c-1",
    client_id: "com.example.arena",
  });
});

it("refuses a code for another Apple account, or for a player not signed in with Apple", async () => {
  const ben = accounts.add(false);
  subjects.set(ben.token, "sub-ben");
  expect(
    (await post("/api/account/apple", ben.token, { code: "c" })).status,
  ).toBe(403);
  const cy = accounts.add(false);
  expect(
    (await post("/api/account/apple", cy.token, { code: "c" })).status,
  ).toBe(400);
  appleAnswers.token = () =>
    Response.json({ error: "invalid_grant" }, { status: 400 });
  subjects.set(ben.token, "sub-ana");
  const refused = await post("/api/account/apple", ben.token, { code: "old" });
  expect(refused.status).toBe(400);
  expect((await refused.json()).error).toContain("Try signing in again");
  expect(kept.size).toBe(0);
});

it("revokes the kept token when the account is deleted, then deletes it", async () => {
  const ana = accounts.add(false);
  kept.set(ana.account.id, {
    sub: "sub-ana",
    clientId: "com.example.arena",
    refreshToken: "refresh-1",
  });
  const reply = await post("/api/account/delete", ana.token, { confirm: true });
  expect(reply.status).toBe(200);
  expect(await reply.json()).toEqual({ ok: true, appleRevoked: true });
  expect(apple.at(-1)).toMatchObject({
    url: "https://appleid.apple.com/auth/revoke",
    form: { token: "refresh-1", token_type_hint: "refresh_token" },
  });
  expect(accounts.users.has(ana.token)).toBe(false);
});

it("still deletes the account when Apple refuses, or with nothing to revoke", async () => {
  appleAnswers.revoke = () => new Response(null, { status: 500 });
  const ana = accounts.add(false);
  kept.set(ana.account.id, { sub: "s", clientId: "c", refreshToken: "r" });
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const refused = await post("/api/account/delete", ana.token, {
    confirm: true,
  });
  expect(await refused.json()).toEqual({ ok: true, appleRevoked: false });
  expect(accounts.users.has(ana.token)).toBe(false);
  warn.mockRestore();
  const ben = accounts.add(false);
  const plain = await post("/api/account/delete", ben.token, { confirm: true });
  expect(await plain.json()).toEqual({ ok: true, appleRevoked: false });
  expect(apple.filter((a) => a.url.endsWith("/revoke"))).toHaveLength(1);
});

it("says Sign in with Apple isn't set up when the server has no Apple key", async () => {
  vi.stubEnv("APPLE_PRIVATE_KEY", "");
  const ana = accounts.add(false);
  subjects.set(ana.token, "sub-ana");
  const reply = await post("/api/account/apple", ana.token, { code: "c" });
  expect(reply.status).toBe(503);
  // Deleting still works, without revoking.
  const deleted = await post("/api/account/delete", ana.token, {
    confirm: true,
  });
  expect(await deleted.json()).toEqual({ ok: true, appleRevoked: false });
});
