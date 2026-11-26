import { afterEach, beforeEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";
import { RULES, type Reply } from "../../packages/shared/src/index";

// A new player's short first matches against a bot (INTRO_ROUNDS), through
// real sockets: the server asks the account's records how many matches it
// has finished, and only a solo bot match is ever shortened.
let server: ReturnType<typeof createArenaServer>,
  accounts: ReturnType<typeof fakeAccounts>,
  url: string,
  clients: Socket[],
  logs: { event: string; details: Record<string, unknown> }[],
  receipts: any[],
  /** What arena_my_progress answers: a count, an error, or never. */
  matches: number | "error" | "slow",
  asked: number;
const emit = (socket: Socket, event: string, data: unknown = {}) =>
  new Promise<Reply>((resolve, reject) =>
    socket
      .timeout(4000)
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
const botMatch = (socket: Socket, extra: object = {}) =>
  emit(socket, "bot-match", {
    name: "A",
    character: "voltkit",
    difficulty: "easy",
    ...extra,
  });
/** End the match in the human's favour and let the server file it. */
function finish(code: string) {
  const arena = server.rooms.get(code)!;
  const me = arena.players.find((p) => !arena.bots.has(p.id))!;
  arena.forfeit(me.id);
  server.broadcast(arena);
  return arena;
}
beforeEach(async () => {
  accounts = fakeAccounts();
  clients = [];
  logs = [];
  receipts = [];
  matches = 0;
  asked = 0;
  accounts.provider.recordActivity = async (r) => void receipts.push(r);
  accounts.provider.rpc = async (_token, name) => {
    if (name !== "arena_my_progress") throw new Error(`Unexpected ${name}`);
    asked++;
    if (matches === "error") throw new Error("No records");
    if (matches === "slow") return new Promise(() => {});
    return {
      matches,
      wins: 0,
      achievements: [],
      fighters: {},
      season: { id: "2026-11", matches, wins: 0 },
    };
  };
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

it("a new account's first bot match is one round, and the database is told", async () => {
  const a = await connect();
  const room = await botMatch(a);
  expect(room.ok).toBe(true);
  const arena = server.rooms.get(room.code!)!;
  expect(arena.roundsToWin).toBe(1);
  expect(arena.snapshot().introRounds).toBe(1);
  finish(room.code!);
  await expect.poll(() => receipts.length).toBe(1);
  expect(receipts[0].players[0]).toMatchObject({
    won: true,
    botLevel: "easy",
    intro: 1,
  });
  // Counted in the match log, to measure the change.
  const line = logs.find((l) => l.event === "arena-match")!;
  expect(line.details).toMatchObject({ intro: 1, rounds: 0 });
});

it("the second is first to two, and from the third on a match has its full length", async () => {
  matches = 1;
  const a = await connect();
  const second = await botMatch(a);
  expect(server.rooms.get(second.code!)!.roundsToWin).toBe(2);
  await emit(a, "leave");
  matches = 2;
  const third = await botMatch(a);
  const arena = server.rooms.get(third.code!)!;
  expect(arena.roundsToWin).toBe(RULES.roundsToWin);
  expect(arena.snapshot().introRounds).toBeUndefined();
  finish(third.code!);
  // (Leaving the second match early filed it too, as a loss.)
  await expect
    .poll(() => receipts.filter((r) => r.players[0].won).length)
    .toBe(1);
  expect(receipts.find((r) => r.players[0].won).players[0].intro).toBeNull();
});

it("a rematch counts on: one round, two, then full, without asking again", async () => {
  const a = await connect();
  const room = await botMatch(a);
  const arena = server.rooms.get(room.code!)!;
  expect(arena.roundsToWin).toBe(1);
  finish(room.code!);
  expect((await emit(a, "rematch")).ok).toBe(true);
  expect(arena.phase).not.toBe("finished");
  expect(arena.roundsToWin).toBe(2);
  finish(room.code!);
  expect((await emit(a, "rematch")).ok).toBe(true);
  expect(arena.roundsToWin).toBe(RULES.roundsToWin);
  expect(asked).toBe(1);
  await expect.poll(() => receipts.length).toBe(2);
  expect(receipts.map((r) => r.players[0].intro)).toEqual([1, 2]);
});

it("an account past its first matches is asked once per connection", async () => {
  matches = 12;
  const a = await connect();
  for (let i = 0; i < 3; i++) {
    const room = await botMatch(a);
    expect(server.rooms.get(room.code!)!.roundsToWin).toBe(RULES.roundsToWin);
    await emit(a, "leave");
  }
  expect(asked).toBe(1);
});

it("records that can't be read, or take too long, mean a full match", async () => {
  matches = "error";
  const a = await connect();
  const failed = await botMatch(a);
  expect(failed.ok).toBe(true);
  expect(server.rooms.get(failed.code!)!.roundsToWin).toBe(RULES.roundsToWin);
  await emit(a, "leave");
  matches = "slow";
  const started = Date.now();
  const slow = await botMatch(a);
  expect(slow.ok).toBe(true);
  // It waited for the answer a moment, not for ever.
  expect(Date.now() - started).toBeLessThan(3500);
  expect(server.rooms.get(slow.code!)!.roundsToWin).toBe(RULES.roundsToWin);
});

it("two taps on Play make one room", async () => {
  const a = await connect();
  const [first, second] = await Promise.all([botMatch(a), botMatch(a)]);
  expect([first.ok, second.ok].sort()).toEqual([false, true]);
  expect(server.rooms.size).toBe(1);
});

it("the weekly arcade and rooms between players keep their length", async () => {
  const a = await connect();
  const b = await connect();
  const room = await emit(a, "create", { name: "A", mode: "duel" });
  expect(room.ok).toBe(true);
  const arena = server.rooms.get(room.code!)!;
  expect(arena.introPlayed).toBeUndefined();
  expect(arena.roundsToWin).toBe(RULES.roundsToWin);
  // Quick Match between two new players: a full match.
  const c = await connect();
  await emit(b, "quick-join", { name: "B", character: "voltkit" });
  const found = await emit(c, "quick-join", {
    name: "C",
    character: "tidefin",
  });
  expect(server.rooms.get(found.code!)!.roundsToWin).toBe(RULES.roundsToWin);
  expect(asked).toBe(0);
});

it("Quick Match's fallback bot is a new player's short match too", async () => {
  const a = await connect();
  await emit(a, "quick-join", { name: "A", character: "voltkit" });
  const room = await botMatch(a, { quick: true });
  expect(server.rooms.get(room.code!)!.roundsToWin).toBe(1);
  finish(room.code!);
  await expect.poll(() => receipts.length).toBe(1);
  expect(receipts[0].players[0]).toMatchObject({ quick: "bot", intro: 1 });
});
