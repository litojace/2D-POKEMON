import { afterEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";
import type { FriendList, Reply } from "../../packages/shared/src/index.js";

/**
 * The friends list shows who of your friends is online and what they are
 * doing. It looked each friend up by building the whole server's online
 * list again, every socket, sorted: friends × connections for one request
 * (performance sweep, S6). One pass over the connections is enough.
 */
let server: ReturnType<typeof createArenaServer> | undefined;
const clients: Socket[] = [];
afterEach(async () => {
  clients.splice(0).forEach((c) => c.disconnect());
  await server?.close();
  server = undefined;
});
const emit = (socket: Socket, event: string, data: unknown = {}) =>
  new Promise<Reply>((resolve, reject) =>
    socket
      .timeout(1000)
      .emit(event, data, (error: Error | null, result: Reply) =>
        error ? reject(error) : resolve(result),
      ),
  );
async function setup(online: number, offline: number) {
  const accounts = fakeAccounts();
  const viewer = accounts.add(false);
  const pals = Array.from({ length: online + offline }, () =>
    accounts.add(false),
  );
  accounts.provider.rpc = async (token, name) => {
    if (!accounts.users.get(token)) throw Error("Not authenticated");
    if (name === "arena_friends")
      return {
        code: "ABCDEF12",
        friends: pals.map((p, i) => ({
          id: p.account.id,
          name: `Pal ${String(i).padStart(2, "0")}`,
          lastOnline: null,
        })),
        incoming: [],
        outgoing: [],
      };
    return [];
  };
  server = createArenaServer({ accounts: accounts.provider, autoTick: false });
  await new Promise<void>((r) => server!.http.listen(0, "127.0.0.1", r));
  const url =
    "http://127.0.0.1:" + (server.http.address() as { port: number }).port;
  const sockets: Socket[] = [];
  for (const pal of pals.slice(0, online)) {
    const socket = io(url, {
      auth: { accessToken: pal.token },
      transports: ["websocket"],
      reconnection: false,
      forceNew: true,
    });
    clients.push(socket);
    await new Promise<void>((r, j) => {
      socket.once("connect", r);
      socket.once("connect_error", j);
    });
    sockets.push(socket);
  }
  const list = async () => {
    const r = await fetch(url + "/api/friends", {
      headers: { authorization: "Bearer " + viewer.token },
    });
    expect(r.status).toBe(200);
    return (await r.json()) as FriendList;
  };
  return { server: server!, pals, sockets, list };
}
/** How many times `run` walks the server's connections. */
async function walks(
  s: ReturnType<typeof createArenaServer>,
  run: () => Promise<unknown>,
) {
  const all = s.io.sockets.sockets;
  const values = all.values.bind(all);
  let count = 0;
  all.values = () => {
    count++;
    return values();
  };
  try {
    await run();
  } finally {
    all.values = values;
  }
  return count;
}

it("looks up every friend's presence in one pass over the connections", async () => {
  const { server, list } = await setup(12, 28);
  // 40 friends, 12 of them online: 40 passes or more before.
  const count = await walks(server, list);
  expect(count).toBeLessThanOrEqual(2);
});

it("still says who is online, what they are doing and in which room", async () => {
  const { pals, sockets, list } = await setup(3, 2);
  const host = await emit(sockets[0], "create", { name: "Host" });
  expect(host.ok).toBe(true);
  expect(
    (await emit(sockets[1], "join", { name: "Guest", code: host.code })).ok,
  ).toBe(true);
  const friends = (await list()).friends;
  const of = (i: number) => friends.find((f) => f.id === pals[i].account.id)!;
  expect(of(0)).toMatchObject({
    online: true,
    activity: "lobby",
    room: host.code,
  });
  expect(of(1)).toMatchObject({
    online: true,
    activity: "lobby",
    room: host.code,
  });
  expect(of(2)).toMatchObject({ online: true, activity: "menu", room: null });
  expect(of(3)).toMatchObject({ online: false, activity: null, room: null });
  expect(of(4)).toMatchObject({ online: false, activity: null, room: null });
  // Online friends first, then by name, as before.
  expect(friends.map((f) => f.online)).toEqual([
    true,
    true,
    true,
    false,
    false,
  ]);
});
