/**
 * Farm invite links (migration 057): `/?farm=AB12CD34` carries the inviter's
 * friend code. It is kept in localStorage (a sign-up can finish in another
 * tab) until the new player is signed in, then claimed once.
 */
const KEY = "arena-farm-invite";
const CODE = /^[0-9A-F]{8}$/;

export function farmInviteUrl(origin: string, code: string) {
  return `${origin.replace(/\/$/, "")}/?farm=${encodeURIComponent(code)}`;
}
/** The invite code in a query string, normalised, or undefined. */
export function readFarmInvite(search: string) {
  const code = new URLSearchParams(search).get("farm")?.trim().toUpperCase();
  return code && CODE.test(code) ? code : undefined;
}
/** Call once at startup: remember an invite from the URL and tidy the URL. */
export function captureFarmInvite() {
  try {
    const code = readFarmInvite(location.search);
    if (!code) return pendingFarmInvite();
    localStorage.setItem(KEY, code);
    const url = new URL(location.href);
    url.searchParams.delete("farm");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
    return code;
  } catch {
    return undefined;
  }
}
export function pendingFarmInvite() {
  try {
    const code = localStorage.getItem(KEY) ?? undefined;
    return code && CODE.test(code) ? code : undefined;
  } catch {
    return undefined;
  }
}
export function clearFarmInvite() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* optional */
  }
}
