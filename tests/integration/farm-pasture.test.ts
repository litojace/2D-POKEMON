import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import { MILK, PASTURE, milkPrice } from "../../packages/shared/src/farm";

// Migration 049: the Cow Pasture, Storm Milk and treats in the Plaza.
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000491";
const friend = "00000000-0000-4000-8000-000000000492";
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
const one = async (a: object) => (await act([a])).results[0];
const barn = async (crop: string, mutation = "") =>
  Number(
    (
      await owner(
        "select coalesce(sum(qty), 0)::int n from public.arena_farm_barn where player_id = $1 and crop = $2 and mutation = $3",
        [player, crop, mutation],
      )
    )[0].n,
  );
const treat = async (ref = randomUUID()) => {
  await login();
  return (
    await db.query<{ r: any }>("select public.arena_plaza_treat($1::uuid) r", [
      ref,
    ])
  ).rows[0].r;
};
const treats = async () => {
  await login();
  return (await db.query<{ n: number }>("select public.arena_plaza_treats() n"))
    .rows[0].n;
};

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
    `reset role;insert into auth.users values('${player}','{"display_name":"Pasture tester"}'),('${friend}','{"display_name":"Pasture friend"}')`,
  );
  for (const who of [player, friend]) {
    await login(who);
    await db.query("select public.arena_me()");
    await db.query("select public.arena_farm()");
  }
  await owner(
    "select public.arena_grant_leaves($1, 100000, 'test', 'pasture', public.arena_today())",
    [player],
  );
}, 60000);
afterAll(async () => db.close());

it("opens the pasture at farm level 9 for 900 leaves, once", async () => {
  let f = await farm();
  expect(f).toMatchObject({ pasture: false, milkAt: null });
  expect(await one({ a: "buy-pasture" })).toEqual({
    ok: false,
    error: `Unlocks at farm level ${PASTURE.level}`,
  });
  await owner(
    "update public.arena_farms set level = $2, xp = 0 where player_id = $1",
    [player, PASTURE.level],
  );
  f = await farm();
  const r = await act([{ a: "buy-pasture" }, { a: "buy-pasture" }]);
  expect(r.results[0]).toMatchObject({ ok: true, pasture: true });
  expect(r.results[1]).toEqual({
    ok: false,
    error: "You already have the pasture",
  });
  expect(f.leaves - r.farm.leaves).toBe(PASTURE.price);
  expect(r.farm.pasture).toBe(true);
  expect(r.farm.xp - f.xp).toBe(PASTURE.xp);
  // The first milk comes 1 h 20 m later.
  const wait = (Date.parse(r.farm.milkAt) - Date.parse(r.farm.now)) / 1000;
  expect(wait).toBeGreaterThan(PASTURE.firstMilkSeconds - 5);
  expect(wait).toBeLessThanOrEqual(PASTURE.firstMilkSeconds);
  expect(await one({ a: "milk" })).toEqual({
    ok: false,
    error: "The cow is still grazing",
  });
});

it("milks 2 Storm Milk every 5 h 20 m into the barn, which it fills", async () => {
  await owner(
    "update public.arena_farms set milk_at = now() - interval '1 second' where player_id = $1",
    [player],
  );
  const before = await farm();
  const r = await act([{ a: "milk" }, { a: "milk" }]);
  expect(r.results[0]).toMatchObject({ ok: true, milk: PASTURE.milk });
  expect(r.results[1]).toEqual({
    ok: false,
    error: "The cow is still grazing",
  });
  expect(r.farm.xp - before.xp).toBe(PASTURE.milkXp);
  expect(r.farm.barn).toContainEqual({
    crop: MILK.id,
    mutation: "",
    qty: PASTURE.milk,
  });
  const wait = (Date.parse(r.farm.milkAt) - Date.parse(r.farm.now)) / 1000;
  expect(wait).toBeGreaterThan(PASTURE.milkSeconds - 5);
  expect(wait).toBeLessThanOrEqual(PASTURE.milkSeconds);
  // Milk takes barn space: with the barn full, the cow waits.
  await owner(
    "insert into public.arena_farm_barn(player_id, crop, mutation, qty) values ($1, 'wheat', '', 79) on conflict (player_id, crop, mutation) do update set qty = 79",
    [player],
  );
  await owner(
    "update public.arena_farms set milk_at = now() - interval '1 second' where player_id = $1",
    [player],
  );
  expect(await one({ a: "milk" })).toEqual({
    ok: false,
    error: "Your barn is full",
  });
  // A harvest counts the milk too: 2 milk + 77 wheat, and 2 more won't fit.
  await owner(
    "update public.arena_farm_barn set qty = 77 where player_id = $1 and crop = 'wheat'",
    [player],
  );
  await owner(
    "update public.arena_farm_plots set owned = true, crop = 'wheat', planted_at = now() - interval '2 hours', progress = 1, progress_at = now() - interval '1 minute' where player_id = $1 and idx = 0",
    [player],
  );
  expect(await one({ a: "harvest", plot: 0 })).toEqual({
    ok: false,
    error: "Your barn is full",
  });
  // With 76 wheat it fits exactly (80).
  await owner(
    "update public.arena_farm_barn set qty = 76 where player_id = $1 and crop = 'wheat'",
    [player],
  );
  expect(await one({ a: "harvest", plot: 0 })).toMatchObject({
    ok: true,
    crop: "wheat",
  });
  await owner(
    "update public.arena_farm_barn set qty = 0 where player_id = $1 and crop = 'wheat'",
    [player],
  );
});

it("sells Storm Milk at 60 leaves times its price of the day", async () => {
  const f = await farm();
  expect(f.milkMult).toBeGreaterThanOrEqual(MILK.multMin);
  expect(f.milkMult).toBeLessThanOrEqual(MILK.multMax);
  // The same price for everyone today.
  await login(friend);
  const theirs = (await db.query<{ f: any }>("select public.arena_farm() f"))
    .rows[0].f;
  expect(theirs.milkMult).toBe(f.milkMult);
  expect(await one({ a: "sell-milk", qty: 3 })).toEqual({
    ok: false,
    error: "You don't have that many",
  });
  expect(await one({ a: "sell-milk", qty: 0 })).toEqual({
    ok: false,
    error: "Choose how many to sell",
  });
  const r = await act([{ a: "sell-milk", qty: 2 }]);
  expect(r.results[0]).toEqual({ ok: true, leaves: milkPrice(f.milkMult) * 2 });
  expect(r.farm.leaves - f.leaves).toBe(milkPrice(f.milkMult) * 2);
  expect(await barn(MILK.id)).toBe(0);
  // Milk is not a crop: the crop sale refuses it.
  await owner(
    "insert into public.arena_farm_barn(player_id, crop, mutation, qty) values ($1, 'milk', '', 1) on conflict (player_id, crop, mutation) do update set qty = 1",
    [player],
  );
  expect(await one({ a: "sell", crop: "milk", qty: 1 })).toEqual({
    ok: false,
    error: "Unknown crop",
  });
  await owner(
    "update public.arena_farm_barn set qty = 0 where player_id = $1 and crop = 'milk'",
    [player],
  );
});

it("lets the barn hold crops and milk only", async () => {
  await expect(
    owner(
      "insert into public.arena_farm_barn(player_id, crop, mutation, qty) values ($1, 'cheese', '', 1)",
      [player],
    ),
  ).rejects.toThrow(/foreign key/);
  // A crop added later is a barn good too.
  await owner(
    "insert into public.arena_farm_crops(id, name, level, grow_seconds, seed_cost, sell, xp, rarity) values ('testfig', 'Test Fig', 99, 60, 1, 1, 1, 'common')",
  );
  await owner(
    "insert into public.arena_farm_barn(player_id, crop, mutation, qty) values ($1, 'testfig', '', 1)",
    [player],
  );
  await owner(
    "delete from public.arena_farm_barn where player_id = $1 and crop = 'testfig'",
    [player],
  );
  await owner("delete from public.arena_farm_crops where id = 'testfig'");
});

it("throws treats from regular crops: the most you have, the cheapest on a tie", async () => {
  await owner("delete from public.arena_farm_barn where player_id = $1", [
    player,
  ]);
  expect(await treats()).toBe(0);
  expect(await treat()).toEqual({
    ok: false,
    error: "No crops to throw yet. Harvest some on the Farm.",
    left: 0,
  });
  await owner(
    `insert into public.arena_farm_barn(player_id, crop, mutation, qty) values
     ($1, 'wheat', '', 2), ($1, 'melon', '', 2), ($1, 'carrot', 'shock', 9), ($1, 'milk', '', 9)`,
    [player],
  );
  // Mutated crops and milk are not treats.
  expect(await treats()).toBe(4);
  // Wheat (5) and melon (22) tie at 2: wheat goes first.
  expect(await treat()).toEqual({ ok: true, crop: "wheat", left: 3 });
  // Then melon has the most.
  expect(await treat()).toEqual({ ok: true, crop: "melon", left: 2 });
  // A retried throw is answered, never taken twice.
  const ref = randomUUID();
  expect(await treat(ref)).toEqual({ ok: true, crop: "wheat", left: 1 });
  expect(await treat(ref)).toEqual({
    ok: false,
    error: "Already thrown",
    left: 1,
  });
  expect(await barn("wheat")).toBe(0);
  expect(await barn("melon")).toBe(1);
  expect(await barn("carrot", "shock")).toBe(9);
  expect(await barn("milk")).toBe(9);
  // Only for signed-in players.
  await db.exec(
    "reset role;select set_config('request.jwt.claim.sub','',false);set role anon",
  );
  await expect(
    db.query("select public.arena_plaza_treat($1::uuid)", [randomUUID()]),
  ).rejects.toThrow(/permission denied/);
});

it("shows a friend's pasture", async () => {
  await owner(
    "insert into public.arena_friendships(a, b) values ($1, $2) on conflict do nothing",
    [player, friend].sort(),
  );
  await login(friend);
  const view = (
    await db.query<{ v: any }>("select public.arena_farm_friend($1) v", [
      player,
    ])
  ).rows[0].v;
  expect(view.pasture).toBe(true);
});
