import { buttonIcon, iconLabel } from "./menu-icons";
import { fighterAvatar } from "./fighter-art";
import { framePortrait } from "./portraits";
import {
  CHARACTERS,
  normalizeCharacterId,
  type CharacterId,
} from "../../../packages/shared/src/index";
import type { Friend, FriendList } from "../../../packages/shared/src/accounts";

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export type FriendsFilter = "all" | "online" | "favorites" | "requests";
export interface FriendsView {
  filter: FriendsFilter;
  query: string;
  favorites: ReadonlySet<string>;
  removing?: string;
  busy?: ReadonlySet<string>;
  room?: FriendsRoom;
  invited?: ReadonlySet<string>;
}
export interface FriendsRoom {
  code?: string;
  canCreate: boolean;
  canInvite?: boolean;
}
const defaults = (): FriendsView => ({
  filter: "all",
  query: "",
  favorites: new Set(),
});

function seenDate(value: Friend["lastOnline"]) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
}
/** Live activity wins over saved history. Unknown history stays "Offline". */
export function friendStatus(f: Friend, now = Date.now()) {
  if (!f.online) {
    const date = seenDate(f.lastOnline);
    if (!date) return "Offline";
    const age = Math.max(0, now - date.getTime());
    const ago =
      age < 60000
        ? "just now"
        : age < 3600000
          ? `${Math.floor(age / 60000)}m ago`
          : age < 86400000
            ? `${Math.floor(age / 3600000)}h ago`
            : age < 30 * 86400000
              ? `${Math.floor(age / 86400000)}d ago`
              : new Intl.DateTimeFormat(undefined, {
                  month: "short",
                  day: "numeric",
                  ...(date.getFullYear() !== new Date(now).getFullYear()
                    ? { year: "numeric" as const }
                    : {}),
                }).format(date);
    return `Last online ${ago}`;
  }
  const fighter: CharacterId | undefined = normalizeCharacterId(f.fighter);
  const as = fighter ? ` as ${CHARACTERS[fighter].name}` : "";
  switch (f.activity) {
    case "match":
      return `In a match${as}`;
    case "lobby":
      return f.joinable ? "In a lobby · room open" : "In a lobby";
    case "practice":
      return "Practising";
    case "town":
      return "In town";
    default:
      return "Online";
  }
}
export const canJoinFriend = (friend: Friend) =>
  !!(
    friend.online &&
    friend.room &&
    friend.joinable &&
    friend.activity !== "match"
  );
export const canWatchFriend = (friend: Friend) =>
  !!(friend.online && friend.room && friend.activity === "match");
export const canInviteFriend = (friend: Friend, room?: FriendsRoom) =>
  !!(
    room?.code &&
    room.canInvite &&
    friend.online &&
    !friend.room &&
    friend.activity !== "match" &&
    friend.activity !== "practice"
  );
const searchMatch = (name: string, query: string) =>
  name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
/** Sort a copy: available friends first, then online friends, then offline. */
export function visibleFriends(list: FriendList, view: FriendsView) {
  return list.friends
    .filter(
      (f) =>
        searchMatch(f.name, view.query) &&
        (view.filter !== "online" || f.online) &&
        (view.filter !== "favorites" || view.favorites.has(f.id)),
    )
    .sort(
      (a, b) =>
        Number(canJoinFriend(b)) - Number(canJoinFriend(a)) ||
        Number(!!b.online) - Number(!!a.online) ||
        Number(view.favorites.has(b.id)) - Number(view.favorites.has(a.id)) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    );
}
export function friendCounts(list: FriendList, favorites: ReadonlySet<string>) {
  return {
    all: list.friends.length,
    online: list.friends.filter((f) => f.online).length,
    favorites: list.friends.filter((f) => favorites.has(f.id)).length,
    incoming: list.incoming.length,
    requests: list.incoming.length + list.outgoing.length,
  };
}
function avatar(friend: Pick<Friend, "id" | "name" | "fighter" | "frame">) {
  const fighter = normalizeCharacterId(friend.fighter);
  const art = fighter
    ? fighterAvatar(fighter, `friend-${friend.id.replace(/[^a-z0-9]/gi, "")}`)
    : `<span>${escape(Array.from(friend.name.trim())[0]?.toUpperCase() ?? "?")}</span>`;
  return `<span class="friend-avatar" aria-hidden="true">${framePortrait(art, friend.frame)}</span>`;
}
function requestCards(
  requests: FriendList["incoming"],
  incoming: boolean,
  view: FriendsView,
) {
  return `<ul class="friend-list friend-requests">${requests
    .map((r) => {
      const disabled = view.busy?.has(r.id) ? ' disabled aria-busy="true"' : "";
      return `<li class="request" data-friend-row="${escape(r.id)}">${avatar(r)}<span class="friend-name"><b title="${escape(r.name)}">${escape(r.name)}</b><small>${incoming ? "Wants to join your crew" : "Friend request sent"}</small></span><span class="friend-actions">${incoming ? `<button type="button" class="primary small" data-accept="${escape(r.id)}" aria-label="Accept ${escape(r.name)}"${disabled}>${iconLabel("check", "Accept")}</button><button type="button" class="quiet small friend-icon-action" data-decline="${escape(r.id)}" aria-label="Decline ${escape(r.name)}" title="Decline"${disabled}>${buttonIcon("cancel")}</button>` : `<button type="button" class="quiet small" data-remove="${escape(r.id)}" data-cancel-request aria-label="Cancel request to ${escape(r.name)}"${disabled}>Cancel</button>`}</span></li>`;
    })
    .join("")}</ul>`;
}
function friendCard(f: Friend, view: FriendsView) {
  const pinned = view.favorites.has(f.id),
    disabled = view.busy?.has(f.id) ? ' disabled aria-busy="true"' : "";
  const status = friendStatus(f),
    presence = f.online ? (f.activity ?? "menu") : "offline";
  const seen = f.online ? null : seenDate(f.lastOnline);
  const statusMarkup = seen
    ? `<time datetime="${seen.toISOString()}" title="${escape(`Last online ${new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" }).format(seen)}`)}">${escape(status)}</time>`
    : escape(status);
  const invite = canInviteFriend(f, view.room)
    ? `<button type="button" class="primary small friend-room-invite" data-friend-invite="${escape(f.id)}" aria-label="Invite ${escape(f.name)} to your room"${view.invited?.has(f.id) ? " disabled" : disabled}>${iconLabel(view.invited?.has(f.id) ? "check" : "add-friend", view.invited?.has(f.id) ? "Invited" : "Invite")}</button>`
    : "";
  return `<li class="friend-card ${f.online ? "online" : ""}${pinned ? " is-pinned" : ""}" data-friend-row="${escape(f.id)}">${avatar(f)}<span class="friend-name"><b title="${escape(f.name)}">${escape(f.name)}</b><span class="friend-presence"><span class="friend-dot ${presence}"></span><small>${statusMarkup}</small></span>${f.title ? `<small class="friend-title" style="color:${/^#[0-9a-f]{3,8}$/i.test(f.titleColor ?? "") ? f.titleColor : "var(--text-dim)"}">${escape(f.title)}</small>` : ""}</span><span class="friend-actions">${invite}${canJoinFriend(f) ? `<button type="button" class="primary small" data-join="${escape(f.room!)}" aria-label="Join ${escape(f.name)}’s room"${disabled}>${iconLabel("enter", "Join")}</button>` : canWatchFriend(f) ? `<button type="button" class="secondary small" data-watch="${escape(f.room!)}" aria-label="Watch ${escape(f.name)}’s match"${disabled}>${iconLabel("watch", "Watch")}</button>` : ""}<button type="button" class="quiet small friend-icon-action friend-pin" data-friend-pin="${escape(f.id)}" aria-pressed="${pinned}" aria-label="${pinned ? "Unpin" : "Pin"} ${escape(f.name)}" title="${pinned ? "Unpin friend" : "Pin friend"}"${disabled}>${buttonIcon("star")}</button><button type="button" class="quiet small friend-icon-action" data-remove="${escape(f.id)}" aria-label="Remove ${escape(f.name)} from friends" title="Remove friend"${disabled}>${buttonIcon("more")}</button></span>${view.removing === f.id ? `<div class="friend-remove-confirm" role="group" aria-label="Remove ${escape(f.name)}"><span>Remove ${escape(f.name)} from your friends?</span><button type="button" class="quiet" data-friend-remove-cancel${disabled}>Keep friend</button><button type="button" class="secondary" data-friend-remove-confirm="${escape(f.id)}"${disabled}>Remove</button></div>` : ""}</li>`;
}
function empty(title: string, text: string, action: string, attr: string) {
  return `<div class="friends-empty">${buttonIcon("friends")}<h3>${title}</h3><p>${text}</p><button type="button" class="secondary" ${attr}>${action}</button></div>`;
}
/** All actions use the existing authenticated friends API and room hooks. */
export function friendsMarkup(
  list: FriendList,
  view: FriendsView = defaults(),
) {
  const incoming = list.incoming.filter((r) => searchMatch(r.name, view.query));
  const outgoing = list.outgoing.filter((r) => searchMatch(r.name, view.query));
  const requests = `${incoming.length ? `<section class="friends-request-section"><h3>Received <span>${incoming.length}</span></h3>${requestCards(incoming, true, view)}</section>` : ""}${outgoing.length ? `<section class="friends-request-section"><h3>Sent <span>${outgoing.length}</span></h3>${requestCards(outgoing, false, view)}</section>` : ""}`;
  if (view.filter === "requests")
    return (
      requests ||
      empty(
        "You're all caught up",
        view.query
          ? "No requests match your search."
          : "New requests will appear here. Share your code to grow your crew.",
        "Add a friend",
        "data-friend-add-toggle",
      )
    );
  const friends = visibleFriends(list, view);
  const preview =
    view.filter === "all" && requests
      ? `<details class="friend-request-peek"><summary>${buttonIcon("add-friend")}<span>${list.incoming.length ? `${list.incoming.length} friend request${list.incoming.length === 1 ? "" : "s"} waiting` : `${list.outgoing.length} sent request${list.outgoing.length === 1 ? "" : "s"}`}</span><span>Review</span></summary>${requests}</details>`
      : "";
  if (!friends.length)
    return (
      preview +
      empty(
        view.query
          ? "No friends found"
          : view.filter === "online"
            ? "Your crew is offline"
            : view.filter === "favorites"
              ? "Keep your crew close"
              : "Better together",
        view.query
          ? "Try another name or clear the search."
          : view.filter === "favorites"
            ? "Pin friends with the star on their card to find them here."
            : "Add friends by code, then join their rooms or watch their matches.",
        view.query
          ? "Clear search"
          : view.filter === "favorites" || view.filter === "online"
            ? "Show all friends"
            : "Add a friend",
        view.query
          ? "data-friend-clear-search"
          : view.filter === "favorites" || view.filter === "online"
            ? 'data-friend-filter="all"'
            : "data-friend-add-toggle",
      )
    );
  const groups = [
    { name: "Ready to join", friends: friends.filter(canJoinFriend) },
    {
      name: "Online",
      friends: friends.filter((f) => f.online && !canJoinFriend(f)),
    },
    { name: "Offline", friends: friends.filter((f) => !f.online) },
  ];
  return (
    preview +
    groups
      .filter((g) => g.friends.length)
      .map(
        (g) =>
          `<section class="friends-group"><h3>${g.name}<span>${g.friends.length}</span></h3><ul class="friend-list">${g.friends.map((f) => friendCard(f, view)).join("")}</ul></section>`,
      )
      .join("")
  );
}
export function friendsScreenMarkup(
  code: string,
  room: FriendsRoom = { canCreate: false },
) {
  return `<div class="friends-screen friends-hub"><h2>${iconLabel("friends", "Your crew")}</h2><div class="friends-hub-tools"><nav class="friends-filters" aria-label="Friends filters">${(
    [
      ["all", "All friends"],
      ["online", "Online"],
      ["favorites", "Pinned"],
      ["requests", "Requests"],
    ] as const
  )
    .map(
      ([id, label]) =>
        `<button type="button" class="quiet${id === "all" ? " is-active" : ""}" data-friend-filter="${id}" aria-pressed="${id === "all"}"><span>${label}</span><b data-friend-count="${id}">0</b></button>`,
    )
    .join(
      "",
    )}</nav><div class="friends-search-row"><label class="friends-search">${buttonIcon("search")}<input id="friend-search" type="search" placeholder="Search your friends" aria-label="Search your friends" autocomplete="off"></label><button type="button" class="quiet friend-icon-action" id="friends-refresh" aria-label="Refresh friends" title="Refresh">${buttonIcon("again")}</button><button type="button" class="secondary" data-friend-add-toggle aria-label="Add friend" aria-expanded="false" aria-controls="friends-add-panel">${iconLabel("add-friend", "Add friend")}</button></div></div><div class="friends-layout"><div class="friends-roster"><div class="friends-roster-heading"><span id="friends-summary" aria-live="polite">Finding your crew…</span><span id="friends-connection" role="status"></span></div><div id="friends-body" tabindex="0" role="region" aria-label="Friends list"><div class="friends-loading" aria-label="Loading friends"><p>Loading your crew…</p></div></div></div><aside class="friends-invite" id="friends-add-panel" aria-label="Add friends"><div class="friends-invite-heading"><span class="eyebrow">BETTER TOGETHER</span><h3>Grow your crew</h3><button type="button" class="quiet friend-icon-action" data-friend-add-close aria-label="Close add friend">${buttonIcon("cancel")}</button></div><div class="friend-code-row"><span>Your friend code</span><button type="button" class="room-code small-code" id="friend-code" aria-label="Copy your friend code"><span class="friend-code-value">${escape(code)}</span>${buttonIcon("copy")}</button></div><button type="button" class="quiet" id="friend-share-code">${iconLabel("share", "Share your code")}</button><form id="friend-add" class="friend-add"><label for="friend-add-code">Add by friend code</label><input id="friend-add-code" name="code" maxlength="8" minlength="8" pattern="[0-9A-Fa-f]{8}" required placeholder="8-character code" aria-describedby="friend-code-hint" autocomplete="off" autocapitalize="characters" spellcheck="false"><small id="friend-code-hint">Ask your friend for their code.</small><div><button type="submit" class="secondary">${iconLabel("add-friend", "Send request")}</button></div></form><p id="friend-message" role="status"></p><div class="friends-teamup"><h3>Make it a party</h3><p>${room.code ? "Your lobby is ready. Share its invite with your crew." : room.canCreate ? "Start a private room for a duel, teams, or a boss raid." : "Join a lobby to share an invite with your crew."}</p><button type="button" class="secondary" id="friend-room-action" ${!room.code && !room.canCreate ? "disabled" : ""}>${iconLabel(room.code ? "share" : "create", room.code ? "Share room invite" : "Create a room")}</button></div></aside></div><div class="friends-mobile-status" role="status" aria-live="polite"></div></div>`;
}
