/**
 * One shard of free-for-all bot matches with random champions (used by
 * tune-teams.ts --mode ffa, and on its own to measure FFA balance).
 *
 *   npx tsx scripts/balance/ffa-worker.ts <factors.json|-> <shard> <shards> <matches> <hard|normal> <out.json> [players] [mode]
 *
 * players: 4 (default) or 3. mode: "ffa" (default), or "duel" with players 2
 * to measure the same per-champion numbers in duels for comparison.
 *
 * Champions are drawn from a fixed seed (FFA_SEED picks another set), so every
 * round plays the same line-ups and only the FFA factors change. Writes one
 * row per match: { picks, winner (index into picks) | null, stats } where
 * stats[i] = [damage dealt, seconds alive while the round was being played,
 * seconds alive with an enemy inside basic-attack reach, damage taken].
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  CHARACTERS,
  FFA_TUNING,
  FIGHTER_IDS,
  RULES,
  type CharacterId,
  type MatchMode,
} from "../../packages/shared/src/index.ts";
import { Arena } from "../../apps/server/src/simulation.ts";
import { BotBrain, type BotDifficulty } from "../../apps/server/src/bot.ts";

const [factorsFile, shard, shards, matches, difficulty, out, players, mode] =
  process.argv.slice(2);
const size = +(players ?? 4);
const matchMode = (mode ?? "ffa") as MatchMode;
const factors: Record<string, number> =
  factorsFile === "-" ? {} : JSON.parse(readFileSync(factorsFile, "utf8"));
for (const id of FIGHTER_IDS) FFA_TUNING[id] = factors[id] ?? 1;

let seed =
  +(process.env.FFA_SEED ?? 4242) +
  (difficulty === "hard" ? 0 : 1_000_003) +
  size * 7919;
const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
type Row = {
  picks: CharacterId[];
  winner: number | null;
  stats: [number, number, number, number][];
};
const rows: Row[] = [];
const dt = 1 / RULES.tick;
for (let m = 0; m < +matches; m++) {
  const pool = [...FIGHTER_IDS];
  const picks: CharacterId[] = [];
  for (let i = 0; i < size; i++)
    picks.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  if (m % +shards !== +shard) continue;
  const arena = new Arena(`ffa-${m}`, matchMode);
  picks.forEach((c, i) => {
    arena.add(`P${i}`, `P${i}`, c);
    arena.bots.set(
      `P${i}`,
      new BotBrain(`P${i}`, difficulty as BotDifficulty, 1000 + m * 13 + i),
    );
  });
  arena.start();
  arena.acknowledgeInstructions("P0");
  const alive = picks.map(() => 0),
    reach = picks.map(() => 0);
  for (let t = 0; t < 30 * 60 * 12 && arena.phase !== "finished"; t++) {
    arena.tick();
    if (arena.phase !== "playing") continue;
    arena.players.forEach((p, i) => {
      if (p.out || p.hp <= 0) return;
      alive[i] += dt;
      const r = (CHARACTERS[p.character].basic.range ?? 0) + RULES.radius;
      if (
        arena
          .enemiesOf(p)
          .some((e) => e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) <= r)
      )
        reach[i] += dt;
    });
  }
  rows.push({
    picks,
    winner:
      arena.phase === "finished" && arena.winnerTeam !== null
        ? arena.players.findIndex((p) => arena.teamOf(p) === arena.winnerTeam)
        : null,
    stats: arena.players.map((p, i) => [
      Math.round(p.stats.dealt ?? 0),
      +alive[i].toFixed(1),
      +reach[i].toFixed(1),
      Math.round(p.stats.received ?? 0),
    ]),
  });
}
writeFileSync(out, JSON.stringify(rows));
