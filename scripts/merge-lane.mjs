// Which lane a branch takes to main (CLAUDE.md, "Merging to main"):
//
//   FAST: merge once the PR's `verify` job is green and the visual specs the
//         change touches pass locally; main's own full run (all 30 visual
//         shards, never cancelled) checks it after the merge.
//   FULL: wait for the PR's whole run (verify and all 30 visual shards).
//
// FULL is for what can't be taken back or reaches everything: a migration
// (it runs on the production database at the merge), the build and test
// machinery, the shared UI, and the battle (what older phones lag on).
//
//   node scripts/merge-lane.mjs [base]     (base: origin/main)
//
// In CI (.github/workflows/ci.yml, the `lane` job) it also writes
// `lane=FAST` or `lane=FULL` to $GITHUB_OUTPUT: a FAST pull request runs
// verify only, and the 30 visual shards are left to main's scheduled full
// run (the shards of a PR that merges on verify only spent runners for
// nothing, and main's own runs starved). It writes `specs=...` too, the
// visual specs the branch changes: a FAST pull request runs those on one
// runner (the `visual-touched` job), so a new or changed visual test meets
// CI's slow renderer before main does (#382 merged a jump test that only
// main's full run found unsteady; #384 and #385 then fixed it).
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** More files than this is too much to check by hand: FULL. */
export const MAX_FAST_FILES = 25;

/** Paths that need the full run, and why. First match names the reason. */
export const FULL_RULES = [
  [
    /^supabase\/migrations\//,
    "a migration runs on the production database at the merge",
  ],
  [/(^|\/)package(-lock)?\.json$/, "dependencies change"],
  [/^\.github\//, "CI or the production workflows change"],
  [
    /^render\.yaml$|(^|\/)capacitor\.config\.ts$|^apps\/client\/ios\//,
    "the deploy or the app build changes",
  ],
  [
    /(^|\/)vite\.config\.ts$|(^|\/)tsconfig[^/]*\.json$|^vitest\.config\.ts$/,
    "the build or the test runner changes",
  ],
  [
    /^tests\/visual\/(harness\/|[^/]*\.config\.ts$|helpers\.ts$|ui-checks\.ts$|ui-measure\.ts$)/,
    "the visual tests' shared harness changes",
  ],
  [
    /^scripts\/(check-migrations|migrate-production|visual-shards|verify-pwa|full-run-due)\.mjs$/,
    "a script CI or production runs changes",
  ],
  [
    /^apps\/client\/src\/(ui\/|style\.css$|main\.ts$|menu-shell\.ts$|overlay\.ts$|dialog\.ts$)/,
    "the shared UI changes (every screen uses it)",
  ],
  [
    /^apps\/client\/src\/(fx-|skill-|battle-|arena-|boss-|raid-|spire-battle|spire-court|stadium|graphics-|render-|renderer-|phaser-|networking\/|predict-|cast-prediction|follow-camera|touch-controls|controls|mobile-input|hud-dom|frame-cap|game-feel|champion-|creature-|fighter-art|fighter-prepaint|animation\/|art\/|[^/]*-rig\.ts$|[^/]*attack-fx\.ts$|[^/]*-controls\.ts$)/,
    "the battle changes (frame rate on older phones)",
  ],
  [
    /^apps\/server\/src\/(simulation|server|tick-clock|bot|bot-lookahead|projectile-collision|raid|matchmaking|party|drain|spire)/,
    "the game server's battle or rooms change",
  ],
  [
    /^packages\/shared\/src\/(index|connection|snapshot-meta|projectile-collision|units|raid|spire)/,
    "the game's shared rules or wire format change",
  ],
];

/** Changes no check reads (CI skips them too). */
const docsOnly = (f) => /^docs\//.test(f) || /\.md$/i.test(f);

/**
 * The website's images, video loops and fonts (apps/site, a static page
 * apart from the game): nothing in the game, its build or its tests reads
 * them, and a page refresh adds dozens at once (the skin loops, 90 of
 * them), so they don't count toward MAX_FAST_FILES. The site's HTML, CSS
 * and tools still do.
 */
const siteAsset = (f) =>
  /^apps\/site\/(.*\.(webp|avif|png|jpe?g|svg|ico|mp4)|fonts\/.*)$/i.test(f);

/**
 * The lane for these changed files: FAST, or FULL with every reason found
 * (one line per rule, naming the first file that matched it).
 */
export function mergeLane(files) {
  const changed = files.map((f) => f.trim()).filter(Boolean);
  const checked = changed.filter((f) => !docsOnly(f));
  const reasons = [];
  for (const [rule, why] of FULL_RULES) {
    const hit = checked.find((f) => rule.test(f));
    if (hit) reasons.push(`${why} (${hit})`);
  }
  const counted = checked.filter((f) => !siteAsset(f));
  if (counted.length > MAX_FAST_FILES)
    reasons.push(
      `${counted.length} files change (more than ${MAX_FAST_FILES} to check by hand)`,
    );
  return {
    lane: reasons.length ? "FULL" : "FAST",
    reasons,
    files: changed.length,
    docsOnly: changed.length > 0 && checked.length === 0,
  };
}

/**
 * The visual specs among `files` that still exist (a deleted spec has
 * nothing to run), as Playwright takes them. Only plain paths: the list goes
 * on a command line.
 */
export function touchedSpecs(files, exists = existsSync) {
  return [
    ...new Set(
      files
        .map((f) => f.trim())
        .filter((f) => /^tests\/visual\/[\w.-]+\.spec\.ts$/.test(f))
        .filter((f) => exists(f)),
    ),
  ].sort();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const base = process.argv[2] ?? "origin/main";
  const files = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], {
    encoding: "utf8",
  }).split("\n");
  const r = mergeLane(files);
  console.log(`${r.lane} lane (${r.files} files changed against ${base})`);
  if (r.docsOnly) console.log("- docs and Markdown only: CI runs nothing");
  for (const why of r.reasons) console.log(`- ${why}`);
  const specs = touchedSpecs(files);
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `lane=${r.lane}\nspecs=${specs.join(" ")}\n`,
    );
  if (r.lane === "FAST") {
    if (specs.length)
      console.log(
        `CI also runs the visual specs this changes (visual-touched): ${specs.join(", ")}`,
      );
    console.log(
      specs.length
        ? "Merge once the PR's verify and visual-touched jobs are green and the visual specs this touches pass locally; main's scheduled full run checks it after."
        : "Merge once the PR's verify job is green and the visual specs this touches pass locally; main's scheduled full run checks it after.",
    );
  } else
    console.log(
      "Wait for the PR's whole run: verify and all 30 visual shards.",
    );
}
