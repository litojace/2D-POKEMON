import { afterEach, describe, expect, it, vi } from "vitest";
import {
  friendSchema,
  type FriendList,
} from "../../packages/shared/src/accounts";
import {
  canInviteFriend,
  canInviteToParty,
  canJoinFriend,
  canWatchFriend,
  friendAction,
  friendStatus,
  friendsMarkup,
  friendsView,
  seenAgo,
  sortFriends,
  spacedCode,
  type FriendsData,
  type FriendsView,
} from "../../apps/client/src/screens/friends-view";
import {
  readPinnedFriends,
  savePinnedFriends,
} from "../../apps/client/src/screens/friends";

// The Friends sheet (UI remodel step 6). The checks of the old friends
// screen (apps/client/tests/friends*.test.ts) moved here: who gets Join,
// Watch and Invite, the order, requests, escaping, removing in two steps,
// pins, and "online … ago" on the server's clock.
const now = Date.parse("2026-10-25T12:00:00Z");
const list: FriendList = {
  code: "aabbccdd",
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
      lastOnline: "2026-10-25T10:00:00Z",
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
    {
      id: "menu",
      name: "Ada",
      online: true,
      activity: "menu",
      fighter: "lumoth",
    },
  ],
};
const data = (extra: Partial<FriendsData> = {}): FriendsData => ({
  list,
  recent: null,
  party: { size: 1, ids: [], leader: true },
  ...extra,
});
const view = (extra: Partial<FriendsView> = {}): FriendsView => ({
  ...friendsView(),
  ...extra,
});
const markup = (v = view(), d = data()) => friendsMarkup(v, d, now);
afterEach(() => vi.unstubAllGlobals());

describe("one action per friend", () => {
  it("joins open rooms and watches matches only for online friends", () => {
    expect(canJoinFriend(list.friends[0])).toBe(false);
    expect(canWatchFriend(list.friends[0])).toBe(false);
    expect(canJoinFriend(list.friends[1])).toBe(false);
    expect(canWatchFriend(list.friends[1])).toBe(true);
    const html = markup();
    expect(html).toContain('data-friend-join="ROOM02"');
    expect(html).toContain('data-friend-watch="ROOM01"');
    expect(html).not.toContain('data-friend-join="ROOM01"');
    expect(html).not.toContain('data-friend-watch="STALE1"');
  });
  it("invites free online friends to your party while you lead it and it has room", () => {
    const party = { size: 1, ids: [], leader: true };
    const town = list.friends.find((f) => f.id === "town")!;
    expect(canInviteToParty(town, party)).toBe(true);
    expect(canInviteToParty(town, { ...party, leader: false })).toBe(false);
    expect(canInviteToParty(town, { ...party, size: 4 })).toBe(false);
    expect(
      canInviteToParty(town, { size: 2, ids: ["town", "me"], leader: true }),
    ).toBe(false);
    for (const id of ["offline", "match", "lobby"])
      expect(
        canInviteToParty(
          list.friends.find((f) => f.id === id)!,
          party,
        ),
      ).toBe(false);
    expect(friendAction(town, data())).toBe("invite");
    expect(friendAction(list.friends[2], data())).toBe("join");
    expect(friendAction(list.friends[1], data())).toBe("watch");
    expect(
      friendAction(
        town,
        data({ party: { size: 2, ids: ["town", "me"], leader: true } }),
      ),
    ).toBe("party");
    expect(
      markup(
        view(),
        data({ party: { size: 2, ids: ["town", "me"], leader: true } }),
      ),
    ).toContain(">In party<");
  });
  it("in a private room, invites free online friends into it and nothing else", () => {
    const room = { code: "ROOM42", canCreate: false, canInvite: true };
    const town = list.friends.find((f) => f.id === "town")!;
    expect(canInviteFriend(town, room)).toBe(true);
    for (const id of ["offline", "match", "lobby"])
      expect(
        canInviteFriend(
          list.friends.find((f) => f.id === id)!,
          room,
        ),
      ).toBe(false);
    expect(canInviteFriend(town, { ...room, canInvite: false })).toBe(false);
    expect(canInviteFriend(town)).toBe(false);
    const html = markup(view({ invited: new Set(["town"]) }), data({ room }));
    expect(html).toContain('data-friend-room-invite="town"');
    expect(html).toContain("<span>Invited</span>");
    expect(html).not.toContain("data-friend-join=");
    expect(html).not.toContain("data-friend-watch=");
    expect(html).toContain("in a room");
  });
});

describe("the list", () => {
  it("puts online friends first, then pins, then names, without changing the server's list", () => {
    const original = list.friends.map((f) => f.id);
    expect(sortFriends(list.friends, new Set()).map((f) => f.id)).toEqual([
      "menu",
      "town",
      "lobby",
      "match",
      "offline",
    ]);
    expect(
      sortFriends(list.friends, new Set(["match"])).map((f) => f.id),
    ).toEqual(["match", "menu", "town", "lobby", "offline"]);
    expect(list.friends.map((f) => f.id)).toEqual(original);
  });
  it("lists offline friends by who was on last", () => {
    const off = (id: string, h: number) => ({
      id,
      name: id,
      online: false,
      lastOnline: new Date(now - h * 3600e3).toISOString(),
    });
    expect(
      sortFriends([off("a", 30), off("b", 1), off("c", 5)], new Set()).map(
        (f) => f.id,
      ),
    ).toEqual(["b", "c", "a"]);
  });
  it("shows requests on top of the Friends tab and counts them on the Requests tab", () => {
    const html = markup();
    expect(html.indexOf('data-friend-accept="new"')).toBeLessThan(
      html.indexOf("Online · 4"),
    );
    expect(html).toContain('data-friend-decline="new"');
    expect(html).toContain(
      'class="ui-badge fr-tab-badge" aria-label="1 waiting">1<',
    );
    const requests = markup(view({ tab: "requests" }));
    expect(requests).toContain('data-friend-accept="new"');
    expect(requests).toContain('data-friend-cancel="sent"');
    expect(requests).not.toContain("data-friend-join=");
  });
  it("counts online friends and your party in the head, and spaces the code", () => {
    expect(markup()).toContain("4 online · party 1 / 4");
    expect(spacedCode("aabbccdd")).toBe("AABB CCDD");
    expect(markup()).toContain(">AABB CCDD<");
  });
  it("escapes names and ids", () => {
    const html = markup(
      view(),
      data({
        list: {
          ...list,
          friends: [
            {
              id: 'bad" onfocus="bad',
              name: "<script>bad</script>",
              online: false,
            },
          ],
        },
      }),
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("bad&quot; onfocus=&quot;bad");
  });
  it("removes a friend in two steps and makes rows wait while a request is on its way", () => {
    expect(markup(view({ menu: "lobby" }))).toContain(
      'data-friend-remove="lobby"',
    );
    expect(markup(view({ menu: "lobby" }))).not.toContain(
      "data-friend-remove-ok",
    );
    const html = markup(
      view({ menu: "lobby", removing: "lobby", busy: new Set(["new"]) }),
    );
    expect(html).toContain('data-friend-remove-ok="lobby"');
    expect(html).toContain("Remove Kai from your friends?");
    expect(html).toMatch(/disabled data-friend-accept="new"/);
    // Options are always in the markup (hidden when closed): focus stays put.
    expect(markup()).toContain(
      'id="fr-opts-lobby" role="group" aria-label="Options for Kai" hidden',
    );
  });
  it("offers real actions when there is nothing to show", () => {
    expect(markup(view(), data({ list: { ...list, friends: [] } }))).toContain(
      "No friends yet",
    );
    expect(
      markup(
        view({ tab: "requests" }),
        data({ list: { ...list, incoming: [], outgoing: [] } }),
      ),
    ).toContain("data-friend-add-open");
    expect(markup(view(), data({ list: null, problem: "Offline." }))).toContain(
      "data-friend-retry",
    );
    expect(markup(view(), data({ list: null }))).toContain(
      "Loading your friends",
    );
  });
  it("keeps the sheet's fixed parts whatever the tab (patching keeps focus and scroll)", () => {
    for (const tab of ["friends", "requests", "recent"] as const) {
      const html = markup(view({ tab }));
      for (const part of [
        "data-friend-add-form",
        "data-friends-list",
        "fr-status",
        "fr-code",
      ])
        expect(html).toContain(part);
    }
  });
});

describe("recent players", () => {
  const recent = [
    {
      id: "a",
      name: "Kai",
      fighter: "cindrake",
      lastPlayed: new Date(now - 2 * 3600e3).toISOString(),
      matches: 3,
      together: 0,
      wins: 2,
      losses: 1,
      relation: "friend" as const,
      online: true,
    },
    {
      id: "b",
      name: "Wren",
      fighter: null,
      lastPlayed: new Date(now - 30 * 3600e3).toISOString(),
      matches: 1,
      together: 1,
      wins: 0,
      losses: 0,
      relation: "none" as const,
    },
    {
      id: "c",
      name: "Oz",
      fighter: "voltkit",
      lastPlayed: new Date(now - 60e3).toISOString(),
      matches: 1,
      together: 0,
      wins: 0,
      losses: 1,
      relation: "received" as const,
    },
    {
      id: "d",
      name: "Lu",
      fighter: "voltkit",
      lastPlayed: new Date(now - 60e3).toISOString(),
      matches: 1,
      together: 0,
      wins: 1,
      losses: 0,
      relation: "sent" as const,
    },
  ];
  it("says when you played, your record or that you were teammates, and what you can do", () => {
    const html = markup(view({ tab: "recent" }), data({ recent }));
    expect(html).toContain("2 h ago · You 2–1");
    expect(html).toContain("Yesterday · Teammate · 1 match");
    expect(html).toContain(">Friend<");
    expect(html).toContain('data-friend-add-id="b"');
    expect(html).toContain('data-friend-accept="c"');
    expect(html).toContain(">Requested<");
  });
  it("loads, fails with a retry, or says nobody", () => {
    expect(markup(view({ tab: "recent" }))).toContain("Loading recent players");
    expect(
      markup(view({ tab: "recent" }), data({ recentProblem: "No." })),
    ).toContain("data-friend-recent-retry");
    expect(markup(view({ tab: "recent" }), data({ recent: [] }))).toContain(
      "Nobody yet",
    );
  });
  it("offers Block on every recent player and on a friend's options", () => {
    const html = markup(view({ tab: "recent" }), data({ recent }));
    for (const id of ["a", "b", "c", "d"])
      expect(html).toContain(`data-friend-block="${id}"`);
    expect(html).toContain('data-friend-name="Wren"');
    const friends = markup(view({ menu: "town" }));
    expect(friends).toContain('data-friend-block="town"');
  });
  it("lists blocked players under Recent with Unblock, and not among the recent", () => {
    const html = markup(
      view({ tab: "recent" }),
      data({ recent, blocked: [{ id: "b", name: "Wren" }] }),
    );
    expect(html).toContain("Blocked · 1");
    expect(html).toContain('data-friend-unblock="b"');
    expect(html).not.toContain('data-friend-add-id="b"');
    expect(html).toContain("Last 30 days · 3");
    // Blocked players show even when nobody else is recent.
    const only = markup(
      view({ tab: "recent" }),
      data({ recent: [], blocked: [{ id: "z", name: "Zed" }] }),
    );
    expect(only).toContain('data-friend-unblock="z"');
  });
});

describe("online … ago, on the server's clock", () => {
  const friend = { id: "pal", name: "Pal", online: false };
  it("counts minutes, hours, yesterday and days", () => {
    for (const [age, label] of [
      [0, "Online just now"],
      [59_999, "Online just now"],
      [60_000, "Online 1 min ago"],
      [3_599_999, "Online 59 min ago"],
      [3_600_000, "Online 1 h ago"],
      [86_400_000, "Online yesterday"],
      [3 * 86_400_000, "Online 3 d ago"],
    ] as const)
      expect(
        friendStatus(
          { ...friend, lastOnline: new Date(now - age).toISOString() },
          now,
        ),
      ).toBe(label);
  });
  it("uses a date for older history, and handles clock skew and missing history", () => {
    expect(seenAgo("2025-08-01T12:00:00Z", now)).toMatch(
      /^Online Aug 1, 2025$/,
    );
    expect(seenAgo(new Date(now + 60_000).toISOString(), now)).toBe(
      "Online just now",
    );
    for (const lastOnline of [undefined, null, "invalid"])
      expect(friendStatus({ ...friend, lastOnline }, now)).toBe("Offline");
  });
  it("prefers what a friend is doing now", () => {
    expect(
      friendStatus(
        {
          ...friend,
          online: true,
          activity: "town",
          lastOnline: "2020-01-01T00:00:00Z",
        },
        now,
      ),
    ).toBe("In the Plaza");
    expect(
      friendStatus(
        { ...friend, online: true, activity: "match", fighter: "tidefin" },
        now,
      ),
    ).toBe("In a match as Tidefin");
    expect(
      friendStatus(
        { ...friend, online: true, activity: "match", fighter: "unknown" },
        now,
      ),
    ).toBe("In a match");
    expect(
      friendStatus({ ...friend, online: true, activity: "menu" }, now),
    ).toBe("In the Lobby");
  });
  it("puts the exact time on a time element, for offline friends only", () => {
    const one = (online: boolean) =>
      markup(
        view(),
        data({
          list: {
            ...list,
            friends: [
              { ...friend, online, lastOnline: "2026-10-25T11:55:00Z" },
            ],
          },
        }),
      );
    expect(one(false)).toContain(
      '<time datetime="2026-10-25T11:55:00.000Z">Online 5 min ago</time>',
    );
    expect(one(true)).not.toContain("<time");
  });
  it("accepts missing history from older servers and timezone offsets", () => {
    for (const lastOnline of [undefined, null, "2026-10-25T10:15:00+02:00"])
      expect(friendSchema.parse({ ...friend, lastOnline }).lastOnline).toBe(
        lastOnline,
      );
    expect(
      friendSchema.safeParse({ ...friend, lastOnline: "not a date" }).success,
    ).toBe(false);
  });
});

describe("pins", () => {
  it("are kept per account and survive corrupt or unavailable storage", () => {
    const entries = new Map([
      [
        "arena-friend-pins:one",
        JSON.stringify(["lobby", 12, "match", "lobby"]),
      ],
      ["arena-friend-pins:bad", "invalid"],
    ]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => entries.set(key, value),
    });
    expect([...readPinnedFriends("one")]).toEqual(["lobby", "match"]);
    expect(readPinnedFriends("two").size).toBe(0);
    expect(readPinnedFriends("bad").size).toBe(0);
    expect(savePinnedFriends("two", new Set(["x"]))).toBe(true);
    expect([...readPinnedFriends("two")]).toEqual(["x"]);
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("Denied");
      },
      setItem: () => {
        throw new Error("Denied");
      },
    });
    expect(readPinnedFriends("one").size).toBe(0);
    expect(savePinnedFriends("one", new Set(["x"]))).toBe(false);
  });
});
