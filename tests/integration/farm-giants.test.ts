import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  CROP_BY_ID,
  GIANT,
  giantPlots,
  giantXp,
  giantYield,
} from "../../packages/shared/src/farm";

// Migration 050: giant crops.
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000501";
const friend = "00000000-0000-4000-8000-000000000502";
const login = (who = player) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${who}',false);set role authenticated`,
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
const chance = (v: "always" | "never" | "") =>
  db.exec(`select set_config('arena.farm_giants', '${v}', false)`);
const pin = (w: string | null) =>
  w
    ? owner(
        "insert into public.arena_farm_weather_pin(id, weather) values (1, $1) on conflict (id) do update set weather = $1",
        [w],
      )
    : owner("delete from public.arena_farm_weather_pin");
const ALL = [...Array(50).keys()];
const clear = () =>
  owner(
    `update public.arena_farm_plots set crop = null, planted_at = null, progress = 0, progress_at = null,
       wet = false, fertilizer = null, mutation = null, pests = 0, crow_at = null where player_id = $1`,
    [player],
  );
/** Ripe crops on plots, planted 2 hours ago (a second apart), ripe `ago` seconds ago. */
const ripe = (plots: number[], crop: string, ago = 60) =>
  owner(
    `update public.arena_farm_plots set crop = $2,
       planted_at = now() - interval '2 hours' + make_interval(secs => idx),
       progress = 1, progress_at = now() - make_interval(secs => $3::int),
       wet = false, fertilizer = null, mutation = null, pests = 0
     where player_id = $1 and idx = any($4::int[])`,
    [player, crop, ago, plots],
  );
const barn = async (crop: string, mutation = "", who = player) =>
  Number(
    (
      await owner(
        "select coalesce(sum(qty), 0)::int n from public.arena_farm_barn where player_id = $1 and crop = $2 and mutation = $3",
        [who, crop, mutation],
      )
    )[0].n,
  );
const emptyBarn = () =>
  owner("delete from public.arena_farm_barn where player_id = $1", [player]);
const SQ0 = giantPlots(0)!; // 0 1 2 / 10 11 12 / 20 21 22

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
  );
  await db.exec("select set_config('arena.farm_bugs', 'off', false)");
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
  await db.exec(
    `reset role;insert into auth.users values('${player}','{"display_name":"Giant tester"}'),('${friend}','{"display_name":"Giant friend"}')`,
  );
  for (const who of [player, friend]) {
    await login(who);
    await db.query("select public.arena_me()");
    await db.query("select public.arena_farm()");
  }
  await owner("insert into public.arena_friendships(a, b) values ($1, $2)", [
    player,
    friend,
  ]);
  // Every plot owned, a big barn, no weather (so no mutations) unless a test pins one.
  await owner(
    "update public.arena_farm_plots set owned = true where player_id = $1",
    [player],
  );
  await owner(
    "update public.arena_farms set barn_upgrades = 10 where player_id = $1",
    [player],
  );
  await pin("none");
}, 60000);
afterAll(async () => db.close());

it("Earth Carrot, Dusk Cap, Lava Pumpkin and Storm Melon can grow giant, at 10% a square", async () => {
  const rows = await owner(
    "select id from public.arena_farm_crops where giant order by id",
  );
  expect(rows.map((r: any) => r.id)).toEqual([...GIANT.crops].sort());
  for (const id of GIANT.crops) expect(CROP_BY_ID[id]).toBeTruthy();
  await chance("");
  const [{ x }] = await owner("select public.arena_farm_giant_chance() x");
  expect(x).toBeCloseTo(GIANT.chance, 9);
  // Many squares of 9 plantings: about 10% of their rolls are under the chance.
  const [{ share }] = await owner(
    `select avg((public.arena_farm_giant_roll($1, 0, array(
        select timestamptz '2026-01-01' + make_interval(secs => s * 60 + k) from generate_series(0, 8) k
      )) < $2)::int)::float share from generate_series(1, 4000) s`,
    [player, GIANT.chance],
  );
  expect(share).toBeGreaterThan(0.085);
  expect(share).toBeLessThan(0.115);
});

it("rolls each square once: reading the farm again never re-rolls it", async () => {
  await chance("");
  await clear();
  await ripe(SQ0, "carrot");
  const planted = async () =>
    (
      await owner(
        "select array_agg(planted_at order by idx) a from public.arena_farm_plots where player_id = $1 and idx = any($2::int[])",
        [player, SQ0],
      )
    )[0].a;
  const roll = async () =>
    (
      await owner(
        "select public.arena_farm_giant_roll($1, 0, (select array_agg(planted_at order by idx) from public.arena_farm_plots where player_id = $1 and idx = any($2::int[]))) x",
        [player, SQ0],
      )
    )[0].x;
  const r1 = await roll();
  expect(await roll()).toBe(r1);
  const reads = [await farm(), await farm(), await farm()];
  for (const f of reads)
    expect(f.giants).toHaveLength(r1 < GIANT.chance ? 1 : 0);
  // Plantings whose roll is under the chance, and one whose roll isn't: the
  // farm shows a giant for the first and none for the second, every time.
  // (Plantings two hours back: growth looks at every 4-hour weather window
  // since planting, so plantings months old make each read slow.)
  const [{ t0 }] = await owner("select (now() - interval '2 hours')::text t0");
  const base = await owner(
    `select s, public.arena_farm_giant_roll($1, 0, array(
        select $2::timestamptz + make_interval(secs => s * 10 + k) from generate_series(0, 8) k)) x
     from generate_series(1, 300) s`,
    [player, t0],
  );
  const lucky = base.find((r: any) => r.x < GIANT.chance)!.s,
    plain = base.find((r: any) => r.x >= GIANT.chance)!.s;
  const plant = (s: number) =>
    owner(
      `update public.arena_farm_plots p set planted_at = $4::timestamptz
         + make_interval(secs => $2::int * 10 + array_position($3::int[], p.idx) - 1)
       where player_id = $1 and idx = any($3::int[])`,
      [player, s, SQ0, t0],
    );
  await plant(lucky);
  expect((await planted()).length).toBe(9);
  for (let k = 0; k < 3; k++) {
    const f = await farm();
    expect(f.giants).toEqual([
      { i: 0, crop: "carrot", plots: SQ0, formedAt: expect.any(String) },
    ]);
  }
  await plant(plain);
  for (let k = 0; k < 3; k++) expect((await farm()).giants).toEqual([]);
});

it("needs all 9 ripe, one crop, and a crop that can grow giant", async () => {
  await chance("always");
  await clear();
  await ripe(SQ0, "carrot");
  // One still growing: no giant yet.
  await owner(
    "update public.arena_farm_plots set progress = 0.5, progress_at = now() where player_id = $1 and idx = 22",
    [player],
  );
  let f = await farm();
  expect(f.plots[22].progress).toBeLessThan(1);
  expect(f.giants).toEqual([]);
  // It ripens: the square forms when its last crop ripened.
  await owner(
    "update public.arena_farm_plots set progress = 1, progress_at = now() - interval '5 seconds' where player_id = $1 and idx = 22",
    [player],
  );
  f = await farm();
  expect(f.giants).toHaveLength(1);
  expect(Date.parse(f.giants[0].formedAt)).toBeCloseTo(
    Date.parse(f.now) - 5000,
    -3,
  );
  // Two kinds of giant crop in one square: none.
  await ripe([22], "duskcap");
  expect((await farm()).giants).toEqual([]);
  // Wheat never grows giant.
  await ripe(SQ0, "wheat");
  expect((await farm()).giants).toEqual([]);
  // Every giant crop does; a square needs 3 rows and 3 columns of field.
  for (const crop of GIANT.crops) {
    await ripe(SQ0, crop);
    expect((await farm()).giants).toMatchObject([{ i: 0, crop }]);
  }
  expect(giantPlots(8)).toBeNull();
  expect(giantPlots(30)).toBeNull();
  expect(giantPlots(27)).toEqual([27, 28, 29, 37, 38, 39, 47, 48, 49]);
  // "never" turns them off.
  await chance("never");
  expect((await farm()).giants).toEqual([]);
});

it("where squares overlap, the first to form wins", async () => {
  await chance("always");
  await clear();
  // Carrots in columns 0–3 of rows 0–2: squares at 0 and at 1 overlap.
  const block = [0, 1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23];
  await ripe(block, "carrot", 600);
  // The same moment: the lower plot number wins.
  expect((await farm()).giants).toMatchObject([{ i: 0 }]);
  // Column 0 ripened last: the square at 1 formed first and wins.
  await ripe([0, 10, 20], "carrot", 60);
  expect((await farm()).giants).toMatchObject([{ i: 1 }]);
  // A field with room for two: both.
  await clear();
  await ripe([...SQ0, ...giantPlots(3)!], "pumpkin");
  expect((await farm()).giants.map((g: any) => g.i)).toEqual([0, 3]);
});

it("harvest-giant: each crop twice its harvest with its own mutation, for twice the XP", async () => {
  await chance("always");
  await clear();
  await emptyBarn();
  await pin("storm");
  await ripe(SQ0, "carrot");
  // A planting moment for plot 0 whose roll comes out Shocked in a storm.
  const [{ at }] = await owner(
    `select planted as at from (
       select now() - interval '3 hours' + make_interval(secs => s) planted,
         public.arena_farm_mutation($1, jsonb_populate_record(p, jsonb_build_object(
           'planted_at', now() - interval '3 hours' + make_interval(secs => s))), 'storm') m
       from public.arena_farm_plots p, generate_series(1, 400) s where p.player_id = $1 and p.idx = 0) x
     where m = 'shock' limit 1`,
    [player],
  );
  await owner(
    "update public.arena_farm_plots set planted_at = $2 where player_id = $1 and idx = 0",
    [player, at],
  );
  const before = await farm();
  expect(before.giants).toHaveLength(1);
  expect(before.plots[0].mutation).toBe("shock");
  const muts: Record<string, number> = {};
  for (const j of SQ0) {
    const k = before.plots[j].mutation ?? "";
    muts[k] = (muts[k] ?? 0) + 1;
  }
  const r = await act([{ a: "harvest-giant", plot: 21 }]);
  const crop = CROP_BY_ID.carrot;
  expect(r.results[0]).toMatchObject({
    ok: true,
    giant: 0,
    crop: "carrot",
    qty: giantYield(2),
    xp: giantXp(crop.xp),
  });
  expect(giantYield(2)).toBe(36);
  expect(r.results[0].harvested).toHaveLength(9);
  for (const h of r.results[0].harvested)
    expect(h).toEqual({
      plot: h.plot,
      crop: "carrot",
      qty: 4,
      xp: 2 * crop.xp,
      mutation: before.plots[h.plot].mutation ?? "",
    });
  // XP: twice the 9 crops', more than a Sickle swing with its combo bonus.
  expect(r.xp).toBe(giantXp(crop.xp));
  expect(giantXp(crop.xp)).toBeGreaterThan(9 * crop.xp + 3 * 9);
  expect(r.combo).toBe(0);
  for (const [k, n] of Object.entries(muts))
    expect(await barn("carrot", k)).toBe(4 * n);
  expect(await barn("carrot", "shock")).toBeGreaterThanOrEqual(4);
  // 9 harvests in the crop book (and mastery), one giant grown; the plots are empty.
  expect(r.farm.harvests.carrot - (before.harvests.carrot ?? 0)).toBe(9);
  expect(r.farm.giantsGrown).toEqual({ carrot: 1 });
  for (const j of SQ0) expect(r.farm.plots[j].crop).toBeNull();
  expect(r.farm.giants).toEqual([]);
  expect((await act([{ a: "harvest-giant", plot: 0 }])).results[0]).toEqual({
    ok: false,
    error: "No giant crop here",
  });
  expect((await act([{ a: "harvest-giant", plot: 49 }])).results[0]).toEqual({
    ok: false,
    error: "No giant crop here",
  });
  await pin("none");
});

it("Rich Soil doubles too, a friend's sneak takes one, and friends see giants", async () => {
  await chance("always");
  await clear();
  await emptyBarn();
  await ripe(SQ0, "melon");
  await owner(
    "update public.arena_farms set farmer = 'terradon' where player_id = $1",
    [player],
  );
  // The friend sees the giant and sneaks a crop from one of its plots.
  await login(friend);
  const view = (
    await db.query<{ v: any }>("select public.arena_farm_friend($1) v", [
      player,
    ])
  ).rows[0].v;
  expect(view.giants).toMatchObject([{ i: 0, crop: "melon", plots: SQ0 }]);
  const sneak = (
    await db.query<{ r: any }>(
      "select public.arena_farm_friend_act($1,$2,$3::jsonb) r",
      [randomUUID(), player, JSON.stringify([{ a: "sneak", plot: 11 }])],
    )
  ).rows[0].r;
  expect(sneak.results[0]).toMatchObject({ ok: true, crop: "melon", qty: 1 });
  // The giant is still there, one crop smaller.
  expect(sneak.farm.giants).toHaveLength(1);
  expect((await farm()).giants).toHaveLength(1);
  const r = await act([{ a: "harvest-giant", plot: 0 }]);
  expect(r.results[0]).toMatchObject({ ok: true, qty: giantYield(3, 1) });
  expect(giantYield(3, 1)).toBe(53);
  expect(r.results[0].harvested.find((h: any) => h.plot === 11).qty).toBe(5);
  expect(await barn("melon")).toBe(53);
  expect(await barn("melon", "", friend)).toBe(1);
  await owner(
    "update public.arena_farms set farmer = 'voltkit' where player_id = $1",
    [player],
  );
});

it("waits for barn room for the whole giant", async () => {
  await chance("always");
  await clear();
  await emptyBarn();
  await ripe(SQ0, "duskcap");
  const [{ cap }] = await owner(
    "select 80 + 40 * barn_upgrades cap from public.arena_farms where player_id = $1",
    [player],
  );
  await owner(
    "insert into public.arena_farm_barn(player_id, crop, mutation, qty) values ($1, 'wheat', '', $2)",
    [player, cap - 35],
  );
  const r = await act([{ a: "harvest-giant", plot: 0 }]);
  expect(r.results[0]).toEqual({
    ok: false,
    error: "Your barn is full. This giant needs room for 36 crops",
  });
  expect(r.farm.giants).toHaveLength(1);
  expect(await barn("duskcap")).toBe(0);
  await owner(
    "update public.arena_farm_barn set qty = $2 where player_id = $1 and crop = 'wheat'",
    [player, cap - 36],
  );
  expect(
    (await act([{ a: "harvest-giant", plot: 12 }])).results[0],
  ).toMatchObject({ ok: true, qty: 36 });
  await emptyBarn();
});

it("the Sickle takes the giant whole when sent first; one plot at a time breaks it", async () => {
  await chance("always");
  await clear();
  await emptyBarn();
  await owner(
    "update public.arena_farms set sickle = true where player_id = $1",
    [player],
  );
  await ripe(SQ0, "carrot");
  await ripe([3, 13], "wheat");
  // The farm screen's swing at plot 2: the giant, then the Sickle's 3×3.
  let r = await act([
    { a: "harvest-giant", plot: 2 },
    { a: "harvest", plot: 2, tool: "sickle" },
  ]);
  expect(r.results[0]).toMatchObject({ ok: true, giant: 0, qty: 36 });
  expect(r.results[1].harvested.map((h: any) => h.plot)).toEqual([3, 13]);
  expect(await barn("carrot")).toBe(36);
  expect(await barn("wheat")).toBe(4);
  // An old app's swing (no harvest-giant): the plots it reaches are
  // harvested one by one (2 each) and the giant breaks.
  await emptyBarn();
  await ripe(SQ0, "carrot");
  expect((await farm()).giants).toHaveLength(1);
  r = await act([{ a: "harvest", plot: 2, tool: "sickle" }]);
  expect(r.results[0].harvested.map((h: any) => h.plot)).toEqual([
    1, 2, 11, 12,
  ]);
  expect(await barn("carrot")).toBe(8);
  expect(r.farm.giants).toEqual([]);
  for (const j of [0, 10, 20, 21, 22]) {
    expect(r.farm.plots[j].crop).toBe("carrot");
    expect(r.farm.plots[j].progress).toBe(1);
  }
  // Digging one up breaks it the same way.
  await ripe(SQ0, "carrot");
  r = await act([{ a: "dig", plot: 22 }]);
  expect(r.farm.giants).toEqual([]);
  await emptyBarn();
});

it("crows never land on a giant", async () => {
  await chance("always");
  await clear();
  await ripe(SQ0, "pumpkin");
  await ripe([5], "wheat");
  await owner(
    "update public.arena_farm_plots set crow_at = now() where player_id = $1 and idx = any($2::int[])",
    [player, [11, 5]],
  );
  const f = await farm();
  expect(Object.keys(f.crows)).toEqual(["5"]);
  expect(f.giants).toHaveLength(1);
  // The way a crow really lands (arena_farm_bugs picks a ripe plot at random):
  // with only the giant ripe, none lands in 200 visits.
  await clear();
  await ripe(SQ0, "pumpkin");
  await db.exec("select set_config('arena.farm_bugs', 'on', false)");
  await owner("select setseed(0.5)");
  for (let k = 0; k < 200; k++) {
    await owner(
      "update public.arena_farms set seen_at = now() - interval '140 seconds', scarecrow = false where player_id = $1",
      [player],
    );
    await owner("select public.arena_farm_bugs($1)", [player]);
  }
  await db.exec("select set_config('arena.farm_bugs', 'off', false)");
  expect((await farm()).crows).toEqual({});
  // Without a giant the same 200 visits bring crows.
  await chance("never");
  await owner("select setseed(0.5)");
  await db.exec("select set_config('arena.farm_bugs', 'on', false)");
  for (let k = 0; k < 200; k++) {
    await owner(
      "update public.arena_farms set seen_at = now() - interval '140 seconds' where player_id = $1",
      [player],
    );
    await owner("select public.arena_farm_bugs($1)", [player]);
  }
  await db.exec("select set_config('arena.farm_bugs', 'off', false)");
  expect(Object.keys((await farm()).crows).length).toBeGreaterThan(0);
  await clear();
});

it("is safe to run again, and keeps the pasture actions", async () => {
  await db.exec("reset role");
  const sql = await readFile("supabase/migrations/050_farm_giants.sql", "utf8");
  await db.exec(sql);
  await db.exec(sql);
  await chance("always");
  await clear();
  await ripe(SQ0, "carrot");
  const f = await farm();
  expect(f.giants).toHaveLength(1);
  expect(f).toMatchObject({ pasture: false, milkMult: expect.any(Number) });
  expect((await act([{ a: "milk" }])).results[0]).toEqual({
    ok: false,
    error: "Open the pasture first",
  });
  expect((await act([{ a: "nonsense" }])).results[0]).toEqual({
    ok: false,
    error: "Unknown action",
  });
  const [{ n }] = await owner(
    "select count(*)::int n from pg_trigger where tgname = 'arena_farm_plots_giant_crow'",
  );
  expect(n).toBe(1);
});

it("players can't call the giant functions directly", async () => {
  await login();
  for (const call of [
    "select public.arena_farm_giants($1, now())",
    "select public.arena_farm_harvest_giant($1, 0, now())",
    "select public.arena_farm_giant_roll($1, 0, array[now()])",
  ])
    await expect(db.query(call, [player])).rejects.toThrow(/permission denied/);
});
