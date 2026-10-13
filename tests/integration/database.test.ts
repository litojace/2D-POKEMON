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
  for (const migration of [
    "001_arena_accounts.sql",
    "002_admin_cleanup_reports.sql",
  ])
    await db.exec(await readFile(`supabase/migrations/${migration}`, "utf8"));
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
it("lets players report problems and admins review and resolve them", async () => {
  await asUser(other);
  const sent = await db.query<{ id: number }>(
    "select public.arena_submit_report('bug','The arena froze after a dash',$1) as id",
    [JSON.stringify({ screen: "match", room: "ABC123" })],
  );
  expect(Number(sent.rows[0].id)).toBeGreaterThan(0);
  await expect(
    db.query("select public.arena_submit_report('nope','long enough','{}')"),
  ).rejects.toThrow("report type");
  await expect(
    db.query("select public.arena_submit_report('bug','hey','{}')"),
  ).rejects.toThrow("5 to 1000");
  await expect(
    db.query("select * from public.arena_reports"),
  ).rejects.toThrow();
  await expect(db.query("select public.arena_admin_reports()")).rejects.toThrow(
    "Admin",
  );
  for (let i = 0; i < 4; i++)
    await db.query("select public.arena_submit_report('other',$1,'{}')", [
      `extra report ${i}`,
    ]);
  await expect(
    db.query("select public.arena_submit_report('other','one too many','{}')"),
  ).rejects.toThrow("Too many reports");
  await asUser(admin);
  type List = {
    value: {
      open: number;
      total: number;
      reports: { id: number; reporterName: string }[];
    };
  };
  const list = await db.query<List>(
    "select public.arena_admin_reports() as value",
  );
  expect(list.rows[0].value.open).toBe(5);
  expect(list.rows[0].value.reports[4].reporterName).toBe("Other");
  await db.query("select public.arena_admin_resolve_report($1,true)", [
    list.rows[0].value.reports[0].id,
  ]);
  const after = await db.query<List>(
    "select public.arena_admin_reports('resolved') as value",
  );
  expect(after.rows[0].value.total).toBe(1);
  expect(after.rows[0].value.open).toBe(4);
});
it("suspends with protection for admins and deletes a whole account", async () => {
  await asUser(admin);
  await db.query("select public.arena_admin_set_suspended($1,true)", [other]);
  await expect(
    db.query("select public.arena_admin_set_suspended($1,true)", [admin]),
  ).rejects.toThrow("Administrators");
  await expect(
    db.query("select public.arena_admin_delete_player($1)", [admin]),
  ).rejects.toThrow("Administrators");
  await asUser(other);
  const ctx = await db.query<{ value: { suspended: boolean } }>(
    "select public.arena_me() as value",
  );
  expect(ctx.rows[0].value.suspended).toBe(true);
  await expect(
    db.query("select public.arena_admin_delete_player($1)", [player]),
  ).rejects.toThrow("Admin");
  await asUser(admin);
  await db.query("select public.arena_admin_delete_player($1)", [other]);
  await expect(
    db.query("select public.arena_admin_delete_player($1)", [other]),
  ).rejects.toThrow("not found");
  await db.exec("reset role");
  const gone = await db.query<{
    users: number;
    profiles: number;
    reports: number;
  }>(
    `select (select count(*)::int from auth.users where id='${other}') users,
      (select count(*)::int from public.arena_profiles where id='${other}') profiles,
      (select count(*)::int from public.arena_reports where reporter_id is null) reports`,
  );
  expect(gone.rows[0]).toEqual({ users: 0, profiles: 0, reports: 5 });
});
