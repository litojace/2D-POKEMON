import { afterEach, expect, it, vi } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts, fakeSpire } from "../helpers/accounts";
import {
  SpireArena,
  SpireDreamArena,
  SpireEmberArena,
  SpireStormArena,
  SpireGloomArena,
  SpireLightArena,
  SpireTideArena,
} from "../../apps/server/src/spire";
import {
  MetaCache,
  unpackSnapshot,
  type Reply,
  type Snapshot,
  type WireSnapshot,
} from "@arena/shared";
import {
  SPIRE_PARTY,
  spireWaves,
  type SpireMember,
} from "../../packages/shared/src/spire";
import { spireHudView } from "../../apps/client/src/raid-hud";

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
const setup = async (cragmuff = true, member?: SpireMember) => {
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
    else if (member) spire.members[user.account.id] = structuredClone(member);
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

it("won't make a standalone Ascendant room for a client", async () => {
  const { connect } = await setup();
  const { socket } = await connect();
  for (const ask of [
    { mode: "raid", boss: "grumblecrag", variant: "ascendant" },
    { mode: "raid", variant: "ascendant" },
    { mode: "raid", spire: 0, variant: "ascendant" },
  ])
    expect((await emit(socket, "create", { name: "Climber", ...ask })).ok).toBe(
      false,
    );
  expect(server!.rooms.size).toBe(0);
});

it("climbs floor 9 → the Ascendant on floor 10 → results in one room, saved as Spire floors only", async () => {
  const { connect, recordRaid, recordActivity, spire } = await setup();
  const one = await connect(),
    two = await connect();
  const created = await emit(one.socket, "create", {
    name: "One",
    mode: "raid",
    spire: 0,
  });
  const joined = await emit(two.socket, "join", {
    name: "Two",
    code: created.code,
  });
  expect(joined.ok).toBe(true);
  const a = server!.rooms.get(created.code!) as SpireArena;
  // What a player's game sees, decoded as the client does.
  const cache = new MetaCache();
  const seen: Snapshot[] = [];
  one.socket.on("state", (wire: WireSnapshot) =>
    seen.push(unpackSnapshot(wire, cache)),
  );
  await emit(one.socket, "ready");
  await emit(two.socket, "ready");
  await settle();
  expect(a.phase).toBe("briefing");
  for (const s of [one.socket, two.socket]) await emit(s, "instructions-ready");
  // Climb: Echoes fall as they appear; each raider takes the first card.
  const ids = [created.id!, joined.id!];
  const step = async () => {
    for (const p of a.heroes()) p.hp = Math.max(p.hp, 900);
    if (a.phase === "playing" && a.raid.spire!.kind !== "boss")
      for (const p of a.players) if (p.echo && p.hp > 0) p.hp = 0;
    if (a.phase === "intermission")
      for (const [i, s] of [one.socket, two.socket].entries()) {
        const offer = a.raid.spire!.offers[ids[i]];
        if (offer?.[0]) await emit(s, "rite", { id: offer[0] });
      }
    server!.step();
  };
  for (let i = 0; i < 30 * 400 && a.raid.spire!.floor < 10; i++) await step();
  for (let i = 0; i < 30 * 5 && a.phase !== "briefing"; i++) await step();
  await settle();
  // Floor 10, same room and arena: the Ascendant's briefing.
  expect(server!.rooms.get(created.code!)).toBe(a);
  expect(a.raid.spire).toMatchObject({ floor: 10, kind: "boss", best: 9 });
  expect(a.phase).toBe("briefing");
  expect(a.raid.variant).toBe("ascendant");
  expect(spire.floors.map((f) => f.floor)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const held = structuredClone(a.raid.spire!.blessings);
  expect(Object.values(held[ids[0]]).reduce((n, k) => n + (k ?? 0), 0)).toBe(8);
  const lastBefore = Math.max(
    ...seen.flatMap((s) => s.events.map((e) => e.id)),
  );
  for (const s of [one.socket, two.socket]) await emit(s, "instructions-ready");
  for (let i = 0; i < 30 * 30 && a.phase !== "playing"; i++) await step();
  expect(a.phase).toBe("playing");
  // A real fight for a while: the Ascendant's attacks reach the players.
  for (let i = 0; i < 30 * 25; i++) await step();
  await settle();
  const fight = seen.filter((s) => s.raid?.spire?.kind === "boss");
  const fightEvents = fight
    .flatMap((s) => s.events)
    .filter((e) => e.id > lastBefore);
  expect(fightEvents.length).toBeGreaterThan(0);
  // The event numbering carried on (a client skips ids it has passed):
  // every event the player received is newer than the one before.
  const stream = seen.flatMap((s) => s.events.map((e) => e.id));
  for (let i = 1; i < stream.length; i++)
    expect(stream[i]).toBeGreaterThan(stream[i - 1]);
  // The same seats, names and appearance; the blessings still held.
  const last = seen.at(-1)!;
  const seats = (snap: Snapshot) =>
    snap.players
      .filter((p) => !p.raidBoss && !p.echo)
      .map((p) => [p.id, p.name, p.character, JSON.stringify(p.raidLook)]);
  const nine = seen.findLast(
    (s) => s.raid?.spire?.floor === 9 && s.phase === "playing",
  )!;
  expect(seats(last)).toEqual(seats(nine));
  expect(seats(last).map((s) => s[0])).toEqual(ids);
  expect(last.players.find((p) => p.raidBoss)?.name).toBe("Ascendant Cragmuff");
  for (const id of ids)
    for (const [b, n] of Object.entries(held[id]))
      expect(
        a.raid.spire!.blessings[id][b as keyof (typeof held)[string]],
      ).toBeGreaterThanOrEqual(n!);
  // Beat it: floor 10 is saved as a Spire floor, under both accounts.
  a.boss()!.hp = 0;
  for (let i = 0; i < 30 * (SPIRE_PARTY.cleared + 0.5); i++) await step();
  await settle();
  expect(a.phase).toBe("finished");
  expect(a.raid.result).toBe("victory");
  expect(a.raid.message).toMatch(/Zone 1 conquered/);
  const ten = spire.floors.at(-1)!;
  expect(ten).toMatchObject({ floor: 10, season: 0, partySize: 2 });
  expect(ten.players.map((p) => p.accountId).sort()).toEqual(
    [one.account.id, two.account.id].sort(),
  );
  expect(Object.keys(ten.blessings).sort()).toEqual(
    [one.account.id, two.account.id].sort(),
  );
  expect(a.raid.spire!.saves.at(-1)).toMatchObject({
    floor: 10,
    status: "saved",
  });
  expect(
    a.raid.spire!.saves.at(-1)!.claims!.find((c) => c.playerId === ids[0]),
  ).toMatchObject({ coins: 120, titles: ["Earthshaker of the Spire"] });
  // Never a Cragmuff raid clear, never activity (XP, missions).
  expect(recordRaid).not.toHaveBeenCalled();
  expect(recordActivity).not.toHaveBeenCalled();
  expect(a.raid.rewardStatus).toBeUndefined();
}, 60_000);

// ------------------------------------------------------------------ Zone 2
const conqueror: SpireMember = {
  checkpoint: 11,
  clears: { grumblecrag: 1, tidewyrm: 1 },
};

it("climbs zone 2 from floor 11 to the Ascendant Tidelotl on floor 20 → results, in one room", async () => {
  const { connect, recordRaid, recordActivity, spire } = await setup(
    true,
    conqueror,
  );
  const one = await connect(),
    two = await connect();
  const created = await emit(one.socket, "create", {
    name: "One",
    mode: "raid",
    spire: 11,
  });
  expect(created.ok).toBe(true);
  const joined = await emit(two.socket, "join", {
    name: "Two",
    code: created.code,
  });
  expect(joined.ok).toBe(true);
  const a = server!.rooms.get(created.code!) as SpireTideArena;
  expect(a).toBeInstanceOf(SpireTideArena);
  expect(a.raid.boss).toBe("tidewyrm");
  const cache = new MetaCache();
  const seen: Snapshot[] = [];
  one.socket.on("state", (wire: WireSnapshot) =>
    seen.push(unpackSnapshot(wire, cache)),
  );
  await emit(one.socket, "ready");
  await emit(two.socket, "ready");
  await settle();
  expect(a.phase).toBe("briefing");
  expect(a.raid.spire).toMatchObject({
    zone: 2,
    startFloor: 11,
    floor: 11,
    ceiling: 20,
  });
  for (const s of [one.socket, two.socket]) await emit(s, "instructions-ready");
  const ids = [created.id!, joined.id!];
  const step = async () => {
    for (const p of a.heroes()) p.hp = Math.max(p.hp, 900);
    if (a.phase === "playing" && a.raid.spire!.kind !== "boss")
      for (const p of a.players) if (p.echo && p.hp > 0) p.hp = 0;
    if (a.phase === "intermission")
      for (const [i, s] of [one.socket, two.socket].entries()) {
        const offer = a.raid.spire!.offers[ids[i]];
        if (offer?.[0]) await emit(s, "rite", { id: offer[0] });
      }
    server!.step();
  };
  for (let i = 0; i < 30 * 400 && a.raid.spire!.floor < 20; i++) await step();
  for (let i = 0; i < 30 * 5 && a.phase !== "briefing"; i++) await step();
  await settle();
  expect(server!.rooms.get(created.code!)).toBe(a);
  expect(a.raid.spire).toMatchObject({ floor: 20, kind: "boss", best: 19 });
  expect(a.phase).toBe("briefing");
  expect(a.raid.variant).toBe("ascendant");
  expect(a.arenaId).toBe("lagoon");
  expect(spire.floors.map((f) => f.floor)).toEqual([
    11, 12, 13, 14, 15, 16, 17, 18, 19,
  ]);
  expect(spire.floors.every((f) => f.startFloor === 11)).toBe(true);
  for (const s of [one.socket, two.socket]) await emit(s, "instructions-ready");
  for (let i = 0; i < 30 * 30 && a.phase !== "playing"; i++) await step();
  expect(a.phase).toBe("playing");
  for (let i = 0; i < 30 * 20; i++) await step();
  await settle();
  // What the players saw: the lagoon's boss, under its Ascendant name.
  const last = seen.at(-1)!;
  expect(last.arena).toBe("lagoon");
  expect(last.raid?.spire).toMatchObject({ zone: 2, floor: 20 });
  expect(last.players.find((p) => p.raidBoss)?.name).toBe("Ascendant Tidelotl");
  const stream = seen.flatMap((s) => s.events.map((e) => e.id));
  for (let i = 1; i < stream.length; i++)
    expect(stream[i]).toBeGreaterThan(stream[i - 1]);
  // Beat it: saved as Spire floor 20 under both accounts, never a raid.
  a.raid.submerged = false;
  a.boss()!.hp = 0;
  for (let i = 0; i < 30 * (SPIRE_PARTY.cleared + 0.5); i++) await step();
  await settle();
  expect(a.phase).toBe("finished");
  expect(a.raid.result).toBe("victory");
  expect(a.raid.message).toMatch(/Zone 2 conquered/);
  const twenty = spire.floors.at(-1)!;
  expect(twenty).toMatchObject({ floor: 20, startFloor: 11, partySize: 2 });
  expect(twenty.players.map((p) => p.accountId).sort()).toEqual(
    [one.account.id, two.account.id].sort(),
  );
  expect(
    a.raid.spire!.saves.at(-1)!.claims!.find((c) => c.playerId === ids[0]),
  ).toMatchObject({ coins: 200, titles: ["Tidecaller of the Spire"] });
  expect(recordRaid).not.toHaveBeenCalled();
  expect(recordActivity).not.toHaveBeenCalled();
  expect(a.raid.rewardStatus).toBeUndefined();
}, 90_000);

it("won't start zone 2 for a party asking for floor 11 without the checkpoint", async () => {
  const { connect, spire } = await setup();
  const one = await connect(),
    two = await connect();
  // One has conquered zone 1; Two hasn't.
  spire.members[one.account.id] = conqueror;
  const created = await emit(one.socket, "create", {
    name: "One",
    mode: "raid",
    spire: 11,
  });
  expect(created.ok).toBe(true);
  await emit(two.socket, "join", { name: "Two", code: created.code });
  const a = server!.rooms.get(created.code!) as SpireTideArena;
  await emit(one.socket, "ready");
  await emit(two.socket, "ready");
  await settle();
  expect(a.phase).toBe("lobby");
  expect(a.raid.spire!.problem).toMatch(/floor 11/);
  expect(a.players.every((p) => !p.ready)).toBe(true);
  expect(spire.floors).toEqual([]);
});

it("refuses a start floor that isn't a built zone's first floor", async () => {
  const { connect } = await setup(true, conqueror);
  const { socket } = await connect();
  for (const spireFloor of [
    2, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 71, -1, 1.5,
  ])
    expect(
      (
        await emit(socket, "create", {
          name: "Climber",
          mode: "raid",
          spire: spireFloor,
        })
      ).ok,
    ).toBe(false);
  expect(server!.rooms.size).toBe(0);
});

it("lets a player with checkpoint 11 replay zone 1 from floor 1", async () => {
  const { connect } = await setup(true, conqueror);
  const { socket } = await connect();
  const created = await emit(socket, "create", {
    name: "Climber",
    mode: "raid",
    spire: 1,
  });
  expect(created.ok).toBe(true);
  const a = server!.rooms.get(created.code!) as SpireArena;
  expect(a).toBeInstanceOf(SpireArena);
  await emit(socket, "ready");
  await settle();
  expect(a.phase).toBe("briefing");
  expect(a.raid.spire).toMatchObject({
    zone: 1,
    startFloor: 1,
    ceiling: 10,
  });
});

// ------------------------------------------------------------------ Zone 3
const shadowWalker: SpireMember = {
  checkpoint: 21,
  clears: { grumblecrag: 1, tidewyrm: 1, gloomshade: 1 },
};

it("climbs zone 3 from floor 21 to the Ascendant Inkpurr on floor 30 → results, in one room", async () => {
  const { connect, recordRaid, recordActivity, spire } = await setup(
    true,
    shadowWalker,
  );
  const one = await connect(),
    two = await connect();
  const created = await emit(one.socket, "create", {
    name: "One",
    mode: "raid",
    spire: 21,
  });
  expect(created.ok).toBe(true);
  const joined = await emit(two.socket, "join", {
    name: "Two",
    code: created.code,
  });
  expect(joined.ok).toBe(true);
  const a = server!.rooms.get(created.code!) as SpireGloomArena;
  expect(a).toBeInstanceOf(SpireGloomArena);
  expect(a.raid.boss).toBe("gloomshade");
  const cache = new MetaCache();
  const seen: Snapshot[] = [];
  one.socket.on("state", (wire: WireSnapshot) =>
    seen.push(unpackSnapshot(wire, cache)),
  );
  await emit(one.socket, "ready");
  await emit(two.socket, "ready");
  await settle();
  expect(a.phase).toBe("briefing");
  expect(a.raid.spire).toMatchObject({
    zone: 3,
    startFloor: 21,
    floor: 21,
    ceiling: 30,
  });
  // The wave floors: the Spire's court, never Inkpurr's yard.
  expect(a.arenaId).toBe("classic");
  expect(a.raid.lanterns).toBeUndefined();
  for (const s of [one.socket, two.socket]) await emit(s, "instructions-ready");
  const ids = [created.id!, joined.id!];
  const step = async () => {
    for (const p of a.heroes()) p.hp = Math.max(p.hp, 900);
    if (a.phase === "playing" && a.raid.spire!.kind !== "boss")
      for (const p of a.players) if (p.echo && p.hp > 0) p.hp = 0;
    if (a.phase === "intermission")
      for (const [i, s] of [one.socket, two.socket].entries()) {
        const offer = a.raid.spire!.offers[ids[i]];
        if (offer?.[0]) await emit(s, "rite", { id: offer[0] });
      }
    server!.step();
  };
  for (let i = 0; i < 30 * 400 && a.raid.spire!.floor < 30; i++) await step();
  for (let i = 0; i < 30 * 5 && a.phase !== "briefing"; i++) await step();
  await settle();
  expect(server!.rooms.get(created.code!)).toBe(a);
  expect(a.raid.spire).toMatchObject({ floor: 30, kind: "boss", best: 29 });
  expect(a.phase).toBe("briefing");
  expect(a.raid.variant).toBe("ascendant");
  expect(a.arenaId).toBe("lantern-yard");
  expect(spire.floors.map((f) => f.floor)).toEqual([
    21, 22, 23, 24, 25, 26, 27, 28, 29,
  ]);
  expect(spire.floors.every((f) => f.startFloor === 21)).toBe(true);
  for (const s of [one.socket, two.socket]) await emit(s, "instructions-ready");
  for (let i = 0; i < 30 * 30 && a.phase !== "playing"; i++) await step();
  expect(a.phase).toBe("playing");
  for (let i = 0; i < 30 * 20; i++) await step();
  await settle();
  // What the players saw: Inkpurr's yard and its boss, under its Ascendant name.
  const last = seen.at(-1)!;
  expect(last.arena).toBe("lantern-yard");
  expect(last.raid?.spire).toMatchObject({ zone: 3, floor: 30 });
  expect(last.raid?.lanterns?.length).toBe(4);
  expect(last.players.find((p) => p.raidBoss)?.name).toBe("Ascendant Inkpurr");
  const stream = seen.flatMap((s) => s.events.map((e) => e.id));
  for (let i = 1; i < stream.length; i++)
    expect(stream[i]).toBeGreaterThan(stream[i - 1]);
  // Beat it: saved as Spire floor 30 under both accounts, never a raid.
  a.boss()!.hp = 0;
  for (let i = 0; i < 30 * (SPIRE_PARTY.cleared + 0.5); i++) await step();
  await settle();
  expect(a.phase).toBe("finished");
  expect(a.raid.result).toBe("victory");
  expect(a.raid.message).toMatch(/Zone 3 conquered/);
  const thirty = spire.floors.at(-1)!;
  expect(thirty).toMatchObject({ floor: 30, startFloor: 21, partySize: 2 });
  expect(thirty.players.map((p) => p.accountId).sort()).toEqual(
    [one.account.id, two.account.id].sort(),
  );
  expect(
    a.raid.spire!.saves.at(-1)!.claims!.find((c) => c.playerId === ids[0]),
  ).toMatchObject({ coins: 250, titles: ["Lanternbane of the Spire"] });
  expect(recordRaid).not.toHaveBeenCalled();
  expect(recordActivity).not.toHaveBeenCalled();
  expect(a.raid.rewardStatus).toBeUndefined();
}, 120_000);

it("won't start zone 3 for a party asking for floor 21 without the checkpoint", async () => {
  const { connect, spire } = await setup();
  const one = await connect(),
    two = await connect();
  // One has conquered zone 2; Two has only conquered zone 1.
  spire.members[one.account.id] = shadowWalker;
  spire.members[two.account.id] = conqueror;
  const created = await emit(one.socket, "create", {
    name: "One",
    mode: "raid",
    spire: 21,
  });
  expect(created.ok).toBe(true);
  await emit(two.socket, "join", { name: "Two", code: created.code });
  const a = server!.rooms.get(created.code!) as SpireGloomArena;
  await emit(one.socket, "ready");
  await emit(two.socket, "ready");
  await settle();
  expect(a.phase).toBe("lobby");
  expect(a.raid.spire!.problem).toMatch(/floor 21/);
  expect(a.players.every((p) => !p.ready)).toBe(true);
  expect(spire.floors).toEqual([]);
});

it("stops zone 3 at floor 29 unless every member has cleared Inkpurr's raid", async () => {
  const { connect, spire } = await setup();
  const one = await connect(),
    two = await connect();
  spire.members[one.account.id] = shadowWalker;
  spire.members[two.account.id] = {
    checkpoint: 21,
    clears: { grumblecrag: 1, tidewyrm: 1 },
  };
  const created = await emit(one.socket, "create", {
    name: "One",
    mode: "raid",
    spire: 21,
  });
  await emit(two.socket, "join", { name: "Two", code: created.code });
  const a = server!.rooms.get(created.code!) as SpireGloomArena;
  await emit(one.socket, "ready");
  await emit(two.socket, "ready");
  await settle();
  expect(a.phase).toBe("briefing");
  expect(a.raid.spire).toMatchObject({
    zone: 3,
    startFloor: 21,
    ceiling: 29,
  });
});

// ------------------------------------------------------------------ Zone 4
const dreamWalker: SpireMember = {
  checkpoint: 31,
  clears: { grumblecrag: 1, tidewyrm: 1, gloomshade: 1, somnara: 1 },
};

it("climbs zone 4 from floor 31 to the Ascendant Snoozaku on floor 40 → results, in one room", async () => {
  const { connect, recordRaid, recordActivity, spire } = await setup(
    true,
    dreamWalker,
  );
  const one = await connect(),
    two = await connect();
  const created = await emit(one.socket, "create", {
    name: "One",
    mode: "raid",
    spire: 31,
  });
  expect(created.ok).toBe(true);
  const joined = await emit(two.socket, "join", {
    name: "Two",
    code: created.code,
  });
  expect(joined.ok).toBe(true);
  const a = server!.rooms.get(created.code!) as SpireDreamArena;
  expect(a).toBeInstanceOf(SpireDreamArena);
  expect(a.raid.boss).toBe("somnara");
  const cache = new MetaCache();
  const seen: Snapshot[] = [];
  one.socket.on("state", (wire: WireSnapshot) =>
    seen.push(unpackSnapshot(wire, cache)),
  );
  await emit(one.socket, "ready");
  await emit(two.socket, "ready");
  await settle();
  expect(a.phase).toBe("briefing");
  expect(a.raid.spire).toMatchObject({
    zone: 4,
    startFloor: 31,
    floor: 31,
    ceiling: 40,
  });
  // The wave floors: the Spire's court, never Snoozaku's deck.
  expect(a.arenaId).toBe("classic");
  expect(a.raid.dream).toBeUndefined();
  for (const s of [one.socket, two.socket]) await emit(s, "instructions-ready");
  const ids = [created.id!, joined.id!];
  let dreamOnWaves = false;
  const step = async () => {
    for (const p of a.heroes()) p.hp = Math.max(p.hp, 900);
    if (a.phase === "playing" && a.raid.spire!.kind !== "boss")
      for (const p of a.players) if (p.echo && p.hp > 0) p.hp = 0;
    if (a.phase === "intermission")
      for (const [i, s] of [one.socket, two.socket].entries()) {
        const offer = a.raid.spire!.offers[ids[i]];
        if (offer?.[0]) await emit(s, "rite", { id: offer[0] });
      }
    server!.step();
    if (a.raid.spire!.kind !== "boss" && (a.raid.dream || a.raid.quietZone))
      dreamOnWaves = true;
  };
  for (let i = 0; i < 30 * 400 && a.raid.spire!.floor < 40; i++) await step();
  for (let i = 0; i < 30 * 5 && a.phase !== "briefing"; i++) await step();
  await settle();
  expect(dreamOnWaves).toBe(false);
  expect(server!.rooms.get(created.code!)).toBe(a);
  expect(a.raid.spire).toMatchObject({ floor: 40, kind: "boss", best: 39 });
  expect(a.phase).toBe("briefing");
  expect(a.raid.variant).toBe("ascendant");
  expect(a.arenaId).toBe("cloud-deck");
  expect(spire.floors.map((f) => f.floor)).toEqual([
    31, 32, 33, 34, 35, 36, 37, 38, 39,
  ]);
  expect(spire.floors.every((f) => f.startFloor === 31)).toBe(true);
  for (const s of [one.socket, two.socket]) await emit(s, "instructions-ready");
  for (let i = 0; i < 30 * 30 && a.phase !== "playing"; i++) await step();
  expect(a.phase).toBe("playing");
  for (let i = 0; i < 30 * 20; i++) await step();
  await settle();
  // What the players saw: Snoozaku's deck and its boss, under its Ascendant name.
  const last = seen.at(-1)!;
  expect(last.arena).toBe("cloud-deck");
  expect(last.raid?.spire).toMatchObject({ zone: 4, floor: 40 });
  expect(last.players.find((p) => p.raidBoss)?.name).toBe("Ascendant Snoozaku");
  const stream = seen.flatMap((s) => s.events.map((e) => e.id));
  for (let i = 1; i < stream.length; i++)
    expect(stream[i]).toBeGreaterThan(stream[i - 1]);
  // Beat it: saved as Spire floor 40 under both accounts, never a raid.
  a.boss()!.hp = 0;
  for (let i = 0; i < 30 * (SPIRE_PARTY.cleared + 0.5); i++) await step();
  await settle();
  expect(a.phase).toBe("finished");
  expect(a.raid.result).toBe("victory");
  expect(a.raid.message).toMatch(/Zone 4 conquered/);
  const forty = spire.floors.at(-1)!;
  expect(forty).toMatchObject({ floor: 40, startFloor: 31, partySize: 2 });
  expect(forty.players.map((p) => p.accountId).sort()).toEqual(
    [one.account.id, two.account.id].sort(),
  );
  expect(
    a.raid.spire!.saves.at(-1)!.claims!.find((c) => c.playerId === ids[0]),
  ).toMatchObject({ coins: 300, titles: ["Dreambreaker of the Spire"] });
  expect(recordRaid).not.toHaveBeenCalled();
  expect(recordActivity).not.toHaveBeenCalled();
  expect(a.raid.rewardStatus).toBeUndefined();
}, 120_000);

it("won't start zone 4 for a party asking for floor 31 without the checkpoint", async () => {
  const { connect, spire } = await setup();
  const one = await connect(),
    two = await connect();
  // One has conquered zone 3; Two only zone 2.
  spire.members[one.account.id] = dreamWalker;
  spire.members[two.account.id] = shadowWalker;
  const created = await emit(one.socket, "create", {
    name: "One",
    mode: "raid",
    spire: 31,
  });
  expect(created.ok).toBe(true);
  await emit(two.socket, "join", { name: "Two", code: created.code });
  const a = server!.rooms.get(created.code!) as SpireDreamArena;
  await emit(one.socket, "ready");
  await emit(two.socket, "ready");
  await settle();
  expect(a.phase).toBe("lobby");
  expect(a.raid.spire!.problem).toMatch(/floor 31/);
  expect(a.players.every((p) => !p.ready)).toBe(true);
  expect(spire.floors).toEqual([]);
});

it("stops zone 4 at floor 39 unless every member has cleared Snoozaku's raid", async () => {
  const { connect, spire } = await setup();
  const one = await connect(),
    two = await connect();
  spire.members[one.account.id] = dreamWalker;
  spire.members[two.account.id] = {
    checkpoint: 31,
    clears: { grumblecrag: 1, tidewyrm: 1, gloomshade: 1 },
  };
  const created = await emit(one.socket, "create", {
    name: "One",
    mode: "raid",
    spire: 31,
  });
  await emit(two.socket, "join", { name: "Two", code: created.code });
  const a = server!.rooms.get(created.code!) as SpireDreamArena;
  await emit(one.socket, "ready");
  await emit(two.socket, "ready");
  await settle();
  expect(a.phase).toBe("briefing");
  expect(a.raid.spire).toMatchObject({
    zone: 4,
    startFloor: 31,
    ceiling: 39,
  });
});

it("makes the party beat every wave, the last one too, before the floor clears", async () => {
  // The last wave once started after the tick's Echo count: the floor read
  // "nothing left", cleared and saved while that wave was still appearing.
  const { connect, spire } = await setup();
  const { socket } = await connect();
  const created = await emit(socket, "create", {
    name: "Climber",
    mode: "raid",
    spire: 0,
  });
  const a = server!.rooms.get(created.code!) as SpireArena;
  const cache = new MetaCache();
  const seen: Snapshot[] = [];
  socket.on("state", (wire: WireSnapshot) =>
    seen.push(unpackSnapshot(wire, cache)),
  );
  await emit(socket, "ready");
  await settle();
  await emit(socket, "instructions-ready");
  for (let i = 0; i < 125 && a.phase !== "playing"; i++) server!.step();
  expect(a.phase).toBe("playing");
  const waves = spireWaves(1, 1);
  expect(waves.length).toBeGreaterThanOrEqual(2);
  const sturdy = () => {
    for (const p of a.heroes()) p.hp = 999;
  };
  for (let w = 0; w < waves.length; w++) {
    // The wave arrives and steps onto the court.
    for (let i = 0; i < 200 && a.raid.spire!.wave !== w + 1; i++) {
      sturdy();
      server!.step();
    }
    for (let i = 0; i < 40; i++) {
      sturdy();
      server!.step();
    }
    await settle();
    const last = seen[seen.length - 1];
    const s = last.raid!.spire!;
    // What the player sees: this wave on the court, the floor not cleared.
    expect(s.wave).toBe(w + 1);
    expect(s.waves).toBe(waves.length);
    expect(s.clearedAt).toBeUndefined();
    expect(s.echoesLeft).toBe(waves[w].length);
    expect(last.players.filter((p) => p.echo && p.hp > 0)).toHaveLength(
      waves[w].length,
    );
    const hud = spireHudView(last);
    expect(hud.spire?.label).toBe(`Wave ${w + 1}/${waves.length}`);
    expect(hud.health).toBeCloseTo((w / waves.length) * 100, 5);
    // Nothing saved, no Blessing cards, until the last Echo falls.
    expect(spire.floors).toHaveLength(0);
    expect(a.raid.spire!.offers).toEqual({});
    for (const p of a.players) if (p.echo) p.hp = 0;
    server!.step();
  }
  await settle();
  const done = seen[seen.length - 1].raid!.spire!;
  expect(done.clearedAt).toBeDefined();
  expect(spireHudView(seen[seen.length - 1]).health).toBe(100);
  // No snapshot showed a cleared floor before the last wave was fought.
  const first = seen.findIndex((x) => x.raid?.spire?.clearedAt !== undefined);
  expect(
    seen
      .slice(0, first)
      .some(
        (x) =>
          x.raid?.spire?.wave === waves.length &&
          x.players.some((p) => p.echo && p.hp > 0),
      ),
  ).toBe(true);
  expect(spire.floors.map((f) => f.floor)).toEqual([1]);
});

// ------------------------------------------------------------------ Zone 5
const sunSeeker: SpireMember = {
  checkpoint: 41,
  clears: {
    grumblecrag: 1,
    tidewyrm: 1,
    gloomshade: 1,
    somnara: 1,
    prismatail: 1,
  },
};

it("climbs zone 5 from floor 41 to the Ascendant Prismell on floor 50 → results, in one room", async () => {
  const { connect, recordRaid, recordActivity, spire } = await setup(
    true,
    sunSeeker,
  );
  const one = await connect(),
    two = await connect();
  const created = await emit(one.socket, "create", {
    name: "One",
    mode: "raid",
    spire: 41,
  });
  expect(created.ok).toBe(true);
  const joined = await emit(two.socket, "join", {
    name: "Two",
    code: created.code,
  });
  expect(joined.ok).toBe(true);
  const a = server!.rooms.get(created.code!) as SpireLightArena;
  expect(a).toBeInstanceOf(SpireLightArena);
  expect(a.raid.boss).toBe("prismatail");
  const cache = new MetaCache();
  const seen: Snapshot[] = [];
  one.socket.on("state", (wire: WireSnapshot) =>
    seen.push(unpackSnapshot(wire, cache)),
  );
  await emit(one.socket, "ready");
  await emit(two.socket, "ready");
  await settle();
  expect(a.phase).toBe("briefing");
  expect(a.raid.spire).toMatchObject({
    zone: 5,
    startFloor: 41,
    floor: 41,
    ceiling: 50,
  });
  // The wave floors: the Spire's court, never Prismell's atrium.
  expect(a.arenaId).toBe("classic");
  expect(a.raid.mirrors ?? []).toEqual([]);
  for (const s of [one.socket, two.socket]) await emit(s, "instructions-ready");
  const ids = [created.id!, joined.id!];
  let atriumOnWaves = false;
  const step = async () => {
    for (const p of a.heroes()) p.hp = Math.max(p.hp, 900);
    if (a.phase === "playing" && a.raid.spire!.kind !== "boss")
      for (const p of a.players) if (p.echo && p.hp > 0) p.hp = 0;
    if (a.phase === "intermission")
      for (const [i, s] of [one.socket, two.socket].entries()) {
        const offer = a.raid.spire!.offers[ids[i]];
        if (offer?.[0]) await emit(s, "rite", { id: offer[0] });
      }
    server!.step();
    if (
      a.raid.spire!.kind !== "boss" &&
      ((a.raid.mirrors ?? []).length || (a.raid.lightLinks ?? []).length)
    )
      atriumOnWaves = true;
  };
  for (let i = 0; i < 30 * 400 && a.raid.spire!.floor < 50; i++) await step();
  for (let i = 0; i < 30 * 5 && a.phase !== "briefing"; i++) await step();
  await settle();
  expect(atriumOnWaves).toBe(false);
  expect(server!.rooms.get(created.code!)).toBe(a);
  expect(a.raid.spire).toMatchObject({ floor: 50, kind: "boss", best: 49 });
  expect(a.phase).toBe("briefing");
  expect(a.raid.variant).toBe("ascendant");
  expect(a.arenaId).toBe("sun-atrium");
  expect(spire.floors.map((f) => f.floor)).toEqual([
    41, 42, 43, 44, 45, 46, 47, 48, 49,
  ]);
  expect(spire.floors.every((f) => f.startFloor === 41)).toBe(true);
  for (const s of [one.socket, two.socket]) await emit(s, "instructions-ready");
  for (let i = 0; i < 30 * 30 && a.phase !== "playing"; i++) await step();
  expect(a.phase).toBe("playing");
  for (let i = 0; i < 30 * 20; i++) await step();
  await settle();
  // What the players saw: Prismell's atrium and its boss, under its Ascendant name.
  const last = seen.at(-1)!;
  expect(last.arena).toBe("sun-atrium");
  expect(last.raid?.spire).toMatchObject({ zone: 5, floor: 50 });
  expect(last.raid?.mirrors?.length).toBeGreaterThan(0);
  expect(last.players.find((p) => p.raidBoss)?.name).toBe("Ascendant Prismell");
  const stream = seen.flatMap((s) => s.events.map((e) => e.id));
  for (let i = 1; i < stream.length; i++)
    expect(stream[i]).toBeGreaterThan(stream[i - 1]);
  // Beat it: saved as Spire floor 50 under both accounts, never a raid.
  a.boss()!.hp = 0;
  for (let i = 0; i < 30 * (SPIRE_PARTY.cleared + 0.5); i++) await step();
  await settle();
  expect(a.phase).toBe("finished");
  expect(a.raid.result).toBe("victory");
  expect(a.raid.message).toMatch(/Zone 5 conquered/);
  const fifty = spire.floors.at(-1)!;
  expect(fifty).toMatchObject({ floor: 50, startFloor: 41, partySize: 2 });
  expect(fifty.players.map((p) => p.accountId).sort()).toEqual(
    [one.account.id, two.account.id].sort(),
  );
  expect(
    a.raid.spire!.saves.at(-1)!.claims!.find((c) => c.playerId === ids[0]),
  ).toMatchObject({ coins: 350, titles: ["Sunbreaker of the Spire"] });
  expect(recordRaid).not.toHaveBeenCalled();
  expect(recordActivity).not.toHaveBeenCalled();
  expect(a.raid.rewardStatus).toBeUndefined();
}, 120_000);

it("won't start zone 5 for a party asking for floor 41 without the checkpoint", async () => {
  const { connect, spire } = await setup();
  const one = await connect(),
    two = await connect();
  // One has conquered zone 4; Two only zone 3.
  spire.members[one.account.id] = sunSeeker;
  spire.members[two.account.id] = dreamWalker;
  const created = await emit(one.socket, "create", {
    name: "One",
    mode: "raid",
    spire: 41,
  });
  expect(created.ok).toBe(true);
  await emit(two.socket, "join", { name: "Two", code: created.code });
  const a = server!.rooms.get(created.code!) as SpireLightArena;
  await emit(one.socket, "ready");
  await emit(two.socket, "ready");
  await settle();
  expect(a.phase).toBe("lobby");
  expect(a.raid.spire!.problem).toMatch(/floor 41/);
  expect(a.players.every((p) => !p.ready)).toBe(true);
  expect(spire.floors).toEqual([]);
});

it("stops zone 5 at floor 49 unless every member has cleared Prismell's raid", async () => {
  const { connect, spire } = await setup();
  const one = await connect(),
    two = await connect();
  spire.members[one.account.id] = sunSeeker;
  // Two has conquered zone 4 but never cleared Prismell's raid; one's
  // missing clears of the zones below never close zone 5's room.
  spire.members[two.account.id] = {
    checkpoint: 41,
    clears: { grumblecrag: 1, somnara: 1 },
  };
  const created = await emit(one.socket, "create", {
    name: "One",
    mode: "raid",
    spire: 41,
  });
  await emit(two.socket, "join", { name: "Two", code: created.code });
  const a = server!.rooms.get(created.code!) as SpireLightArena;
  await emit(one.socket, "ready");
  await emit(two.socket, "ready");
  await settle();
  expect(a.phase).toBe("briefing");
  expect(a.raid.spire).toMatchObject({
    zone: 5,
    startFloor: 41,
    ceiling: 49,
  });
});

// ------------------------------------------------------------------ Zone 6
const flameSeeker: SpireMember = {
  checkpoint: 51,
  clears: {
    grumblecrag: 1,
    tidewyrm: 1,
    gloomshade: 1,
    somnara: 1,
    prismatail: 1,
    emberwing: 1,
  },
};

it("climbs zone 6 from floor 51 to the Ascendant Lumiwick on floor 60 → results, in one room", async () => {
  const { connect, recordRaid, recordActivity, spire } = await setup(
    true,
    flameSeeker,
  );
  const one = await connect(),
    two = await connect();
  const created = await emit(one.socket, "create", {
    name: "One",
    mode: "raid",
    spire: 51,
  });
  expect(created.ok).toBe(true);
  const joined = await emit(two.socket, "join", {
    name: "Two",
    code: created.code,
  });
  expect(joined.ok).toBe(true);
  const a = server!.rooms.get(created.code!) as SpireEmberArena;
  expect(a).toBeInstanceOf(SpireEmberArena);
  expect(a.raid.boss).toBe("emberwing");
  const cache = new MetaCache();
  const seen: Snapshot[] = [];
  one.socket.on("state", (wire: WireSnapshot) =>
    seen.push(unpackSnapshot(wire, cache)),
  );
  await emit(one.socket, "ready");
  await emit(two.socket, "ready");
  await settle();
  expect(a.phase).toBe("briefing");
  expect(a.raid.spire).toMatchObject({
    zone: 6,
    startFloor: 51,
    floor: 51,
    ceiling: 60,
  });
  // The wave floors: the Spire's court, never Lumiwick's terrace.
  expect(a.arenaId).toBe("classic");
  expect(a.raid.braziers ?? []).toEqual([]);
  for (const s of [one.socket, two.socket]) await emit(s, "instructions-ready");
  const ids = [created.id!, joined.id!];
  let terraceOnWaves = false;
  const step = async () => {
    for (const p of a.heroes()) p.hp = Math.max(p.hp, 900);
    if (a.phase === "playing" && a.raid.spire!.kind !== "boss")
      for (const p of a.players) if (p.echo && p.hp > 0) p.hp = 0;
    if (a.phase === "intermission")
      for (const [i, s] of [one.socket, two.socket].entries()) {
        const offer = a.raid.spire!.offers[ids[i]];
        if (offer?.[0]) await emit(s, "rite", { id: offer[0] });
      }
    server!.step();
    if (
      a.raid.spire!.kind !== "boss" &&
      ((a.raid.braziers ?? []).length ||
        a.raid.airborne ||
        (a.raid.flameRings ?? []).length ||
        (a.raid.emberPatches ?? []).length)
    )
      terraceOnWaves = true;
  };
  for (let i = 0; i < 30 * 400 && a.raid.spire!.floor < 60; i++) await step();
  for (let i = 0; i < 30 * 5 && a.phase !== "briefing"; i++) await step();
  await settle();
  expect(terraceOnWaves).toBe(false);
  expect(server!.rooms.get(created.code!)).toBe(a);
  expect(a.raid.spire).toMatchObject({ floor: 60, kind: "boss", best: 59 });
  expect(a.phase).toBe("briefing");
  expect(a.raid.variant).toBe("ascendant");
  expect(a.arenaId).toBe("sky-terrace");
  expect(spire.floors.map((f) => f.floor)).toEqual([
    51, 52, 53, 54, 55, 56, 57, 58, 59,
  ]);
  expect(spire.floors.every((f) => f.startFloor === 51)).toBe(true);
  for (const s of [one.socket, two.socket]) await emit(s, "instructions-ready");
  for (let i = 0; i < 30 * 30 && a.phase !== "playing"; i++) await step();
  expect(a.phase).toBe("playing");
  for (let i = 0; i < 30 * 20; i++) await step();
  await settle();
  // What the players saw: Lumiwick's terrace and its boss, under its Ascendant name.
  const last = seen.at(-1)!;
  expect(last.arena).toBe("sky-terrace");
  expect(last.raid?.spire).toMatchObject({ zone: 6, floor: 60 });
  expect(last.raid?.braziers?.length).toBe(3);
  expect(last.players.find((p) => p.raidBoss)?.name).toBe("Ascendant Lumiwick");
  const stream = seen.flatMap((s) => s.events.map((e) => e.id));
  for (let i = 1; i < stream.length; i++)
    expect(stream[i]).toBeGreaterThan(stream[i - 1]);
  // Beat it: saved as Spire floor 60 under both accounts, never a raid.
  a.boss()!.hp = 0;
  for (let i = 0; i < 30 * (SPIRE_PARTY.cleared + 0.5); i++) await step();
  await settle();
  expect(a.phase).toBe("finished");
  expect(a.raid.result).toBe("victory");
  expect(a.raid.message).toMatch(/Zone 6 conquered/);
  const sixty = spire.floors.at(-1)!;
  expect(sixty).toMatchObject({ floor: 60, startFloor: 51, partySize: 2 });
  expect(sixty.players.map((p) => p.accountId).sort()).toEqual(
    [one.account.id, two.account.id].sort(),
  );
  expect(
    a.raid.spire!.saves.at(-1)!.claims!.find((c) => c.playerId === ids[0]),
  ).toMatchObject({ coins: 400, titles: ["Flamebreaker of the Spire"] });
  expect(recordRaid).not.toHaveBeenCalled();
  expect(recordActivity).not.toHaveBeenCalled();
  expect(a.raid.rewardStatus).toBeUndefined();
}, 120_000);

it("won't start zone 6 for a party asking for floor 51 without the checkpoint", async () => {
  const { connect, spire } = await setup();
  const one = await connect(),
    two = await connect();
  // One has conquered zone 5; Two only zone 4.
  spire.members[one.account.id] = flameSeeker;
  spire.members[two.account.id] = sunSeeker;
  const created = await emit(one.socket, "create", {
    name: "One",
    mode: "raid",
    spire: 51,
  });
  expect(created.ok).toBe(true);
  await emit(two.socket, "join", { name: "Two", code: created.code });
  const a = server!.rooms.get(created.code!) as SpireEmberArena;
  await emit(one.socket, "ready");
  await emit(two.socket, "ready");
  await settle();
  expect(a.phase).toBe("lobby");
  expect(a.raid.spire!.problem).toMatch(/floor 51/);
  expect(a.players.every((p) => !p.ready)).toBe(true);
  expect(spire.floors).toEqual([]);
});

it("stops zone 6 at floor 59 unless every member has cleared Lumiwick's raid", async () => {
  const { connect, spire } = await setup();
  const one = await connect(),
    two = await connect();
  spire.members[one.account.id] = flameSeeker;
  // Two has conquered zone 5 but never cleared Lumiwick's raid; one's
  // missing clears of the zones below never close zone 6's room.
  spire.members[two.account.id] = {
    checkpoint: 51,
    clears: { grumblecrag: 1, prismatail: 1 },
  };
  const created = await emit(one.socket, "create", {
    name: "One",
    mode: "raid",
    spire: 51,
  });
  await emit(two.socket, "join", { name: "Two", code: created.code });
  const a = server!.rooms.get(created.code!) as SpireEmberArena;
  await emit(one.socket, "ready");
  await emit(two.socket, "ready");
  await settle();
  expect(a.phase).toBe("briefing");
  expect(a.raid.spire).toMatchObject({
    zone: 6,
    startFloor: 51,
    ceiling: 59,
  });
});

it("never opens floor 60 to a party whose only Lumiwick clear is someone else's boss", async () => {
  const { connect, spire } = await setup();
  const one = await connect();
  // Every boss but Lumiwick: zone 6's room asks for its own boss only.
  spire.members[one.account.id] = {
    checkpoint: 51,
    clears: {
      grumblecrag: 1,
      tidewyrm: 1,
      gloomshade: 1,
      somnara: 1,
      prismatail: 1,
    },
  };
  const created = await emit(one.socket, "create", {
    name: "One",
    mode: "raid",
    spire: 51,
  });
  const a = server!.rooms.get(created.code!) as SpireEmberArena;
  await emit(one.socket, "ready");
  await settle();
  expect(a.raid.spire).toMatchObject({ zone: 6, ceiling: 59 });
});

// ------------------------------------------------------------------ Zone 7
const stormSeeker: SpireMember = {
  checkpoint: 61,
  clears: {
    grumblecrag: 1,
    tidewyrm: 1,
    gloomshade: 1,
    somnara: 1,
    prismatail: 1,
    emberwing: 1,
    "storm-twins": 1,
  },
};

it("climbs zone 7 from floor 61 to the Ascendant Storm Twins on floor 70 → the whole Spire conquered, in one room", async () => {
  const { connect, recordRaid, recordActivity, spire } = await setup(
    true,
    stormSeeker,
  );
  const one = await connect(),
    two = await connect();
  const created = await emit(one.socket, "create", {
    name: "One",
    mode: "raid",
    spire: 61,
  });
  expect(created.ok).toBe(true);
  const joined = await emit(two.socket, "join", {
    name: "Two",
    code: created.code,
  });
  expect(joined.ok).toBe(true);
  const a = server!.rooms.get(created.code!) as SpireStormArena;
  expect(a).toBeInstanceOf(SpireStormArena);
  expect(a.raid.boss).toBe("storm-twins");
  const cache = new MetaCache();
  const seen: Snapshot[] = [];
  one.socket.on("state", (wire: WireSnapshot) =>
    seen.push(unpackSnapshot(wire, cache)),
  );
  await emit(one.socket, "ready");
  await emit(two.socket, "ready");
  await settle();
  expect(a.phase).toBe("briefing");
  expect(a.raid.spire).toMatchObject({
    zone: 7,
    startFloor: 61,
    floor: 61,
    ceiling: 70,
  });
  // The wave floors: the Spire's court, never the twins' ring.
  expect(a.arenaId).toBe("classic");
  expect(a.raid.twins ?? []).toEqual([]);
  for (const s of [one.socket, two.socket]) await emit(s, "instructions-ready");
  const ids = [created.id!, joined.id!];
  let ringOnWaves = false;
  const step = async () => {
    for (const p of a.heroes()) p.hp = Math.max(p.hp, 900);
    if (a.phase === "playing" && a.raid.spire!.kind !== "boss")
      for (const p of a.players) if (p.echo && p.hp > 0) p.hp = 0;
    if (a.phase === "intermission")
      for (const [i, s] of [one.socket, two.socket].entries()) {
        const offer = a.raid.spire!.offers[ids[i]];
        if (offer?.[0]) await emit(s, "rite", { id: offer[0] });
      }
    server!.step();
    if (
      a.raid.spire!.kind !== "boss" &&
      ((a.raid.twins ?? []).length ||
        a.players.some((p) => p.raidBoss) ||
        a.raid.stormBeam ||
        (a.raid.stormFields ?? []).length ||
        (a.raid.stormRushes ?? []).length)
    )
      ringOnWaves = true;
  };
  for (let i = 0; i < 30 * 400 && a.raid.spire!.floor < 70; i++) await step();
  for (let i = 0; i < 30 * 5 && a.phase !== "briefing"; i++) await step();
  await settle();
  expect(ringOnWaves).toBe(false);
  expect(server!.rooms.get(created.code!)).toBe(a);
  expect(a.raid.spire).toMatchObject({ floor: 70, kind: "boss", best: 69 });
  expect(a.phase).toBe("briefing");
  expect(a.raid.variant).toBe("ascendant");
  expect(a.arenaId).toBe("conductor-ring");
  expect(spire.floors.map((f) => f.floor)).toEqual([
    61, 62, 63, 64, 65, 66, 67, 68, 69,
  ]);
  expect(spire.floors.every((f) => f.startFloor === 61)).toBe(true);
  for (const s of [one.socket, two.socket]) await emit(s, "instructions-ready");
  for (let i = 0; i < 30 * 30 && a.phase !== "playing"; i++) await step();
  expect(a.phase).toBe("playing");
  for (let i = 0; i < 30 * 20; i++) await step();
  await settle();
  // What the players saw: the twins' ring and both twins, by their names.
  const last = seen.at(-1)!;
  expect(last.arena).toBe("conductor-ring");
  expect(last.raid?.spire).toMatchObject({ zone: 7, floor: 70 });
  expect(last.raid?.name).toBe("Ascendant Storm Twins");
  expect(last.raid?.twins?.map((t) => t.name)).toEqual(["Fizz", "Crackle"]);
  expect(last.players.filter((p) => p.raidBoss).map((p) => p.name)).toEqual([
    "Fizz",
    "Crackle",
  ]);
  const stream = seen.flatMap((s) => s.events.map((e) => e.id));
  for (let i = 1; i < stream.length; i++)
    expect(stream[i]).toBeGreaterThan(stream[i - 1]);
  // Beat both twins: saved as Spire floor 70 under both accounts, never a raid.
  for (const p of a.players.filter((q) => q.raidBoss)) p.hp = 0;
  for (let i = 0; i < 30 * (SPIRE_PARTY.cleared + 0.5); i++) await step();
  await settle();
  expect(a.phase).toBe("finished");
  expect(a.raid.result).toBe("victory");
  expect(a.raid.message).toBe("Zone 7 conquered — the Spire is yours.");
  const seventy = spire.floors.at(-1)!;
  expect(seventy).toMatchObject({ floor: 70, startFloor: 61, partySize: 2 });
  expect(seventy.players.map((p) => p.accountId).sort()).toEqual(
    [one.account.id, two.account.id].sort(),
  );
  expect(
    a.raid.spire!.saves.at(-1)!.claims!.find((c) => c.playerId === ids[0]),
  ).toMatchObject({ coins: 500, titles: ["Stormbreaker of the Spire"] });
  expect(recordRaid).not.toHaveBeenCalled();
  expect(recordActivity).not.toHaveBeenCalled();
  expect(a.raid.rewardStatus).toBeUndefined();
}, 120_000);

it("won't start zone 7 for a party asking for floor 61 without the checkpoint", async () => {
  const { connect, spire } = await setup();
  const one = await connect(),
    two = await connect();
  // One has conquered zone 6; Two only zone 5.
  spire.members[one.account.id] = stormSeeker;
  spire.members[two.account.id] = flameSeeker;
  const created = await emit(one.socket, "create", {
    name: "One",
    mode: "raid",
    spire: 61,
  });
  expect(created.ok).toBe(true);
  await emit(two.socket, "join", { name: "Two", code: created.code });
  const a = server!.rooms.get(created.code!) as SpireStormArena;
  await emit(one.socket, "ready");
  await emit(two.socket, "ready");
  await settle();
  expect(a.phase).toBe("lobby");
  expect(a.raid.spire!.problem).toMatch(/floor 61/);
  expect(a.players.every((p) => !p.ready)).toBe(true);
  expect(spire.floors).toEqual([]);
});

it("stops zone 7 at floor 69 unless every member has cleared the Storm Twins' raid", async () => {
  const { connect, spire } = await setup();
  const one = await connect(),
    two = await connect();
  spire.members[one.account.id] = stormSeeker;
  // Two has conquered zone 6 but never cleared the twins' raid; its missing
  // clears of the zones below never close zone 7's room.
  spire.members[two.account.id] = {
    checkpoint: 61,
    clears: { grumblecrag: 1, emberwing: 1 },
  };
  const created = await emit(one.socket, "create", {
    name: "One",
    mode: "raid",
    spire: 61,
  });
  await emit(two.socket, "join", { name: "Two", code: created.code });
  const a = server!.rooms.get(created.code!) as SpireStormArena;
  await emit(one.socket, "ready");
  await emit(two.socket, "ready");
  await settle();
  expect(a.phase).toBe("briefing");
  expect(a.raid.spire).toMatchObject({
    zone: 7,
    startFloor: 61,
    ceiling: 69,
  });
});

it("never opens floor 70 to a party whose only clears are the other bosses'", async () => {
  const { connect, spire } = await setup();
  const one = await connect();
  // Every boss but the Storm Twins: zone 7's room asks for its own boss only.
  spire.members[one.account.id] = {
    checkpoint: 61,
    clears: {
      grumblecrag: 1,
      tidewyrm: 1,
      gloomshade: 1,
      somnara: 1,
      prismatail: 1,
      emberwing: 1,
    },
  };
  const created = await emit(one.socket, "create", {
    name: "One",
    mode: "raid",
    spire: 61,
  });
  const a = server!.rooms.get(created.code!) as SpireStormArena;
  await emit(one.socket, "ready");
  await settle();
  expect(a.raid.spire).toMatchObject({ zone: 7, ceiling: 69 });
});
