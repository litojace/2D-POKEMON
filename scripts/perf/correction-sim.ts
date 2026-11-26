/**
 * Why does your own fighter jump? A duel against the real bot, with real
 * hits, over a modelled connection, the way a phone plays it: the server's
 * Arena with its input queue and bot brain, the wire packing, and the
 * client's prediction and reconciliation (main.ts). Every time a snapshot
 * moves your predicted fighter by more than 4 px (what battle-perf counts
 * as a correction), the cause is read off the server's own state:
 *
 * hit, status, move or other, as the game itself reads it on the phone
 * (apps/client/src/networking/correction-cause.ts). "other" is the one to
 * worry about: the prediction disagreed with the server for no reason.
 *
 *   npx tsx scripts/perf/correction-sim.ts [seconds] [one-way ms] [me] [bot]
 *
 * NO_BOT=1, NO_SKILL=1, NO_BASIC=1 leave out the bot's brain, your skills or
 * your basic attacks; NO_CARRY=1 replays without carryCurrent.
 * MODE=ffa BOTS=2 is a 3-player free-for-all, ARENA=<id> picks the court,
 * and SERVER_HZ=<rate> runs the server's ticks at that real rate while the
 * phone keeps its exact 30 (docs/network-performance.md, section 15).
 *
 * RAID=<boss id> (VARIANT=ascendant, HUMANS=2, RITES=footing,...) is a raid
 * instead: you and HUMANS-1 raiders standing by, against the boss's own
 * attacks, a third of the run in each chapter, the corrections counted per
 * chapter. NO_RAID_CARRY=1 replays without stepRaidCarry (Tidelotl's
 * Undertow, Bubble Prison and bubble roots left out of the prediction, as
 * before 26 Nov 2026). DIAG=1 tags each "other" correction with the
 * Tidelotl mechanic active at the time; DIAG=2 lists them one by one.
 * Measured 26 Nov 2026 (180 s, 33 ms each way): Tidelotl went from about
 * 150 "other" corrections a minute to 2-4, and Lumiwick's 1-3 (each a
 * 140-220 px Wing Gust or Snuffing Gale) to 0; the other five bosses 0-0.3
 * (network-performance.md, section 22). NO_RAID_CARRY=1 also leaves out
 * Lumiwick's blows.
 *
 * Measured 11 Nov 2026 (120 s, 33 ms each way, as an iPhone on school
 * Wi-Fi with a 67 ms ping): 30-50 corrections a minute, every one a
 * knockback or a status that landed (the phone cannot know a hit is coming).
 * Walking alone gives none. Before carryCurrent, standing in Tidefin's
 * old Undertow (a current) added about 70 a minute of ~7 px; the same drift
 * now carries you in Riptide Wave and draws you into Radiant Flare.
 */
import { Arena } from "../../apps/server/src/simulation.js";
import { BotBrain, type BotDifficulty } from "../../apps/server/src/bot.js";
import { createRaidArena } from "../../apps/server/src/raid-bosses.js";
import type { RaidBossId } from "../../packages/shared/src/raid-roster.js";
import type { RaidVariant } from "../../packages/shared/src/raid-ascendant.js";
import {
  CHARACTERS,
  RULES,
  blankInput,
  kitOf,
  packSnapshot,
  unpackSnapshot,
  MetaCache,
  type ArenaId,
  type CharacterId,
  type Fighter,
  type Input,
  type Snapshot,
  type WireSnapshot,
} from "../../packages/shared/src/index.js";
import {
  carryCurrent,
  newestStep,
  predictFighter,
  raidCarry,
  serverSteps,
  stepRaidCarry,
  type RaidCarry,
} from "../../apps/client/src/predict-fighter.js";
import {
  correctionCause,
  type CorrectionReason,
} from "../../apps/client/src/networking/correction-cause.js";
import { LocalTimeline } from "../../apps/client/src/networking/timeline-lead.js";
import { HIT_GAP_PX, drawnGap } from "../../apps/client/src/battle-perf.js";

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
    /** Now and then the link holds packets (Wi-Fi power saving, a busy
     * radio): this share of sends starts a hold of `stallMs`, and the
     * packets behind it queue up (in order, as over TCP). */
    private stallChance = 0,
    private stallMs = 0,
  ) {}
  send(now: number, value: T) {
    if (this.stallChance && this.random() < this.stallChance)
      this.last = Math.max(this.last, now + this.latency + this.stallMs);
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

export interface Correction extends CorrectionReason {
  px: number;
  /** A raid's chapter (1-3) when the snapshot arrived. */
  chapter?: number;
  /** DIAG=2: your fighter's state on the server then. */
  note?: string;
}
/**
 * A hit on you, measured as the phone measures it (battle-perf hitsFar:
 * drawnGap at the snapshot's arrival minus the lead) and as it really was:
 * `aligned` is how far you were drawn, on the frame that first showed the
 * input the server ran on the hit's tick, from where the server hit you.
 */
export interface HitGap {
  gap: number;
  aligned: number;
  abilityId?: string;
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
  /** Keep the bot's ultimate meter full (a drift it casts often: Radiant Flare). */
  fullUlt?: boolean;
  /** The bot's level (the match reports' fights are mostly "hard"). */
  level?: BotDifficulty;
  /** Uplink holds: chance per input and length (ms). */
  stallChance?: number;
  stallMs?: number;
  /** The phone's frame rate (a 120 Hz Android phone draws up to 120). */
  fps?: number;
  /** "ffa" for a free-for-all (the match reports' 3-player rooms). */
  mode?: "duel" | "ffa";
  /** Opponents (bots), each with a brain unless `noBot`. */
  bots?: number;
  /** The court (walls, hazards); default Classic. */
  arena?: ArenaId;
  /** How often the server really ticks (Node's setInterval: about 30.1). */
  serverHz?: number;
  /**
   * Which lead the hit gap is measured with: the snapshot's own
   * ("estimate", what the game uses) or the eased one drawn ("lead", the
   * reading before 20 Nov 2026).
   */
  hitLead?: "estimate" | "lead";
  /**
   * A raid on this boss instead of a duel: you and `humans - 1` more
   * raiders (they stand still) against the boss's own attacks. The boss is
   * held in each chapter for a third of the run, then taken to the next.
   */
  raid?: RaidBossId;
  variant?: RaidVariant;
  humans?: number;
  /** Raid rites you hold (the boss's own leads every offer). */
  rites?: string[];
  /** Replay without stepRaidCarry (the Undertow and Bubble Prison left out, before 26 Nov 2026). */
  noRaidCarry?: boolean;
}) {
  const seconds = o.seconds ?? 120;
  const random = rng(o.seed ?? 11);
  const arena = o.raid
    ? createRaidArena("CORSIM", o.raid, { variant: o.variant })
    : new Arena("CORSIM", o.mode ?? "duel");
  const me = arena.add("me", "Me", o.me ?? "tidefin");
  const raiders = o.raid
    ? Array.from({ length: Math.max(0, (o.humans ?? 2) - 1) }, (_, i) =>
        arena.add(
          `raider${i + 1}`,
          `Raider ${i + 1}`,
          (Object.keys(CHARACTERS) as CharacterId[])[(i * 5 + 3) % 18],
        ),
      )
    : [];
  const others = o.raid
    ? []
    : Array.from({ length: Math.max(1, o.bots ?? 1) }, (_, i) => {
        const id = i ? `bot${i}` : "bot";
        const pick = i
          ? (Object.keys(CHARACTERS) as CharacterId[])[
              (i * 7) % Object.keys(CHARACTERS).length
            ]
          : (o.bot ?? "cindrake");
        const f = arena.add(id, `Bot ${i}`, pick);
        if (!o.noBot)
          arena.bots.set(id, new BotBrain(id, o.level ?? "normal", 4242 + i));
        return f;
      });
  if (o.arena) arena.arenaId = o.arena;
  arena.start();
  arena.phase = "playing";
  arena.deadline = 1e9;
  const boss = o.raid ? arena.players.find((p) => p.raidBoss) : undefined;
  // Rites you picked (RITES=footing,...): the server plays them on you.
  if (o.raid && o.rites?.length)
    (
      arena as unknown as { raid: { rites: Record<string, string[]> } }
    ).raid.rites.me = o.rites;
  const bot = boss ?? others[0];
  const maxHp = boss?.hp ?? 0;
  const up = new Link<Input>(
    o.latency ?? 33,
    o.jitter ?? 4,
    random,
    o.stallChance,
    o.stallMs,
  );
  const down = new Link<WireSnapshot>(o.latency ?? 33, o.jitter ?? 4, random);
  const cache = new MetaCache();
  const kit = kitOf(me.character, me.rites);
  let state: Snapshot | undefined,
    previous: Snapshot | undefined,
    local: Fighter | undefined,
    pending: Input[] = [],
    held = 0,
    seq = 0,
    cursor = 0,
    serverClock = 0,
    ticks = 0,
    accumulator = 0,
    until = 0,
    dx = 0,
    dy = 0;
  const corrections: Correction[] = [];
  let carry: RaidCarry | undefined;
  const isRaid = !!o.raid;
  // main.ts predict(): what Tidelotl does to you, then your input.
  const step = (input: Input, time: number) =>
    predictFighter(
      local!,
      o.noRaidCarry ? input : stepRaidCarry(local!, carry, input, time),
      time,
      isRaid,
    );
  let snapshots = 0,
    pendingSum = 0;
  // The hit-gap reading (main.ts measureHitGap): your fighter as drawn
  // (eased onto the prediction like the scene does), the lead, and, as the
  // truth, the input the server had run when each hit on you landed.
  const timeline = new LocalTimeline();
  const drawnSelf: { t: number; x: number; y: number }[] = [];
  let drawn: { x: number; y: number } | undefined;
  const shown = new Map<number, { x: number; y: number }>();
  const hitAck = new Map<number, number>();
  const hits: HitGap[] = [];
  let serverEvent = 0;
  const frameMs = 1000 / (o.fps ?? 60);
  for (let now = 0; now < seconds * 1000; now += frameMs) {
    const serverMs = 1000 / (o.serverHz ?? RULES.tick);
    while (serverClock + serverMs <= now) {
      serverClock += serverMs;
      for (const input of up.receive(serverClock)) arena.enqueue(me, input);
      arena.drainInputs();
      // Keep both alive: the point is the corrections, not who wins.
      // (A knockout would end the round and reset both to their spawns.)
      me.hp = 100_000;
      for (const f of others) f.hp = 100_000;
      for (const f of raiders) f.hp = 100_000;
      if (boss) {
        // A third of the run in each chapter: above 67%, above 33%, then low.
        const part = Math.min(
          2,
          Math.floor((3 * serverClock) / (seconds * 1000)),
        );
        const [floor, ceiling] = [
          [0.75, 1],
          [0.4, 0.6],
          [0.1, 0.3],
        ][part];
        boss.hp = Math.min(Math.max(boss.hp, maxHp * floor), maxHp * ceiling);
      }
      if (o.fullUlt) bot.ult = RULES.ultMax;
      arena.tick();
      for (const e of arena.events)
        if (e.id > serverEvent) {
          serverEvent = e.id;
          if (e.kind === "hit" && e.target === "me") hitAck.set(e.id, me.ack);
        }
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
      pendingSum += pending.length;
      local = structuredClone(server);
      if (!o.noCarry) carryCurrent(local, state.time);
      carry = raidCarry(
        server,
        state.raid,
        state.players.find((p) => p.raidBoss),
        state.time,
      );
      held = server.held ?? 0;
      timeline.snapshot(Math.max(0, pending.length - held), now);
      for (const { input, tick } of serverSteps(pending, held))
        step(input, state.time + tick / RULES.tick);
      for (const e of state.events) {
        if (e.kind !== "hit" || e.target !== "me") continue;
        const lead =
          o.hitLead === "lead" ? timeline.lead(now) : timeline.estimate(now);
        const gap = drawnGap(drawnSelf, now - lead * 1000, e.x, e.y);
        const saw = shown.get(hitAck.get(e.id) ?? -1);
        if (gap !== undefined && saw)
          hits.push({
            gap,
            aligned: Math.hypot(saw.x - e.x, saw.y - e.y),
            abilityId: e.abilityId,
          });
      }
      if (!before) continue;
      const px = Math.hypot(local.x - before.x, local.y - before.y);
      if (px <= 4) continue;
      const was = previous?.players.find((p) => p.id === "me");
      // The same reading the game makes on the phone (battle-perf).
      const u = (state.raid as { undertow?: { until: number } } | undefined)
        ?.undertow;
      const tide = state.raid as Record<string, unknown> | undefined;
      corrections.push({
        px,
        chapter: state.raid?.phase,
        note:
          process.env.DIAG === "2"
            ? `at ${server.x.toFixed(0)},${server.y.toFixed(0)} statuses [${server.statuses.map((x) => x.kind).join(",")}] jump ${server.jumpUntil > state.time} dash ${server.dashUntil > state.time} vx ${server.vx.toFixed(0)} vy ${server.vy.toFixed(0)} events [${[...new Set(state.events.map((e) => e.kind))].join(",")}]`
            : undefined,
        ...(process.env.DIAG
          ? {
              diag:
                [
                  u && u.until > state.time ? "undertow" : "",
                  (tide?.waves as unknown[] | undefined)?.length ? "waves" : "",
                  ((tide?.floodUntil as number | undefined) ?? 0 > state.time)
                    ? "flood"
                    : "",
                  (tide?.bubbles as unknown[] | undefined)?.length
                    ? "bubbles"
                    : "",
                  tide?.hightide ? "hightide" : "",
                  (tide?.prisons as unknown[] | undefined)?.length
                    ? "prison"
                    : "",
                ]
                  .filter(Boolean)
                  .join("+") || "none",
            }
          : {}),
        ...correctionCause(server, was, state.events, state.time),
      });
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
      const target = state.players.find((p) => p.id === bot.id)!;
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
      const next = newestStep(pending, held);
      if (next) step(next.input, state.time + next.tick / RULES.tick);
    }
    // The scene eases your drawn fighter onto the prediction (main.ts).
    drawn ??= { x: local.x, y: local.y };
    const ease = 1 - Math.exp(-frameMs / 30);
    drawn.x += (local.x - drawn.x) * ease;
    drawn.y += (local.y - drawn.y) * ease;
    drawnSelf.push({ t: now, x: drawn.x, y: drawn.y });
    if (drawnSelf.length > 150) drawnSelf.splice(0, 30);
    if (!shown.has(seq)) shown.set(seq, { x: drawn.x, y: drawn.y });
    timeline.lead(now);
  }
  // As the match reports' lead: pending inputs at a snapshot, plus the
  // snapshot's age on average (half a snapshot interval).
  const lead = snapshots
    ? Math.round(
        ((pendingSum / snapshots) * 1000) / RULES.tick + 500 / RULES.snapshot,
      )
    : 0;
  return { seconds, snapshots, corrections, lead, hits };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [secs, lat, mine, theirs] = process.argv.slice(2);
  const { seconds, snapshots, corrections, lead, hits } = simulateCorrections({
    seconds: Number(secs ?? 120),
    latency: Number(lat ?? 33),
    me: (mine as CharacterId) ?? "tidefin",
    bot: (theirs as CharacterId) ?? "cindrake",
    noBot: process.env.NO_BOT === "1",
    noSkill: process.env.NO_SKILL === "1",
    noBasic: process.env.NO_BASIC === "1",
    noCarry: process.env.NO_CARRY === "1",
    level: (process.env.BOT_LEVEL as BotDifficulty | undefined) ?? "normal",
    fps: Number(process.env.FPS ?? 60),
    seed: Number(process.env.SEED ?? 11),
    jitter: Number(process.env.JITTER ?? 4),
    stallChance: Number(process.env.STALL_CHANCE ?? 0),
    stallMs: Number(process.env.STALL_MS ?? 0),
    mode: process.env.MODE === "ffa" ? "ffa" : "duel",
    bots: Number(process.env.BOTS ?? 1),
    arena: (process.env.ARENA as ArenaId | undefined) || undefined,
    serverHz: Number(process.env.SERVER_HZ ?? RULES.tick),
    hitLead: process.env.HIT_LEAD === "lead" ? "lead" : "estimate",
    raid: (process.env.RAID as RaidBossId | undefined) || undefined,
    variant: (process.env.VARIANT as RaidVariant | undefined) || undefined,
    humans: Number(process.env.HUMANS ?? 2),
    rites: process.env.RITES ? process.env.RITES.split(",") : undefined,
    noRaidCarry: process.env.NO_RAID_CARRY === "1",
  });
  const by = new Map<string, Correction[]>();
  for (const c of corrections) {
    const key = `${c.cause}${c.detail ? `: ${c.detail}` : ""}`;
    if (!by.has(key)) by.set(key, []);
    by.get(key)!.push(c);
  }
  console.log(
    `${corrections.length} corrections over 4 px in ${seconds} s (${(corrections.length / (seconds / 60)).toFixed(1)}/min), ${snapshots} snapshots, lead ${lead} ms`,
  );
  for (const [key, list] of [...by].sort((a, b) => b[1].length - a[1].length)) {
    const px = list.map((c) => c.px).sort((a, b) => a - b);
    console.log(
      `${String(list.length).padStart(5)}  median ${px[Math.floor(px.length / 2)].toFixed(0)} px, max ${px.at(-1)!.toFixed(0)} px  ${key}`,
    );
  }
  if (process.env.DIAG) {
    const tally = new Map<string, number>();
    for (const c of corrections as (Correction & { diag?: string })[])
      if (c.cause === "other")
        tally.set(c.diag ?? "?", (tally.get(c.diag ?? "?") ?? 0) + 1);
    console.log("other, by what was active:", Object.fromEntries(tally));
    if (process.env.DIAG === "2")
      for (const c of corrections as (Correction & { diag?: string })[])
        if (c.cause === "other")
          console.log(
            `  other ${c.px.toFixed(1)} px, chapter ${c.chapter}, ${c.diag}${c.detail ? `, hits ${c.detail}` : ""}${c.note ? `, ${c.note}` : ""}`,
          );
  }
  if (corrections.some((c) => c.chapter !== undefined))
    for (const chapter of [1, 2, 3]) {
      const list = corrections.filter((c) => c.chapter === chapter);
      const causes = ["hit", "status", "move", "other"].map(
        (k) => `${k} ${list.filter((c) => c.cause === k).length}`,
      );
      console.log(`chapter ${chapter}: ${list.length} (${causes.join(", ")})`);
    }
  const far = (k: "gap" | "aligned") =>
    hits.filter((h) => h[k] > HIT_GAP_PX).length;
  console.log(
    `${hits.length} hits on you: ${far("gap")} far as the phone measures (hitsFar), ${far("aligned")} really drawn over ${HIT_GAP_PX} px away`,
  );
}
