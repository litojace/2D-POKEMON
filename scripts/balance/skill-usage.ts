/**
 * What every skill does in bot matches: one shard of a round robin (like
 * round-robin.ts) that also counts, for each champion's basic attack and
 * skills, how often it was cast, how many casts landed at least once, how
 * many hits it made and how much damage it dealt.
 *
 *   npx tsx scripts/balance/skill-usage.ts <shard> <shards> <games> <hard|normal|easy> <out.json>
 *   npx tsx scripts/balance/skill-usage.ts --report <out-0.json> <out-1.json> ...
 *
 * RR_SEED and RR_ONLY work as in round-robin.ts. The out file holds the
 * result rows ([a, b, winner]) and the per-skill counts.
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  CHARACTERS,
  FIGHTER_IDS,
  type Ability,
  type CharacterId,
  type Fighter,
} from "../../packages/shared/src/index.ts";
import { Arena } from "../../apps/server/src/simulation.ts";
import { BotBrain, type BotDifficulty } from "../../apps/server/src/bot.ts";

interface Count {
  casts: number;
  landed: number;
  hits: number;
  damage: number;
}
type Usage = Record<string, Record<string, Count>>;
interface Out {
  rows: [string, string, string | null][];
  usage: Usage;
  /** Matches (and seconds of play) each champion appeared in. */
  matches: Record<string, number>;
  seconds: Record<string, number>;
}

const blank = (): Count => ({ casts: 0, landed: 0, hits: 0, damage: 0 });

if (process.argv[2] === "--report") {
  const all: Out = { rows: [], usage: {}, matches: {}, seconds: {} };
  for (const f of process.argv.slice(3)) {
    const o = JSON.parse(readFileSync(f, "utf8")) as Out;
    all.rows.push(...o.rows);
    for (const [c, skills] of Object.entries(o.usage))
      for (const [id, n] of Object.entries(skills)) {
        const t = ((all.usage[c] ??= {})[id] ??= blank());
        t.casts += n.casts;
        t.landed += n.landed;
        t.hits += n.hits;
        t.damage += n.damage;
      }
    for (const [c, n] of Object.entries(o.matches))
      all.matches[c] = (all.matches[c] ?? 0) + n;
    for (const [c, n] of Object.entries(o.seconds))
      all.seconds[c] = (all.seconds[c] ?? 0) + n;
  }
  const wins: Record<string, [number, number]> = {};
  for (const [a, b, w] of all.rows)
    for (const c of [a, b]) {
      const r = (wins[c] ??= [0, 0]);
      r[1]++;
      if (w === c) r[0]++;
    }
  const pct = (x: number) => `${(x * 100).toFixed(0)}%`.padStart(5);
  for (const id of FIGHTER_IDS) {
    const u = all.usage[id];
    if (!u || !all.matches[id]) continue;
    const ch = CHARACTERS[id as CharacterId];
    const w = wins[id] ?? [0, 0];
    const minutes = (all.seconds[id] ?? 1) / 60;
    const total = Object.values(u).reduce((s, n) => s + n.damage, 0) || 1;
    console.log(
      `\n${ch.name}  win ${pct(w[0] / Math.max(1, w[1]))} of ${w[1]}  (${minutes.toFixed(0)} min)`,
    );
    console.log(
      "  skill                 casts/min  landed  hits/cast  dmg/cast  dmg/min  share",
    );
    for (const a of [ch.basic, ...ch.skills]) {
      const n = u[a.id] ?? blank();
      console.log(
        `  ${a.name.padEnd(20)} ${(n.casts / minutes).toFixed(2).padStart(9)}  ${pct(n.landed / Math.max(1, n.casts))}  ${(n.hits / Math.max(1, n.casts)).toFixed(2).padStart(9)}  ${(n.damage / Math.max(1, n.casts)).toFixed(1).padStart(8)}  ${(n.damage / minutes).toFixed(0).padStart(7)}  ${pct(n.damage / total)}`,
      );
    }
  }
  process.exit(0);
}

const [shard, shards, games, diff, out] = [
  +process.argv[2],
  +process.argv[3],
  +process.argv[4],
  process.argv[5] as BotDifficulty,
  process.argv[6],
];

const usage: Usage = {};
const count = (p: Fighter, id: string) =>
  ((usage[p.character] ??= {})[id] ??= blank());
// The cast each (fighter, skill) is on, and whether it has landed yet.
const current = new Map<string, { landed: boolean }>();
const proto = Arena.prototype as unknown as {
  cast(p: Fighter, a: Ability, ex?: boolean): void;
  damage(t: Fighter, amount: number, owner: string, a?: Ability): void;
};
const cast = proto.cast;
proto.cast = function (this: Arena, p: Fighter, a: Ability, ex?: boolean) {
  if (
    CHARACTERS[p.character] &&
    p.hp > 0 &&
    !p.out &&
    this.phase === "playing"
  ) {
    count(p, a.id).casts++;
    current.set(`${p.id}:${a.id}`, { landed: false });
  }
  return cast.call(this, p, a, ex);
};
const damage = proto.damage;
proto.damage = function (
  this: Arena,
  t: Fighter,
  amount: number,
  owner: string,
  a?: Ability,
) {
  const before = t.hp;
  const lastId = this.events[this.events.length - 1]?.id ?? -1;
  const result = damage.call(this, t, amount, owner, a);
  // It landed if it made a hit event (not a blinded miss, not jumped over).
  const made = this.events.some(
    (e) => e.id > lastId && e.kind === "hit" && e.target === t.id && !e.miss,
  );
  const source = this.players.find((q) => q.id === owner);
  if (a && source && source !== t && this.phase === "playing") {
    const n = count(source, a.id);
    if (made) {
      n.hits++;
      n.damage += before - t.hp;
      const c = current.get(`${source.id}:${a.id}`);
      if (c && !c.landed) {
        c.landed = true;
        n.landed++;
      }
    }
  }
  return result;
};

const ids: string[] = [...FIGHTER_IDS];
const rows: Out["rows"] = [];
const matches: Record<string, number> = {};
const seconds: Record<string, number> = {};
const only = process.env.RR_ONLY?.split(",");
let k = 0,
  played = 0;
for (let i = 0; i < ids.length; i++)
  for (let j = i + 1; j < ids.length; j++, k++) {
    if (only && !only.includes(ids[i]) && !only.includes(ids[j])) continue;
    if (played++ % shards !== shard) continue;
    for (let g = 0; g < games; g++) {
      const [a, b] = g % 2 ? [ids[j], ids[i]] : [ids[i], ids[j]];
      const seed = +(process.env.RR_SEED ?? 5000) + k * 97 + g;
      const arena = new Arena(`balance${seed}`);
      arena.add("A", "A", a as never);
      arena.add("B", "B", b as never);
      arena.bots.set("A", new BotBrain("A", diff, seed));
      arena.bots.set("B", new BotBrain("B", diff, seed * 7 + 3));
      arena.start();
      arena.acknowledgeInstructions("A");
      current.clear();
      let ticks = 0;
      for (let t = 0; t < 30 * 60 * 12 && arena.phase !== "finished"; t++) {
        arena.tick();
        if (arena.phase === "playing") ticks++;
      }
      const winner =
        arena.phase === "finished" ? (arena.winner === "A" ? a : b) : null;
      rows.push([a, b, winner]);
      for (const c of [a, b]) {
        matches[c] = (matches[c] ?? 0) + 1;
        seconds[c] = (seconds[c] ?? 0) + ticks / 30;
      }
    }
  }
writeFileSync(out, JSON.stringify({ rows, usage, matches, seconds }));
