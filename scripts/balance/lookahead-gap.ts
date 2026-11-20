/**
 * How much the look-ahead adds: every pair of champions plays `games` duels
 * between an expert bot with its look-ahead (bot-lookahead.ts) and one on
 * its rules only (champions and sides swap), and it prints the look-ahead
 * side's win rate, overall and by champion.
 *
 *   npx tsx scripts/balance/lookahead-gap.ts <games> [shard shards out.json]
 */
import { writeFileSync } from "node:fs";
import { FIGHTER_IDS } from "../../packages/shared/src/index.ts";
import { Arena } from "../../apps/server/src/simulation.ts";
import { BotBrain, EXPERT_PROFILE } from "../../apps/server/src/bot.ts";

const [games, shard, shards, out] = process.argv.slice(2);
const ahead = EXPERT_PROFILE,
  rules = {
    ...EXPERT_PROFILE,
    expert: { ...EXPERT_PROFILE.expert!, lookAhead: false },
  };
const brain = (id: string, profile: object, seed: number) =>
  Object.assign(new BotBrain(id, "expert", seed), { profile });
// [look-ahead champion, rules champion, look-ahead won]
const rows: [string, string, boolean][] = [];
let k = 0;
for (let i = 0; i < FIGHTER_IDS.length; i++)
  for (let j = i + 1; j < FIGHTER_IDS.length; j++, k++) {
    if (shards && k % +shards !== +shard) continue;
    for (let g = 0; g < +games; g++) {
      const [a, b] =
        g % 2
          ? [FIGHTER_IDS[j], FIGHTER_IDS[i]]
          : [FIGHTER_IDS[i], FIGHTER_IDS[j]];
      const aheadFirst = g % 4 < 2,
        seed = 7000 + k * 97 + g;
      const arena = new Arena(`lag${seed}`);
      arena.add("A", "A", a);
      arena.add("B", "B", b);
      arena.bots.set("A", brain("A", aheadFirst ? ahead : rules, seed));
      arena.bots.set("B", brain("B", aheadFirst ? rules : ahead, seed * 7 + 3));
      arena.start();
      arena.acknowledgeInstructions("A");
      for (let t = 0; t < 30 * 60 * 12 && arena.phase !== "finished"; t++)
        arena.tick();
      if (arena.phase !== "finished") continue;
      rows.push([
        aheadFirst ? a : b,
        aheadFirst ? b : a,
        arena.winner === (aheadFirst ? "A" : "B"),
      ]);
    }
  }
if (out) writeFileSync(out, JSON.stringify(rows));
else {
  const by: Record<string, [number, number]> = {};
  for (const [c, , won] of rows) {
    by[c] ??= [0, 0];
    by[c][1]++;
    if (won) by[c][0]++;
  }
  const won = rows.filter((r) => r[2]).length;
  console.log(
    `look-ahead wins ${((100 * won) / rows.length).toFixed(1)}% of ${rows.length} duels`,
  );
  for (const [c, [w, n]] of Object.entries(by).sort(
    (p, q) => q[1][0] / q[1][1] - p[1][0] / p[1][1],
  ))
    console.log(`  ${c.padEnd(10)} ${((100 * w) / n).toFixed(0)}%`);
}
