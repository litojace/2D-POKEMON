import { afterEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";

/**
 * A new player opened the sign-up confirmation link and was told the game
 * was "playing on another device" (25 Nov). Socket.IO's client sends its
 * CONNECT again when `connect()` is called while the first is still
 * waiting for the server's answer, on the same connection; the app does
 * that when the sign-in is announced twice with the same login (the
 * confirmation link), or when the iPhone app comes back while connecting.
 * The server took the second CONNECT for a second device, told the first
 * "session-replaced" (which the one tab receives) and closed the
 * connection. Two CONNECTs on one connection are one tab: the older is
 * dropped quietly. A second connection still takes over, as before.
 */
let server: ReturnType<typeof createArenaServer> | undefined;
const clients: Socket[] = [];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
afterEach(async () => {
  clients.splice(0).forEach((c) => c.disconnect());
  await server?.close();
  server = undefined;
});
async function setup(loginMs = 0) {
  const accounts = fakeAccounts();
  const log: { event: string; details: Record<string, unknown> }[] = [];
  const { token, account } = accounts.add(false);
  const real = accounts.provider.authenticate;
  accounts.provider.authenticate = async (t) => {
    await wait(loginMs);
    return real(t);
  };
  accounts.provider.rpc = async () => [];
  server = createArenaServer({
    accounts: accounts.provider,
    autoTick: false,
    connectionLog: (event, details) => log.push({ event, details }),
  });
  await new Promise<void>((r) => server!.http.listen(0, "127.0.0.1", r));
  const url =
    "http://127.0.0.1:" + (server.http.address() as { port: number }).port;
  const open = (transports?: string[]) => {
    const socket = io(url, {
      autoConnect: false,
      forceNew: true,
      auth: { accessToken: token },
      ...(transports ? { transports } : {}),
    });
    clients.push(socket);
    const heard: string[] = [];
    socket.on("session-replaced", () => heard.push("session-replaced"));
    socket.on("disconnect", (reason) => heard.push(`disconnect: ${reason}`));
    return { socket, heard };
  };
  return { server: server!, account, open, log };
}
/** Connect, and connect again before the server has answered. */
async function connectTwice(socket: Socket) {
  socket.connect();
  await new Promise<void>((r) => socket.io.once("open", () => r()));
  socket.connect();
  await wait(600);
}

// The server's login check takes a moment (here 100 ms, Supabase in
// production), so the second CONNECT always arrives while the first waits.
// (One arriving after the first was answered is Socket.IO's own business:
// its server closes the connection as an invalid state and the client
// reconnects by itself, never told "session-replaced". Only the client can
// avoid that one: main.ts no longer calls connect() while connecting.)
for (const transports of [undefined, ["websocket"]])
  it(`one tab connecting twice stays connected (${transports ? "websocket" : "polling first"})`, async () => {
    const { server, account, open, log } = await setup(100);
    const { socket, heard } = open(transports);
    await connectTwice(socket);
    expect(heard).toEqual([]);
    expect(socket.connected).toBe(true);
    // One server socket for the tab, and it is the one the tab uses.
    const mine = [...server.io.sockets.sockets.values()].filter(
      (s) => s.data.account?.id === account.id,
    );
    expect(mine.map((s) => s.id)).toEqual([socket.id]);
    // The tab still talks to the server (its events reach a live socket).
    await expect(
      socket.timeout(1000).emitWithAck("rtt", {}),
    ).resolves.toBeUndefined();
    // Logged once, so production shows how often it happens.
    expect(log.filter((l) => l.event === "arena-twin-connect")).toHaveLength(1);
  });

it("a second device still takes the account over", async () => {
  const { open } = await setup();
  const first = open(["websocket"]);
  first.socket.connect();
  await new Promise<void>((r) => first.socket.once("connect", () => r()));
  const second = open(["websocket"]);
  second.socket.connect();
  await new Promise<void>((r) => second.socket.once("connect", () => r()));
  await wait(200);
  expect(first.heard).toEqual([
    "session-replaced",
    "disconnect: io server disconnect",
  ]);
  expect(second.heard).toEqual([]);
  expect(second.socket.connected).toBe(true);
});
