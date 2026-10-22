import { afterEach, expect, it, vi } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";
import { blankInput, type Reply } from "@arena/shared";
import type { ActivityReceipt } from "../../packages/shared/src/shop";
import type { RaidArena } from "../../apps/server/src/raid";

let server: ReturnType<typeof createArenaServer> | undefined;
const clients: Socket[] = [];
afterEach(async () => {
  clients.splice(0).forEach((c) => c.disconnect());
  await server?.close();
});
const emit = (socket: Socket, event: string, data: unknown = {}) =>
  new Promise<Reply>((resolve, reject) =>
    socket
      .timeout(2000)
      .emit(event, data, (error: Error | null, result: Reply) =>
        error ? reject(error) : resolve(result),
      ),
  );
const setup = async () => {
  const accounts = fakeAccounts();
  const recordActivity = vi.fn(async (_receipt: ActivityReceipt) => {});
  accounts.provider.recordActivity = recordActivity;
  accounts.provider.recordRaid = async () => {};
  accounts.provider.rpc = async () => ({
    highestPeril: 3,
    clears: 1,
    cosmetics: [],
    weekly: [],
  });
  server = createArenaServer({ accounts: accounts.provider, autoTick: false });
  await new Promise<void>((r) => server!.http.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.http.address() as { port: number }).port}`;
  const connect = async () => {
    const user = accounts.add(false);
    const socket = io(url, {
      auth: { accessToken: user.token },
      transports: ["websocket"],
      reconnection: false,
    });
    clients.push(socket);
    await new Promise<void>((r, j) => {
      socket.once("connect", r);
      socket.once("connect_error", j);
    });
    return { socket, account: user.account };
  };
  return { connect, recordActivity };
};
it.each(["easy", "normal", "hard"])(
  "reports a short %s bot win with actual skill and ultimate casts",
  async (difficulty) => {
    const { connect, recordActivity } = await setup();
    const { socket, account } = await connect();
    const created = await emit(socket, "bot-match", {
      name: "Raider",
      character: "voltkit",
      difficulty,
    });
    expect(created.ok).toBe(true);
    const a = server!.rooms.get(created.code!)!;
    await emit(socket, "instructions-ready");
    for (let n = 0; n < 100; n++) server!.step();
    expect(a.phase).toBe("playing");
    const p = a.players.find((p) => p.id === created.id)!;
    p.ult = 100;
    a.submit(p, { ...blankInput(), seq: 1, skill: 3, aimX: 800, aimY: 450 });
    server!.step();
    a.forfeit(p.id);
    const refreshed = new Promise<void>((r) =>
      socket.once("economy-changed", r),
    );
    server!.step();
    await refreshed;
    expect(recordActivity).toHaveBeenCalledTimes(1);
    const payload = recordActivity.mock.calls[0][0];
    expect(payload).toMatchObject({
      kind: "match",
      players: [
        {
          accountId: account.id,
          character: "voltkit",
          won: true,
          botLevel: difficulty,
          vsPeople: false,
          mode: "duel",
          skillUses: 1,
          ults: 1,
          participated: true,
          abandoned: false,
        },
      ],
    });
    expect(payload.players[0].activeSeconds).toBeLessThan(20);
    expect(a.activityStatus).toBe("saved");
  },
);
it.each(["teams", "ffa"])(
  "reports %s winners and knockout history for player-only missions",
  async (mode) => {
    const { connect, recordActivity } = await setup();
    const users = await Promise.all(Array.from({ length: 4 }, () => connect()));
    const created = await emit(users[0].socket, "create", {
      name: "Host",
      mode,
    });
    expect(created.ok).toBe(true);
    for (const user of users.slice(1))
      expect(
        (await emit(user.socket, "join", { name: "Peer", code: created.code }))
          .ok,
      ).toBe(true);
    for (const user of users) await emit(user.socket, "ready");
    const a = server!.rooms.get(created.code!)!;
    for (const user of users) await emit(user.socket, "instructions-ready");
    for (let n = 0; n < 100; n++) server!.step();
    expect(a.phase).toBe("playing");
    a.playTime = 30;
    for (const p of a.players) a.submit(p, { ...blankInput(), seq: 1, dx: 1 });
    const winner = a.players.find((p) => p.id === created.id)!;
    const other = a.players.find((p) => a.teamOf(p) !== a.teamOf(winner))!;
    a.damage(other, 1e6, winner.id);
    a.forfeit(winner.id);
    for (let n = 0; n < 4; n++) server!.step();
    await vi.waitFor(() => expect(a.activityStatus).toBe("saved"));
    const payload = recordActivity.mock.calls[0][0];
    expect(payload.players).toHaveLength(4);
    for (const p of payload.players) {
      expect(p.vsPeople).toBe(true);
      expect(p.botLevel).toBeNull();
      expect(p.mode).toBe(mode);
      expect(p.participated).toBe(true);
    }
    expect(
      payload.players.find((p) => p.accountId === users[0].account.id),
    ).toMatchObject({ won: true, knockedOut: false });
    expect(payload.players.filter((p) => p.knockedOut)).toHaveLength(1);
    expect(payload.players.filter((p) => p.won)).toHaveLength(
      mode === "teams" ? 2 : 1,
    );
  },
);
it("keeps a departed raid teammate in the receipt so a co-op clear cannot become solo", async () => {
  const { connect, recordActivity } = await setup();
  const host = await connect(),
    peer = await connect();
  const created = await emit(host.socket, "create", {
    name: "Host",
    mode: "raid",
    boss: "grumblecrag",
  });
  await emit(peer.socket, "join", { name: "Ally", code: created.code });
  await emit(host.socket, "ready");
  await emit(peer.socket, "ready");
  const a = server!.rooms.get(created.code!) as RaidArena;
  a.phase = "playing";
  a.raid.elapsed = 90;
  a.engaged.add(created.id!);
  await emit(peer.socket, "leave");
  a.endRound(0);
  for (let n = 0; n < 4; n++) server!.step();
  await vi.waitFor(() => expect(a.activityStatus).toBe("saved"));
  const payload = recordActivity.mock.calls[0][0];
  expect(payload.kind).toBe("raid");
  expect(payload.players).toHaveLength(2);
  expect(
    payload.players.find((p) => p.accountId === host.account.id),
  ).toMatchObject({
    participated: true,
    raid: { cleared: true, peril: 1, flawless: true },
  });
  expect(
    payload.players.find((p) => p.accountId === host.account.id)!.abandoned,
  ).not.toBe(true);
  expect(
    payload.players.find((p) => p.accountId === peer.account.id),
  ).toMatchObject({ abandoned: true });
});
it("never reports solo practice or attack drills as daily mission activity", async () => {
  const { connect, recordActivity } = await setup();
  const { socket } = await connect();
  const created = await emit(socket, "practice", {
    name: "Tester",
    character: "voltkit",
  });
  const a = server!.rooms.get(created.code!)!;
  a.players[0].stats.skills = 100;
  a.playTime = 120;
  a.forfeit(created.id!);
  server!.step();
  expect(recordActivity).not.toHaveBeenCalled();
  await emit(socket, "leave");
  const raid = await emit(socket, "create", {
    name: "Tester",
    mode: "raid",
    boss: "grumblecrag",
  });
  expect((await emit(socket, "raid-drill", { kind: "charge" })).ok).toBe(true);
  const b = server!.rooms.get(raid.code!) as RaidArena;
  b.raid.elapsed = 120;
  b.heroes()[0].stats.skills = 100;
  b.endRound(0);
  server!.step();
  expect(recordActivity).not.toHaveBeenCalled();
});
