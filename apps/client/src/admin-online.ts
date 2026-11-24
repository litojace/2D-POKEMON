import type {
  OnlineActivity,
  OnlineList,
  OnlinePlayer,
} from "../../../packages/shared/src/accounts";
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
/** "just now", "4m", "2h 5m" — how long someone has been connected. */
export function onlineFor(since: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(since)) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
const PHASES: Record<string, string> = {
  lobby: "waiting in lobby",
  briefing: "reading the briefing",
  countdown: "starting",
  playing: "fighting",
  intermission: "between rounds",
  paused: "paused (reconnecting)",
  finished: "match over",
};
/** One-line description of what the player is doing. */
export function describeActivity(
  p: OnlinePlayer,
  fighterName: (id: string) => string,
) {
  const as = p.fighter ? ` as ${escape(fighterName(p.fighter))}` : "";
  switch (p.activity) {
    case "menu":
      return "Browsing menus";
    case "town":
      return "In the Plaza";
    case "practice":
      return `Solo practice${as}`;
    case "lobby":
      return `In lobby <code>${escape(p.room ?? "")}</code>${
        p.opponent ? ` with ${escape(p.opponent)}` : " · waiting for a rival"
      }`;
    case "match":
      return `${p.opponent ? `Battling ${escape(p.opponent)}` : "In a match"}${as} · ${
        PHASES[p.phase ?? ""] ?? escape(p.phase ?? "")
      } <code>${escape(p.room ?? "")}</code>`;
  }
}
export const ACTIVITY_LABELS: Record<OnlineActivity, string> = {
  match: "In match",
  practice: "Practice",
  lobby: "Lobby",
  town: "Plaza",
  menu: "Menu",
};
/** Busiest first: matches, then lobbies, practice, the Plaza, menus. */
const ORDER: OnlineActivity[] = ["match", "lobby", "practice", "town", "menu"];
/**
 * Body of the admin "Online" tab: filter chips with a count for each
 * activity, then one row per signed-in player (busiest first). `filter`
 * shows one activity only.
 */
export function renderOnline(
  list: OnlineList,
  fighterName: (id: string) => string,
  now = Date.now(),
  filter: "all" | OnlineActivity = "all",
) {
  const counts = { match: 0, practice: 0, lobby: 0, town: 0, menu: 0 };
  for (const p of list.players) counts[p.activity]++;
  const chip = (id: "all" | OnlineActivity, label: string) =>
    `<button type="button" class="${filter === id ? "active" : ""}" data-act="online-filter" data-filter="${id}" aria-pressed="${filter === id}">${id === "all" ? "" : `<span class="online-dot ${id}" aria-hidden="true"></span>`}${label}</button>`;
  const summary = `<div class="report-filter adm-chips adm-sticky" role="group" aria-label="Filter by activity">${chip(
    "all",
    `All ${list.players.length}`,
  )}${ORDER.filter((k) => counts[k])
    .map((k) => chip(k, `${counts[k]} ${ACTIVITY_LABELS[k].toLowerCase()}`))
    .join("")}</div>`;
  const shown = list.players
    .filter((p) => filter === "all" || p.activity === filter)
    .sort(
      (a, b) =>
        ORDER.indexOf(a.activity) - ORDER.indexOf(b.activity) ||
        a.displayName.localeCompare(b.displayName),
    );
  const rows = shown
    .map(
      (p) =>
        `<div class="admin-row online-row" data-online="${escape(p.id)}" data-name="${escape(p.displayName)}"><div class="admin-row-head"><span class="online-dot ${p.activity}" aria-hidden="true"></span><strong>${escape(p.displayName)}</strong>${
          p.title
            ? `<span class="title-chip" style="--chip:${escape(p.titleColor ?? "#9fb3d1")}">${escape(p.title)}</span>`
            : ""
        }${p.isAdmin ? '<span class="admin-badge">Admin</span>' : ""}${p.guest ? '<span class="admin-badge guest-badge">Guest</span>' : ""}<small>${onlineFor(p.since, now)}${p.connections > 1 ? ` · ${p.connections} tabs` : ""}</small></div><div class="online-activity"><span class="online-state ${p.activity}">${ACTIVITY_LABELS[p.activity]}</span><span class="online-what">${describeActivity(p, fighterName)}</span>${
          p.isAdmin
            ? ""
            : `<button type="button" class="adm-btn" data-manage data-act="manage" data-id="${escape(p.id)}">Manage</button>`
        }</div></div>`,
    )
    .join("");
  return `${summary}<div class="admin-list adm-list">${
    rows ||
    `<div class="adm-empty"><p>${
      list.players.length
        ? "Nobody is doing that right now."
        : "No signed-in players are online right now."
    }</p></div>`
  }</div><p class="online-note">${
    list.guests ? `${list.guests} not signed in · ` : ""
  }last checked ${new Date(list.at).toLocaleTimeString()}</p>`;
}
