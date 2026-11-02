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
/**
 * The old callback paths. The build copies the game page to each of them so a
 * static host serves it there with no rewrite rule (see vite.config.ts).
 */
export const LEGACY_AUTH_PATHS = Object.keys(PATHS);
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

/**
 * The error Supabase attached to a failed email or OAuth link, if any.
 * Expired or reused email links come back as `#error=access_denied&
 * error_code=otp_expired`; OAuth failures use the query string instead.
 */
export function readAuthError(search: string, hash: string) {
  for (const part of [hash.replace(/^#/, ""), search.replace(/^\?/, "")]) {
    const params = new URLSearchParams(part);
    const code = params.get("error_code") || params.get("error");
    if (code) return code;
  }
  return undefined;
}

/** What to tell the player when a link failed. */
export function authErrorMessage(kind: AuthReturn | undefined, code: string) {
  const expired = code === "otp_expired" || code === "access_denied";
  if (kind === "reset-password")
    return expired
      ? "This password reset link has expired or was already used. Use “Forgot password?” to get a new one."
      : "That password reset link didn't work. Use “Forgot password?” to get a new one.";
  if (kind === "auth-callback")
    return "Google sign-in didn't finish. Please try again.";
  return expired
    ? "This email link has expired or was already used. If you already confirmed your email, just log in."
    : "That email link didn't work. Please try again.";
}

const ERROR_KEYS = ["error", "error_code", "error_description", "sb"];

/** The address with Supabase's error details removed, so a refresh is clean. */
export function withoutAuthError(href: string) {
  const url = new URL(href, "https://x.invalid");
  for (const key of ERROR_KEYS) url.searchParams.delete(key);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  if (ERROR_KEYS.some((key) => hash.has(key))) {
    for (const key of ERROR_KEYS) hash.delete(key);
    url.hash = hash.toString();
  }
  return url.pathname + url.search + url.hash;
}
