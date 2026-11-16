// Applies the migrations production hasn't run yet, in file order, with
// psql. Which files have run is kept in arena_ops.migration_files on the
// database itself; the files in supabase/applied-baseline.txt (everything up
// to 16 Nov 2026, applied by hand) are recorded there without running.
//
//   SUPABASE_DB_URL=postgresql://... node scripts/migrate-production.mjs [--dry-run]
//
// SUPABASE_DB_URL is the "Session pooler" connection string from the
// Supabase dashboard (Connect). GitHub's runners have no IPv6, so the direct
// db.<ref>.supabase.co address does not work from Actions.
// Stops at the first file that fails; nothing after it runs. Migrations are
// written to be safe to run again, so a run cut off after a file ran but
// before it was recorded simply runs that file again next time.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, appendFileSync } from "node:fs";

const DIR = "supabase/migrations";
const url = process.env.SUPABASE_DB_URL;
const dry = process.argv.includes("--dry-run");
if (!url) {
  console.error(
    "SUPABASE_DB_URL is not set. Add the Session pooler connection string as a repository secret (see docs/auto-migrations.md).",
  );
  process.exit(1);
}
// Errors and warnings only, not every "already exists, skipping" (set in
// the session: the pooler may not pass connection options through).
const QUIET = "set client_min_messages = warning;";
const psql = (args, input) =>
  execFileSync(
    "psql",
    [
      url,
      "-X",
      "-q",
      "-v",
      "ON_ERROR_STOP=1",
      "--no-psqlrc",
      "-c",
      QUIET,
      ...args,
    ],
    { encoding: "utf8", input, stdio: ["pipe", "pipe", "inherit"] },
  );
// psql runs -c and -f in order on one connection; stdin only without -c.
const psqlIn = (args, input) => psql([...args, "-f", "-"], input);
const sqlText = (s) => `'${s.replace(/'/g, "''")}'`;
const summary = (line) => {
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + "\n");
};

const files = readdirSync(DIR)
  .filter((f) => /^[0-9]+[a-z]?_[a-z0-9_]+\.sql$/.test(f))
  .sort();
const baseline = readFileSync("supabase/applied-baseline.txt", "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));
for (const f of baseline)
  if (!files.includes(f)) {
    console.error(`Baseline lists ${f}, which is not in ${DIR}.`);
    process.exit(1);
  }

// The record of what ran (kept away from the API's roles).
if (!dry)
  psqlIn(
    [],
    `create schema if not exists arena_ops;
     revoke all on schema arena_ops from public, anon, authenticated;
     create table if not exists arena_ops.migration_files (
       file text primary key,
       applied_at timestamptz not null default now(),
       how text not null check (how in ('baseline', 'auto'))
     );
     revoke all on arena_ops.migration_files from public, anon, authenticated;
     insert into arena_ops.migration_files(file, how)
     select f, 'baseline' from unnest(array[${baseline.map(sqlText).join(",")}]::text[]) f
     on conflict (file) do nothing;`,
  );
const exists = psql([
  "-tA",
  "-c",
  "select to_regclass('arena_ops.migration_files') is not null;",
]).trim();
const applied = new Set(
  exists === "t"
    ? psql(["-tA", "-c", "select file from arena_ops.migration_files;"])
        .split("\n")
        .filter(Boolean)
    : baseline,
);
const pending = files.filter((f) => !applied.has(f));
if (!pending.length) {
  summary("Production is up to date: no migrations to run.");
  process.exit(0);
}
summary(
  `${dry ? "Would run" : "Running"} ${pending.length} migration(s): ${pending.join(", ")}`,
);
if (dry) process.exit(0);
for (const f of pending) {
  const t0 = Date.now();
  try {
    psql(["-f", `${DIR}/${f}`]);
  } catch {
    summary(`✗ ${f} failed. Nothing after it ran. Fix it in a new commit.`);
    process.exit(1);
  }
  psqlIn(
    [],
    `insert into arena_ops.migration_files(file, how) values (${sqlText(f)}, 'auto')
     on conflict (file) do update set applied_at = now(), how = 'auto';`,
  );
  summary(`✓ ${f} (${Date.now() - t0} ms)`);
}
