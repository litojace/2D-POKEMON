import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";

let db: PGlite;
const player = "00000000-0000-4000-8000-000000000341";
const login = (id = player) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`,
  );

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
    `reset role;insert into auth.users values('${player}','{"display_name":"Advisor tester"}')`,
  );
  await login();
  await db.query("select public.arena_me()");
}, 60000);
afterAll(async () => db.close());

it("pins arena_level_for's search_path and closes the two public RPCs", async () => {
  await db.exec("reset role");
  const checks = await db.query<Record<string, boolean>>(`select
    (select proconfig @> array['search_path=""'] from pg_proc
      where oid = 'public.arena_level_for(bigint)'::regprocedure) as pinned,
    has_function_privilege('anon', 'public.arena_shop_picks(date)', 'execute') as anon_picks,
    has_function_privilege('authenticated', 'public.arena_shop_picks(date)', 'execute') as user_picks,
    has_function_privilege('anon', 'public.arena_daily_mission(date,text,integer)', 'execute') as anon_daily,
    has_function_privilege('authenticated', 'public.arena_daily_mission(date,text,integer)', 'execute') as user_daily`);
  expect(checks.rows[0]).toEqual({
    pinned: true,
    anon_picks: false,
    user_picks: false,
    anon_daily: false,
    user_daily: false,
  });
  // Level maths is unchanged by the pinned search_path.
  const levels = await db.query<{ a: number; b: number; c: number }>(
    "select public.arena_level_for(0) a, public.arena_level_for(100) b, public.arena_level_for(-5) c",
  );
  expect(levels.rows[0]).toEqual({ a: 1, b: 2, c: 1 });
});

it("still serves the Shop and missions to a signed-in player", async () => {
  await login();
  await expect(
    db.query("select public.arena_shop_picks(current_date)"),
  ).rejects.toThrow(/permission denied/);
  const economy = await db.query<{ e: any }>(
    "select public.arena_economy() as e",
  );
  expect(economy.rows[0].e.missions.length).toBeGreaterThan(0);
  // The economy (SECURITY DEFINER) still reads today's Shop picks itself.
  expect(economy.rows[0].e.picks.items.length).toBeGreaterThan(0);
});
