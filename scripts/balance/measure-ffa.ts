/**
 * Measure free-for-all balance with bots: each champion's win rate (with its
 * standard error), damage per second while alive and share of alive time with
 * an enemy in basic-attack reach, at Hard and Normal.
 *
 *   npx tsx scripts/balance/measure-ffa.ts <matchesPerDifficulty> [options]
 *
 *   --players <n>    4 (default) or 3; 2 with --mode duel
 *   --mode <m>       ffa (default) or duel (same numbers in duels, to compare)
 *   --factors <f>    FFA factors JSON to measure (default: FFA_TUNING as shipped)
 *   --seed <s>       FFA_SEED for the line-ups (default 4242)
 *   --shards <n>     parallel processes per difficulty (default 4)
 *   --out <dir>      where shard files and the summary go (default balance-out/ffa-measure)
 *
 * The fair win rate is 1 / players (25% with four, 33% with three).
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FFA_TUNING, FIGHTER_IDS } from "../../packages/shared/src/index.ts";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const matches = +args[0];
if (!matches) {
  console.error(
    "usage: measure-ffa.ts <matchesPerDifficulty> [--players n] [--mode ffa|duel] [--factors f] [--seed s] [--shards n] [--out dir]",
  );
  process.exit(1);
}
const mode = opt("--mode") ?? "ffa";
const players = +(opt("--players") ?? (mode === "duel" ? 2 : 4));
const shards = +(opt("--shards") ?? 4);
const out = opt("--out") ?? "balance-out/ffa-measure";
mkdirSync(out, { recursive: true });
let factorsFile = opt("--factors");
if (!factorsFile) {
  factorsFile = join(out, "factors.json");
  writeFileSync(
    factorsFile,
    JSON.stringify(
      Object.fromEntries(FIGHTER_IDS.map((id) => [id, FFA_TUNING[id] ?? 1])),
    ),
  );
}
const env = opt("--seed")
  ? { ...process.env, FFA_SEED: opt("--seed") }
  : process.env;
const run = (cmd: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn("npx", ["tsx", ...cmd], { stdio: "inherit", env });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd.join(" ")}: ${code}`)),
    );
  });

type Row = {
  picks: string[];
  winner: number | null;
  stats: [number, number, number][];
};
type Tally = {
  games: number;
  wins: number;
  dealt: number;
  alive: number;
  reach: number;
};
const fair = 100 / players;
const result: Record<string, Record<string, Tally>> = {};
let draws = 0;
const difficulties = ["hard", "normal"];
await Promise.all(
  difficulties.flatMap((difficulty) =>
    Array.from({ length: shards }, (_, s) =>
      run([
        "scripts/balance/ffa-worker.ts",
        factorsFile!,
        String(s),
        String(shards),
        String(matches),
        difficulty,
        join(out, `${difficulty}-${s}.json`),
        String(players),
        mode,
      ]),
    ),
  ),
);
for (const difficulty of difficulties)
  for (let s = 0; s < shards; s++)
    for (const row of JSON.parse(
      readFileSync(join(out, `${difficulty}-${s}.json`), "utf8"),
    ) as Row[]) {
      if (row.winner === null) {
        draws++;
        continue;
      }
      row.picks.forEach((id, i) => {
        const t = ((result[id] ??= {})[difficulty] ??= {
          games: 0,
          wins: 0,
          dealt: 0,
          alive: 0,
          reach: 0,
        });
        t.games++;
        t.wins += row.winner === i ? 1 : 0;
        t.dealt += row.stats[i][0];
        t.alive += row.stats[i][1];
        t.reach += row.stats[i][2];
      });
    }
const rate = (t: Tally) => (100 * t.wins) / Math.max(1, t.games);
const se = (t: Tally) => {
  const p = t.wins / Math.max(1, t.games);
  return 100 * Math.sqrt((p * (1 - p)) / Math.max(1, t.games));
};
const summary = FIGHTER_IDS.map((id) => {
  const [h, n] = difficulties.map((d) => result[id][d]);
  const sum = (k: keyof Tally) => h[k] + n[k];
  return {
    id,
    hard: +rate(h).toFixed(1),
    normal: +rate(n).toFixed(1),
    avg: +((rate(h) + rate(n)) / 2).toFixed(1),
    // SE of the mean of two independent rates.
    se: +(Math.sqrt(se(h) ** 2 + se(n) ** 2) / 2).toFixed(1),
    games: sum("games"),
    dps: +(sum("dealt") / sum("alive")).toFixed(2),
    reach: +((100 * sum("reach")) / sum("alive")).toFixed(1),
  };
}).sort((a, b) => b.avg - a.avg);
console.log(
  `${mode} with ${players} players, ${matches} matches per difficulty (${draws} unfinished), fair win rate ${fair.toFixed(1)}%`,
);
console.log(
  "champion    win%   ±SE  (hard / normal)  games  dmg/s alive  reach%",
);
for (const r of summary)
  console.log(
    `${r.id.padEnd(10)} ${r.avg.toFixed(1).padStart(5)} ±${r.se.toFixed(1)}  (${r.hard.toFixed(1).padStart(4)} / ${r.normal.toFixed(1).padStart(4)})  ${String(r.games).padStart(5)}  ${r.dps.toFixed(2).padStart(6)}  ${r.reach.toFixed(1).padStart(6)}`,
  );
writeFileSync(
  join(out, "summary.json"),
  JSON.stringify({ mode, players, matches, draws, fair, summary }, null, 1),
);
