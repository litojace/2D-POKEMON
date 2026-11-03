import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import { FARM_PERKS } from "../../packages/shared/src/farm";

// Migration 046: farmer perks, following the Lobby fighter.
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000461";
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
const plots = (set: string, idx: number[]) =>
  owner(
    `update public.arena_farm_plots set ${set} where player_id = $1 and idx = any($2::int[])`,
    [player, idx],
  );
const farmer = async (id: string) => (await act([{ a: "farmer", id }])).farm;
const ripeIn = (f: any, i: number) =>
  (Date.parse(f.plots[i].ripeAt) - Date.parse(f.now)) / 1000;
const wheat = (f: any) =>
  f.barn
    .filter((b: any) => b.crop === "wheat")
    .reduce((s: number, b: any) => s + b.qty, 0);

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
    "reset role;insert into public.arena_farm_weather_pin(id, weather) values (1, 'none')",
  );
  await db.exec(
    `reset role;insert into auth.users values('${player}','{"display_name":"Perk tester"}')`,
  );
  await login();
  await db.query("select public.arena_me()");
  await farm();
  await owner(
    "insert into public.arena_farm_seeds(player_id, crop, qty) values ($1, 'wheat', 100) on conflict (player_id, crop) do update set qty = 100",
    [player],
  );
  await plots("owned = true", [...Array(50).keys()]);
}, 60000);
afterAll(async () => db.close());

it("Early Sun speeds up only the time Lumoth farms", async () => {
  let f = await farm();
  expect(f.farmer).toBe("voltkit");
  expect((await act([{ a: "farmer", id: "pikachu" }])).results[0]).toEqual({
    ok: false,
    error: "Choose a valid champion",
  });
  let r = await act([{ a: "plant", plot: 0, crop: "wheat" }]);
  expect(ripeIn(r.farm, 0)).toBeCloseTo(3600, -1);
  f = await farmer("lumoth");
  expect(f.farmer).toBe("lumoth");
  expect(ripeIn(f, 0)).toBeCloseTo(3600 / 1.2, -1);
  // Half an hour of Lumoth (from a 0.1 baseline): 0.6 grown; then back to
  // Voltkit for the rest at normal speed.
  await plots(
    "progress = 0.1, progress_at = now() - interval '1800 seconds'",
    [0],
  );
  f = await farmer("voltkit");
  expect(Number(f.plots[0].progress)).toBeCloseTo(0.1 + (1800 * 1.2) / 3600, 2);
  expect(ripeIn(f, 0)).toBeCloseTo(3600 * (1 - 0.7), -1);
  // Switching again counts nothing twice.
  const again = await farmer("voltkit");
  expect(Number(again.plots[0].progress)).toBeCloseTo(0.7, 2);
});

it("Rich Soil gives 3 crops a harvest, and Night Stalker a crop a bug", async () => {
  await plots("progress = 1, progress_at = now() - interval '1 minute'", [0]);
  let f = await farmer("terradon");
  let r = await act([{ a: "harvest", plot: 0 }]);
  expect(r.results[0]).toMatchObject({ ok: true, crop: "wheat", qty: 3 });
  expect(wheat(r.farm) - wheat(f)).toBe(3);
  await farmer("duskveil");
  await act([{ a: "plant", plot: 1, crop: "wheat" }]);
  await plots("pests = 2", [1]);
  f = await farm();
  r = await act([{ a: "catch", plot: 1 }]);
  expect(r.results[0]).toMatchObject({ ok: true, caught: 1 });
  expect(wheat(r.farm) - wheat(f)).toBe(1);
  // Not for other farmers; and harvests give 2 again.
  await farmer("voltkit");
  r = await act([{ a: "catch", plot: 1 }]);
  expect(wheat(r.farm) - wheat(f)).toBe(1);
  await plots("progress = 1, progress_at = now() - interval '1 minute'", [1]);
  r = await act([{ a: "harvest", plot: 1 }]);
  expect(r.results[0].qty).toBe(2);
});

it("Zap, Downpour and Warmth work once a Pacific day each", async () => {
  await act([0, 1, 2, 3].map((plot) => ({ a: "plant", plot, crop: "wheat" })));
  await plots("pests = 1", [0, 1]);
  await plots("pests = 2", [2]);
  // Voltkit: Zap clears every bug.
  let f = await farmer("voltkit");
  expect(f.perksUsed).toEqual([]);
  let r = await act([{ a: "perk" }]);
  expect(r.results[0]).toEqual({ ok: true, perk: "zap", cleared: 4 });
  expect(r.farm.plots.every((p: any) => p.pests === 0)).toBe(true);
  expect(r.farm.perksUsed).toEqual(["zap"]);
  expect((await act([{ a: "perk" }])).results[0]).toEqual({
    ok: false,
    error: "Already used today. It's back tomorrow",
  });
  // Tidefin: Downpour waters every growing plot.
  await farmer("tidefin");
  r = await act([{ a: "perk" }]);
  expect(r.results[0]).toEqual({
    ok: true,
    perk: "downpour",
    watered: [0, 1, 2, 3],
  });
  expect(r.farm.plots.slice(0, 4).every((p: any) => p.wet)).toBe(true);
  // Cindrake: Warmth, no bugs for 4 hours (even on the farm).
  await farmer("cindrake");
  r = await act([{ a: "perk" }]);
  expect(r.results[0]).toMatchObject({ ok: true, perk: "warmth" });
  expect(
    (Date.parse(r.farm.warmUntil) - Date.parse(r.farm.now)) / 3600e3,
  ).toBeCloseTo(4, 2);
  await db.exec("select set_config('arena.farm_bugs', 'on', false)");
  for (let k = 0; k < 30; k++) {
    await owner(
      "update public.arena_farms set seen_at = now() - interval '149 seconds' where player_id = $1",
      [player],
    );
    expect(
      (await owner("select public.arena_farm_bugs($1) n", [player]))[0].n,
    ).toBe(0);
  }
  await db.exec("select set_config('arena.farm_bugs', 'off', false)");
  expect(r.farm.perksUsed).toEqual(["downpour", "warmth", "zap"]);
  // Passive farmers have nothing to tap.
  await farmer("lumoth");
  expect((await act([{ a: "perk" }])).results[0]).toEqual({
    ok: false,
    error: "Your farmer's perk is always on",
  });
  // The next Pacific day, each is back.
  await owner(
    "update public.arena_farm_perk_uses set day = day - 1 where player_id = $1",
    [player],
  );
  await farmer("voltkit");
  expect((await act([{ a: "perk" }])).results[0]).toMatchObject({
    ok: true,
    perk: "zap",
  });
});

it("Foresight shows the third forecast; the shared perk list matches", async () => {
  await db.exec("reset role;delete from public.arena_farm_weather_pin");
  let f = await farmer("lumoth");
  expect(Object.keys(f.weather).sort()).toEqual(["next", "now", "until"]);
  f = await farmer("mystowl");
  expect(Object.keys(f.weather).sort()).toEqual([
    "later",
    "next",
    "now",
    "until",
  ]);
  expect(Object.keys(FARM_PERKS).sort()).toEqual(
    [
      "auralynx",
      "cindrake",
      "duskveil",
      "lumoth",
      "mystowl",
      "terradon",
      "tidefin",
      "voltkit",
    ].sort(),
  );
  expect(
    Object.entries(FARM_PERKS)
      .filter(([, p]) => p.active)
      .map(([id, p]) => [id, p.active]),
  ).toEqual([
    ["voltkit", "zap"],
    ["tidefin", "downpour"],
    ["cindrake", "warmth"],
  ]);
});
