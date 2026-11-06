/**
 * Friends (UI remodel step 6, docs/ui-remodel/PLAN.md): a sheet beside the
 * Lobby, so your fighter and PLAY stay in view. Markup and rules only (no
 * DOM); screens/friends.ts wires it up.
 *
 * Tabs Friends · Requests · Recent. Requests waiting for you sit on top of
 * the Friends tab with Decline / Accept. Online friends come first, each with
 * a status dot and one action (Invite to your party, Join their room, or
 * Watch their match); offline friends say when they were last online, on the
 * server's clock. Your friend code with Copy and Share closes the list.
 * Recent lists the players of your latest matches (a read-only server
 * endpoint). The server owns every list; the sheet only shows them.
 */
import {
  CHARACTERS,
  normalizeCharacterId,
  type CharacterId,
} from "../../../../packages/shared/src/index";
import type {
  Friend,
  FriendList,
  RecentPlayer,
} from "../../../../packages/shared/src/accounts";
import type { RaidLoadout } from "../../../../packages/shared/src/raid";
import { framePortrait, framedAvatar } from "../portraits";
import { serverNow } from "../server-clock";
import {
  button,
  emptyState,
  esc,
  iconButton,
  panelHead,
  tabs,
  type Presence,
} from "../ui/components";

export type FriendsTab = "friends" | "requests" | "recent";
/** A private room you are in: inviting sends its invite instead. */
export interface FriendsRoom {
  code?: string;
  canCreate: boolean;
  canInvite?: boolean;
}
export interface FriendsParty {
  /** People in your Lobby party, you included (1 when alone). */
  size: number;
  ids: readonly string[];
  /** You lead it (or have none): you can invite. */
  leader: boolean;
}
export const PARTY_MAX = 4;
export interface FriendsData {
  list: FriendList | null;
  problem?: string;
  /** null until the Recent tab has loaded. */
  recent: RecentPlayer[] | null;
  recentProblem?: string;
  party: FriendsParty;
  /** Set while you are in a private room (the sheet opens there). */
  room?: FriendsRoom;
}
export interface FriendsView {
  tab: FriendsTab;
  pins: ReadonlySet<string>;
  /** Rows with a request on its way: their buttons wait. */
  busy: ReadonlySet<string>;
  /** Friends invited a moment ago (to this party or room). */
  invited: ReadonlySet<string>;
  /** The row whose options (Pin, Remove) are open. */
  menu: string | null;
  /** The friend whose removal waits for a second tap. */
  removing: string | null;
  /** The add-by-code row is open. */
  adding: boolean;
  /** The last answer ("Friend request sent." or the server's reason). */
  status: string;
}
export const friendsView = (pins: ReadonlySet<string> = new Set()) =>
  ({
    tab: "friends",
    pins,
    busy: new Set<string>(),
    invited: new Set<string>(),
    menu: null,
    removing: null,
    adding: false,
    status: "",
  }) as FriendsView;

/* ------------------------------------------------------------- rules */

function seenDate(value: Friend["lastOnline"]) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
}
/** "Online 2 h ago", measured on the server's clock. */
export function seenAgo(value: Friend["lastOnline"], now = serverNow()) {
  const date = seenDate(value);
  if (!date) return "Offline";
  const age = Math.max(0, now - date.getTime());
  if (age < 60_000) return "Online just now";
  if (age < 3_600_000) return `Online ${Math.floor(age / 60_000)} min ago`;
  if (age < 86_400_000) return `Online ${Math.floor(age / 3_600_000)} h ago`;
  if (age < 2 * 86_400_000) return "Online yesterday";
  if (age < 30 * 86_400_000)
    return `Online ${Math.floor(age / 86_400_000)} d ago`;
  return `Online ${new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    ...(date.getUTCFullYear() !== new Date(now).getUTCFullYear()
      ? { year: "numeric" as const }
      : {}),
  }).format(date)}`;
}
/** What a friend is doing; offline: when they were last online. */
export function friendStatus(f: Friend, now = serverNow()) {
  if (!f.online) return seenAgo(f.lastOnline, now);
  const fighter: CharacterId | undefined = normalizeCharacterId(f.fighter);
  const as = fighter ? ` as ${CHARACTERS[fighter].name}` : "";
  switch (f.activity) {
    case "match":
      return `In a match${as}`;
    case "lobby":
      return f.joinable ? "In a room · open to join" : "In a room";
    case "practice":
      return "Practising";
    case "town":
      return "In the Plaza";
    default:
      return "In the Lobby";
  }
}
/** The status dot's colour. */
export const presenceOf = (f: Pick<Friend, "online" | "activity">): Presence =>
  !f.online
    ? "away"
    : f.activity === "match" || f.activity === "practice"
      ? "busy"
      : f.activity === "town"
        ? "plaza"
        : "online";
export const canJoinFriend = (f: Friend) =>
  !!(f.online && f.room && f.joinable && f.activity !== "match");
export const canWatchFriend = (f: Friend) =>
  !!(f.online && f.room && f.activity === "match");
/** Into the private room you are in. */
export const canInviteFriend = (f: Friend, room?: FriendsRoom) =>
  !!(
    room?.code &&
    room.canInvite &&
    f.online &&
    !f.room &&
    f.activity !== "match" &&
    f.activity !== "practice"
  );
/** Into your Lobby party: you lead it, it has room, they are free. */
export const canInviteToParty = (f: Friend, party: FriendsParty) =>
  !!(
    party.leader &&
    party.size < PARTY_MAX &&
    f.online &&
    !f.room &&
    f.activity !== "match" &&
    f.activity !== "practice" &&
    !party.ids.includes(f.id)
  );
export type FriendAction =
  "invite-room" | "invite" | "join" | "watch" | "party";
/** A friend's one action, the most useful first. */
export function friendAction(f: Friend, d: FriendsData): FriendAction | null {
  if (d.room) return canInviteFriend(f, d.room) ? "invite-room" : null;
  if (d.party.ids.includes(f.id)) return "party";
  if (canJoinFriend(f)) return "join";
  if (canWatchFriend(f)) return "watch";
  if (canInviteToParty(f, d.party)) return "invite";
  return null;
}
/** Online first, then pinned, then by name; offline by who was on last. */
export function sortFriends(
  list: readonly Friend[],
  pins: ReadonlySet<string>,
) {
  const seen = (f: Friend) => seenDate(f.lastOnline)?.getTime() ?? 0;
  return [...list].sort(
    (a, b) =>
      Number(!!b.online) - Number(!!a.online) ||
      Number(pins.has(b.id)) - Number(pins.has(a.id)) ||
      (a.online ? 0 : seen(b) - seen(a)) ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
  );
}
/** "A1B2 C3D4": the code in two groups, easier to read out. */
export const spacedCode = (raw: string) => {
  const code = raw.toUpperCase();
  return code.length === 8 ? `${code.slice(0, 4)} ${code.slice(4)}` : code;
};

/* ------------------------------------------------------------- pieces */

const fighterOf = (id?: string | null) => normalizeCharacterId(id);
/** A portrait in the look and frame the friend wears, with a status dot. */
function portrait(
  p: Pick<
    Friend,
    | "id"
    | "name"
    | "fighter"
    | "frame"
    | "look"
    | "championLooks"
    | "raidClears"
  >,
  status?: Presence,
) {
  const fighter = fighterOf(p.fighter);
  const art = fighter
    ? framedAvatar(
        {
          character: fighter,
          raidLook: (p.look ?? { frame: p.frame }) as RaidLoadout,
          championLooks: p.championLooks,
          raidClears: p.raidClears,
        },
        `fr-${p.id.replace(/[^a-z0-9]/gi, "")}`,
      )
    : framePortrait(
        `<span class="fr-initial">${esc(Array.from(p.name.trim())[0]?.toUpperCase() ?? "?")}</span>`,
        p.look?.frame ?? p.frame,
      );
  return `<span class="fr-avatar"${fighter ? ` style="--el:var(--el-${CHARACTERS[fighter].element})"` : ""} aria-hidden="true">${art}${status ? `<i class="ui-status" style="--st:var(--st-${status})"></i>` : ""}</span>`;
}
function rowShell(o: {
  id: string;
  cls?: string;
  lead: string;
  name: string;
  sub: string;
  subHtml?: string;
  acts: string;
  extra?: string;
}) {
  return `<li class="fr-row${o.cls ? ` ${o.cls}` : ""}" data-friend-row="${esc(o.id)}"><div class="ui-row">${o.lead}<span class="ui-row-main"><b title="${esc(o.name)}">${esc(o.name)}</b><small>${o.subHtml ?? esc(o.sub)}</small></span><span class="ui-row-acts">${o.acts}</span></div>${o.extra ?? ""}</li>`;
}
const waiting = (view: FriendsView, id: string) => view.busy.has(id);

function requestRow(
  r: { id: string; name: string },
  incoming: boolean,
  view: FriendsView,
) {
  const busy = waiting(view, r.id);
  const acts = incoming
    ? button("Decline", {
        size: "s",
        disabled: busy,
        attrs: {
          "data-friend-decline": r.id,
          "aria-label": `Decline ${r.name}`,
        },
      }) +
      button("Accept", {
        size: "s",
        kind: "ok",
        disabled: busy,
        attrs: { "data-friend-accept": r.id, "aria-label": `Accept ${r.name}` },
      })
    : button("Cancel", {
        size: "s",
        disabled: busy,
        attrs: {
          "data-friend-cancel": r.id,
          "aria-label": `Cancel the request to ${r.name}`,
        },
      });
  return rowShell({
    id: r.id,
    cls: incoming ? "is-request" : "is-sent",
    lead: portrait({ id: r.id, name: r.name }),
    name: r.name,
    sub: incoming ? "Wants to be friends" : "Request sent",
    acts,
  });
}

function actionButton(a: FriendAction | null, f: Friend, view: FriendsView) {
  const busy = waiting(view, f.id);
  const invited = view.invited.has(f.id);
  switch (a) {
    case "invite":
    case "invite-room":
      return button(invited ? "Invited" : "Invite", {
        size: "s",
        kind: invited ? "default" : "primary",
        icon: invited ? "check" : "add-friend",
        disabled: busy || invited,
        attrs: {
          [a === "invite" ? "data-friend-invite" : "data-friend-room-invite"]:
            f.id,
          "aria-label": `${invited ? "Invited" : "Invite"} ${f.name} to your ${a === "invite" ? "party" : "room"}`,
        },
      });
    case "join":
      return button("Join", {
        size: "s",
        kind: "primary",
        icon: "enter",
        disabled: busy,
        attrs: {
          "data-friend-join": f.room!,
          "aria-label": `Join ${f.name}'s room`,
        },
      });
    case "watch":
      return button("Watch", {
        size: "s",
        icon: "watch",
        disabled: busy,
        attrs: {
          "data-friend-watch": f.room!,
          "aria-label": `Watch ${f.name}'s match`,
        },
      });
    case "party":
      return `<span class="fr-in-party">In party</span>`;
    default:
      return "";
  }
}

function friendRow(f: Friend, d: FriendsData, view: FriendsView, now: number) {
  const pinned = view.pins.has(f.id);
  const open = view.menu === f.id;
  const removing = view.removing === f.id;
  const busy = waiting(view, f.id);
  const seen = f.online ? null : seenDate(f.lastOnline);
  const status = friendStatus(f, now);
  const subHtml = seen
    ? `<time datetime="${seen.toISOString()}">${esc(status)}</time>`
    : undefined;
  const more = iconButton("more", `Options for ${f.name}`, {
    class: "fr-more",
    "data-friend-menu": f.id,
    "aria-expanded": String(open),
    "aria-controls": `fr-opts-${f.id}`,
  });
  // Always in the markup (hidden when closed), so opening it changes
  // attributes only and focus stays where it was.
  const opts = `<div class="fr-opts" id="fr-opts-${esc(f.id)}" role="group" aria-label="Options for ${esc(f.name)}"${open ? "" : " hidden"}><span class="fr-opts-text">${removing ? `Remove ${esc(f.name)} from your friends?` : pinned ? "Pinned to the top" : "Keep them near the top"}</span>${
    removing
      ? button("Keep", {
          size: "s",
          disabled: busy,
          attrs: { "data-friend-keep": f.id },
        }) +
        button("Remove", {
          size: "s",
          kind: "danger",
          disabled: busy,
          attrs: { "data-friend-remove-ok": f.id },
        })
      : button(pinned ? "Unpin" : "Pin", {
          size: "s",
          icon: "star",
          attrs: { "data-friend-pin": f.id, "aria-pressed": String(pinned) },
        }) +
        button("Remove", {
          size: "s",
          disabled: busy,
          attrs: { "data-friend-remove": f.id },
        })
  }</div>`;
  return rowShell({
    id: f.id,
    cls: `${f.online ? "is-online" : "is-offline"}${pinned ? " is-pinned" : ""}`,
    lead: portrait(f, presenceOf(f)),
    name: f.name,
    sub: status,
    subHtml,
    acts: actionButton(f.online ? friendAction(f, d) : null, f, view) + more,
    extra: opts,
  });
}

function recentRow(p: RecentPlayer, view: FriendsView, now: number) {
  const busy = waiting(view, p.id);
  const ago = seenAgo(p.lastPlayed, now).replace(/^Online /, "");
  const when = ago.charAt(0).toUpperCase() + ago.slice(1);
  const meet =
    p.together === p.matches
      ? `Teammate · ${p.matches} ${p.matches === 1 ? "match" : "matches"}`
      : `You ${p.wins}–${p.losses}`;
  const act =
    p.relation === "friend"
      ? `<span class="fr-in-party">Friend</span>`
      : p.relation === "sent"
        ? `<span class="fr-in-party">Requested</span>`
        : p.relation === "received"
          ? button("Accept", {
              size: "s",
              kind: "ok",
              disabled: busy,
              attrs: {
                "data-friend-accept": p.id,
                "aria-label": `Accept ${p.name}`,
              },
            })
          : button("Add friend", {
              size: "s",
              disabled: busy,
              attrs: {
                "data-friend-add-id": p.id,
                "aria-label": `Send ${p.name} a friend request`,
              },
            });
  const dot: Presence | undefined =
    p.online === undefined ? undefined : p.online ? "online" : "away";
  return rowShell({
    id: p.id,
    cls: "is-recent",
    lead: portrait({ id: p.id, name: p.name, fighter: p.fighter }, dot),
    name: p.name,
    sub: `${when} · ${meet}`,
    acts: act,
  });
}

const kicker = (text: string, n: number, dim = false) =>
  `<li class="fr-kicker${dim ? " is-dim" : ""}"><span class="ui-kicker">${esc(text)} · ${n}</span></li>`;

function friendsTab(d: FriendsData, view: FriendsView, now: number) {
  const list = d.list!;
  const requests = list.incoming.map((r) => requestRow(r, true, view)).join("");
  const sorted = sortFriends(list.friends, view.pins);
  const online = sorted.filter((f) => f.online);
  const offline = sorted.filter((f) => !f.online);
  if (!list.friends.length)
    return `${requests ? `<ul class="fr-list">${requests}</ul>` : ""}${emptyState(
      "No friends yet",
      "Share your code below, or add a friend by theirs with +.",
      button("Add a friend", {
        size: "s",
        icon: "add-friend",
        attrs: { "data-friend-add-open": true },
      }),
    )}`;
  return `<ul class="fr-list">${requests}${online.length ? kicker("Online", online.length) : ""}${online.map((f) => friendRow(f, d, view, now)).join("")}${offline.length ? kicker("Offline", offline.length, true) : ""}${offline.map((f) => friendRow(f, d, view, now)).join("")}</ul>`;
}
function requestsTab(d: FriendsData, view: FriendsView) {
  const list = d.list!;
  if (!list.incoming.length && !list.outgoing.length)
    return emptyState(
      "No requests",
      "Requests to you and from you show up here.",
      button("Add a friend", {
        size: "s",
        icon: "add-friend",
        attrs: { "data-friend-add-open": true },
      }),
    );
  return `<ul class="fr-list">${list.incoming.length ? kicker("For you", list.incoming.length) + list.incoming.map((r) => requestRow(r, true, view)).join("") : ""}${list.outgoing.length ? kicker("Sent", list.outgoing.length, true) + list.outgoing.map((r) => requestRow(r, false, view)).join("") : ""}</ul>`;
}
function recentTab(d: FriendsData, view: FriendsView, now: number) {
  if (d.recent === null)
    return d.recentProblem
      ? emptyState(
          "Recent players aren't available",
          d.recentProblem,
          button("Try again", {
            size: "s",
            attrs: { "data-friend-recent-retry": true },
          }),
        )
      : emptyState("Loading recent players", "One moment…");
  if (!d.recent.length)
    return emptyState(
      "Nobody yet",
      "Players from your matches in the last 30 days show up here.",
    );
  return `<ul class="fr-list">${kicker("Last 30 days", d.recent.length)}${d.recent.map((p) => recentRow(p, view, now)).join("")}</ul>`;
}

/** The add-by-code row (the head's + opens it). */
function addRow(view: FriendsView) {
  return `<form class="fr-add" data-friend-add-form${view.adding ? "" : " hidden"}><label class="fr-add-label" for="fr-add-code">Friend code</label><input id="fr-add-code" name="code" maxlength="9" required placeholder="8 letters or digits" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-describedby="fr-add-hint"><button type="submit" class="ui-btn is-s is-primary"><span>Send</span></button><small id="fr-add-hint" class="ui-note">Ask your friend for the code on their Friends sheet.</small></form>`;
}
function codeRow(code: string) {
  return `<div class="fr-code"><span class="fr-code-text"><small class="ui-note">Your friend code</small><b class="ui-num" data-friend-code="${esc(code)}">${esc(spacedCode(code))}</b></span>${button("Copy", { size: "s", icon: "copy", attrs: { "data-friend-copy": true, "aria-label": "Copy your friend code" } })}${button("Share", { size: "s", icon: "share", attrs: { "data-friend-share": true, "aria-label": "Share your friend code" } })}</div>`;
}

export function friendsMarkup(
  view: FriendsView,
  d: FriendsData,
  now = serverNow(),
) {
  const list = d.list;
  const online = list?.friends.filter((f) => f.online).length ?? 0;
  const top = d.room
    ? `${online} online · in a room`
    : `${online} online · party ${Math.max(1, d.party.size)} / ${PARTY_MAX}`;
  const tools = iconButton("add-friend", "Add a friend by code", {
    class: "fr-add-toggle",
    "data-friend-add-open": true,
    "aria-expanded": String(view.adding),
  });
  const tabBar = tabs(
    [
      {
        id: "friends",
        label: "Friends",
        selected: view.tab === "friends",
        count: list?.friends.length ?? 0,
      },
      { id: "requests", label: "Requests", selected: view.tab === "requests" },
      { id: "recent", label: "Recent", selected: view.tab === "recent" },
    ],
    "Friends",
    "friends-tab",
  ).replace(
    /(data-ui-friends-tab="requests"[^>]*>Requests)/,
    `$1${list?.incoming.length ? `<i class="ui-badge fr-tab-badge" aria-label="${list.incoming.length} waiting">${list.incoming.length > 99 ? "99+" : list.incoming.length}</i>` : ""}`,
  );
  const body = !list
    ? d.problem
      ? emptyState(
          "Friends aren't available",
          d.problem,
          button("Try again", {
            size: "s",
            attrs: { "data-friend-retry": true },
          }),
        )
      : emptyState("Loading your friends", "One moment…")
    : view.tab === "requests"
      ? requestsTab(d, view)
      : view.tab === "recent"
        ? recentTab(d, view, now)
        : friendsTab(d, view, now);
  // Fixed parts (add row, list box, status, code) are always there, so a
  // patch keeps focus and scroll (ui/patch.ts rebuilds on a count change).
  return `<section class="ui-panel ui-sheet friends-sheet" role="dialog" aria-label="Friends">${panelHead("Friends", top, tools)}${tabBar}<div class="ui-panel-body fr-body">${addRow(view)}<div class="fr-scroll" data-friends-list>${body}</div><p class="ui-note fr-status" role="status">${esc(view.status)}</p>${codeRow(list?.code ?? "--------")}</div></section>`;
}
