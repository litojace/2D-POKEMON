import { afterEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer, BACKPRESSURE } from "../../apps/server/src/server.js";
import { fakeAccounts } from "../helpers/accounts";
import {
  blankInput,
  MetaCache,
  unpackSnapshot,
  type Reply,
  type Snapshot,
  type SnapshotMeta,
  type WireSnapshot,
} from "../../packages/shared/src/index.js";

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
const emit = <T = Reply>(socket: Socket, event: string, data: unknown = {}) =>
  new Promise<T>((resolve, reject) =>
    socket
      .timeout(1000)
      .emit(event, data, (error: Error | null, result: T) =>
        error ? reject(error) : resolve(result),
      ),
  );
async function setup(options: { backpressure?: boolean } = {}) {
  const accounts = fakeAccounts();
  server = createArenaServer({
    autoTick: false,
    reconnectMs: 2000,
    accounts: accounts.provider,
    ...options,
  });
  await new Promise<void>((r) => server!.http.listen(0, "127.0.0.1", r));
  const { port } = server.http.address() as { port: number };
  const connect = async (token = accounts.add().token) => {
    const socket = io(`http://127.0.0.1:${port}`, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
      auth: { accessToken: token },
    });
    clients.push(socket);
    await new Promise<void>((r) => socket.on("connect", r));
    return socket;
  };
  return { connect, accounts };
}
/** Decode snapshots exactly as the game client does. */
function watch(socket: Socket) {
  const cache = new MetaCache();
  const seen: { wire: WireSnapshot; state: Snapshot }[] = [];
  socket.on("state", (wire: WireSnapshot) =>
    seen.push({ wire, state: unpackSnapshot(wire, cache) }),
  );
  return { cache, seen, last: () => seen.at(-1) };
}
async function fight(connect: () => Promise<Socket>) {
  const one = await connect(),
    two = await connect();
  const host = await emit(one, "create", { name: "One" });
  const guest = await emit(two, "join", { name: "Two", code: host.code });
  const arena = server!.rooms.get(host.code!)!;
  arena.start();
  arena.phase = "playing";
  arena.deadline = 1e9;
  return { one, two, host, guest, arena };
}
afterEach(async () => {
  for (const c of clients) c.disconnect();
  clients = [];
  await server?.close();
  server = undefined;
});

it("gives a new watcher every fighter's name and look without resending them each tick", async () => {
  const { connect, accounts } = await setup();
  const { one, arena, host } = await fight(connect);
  const player = watch(one);
  server!.step();
  server!.step();
  await until(() => player.seen.length >= 1);
  // Steady fighting: names stay cached, compact snapshots carry none.
  for (let i = 0; i < 6; i++) server!.step();
  await wait();
  const quiet = player.seen.slice(-2).map((s) => s.wire);
  expect(quiet.every((w) => w.meta === undefined)).toBe(true);
  expect(quiet.every((w) => !("name" in w.players[0]))).toBe(true);
  expect(player.last()!.state.players.map((p) => p.name)).toEqual([
    "Player 1",
    "Player 2",
  ]);
  // A spectator joining mid-fight gets the appearance block straight away.
  const fan = await connect(accounts.add().token);
  const spectator = watch(fan);
  expect((await emit(fan, "watch", { code: host.code })).ok).toBe(true);
  await until(() => spectator.seen.length >= 1);
  expect(spectator.seen[0].wire.meta?.players).toBeDefined();
  expect(spectator.last()!.state.players.map((p) => p.name)).toEqual([
    "Player 1",
    "Player 2",
  ]);
  // Anyone in the room can ask again; outsiders cannot.
  const asked = await emit<Reply & { code: string; meta: SnapshotMeta }>(
    fan,
    "snapshot-meta",
  );
  expect(asked.ok).toBe(true);
  expect(Object.keys(asked.meta.players)).toEqual(arena.players.map((p) => p.id));
  const stranger = await connect();
  expect((await emit(stranger, "snapshot-meta")).ok).toBe(false);
});

it("reconnects without replaying a stale cast or stale movement", async () => {
  const { connect } = await setup();
  const { two, guest, arena } = await fight(connect);
  const [, them] = arena.players;
  them.x = 600;
  them.y = 450;
  // Inputs that were still queued when the connection dropped.
  two.emit("input", { ...blankInput(), seq: 1, dx: 1, skill: 0 });
  two.emit("input", { ...blankInput(), seq: 2, dx: 1, dash: true });
  await wait();
  two.disconnect();
  await wait();
  expect(arena.phase).toBe("paused");
  const replacement = await connect(
    (two.auth as { accessToken: string }).accessToken,
  );
  const view = watch(replacement);
  const resumed = await emit(replacement, "resume", { token: guest.token });
  expect(resumed.ok).toBe(true);
  expect(arena.phase).toBe("playing");
  const x = them.x;
  for (let i = 0; i < 10; i++) server!.step();
  await until(() => view.seen.length > 0);
  // Nothing from before the drop ran: no cast, no dash, no drift.
  expect(arena.events.some((e) => e.owner === them.id && e.kind === "cast"))
    .toBe(false);
  expect(arena.events.some((e) => e.owner === them.id && e.kind === "dash"))
    .toBe(false);
  expect(them.x).toBeCloseTo(x, 5);
  // The resumed client sees names again and its next press casts once.
  expect(view.last()!.state.players.every((p) => p.name)).toBe(true);
  replacement.emit("input", {
    ...blankInput(),
    seq: them.ack + 1,
    skill: 0,
    aimX: 1200,
    aimY: 450,
  });
  await wait();
  for (let i = 0; i < 4; i++) server!.step();
  expect(
    arena.events.filter((e) => e.owner === them.id && e.kind === "cast"),
  ).toHaveLength(1);
});

it("holds snapshots back from a congested socket and delivers every missed event after", async () => {
  const { connect } = await setup({ backpressure: true });
  const { one, two, arena } = await fight(connect);
  const slow = watch(two),
    fast = watch(one);
  server!.step();
  server!.step();
  await until(() => slow.seen.length > 0 && fast.seen.length > 0);
  // Make the guest's WebSocket look backed up (unsent bytes queued).
  const guestSocket = [...server!.io.sockets.sockets.values()].find(
    (s) => s.handshake.auth.accessToken === (two.auth as { accessToken: string }).accessToken,
  )!;
  const ws = (guestSocket.conn as unknown as { transport: { socket: object } })
    .transport.socket;
  Object.defineProperty(ws, "bufferedAmount", {
    configurable: true,
    get: () => BACKPRESSURE.bytes + 1,
  });
  const before = slow.seen.length,
    fastBefore = fast.seen.length;
  const [me] = arena.players;
  for (let i = 0; i < 12; i++) {
    one.emit("input", {
      ...blankInput(),
      seq: me.ack + 1 + i,
      basic: true,
      skill: i === 3 ? 0 : -1,
      aimX: 1200,
      aimY: 450,
    });
    await wait(5);
    server!.step();
  }
  await wait();
  const castIds = arena.events
    .filter((e) => e.owner === me.id && e.kind === "cast")
    .map((e) => e.id);
  expect(castIds.length).toBeGreaterThan(1);
  expect(slow.seen.length).toBe(before);
  expect(fast.seen.length).toBeGreaterThan(fastBefore);
  // Drained: the next snapshot catches the guest up, events exactly once.
  delete (ws as { bufferedAmount?: number }).bufferedAmount;
  server!.step();
  server!.step();
  await until(() => slow.seen.length > before);
  const delivered = slow.seen.flatMap((s) => s.wire.events.map((e) => e.id));
  for (const id of castIds) expect(delivered.filter((d) => d === id)).toHaveLength(1);
  expect(slow.seen.at(-1)!.wire.meta).toBeDefined();
});
