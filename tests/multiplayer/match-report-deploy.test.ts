import { afterEach, expect, it, vi } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";
import { blankInput, type Reply } from "@arena/shared";

/**
 * A match's record is filed by asking the server that ran it: its summary
 * lives in that process's memory (the match ledger). The app asked over
 * HTTP. During a deploy the address already answers from the new server
 * while the match finishes on the old one, so the report reached a server
 * that never saw the match: "That match is no longer available", and the
 * results said "Couldn't save this match to your records" (25 Nov). The
 * connection stays with the old server until the results are left, so the
 * report now goes over it; HTTP stays as the fallback.
 */
const servers: ReturnType<typeof createArenaServer>[] = [];
const sockets: Socket[] = [];
afterEach(async () => {
  sockets.splice(0).forEach((s) => s.disconnect());
  for (const s of servers.splice(0)) await s.close();
});
const emit = (s: Socket, event: string, data: unknown = {}) =>
  new Promise<Reply>((resolve, reject) =>
    s
      .timeout(2000)
      .emit(event, data, (e: Error | null, r: Reply) =>
        e ? reject(e) : resolve(r),
      ),
  );
async function setup(serverOptions: { reportGraceMs?: number } = {}) {
  const accounts = fakeAccounts();
  const reports: { token: string; matchId: unknown; summary: unknown }[] = [];
  accounts.provider.recordActivity = vi.fn(async () => {});
  accounts.provider.rpc = async (token, name, args) => {
    if (name !== "arena_report_match") return null;
    const a = args as { p_match_id: unknown; p_summary: unknown };
    reports.push({ token, matchId: a.p_match_id, summary: a.p_summary });
    return { confirmed: true, achievements: [], rating: null };
  };
  const start = async () => {
    const server = createArenaServer({
      accounts: accounts.provider,
      autoTick: false,
      ...serverOptions,
    });
    servers.push(server);
    await new Promise<void>((r) => server.http.listen(0, "127.0.0.1", r));
    const url = `http://127.0.0.1:${(server.http.address() as { port: number }).port}`;
    return { server, url };
  };
  // The server the match runs on, and the one that took over the address.
  const old = await start(),
    fresh = await start();
  const user = accounts.add(false);
  const socket = io(old.url, {
    auth: { accessToken: user.token },
    transports: ["websocket"],
    reconnection: false,
  });
  sockets.push(socket);
  await new Promise<void>((r, j) => {
    socket.once("connect", r);
    socket.once("connect_error", j);
  });
  /**
   * A bot match, played to its end on the old server; `beforeEnd` runs just
   * before its last moment (a deploy's SIGTERM, say).
   */
  const play = async (beforeEnd?: () => void) => {
    const r = await emit(socket, "bot-match", {
      name: "Player",
      character: "voltkit",
      difficulty: "normal",
    });
    expect(r.ok).toBe(true);
    const a = old.server.rooms.get(r.code!)!;
    await emit(socket, "instructions-ready");
    for (let i = 0; i < 100; i++) old.server.step();
    expect(a.phase).toBe("playing");
    socket.emit("input", { ...blankInput(), seq: 1, dx: 1 });
    await vi.waitFor(() => expect(a.engaged.has(r.id!)).toBe(true));
    a.playTime = 30;
    beforeEnd?.();
    a.forfeit(r.id!);
    for (let i = 0; i < 4; i++) old.server.step();
    expect(a.matchId).toBeTruthy();
    return a.matchId!;
  };
  const http = (url: string, matchId: string) =>
    fetch(`${url}/api/matches/report`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify({ matchId }),
    });
  return { old, fresh, socket, user, reports, play, http };
}

it("files a match from the server that ran it, over the connection, even while a deploy has moved the address", async () => {
  const { old, fresh, socket, user, reports, play, http } = await setup();
  const matchId = await play();
  // The deploy window: the address answers from the new server, which
  // never saw this match.
  expect((await http(fresh.url, matchId)).status).toBe(404);
  // The connection is still with the old server: it files the match.
  const reply = (await emit(socket, "match-report", { matchId })) as Reply & {
    report?: unknown;
  };
  expect(reply.ok).toBe(true);
  expect(reply.report).toEqual({
    confirmed: true,
    achievements: [],
    rating: null,
  });
  expect(reports).toHaveLength(1);
  expect(reports[0]).toMatchObject({ token: user.token, matchId });
  // The summary is the server's own, as over HTTP.
  expect((await http(old.url, matchId)).status).toBe(200);
  expect(reports[1].summary).toEqual(reports[0].summary);
});

it("refuses a match it does not have, and anything that is not a match id", async () => {
  const { socket, reports } = await setup();
  const unknown = await emit(socket, "match-report", {
    matchId: "00000000-0000-4000-8000-000000000000",
  });
  expect(unknown).toMatchObject({
    ok: false,
    error: "That match is no longer available.",
  });
  const bad = await emit(socket, "match-report", { matchId: 42 });
  expect(bad.ok).toBe(false);
  expect(reports).toHaveLength(0);
});

it("a server being replaced stays up until the match that just ended is filed", async () => {
  const { old, socket, reports, play } = await setup();
  let drained = false;
  // Render sends SIGTERM during the match: it plays on to its end.
  const matchId = await play(() => {
    void old.server.drain(Date.now() + 60_000, 5).then(() => (drained = true));
  });
  // Over, and its coins saved, but the player's game hasn't filed it yet:
  // the results reach the phone a moment after the server ends the match.
  // Leaving now would lose the record (its summary is in this process).
  await new Promise((r) => setTimeout(r, 150));
  expect(drained).toBe(false);
  const reply = await emit(socket, "match-report", { matchId });
  expect(reply.ok).toBe(true);
  expect(reports).toHaveLength(1);
  // Filed: nothing else keeps the old server.
  await vi.waitFor(() => expect(drained).toBe(true));
});

it("a server being replaced waits for a match's report only a short while", async () => {
  const { old, play } = await setup({ reportGraceMs: 300 });
  let drained = 0;
  const started = Date.now();
  await play(() => {
    void old.server
      .drain(Date.now() + 60_000, 5)
      .then(() => (drained = Date.now()));
  });
  // The player left without filing (closed the app): the server goes anyway.
  await vi.waitFor(() => expect(drained).toBeGreaterThan(0), {
    timeout: 3000,
  });
  expect(drained - started).toBeLessThan(2500);
});
