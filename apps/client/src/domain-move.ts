/**
 * The game moved to play.elementarenausa.com (docs/domain-move.md). The old
 * address keeps serving the same game while players move over, so installs
 * on it keep their sign-in. There a dialog (announcements.ts) offers the new
 * address: Open or Later, once every few days, never in a battle. (It was a
 * banner, but on a phone in landscape the banner covered the top bar and the
 * sign-in card's tabs until it was answered.)
 */
import type { Announcement } from "../../../packages/shared/src/accounts";
import type { NoticeLink } from "./announcements";

/** Addresses the game used to live at. */
export const OLD_HOSTS: readonly string[] = ["parena.litojace.com"];
/** The notice comes back after this long, until they move. */
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

/** The notice, with a new id every few days so "Later" isn't for good. */
export function moveNotice(origin: string, now = Date.now()): Announcement {
  const host = new URL(origin).host;
  return {
    id: ID_BASE + Math.floor(now / REMIND_MS),
    tone: "info",
    message: `It's now at ${host}. Open it, sign in, and add it to your Home Screen. Playing as a guest? Add an email on your player card here first, so your progress comes with you.`,
    createdAt: new Date(now).toISOString(),
    endsAt: new Date(now + REMIND_MS).toISOString(),
  };
}

/** The notice's button and heading. */
export function moveLink(origin: string): NoticeLink {
  return {
    href: `${origin}/`,
    label: "Open",
    title: "Element Arena has moved",
  };
}
