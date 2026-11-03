import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";

// Migration 043: crop mastery stars from farm level 40.
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000431";
const login = () =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${player}',false);set role authenticated`,
  );
const farm = async () => {
  await login();
  return (await db.query<{ f: any }>("select public.arena_farm() f")).rows[0].f;
};
const master = async (crop: string, request = randomUUID()) => {
  await login();
  return (
    await db.query<{ r: any }>("select public.arena_farm_master($1,$2) r", [
      request,
      crop,
    ])
  ).rows[0].r;
};
const owner = async (sql: string, params: unknown[] = []) => {
  await db.exec("reset role");
  return (await db.query<any>(sql, params)).rows;
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
  );
  // Random bugs (migration 044) would change growth timings.
  await db.exec("select set_config('arena.farm_bugs', 'off', false)");
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
  await db.exec(
    `reset role;insert into auth.users values('${player}','{"display_name":"Master tester"}')`,
  );
  await login();
  await db.query("select public.arena_me()");
}, 60000);
afterAll(async () => db.close());

it("needs farm level 40 and enough harvests", async () => {
  await farm();
  expect(await master("wheat")).toMatchObject({
    ok: false,
    error: "Crop mastery unlocks at farm level 40",
  });
  await owner("update public.arena_farms set level = 40 where player_id = $1", [
    player,
  ]);
  expect(await master("wheat")).toMatchObject({
    ok: false,
    error: "Harvest Breeze Wheat 25 times first",
  });
  await owner(
    "insert into public.arena_farm_harvests(player_id, crop, harvests) values ($1, 'wheat', 1000)",
    [player],
  );
  expect(await master("wheat")).toMatchObject({
    ok: false,
    error: "Not enough Gold Leaves",
  });
});

it("charges seed × 30 × star² leaves a star and raises the price 4% a star", async () => {
  await owner(
    "select public.arena_grant_leaves($1, 100000, 'test', 'mastery', public.arena_today())",
    [player],
  );
  const before = await farm();
  const base = Number(before.market.mult.wheat);
  const request = randomUUID();
  let r = await master("wheat", request);
  expect(r).toMatchObject({ ok: true, stars: 1, cost: 5 * 30 });
  expect(before.leaves - r.farm.leaves).toBe(150);
  expect(r.farm.mastery).toEqual({ wheat: 1 });
  expect(Number(r.farm.market.mult.wheat)).toBeCloseTo(base * 1.04, 1);
  // A retry is not charged again.
  const again = await master("wheat", request);
  expect(again).toMatchObject({ ok: false, repeated: true });
  expect(again.farm.leaves).toBe(r.farm.leaves);
  for (const [stars, cost] of [
    [2, 600],
    [3, 1350],
    [4, 2400],
    [5, 3750],
  ]) {
    const left = r.farm.leaves;
    r = await master("wheat");
    expect(r).toMatchObject({ ok: true, stars, cost });
    expect(left - r.farm.leaves).toBe(cost);
  }
  expect(Number(r.farm.market.mult.wheat)).toBeCloseTo(base * 1.2, 1);
  expect(await master("wheat")).toMatchObject({
    ok: false,
    error: "Already golden",
  });
  // Other crops keep the day's price.
  expect(r.farm.market.mult.carrot).toEqual(before.market.mult.carrot);
});
