/**
 * Why does your own fighter jump? A duel against the real bot, with real
 * hits, over a modelled connection, the way a phone plays it: the server's
 * Arena with its input queue and bot brain, the wire packing, and the
 * client's prediction and reconciliation (main.ts). Every time a snapshot
 * moves your predicted fighter by more than 4 px (what battle-perf counts
 * as a correction), the cause is read off the server's own state:
 *
 * - knockback: a hit on you this snapshot pushed or pulled you;
 * - status: a status that changes how you move landed on you (stun,
 *   freeze, root, slow, taunt...);
 * - own-move: your own dash or movement skill (blink, rush...) ran;
 * - unexplained: none of these (a prediction bug, if it is common).
 *
 *   npx tsx scripts/perf/correction-sim.ts [seconds] [one-way ms] [me] [bot]
 *
 * NO_BOT=1, NO_SKILL=1, NO_BASIC=1 leave out the bot's brain, your skills or
 * your basic attacks; NO_CARRY=1 replays without carryCurrent.
 *
 * Measured 11 Nov 2026 (120 s, 33 ms each way, as an iPhone on school
 * Wi-Fi with a 67 ms ping): 30-50 corrections a minute, every one a
 * knockback or a status that landed (the phone cannot know a hit is coming).
 * Walking alone gives none. Before carryCurrent, standing in Tidefin's
 * Undertow added about 70 a minute of ~7 px.
 */
import { Arena } from "../../apps/server/src/simulation.js";
import { BotBrain } from "../../apps/server/src/bot.js";
import {
  CHARACTERS,
  RULES,
  blankInput,
  kitOf,
  packSnapshot,
  unpackSnapshot,
  MetaCache,
  type CharacterId,
  type Fighter,
  type Input,
  type Snapshot,
  type WireSnapshot,
} from "../../packages/shared/src/index.js";
import {
  carryCurrent,
  predictFighter,
} from "../../apps/client/src/predict-fighter.js";

/** Statuses that change where your inputs take you. */
const MOVEMENT = new Set([
  "stun",
  "freeze",
  "sleep",
  "shell",
  "root",
  "slow",
  "warp",
  "taunt",
  "leash",
  "cage",
  "current",
  "float",
  "haste",
]);

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
class Link<T> {
  private queue: { at: number; value: T }[] = [];
  private last = 0;
  constructor(
    private latency: number,
    private jitter: number,
    private random: () => number,
  ) {}
  send(now: number, value: T) {
    const at = Math.max(
      this.last,
      now + this.latency + this.random() * this.jitter,
    );
    this.last = at;
    this.queue.push({ at, value });
  }
  receive(now: number) {
    const out: T[] = [];
    while (this.queue.length && this.queue[0].at <= now)
      out.push(this.queue.shift()!.value);
    return out;
  }
}

export interface Correction {
  px: number;
  cause: "knockback" | "status" | "own-move" | "unexplained";
  detail: string;
}

export function simulateCorrections(o: {
  seconds?: number;
  latency?: number;
  jitter?: number;
  me?: CharacterId;
  bot?: CharacterId;
  seed?: number;
  /** Leave the bot's brain off (it stands still). */
  noBot?: boolean;
  noSkill?: boolean;
  noBasic?: boolean;
  /** Replay without carryCurrent (the behaviour before it). */
  noCarry?: boolean;
}) {
  const seconds = o.seconds ?? 120;
  const random = rng(o.seed ?? 11);
  const arena = new Arena("CORSIM", "duel");
  const me = arena.add("me", "Me", o.me ?? "tidefin");
  const bot = arena.add("bot", "Bot", o.bot ?? "cindrake");
  if (!o.noBot) arena.bots.set("bot", new BotBrain("bot", "normal", 4242));
  arena.start();
  arena.phase = "playing";
  arena.deadline = 1e9;
  const up = new Link<Input>(o.latency ?? 33, o.jitter ?? 4, random);
  const down = new Link<WireSnapshot>(o.latency ?? 33, o.jitter ?? 4, random);
  const cache = new MetaCache();
  const kit = kitOf(me.character, me.rites);
  let state: Snapshot | undefined,
    previous: Snapshot | undefined,
    local: Fighter | undefined,
    pending: Input[] = [],
    seq = 0,
    cursor = 0,
    serverClock = 0,
    ticks = 0,
    accumulator = 0,
    until = 0,
    dx = 0,
    dy = 0;
  const corrections: Correction[] = [];
  let snapshots = 0;
  const frameMs = 1000 / 60;
  for (let now = 0; now < seconds * 1000; now += frameMs) {
    while (serverClock + 1000 / RULES.tick <= now) {
      serverClock += 1000 / RULES.tick;
      for (const input of up.receive(serverClock)) arena.enqueue(me, input);
      arena.drainInputs();
      // Keep both alive: the point is the corrections, not who wins.
      // (A knockout would end the round and reset both to their spawns.)
      me.hp = bot.hp = 100_000;
      arena.tick();
      if (++ticks % Math.round(RULES.tick / RULES.snapshot) === 0) {
        const s = arena.snapshot();
        s.events = s.events.filter((e) => e.id > cursor);
        if (s.events.length) cursor = s.events.at(-1)!.id;
        down.send(serverClock, JSON.parse(JSON.stringify(packSnapshot(s))));
      }
    }
    for (const wire of down.receive(now)) {
      previous = state;
      state = unpackSnapshot(wire, cache);
      snapshots++;
      const server = state.players.find((p) => p.id === "me")!;
      const before = local && { x: local.x, y: local.y };
      pending = pending.filter((i) => i.seq > server.ack);
      local = structuredClone(server);
      if (!o.noCarry) carryCurrent(local, state.time);
      for (const [i, input] of pending.entries())
        predictFighter(local, input, state.time + (i + 1) / RULES.tick, false);
      if (!before) continue;
      const px = Math.hypot(local.x - before.x, local.y - before.y);
      if (px <= 4) continue;
      const was = previous?.players.find((p) => p.id === "me");
      const hits = state.events.filter(
        (e) => e.kind === "hit" && e.target === "me",
      );
      const pushed = hits.filter((e) => {
        const a = Object.values(CHARACTERS)
          .flatMap((c) => [c.basic, ...c.skills])
          .find((x) => x.id === e.abilityId);
        return !!a && (a.knockback ?? 0) !== 0;
      });
      const landed = server.statuses
        .filter((s) => MOVEMENT.has(s.kind))
        .filter(
          (s) =>
            !was?.statuses.some((w) => w.kind === s.kind && w.until >= s.until),
        );
      const ended = (was?.statuses ?? []).filter(
        (w) =>
          MOVEMENT.has(w.kind) &&
          !server.statuses.some((s) => s.kind === w.kind),
      );
      const moving =
        server.dashUntil > state.time - 0.07 ||
        !!server.roll ||
        !!server.charge ||
        state.events.some(
          (e) =>
            e.owner === "me" &&
            (e.kind === "dash" || e.kind === "blink" || e.kind === "cast"),
        );
      corrections.push(
        pushed.length
          ? {
              px,
              cause: "knockback",
              detail: pushed.map((e) => e.abilityId).join(","),
            }
          : landed.length || ended.length
            ? {
                px,
                cause: "status",
                detail: [
                  ...landed.map((s) => s.kind),
                  ...ended.map((s) => `${s.kind} ended`),
                ].join(","),
              }
            : moving
              ? { px, cause: "own-move", detail: "" }
              : {
                  px,
                  cause: "unexplained",
                  detail: hits.map((e) => e.abilityId).join(","),
                },
      );
    }
    if (!state || !local) continue;
    accumulator += frameMs;
    while (accumulator >= 1000 / RULES.tick) {
      accumulator -= 1000 / RULES.tick;
      if (now >= until) {
        until = now + 250 + random() * 900;
        const a =
          random() < 0.4
            ? Math.atan2(450 - local.y, 800 - local.x)
            : random() * Math.PI * 2;
        dx = random() < 0.15 ? 0 : Math.cos(a);
        dy = dx === 0 ? 0 : Math.sin(a);
      }
      const target = state.players.find((p) => p.id === "bot")!;
      // A player presses a skill now and then, and the basic often.
      const skill =
        !o.noSkill && random() < 0.03 ? Math.floor(random() * 3) : -1;
      const input: Input = {
        ...blankInput(),
        seq: ++seq,
        dx,
        dy,
        aimX: target.x,
        aimY: target.y,
        basic: !o.noBasic && random() < 0.3,
        skill: skill >= 0 && kit.skills[skill] ? skill : -1,
        dash: random() < 0.004,
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
  }
  return { seconds, snapshots, corrections };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [secs, lat, mine, theirs] = process.argv.slice(2);
  const { seconds, snapshots, corrections } = simulateCorrections({
    seconds: Number(secs ?? 120),
    latency: Number(lat ?? 33),
    me: (mine as CharacterId) ?? "tidefin",
    bot: (theirs as CharacterId) ?? "cindrake",
    noBot: process.env.NO_BOT === "1",
    noSkill: process.env.NO_SKILL === "1",
    noBasic: process.env.NO_BASIC === "1",
    noCarry: process.env.NO_CARRY === "1",
  });
  const by = new Map<string, Correction[]>();
  for (const c of corrections) {
    const key = `${c.cause}${c.detail ? `: ${c.detail}` : ""}`;
    if (!by.has(key)) by.set(key, []);
    by.get(key)!.push(c);
  }
  console.log(
    `${corrections.length} corrections over 4 px in ${seconds} s (${(corrections.length / (seconds / 60)).toFixed(1)}/min), ${snapshots} snapshots`,
  );
  for (const [key, list] of [...by].sort((a, b) => b[1].length - a[1].length)) {
    const px = list.map((c) => c.px).sort((a, b) => a - b);
    console.log(
      `${String(list.length).padStart(5)}  median ${px[Math.floor(px.length / 2)].toFixed(0)} px, max ${px.at(-1)!.toFixed(0)} px  ${key}`,
    );
  }
}
