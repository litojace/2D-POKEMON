import type {
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
const LABELS: Record<OnlinePlayer["activity"], string> = {
  match: "In match",
  practice: "Practice",
  lobby: "Lobby",
  menu: "Menu",
};
/** Body of the admin "Online" tab. */
export function renderOnline(
  list: OnlineList,
  fighterName: (id: string) => string,
  now = Date.now(),
) {
  const counts = { match: 0, practice: 0, lobby: 0, menu: 0 };
  for (const p of list.players) counts[p.activity]++;
  const summary = `<div class="online-summary"><span><b>${list.players.length}</b> signed in</span>${(
    Object.keys(counts) as OnlinePlayer["activity"][]
  )
    .filter((k) => counts[k])
    .map((k) => `<span>${counts[k]} ${LABELS[k].toLowerCase()}</span>`)
    .join(
      "",
    )}${list.guests ? `<span>${list.guests} not signed in</span>` : ""}<button type="button" class="quiet" id="online-refresh">Refresh</button></div>`;
  const rows = list.players
    .map(
      (p) =>
        `<div class="admin-row online-row" data-online="${escape(p.id)}" data-name="${escape(p.displayName)}"><div class="admin-row-head"><span class="online-dot ${p.activity}" aria-hidden="true"></span><strong>${escape(p.displayName)}</strong>${
          p.title
            ? `<span class="title-chip" style="--chip:${escape(p.titleColor ?? "#9fb3d1")}">${escape(p.title)}</span>`
            : ""
        }${p.isAdmin ? '<span class="admin-badge">ADMIN</span>' : ""}${p.guest ? '<span class="admin-badge guest-badge">GUEST</span>' : ""}<span class="online-state ${p.activity}">${LABELS[p.activity]}</span><small>online ${onlineFor(p.since, now)}${p.connections > 1 ? ` · ${p.connections} tabs` : ""}</small></div><div class="online-activity">${describeActivity(p, fighterName)}${
          p.isAdmin
            ? ""
            : '<button type="button" class="quiet" data-manage>Manage</button>'
        }</div></div>`,
    )
    .join("");
  return `${summary}<div class="admin-list">${
    rows || "<p>No signed-in players are online right now.</p>"
  }</div><p class="online-note">Updates every 10 seconds while this tab is open · last checked ${new Date(
    list.at,
  ).toLocaleTimeString()}</p>`;
}
