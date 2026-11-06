import { afterEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server.js";
import { fakeAccounts } from "../helpers/accounts";
import type { Reply } from "../../packages/shared/src/index.js";

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
  const log: { event: string; details: Record<string, unknown> }[] = [];
  server = createArenaServer({
    autoTick: false,
    reconnectMs: 2000,
    accounts: accounts.provider,
    connectionLog: (event, details) => log.push({ event, details }),
  });
  await new Promise<void>((r) => server!.http.listen(0, "127.0.0.1", r));
  const { port } = server.http.address() as { port: number };
  const connect = async (token: string) => {
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
  return { connect, accounts, log };
}
afterEach(async () => {
  for (const c of clients) c.disconnect();
  clients = [];
  await server?.close();
  server = undefined;
});

it("logs why a player in a match dropped, and what their browser saw", async () => {
  const { connect, accounts, log } = await setup();
  const host = accounts.add(),
    guest = accounts.add(),
    idle = accounts.add();
  const one = await connect(host.token),
    two = await connect(guest.token),
    bystander = await connect(idle.token);
  const created = await emit(one, "create", { name: "One" });
  const joined = await emit(two, "join", { name: "Two", code: created.code });
  const arena = server!.rooms.get(created.code!)!;
  arena.start();
  arena.phase = "playing";
  arena.deadline = 1e9;

  // A socket outside any room leaves no line.
  bystander.disconnect();
  await wait();
  expect(log).toEqual([]);

  // Cut the guest's network link (not a polite Socket.IO disconnect).
  let clientView: { reason: string; transport: string } | undefined;
  two.on("disconnect", (reason) => {
    clientView = { reason, transport: two.io.engine?.transport?.name ?? "" };
  });
  two.io.engine.close();
  await until(() => log.length === 1 && !!clientView);
  expect(log[0]).toEqual({
    event: "arena-disconnect",
    details: {
      reason: "transport close",
      transport: "websocket",
      room: created.code,
      mode: "duel",
      phase: "playing",
      account: guest.account.id,
      connectedFor: expect.any(Number),
    },
  });
  // The match pauses with the configured grace, as before.
  expect(arena.phase).toBe("paused");
  // The browser can still read which transport it was on when it dropped
  // (closing the engine by hand reads as "forced close" on this side).
  expect(clientView).toEqual({
    reason: "forced close",
    transport: "websocket",
  });

  // Back on a new connection: the browser's report is logged once.
  const back = await connect(guest.token);
  const report = {
    reason: "transport close",
    transport: "websocket",
    hidden: true,
    offline: false,
    away: 3,
  };
  back.emit("connection-report", { ...report, extra: "nope" });
  back.emit("connection-report", report);
  back.emit("connection-report", { ...report, away: 99 });
  expect((await emit(back, "resume", { token: joined.token })).ok).toBe(true);
  await until(() => log.length === 2);
  await wait();
  expect(log.slice(1)).toEqual([
    {
      event: "arena-client-drop",
      details: { ...report, account: guest.account.id },
    },
  ]);
  expect(arena.phase).toBe("playing");
});

it("marks a player pushed out by their own account signing in elsewhere", async () => {
  const { connect, accounts, log } = await setup();
  const host = accounts.add(),
    guest = accounts.add();
  const one = await connect(host.token);
  await connect(guest.token);
  const created = await emit(one, "create", { name: "One" });
  expect(created.ok).toBe(true);
  // The same account opens the game somewhere else.
  await connect(host.token);
  await until(() => log.length === 1);
  expect(log[0].event).toBe("arena-disconnect");
  expect(log[0].details).toMatchObject({
    reason: "server namespace disconnect",
    replaced: true,
    account: host.account.id,
  });
});

it("logs how long a player's device took to load the battle", async () => {
  const { connect, accounts, log } = await setup();
  const host = accounts.add(),
    guest = accounts.add(),
    outsider = accounts.add();
  const one = await connect(host.token),
    two = await connect(guest.token),
    stranger = await connect(outsider.token);
  const created = await emit(one, "create", { name: "One" });
  await emit(two, "join", { name: "Two", code: created.code });
  const arena = server!.rooms.get(created.code!)!;
  arena.start();
  const report = { ms: 8421, fighters: 2, memory: 2, cores: 8 };
  // Outside a room, or malformed: nothing is logged.
  stranger.emit("battle-loaded", report);
  one.emit("battle-loaded", { ...report, ms: -1 });
  one.emit("battle-loaded", { ...report, extra: true });
  one.emit("battle-loaded", report);
  await until(() => log.length === 1);
  await wait();
  expect(log).toEqual([
    {
      event: "arena-load",
      details: {
        ...report,
        account: host.account.id,
        room: created.code,
        mode: "duel",
        phase: arena.phase,
        character: arena.players[0].character,
      },
    },
  ]);
  // A client stuck in a loop is capped.
  for (let i = 0; i < 30; i++) two.emit("battle-loaded", report);
  await until(() => log.length === 21);
  await wait(150);
  expect(log.length).toBe(21);
});
