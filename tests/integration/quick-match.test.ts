import { afterEach, beforeEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";
import type { Reply } from "../../packages/shared/src/index";

// Quick Match (docs/pvp-plan.md, item 1) and the match/queue log lines
// (item 2), through real sockets.
let server: ReturnType<typeof createArenaServer>,
  accounts: ReturnType<typeof fakeAccounts>,
  url: string,
  clients: Socket[],
  logs: { event: string; details: Record<string, unknown> }[];
const emit = (socket: Socket, event: string, data: unknown = {}) =>
  new Promise<Reply>((resolve, reject) =>
    socket
      .timeout(2000)
      .emit(event, data, (error: Error | null, value: Reply) =>
        error ? reject(error) : resolve(value),
      ),
  );
const connect = async () => {
  const { token } = accounts.add(false);
  const socket = io(url, {
    auth: { accessToken: token },
    transports: ["websocket"],
    reconnection: false,
  });
  clients.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  return socket;
};
const queued = (event: string) => logs.filter((l) => l.event === event);
beforeEach(async () => {
  accounts = fakeAccounts();
  clients = [];
  logs = [];
  server = createArenaServer({
    accounts: accounts.provider,
    autoTick: false,
    connectionLog: (event, details) => logs.push({ event, details }),
  });
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  if (!address || typeof address === "string") throw Error("No address");
  url = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  for (const client of clients) client.disconnect();
  await server.close();
});

it("two searching players land in one 1v1 room", async () => {
  const a = await connect();
  const b = await connect();
  const first = await emit(a, "quick-join", {
    name: "A",
    character: "voltkit",
  });
  expect(first).toMatchObject({ ok: true, queued: true, online: 1 });
  const found = new Promise<Reply>((resolve) => a.once("quick-found", resolve));
  const second = await emit(b, "quick-join", {
    name: "B",
    character: "tidefin",
  });
  expect(second.ok).toBe(true);
  expect(second.queued).toBeUndefined();
  const theirs = await found;
  expect(theirs.ok).toBe(true);
  expect(theirs.code).toBe(second.code);
  const arena = server.rooms.get(second.code!)!;
  expect(arena.mode).toBe("duel");
  expect(arena.players).toHaveLength(2);
  expect(arena.bots.size).toBe(0);
  // Picks stay hidden in a PvP lobby: each sees its own browse.
  expect(arena.players.map((p) => p.browse)).toEqual(["voltkit", "tidefin"]);
  expect(queued("arena-queue").map((l) => l.details.outcome)).toEqual([
    "human",
    "human",
  ]);
});

it("a lone player who takes the sparring bot gets a labelled bot, logged as a quick fallback", async () => {
  const a = await connect();
  expect(
    (await emit(a, "quick-join", { name: "A", character: "voltkit" })).queued,
  ).toBe(true);
  const room = await emit(a, "bot-match", {
    name: "A",
    character: "voltkit",
    difficulty: "easy",
    quick: true,
  });
  expect(room.ok).toBe(true);
  const arena = server.rooms.get(room.code!)!;
  expect(arena.bots.size).toBe(1);
  expect(arena.players.find((p) => arena.bots.has(p.id))!.name).toMatch(
    /\(Bot\)$/,
  );
  expect(queued("arena-queue").map((l) => l.details.outcome)).toEqual(["bot"]);
  // Finish the match: one arena-match line, marked as a Quick Match bot.
  arena.winnerTeam = arena.teamOf(arena.players[0]);
  arena.phase = "finished";
  server.broadcast(arena);
  server.broadcast(arena);
  const lines = queued("arena-match");
  expect(lines).toHaveLength(1);
  expect(lines[0].details).toMatchObject({
    mode: "duel",
    humans: 1,
    bots: 1,
    botLevel: "easy",
    quick: "bot",
  });
  expect(JSON.stringify(lines[0].details)).not.toContain("Player");
});

it("cancelling or disconnecting leaves the queue, so nobody is paired with a ghost", async () => {
  const a = await connect();
  const b = await connect();
  await emit(a, "quick-join", { name: "A", character: "voltkit" });
  await emit(a, "quick-leave");
  expect(
    (await emit(b, "quick-join", { name: "B", character: "voltkit" })).queued,
  ).toBe(true);
  b.disconnect();
  await expect.poll(() => queued("arena-queue").length).toBe(2);
  const c = await connect();
  expect(
    (await emit(c, "quick-join", { name: "C", character: "voltkit" })).queued,
  ).toBe(true);
  expect(queued("arena-queue").map((l) => l.details.outcome)).toEqual([
    "cancel",
    "disconnect",
  ]);
});

it("a player already in a room can't search", async () => {
  const a = await connect();
  expect((await emit(a, "create", { name: "A" })).ok).toBe(true);
  const r = await emit(a, "quick-join", { name: "A", character: "voltkit" });
  expect(r.ok).toBe(false);
});
