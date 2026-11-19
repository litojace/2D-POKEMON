import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import { PLAZA, PLAZA_TREATS } from "../../packages/shared/src/plaza";

// Migration 20261119170000_remove_farm: the Farm's tables and functions go
// for good; Gold Leaves, the Bistro, the coin exchange, Plaza treats and
// account deletion keep working. The database is filled the way production
// was (farms, barns, leaf wallets with history, a Bistro that took farm
// crops, friends) before the migration runs, as it will on production.
const MIGRATION = "20261119170000_remove_farm.sql";
let db: PGlite;
const ana = "00000000-0000-4000-8000-00000000fa01";
const ben = "00000000-0000-4000-8000-00000000fa02";
const cal = "00000000-0000-4000-8000-00000000fa03";
const as = (id: string) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`,
  );
const sql = async (q: string, params: unknown[] = []) => {
  await db.exec("reset role");
  return (await db.query<any>(q, params)).rows;
};
const rpc = async (id: string, q: string, params: unknown[] = []) => {
  await as(id);
  return (await db.query<{ r: any }>(`select ${q} r`, params)).rows[0].r;
};
/** Everything the migration must leave exactly as it was. */
const kept = async () => ({
  wallets: await sql(
    "select to_jsonb(w) j from public.arena_leaf_wallets w order by player_id",
  ),
  ledger: await sql(
    "select to_jsonb(l) j from public.arena_leaf_ledger l order by to_jsonb(l)::text",
  ),
  profiles: await sql(
    "select id, display_name from public.arena_profiles order by id",
  ),
  coins: await sql(
    "select player_id, balance from public.arena_wallets order by player_id",
  ),
  bistros: await sql(
    "select player_id, coins, level, xp from public.arena_bistros order by player_id",
  ),
  pantry: await sql(
    "select player_id, ingredient, qty from public.arena_bistro_pantry order by 1, 2",
  ),
  friends: await sql("select a, b from public.arena_friendships order by 1, 2"),
});
let before: Awaited<ReturnType<typeof kept>>;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
  );
  const files = (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const at = files.indexOf(MIGRATION);
  expect(at).toBeGreaterThan(0);
  for (const f of files.slice(0, at))
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
  for (const [id, name] of [
    [ana, "Ana"],
    [ben, "Ben"],
    [cal, "Cal"],
  ]) {
    await sql(
      `insert into auth.users values($1, jsonb_build_object('display_name', $2::text))`,
      [id, name],
    );
    await as(id);
    await db.query("select public.arena_me()");
  }
  await sql("insert into public.arena_friendships(a, b) values ($1, $2)", [
    ana < ben ? ana : ben,
    ana < ben ? ben : ana,
  ]);
  // The Farm as players left it: farms, barns, a farm-level title.
  for (const id of [ana, ben]) await rpc(id, "public.arena_farm()");
  await sql(
    "insert into public.arena_farm_barn(player_id, crop, mutation, qty) values ($1, 'wheat', '', 30), ($1, 'egg', '', 9), ($2, 'mint', '', 12)",
    [ana, ben],
  );
  await sql(
    "insert into public.arena_player_titles(player_id, title_id) select $1, id from public.arena_titles where name = 'Green Thumb'",
    [ana],
  );
  // Gold Leaves with history, some of it from the Farm.
  for (const [id, n, reason] of [
    [ana, 1500, "farm-level"],
    [ana, 300, "bistro-trade"],
    [ben, 250, "farm-fine"],
  ] as const)
    await sql(
      "select public.arena_grant_leaves($1, $2, $3, 'seed', public.arena_today())",
      [id, n, reason],
    );
  // A Bistro that brought farm crops in.
  await rpc(ana, "public.arena_bistro()");
  await rpc(ben, "public.arena_bistro()");
  const r = await rpc(ana, "public.arena_bistro_act($1, $2::jsonb)", [
    randomUUID(),
    JSON.stringify([{ a: "farm", id: "wheat", qty: 3 }]),
  ]);
  expect(r.results[0].ok).toBe(true);
  expect(r.bistro.farmSent).toBe(3);
  // Treats came from the barn.
  expect(await rpc(ana, "public.arena_plaza_treats()")).toBeGreaterThan(0);

  before = await kept();
  // This migration, then any that came after it.
  for (const f of files.slice(at))
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
}, 120000);
afterAll(async () => db.close());

it("leaves Gold Leaves, coins, accounts, friends and the Bistro exactly as they were", async () => {
  expect(before.wallets.length).toBe(2);
  expect(before.ledger.some((l: any) => l.j.reason === "farm-level")).toBe(
    true,
  );
  expect(await kept()).toEqual(before);
  // Earned farm titles stay, worded as history.
  expect(
    await sql(
      "select t.name, t.description from public.arena_player_titles g join public.arena_titles t on t.id = g.title_id where g.player_id = $1",
      [ana],
    ),
  ).toEqual([
    {
      name: "Green Thumb",
      description: "Reached farm level 25 while the Farm was open.",
    },
  ]);
});

it("leaves no public table, function, view, trigger or sequence of the Farm", async () => {
  const left = await sql(`
    select 'table ' || tablename n from pg_tables where schemaname = 'public' and tablename ilike '%farm%'
    union all select 'relation ' || relname from pg_class c join pg_namespace s on s.oid = c.relnamespace
      where s.nspname = 'public' and relname ilike '%farm%'
    union all select 'function ' || p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid = p.pronamespace
      where s.nspname = 'public' and (p.proname ilike '%farm%' or p.prosrc ilike '%arena_farm%' or p.prosrc ilike '%farm_sent%')
    union all select 'view ' || viewname from pg_views where schemaname = 'public' and definition ilike '%farm%'
    union all select 'trigger ' || tgname from pg_trigger where not tgisinternal and tgname ilike '%farm%'
    union all select 'type ' || typname from pg_type t join pg_namespace s on s.oid = t.typnamespace
      where s.nspname = 'public' and typname ilike '%farm%'`);
  expect(left).toEqual([]);
  // Nothing outside the Farm still points at it (functions included).
  expect(
    await sql(
      "select p.proname from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.prosrc ilike '%farm%'",
    ),
  ).toEqual([]);
});

it("keeps the Bistro: friends, the Market, the special, and no more Farm crops", async () => {
  const b = await rpc(ana, "public.arena_bistro()");
  expect(b).not.toHaveProperty("farmSent");
  expect(b).not.toHaveProperty("farmCrops");
  expect(b.pantry.flour).toBe(3);
  expect(typeof b.special).toBe("string");
  const r = await rpc(ana, "public.arena_bistro_act($1, $2::jsonb)", [
    randomUUID(),
    JSON.stringify([{ a: "farm", id: "wheat", qty: 1 }]),
  ]);
  expect(r.results[0]).toMatchObject({ ok: false, error: "Unknown action." });
  // Friends still visit each other's bistros; strangers still can't.
  const view = await rpc(ana, "public.arena_bistro_friend($1)", [ben]);
  expect(view.id ?? view.bistro?.id).toBe(ben);
  expect(view).not.toHaveProperty("farmSent");
  await expect(
    rpc(ana, "public.arena_bistro_friend($1)", [cal]),
  ).rejects.toThrow();
  // The friends league still counts friends.
  expect(b.league.week.map((p: any) => p.id).sort()).toEqual([ana, ben].sort());
});

it("keeps the leaves → coins exchange", async () => {
  const coins = async () =>
    (
      await sql(
        "select coalesce((select balance from public.arena_wallets where player_id = $1), 0)::int n",
        [ana],
      )
    )[0].n;
  const c0 = await coins();
  const l0 = (await rpc(ana, "public.arena_leaves()")).balance;
  await as(ana);
  await db.query("select public.arena_trade_leaves(2)");
  expect((await rpc(ana, "public.arena_leaves()")).balance).toBe(l0 - 200);
  expect(await coins()).toBe(c0 + 10);
});

it("gives Plaza treats from a daily allowance, once per request", async () => {
  expect(PLAZA.treatsDaily).toBe(10);
  expect(await rpc(cal, "public.arena_plaza_treats()")).toBe(10);
  const ref = randomUUID();
  const thrown = [];
  for (let i = 0; i < 10; i++) {
    const r = await rpc(cal, "public.arena_plaza_treat($1::uuid)", [
      i === 0 ? ref : randomUUID(),
    ]);
    expect(r).toMatchObject({ ok: true, left: 9 - i });
    thrown.push(r.treat);
    if (i === 0)
      // The same request twice throws once.
      expect(
        await rpc(cal, "public.arena_plaza_treat($1::uuid)", [ref]),
      ).toMatchObject({ ok: false, error: "Already thrown", left: 9 });
  }
  // The SQL list is the shared one, in its order.
  expect(thrown.slice(0, PLAZA_TREATS.length)).toEqual(
    PLAZA_TREATS.map((t) => t.id),
  );
  expect(
    await rpc(cal, "public.arena_plaza_treat($1::uuid)", [randomUUID()]),
  ).toMatchObject({ ok: false, left: 0 });
  expect(await rpc(cal, "public.arena_plaza_treats()")).toBe(0);
  // Tomorrow, ten more.
  await sql(
    "update public.arena_plaza_treat_days set day = day - 1 where player_id = $1",
    [cal],
  );
  expect(await rpc(cal, "public.arena_plaza_treats()")).toBe(10);
});

it("still deletes an account, with its Bistro, leaves and treats", async () => {
  const benLeaves = (await rpc(ben, "public.arena_leaves()")).balance;
  expect(benLeaves).toBeGreaterThan(0);
  await rpc(ana, "public.arena_plaza_treat($1::uuid)", [randomUUID()]);
  await as(ana);
  await db.query("select public.arena_delete_my_account()");
  for (const t of [
    "arena_profiles",
    "arena_bistros",
    "arena_leaf_wallets",
    "arena_plaza_treat_days",
  ])
    expect(
      await sql(
        `select count(*)::int n from public.${t} where ${t === "arena_profiles" ? "id" : "player_id"} = $1`,
        [ana],
      ),
    ).toEqual([{ n: 0 }]);
  // Ben keeps everything.
  expect((await rpc(ben, "public.arena_leaves()")).balance).toBe(benLeaves);
});

it("runs again without changing anything", async () => {
  const now = await kept();
  await db.exec(await readFile("supabase/migrations/" + MIGRATION, "utf8"));
  expect(await kept()).toEqual(now);
});
