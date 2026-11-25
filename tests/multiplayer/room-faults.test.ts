import { afterEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server.js";
import { fakeAccounts } from "../helpers/accounts";
import type { Reply } from "../../packages/shared/src/index.js";

/**
 * One room's fault must not end every match (performance sweep, S5). Before,
 * a throw in a room's tick, its snapshot or a socket handler left the tick
 * loop or the process: every room on the server stopped with it.
 */
let server: ReturnType<typeof createArenaServer> | undefined,
  clients: Socket[] = [];
const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms));
async function until(condition: () => boolean, timeout = 3000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) throw new Error("Timed out waiting");
    await wait(10);
  }
}
const emit = (socket: Socket, event: string, data: unknown = {}) =>
  new Promise<Reply>((resolve, reject) =>
    socket
      .timeout(1000)
      .emit(event, data, (error: Error | null, result: Reply) =>
        error ? reject(error) : resolve(result),
      ),
  );
type Logged = { event: string; details: Record<string, unknown> };
async function setup() {
  const accounts = fakeAccounts();
  const log: Logged[] = [];
  server = createArenaServer({
    autoTick: false,
    reconnectMs: 2000,
    accounts: accounts.provider,
    connectionLog: (event, details) => log.push({ event, details }),
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
  /** A duel room with both players in it, fighting. */
  const duel = async () => {
    const one = await connect(),
      two = await connect();
    const host = await emit(one, "create", { name: "One" });
    const guest = await emit(two, "join", { name: "Two", code: host.code });
    const arena = server!.rooms.get(host.code!)!;
    arena.phase = "playing";
    return { one, two, host, guest, arena };
  };
  return { connect, duel, log, server: server! };
}
const states = (socket: Socket) => {
  const seen: unknown[] = [];
  socket.on("state", (s) => seen.push(s));
  return seen;
};
afterEach(async () => {
  for (const c of clients) c.disconnect();
  clients = [];
  await server?.close();
  server = undefined;
});

it("closes only the room whose tick throws; the other rooms play on", async () => {
  const { duel, connect, log, server } = await setup();
  const broken = await duel(),
    healthy = await duel();
  const fan = await connect();
  expect((await emit(fan, "watch", { code: broken.host.code })).ok).toBe(true);
  const told: string[] = [];
  for (const socket of [broken.one, broken.two])
    socket.on("access-revoked", ({ error }: { error: string }) =>
      told.push(error),
    );
  let watchEnded = "";
  fan.on("watch-ended", ({ reason }: { reason: string }) => {
    watchEnded = reason;
  });
  const healthyStates = states(healthy.one);
  broken.arena.tick = () => {
    throw new Error("boom in tick");
  };
  const before = healthy.arena.time;
  expect(() => server.step()).not.toThrow();
  // The broken room is gone, with its seats; the healthy one ticked.
  expect(server.rooms.has(broken.host.code!)).toBe(false);
  expect(server.rooms.has(healthy.host.code!)).toBe(true);
  expect(healthy.arena.time).toBeGreaterThan(before);
  expect(
    [...server.sessions.values()].filter((s) => s.code === broken.host.code),
  ).toHaveLength(0);
  // Its players and its watcher are told, in words an older app shows too.
  await until(() => told.length === 2 && !!watchEnded);
  expect(told[0]).toMatch(/server error/i);
  expect(watchEnded).toMatch(/server error/i);
  // The fault is logged once, with what is needed to find it.
  const faults = log.filter((l) => l.event === "arena-room-fault");
  expect(faults).toHaveLength(1);
  expect(faults[0].details).toMatchObject({
    code: broken.host.code,
    mode: "duel",
    phase: "playing",
    players: 2,
  });
  expect(String(faults[0].details.error)).toContain("boom in tick");
  // The server keeps ticking: no second fault, and the healthy room's
  // players keep getting snapshots.
  for (let i = 0; i < 6; i++) server.step();
  await until(() => healthyStates.length > 0);
  expect(log.filter((l) => l.event === "arena-room-fault")).toHaveLength(1);
  // The closed room can't be resumed, and its players can start a new one.
  const again = await emit(broken.one, "resume", { token: broken.host.token });
  expect(again.ok).toBe(false);
  expect((await emit(broken.one, "create", { name: "One" })).ok).toBe(true);
});

it("closes only the room whose snapshot throws", async () => {
  const { duel, log, server } = await setup();
  const broken = await duel(),
    healthy = await duel();
  broken.arena.snapshot = () => {
    throw new Error("boom in snapshot");
  };
  for (let i = 0; i < 3; i++) expect(() => server.step()).not.toThrow();
  expect(server.rooms.has(broken.host.code!)).toBe(false);
  expect(server.rooms.has(healthy.host.code!)).toBe(true);
  const faults = log.filter((l) => l.event === "arena-room-fault");
  expect(faults).toHaveLength(1);
  expect(String(faults[0].details.error)).toContain("boom in snapshot");
});

it("a handler that throws answers with an error; the server and the room carry on", async () => {
  const { connect, log, server } = await setup();
  const one = await connect(),
    two = await connect();
  const host = await emit(one, "create", { name: "One" });
  await emit(two, "join", { name: "Two", code: host.code });
  const arena = server.rooms.get(host.code!)!;
  // The "select" handler reads the room's players.
  const players = arena.players;
  Object.defineProperty(arena, "players", {
    configurable: true,
    get() {
      throw new Error("boom in handler");
    },
  });
  const reply = await emit(one, "select", "cindrake");
  Object.defineProperty(arena, "players", {
    configurable: true,
    writable: true,
    value: players,
  });
  expect(reply.ok).toBe(false);
  expect(reply.error).toMatch(/went wrong/i);
  const faults = log.filter((l) => l.event === "arena-handler-fault");
  expect(faults).toHaveLength(1);
  expect(faults[0].details).toMatchObject({ on: "select" });
  expect(String(faults[0].details.error)).toContain("boom in handler");
  // Still serving: the same room, the same connection.
  expect(server.rooms.has(host.code!)).toBe(true);
  expect((await emit(one, "select", "cindrake")).ok).toBe(true);
  expect(() => server.step()).not.toThrow();
});

it("an async handler that rejects answers with an error too", async () => {
  const { connect, log, server } = await setup();
  const host = await connect();
  const created = await emit(host, "create", {
    name: "Raider",
    mode: "raid",
    boss: "grumblecrag",
  });
  const arena = server.rooms.get(created.code!)! as unknown as {
    configure: () => void;
  };
  arena.configure = () => {
    throw new Error("boom in async handler");
  };
  const reply = await emit(host, "raid-config", { peril: 3 });
  expect(reply.ok).toBe(false);
  expect(reply.error).toMatch(/went wrong/i);
  const faults = log.filter((l) => l.event === "arena-handler-fault");
  expect(faults).toHaveLength(1);
  expect(faults[0].details).toMatchObject({ on: "raid-config" });
  expect(server.rooms.has(created.code!)).toBe(true);
});

it("a seat that can't be released is dropped, not retried every tick", async () => {
  const { duel, log, server } = await setup();
  const { one, host, arena } = await duel();
  const other = await duel();
  // The player's grace period has run out, and releasing the seat throws.
  one.disconnect();
  await until(
    () =>
      [...server.sessions.values()].find((s) => s.token === host.token)
        ?.socketId === null,
  );
  const session = [...server.sessions.values()].find(
    (s) => s.token === host.token,
  )!;
  session.expires = 0;
  arena.forfeit = () => {
    throw new Error("boom in forfeit");
  };
  expect(() => server.step()).not.toThrow();
  expect(server.sessions.has(host.token!)).toBe(false);
  expect(server.rooms.has(other.host.code!)).toBe(true);
  expect(
    log.filter((l) =>
      ["arena-room-fault", "arena-session-fault"].includes(l.event),
    ).length,
  ).toBeGreaterThan(0);
  for (let i = 0; i < 5; i++) expect(() => server.step()).not.toThrow();
});

it("a flood of faults is logged a few times a minute, then counted", async () => {
  const { connect, log, server } = await setup();
  const one = await connect();
  const host = await emit(one, "create", { name: "One" });
  const arena = server.rooms.get(host.code!)!;
  Object.defineProperty(arena, "players", {
    configurable: true,
    get() {
      throw new Error("boom again");
    },
  });
  for (let i = 0; i < 40; i++) await emit(one, "select", "cindrake");
  const faults = log.filter((l) => l.event === "arena-handler-fault");
  expect(faults.length).toBeGreaterThan(0);
  expect(faults.length).toBeLessThanOrEqual(20);
});
