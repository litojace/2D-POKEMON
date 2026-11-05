/**
 * Why does a champion do better or worse against Hard bots than Normal ones?
 * Plays bot duels (both sides the same difficulty) and reports, per champion
 * and difficulty: win rate, damage dealt and taken per second, average gap to
 * the opponent, share of time with the opponent in basic-attack reach, and
 * for each ability its casts per minute, hits per cast and damage share.
 *
 *   npx tsx scripts/balance/duel-diag.ts <gamesPerPair> [champion ...] [--json out.json]
 *
 * With champions named, only their pairings are played (against all 15
 * others). Read-only: it wraps Arena.cast / Arena.damage to count, nothing
 * else changes.
 */
import { writeFileSync } from "node:fs";
import {
  CHARACTERS,
  FIGHTER_IDS,
  RULES,
  type Ability,
  type CharacterId,
  type Fighter,
} from "../../packages/shared/src/index.ts";
import { Arena } from "../../apps/server/src/simulation.ts";
import { BotBrain, type BotDifficulty } from "../../apps/server/src/bot.ts";

const args = process.argv.slice(2);
const jsonAt = args.indexOf("--json");
const jsonOut = jsonAt >= 0 ? args[jsonAt + 1] : undefined;
const games = +args[0];
const only = args
  .slice(1)
  .filter((a, i) => a !== "--json" && args[i] !== "--json") as CharacterId[];
if (!games) {
  console.error(
    "usage: duel-diag.ts <gamesPerPair> [champion ...] [--json out]",
  );
  process.exit(1);
}
type Tally = {
  games: number;
  wins: number;
  seconds: number;
  dealt: number;
  taken: number;
  gap: number;
  reach: number;
  abilities: Record<string, { casts: number; hits: number; damage: number }>;
};
const blank = (): Tally => ({
  games: 0,
  wins: 0,
  seconds: 0,
  dealt: 0,
  taken: 0,
  gap: 0,
  reach: 0,
  abilities: {},
});
const out: Record<string, Record<string, Tally>> = {};
const dt = 1 / RULES.tick;

for (const difficulty of ["hard", "normal"] as BotDifficulty[]) {
  let k = 0;
  for (let i = 0; i < FIGHTER_IDS.length; i++)
    for (let j = i + 1; j < FIGHTER_IDS.length; j++, k++) {
      const pair = [FIGHTER_IDS[i], FIGHTER_IDS[j]];
      if (only.length && !pair.some((c) => only.includes(c))) continue;
      for (let g = 0; g < games; g++) {
        const [a, b] = g % 2 ? [pair[1], pair[0]] : pair;
        const seed = 9000 + k * 97 + g;
        const arena = new Arena(`diag${seed}`);
        arena.add("A", "A", a);
        arena.add("B", "B", b);
        arena.bots.set("A", new BotBrain("A", difficulty, seed));
        arena.bots.set("B", new BotBrain("B", difficulty, seed * 7 + 3));
        const t: Record<string, Tally> = { A: blank(), B: blank() };
        const ab = (id: string, a: Ability) =>
          (t[id].abilities[a.id] ??= { casts: 0, hits: 0, damage: 0 });
        const cast = arena.cast.bind(arena);
        arena.cast = (p: Fighter, a: Ability, ex?: boolean) => {
          if (arena.phase === "playing" && p.hp > 0) ab(p.id, a).casts++;
          return cast(p, a, ex);
        };
        const damage = arena.damage.bind(arena);
        arena.damage = (
          target: Fighter,
          amount: number,
          owner: string,
          a?: Ability,
        ) => {
          const before = target.hp;
          const r = damage(target, amount, owner, a);
          const done = before - target.hp;
          if (a && t[owner] && owner !== target.id && done > 0) {
            ab(owner, a).hits++;
            ab(owner, a).damage += done;
          }
          return r;
        };
        arena.start();
        arena.acknowledgeInstructions("A");
        for (let s = 0; s < 30 * 60 * 12 && arena.phase !== "finished"; s++) {
          arena.tick();
          if (arena.phase !== "playing") continue;
          const [p, q] = arena.players;
          if (p.hp <= 0 || q.hp <= 0) continue;
          const gap = Math.hypot(p.x - q.x, p.y - q.y);
          for (const f of [p, q]) {
            t[f.id].seconds += dt;
            t[f.id].gap += gap * dt;
            if (
              gap <=
              (CHARACTERS[f.character].basic.range ?? 0) + RULES.radius
            )
              t[f.id].reach += dt;
          }
        }
        if (arena.phase !== "finished") continue;
        for (const f of arena.players) {
          const tally = t[f.id];
          tally.games = 1;
          tally.wins = arena.winner === f.id ? 1 : 0;
          tally.dealt = f.stats.dealt;
          tally.taken = f.stats.received;
          const sum = ((out[f.character] ??= {})[difficulty] ??= blank());
          for (const key of [
            "games",
            "wins",
            "seconds",
            "dealt",
            "taken",
            "gap",
            "reach",
          ] as const)
            sum[key] += tally[key];
          for (const [id, v] of Object.entries(tally.abilities)) {
            const s = (sum.abilities[id] ??= { casts: 0, hits: 0, damage: 0 });
            s.casts += v.casts;
            s.hits += v.hits;
            s.damage += v.damage;
          }
        }
      }
    }
}
const ids = only.length ? only : [...FIGHTER_IDS];
for (const id of ids) {
  console.log(`\n${id}`);
  for (const d of ["hard", "normal"]) {
    const s = out[id][d];
    console.log(
      `  ${d.padEnd(6)} win ${((100 * s.wins) / s.games).toFixed(1)}% (${s.games})  dealt/s ${(s.dealt / s.seconds).toFixed(2)}  taken/s ${(s.taken / s.seconds).toFixed(2)}  gap ${(s.gap / s.seconds).toFixed(0)}  in reach ${((100 * s.reach) / s.seconds).toFixed(0)}%`,
    );
    const kit = CHARACTERS[id as CharacterId];
    for (const a of [kit.basic, ...kit.skills]) {
      const v = s.abilities[a.id] ?? { casts: 0, hits: 0, damage: 0 };
      console.log(
        `      ${a.id.padEnd(18)} ${((60 * v.casts) / s.seconds).toFixed(1).padStart(5)}/min  hits/cast ${(v.hits / Math.max(1, v.casts)).toFixed(2)}  ${((100 * v.damage) / Math.max(1, s.dealt)).toFixed(0).padStart(3)}% of damage`,
      );
    }
  }
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(out, null, 1));
