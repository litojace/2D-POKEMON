import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";

// Migration 066: players change their own name, once every 14 days.
let db: PGlite;
const ana = "00000000-0000-4000-8000-000000000001";
const ben = "00000000-0000-4000-8000-000000000002";
async function as(id: string) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
}
async function change(id: string, name: string) {
  await as(id);
  return (
    await db.query<{ v: { displayName: string; nextAt: string } }>(
      "select public.arena_change_name($1) as v",
      [name],
    )
  ).rows[0].v;
}
async function status(id: string) {
  await as(id);
  return (
    await db.query<{ v: { changedAt: string | null; nextAt: string | null; days: number } }>(
      "select public.arena_name_status() as v",
    )
  ).rows[0].v;
}
async function nameOf(id: string) {
  await db.exec("reset role");
  return (
    await db.query<{ display_name: string }>(
      "select display_name from public.arena_profiles where id=$1",
      [id],
    )
  ).rows[0].display_name;
}
/** Move a player's last change back in time. */
async function age(id: string, days: number) {
  await db.exec("reset role");
  await db.query(
    `update public.arena_profiles set name_changed_at = now() - make_interval(days => $2) where id=$1`,
    [id, days],
  );
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
    "066_display_name_changes.sql",
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

it("lets you change your name the first time at once, cleaned", async () => {
  expect(await status(ana)).toMatchObject({ changedAt: null, nextAt: null, days: 14 });
  const reply = await change(ana, "  Ana   the  Bold ");
  expect(reply.displayName).toBe("Ana the Bold");
  expect(await nameOf(ana)).toBe("Ana the Bold");
  // arena_me (the account every API answer is built on) shows the new name.
  await as(ana);
  const me = await db.query<{ v: { displayName: string } }>("select public.arena_me() as v");
  expect(me.rows[0].v.displayName).toBe("Ana the Bold");
  const s = await status(ana);
  expect(Date.parse(s.nextAt!) - Date.parse(s.changedAt!)).toBe(14 * 86_400_000);
});

it("refuses another change for 14 days, then allows it", async () => {
  await expect(change(ana, "Ana Again")).rejects.toThrow(/You can change your name again on .+ UTC\./);
  expect(await nameOf(ana)).toBe("Ana the Bold");
  await age(ana, 13);
  await expect(change(ana, "Ana Again")).rejects.toThrow(/again on/);
  await age(ana, 14);
  expect((await change(ana, "Ana Again")).displayName).toBe("Ana Again");
});

it("checks the name itself", async () => {
  for (const [name, reason] of [
    ["", /1 to 20/],
    ["   ", /1 to 20/],
    ["A".repeat(21), /1 to 20/],
    ["Ben\u200bny", /can't be shown/],
    ["Ben\nny", /can't be shown/],
    ["!!! ...", /letter or number/],
    ["Ben", /already your name/],
  ] as const)
    await expect(change(ben, name)).rejects.toThrow(reason);
  // None of them used the change.
  expect((await status(ben)).changedAt).toBeNull();
  expect((await change(ben, "Bénédicte")).displayName).toBe("Bénédicte");
});

it("doesn't count an admin's rename, and refuses the suspended and the logged out", async () => {
  await db.exec("reset role");
  await db.query("update public.arena_profiles set display_name='Benny', suspended=true where id=$1", [ben]);
  await expect(change(ben, "Benji")).rejects.toThrow(/Login required/);
  await db.exec("reset role");
  await db.query("update public.arena_profiles set suspended=false where id=$1", [ben]);
  await db.exec(`reset role;select set_config('request.jwt.claim.sub','',false);set role authenticated;`);
  await expect(db.query("select public.arena_change_name('Nobody')")).rejects.toThrow(/Login required/);
});

it("keeps the function private to logged-in players", async () => {
  await db.exec("reset role;set role anon");
  await expect(db.query("select public.arena_change_name('X')")).rejects.toThrow();
  await expect(db.query("select public.arena_name_status()")).rejects.toThrow();
});
