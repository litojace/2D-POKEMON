import { afterEach, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { supabaseAuth } from "../../apps/client/src/supabase-auth";

/**
 * The game makes Supabase's sign-in client on its own (supabase-auth.ts),
 * not through createClient. Every setting must match the `auth` createClient
 * makes, or a saved sign-in stops working (a different storage key) or a
 * request changes (an address or a key header): after a supabase-js upgrade,
 * this says what moved.
 */
const memory = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
};
const made: { stopAutoRefresh(): Promise<void> }[] = [];
afterEach(async () => {
  await Promise.all(made.splice(0).map((auth) => auth.stopAutoRefresh()));
});
function both(url: string, key: string) {
  const storage = memory();
  const full = createClient(url, key, {
    auth: {
      storage,
      storageKey: "parena-auth",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }).auth;
  const own = supabaseAuth(url, key, storage, "parena-auth")!.auth;
  made.push(full, own);
  return { full, own, storage };
}
/**
 * Settings createClient leaves undefined, where auth-js's own default acts
 * the same (auth-js 2.117 GoTrueClient): `throwOnError` is only read as
 * true or false, and `lockAcquireTimeout` only with a custom `lock`, which
 * neither client has.
 */
const SAME_AS_UNSET: Record<string, unknown> = {
  throwOnError: false,
  lockAcquireTimeout: 5000,
};
/** The client's settings: every plain value it keeps, and its headers. */
function settings(auth: object) {
  const out: Record<string, unknown> = {};
  for (const [name, raw] of Object.entries(auth)) {
    // Each client's own id.
    if (name === "instanceID") continue;
    const value =
      raw === undefined && name in SAME_AS_UNSET ? SAME_AS_UNSET[name] : raw;
    if (
      value === null ||
      ["string", "number", "boolean", "undefined"].includes(typeof value)
    )
      out[name] = value;
  }
  const { "X-Client-Info": _info, ...headers } = (
    auth as { headers: Record<string, string> }
  ).headers;
  out.headers = headers;
  return out;
}

describe("Supabase sign-in client", () => {
  for (const url of [
    "https://abcdefghijklmnop.supabase.co",
    "https://abcdefghijklmnop.supabase.co/",
    " https://auth.example.com/base ",
  ])
    it(`is set up as createClient sets up its auth (${url.trim()})`, () => {
      const { full, own, storage } = both(url, "anon-key");
      expect(settings(own)).toEqual(settings(full));
      expect((own as unknown as { storage: unknown }).storage).toBe(storage);
      expect((own as unknown as { url: string }).url).toBe(
        (full as unknown as { url: string }).url,
      );
    });

  it("sends the key as createClient does", () => {
    const { own } = both("https://abcdefghijklmnop.supabase.co", "anon-key");
    expect((own as unknown as { url: string }).url).toBe(
      "https://abcdefghijklmnop.supabase.co/auth/v1",
    );
    expect((own as unknown as { headers: object }).headers).toEqual({
      Authorization: "Bearer anon-key",
      apikey: "anon-key",
    });
  });

  it("is not made without an address and a key", () => {
    expect(supabaseAuth(undefined, "k", memory(), "x")).toBeNull();
    expect(
      supabaseAuth("https://a.supabase.co", undefined, memory(), "x"),
    ).toBeNull();
    expect(supabaseAuth("  ", "k", memory(), "x")).toBeNull();
  });
});
