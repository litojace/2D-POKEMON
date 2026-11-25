/**
 * What a delta protocol for battle snapshots could save, measured before
 * designing one (performance sweep, S7).
 *
 *   npx tsx scripts/perf/snapshot-delta-probe.ts --seconds 20
 *   npx tsx scripts/perf/snapshot-delta-probe.ts --only ffa4 --out probe.json
 *
 * A real game server (in this process, its own 30 Hz loop) and real
 * Socket.IO clients over WebSocket fight a duel, a 4-player free-for-all, a
 * 4-hero raid (Cragmuff and Snoozaku) and a solo Spire climb. One client per
 * room keeps every snapshot it is sent, and the script reports:
 *
 * - bytes per snapshot and per second on the wire (Engine.IO packets);
 * - which parts of a snapshot repeat the one before (by top-level key and
 *   by fighter field), in bytes;
 * - the size of three alternatives: a field delta against the previous
 *   snapshot, per-message deflate, and both;
 * - whether the connection negotiated WebSocket compression;
 * - the CPU each costs per message on this machine.
 *
 * It measures this host, not Render: compare the columns with each other.
 * Run locally or in an isolated environment only.
 */
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import zlib from "node:zlib";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server.js";
import { RaidArena } from "../../apps/server/src/raid.js";
import {
  CHARACTERS,
  RULES,
  type Reply,
  type WireSnapshot,
} from "../../packages/shared/src/index.js";
import { TickClock } from "../../apps/server/src/tick-clock.js";
import { fakeAccounts, fakeSpire } from "../../tests/helpers/accounts.js";

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2)
  args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1] ?? "");
const SECONDS = Number(args.get("seconds") ?? 20);
const WARMUP = Number(args.get("warmup") ?? 3);
const ONLY = args.get("only")?.split(",");
const OUT = args.get("out");
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Json = unknown;
const size = (v: Json) =>
  v === undefined ? 0 : Buffer.byteLength(JSON.stringify(v));

interface Scenario {
  name: string;
  seats: number;
  create: Record<string, unknown>;
  spire?: boolean;
}
const SCENARIOS: Scenario[] = [
  { name: "duel", seats: 2, create: { mode: "duel" } },
  { name: "ffa4", seats: 4, create: { mode: "ffa" } },
  { name: "raid4", seats: 4, create: { mode: "raid", boss: "grumblecrag" } },
  {
    name: "raid4-snoozaku",
    seats: 4,
    create: { mode: "raid", boss: "somnara" },
  },
  { name: "spire", seats: 1, create: { mode: "raid", spire: 0 }, spire: true },
];

/**
 * A field delta against the previous snapshot: only what differs. Lists of
 * things with an id (fighters, shots, zones) are matched by id; any other
 * list is sent whole when it differs. `null` here stands for "unchanged".
 */
function delta(prev: Json, cur: Json): Json | null {
  if (prev === cur) return null;
  if (
    typeof prev !== "object" ||
    typeof cur !== "object" ||
    prev === null ||
    cur === null ||
    Array.isArray(prev) !== Array.isArray(cur)
  )
    return { v: cur };
  if (Array.isArray(cur)) {
    const before = prev as Json[];
    const keyed = (list: Json[]) =>
      list.every(
        (e) => e && typeof e === "object" && "id" in (e as object),
      ) as boolean;
    if (!cur.length && !before.length) return null;
    if (!keyed(cur) || !keyed(before))
      return JSON.stringify(prev) === JSON.stringify(cur) ? null : { v: cur };
    const old = new Map(
      before.map((e) => [(e as { id: unknown }).id, e] as const),
    );
    const changed: Json[] = [],
      added: Json[] = [];
    const ids = new Set<unknown>();
    for (const e of cur) {
      const id = (e as { id: unknown }).id;
      ids.add(id);
      const was = old.get(id);
      if (was === undefined) added.push(e);
      else {
        const d = delta(was, e);
        if (d) changed.push({ id, ...(d as { d: object }).d });
      }
    }
    const removed = before
      .map((e) => (e as { id: unknown }).id)
      .filter((id) => !ids.has(id));
    // Order: the lists the game sends keep their order between ticks; a
    // reorder would need the id list as well (counted when it happens).
    const order =
      !added.length &&
      !removed.length &&
      cur.some(
        (e, i) =>
          (e as { id: unknown }).id !== (before[i] as { id: unknown }).id,
      )
        ? cur.map((e) => (e as { id: unknown }).id)
        : undefined;
    if (!changed.length && !added.length && !removed.length && !order)
      return null;
    return {
      d: {
        ...(changed.length ? { u: changed } : {}),
        ...(added.length ? { a: added } : {}),
        ...(removed.length ? { r: removed } : {}),
        ...(order ? { o: order } : {}),
      },
    };
  }
  const a = prev as Record<string, Json>,
    b = cur as Record<string, Json>;
  const out: Record<string, Json> = {};
  let any = false;
  for (const key in b) {
    if (!(key in a)) {
      out[key] = b[key];
      any = true;
      continue;
    }
    const d = delta(a[key], b[key]);
    if (!d) continue;
    any = true;
    // A nested object's or keyed list's own delta, or the new value.
    out[key] = "v" in (d as object) ? (d as { v: Json }).v : d;
  }
  const gone = Object.keys(a).filter((key) => !(key in b));
  if (gone.length) {
    out.$gone = gone;
    any = true;
  }
  return any ? { d: out } : null;
}

const pct = (n: number, of: number) =>
  of ? Math.round((n / of) * 1000) / 10 : 0;
function stats(list: number[]) {
  const s = [...list].sort((a, b) => a - b);
  const at = (q: number) => s[Math.min(s.length - 1, Math.floor(q * s.length))];
  return {
    mean: Math.round(s.reduce((a, b) => a + b, 0) / (s.length || 1)),
    p50: at(0.5) ?? 0,
    p95: at(0.95) ?? 0,
    max: s.at(-1) ?? 0,
  };
}
/** Milliseconds per call, over enough calls to mean something. */
function cost<T>(items: T[], work: (item: T, i: number) => void) {
  const rounds = Math.max(1, Math.ceil(3000 / items.length));
  const start = performance.now();
  for (let r = 0; r < rounds; r++) items.forEach(work);
  return (
    Math.round(((performance.now() - start) / (rounds * items.length)) * 1e4) /
    1e4
  );
}

function analyse(wires: WireSnapshot[], seconds: number, wireBytes: number) {
  const full = wires.map(size);
  // 1. What repeats: each top-level key's bytes, and how many of them are a
  //    value the previous snapshot already carried.
  const keys = new Map<string, { bytes: number; same: number }>();
  const fields = new Map<string, { bytes: number; same: number }>();
  const add = (
    map: typeof keys,
    key: string,
    value: Json,
    before: Json,
    known: boolean,
  ) => {
    const bytes = size(value) + key.length + 3;
    const row = map.get(key) ?? { bytes: 0, same: 0 };
    row.bytes += bytes;
    if (known && JSON.stringify(before) === JSON.stringify(value))
      row.same += bytes;
    map.set(key, row);
  };
  for (let i = 1; i < wires.length; i++) {
    const cur = wires[i] as unknown as Record<string, Json>,
      prev = wires[i - 1] as unknown as Record<string, Json>;
    for (const key in cur)
      if (key !== "players") add(keys, key, cur[key], prev[key], key in prev);
    const old = new Map(wires[i - 1].players.map((p) => [p.id, p]));
    let playerBytes = 0,
      playerSame = 0;
    for (const p of wires[i].players) {
      const was = old.get(p.id) as Record<string, Json> | undefined;
      for (const key in p) {
        const value = (p as Record<string, Json>)[key];
        add(fields, key, value, was?.[key], !!was && key in was);
        const bytes = size(value) + key.length + 3;
        playerBytes += bytes;
        if (
          was &&
          key in was &&
          JSON.stringify(was[key]) === JSON.stringify(value)
        )
          playerSame += bytes;
      }
    }
    const row = keys.get("players") ?? { bytes: 0, same: 0 };
    row.bytes += playerBytes;
    row.same += playerSame;
    keys.set("players", row);
  }
  const table = (map: typeof keys, top = 14) => {
    const total = [...map.values()].reduce((n, r) => n + r.bytes, 0);
    return [...map]
      .sort((a, b) => b[1].bytes - a[1].bytes)
      .slice(0, top)
      .map(([key, r]) => ({
        key,
        shareOfSnapshot: pct(r.bytes, total),
        unchanged: pct(r.same, r.bytes),
      }));
  };
  const totalBytes = [...keys.values()].reduce((n, r) => n + r.bytes, 0);
  const sameBytes = [...keys.values()].reduce((n, r) => n + r.same, 0);

  // 2. The alternatives, message by message.
  const deltas = wires.map((w, i) =>
    i ? (delta(wires[i - 1], w) ?? { d: {} }) : { v: w },
  );
  const deltaSizes = deltas.map(size);
  const texts = wires.map((w) => JSON.stringify(w));
  const deltaTexts = deltas.map((d) => JSON.stringify(d));
  // permessage-deflate as `ws` does it: raw deflate, sync flush, the four
  // trailer bytes dropped. Without context takeover each message stands
  // alone; with it the stream remembers the last 32 KB (so it sees the
  // previous snapshot).
  const alone = (text: string) =>
    zlib.deflateRawSync(text, {
      level: 3,
      finishFlush: zlib.constants.Z_SYNC_FLUSH,
    }).length - 4;
  const stream = (list: string[]) => {
    // One deflate stream fed message by message, as a connection would.
    const sizes: number[] = [];
    const z = zlib.createDeflateRaw({ level: 3 });
    let pending = 0;
    z.on("data", (chunk: Buffer) => (pending += chunk.length));
    return new Promise<number[]>((resolve) => {
      let i = 0;
      const next = () => {
        if (i === list.length) return resolve(sizes);
        z.write(list[i++]);
        z.flush(zlib.constants.Z_SYNC_FLUSH, () => {
          sizes.push(pending - 4);
          pending = 0;
          next();
        });
      };
      next();
    });
  };
  const sum = (l: number[]) => l.reduce((a, b) => a + b, 0);
  const perSecond = (l: number[]) => Math.round(sum(l) / seconds);
  return stream(texts).then(async (takeover) => {
    const deltaTakeover = await stream(deltaTexts);
    const deflated = texts.map(alone);
    const deltaDeflated = deltaTexts.map(alone);
    const base = sum(full);
    return {
      snapshots: wires.length,
      snapshotsPerSecond: Math.round((wires.length / seconds) * 10) / 10,
      wireBytesPerSecond: Math.round(wireBytes / seconds),
      snapshotBytes: stats(full),
      unchangedShareOfBytes: pct(sameBytes, totalBytes),
      byTopLevelKey: table(keys),
      byFighterField: table(fields, 40),
      alternatives: {
        full: { bytesPerSecond: perSecond(full), perMessage: stats(full) },
        fieldDelta: {
          bytesPerSecond: perSecond(deltaSizes),
          saved: pct(base - sum(deltaSizes), base),
          perMessage: stats(deltaSizes),
        },
        deflateEachMessage: {
          bytesPerSecond: perSecond(deflated),
          saved: pct(base - sum(deflated), base),
        },
        deflateWithContext: {
          bytesPerSecond: perSecond(takeover),
          saved: pct(base - sum(takeover), base),
        },
        fieldDeltaThenDeflate: {
          bytesPerSecond: perSecond(deltaDeflated),
          saved: pct(base - sum(deltaDeflated), base),
        },
        fieldDeltaThenDeflateWithContext: {
          bytesPerSecond: perSecond(deltaTakeover),
          saved: pct(base - sum(deltaTakeover), base),
        },
      },
      // Per message, on this machine. The server stringifies a room's
      // snapshot once (Socket.IO encodes a broadcast once for the room);
      // deflate would run once per connection.
      cpuMsPerMessage: {
        stringifyFull: cost(wires, (w) => JSON.stringify(w)),
        parseFull: cost(texts, (t) => JSON.parse(t)),
        buildDelta: cost(wires.slice(1), (w, i) => delta(wires[i], w)),
        stringifyDelta: cost(deltas, (d) => JSON.stringify(d)),
        parseDelta: cost(deltaTexts, (t) => JSON.parse(t)),
        deflateFull: cost(texts, alone),
        deflateDelta: cost(deltaTexts, alone),
      },
    };
  });
}

async function main() {
  const accounts = fakeAccounts();
  accounts.provider.recordRaid = async () => {};
  accounts.provider.recordActivity = async () => {};
  accounts.provider.rpc = async () => null;
  fakeSpire(accounts.provider);
  const server = createArenaServer({
    accounts: accounts.provider,
    diagnostics: true,
    connectionLog: () => {},
    push: null,
  });
  await new Promise<void>((r) => server.http.listen(0, "127.0.0.1", r));
  const port = (server.http.address() as { port: number }).port;
  const sockets: Socket[] = [];
  const connect = async () => {
    const user = accounts.add(false);
    const socket = io(`http://127.0.0.1:${port}`, {
      auth: { accessToken: user.token },
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });
    sockets.push(socket);
    await new Promise<void>((r, j) => {
      socket.once("connect", r);
      socket.once("connect_error", j);
    });
    return socket;
  };
  const emit = (s: Socket, event: string, data: unknown = {}) =>
    new Promise<Reply>((resolve, reject) =>
      s
        .timeout(5000)
        .emit(event, data, (err: Error | null, r: Reply) =>
          err ? reject(err) : resolve(r),
        ),
    );
  const results: Record<string, unknown> = {};
  let compression: unknown;
  try {
    for (const scenario of SCENARIOS) {
      if (ONLY && !ONLY.includes(scenario.name)) continue;
      const host = await connect();
      // Whether this connection compresses its messages (what the server and
      // a `ws` client agreed on in the handshake).
      const ws = (
        host.io.engine.transport as unknown as { ws?: { extensions?: unknown } }
      ).ws;
      compression = ws?.extensions ?? null;
      const created = await emit(host, "create", {
        name: "Host",
        ...scenario.create,
      });
      if (!created.ok) throw new Error(`${scenario.name}: ${created.error}`);
      const room = [host];
      for (let s = 1; s < scenario.seats; s++) {
        const guest = await connect();
        const joined = await emit(guest, "join", {
          name: `Guest ${s}`,
          code: created.code,
        });
        if (!joined.ok) throw new Error(`${scenario.name}: ${joined.error}`);
        room.push(guest);
      }
      const arena = server.rooms.get(created.code!)!;
      if (scenario.spire) {
        // A climb is checked by the server before it starts: go through it.
        await emit(host, "ready");
        for (let i = 0; i < 100 && arena.phase !== "briefing"; i++)
          await wait(20);
        await emit(host, "instructions-ready");
        for (let i = 0; i < 400 && arena.phase !== "playing"; i++)
          await wait(20);
        if (arena.phase !== "playing")
          throw new Error(`spire: still ${arena.phase}`);
      } else {
        arena.start();
        arena.phase = "playing";
        arena.deadline = arena.time + 10_000;
      }
      // Nobody dies, so the fight lasts the whole measurement.
      const immortal = setInterval(() => {
        for (const p of arena.players)
          if (p.raidBoss) p.hp = Math.max(p.hp, 1);
          else if (!p.echo && !p.out)
            p.hp = Math.max(p.hp, CHARACTERS[p.character].health * 0.5);
        if (arena instanceof RaidArena && !scenario.spire)
          arena.deadline = arena.time + 10_000;
      }, 250);
      let tick = 0;
      const seqs = room.map(() => 0);
      const inputs = new TickClock(() => {
        tick++;
        room.forEach((socket, i) =>
          socket.emit("input", {
            seq: ++seqs[i],
            dx: Math.cos(tick / 20 + i),
            dy: Math.sin(tick / 20 + i),
            aimX: 800 + Math.cos(tick / 30) * 300,
            aimY: 450 + Math.sin(tick / 30) * 200,
            basic: true,
            skill:
              room.length >= 4
                ? tick % 45 === 0
                  ? Math.floor(tick / 45) % 4
                  : -1
                : (tick + i * 11) % 90 === 0
                  ? ((tick / 90 + i) | 0) % 4
                  : -1,
            dash: (tick + i * 17) % 150 === 0,
            jump: (tick + i * 23) % 210 === 0,
          }),
        );
      }, RULES.tick);
      await wait(WARMUP * 1000);
      const wires: WireSnapshot[] = [];
      let wireBytes = 0;
      const onState = (wire: WireSnapshot) => wires.push(wire);
      const onPacket = (packet: { data?: unknown }) => {
        if (typeof packet.data === "string")
          wireBytes += Buffer.byteLength(packet.data);
      };
      host.on("state", onState);
      host.io.engine.on("packet", onPacket);
      const started = performance.now();
      await wait(SECONDS * 1000);
      const seconds = (performance.now() - started) / 1000;
      host.off("state", onState);
      host.io.engine.off("packet", onPacket);
      inputs.stop();
      clearInterval(immortal);
      const phases = [...new Set(wires.map((w) => w.phase))];
      results[scenario.name] = {
        phases,
        fighters: wires.at(-1)?.players.length,
        ...(await analyse(wires, seconds, wireBytes)),
      };
      for (const s of room) s.disconnect();
      console.error(`${scenario.name}: ${wires.length} snapshots`);
      await wait(300);
    }
  } finally {
    for (const s of sockets) s.disconnect();
    await server.close();
  }
  const output = JSON.stringify(
    {
      seconds: SECONDS,
      node: process.version,
      webSocketExtensions: compression,
      results,
    },
    null,
    2,
  );
  if (OUT) writeFileSync(OUT, output);
  console.log(output);
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
