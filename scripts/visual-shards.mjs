// Splits the visual suite into CI shards of about equal running time
// (.github/workflows/ci.yml). Playwright's own --shard splits by test count,
// and our tests take from 3 seconds to several minutes, so count-based
// shards came out 10 to 30 minutes long and the slowest set the pace.
//
// - The timing and frame-rate specs (TIMING_SPECS, the list in CLAUDE.md)
//   get a shard of their own, on one worker, so nothing shares their machine.
// - Every other test is placed by its recorded duration
//   (tests/visual/durations.json) onto the least-loaded of the balanced
//   shards, which run two workers each (4-CPU runners). A test with no
//   recorded time (a new one) counts as the median.
// - The test list comes from Playwright itself (--list), so every current
//   test lands in exactly one shard, whatever the durations file says.
//
// Usage (prints a --grep pattern matching exactly that shard's tests):
//   node scripts/visual-shards.mjs timing
//   node scripts/visual-shards.mjs <index> <count>     e.g. 3 8
//   node scripts/visual-shards.mjs --plan <count>      minutes per shard
//   node scripts/visual-shards.mjs --update <report.json>
//     refresh tests/visual/durations.json from a JSON report
//     (npx playwright merge-reports --reporter json <blobs> > report.json)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const TIMING_SPECS = [
  "battle-performance.spec.ts",
  "pvp-performance.spec.ts",
  "roster-smooth.spec.ts",
  "graphics-quality.spec.ts",
  "ui-motion.spec.ts",
  "touch-recovery.spec.ts",
  "cosmetic-displays.spec.ts",
];
/** Two workers per balanced shard: each test costs half its time. */
export const BALANCED_WORKERS = 2;

const root = fileURLToPath(new URL("..", import.meta.url));
const DURATIONS = `${root}tests/visual/durations.json`;

/**
 * "file describe… title", the key in durations.json (file relative to
 * tests/visual; any describe blocks' titles before the test's, as Playwright
 * joins them). Tests in describe blocks can share a title.
 */
export const keyOf = (t) => [t.file, ...(t.describes ?? []), t.title].join(" ");
/** A test's recorded seconds (by full key, else by file and title alone). */
const secondsOf = (t, durations) =>
  durations[keyOf(t)] ?? durations[`${t.file} ${t.title}`];

/** A --grep pattern matching exactly these tests: Playwright matches it
 *  against " <file> <title>" (an empty project name, then a space). */
export function grepFor(tests) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  return `^ (${tests.map((t) => esc(keyOf(t))).join("|")})$`;
}

/**
 * Place tests onto `count` shards, longest first onto the least loaded
 * (ties: the lower index), so shard lengths come out close. Deterministic:
 * the same tests and durations always give the same shards.
 */
export function balance(tests, durations, count) {
  const known = tests.map((t) => secondsOf(t, durations)).filter((s) => s > 0);
  const sorted = [...known].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 10;
  const costed = tests
    .map((t) => {
      const s = secondsOf(t, durations);
      return { t, s: s > 0 ? s : median };
    })
    .sort((a, b) => b.s - a.s || (keyOf(a.t) < keyOf(b.t) ? -1 : 1));
  const shards = Array.from({ length: count }, () => ({
    tests: [],
    seconds: 0,
  }));
  for (const { t, s } of costed) {
    let best = 0;
    for (let i = 1; i < count; i++)
      if (shards[i].seconds < shards[best].seconds) best = i;
    shards[best].tests.push(t);
    shards[best].seconds += s;
  }
  return shards;
}

export const isTiming = (t) => TIMING_SPECS.includes(t.file);

/** Every test in the suite, from Playwright's own list. */
function listTests() {
  const out = execFileSync(
    "npx",
    [
      "playwright",
      "test",
      "--config",
      "tests/visual/playwright.config.ts",
      "--list",
      "--reporter=json",
    ],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const report = JSON.parse(out.slice(out.indexOf("{")));
  return testsIn(report);
}

const readDurations = () => {
  try {
    return JSON.parse(readFileSync(DURATIONS, "utf8"));
  } catch {
    return {};
  }
};

/** Every test in a Playwright JSON report (file suites, then describes). */
export function testsIn(report) {
  const tests = [];
  const walk = (suite, describes) => {
    for (const spec of suite.specs ?? [])
      tests.push({ file: spec.file, describes, title: spec.title, spec });
    for (const child of suite.suites ?? [])
      walk(child, [...describes, child.title]);
  };
  for (const file of report.suites ?? []) walk(file, []);
  return tests;
}

/** Durations from a Playwright JSON report: the passing attempt of each test. */
export function durationsFromReport(report) {
  const out = {};
  for (const t of testsIn(report)) {
    const results = t.spec.tests.flatMap((x) => x.results ?? []);
    const pass = results.find((r) => r.status === "passed") ?? results.at(-1);
    if (pass) out[keyOf(t)] = Math.round(pass.duration / 100) / 10;
  }
  return Object.fromEntries(
    Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)),
  );
}

function main(args) {
  if (args[0] === "--update") {
    const report = JSON.parse(readFileSync(args[1], "utf8"));
    const fresh = durationsFromReport(report);
    writeFileSync(DURATIONS, JSON.stringify(fresh, null, 2) + "\n");
    console.log(
      `Wrote ${Object.keys(fresh).length} durations to tests/visual/durations.json`,
    );
    return;
  }
  const tests = listTests();
  const durations = readDurations();
  const timing = tests.filter(isTiming);
  const rest = tests.filter((t) => !isTiming(t));
  if (args[0] === "--plan") {
    const count = Number(args[1]);
    const minutes = (s) => (s / 60).toFixed(1);
    const timingSeconds = timing.reduce(
      (sum, t) => sum + (secondsOf(t, durations) ?? 0),
      0,
    );
    console.log(
      `timing: ${timing.length} tests, ${minutes(timingSeconds)} min on 1 worker`,
    );
    balance(rest, durations, count).forEach((s, i) =>
      console.log(
        `${i + 1} of ${count}: ${s.tests.length} tests, ${minutes(s.seconds)} min of tests, about ${minutes(s.seconds / BALANCED_WORKERS)} min on ${BALANCED_WORKERS} workers`,
      ),
    );
    return;
  }
  let chosen;
  if (args[0] === "timing") chosen = timing;
  else {
    const index = Number(args[0]),
      count = Number(args[1]);
    if (!(count >= 1 && index >= 1 && index <= count))
      throw new Error(
        "Usage: visual-shards.mjs <index> <count> | timing | --plan <count>",
      );
    chosen = balance(rest, durations, count)[index - 1].tests;
  }
  if (!chosen.length) throw new Error("This shard has no tests.");
  process.stdout.write(grepFor(chosen));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  main(process.argv.slice(2));
