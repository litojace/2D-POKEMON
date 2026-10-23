import { beforeEach, afterEach, it, expect } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";
import { AccountError } from "../../apps/server/src/accounts";
import { LOOK_ITEMS } from "../../packages/shared/src/shop";
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
it("lists who is online for administrators only", async () => {
  const admin = accounts.add(),
    host = accounts.add(false),
    rival = accounts.add(false),
    solo = accounts.add(false);
  const online = (token?: string) =>
    fetch(`${url}/api/admin/online`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  expect((await online()).status).toBe(401);
  expect((await online(host.token)).status).toBe(403);
  await connect(admin.token);
  await connect(admin.token); // second tab merges into one entry
  await connect(); // guest
  const hostSocket = await connect(host.token);
  const room = await emit(hostSocket, "create", { name: "Host" });
  const rivalSocket = await connect(rival.token);
  expect(
    (await emit(rivalSocket, "join", { name: "Rival", code: room.code })).ok,
  ).toBe(true);
  const soloSocket = await connect(solo.token);
  expect(
    (await emit(soloSocket, "practice", { name: "Solo", character: "tidefin" }))
      .ok,
  ).toBe(true);
  const response = await online(admin.token);
  expect(response.status).toBe(200);
  const list =
    (await response.json()) as import("../../packages/shared/src/accounts").OnlineList;
  expect(list.guests).toBe(1);
  expect(list.players).toHaveLength(4);
  const byId = Object.fromEntries(list.players.map((p) => [p.id, p]));
  expect(byId[admin.account.id]).toMatchObject({
    activity: "menu",
    connections: 2,
    isAdmin: true,
    room: null,
  });
  expect(byId[host.account.id]).toMatchObject({
    activity: "lobby",
    room: room.code,
    opponent: rival.account.displayName,
  });
  expect(byId[rival.account.id]).toMatchObject({
    activity: "lobby",
    opponent: host.account.displayName,
  });
  expect(byId[solo.account.id]).toMatchObject({
    activity: "practice",
    room: null,
    fighter: "tidefin",
    opponent: null,
  });
  // Busiest players first, menus last.
  expect(list.players.at(-1)!.id).toBe(admin.account.id);
  rivalSocket.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 50));
  const after = (await (await online(admin.token)).json()) as typeof list;
  expect(after.players.map((p) => p.id)).not.toContain(rival.account.id);
});
it("starts a private match against an AI bot", async () => {
  const admin = accounts.add(),
    player = accounts.add(false);
  const socket = await connect(player.token);
  expect(
    (
      await emit(socket, "bot-match", {
        name: "Solo",
        character: "tidefin",
        difficulty: "brutal",
      })
    ).ok,
  ).toBe(false);
  const reply = await emit(socket, "bot-match", {
    name: "Solo",
    character: "tidefin",
    difficulty: "hard",
  });
  expect(reply.ok).toBe(true);
  const arena = server.rooms.get(reply.code!)!;
  expect(arena.players).toHaveLength(2);
  const [me, bot] = arena.players;
  expect(me.character).toBe("tidefin");
  expect(bot.id.startsWith("bot-")).toBe(true);
  expect(bot.name).toMatch(/\(Bot\)$/);
  expect(bot.title).toBe("AI · Hard");
  expect(arena.snapshot().vsBot).toBe("hard");
  // Nobody else can join: the room code is not a six-character join code.
  expect(reply.code!.length).toBeGreaterThan(6);
  expect(arena.phase).toBe("briefing");
  expect((await emit(socket, "instructions-ready")).ok).toBe(true);
  expect(arena.phase).toBe("countdown");
  const online = (await (
    await fetch(`${url}/api/admin/online`, {
      headers: { authorization: `Bearer ${admin.token}` },
    })
  ).json()) as import("../../packages/shared/src/accounts").OnlineList;
  expect(online.players.find((p) => p.id === player.account.id)).toMatchObject({
    activity: "match",
    room: null,
    opponent: bot.name,
  });
  // A second room for the same account is refused; leaving closes the bot room.
  expect(
    (
      await emit(socket, "bot-match", {
        name: "Solo",
        character: "voltkit",
        difficulty: "easy",
      })
    ).ok,
  ).toBe(false);
  expect((await emit(socket, "leave")).ok).toBe(true);
  expect(server.rooms.has(reply.code!)).toBe(false);
});
it("keeps a finished bot match on rematch and refuses the lobby", async () => {
  const player = accounts.add(false);
  const socket = await connect(player.token);
  const reply = await emit(socket, "bot-match", {
    name: "Solo",
    character: "voltkit",
    difficulty: "easy",
  });
  const arena = server.rooms.get(reply.code!)!;
  // The bot is on match point and the player is knocked out during a server step.
  const [me, bot] = arena.players;
  arena.phase = "playing";
  arena.deadline = arena.time + 100;
  arena.teamScores[bot.team ?? 1] = arena.roundsToWin - 1;
  me.hp = 0;
  bot.ready = false;
  server.step();
  expect(arena.phase).toBe("finished");
  expect(arena.players[1].ready).toBe(true);
  expect((await emit(socket, "lobby")).ok).toBe(false);
  expect((await emit(socket, "rematch")).ok).toBe(true);
  expect(arena.phase).toBe("briefing");
});
it("runs a 2v2 room: four players, teams, shuffle, start and 2v1 on leave", async () => {
  const people = [0, 1, 2, 3, 4].map(() => accounts.add(false));
  const sockets = await Promise.all(people.map((p) => connect(p.token)));
  const host = await emit(sockets[0], "create", {
    name: "Host",
    mode: "teams",
  });
  expect(host.ok).toBe(true);
  const arena = server.rooms.get(host.code!)!;
  expect(arena.mode).toBe("teams");
  for (const s of sockets.slice(1, 4))
    expect((await emit(s, "join", { name: "Mate", code: host.code })).ok).toBe(
      true,
    );
  // Room holds four; the fifth is turned away.
  expect(
    (await emit(sockets[4], "join", { name: "Late", code: host.code })).ok,
  ).toBe(false);
  expect(arena.players.map((p) => p.team)).toEqual([0, 1, 0, 1]);
  // Blue is full, so a Red player cannot switch to it.
  expect((await emit(sockets[1], "team", { team: 0 })).ok).toBe(false);
  expect((await emit(sockets[1], "team", { team: 2 })).ok).toBe(false);
  // Only the host can shuffle; teams stay two and two.
  expect((await emit(sockets[1], "shuffle")).ok).toBe(false);
  expect((await emit(sockets[0], "shuffle")).ok).toBe(true);
  expect(arena.players.filter((p) => p.team === 0)).toHaveLength(2);
  // Starts only when all four are ready.
  for (const s of sockets.slice(0, 3)) await emit(s, "ready");
  expect(arena.phase).toBe("lobby");
  await emit(sockets[3], "ready");
  expect(arena.phase).toBe("briefing");
  for (const s of sockets.slice(0, 4)) await emit(s, "instructions-ready");
  expect(arena.phase).toBe("countdown");
  for (let i = 0; i < 100; i++) server.step();
  expect(arena.phase).toBe("playing");
  // One player leaves for good: their partner plays on 2v1.
  const leaver = arena.players[1];
  const partner = arena.players.find(
    (p) => p !== leaver && p.team === leaver.team,
  )!;
  const leaverSocket = sockets[1];
  expect((await emit(leaverSocket, "leave")).ok).toBe(true);
  expect(leaver.out).toBe(true);
  expect(arena.phase).toBe("playing");
  // Rematch is impossible with someone missing; then the partner leaves too → forfeit.
  const partnerSocket = sockets[arena.players.indexOf(partner)];
  expect((await emit(partnerSocket, "leave")).ok).toBe(true);
  expect(arena.phase).toBe("finished");
  expect(arena.winnerTeam).toBe(1 - (leaver.team ?? 0));
  const stayer = sockets[arena.players.findIndex((p) => !p.out && p.connected)];
  expect((await emit(stayer, "rematch")).ok).toBe(false);
  expect((await emit(stayer, "lobby")).ok).toBe(true);
  expect(arena.phase).toBe("lobby");
  expect(arena.players).toHaveLength(2);
  expect(arena.players.every((p) => !p.out)).toBe(true);
});
it("still creates a normal 1v1 room by default", async () => {
  const one = accounts.add(false);
  const socket = await connect(one.token);
  const room = await emit(socket, "create", { name: "Solo" });
  expect(server.rooms.get(room.code!)!.mode).toBe("duel");
  expect((await emit(socket, "team", { team: 1 })).ok).toBe(false);
  expect((await emit(socket, "create", { name: "X", mode: "chaos" })).ok).toBe(
    false,
  );
});
it("files a finished match and reports the server's own summary for each player", async () => {
  const one = accounts.add(false),
    two = accounts.add(false),
    stranger = accounts.add(false);
  const a = await connect(one.token),
    b = await connect(two.token);
  const host = await emit(a, "create", { name: "One" });
  expect((await emit(b, "join", { name: "Two", code: host.code })).ok).toBe(
    true,
  );
  const arena = server.rooms.get(host.code!)!;
  arena.start();
  arena.phase = "playing";
  arena.forfeit(arena.players[0].id);
  server.broadcast(arena);
  const matchId = arena.snapshot().matchId!;
  expect(matchId).toMatch(/^[0-9a-f-]{36}$/);
  const calls: {
    token: string;
    name: string;
    args: Record<string, unknown>;
  }[] = [];
  accounts.provider.rpc = async (token, name, args) => {
    calls.push({ token, name, args });
    return { confirmed: false, records: [], achievements: [] };
  };
  const post = (token: string, body: unknown) =>
    fetch(`${url}/api/matches/report`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  expect((await post(one.token, { matchId })).status).toBe(200);
  expect((await post(two.token, { matchId })).status).toBe(200);
  // Someone who wasn't in it, an unknown match, or a forged summary: refused.
  expect((await post(stranger.token, { matchId })).status).toBe(404);
  expect((await post(one.token, { matchId: "unknown-match" })).status).toBe(
    404,
  );
  expect(
    (await post(one.token, { matchId, summary: { winnerTeam: 1 } })).status,
  ).toBe(400);
  expect(calls).toHaveLength(2);
  expect(calls.map((c) => c.name)).toEqual([
    "arena_report_match",
    "arena_report_match",
  ]);
  // Both players submit the very same summary, naming both accounts.
  expect(calls[0].args).toEqual(calls[1].args);
  const summary = calls[0].args
    .p_summary as import("../../packages/shared/src/accounts").MatchSummary;
  expect(summary.players.map((p) => p.account)).toEqual([
    one.account.id,
    two.account.id,
  ]);
  expect(summary.winnerTeam).toBe(0);
  // A new match gets a new id.
  arena.start();
  expect(arena.snapshot().matchId).toBeNull();
});
it("runs a free-for-all: starts with three ready, plays on until one is left", async () => {
  const people = [0, 1, 2].map(() => accounts.add(false));
  const sockets = await Promise.all(people.map((p) => connect(p.token)));
  const host = await emit(sockets[0], "create", { name: "Host", mode: "ffa" });
  expect(host.ok).toBe(true);
  const arena = server.rooms.get(host.code!)!;
  expect(arena.mode).toBe("ffa");
  expect(
    (await emit(sockets[1], "join", { name: "B", code: host.code })).ok,
  ).toBe(true);
  // Two players can't start a free-for-all.
  await emit(sockets[0], "ready");
  await emit(sockets[1], "ready");
  expect(arena.phase).toBe("lobby");
  expect(
    (await emit(sockets[2], "join", { name: "C", code: host.code })).ok,
  ).toBe(true);
  await emit(sockets[2], "ready");
  expect(arena.phase).toBe("briefing");
  expect(arena.players.map((p) => p.team)).toEqual([0, 1, 2]);
  for (const s of sockets) await emit(s, "instructions-ready");
  for (let i = 0; i < 100; i++) server.step();
  expect(arena.phase).toBe("playing");
  // One leaves: the other two fight on.
  expect((await emit(sockets[1], "leave")).ok).toBe(true);
  expect(arena.players[1].out).toBe(true);
  expect(arena.phase).toBe("playing");
  // Another leaves: the last one standing wins the match.
  expect((await emit(sockets[2], "leave")).ok).toBe(true);
  expect(arena.phase).toBe("finished");
  expect(arena.winner).toBe(arena.players[0].id);
});
it("lets a friend watch a room live without a seat", async () => {
  const one = accounts.add(false),
    two = accounts.add(false),
    fan = accounts.add(false);
  const a = await connect(one.token),
    b = await connect(two.token),
    f = await connect(fan.token);
  const host = await emit(a, "create", { name: "One" });
  await emit(b, "join", { name: "Two", code: host.code });
  expect((await emit(f, "watch", { code: "NOPE00" })).ok).toBe(false);
  const seen: { watchers?: string[]; players: unknown[] }[] = [];
  f.on("state", (s) => seen.push(s));
  const watch = await emit(f, "watch", { code: host.code });
  expect(watch.ok).toBe(true);
  const arena = server.rooms.get(host.code!)!;
  // A watcher takes no seat and can't play.
  expect(arena.players).toHaveLength(2);
  expect((await emit(f, "ready")).ok).toBe(false);
  await new Promise((r) => setTimeout(r, 50));
  expect(seen.at(-1)?.watchers).toEqual([fan.account.displayName]);
  // Watching then creating a room of your own stops the watching.
  expect((await emit(f, "unwatch")).ok).toBe(true);
  expect(arena.snapshot().phase).toBe("lobby");
  expect((await emit(f, "watch", { code: host.code })).ok).toBe(true);
  // When the room closes, watchers are told.
  const ended = new Promise((resolve) => f.once("watch-ended", resolve));
  await emit(a, "leave");
  await emit(b, "leave");
  await expect(ended).resolves.toBeTruthy();
});
it("adds live presence to the friends list and pings friends on requests", async () => {
  const me = accounts.add(false),
    pal = accounts.add(false);
  const mine = await connect(me.token),
    theirs = await connect(pal.token);
  const room = await emit(theirs, "create", { name: "Pal" });
  accounts.provider.rpc = async (_token, name) => {
    if (name === "arena_friends")
      return {
        code: "ABCDEF12",
        friends: [
          { id: pal.account.id, name: "Pal", title: null, titleColor: null },
          { id: "00000000-0000-4000-8000-0000000000ff", name: "Away" },
        ],
        incoming: [],
        outgoing: [],
      };
    if (name === "arena_friend_request") return "requested";
    throw new Error("unexpected " + name);
  };
  const res = await fetch(`${url}/api/friends`, {
    headers: { authorization: `Bearer ${me.token}` },
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as {
    friends: {
      name: string;
      online: boolean;
      room: string | null;
      joinable: boolean;
    }[];
  };
  expect(body.friends[0]).toMatchObject({
    name: "Pal",
    online: true,
    room: room.code,
    joinable: true,
  });
  expect(body.friends[1]).toMatchObject({ name: "Away", online: false });
  const pinged = new Promise((resolve) =>
    theirs.once("friends-changed", resolve),
  );
  const sent = await fetch(`${url}/api/friends/request`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${me.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ playerId: pal.account.id }),
  });
  expect(sent.status).toBe(200);
  await expect(pinged).resolves.toBeUndefined();
  void mine;
});
it("lets a player wear only the mastery flair their records unlock", async () => {
  const player = accounts.add(false);
  const socket = await connect(player.token);
  const host = await emit(socket, "create", { name: "Flair" });
  const arena = server.rooms.get(host.code!)!;
  const me = arena.players[0];
  me.character = "voltkit";
  accounts.provider.rpc = async (_token, name) => {
    if (name !== "arena_my_progress") throw new Error("unexpected " + name);
    return {
      matches: 20,
      wins: 9,
      achievements: [],
      fighters: { voltkit: { matches: 16, wins: 7 } },
      season: { id: "2026-10", matches: 4, wins: 2 },
    };
  };
  expect((await emit(socket, "flair", { tier: "Gold" })).ok).toBe(false);
  expect((await emit(socket, "flair", { tier: "Shiny" })).ok).toBe(false);
  expect((await emit(socket, "flair", { tier: "Silver" })).ok).toBe(true);
  expect(me.flair).toBe("Silver");
  // Switching fighter takes it off (it belonged to Voltkit).
  expect((await emit(socket, "select", "tidefin")).ok).toBe(true);
  expect(me.flair).toBeUndefined();
  expect((await emit(socket, "flair", { tier: "Bronze" })).ok).toBe(false);
  expect((await emit(socket, "flair", { tier: null })).ok).toBe(true);
});

it("equips every collection item through the shared appearance route and reads all slots back", async () => {
  const player = accounts.add(false);
  const loadout: Record<string, string | null> = {};
  accounts.provider.rpc = async (_token, name, args) => {
    if (name === "arena_equip_raid_slot") {
      loadout[args.p_slot as string] = args.p_item as string | null;
      return null;
    }
    if (name === "arena_raid_progress") return { loadout: { ...loadout } };
    throw Error(`Unexpected RPC ${name}`);
  };
  for (const item of LOOK_ITEMS) {
    const response = await fetch(`${url}/api/raids/equip`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${player.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ slot: item.slot, item: item.id }),
    });
    expect(response.status, item.id).toBe(200);
    expect((await response.json()).progress.loadout[item.slot]).toBe(item.id);
  }
});

it("explains stale collection functions and never reports an unsaved appearance as success", async () => {
  const player = accounts.add(false);
  const post = (slot: string, item: string) =>
    fetch(`${url}/api/raids/equip`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${player.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ slot, item }),
    });
  accounts.provider.rpc = async () => {
    throw new AccountError(400, "That item belongs in another slot");
  };
  const stale = await post("victory", "galaxy-victory");
  expect(stale.status).toBe(503);
  expect((await stale.json()).error).toContain("018_collection_equipping.sql");
  const wrong = await post("aura", "galaxy-victory");
  expect(wrong.status).toBe(400);
  expect((await wrong.json()).error).toBe("That item belongs in another slot.");
  accounts.provider.rpc = async (_token, name) =>
    name === "arena_raid_progress" ? { loadout: {} } : null;
  const lost = await post("victory", "galaxy-victory");
  expect(lost.status).toBe(503);
  expect((await lost.json()).error).toContain("018_collection_equipping.sql");
  accounts.provider.rpc = async () => {
    throw new AccountError(400, "Cosmetic not earned");
  };
  const unowned = await post("victory", "galaxy-victory");
  expect(unowned.status).toBe(400);
  expect((await unowned.json()).error).toBe("Cosmetic not earned");
});

it("accepts all six daily mission slots and rejects invalid reroll requests before the RPC", async () => {
  const player = accounts.add(false);
  const slots: unknown[] = [];
  accounts.provider.rpc = async (_token, name, args) => {
    expect(name).toBe("arena_reroll_mission");
    slots.push(args.p_slot);
    return { missions: [], rerollsUsed: 1, rerollLimit: 5 };
  };
  const post = (body: unknown, token = player.token) =>
    fetch(`${url}/api/missions/reroll`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  for (let slot = 0; slot < 6; slot++)
    expect((await post({ slot })).status).toBe(200);
  expect(slots).toEqual([0, 1, 2, 3, 4, 5]);
  for (const body of [
    { slot: -1 },
    { slot: 6 },
    { slot: 1.5 },
    { slot: "5" },
    { slot: null },
    {},
    { slot: 0, rerollsUsed: 0 },
  ])
    expect((await post(body)).status).toBe(400);
  expect((await post({ slot: 5 }, "invalid")).status).toBe(401);
  expect(slots).toHaveLength(6);
});
