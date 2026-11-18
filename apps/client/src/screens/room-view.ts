/**
 * Rooms (UI remodel step 5, docs/ui-remodel/PLAN.md): the raid room and the
 * private PvP rooms (1v1, 2v2, free-for-all) in one frame, as the owner
 * approved on 4 Nov (images/mockups/room-*.webp). The seats sit in a column
 * on the left, where the stage stands on other screens; the roster is the
 * picker on the right (screens/roster.ts in its "lock" mode), with Lock in
 * and Ready bottom right. A room has no rail: you are in a server room, not
 * the Lobby; leaving is the picker's corner button.
 *
 * Markup and rules only (no DOM); main.ts gathers the room's data and wires
 * the clicks (data-room-*, data-team).
 */
import { SOLO_NO_REVIVE, soloRevives } from "../raid-solo";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import {
  RAID_BOSSES,
  type RaidBossId,
} from "../../../../packages/shared/src/raid";
import { raidPortraitImage } from "../raid-splash-art";
import { SPIRE_COLOR, spireTowerArt } from "../spire-art";
import {
  SPIRE_ZONES,
  spireZoneStart,
} from "../../../../packages/shared/src/spire";
import { menuIcon } from "../menu-icons";
import { button, elementTag, esc, tag } from "../ui/components";

export type RoomMode = "raid" | "duel" | "teams" | "ffa";
export interface RoomSeat {
  id: string;
  name: string;
  character: CharacterId;
  /** The portrait (framedAvatar markup: frame and colours). */
  avatar: string;
  ready: boolean;
  connected: boolean;
  host: boolean;
  me: boolean;
  team?: 0 | 1;
  /** A raid's AI stand-in, a rank flair… (short, shown after the fighter). */
  flair?: string;
  /**
   * PvP: the seat's pick, as far as you may see it (docs/hidden-picks.md).
   * `hidden`: another side's (a "?"). Without `character`: nothing chosen
   * yet. `art` is the fighter's portrait.
   */
  pick?: {
    hidden?: boolean;
    locked: boolean;
    character?: CharacterId;
    art?: string;
  };
  /** Another player's own picture (its id): a tap reports it. */
  reportPhoto?: string;
}
export interface RoomData {
  mode: RoomMode;
  /** Watching someone else's room: no picker, no Ready. */
  watch: boolean;
  code: string;
  boss?: RaidBossId;
  /** A Spire climb (a raid room): its zone, and why it could not start, if it couldn't. */
  spire?: { problem?: string; zone?: number };
  /** Round wins needed (PvP). */
  rounds: number;
  seats: RoomSeat[];
  /** You host the room (Shuffle). */
  host: boolean;
  /** This week's arcade: its rules are fixed. */
  arcade?: { name: string; text: string };
  /** The 2v2 team-up line (markup built by main.ts), or "". */
  teamUp: string;
  watchers: string[];
  /** The ⋯ menu (settings, invite, leave) is open. */
  menu?: boolean;
}

export const MODE_NAMES: Record<RoomMode, string> = {
  raid: "Boss raid",
  duel: "1v1 Duel",
  teams: "2v2 Teams",
  ffa: "Free-for-all",
};
const TEAM_NAMES = ["Blue team", "Red team"] as const;
const SHORT_TEAM = ["Blue", "Red"] as const;
const words = ["zero", "one", "two", "three", "four"];
const firstTo = (n: number) => `first to ${words[n] ?? n}`;

/** How many seats a room has, and how many must be filled to start. */
export function roomSize(mode: RoomMode) {
  return mode === "duel"
    ? { seats: 2, needed: 2 }
    : mode === "ffa"
      ? { seats: 4, needed: 3 }
      : mode === "teams"
        ? { seats: 4, needed: 4 }
        : { seats: 4, needed: 1 };
}
/** The picker's kicker for this room ("Raid room · Grumblecrag"…). */
export function roomKicker(d: RoomData) {
  if (d.spire) {
    const zone = d.spire.zone ?? 1;
    return zone > 1
      ? `Spire room · zone ${zone} from floor ${spireZoneStart(zone)} · everyone needs that checkpoint`
      : "Spire room · zone 1 from floor 1";
  }
  return d.mode === "raid" && d.boss
    ? `Raid room · ${RAID_BOSSES[d.boss].name}`
    : `Private ${MODE_NAMES[d.mode]} · ${firstTo(d.rounds)}`;
}
export const readyCount = (d: RoomData) =>
  d.seats.filter((s) => s.ready).length;

/* ------------------------------------------------------------ pieces */

/** PvP: the pick beside a seat: the fighter, or "?" for another side's. */
/** A small padlock (Locked: picked, not yet ready). */
const PADLOCK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
/**
 * A seat's state, one colour each, so it reads at a glance: Choosing
 * (plain), Locked (gold, a padlock), Ready (solid green, a tick).
 */
function seatState(s: RoomSeat) {
  if (!s.connected) return tag("Offline");
  if (s.ready)
    return `<span class="ui-tag room-state is-ready">${menuIcon("check")}Ready</span>`;
  if (s.pick?.locked)
    return `<span class="ui-tag room-state is-locked">${PADLOCK}Locked</span>`;
  return `<span class="ui-tag room-state">Choosing</span>`;
}
function pickTile(p: NonNullable<RoomSeat["pick"]>, s: RoomSeat) {
  const name = p.character ? CHARACTERS[p.character].name : "";
  const label = p.hidden
    ? `${s.name}'s fighter is hidden until the match starts${p.locked ? " · locked in" : ""}`
    : name
      ? `${s.name} ${p.locked ? "locked in" : "is looking at"} ${name}`
      : `${s.name} hasn't picked yet`;
  const inner = p.hidden ? `<b aria-hidden="true">?</b>` : (p.art ?? "");
  // No corner badge on the picture: the seat's state tag beside it already
  // says Locked (a padlock) or Ready (a tick), on desktop and phones; the
  // tile's gold or green edge repeats it.
  return `<span class="room-pick${p.hidden ? " is-hidden" : ""}${p.locked ? " is-locked" : p.character ? " is-browsing" : " is-empty"}${s.ready ? " is-ready" : ""}" role="img" aria-label="${esc(label)}" title="${esc(label)}">${inner}</span>`;
}
function seat(s: RoomSeat) {
  const state = s.pick
    ? seatState(s)
    : !s.connected
      ? tag("Offline")
      : s.ready
        ? `<span class="ui-tag is-ok">${menuIcon("check")}Ready</span>`
        : tag("Choosing");
  // PvP: the pick is in its own tile (and may be hidden), never in words.
  const fighter = s.pick
    ? s.pick.hidden
      ? "Pick hidden"
      : s.pick.character
        ? CHARACTERS[s.pick.character].name
        : ""
    : CHARACTERS[s.character].name;
  // The host wears the Lobby's crown before their name, not a word.
  const sub = [fighter, s.flair ?? ""].filter(Boolean).join(" · ");
  return `<div class="room-seat${s.me ? " is-me" : ""}${s.connected ? "" : " is-away"}${s.pick ? " has-pick" : ""}" data-room-seat="${esc(s.id)}"${s.me ? " data-me" : ""}>${
    s.reportPhoto
      ? `<button type="button" class="room-avatar player-avatar is-reportable" data-room-report-photo="${esc(s.reportPhoto)}" data-room-report-name="${esc(s.name)}" aria-label="${esc(`${s.name}'s picture. Report it`)}" title="Report this picture">${s.avatar}</button>`
      : `<span class="room-avatar player-avatar"${s.pick ? "" : ` title="${esc(CHARACTERS[s.character].name)}"`}>${s.avatar}</span>`
  }<span class="room-seat-text"><b>${s.host ? '<i class="room-crown" role="img" aria-label="Host" title="Host">♛</i>' : ""}${esc(s.name)}${s.me ? ' <small class="ui-note">(you)</small>' : ""}</b><small class="ui-note room-seat-fighter">${esc(sub || "\u00a0")}</small></span>${s.pick ? `<span class="room-seat-side">${pickTile(s.pick, s)}${state}</span>` : state}</div>`;
}
function openSeat(
  label: string,
  o: { team?: 0 | 1; watch?: boolean; first?: boolean } = {},
) {
  const inner = `<span class="room-plus" aria-hidden="true">+</span><span class="room-seat-text"><b>${o.team !== undefined ? `Join ${SHORT_TEAM[o.team]}` : "Invite"}</b><small class="ui-note">${esc(label)}</small></span>`;
  if (o.watch) return `<div class="room-seat is-open">${inner}</div>`;
  return o.team !== undefined
    ? `<button type="button" class="room-seat is-open" data-team="${o.team}" aria-label="Join the ${TEAM_NAMES[o.team].toLowerCase()}">${inner}</button>`
    : `<button type="button" class="room-seat is-open" data-room-invite${o.first ? ' id="invite-friends"' : ""} aria-label="Invite a friend: ${esc(label)}">${inner}</button>`;
}
function banner(d: RoomData) {
  if (d.spire)
    return `<div class="room-banner is-boss is-spire" style="--el:${SPIRE_COLOR}">${spireTowerArt(0, "room-spire")}<span class="room-banner-text"><span class="room-row">${elementTag((SPIRE_ZONES[d.spire.zone ?? 1] ?? SPIRE_ZONES[1]).element)}</span><b class="room-banner-name">The Spire</b><small class="ui-note room-banner-line">${esc(`Zone ${d.spire.zone ?? 1} · ${(SPIRE_ZONES[d.spire.zone ?? 1] ?? SPIRE_ZONES[1]).name} · beat the Echoes, floor by floor`)}</small></span></div>`;
  if (d.mode === "raid" && d.boss) {
    const b = RAID_BOSSES[d.boss];
    return `<div class="room-banner is-boss" style="--el:${b.color}">${raidPortraitImage(d.boss)}<span class="room-banner-text"><span class="room-row">${elementTag(b.element)}<span class="room-stars" aria-label="Difficulty ${b.stars} of 3">${"★".repeat(b.stars)}<i aria-hidden="true">${"★".repeat(3 - b.stars)}</i></span></span><b class="room-banner-name">${esc(b.name)}</b><small class="ui-note room-banner-line">${esc(b.signature)}</small></span></div>`;
  }
  const line =
    d.mode === "duel"
      ? "Starts when both players are ready"
      : d.mode === "teams"
        ? "Starts when all four are ready"
        : "Everyone fights everyone · 3 or 4 players";
  return `<div class="room-banner is-mode is-${d.mode}"><span class="room-banner-text"><span class="ui-kicker">${d.arcade ? `${esc(d.arcade.name)} · ` : ""}${firstTo(d.rounds)}</span><b class="room-banner-name">${MODE_NAMES[d.mode]}</b><small class="ui-note room-banner-line">${line}</small></span></div>`;
}
function head(title: string, note: string, extra = "") {
  return `<div class="room-head"><h3 class="ui-h">${esc(title)}</h3>${extra || `<small class="ui-note">${esc(note)}</small>`}</div>`;
}
/** This week's arcade: its fixed rules (private rooms have none). */
function rules(d: RoomData) {
  if (d.mode === "raid" || !d.arcade) return "";
  return `<p class="ui-note room-arcade"><b>${esc(d.arcade.name)}</b> · ${esc(d.arcade.text)} Weekly rules are fixed. PvP rating stays separate.</p>`;
}
function notes(d: RoomData) {
  const lines = d.spire
    ? [
        ...(d.spire.problem ? [d.spire.problem] : []),
        d.seats.length === 1
          ? "One self-revive a floor"
          : "Stand near allies to revive",
        "Each cleared floor is saved",
      ]
    : d.mode === "raid"
      ? [
          d.seats.length === 1
            ? d.boss && !soloRevives(d.boss)
              ? SOLO_NO_REVIVE
              : "One solo self-revive"
            : "Stand near allies to revive",
          "Separate from PvP rating",
        ]
      : [
          d.mode === "duel"
            ? "The match begins when both players are ready."
            : d.mode === "ffa"
              ? `First to ${d.rounds} round wins. Starts when everyone here is ready (3 or 4 players).`
              : `First team to ${d.rounds} round wins. Starts when all four players are ready.`,
        ];
  return `<div class="room-notes">${lines.map((l) => `<span>${esc(l)}</span>`).join("")}</div>`;
}

/* -------------------------------------------------------------- seats */

function seats(d: RoomData) {
  const { seats: max, needed } = roomSize(d.mode);
  const room = `room ${d.code}`;
  if (d.mode === "teams") {
    const me = d.seats.find((s) => s.me);
    return ([0, 1] as const)
      .map((t) => {
        const members = d.seats.filter((s) => s.team === t);
        const open = Math.max(0, 2 - members.length);
        const slots = Array.from({ length: open }, (_, k) =>
          !d.watch && me && me.team !== t && k === 0
            ? openSeat("Switch to this team", { team: t })
            : openSeat("Waiting for a player", {
                watch: d.watch,
                first: t === 0 && k === 0,
              }),
        ).join("");
        const shuffle =
          t === 1 && d.host && !d.watch
            ? button("Shuffle", {
                size: "s",
                icon: "shuffle",
                attrs: { id: "shuffle", "data-room-shuffle": true },
              })
            : "";
        return `<div class="room-team is-team-${t}">${head(TEAM_NAMES[t], t === 0 ? room : "", shuffle)}<div class="room-seat-list">${members.map(seat).join("")}${slots}</div></div>`;
      })
      .join("");
  }
  const open = Array.from(
    { length: Math.max(0, max - d.seats.length) },
    (_, k) =>
      openSeat(
        d.mode === "duel"
          ? "Waiting for your opponent"
          : d.mode === "ffa"
            ? d.seats.length + k < needed
              ? "Needed to start"
              : "Optional fourth fighter"
            : "Open seat",
        { watch: d.watch, first: k === 0 },
      ),
  ).join("");
  const title = d.spire
    ? "Climbing party"
    : d.mode === "raid"
      ? "Raid party"
      : "Players";
  return `${head(title, `${readyCount(d)}/${d.seats.length} ready · ${room}`)}<div class="room-seat-list">${d.seats.map(seat).join("")}${open}</div>`;
}

/**
 * The ⋯ button in the banner's top-right corner, and its menu. A room has no
 * top bar (coins, level, settings: more room for the seats and the picker);
 * Settings, Invite and Leave live here. Chat is the button in the banner's
 * other corner (chat/chat.css places it).
 */
function more(d: RoomData) {
  const full = d.seats.length >= roomSize(d.mode).seats;
  const item = (
    id: string,
    icon: Parameters<typeof menuIcon>[0],
    label: string,
    danger = false,
  ) =>
    `<button type="button" class="room-menu-item${danger ? " is-danger" : ""}" role="menuitem" data-room-menu="${id}">${menuIcon(icon)}<span>${esc(label)}</span></button>`;
  const items = [
    item("settings", "settings", "Settings"),
    item("help", "help", "How to play"),
    ...(d.watch || full
      ? []
      : [item("invite", "add-friend", "Invite friends")]),
    d.watch
      ? item("stop-watching", "stop-watching", "Stop watching", true)
      : item("leave", "leave", "Leave the room", true),
  ];
  return `<button type="button" class="room-more" data-room-more aria-label="Room menu: settings, invite, leave" aria-haspopup="menu" aria-expanded="${!!d.menu}">${menuIcon("more")}</button>${d.menu ? `<div class="room-menu" role="menu" aria-label="Room menu">${items.join("")}</div>` : ""}`;
}

/** The seats column (the picker or the watch panel sits beside it). */
export function roomSeatsMarkup(d: RoomData) {
  return `<section class="room-seats" aria-label="${esc(MODE_NAMES[d.mode])} room" data-room-mode="${d.mode}">${banner(d)}${more(d)}<div class="room-seats-body">${seats(d)}${d.teamUp}${rules(d)}</div>${notes(d)}</section>`;
}

/** Watching a room: the panel beside the seats (no picker, no Ready). */
export function roomWatchMarkup(d: RoomData) {
  return `<section class="ui-panel room-watch" role="region" aria-label="Watching room ${esc(d.code)}"><header class="ui-panel-head"><div class="ui-heading"><span class="ui-kicker">Watching room ${esc(d.code)}</span><h2 class="ui-title">Ringside seat</h2></div></header><div class="ui-panel-body"><p class="room-watch-text">You'll see the match live as soon as everyone's ready.</p><p class="ui-note">Watching: ${esc(d.watchers.join(", ") || "just you")}.</p></div><footer class="ui-panel-foot"><div class="ui-foot-info"></div><div class="ui-actions">${button("Stop watching", { kind: "danger", icon: "stop-watching", attrs: { id: "stop-watching" } })}</div></footer></section>`;
}
