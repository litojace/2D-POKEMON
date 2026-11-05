/**
 * How much stronger is one bot difficulty than another? Every pair of
 * champions plays `games` duels with one side at <strong> and the other at
 * <weak> (champions and sides swap), and it prints the stronger side's win
 * rate overall and per champion it played.
 *
 *   npx tsx scripts/balance/difficulty-gap.ts <games> [strong=hard] [weak=normal] [shard shards out.json]
 *
 * Use it to check that a bot change keeps Hard as much stronger than Normal
 * as before. BOT_OVERRIDE works as in round-robin.ts.
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
const rows: [string, string, boolean][] = [];
let k = 0;
for (let i = 0; i < FIGHTER_IDS.length; i++)
  for (let j = i + 1; j < FIGHTER_IDS.length; j++, k++) {
    if (shards && k % +shards !== +shard) continue;
    for (let g = 0; g < +games; g++) {
      // g % 4: which champion is the strong bot, and which side it starts on.
      const [a, b] =
        g % 2
          ? [FIGHTER_IDS[j], FIGHTER_IDS[i]]
          : [FIGHTER_IDS[i], FIGHTER_IDS[j]];
      const strongFirst = g % 4 < 2;
      const seed = 7000 + k * 97 + g;
      const arena = new Arena(`gap${seed}`);
      arena.add("A", "A", a);
      arena.add("B", "B", b);
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
      const strongChamp = strongFirst ? a : b;
      const weakChamp = strongFirst ? b : a;
      rows.push([
        strongChamp,
        weakChamp,
        arena.winner === (strongFirst ? "A" : "B"),
      ]);
    }
  }
if (out) writeFileSync(out, JSON.stringify(rows));
else {
  const won = rows.filter((r) => r[2]).length;
  console.log(
    `${strong} beats ${weak} in ${((100 * won) / rows.length).toFixed(1)}% of ${rows.length} duels`,
  );
}
