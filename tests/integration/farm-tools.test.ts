import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  BUG_RATE,
  CROP_BY_ID,
  FARM_TOOLS,
  SPRINKLER_LEVELS,
  SPRINKLER_PRICES,
  farmArea,
} from "../../packages/shared/src/farm";
/** Breeze Wheat's grow time (seconds). */
const W = CROP_BY_ID.wheat.growSeconds;

// Migration 044: tools bought once, and bugs while you are on the farm.
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000441";
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
const tools = (set: string) =>
  owner(`update public.arena_farms set ${set} where player_id = $1`, [player]);
const plots = (set: string, idx: number[]) =>
  owner(
    `update public.arena_farm_plots set ${set} where player_id = $1 and idx = any($2::int[])`,
    [player, idx],
  );
const ripeIn = (f: any, i: number) =>
  (Date.parse(f.plots[i].ripeAt) - Date.parse(f.now)) / 1000;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
  );
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
  // No weather (rain would water plots and change growth speeds), and no
  // random bugs except where a test turns them on.
  await db.exec("select set_config('arena.farm_bugs', 'off', false)");
  await db.exec(
    "reset role;insert into public.arena_farm_weather_pin(id, weather) values (1, 'none')",
  );
  await db.exec(
    `reset role;insert into auth.users values('${player}','{"display_name":"Tool tester"}')`,
  );
  await login();
  await db.query("select public.arena_me()");
  await farm();
  await owner(
    "select public.arena_grant_leaves($1, 100000, 'test', 'tools', public.arena_today())",
    [player],
  );
  await owner(
    "insert into public.arena_farm_seeds(player_id, crop, qty) values ($1, 'wheat', 500) on conflict (player_id, crop) do update set qty = 500",
    [player],
  );
  await plots("owned = true", [...Array(50).keys()]);
}, 60000);
afterAll(async () => db.close());

it("sells each tool once, at the shared level and price", async () => {
  let f = await farm();
  expect(f.tools).toEqual({
    can: 1,
    bigNet: false,
    sickle: false,
    scarecrow: false,
    sprinklers: 0,
  });
  expect(
    (await act([{ a: "buy-tool", tool: "scarecrow" }])).results[0],
  ).toEqual({ ok: false, error: "Unlocks at farm level 4" });
  await tools("level = 50");
  expect((await act([{ a: "buy-tool", tool: "can3" }])).results[0]).toEqual({
    ok: false,
    error: "Buy the Copper Can first",
  });
  f = await farm();
  for (const t of FARM_TOOLS) {
    // One level short, then at the level.
    await tools(`level = ${t.level - 1}`);
    expect(
      (await act([{ a: "buy-tool", tool: t.id }])).results[0].error,
      t.id,
    ).toBe(`Unlocks at farm level ${t.level}`);
    await tools("level = 50");
    const r = await act([{ a: "buy-tool", tool: t.id }]);
    expect(r.results[0], t.id).toMatchObject({ ok: true, cost: t.price });
    expect(f.leaves - r.farm.leaves, t.id).toBe(t.price);
    f = r.farm;
    expect((await act([{ a: "buy-tool", tool: t.id }])).results[0].error).toBe(
      "You already have it",
    );
  }
  for (let n = 0; n < 5; n++) {
    await tools(`level = ${SPRINKLER_LEVELS[n] - 1}`);
    expect(
      (await act([{ a: "buy-tool", tool: "sprinkler" }])).results[0].error,
    ).toBe(`Unlocks at farm level ${SPRINKLER_LEVELS[n]}`);
    await tools("level = 50");
    const r = await act([{ a: "buy-tool", tool: "sprinkler" }]);
    expect(r.results[0]).toMatchObject({ ok: true, cost: SPRINKLER_PRICES[n] });
    expect(f.leaves - r.farm.leaves).toBe(SPRINKLER_PRICES[n]);
    f = r.farm;
  }
  expect(
    (await act([{ a: "buy-tool", tool: "sprinkler" }])).results[0].error,
  ).toBe("Every row has a sprinkler");
  expect(f.tools).toEqual({
    can: 3,
    bigNet: true,
    sickle: true,
    scarecrow: true,
    sprinklers: 5,
  });
});

it("waters the can's area, plants watered under a sprinkler, and harvests 3×3 with the Sickle", async () => {
  // Plant the whole field; with 5 sprinklers every crop starts watered.
  let r = await act(
    [...Array(50).keys()].map((plot) => ({ a: "plant", plot, crop: "wheat" })),
  );
  expect(r.results.every((x: any) => x.ok)).toBe(true);
  expect(r.farm.plots.every((p: any) => p.wet)).toBe(true);
  expect(ripeIn(r.farm, 0)).toBeCloseTo(W / 1.35, -1);
  await act([...Array(50).keys()].map((plot) => ({ a: "dig", plot })));
  // Two sprinklers: rows 1 and 2 only.
  await tools("sprinklers = 2, can_level = 1");
  r = await act(
    [...Array(50).keys()].map((plot) => ({ a: "plant", plot, crop: "wheat" })),
  );
  expect(r.farm.plots.filter((p: any) => p.wet).map((p: any) => p.i)).toEqual([
    ...Array(20).keys(),
  ]);
  // Wood can: one plot. Copper: three in a row. Gold: 3×3 (cut at the edge).
  r = await act([{ a: "water", plot: 22 }]);
  expect(r.results[0]).toMatchObject({ ok: true, watered: [22] });
  await tools("can_level = 2");
  r = await act([{ a: "water", plot: 25 }]);
  expect(r.results[0].watered).toEqual(farmArea(25, 2));
  expect(r.results[0].watered).toEqual([24, 25, 26]);
  await tools("can_level = 3");
  r = await act([{ a: "water", plot: 49 }]);
  expect(r.results[0].watered).toEqual(farmArea(49, 3));
  expect(r.results[0].watered).toEqual([38, 39, 48, 49]);
  // Only dry plots count; all wet is an error.
  r = await act([{ a: "water", plot: 25 }]);
  expect(r.results[0].watered).toEqual([34, 35, 36]);
  expect((await act([{ a: "water", plot: 5 }])).results[0]).toEqual({
    ok: false,
    error: "Already watered",
  });
  // The Sickle: every ripe plot of the 3×3, one harvest each.
  await plots(
    "progress = 1, progress_at = now() - interval '1 minute'",
    [0, 1, 2, 10, 11, 12, 20, 21],
  );
  const before = r.farm;
  r = await act([{ a: "harvest", plot: 11, tool: "sickle" }]);
  expect(r.results[0].ok).toBe(true);
  expect(r.results[0].harvested.map((h: any) => h.plot)).toEqual([
    0, 1, 2, 10, 11, 12, 20, 21,
  ]);
  expect(r.combo).toBe(8);
  expect(r.farm.harvests.wheat - (before.harvests.wheat ?? 0)).toBe(8);
  const wheat = (f: any) =>
    f.barn
      .filter((b: any) => b.crop === "wheat")
      .reduce((s: number, b: any) => s + b.qty, 0);
  expect(wheat(r.farm) - wheat(before)).toBe(16);
  // By hand: one plot only, and the old errors.
  expect((await act([{ a: "harvest", plot: 22 }])).results[0]).toEqual({
    ok: false,
    error: "Not ripe yet",
  });
  await tools("sickle = false");
  expect(
    (await act([{ a: "harvest", plot: 33, tool: "sickle" }])).results[0],
  ).toEqual({ ok: false, error: "Buy the Sickle first" });
  await tools("sickle = true");
  await act([...Array(50).keys()].map((plot) => ({ a: "dig", plot })));
});

it("brings bugs only while you are on the farm, and half as many with a Scarecrow", async () => {
  await act(
    [...Array(50).keys()].map((plot) => ({ a: "plant", plot, crop: "wheat" })),
  );
  // Grow slowly enough that nothing ripens during the test.
  await plots("progress = 0, progress_at = now(), planted_at = now()", [
    ...Array(50).keys(),
  ]);
  const bugs = async () =>
    Number(
      (
        await owner(
          "select coalesce(sum(pests), 0)::int n from public.arena_farm_plots where player_id = $1",
          [player],
        )
      )[0].n,
    );
  const clear = () => plots("pests = 0", [...Array(50).keys()]);
  /** Rolls as if the last visit was `secs` ago, `times` times. */
  const roll = async (secs: number, times: number) => {
    let n = 0;
    for (let k = 0; k < times; k++) {
      await tools(`seen_at = now() - make_interval(secs => ${secs})`);
      n += (await owner("select public.arena_farm_bugs($1) n", [player]))[0].n;
    }
    return n;
  };
  // Turned off for the session (as the other farm tests do): nothing.
  await tools("scarecrow = false");
  expect(await roll(60, 20)).toBe(0);
  await db.exec("select set_config('arena.farm_bugs', 'on', false)");
  // Away for longer than 150 s: you weren't on the farm, so no bugs at all.
  expect(await roll(151, 40)).toBe(0);
  expect(await roll(3600 * 5, 5)).toBe(0);
  expect(await bugs()).toBe(0);
  // 120 s on the farm for 50 plots, 100 times: about 50 × 100 × (1 -
  // e^(-BUG_RATE × 120)) bugs, a little fewer as plots reach two. (A fixed
  // seed keeps the count the same every run.)
  const expected = 50 * 100 * (1 - Math.exp(-BUG_RATE * 120));
  await clear();
  await owner("select setseed(0.42)");
  const plain = await roll(120, 100);
  expect(plain).toBeGreaterThan(expected * 0.6);
  expect(plain).toBeLessThan(expected * 1.4);
  expect(await bugs()).toBe(plain);
  // The same rolls with a Scarecrow: half the chance.
  await clear();
  await tools("scarecrow = true");
  await owner("select setseed(0.42)");
  const scared = await roll(120, 100);
  expect(scared).toBeLessThan(plain);
  expect(scared).toBeGreaterThan(expected * 0.25);
  expect(scared).toBeLessThan(expected * 0.75);
  // Never more than two from nature.
  const [{ m }] = await owner(
    "select max(pests)::int m from public.arena_farm_plots where player_id = $1",
    [player],
  );
  expect(m).toBeLessThanOrEqual(2);
  // A farm read stamps the visit: the next read soon after counts that time.
  await clear();
  await tools("seen_at = null");
  await farm();
  const [{ seen }] = await owner(
    "select extract(epoch from now() - seen_at)::float seen from public.arena_farms where player_id = $1",
    [player],
  );
  expect(seen).toBeLessThan(5);
  await db.exec("select set_config('arena.farm_bugs', 'off', false)");
  await act([...Array(50).keys()].map((plot) => ({ a: "dig", plot })));
});

it("slows a crop 20% a bug; catching one pays 1 XP and keeps a ripe crop's moment", async () => {
  await clearPests();
  let r = await act([
    { a: "plant", plot: 30, crop: "wheat" },
    { a: "plant", plot: 31, crop: "wheat" },
  ]);
  // The fourth row has no sprinkler (two bought): wheat ripens in W seconds.
  expect(ripeIn(r.farm, 30)).toBeCloseTo(W, -1);
  await owner("select public.arena_farm_set_pests($1, 30, 1, now())", [player]);
  await owner("select public.arena_farm_set_pests($1, 31, 2, now())", [player]);
  let f = await farm();
  expect(f.plots[30].pests).toBe(1);
  expect(ripeIn(f, 30)).toBeCloseTo(W / 0.8, -1);
  expect(ripeIn(f, 31)).toBeCloseTo(W / 0.6, -1);
  // By hand: one bug from one plot, +1 XP.
  await tools("big_net = false");
  r = await act([{ a: "catch", plot: 31 }]);
  expect(r.results[0]).toEqual({ ok: true, caught: 1, xp: 1 });
  expect(r.xp).toBe(1);
  expect(r.farm.plots[31].pests).toBe(1);
  expect(ripeIn(r.farm, 31)).toBeCloseTo(W / 0.8, -1);
  // The Big Net: one from each plot of the 3×3.
  await tools("big_net = true");
  r = await act([{ a: "catch", plot: 30, tool: "net" }]);
  expect(r.results[0]).toEqual({ ok: true, caught: 2, xp: 2 });
  expect(r.farm.plots[30].pests).toBe(0);
  expect(r.farm.plots[31].pests).toBe(0);
  expect(ripeIn(r.farm, 30)).toBeCloseTo(W, -1);
  expect((await act([{ a: "catch", plot: 30 }])).results[0]).toEqual({
    ok: false,
    error: "No bugs here",
  });
  // A crop that ripened with a bug on it keeps the moment it ripened.
  await plots(
    "progress = 1, progress_at = timestamptz '2026-01-01 10:00Z', pests = 1",
    [30],
  );
  await plots(
    `progress = ${1 - 36 / W}, progress_at = now() - interval '1 hour', pests = 1`,
    [31],
  );
  r = await act([{ a: "catch", plot: 30, tool: "net" }]);
  expect(r.results[0].caught).toBe(2);
  const rows = await owner(
    "select idx, progress, progress_at from public.arena_farm_plots where player_id = $1 and idx in (30, 31) order by idx",
    [player],
  );
  expect(rows[0].progress).toBe(1);
  expect(new Date(rows[0].progress_at).toISOString()).toBe(
    "2026-01-01T10:00:00.000Z",
  );
  // The last 36 s of growth at 80% speed: 45 s after the old baseline.
  expect(rows[1].progress).toBe(1);
  expect(
    (Date.parse(rows[1].progress_at) - (Date.parse(r.farm.now) - 3600_000)) /
      1000,
  ).toBeCloseTo(45, -1);
  // Harvesting clears any bugs left.
  await plots("pests = 2", [30]);
  r = await act([{ a: "harvest", plot: 30 }]);
  expect(r.results[0]).toMatchObject({ ok: true, crop: "wheat", qty: 2 });
  expect(r.farm.plots[30].pests).toBe(0);
});

async function clearPests() {
  await plots("pests = 0", [...Array(50).keys()]);
}
