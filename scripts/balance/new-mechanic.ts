/**
 * Does the expert bot use a mechanic its rules don't know? For one champion
 * and one skill kind, plays the champion against every other champion
 * (expert bots on rules only) three ways and prints its win rate and how
 * often it cast the skill a match:
 *
 *   1. its rules know the kind (as the game is today),
 *   2. its rules act as if the kind were new (Profile.unknownKinds): today's
 *      rules never cast it,
 *   3. the same, with the expert's look-ahead (bot-lookahead.ts) on.
 *
 * Use it on a new champion: if (3) casts the new skill about as often as a
 * player would, the look-ahead covers it; then write rules for it if they
 * do better still. Win rates in (3) include the look-ahead's other gains.
 *
 *   npx tsx scripts/balance/new-mechanic.ts <champion> <kind> <skill id> [games=4]
 *   npx tsx scripts/balance/new-mechanic.ts lumoth gaze eyespot-flash
 */
import { Arena } from "../../apps/server/src/simulation.ts";
import { BotBrain, EXPERT_PROFILE } from "../../apps/server/src/bot.ts";
import {
  FIGHTER_IDS,
  type Ability,
  type CharacterId,
  type Fighter,
} from "../../packages/shared/src/index.ts";

const [champ, kind, skillId] = process.argv.slice(2) as [
  CharacterId,
  string,
  string,
];
const games = +(process.argv[5] ?? 4);
if (!champ || !kind || !skillId) {
  console.error("usage: new-mechanic.ts <champion> <kind> <skill id> [games]");
  process.exit(1);
}
const rulesOnly = {
  ...EXPERT_PROFILE,
  expert: { ...EXPERT_PROFILE.expert!, lookAhead: false },
};
const brain = (id: string, profile: object, seed: number) =>
  Object.assign(new BotBrain(id, "expert", seed), { profile });
// Casts in the real match (not in the look-ahead's copies, which run no bots).
let casts = 0;
const proto = Arena.prototype as unknown as {
  cast: (this: Arena, p: Fighter, a: Ability, ...rest: unknown[]) => unknown;
};
const cast = proto.cast;
proto.cast = function (p, a, ...rest) {
  if (this.bots.size && p.character === champ && a?.id === skillId) casts++;
  return cast.call(this, p, a, ...rest);
};
const ways = [
  ["rules know it", rulesOnly],
  ["new to the rules", { ...rulesOnly, unknownKinds: [kind] }],
  ["new + look-ahead", { ...EXPERT_PROFILE, unknownKinds: [kind] }],
] as const;
for (const [label, mine] of ways) {
  casts = 0;
  let won = 0,
    played = 0,
    k = 0;
  for (const opp of FIGHTER_IDS) {
    if (opp === champ) continue;
    k++;
    for (let g = 0; g < games; g++) {
      const seed = 31000 + k * 97 + g;
      const arena = new Arena(`nk${seed}`);
      const [a, b] = g % 2 ? [opp, champ] : [champ, opp];
      arena.add("A", "A", a);
      arena.add("B", "B", b);
      arena.bots.set("A", brain("A", a === champ ? mine : rulesOnly, seed));
      arena.bots.set(
        "B",
        brain("B", b === champ ? mine : rulesOnly, seed * 7 + 3),
      );
      arena.start();
      arena.acknowledgeInstructions("A");
      for (let t = 0; t < 30 * 60 * 12 && arena.phase !== "finished"; t++)
        arena.tick();
      if (arena.phase !== "finished") continue;
      played++;
      if ((arena.winner === "A" ? a : b) === champ) won++;
    }
  }
  console.log(
    `${champ} ${skillId} | ${label.padEnd(17)} | wins ${((100 * won) / played).toFixed(1)}% of ${played} | casts a match ${(casts / played).toFixed(1)}`,
  );
}
