import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import { FIGHTER_IDS } from "../../packages/shared/src/index";
import {
  FARM_PERK_OF,
  FARM_PERKS,
  farmPerk,
  farmPerkOf,
} from "../../packages/shared/src/farm";

// Migration 055: the eight newest champions farm with the perk of the
// original champion of their element.
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000551";
const friend = "00000000-0000-4000-8000-000000000552";
const as = (id: string) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`,
  );
const farm = async () => {
  await as(player);
  return (await db.query<{ f: any }>("select public.arena_farm() f")).rows[0].f;
};
const act = async (actions: object[]) => {
  await as(player);
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
const farmer = async (id: string) => {
  const r = await act([{ a: "farmer", id }]);
  expect(r.results[0]?.error, id).toBeUndefined();
  return r.farm;
};
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
  for (const [id, name] of [
    [player, "Twin tester"],
    [friend, "Friend"],
  ]) {
    await owner(
      "insert into auth.users values($1, jsonb_build_object('display_name', $2::text))",
      [id, name],
    );
    await as(id);
    await db.query("select public.arena_me()");
  }
  await owner("insert into public.arena_friendships(a, b) values ($1, $2)", [
    player,
    friend,
  ]);
  await farm();
  await owner(
    "insert into public.arena_farm_seeds(player_id, crop, qty) values ($1, 'wheat', 100) on conflict (player_id, crop) do update set qty = 100",
    [player],
  );
  await plots("owned = true", [...Array(50).keys()]);
}, 60000);
afterAll(async () => db.close());

it("maps every champion to a perk, the same in SQL and in the client", async () => {
  const sqlMap = await owner(
    "select id, public.arena_farm_perk_of(id) perk from unnest($1::text[]) id",
    [FIGHTER_IDS],
  );
  for (const { id, perk } of sqlMap) {
    expect(perk, id).toBe(farmPerkOf(id));
    expect(Object.keys(FARM_PERKS), id).toContain(perk);
    expect(farmPerk(id), id).toBe(FARM_PERKS[perk]);
  }
  // Each of the eight newest has the perk of the original of its element.
  const { CHARACTERS } = await import("../../packages/shared/src/index");
  for (const [id, twin] of Object.entries(FARM_PERK_OF))
    expect(
      CHARACTERS[id as keyof typeof CHARACTERS].element,
      `${id} and ${twin}`,
    ).toBe(CHARACTERS[twin as keyof typeof CHARACTERS].element);
  expect(Object.keys(FARM_PERK_OF)).toHaveLength(8);
  expect(farmPerk(null)).toBeNull();
});

it("Sunbara has Early Sun (Lumoth's)", async () => {
  await farmer("voltkit");
  const r = await act([{ a: "plant", plot: 0, crop: "wheat" }]);
  expect(ripeIn(r.farm, 0)).toBeCloseTo(3600, -1);
  expect(ripeIn(await farmer("sunbara"), 0)).toBeCloseTo(3600 / 1.2, -1);
});

it("Wombolder has Rich Soil and Shadopus Night Stalker", async () => {
  await plots("progress = 1, progress_at = now() - interval '1 minute'", [0]);
  let f = await farmer("wombolder");
  let r = await act([{ a: "harvest", plot: 0 }]);
  expect(r.results[0]).toMatchObject({ ok: true, crop: "wheat", qty: 3 });
  expect(wheat(r.farm) - wheat(f)).toBe(3);
  await farmer("shadopus");
  await act([{ a: "plant", plot: 1, crop: "wheat" }]);
  await plots("pests = 2", [1]);
  f = await farm();
  r = await act([{ a: "catch", plot: 1 }]);
  expect(r.results[0]).toMatchObject({ ok: true, caught: 1 });
  expect(wheat(r.farm) - wheat(f)).toBe(1);
});

it("Coilemur, Glacelle and Pyranda have Zap, Downpour and Warmth", async () => {
  await act([2, 3].map((plot) => ({ a: "plant", plot, crop: "wheat" })));
  await plots("pests = 1", [2, 3]);
  await farmer("coilemur");
  let r = await act([{ a: "perk" }]);
  expect(r.results[0]).toMatchObject({ ok: true, perk: "zap" });
  expect(r.farm.plots.every((p: any) => p.pests === 0)).toBe(true);
  await farmer("glacelle");
  r = await act([{ a: "perk" }]);
  expect(r.results[0]).toMatchObject({ ok: true, perk: "downpour" });
  await farmer("pyranda");
  r = await act([{ a: "perk" }]);
  expect(r.results[0]).toMatchObject({ ok: true, perk: "warmth" });
  // A perk is once a day whoever uses it: Voltkit's Zap is spent too.
  await farmer("voltkit");
  expect((await act([{ a: "perk" }])).results[0]).toEqual({
    ok: false,
    error: "Already used today. It's back tomorrow",
  });
  // The passive twins have nothing to tap.
  for (const id of [
    "halcyra",
    "sunbara",
    "astrabun",
    "wombolder",
    "shadopus",
  ]) {
    await farmer(id);
    expect((await act([{ a: "perk" }])).results[0], id).toEqual({
      ok: false,
      error: "Your farmer's perk is always on",
    });
  }
});

it("Astrabun has Foresight and Halcyra Shield", async () => {
  await db.exec("reset role;delete from public.arena_farm_weather_pin");
  expect(Object.keys((await farmer("coilemur")).weather)).not.toContain(
    "later",
  );
  expect(Object.keys((await farmer("astrabun")).weather)).toContain("later");
  await act([{ a: "plant", plot: 40, crop: "wheat" }]);
  await farmer("halcyra");
  await as(friend);
  const r = (
    await db.query<{ r: any }>(
      "select public.arena_farm_friend_act($1,$2,$3::jsonb) r",
      [randomUUID(), player, JSON.stringify([{ a: "prank", plot: 40 }])],
    )
  ).rows[0].r;
  expect(r.results[0]).toEqual({
    ok: false,
    error: "Their Shield blocks pranks",
  });
});
