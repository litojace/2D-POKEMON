import { afterEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import {
  BACKPRESSURE,
  createArenaServer,
} from "../../apps/server/src/server.js";
import { SomnaraArena } from "../../apps/server/src/raid-somnara.js";
import { fakeAccounts, fakeSpire } from "../helpers/accounts";
import { SpireArena } from "../../apps/server/src/spire.js";
import { SPIRE_PARTY } from "../../packages/shared/src/spire.js";
import {
  SnapshotDeltaDecoder,
  blankInput,
  type Reply,
  type WireSnapshot,
  type WireSnapshotDelta,
} from "../../packages/shared/src/index.js";

/**
 * Snapshots as changes (snapshot-delta.ts; network-performance.md section
 * 21), over real Socket.IO connections. A client that says it understands
 * deltas is sent a whole snapshot once and changes after that; one that
 * does not say so (an older app) is sent whole snapshots as ever; and
 * whatever happens to a connection, what it shows is a snapshot the server
 * made, never a mix of two.
 */
let server: ReturnType<typeof createArenaServer> | undefined,
  clients: Socket[] = [];
const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms));
async function until(condition: () => boolean, timeout = 3000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) throw new Error("Timed out waiting");
    await wait(5);
  }
}
const emit = (socket: Socket, event: string, data: unknown = {}) =>
  new Promise<Reply>((resolve, reject) =>
    socket
      .timeout(1000)
      .emit(event, data, (error: Error | null, result: Reply) =>
        error ? reject(error) : resolve(result),
      ),
  );
afterEach(async () => {
  for (const c of clients) c.disconnect();
  clients = [];
  await server?.close();
  server = undefined;
});

async function setup(
  options: Parameters<typeof createArenaServer>[0] = { snapshotDelta: true },
) {
  const accounts = fakeAccounts();
  accounts.provider.rpc = async () => ({
    clears: 1,
    highestPeril: 3,
    cosmetics: [],
    bosses: { grumblecrag: { clears: 1, highestPeril: 3 } },
  });
  accounts.provider.recordRaid = async () => {};
  accounts.provider.recordActivity = async () => {};
  fakeSpire(accounts.provider);
  server = createArenaServer({
    autoTick: false,
    reconnectMs: 60_000,
    accounts: accounts.provider,
    ...options,
  });
  await new Promise<void>((r) => server!.http.listen(0, "127.0.0.1", r));
  const { port } = server.http.address() as { port: number };
  /** `delta`: what the app's handshake says (1), or an older app (nothing). */
  const connect = async (delta: boolean, token = accounts.add().token) => {
    const socket = io(`http://127.0.0.1:${port}`, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
      auth: { accessToken: token, ...(delta ? { delta: 1 } : {}) },
    });
    clients.push(socket);
    await new Promise<void>((r) => socket.on("connect", r));
    return socket;
  };
  return { connect, server };
}

interface Seen {
  kind: "whole" | "delta" | "refused";
  /** What the game would be handed (nothing for a refused delta). */
  wire?: WireSnapshot;
  bytes: number;
}
/** Receive snapshots exactly as the game client does (main.ts). */
function follow(socket: Socket) {
  const decoder = new SnapshotDeltaDecoder();
  const seen: Seen[] = [];
  const state = { lose: 0, asked: 0 };
  socket.on("state", (wire: WireSnapshot) => {
    decoder.full(wire);
    seen.push({ kind: "whole", wire, bytes: JSON.stringify(wire).length });
  });
  socket.on("state-delta", (message: WireSnapshotDelta) => {
    // A test can make the next deltas vanish, as no network should.
    if (state.lose > 0) return void state.lose--;
    const bytes = JSON.stringify(message).length;
    const wire = decoder.delta(message);
    if (wire) return void seen.push({ kind: "delta", wire, bytes });
    seen.push({ kind: "refused", bytes });
    state.asked++;
    socket.emit("state-full", { code: message.code });
  });
  const shown = () => seen.filter((s) => s.wire).map((s) => s.wire!);
  return {
    seen,
    state,
    shown,
    kinds: () => seen.map((s) => s.kind),
    last: () => shown().at(-1)!,
    /** Numbered snapshots by their number. */
    byNumber: () =>
      new Map(
        shown()
          .filter((w) => w.n !== undefined)
          .map((w) => [w.n!, w]),
      ),
    events: () => shown().flatMap((w) => w.events.map((e) => e.id)),
  };
}
type Follower = ReturnType<typeof follow>;
/** Every numbered snapshot both saw is the same snapshot. */
function expectSameMatch(a: Follower, b: Follower, atLeast: number) {
  const mine = a.byNumber(),
    theirs = b.byNumber();
  let shared = 0;
  for (const [n, wire] of mine) {
    const other = theirs.get(n);
    if (!other) continue;
    shared++;
    expect(wire).toStrictEqual(other);
  }
  expect(shared).toBeGreaterThanOrEqual(atLeast);
}
/** Steps of a fight: the first seat runs, shoots and casts. */
async function play(
  sockets: Socket[],
  arena: { players: { ack: number }[] },
  steps: number,
) {
  for (let i = 0; i < steps; i++) {
    sockets.forEach((socket, seat) =>
      socket.emit("input", {
        ...blankInput(),
        seq: arena.players[seat].ack + 1,
        dx: Math.cos(i / 9 + seat),
        dy: Math.sin(i / 9 + seat),
        basic: seat === 0,
        skill: seat === 0 && i % 20 === 5 ? ((i / 20) % 4) | 0 : -1,
        aimX: 1200,
        aimY: 450,
      }),
    );
    await wait(3);
    server!.step();
  }
  await wait();
}
async function duel(
  connect: (delta: boolean) => Promise<Socket>,
  kinds = [false, true],
) {
  const one = await connect(kinds[0]),
    two = await connect(kinds[1]);
  const a = follow(one),
    b = follow(two);
  const host = await emit(one, "create", { name: "One" });
  await emit(two, "join", { name: "Two", code: host.code });
  const arena = server!.rooms.get(host.code!)!;
  const start = () => {
    arena.start();
    arena.phase = "playing";
    arena.deadline = arena.time + 10_000;
  };
  return { one, two, a, b, arena, start, code: host.code! };
}

it("an older client is sent whole snapshots, a newer one changes, and both see the same match", async () => {
  const { connect } = await setup();
  const { one, two, a: old, b: fresh, arena, start } = await duel(connect);
  server!.step();
  await wait();
  start();
  await play([one, two], arena, 150);
  // The older client never hears of deltas.
  expect(old.kinds()).not.toContain("delta");
  expect(old.seen.length).toBeGreaterThan(150);
  // The newer one: whole snapshots until the fight (the lobby hides picks
  // per side), one whole numbered snapshot, then changes only.
  const kinds = fresh.kinds();
  const first = fresh.seen.findIndex((s) => s.wire?.n !== undefined);
  expect(kinds[first]).toBe("whole");
  expect(kinds.slice(first + 1).every((k) => k === "delta")).toBe(true);
  expect(kinds.slice(first + 1).length).toBeGreaterThanOrEqual(149);
  expect(fresh.state.asked).toBe(0);
  expectSameMatch(old, fresh, 150);
  // Events (casts, hits) reach both, once each, in order.
  expect(fresh.events().length).toBeGreaterThan(5);
  expect(fresh.events()).toEqual(old.events());
  expect(fresh.events()).toEqual([...fresh.events()].sort((x, y) => x - y));
  // And it is worth it: the same fight in well under half the bytes.
  const bytes = (f: Follower) =>
    f.seen.slice(-150).reduce((sum, s) => sum + s.bytes, 0);
  expect(bytes(fresh) / bytes(old)).toBeLessThan(0.45);
});

it("the switch is on unless SNAPSHOT_DELTA says off", async () => {
  const { connect } = await setup({});
  const { one, two, b, arena, start } = await duel(connect);
  start();
  await play([one, two], arena, 10);
  expect(b.kinds().filter((k) => k === "delta").length).toBeGreaterThan(5);
});

it("with the switch off (or an older server), a newer client is sent whole snapshots", async () => {
  // SNAPSHOT_DELTA=off on the server: what it sent before deltas existed.
  const { connect } = await setup({ snapshotDelta: false });
  const { one, two, a, b, arena, start } = await duel(connect, [true, true]);
  start();
  await play([one, two], arena, 20);
  for (const f of [a, b]) {
    expect(f.kinds().every((k) => k === "whole")).toBe(true);
    expect(f.seen.length).toBeGreaterThanOrEqual(20);
    // No numbers, so the client keeps (and copies) nothing.
    expect(f.shown().every((w) => w.n === undefined)).toBe(true);
  }
  expect(a.last()).toStrictEqual(b.last());
});

it("when everyone in the room takes deltas, the whole snapshot is not encoded at all", async () => {
  const { connect, server } = await setup();
  const { one, two, arena, start } = await duel(connect, [true, true]);
  start();
  await play([one, two], arena, 3);
  const adapter = server.io.sockets.adapter;
  const original = adapter.broadcast;
  const sent: string[] = [];
  adapter.broadcast = function (packet, ...rest) {
    sent.push(String((packet.data as unknown[] | undefined)?.[0]));
    return original.call(this, packet, ...rest);
  };
  for (let i = 0; i < 5; i++) server.step();
  adapter.broadcast = original;
  expect(sent).toEqual(Array(5).fill("state-delta"));
});

it("a friend who starts watching mid-fight gets a whole snapshot, then changes", async () => {
  const { connect } = await setup();
  const {
    one,
    two,
    a: old,
    b: fresh,
    arena,
    start,
    code,
  } = await duel(connect);
  start();
  await play([one, two], arena, 20);
  const friend = await connect(true);
  const watcher = follow(friend);
  expect((await emit(friend, "watch", { code })).ok).toBe(true);
  await play([one, two], arena, 30);
  expect(watcher.kinds()[0]).toBe("whole");
  expect(
    watcher
      .kinds()
      .slice(1)
      .every((k) => k === "delta"),
  ).toBe(true);
  expect(watcher.seen.length).toBeGreaterThanOrEqual(30);
  // The appearance block sent for the newcomer reached the player's delta
  // and was gone again from the snapshot after it.
  const withMeta = fresh.shown().filter((w) => w.meta);
  expect(withMeta.length).toBeGreaterThan(0);
  expect(fresh.last().meta).toBeUndefined();
  expect(fresh.kinds().filter((k) => k === "whole").length).toBe(
    fresh.shown().filter((w) => w.n === undefined).length + 1,
  );
  expectSameMatch(old, watcher, 30);
  expectSameMatch(old, fresh, 50);
});

it("a player who reconnects starts from a whole snapshot", async () => {
  const { connect } = await setup();
  const one = await connect(false);
  const old = follow(one);
  const host = await emit(one, "create", { name: "One" });
  const two = await connect(true);
  const guest = await emit(two, "join", { name: "Two", code: host.code });
  const before = follow(two);
  const arena = server!.rooms.get(host.code!)!;
  arena.start();
  arena.phase = "playing";
  arena.deadline = arena.time + 10_000;
  await play([one, two], arena, 15);
  expect(before.kinds().at(-1)).toBe("delta");
  two.disconnect();
  await play([one], arena, 5);
  const again = await connect(
    true,
    (two.auth as { accessToken: string }).accessToken,
  );
  const after = follow(again);
  expect((await emit(again, "resume", { token: guest.token })).ok).toBe(true);
  arena.phase = "playing";
  await play([one, again], arena, 20);
  expect(after.kinds()[0]).toBe("whole");
  expect(after.kinds()).not.toContain("refused");
  expect(after.kinds().filter((k) => k === "delta").length).toBeGreaterThan(10);
  expectSameMatch(old, after, 15);
});

it("a delta that goes missing: nothing wrong is shown, and a whole snapshot puts it right", async () => {
  const { connect } = await setup();
  const { one, two, a: old, b: fresh, arena, start } = await duel(connect);
  start();
  await play([one, two], arena, 10);
  const shownBefore = fresh.shown().length;
  fresh.state.lose = 1;
  await play([one, two], arena, 1);
  expect(fresh.shown().length).toBe(shownBefore);
  await play([one, two], arena, 20);
  // The delta after the gap was refused and the client asked once or twice
  // (a second delta can be on its way before the server hears).
  const kinds = fresh.kinds();
  const refused = kinds.indexOf("refused");
  expect(refused).toBeGreaterThan(0);
  expect(fresh.state.asked).toBeGreaterThanOrEqual(1);
  expect(fresh.state.asked).toBeLessThanOrEqual(3);
  const whole = kinds.indexOf("whole", refused);
  expect(whole).toBeGreaterThan(refused);
  expect(kinds.slice(refused, whole).every((k) => k === "refused")).toBe(true);
  expect(kinds.slice(whole + 1).every((k) => k === "delta")).toBe(true);
  expect(kinds.slice(whole + 1).length).toBeGreaterThan(10);
  // Everything it did show is a snapshot the server made.
  expectSameMatch(old, fresh, 25);
  expect(fresh.last()).toStrictEqual(old.last());
});

it("in a quiet room, the whole snapshot a client asks for comes on the next tick", async () => {
  const { connect } = await setup();
  const one = await connect(true);
  const host = follow(one);
  const created = await emit(one, "create", { name: "One", mode: "raid" });
  expect(created.ok).toBe(true);
  // A raid's lobby is one snapshot for everyone, sent when it changes.
  for (let i = 0; i < 4; i++) server!.step();
  await wait();
  const before = host.seen.length;
  expect(host.last().phase).toBe("lobby");
  for (let i = 0; i < 4; i++) server!.step();
  await wait();
  expect(host.seen.length).toBe(before);
  one.emit("state-full", { code: created.code });
  await wait();
  server!.step();
  await until(() => host.seen.length > before);
  expect(host.seen[before].kind).toBe("whole");
  // Asking about a room you are not in changes nothing.
  one.emit("state-full", { code: "NOPE00" });
  one.emit("state-full", null);
  one.emit("state-full", { code: 7 });
  await wait();
  server!.step();
  server!.step();
  await wait();
  expect(host.seen.length).toBe(before + 1);
});

it("a congested connection is held back, caught up whole, then sent changes again", async () => {
  const { connect } = await setup({ snapshotDelta: true, backpressure: true });
  const { one, two, a: old, b: slow, arena, start } = await duel(connect);
  start();
  await play([one, two], arena, 6);
  expect(slow.kinds().at(-1)).toBe("delta");
  const guestSocket = [...server!.io.sockets.sockets.values()].find(
    (s) =>
      s.handshake.auth.accessToken ===
      (two.auth as { accessToken: string }).accessToken,
  )!;
  const ws = (guestSocket.conn as unknown as { transport: { socket: object } })
    .transport.socket;
  Object.defineProperty(ws, "bufferedAmount", {
    configurable: true,
    get: () => BACKPRESSURE.bytes + 1,
  });
  const before = slow.seen.length;
  await play([one], arena, 25);
  expect(slow.seen.length).toBe(before);
  delete (ws as { bufferedAmount?: number }).bufferedAmount;
  await play([one, two], arena, 20);
  const kinds = slow.kinds().slice(before);
  // The catch-up (its own copy, with the events it missed), the room's
  // numbered snapshot, then changes.
  expect(kinds.slice(0, 2)).toEqual(["whole", "whole"]);
  expect(slow.seen[before].wire!.n).toBeUndefined();
  expect(slow.seen[before].wire!.meta).toBeDefined();
  expect(slow.seen[before + 1].wire!.n).toBeDefined();
  expect(kinds.slice(2).every((k) => k === "delta")).toBe(true);
  expect(kinds).not.toContain("refused");
  // Every event exactly once, in order, as the uncongested client saw them.
  expect(slow.events()).toEqual(old.events());
  expect(new Set(slow.events()).size).toBe(slow.events().length);
  expect(slow.events().length).toBeGreaterThan(5);
  expect(slow.last()).toStrictEqual(old.last());
});

it("Snoozaku's dream stays private: the Dreamer gets copies of its own, the others changes", async () => {
  const { connect } = await setup();
  const sockets = [
    await connect(true),
    await connect(true),
    await connect(true),
  ];
  const friend = await connect(true);
  const followers = [...sockets, friend].map(follow);
  const created = await emit(sockets[0], "create", {
    name: "Host",
    mode: "raid",
    boss: "somnara",
  });
  const ids = [created.id!];
  for (const socket of sockets.slice(1))
    ids.push(
      (await emit(socket, "join", { name: "R", code: created.code })).id!,
    );
  expect((await emit(friend, "watch", { code: created.code })).ok).toBe(true);
  const arena = server!.rooms.get(created.code!) as SomnaraArena;
  expect(arena).toBeInstanceOf(SomnaraArena);
  arena.start();
  arena.phase = "playing";
  const inner = arena as unknown as {
    started: boolean;
    nextAttack: number;
    startAttack(id: string, target: unknown): void;
  };
  inner.started = true;
  inner.nextAttack = Infinity;
  for (let i = 0; i < 5; i++) server!.step();
  await wait(80);
  for (const f of followers) expect(f.kinds().at(-1)).toBe("delta");
  inner.startAttack("dream-sequence", arena.heroes()[0]);
  const dream = arena.raid.dream!;
  const dreamer = ids.indexOf(dream.dreamerId);
  expect(ids.filter((id) => arena.dreamFor(id))).toEqual([dream.dreamerId]);
  const marks = followers.map((f) => f.seen.length);
  for (let i = 0; i < 6; i++) server!.step();
  await wait(80);
  followers.forEach((f, i) => {
    const during = f.seen.slice(marks[i]);
    expect(during).toHaveLength(6);
    if (i === dreamer) {
      // Its own copy every tick: whole, with the runes, not numbered.
      for (const s of during) {
        expect(s.kind).toBe("whole");
        expect(s.wire!.raidDream!.runes).toHaveLength(dream.length);
        expect(s.wire!.n).toBeUndefined();
      }
    } else {
      for (const s of during) {
        expect(s.kind).toBe("delta");
        expect(JSON.stringify(s.wire)).not.toContain('"runes"');
      }
    }
  });
  // The dream ends: the Dreamer is back on the room's snapshot, and the
  // runes are gone from what it shows.
  while (arena.dreamFor(dream.dreamerId)) {
    arena.raid.dream = undefined as never;
  }
  for (let i = 0; i < 6; i++) server!.step();
  await wait(80);
  const after = followers[dreamer].seen.slice(marks[dreamer] + 6);
  expect(after.map((s) => s.kind)).toEqual([
    "whole",
    "delta",
    "delta",
    "delta",
    "delta",
    "delta",
  ]);
  expect(followers[dreamer].last().raidDream).toBeUndefined();
  for (const f of followers)
    expect(f.last()).toStrictEqual(followers[dreamer].last());
});

it("leaving for another room starts that room from a whole snapshot", async () => {
  const { connect } = await setup();
  const { one, two, b: fresh, arena, start, code } = await duel(connect);
  start();
  await play([one, two], arena, 10);
  expect(fresh.kinds().at(-1)).toBe("delta");
  await emit(two, "leave");
  await wait();
  const mark = fresh.seen.length;
  const next = await emit(two, "create", { name: "Two", mode: "raid" });
  expect(next.ok).toBe(true);
  expect(next.code).not.toBe(code);
  for (let i = 0; i < 20; i++) server!.step();
  await wait();
  // The old room goes on without it; nothing of it reaches this client.
  const since = fresh.seen.slice(mark);
  expect(since.length).toBeGreaterThan(0);
  expect(since[0].kind).toBe("whole");
  expect(since.every((s) => s.wire?.code === next.code)).toBe(true);
  expect(since.map((s) => s.kind)).not.toContain("refused");
});

it("a raid with some raiders on deltas and some on whole snapshots: Snoozaku's dream reaches only the Dreamer, and everyone else sees one raid", async () => {
  const { connect } = await setup();
  // Four raiders and two friends watching, every other one an older app.
  const kinds = [true, false, true, false];
  const sockets = [];
  for (const kind of kinds) sockets.push(await connect(kind));
  const friends = [await connect(false), await connect(true)];
  const all = [...sockets, ...friends];
  const takesDeltas = [...kinds, false, true];
  const followers = all.map(follow);
  const created = await emit(sockets[0], "create", {
    name: "Host",
    mode: "raid",
    boss: "somnara",
  });
  const ids = [created.id!];
  for (const socket of sockets.slice(1))
    ids.push(
      (await emit(socket, "join", { name: "R", code: created.code })).id!,
    );
  for (const friend of friends)
    expect((await emit(friend, "watch", { code: created.code })).ok).toBe(true);
  const arena = server!.rooms.get(created.code!) as SomnaraArena;
  arena.start();
  arena.phase = "playing";
  const inner = arena as unknown as {
    started: boolean;
    nextAttack: number;
    startAttack(id: string, target: unknown): void;
  };
  inner.started = true;
  inner.nextAttack = Infinity;
  for (let i = 0; i < 5; i++) server!.step();
  await wait(80);
  followers.forEach((f, i) =>
    expect(f.kinds().at(-1)).toBe(takesDeltas[i] ? "delta" : "whole"),
  );
  inner.startAttack("dream-sequence", arena.heroes()[0]);
  const dream = arena.raid.dream!;
  const dreamer = ids.indexOf(dream.dreamerId);
  expect(dreamer).toBeGreaterThanOrEqual(0);
  const marks = followers.map((f) => f.seen.length);
  for (let i = 0; i < 6; i++) server!.step();
  await wait(80);
  followers.forEach((f, i) => {
    const during = f.seen.slice(marks[i]);
    expect(during).toHaveLength(6);
    for (const s of during) {
      if (i === dreamer) {
        expect(s.kind).toBe("whole");
        expect(s.wire!.raidDream!.runes).toHaveLength(dream.length);
        expect(s.wire!.n).toBeUndefined();
      } else {
        expect(s.kind).toBe(takesDeltas[i] ? "delta" : "whole");
        expect(JSON.stringify(s.wire)).not.toContain('"runes"');
      }
    }
  });
  arena.raid.dream = undefined as never;
  for (let i = 0; i < 6; i++) server!.step();
  await wait(80);
  // One raid for everyone: every numbered snapshot two of them both saw is
  // the same, whichever way it reached them.
  for (const f of followers) {
    expect(f.kinds()).not.toContain("refused");
    expect(f.last().raidDream).toBeUndefined();
    expect(f.last()).toStrictEqual(followers[0].last());
    expectSameMatch(followers[1], f, 10);
  }
});

it("a Spire climb from the lobby through a cleared floor to the next, as changes", async () => {
  const { connect } = await setup();
  const climber = await connect(true);
  const friend = await connect(false);
  const fresh = follow(climber),
    old = follow(friend);
  const created = await emit(climber, "create", {
    name: "Climber",
    mode: "raid",
    spire: 0,
  });
  expect(created.ok).toBe(true);
  expect((await emit(friend, "watch", { code: created.code })).ok).toBe(true);
  const a = server!.rooms.get(created.code!) as SpireArena;
  expect(a).toBeInstanceOf(SpireArena);
  server!.step();
  await emit(climber, "ready");
  await until(() => a.phase === "briefing");
  await emit(climber, "instructions-ready");
  for (let i = 0; i < 125 && a.phase !== "playing"; i++) server!.step();
  expect(a.phase).toBe("playing");
  // Beat both waves of floor 1 (as spire-network.test.ts does), then on
  // into floor 2.
  for (let wave = 0; wave < 2; wave++) {
    for (let i = 0; i < 40; i++) server!.step();
    for (const p of a.players) if (p.echo) p.hp = 0;
    for (const p of a.heroes()) p.hp = 999;
    for (let i = 0; i < (SPIRE_PARTY.waveGap + 0.3) * 30; i++) server!.step();
  }
  for (let i = 0; i < 30 * 30 && a.raid.spire!.floor < 2; i++) {
    for (const p of a.heroes()) p.hp = 999;
    server!.step();
  }
  expect(a.raid.spire!.floor).toBe(2);
  for (let i = 0; i < 60; i++) server!.step();
  await until(
    () => fresh.last()?.n === old.last()?.n && fresh.last()?.n !== undefined,
  );
  // The climber never needed a second whole snapshot: lobby, briefing,
  // countdown, floor 1, the stairs and floor 2 all came as changes.
  const kinds = fresh.kinds();
  expect(kinds).not.toContain("refused");
  expect(kinds.filter((k) => k === "whole").length).toBeLessThanOrEqual(2);
  expect(kinds.filter((k) => k === "delta").length).toBeGreaterThan(300);
  const phases = new Set(fresh.shown().map((w) => w.phase));
  for (const phase of ["lobby", "briefing", "countdown", "playing"])
    expect(phases).toContain(phase);
  const floors = new Set(fresh.shown().map((w) => w.raid?.spire?.floor));
  expect(floors).toContain(1);
  expect(floors).toContain(2);
  // And it is the climb the friend on whole snapshots watched.
  expectSameMatch(old, fresh, 300);
  expect(fresh.last()).toStrictEqual(old.last());
  expect(fresh.events()).toEqual(
    old.events().filter((id) => fresh.events().includes(id)),
  );
});
