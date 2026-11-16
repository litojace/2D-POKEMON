# Automatic production migrations

Since 16 Nov 2026, a push to `main` that adds or changes a file in
`supabase/migrations/` runs, on the production Supabase database, every
migration it hasn't run yet. Render deploys the same push, so the database
and the server change within a few minutes of each other.

## How it works

`.github/workflows/migrate.yml`:

1. Lists what production hasn't run (`scripts/migrate-production.mjs --dry-run`).
2. Runs every migration in order on an empty database in memory, then the
   pending ones a second time (`scripts/check-migrations.mjs`, PGlite, the same
   setup as `tests/integration`). SQL that fails, or that can't run twice,
   stops here and never reaches production.
3. Applies the pending files to production with `psql`, one by one, in file
   name order (`scripts/migrate-production.mjs`). It stops at the first file
   that fails: nothing after it runs, and the failed file isn't recorded, so
   the next run tries it again.

What has run is recorded on the database itself, in
`arena_ops.migration_files` (out of the API's reach). The files in
`supabase/applied-baseline.txt` were applied by hand before this existed
(checked against the database on 16 Nov 2026); they are recorded without
running.

Runs never overlap and are never cancelled half way. Each run writes what it
did in the run's summary on GitHub (Actions → Production migrations).

## Set up (once)

1. Supabase dashboard → project **2D-POKEMON** → **Connect** → **Session
   pooler** → copy the URI. Replace `[YOUR-PASSWORD]` with the database
   password (Project Settings → Database → Reset database password if it is
   lost; the game server does not use it, it uses the API keys). Use the
   **Session pooler** address, not the direct `db.<ref>.supabase.co` one:
   GitHub's runners have no IPv6. Remove the `[ ]` around the password. A
   password with `@ : / ? # [ ] %` must have them written as `%40 %3A %2F
%3F %23 %5B %5D %25`; simplest is a password of letters and digits only.
2. GitHub → repository → **Settings → Secrets and variables → Actions → New
   repository secret**: name `SUPABASE_DB_URL`, value the URI.
3. Optional: **Settings → Environments → production → Required reviewers**:
   each run then waits for your approval before it touches the database.
4. Check it: **Actions → Production migrations → Run workflow** with "Only list
   what would run" ticked. It should say production is up to date.

Until the secret exists, the workflow fails at its first step and changes
nothing.

## Rules for migrations

- Name: `YYYYMMDDHHMMSS_name.sql` (lowercase letters, digits, `_`), after the
  newest file. Files run in name order.
- Safe to run again: `create … if not exists`, `create or replace`,
  `on conflict`, renames guarded with `to_regprocedure` / `to_regclass` (see
  `20261116120000_farm_free_decor.sql`). The check runs each new file twice.
- Wrap changes in `begin; … commit;` so a failure leaves nothing half done.
- Don't edit a migration that already ran: add a new one. A changed file
  doesn't run again (the record is by file name).
- Applying a migration by hand (SQL editor, the Supabase MCP) is still
  possible; the workflow then runs it once more, which is harmless when it is
  safe to run again.
- A migration that the new server or client needs must reach `main` together
  with that code, in the same push.

## Run it by hand

```bash
SUPABASE_DB_URL='postgresql://…' node scripts/migrate-production.mjs --dry-run
```

```bash
node scripts/check-migrations.mjs
```
