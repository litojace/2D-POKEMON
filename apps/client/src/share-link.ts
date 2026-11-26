/**
 * Where shared pictures send people: the QR code and the "Play free" line on
 * the player card and the match result card (share-card.ts,
 * screens/profile-card.ts).
 *
 * SHARE_SITE is the one place to change it: the game's introduction website
 * (apps/site, docs/website.md), where a newcomer sees the game and taps Play
 * (owner, 25 Nov). VITE_SHARE_SITE can point a test build elsewhere. It
 * never falls back to the page's own origin: inside the iPhone app that is
 * capacitor://localhost, which no camera can open.
 */
export const SHARE_SITE = (
  import.meta.env.VITE_SHARE_SITE || "https://elementarenausa.com"
).replace(/\/+$/, "");

/** Which picture a visit came from, as `?ref=` (the website ignores it;
 * the host's request log can count it). It leaves invites (`?room=`,
 * invite.ts) and sign-in links alone. */
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
