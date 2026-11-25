import { afterEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server.js";
import { fakeAccounts } from "../helpers/accounts";
import {
  RULES,
  type Reply,
  type WireSnapshot,
} from "../../packages/shared/src/index.js";

/**
 * A room nobody is fighting in (lobby, briefing, results, pause) changes
 * only when someone does something, yet it was sent to everyone 30 times a
 * second (performance sweep, S2). Now it is sent when it changes, and
 * otherwise a few times a second. These clients are plain Socket.IO
 * clients, as an older app is: nothing here is negotiated.
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
async function setup() {
  const accounts = fakeAccounts();
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
  const lobby = async () => {
    const one = await connect(),
      two = await connect();
    const seen: WireSnapshot[] = [];
    one.on("state", (s: WireSnapshot) => seen.push(s));
    const host = await emit(one, "create", { name: "One" });
    await emit(two, "join", { name: "Two", code: host.code });
    const arena = server!.rooms.get(host.code!)!;
    await settle(seen);
    return { one, two, host, arena, seen };
  };
  return { connect, lobby, server: server! };
}
/** Wait until no more snapshots arrive, then forget those that did. */
async function settle(seen: WireSnapshot[]) {
  let count = -1;
  while (count !== seen.length) {
    count = seen.length;
    await wait(60);
  }
  seen.length = 0;
}
/** Run `seconds` of server ticks and return the snapshots one client got. */
async function run(seconds: number, seen: WireSnapshot[]) {
  seen.length = 0;
  for (let i = 0; i < seconds * RULES.tick; i++) server!.step();
  let count = -1;
  while (count !== seen.length) {
    count = seen.length;
    await wait(60);
  }
  return seen.slice();
}
afterEach(async () => {
  for (const c of clients) c.disconnect();
  clients = [];
  await server?.close();
  server = undefined;
});

it("a lobby nobody touches is sent a few times a second, not thirty", async () => {
  const { lobby } = await setup();
  const { seen } = await lobby();
  const got = await run(2, seen);
  // 60 before. A slow beat stays, for an app that redraws on snapshots.
  expect(got.length).toBeGreaterThanOrEqual(2);
  expect(got.length).toBeLessThanOrEqual(6);
  expect(got.every((s) => s.phase === "lobby")).toBe(true);
});

it("a change in a quiet room goes out on the next tick, whoever made it", async () => {
  const { lobby, server } = await setup();
  const { arena, seen, two } = await lobby();
  await run(1, seen);
  // Changed by the server itself, with no broadcast of its own.
  arena.players[1].ready = true;
  seen.length = 0;
  server.step();
  await until(() => seen.length > 0);
  expect(seen).toHaveLength(1);
  expect(seen[0].players[1].ready).toBe(true);
  // Changed by a player's command: at once, without waiting for a tick.
  seen.length = 0;
  expect((await emit(two, "select", "cindrake")).ok).toBe(true);
  await until(() => seen.length > 0);
  // And then quiet again.
  const after = await run(1, seen);
  expect(after.length).toBeLessThanOrEqual(3);
});

it("the fight itself is still sent every tick, and its start is not delayed", async () => {
  const { lobby, server } = await setup();
  const { one, two, arena, seen } = await lobby();
  await run(1, seen);
  await emit(one, "ready");
  await emit(two, "ready");
  await settle(seen);
  expect(arena.phase).not.toBe("lobby");
  // Whatever comes between the lobby and the fight, to the fight.
  if (arena.phase === "briefing") {
    await emit(one, "instructions-ready");
    await emit(two, "instructions-ready");
    await settle(seen);
  }
  expect(arena.phase).toBe("countdown");
  const countdown = await run(1, seen);
  expect(countdown).toHaveLength(RULES.tick);
  arena.deadline = arena.time;
  seen.length = 0;
  server.step();
  await until(() => seen.length > 0);
  expect(seen[0].phase).toBe("playing");
  const playing = await run(1, seen);
  expect(playing).toHaveLength(RULES.tick);
});

it("a paused match counts down at least five times a second", async () => {
  const { lobby } = await setup();
  const { two, arena, seen } = await lobby();
  arena.phase = "playing";
  two.disconnect();
  await until(() => arena.phase === "paused");
  await settle(seen);
  const got = await run(2, seen);
  expect(got.length).toBeGreaterThanOrEqual(10);
  expect(got.length).toBeLessThanOrEqual(14);
  expect(got.every((s) => s.phase === "paused")).toBe(true);
  expect(got.at(-1)!.pauseRemaining).toBeGreaterThan(0);
  expect(got.at(-1)!.pauseRemaining).toBeLessThanOrEqual(got[0].pauseRemaining);
});

it("the results screen is quiet too, and a rematch vote still shows at once", async () => {
  const { lobby } = await setup();
  const { one, arena, seen } = await lobby();
  arena.phase = "playing";
  arena.forfeit(arena.players[0].id);
  expect(arena.phase).toBe("finished");
  await run(1, seen);
  const got = await run(2, seen);
  expect(got.length).toBeLessThanOrEqual(6);
  seen.length = 0;
  await emit(one, "rematch", {});
  await until(() => seen.length > 0);
});

it("someone who joins or watches a quiet room sees it at once", async () => {
  const { lobby, connect } = await setup();
  const { host, seen } = await lobby();
  await run(1, seen);
  const fan = await connect();
  const fanSaw: WireSnapshot[] = [];
  fan.on("state", (s: WireSnapshot) => fanSaw.push(s));
  expect((await emit(fan, "watch", { code: host.code })).ok).toBe(true);
  await until(() => fanSaw.length > 0);
  // With the fighters' names and looks (the appearance block).
  expect(fanSaw.some((s) => s.meta)).toBe(true);
});
