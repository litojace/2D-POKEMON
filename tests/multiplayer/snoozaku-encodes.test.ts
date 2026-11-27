import { afterEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server.js";
import { SomnaraArena } from "../../apps/server/src/raid-somnara.js";
import { fakeAccounts } from "../helpers/accounts";
import type { Reply } from "../../packages/shared/src/index.js";

/**
 * Snoozaku's raid (id `somnara`) has a private part: the dream's runes go
 * only to the players allowed to see them. The server took every seat out of
 * the room's shared send and sent each its own copy, every tick of the whole
 * raid, dream or no dream: one encoding per raider plus one for the room
 * (performance sweep, S4). Only a seat that has something private needs its
 * own copy.
 */
let server: ReturnType<typeof createArenaServer> | undefined,
  clients: Socket[] = [];
const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const emit = (socket: Socket, event: string, data: unknown = {}) =>
  new Promise<Reply>((resolve, reject) =>
    socket
      .timeout(1000)
      .emit(event, data, (error: Error | null, result: Reply) =>
        error ? reject(error) : resolve(result),
      ),
  );
async function raid() {
  const accounts = fakeAccounts();
  accounts.provider.rpc = async () => ({
    clears: 1,
    highestPeril: 3,
    cosmetics: [],
    bosses: { grumblecrag: { clears: 1, highestPeril: 3 } },
  });
  server = createArenaServer({
    autoTick: false,
    reconnectMs: 60_000,
    accounts: accounts.provider,
  });
  await new Promise<void>((r) => server!.http.listen(0, "127.0.0.1", r));
  const { port } = server.http.address() as { port: number };
  const connect = async () => {
    const socket = io(`http://127.0.0.1:${port}`, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
      auth: { accessToken: accounts.add().token },
    });
    clients.push(socket);
    await new Promise<void>((r) => socket.on("connect", r));
    return socket;
  };
  const sockets = [await connect(), await connect(), await connect()];
  const watcher = await connect();
  const created = await emit(sockets[0], "create", {
    name: "Host",
    mode: "raid",
    boss: "somnara",
  });
  const ids = [created.id!];
  for (const socket of sockets.slice(1))
    ids.push(
      (await emit(socket, "join", { name: "R", code: created.code })).id!,
    );
  expect((await emit(watcher, "watch", { code: created.code })).ok).toBe(true);
  const arena = server.rooms.get(created.code!) as SomnaraArena;
  expect(arena).toBeInstanceOf(SomnaraArena);
  arena.start();
  arena.phase = "playing";
  const inner = arena as unknown as {
    started: boolean;
    nextAttack: number;
    startAttack(id: string, target: unknown): void;
  };
  inner.started = true;
  inner.nextAttack = Infinity;
  const seen = new Map<Socket, any[]>();
  for (const socket of [...sockets, watcher]) {
    seen.set(socket, []);
    socket.on("state", (s) => seen.get(socket)!.push(s));
  }
  await wait(80);
  return { server, arena, inner, sockets, ids, watcher, seen };
}
/** How many times one step encodes and sends this room's snapshot. */
function sendsPerStep(s: NonNullable<typeof server>) {
  const adapter = s.io.sockets.adapter;
  const original = adapter.broadcast;
  let sends = 0;
  adapter.broadcast = function (packet, ...rest) {
    if ((packet.data as unknown[] | undefined)?.[0] === "state") sends++;
    return original.call(this, packet, ...rest);
  };
  try {
    s.step();
  } finally {
    adapter.broadcast = original;
  }
  return sends;
}
afterEach(async () => {
  for (const c of clients) c.disconnect();
  clients = [];
  await server?.close();
  server = undefined;
});

it("with no dream running, the raid is encoded once a tick for everyone", async () => {
  const { server, arena, sockets, watcher, seen } = await raid();
  expect(arena.raid.dream).toBeFalsy();
  for (let i = 0; i < 5; i++) expect(sendsPerStep(server)).toBe(1);
  await wait(80);
  // Everyone still gets every tick.
  for (const socket of [...sockets, watcher])
    expect(seen.get(socket)!.length).toBeGreaterThanOrEqual(5);
});

it("during a dream, only the seats that see runes get their own copy", async () => {
  const { server, arena, inner, sockets, ids, watcher, seen } = await raid();
  inner.startAttack("dream-sequence", arena.heroes()[0]);
  const dream = arena.raid.dream!;
  const privy = ids.filter((id) => arena.dreamFor(id));
  expect(privy).toEqual([dream.dreamerId]);
  for (const list of seen.values()) list.length = 0;
  // One shared copy and the Dreamer's own (4 before: room + three seats).
  expect(sendsPerStep(server)).toBe(2);
  await wait(80);
  const last = (socket: Socket) => seen.get(socket)!.at(-1);
  sockets.forEach((socket, i) => {
    expect(seen.get(socket)).toHaveLength(1);
    if (ids[i] === dream.dreamerId)
      expect(last(socket).raidDream.runes).toHaveLength(dream.length);
    else {
      expect(last(socket).raidDream).toBeUndefined();
      expect(JSON.stringify(last(socket))).not.toContain('"runes"');
    }
  });
  expect(seen.get(watcher)).toHaveLength(1);
  expect(JSON.stringify(last(watcher))).not.toContain('"runes"');
});
