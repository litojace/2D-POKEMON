import { afterEach, beforeEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";

// Announcements and the admin list's sort (migration 20261122120000): an
// admin's announcement reaches every open game at once, signed in or not.
let server: ReturnType<typeof createArenaServer>,
  accounts: ReturnType<typeof fakeAccounts>,
  url: string,
  calls: [string, Record<string, unknown>][],
  sockets: Socket[],
  missingList: boolean;
const SENT = {
  id: 4,
  message: "Double coins this weekend!",
  tone: "event",
  createdAt: "2026-11-22T05:00:00Z",
  endsAt: "2026-11-23T05:00:00Z",
};
beforeEach(async () => {
  accounts = fakeAccounts();
  calls = [];
  sockets = [];
  missingList = false;
  accounts.provider.rpc = async (_token, name, args) => {
    calls.push([name, args]);
    if (name === "arena_admin_announce") return SENT;
    if (name === "arena_admin_end_announcement") return null;
    if (name === "arena_current_announcements") return [SENT];
    if (name === "arena_admin_announcements") return [{ ...SENT, by: "Boss" }];
    if (name === "arena_admin_player_list") {
      if (missingList) throw new Error("function does not exist");
      return { players: [], total: 0 };
    }
    if (name === "arena_admin_players") return { players: [], total: 0 };
    throw new Error(`unexpected ${name}`);
  };
  server = createArenaServer({ accounts: accounts.provider, autoTick: false });
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  if (!address || typeof address === "string") throw Error("No address");
  url = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  for (const s of sockets) s.disconnect();
  await server.close();
});
const request = (token: string, path: string, body?: unknown) =>
  fetch(`${url}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
async function listener() {
  const socket = io(url, { forceNew: true, transports: ["websocket"] });
  sockets.push(socket);
  await new Promise<void>((resolve) => socket.on("connect", () => resolve()));
  return socket;
}

it("sends an announcement to every open game", async () => {
  const { token } = accounts.add(true);
  const watcher = await listener();
  const heard = new Promise((resolve) =>
    watcher.on("announcement", (data) => resolve(data)),
  );
  const response = await request(token, "/api/admin/announce", {
    message: "  Double coins this weekend!  ",
    tone: "event",
    hours: 24,
  });
  expect(response.status).toBe(200);
  expect(await heard).toEqual(SENT);
  expect(calls).toEqual([
    [
      "arena_admin_announce",
      { p_message: "Double coins this weekend!", p_tone: "event", p_hours: 24 },
    ],
  ]);
  // Ending it early tells every game too.
  const ended = new Promise((resolve) =>
    watcher.on("announcement-ended", (data) => resolve(data)),
  );
  expect(
    (await request(token, "/api/admin/announcements/end", { id: 4 })).status,
  ).toBe(200);
  expect(await ended).toEqual({ id: 4 });
});

it("checks the request and is for admins only", async () => {
  const player = accounts.add(false);
  expect(
    (
      await request(player.token, "/api/admin/announce", {
        message: "Hello all",
        tone: "info",
        hours: 1,
      })
    ).status,
  ).toBe(403);
  expect((await request(player.token, "/api/admin/announcements")).status).toBe(
    403,
  );
  const { token } = accounts.add(true);
  for (const bad of [
    { message: "hi", tone: "info", hours: 1 },
    { message: "Hello all", tone: "shout", hours: 1 },
    { message: "Hello all", tone: "info", hours: 0 },
    { message: "Hello all", tone: "info", hours: 169 },
    { message: "Hello all", tone: "info", hours: 1, pin: true },
  ])
    expect(
      (await request(token, "/api/admin/announce", bad)).status,
      JSON.stringify(bad),
    ).toBe(400);
  expect(calls).toEqual([]);
});

it("gives signed-in players the running announcements", async () => {
  const { token } = accounts.add(false);
  const response = await request(token, "/api/announcements");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([SENT]);
  // Before the migration: none, not an error.
  accounts.provider.rpc = async () => {
    throw new Error("function does not exist");
  };
  expect(await (await request(token, "/api/announcements")).json()).toEqual([]);
});

it("sorts the admin player list, with the older list as a fallback", async () => {
  const { token } = accounts.add(true);
  await request(token, "/api/admin/players?sort=online&offset=0&search=no");
  expect(calls.at(-1)).toEqual([
    "arena_admin_player_list",
    { p_search: "no", p_offset: 0, p_sort: "online" },
  ]);
  missingList = true;
  const response = await request(token, "/api/admin/players?offset=0");
  expect(response.status).toBe(200);
  expect(calls.at(-1)).toEqual([
    "arena_admin_players",
    { p_search: "", p_offset: 0 },
  ]);
});

it("also sends an announcement as a notification, when asked", async () => {
  await server.close();
  const sent: { endpoint: string; payload: any }[] = [];
  const devices = ["a", "b"].map((n) => ({
    endpoint: `https://fcm.googleapis.com/fcm/send/${n}`,
    p256dh: "BNcRdreALRFXTkOO",
    auth: "tBHItJI5",
  }));
  accounts.provider.pushDevices = {
    save: async () => {},
    remove: async () => {},
    list: async () => [],
    newsPage: async (after) => devices.filter((d) => d.endpoint > after),
    newsCount: async () => devices.length,
  };
  server = createArenaServer({
    accounts: accounts.provider,
    autoTick: false,
    push: {
      publicKey: "key",
      send: async (d, payload) => {
        sent.push({ endpoint: d.endpoint, payload: JSON.parse(payload) });
        return "sent";
      },
    },
  });
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  if (!address || typeof address === "string") throw Error("No address");
  url = `http://127.0.0.1:${address.port}`;
  const { token } = accounts.add(true);
  expect(await (await request(token, "/api/admin/push-reach")).json()).toEqual({
    available: true,
    devices: 2,
  });
  // Without the tick: no notification.
  await request(token, "/api/admin/announce", {
    message: "Quiet one",
    tone: "info",
    hours: 1,
  });
  expect(sent).toEqual([]);
  const response = await request(token, "/api/admin/announce", {
    message: "Double coins this weekend!",
    tone: "event",
    hours: 24,
    push: true,
  });
  expect(await response.json()).toMatchObject({ id: 4, push: { devices: 2 } });
  await expect.poll(() => sent.length).toBe(2);
  expect(sent[0].payload).toEqual({
    kind: "announcement",
    title: "Element Arena · Event",
    body: "Double coins this weekend!",
    tag: "announcement-4",
  });
});

it("says when notifications aren't set up", async () => {
  const { token } = accounts.add(true);
  expect(await (await request(token, "/api/admin/push-reach")).json()).toEqual({
    available: false,
    devices: 0,
  });
  const response = await request(token, "/api/admin/announce", {
    message: "Hello all",
    tone: "info",
    hours: 1,
    push: true,
  });
  expect(response.status).toBe(200);
  expect((await response.json()).push).toEqual({
    error: "Notifications aren't set up on the server.",
  });
});
