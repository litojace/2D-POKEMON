import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
const admin = "00000000-0000-4000-8000-000000000001",
  player = "00000000-0000-4000-8000-000000000002",
  other = "00000000-0000-4000-8000-000000000003";
async function asUser(id: string) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;insert into auth.users values('${admin}','{"display_name":"Admin"}'),('${player}','{"display_name":"Player","isAdmin":true}'),('${other}','{"display_name":"Other"}');`,
  );
  await db.exec(
    await readFile("supabase/migrations/001_arena_accounts.sql", "utf8"),
  );
  await db.exec(`insert into public.arena_admins values('${admin}');`);
  for (const id of [admin, player, other]) {
    await asUser(id);
    await db.query("select public.arena_me()");
  }
}, 20000);
afterAll(async () => {
  await db.close();
});
it("ignores signup role metadata and prevents direct privilege changes", async () => {
  await asUser(player);
  const context = await db.query<{ value: { isAdmin: boolean } }>(
    "select public.arena_me() as value",
  );
  expect(context.rows[0].value.isAdmin).toBe(false);
  await expect(
    db.query(`insert into public.arena_admins values('${player}')`),
  ).rejects.toThrow();
  await expect(
    db.query(
      `update public.arena_profiles set suspended=false where id='${player}'`,
    ),
  ).rejects.toThrow();
  await expect(db.query("select public.arena_admin_players()")).rejects.toThrow(
    "Admin",
  );
  await db.exec(`reset role;set role anon;`);
  await expect(db.query("select public.arena_me()")).rejects.toThrow();
});
it("creates, grants, equips, retires and revokes titles with ownership enforced", async () => {
  await asUser(admin);
  const created = await db.query<{ id: string }>(
    "select public.arena_admin_save_title(null,'Champion','Arena winner','#d5f778',true) as id",
  );
  const id = created.rows[0].id;
  await db.query("select public.arena_admin_grant_title($1,$2,true)", [
    player,
    id,
  ]);
  await asUser(other);
  await expect(
    db.query("select public.arena_equip_title($1)", [id]),
  ).rejects.toThrow("own");
  await asUser(player);
  await db.query("select public.arena_equip_title($1)", [id]);
  const ctx = await db.query<{ value: { title: string } }>(
    "select public.arena_me() as value",
  );
  expect(ctx.rows[0].value.title).toBe("Champion");
  await asUser(admin);
  await db.query(
    "select public.arena_admin_save_title($1,'Champion','Arena winner','#d5f778',false)",
    [id],
  );
  await asUser(player);
  const retired = await db.query<{ value: { title: string | null } }>(
    "select public.arena_me() as value",
  );
  expect(retired.rows[0].value.title).toBeNull();
  await expect(
    db.query("select public.arena_equip_title($1)", [id]),
  ).rejects.toThrow();
  await asUser(admin);
  await db.query("select public.arena_admin_grant_title($1,$2,false)", [
    player,
    id,
  ]);
  await asUser(player);
  await expect(
    db.query("select public.arena_equip_title($1)", [id]),
  ).rejects.toThrow();
});
it("audits player management and prevents administrator self-suspension", async () => {
  await asUser(admin);
  await db.query("select public.arena_admin_update_player($1,$2,true)", [
    player,
    "Renamed",
  ]);
  await expect(
    db.query("select public.arena_admin_update_player($1,$2,true)", [
      admin,
      "Admin",
    ]),
  ).rejects.toThrow("Administrator");
  await asUser(player);
  const ctx = await db.query<{
    value: { suspended: boolean; displayName: string };
  }>("select public.arena_me() as value");
  expect(ctx.rows[0].value.suspended).toBe(true);
  expect(ctx.rows[0].value.displayName).toBe("Renamed");
  await expect(
    db.query("select public.arena_equip_title(null)"),
  ).rejects.toThrow();
  await asUser(admin);
  await db.query("select public.arena_admin_update_player($1,$2,false)", [
    player,
    "Player",
  ]);
  await db.exec("reset role");
  const audit = await db.query<{ count: number }>(
    "select count(*)::int count from public.arena_admin_audit",
  );
  expect(audit.rows[0].count).toBeGreaterThan(3);
});
