import { afterEach, expect, it, vi } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts, fakeSpire } from "../helpers/accounts";
import {
  SpireArena,
  SpireGloomArena,
  SpireTideArena,
} from "../../apps/server/src/spire";
import {
  MetaCache,
  unpackSnapshot,
  type Reply,
  type Snapshot,
  type WireSnapshot,
} from "@arena/shared";
import { SPIRE_PARTY, type SpireMember } from "../../packages/shared/src/spire";

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
  for (const spireFloor of [2, 10, 15, 20, 25, 30, 31, -1, 1.5])
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
