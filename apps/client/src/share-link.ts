/**
 * Where shared pictures send people: the QR code and the "Play free" line on
 * the player card and the match result card (share-card.ts,
 * screens/profile-card.ts).
 *
 * SHARE_SITE is the one place to change it. For now it is the game itself
 * (VITE_SITE_URL); when the game's own introduction website is ready, put
 * its address here. It never falls back to the page's own origin: inside
 * the iPhone app that is capacitor://localhost, which no camera can open.
 */
export const SHARE_SITE = (
  import.meta.env.VITE_SITE_URL || "https://play.elementarenausa.com"
).replace(/\/+$/, "");

/** Which picture a visit came from, as `?ref=` (nothing reads it in the
 * game; the server's request log can count it). It leaves invites
 * (`?room=`, invite.ts) and sign-in links alone. */
export type ShareSource = "card" | "result";

/** The address the QR code holds. */
export function shareLink(source: ShareSource, site = SHARE_SITE) {
  const url = new URL(site);
  url.searchParams.set("ref", source);
  return url.href;
}

/** The address as printed under the code: no scheme, no slash, no ref. */
export const shownSite = (site = SHARE_SITE) =>
  site.replace(/^https?:\/\//, "").replace(/\/+$/, "");
