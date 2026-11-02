/**
 * Where Supabase sends people back after an email or OAuth step.
 *
 * Links point at the site root with `?auth=<kind>` instead of a path such as
 * `/email-confirmed`. The root is always served by both the Express server and
 * the Render Static Site, so an email link can never land on a host's "Not
 * Found" page when a rewrite rule is missing. Supabase allows any redirect on
 * the same host as its Site URL. The old paths are still recognised so links
 * already sitting in inboxes keep working wherever those paths are served.
 */
export type AuthReturn = "email-confirmed" | "reset-password" | "auth-callback";

const PATHS: Record<string, AuthReturn> = {
  "/email-confirmed": "email-confirmed",
  "/reset-password": "reset-password",
  "/auth/callback": "auth-callback",
};
const KINDS = new Set<string>(Object.values(PATHS));

/** The URL to hand Supabase as `emailRedirectTo` / `redirectTo`. */
export function authRedirectUrl(site: string, kind: AuthReturn) {
  const url = new URL("/", site);
  url.searchParams.set("auth", kind);
  return url.toString();
}

/** Which auth return this address is, if any (new query form or old path). */
export function readAuthReturn(pathname: string, search: string) {
  const kind = new URLSearchParams(search).get("auth");
  if (kind && KINDS.has(kind)) return kind as AuthReturn;
  return PATHS[pathname.replace(/\/+$/, "") || "/"];
}

/**
 * The same address without the `auth` marker, keeping everything Supabase
 * still needs (`?code=` for PKCE, `#access_token=…` for implicit links).
 */
export function withoutAuthMarker(href: string) {
  const url = new URL(href);
  url.searchParams.delete("auth");
  return url.pathname + url.search + url.hash;
}
