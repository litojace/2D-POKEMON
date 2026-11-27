/**
 * The game moved to play.elementarenausa.com (docs/domain-move.md). The old
 * address keeps serving the same game while players move over, so installs
 * on it keep their sign-in. There a light banner (announcements.ts) offers
 * the new address: once every few days, never in a battle, never blocking.
 */
import type { Announcement } from "../../../packages/shared/src/accounts";

/** Addresses the game used to live at. */
export const OLD_HOSTS: readonly string[] = ["parena.litojace.com"];
/** The banner comes back after this long, until they move. */
const REMIND_MS = 3 * 24 * 60 * 60 * 1000;
/** Ids far above the admins' own (a database serial). */
const ID_BASE = 1_900_000_000;

/** The game's address (VITE_SITE_URL) when this page is on an old one. */
export function newAddress(
  host: string,
  site: string | undefined,
): string | null {
  if (!site || !OLD_HOSTS.includes(host)) return null;
  try {
    const url = new URL(site);
    return url.protocol === "https:" && url.host !== host ? url.origin : null;
  } catch {
    return null;
  }
}

/** The banner, with a new id every few days so "Later" isn't for good. */
export function moveNotice(origin: string, now = Date.now()): Announcement {
  const host = new URL(origin).host;
  return {
    id: ID_BASE + Math.floor(now / REMIND_MS),
    tone: "info",
    message: `Element Arena moved to ${host}: sign in there and add it to your Home Screen. Guests, add an email first.`,
    createdAt: new Date(now).toISOString(),
    endsAt: new Date(now + REMIND_MS).toISOString(),
  };
}
