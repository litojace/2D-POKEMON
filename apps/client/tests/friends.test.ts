import { afterEach, describe, expect, it, vi } from "vitest";
import type { FriendList } from "../../../packages/shared/src/accounts";
import {
  canJoinFriend,
  canWatchFriend,
  friendCounts,
  friendsMarkup,
  friendsScreenMarkup,
  friendStatus,
  visibleFriends,
  type FriendsView,
} from "../src/friends-view";
import { readPinnedFriends } from "../src/friends-hub";
const list: FriendList = {
  code: "AABBCCDD",
  incoming: [{ id: "new", name: "New teammate" }],
  outgoing: [{ id: "sent", name: "Pending player" }],
  friends: [
    {
      id: "offline",
      name: "Offline friend",
      online: false,
      activity: "match",
      room: "STALE1",
      joinable: true,
    },
    {
      id: "match",
      name: "Mina",
      online: true,
      activity: "match",
      room: "ROOM01",
      fighter: "tidefin",
      joinable: true,
    },
    {
      id: "lobby",
      name: "Kai",
      online: true,
      activity: "lobby",
      room: "ROOM02",
      joinable: true,
      fighter: "voltkit",
    },
    {
      id: "town",
      name: "Éli",
      online: true,
      activity: "town",
      fighter: "cindrake",
    },
  ],
};
const view = (extra: Partial<FriendsView> = {}): FriendsView => ({
  filter: "all",
  query: "",
  favorites: new Set(),
  ...extra,
});
afterEach(() => vi.unstubAllGlobals());
describe("friends hub", () => {
  it("shows actual room actions only for online, eligible friends", () => {
    expect(canJoinFriend(list.friends[0])).toBe(false);
    expect(canWatchFriend(list.friends[0])).toBe(false);
    expect(canJoinFriend(list.friends[1])).toBe(false);
    expect(canWatchFriend(list.friends[1])).toBe(true);
    const html = friendsMarkup(list);
    expect(html).toContain('data-join="ROOM02"');
    expect(html).toContain('data-watch="ROOM01"');
    expect(html).not.toContain('data-join="ROOM01"');
    expect(html).not.toContain('data-watch="STALE1"');
  });
  it("prioritizes open rooms and online friends without mutating server data", () => {
    const original = list.friends.map((f) => f.id);
    expect(visibleFriends(list, view()).map((f) => f.id)).toEqual([
      "lobby",
      "town",
      "match",
      "offline",
    ]);
    expect(list.friends.map((f) => f.id)).toEqual(original);
  });
  it("filters online and pinned friends and searches trimmed, case-insensitive names", () => {
    expect(visibleFriends(list, view({ filter: "online" }))).toHaveLength(3);
    expect(
      visibleFriends(
        list,
        view({ filter: "favorites", favorites: new Set(["offline", "lobby"]) }),
      ).map((f) => f.id),
    ).toEqual(["lobby", "offline"]);
    expect(
      visibleFriends(list, view({ query: "  ÉLI " })).map((f) => f.id),
    ).toEqual(["town"]);
    expect(visibleFriends(list, view({ query: "unknown" }))).toEqual([]);
  });
  it("keeps requests separate from online counts and ignores stale pins", () => {
    expect(friendCounts(list, new Set(["lobby", "removed"]))).toEqual({
      all: 4,
      online: 3,
      favorites: 1,
      incoming: 1,
      requests: 2,
    });
    const html = friendsMarkup(list, view({ filter: "requests" }));
    expect(html).toContain('data-accept="new"');
    expect(html).toContain('data-decline="new"');
    expect(html).toContain('data-remove="sent"');
    expect(html).not.toContain("data-join=");
  });
  it("escapes names, attribute values and unsafe title colours", () => {
    const html = friendsMarkup({
      ...list,
      friends: [
        {
          id: 'bad" onfocus="bad',
          name: "<script>bad</script>",
          title: '<img onerror="bad">',
          titleColor: "red;background:url(bad)",
          online: false,
        },
      ],
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img onerror");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain('style="color:red');
    expect(html).toContain("bad&quot; onfocus=&quot;bad");
  });
  it("requires a separate confirmation to remove a friend and marks in-flight requests busy", () => {
    expect(friendsMarkup(list, view())).not.toContain(
      "data-friend-remove-confirm",
    );
    const html = friendsMarkup(
      list,
      view({ removing: "lobby", busy: new Set(["new"]) }),
    );
    expect(html).toContain('data-friend-remove-confirm="lobby"');
    expect(html).toContain("Keep friend");
    expect(html).toContain(
      'data-accept="new" aria-label="Accept New teammate" disabled aria-busy="true"',
    );
  });
  it("offers real empty-state actions and distinguishes activity without a fighter", () => {
    expect(
      friendsMarkup({ ...list, friends: [] }, view({ filter: "favorites" })),
    ).toContain('data-friend-filter="all"');
    expect(friendsMarkup(list, view({ query: "missing" }))).toContain(
      "data-friend-clear-search",
    );
    expect(
      friendStatus({ id: "x", name: "X", online: true, activity: "town" }),
    ).toBe("In town");
    expect(
      friendStatus({
        id: "x",
        name: "X",
        online: true,
        activity: "match",
        fighter: "unknown",
      }),
    ).toBe("In a match");
  });
  it("preserves existing screen IDs and room availability when adding new controls", () => {
    const html = friendsScreenMarkup("AABBCCDD", { canCreate: true });
    for (const id of [
      "friend-code",
      "friend-add",
      "friend-message",
      "friends-body",
    ])
      expect(html).toContain(`id="${id}"`);
    expect(html).toContain("Create a room");
    expect(
      friendsScreenMarkup("AABBCCDD", { code: "ROOM01", canCreate: false }),
    ).toContain("Share room invite");
    expect(friendsScreenMarkup("AABBCCDD", { canCreate: false })).toContain(
      'id="friend-room-action" disabled',
    );
  });
  it("isolates pinned friends by account and tolerates corrupt or unavailable storage", () => {
    const entries = new Map([
      [
        "arena-friend-pins:one",
        JSON.stringify(["lobby", 12, "match", "lobby"]),
      ],
      ["arena-friend-pins:bad", "invalid"],
    ]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => entries.get(key) ?? null,
    });
    expect([...readPinnedFriends("one")]).toEqual(["lobby", "match"]);
    expect(readPinnedFriends("two").size).toBe(0);
    expect(readPinnedFriends("bad").size).toBe(0);
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("Denied");
      },
    });
    expect(readPinnedFriends("one").size).toBe(0);
  });
});
