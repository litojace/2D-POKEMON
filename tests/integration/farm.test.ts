import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  CROPS,
  CROP_BY_ID,
  FARM_STARTER,
  LAND_LEVEL,
  LAND_PRICE,
  farmXpToNext,
  isStartPlot,
} from "../../packages/shared/src/farm";
/** Breeze Wheat's grow time (seconds). */
const W = CROP_BY_ID.wheat.growSeconds;
/** Earth Carrot's grow time (seconds). */
const C = CROP_BY_ID.carrot.growSeconds;

// Migration 037: the farm's rules run in the database and read the server's
// clock. Tests move stored timestamps back to make time pass.
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000371",
  other = "00000000-0000-4000-8000-000000000372";
const login = (id = player) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`,
  );
const farm = async (id = player) => {
  await login(id);
  return (await db.query<{ f: any }>("select public.arena_farm() f")).rows[0].f;
};
const act = async (actions: object[], id = player, request = randomUUID()) => {
  await login(id);
  return (
    await db.query<{ r: any }>("select public.arena_farm_act($1,$2::jsonb) r", [
      request,
      JSON.stringify(actions),
    ])
  ).rows[0].r;
};
/** Make `seconds` pass for a player's growing crops. */
const pass = async (seconds: number, id = player) => {
  await db.exec("reset role");
  await db.query(
    "update public.arena_farm_plots set progress_at = progress_at - make_interval(secs => $2), planted_at = planted_at - make_interval(secs => $2) where player_id = $1 and crop is not null",
    [id, seconds],
  );
};
const owner = async (sql: string, params: unknown[] = []) => {
  await db.exec("reset role");
  return (await db.query<any>(sql, params)).rows;
};
const giveLeaves = (id: string, n: number) =>
  owner(
    "select public.arena_grant_leaves($1,$2,'test',$3,public.arena_today())",
    [id, n, randomUUID()],
  );

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
  // These tests are about growth and prices: no weather (migration 039).
  await db.exec(
    "reset role;insert into public.arena_farm_weather_pin(id, weather) values (1, 'none') on conflict (id) do update set weather = 'none'",
  );
  for (const id of [player, other]) {
    await db.exec(
      `reset role;insert into auth.users values('${id}','{"display_name":"Farm tester"}')`,
    );
    await login(id);
    await db.query("select public.arena_me()");
  }
}, 60000);
afterAll(async () => db.close());

it("stores the same crops and farm level curve as the shared code", async () => {
  const rows = await owner(
    "select id, level, grow_seconds, seed_cost, sell, xp, rarity from public.arena_farm_crops order by id",
  );
  expect(rows).toEqual(
    [...CROPS]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((c) => ({
        id: c.id,
        level: c.level,
        grow_seconds: c.growSeconds,
        seed_cost: c.seedCost,
        sell: c.sell,
        xp: c.xp,
        rarity: c.rarity,
      })),
  );
  const need = await owner(
    "select array_agg(public.arena_farm_need(l) order by l) v from generate_series(1,100) l",
  );
  expect(need[0].v).toEqual(
    Array.from({ length: 100 }, (_, i) => farmXpToNext(i + 1)),
  );
  const land = await owner(
    "select array_agg(public.arena_farm_land_level(k) order by k) l, array_agg(public.arena_farm_land_price(k) order by k) p from generate_series(0,34) k",
  );
  expect(land[0]).toEqual({ l: [...LAND_LEVEL], p: [...LAND_PRICE] });
});

it("starts a farm with 15 plots, starter seeds and a welcome gift, on the server's clock", async () => {
  const f = await farm();
  expect(f.level).toBe(1);
  expect(f.plots.filter((p: any) => p.owned).map((p: any) => p.i)).toEqual(
    Array.from({ length: 50 }, (_, i) => i).filter(isStartPlot),
  );
  expect(f.seeds).toEqual(FARM_STARTER.seeds);
  expect(f.fertilizer).toEqual(FARM_STARTER.fertilizer);
  expect(f.leaves).toBe(FARM_STARTER.leaves);
  expect(Math.abs(Date.parse(f.now) - Date.now())).toBeLessThan(60_000);
  expect(Object.keys(f.market.mult)).toHaveLength(25);
  expect(f.market.mult[f.market.hot]).toBeGreaterThanOrEqual(1.6);
  // Opening the farm again changes nothing.
  expect((await farm()).leaves).toBe(FARM_STARTER.leaves);
});

it("grows a crop on the server's clock: no early harvest, then two crops and XP", async () => {
  let r = await act([{ a: "plant", plot: 0, crop: "wheat" }]);
  expect(r.results).toEqual([{ ok: true }]);
  const plot = r.farm.plots[0];
  expect(plot.crop).toBe("wheat");
  expect(Date.parse(plot.ripeAt) - Date.parse(r.farm.now)).toBeGreaterThan(
    (W - 10) * 1000,
  );
  expect(r.farm.seeds.wheat).toBe(9);
  r = await act([{ a: "harvest", plot: 0 }]);
  expect(r.results).toEqual([{ ok: false, error: "Not ripe yet" }]);
  await pass(W / 2);
  expect((await farm()).plots[0].progress).toBeCloseTo(0.5, 2);
  await pass(W / 2 + 1);
  r = await act([{ a: "harvest", plot: 0 }]);
  expect(r.results[0]).toEqual({
    ok: true,
    crop: "wheat",
    qty: 2,
    xp: 3,
    mutation: "",
  });
  expect(r.farm.barn).toEqual([{ crop: "wheat", mutation: "", qty: 2 }]);
  expect(r.farm.xp).toBe(3);
  expect(r.farm.plots[0].crop).toBeNull();
});

it("waters and fertilizes from the moment of the action", async () => {
  let r = await act([
    { a: "plant", plot: 1, crop: "carrot" },
    { a: "water", plot: 1 },
    { a: "water", plot: 1 },
  ]);
  expect(r.results).toEqual([
    { ok: true },
    { ok: true, watered: [1] },
    { ok: false, error: "Already watered" },
  ]);
  const ripeIn =
    (Date.parse(r.farm.plots[1].ripeAt) - Date.parse(r.farm.now)) / 1000;
  expect(ripeIn).toBeGreaterThan(C / 1.35 - 5);
  expect(ripeIn).toBeLessThan(C / 1.35 + 5);
  r = await act([
    { a: "fertilize", plot: 1, kind: "norm" },
    { a: "fertilize", plot: 1, kind: "norm" },
    { a: "fertilize", plot: 1, kind: "super" },
  ]);
  expect(r.results).toEqual([
    { ok: true },
    { ok: false, error: "This plot is already fertilized" },
    { ok: false, error: "Unlocks at farm level 6" },
  ]);
  expect(r.farm.fertilizer.norm).toBe(2);
  const left =
    (Date.parse(r.farm.plots[1].ripeAt) - Date.parse(r.farm.now)) / 1000;
  expect(left).toBeCloseTo(C / 1.35 / 1.4, -1);
});

it("refuses locked plots, locked crops, missing seeds and occupied plots", async () => {
  const r = await act([
    { a: "plant", plot: 9, crop: "wheat" },
    { a: "plant", plot: 2, crop: "voltberry" },
    { a: "plant", plot: 2, crop: "pumpkin" },
    { a: "plant", plot: 1, crop: "wheat" },
    { a: "plant", plot: 99, crop: "wheat" },
    { a: "dance" },
  ]);
  expect(r.results.map((x: any) => x.error)).toEqual([
    "Buy this plot first",
    "Unlocks at farm level 2",
    "Unlocks at farm level 17",
    "Something is already growing here",
    "Unknown plot",
    "Unknown action",
  ]);
});

it("applies a repeated request only once", async () => {
  const request = randomUUID();
  const first = await act(
    [{ a: "plant", plot: 2, crop: "wheat" }],
    player,
    request,
  );
  expect(first.results).toEqual([{ ok: true }]);
  const again = await act(
    [{ a: "plant", plot: 2, crop: "wheat" }],
    player,
    request,
  );
  expect(again.repeated).toBe(true);
  expect(again.farm.seeds.wheat).toBe(first.farm.seeds.wheat);
});

it("sells at today's market price and buys seeds from the restock", async () => {
  const before = await farm();
  const mult = before.market.mult.wheat;
  let r = await act([
    { a: "sell", crop: "wheat", mutation: "", qty: 3 },
    { a: "sell", crop: "wheat", mutation: "", qty: 2 },
  ]);
  expect(r.results[0]).toEqual({
    ok: false,
    error: "You don't have that many",
  });
  const price = Math.max(1, Math.round(5 * mult)) * 2;
  expect(r.results[1]).toEqual({ ok: true, leaves: price });
  expect(r.farm.leaves).toBe(before.leaves + price);
  expect(r.farm.barn).toEqual([]);
  const stock = r.farm.shop.stock.wheat;
  r = await act([{ a: "buy-seeds", crop: "wheat", qty: 4 }]);
  expect(r.results).toEqual([{ ok: true }]);
  expect(r.farm.leaves).toBe(before.leaves + price - 20);
  expect(r.farm.shop.stock.wheat).toBe(stock - 4);
  r = await act([
    { a: "buy-seeds", crop: "wheat", qty: 50 },
    { a: "buy-seeds", crop: "pumpkin", qty: 1 },
  ]);
  expect(r.results[0].ok).toBe(false);
  expect(r.results[1]).toEqual({
    ok: false,
    error: "Unlocks at farm level 17",
  });
});

it("sells land next to your field once you reach its level and can pay", async () => {
  let r = await act([{ a: "buy-land", plot: 5 }]);
  expect(r.results).toEqual([{ ok: false, error: "Needs farm level 3" }]);
  await owner("select public.arena_farm_add_xp($1, 200)", [player]);
  await giveLeaves(player, 1000);
  r = await act([
    { a: "buy-land", plot: 9 },
    { a: "buy-land", plot: 5 },
    { a: "buy-land", plot: 5 },
  ]);
  expect(r.results).toEqual([
    { ok: false, error: "You can only buy plots next to land you own" },
    { ok: true },
    { ok: false, error: "You already own this plot" },
  ]);
  expect(r.farm.landBought).toBe(1);
  expect(r.farm.plots[5].owned).toBe(true);
});

it("pays farm level-ups in leaves and fertilizer, and grants farm titles", async () => {
  const before = await farm(other);
  await owner("select public.arena_farm_add_xp($1, $2)", [
    other,
    Array.from({ length: 24 }, (_, i) => farmXpToNext(i + 1)).reduce(
      (a, b) => a + b,
    ),
  ]);
  const after = await farm(other);
  expect(after.level).toBe(25);
  // 40 + 10·L leaves for each level 2–25.
  let leaves = 0;
  for (let l = 2; l <= 25; l++) leaves += 40 + 10 * l;
  expect(after.leaves - before.leaves).toBe(leaves);
  expect(after.fertilizer).toEqual({ norm: 3 + 15, super: 1 + 5, gold: 2 });
  await login(other);
  const titles = (
    await db.query<{ m: any }>("select public.arena_me() m")
  ).rows[0].m.ownedTitles.map((t: any) => t.name);
  expect(titles).toContain("Green Thumb");
});

it("gives a combo bonus for three harvests in one go, and stops at a full barn", async () => {
  await act(
    [0, 1, 2, 3].map((plot) => ({ a: "dig", plot })),
    other,
  );
  await owner(
    "update public.arena_farm_seeds set qty = 20 where player_id = $1 and crop = 'wheat'",
    [other],
  );
  await act(
    [0, 1, 2].map((plot) => ({ a: "plant", plot, crop: "wheat" })),
    other,
  );
  await pass(W, other);
  const before = await farm(other);
  const r = await act(
    [0, 1, 2].map((plot) => ({ a: "harvest", plot })),
    other,
  );
  expect(r.combo).toBe(3);
  expect(r.xp).toBe(3 * 3 + 9);
  expect(r.farm.xp - before.xp).toBe(18);
  await owner(
    "insert into public.arena_farm_barn values($1,'carrot','',78) on conflict (player_id,crop,mutation) do update set qty=78",
    [other],
  );
  await act([{ a: "plant", plot: 3, crop: "wheat" }], other);
  await pass(W, other);
  const full = await act([{ a: "harvest", plot: 3 }], other);
  expect(full.results).toEqual([{ ok: false, error: "Your barn is full" }]);
});

it("keeps the farm tables and internal functions away from players", async () => {
  await login();
  for (const sql of [
    "select * from public.arena_farm_plots",
    "select * from public.arena_farms",
    `select public.arena_farm_add_xp('${player}', 100000)`,
    `select public.arena_farm_state('${player}')`,
    `select public.arena_farm_ensure('${player}')`,
  ])
    await expect(db.query(sql)).rejects.toThrow("permission");
});

it("can be run again without changing any farm", async () => {
  const before = await farm();
  // 037 and every migration after it, newest last (as the README says).
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql") && f >= "037")
    .sort())
    await db.exec(
      "reset role;" + (await readFile("supabase/migrations/" + f, "utf8")),
    );
  const after = await farm();
  // Growing crops keep growing while the files run: compare growth loosely.
  const still = (f: any) => ({
    ...f,
    now: null,
    plots: f.plots.map((p: any) => ({ ...p, progress: null })),
  });
  expect(still(after)).toEqual(still(before));
  after.plots.forEach((p: any, i: number) =>
    expect(p.progress).toBeCloseTo(before.plots[i].progress, 2),
  );
});
