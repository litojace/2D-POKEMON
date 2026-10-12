import { beforeEach, afterEach, it, expect } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";
import type { Reply } from "../../packages/shared/src/index";
let server: ReturnType<typeof createArenaServer>,
  accounts: ReturnType<typeof fakeAccounts>,
  url: string,
  clients: Socket[];
const emit = (
  socket: Socket,
  event: string,
  data: unknown = {},
): Promise<Reply> =>
  new Promise((resolve, reject) =>
    socket
      .timeout(2000)
      .emit(event, data, (error: Error | null, value: Reply) =>
        error ? reject(error) : resolve(value),
      ),
  );
const connect = async (token?: string) => {
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
it("rejects anonymous gameplay and forged admin payloads", async () => {
  const guest = await connect();
  expect((await emit(guest, "create", { name: "Guest" })).ok).toBe(false);
  expect(
    (
      await emit(guest, "practice", {
        name: "Guest",
        character: "voltling",
        isAdmin: true,
      })
    ).ok,
  ).toBe(false);
  const player = accounts.add(false);
  const socket = await connect(player.token);
  expect(
    (await emit(socket, "practice", { name: "Tester", character: "voltling" }))
      .error,
  ).toContain("Admin");
  expect((await emit(socket, "create", { name: "Invented name" })).ok).toBe(
    true,
  );
  expect([...server.rooms.values()][0].players[0].name).toBe(
    player.account.displayName,
  );
  expect(
    (
      await fetch(`${url}/api/admin/players`, {
        headers: { Authorization: `Bearer ${player.token}` },
      })
    ).status,
  ).toBe(403);
});
it("rejects invalid credentials, suspension, and account reuse", async () => {
  await expect(connect("invalid")).rejects.toThrow("expired");
  const banned = accounts.add();
  banned.account.suspended = true;
  await expect(connect(banned.token)).rejects.toThrow("suspended");
  const user = accounts.add(false);
  const one = await connect(user.token),
    two = await connect(user.token);
  await emit(one, "create", { name: "One" });
  expect((await emit(two, "create", { name: "Two" })).ok).toBe(false);
  expect(server.rooms.size).toBe(1);
});
it("revoked administrators cannot change or restart a practice session", async () => {
  const admin = accounts.add();
  const socket = await connect(admin.token);
  await emit(socket, "practice", { name: "Admin", character: "voltling" });
  admin.account.isAdmin = false;
  expect(
    (
      await emit(socket, "practice-options", {
        unlimitedCooldowns: true,
        targetAttacks: true,
      })
    ).ok,
  ).toBe(false);
  expect((await emit(socket, "practice-character", "auralith")).ok).toBe(false);
  expect((await emit(socket, "practice-reset")).ok).toBe(false);
});
it("a revoked administrator cannot reconnect into their previous test session", async () => {
  const admin = accounts.add();
  const socket = await connect(admin.token);
  const room = await emit(socket, "practice", {
    name: "Admin",
    character: "voltling",
  });
  socket.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 30));
  admin.account.isAdmin = false;
  const replacement = await connect(admin.token);
  expect(
    (await emit(replacement, "resume", { token: room.token })).error,
  ).toContain("Admin");
  expect(server.rooms.get(room.code!)!.phase).toBe("paused");
});
it("checks HTTP authorization, payloads, origin and title ownership RPC paths", async () => {
  const admin = accounts.add(),
    player = accounts.add(false);
  const calls: {
    token: string;
    name: string;
    args: Record<string, unknown>;
  }[] = [];
  accounts.provider.rpc = async (token, name, args) => {
    calls.push({ token, name, args });
    return name === "arena_admin_players"
      ? { players: [], total: 0 }
      : { ok: true };
  };
  expect((await fetch(`${url}/api/account`)).status).toBe(401);
  expect(
    (
      await fetch(`${url}/api/account`, {
        headers: { Authorization: `Bearer ${player.token}` },
      })
    ).status,
  ).toBe(200);
  const headers = {
    Authorization: `Bearer ${admin.token}`,
    "Content-Type": "application/json",
  };
  expect(
    (
      await fetch(`${url}/api/admin/titles`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: null,
          name: "Champion",
          description: "First win",
          color: "#d5f778",
          active: true,
        }),
      })
    ).status,
  ).toBe(200);
  expect(calls.at(-1)?.name).toBe("arena_admin_save_title");
  expect(
    (
      await fetch(`${url}/api/admin/players`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: player.account.id,
          displayName: "Renamed",
          suspended: true,
          role: "admin",
        }),
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await fetch(`${url}/api/account/title`, {
        method: "POST",
        headers: { ...headers, Authorization: `Bearer ${player.token}` },
        body: JSON.stringify({ titleId: null }),
      })
    ).status,
  ).toBe(200);
  expect(calls.at(-1)?.token).toBe(player.token);
  expect(
    (
      await fetch(`${url}/api/admin/players`, {
        headers: { ...headers, Origin: "https://evil.example" },
      })
    ).status,
  ).toBe(403);
});
