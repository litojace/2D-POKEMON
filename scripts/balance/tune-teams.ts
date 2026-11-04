/**
 * 2v2 auto-tune: random-team bot matches (Hard and Normal), each champion's
 * team win rate averaged over both, its 2v2 factor nudged toward 50%, repeat.
 * The factors are 2v2 only (TEAM_TUNING in packages/shared/src/index.ts):
 * health × f and basic interval ÷ √f, duels untouched.
 *
 *   npx tsx scripts/balance/tune-teams.ts <rounds> <matchesPerDifficulty> [options]
 *
 *   --out <dir>        where round files go (default balance-out/teams)
 *   --start <file>     starting factors JSON (default: TEAM_TUNING as shipped)
 *   --shards <n>       parallel processes per difficulty (default 4)
 *
 * Every round plays the same line-ups (fixed seeds), so only the factors
 * change. One champion is one of four players, so its factor moves its own
 * win rate less than in a duel: the gain is higher than the duel tuner's.
 * At the end it prints the factors averaged over the last three rounds.
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FIGHTER_IDS, TEAM_TUNING } from "../../packages/shared/src/index.ts";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const [rounds, matches] = [+args[0], +args[1]];
if (!rounds || !matches) {
  console.error(
    "usage: tune-teams.ts <rounds> <matchesPerDifficulty> [--out dir] [--start factors.json] [--shards n]",
  );
  process.exit(1);
}
const out = opt("--out") ?? "balance-out/teams";
const shards = +(opt("--shards") ?? 4);
mkdirSync(out, { recursive: true });
// A factor moves at most 12% a round, toward 50% at GAIN per point.
const [LO, HI, GAIN, STEP] = [0.6, 1.6, 1, 0.12];
let factors: Record<string, number> = opt("--start")
  ? JSON.parse(readFileSync(opt("--start")!, "utf8"))
  : Object.fromEntries(FIGHTER_IDS.map((id) => [id, TEAM_TUNING[id] ?? 1]));

const run = (cmd: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn("npx", ["tsx", ...cmd], { stdio: "inherit" });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd.join(" ")}: ${code}`)),
    );
  });

const used: Record<string, number>[] = [];
for (let r = 1; r <= rounds; r++) {
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
          "scripts/balance/teams-worker.ts",
          file,
          String(s),
          String(shards),
          String(matches),
          difficulty,
          part,
        ]),
      ),
    );
    const games: Record<string, number> = {},
      wins: Record<string, number> = {};
    for (const part of parts)
      for (const [blue, red, winner] of JSON.parse(
        readFileSync(part, "utf8"),
      ) as [string[], string[], number | null][]) {
        if (winner === null) continue;
        for (const [team, ids] of [blue, red].entries())
          for (const id of ids) {
            games[id] = (games[id] ?? 0) + 1;
            wins[id] = (wins[id] ?? 0) + (winner === team ? 1 : 0);
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
    const step = Math.max(-STEP, Math.min(STEP, (GAIN * (50 - avg(id))) / 100));
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
    `round ${r}: 2v2 win rates ${Math.min(...avgs).toFixed(1)}–${Math.max(...avgs).toFixed(1)}%`,
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
console.log(`\n2v2 factors averaged over the last ${last.length} rounds:`);
console.log(JSON.stringify(final, null, 1));
writeFileSync(join(out, "final-factors.json"), JSON.stringify(final, null, 1));
