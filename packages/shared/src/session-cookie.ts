/**
 * One Supabase session for the website and the game (apps/site/ACCOUNTS.md).
 *
 * On elementarenausa.com the website (the apex) and the game
 * (play.elementarenausa.com) are two origins, so localStorage can't be
 * shared. Both instead keep the session in a cookie scoped to the whole
 * domain: signing in on either signs you in on both, and the website's Play
 * button opens the game already signed in.
 *
 * - Only our own sites live under the domain: never point one of its
 *   subdomains at a third-party host, or that host gets the session.
 * - Secure, SameSite=Lax, Path=/. Supabase's browser client reads the
 *   session itself, so the cookie can't be HttpOnly: the same exposure the
 *   game's localStorage session has.
 * - A session is a few KB; browsers keep about 4 KB per cookie, so the value
 *   is split into at most two numbered chunks (`<key>.0`, `<key>.1`). A
 *   bigger session stays in the origin's own storage (MAX_SHARED).
 * - "Remember me" keeps it 400 days (the browsers' cap); otherwise it is a
 *   browser-session cookie. The choice is itself a shared cookie.
 *
 * Plain and DOM-free (a `{ cookie }` object stands in for `document`), so
 * the game, the website's built copy and the tests use the same code.
 */

/** The domain whose hosts share the session. */
export const SESSION_DOMAIN = "elementarenausa.com";
/** Bytes of value per chunk, under the ~4096-byte cookie limit with its name and attributes. */
export const CHUNK = 3000;
/**
 * The most a shared session may add to every request to our hosts (encoded
 * bytes, two chunks). Past ~16 KB of headers a server answers 431 to every
 * request, the page included, and a player couldn't even load the game; a
 * bigger session (an OAuth user with a lot of metadata) stays in this
 * origin's own storage instead, as on any other host: not shared, never
 * locked out.
 */
// A chunk can end up to 2 bytes short (a %XX escape is never cut), so this
// always fits in two.
export const MAX_SHARED = 2 * (CHUNK - 2);
/** More chunks than this is not ours: ignore and clear it. */
const MAX_CHUNKS = 2;
const REMEMBER = "ea-remember";
const YEAR_ISH = 400 * 24 * 60 * 60;

export interface CookieJar {
  cookie: string;
}
/** This origin's own storage, for a session too big to share. */
export interface LocalStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Is this page on a host that shares the session? */
export function sharesSession(hostname: string) {
  const h = hostname.toLowerCase();
  return h === SESSION_DOMAIN || h.endsWith(`.${SESSION_DOMAIN}`);
}

/** Every value per cookie name, in the order the browser lists them. */
function read(jar: CookieJar) {
  const map = new Map<string, string[]>();
  for (const part of jar.cookie.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    map.set(name, [...(map.get(name) ?? []), part.slice(eq + 1).trim()]);
  }
  return map;
}

function write(jar: CookieJar, name: string, value: string, maxAge?: number) {
  jar.cookie =
    `${name}=${value}; Domain=${SESSION_DOMAIN}; Path=/; Secure; SameSite=Lax` +
    (maxAge === undefined ? "" : `; Max-Age=${maxAge}`);
}
/** Also clears a host-only copy someone else planted under our name. */
function clear(jar: CookieJar, name: string) {
  write(jar, name, "", 0);
  jar.cookie = `${name}=; Path=/; Secure; SameSite=Lax; Max-Age=0`;
}

/** FNV-1a, to notice chunks from two different writes (base 36). */
function check(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++)
    h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36);
}

/**
 * A synchronous storage (Supabase's `auth.storage`) over the jar's cookies,
 * with `local` holding a session over MAX_SHARED. `remembered()` and
 * `remember()` hold the "Remember me" choice.
 */
export function sessionCookieStorage(jar: CookieJar, local?: LocalStore) {
  const remembered = () => read(jar).get(REMEMBER)?.[0] === "1";
  const chunkNames = (key: string) => {
    const names: string[] = [];
    const all = read(jar);
    for (let i = 0; i < MAX_CHUNKS + 1 && all.has(`${key}.${i}`); i++)
      names.push(`${key}.${i}`);
    return names;
  };
  const dropCookies = (key: string) => {
    for (const name of chunkNames(key)) clear(jar, name);
  };
  const removeItem = (key: string) => {
    dropCookies(key);
    local?.removeItem(key);
  };
  const fromCookies = (key: string): string | null => {
    const names = chunkNames(key);
    if (!names.length) return null;
    const all = read(jar);
    // Two cookies under one of our names: one was planted (a host-only or
    // narrower-path copy from another subdomain, to fix a session on us).
    // Trust neither: clear both and start signed out.
    if (
      names.length > MAX_CHUNKS ||
      names.some((n) => all.get(n)!.length > 1)
    ) {
      dropCookies(key);
      return null;
    }
    const joined = names.map((n) => all.get(n)![0]).join("");
    const colon = joined.indexOf(":"); // never inside the encoded value (%3A)
    const body = joined.slice(colon + 1);
    // Chunks from two different writes (read mid-write from the other site):
    // signed out for this read only, without deleting anything.
    if (colon < 0 || joined.slice(0, colon) !== check(body)) return null;
    try {
      return decodeURIComponent(body);
    } catch {
      dropCookies(key); // not ours: start signed out
      return null;
    }
  };
  const getItem = (key: string): string | null =>
    fromCookies(key) ?? local?.getItem(key) ?? null;
  const setItem = (key: string, value: string) => {
    const encoded = encodeURIComponent(value);
    if (encoded.length > MAX_SHARED) {
      // Too big to share safely: this origin keeps it, the cookies go.
      dropCookies(key);
      local?.removeItem(key); // e.g. from localStorage when Remember me went off
      local?.setItem(key, value);
      return;
    }
    local?.removeItem(key);
    const parts: string[] = [];
    // Never cut a %XX escape in two.
    for (let i = 0; i < encoded.length;) {
      let end = Math.min(i + CHUNK, encoded.length);
      const pct = encoded.lastIndexOf("%", end - 1);
      if (pct > end - 3 && pct >= i && end < encoded.length) end = pct;
      parts.push(encoded.slice(i, end));
      i = end;
    }
    parts[0] = `${check(encoded)}:${parts[0]}`;
    const old = chunkNames(key).length;
    const age = remembered() ? YEAR_ISH : undefined;
    parts.forEach((part, i) => write(jar, `${key}.${i}`, part, age));
    for (let i = parts.length; i < old; i++) write(jar, `${key}.${i}`, "", 0);
  };
  /** Change "Remember me", keeping a stored session under `key` with the new lifetime. */
  const remember = (yes: boolean, key: string) => {
    const session = getItem(key);
    if (yes) write(jar, REMEMBER, "1", YEAR_ISH);
    else write(jar, REMEMBER, "", 0);
    if (session !== null) setItem(key, session);
  };
  return { getItem, setItem, removeItem, remembered, remember };
}
