import { AuthClient, type SupportedStorage } from "@supabase/supabase-js";

/**
 * Supabase's sign-in client, on its own. The game signs in through Supabase
 * and does everything else through its own server, so the database,
 * storage, functions and realtime clients that createClient also makes were
 * never used: 120 kB of the scripts every start downloads and parses
 * (26 Nov 2026). Set up as createClient sets up its `auth` (supabase-js
 * 2.117, SupabaseClient._initSupabaseAuthClient): the same address, keys and
 * session settings, so a saved sign-in carries on.
 * tests/unit/supabase-auth.test.ts compares the two.
 */
export function supabaseAuth(
  url: string | undefined,
  key: string | undefined,
  storage: SupportedStorage,
  storageKey: string,
) {
  const base = url?.trim();
  if (!base || !key) return null;
  return {
    auth: new AuthClient({
      url: new URL("auth/v1", base.endsWith("/") ? base : `${base}/`).href,
      headers: { Authorization: `Bearer ${key}`, apikey: key },
      storage,
      storageKey,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "implicit",
    }),
  };
}
