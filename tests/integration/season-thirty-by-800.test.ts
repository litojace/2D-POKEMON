import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import { SEASON_RULES, seasonTheme } from "../../packages/shared/src/journey";

// Migration 20261121200000: the 30-tier season takes 800 XP a tier, and a
// run after such a season started pays the tiers players were lifted past.
const MIGRATION = "20261121200000_season_thirty_by_800.sql";
const SEASON = "2031-03"; // a 30-tier month far from today's real one
const player = "00000000-0000-4000-8000-000000000801",
  owner = "00000000-0000-4000-8000-000000000802";
let db: PGlite;
const value = async <T>(sql: string, params: unknown[] = []) =>
  (await db.query<{ v: T }>(sql, params)).rows[0].v;
const tiersPaid = (pid: string) =>
  value<string[]>(
    "select coalesce(array_agg(ref order by split_part(ref,':',2)::int),'{}') v from public.arena_coin_ledger where player_id=$1 and reason='season'",
    [pid],
  );
const coins = (pid: string, reason: string) =>
  value<number>(
    "select coalesce(sum(amount),0)::int v from public.arena_coin_ledger where player_id=$1 and reason=$2",
    [pid, reason],
  );
const runMigration = async () =>
  db.exec(await readFile("supabase/migrations/" + MIGRATION, "utf8"));

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
  );
  const files = (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files)
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
  for (const id of [player, owner]) {
    await db.exec(
      `reset role;insert into auth.users values('${id}','{"display_name":"Season tester"}')`,
    );
    await db.exec(
      `select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`,
    );
    await db.query("select public.arena_me()");
  }
  await db.exec("reset role");
}, 120000);
afterAll(async () => db.close());

it("stores 30 tiers of 800 XP, the same as the shared rules, even if 035 runs again", async () => {
  await db.exec(
    await readFile("supabase/migrations/035_level_100_daily_spark.sql", "utf8"),
  );
  const rule = (
    await db.query<{ tiers: number; tier_xp: number; item_tiers: number[] }>(
      "select tiers, tier_xp, item_tiers from public.arena_season_rules where tiers = 30",
    )
  ).rows;
  expect(rule).toEqual([
    {
      tiers: SEASON_RULES.tiers,
      tier_xp: SEASON_RULES.tierXp,
      item_tiers: [...SEASON_RULES.itemTiers],
    },
  ]);
});

it("pays the tiers a 30-tier season's players were lifted past, once", async () => {
  // Pretend the 1,200-XP season already ran into SEASON: 9,000 XP paid tiers
  // 1–7 (and tier 5's frame). At 800 XP a tier the same XP is tier 11.
  await db.exec(`
    alter table public.arena_season_rules disable trigger arena_season_rules_800;
    insert into public.arena_season_rules values ('${SEASON}', 30, 1200, '{5,12,20,30}');
    alter table public.arena_season_rules enable trigger arena_season_rules_800;
    create or replace function public.arena_today() returns date language sql stable as $$ select date '${SEASON}-10' $$;
    insert into public.arena_season_xp(player_id, season, xp) values ('${player}', '${SEASON}', 9000), ('${owner}', '${SEASON}', 9600);
  `);
  const theme = seasonTheme(SEASON);
  for (let t = 1; t <= 7; t++)
    await db.query(
      "select public.arena_grant($1, 50, 'season', $2, $3::date)",
      [player, `${SEASON}:${t}`, `${SEASON}-05`],
    );
  await db.query(
    "insert into public.arena_owned_items values ($1, $2) on conflict do nothing",
    [player, `season-${theme}-frame`],
  );
  // The owner already had this month's aura (tier 12) from somewhere else.
  await db.query(
    "insert into public.arena_owned_items values ($1, $2) on conflict do nothing",
    [owner, `season-${theme}-aura`],
  );

  await runMigration();
  expect(
    await value<number>(
      `select tier_xp v from public.arena_season_rules where starts = '${SEASON}'`,
    ),
  ).toBe(800);
  expect(await tiersPaid(player)).toEqual(
    Array.from({ length: 11 }, (_, i) => `${SEASON}:${i + 1}`),
  );
  expect(await coins(player, "season")).toBe(11 * 50);
  expect(await coins(player, "season-repeat")).toBe(0);
  // 9,600 XP is tier 12: the owner gets 12 tiers and 100 for the owned aura.
  expect(await coins(owner, "season")).toBe(12 * 50);
  expect(await coins(owner, "season-repeat")).toBe(100);

  const ledgerRows = await value<number>(
    "select count(*)::int v from public.arena_coin_ledger",
  );
  await runMigration();
  expect(
    await value<number>("select count(*)::int v from public.arena_coin_ledger"),
  ).toBe(ledgerRows);
  // Wallets still match the ledger.
  expect(
    await value<number>(
      `select count(*)::int v from public.arena_wallets w
         left join (select player_id, sum(amount) s from public.arena_coin_ledger group by 1) l using (player_id)
        where w.balance <> coalesce(l.s, 0)`,
    ),
  ).toBe(0);
});
