import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  DAILY_SPARK_XP,
  MAX_PLAYER_LEVEL,
  SEASON_RULES,
  levelThreshold,
  seasonRules,
  seasonTheme,
} from "../../packages/shared/src/journey";

// Migration 035: levels 1–100, the Daily Spark and the 30-tier season.
let db: PGlite;
const veteran = "00000000-0000-4000-8000-000000000351", // past Lv 50 before 035
  sparky = "00000000-0000-4000-8000-000000000352",
  seasoned = "00000000-0000-4000-8000-000000000353",
  racer = "00000000-0000-4000-8000-000000000354";
const LATEST = "035_level_100_daily_spark.sql";
const login = (id: string) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`,
  );
const journey = async (id: string) => {
  await login(id);
  return (await db.query<{ j: any }>("select public.arena_journey() as j"))
    .rows[0].j;
};
const today = async () => {
  await db.exec("reset role");
  return (
    await db.query<{ d: string }>("select public.arena_today()::text as d")
  ).rows[0].d;
};
const addDays = (day: string, n: number) => {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const grant = async (pid: string, amount: number, ref: string, day: string) => {
  await db.exec("reset role");
  await db.query("select public.arena_add_xp($1,$2,'test',$3,$4)", [
    pid,
    amount,
    ref,
    day,
  ]);
};
const value = async <T>(sql: string, params: unknown[] = []) => {
  await db.exec("reset role");
  return (await db.query<{ v: T }>(sql, params)).rows[0].v;
};
const balance = (pid: string) =>
  value<number>(
    "select coalesce((select balance from public.arena_wallets where player_id=$1),0)::int v",
    [pid],
  );

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
  );
  const files = (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  // Everything before 035 first, so a player can already be past Lv 50.
  for (const f of files.filter((f) => f < LATEST))
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
  for (const id of [veteran, sparky, seasoned, racer]) {
    await db.exec(
      `reset role;insert into auth.users values('${id}','{"display_name":"Level tester"}')`,
    );
    await login(id);
    await db.query("select public.arena_me()");
  }
  // 130,000 XP was "max level 50" before; it is Lv 70 now.
  await db.exec(
    `reset role;insert into public.arena_player_xp values('${veteran}',130000)`,
  );
  for (const f of files.filter((f) => f >= LATEST))
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
}, 60000);
afterAll(async () => db.close());

it("stores the same level curve as the shared code at every boundary", async () => {
  await db.exec("reset role");
  const rows = (
    await db.query<{ l: number; t: string; at: number; below: number }>(
      `select l, public.arena_level_threshold(l)::text t,
        public.arena_level_for(public.arena_level_threshold(l)) at,
        public.arena_level_for(public.arena_level_threshold(l)-1) below
       from generate_series(1,100) l order by l`,
    )
  ).rows;
  expect(rows).toHaveLength(MAX_PLAYER_LEVEL);
  for (const r of rows) {
    expect(Number(r.t)).toBe(levelThreshold(r.l));
    expect(r.at).toBe(r.l);
    expect(r.below).toBe(Math.max(1, r.l - 1));
  }
  expect(
    (
      await db.query<{ a: number; b: number; c: number }>(
        "select public.arena_level_for(-5) a, public.arena_level_for(431624) b, public.arena_level_for(2000000000) c",
      )
    ).rows[0],
  ).toEqual({ a: 1, b: 99, c: 100 });
});

it("pays the new levels once to a player already past Lv 50, even when 035 runs again", async () => {
  const levelRows = () =>
    value<string>(
      "select string_agg(ref||'='||amount, ',' order by ref::int) v from public.arena_coin_ledger where player_id=$1 and reason='level'",
      [veteran],
    );
  const expected = Array.from({ length: 20 }, (_, i) => `${51 + i}=100`).join(
    ",",
  );
  expect(await levelRows()).toBe(expected);
  expect(await balance(veteran)).toBe(2000);
  await login(veteran);
  const titles = (
    await db.query<{ m: any }>("select public.arena_me() m")
  ).rows[0].m.ownedTitles.map((t: any) => t.name);
  expect(titles).toContain("Arena Veteran");
  expect(titles).not.toContain("Mythic Champion");
  await db.exec(
    "reset role;" + (await readFile("supabase/migrations/" + LATEST, "utf8")),
  );
  expect(await levelRows()).toBe(expected);
  expect(await balance(veteran)).toBe(2000);
});

it("doubles exactly the first 500 XP of each Pacific day, once per result", async () => {
  const d = await today();
  const xp = async () => (await journey(sparky)).xp as number;
  await grant(sparky, 450, "a", d);
  expect(await xp()).toBe(900);
  await grant(sparky, 100, "b", d); // only 50 of the allowance is left
  expect(await xp()).toBe(1050);
  await grant(sparky, 100, "b", d); // the same result again changes nothing
  await grant(sparky, 100, "c", d);
  expect(await xp()).toBe(1150);
  const j = await journey(sparky);
  expect(j.spark).toEqual({ day: d, used: DAILY_SPARK_XP, limit: 500 });
  expect(j.season.xp).toBe(1150);
  expect(
    j.recent
      .filter((r: any) => r.source === "spark")
      .map((r: any) => [r.ref, r.amount])
      .sort(),
  ).toEqual([
    ["test:a", 450],
    ["test:b", 50],
  ]);
  await grant(sparky, 100, "next-day", addDays(d, 1));
  expect(await xp()).toBe(1350);
  await db.exec("reset role");
  await expect(
    db.query("select public.arena_add_xp($1,500,'spark','forged',$2)", [
      sparky,
      d,
    ]),
  ).resolves.toBeDefined();
  expect(await xp()).toBe(1350);
});

it("doubles mission and match XP from real results and shows the bonus in the journey", async () => {
  const d = await today();
  // Today's missions are already done, so the match cannot finish one first.
  await db.query("select public.arena_ensure_missions($1,$2)", [racer, d]);
  await db.query(
    "update public.arena_mission_progress set done=true where player_id=$1 and day=$2",
    [racer, d],
  );
  const p = {
    id: "spark-match-1",
    kind: "match",
    day: d,
    players: [
      {
        accountId: racer,
        character: "voltkit",
        won: true,
        vsPeople: true,
        botLevel: null,
        mode: "duel",
        skillUses: 0,
        ults: 0,
        activeSeconds: 90,
        participated: true,
      },
    ],
  };
  await db.exec("reset role;set role service_role");
  await db.query("select public.arena_record_activity($1::jsonb)", [
    JSON.stringify(p),
  ]);
  const j = await journey(racer);
  expect(j.xp).toBe(150);
  expect(
    j.recent.find((r: any) => r.ref === p.id && r.source === "match"),
  ).toMatchObject({ amount: 75 });
  expect(j.recent.find((r: any) => r.ref === `match:${p.id}`)).toMatchObject({
    source: "spark",
    amount: 75,
  });
  await db.exec("reset role");
  await db.query(
    "select public.arena_grant($1,40,'mission','spark-mission',$2)",
    [racer, d],
  );
  expect((await journey(racer)).xp).toBe(250);
});

it("keeps 20 × 400 for the month in progress and runs 30 × 1,200 from the next month", async () => {
  const d = await today(),
    thisMonth = d.slice(0, 7),
    first = new Date(thisMonth + "-01T12:00:00Z");
  first.setUTCMonth(first.getUTCMonth() + 1);
  const nextDay = first.toISOString().slice(0, 10),
    next = nextDay.slice(0, 7);
  expect(
    await value<string>(
      "select starts v from public.arena_season_rules where tiers=30",
    ),
  ).toBe(next);
  const now = await journey(seasoned);
  expect(seasonRules(now.season)).toEqual({
    tiers: 20,
    tierXp: 400,
    itemTiers: [5, 10, 15, 20],
  });

  const tiers = () =>
    value<number>(
      "select count(*)::int v from public.arena_coin_ledger where player_id=$1 and reason='season' and ref like $2",
      [seasoned, next + ":%"],
    );
  // 3 × 10,000 plus that day's 500 Spark = 30,500 season XP: tier 25.
  for (let i = 0; i < 3; i++)
    await grant(seasoned, 10000, "next-" + i, nextDay);
  expect(await tiers()).toBe(25);
  const theme = seasonTheme(next);
  const owned = async () =>
    (
      await db.query<{ item_id: string }>(
        "select item_id from public.arena_owned_items where player_id=$1 and item_id like 'season-%' order by item_id",
        [seasoned],
      )
    ).rows.map((r) => r.item_id);
  await db.exec("reset role");
  expect(await owned()).toEqual(
    ["aura", "colors", "frame"].map((s) => `season-${theme}-${s}`),
  );
  await grant(seasoned, 10000, "next-3", nextDay);
  expect(await tiers()).toBe(SEASON_RULES.tiers);
  await db.exec("reset role");
  expect(await owned()).toContain(`season-${theme}-victory`);
  await grant(seasoned, 10000, "next-4", nextDay);
  expect(await tiers()).toBe(SEASON_RULES.tiers);
});

it("keeps the new rule tables and helpers away from players", async () => {
  await login(sparky);
  for (const sql of [
    "select * from public.arena_season_rules",
    "select public.arena_level_threshold(10)",
    "select public.arena_season_rule('2026-12')",
    "select public.arena_add_xp('00000000-0000-4000-8000-000000000352',100,'test','forged',public.arena_today())",
  ])
    await expect(db.query(sql)).rejects.toThrow("permission");
});
