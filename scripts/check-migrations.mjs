// Runs every migration in supabase/migrations, in order, on an empty
// database in memory (PGlite, the same setup as tests/integration), then the
// pending ones a second time: each must say "Safe to run again". The
// automatic production migration (.github/workflows/migrate.yml) runs this
// first, so SQL that doesn't run never reaches the real database.
//
//   node scripts/check-migrations.mjs [pending files...]
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";

const DIR = "supabase/migrations";
const again = process.argv.slice(2).map((f) => f.replace(/^.*\//, ""));
const files = (await readdir(DIR)).filter((f) => f.endsWith(".sql")).sort();
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
);
const run = async (f, label) => {
  const t0 = Date.now();
  try {
    await db.exec(await readFile(`${DIR}/${f}`, "utf8"));
  } catch (e) {
    console.error(`✗ ${label}${f}: ${e.message}`);
    process.exit(1);
  }
  return Date.now() - t0;
};
let ms = 0;
for (const f of files) ms += await run(f, "");
console.log(`✓ ${files.length} migrations ran on an empty database (${ms} ms)`);
for (const f of again) {
  if (!files.includes(f)) {
    console.error(`✗ No such migration: ${f}`);
    process.exit(1);
  }
  await run(f, "again: ");
  console.log(`✓ ${f} runs again safely`);
}
await db.close();
