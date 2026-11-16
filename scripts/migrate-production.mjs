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
// The password must never reach a log: hide it in GitHub's output, and check
// the string's shape before psql sees it (psql prints the host it couldn't
// find, which for a malformed string holds part of the password).
const BAD_URL =
  "SUPABASE_DB_URL doesn't look like postgresql://USER:PASSWORD@HOST:PORT/postgres. Remove the [ ] around the password, and write any @ : / ? # [ ] % in the password as %40 %3A %2F %3F %23 %5B %5D %25 (or choose a password of letters and digits). See docs/auto-migrations.md.";
{
  const m =
    /^postgres(?:ql)?:\/\/([^:/@]+):(.*)@([^@/]+)$|^postgres(?:ql)?:\/\/([^:/@]+):(.*)@([^@/]+)\/[^@]*$/.exec(
      url,
    );
  const pass = m ? (m[2] ?? m[5]) : null;
  if (process.env.GITHUB_ACTIONS && pass) {
    console.log(`::add-mask::${pass}`);
    try {
      console.log(`::add-mask::${decodeURIComponent(pass)}`);
    } catch {}
  }
  const host = m ? (m[3] ?? m[6]) : "";
  if (!m || /[@\[\]\s]/.test(pass) || !/^[a-z0-9.-]+(:[0-9]+)?$/i.test(host)) {
    console.error(BAD_URL);
    process.exit(1);
  }
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
