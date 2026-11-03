/**
 * Auto-tune: run Hard and Normal bot round robins, average each champion's
 * win rate, nudge its strength factor toward 50%, and repeat.
 *
 *   npx tsx scripts/balance/tune.ts <rounds> <gamesPerPair> [options]
 *
 *   --out <dir>        where round files go (default balance-out/, gitignored)
 *   --start <file>     starting factors JSON (default: all 1)
 *   --shards <n>       parallel processes per difficulty (default 4)
 *   --prototype        include the eight prototype champions (docs/new-champions)
 *
 * Each round writes <out>/round-N.json ({ factors, rates, next }) and prints
 * the win-rate spread. At the end it prints the factors averaged over the
 * last three rounds and the health and basic interval they give. One round
 * with factors left alone is a plain win-rate report: rounds = 1.
 *
 * Cost: n champions play n(n-1)/2 pairings × games × 2 difficulties per
 * round; 16 champions at 40 games is 9,600 matches.
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CHARACTERS, type Character } from "../../packages/shared/src/index.ts";
import { scaled } from "./factors.ts";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const [rounds, games] = [+args[0], +args[1]];
if (!(rounds > 0 && games > 0)) {
  console.error(
    "usage: tune.ts <rounds> <gamesPerPair> [--out dir] [--start factors.json] [--shards n] [--prototype]",
  );
  process.exit(1);
}
const prototype = args.includes("--prototype");
const out = opt("--out") ?? "balance-out";
const shards = +(opt("--shards") ?? 4);
const start = opt("--start");
mkdirSync(out, { recursive: true });

// A factor moves at most 10% a round, half the distance from 50%.
const [LO, HI, GAIN, STEP] = [0.8, 1.25, 0.5, 0.1];
let factors: Record<string, number> = start
  ? JSON.parse(readFileSync(start, "utf8"))
  : {};
const tsx = join("node_modules", ".bin", "tsx");
const run = (argv: string[]) =>
  new Promise<void>((ok, bad) => {
    const p = spawn(tsx, argv, { stdio: "inherit" });
    p.on("exit", (code) =>
      code ? bad(new Error(`round robin exited ${code}`)) : ok(),
    );
  });

const used: Record<string, number>[] = [];
let ids: string[] = [];
for (let r = 0; r < rounds; r++) {
  const file = join(out, `factors-${r}.json`);
  writeFileSync(file, JSON.stringify(factors));
  used.push(factors);
  const rates: Record<string, Record<string, number>> = {};
  for (const diff of ["hard", "normal"]) {
    const parts = [...Array(shards).keys()].map((s) =>
      join(out, `r-${r}-${diff}-${s}.json`),
    );
    await Promise.all(
      parts.map((part, s) =>
        run([
          "scripts/balance/round-robin.ts",
          file,
          `${s}`,
          `${shards}`,
          `${games}`,
          diff,
          part,
          ...(prototype ? ["--prototype"] : []),
        ]),
      ),
    );
    const wins: Record<string, number> = {};
    const played: Record<string, number> = {};
    for (const part of parts)
      for (const [a, b, winner] of JSON.parse(readFileSync(part, "utf8")) as [
        string,
        string,
        string | null,
      ][]) {
        if (!winner) continue;
        played[a] = (played[a] ?? 0) + 1;
        played[b] = (played[b] ?? 0) + 1;
        wins[winner] = (wins[winner] ?? 0) + 1;
      }
    for (const id of Object.keys(played))
      (rates[id] ??= {})[diff] = +(
        (100 * (wins[id] ?? 0)) /
        played[id]
      ).toFixed(1);
  }
  const next: Record<string, number> = {};
  const avg = (id: string) => (rates[id].hard + rates[id].normal) / 2;
  for (const id of Object.keys(rates)) {
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
  const avgs = Object.keys(rates).map(avg);
  console.log(
    `round ${r}: win rates ${Math.min(...avgs).toFixed(1)}–${Math.max(...avgs).toFixed(1)}%`,
  );
  for (const id of Object.keys(rates).sort((a, b) => avg(b) - avg(a)))
    console.log(
      `  ${id.padEnd(10)} ${avg(id).toFixed(1)}%  (hard ${rates[id].hard}, normal ${rates[id].normal})`,
    );
  factors = next;
  ids = Object.keys(rates);
}

// Average the factors used in the last three rounds: single rounds are noisy.
const last = used.slice(-3);
if (rounds > 1 || start) {
  if (prototype) {
    const { NEW_CHARACTERS } =
      await import("../../docs/new-champions/prototype/new-champions.ts");
    Object.assign(CHARACTERS, NEW_CHARACTERS);
  }
  const final: Record<string, number> = {};
  console.log(`\nfactors averaged over the last ${last.length} rounds:`);
  for (const id of ids) {
    final[id] = +(
      last.reduce((s, f) => s + (f[id] ?? 1), 0) / last.length
    ).toFixed(4);
    const c = (CHARACTERS as Record<string, Character>)[id];
    if (!c) continue;
    const ms = Math.round((c.basic.interval ?? 0) * 1000);
    const s = scaled(c.health, ms, final[id]);
    console.log(
      `  ${id.padEnd(10)} ×${final[id]}  health ${c.health} → ${s.health}, basic ${ms} → ${s.intervalMs} ms`,
    );
  }
  writeFileSync(
    join(out, "final-factors.json"),
    JSON.stringify(final, null, 1),
  );
}
