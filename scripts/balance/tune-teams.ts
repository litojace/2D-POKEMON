/**
 * 2v2 / free-for-all auto-tune: random line-up bot matches (Hard and Normal),
 * each champion's win rate averaged over both, its mode factor nudged toward
 * the fair rate (50% in 2v2, 1 / players in a free-for-all), repeat. The
 * factors are for that mode only (TEAM_TUNING or FFA_TUNING in
 * packages/shared/src/index.ts): health × f and basic interval ÷ √f, duels
 * untouched.
 *
 *   npx tsx scripts/balance/tune-teams.ts <rounds> <matchesPerDifficulty> [options]
 *
 *   --mode <m>         teams (default) or ffa
 *   --players <n>      free-for-all size, 4 (default) or 3
 *   --out <dir>        where round files go (default balance-out/<mode>)
 *   --start <file>     starting factors JSON (default: the mode's table as shipped)
 *   --shards <n>       parallel processes per difficulty (default 4)
 *   --gain <g>         how hard a round pushes toward the fair rate (default 1)
 *   --fresh            new line-ups every round instead of the same ones
 *
 * Every round plays the same line-ups (fixed seeds), so only the factors
 * change. One champion is one of four players, so its factor moves its own
 * win rate less than in a duel: the gain is higher than the duel tuner's.
 * At the end it prints the factors averaged over the last three rounds.
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  FFA_TUNING,
  FIGHTER_IDS,
  TEAM_TUNING,
} from "../../packages/shared/src/index.ts";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const [rounds, matches] = [+args[0], +args[1]];
if (!rounds || !matches) {
  console.error(
    "usage: tune-teams.ts <rounds> <matchesPerDifficulty> [--mode teams|ffa] [--players n] [--out dir] [--start factors.json] [--shards n] [--gain g] [--fresh]",
  );
  process.exit(1);
}
const mode = opt("--mode") ?? "teams";
if (mode !== "teams" && mode !== "ffa") {
  console.error(`unknown --mode ${mode} (teams or ffa)`);
  process.exit(1);
}
const ffa = mode === "ffa";
const players = ffa ? +(opt("--players") ?? 4) : 4;
// The fair win rate: 50% for a team, one in `players` in a free-for-all.
const TARGET = ffa ? 100 / players : 50;
const label = ffa ? `FFA (${players} players)` : "2v2";
const table = ffa ? FFA_TUNING : TEAM_TUNING;
const out = opt("--out") ?? `balance-out/${mode}`;
const shards = +(opt("--shards") ?? 4);
mkdirSync(out, { recursive: true });
// A factor moves at most 12% a round, toward TARGET at GAIN per point.
const [LO, HI, STEP] = [0.6, 1.6, 0.12];
const GAIN = +(opt("--gain") ?? 1);
// --fresh: new line-ups every round (TEAMS_SEED / FFA_SEED = 5000 + round),
// so the factors fit the mode in general rather than one fixed set of matches.
const fresh = args.includes("--fresh");
let factors: Record<string, number> = opt("--start")
  ? JSON.parse(readFileSync(opt("--start")!, "utf8"))
  : Object.fromEntries(FIGHTER_IDS.map((id) => [id, table[id] ?? 1]));

const run = (cmd: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn("npx", ["tsx", ...cmd], {
      stdio: "inherit",
      env: fresh
        ? {
            ...process.env,
            [ffa ? "FFA_SEED" : "TEAMS_SEED"]: String(seedFor),
          }
        : process.env,
    });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd.join(" ")}: ${code}`)),
    );
  });

const used: Record<string, number>[] = [];
let seedFor = 0;
for (let r = 1; r <= rounds; r++) {
  seedFor = 5000 + r;
  const file = join(out, `factors-${r}.json`);
  writeFileSync(file, JSON.stringify(factors));
  used.push(factors);
  const rates: Record<string, Record<string, number>> = {};
  for (const difficulty of ["hard", "normal"]) {
    const parts = Array.from({ length: shards }, (_, s) =>
      join(out, `round-${r}-${difficulty}-${s}.json`),
    );
    await Promise.all(
      parts.map((part, s) =>
        run([
          `scripts/balance/${ffa ? "ffa" : "teams"}-worker.ts`,
          file,
          String(s),
          String(shards),
          String(matches),
          difficulty,
          part,
          ...(ffa ? [String(players)] : []),
        ]),
      ),
    );
    const games: Record<string, number> = {},
      wins: Record<string, number> = {};
    const tally = (id: string, won: boolean) => {
      games[id] = (games[id] ?? 0) + 1;
      wins[id] = (wins[id] ?? 0) + (won ? 1 : 0);
    };
    for (const part of parts) {
      const rows = JSON.parse(readFileSync(part, "utf8"));
      if (ffa)
        for (const { picks, winner } of rows as {
          picks: string[];
          winner: number | null;
        }[]) {
          if (winner === null) continue;
          picks.forEach((id, i) => tally(id, winner === i));
        }
      else
        for (const [blue, red, winner] of rows as [
          string[],
          string[],
          number | null,
        ][]) {
          if (winner === null) continue;
          for (const [team, ids] of [blue, red].entries())
            for (const id of ids) tally(id, winner === team);
        }
    }
    for (const id of FIGHTER_IDS)
      (rates[id] ??= {})[difficulty] = +(
        (100 * (wins[id] ?? 0)) /
        Math.max(1, games[id] ?? 0)
      ).toFixed(1);
  }
  const avg = (id: string) => (rates[id].hard + rates[id].normal) / 2;
  const next: Record<string, number> = {};
  for (const id of FIGHTER_IDS) {
    const step = Math.max(
      -STEP,
      Math.min(STEP, (GAIN * (TARGET - avg(id))) / 100),
    );
    next[id] = +Math.max(
      LO,
      Math.min(HI, (factors[id] ?? 1) * (1 + step)),
    ).toFixed(4);
  }
  writeFileSync(
    join(out, `round-${r}.json`),
    JSON.stringify({ round: r, factors, rates, next }, null, 1),
  );
  const avgs = FIGHTER_IDS.map(avg);
  console.log(
    `round ${r}: ${label} win rates ${Math.min(...avgs).toFixed(1)}–${Math.max(...avgs).toFixed(1)}%`,
  );
  for (const id of [...FIGHTER_IDS].sort((a, b) => avg(b) - avg(a)))
    console.log(
      `  ${id.padEnd(10)} ${avg(id).toFixed(1)}%  (hard ${rates[id].hard}, normal ${rates[id].normal})  factor ${(factors[id] ?? 1).toFixed(3)} -> ${next[id].toFixed(3)}`,
    );
  factors = next;
}
// Average the factors used in the last three rounds: single rounds are noisy.
const last = used.slice(-3);
const final = Object.fromEntries(
  FIGHTER_IDS.map((id) => [
    id,
    +(last.reduce((s, f) => s + (f[id] ?? 1), 0) / last.length).toFixed(3),
  ]),
);
console.log(`\n${label} factors averaged over the last ${last.length} rounds:`);
console.log(JSON.stringify(final, null, 1));
writeFileSync(join(out, "final-factors.json"), JSON.stringify(final, null, 1));
