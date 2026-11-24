/**
 * One shard of 2v2 bot matches with random teams (used by tune-teams.ts).
 *
 *   npx tsx scripts/balance/teams-worker.ts <factors.json|-> <shard> <shards> <matches> <hard|normal> <out.json>
 *
 * Teams are drawn from a fixed seed, so every round plays the same line-ups
 * and only the 2v2 factors change between rounds. Writes
 * [[blue], [red], winnerTeam | null] per match.
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  FIGHTER_IDS,
  TEAM_TUNING,
  type CharacterId,
} from "../../packages/shared/src/index.ts";
import { Arena } from "../../apps/server/src/simulation.ts";
import {
  BOT_PROFILES,
  BotBrain,
  type BotDifficulty,
} from "../../apps/server/src/bot.ts";

const [factorsFile, shard, shards, matches, difficulty, out] =
  process.argv.slice(2);
const factors: Record<string, number> =
  factorsFile === "-" ? {} : JSON.parse(readFileSync(factorsFile, "utf8"));
for (const id of FIGHTER_IDS) TEAM_TUNING[id] = factors[id] ?? 1;
// BOT_OVERRIDE (JSON, as in round-robin.ts) changes bot profiles for this run.
for (const [d, o] of Object.entries(
  JSON.parse(process.env.BOT_OVERRIDE ?? "{}") as Record<string, object>,
))
  Object.assign(BOT_PROFILES[d as BotDifficulty], o);

// TEAMS_SEED picks another set of line-ups (to check tuned factors on fresh matches).
let seed =
  +(process.env.TEAMS_SEED ?? 2024) + (difficulty === "hard" ? 0 : 1_000_003);
const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const rows: [string[], string[], number | null][] = [];
const only = process.env.RR_ONLY?.split(",");
for (let m = 0; m < +matches; m++) {
  const pool = [...FIGHTER_IDS];
  const pick: CharacterId[] = [];
  for (let i = 0; i < 4; i++)
    pick.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  // RR_ONLY: only the line-ups with one of these champions (tune-teams --only).
  if (only && !pick.some((id) => only.includes(id))) continue;
  if (m % +shards !== +shard) continue;
  const arena = new Arena(`teams-${m}`, "teams");
  // Join order alternates teams: 0 and 2 blue, 1 and 3 red.
  pick.forEach((c, i) => {
    arena.add(`P${i}`, `P${i}`, c);
    arena.bots.set(
      `P${i}`,
      new BotBrain(`P${i}`, difficulty as BotDifficulty, 1000 + m * 13 + i),
    );
  });
  arena.start();
  arena.acknowledgeInstructions("P0");
  for (let t = 0; t < 30 * 60 * 12 && arena.phase !== "finished"; t++)
    arena.tick();
  rows.push([
    [pick[0], pick[2]],
    [pick[1], pick[3]],
    arena.phase === "finished" ? arena.winnerTeam : null,
  ]);
}
writeFileSync(out, JSON.stringify(rows));
