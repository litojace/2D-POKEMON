import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  CROP_BY_ID,
  FARM_WEATHERS,
  MUTATIONS,
  mutationMultiplier,
} from "../../packages/shared/src/farm";
/** Breeze Wheat's grow time (seconds). */
const W = CROP_BY_ID.wheat.growSeconds;

// Migration 039: farm weather by 4-hour UTC window, growth window by window,
// and mutations rolled when a crop ripens.
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000391";
const login = () =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${player}',false);set role authenticated`,
  );
const farm = async () => {
  await login();
  return (await db.query<{ f: any }>("select public.arena_farm() f")).rows[0].f;
};
const act = async (actions: object[]) => {
  await login();
  return (
    await db.query<{ r: any }>("select public.arena_farm_act($1,$2::jsonb) r", [
      randomUUID(),
      JSON.stringify(actions),
    ])
  ).rows[0].r;
};
const owner = async (sql: string, params: unknown[] = []) => {
  await db.exec("reset role");
  return (await db.query<any>(sql, params)).rows;
};
const pin = (weather: string | null) =>
  weather
    ? owner(
        "insert into public.arena_farm_weather_pin(id, weather) values (1, $1) on conflict (id) do update set weather = $1",
        [weather],
      )
    : owner("delete from public.arena_farm_weather_pin");
const ripeIn = (f: any, i: number) =>
  (Date.parse(f.plots[i].ripeAt) - Date.parse(f.now)) / 1000;

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
    `reset role;insert into auth.users values('${player}','{"display_name":"Weather tester"}')`,
  );
  await login();
  await db.query("select public.arena_me()");
}, 60000);
afterAll(async () => db.close());

it("picks the weather by its weights, the same for everyone, with a forecast", async () => {
  await pin(null);
  const rows = await owner(
    "select public.arena_farm_weather(s) w, count(*)::int n from generate_series(100000, 119999) s group by 1",
  );
  const share = Object.fromEntries(rows.map((r: any) => [r.w, r.n / 20000]));
  const total = FARM_WEATHERS.reduce((s, w) => s + w.weight, 0);
  expect(total).toBe(100);
  for (const w of FARM_WEATHERS)
    expect(share[w.id], w.id).toBeCloseTo(w.weight / total, 1);
  // The third forecast is Mystowl's (Foresight, migration 046).
  await farm();
  await owner(
    "update public.arena_farms set farmer = 'mystowl' where player_id = $1",
    [player],
  );
  const f = await farm();
  const slot = Math.floor(Date.parse(f.now) / 1000 / 14400);
  const expected = await owner(
    "select public.arena_farm_weather($1) a, public.arena_farm_weather($2) b, public.arena_farm_weather($3) c",
    [slot, slot + 1, slot + 2],
  );
  expect(f.weather).toEqual({
    now: expected[0].a,
    next: expected[0].b,
    later: expected[0].c,
    until: expect.any(String),
  });
  expect(Date.parse(f.weather.until)).toBe((slot + 1) * 14400 * 1000);
});

it("grows faster in sun, slower in frost, and counts rain and storms as watering", async () => {
  await pin("sun");
  let r = await act([{ a: "plant", plot: 0, crop: "wheat" }]);
  expect(ripeIn(r.farm, 0)).toBeCloseTo(W / 1.1, -1);
  await pin("frost");
  r = await act([{ a: "plant", plot: 1, crop: "wheat" }]);
  expect(ripeIn(r.farm, 1)).toBeCloseTo(W / 0.85, -1);
  await pin("rain");
  r = await act([
    { a: "plant", plot: 2, crop: "wheat" },
    { a: "water", plot: 2 },
  ]);
  expect(r.results[1]).toEqual({ ok: false, error: "Already watered" });
  expect(r.farm.plots[2].wet).toBe(true);
  expect(ripeIn(r.farm, 2)).toBeCloseTo(W / 1.35, -1);
  // A storm pours rain too: it waters as well (migration 067).
  await pin("storm");
  r = await act([
    { a: "plant", plot: 4, crop: "wheat" },
    { a: "water", plot: 4 },
  ]);
  expect(r.results[1]).toEqual({ ok: false, error: "Already watered" });
  expect(r.farm.plots[4].wet).toBe(true);
  await pin("rain");
  // Rain that fell after planting keeps the crop watered when the sky
  // clears: plant in a real past rain window, look at it in the next one.
  await pin(null);
  const [{ slot }] = await owner(
    `select s as slot from generate_series(public.arena_farm_slot(now()) - 400, public.arena_farm_slot(now()) - 2) s
     where public.arena_farm_weather(s) = 'rain' and public.arena_farm_weather(s + 1) <> 'rain' limit 1`,
  );
  await owner(
    `update public.arena_farm_plots set wet = false, progress = 0.01,
       planted_at = to_timestamp($2 * 14400 + 60), progress_at = to_timestamp(($2 + 1) * 14400 + 60)
     where player_id = $1 and idx = 2`,
    [player, slot],
  );
  r = await farm();
  expect(r.plots[2].wet).toBe(true);
  expect(r.plots[2].progress).toBe(1); // long since ripe
  await act([0, 1, 2].map((plot) => ({ a: "dig", plot })));
});

it("rolls mutations by the weather when a crop ripens", async () => {
  // Many plantings of one plot, a second apart: the shares of each mutation.
  const tally = async (weather: string, fertilizer: string | null) =>
    Object.fromEntries(
      (
        await owner(
          `select m, count(*)::int n from (
             select public.arena_farm_mutation($1, jsonb_populate_record(p, jsonb_build_object('crop', 'wheat',
               'planted_at', timestamptz '2026-01-01' + make_interval(secs => s), 'progress', 1, 'progress_at', now(),
               'wet', false, 'fertilizer', $3::text, 'mutation', null)), $2) m
             from public.arena_farm_plots p, generate_series(1, 8000) s
             where p.player_id = $1 and p.idx = 0) x group by m`,
          [player, weather, fertilizer],
        )
      ).map((r: any) => [r.m, r.n / 8000]),
    );
  const has = (t: Record<string, number>, m: string) =>
    Object.entries(t)
      .filter(([k]) => k.split("+").includes(m))
      .reduce((s, [, v]) => s + v, 0);
  const storm = await tally("storm", null);
  expect(has(storm, "shock")).toBeCloseTo(0.25, 1);
  expect(has(storm, "gold")).toBeGreaterThan(0.015);
  expect(has(storm, "gold")).toBeLessThan(0.05);
  expect(Object.keys(storm).some((k) => k.includes("moon"))).toBe(false);
  const rain = await tally("rain", null);
  expect(has(rain, "wet")).toBeCloseTo(0.3, 1);
  const sun = await tally("sun", null);
  expect(has(sun, "shock") + has(sun, "wet") + has(sun, "moon")).toBe(0);
  const rainbow = await tally("rainbow", "gold");
  // Gold 3% × Gold Fertilizer 3 × Rainbow 3 = 27%; Rainbow 0.5% × 10 = 5%.
  expect(has(rainbow, "gold")).toBeCloseTo(0.27, 1);
  expect(has(rainbow, "rainbow")).toBeCloseTo(0.05, 1);
  // Keys are sorted and joined with "+", as the browser expects.
  for (const key of Object.keys({ ...storm, ...rain }))
    if (key) expect(key).toBe(key.split("+").sort().join("+"));
});

it("keeps the mutation in the barn and sells it at its multiplier", async () => {
  await pin("storm");
  // A planting moment whose roll comes out Shocked (25% of them do).
  const [{ at }] = await owner(
    `select planted as at from (
       select timestamptz '2026-01-01' + make_interval(secs => s) planted,
         public.arena_farm_mutation($1, jsonb_populate_record(p, jsonb_build_object('crop', 'wheat',
           'planted_at', timestamptz '2026-01-01' + make_interval(secs => s), 'progress', 1, 'progress_at', now(),
           'wet', false, 'fertilizer', null, 'mutation', null)), 'storm') m
       from public.arena_farm_plots p, generate_series(1, 400) s where p.player_id = $1 and p.idx = 3) x
     where m = 'shock' limit 1`,
    [player],
  );
  await act([{ a: "plant", plot: 3, crop: "wheat" }]);
  await owner(
    "update public.arena_farm_plots set planted_at = $2, progress = 0.999, progress_at = now() - interval '10 minutes' where player_id = $1 and idx = 3",
    [player, at],
  );
  let f = await farm();
  expect(f.plots[3].progress).toBe(1);
  expect(f.plots[3].mutation).toBe("shock");
  const r = await act([{ a: "harvest", plot: 3 }]);
  expect(r.results[0]).toMatchObject({ ok: true, mutation: "shock" });
  expect(r.farm.barn).toContainEqual({
    crop: "wheat",
    mutation: "shock",
    qty: 2,
  });
  const before = r.farm.leaves;
  const mult = Number(r.farm.market.mult.wheat);
  f = (await act([{ a: "sell", crop: "wheat", mutation: "shock", qty: 2 }]))
    .farm;
  expect(f.leaves - before).toBe(
    2 * Math.max(1, Math.round(5 * mult * mutationMultiplier("shock"))),
  );
  // The database's multipliers are the shared ones, exactly (migration 056).
  for (const m of MUTATIONS) {
    const [{ x }] = await owner(
      "select public.arena_farm_mutation_mult($1) x",
      [m.id],
    );
    expect(Number(x)).toBe(m.mult);
  }
  const [{ x }] = await owner(
    "select public.arena_farm_mutation_mult('gold+shock') x",
  );
  expect(Number(x)).toBe(15);
  // The sell action's price (arena_farm_sell_price) rounds as the Market
  // does (Math.round), whatever the day's prices. Wheat (5) Shocked on a
  // ×1.50 day lands on 22.5 and pays 23 (it paid 22 before migration 056).
  // Wet on ×1.10 is 8.25 → 8, Moonlit+Wet on ×1.70 is 31.875 → 32, and a
  // tiny price still pays 1.
  const prices = await owner(
    `select public.arena_farm_sell_price(sell, mult, mut) p
       from (values (5, 1.50, 'shock'), (5, 1.10, 'wet'), (5, 1.70, 'moon+wet'), (1, 0.30, '')) v(sell, mult, mut)`,
  );
  expect(prices.map((r: any) => r.p)).toEqual([23, 8, 32, 1]);
  await pin(null);
});
