import { afterEach, expect, it, vi } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts, fakeSpire } from "../helpers/accounts";
import { SpireArena } from "../../apps/server/src/spire";
import type { Reply } from "@arena/shared";
import { SPIRE_PARTY } from "../../packages/shared/src/spire";

// The Spire over the network: the server checks where a party may climb
// (never the client), saves each cleared floor at once under the players'
// accounts, and never files a climb as a raid clear or a match.
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
const settle = () => new Promise((r) => setTimeout(r, 20));
const setup = async (cragmuff = true) => {
  const accounts = fakeAccounts();
  const recordRaid = vi.fn(async () => {});
  const recordActivity = vi.fn(async () => {});
  accounts.provider.recordRaid = recordRaid;
  accounts.provider.recordActivity = recordActivity;
  accounts.provider.rpc = async () => null;
  const spire = fakeSpire(accounts.provider);
  server = createArenaServer({ accounts: accounts.provider, autoTick: false });
  await new Promise<void>((r) => server!.http.listen(0, "127.0.0.1", r));
  const addr = server.http.address() as { port: number };
  const connect = async () => {
    const user = accounts.add(false);
    if (!cragmuff)
      spire.members[user.account.id] = { checkpoint: 1, clears: {} };
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
    return { socket, account: user.account };
  };
  return { connect, recordRaid, recordActivity, spire };
};

it("climbs, saves a cleared floor under the account at once, and is never a raid clear", async () => {
  const { connect, recordRaid, recordActivity, spire } = await setup();
  const { socket, account } = await connect();
  const created = await emit(socket, "create", {
    name: "Climber",
    mode: "raid",
    spire: 0,
  });
  expect(created.ok).toBe(true);
  const a = server!.rooms.get(created.code!) as SpireArena;
  expect(a).toBeInstanceOf(SpireArena);
  await emit(socket, "ready");
  await settle();
  // The server checked the climb (from floor 1) before the briefing.
  expect(a.phase).toBe("briefing");
  expect(a.raid.spire!.startFloor).toBe(1);
  await emit(socket, "instructions-ready");
  for (let i = 0; i < 125 && a.phase !== "playing"; i++) server!.step();
  expect(a.phase).toBe("playing");
  // Beat both waves of floor 1.
  for (let wave = 0; wave < 2; wave++) {
    for (let i = 0; i < 40; i++) server!.step();
    for (const p of a.players) if (p.echo) p.hp = 0;
    for (const p of a.heroes()) p.hp = 999;
    for (let i = 0; i < (SPIRE_PARTY.waveGap + 0.3) * 30; i++) server!.step();
  }
  await settle();
  expect(spire.floors).toHaveLength(1);
  expect(spire.floors[0]).toMatchObject({
    floor: 1,
    season: 0,
    startFloor: 1,
    partySize: 1,
    players: [{ accountId: account.id, character: "voltkit" }],
  });
  expect(Object.keys(spire.floors[0].blessings)).toEqual([]);
  expect(a.raid.spire!.saves).toEqual([
    {
      floor: 1,
      status: "saved",
      claims: [{ playerId: created.id, coins: 20, titles: [] }],
    },
  ]);
  expect(recordRaid).not.toHaveBeenCalled();
  // No XP or missions for the Spire yet.
  expect(recordActivity).not.toHaveBeenCalled();
  expect(a.matchId).toBeNull();
  // The snapshot never calls Echo brains a bot match.
  expect(a.snapshot().vsBot).toBeNull();
});

it("won't start a climb for a party without a Cragmuff clear", async () => {
  const { connect } = await setup(false);
  const { socket } = await connect();
  const created = await emit(socket, "create", {
    name: "Climber",
    mode: "raid",
    spire: 0,
  });
  const a = server!.rooms.get(created.code!) as SpireArena;
  await emit(socket, "ready");
  await settle();
  expect(a.phase).toBe("lobby");
  expect(a.raid.spire!.problem).toMatch(/Cragmuff/);
  expect(a.players[0].ready).toBe(false);
});

it("returns to its lobby after a defeat (no Echo brains left behind), never filed as a raid", async () => {
  const { connect, recordRaid } = await setup();
  const { socket } = await connect();
  const created = await emit(socket, "create", {
    name: "Climber",
    mode: "raid",
    spire: 0,
  });
  const a = server!.rooms.get(created.code!) as SpireArena;
  await emit(socket, "ready");
  await settle();
  await emit(socket, "instructions-ready");
  for (let i = 0; i < 125 && a.phase !== "playing"; i++) server!.step();
  // A real attempt (over 20 s): a raid would be saved now.
  for (let i = 0; i < 25 * 30; i++) {
    for (const p of a.heroes()) p.hp = 999;
    server!.step();
  }
  a.heroes()[0].out = true;
  server!.step();
  await settle();
  expect(a.phase).toBe("finished");
  expect(a.raid.result).toBe("defeat");
  expect(recordRaid).not.toHaveBeenCalled();
  a.players.forEach((p) => (p.out = false));
  expect((await emit(socket, "lobby")).ok).toBe(true);
  expect(a.phase).toBe("lobby");
  expect(a.players.every((p) => !p.echo)).toBe(true);
});
