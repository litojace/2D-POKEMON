import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";

const migration = "20261116150001_raise_currency_trade_caps.sql";
const player = "00000000-0000-4000-8000-000000006001";
let db: PGlite;
const login = () =>
  db.exec(
    `reset role; select set_config('request.jwt.claim.sub','${player}',false); set role authenticated`,
  );
const owner = async (sql: string, params: unknown[] = []) => {
  await db.exec("reset role");
  return (await db.query<any>(sql, params)).rows;
};
const apply = async () => {
  await db.exec("reset role");
  await db.exec(await readFile(`supabase/migrations/${migration}`, "utf8"));
};
const leaves = async () => {
  await login();
  return (await db.query<{ v: any }>("select public.arena_leaves() v")).rows[0]
    .v;
};
const tradeLeaves = async (lots: number) => {
  await login();
  return db.query("select public.arena_trade_leaves($1)", [lots]);
};
const tradeBistro = async (lots: number, request = randomUUID()) => {
  await login();
  return (
    await db.query<{ v: any }>(
      "select public.arena_bistro_act($1,$2::jsonb) v",
      [request, JSON.stringify([{ a: "trade", lots }])],
    )
  ).rows[0].v;
};
const balances = async () =>
  (
    await owner(
      `select
  (select balance from public.arena_wallets where player_id=$1) as coins,
  (select balance from public.arena_leaf_wallets where player_id=$1) as leaves,
  (select coins from public.arena_bistros where player_id=$1) as bistro,
  (select count(*) from public.arena_coin_ledger where player_id=$1) as coin_entries,
  (select count(*) from public.arena_leaf_ledger where player_id=$1) as leaf_entries`,
      [player],
    )
  )[0];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;`);
  for (const file of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql") && f !== migration)
    .sort())
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await db.query("insert into auth.users values($1,$2)", [
    player,
    { display_name: "Trade tester" },
  ]);
  await login();
  await db.query("select public.arena_me()");
  await db.query("select public.arena_bistro()");
  await owner(
    "update public.arena_bistros set coins=10000 where player_id=$1",
    [player],
  );
  await owner(
    "select public.arena_grant_leaves($1,5000,'test','seed',public.arena_today())",
    [player],
  );
}, 60000);
afterAll(async () => db.close());

it("raises both caps mid-day, preserves old trades and prevents duplicate payments", async () => {
  expect((await leaves()).tradeCap).toBe(40);
  const request = randomUUID();
  await tradeLeaves(8);
  const oldTrade = await tradeBistro(15, request);
  expect(oldTrade.bistro.tradedToday).toBe(300);
  const before = await balances();
  await apply();
  expect(await balances()).toEqual(before);
  expect(await leaves()).toMatchObject({
    tradeCap: 60,
    tradedToday: 40,
    tradeLeaves: 100,
    tradeCoins: 5,
  });
  expect((await tradeBistro(15, request)).repeated).toBe(true);
  expect(await balances()).toEqual(before);

  await tradeLeaves(4);
  const more = await tradeBistro(15);
  expect(more.results[0]).toEqual({ ok: true, leaves: 300 });
  expect(more.bistro.tradedToday).toBe(600);
  expect((await leaves()).tradedToday).toBe(60);
  const capped = await balances();
  expect(Number(capped.coins) - Number(before.coins)).toBe(20);
  expect(Number(capped.leaves) - Number(before.leaves)).toBe(-100);
  expect(Number(capped.bistro) - Number(before.bistro)).toBe(-1500);
  // Bistro-generated Leaves share the same Leaves -> shop Coin cap.
  await expect(tradeLeaves(1)).rejects.toThrow("at most 60 coins");
  expect((await tradeBistro(1)).results[0].error).toContain(
    "600 Gold Leaves a day",
  );
  expect(await balances()).toEqual(capped);
  await apply();
  await apply();
  expect(await balances()).toEqual(capped);
  expect((await leaves()).tradedToday).toBe(60);
});

it("allows full-day batches next day, with unchanged conversion rates", async () => {
  // Daily allowance is derived from Pacific-day ledger entries, not a new
  // counter that could accidentally reset when the migration runs.
  await owner(
    "update public.arena_coin_ledger set day=public.arena_today()-1 where player_id=$1 and reason='leaf-trade'",
    [player],
  );
  await owner(
    "update public.arena_leaf_ledger set day=public.arena_today()-1 where player_id=$1 and reason='bistro-trade'",
    [player],
  );
  expect((await leaves()).tradedToday).toBe(0);
  const before = await balances();
  await tradeLeaves(12);
  const request = randomUUID();
  const full = await tradeBistro(30, request);
  expect(full.results[0]).toEqual({ ok: true, leaves: 600 });
  expect(full.bistro.tradedToday).toBe(600);
  const after = await balances();
  expect(Number(after.coins) - Number(before.coins)).toBe(60);
  expect(Number(after.leaves) - Number(before.leaves)).toBe(-600);
  expect(Number(after.bistro) - Number(before.bistro)).toBe(-3000);
  expect((await tradeBistro(30, request)).repeated).toBe(true);
  expect(await balances()).toEqual(after);
  await expect(tradeLeaves(13)).rejects.toThrow("how many");
  expect((await tradeBistro(31)).results[0].error).toContain("how many");
  expect(await balances()).toEqual(after);
});

it("retains restricted permissions and requires a signed-in player", async () => {
  const grants = (
    await owner(`select
    has_function_privilege('anon','public.arena_trade_leaves(integer)','EXECUTE') as anon_trade,
    has_function_privilege('anon','public.arena_bistro_act(uuid,jsonb)','EXECUTE') as anon_bistro,
    has_function_privilege('authenticated','public.arena_trade_leaves(integer)','EXECUTE') as player_trade,
    has_function_privilege('authenticated','public.arena_bistro_act(uuid,jsonb)','EXECUTE') as player_bistro`)
  )[0];
  expect(grants).toEqual({
    anon_trade: false,
    anon_bistro: false,
    player_trade: true,
    player_bistro: true,
  });
  await db.exec(
    "select set_config('request.jwt.claim.sub','',false); set role authenticated",
  );
  await expect(db.query("select public.arena_trade_leaves(1)")).rejects.toThrow(
    "Login required",
  );
  await expect(
    db.query("select public.arena_bistro_act($1,$2::jsonb)", [
      randomUUID(),
      '[{"a":"trade","lots":1}]',
    ]),
  ).rejects.toThrow("Login required");
});
