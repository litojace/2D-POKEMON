/**
 * The title screen (owner, 22 Nov): opening the game shows who you are
 * playing as, with Start, Switch account and quick buttons (Settings, Help,
 * Support, Repair), as big games do. It is part of the front door
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
import { buildId } from "./build-id";
import { betaTag } from "./open-beta";
import { menuIcon } from "./menu-icons";
import { welcomeTools } from "./welcome-tools";

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

export type QuickAction = "settings" | "help" | "support" | "repair";
const QUICK: [QuickAction, Parameters<typeof menuIcon>[0], string][] = [
  ["settings", "settings", "Settings"],
  ["help", "help", "Help"],
  ["support", "chat", "Support"],
  ["repair", "again", "Repair"],
];
/**
 * The title screen (owner's pick, 22 Nov: layout B, "tap anywhere"): the
 * painting fills the screen with the name in the middle; a tap anywhere
 * starts. Who you play as sits top left and opens Switch account; the quick
 * buttons sit top right; the version and the server's state sit in the
 * bottom corners. The tap target is one screen-sized button under the other
 * controls, so tapping those never starts the game.
 */
export function titleScreen(a: TitleAccount, build = "") {
  const how = a.method === "guest" ? "Guest" : (METHOD[a.method] ?? "email");
  const quick = quickButtons();
  return `<section class="welcome-gate is-title" data-title-card aria-labelledby="title-heading"><div class="gate-backdrop" aria-hidden="true"></div><div class="title-illustration" aria-hidden="true"></div><button type="button" class="title-tap" id="title-start" ${a.ready ? "" : "disabled"} aria-describedby="title-status"><span class="title-prompt">${a.ready ? `<span class="for-touch">Tap to start</span><span class="for-mouse">Click to start</span>` : `<span class="gate-spinner" aria-hidden="true"></span>Connecting…`}</span>${a.ready ? `<small class="title-hint"><span class="for-touch">Tap anywhere on the screen</span><span class="for-mouse">Click anywhere, or press Enter</span></small>` : ""}</button><div class="title-brand"><span class="gate-kicker">Real-time creature duels</span><h1 id="title-heading">Element<span>Arena</span>${betaTag()}</h1></div><button type="button" class="title-who" id="title-switch" aria-label="${esc(a.name)}, level ${a.level ?? "unknown"}, signed in with ${how}. Switch account"><span class="title-avatar" aria-hidden="true">${a.picture}</span><span class="title-id"><b class="title-name">${esc(a.name)}</b><small>${a.level !== null ? `<span class="title-level">Lv ${a.level}</span> · ` : ""}${menuIcon("swap")}Switch account</small></span></button>${welcomeTools("title-quick", quick)}${build ? `<p class="title-build">Version ${esc(build)}</p>` : ""}<p class="title-status" id="title-status" role="status"><i class="title-dot${a.ready ? " is-on" : ""}" aria-hidden="true"></i>${a.ready ? "Server online" : "Reaching the server…"}</p></section>`;
}

/**
 * Quick buttons on every front-door screen: what a player needs before
 * they can (or want to) go in. Repair is the classic "fix client" button:
 * when an update half-arrived or a picture is stuck, it clears the game's
 * downloaded files and reloads, without touching the account.
 */
export function quickBar(build?: string) {
  return `${welcomeTools("gate-quick", quickButtons())}${build ? `<p class="gate-build">Version ${esc(build)}</p>` : ""}`;
}
/**
 * The four actions share their markup across the title and sign-in screens.
 * Poster groups them under MENU; the underlying look retains its round icons.
 */
function quickButtons() {
  return QUICK.map(
    ([action, icon, label]) =>
      `<button type="button" class="title-quick-btn" data-gate-quick="${action}"><span class="title-quick-icon">${menuIcon(icon)}</span><span>${label}</span></button>`,
  ).join("");
}

/** The game's version for the front door ("dev" while developing). */
export const BUILD_ID = buildId() ?? "";

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
