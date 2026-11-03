import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import { FARM_DOGS } from "../../packages/shared/src/farm";

// Migration 045: guard dogs (hired by the day, gifts) and crows.
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000451";
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
const farmSet = (set: string) =>
  owner(`update public.arena_farms set ${set} where player_id = $1`, [player]);
const plots = (set: string, idx: number[]) =>
  owner(
    `update public.arena_farm_plots set ${set} where player_id = $1 and idx = any($2::int[])`,
    [player, idx],
  );
const hire = async (dog: string, days: number) =>
  (await act([{ a: "hire-dog", dog, days }])).results[0];
const all = [...Array(50).keys()];

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
    `reset role;insert into auth.users values('${player}','{"display_name":"Dog tester"}')`,
  );
  await login();
  await db.query("select public.arena_me()");
  await farm();
  await owner(
    "select public.arena_grant_leaves($1, 100000, 'test', 'dogs', public.arena_today())",
    [player],
  );
  await plots("owned = true", all);
}, 60000);
afterAll(async () => db.close());

it("hires dogs by the day at the shared levels and prices, extends and replaces", async () => {
  let f = await farm();
  expect(f.dog).toBeNull();
  expect(await hire("gold", 1)).toEqual({
    ok: false,
    error: "Unlocks at farm level 3",
  });
  expect(await hire("gold", 2)).toEqual({
    ok: false,
    error: "Hire for 1 or 3 days",
  });
  await farmSet("level = 40");
  for (const d of FARM_DOGS)
    for (const [days, price] of [
      [1, d.price1],
      [3, d.price3],
    ]) {
      await farmSet(`level = ${d.level - 1}`);
      expect((await hire(d.id, days)).error).toBe(
        `Unlocks at farm level ${d.level}`,
      );
      await farmSet("level = 40");
      const r = await act([{ a: "hire-dog", dog: d.id, days }]);
      expect(r.results[0], `${d.id} ${days}`).toMatchObject({
        ok: true,
        cost: price,
      });
      expect(f.leaves - r.farm.leaves).toBe(price);
      f = r.farm;
    }
  // Hiring the dog on guard adds the days: Fluffy for 1, then 3 more.
  const until = Date.parse(f.dog.until);
  expect(f.dog.type).toBe("cream");
  expect((until - Date.parse(f.now)) / 86400e3).toBeCloseTo(4, 2);
  let r = await act([{ a: "hire-dog", dog: "cream", days: 1 }]);
  expect(r.results[0]).toMatchObject({ ok: true, extended: true, cost: 300 });
  expect(Date.parse(r.farm.dog.until) - until).toBe(86400e3);
  expect(r.farm.dog.since).toBe(f.dog.since);
  // At most 30 days ahead.
  for (let k = 0; k < 8; k++) await hire("cream", 3);
  expect(await hire("cream", 3)).toEqual({
    ok: false,
    error: "That is as long as a dog can be booked",
  });
  // Another dog takes over now; the old hire ends.
  r = await act([{ a: "hire-dog", dog: "gold", days: 1 }]);
  expect(r.results[0]).toMatchObject({ ok: true, extended: false });
  expect(r.farm.dog.type).toBe("gold");
  const [{ open }] = await owner(
    "select count(*)::int open from public.arena_farm_dog_hires where player_id = $1 and ends_at > now()",
    [player],
  );
  expect(open).toBe(1);
});

it("dogs dig up gifts while on guard, also while you are away", async () => {
  await owner("delete from public.arena_farm_dog_hires where player_id = $1", [
    player,
  ]);
  const before = await farm();
  // Goldie, hired 2.5 days ago for 3 days: 2 gifts so far.
  await owner(
    `insert into public.arena_farm_dog_hires(player_id, dog, started_at, ends_at, dug_at)
     values ($1, 'gold', now() - interval '60 hours', now() + interval '12 hours', now() - interval '60 hours')`,
    [player],
  );
  let f = await farm();
  expect(f.dog.type).toBe("gold");
  expect(f.dogGifts).toHaveLength(2);
  const seeds = (s: any) =>
    Object.values(s.seeds as Record<string, number>).reduce((a, b) => a + b, 0);
  let want = { seeds: 0, leaves: 0, super: 0 };
  for (const g of f.dogGifts) {
    expect(g.dog).toBe("gold");
    if (g.kind === "seeds") {
      expect(g.qty).toBe(2);
      expect(g.crop).toEqual(expect.any(String));
      want.seeds += 2;
    } else if (g.kind === "leaves") {
      expect(g.qty).toBeGreaterThanOrEqual(15);
      expect(g.qty).toBeLessThanOrEqual(44);
      want.leaves += g.qty;
    } else want.super += 1;
  }
  expect(seeds(f) - seeds(before)).toBe(want.seeds);
  expect(f.leaves - before.leaves).toBe(want.leaves);
  expect(f.fertilizer.super - before.fertilizer.super).toBe(want.super);
  // Nothing more until the next day's gift.
  f = await farm();
  expect(f.dogGifts).toHaveLength(2);
  // Fluffy digs twice a day; Inky digs nothing.
  await owner("delete from public.arena_farm_dog_hires where player_id = $1", [
    player,
  ]);
  await owner(
    `insert into public.arena_farm_dog_hires(player_id, dog, started_at, ends_at, dug_at) values
     ($1, 'black', now() - interval '5 days', now() - interval '3 days', now() - interval '5 days'),
     ($1, 'cream', now() - interval '25 hours', now() + interval '1 hour', now() - interval '25 hours')`,
    [player],
  );
  f = await farm();
  expect(f.dog.type).toBe("cream");
  expect(f.dogGifts.filter((g: any) => g.dog === "cream")).toHaveLength(2);
  expect(f.dogGifts.filter((g: any) => g.dog === "black")).toHaveLength(0);
});

it("crows land only while you are on the farm with no Scarecrow and no dog", async () => {
  await owner("delete from public.arena_farm_dog_hires where player_id = $1", [
    player,
  ]);
  await owner(
    "insert into public.arena_farm_seeds(player_id, crop, qty) values ($1, 'wheat', 100) on conflict (player_id, crop) do update set qty = 100",
    [player],
  );
  await act(all.map((plot) => ({ a: "plant", plot, crop: "wheat" })));
  await plots("progress = 1, progress_at = now() - interval '1 minute'", all);
  await db.exec("select set_config('arena.farm_bugs', 'on', false)");
  const crows = async () =>
    Number(
      (
        await owner(
          "select count(*)::int n from public.arena_farm_plots where player_id = $1 and crow_at is not null",
          [player],
        )
      )[0].n,
    );
  const roll = async (secs: number, times: number) => {
    for (let k = 0; k < times; k++) {
      await farmSet(`seen_at = now() - make_interval(secs => ${secs})`);
      await owner("select public.arena_farm_bugs($1)", [player]);
    }
  };
  // Away: none. On the farm, 140 s at a time, 200 times: about 200 × 2.7% = 5.
  // (140, not 150: the farm counts you away past 150 s, and the time between
  // setting seen_at and rolling would sometimes cross that and skip a roll.)
  await farmSet("scarecrow = false");
  await roll(200, 50);
  expect(await crows()).toBe(0);
  await owner("select setseed(0.17)");
  await roll(140, 200);
  const landed = await crows();
  expect(landed).toBeGreaterThan(0);
  expect(landed).toBeLessThan(20);
  // A Scarecrow or a dog keeps them away.
  await plots("crow_at = null", all);
  await farmSet("scarecrow = true");
  await roll(140, 200);
  expect(await crows()).toBe(0);
  await farmSet("scarecrow = false");
  await owner(
    `insert into public.arena_farm_dog_hires(player_id, dog, started_at, ends_at, dug_at)
     values ($1, 'black', now(), now() + interval '1 day', now())`,
    [player],
  );
  await roll(140, 200);
  expect(await crows()).toBe(0);
  await db.exec("select set_config('arena.farm_bugs', 'off', false)");
  await owner("delete from public.arena_farm_dog_hires where player_id = $1", [
    player,
  ]);
});

it("a crow eats its crop unless it is shooed in time", async () => {
  await plots("crow_at = null", all);
  await plots("crow_at = now() - interval '3 seconds'", [5, 6]);
  let f = await farm();
  expect(Object.keys(f.crows).sort()).toEqual(["5", "6"]);
  // Shooed in time: the crop stays.
  let r = await act([{ a: "shoo", plot: 5 }]);
  expect(r.results[0]).toEqual({ ok: true, shooed: true });
  expect(r.farm.crows).toEqual({ "6": expect.any(String) });
  expect(r.farm.plots[5].crop).toBe("wheat");
  expect((await act([{ a: "shoo", plot: 5 }])).results[0]).toEqual({
    ok: false,
    error: "No crow here",
  });
  // Too late (8 s and the 2 s allowance): the crop is gone before the shoo.
  await plots("crow_at = now() - interval '11 seconds'", [6]);
  r = await act([{ a: "shoo", plot: 6 }]);
  expect(r.results[0]).toEqual({ ok: false, error: "No crow here" });
  expect(r.farm.plots[6].crop).toBeNull();
  expect(r.farm.crows).toEqual({});
  // Harvesting a crop with a crow on it takes the crow away too.
  await plots("crow_at = now()", [7]);
  r = await act([{ a: "harvest", plot: 7 }]);
  expect(r.results[0]).toMatchObject({ ok: true, crop: "wheat" });
  expect(r.farm.crows).toEqual({});
});

it("Fluffy raises the Gold odds of crops that ripened while she was on guard", async () => {
  // Many plantings, all ripe at the same moment (2026-01-01 12:00 UTC):
  // which of them roll Gold.
  const golds = async (n: number) =>
    (
      await owner(
        `select coalesce(array_agg(s order by s) filter (where public.arena_farm_mutation($1,
           jsonb_populate_record(p, jsonb_build_object('crop', 'wheat',
             'planted_at', timestamptz '2025-12-01' + make_interval(secs => s), 'progress', 1,
             'progress_at', timestamptz '2026-01-01 12:00Z', 'pests', 0)), 'sun') like '%gold%'), '{}') g
         from public.arena_farm_plots p, generate_series(1, $2::int) s
         where p.player_id = $1 and p.idx = 0`,
        [player, n],
      )
    )[0].g as number[];
  const n = 4000;
  const plain = await golds(n);
  expect(plain.length / n).toBeGreaterThan(0.018);
  expect(plain.length / n).toBeLessThan(0.042);
  // Fluffy hired after that moment: exactly the same rolls.
  await owner(
    `insert into public.arena_farm_dog_hires(player_id, dog, started_at, ends_at, dug_at)
     values ($1, 'cream', '2026-01-02', '2026-01-03', '2026-01-03')`,
    [player],
  );
  expect(await golds(1000)).toEqual(plain.filter((s) => s <= 1000));
  // On guard then: every plain Gold stays Gold, and about half as many again
  // join them (×1.5: 3% → 4.5%).
  await owner(
    `insert into public.arena_farm_dog_hires(player_id, dog, started_at, ends_at, dug_at)
     values ($1, 'cream', '2026-01-01', '2026-01-02', '2026-01-02')`,
    [player],
  );
  const fluffy = await golds(n);
  expect(plain.every((s) => fluffy.includes(s))).toBe(true);
  const extra = fluffy.length - plain.length;
  expect(extra / n).toBeGreaterThan(0.007);
  expect(extra / n).toBeLessThan(0.024);
  await owner("delete from public.arena_farm_dog_hires where player_id = $1", [
    player,
  ]);
}, 60000);
