import { expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import {
  BattleInputClock,
  type InputClockTimers,
} from "../../apps/client/src/battle-input-clock";
import {
  blankInput,
  RULES,
  type Input,
  type Reply,
  type WireSnapshot,
} from "../../packages/shared/src/index";
import { fakeAccounts } from "../helpers/accounts";

it("two real sockets preserve seq/actions and held steps through client hitches and ordered uplink jitter", async () => {
  const accounts = fakeAccounts();
  const server = createArenaServer({
    accounts: accounts.provider,
    autoTick: false,
  });
  const clients: Socket[] = [];
  const clocks: BattleInputClock[] = [];
  const request = (socket: Socket, event: string, data = {}) =>
    new Promise<Reply>((resolve, reject) =>
      socket
        .timeout(2000)
        .emit(event, data, (error: Error | null, reply: Reply) =>
          error ? reject(error) : resolve(reply),
        ),
    );
  const barrier = (socket: Socket) =>
    new Promise<void>((resolve, reject) =>
      socket
        .timeout(2000)
        .emit("rtt", {}, (error: Error | null) =>
          error ? reject(error) : resolve(),
        ),
    );
  try {
    await new Promise<void>((resolve) =>
      server.http.listen(0, "127.0.0.1", resolve),
    );
    const address = server.http.address();
    if (!address || typeof address === "string")
      throw Error("No server address");
    for (let i = 0; i < 2; i++) {
      const socket = io(`http://127.0.0.1:${address.port}`, {
        auth: { accessToken: accounts.add(false).token },
        transports: ["websocket"],
        reconnection: false,
      });
      clients.push(socket);
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("connect_error", reject);
      });
    }
    const host = await request(clients[0], "create", {
      name: "One",
      mode: "duel",
    });
    const guest = await request(clients[1], "join", {
      name: "Two",
      code: host.code,
    });
    expect(host.ok && guest.ok).toBe(true);
    const arena = server.rooms.get(host.code!)!;
    arena.start();
    arena.phase = "playing";
    arena.deadline = 1e9;
    arena.players.forEach((p, i) => {
      p.x = i ? 1250 : 300;
      p.y = i ? 700 : 200;
    });
    let now = 0;
    const packets: { at: number; client: number; input: Input }[] = [];
    const due: typeof packets = [];
    const emitted: Input[][] = [[], []];
    const events = new Map<number, WireSnapshot["events"][number]>();
    clients[0].on("state", (s: WireSnapshot) =>
      s.events.forEach((e) => events.set(e.id, e)),
    );
    const engines = clients.map((socket, client) => {
      const jobs: { at: number; fn: () => void; cancelled?: boolean }[] = [];
      const timers: InputClockTimers = {
        now: () => now,
        setTimeout: (fn, ms) => {
          const job = { at: now + Math.max(1, Math.ceil(ms)), fn };
          jobs.push(job);
          return job;
        },
        clearTimeout: (handle) => {
          (handle as (typeof jobs)[number]).cancelled = true;
        },
      };
      let arrival = 0;
      const clock = new BattleInputClock(
        () => {
          const seq = emitted[client].length + 1;
          const input = {
            ...blankInput(),
            seq,
            dx: seq < 45 ? 1 : -1,
            aimX: 1450,
            aimY: 50,
            basic: client === 0,
            skill: client === 0 && seq === 31 ? 0 : -1,
            dash: client === 0 && seq === 31,
            jump: client === 0 && seq === 31,
          };
          emitted[client].push(input);
          // TCP preserves order; the latency variation is modelled, while
          // serialization, parsing, enqueue, drain and ack use real sockets.
          arrival = Math.max(arrival, now + 20 + ((seq * 17) % 25));
          packets.push({ at: arrival, client, input });
        },
        () => socket.connected,
        RULES.tick,
        timers,
      );
      clocks.push(clock);
      clock.sync();
      return () => {
        jobs.sort((a, b) => a.at - b.at);
        while (jobs[0]?.at <= now) {
          const job = jobs.shift()!;
          if (!job.cancelled) job.fn();
        }
      };
    });
    let tick = 1;
    for (now = 0; now <= 3500; now++) {
      if (now <= 3000)
        engines.forEach((run, i) => {
          const hitch = i === 0 ? 250 : 150;
          if (now < 1000 || now >= 1000 + hitch) run();
        });
      else clocks.forEach((clock) => clock.stop());
      let delivered = false;
      for (let i = packets.length - 1; i >= 0; i--)
        if (packets[i].at <= now) {
          const packet = packets.splice(i, 1)[0];
          // Sort deliveries below; two clients may become due together.
          due.push(packet);
          delivered = true;
        }
      due.sort((a, b) => a.at - b.at || a.input.seq - b.input.seq);
      for (const packet of due.splice(0))
        clients[packet.client].emit("input", packet.input);
      if (delivered) await Promise.all(clients.map(barrier));
      if (now >= (tick * 1000) / RULES.tick) {
        server.step();
        tick++;
        await Promise.all(clients.map(barrier));
      }
    }
    for (const [i, id] of [host.id!, guest.id!].entries()) {
      expect(emitted[i].length).toBeGreaterThanOrEqual(89);
      expect(emitted[i].length).toBeLessThanOrEqual(90);
      expect(emitted[i].map((p) => p.seq)).toEqual(
        Array.from({ length: emitted[i].length }, (_, n) => n + 1),
      );
      expect(arena.players.find((p) => p.id === id)!.ack).toBe(
        emitted[i].length,
      );
      expect(arena.inputStats(id)!.folded).toBe(0);
      expect(arena.inputStats(id)!.lateSteps).toBeGreaterThan(0);
    }
    const player = arena.players.find((p) => p.id === host.id)!;
    expect(player.stats.skills).toBe(1);
    expect(
      [...events.values()].filter(
        (e) => e.owner === host.id && e.kind === "dash",
      ),
    ).toHaveLength(1);
    expect(
      [...events.values()].filter(
        (e) => e.owner === host.id && e.kind === "jump",
      ),
    ).toHaveLength(1);
    expect(
      [...events.values()].filter(
        (e) => e.owner === host.id && e.kind === "cast",
      ).length,
    ).toBeGreaterThan(2);
  } finally {
    clocks.forEach((clock) => clock.stop());
    clients.forEach((socket) => socket.disconnect());
    await server.close();
  }
});
