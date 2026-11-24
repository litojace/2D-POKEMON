/**
 * One shard of a bot round robin on the real server Arena: every pair of
 * champions plays `games` matches (sides alternate), one result row per match.
 *
 *   npx tsx scripts/balance/round-robin.ts <factors.json|-> <shard> <shards> <games> <expert|hard|normal|easy> <out.json>
 *
 * factors.json maps champion id to a strength factor (health × f, basic
 * interval ÷ √f, rounded to 5 ms); "-" means none. BOT_OVERRIDE (JSON, e.g.
 * {"hard":{"rest":0.34}}) overrides bot profile settings for the run;
 * RR_SEED (default 5000) picks another set of seeded matches; RR_ONLY
 * (comma-separated ids) plays only the pairings that include one of them.
 *
 * "expert" is the balance-only bot (EXPERT_PROFILE in apps/server/src/bot.ts:
 * Hard plus the counterplay a decent player knows). EXPERT_OFF
 * (comma-separated ExpertFlags, e.g. lookAway,jumpSeeds) switches some of
 * its behaviours off, to measure what each one changes.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { FIGHTER_IDS } from "../../packages/shared/src/index.ts";
import { Arena } from "../../apps/server/src/simulation.ts";
import {
  BALANCE_PROFILES,
  BotBrain,
  EXPERT_FLAGS,
  type BotLevel,
} from "../../apps/server/src/bot.ts";
import { applyFactors } from "./factors.ts";

const [file, shard, shards, games, diff, out] = [
  process.argv[2],
  +process.argv[3],
  +process.argv[4],
  +process.argv[5],
  process.argv[6] as BotLevel,
  process.argv[7],
];

// BOT_OVERRIDE='{"hard":{"rest":0.34}}' changes bot profiles for this run
// (to find out which profile setting moves which champion).
for (const [d, o] of Object.entries(
  JSON.parse(process.env.BOT_OVERRIDE ?? "{}") as Record<string, object>,
))
  Object.assign(BALANCE_PROFILES[d as BotLevel], o);
if (!(diff in BALANCE_PROFILES)) throw new Error(`unknown bot level ${diff}`);
for (const flag of process.env.EXPERT_OFF?.split(",").filter(Boolean) ?? []) {
  if (!EXPERT_FLAGS.includes(flag as never))
    throw new Error(`unknown expert flag ${flag}`);
  BALANCE_PROFILES.expert.expert![flag as (typeof EXPERT_FLAGS)[number]] =
    false;
}

const ids: string[] = [...FIGHTER_IDS];
applyFactors(file === "-" ? {} : JSON.parse(readFileSync(file, "utf8")));

const rows: [string, string, string | null][] = [];
const only = process.env.RR_ONLY?.split(",");
// Pairings are numbered over the whole roster (k, which seeds the matches)
// whatever RR_ONLY leaves out; shards split the pairings actually played.
let k = 0,
  played = 0;
for (let i = 0; i < ids.length; i++)
  for (let j = i + 1; j < ids.length; j++, k++) {
    if (only && !only.includes(ids[i]) && !only.includes(ids[j])) continue;
    if (played++ % shards !== shard) continue;
    for (let g = 0; g < games; g++) {
      // Alternate sides so the spawn side never decides a matchup.
      const [a, b] = g % 2 ? [ids[j], ids[i]] : [ids[i], ids[j]];
      const seed = +(process.env.RR_SEED ?? 5000) + k * 97 + g;
      const arena = new Arena(`balance${seed}`);
      arena.add("A", "A", a as never);
      arena.add("B", "B", b as never);
      arena.bots.set("A", new BotBrain("A", diff, seed));
      arena.bots.set("B", new BotBrain("B", diff, seed * 7 + 3));
      arena.start();
      arena.acknowledgeInstructions("A");
      // Twelve minutes at 30 Hz; unfinished matches count for neither side.
      for (let t = 0; t < 30 * 60 * 12 && arena.phase !== "finished"; t++)
        arena.tick();
      const winner =
        arena.phase === "finished" ? (arena.winner === "A" ? a : b) : null;
      rows.push([a, b, winner]);
    }
  }
writeFileSync(out, JSON.stringify(rows));
