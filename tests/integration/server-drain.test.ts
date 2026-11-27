import { afterEach, beforeEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { DRAIN_MESSAGE, MOVE_MESSAGE } from "../../apps/server/src/drain";
import { fakeAccounts } from "../helpers/accounts";
import type { Reply } from "../../packages/shared/src/index";

// A deploy replaces the server (docs/server-updates.md): matches in progress
// play on, new ones are refused, and shutdown waits for rewards to save.
let server: ReturnType<typeof createArenaServer>,
  accounts: ReturnType<typeof fakeAccounts>,
  url: string,
  clients: Socket[];
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
beforeEach(async () => {
  accounts = fakeAccounts();
  clients = [];
  server = createArenaServer({ accounts: accounts.provider, autoTick: false });
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

it("lets a running match finish, refuses new ones, and tells every player", async () => {
  const fighter = await connect();
  const host = await connect();
  const match = await emit(fighter, "bot-match", {
    name: "A",
    character: "voltkit",
    difficulty: "easy",
  });
  expect(match.ok).toBe(true);
  const arena = server.rooms.get(match.code!)!;
  expect(arena.phase).not.toBe("lobby");
  const lobby = await emit(host, "create", { name: "Host", mode: "duel" });
  expect(lobby.ok).toBe(true);

  const told = Promise.all(
    [fighter, host].map(
      (s) => new Promise((resolve) => s.once("server-update", resolve)),
    ),
  );
  let drained = false;
  const drain = server
    .drain(Date.now() + 60000, 5)
    .then((r) => ((drained = true), r));
  expect(server.draining).toBe(true);
  // Move to the new server once out of a match, and how long a match has.
  for (const notice of (await told) as {
    reconnect: boolean;
    draining: boolean;
    left: number;
  }[]) {
    expect(notice).toMatchObject({ reconnect: true, draining: true });
    expect(notice.left).toBeGreaterThan(58_000);
    expect(notice.left).toBeLessThanOrEqual(60_000);
  }

  // The match keeps its room; the lobby cannot start a new one.
  expect(await emit(host, "ready")).toEqual({
    ok: false,
    error: DRAIN_MESSAGE,
  });
  const late = await connect();
  const refused = await emit(late, "create", { name: "Late", mode: "duel" });
  expect(refused).toEqual({ ok: false, error: DRAIN_MESSAGE });
  expect(
    (await emit(late, "quick-join", { name: "Late", character: "tidefin" }))
      .error,
  ).toBe(DRAIN_MESSAGE);
  await new Promise((r) => setTimeout(r, 30));
  expect(drained).toBe(false);
  expect(server.rooms.get(match.code!)).toBe(arena);

  // The match ends: shutdown may go ahead, and no rematch starts.
  arena.phase = "finished";
  expect(await drain).toEqual({ finished: true, busy: 0, saving: 0 });
  expect((await emit(fighter, "rematch")).error).toBe(DRAIN_MESSAGE);
});

it("waits for the rewards of a match that just ended to save", async () => {
  let save!: () => void;
  const receipts: unknown[] = [];
  accounts.provider.recordActivity = (receipt) =>
    new Promise<void>((resolve) => {
      receipts.push(receipt);
      save = resolve;
    });
  const fighter = await connect();
  const match = await emit(fighter, "bot-match", {
    name: "A",
    character: "voltkit",
    difficulty: "easy",
  });
  const arena = server.rooms.get(match.code!)!;
  let drained = false;
  const drain = server
    .drain(Date.now() + 60000, 5)
    .then((r) => ((drained = true), r));
  arena.winnerTeam = arena.teamOf(arena.players[0]);
  arena.phase = "finished";
  server.broadcast(arena);
  expect(receipts).toHaveLength(1);
  await new Promise((r) => setTimeout(r, 30));
  expect(drained).toBe(false);
  save();
  // Its rewards are saved; its record waits for the player's game to file
  // it (match-report-deploy.test.ts), then nothing keeps the server.
  await new Promise((r) => setTimeout(r, 30));
  expect(drained).toBe(false);
  accounts.provider.rpc = async () => ({
    confirmed: true,
    achievements: [],
    rating: null,
  });
  const filed = await emit(fighter, "match-report", {
    matchId: arena.matchId,
  });
  expect(filed.ok).toBe(true);
  expect(await drain).toEqual({ finished: true, busy: 0, saving: 0 });
});

it("gives up at the deadline so the process can still exit", async () => {
  const fighter = await connect();
  const match = await emit(fighter, "bot-match", {
    name: "A",
    character: "voltkit",
    difficulty: "easy",
  });
  expect(match.ok).toBe(true);
  expect(await server.drain(Date.now() + 40, 5)).toEqual({
    finished: false,
    busy: 1,
    saving: 0,
  });
});

// Render puts the new server in front about two minutes before it asks the
// old one to stop. The old one notices on its own public address
// (/api/health answers with another server's id): its players move over
// once out of a match, so no new match starts on a server about to go.
it("says which server answers /api/health", async () => {
  const reply = await (await fetch(`${url}/api/health`)).json();
  expect(reply).toMatchObject({ ok: true, server: server.serverId });
  expect(server.serverId).toMatch(/^[0-9a-f]{8}$/);
});

it("moves its players to a newer server, keeps a match going, refuses new ones", async () => {
  await server.close();
  let answer: unknown = { ok: true };
  server = createArenaServer({
    accounts: accounts.provider,
    autoTick: false,
    publicHealthUrl: "https://arena.example/api/health",
    supersedeEvery: 3_600_000,
    fetchHealth: async () => answer,
  });
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  if (!address || typeof address === "string") throw Error("No address");
  url = `http://127.0.0.1:${address.port}`;
  const fighter = await connect();
  const idle = await connect();
  const match = await emit(fighter, "bot-match", {
    name: "A",
    character: "voltkit",
    difficulty: "easy",
  });
  expect(match.ok).toBe(true);

  // Its own reply, one with no id (an older build), or none: nothing moves.
  for (const reply of [{ ok: true, server: server.serverId }, { ok: true }]) {
    answer = reply;
    await server.checkSuperseded();
    expect(server.superseded).toBe(false);
  }
  answer = Promise.reject(new Error("unreachable"));
  await server.checkSuperseded();
  expect(server.superseded).toBe(false);

  const told = Promise.all(
    [fighter, idle].map(
      (s) => new Promise((resolve) => s.once("server-update", resolve)),
    ),
  );
  answer = { ok: true, server: "0badc0de" };
  await server.checkSuperseded();
  expect(server.superseded).toBe(true);
  expect(server.draining).toBe(false);
  expect(await told).toEqual([{ reconnect: true }, { reconnect: true }]);

  // The match plays on here; a new one is refused, and asked to move again.
  expect(server.rooms.get(match.code!)).toBeDefined();
  const again = new Promise((resolve) => idle.once("server-update", resolve));
  expect(await emit(idle, "create", { name: "Late", mode: "duel" })).toEqual({
    ok: false,
    error: MOVE_MESSAGE,
  });
  expect(await again).toEqual({ reconnect: true });

  // Render then asks it to stop: the countdown starts from the drain.
  const counted = new Promise((resolve) =>
    fighter.once("server-update", resolve),
  );
  void server.drain(Date.now() + 30_000, 5);
  expect(await counted).toMatchObject({ reconnect: true, draining: true });
});

it("tells players still in a match why they are cut off when time runs out", async () => {
  const fighter = await connect();
  await emit(fighter, "bot-match", {
    name: "A",
    character: "voltkit",
    difficulty: "easy",
  });
  await server.drain(Date.now() + 20, 5);
  const closing = new Promise((resolve) =>
    fighter.once("server-update", resolve),
  );
  const closed = server.close();
  expect(await closing).toEqual({ closing: true });
  await closed;
  // afterEach closes it again: a second close must not throw.
});
