import { afterEach, it, expect, vi } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";
import { RaidArena } from "../../apps/server/src/raid";
import { blankInput, type Reply } from "@arena/shared";
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
      .emit(event, data, (err: Error | null, r: Reply) =>
        err ? reject(err) : resolve(r),
      ),
  );
const setup = async () => {
  const accounts = fakeAccounts(),
    recordRaid = vi.fn(async () => {});
  accounts.provider.recordRaid = recordRaid;
  accounts.provider.rpc = async (_token, name) =>
    name === "arena_raid_progress"
      ? { highestPeril: 0, clears: 0, cosmetics: [], weekly: [] }
      : null;
  server = createArenaServer({ accounts: accounts.provider, autoTick: false });
  await new Promise<void>((r) => server!.http.listen(0, "127.0.0.1", r));
  const addr = server.http.address() as { port: number };
  const connect = async () => {
    const user = accounts.add(false);
    const socket = io(`http://127.0.0.1:${addr.port}`, {
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
  return { connect, recordRaid, accounts };
};
it("starts a regular-player solo raid, enforces Peril unlocks, and records a verified victory once outside Elo", async () => {
  const { connect, recordRaid } = await setup(),
    host = await connect();
  const created = await emit(host, "create", { name: "Raider", mode: "raid" });
  expect(created.ok).toBe(true);
  const a = server!.rooms.get(created.code!) as RaidArena;
  expect(a).toBeInstanceOf(RaidArena);
  expect(
    (await emit(host, "raid-config", { peril: 3, weekly: false })).ok,
  ).toBe(false);
  expect(
    (await emit(host, "raid-config", { peril: 1, weekly: false })).ok,
  ).toBe(true);
  await emit(host, "ready");
  expect(a.phase).toBe("briefing");
  await emit(host, "instructions-ready");
  expect(a.phase).toBe("intermission");
  await emit(host, "rite", { id: a.raid.offers[created.id!][0] });
  for (let i = 0; i < 125; i++) server!.step();
  expect(a.phase).toBe("playing");
  for (let stage = 1; stage <= 3; stage++) {
    a.damage(a.boss()!, 100000, created.id!);
    server!.step();
    if (stage < 3) {
      await emit(host, "rite", { id: a.raid.offers[created.id!][0] });
      for (let i = 0; i < 125; i++) server!.step();
    }
  }
  server!.step();
  await new Promise((r) => setTimeout(r, 20));
  expect(a.raid.result).toBe("victory");
  expect(recordRaid).toHaveBeenCalledTimes(1);
  expect(recordRaid.mock.calls[0][0]).toMatchObject({
    boss: "grumblecrag",
    partySize: 1,
    peril: 1,
  });
  expect(a.matchId).toBeNull();
  expect(a.raid.rewardStatus).toBe("saved");
  await emit(host, "rematch");
  expect(a.phase).toBe("intermission");
  expect(a.raid.result).toBeNull();
  expect(a.players).toHaveLength(2);
});
it("synchronizes four teammates against the same boss and preserves disconnect recovery", async () => {
  const { connect } = await setup();
  const host = await connect();
  const created = await emit(host, "create", { name: "Host", mode: "raid" });
  const peers = [host];
  for (let i = 0; i < 3; i++) {
    const p = await connect();
    expect(
      (await emit(p, "join", { name: "Friend", code: created.code })).ok,
    ).toBe(true);
    peers.push(p);
  }
  const a = server!.rooms.get(created.code!) as RaidArena;
  expect(
    (await emit(peers[1], "raid-config", { peril: 1, weekly: true })).ok,
  ).toBe(false);
  for (const s of peers) await emit(s, "ready");
  expect(a.heroes()).toHaveLength(4);
  expect(a.players).toHaveLength(5);
  expect(a.enemiesOf(a.heroes()[0])).toEqual([a.boss()]);
  for (const p of a.heroes()) a.acknowledgeInstructions(p.id);
  a.phase = "playing";
  const target = a.heroes()[1],
    before = target.hp;
  a.damage(target, 50, a.heroes()[0].id);
  expect(target.hp).toBe(before);
  const dropped = a.heroes()[3].id;
  peers[3].disconnect();
  await new Promise((r) => setTimeout(r, 20));
  // An AI stand-in plays the dropped raider instead of pausing everyone.
  expect(a.phase).toBe("playing");
  expect(a.raid.standIns).toContain(dropped);
  expect(a.bots.has(dropped)).toBe(true);
  expect((await emit(host, "leave")).ok).toBe(true);
  expect(a.players[0].out).toBe(true);
});

it("broadcasts an equipped cosmetic and its removal to an existing room immediately", async () => {
  const { connect, accounts } = await setup();
  let equipped: string | null = null;
  accounts.provider.rpc = async (_token, name, args) => {
    if (name === "arena_equip_raid_cosmetic") {
      equipped = (args as { p_cosmetic: string | null }).p_cosmetic;
      return null;
    }
    return {
      highestPeril: 3,
      clears: 5,
      cosmetics: ["cragbound", "mountain-aura"],
      weekly: [],
      equipped,
    };
  };
  const host = await connect();
  const created = await emit(host, "create", { name: "Raider", mode: "raid" });
  const address = server!.http.address() as { port: number };
  for (const cosmetic of ["cragbound", null]) {
    const update = new Promise<void>((resolve) => {
      const listener = (state: any) => {
        if (
          (state.players.find((p: any) => p.id === created.id)?.raidLook
            ?.skin ?? null) === cosmetic
        ) {
          host.off("state", listener);
          resolve();
        }
      };
      host.on("state", listener);
    });
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/raids/cosmetic`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(host.auth as { accessToken: string }).accessToken}`,
        },
        body: JSON.stringify({ cosmetic }),
      },
    );
    expect(response.ok).toBe(true);
    await update;
    expect(
      server!.rooms.get(created.code!)!.players.find((p) => p.id === created.id)
        ?.raidLook?.skin ?? null,
    ).toBe(cosmetic);
  }
});

it("waits for both teammates before quick retry and preserves the party's picks", async () => {
  const { connect } = await setup();
  const host = await connect(),
    friend = await connect();
  const created = await emit(host, "create", { name: "Host", mode: "raid" });
  await emit(friend, "join", { name: "Friend", code: created.code });
  await emit(host, "ready");
  await emit(friend, "ready");
  const a = server!.rooms.get(created.code!) as RaidArena;
  const picks = a.heroes().map((p) => p.character);
  a.forfeit(a.heroes()[0].id);
  a.heroes().forEach((p) => (p.ready = false));
  expect((await emit(host, "rematch")).ok).toBe(true);
  expect(a.phase).toBe("finished");
  expect(a.heroes().filter((p) => p.ready)).toHaveLength(1);
  expect((await emit(friend, "rematch")).ok).toBe(true);
  expect(a.phase).toBe("intermission");
  expect(a.heroes().map((p) => p.character)).toEqual(picks);
  expect(Object.keys(a.raid.offers)).toHaveLength(2);
});
