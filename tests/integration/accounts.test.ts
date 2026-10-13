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
        character: "voltkit",
        isAdmin: true,
      })
    ).ok,
  ).toBe(false);
  const player = accounts.add(false);
  const socket = await connect(player.token);
  expect(
    (await emit(socket, "practice", { name: "Tester", character: "voltkit" }))
      .ok,
  ).toBe(true);
  expect(
    (
      await emit(socket, "practice-options", {
        unlimitedCooldowns: true,
        targetAttacks: true,
      })
    ).ok,
  ).toBe(true);
  expect((await emit(socket, "practice-character", "auralynx")).ok).toBe(true);
  expect((await emit(socket, "practice-reset")).ok).toBe(true);
  await emit(socket, "leave");
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
it("suspended players cannot change or restart a practice session", async () => {
  const admin = accounts.add();
  const socket = await connect(admin.token);
  await emit(socket, "practice", { name: "Admin", character: "voltkit" });
  admin.account.suspended = true;
  expect(
    (
      await emit(socket, "practice-options", {
        unlimitedCooldowns: true,
        targetAttacks: true,
      })
    ).ok,
  ).toBe(false);
  expect((await emit(socket, "practice-character", "auralynx")).ok).toBe(false);
  expect((await emit(socket, "practice-reset")).ok).toBe(false);
});
it("players can resume practice after losing administrator privileges", async () => {
  const admin = accounts.add();
  const socket = await connect(admin.token);
  const room = await emit(socket, "practice", {
    name: "Admin",
    character: "voltkit",
  });
  socket.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 30));
  admin.account.isAdmin = false;
  const replacement = await connect(admin.token);
  expect((await emit(replacement, "resume", { token: room.token })).ok).toBe(
    true,
  );
  expect(server.rooms.get(room.code!)!.phase).toBe("playing");
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
      await fetch(`${url}/api/admin/players/suspend`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: player.account.id,
          suspended: true,
          role: "admin",
        }),
      })
    ).status,
  ).toBe(400);
  const post = (path: string, body: unknown, token = admin.token) =>
    fetch(`${url}${path}`, {
      method: "POST",
      headers: { ...headers, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  expect(
    (
      await post("/api/admin/players/suspend", {
        id: player.account.id,
        suspended: true,
      })
    ).status,
  ).toBe(200);
  expect(calls.at(-1)?.name).toBe("arena_admin_set_suspended");
  // Deleting must be explicitly confirmed and is admin-only.
  expect(
    (await post("/api/admin/players/delete", { id: player.account.id })).status,
  ).toBe(400);
  expect(
    (
      await post(
        "/api/admin/players/delete",
        { id: admin.account.id, confirm: true },
        player.token,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await post("/api/admin/players/delete", {
        id: player.account.id,
        confirm: true,
      })
    ).status,
  ).toBe(200);
  expect(calls.at(-1)).toMatchObject({
    name: "arena_admin_delete_player",
    args: { p_player_id: player.account.id },
  });
  // Any signed-in player can report; only admins can read reports.
  expect(
    (
      await post(
        "/api/reports",
        { category: "bug", message: "It froze", context: { screen: "match" } },
        player.token,
      )
    ).status,
  ).toBe(200);
  expect(calls.at(-1)?.name).toBe("arena_submit_report");
  expect(
    (
      await post(
        "/api/reports",
        { category: "bug", message: "hi", context: {} },
        player.token,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await fetch(`${url}/api/admin/reports`, {
        headers: { Authorization: `Bearer ${player.token}` },
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await fetch(`${url}/api/admin/reports?status=open`, {
        headers: { Authorization: `Bearer ${admin.token}` },
      })
    ).status,
  ).toBe(200);
  expect(calls.at(-1)?.name).toBe("arena_admin_reports");
  expect(
    (await post("/api/admin/reports/resolve", { id: 3, resolved: true }))
      .status,
  ).toBe(200);
  expect(calls.at(-1)?.name).toBe("arena_admin_resolve_report");
  expect(
    (await post("/api/admin/titles/delete", { id: admin.account.id })).status,
  ).toBe(400);
  expect(
    (
      await post(
        "/api/admin/titles/delete",
        { id: admin.account.id, confirm: true },
        player.token,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await post("/api/admin/titles/delete", {
        id: admin.account.id,
        confirm: true,
      })
    ).status,
  ).toBe(200);
  expect(calls.at(-1)?.name).toBe("arena_admin_delete_title");
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
it("clears a detached reservation when the owner explicitly leaves after reconnecting", async () => {
  const owner = accounts.add(true),
    socket = await connect(owner.token);
  const room = await emit(socket, "practice", {
    name: "Admin",
    character: "voltkit",
  });
  socket.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 30));
  const next = await connect(owner.token);
  expect((await emit(next, "leave", { token: room.token })).ok).toBe(true);
  expect(server.sessions.size).toBe(0);
  expect((await emit(next, "create", { name: "Admin" })).ok).toBe(true);
});
it("allows a new room after a lost disconnected reservation but protects active rooms", async () => {
  const owner = accounts.add(true),
    socket = await connect(owner.token);
  await emit(socket, "practice", { name: "Admin", character: "voltkit" });
  const second = await connect(owner.token);
  expect((await emit(second, "create", { name: "Admin" })).ok).toBe(false);
  socket.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect((await emit(second, "create", { name: "Admin" })).ok).toBe(true);
  expect(server.sessions.size).toBe(1);
  expect(server.rooms.size).toBe(1);
});
it("removes the account reservation even if the room disappeared first", async () => {
  const owner = accounts.add(true),
    socket = await connect(owner.token);
  const room = await emit(socket, "create", { name: "Admin" });
  server.rooms.delete(room.code!);
  expect((await emit(socket, "leave", { token: room.token })).ok).toBe(true);
  expect(server.sessions.size).toBe(0);
  expect(
    (await emit(socket, "practice", { name: "Admin", character: "voltkit" }))
      .ok,
  ).toBe(true);
});
it("does not let another account release a disconnected room token", async () => {
  const owner = accounts.add(true),
    socket = await connect(owner.token);
  const room = await emit(socket, "create", { name: "Owner" });
  socket.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 30));
  const stranger = await connect(accounts.add(false).token);
  expect((await emit(stranger, "leave", { token: room.token })).ok).toBe(false);
  expect(server.sessions.has(room.token!)).toBe(true);
});
