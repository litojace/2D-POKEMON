// Splits the visual suite into CI shards of about equal running time.
//
// Playwright's own --shard cuts the test list into runs of equal test count,
// so a shard that draws the slow tests (raid fights, panel sweeps) sets the
// pace for the whole check. This script reads how long each test took on CI
// (tests/visual/durations.json), deals the tests out longest first, each to
// the shard with the least time so far (LPT), and writes this shard's tests
// to a file for `playwright test --test-list`.
//
// Every runner computes the same plan on its own: same commit, same test
// list, same durations file, and ties broken by name. A test missing from the
// durations file (a new one) counts as the median test.
//
//   node scripts/visual-shards.mjs <shard> <total> <out-file>   this shard's list
//   node scripts/visual-shards.mjs --plan <total>                 every shard's estimate
//
// Fresh durations come from scripts/visual-durations-reporter.mjs, which CI's
// visual-report job runs over the merged blobs and uploads as the
// visual-durations artifact: commit it over tests/visual/durations.json.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const CONFIG = "tests/visual/playwright.config.ts";
export const DURATIONS = "tests/visual/durations.json";

/** "file.spec.ts › describe › title", the form --test-list reads. */
export const testKey = (file, titles) => [file, ...titles].join(" › ");

/** Every test in a Playwright JSON report (from --list or a real run). */
export function collectTests(report) {
  const out = [];
  const walk = (suite, path) => {
    for (const spec of suite.specs ?? []) {
      out.push({
        file: spec.file,
        titles: [...path, spec.title],
        tests: spec.tests ?? [],
      });
    }
    for (const child of suite.suites ?? []) walk(child, [...path, child.title]);
  };
  // A file's top suite is titled with the file name: not part of the path.
  for (const file of report.suites ?? []) walk(file, []);
  return out;
}

/** A title --test-list can't match: it splits lines on "›" (or ">") and trims. */
export function unlistable(titles) {
  return titles.some((t) => /[›>]/.test(t) || t !== t.trim() || t === "");
}

function median(values) {
  if (!values.length) return 30;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Deal keys into `total` shards, longest first, each to the lightest shard.
 * Returns [{ keys, seconds }] in shard order (shard 1 first).
 */
export function planShards(keys, durations, total) {
  if (!Number.isInteger(total) || total < 1)
    throw new Error(`bad shard total: ${total}`);
  const fallback = median(
    keys.map((k) => durations[k]).filter((v) => typeof v === "number"),
  );
  const cost = (k) =>
    typeof durations[k] === "number" ? durations[k] : fallback;
  const order = [...keys].sort(
    (a, b) => cost(b) - cost(a) || (a < b ? -1 : a > b ? 1 : 0),
  );
  const shards = Array.from({ length: total }, () => ({
    keys: [],
    seconds: 0,
  }));
  for (const k of order) {
    let best = 0;
    for (let i = 1; i < total; i++)
      if (shards[i].seconds < shards[best].seconds) best = i;
    shards[best].keys.push(k);
    shards[best].seconds += cost(k);
  }
  return shards;
}

/** The durations key of a test from its titlePath(): ["", project, file, ...titles]. */
export const durationKey = (titlePath) =>
  testKey(titlePath[2], titlePath.slice(3));

/**
 * Note one attempt's time in seconds. A test's passing attempt wins over a
 * failed one (a retried test keeps the time of the run that passed).
 */
export function recordDuration(times, passed, key, result) {
  if (typeof result.duration !== "number") return;
  const ok = result.status === "passed";
  if (passed.has(key) && !ok) return;
  if (ok) passed.add(key);
  times[key] = Math.round(result.duration / 100) / 10;
}

export function sortedDurations(times) {
  return Object.fromEntries(
    Object.entries(times).sort(([a], [b]) => (a < b ? -1 : 1)),
  );
}

function listTests() {
  const json = execFileSync(
    "npx",
    ["playwright", "test", "--config", CONFIG, "--list", "--reporter=json"],
    {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
  const tests = collectTests(JSON.parse(json));
  const bad = tests.filter((t) => unlistable(t.titles));
  if (bad.length) {
    throw new Error(
      "These titles can't go in a --test-list file (no › or >, no outer spaces):\n" +
        bad.map((t) => "  " + testKey(t.file, t.titles)).join("\n"),
    );
  }
  return tests.map((t) => testKey(t.file, t.titles));
}

function readDurations() {
  try {
    return JSON.parse(readFileSync(DURATIONS, "utf8"));
  } catch {
    return {};
  }
}

function main(argv) {
  const durations = readDurations();
  if (argv[0] === "--plan") {
    const total = Number(argv[1]);
    const keys = listTests();
    const known = keys.filter((k) => typeof durations[k] === "number").length;
    const shards = planShards(keys, durations, total);
    shards.forEach((s, i) =>
      console.log(
        `shard ${String(i + 1).padStart(2)}: ${String(s.keys.length).padStart(3)} tests, ~${(s.seconds / 60).toFixed(1)} min`,
      ),
    );
    console.log(
      `${keys.length} tests, ${known} with a measured time; the slowest shard sets the pace.`,
    );
    return;
  }
  const [shard, total, out] = [Number(argv[0]), Number(argv[1]), argv[2]];
  if (!Number.isInteger(shard) || shard < 1 || shard > total || !out) {
    throw new Error(
      "usage: node scripts/visual-shards.mjs <shard> <total> <out-file>",
    );
  }
  const keys = listTests();
  const mine = planShards(keys, durations, total)[shard - 1];
  writeFileSync(out, mine.keys.join("\n") + "\n");
  console.error(
    `shard ${shard}/${total}: ${mine.keys.length} of ${keys.length} tests, ~${(mine.seconds / 60).toFixed(1)} min by the durations file`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
