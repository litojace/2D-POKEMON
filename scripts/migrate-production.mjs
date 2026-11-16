// Applies the migrations production hasn't run yet, in file order. Which
// files have run is kept in arena_ops.migration_files on the database
// itself; the files in supabase/applied-baseline.txt (everything up to
// 16 Nov 2026, applied by hand) are recorded there without running.
//
//   SUPABASE_DB_URL=postgresql://... node scripts/migrate-production.mjs [flags]
//     --dry-run        only list what would run
//     --verify         first run every migration on an empty database, and the
//                      pending ones twice (scripts/check-migrations.mjs)
//     --if-configured  do nothing (and succeed) when SUPABASE_DB_URL is unset
//
// Two places run it (docs/auto-migrations.md): Render's pre-deploy command
// for the game server (before the new server goes live; a failure stops the
// deploy and the old server keeps running), and GitHub Actions on a push to
// main, as a fallback. A database lock keeps them from running at once, and
// whichever comes second finds nothing to do.
//
// SUPABASE_DB_URL is the "Session pooler" connection string from the
// Supabase dashboard (Connect): it works from IPv4-only machines.
// Stops at the first file that fails; nothing after it runs. Migrations are
// written to be safe to run again, so a run cut off after a file ran but
// before it was recorded simply runs that file again next time.
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, readdirSync } from "node:fs";
import pg from "pg";

const DIR = "supabase/migrations";
const url = process.env.SUPABASE_DB_URL;
const flag = (f) => process.argv.includes(f);
const dry = flag("--dry-run");
const summary = (line) => {
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + "\n");
};
if (!url) {
  if (flag("--if-configured")) {
    summary(
      "SUPABASE_DB_URL is not set here: no migrations run from this place.",
    );
    process.exit(0);
  }
  console.error(
    "SUPABASE_DB_URL is not set. Add the Session pooler connection string (see docs/auto-migrations.md).",
  );
  process.exit(1);
}
// The password must never reach a log: hide it in GitHub's output, and check
// the string's shape before connecting (an error naming the host of a
// malformed string would print part of the password).
const BAD_URL =
  "SUPABASE_DB_URL doesn't look like postgresql://USER:PASSWORD@HOST:PORT/postgres. Remove the [ ] around the password, and write any @ : / ? # [ ] % in the password as %40 %3A %2F %3F %23 %5B %5D %25 (or choose a password of letters and digits). See docs/auto-migrations.md.";
const m =
  /^postgres(?:ql)?:\/\/([^:/@]+):(.*)@([^@/?]+)(\/[^@]*)?$/.exec(url) ?? null;
const pass = m?.[2] ?? null;
if (process.env.GITHUB_ACTIONS && pass) {
  console.log(`::add-mask::${pass}`);
  try {
    console.log(`::add-mask::${decodeURIComponent(pass)}`);
  } catch {}
}
const host = m?.[3] ?? "";
if (!m || /[@\[\]\s]/.test(pass) || !/^[a-z0-9.-]+(:[0-9]+)?$/i.test(host)) {
  console.error(BAD_URL);
  process.exit(1);
}
const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);

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

const db = new pg.Client({
  connectionString: url.replace(/[?&]sslmode=[^&]*/, ""),
  // Supabase takes TLS; its pooler's certificate isn't in Node's store.
  ssl: local ? false : { rejectUnauthorized: false },
  application_name: "arena-migrations",
});
db.on("notice", () => {}); // "already exists, skipping" and the like
try {
  await db.connect();
} catch (e) {
  console.error(`Couldn't connect to the database (${e.code ?? "error"}).`);
  process.exit(1);
}
const q = (sql, params) => db.query(sql, params);
let code = 0;
try {
  // One run at a time (Render and GitHub may both start one).
  await q("select pg_advisory_lock(hashtext('arena-migrations'))");
  if (!dry) {
    await q(`
      create schema if not exists arena_ops;
      revoke all on schema arena_ops from public, anon, authenticated;
      create table if not exists arena_ops.migration_files (
        file text primary key,
        applied_at timestamptz not null default now(),
        how text not null check (how in ('baseline', 'auto'))
      );
      revoke all on arena_ops.migration_files from public, anon, authenticated;`);
    await q(
      `insert into arena_ops.migration_files(file, how)
       select f, 'baseline' from unnest($1::text[]) f on conflict (file) do nothing`,
      [baseline],
    );
  }
  const table = (
    await q("select to_regclass('arena_ops.migration_files') is not null as t")
  ).rows[0].t;
  const applied = new Set(
    table
      ? (await q("select file from arena_ops.migration_files")).rows.map(
          (r) => r.file,
        )
      : baseline,
  );
  const pending = files.filter((f) => !applied.has(f));
  if (!pending.length)
    summary("Production is up to date: no migrations to run.");
  else {
    summary(
      `${dry ? "Would run" : "Running"} ${pending.length} migration(s): ${pending.join(", ")}`,
    );
    if (flag("--verify") && !dry)
      execFileSync("node", ["scripts/check-migrations.mjs", ...pending], {
        stdio: "inherit",
      });
    if (!dry)
      for (const f of pending) {
        const sql = readFileSync(`${DIR}/${f}`, "utf8"),
          t0 = Date.now();
        try {
          await q(sql);
        } catch (e) {
          // Leave no half-open transaction behind.
          await q("rollback").catch(() => {});
          const line = e.position
            ? ` (line ${sql.slice(0, Number(e.position)).split("\n").length})`
            : "";
          summary(`✗ ${f}${line}: ${e.message}`);
          summary("Nothing after it ran. Fix it in a new commit.");
          code = 1;
          break;
        }
        await q(
          `insert into arena_ops.migration_files(file, how) values ($1, 'auto')
           on conflict (file) do update set applied_at = now(), how = 'auto'`,
          [f],
        );
        summary(`✓ ${f} (${Date.now() - t0} ms)`);
      }
  }
} catch (e) {
  if (e.status !== undefined)
    code = e.status || 1; // --verify failed
  else {
    console.error(`Migrations stopped: ${e.message}`);
    code = 1;
  }
} finally {
  await db.end().catch(() => {});
}
process.exit(code);
