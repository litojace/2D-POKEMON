import { afterEach, beforeEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { DRAIN_MESSAGE } from "../../apps/server/src/drain";
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
  expect(await told).toEqual([{ draining: true }, { draining: true }]);

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
