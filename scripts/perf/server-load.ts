/**
 * Synthetic multiplayer load: many concurrent rooms of real Socket.IO
 * clients against a real game server in a child process.
 *
 *   npx tsx scripts/perf/server-load.ts --rooms 10 --mix pvp2,pvp4,raid4
 *   npx tsx scripts/perf/server-load.ts --cycles 8 --rooms 6   # memory soak
 *   CGROUP=halfcpu npx tsx scripts/perf/server-load.ts ...      # see docs
 *
 * Every simulated player sends 30 inputs a second (movement, held Basic,
 * skills; four-seat rooms cast on the same ticks), pings once a second, and
 * measures snapshot bytes, arrival jitter and unpack time. The server child
 * reports tick/broadcast durations, event-loop delay, CPU and memory.
 * Prints one JSON document. Run locally or in an isolated environment only.
 */
import { fork, type ChildProcess } from "node:child_process";
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { io, type Socket } from "socket.io-client";
import {
  RULES,
  unpackSnapshot,
  type Reply,
  type WireSnapshot,
} from "../../packages/shared/src/index.js";
import { summary } from "../../apps/server/src/diagnostics.js";
import type { Scenario } from "./workloads.js";

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2)
  args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1] ?? "");
const ROOMS = Number(args.get("rooms") ?? 6);
const MIX = (args.get("mix") ?? "pvp2,pvp4,raid4").split(",") as Scenario[];
const WARMUP = Number(args.get("warmup") ?? 5) * 1000;
const SECONDS = Number(args.get("seconds") ?? 20) * 1000;
const CYCLES = Number(args.get("cycles") ?? 0);
const OUT = args.get("out");
const DUMP = args.get("dump");
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function startServer(): Promise<{ child: ChildProcess; port: number }> {
  const child = fork(new URL("./load-server.ts", import.meta.url).pathname, {
    execArgv: [
      "--import",
      "tsx",
      "--expose-gc",
      ...(process.env.SERVER_NODE_ARGS?.split(" ").filter(Boolean) ?? []),
    ],
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  // Optional CPU/memory cap: put the child into an existing cgroup v1.
  const group = process.env.CGROUP;
  if (group && child.pid)
    for (const controller of ["cpu", "memory"])
      try {
        writeFileSync(
          `/sys/fs/cgroup/${controller}/${group}/cgroup.procs`,
          String(child.pid),
        );
      } catch (error) {
        console.error(`cgroup ${controller}/${group}:`, String(error));
      }
  return new Promise((resolve) =>
    child.on("message", (m: { type: string; port: number }) => {
      if (m.type === "ready") resolve({ child, port: m.port });
    }),
  );
}
function ask<T>(child: ChildProcess, cmd: object, type: string): Promise<T> {
  return new Promise((resolve) => {
    const on = (m: { type: string }) => {
      if (m.type !== type) return;
      child.off("message", on);
      resolve(m as T);
    };
    child.on("message", on);
    child.send(cmd);
  });
}

interface Client {
  socket: Socket;
  seat: number;
  room: number;
  seq: number;
  bytes: number;
  states: number;
  arrivals: number[];
  last: number;
  unpackMs: number[];
  rtt: number[];
  sizes: number[];
}
let tokenSerial = 0;
async function connect(port: number, room: number, seat: number) {
  const socket = io(`http://127.0.0.1:${port}`, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
    auth: { accessToken: `load-${++tokenSerial}` },
  });
  const c: Client = {
    socket,
    seat,
    room,
    seq: 0,
    bytes: 0,
    states: 0,
    arrivals: [],
    last: 0,
    unpackMs: [],
    rtt: [],
    sizes: [],
  };
  socket.io.on("open", () =>
    socket.io.engine.on("packet", (packet: { data?: unknown }) => {
      if (typeof packet.data === "string")
        c.bytes += Buffer.byteLength(packet.data);
    }),
  );
  socket.on("state", (wire: WireSnapshot) => {
    const now = performance.now();
    if (c.last) c.arrivals.push(now - c.last);
    c.last = now;
    c.states++;
    const start = performance.now();
    unpackSnapshot(wire);
    c.unpackMs.push(performance.now() - start);
    if (DUMP && c.room === 1 && c.seat === 0 && c.states === 200)
      writeFileSync(DUMP, JSON.stringify(wire));
    if (c.sizes.length < 400 && c.states % 5 === 0)
      c.sizes.push(Buffer.byteLength(JSON.stringify(wire)));
  });
  await new Promise<void>((resolve, reject) => {
    socket.on("connect", resolve);
    socket.on("connect_error", reject);
  });
  return c;
}
const emit = (socket: Socket, event: string, data: unknown = {}) =>
  new Promise<Reply>((resolve, reject) =>
    socket
      .timeout(5000)
      .emit(event, data, (error: Error | null, reply: Reply) =>
        error ? reject(error) : resolve(reply),
      ),
  );

async function makeRooms(port: number, count: number) {
  const clients: Client[] = [];
  for (let r = 0; r < count; r++) {
    const scenario = MIX[r % MIX.length];
    const seats = scenario === "pvp2" ? 2 : 4;
    const host = await connect(port, r, 0);
    const mode =
      scenario === "raid4" ? "raid" : scenario === "pvp4" ? "ffa" : "duel";
    const created = await emit(host.socket, "create", {
      name: `Host ${r}`,
      mode,
    });
    if (!created.ok) throw new Error(`create: ${created.error}`);
    clients.push(host);
    for (let s = 1; s < seats; s++) {
      const guest = await connect(port, r, s);
      const joined = await emit(guest.socket, "join", {
        name: `Guest ${r}.${s}`,
        code: created.code,
      });
      if (!joined.ok) throw new Error(`join: ${joined.error}`);
      clients.push(guest);
    }
  }
  return clients;
}
function drive(clients: Client[]) {
  let tick = 0;
  const inputs = setInterval(() => {
    tick++;
    for (const c of clients) {
      const i = c.seat + c.room;
      const four = clients.filter((o) => o.room === c.room).length >= 4;
      c.socket.emit("input", {
        seq: ++c.seq,
        dx: Math.cos(tick / 20 + i),
        dy: Math.sin(tick / 20 + i),
        aimX: 800 + Math.cos(tick / 30) * 300,
        aimY: 450 + Math.sin(tick / 30) * 200,
        basic: true,
        skill: four
          ? tick % 45 === 0
            ? Math.floor(tick / 45) % 4
            : -1
          : (tick + i * 11) % 90 === 0
            ? ((tick / 90 + i) | 0) % 4
            : -1,
        dash: (tick + i * 17) % 150 === 0,
        jump: (tick + i * 23) % 210 === 0,
      });
    }
  }, 1000 / RULES.tick);
  const pings = setInterval(() => {
    for (const c of clients) {
      const start = performance.now();
      c.socket.emit("rtt", {}, () => c.rtt.push(performance.now() - start));
    }
  }, 1000);
  return () => {
    clearInterval(inputs);
    clearInterval(pings);
  };
}
function resetClientStats(clients: Client[]) {
  for (const c of clients) {
    c.bytes = c.states = 0;
    c.arrivals = [];
    c.unpackMs = [];
    c.rtt = [];
    c.sizes = [];
  }
}
function clientSummary(clients: Client[], seconds: number) {
  const all = <K extends keyof Client>(k: K) =>
    clients.flatMap((c) => c[k] as number[]);
  const interval = 1000 / RULES.snapshot;
  const arrivals = all("arrivals");
  return {
    clients: clients.length,
    bytesInPerClientPerSecond: Math.round(
      clients.reduce((n, c) => n + c.bytes, 0) / clients.length / seconds,
    ),
    statesPerClientPerSecond:
      Math.round(
        (clients.reduce((n, c) => n + c.states, 0) / clients.length / seconds) *
          10,
      ) / 10,
    snapshotBytes: summary(all("sizes")),
    arrivalIntervalMs: summary(arrivals),
    /** |arrival interval - 66.7 ms|: how irregular snapshots arrive. */
    arrivalJitterMs: summary(arrivals.map((a) => Math.abs(a - interval))),
    unpackMs: summary(all("unpackMs")),
    rttMs: summary(all("rtt")),
  };
}

async function main() {
  const { child, port } = await startServer();
  const results: unknown[] = [];
  if (CYCLES > 0) {
    // Soak: rooms are created, fight, and are left, again and again.
    for (let cycle = 0; cycle < CYCLES; cycle++) {
      const clients = await makeRooms(port, ROOMS);
      await ask(child, { cmd: "fight", immortal: false }, "fighting");
      const stop = drive(clients);
      await wait(SECONDS);
      stop();
      for (const c of clients) await emit(c.socket, "leave").catch(() => {});
      for (const c of clients) c.socket.disconnect();
      await wait(500);
      const { report } = await ask<{ report: Record<string, unknown> }>(
        child,
        { cmd: "report", gc: true },
        "report",
      );
      results.push({ cycle, ...report });
      console.error(
        `cycle ${cycle}: heapAfterGc ${report.heapAfterGcMB} MB, rss ${report.rssMB} MB, rooms ${report.rooms}, sessions ${report.sessions}`,
      );
    }
  } else {
    const clients = await makeRooms(port, ROOMS);
    await ask(child, { cmd: "fight", immortal: true }, "fighting");
    const stop = drive(clients);
    await wait(WARMUP);
    await ask(child, { cmd: "report" }, "report");
    resetClientStats(clients);
    const started = performance.now();
    await wait(SECONDS);
    const seconds = (performance.now() - started) / 1000;
    const { report } = await ask<{ report: unknown }>(
      child,
      { cmd: "report", gc: false },
      "report",
    );
    stop();
    results.push({ server: report, client: clientSummary(clients, seconds) });
    for (const c of clients) c.socket.disconnect();
  }
  child.send({ cmd: "close" });
  const output = JSON.stringify(
    {
      rooms: ROOMS,
      mix: MIX,
      cgroup: process.env.CGROUP ?? null,
      seconds: SECONDS / 1000,
      cycles: CYCLES,
      results,
    },
    null,
    2,
  );
  if (OUT) writeFileSync(OUT, output);
  console.log(output);
  process.exit(0);
}
void main();
