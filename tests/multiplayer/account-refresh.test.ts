import { afterEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server.js";
import { fakeAccounts } from "../helpers/accounts";

/**
 * Every signed-in connection's account is checked again every 30 seconds
 * (a suspension, a new name or title, the chat's block list). All of them
 * were checked in the same instant, and each was then told "account-changed"
 * whether or not anything had: the app answers that by loading its profile
 * and three more records again (performance sweep, S3). Now each connection
 * has its own moment in the 30 seconds, and hears "account-changed" only
 * when its account did change.
 */
let server: ReturnType<typeof createArenaServer> | undefined,
  clients: Socket[] = [];
const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms));
async function setup(players: number) {
  const accounts = fakeAccounts();
  const checks: string[] = [];
  const authenticate = accounts.provider.authenticate;
  accounts.provider.authenticate = async (token) => {
    checks.push(token);
    return authenticate(token);
  };
  accounts.provider.rpc = async () => [];
  server = createArenaServer({
    autoTick: false,
    reconnectMs: 60_000,
    accounts: accounts.provider,
  });
  await new Promise<void>((r) => server!.http.listen(0, "127.0.0.1", r));
  const { port } = server.http.address() as { port: number };
  const sockets: Socket[] = [];
  const tokens: string[] = [];
  const heard: number[] = [];
  for (let i = 0; i < players; i++) {
    const { token } = accounts.add(false);
    const socket = io(`http://127.0.0.1:${port}`, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
      auth: { accessToken: token },
    });
    clients.push(socket);
    await new Promise<void>((r) => socket.on("connect", r));
    socket.on("account-changed", () => heard.push(i));
    sockets.push(socket);
    tokens.push(token);
  }
  await wait();
  checks.length = 0;
  return {
    accounts,
    sockets,
    tokens,
    heard,
    checks,
    server: server!,
    url: `http://127.0.0.1:${port}`,
  };
}
afterEach(async () => {
  for (const c of clients) c.disconnect();
  clients = [];
  await server?.close();
  server = undefined;
});

it("says account-changed only to a connection whose account changed", async () => {
  const { accounts, tokens, heard, checks, server } = await setup(3);
  await server.refreshAccounts();
  await wait();
  // Everyone was checked; nobody's account changed.
  expect(checks.slice().sort()).toEqual(tokens.slice().sort());
  expect(heard).toEqual([]);
  // The second player's name changes (a rename, an admin's edit).
  accounts.users.set(tokens[1], {
    ...accounts.users.get(tokens[1])!,
    displayName: "Renamed",
  });
  await server.refreshAccounts();
  await wait();
  expect(heard).toEqual([1]);
  // Told once: the next check finds nothing new.
  await server.refreshAccounts();
  await wait();
  expect(heard).toEqual([1]);
  // A new title, or one more owned, counts as a change too.
  accounts.users.set(tokens[2], {
    ...accounts.users.get(tokens[2])!,
    title: "Champion",
    titleColor: "#ffcc00",
  });
  await server.refreshAccounts();
  await wait();
  expect(heard).toEqual([1, 2]);
});

it("checks each connection at its own moment in the 30 seconds, every one of them once", async () => {
  const players = 24;
  const { tokens, checks, server } = await setup(players);
  const start = Date.now();
  // The timer's own work, second by second, long enough for two checks (a
  // connection's first check comes 15 to 45 s after it connects).
  const perSecond: number[] = [];
  const seenAt = new Map<string, number[]>();
  for (let s = 1; s <= 80; s++) {
    const before = checks.length;
    await server.refreshDueAccounts(start + s * 1000);
    perSecond.push(checks.length - before);
    for (const token of checks.slice(before))
      seenAt.set(token, [...(seenAt.get(token) ?? []), s]);
  }
  // Never the whole server in one second (24 before).
  expect(Math.max(...perSecond)).toBeLessThanOrEqual(players / 4);
  // Nobody is left out, and each is checked every 30 seconds.
  for (const token of tokens) {
    const at = seenAt.get(token) ?? [];
    expect(at.length).toBeGreaterThanOrEqual(2);
    expect(at[0]).toBeGreaterThanOrEqual(15);
    expect(at[0]).toBeLessThanOrEqual(46);
    expect(at[1] - at[0]).toBe(30);
  }
});

it("still tells a player at once when a route changed something of theirs", async () => {
  const { accounts, tokens, heard, url } = await setup(2);
  // An admin gives the second player coins: nothing in the account record
  // changes, yet their app must load its Shop record again.
  const admin = accounts.add(true);
  const player = accounts.users.get(tokens[1])!;
  const response = await fetch(`${url}/api/admin/coins`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${admin.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      playerId: player.id,
      amount: 100,
      reason: "A gift",
      ref: "7d3f5a0e-1c2b-4d6e-8f90-123456789abc",
    }),
  });
  expect(response.status).toBe(200);
  await wait(80);
  expect(heard).toEqual([1]);
});
