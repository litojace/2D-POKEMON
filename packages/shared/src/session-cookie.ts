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
 *   is split into numbered chunks (`<key>.0`, `<key>.1`, ...).
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
/** More chunks than this is not a session: ignore and clear it. */
const MAX_CHUNKS = 12;
const REMEMBER = "ea-remember";
const YEAR_ISH = 400 * 24 * 60 * 60;

export interface CookieJar {
  cookie: string;
}

/** Is this page on a host that shares the session? */
export function sharesSession(hostname: string) {
  const h = hostname.toLowerCase();
  return h === SESSION_DOMAIN || h.endsWith(`.${SESSION_DOMAIN}`);
}

function read(jar: CookieJar) {
  const map = new Map<string, string>();
  for (const part of jar.cookie.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (!map.has(name)) map.set(name, part.slice(eq + 1).trim());
  }
  return map;
}

function write(jar: CookieJar, name: string, value: string, maxAge?: number) {
  jar.cookie =
    `${name}=${value}; Domain=${SESSION_DOMAIN}; Path=/; Secure; SameSite=Lax` +
    (maxAge === undefined ? "" : `; Max-Age=${maxAge}`);
}

/**
 * A synchronous storage (Supabase's `auth.storage`) over the jar's cookies.
 * `remembered()` and `remember()` hold the "Remember me" choice.
 */
export function sessionCookieStorage(jar: CookieJar) {
  const remembered = () => read(jar).get(REMEMBER) === "1";
  const chunkNames = (key: string) => {
    const names: string[] = [];
    const all = read(jar);
    for (let i = 0; i < MAX_CHUNKS + 1 && all.has(`${key}.${i}`); i++)
      names.push(`${key}.${i}`);
    return names;
  };
  const removeItem = (key: string) => {
    for (const name of chunkNames(key)) write(jar, name, "", 0);
  };
  const getItem = (key: string): string | null => {
    const names = chunkNames(key);
    if (!names.length) return null;
    if (names.length > MAX_CHUNKS) {
      removeItem(key);
      return null;
    }
    const all = read(jar);
    try {
      return decodeURIComponent(names.map((n) => all.get(n)).join(""));
    } catch {
      removeItem(key); // torn or foreign: start signed out
      return null;
    }
  };
  const setItem = (key: string, value: string) => {
    const encoded = encodeURIComponent(value);
    const parts: string[] = [];
    // Never cut a %XX escape in two.
    for (let i = 0; i < encoded.length;) {
      let end = Math.min(i + CHUNK, encoded.length);
      const pct = encoded.lastIndexOf("%", end - 1);
      if (pct > end - 3 && pct >= i && end < encoded.length) end = pct;
      parts.push(encoded.slice(i, end));
      i = end;
    }
    if (parts.length > MAX_CHUNKS) return; // never store a broken session
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
