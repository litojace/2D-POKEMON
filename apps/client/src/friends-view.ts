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

/** "In a match as Voltkit", "In a lobby", "Online", "Offline". */
export function friendStatus(f: Friend) {
  if (!f.online) return "Offline";
  const fighter: CharacterId | undefined = normalizeCharacterId(f.fighter);
  const as = fighter ? ` as ${CHARACTERS[fighter].name}` : "";
  switch (f.activity) {
    case "match":
      return `In a match${as}`;
    case "lobby":
      return f.joinable ? "In a lobby · room open" : "In a lobby";
    case "practice":
      return "Practising";
    default:
      return "Online";
  }
}

/** The friends list: requests first, then friends (online first). */
export function friendsMarkup(list: FriendList) {
  const incoming = list.incoming.length
    ? `<h3>Friend requests</h3><ul class="friend-list">${list.incoming
        .map(
          (r) =>
            `<li class="request"><span class="friend-dot"></span><b>${escape(r.name)}</b><span class="friend-actions"><button class="primary small" data-accept="${r.id}">Accept</button><button class="quiet small" data-decline="${r.id}">Decline</button></span></li>`,
        )
        .join("")}</ul>`
    : "";
  const friends = list.friends.length
    ? `<ul class="friend-list">${list.friends
        .map(
          (f) =>
            `<li class="${f.online ? "online" : ""}"><span class="friend-dot ${f.online ? (f.activity ?? "menu") : ""}"></span><span class="friend-name"><b>${escape(f.name)}</b>${f.title ? `<small style="color:${escape(f.titleColor ?? "#d5f778")}">${escape(f.title)}</small>` : ""}<small>${escape(friendStatus(f))}</small></span><span class="friend-actions">${f.room && f.joinable ? `<button class="primary small" data-join="${escape(f.room)}">Join</button>` : ""}${f.room && f.activity === "match" ? `<button class="secondary small" data-watch="${escape(f.room)}">Watch</button>` : ""}<button class="quiet small" data-remove="${f.id}" title="Remove friend" aria-label="Remove ${escape(f.name)}">×</button></span></li>`,
        )
        .join("")}</ul>`
    : '<p class="muted">No friends yet. Share your friend code, or add someone from a match result.</p>';
  const outgoing = list.outgoing.length
    ? `<p class="muted">Waiting for: ${list.outgoing
        .map(
          (r) =>
            `${escape(r.name)} <button class="quiet small" data-remove="${r.id}" aria-label="Cancel request to ${escape(r.name)}">cancel</button>`,
        )
        .join(" · ")}</p>`
    : "";
  return `${incoming}<h3>Friends</h3>${friends}${outgoing}`;
}
