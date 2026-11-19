/**
 * The difficulty curve on equal terms: every champion plays `games` mirror
 * duels (the same champion on both sides), one side a <strong> bot and the
 * other a <weak> one (sides swap). Prints the stronger bot's win rate per
 * champion and overall, and the share of rounds the weaker bot still took.
 *
 *   npx tsx scripts/balance/difficulty-mirror.ts <games> [strong=hard] [weak=normal] [shard shards out.json]
 *
 * With shard/shards/out it plays only every shards-th champion from shard
 * on and writes [champion, strong won, rounds strong, rounds weak] rows to
 * out.json, to merge later (long runs survive in small pieces).
 * BOT_OVERRIDE works as in round-robin.ts.
 */
import { writeFileSync } from "node:fs";
import { FIGHTER_IDS } from "../../packages/shared/src/index.ts";
import { Arena } from "../../apps/server/src/simulation.ts";
import {
  BOT_PROFILES,
  BotBrain,
  type BotDifficulty,
} from "../../apps/server/src/bot.ts";

const [games, strong = "hard", weak = "normal", shard, shards, out] =
  process.argv.slice(2);
for (const [d, o] of Object.entries(
  JSON.parse(process.env.BOT_OVERRIDE ?? "{}") as Record<string, object>,
))
  Object.assign(BOT_PROFILES[d as BotDifficulty], o);
const rows: [string, boolean, number, number][] = [];
FIGHTER_IDS.forEach((c, k) => {
  if (shards && k % +shards !== +shard) return;
  for (let g = 0; g < +games; g++) {
    const strongFirst = g % 2 === 0;
    const seed = 9100 + k * 131 + g;
    const arena = new Arena(`mirror${seed}`);
    arena.add("A", "A", c);
    arena.add("B", "B", c);
    arena.bots.set(
      "A",
      new BotBrain("A", (strongFirst ? strong : weak) as BotDifficulty, seed),
    );
    arena.bots.set(
      "B",
      new BotBrain(
        "B",
        (strongFirst ? weak : strong) as BotDifficulty,
        seed * 7 + 3,
      ),
    );
    arena.start();
    arena.acknowledgeInstructions("A");
    for (let t = 0; t < 30 * 60 * 12 && arena.phase !== "finished"; t++)
      arena.tick();
    if (arena.phase !== "finished") continue;
    const [sid, wid] = strongFirst ? ["A", "B"] : ["B", "A"];
    rows.push([c, arena.winner === sid, arena.scores[sid], arena.scores[wid]]);
  }
});
if (out) writeFileSync(out, JSON.stringify(rows));
else {
  const by = new Map<string, number[]>();
  for (const [c, w] of rows) {
    const e = by.get(c) ?? [0, 0];
    e[0] += w ? 1 : 0;
    e[1]++;
    by.set(c, e);
  }
  for (const [c, [w, n]] of by)
    console.log(`${c.padEnd(10)} ${((100 * w) / n).toFixed(0)}% (${n})`);
  const won = rows.filter((r) => r[1]).length;
  const rs = rows.reduce((s, r) => s + r[2], 0),
    rw = rows.reduce((s, r) => s + r[3], 0);
  console.log(
    `${strong} beats ${weak} (same champion) in ${((100 * won) / rows.length).toFixed(1)}% of ${rows.length} duels; ${weak} takes ${((100 * rw) / (rs + rw)).toFixed(1)}% of rounds`,
  );
}
