import { afterEach, beforeEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";
import { RULES, type Reply } from "../../packages/shared/src/index";

// 2v2 and Free-for-all with bots in the empty seats (docs/pvp-plan.md,
// "Bots fill in"), through real sockets.
let server: ReturnType<typeof createArenaServer>,
  accounts: ReturnType<typeof fakeAccounts>,
  url: string,
  clients: Socket[],
  logs: { event: string; details: Record<string, unknown> }[],
  receipts: any[];
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
const found = (socket: Socket) =>
  new Promise<Reply>((resolve) => socket.once("quick-found", resolve));
const search = (socket: Socket, mode: string, character = "voltkit") =>
  emit(socket, "quick-join", { name: "P", character, mode });
const humans = (code: string) => {
  const arena = server.rooms.get(code)!;
  return arena.players.filter((p) => !arena.bots.has(p.id));
};
beforeEach(async () => {
  accounts = fakeAccounts();
  clients = [];
  logs = [];
  receipts = [];
  accounts.provider.recordActivity = async (r) => void receipts.push(r);
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

it("alone in 2v2: a bot teammate, two bot opponents, and the match starts at once", async () => {
  const a = await connect();
  expect(await search(a, "teams", "tidefin")).toMatchObject({
    ok: true,
    queued: true,
  });
  expect(server.rooms.size).toBe(0);
  const room = found(a);
  expect((await emit(a, "quick-fill", { difficulty: "easy" })).ok).toBe(true);
  const reply = await room;
  expect(reply).toMatchObject({ ok: true, started: true });
  const arena = server.rooms.get(reply.code!)!;
  expect(arena.mode).toBe("teams");
  expect(arena.players).toHaveLength(4);
  expect(arena.bots.size).toBe(3);
  expect(arena.phase).not.toBe("lobby");
  // Two a side; the player has the fighter they searched with.
  const me = humans(reply.code!)[0];
  expect(me.character).toBe("tidefin");
  expect(arena.players.filter((p) => arena.teamOf(p) === 0)).toHaveLength(2);
  expect(arena.players.filter((p) => arena.teamOf(p) === 1)).toHaveLength(2);
  // Every bot says it is one, with its level, and no two share a name.
  const bots = arena.players.filter((p) => arena.bots.has(p.id));
  for (const b of bots) {
    expect(b.name).toMatch(/\(Bot\)$/);
    expect(b.title).toBe("AI · Easy");
  }
  expect(new Set(bots.map((b) => b.name)).size).toBe(3);
  // One of each fighter a team.
  for (const team of [0, 1]) {
    const picks = arena.players
      .filter((p) => arena.teamOf(p) === team)
      .map((p) => p.character);
    expect(new Set(picks).size).toBe(picks.length);
  }
  // A full-length match: a new player's short matches are bot duels only.
  expect(arena.roundsToWin).toBe(RULES.roundsToWin);
});

it("alone in Free-for-all: three bots", async () => {
  const a = await connect();
  await search(a, "ffa");
  const room = found(a);
  await emit(a, "quick-fill", { difficulty: "normal" });
  const reply = await room;
  const arena = server.rooms.get(reply.code!)!;
  expect(arena.mode).toBe("ffa");
  expect(arena.players).toHaveLength(4);
  expect(arena.bots.size).toBe(3);
  expect(reply.started).toBe(true);
  // Four different fighters.
  expect(new Set(arena.players.map((p) => p.character)).size).toBe(4);
});

it("two searching 2v2 share the room, on opposite teams, and pick in it first", async () => {
  const a = await connect();
  const b = await connect();
  await search(a, "teams");
  await search(b, "teams", "cindrake");
  const [roomA, roomB] = [found(a), found(b)];
  // The second to search starts it.
  await emit(b, "quick-fill", { difficulty: "normal" });
  const [ra, rb] = await Promise.all([roomA, roomB]);
  expect(ra.code).toBe(rb.code);
  expect(ra.started).toBe(false);
  const arena = server.rooms.get(ra.code!)!;
  expect(arena.phase).toBe("lobby");
  expect(humans(ra.code!)).toHaveLength(2);
  expect(arena.bots.size).toBe(2);
  const [h1, h2] = humans(ra.code!);
  expect(arena.teamOf(h1)).not.toBe(arena.teamOf(h2));
  // Their picks are hidden until the match (a PvP room).
  expect(
    humans(ra.code!)
      .map((p) => p.browse)
      .sort(),
  ).toEqual(["cindrake", "voltkit"]);
  // Both ready: it starts, bots and all.
  expect((await emit(a, "ready")).ok).toBe(true);
  expect(arena.phase).toBe("lobby");
  expect((await emit(b, "ready")).ok).toBe(true);
  expect(arena.phase).not.toBe("lobby");
});

it("a player who leaves that room gives their seat to a bot at Ready", async () => {
  const a = await connect();
  const b = await connect();
  await search(a, "teams");
  await search(b, "teams");
  const [roomA, roomB] = [found(a), found(b)];
  await emit(a, "quick-fill", { difficulty: "hard" });
  const [ra] = await Promise.all([roomA, roomB]);
  const arena = server.rooms.get(ra.code!)!;
  await emit(b, "leave");
  expect(arena.players).toHaveLength(3);
  expect((await emit(a, "ready")).ok).toBe(true);
  expect(arena.players).toHaveLength(4);
  expect(arena.bots.size).toBe(3);
  expect(arena.phase).not.toBe("lobby");
});

it("shuffling the teams keeps the bots ready, so the room can still start", async () => {
  const a = await connect();
  const b = await connect();
  await search(a, "teams");
  await search(b, "teams", "cindrake");
  const [roomA, roomB] = [found(a), found(b)];
  await emit(a, "quick-fill", { difficulty: "normal" });
  const [ra] = await Promise.all([roomA, roomB]);
  const arena = server.rooms.get(ra.code!)!;
  const host = arena.players[0];
  const hostSocket = humans(ra.code!)[0] === host ? a : b;
  for (let i = 0; i < 6; i++)
    expect((await emit(hostSocket, "shuffle")).ok).toBe(true);
  const bots = arena.players.filter((p) => arena.bots.has(p.id));
  expect(bots).toHaveLength(2);
  for (const bot of bots) {
    expect(bot.ready).toBe(true);
    expect(bot.locked).toBe(true);
  }
  // Still two a side, one of each fighter a team.
  for (const team of [0, 1]) {
    const side = arena.players.filter((p) => arena.teamOf(p) === team);
    expect(side).toHaveLength(2);
    const shown = side.map((p) => p.browse ?? p.character);
    expect(new Set(shown).size).toBe(2);
  }
  expect((await emit(a, "ready")).ok).toBe(true);
  expect((await emit(b, "ready")).ok).toBe(true);
  expect(arena.phase).not.toBe("lobby");
});

it("four searching Free-for-all play at once, without bots", async () => {
  const sockets = [await connect(), await connect(), await connect()];
  for (const s of sockets) expect((await search(s, "ffa")).queued).toBe(true);
  const last = await connect();
  const rooms = [...sockets, last].map(found);
  expect((await search(last, "ffa")).ok).toBe(true);
  const replies = await Promise.all(rooms);
  expect(new Set(replies.map((r) => r.code)).size).toBe(1);
  const arena = server.rooms.get(replies[0].code!)!;
  expect(arena.players).toHaveLength(4);
  expect(arena.bots.size).toBe(0);
  expect(arena.phase).toBe("lobby");
});

it("the two modes and the 1v1 queue never mix", async () => {
  const a = await connect();
  const b = await connect();
  const c = await connect();
  await search(a, "teams");
  await search(b, "ffa");
  // A 1v1 searcher meets neither.
  expect(
    (await emit(c, "quick-join", { name: "C", character: "voltkit" })).queued,
  ).toBe(true);
  const room = found(a);
  await emit(a, "quick-fill", { difficulty: "normal" });
  const reply = await room;
  expect(humans(reply.code!)).toHaveLength(1);
  expect(server.rooms.size).toBe(1);
});

it("cancelling, disconnecting or starting without a search leaves no room", async () => {
  const a = await connect();
  expect((await emit(a, "quick-fill", { difficulty: "normal" })).ok).toBe(
    false,
  );
  await search(a, "teams");
  await emit(a, "quick-leave");
  expect((await emit(a, "quick-fill", { difficulty: "normal" })).ok).toBe(
    false,
  );
  const b = await connect();
  await search(b, "ffa");
  b.disconnect();
  await expect
    .poll(() => logs.filter((l) => l.event === "arena-queue").length)
    .toBe(2);
  // Nobody is left to share a match with.
  const c = await connect();
  await search(c, "ffa");
  const room = found(c);
  await emit(c, "quick-fill", { difficulty: "normal" });
  expect(humans((await room).code!)).toHaveLength(1);
  expect(
    logs.filter((l) => l.event === "arena-queue").map((l) => l.details.outcome),
  ).toEqual(["cancel", "disconnect", "bot"]);
});

it("a party can't search (it makes its own room), and a player in a room can't either", async () => {
  const a = await connect();
  await emit(a, "create", { name: "A", mode: "duel" });
  expect((await search(a, "teams")).ok).toBe(false);
});

it("a match with bots is told to the database as a bot match: no rating, the bot's XP", async () => {
  const a = await connect();
  await search(a, "teams");
  const room = found(a);
  await emit(a, "quick-fill", { difficulty: "normal" });
  const reply = await room;
  const arena = server.rooms.get(reply.code!)!;
  const me = humans(reply.code!)[0];
  arena.forfeit(me.id);
  server.broadcast(arena);
  await expect.poll(() => receipts.length).toBe(1);
  expect(receipts[0].players).toHaveLength(1);
  expect(receipts[0].players[0]).toMatchObject({
    won: true,
    vsPeople: false,
    botLevel: "normal",
    quick: "bot",
    mode: "teams",
    intro: null,
  });
  const line = logs.find((l) => l.event === "arena-match")!;
  expect(line.details).toMatchObject({
    mode: "teams",
    humans: 1,
    bots: 3,
    quick: "bot",
  });
});

// The bots really play it: a whole match alone with them, stepped by the
// server, ends with a winner and with every bot having fought.
for (const mode of ["teams", "ffa"] as const)
  it(`bots play a whole ${mode} match to its end`, async () => {
    const a = await connect();
    await search(a, mode);
    const room = found(a);
    await emit(a, "quick-fill", { difficulty: "normal" });
    const reply = await room;
    const arena = server.rooms.get(reply.code!)!;
    expect((await emit(a, "instructions-ready")).ok).toBe(true);
    let steps = 0;
    while (arena.phase !== "finished" && steps < 60_000) {
      server.step();
      steps++;
    }
    expect(arena.phase).toBe("finished");
    expect(arena.roundLog.length).toBeGreaterThanOrEqual(RULES.roundsToWin);
    const bots = arena.players.filter((p) => arena.bots.has(p.id));
    expect(bots).toHaveLength(3);
    for (const b of bots) expect(b.stats.dealt).toBeGreaterThan(0);
    // The player's match is filed for them, as a bot match.
    await expect.poll(() => receipts.length).toBe(1);
    expect(receipts[0].players[0]).toMatchObject({ mode, botLevel: "normal" });
  }, 120_000);
