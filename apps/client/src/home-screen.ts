import { CHARACTERS, type CharacterId } from "@arena/shared";
import { menuIcon } from "./menu-icons";
import "./welcome-scene.css";

export type HomeMode = "duel" | "teams" | "ffa" | "raid";
export const HOME_MODES = [
  ["duel", "1v1 Duel", "Private room · best of five"],
  ["teams", "2v2 Teams", "Private room · best of five"],
  ["ffa", "Free-for-all", "Private room · 3–4 players"],
  ["raid", "Boss Raid", "Choose a boss · 1–4 players"],
] as const;

export function lastHomeFighter(): CharacterId {
  try {
    const id = localStorage.getItem("arena-featured-fighter");
    if (id && Object.hasOwn(CHARACTERS, id)) return id as CharacterId;
  } catch {
    /* Optional preference. */
  }
  return "voltkit";
}
export function rememberHomeFighter(id: CharacterId) {
  try {
    localStorage.setItem("arena-featured-fighter", id);
  } catch {
    /* Optional preference. */
  }
}
/**
 * What #menu holds while you're in town: the Fighters and Play panels that
 * slide over the town (the town itself is its own layer, see town.ts).
 */
export function homeShell(controls: string, roster: string) {
  return `<div class="home-screen"><button type="button" class="home-panel-scrim" data-home-close aria-label="Close panel" tabindex="-1" hidden></button><section id="home-fighter-panel" class="home-drawer home-roster-drawer" role="dialog" aria-modal="true" aria-labelledby="home-fighters-title" tabindex="-1" hidden><header class="home-drawer-head"><div><span class="eyebrow">YOUR ROSTER</span><h2 id="home-fighters-title">Choose your fighter</h2></div><button type="button" class="home-panel-close btn-secondary" data-home-close aria-label="Close fighter selection">×</button></header><div class="home-drawer-scroll"><div class="roster-panel">${roster}</div></div></section><section id="home-play-panel" class="home-drawer home-play-drawer" role="dialog" aria-modal="true" aria-labelledby="home-play-title" tabindex="-1" hidden><header class="home-drawer-head"><div><span class="eyebrow">PLAY YOUR WAY</span><h2 id="home-play-title">Bring a friend. Find a rival.</h2></div><button type="button" class="home-panel-close btn-secondary" data-home-close aria-label="Close play options">×</button></header><div class="home-drawer-scroll"><aside class="room-panel card">${controls}</aside></div></section></div>`;
}

export type GateStatus =
  | "loading"
  | "connecting"
  | "signed-out"
  | "error"
  | "unavailable"
  | "session-replaced";
/**
 * The front door, over a single still painting of the plaza: the game's pitch on
 * the left, and on the right the sign-up / log-in panel (filled in by
 * AccountUI.showAuth) or the current status.
 */
export function welcomeGate(status: GateStatus, invite?: string | null) {
  const wait = (text: string) =>
    `<div class="gate-wait" role="status"><span class="gate-spinner" aria-hidden="true"></span><p>${text}</p></div>`;
  const panel =
    status === "session-replaced"
      ? `<div class="gate-wait" role="status"><h2>Playing on another device</h2><p>This account was opened on another device or tab. Only one game session can be active at a time.</p><p>Continuing here will pause the game on the other device.</p><div class="gate-actions"><button type="button" class="auth-submit" id="gate-retry">Play on this device</button><button type="button" class="auth-link" id="gate-login">Use another account</button></div></div>`
      : status === "loading"
        ? wait("Checking your account…")
        : status === "connecting"
          ? wait("Connecting to Elemental Plaza…")
          : status === "error"
            ? `<div class="gate-wait" role="status"><p>We couldn't load your profile. Check your connection and try again.</p><div class="gate-actions"><button type="button" class="auth-submit" id="gate-retry">Try again</button><button type="button" class="auth-link" id="gate-login">Use another account</button></div></div>`
            : status === "unavailable"
              ? `<div class="gate-wait" role="status"><p>Sign-in isn't available right now. Please try again later.</p></div>`
              : "";
  return `<section class="welcome-gate" aria-labelledby="gate-title"><div class="gate-backdrop" aria-hidden="true"></div><div class="gate-layout"><div class="gate-intro"><div class="gate-heading"><span class="gate-mark" aria-hidden="true"><svg viewBox="0 0 64 64"><path fill="currentColor" fill-rule="evenodd" d="M32 2 42 21 62 32 43 43 32 62 21 43 2 32 21 21Zm0 14L16 32l16 16 16-16Z"/></svg></span><span class="gate-kicker">Real-time creature duels</span><h1 id="gate-title">Element<span>Arena</span></h1>${invite ? `<p class="gate-invite">You've been invited to room <b>${invite}</b>. Log in or create an account to join.</p>` : `<p class="gate-lead">Eight elemental fighters. One living town. Your next rival is already here.</p>`}</div></div><div class="gate-card" id="gate-auth">${panel}</div></div></section>`;
}

/** Start a room: the mode choice and Create button, for the town's Play panel. */
export function startRoomSection(mode: HomeMode) {
  const icons = {
    duel: "battle",
    teams: "friends",
    ffa: "target",
    raid: "bestiary",
  } as const;
  return `<section class="play-start"><h3>Start a room</h3><div class="mode-grid" role="radiogroup" aria-label="Room type">${HOME_MODES.map(([value, label, hint]) => `<button type="button" role="radio" class="bot-level mode-level mode-card${mode === value ? " active" : ""}" data-mode="${value}" aria-checked="${mode === value}"><span class="mode-card-icon" aria-hidden="true">${menuIcon(icons[value])}</span><span class="mode-card-text"><b>${label}</b><small>${hint}</small></span><span class="mode-card-check" aria-hidden="true">${menuIcon("check")}</span></button>`).join("")}</div><button type="button" class="primary btn-primary full" id="play-create">${menuIcon("battle")}<span>Create room</span></button></section>`;
}
