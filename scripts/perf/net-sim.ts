/**
 * Deterministic network simulation of one PvP duel, measuring what players
 * feel rather than what the server sends:
 *
 * - local corrections: how far your own predicted fighter jumps when a
 *   snapshot reconciles it (px);
 * - remote smoothness: frames where an opponent who is really moving is
 *   drawn standing still (starved) or leaping (catch-up), and how far
 *   behind the true position it is drawn.
 *
 * It runs the real server simulation (Arena), the real wire packing, the
 * client's prediction and the client's InterpolationBuffer against a
 * modelled connection: one-way latency, jitter, ordered (TCP) delivery and
 * occasional stalls that release a burst. Inputs and snapshots both cross
 * it. Seeded, so before/after runs compare like with like.
 *
 *   npx tsx scripts/perf/net-sim.ts            # all profiles, JSON
 */
import { Arena } from "../../apps/server/src/simulation.js";
import {
  RULES,
  blankInput,
  packSnapshot,
  unpackSnapshot,
  MetaCache,
  MetaTracker,
  type Fighter,
  type Input,
  type Snapshot,
  type WireSnapshot,
} from "../../packages/shared/src/index.js";
import { predictFighter } from "../../apps/client/src/predict-fighter.js";
import { InterpolationBuffer } from "../../apps/client/src/networking/interpolation.js";
import { summary } from "../../apps/server/src/diagnostics.js";

export interface Profile {
  name: string;
  /** One-way base latency (ms). */
  latency: number;
  /** Uniform extra delay 0..jitter (ms). */
  jitter: number;
  /** Chance per packet of a spike adding `spike` ms. */
  spikeChance?: number;
  spike?: number;
  /** Every `stallEvery` ms the link stalls for `stall` ms, then bursts. */
  stallEvery?: number;
  stall?: number;
}
export const PROFILES: Profile[] = [
  { name: "good-wifi", latency: 15, jitter: 4 },
  { name: "mobile-4g", latency: 45, jitter: 30, spikeChance: 0.02, spike: 80 },
  {
    name: "congested",
    latency: 90,
    jitter: 70,
    spikeChance: 0.05,
    spike: 150,
  },
  {
    name: "wifi-stalls",
    latency: 25,
    jitter: 10,
    stallEvery: 4000,
    stall: 350,
  },
];

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** An ordered one-way link: packets never overtake each other. */
class Link<T> {
  private queue: { at: number; value: T }[] = [];
  private lastArrival = 0;
  constructor(
    private profile: Profile,
    private random: () => number,
  ) {}
  send(now: number, value: T) {
    const p = this.profile;
    let at = now + p.latency + this.random() * p.jitter;
    if (p.spikeChance && this.random() < p.spikeChance) at += p.spike ?? 0;
    if (p.stallEvery && p.stall) {
      const phase = at % p.stallEvery;
      if (phase < p.stall) at += p.stall - phase;
    }
    at = Math.max(at, this.lastArrival);
    this.lastArrival = at;
    this.queue.push({ at, value });
  }
  receive(now: number) {
    const out: T[] = [];
    while (this.queue.length && this.queue[0].at <= now)
      out.push(this.queue.shift()!.value);
    return out;
  }
}
/** Hold a direction for a while, sometimes stop, sometimes dash. */
function walker(random: () => number) {
  let until = 0,
    dx = 0,
    dy = 0;
  return (now: number, me: { x: number; y: number }) => {
    if (now >= until) {
      until = now + 250 + random() * 900;
      if (random() < 0.2) dx = dy = 0;
      else {
        // Head back towards the middle when near a wall.
        const a =
          random() < 0.35
            ? Math.atan2(450 - me.y, 800 - me.x)
            : random() * Math.PI * 2;
        dx = Math.cos(a);
        dy = Math.sin(a);
      }
    }
    return { dx, dy, dash: random() < 0.004 };
  };
}

export function simulate(
  profile: Profile,
  options: {
    seconds?: number;
    seed?: number;
    legacyInputs?: boolean;
    legacyWire?: boolean;
  } = {},
) {
  const seconds = options.seconds ?? 60;
  const random = rng(options.seed ?? 7);
  const arena = new Arena("NETSIM", "duel");
  const me = arena.add("me", "Me", "voltkit");
  const them = arena.add("them", "Them", "cindrake");
  arena.start();
  arena.phase = "playing";
  arena.deadline = 1e9;
  me.x = 600;
  them.x = 1000;
  me.y = them.y = 450;
  const up = new Link<Input>(profile, random),
    down = new Link<WireSnapshot>(profile, random),
    theirUp = new Link<Input>(profile, random);
  const myWalk = walker(random),
    theirWalk = walker(random);
  const frames = new InterpolationBuffer();
  const tracker = new MetaTracker(),
    cache = new MetaCache();
  let state: Snapshot | undefined,
    local: Fighter | undefined,
    pending: Input[] = [],
    seq = 0,
    theirSeq = 0,
    accumulator = 0,
    serverClock = 0,
    ticks = 0,
    cursor = 0;
  const corrections: number[] = [];
  const displayDelay: number[] = [];
  const remoteError: number[] = [];
  let moving = 0,
    starved = 0,
    leaps = 0,
    lastDrawn: { x: number; y: number } | undefined;
  // True opponent path by server time, to compare what is drawn.
  const truth: { time: number; x: number; y: number }[] = [];
  // Wire bytes, to show the protocol's cost in the same run.
  let bytes = 0,
    snapshots = 0;
  const frameMs = 1000 / 60;
  for (let now = 0; now < seconds * 1000; now += frameMs) {
    // Server: 30 ticks a second, snapshots at 15.
    while (serverClock + 1000 / RULES.tick <= now) {
      serverClock += 1000 / RULES.tick;
      // As server.ts: queue network inputs, apply them at the tick.
      const take = (p: Fighter, input: Input) =>
        options.legacyInputs ? arena.submit(p, input) : arena.enqueue(p, input);
      for (const input of up.receive(serverClock)) take(me, input);
      for (const input of theirUp.receive(serverClock)) take(them, input);
      if (!options.legacyInputs) arena.drainInputs();
      // The opponent's own client sends at its own steady 30 Hz.
      const walk = theirWalk(serverClock, them);
      theirUp.send(serverClock, {
        ...blankInput(),
        seq: ++theirSeq,
        dx: walk.dx,
        dy: walk.dy,
        dash: walk.dash,
        aimX: me.x,
        aimY: me.y,
      });
      me.hp = them.hp = 1000;
      arena.tick();
      truth.push({ time: arena.time, x: them.x, y: them.y });
      if (truth.length > 400) truth.shift();
      if (++ticks % Math.round(RULES.tick / RULES.snapshot) === 0) {
        const s = arena.snapshot();
        s.events = s.events.filter((e) => e.id > cursor);
        if (s.events.length) cursor = s.events.at(-1)!.id;
        // Through JSON, exactly as Socket.IO would carry it.
        const changed = tracker.update(s.players);
        const json = JSON.stringify(
          options.legacyWire
            ? packSnapshot(s)
            : packSnapshot(s, {
                compact: true,
                metaRev: tracker.rev,
                meta: changed ? tracker.meta(s.players) : undefined,
              }),
        );
        bytes += json.length;
        snapshots++;
        down.send(serverClock, JSON.parse(json));
      }
    }
    // Client: receive, reconcile, predict at 30 Hz, draw at 60 Hz.
    for (const wire of down.receive(now)) {
      state = unpackSnapshot(wire, cache);
      frames.add(state, now);
      const server = state.players.find((p) => p.id === "me")!;
      const before = local && { x: local.x, y: local.y };
      seq = Math.max(seq, server.ack);
      pending = pending.filter((i) => i.seq > server.ack);
      local = structuredClone(server);
      for (const [i, input] of pending.entries())
        predictFighter(local, input, state.time + (i + 1) / RULES.tick, false);
      if (before)
        corrections.push(Math.hypot(local.x - before.x, local.y - before.y));
    }
    if (!state || !local) continue;
    accumulator += frameMs;
    while (accumulator >= 1000 / RULES.tick) {
      accumulator -= 1000 / RULES.tick;
      const walk = myWalk(now, local);
      const input: Input = {
        ...blankInput(),
        seq: ++seq,
        dx: walk.dx,
        dy: walk.dy,
        dash: walk.dash,
        aimX: them.x,
        aimY: them.y,
      };
      up.send(now, input);
      pending.push(input);
      if (pending.length > 90) pending.shift();
      predictFighter(
        local,
        input,
        state.time + pending.length / RULES.tick,
        false,
      );
    }
    const drawn = frames.sample("them", now);
    if (!drawn) continue;
    // Compare with where the opponent truly was at the drawn server time.
    const shownTime = frames.lastSampleTime;
    const at =
      truth.find((t) => t.time >= shownTime - 1e-6) ?? truth[truth.length - 1];
    if (at) remoteError.push(Math.hypot(drawn.x - at.x, drawn.y - at.y));
    const behind = (arena.time - shownTime) * 1000;
    if (lastDrawn && now > 2000) {
      const step = Math.hypot(drawn.x - lastDrawn.x, drawn.y - lastDrawn.y);
      // Was the opponent really moving across this frame?
      const i = truth.findIndex((t) => t.time >= shownTime - 1e-6);
      const prev = truth[Math.max(0, i - 1)];
      const trueStep =
        i > 0 && prev
          ? (Math.hypot(at.x - prev.x, at.y - prev.y) * frameMs * RULES.tick) /
            1000
          : 0;
      if (trueStep > 1) {
        moving++;
        if (step < trueStep * 0.25) starved++;
        else if (step > trueStep * 2.5 + 2) leaps++;
      }
      displayDelay.push(behind);
    }
    lastDrawn = drawn;
  }
  return {
    profile: profile.name,
    seconds,
    bytesPerSnapshot: Math.round(bytes / snapshots),
    localCorrectionPx: summary(corrections),
    correctionsOver4px:
      Math.round(
        (corrections.filter((c) => c > 4).length / corrections.length) * 1000,
      ) / 10,
    remote: {
      movingFrames: moving,
      starvedPercent: Math.round((starved / Math.max(1, moving)) * 1000) / 10,
      leapPercent: Math.round((leaps / Math.max(1, moving)) * 1000) / 10,
      drawnBehindMs: summary(displayDelay),
      pathErrorPx: summary(remoteError),
    },
  };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const legacyInputs = process.argv.includes("--legacy-inputs");
  const legacyWire = process.argv.includes("--legacy-wire");
  const results = PROFILES.map((p) =>
    simulate(p, {
      seconds: Number(process.argv[2] ?? 60),
      legacyInputs,
      legacyWire,
    }),
  );
  console.log(JSON.stringify(results, null, 2));
}
