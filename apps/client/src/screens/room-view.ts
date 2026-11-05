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
 * the clicks (data-room-*, data-team, data-mutator).
 */
import { CHARACTERS, type CharacterId } from "@arena/shared";
import {
  RAID_BOSSES,
  type RaidBossId,
} from "../../../../packages/shared/src/raid";
import { raidPortraitImage } from "../raid-splash-art";
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
}
export interface RoomRule {
  id: string;
  name: string;
  text: string;
  on: boolean;
}
export interface RoomData {
  mode: RoomMode;
  /** Watching someone else's room: no picker, no Ready. */
  watch: boolean;
  code: string;
  boss?: RaidBossId;
  /** Round wins needed (PvP). */
  rounds: number;
  seats: RoomSeat[];
  /** You host the room (party rules, Shuffle). */
  host: boolean;
  rules: RoomRule[];
  /** This week's arcade: its rules are fixed. */
  arcade?: { name: string; text: string };
  /** The 2v2 team-up line (markup built by main.ts), or "". */
  teamUp: string;
  watchers: string[];
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
  return d.mode === "raid" && d.boss
    ? `Raid room · ${RAID_BOSSES[d.boss].name}`
    : `Private ${MODE_NAMES[d.mode]} · ${firstTo(d.rounds)}`;
}
export const readyCount = (d: RoomData) =>
  d.seats.filter((s) => s.ready).length;

/* ------------------------------------------------------------ pieces */

function seat(s: RoomSeat) {
  const state = !s.connected
    ? tag("Offline")
    : s.ready
      ? `<span class="ui-tag is-ok">${menuIcon("check")}Ready</span>`
      : tag("Choosing");
  const sub = [
    CHARACTERS[s.character].name,
    s.host ? "Host" : "",
    s.flair ?? "",
  ]
    .filter(Boolean)
    .join(" · ");
  return `<div class="room-seat${s.me ? " is-me" : ""}${s.connected ? "" : " is-away"}" data-room-seat="${esc(s.id)}"${s.me ? " data-me" : ""}><span class="room-avatar player-avatar" title="${esc(CHARACTERS[s.character].name)}">${s.avatar}</span><span class="room-seat-text"><b>${esc(s.name)}${s.me ? ' <small class="ui-note">(you)</small>' : ""}</b><small class="ui-note room-seat-fighter">${esc(sub)}</small></span>${state}</div>`;
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
  return `<div class="room-banner is-mode is-${d.mode}"><span class="room-banner-text"><span class="ui-kicker">${d.arcade ? `${esc(d.arcade.name)} · ` : "Private room · "}${firstTo(d.rounds)}</span><b class="room-banner-name">${MODE_NAMES[d.mode]}</b><small class="ui-note room-banner-line">${line}</small></span></div>`;
}
function head(title: string, note: string, extra = "") {
  return `<div class="room-head"><h3 class="ui-h">${esc(title)}</h3>${extra || `<small class="ui-note">${esc(note)}</small>`}</div>`;
}
function rules(d: RoomData) {
  if (d.mode === "raid") return "";
  if (d.arcade)
    return `<p class="ui-note room-arcade"><b>${esc(d.arcade.name)}</b> · ${esc(d.arcade.text)} Weekly rules are fixed. PvP rating stays separate.</p>`;
  const on = d.rules.filter((r) => r.on);
  if (!d.host && !on.length) return "";
  const body = d.host
    ? `<div class="ui-chips room-rule-chips" role="group" aria-label="Party rules">${d.rules
        .map(
          (r) =>
            `<button type="button" class="ui-chip" aria-pressed="${r.on}" data-mutator="${esc(r.id)}" title="${esc(r.text)}">${esc(r.name)}</button>`,
        )
        .join(
          "",
        )}</div><small class="ui-note">Only you (the host) can change these. Everyone readies up again after a change.</small>`
    : `<ul class="room-rule-list">${on.map((r) => `<li><b>${esc(r.name)}</b> · ${esc(r.text)}</li>`).join("")}</ul>`;
  return `<details class="room-rules"${on.length ? " open" : ""}><summary>${menuIcon("settings")}<span>Party rules${on.length ? ` · ${on.length} on` : d.host ? " · optional" : ""}</span></summary>${body}</details>`;
}
function notes(d: RoomData) {
  const lines =
    d.mode === "raid"
      ? [
          d.seats.length === 1
            ? "One solo self-revive"
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
  const title = d.mode === "raid" ? "Raid party" : "Players";
  return `${head(title, `${readyCount(d)}/${d.seats.length} ready · ${room}`)}<div class="room-seat-list">${d.seats.map(seat).join("")}${open}</div>`;
}

/** The seats column (the picker or the watch panel sits beside it). */
export function roomSeatsMarkup(d: RoomData) {
  return `<section class="room-seats" aria-label="${esc(MODE_NAMES[d.mode])} room" data-room-mode="${d.mode}">${banner(d)}<div class="room-seats-body">${seats(d)}${d.teamUp}${rules(d)}</div>${notes(d)}</section>`;
}

/** Watching a room: the panel beside the seats (no picker, no Ready). */
export function roomWatchMarkup(d: RoomData) {
  return `<section class="ui-panel room-watch" role="region" aria-label="Watching room ${esc(d.code)}"><header class="ui-panel-head"><div class="ui-heading"><span class="ui-kicker">Watching room ${esc(d.code)}</span><h2 class="ui-title">Ringside seat</h2></div></header><div class="ui-panel-body"><p class="room-watch-text">You'll see the match live as soon as everyone's ready.</p><p class="ui-note">Watching: ${esc(d.watchers.join(", ") || "just you")}.</p></div><footer class="ui-panel-foot"><div class="ui-foot-info"></div><div class="ui-actions">${button("Stop watching", { icon: "stop-watching", attrs: { id: "stop-watching" } })}</div></footer></section>`;
}
