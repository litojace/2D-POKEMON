# Automatic production migrations

Since 16 Nov 2026, a push to `main` that adds or changes a file in
`supabase/migrations/` runs, on the production Supabase database, every
migration it hasn't run yet. Render deploys the same push, so the database
and the server change within a few minutes of each other.

## How it works

`scripts/migrate-production.mjs` runs the migrations production hasn't run
yet, in file name order. It stops at the first file that fails: nothing after
it runs, and the failed file isn't recorded, so the next run tries it again.
With `--verify` it first runs every migration on an empty database in memory,
and the pending ones twice (`scripts/check-migrations.mjs`, PGlite, the same
setup as `tests/integration`), so SQL that fails, or can't run twice, never
reaches production.

Two places run it on each push to `main`:

1. **Render, before the new game server goes live**, as the web service's
   pre-deploy command (below). It doesn't wait for GitHub's runners, and the new server
   never starts on a database that lacks its migration: if a migration fails,
   Render stops the deploy and the old server keeps running.
2. **GitHub Actions** (`.github/workflows/migrate.yml`), as a fallback and for
   checking by hand. Its job can wait a while when CI fills GitHub's runners.

A database lock keeps the two from running at once; whichever comes second
finds nothing to do.

What has run is recorded on the database itself, in
`arena_ops.migration_files` (out of the API's reach). The files in
`supabase/applied-baseline.txt` were applied by hand before this existed
(checked against the database on 16 Nov 2026); they are recorded without
running.

## Set up (once)

1. Supabase dashboard → project **2D-POKEMON** → **Connect** → **Session
   pooler** → copy the URI. Replace `[YOUR-PASSWORD]` with the database
   password (Project Settings → Database → Reset database password if it is
   lost; the game server does not use it, it uses the API keys). Use the
   **Session pooler** address, not the direct `db.<ref>.supabase.co` one: it
   works from machines without IPv6. Remove the `[ ]` around the password.
   In the password, write `@` as `%40`, `:` as `%3A`, `/` as `%2F`, `?` as
   `%3F`, `#` as `%23`, `[` as `%5B`, `]` as `%5D` and `%` as `%25`; simplest
   is a password of letters and digits only.
2. **GitHub** → repository → **Settings → Secrets and variables → Actions →
   New repository secret**: name `SUPABASE_DB_URL`, value the URI.
3. **Render** → service **element-arena** (the game server, not the static
   site):
   - **Environment** → add `SUPABASE_DB_URL` with the same URI.
   - **Settings → Build & Deploy → Pre-Deploy Command**:
     `node scripts/migrate-production.mjs --verify --if-configured`
4. Optional: GitHub **Settings → Environments → production → Required
   reviewers**: the GitHub run then waits for your approval (Render's doesn't).
5. Check it: GitHub **Actions → Production migrations → Run workflow** with
   "Only list what would run" ticked. It should say production is up to date.

Without the Render settings, migrations still run from GitHub, only later
when CI is busy.

## Rules for migrations

- Name: `YYYYMMDDHHMMSS_name.sql` (lowercase letters, digits, `_`), after the
  newest file. Files run in name order.
- Safe to run again: `create … if not exists`, `create or replace`,
  `on conflict`, renames guarded with `to_regprocedure` / `to_regclass` (see
  `028_retire_raid_modes.sql`). The check runs each new file twice.
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
