import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";

// Migration 108: the fighter you last picked, kept with your account.
let db: PGlite;
const ana = "00000000-0000-4000-8000-000000000001";
const ben = "00000000-0000-4000-8000-000000000002";
async function as(id: string | null) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id ?? ""}',false);set role authenticated;`,
  );
}
async function saved(id: string) {
  await as(id);
  return (
    await db.query<{ v: string | null }>(
      "select public.arena_saved_fighter() as v",
    )
  ).rows[0].v;
}
async function save(id: string | null, fighter: string) {
  await as(id);
  await db.query("select public.arena_save_fighter($1)", [fighter]);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;insert into auth.users values ('${ana}','{"display_name":"Ana"}'),('${ben}','{"display_name":"Ben"}');`,
  );
  for (const m of [
    "001_arena_accounts.sql",
    "002_admin_cleanup_reports.sql",
    "003_titles.sql",
    "004_matches_achievements.sql",
    "005_friends.sql",
    "108_selected_fighter.sql",
  ])
    await db.exec(await readFile(`supabase/migrations/${m}`, "utf8"));
  for (const id of [ana, ben]) {
    await as(id);
    await db.query("select public.arena_me()");
  }
}, 30000);
afterAll(async () => {
  await db.close();
});

it("has nothing saved until you pick, then keeps your latest pick", async () => {
  expect(await saved(ana)).toBeNull();
  await save(ana, "tidefin");
  expect(await saved(ana)).toBe("tidefin");
  await save(ana, "mossloth");
  expect(await saved(ana)).toBe("mossloth");
});

it("keeps each player's own pick", async () => {
  expect(await saved(ben)).toBeNull();
  await save(ben, "cindrake");
  expect(await saved(ben)).toBe("cindrake");
  expect(await saved(ana)).toBe("mossloth");
});

it("refuses something that is not a fighter id, and a signed-out caller", async () => {
  for (const bad of [
    "",
    "Voltkit",
    "volt kit",
    "x",
    "a".repeat(25),
    "'; drop table x; --",
  ])
    await expect(save(ana, bad)).rejects.toThrow(/not a fighter/);
  expect(await saved(ana)).toBe("mossloth");
  await expect(save(null, "voltkit")).rejects.toThrow(/Login required/);
});

it("can't be read or written around the functions", async () => {
  await as(ana);
  await expect(
    db.query("select * from public.arena_preferences"),
  ).rejects.toThrow(/permission denied/);
  await expect(
    db.query("update public.arena_preferences set fighter='voltkit'"),
  ).rejects.toThrow(/permission denied/);
});
