import { afterEach, expect, it, vi } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";
import {
  partyStateSchema,
  roomInviteSchema,
  type PartyState,
  type RoomInvite,
} from "../../packages/shared/src/accounts";
import type { Reply } from "../../packages/shared/src/index";
import { Parties, PARTY_SIZE } from "../../apps/server/src/party";

// Hub redesign phase 2b: parties before a room. Friends gather on the Lobby,
// the leader's PLAY opens a room and the others follow it in.
let server: ReturnType<typeof createArenaServer> | undefined;
const sockets: Socket[] = [];
afterEach(async () => {
  sockets.splice(0).forEach((s) => s.disconnect());
  await server?.close();
  server = undefined;
});
const request = (s: Socket, event: string, data: unknown = {}) =>
  new Promise<Reply>((resolve) => s.emit(event, data, resolve));
const settle = () => new Promise((r) => setTimeout(r, 20));

async function setup(options: { partyAwayMs?: number } = {}) {
  const accounts = fakeAccounts(),
    lead = accounts.add(false),
    pal = accounts.add(false),
    third = accounts.add(false),
    stranger = accounts.add(false);
  // Everyone is friends with the leader; the stranger is nobody's friend.
  accounts.provider.rpc = async (token, name) => {
    if (name !== "arena_friends") return {};
    const friendsOfLead = [pal, third].map((p) => ({
      id: p.account.id,
      name: p.account.displayName,
    }));
    return {
      code: "ABCDEF12",
      friends:
        token === lead.token
          ? friendsOfLead
          : [{ id: lead.account.id, name: lead.account.displayName }],
      incoming: [],
      outgoing: [],
    };
  };
  server = createArenaServer({
    accounts: accounts.provider,
    autoTick: false,
    partyAwayMs: options.partyAwayMs ?? 60,
  });
  await new Promise<void>((r) => server!.http.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.http.address() as { port: number }).port}`;
  const connect = async (token: string) => {
    const s = io(url, {
      auth: { accessToken: token },
      transports: ["websocket"],
      reconnection: false,
    });
    sockets.push(s);
    // Listening before the connection opens, as the game does: the party
    // comes straight away to a returning member.
    const parties: PartyState[] = [],
      invites: RoomInvite[] = [],
      follows: unknown[] = [],
      declined: unknown[] = [];
    s.on("party", (d) => parties.push(partyStateSchema.parse(d)));
    s.on("room-invite", (d) => invites.push(roomInviteSchema.parse(d)));
    s.on("party-room", (d) => follows.push(d));
    s.on("invite-declined", (d) => declined.push(d));
    await new Promise<void>((r, reject) => {
      s.once("connect", r);
      s.once("connect_error", reject);
    });
    return { s, parties, invites, follows, declined };
  };
  return {
    accounts,
    connect,
    lead,
    pal,
    third,
    stranger,
    a: await connect(lead.token),
    b: await connect(pal.token),
    c: await connect(third.token),
    x: await connect(stranger.token),
  };
}

it("forms a party from a friend's invitation and shows everyone's fighter", async () => {
  const f = await setup();
  const sent = await request(f.a.s, "party-invite", {
    playerId: f.pal.account.id,
    character: "voltkit",
  });
  expect(sent.ok).toBe(true);
  await settle();
  const invite = f.b.invites.at(-1)!;
  expect(invite).toMatchObject({ mode: "party", fromId: f.lead.account.id });
  // The leader's party exists with just them until the friend accepts.
  expect(f.a.parties.at(-1)?.members.map((m) => m.id)).toEqual([
    f.lead.account.id,
  ]);
  expect(
    (
      await request(f.b.s, "party-accept", {
        code: invite.code,
        character: "tidefin",
      })
    ).ok,
  ).toBe(true);
  await settle();
  for (const who of [f.a, f.b]) {
    const party = who.parties.at(-1)!;
    expect(party.leader).toBe(f.lead.account.id);
    expect(party.members.map((m) => [m.id, m.character])).toEqual([
      [f.lead.account.id, "voltkit"],
      [f.pal.account.id, "tidefin"],
    ]);
  }
  // Changing fighter on the Lobby shows on the friend's stage.
  f.b.s.emit("party-character", { character: "lumoth" });
  await settle();
  expect(
    f.a.parties.at(-1)!.members.find((m) => m.id === f.pal.account.id)
      ?.character,
  ).toBe("lumoth");
  // Strangers get nothing.
  expect(f.x.invites).toEqual([]);
  expect(f.x.parties).toEqual([]);
});

it("shows each member in the skin and look saved on their own account", async () => {
  const f = await setup();
  // What each account has saved: Shop skins by champion, and a raid look.
  const saved = new Map<string, { looks: unknown; progress: unknown }>([
    [
      f.lead.token,
      {
        looks: { voltkit: { skin: "voltkit-storm", stage: 2 } },
        progress: { loadout: { aura: "mountain-aura", frame: "ember-frame" } },
      },
    ],
    [
      f.pal.token,
      { looks: { lumoth: { skin: "lumoth-moon", stage: 1 } }, progress: {} },
    ],
  ]);
  const friends = f.accounts.provider.rpc;
  const reads: string[] = [];
  f.accounts.provider.rpc = async (token, name, args) => {
    if (name === "arena_my_looks" || name === "arena_raid_progress") {
      reads.push(`${name}:${token === f.lead.token ? "lead" : "pal"}`);
      const own = saved.get(token);
      return name === "arena_my_looks" ? own?.looks : own?.progress;
    }
    return friends(token, name, args);
  };
  // A look in the request is refused: only the account's own save counts.
  expect(
    (
      await request(f.a.s, "party-invite", {
        playerId: f.pal.account.id,
        character: "voltkit",
        skin: { skin: "forged", stage: 3 },
      })
    ).ok,
  ).toBe(false);
  await request(f.a.s, "party-invite", {
    playerId: f.pal.account.id,
    character: "voltkit",
  });
  await settle();
  await request(f.b.s, "party-accept", {
    code: f.b.invites.at(-1)!.code,
    character: "tidefin",
  });
  await settle();
  const member = (who: typeof f.a, id: string) =>
    who.parties.at(-1)!.members.find((m) => m.id === id);
  expect(member(f.b, f.lead.account.id)).toMatchObject({
    character: "voltkit",
    skin: { skin: "voltkit-storm", stage: 2 },
    look: { aura: "mountain-aura", frame: "ember-frame" },
  });
  // No skin saved on that champion: the original look.
  expect(member(f.a, f.pal.account.id)).toMatchObject({
    character: "tidefin",
    skin: null,
    look: {},
  });
  // Switching champion shows the skin saved on the new one.
  f.b.s.emit("party-character", { character: "lumoth" });
  await settle();
  expect(member(f.a, f.pal.account.id)?.skin).toEqual({
    skin: "lumoth-moon",
    stage: 1,
  });
  // After a new save, a ping reads it again from the account.
  saved.get(f.lead.token)!.looks = {
    voltkit: { skin: "voltkit-sun", stage: 1 },
  };
  f.a.s.emit("party-look", { skin: "ignored" });
  await settle();
  expect(member(f.b, f.lead.account.id)?.skin).toEqual({
    skin: "voltkit-sun",
    stage: 1,
  });
  // Someone outside a party reads nothing.
  const before = reads.length;
  f.x.s.emit("party-look", {});
  await settle();
  expect(reads.length).toBe(before);
});

it("refuses strangers, forged codes, unknown fighters and players already in a room", async () => {
  const f = await setup();
  expect(
    (
      await request(f.a.s, "party-invite", {
        playerId: f.stranger.account.id,
        character: "voltkit",
      })
    ).ok,
  ).toBe(false);
  expect(
    (
      await request(f.a.s, "party-invite", {
        playerId: f.pal.account.id,
        character: "missingno",
      })
    ).ok,
  ).toBe(false);
  expect(
    (
      await request(f.x.s, "party-accept", {
        code: "ZZZZZZ",
        character: "voltkit",
      })
    ).ok,
  ).toBe(false);
  // A friend who is in a room can't be invited.
  expect(
    (await request(f.b.s, "create", { name: "Pal", mode: "duel" })).ok,
  ).toBe(true);
  const busy = await request(f.a.s, "party-invite", {
    playerId: f.pal.account.id,
    character: "voltkit",
  });
  expect(busy).toMatchObject({
    ok: false,
    error: "Your friend is already in a room.",
  });
  // A stolen invitation code does not let someone else in.
  expect(
    (
      await request(f.a.s, "party-invite", {
        playerId: f.third.account.id,
        character: "voltkit",
      })
    ).ok,
  ).toBe(true);
  await settle();
  const code = f.c.invites.at(-1)!.code;
  expect(
    (await request(f.x.s, "party-accept", { code, character: "voltkit" })).ok,
  ).toBe(false);
  // The same invitation can't be repeated straight away.
  const again = await request(f.a.s, "party-invite", {
    playerId: f.third.account.id,
    character: "voltkit",
  });
  expect(again.ok).toBe(false);
});

it("sends the party into the leader's room, and only the leader can do that", async () => {
  const f = await setup();
  await request(f.a.s, "party-invite", {
    playerId: f.pal.account.id,
    character: "voltkit",
  });
  await settle();
  await request(f.b.s, "party-accept", {
    code: f.b.invites.at(-1)!.code,
    character: "tidefin",
  });
  await settle();
  expect((await request(f.b.s, "party-room")).ok).toBe(false);
  expect((await request(f.a.s, "party-room")).ok).toBe(false); // no room yet
  const room = await request(f.a.s, "create", { name: "Lead", mode: "teams" });
  expect(room.ok).toBe(true);
  expect((await request(f.a.s, "party-room")).ok).toBe(true);
  await settle();
  expect(f.b.follows.at(-1)).toEqual({ code: room.code, mode: "teams" });
  expect(f.a.follows).toEqual([]);
  // The follower joins with an ordinary join request.
  const joined = await request(f.b.s, "join", { name: "Pal", code: room.code });
  expect(joined.ok).toBe(true);
});

it("passes the lead on, ends a party of one, and drops members who go offline", async () => {
  const f = await setup();
  for (const [who, account] of [
    [f.b, f.pal],
    [f.c, f.third],
  ] as const) {
    await request(f.a.s, "party-invite", {
      playerId: account.account.id,
      character: "voltkit",
    });
    await settle();
    await request(who.s, "party-accept", {
      code: who.invites.at(-1)!.code,
      character: "voltkit",
    });
  }
  await settle();
  expect(f.a.parties.at(-1)!.members).toHaveLength(3);
  expect((await request(f.a.s, "party-leave")).ok).toBe(true);
  // Wait for the updates themselves, not a fixed time (a busy machine is slow).
  await vi.waitFor(() => {
    expect(f.a.parties.at(-1)).toBeNull();
    expect(f.b.parties.at(-1)!.leader).toBe(f.pal.account.id);
    expect(f.b.parties.at(-1)!.members).toHaveLength(2);
  });
  f.c.s.disconnect();
  // Gone offline: their place is kept a moment (shown as away)...
  await vi.waitFor(() =>
    expect(
      f.b.parties.at(-1)!.members.find((m) => m.id === f.third.account.id)
        ?.away,
    ).toBe(true),
  );
  // ...then, still gone, only the new leader is left: the party ends.
  await vi.waitFor(() => expect(f.b.parties.at(-1)).toBeNull());
});

async function pairUp(f: Awaited<ReturnType<typeof setup>>) {
  await request(f.a.s, "party-invite", {
    playerId: f.pal.account.id,
    character: "voltkit",
  });
  await settle();
  await request(f.b.s, "party-accept", {
    code: f.b.invites.at(-1)!.code,
    character: "tidefin",
  });
  await settle();
}

it("keeps a member's place through a short drop and shows them the party again", async () => {
  const f = await setup({ partyAwayMs: 5_000 });
  await pairUp(f);
  f.b.s.disconnect();
  await vi.waitFor(() =>
    expect(
      f.a.parties.at(-1)!.members.find((m) => m.id === f.pal.account.id),
    ).toMatchObject({ away: true }),
  );
  // Back (a phone unlocked): still in the party, and the new tab sees it.
  const again = await f.connect(f.pal.token);
  await vi.waitFor(() => {
    expect(again.parties.at(-1)?.members.map((m) => m.id)).toEqual([
      f.lead.account.id,
      f.pal.account.id,
    ]);
    expect(
      f.a.parties.at(-1)!.members.find((m) => m.id === f.pal.account.id)?.away,
    ).toBeUndefined();
  });
});

it("keeps the party's room: follow it, step out, and stay a party", async () => {
  const f = await setup();
  await pairUp(f);
  const room = await request(f.a.s, "create", { name: "Lead", mode: "duel" });
  expect((await request(f.a.s, "party-room")).ok).toBe(true);
  await vi.waitFor(() =>
    expect(f.b.parties.at(-1)?.room).toEqual({ code: room.code, mode: "duel" }),
  );
  const joined = await request(f.b.s, "join", { name: "Pal", code: room.code });
  expect(joined.ok).toBe(true);
  // The member steps out to the Lobby: still a party, and its room is open.
  expect((await request(f.b.s, "leave", {})).ok).toBe(true);
  await settle();
  expect(f.b.parties.at(-1)?.members).toHaveLength(2);
  expect(f.b.parties.at(-1)?.room?.code).toBe(room.code);
  // The leader leaves too: still a party, with no room until the next one.
  expect((await request(f.a.s, "leave", {})).ok).toBe(true);
  await vi.waitFor(() => {
    expect(f.b.parties.at(-1)?.members).toHaveLength(2);
    expect(f.b.parties.at(-1)?.room ?? null).toBeNull();
  });
});

it("makes a party of a room invitation, so the friends stay together after it", async () => {
  const f = await setup();
  const room = await request(f.a.s, "create", { name: "Lead", mode: "duel" });
  expect(room.ok).toBe(true);
  expect(
    (await request(f.a.s, "room-invite", { playerId: f.pal.account.id })).ok,
  ).toBe(true);
  await settle();
  expect(f.b.invites.at(-1)).toMatchObject({ code: room.code, mode: "duel" });
  expect(
    (await request(f.b.s, "join", { name: "Pal", code: room.code })).ok,
  ).toBe(true);
  await vi.waitFor(() => {
    const party = f.b.parties.at(-1)!;
    expect(party.leader).toBe(f.lead.account.id);
    expect(party.members.map((m) => m.id)).toEqual([
      f.lead.account.id,
      f.pal.account.id,
    ]);
    expect(party.room?.code).toBe(room.code);
  });
  // Joining by the code alone (no invitation) makes no party.
  const other = await request(f.c.s, "create", { name: "Third", mode: "duel" });
  expect(
    (await request(f.x.s, "join", { name: "X", code: other.code })).ok,
  ).toBe(true);
  await settle();
  expect(f.x.parties).toEqual([]);
});

it("tells the sender about a Decline and lists the party's open invitations", async () => {
  const f = await setup();
  await request(f.a.s, "party-invite", {
    playerId: f.pal.account.id,
    character: "voltkit",
  });
  await vi.waitFor(() =>
    expect(f.a.parties.at(-1)?.invites?.map((i) => i.id)).toEqual([
      f.pal.account.id,
    ]),
  );
  await request(f.b.s, "party-decline", { code: f.b.invites.at(-1)!.code });
  await vi.waitFor(() => {
    expect(f.a.declined.at(-1)).toMatchObject({ playerId: f.pal.account.id });
    expect(f.a.parties.at(-1)?.invites).toEqual([]);
  });
  // A room invitation's Decline reaches the sender too, who may invite again.
  await request(f.a.s, "party-leave");
  await settle();
  await request(f.a.s, "create", { name: "Lead", mode: "duel" });
  expect(
    (await request(f.a.s, "room-invite", { playerId: f.third.account.id })).ok,
  ).toBe(true);
  await settle();
  await request(f.c.s, "room-invite-decline", { fromId: f.lead.account.id });
  await vi.waitFor(() =>
    expect(f.a.declined.at(-1)).toMatchObject({
      playerId: f.third.account.id,
    }),
  );
  expect(
    (await request(f.a.s, "room-invite", { playerId: f.third.account.id })).ok,
  ).toBe(true);
});

it("caps a party at four and lets an invitation expire", () => {
  const parties = new Parties();
  const member = (id: string) => ({ id, name: id, character: "voltkit" });
  let now = 1000;
  for (let i = 1; i < PARTY_SIZE; i++) {
    const sent = parties.invite(member("lead"), `p${i}`, now);
    expect(sent.ok).toBe(true);
    expect(
      parties.accept(member(`p${i}`), parties.of("lead")!.code, now).ok,
    ).toBe(true);
  }
  expect(parties.of("lead")!.members).toHaveLength(PARTY_SIZE);
  expect(parties.invite(member("lead"), "p9", now)).toMatchObject({
    ok: false,
  });
  const solo = new Parties();
  const sent = solo.invite(member("a"), "b", now);
  expect(sent.ok).toBe(true);
  now += 90_001;
  expect(solo.accept(member("b"), solo.of("a")!.code, now)).toMatchObject({
    ok: false,
    error: "This invitation has expired.",
  });
});

it("lets members invite their friends, unless the leader turns it off", async () => {
  const f = await setup();
  await pairUp(f);
  // The pal (a member) invites the third: the invitation names the leader.
  f.accounts.provider.rpc = ((rpc) => async (token, name, args) => {
    if (name === "arena_friends" && token === f.pal.token)
      return {
        code: "ABCDEF12",
        friends: [f.lead, f.third].map((p) => ({
          id: p.account.id,
          name: p.account.displayName,
        })),
        incoming: [],
        outgoing: [],
      };
    return rpc(token, name, args);
  })(f.accounts.provider.rpc);
  expect(
    (
      await request(f.b.s, "party-invite", {
        playerId: f.third.account.id,
        character: "tidefin",
      })
    ).ok,
  ).toBe(true);
  await settle();
  expect(f.c.invites.at(-1)).toMatchObject({
    mode: "party",
    fromId: f.pal.account.id,
    leader: f.lead.account.displayName,
  });
  expect(
    (
      await request(f.c.s, "party-accept", {
        code: f.c.invites.at(-1)!.code,
        character: "lumoth",
      })
    ).ok,
  ).toBe(true);
  await vi.waitFor(() => {
    const party = f.a.parties.at(-1)!;
    expect(party.leader).toBe(f.lead.account.id);
    expect(party.members).toHaveLength(3);
    expect(party.membersInvite).toBe(true);
  });
  // Only the leader changes the setting; turned off, members can't invite.
  expect(
    (await request(f.b.s, "party-settings", { membersInvite: false })).ok,
  ).toBe(false);
  expect(
    (await request(f.a.s, "party-settings", { membersInvite: false })).ok,
  ).toBe(true);
  await vi.waitFor(() => expect(f.b.parties.at(-1)?.membersInvite).toBe(false));
  await request(f.c.s, "party-leave");
  await settle();
  const refused = await request(f.b.s, "party-invite", {
    playerId: f.third.account.id,
    character: "tidefin",
  });
  expect(refused).toMatchObject({
    ok: false,
    error: "Your party leader has turned off invites from members.",
  });
});

it("lets only the leader remove a member, who is told", async () => {
  const f = await setup();
  await pairUp(f);
  const kicked: unknown[] = [];
  f.b.s.on("party-kicked", (d) => kicked.push(d));
  // A member can't remove the leader; the leader removes the member.
  expect(
    (await request(f.b.s, "party-kick", { playerId: f.lead.account.id })).ok,
  ).toBe(false);
  expect(
    (await request(f.a.s, "party-kick", { playerId: f.pal.account.id })).ok,
  ).toBe(true);
  await vi.waitFor(() => {
    expect(f.b.parties.at(-1)).toBeNull();
    expect(kicked.at(-1)).toEqual({ by: f.lead.account.displayName });
    // Only the leader was left: the party ended.
    expect(f.a.parties.at(-1)).toBeNull();
  });
});

it("keeps someone out of a party with a member they blocked", async () => {
  const f = await setup();
  await pairUp(f);
  // The third blocked the pal (a member): the leader's invite is refused,
  // without saying why.
  const rpc = f.accounts.provider.rpc;
  f.accounts.provider.rpc = async (token, name, args) =>
    name === "arena_blocked_players" && token === f.third.token
      ? [{ id: f.pal.account.id, name: f.pal.account.displayName }]
      : rpc(token, name, args);
  await f.connect(f.third.token);
  await settle();
  const sent = await request(f.a.s, "party-invite", {
    playerId: f.third.account.id,
    character: "voltkit",
  });
  expect(sent).toMatchObject({
    ok: false,
    error: "Your friend can't join this party.",
  });
});
