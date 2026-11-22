/**
 * The title screen (owner, 22 Nov): opening the game shows who you are
 * playing as, with Start, Switch account and quick buttons (Settings, How to
 * play, Support, Repair), as big games do. It is part of the front door
 * (home-screen.ts, welcomeGate) and replaces 20 Nov's "straight to the Lobby"
 * once per launch:
 *
 * - once per launch: a reload in the same tab, or the app coming back from
 *   the background, goes straight back in (sessionStorage lives as long as
 *   the tab or app does; killing the app clears it);
 * - never in the way of where the player was going: a room to rejoin, an
 *   invite link or a friend's notification skip it;
 * - a player who just signed in at the front door has passed it already.
 *
 * Start waits for the game connection ("Connecting…"); everything else on
 * the screen works without one.
 */
import { iconLabel, menuIcon } from "./menu-icons";

const PASSED_KEY = "ea-title-passed";

/** Not yet shown on this launch. */
export function titleDue(): boolean {
  try {
    return sessionStorage.getItem(PASSED_KEY) !== "1";
  } catch {
    return false;
  }
}
/** Passed for this launch (Start, a sign-in at the front door, a skip). */
export function passTitle() {
  try {
    sessionStorage.setItem(PASSED_KEY, "1");
  } catch {
    /* No storage: shown at most until the next screen. */
  }
}

const METHOD: Record<string, string> = {
  apple: "Apple",
  google: "Google",
  email: "email",
};

const esc = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

export interface TitleAccount {
  name: string;
  level: number | null;
  /** "apple", "google", "email" or "guest". */
  method: string;
  /** The avatar in its frame (AccountUI.identityPicture). */
  picture: string;
  /** The game connection is up: Start can go in. */
  ready: boolean;
}

/** The card on the right of the front door: who you are, Start, Switch. */
export function titleCard(a: TitleAccount) {
  const how =
    a.method === "guest"
      ? "Guest pass on this device"
      : `Signed in with ${METHOD[a.method] ?? "email"}`;
  return `<div class="title-card" data-title-card><div class="title-who"><span class="title-avatar" aria-hidden="true">${a.picture}</span><span class="title-id"><small>Playing as</small><b class="title-name">${esc(a.name)}</b><span class="title-meta">${a.level !== null ? `<span class="title-level">Lv ${a.level}</span>` : ""}<span>${how}</span></span></span></div><button type="button" class="auth-submit title-start" id="title-start" ${a.ready ? "" : 'disabled aria-describedby="title-status"'}>${a.ready ? iconLabel("battle", "Start") : `<span class="gate-spinner" aria-hidden="true"></span><span>Connecting…</span>`}</button><p class="title-status" id="title-status" role="status">${a.ready ? `<i class="title-dot is-on" aria-hidden="true"></i>Server online` : `<i class="title-dot" aria-hidden="true"></i>Reaching the server…`}</p><button type="button" class="auth-secondary title-switch" id="title-switch">${iconLabel("swap", "Switch account")}</button></div>`;
}

export type QuickAction = "settings" | "help" | "support" | "repair";
const QUICK: [QuickAction, Parameters<typeof menuIcon>[0], string][] = [
  ["settings", "settings", "Settings"],
  ["help", "help", "How to play"],
  ["support", "chat", "Support"],
  ["repair", "again", "Repair"],
];
/**
 * Quick buttons on every front-door screen: what a player needs before
 * they can (or want to) go in. Repair is the classic "fix client" button:
 * when an update half-arrived or a picture is stuck, it clears the game's
 * downloaded files and reloads, without touching the account.
 */
export function quickBar(build?: string) {
  return `<nav class="gate-quick" aria-label="Quick options">${QUICK.map(([action, icon, label]) => `<button type="button" class="gate-quick-btn" data-gate-quick="${action}">${menuIcon(icon)}<span>${label}</span></button>`).join("")}</nav>${build ? `<p class="gate-build">Version ${esc(build)}</p>` : ""}`;
}

/** The game's version for the front door ("dev" while developing). */
declare const __BUILD__: string | undefined;
export const BUILD_ID =
  typeof __BUILD__ === "string" && /^[a-z0-9-]{1,16}$/.test(__BUILD__)
    ? __BUILD__
    : "";

/**
 * Repair: unregister the service worker and empty its caches, then reload.
 * Nothing about the account or the player's settings is removed; the
 * download caches and this device's copy of the profile are rebuilt.
 */
export async function repairGame(o: {
  reload?: () => void;
  forget?: string[];
}) {
  try {
    const registrations =
      (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
    await Promise.all(registrations.map((r) => r.unregister()));
  } catch {
    /* No service worker here (the app, a private window). */
  }
  try {
    const names = (await globalThis.caches?.keys()) ?? [];
    await Promise.all(names.map((n) => caches.delete(n)));
  } catch {
    /* No Cache Storage. */
  }
  for (const key of o.forget ?? [])
    try {
      localStorage.removeItem(key);
    } catch {
      /* No storage. */
    }
  (o.reload ?? (() => location.reload()))();
}
