import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";

// Announcements and last-online in the admin list (migration
// 20261122120000).
let db: PGlite;
const nova = "00000000-0000-4000-8000-0000000033a1";
const ana = "00000000-0000-4000-8000-0000000033a2";
const admin = "00000000-0000-4000-8000-0000000033a3";
async function as(id: string) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
}
async function call<T = any>(id: string, sql: string, args: unknown[] = []) {
  await as(id);
  const r = await db.query<{ r: T }>(`select ${sql} as r`, args);
  return r.rows[0].r;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
  );
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
  await db.exec(
    `reset role;insert into auth.users values('${nova}','{"display_name":"Nova"}'),('${ana}','{"display_name":"Ana"}'),('${admin}','{"display_name":"Boss"}')`,
  );
  for (const id of [nova, ana, admin]) {
    await as(id);
    await db.query("select public.arena_me()");
  }
  await db.exec(
    `reset role;insert into public.arena_admins values('${admin}')`,
  );
}, 120000);
afterAll(async () => db.close());

it("sends an announcement every player can read until it ends", async () => {
  expect(await call(nova, "public.arena_current_announcements()")).toEqual([]);
  const sent = await call(
    admin,
    "public.arena_admin_announce($1, 'event', 24)",
    ["  Double coins this weekend!  "],
  );
  expect(sent).toMatchObject({
    message: "Double coins this weekend!",
    tone: "event",
  });
  const hours = (Date.parse(sent.endsAt) - Date.now()) / 3_600_000;
  expect(hours).toBeGreaterThan(23.9);
  const seen = await call(nova, "public.arena_current_announcements()");
  expect(seen).toHaveLength(1);
  expect(seen[0].id).toBe(sent.id);
  // The admin list says who sent it.
  const list = await call(admin, "public.arena_admin_announcements()");
  expect(list[0]).toMatchObject({ id: sent.id, by: "Boss" });
  // Ended early: players no longer get it; the admin list keeps it.
  await call(admin, "public.arena_admin_end_announcement($1)", [sent.id]);
  expect(await call(ana, "public.arena_current_announcements()")).toEqual([]);
  expect(await call(admin, "public.arena_admin_announcements()")).toHaveLength(
    1,
  );
  // Audited.
  await db.exec("reset role");
  const audit = await db.query<{ action: string }>(
    "select action from public.arena_admin_audit where action in ('announce','end_announcement') order by id",
  );
  expect(audit.rows.map((r) => r.action)).toEqual([
    "announce",
    "end_announcement",
  ]);
});

it("refuses non-admins and bad announcements", async () => {
  await as(nova);
  await expect(
    db.query("select public.arena_admin_announce('Hello all', 'info', 1)"),
  ).rejects.toThrow();
  await expect(
    db.query("select public.arena_admin_announcements()"),
  ).rejects.toThrow();
  await as(admin);
  await expect(
    db.query("select public.arena_admin_announce('hi', 'info', 1)"),
  ).rejects.toThrow("3 to 300");
  await expect(
    db.query("select public.arena_admin_announce('Hello all', 'shout', 1)"),
  ).rejects.toThrow("info, event or warning");
  await expect(
    db.query("select public.arena_admin_announce('Hello all', 'info', 169)"),
  ).rejects.toThrow("1 to 168");
  // Players can't read the table directly.
  await as(nova);
  await expect(
    db.query("select * from public.arena_announcements"),
  ).rejects.toThrow();
});

it("lists players with when they were last online, most recent first", async () => {
  await db.exec(
    `reset role;update public.arena_profiles set last_online_at = now() - interval '2 hours' where id = '${nova}';
     update public.arena_profiles set last_online_at = now() - interval '5 minutes' where id = '${ana}';
     update public.arena_profiles set last_online_at = null where id = '${admin}';`,
  );
  const online = await call(
    admin,
    "public.arena_admin_player_list('', 0, 'online')",
  );
  expect(online.total).toBe(3);
  expect(online.players.map((p: any) => p.displayName)).toEqual([
    "Ana",
    "Nova",
    "Boss",
  ]);
  expect(online.players[2].lastOnline).toBeNull();
  expect(Date.parse(online.players[0].lastOnline)).toBeGreaterThan(
    Date.now() - 6 * 60_000,
  );
  const found = await call(
    admin,
    "public.arena_admin_player_list('nov', 0, 'new')",
  );
  expect(found.players.map((p: any) => p.displayName)).toEqual(["Nova"]);
  await as(admin);
  await expect(
    db.query("select public.arena_admin_player_list('', 0, 'name')"),
  ).rejects.toThrow("Invalid search");
  await as(nova);
  await expect(
    db.query("select public.arena_admin_player_list('', 0, 'new')"),
  ).rejects.toThrow();
});
