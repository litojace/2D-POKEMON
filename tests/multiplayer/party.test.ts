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

async function setup() {
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
  server = createArenaServer({ accounts: accounts.provider, autoTick: false });
  await new Promise<void>((r) => server!.http.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.http.address() as { port: number }).port}`;
  const connect = async (token: string) => {
    const s = io(url, {
      auth: { accessToken: token },
      transports: ["websocket"],
      reconnection: false,
    });
    sockets.push(s);
    await new Promise<void>((r, reject) => {
      s.once("connect", r);
      s.once("connect_error", reject);
    });
    const parties: PartyState[] = [],
      invites: RoomInvite[] = [],
      follows: unknown[] = [];
    s.on("party", (d) => parties.push(partyStateSchema.parse(d)));
    s.on("room-invite", (d) => invites.push(roomInviteSchema.parse(d)));
    s.on("party-room", (d) => follows.push(d));
    return { s, parties, invites, follows };
  };
  return {
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
  // Only the new leader is left: the party ends.
  await vi.waitFor(() => expect(f.b.parties.at(-1)).toBeNull());
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
