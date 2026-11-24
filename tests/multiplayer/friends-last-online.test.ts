import { afterEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";
import type { FriendList } from "../../packages/shared/src/accounts";
let server: ReturnType<typeof createArenaServer> | undefined;
const clients: Socket[] = [];
afterEach(async () => {
  clients.splice(0).forEach((c) => c.disconnect());
  await server?.close();
  server = undefined;
});
const setup = async () => {
  const accounts = fakeAccounts(),
    viewer = accounts.add(false),
    pal = accounts.add(false),
    saved = new Map<string, string>(),
    writes = new Map<string, number>();
  accounts.provider.rpc = async (token, name) => {
    const user = accounts.users.get(token);
    if (!user) throw Error("Not authenticated");
    if (name === "arena_touch_presence") {
      const stamp = new Date().toISOString();
      saved.set(user.id, stamp);
      writes.set(user.id, (writes.get(user.id) ?? 0) + 1);
      return stamp;
    }
    if (name === "arena_friends")
      return {
        code: "ABCDEF12",
        friends: [
          {
            id: pal.account.id,
            name: "Pal",
            lastOnline: saved.get(pal.account.id) ?? null,
          },
        ],
        incoming: [],
        outgoing: [],
      };
    return {};
  };
  const start = async () => {
    server = createArenaServer({
      accounts: accounts.provider,
      autoTick: false,
    });
    await new Promise<void>((r) => server!.http.listen(0, "127.0.0.1", r));
    return (
      "http://127.0.0.1:" + (server.http.address() as { port: number }).port
    );
  };
  let url = await start();
  const connect = async (token?: string) => {
    const socket = io(url, {
      auth: { accessToken: token },
      transports: ["websocket"],
      reconnection: false,
    });
    clients.push(socket);
    await new Promise<void>((r, j) => {
      socket.once("connect", r);
      socket.once("connect_error", j);
    });
    return socket;
  };
  const list = async () => {
    const r = await fetch(url + "/api/friends", {
      headers: { authorization: "Bearer " + viewer.token },
    });
    expect(r.status).toBe(200);
    return (await r.json()) as FriendList;
  };
  return {
    accounts,
    viewer,
    pal,
    saved,
    writes,
    connect,
    list,
    restart: async () => {
      await server!.close();
      url = await start();
    },
  };
};
const settle = () => new Promise((r) => setTimeout(r, 60));
it("keeps friends online until the final tab disconnects, then exposes a real timestamp", async () => {
  const f = await setup();
  await f.connect(f.viewer.token);
  const first = await f.connect(f.pal.token),
    second = await f.connect(f.pal.token);
  await settle();
  expect((await f.list()).friends[0].online).toBe(true);
  expect(f.writes.get(f.pal.account.id)).toBe(1);
  first.disconnect();
  await settle();
  expect((await f.list()).friends[0].online).toBe(true);
  expect(f.writes.get(f.pal.account.id)).toBe(1);
  const before = Date.now();
  second.disconnect();
  await settle();
  const offline = (await f.list()).friends[0];
  expect(offline.online).toBe(false);
  expect(offline.lastOnline).toBeTruthy();
  expect(Date.parse(offline.lastOnline!)).toBeGreaterThanOrEqual(before);
  expect(f.writes.get(f.pal.account.id)).toBe(2);
});
it("retains last-online history across a server restart", async () => {
  const f = await setup();
  await f.connect(f.viewer.token);
  await f.connect(f.pal.token);
  await settle();
  await f.restart();
  const saved = f.saved.get(f.pal.account.id);
  expect(saved).toBeTruthy();
  await f.connect(f.viewer.token);
  const offline = (await f.list()).friends[0];
  expect(offline.online).toBe(false);
  expect(offline.lastOnline).toBe(saved);
});
it("starts tracking a newly authenticated connection and ignores forged identity/activity input", async () => {
  const f = await setup();
  const socket = await f.connect();
  await settle();
  expect(f.writes.size).toBe(0);
  const token = (value: string) =>
    new Promise<{ ok: boolean }>((r) =>
      socket.emit("token", { token: value }, r),
    );
  expect((await token(f.viewer.token)).ok).toBe(true);
  await settle();
  expect(f.writes.get(f.viewer.account.id)).toBe(1);
  socket.emit("presence", {
    id: f.pal.account.id,
    lastOnline: "2099-01-01T00:00:00Z",
  });
  expect((await token(f.pal.token)).ok).toBe(false);
  await settle();
  expect(f.saved.has(f.pal.account.id)).toBe(false);
});
