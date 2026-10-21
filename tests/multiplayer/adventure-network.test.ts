import { afterEach, it, expect, vi } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";
import { arcadeWeek, ARCADE_IDS } from "../../packages/shared/src/arcade";
import { raidDay } from "../../packages/shared/src/raid";
import { blankInput, type Reply } from "@arena/shared";
import type { RaidArena } from "../../apps/server/src/raid";
import type { ArcadeArena } from "../../apps/server/src/arcade";
let server: ReturnType<typeof createArenaServer> | undefined;
const sockets: Socket[] = [];
afterEach(async () => {
  sockets.splice(0).forEach((s) => s.disconnect());
  await server?.close();
});
const emit = (s: Socket, event: string, data: unknown = {}) =>
  new Promise<Reply>((resolve, reject) =>
    s
      .timeout(2000)
      .emit(event, data, (e: Error | null, r: Reply) =>
        e ? reject(e) : resolve(r),
      ),
  );
const setup = async () => {
  const accounts = fakeAccounts(),
    recordActivity = vi.fn(async () => {}),
    recordRaid = vi.fn(async () => {});
  accounts.provider.recordActivity = recordActivity;
  accounts.provider.recordRaid = recordRaid;
  accounts.provider.rpc = async (_token, name) =>
    name === "arena_raid_progress"
      ? {
          clears: 1,
          highestPeril: 3,
          bosses: { grumblecrag: { clears: 1, highestPeril: 3 } },
          cosmetics: [],
          weekly: [],
        }
      : null;
  server = createArenaServer({ accounts: accounts.provider, autoTick: false });
  await new Promise<void>((r) => server!.http.listen(0, "127.0.0.1", r));
  const port = (server.http.address() as { port: number }).port;
  const connect = async () => {
    const user = accounts.add(false),
      socket = io(`http://127.0.0.1:${port}`, {
        auth: { accessToken: user.token },
        transports: ["websocket"],
        reconnection: false,
      });
    sockets.push(socket);
    await new Promise<void>((r, j) => {
      socket.once("connect", r);
      socket.once("connect_error", j);
    });
    return socket;
  };
  return { connect, recordActivity, recordRaid };
};
it("starts this week’s fixed arcade with an AI and awards an arcade-tagged result", async () => {
  const { connect, recordActivity } = await setup(),
    host = await connect(),
    weekly = arcadeWeek(raidDay().day);
  const other = ARCADE_IDS.find((id) => id !== weekly.id)!;
  expect(
    (
      await emit(host, "bot-match", {
        name: "Arcader",
        character: "voltkit",
        difficulty: "easy",
        arcade: other,
      })
    ).ok,
  ).toBe(false);
  const r = await emit(host, "bot-match", {
    name: "Arcader",
    character: "voltkit",
    difficulty: "normal",
    arcade: weekly.id,
  });
  expect(r.ok).toBe(true);
  const a = server!.rooms.get(r.code!) as ArcadeArena;
  expect(a.arcade.id).toBe(weekly.id);
  await emit(host, "instructions-ready");
  for (let i = 0; i < 100; i++) server!.step();
  expect(a.phase).toBe("playing");
  host.emit("input", { ...blankInput(), seq: 1, dx: 1 });
  await new Promise((r) => setTimeout(r, 10));
  a.playTime = 30;
  a.forfeit(r.id!);
  for (let i = 0; i < 4; i++) server!.step();
  await new Promise((r) => setTimeout(r, 10));
  expect(recordActivity).toHaveBeenCalledTimes(1);
  expect(recordActivity.mock.calls[0][0].players[0]).toMatchObject({
    arcade: weekly.id,
    participated: true,
  });
  expect(a.matchId).toBeTruthy();
  const report = await fetch(
    `http://127.0.0.1:${(server!.http.address() as { port: number }).port}/api/matches/report`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${(host.auth as any).accessToken}`,
      },
      body: JSON.stringify({ matchId: a.matchId }),
    },
  );
  expect(report.status).toBe(404);
});
it("keeps private weekly rules fixed for both players and separate from regular PvP records", async () => {
  const { connect, recordActivity } = await setup(),
    host = await connect(),
    peer = await connect();
  const weekly = arcadeWeek(raidDay().day);
  const r = await emit(host, "create", {
    name: "Host",
    mode: "duel",
    arcade: weekly.id,
  });
  await emit(peer, "join", { name: "Peer", code: r.code });
  expect((await emit(host, "mutators", { ids: [] })).ok).toBe(false);
  await emit(host, "ready");
  await emit(peer, "ready");
  const a = server!.rooms.get(r.code!) as ArcadeArena;
  expect(a.phase).toBe("briefing");
  await emit(host, "instructions-ready");
  await emit(peer, "instructions-ready");
  for (let i = 0; i < 100; i++) server!.step();
  a.playTime = 30;
  a.engaged.add(r.id!);
  a.forfeit(r.id!);
  for (let i = 0; i < 4; i++) server!.step();
  await new Promise((r) => setTimeout(r, 10));
  expect(recordActivity.mock.calls[0][0].players[0].vsPeople).toBe(true);
  expect(a.snapshot().arcade?.week).toBe(weekly.week);
});
it("runs three expedition legs with two real clients, retains room identity and saves only the expedition", async () => {
  const { connect, recordActivity, recordRaid } = await setup(),
    host = await connect(),
    peer = await connect();
  const r = await emit(host, "create", {
    name: "Leader",
    mode: "raid",
    expedition: true,
  });
  expect(r.ok).toBe(true);
  expect((await emit(peer, "join", { name: "Ally", code: r.code })).ok).toBe(
    true,
  );
  expect((await emit(host, "raid-config", { peril: 2, daily: false })).ok).toBe(
    false,
  );
  expect((await emit(host, "raid-drill", { kind: "charge" })).ok).toBe(false);
  await emit(host, "ready");
  await emit(peer, "ready");
  const get = () => server!.rooms.get(r.code!) as RaidArena;
  for (let leg = 0; leg < 3; leg++) {
    const a = get();
    expect(a.raid.expedition!.leg).toBe(leg);
    expect(a.phase).toBe("briefing");
    expect(a.raid.phase).toBe(3);
    await emit(host, "instructions-ready");
    await emit(peer, "instructions-ready");
    for (const [id, offer] of Object.entries(a.raid.offers))
      await emit(id === r.id ? host : peer, "rite", { id: offer[0] });
    for (let i = 0; i < 125; i++) server!.step();
    expect(a.phase).toBe("playing");
    a.raid.elapsed = 60;
    a.engaged.add(r.id!);
    for (const boss of a.players.filter((p) => p.raidBoss))
      a.damage(boss, 1e6, r.id!);
    server!.step();
    if (leg < 2) {
      expect(a.raid.expedition!.camp).toBe(true);
      expect(recordActivity).not.toHaveBeenCalled();
      await emit(host, "expedition-choice", { choice: "surge" });
      await emit(peer, "expedition-choice", { choice: "rest" });
      for (let i = 0; i < 35; i++) server!.step();
      expect(get()).not.toBe(a);
      expect(
        get()
          .heroes()
          .map((p) => p.id),
      ).toEqual(a.heroes().map((p) => p.id));
    }
  }
  await new Promise((r) => setTimeout(r, 20));
  expect(get().raid.result).toBe("victory");
  expect(recordRaid).not.toHaveBeenCalled();
  expect(recordActivity).toHaveBeenCalledTimes(1);
  expect(recordActivity.mock.calls[0][0]).toMatchObject({ kind: "expedition" });
  expect(recordActivity.mock.calls[0][0].players).toHaveLength(2);
  expect(recordActivity.mock.calls[0][0].players[0].expedition.completed).toBe(
    3,
  );
  expect(get().raid.expedition!.saved).toBe("saved");
  const old = get().raid.expedition!.id;
  expect((await emit(host, "lobby")).ok).toBe(true);
  expect(get().phase).toBe("lobby");
  expect(get().raid.expedition!.leg).toBe(0);
  expect(get().raid.expedition!.id).not.toBe(old);
});
