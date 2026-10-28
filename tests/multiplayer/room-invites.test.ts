import { afterEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";
import {
  roomInviteSchema,
  type RoomInvite,
} from "../../packages/shared/src/accounts";
import type { Reply } from "../../packages/shared/src/index";
let server: ReturnType<typeof createArenaServer> | undefined;
const sockets: Socket[] = [];
afterEach(async () => {
  sockets.splice(0).forEach((s) => s.disconnect());
  await server?.close();
  server = undefined;
});
const request = (s: Socket, event: string, data: unknown = {}) =>
  new Promise<Reply>((resolve) => s.emit(event, data, resolve));
async function setup() {
  const accounts = fakeAccounts(),
    host = accounts.add(false),
    pal = accounts.add(false),
    stranger = accounts.add(false);
  let beforeFriends: (() => Promise<void>) | undefined;
  accounts.provider.rpc = async (_token, name) => {
    if (name === "arena_friends") {
      await beforeFriends?.();
      return {
        code: "ABCDEF12",
        friends: [{ id: pal.account.id, name: "Pal" }],
        incoming: [],
        outgoing: [],
      };
    }
    return {};
  };
  server = createArenaServer({ accounts: accounts.provider, autoTick: false });
  await new Promise<void>((r) => server!.http.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.http.address() as { port: number }).port}`;
  const connect = async (token?: string) => {
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
    return s;
  };
  const sender = await connect(host.token),
    receiver = await connect(pal.token),
    unrelated = await connect(stranger.token);
  const room = await request(sender, "create", { name: "Host", mode: "ffa" });
  expect(room.ok).toBe(true);
  return {
    host,
    pal,
    stranger,
    sender,
    receiver,
    unrelated,
    room,
    connect,
    gate: (fn: () => Promise<void>) => {
      beforeFriends = fn;
    },
  };
}
it("delivers an authenticated invitation only to a friend, who can join the actual room", async () => {
  const f = await setup();
  const secondTab = await f.connect(f.pal.token);
  const received: RoomInvite[] = [],
    second: RoomInvite[] = [],
    others: unknown[] = [];
  f.receiver.on("room-invite", (data) =>
    received.push(roomInviteSchema.parse(data)),
  );
  secondTab.on("room-invite", (data) =>
    second.push(roomInviteSchema.parse(data)),
  );
  f.unrelated.on("room-invite", (data) => others.push(data));
  expect(
    (await request(f.sender, "room-invite", { playerId: f.pal.account.id })).ok,
  ).toBe(true);
  await new Promise((r) => setTimeout(r, 15));
  expect(received).toHaveLength(1);
  expect(second).toEqual(received);
  expect(others).toEqual([]);
  expect(received[0]).toMatchObject({
    fromId: f.host.account.id,
    name: f.host.account.displayName,
    code: f.room.code,
    mode: "ffa",
  });
  expect(received[0].expiresAt - Date.now()).toBeGreaterThan(85000);
  expect(
    (await request(f.sender, "room-invite", { playerId: f.pal.account.id }))
      .error,
  ).toMatch(/already sent/i);
  const joined = await request(f.receiver, "join", {
    name: "Pal",
    code: received[0].code,
  });
  expect(joined.ok).toBe(true);
  expect(server!.rooms.get(f.room.code!)!.players.map((p) => p.id)).toContain(
    joined.id,
  );
});
it("rejects unauthenticated requests, strangers, self-invites, malformed targets and offline friends", async () => {
  const f = await setup(),
    anonymous = await f.connect();
  expect(
    (await request(anonymous, "room-invite", { playerId: f.pal.account.id }))
      .error,
  ).toMatch(/log in/i);
  expect(
    (
      await request(f.sender, "room-invite", {
        playerId: f.stranger.account.id,
      })
    ).error,
  ).toMatch(/friends list/i);
  expect(
    (await request(f.sender, "room-invite", { playerId: f.host.account.id }))
      .ok,
  ).toBe(false);
  expect(
    (
      await request(f.sender, "room-invite", {
        playerId: "bad",
        code: "FAKE42",
      })
    ).ok,
  ).toBe(false);
  f.receiver.disconnect();
  await new Promise((r) => setTimeout(r, 20));
  expect(
    (await request(f.sender, "room-invite", { playerId: f.pal.account.id }))
      .error,
  ).toMatch(/offline/i);
});
it("doesn't interrupt friends already playing and rejects full or started source rooms", async () => {
  const f = await setup();
  await request(f.receiver, "create", { name: "Pal" });
  expect(
    (await request(f.sender, "room-invite", { playerId: f.pal.account.id }))
      .error,
  ).toMatch(/already in a room/i);
  const arena = server!.rooms.get(f.room.code!)!;
  arena.phase = "playing";
  expect(
    (await request(f.sender, "room-invite", { playerId: f.pal.account.id })).ok,
  ).toBe(false);
  arena.phase = "lobby";
  arena.add("extra1", "Extra 1");
  arena.add("extra2", "Extra 2");
  arena.add("extra3", "Extra 3");
  expect(
    (await request(f.sender, "room-invite", { playerId: f.pal.account.id })).ok,
  ).toBe(false);
});
it("rechecks the lobby after friends authorization and rejects stale joins", async () => {
  const f = await setup();
  let release!: () => void, entered!: () => void;
  const started = new Promise<void>((r) => {
    entered = r;
  });
  f.gate(() => {
    entered();
    return new Promise<void>((r) => {
      release = r;
    });
  });
  const invite = request(f.sender, "room-invite", {
    playerId: f.pal.account.id,
  });
  await started;
  const arena = server!.rooms.get(f.room.code!)!;
  arena.phase = "playing";
  release();
  expect((await invite).error).toMatch(/no longer open/i);
  expect(
    (await request(f.receiver, "join", { name: "Pal", code: f.room.code }))
      .error,
  ).toMatch(/already started/i);
});
