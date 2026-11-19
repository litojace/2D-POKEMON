import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  PLAZA,
  PLAZA_QUESTS,
  PLAZA_TREATS,
} from "../../packages/shared/src/plaza";

// Migration 20261119170000_remove_farm_bistro_leaves: the Farm, the Bistro
// and Gold Leaves go for good. Every leaf balance is paid out once in shop
// coins (100 leaves -> 5 coins) before the leaf tables are dropped. The
// database is filled the way production was (farms, Bistros, leaf wallets
// with history, Plaza quests done today) before the migration runs, as it
// will on production.
const MIGRATION = "20261119170000_remove_farm_bistro_leaves.sql";
let db: PGlite;
let files: string[] = [];
let at = -1;
const id = (n: number) => `00000000-0000-4000-8000-00000000fa0${n}`;
// Leaf balances: 0, 19 (a share of 0), 20 (1 coin), 1500 and 1999.
const LEAVES = [0, 19, 20, 1500, 1999];
const players = LEAVES.map((_, i) => id(i + 1));
const [ana, ben, cal, dee, eve] = players;
const as = (who: string) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${who}',false);set role authenticated`,
  );
const sql = async (q: string, params: unknown[] = []) => {
  await db.exec("reset role");
  return (await db.query<any>(q, params)).rows;
};
const rpc = async (who: string, q: string, params: unknown[] = []) => {
  await as(who);
  return (await db.query<{ r: any }>(`select ${q} r`, params)).rows[0].r;
};
const coins = async (who: string) =>
  (
    await sql(
      "select coalesce((select balance from public.arena_wallets where player_id = $1), 0)::int n",
      [who],
    )
  )[0].n as number;
const record = (who: string, event: object) =>
  sql("select public.arena_plaza_record($1::jsonb) r", [
    JSON.stringify({ player: who, ...event }),
  ]).then((r) => r[0].r);
/** What the migration must leave exactly as it was. */
const kept = async () => ({
  profiles: await sql(
    "select id, display_name from public.arena_profiles order by id",
  ),
  friends: await sql("select a, b from public.arena_friendships order by 1, 2"),
  coinLedger: await sql(
    "select player_id, amount, reason, ref from public.arena_coin_ledger where reason <> 'leaf-retire' order by 1, 3, 4",
  ),
});
let before: Awaited<ReturnType<typeof kept>>;
const coinsBefore: Record<string, number> = {};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
  );
  files = (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  at = files.indexOf(MIGRATION);
  expect(at).toBeGreaterThan(0);
  for (const f of files.slice(0, at))
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
  for (const [i, who] of players.entries()) {
    await sql(
      `insert into auth.users values($1, jsonb_build_object('display_name', $2::text))`,
      [who, `Player ${i + 1}`],
    );
    await as(who);
    await db.query("select public.arena_me()");
  }
  await sql("insert into public.arena_friendships(a, b) values ($1, $2)", [
    ana < ben ? ana : ben,
    ana < ben ? ben : ana,
  ]);
  // Some shop coins already (from anywhere).
  await sql(
    "select public.arena_grant($1, 40, 'test', 'seed', public.arena_today())",
    [dee],
  );
  // The Farm and the Bistro as players left them.
  for (const who of [ana, dee]) {
    await rpc(who, "public.arena_farm()");
    await rpc(who, "public.arena_bistro()");
  }
  await sql(
    "insert into public.arena_farm_barn(player_id, crop, mutation, qty) values ($1, 'wheat', '', 30)",
    [ana],
  );
  await sql(
    "insert into public.arena_player_titles(player_id, title_id) select $1, id from public.arena_titles where name = 'Green Thumb'",
    [ana],
  );
  // Leaf wallets: exactly LEAVES (farm levels and the like may have paid
  // some already, so set them).
  for (const [i, who] of players.entries()) {
    await sql(
      "insert into public.arena_leaf_wallets(player_id, balance) values ($1, $2) on conflict (player_id) do update set balance = excluded.balance",
      [who, LEAVES[i]],
    );
  }
  // Eve did the photo quest today (paid in leaves) and caught two orbs.
  await record(eve, { kind: "photo" });
  await record(eve, { kind: "orb", ref: "29000000-1" });
  await record(eve, { kind: "orb", ref: "29000000-2" });
  await sql(
    "update public.arena_leaf_wallets set balance = $2 where player_id = $1",
    [eve, 1999],
  );
  for (const who of players) coinsBefore[who] = await coins(who);
  before = await kept();
  // This migration, then any that came after it.
  for (const f of files.slice(at))
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
}, 120000);
afterAll(async () => db.close());

it("pays every leaf balance once in shop coins: floor(balance × 5 / 100)", async () => {
  for (const [i, who] of players.entries())
    expect(await coins(who), `${LEAVES[i]} leaves`).toBe(
      coinsBefore[who] + Math.floor((LEAVES[i] * 5) / 100),
    );
  // One ledger line per player with a share; none for a share of 0.
  expect(
    await sql(
      "select player_id, amount from public.arena_coin_ledger where reason = 'leaf-retire' order by player_id",
    ),
  ).toEqual([
    { player_id: cal, amount: 1 },
    { player_id: dee, amount: 75 },
    { player_id: eve, amount: 99 },
  ]);
});

it("leaves accounts, friends, earned titles and other coins as they were", async () => {
  expect(await kept()).toEqual(before);
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

it("leaves no public table, function, view, trigger or type of the Farm, the Bistro or Gold Leaves", async () => {
  const left = await sql(`
    select 'relation ' || relname n from pg_class c join pg_namespace s on s.oid = c.relnamespace
      where s.nspname = 'public' and relname ~* 'farm|bistro|leaf'
    union all select 'table ' || tablename from pg_tables where schemaname = 'public' and tablename ~* 'farm|bistro|leaf'
    union all select 'function ' || p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid = p.pronamespace
      where s.nspname = 'public' and (p.proname ~* 'farm|bistro|leaf|leaves'
        or p.prosrc ~* 'arena_farm|arena_bistro|arena_leaf|_leaves\\(|farm_sent')
    union all select 'view ' || viewname from pg_views where schemaname = 'public' and definition ~* 'farm|bistro|leaf'
    union all select 'trigger ' || tgname from pg_trigger where not tgisinternal and tgname ~* 'farm|bistro|leaf'
    union all select 'type ' || typname from pg_type t join pg_namespace s on s.oid = t.typnamespace
      where s.nspname = 'public' and typname ~* 'farm|bistro|leaf'`);
  expect(left).toEqual([]);
});

it("reports the economy without leaves", async () => {
  const e = await rpc(dee, "public.arena_economy()");
  expect(e).not.toHaveProperty("leaves");
  expect(e.balance).toBe(await coins(dee));
});

it("pays Plaza quests in coins, once, and keeps today's leaf-paid ones paid", async () => {
  expect(PLAZA_QUESTS.map((q) => [q.id, q.max, q.coins])).toEqual(
    (
      await sql("select id, needed, coins from public.arena_plaza_quests()")
    ).map((r: any) => [r.id, r.needed, r.coins]),
  );
  // Eve's photo quest was paid in leaves today: done, and not paid again.
  let s = await sql("select public.arena_plaza_state($1) s", [eve]);
  expect(s[0].s.quests.photo.done).toBe(true);
  expect(s[0].s.orbsToday).toBe(2);
  expect(s[0].s).not.toHaveProperty("leaves");
  const c0 = await coins(eve);
  await record(eve, { kind: "photo" });
  expect(await coins(eve)).toBe(c0);
  // A new quest pays its coins once.
  await record(eve, { kind: "goal" });
  await record(eve, { kind: "goal" });
  expect(await coins(eve)).toBe(
    c0 + PLAZA_QUESTS.find((q) => q.id === "goal")!.coins,
  );
  // Orbs pay nothing themselves, count once each, at most 10 a shower.
  const c1 = await coins(eve);
  await record(eve, { kind: "orb", ref: "29000000-1" });
  for (let i = 3; i <= 12; i++)
    await record(eve, { kind: "orb", ref: `29000000-${i}` });
  s = await sql("select public.arena_plaza_state($1) s", [eve]);
  expect(s[0].s.orbsToday).toBe(10);
  expect(s[0].s.quests.orbs).toEqual({ n: 10, done: true });
  expect(await coins(eve)).toBe(
    c1 + PLAZA_QUESTS.find((q) => q.id === "orbs")!.coins,
  );
});

it("makes Volt Boba free", async () => {
  const c = await coins(ben);
  expect(await rpc(ben, "public.arena_plaza_boba($1)", [randomUUID()])).toEqual(
    { ok: true },
  );
  expect(await coins(ben)).toBe(c);
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
  // Tomorrow, ten more.
  await sql(
    "update public.arena_plaza_treat_days set day = day - 1 where player_id = $1",
    [cal],
  );
  expect(await rpc(cal, "public.arena_plaza_treats()")).toBe(10);
});

it("still deletes an account, with its coins and Plaza days", async () => {
  await rpc(eve, "public.arena_plaza_treat($1::uuid)", [randomUUID()]);
  const deeCoins = await coins(dee);
  await as(eve);
  await db.query("select public.arena_delete_my_account()");
  for (const [t, col] of [
    ["arena_profiles", "id"],
    ["arena_wallets", "player_id"],
    ["arena_coin_ledger", "player_id"],
    ["arena_plaza_days", "player_id"],
    ["arena_plaza_orbs", "player_id"],
    ["arena_plaza_treat_days", "player_id"],
  ])
    expect(
      await sql(`select count(*)::int n from public.${t} where ${col} = $1`, [
        eve,
      ]),
      t,
    ).toEqual([{ n: 0 }]);
  expect(await coins(dee)).toBe(deeCoins);
});

it("runs again without paying or changing anything", async () => {
  const snapshot = async () => ({
    kept: await kept(),
    wallets: await sql(
      "select player_id, balance from public.arena_wallets order by 1",
    ),
    retire: await sql(
      "select player_id, amount from public.arena_coin_ledger where reason = 'leaf-retire' order by 1",
    ),
  });
  const now = await snapshot();
  await db.exec(await readFile("supabase/migrations/" + MIGRATION, "utf8"));
  expect(await snapshot()).toEqual(now);
});
