/**
 * Raid balance harness: stand-in bots play whole raids against each boss and
 * it prints how the fights went. No gameplay is changed; it only watches.
 *
 *   npx tsx scripts/balance/raid-sim.ts [runs=12] [bosses=all] [sizes=1,4] [reactions=0.35,0.15]
 *
 *   bosses     comma list of boss ids, or "all"
 *   sizes      party sizes (1-4)
 *   reactions  reaction delays in seconds: the bots see each warning as it
 *              was this long ago (0.35 s typical, 0.15 s near-perfect)
 *
 * RAID_SIM_JSON=<file> also writes every run as JSON. RAID_SIM_SEED changes
 * the base seed (runs are repeatable for the same seed and code).
 *
 * Per boss × party size × reaction it reports:
 *   win     share of runs won inside the 600 s limit
 *   t/o     share of runs lost to the time limit (not to a wipe)
 *   ch1-3   median seconds spent in each chapter (wins and losses)
 *   clear   median and 90th-percentile clear time of the wins
 *   reach   share of runs that reached chapter 2 / 3
 *   downs   downs per run, and the attacks that caused them
 *   dmg/min incoming damage per raider per minute alive
 *   threat  share of combat time with a live damaging warning or hazard
 *   free    share of combat time the boss is exposed (free damage)
 */
import { writeFileSync } from "node:fs";
import {
  FIGHTER_IDS,
  type CharacterId,
  type Fighter,
  type Input,
} from "../../packages/shared/src/index.ts";
import {
  RAID_BOSSES,
  type RaidBossId,
  type RaidWarning,
} from "../../packages/shared/src/raid.ts";
import { createRaidArena } from "../../apps/server/src/raid-bosses.ts";
import type { RaidArena } from "../../apps/server/src/raid.ts";

const [
  runsArg = "12",
  bossArg = "all",
  sizeArg = "1,4",
  reactionArg = "0.35,0.15",
] = process.argv.slice(2);
const BOSSES = (
  bossArg === "all" ? Object.keys(RAID_BOSSES) : bossArg.split(",")
) as RaidBossId[];
const SIZES = sizeArg.split(",").map(Number);
const REACTIONS = reactionArg.split(",").map(Number);
const RUNS = +runsArg;
const BASE_SEED = +(process.env.RAID_SIM_SEED ?? 1);
const DT = 1 / 30;

/** A small repeatable PRNG (mulberry32). */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}
/** The raid seeds itself through Web Crypto: make that repeatable here. */
function seedCrypto(seed: number) {
  const rand = prng(seed);
  const c = globalThis.crypto as Crypto;
  Object.defineProperty(c, "getRandomValues", {
    configurable: true,
    value: <T extends ArrayBufferView | null>(array: T): T => {
      if (array instanceof Uint32Array)
        for (let i = 0; i < array.length; i++)
          array[i] = Math.floor(rand() * 2 ** 32);
      else if (array instanceof Uint8Array)
        for (let i = 0; i < array.length; i++)
          array[i] = Math.floor(rand() * 256);
      return array;
    },
  });
  Math.random = prng(seed ^ 0x5bd1e995);
}

type Run = {
  boss: RaidBossId;
  size: number;
  reaction: number;
  seed: number;
  team: CharacterId[];
  won: boolean;
  seconds: number;
  phase: number;
  chapters: number[];
  downs: number;
  causes: Record<string, number>;
  damagePerMin: number;
  threat: number;
  free: number;
};

/** Live damaging warnings or hazards on the floor right now. */
function threatened(a: RaidArena) {
  const r = a.raid;
  return (
    r.warnings.length > 0 ||
    !!r.waves?.length ||
    !!r.bubbles?.length ||
    !!r.flameRings?.length ||
    !!r.stormRushes?.length ||
    !!r.dreamRings?.length ||
    !!r.emberDive ||
    !!r.undertow ||
    !!r.stormBeam ||
    !!r.stormChain ||
    !!(a as unknown as { charging?: unknown }).charging
  );
}

function play(
  boss: RaidBossId,
  size: number,
  reaction: number,
  seed: number,
): Run {
  seedCrypto(seed * 7919 + size * 131 + Math.round(reaction * 1000));
  const rand = prng(seed * 31 + size);
  const team: CharacterId[] = [];
  while (team.length < size) {
    const c = FIGHTER_IDS[Math.floor(rand() * FIGHTER_IDS.length)];
    if (!team.includes(c)) team.push(c);
  }
  const a = createRaidArena(`SIM${seed}`, boss);
  team.forEach((c, i) => a.add("b" + i, "Bot " + i, c));
  a.configure(3, false);
  a.start();
  for (const p of a.heroes()) a.standIn(p.id);
  // Rites as a real party would have them: everyone takes their first offers.
  (a as unknown as { offerRaidRites(): void }).offerRaidRites();
  for (const id of Object.keys(a.raid.offers))
    while (a.raid.offers[id]?.[0]) a.pickRite(id, a.raid.offers[id][0]);
  a.phase = "playing";
  a.deadline = a.time + 600;
  // Reaction delay: the bots see every warning as it was `reaction` seconds
  // ago. A new warning is hidden until it is that old, and a shape that
  // moves (follows, locks, flips) is seen moving that much later.
  const seen = new Map<number, { t: number; w: RaidWarning }[]>();
  const remember = () => {
    for (const w of a.raid.warnings) {
      const list = seen.get(w.id) ?? [];
      list.push({ t: a.time, w: { ...w } });
      if (list.length > 40) list.shift();
      seen.set(w.id, list);
    }
    if (seen.size > 200)
      for (const id of [...seen.keys()])
        if (!a.raid.warnings.some((w) => w.id === id)) seen.delete(id);
  };
  const perceived = () => {
    const out: RaidWarning[] = [];
    for (const w of a.raid.warnings) {
      const list = seen.get(w.id);
      if (!list) continue;
      let pick: RaidWarning | undefined;
      for (const s of list) if (s.t <= a.time - reaction + 1e-6) pick = s.w;
      if (pick) out.push(pick);
    }
    return out;
  };
  const think = a.botInput.bind(a);
  a.botInput = (bot: Fighter, input: Input) => {
    const all = a.raid.warnings;
    a.raid.warnings = perceived();
    try {
      return think(bot, input);
    } finally {
      a.raid.warnings = all;
    }
  };
  const chapters = [0, 0, 0];
  const hp = new Map<string, number>();
  let damage = 0,
    alive = 0,
    threat = 0,
    free = 0,
    combat = 0;
  const exposed = (a as unknown as { bossExposed(b: Fighter): boolean })
    .bossExposed;
  for (let t = 0; t < 620 && !a.raid.result; t += DT) {
    const phase = a.raid.phase;
    for (const p of a.heroes()) hp.set(p.id, p.hp);
    a.tick(DT);
    remember();
    if (a.phase !== "playing" && !a.raid.result) continue;
    chapters[phase - 1] += DT;
    combat += DT;
    if (threatened(a)) threat += DT;
    const b = a.boss();
    if (b && exposed.call(a, b)) free += DT;
    for (const p of a.heroes()) {
      const before = hp.get(p.id) ?? p.hp;
      if (before > 0) {
        alive += DT;
        damage += Math.max(0, before - Math.max(0, p.hp));
      }
    }
  }
  return {
    boss,
    size,
    reaction,
    seed,
    team,
    won: a.raid.result === "victory",
    seconds: a.raid.elapsed,
    phase: a.raid.phase,
    chapters,
    downs: a.raid.downs,
    causes: { ...a.downCauses } as Record<string, number>,
    damagePerMin: alive ? (damage / alive) * 60 : 0,
    threat: combat ? threat / combat : 0,
    free: combat ? free / combat : 0,
  };
}

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((m, n) => m - n);
  return s[Math.floor((s.length - 1) / 2)];
};
const pct = (xs: number[], q: number) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((m, n) => m - n);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const f0 = (x: number) => (Number.isFinite(x) ? x.toFixed(0) : "-");
const pc = (x: number) => `${(100 * x).toFixed(0)}%`;

const all: Run[] = [];
const started = Date.now();
console.log(
  `raid-sim: ${RUNS} runs per cell, seed ${BASE_SEED}, bosses ${BOSSES.join(",")}, sizes ${SIZES.join(",")}, reactions ${REACTIONS.join(",")}`,
);
console.log(
  [
    "boss".padEnd(12),
    "★",
    "size",
    "react",
    "win".padStart(5),
    "t/o".padStart(4),
    "ch1".padStart(4),
    "ch2".padStart(4),
    "ch3".padStart(4),
    "clear p50/p90".padStart(14),
    "reach2/3".padStart(9),
    "downs".padStart(6),
    "dmg/min".padStart(8),
    "threat".padStart(7),
    "free".padStart(5),
    "  top down causes",
  ].join(" "),
);
for (const boss of BOSSES)
  for (const size of SIZES)
    for (const reaction of REACTIONS) {
      const runs: Run[] = [];
      for (let i = 0; i < RUNS; i++)
        runs.push(play(boss, size, reaction, BASE_SEED * 1000 + i));
      all.push(...runs);
      const wins = runs.filter((r) => r.won);
      const causes: Record<string, number> = {};
      for (const r of runs)
        for (const [k, v] of Object.entries(r.causes))
          causes[k] = (causes[k] ?? 0) + v;
      const top = Object.entries(causes)
        .sort((m, n) => n[1] - m[1])
        .slice(0, 4)
        .map(([k, v]) => `${k} ${(v / runs.length).toFixed(1)}`)
        .join(", ");
      const ch = (i: number) =>
        median(runs.filter((r) => r.chapters[i] > 0).map((r) => r.chapters[i]));
      console.log(
        [
          boss.padEnd(12),
          String(RAID_BOSSES[boss].stars),
          String(size).padStart(4),
          reaction.toFixed(2).padStart(5),
          pc(wins.length / runs.length).padStart(5),
          pc(
            runs.filter((r) => !r.won && r.seconds >= 599).length / runs.length,
          ).padStart(4),
          f0(ch(0)).padStart(4),
          f0(ch(1)).padStart(4),
          f0(ch(2)).padStart(4),
          `${f0(median(wins.map((r) => r.seconds)))}/${f0(
            pct(
              wins.map((r) => r.seconds),
              0.9,
            ),
          )}`.padStart(14),
          `${pc(runs.filter((r) => r.phase >= 2).length / runs.length)}/${pc(runs.filter((r) => r.phase >= 3).length / runs.length)}`.padStart(
            9,
          ),
          (runs.reduce((s, r) => s + r.downs, 0) / runs.length)
            .toFixed(1)
            .padStart(6),
          f0(median(runs.map((r) => r.damagePerMin))).padStart(8),
          pc(median(runs.map((r) => r.threat))).padStart(7),
          pc(median(runs.map((r) => r.free))).padStart(5),
          "  " + top,
        ].join(" "),
      );
    }
console.log(`done in ${((Date.now() - started) / 1000).toFixed(0)} s`);
if (process.env.RAID_SIM_JSON)
  writeFileSync(process.env.RAID_SIM_JSON, JSON.stringify(all));
