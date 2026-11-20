/**
 * Train the expert bot's way of playing each champion (EXPERT_STYLE in
 * apps/server/src/expert-style.ts) by evolution, from bot duels.
 *
 *   npx tsx scripts/balance/train-expert.ts [options]
 *
 *   --rounds <n>     passes over the roster (default 4)
 *   --mutants <n>    variations tried per champion per round (default 6)
 *   --games <n>      games against each opponent per evaluation (default 6)
 *   --workers <n>    parallel processes (default 4)
 *   --only <a,b>     train only these champions
 *   --state <file>   where progress is kept (default balance-out/train-expert.json)
 *
 * For each champion in turn it makes `mutants` variations of its current
 * style (a few of its numbers moved at random), plays the current style and
 * every variation against all other champions (who play their current
 * styles), and keeps the best variation only if it also wins more on a
 * second, unseen set of games: one lucky set must not decide. Every step is
 * saved to the state file, and an accepted style is written to
 * expert-style.ts at once, so a restarted container loses nothing: run the
 * same command again and it carries on.
 *
 * Run it after a champion is added or changed, then measure as usual. It
 * trains the expert on its rules (look-ahead off: six times faster); the
 * look-ahead weighs the rules' choice too, so it gains from it as well.
 *
 * Internal: `--worker <task.json> <out.json>` plays one share of the games.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  FIGHTER_IDS,
  type CharacterId,
} from "../../packages/shared/src/index.ts";
import { Arena } from "../../apps/server/src/simulation.ts";
import {
  BotBrain,
  EXPERT_PROFILE,
  STYLE_KEYS,
  type Style,
} from "../../apps/server/src/bot.ts";
import { EXPERT_STYLE } from "../../apps/server/src/expert-style.ts";

type Table = Partial<Record<CharacterId, Style>>;
type Task = {
  champion: CharacterId;
  candidates: Style[];
  table: Table;
  opponents: CharacterId[];
  games: number;
  seed: number;
};

/** The expert on its rules, with a style table. */
const profile = (table: Table) => ({
  ...EXPERT_PROFILE,
  expert: { ...EXPERT_PROFILE.expert!, lookAhead: false },
  style: table,
});

/** Wins of `champion` playing `style` against each opponent. */
function play(task: Task) {
  const wins = task.candidates.map(() => 0),
    played = task.candidates.map(() => 0);
  task.candidates.forEach((style, c) => {
    const mine = profile({ ...task.table, [task.champion]: style }),
      theirs = profile(task.table);
    task.opponents.forEach((opp, o) => {
      for (let g = 0; g < task.games; g++) {
        // Every candidate meets the same games (common random numbers).
        const seed = task.seed + FIGHTER_IDS.indexOf(opp) * 997 + g;
        const arena = new Arena(`train${seed}`);
        const [a, b] = g % 2 ? [opp, task.champion] : [task.champion, opp];
        arena.add("A", "A", a);
        arena.add("B", "B", b);
        const brain = (id: string, champ: string, s: number) =>
          Object.assign(new BotBrain(id, "expert", s), {
            profile: champ === task.champion ? mine : theirs,
          });
        arena.bots.set("A", brain("A", a, seed));
        arena.bots.set("B", brain("B", b, seed * 7 + 3));
        arena.start();
        arena.acknowledgeInstructions("A");
        for (let t = 0; t < 30 * 60 * 12 && arena.phase !== "finished"; t++)
          arena.tick();
        if (arena.phase !== "finished") continue;
        played[c]++;
        if ((arena.winner === "A" ? a : b) === task.champion) wins[c]++;
      }
      void o;
    });
  });
  return { wins, played };
}

if (process.argv[2] === "--worker") {
  const task = JSON.parse(readFileSync(process.argv[3], "utf8")) as Task;
  writeFileSync(process.argv[4], JSON.stringify(play(task)));
  process.exit(0);
}

const args = process.argv.slice(2);
const opt = (name: string, d: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : d;
};
const rounds = +opt("--rounds", "4"),
  mutants = +opt("--mutants", "6"),
  games = +opt("--games", "6"),
  workers = +opt("--workers", "4"),
  only = opt("--only", "").split(",").filter(Boolean) as CharacterId[],
  stateFile = opt("--state", "balance-out/train-expert.json");
const champions = only.length ? only : [...FIGHTER_IDS];
const STYLE_FILE = "apps/server/src/expert-style.ts";

type State = {
  table: Table;
  /** Next step: round and champion index. */
  round: number;
  next: number;
  log: string[];
};
let state: State = existsSync(stateFile)
  ? JSON.parse(readFileSync(stateFile, "utf8"))
  : { table: { ...EXPERT_STYLE }, round: 0, next: 0, log: [] };
const save = () => {
  mkdirSync(dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, JSON.stringify(state, null, 1));
};

/** What a missing number means (the rules as written, Hard's settings). */
const DEFAULTS: Required<Omit<Style, "slots">> = {
  range: 1,
  reach: 70,
  closeIn: 2.6,
  sight: 1,
  circle: 1,
  engage: EXPERT_PROFILE.engage,
  retreat: EXPERT_PROFILE.retreat ?? 0,
  kite: EXPERT_PROFILE.kite ?? 0,
  floor: 0,
};
/** Allowed ranges, so a lucky streak can't take a number anywhere absurd. */
const LIMITS: Record<keyof typeof DEFAULTS, [number, number]> = {
  range: [0.6, 1.6],
  reach: [30, 160],
  closeIn: [0.8, 6],
  sight: [0.3, 3],
  circle: [0, 2.5],
  engage: [0, 0.6],
  retreat: [0, 0.7],
  kite: [0, 1],
  floor: [0, 30],
};
let rand = 12345 + state.round * 7919 + state.next * 131;
const random = () => {
  rand = (rand * 1103515245 + 12345) % 2147483648;
  return rand / 2147483648;
};
const gauss = () =>
  Math.sqrt(-2 * Math.log(random() || 1e-9)) * Math.cos(2 * Math.PI * random());
const round3 = (v: number) => Math.round(v * 1000) / 1000;
/** Move two or three of the style's numbers (or a skill's weight). */
function mutate(style: Style): Style {
  const next: Style = { ...style, slots: style.slots && [...style.slots] };
  const moves = 2 + (random() < 0.5 ? 1 : 0);
  for (let m = 0; m < moves; m++) {
    const pick = Math.floor(random() * (STYLE_KEYS.length + 4));
    if (pick >= STYLE_KEYS.length) {
      const slot = pick - STYLE_KEYS.length;
      const slots = next.slots ?? [1, 1, 1, 1];
      slots[slot] = round3(
        Math.max(
          0.3,
          Math.min(3, (slots[slot] ?? 1) * Math.exp(gauss() * 0.3)),
        ),
      );
      next.slots = slots;
      continue;
    }
    const key = STYLE_KEYS[pick];
    const [lo, hi] = LIMITS[key],
      now = next[key] ?? DEFAULTS[key];
    const moved =
      key === "engage" || key === "retreat" || key === "kite"
        ? now + gauss() * 0.08
        : key === "floor"
          ? now + gauss() * 4
          : now * Math.exp(gauss() * 0.2);
    next[key] = round3(Math.max(lo, Math.min(hi, moved)));
  }
  if (!next.slots) delete next.slots;
  return next;
}

const run = (file: string, out: string) =>
  new Promise<void>((ok, bad) => {
    const p = spawn(
      join("node_modules", ".bin", "tsx"),
      ["scripts/balance/train-expert.ts", "--worker", file, out],
      { stdio: "inherit" },
    );
    p.on("exit", (code) => (code ? bad(new Error(`worker ${code}`)) : ok()));
  });
/** Win rates of each candidate, the games split over the workers. */
async function evaluate(
  champion: CharacterId,
  candidates: Style[],
  seed: number,
) {
  const opponents = FIGHTER_IDS.filter((c) => c !== champion);
  const shares = [...Array(workers).keys()].map((w) =>
    opponents.filter((_, i) => i % workers === w),
  );
  const dir = join(dirname(stateFile), "train-work");
  mkdirSync(dir, { recursive: true });
  const results = await Promise.all(
    shares.map(async (share, w) => {
      const task: Task = {
        champion,
        candidates,
        table: state.table,
        opponents: share,
        games,
        seed,
      };
      const file = join(dir, `task-${w}.json`),
        out = join(dir, `out-${w}.json`);
      writeFileSync(file, JSON.stringify(task));
      await run(file, out);
      return JSON.parse(readFileSync(out, "utf8")) as {
        wins: number[];
        played: number[];
      };
    }),
  );
  return candidates.map((_, c) => {
    const w = results.reduce((s, r) => s + r.wins[c], 0),
      n = results.reduce((s, r) => s + r.played[c], 0);
    return (100 * w) / Math.max(1, n);
  });
}

const STYLE_HEADER = `import type { CharacterId } from "../../../packages/shared/src/index.js";
import type { Style } from "./bot.js";
/**
 * The expert bot's learned way of playing each champion (balance
 * measurement only). Written by scripts/balance/train-expert.ts; run it
 * again after a champion is added or changed. A champion missing here plays
 * by the rules as written.
 */
`;
function writeStyles() {
  const entries = Object.entries(state.table).filter(
    ([, s]) => s && Object.keys(s).length,
  );
  const body = entries
    .map(([c, s]) => `  ${c}: ${JSON.stringify(s)},`)
    .join("\n");
  writeFileSync(
    STYLE_FILE,
    `${STYLE_HEADER}export const EXPERT_STYLE: Partial<Record<CharacterId, Style>> = {${body ? `\n${body}\n` : ""}};\n`,
  );
}

for (; state.round < rounds; state.round++, state.next = 0) {
  for (; state.next < champions.length; state.next++) {
    const champion = champions[state.next];
    const current = state.table[champion] ?? {};
    const variants = [...Array(mutants)].map(() => mutate(current));
    const seed = 900000 + state.round * 10007 + state.next * 101;
    const first = await evaluate(champion, [current, ...variants], seed);
    let best = 1;
    for (let i = 2; i < first.length; i++) if (first[i] > first[best]) best = i;
    let line = `round ${state.round} ${champion.padEnd(9)} current ${first[0].toFixed(1)}% best variant ${first[best].toFixed(1)}%`;
    if (first[best] > first[0]) {
      // A second, unseen set of games for the current style and the best variant.
      const [again, check] = await evaluate(
        champion,
        [current, variants[best - 1]],
        seed + 500000,
      );
      line += `, rechecked ${again.toFixed(1)}% vs ${check.toFixed(1)}%`;
      if (check > again) {
        state.table[champion] = variants[best - 1];
        writeStyles();
        line += ` -> kept ${JSON.stringify(variants[best - 1])}`;
      } else line += " -> dropped";
    } else line += " -> kept the current style";
    console.log(line);
    state.log.push(line);
    save();
  }
}
writeStyles();
console.log(`done: ${rounds} rounds; styles in ${STYLE_FILE}`);
