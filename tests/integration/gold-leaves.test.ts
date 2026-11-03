import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";

// Migration 036: the Gold Leaves wallet and the leaves → coins trade.
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000361",
  other = "00000000-0000-4000-8000-000000000362";
const login = (id = player) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`,
  );
const asOwner = async <T>(sql: string, params: unknown[] = []) => {
  await db.exec("reset role");
  return (await db.query<{ v: T }>(sql, params)).rows[0].v;
};
const grant = (pid: string, amount: number, ref: string) =>
  asOwner<boolean>(
    "select public.arena_grant_leaves($1,$2,'test',$3,public.arena_today()) v",
    [pid, amount, ref],
  );
const spend = (pid: string, amount: number, ref: string) =>
  asOwner<boolean>(
    "select public.arena_spend_leaves($1,$2,'test-spend',$3,public.arena_today()) v",
    [pid, amount, ref],
  );
const leaves = async (id = player) => {
  await login(id);
  return (await db.query<{ v: any }>("select public.arena_leaves() v")).rows[0]
    .v;
};
const coins = (pid: string) =>
  asOwner<number>(
    "select coalesce((select balance from public.arena_wallets where player_id=$1),0)::int v",
    [pid],
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
  for (const id of [player, other]) {
    await db.exec(
      `reset role;insert into auth.users values('${id}','{"display_name":"Leaf tester"}')`,
    );
    await login(id);
    await db.query("select public.arena_me()");
  }
}, 60000);
afterAll(async () => db.close());

it("grants leaves once per reason and ref, and reports them in the economy", async () => {
  expect(await grant(player, 2000, "a")).toBe(true);
  expect(await grant(player, 2000, "a")).toBe(false);
  expect(await grant(player, 0, "zero")).toBe(false);
  expect(await grant(player, -5, "negative")).toBe(false);
  expect((await leaves()).balance).toBe(2000);
  await login();
  const e = (await db.query<{ e: any }>("select public.arena_economy() e"))
    .rows[0].e;
  expect(e.leaves).toMatchObject({
    balance: 2000,
    tradedToday: 0,
    tradeCap: 40,
    tradeLeaves: 100,
    tradeCoins: 5,
  });
  expect(e.missions).toBeDefined(); // the rest of the economy is unchanged
});

it("spends leaves only when the balance covers it, and never twice for one request", async () => {
  expect(await spend(player, 500, "s1")).toBe(true);
  expect(await spend(player, 500, "s1")).toBe(false);
  expect(await spend(player, 999999, "too-much")).toBe(false);
  expect((await leaves()).balance).toBe(1500);
});

it("trades 100 leaves for 5 coins, at most 40 coins a day", async () => {
  const before = await coins(player);
  await login();
  await db.query("select public.arena_trade_leaves(3)");
  expect((await leaves()).balance).toBe(1200);
  expect(await coins(player)).toBe(before + 15);
  await login();
  await db.query("select public.arena_trade_leaves(5)");
  expect((await leaves()).tradedToday).toBe(40);
  await login();
  await expect(db.query("select public.arena_trade_leaves(1)")).rejects.toThrow(
    "at most 40 coins",
  );
  expect(await coins(player)).toBe(before + 40);
  expect((await leaves()).balance).toBe(700);
});

it("refuses a trade without enough leaves and leaves both wallets as they were", async () => {
  await grant(other, 150, "b");
  const before = await coins(other);
  await login(other);
  await expect(db.query("select public.arena_trade_leaves(2)")).rejects.toThrow(
    "Not enough Gold Leaves",
  );
  expect((await leaves(other)).balance).toBe(150);
  expect(await coins(other)).toBe(before);
  await login(other);
  await expect(db.query("select public.arena_trade_leaves(9)")).rejects.toThrow(
    "how many",
  );
});

it("keeps the wallet tables and the grant and spend functions away from players", async () => {
  await login();
  for (const sql of [
    "select * from public.arena_leaf_wallets",
    "select * from public.arena_leaf_ledger",
    `select public.arena_grant_leaves('${player}',100,'x','y',public.arena_today())`,
    `select public.arena_spend_leaves('${player}',100,'x','y',public.arena_today())`,
  ])
    await expect(db.query(sql)).rejects.toThrow("permission");
});

it("can be run again without changing balances", async () => {
  const before = await leaves();
  await db.exec(
    "reset role;" +
      (await readFile("supabase/migrations/036_gold_leaves.sql", "utf8")),
  );
  expect(await leaves()).toEqual(before);
});
