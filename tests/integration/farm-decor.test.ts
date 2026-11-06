import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import { CROPS, FARM_DECOR, charmBonus } from "../../packages/shared/src/farm";

// Migration 048: decorations, Charm and the crop book's statue.
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000481";
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
const place = async (slot: number, item: string) =>
  (await act([{ a: "decor", slot, item }])).results[0];

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
    `reset role;insert into auth.users values('${player}','{"display_name":"Decor tester"}')`,
  );
  await login();
  await db.query("select public.arena_me()");
  await farm();
  await owner(
    "select public.arena_grant_leaves($1, 100000, 'test', 'decor', public.arena_today())",
    [player],
  );
}, 60000);
afterAll(async () => db.close());

it("sells the shared decorations at their level and price, one per spot", async () => {
  const items = await owner(
    "select id, name, price, charm, level from public.arena_farm_decor_items order by level, id",
  );
  expect(items).toEqual(
    [...FARM_DECOR]
      .sort((a, b) => a.level - b.level || a.id.localeCompare(b.id))
      .map(({ id, name, price, charm, level }) => ({
        id,
        name,
        price,
        charm,
        level,
      })),
  );
  let f = await farm();
  expect(f).toMatchObject({ decor: [], charm: 0, decorCredits: {} });
  expect(await place(0, "lamp")).toEqual({
    ok: false,
    error: "Unlocks at farm level 12",
  });
  expect(await place(8, "rock")).toEqual({ ok: false, error: "Choose a spot" });
  expect(await place(0, "throne")).toEqual({
    ok: false,
    error: "Unknown decoration",
  });
  await owner("update public.arena_farms set level = 30 where player_id = $1", [
    player,
  ]);
  const r = await act([
    { a: "decor", slot: 0, item: "lamp" },
    { a: "decor", slot: 1, item: "apple" },
    { a: "decor", slot: 1, item: "apple" },
  ]);
  expect(r.results).toEqual([
    { ok: true, decor: "lamp", slot: 0, cost: 1350 },
    { ok: true, decor: "apple", slot: 1, cost: 4200 },
    { ok: false, error: "That is already there" },
  ]);
  expect(f.leaves - r.farm.leaves).toBe(1350 + 4200);
  expect(r.farm.decor).toEqual([
    { slot: 0, item: "lamp" },
    { slot: 1, item: "apple" },
  ]);
  expect(r.farm.charm).toBe(2 + 4);
  // Replacing pays for the new one; the old one goes to storage.
  f = r.farm;
  const swap = await act([{ a: "decor", slot: 0, item: "rock" }]);
  expect(swap.results[0]).toEqual({
    ok: true,
    decor: "rock",
    slot: 0,
    cost: 300,
    stored: "lamp",
  });
  expect(swap.farm.charm).toBe(1 + 4);
  expect(swap.farm.decorCredits).toEqual({ lamp: 1 });
  // Putting one away: no leaves back, but it goes to storage.
  const away = await act([
    { a: "decor-remove", slot: 1 },
    { a: "decor-remove", slot: 1 },
  ]);
  expect(away.results).toEqual([
    { ok: true, removed: 1, stored: "apple" },
    { ok: false, error: "Nothing there" },
  ]);
  expect(away.farm.decor).toEqual([{ slot: 0, item: "rock" }]);
  expect(away.farm.charm).toBe(1);
  expect(away.farm.leaves).toBe(swap.farm.leaves);
  expect(away.farm.decorCredits).toEqual({ lamp: 1, apple: 1 });
  // A stored one places again for free, even over another (which is stored).
  const back = await act([
    { a: "decor", slot: 5, item: "apple" },
    { a: "decor", slot: 0, item: "lamp" },
  ]);
  expect(back.results).toEqual([
    { ok: true, decor: "apple", slot: 5, cost: 0 },
    { ok: true, decor: "lamp", slot: 0, cost: 0, stored: "rock" },
  ]);
  expect(back.farm.leaves).toBe(away.farm.leaves);
  expect(back.farm.decorCredits).toEqual({ rock: 1 });
  expect(back.farm.charm).toBe(4 + 2);
  // Storage lasts: a stored decoration places before its level, like a reward.
  await owner("update public.arena_farms set level = 1 where player_id = $1", [
    player,
  ]);
  await act([{ a: "decor-remove", slot: 0 }]);
  const low = await act([{ a: "decor", slot: 3, item: "lamp" }]);
  expect(low.results[0]).toMatchObject({ ok: true, cost: 0 });
  expect(low.farm.decorCredits).toEqual({ rock: 1 });
  // Clean up for the next tests.
  await owner(
    "delete from public.arena_farm_decor_credits where player_id = $1",
    [player],
  );
  await owner(
    "update public.arena_farm_decor set item = null where player_id = $1 and slot in (0, 3, 5)",
    [player],
  );
  await owner(
    "insert into public.arena_farm_decor(player_id, slot, item) values ($1, 0, 'rock') on conflict (player_id, slot) do update set item = 'rock'",
    [player],
  );
});

it("adds 1% farm XP for every 2 Charm, up to 25%", async () => {
  const xpAfter = async (add: number) => {
    await owner(
      "update public.arena_farms set level = 30, xp = 0 where player_id = $1",
      [player],
    );
    await owner("select public.arena_farm_add_xp($1, $2)", [player, add]);
    return Number(
      (
        await owner("select xp from public.arena_farms where player_id = $1", [
          player,
        ])
      )[0].xp,
    );
  };
  // Charm 1: no bonus yet.
  expect(await xpAfter(100)).toBe(100);
  // Gazebo (10) + Rock (1) = 11 Charm: +5%.
  await owner("update public.arena_farms set level = 45 where player_id = $1", [
    player,
  ]);
  await place(2, "tower");
  expect((await farm()).charm).toBe(11);
  expect(charmBonus(11)).toBe(5);
  expect(await xpAfter(100)).toBe(105);
  // Many decorations: capped at 25%.
  await owner(
    `insert into public.arena_farm_decor(player_id, slot, item) values
     ($1, 3, 'plum'), ($1, 4, 'plum'), ($1, 5, 'tower'), ($1, 6, 'tower'), ($1, 7, 'statue')
     on conflict (player_id, slot) do update set item = excluded.item`,
    [player],
  );
  expect((await farm()).charm).toBeGreaterThan(50);
  expect(await xpAfter(100)).toBe(125);
});

it("gives the Golden Voltkit Statue for 15 crops, placeable before level 75", async () => {
  await owner(
    "update public.arena_farm_decor set item = null where player_id = $1",
    [player],
  );
  await owner("update public.arena_farms set level = 20 where player_id = $1", [
    player,
  ]);
  expect(await place(0, "statue")).toEqual({
    ok: false,
    error: "Unlocks at farm level 75",
  });
  // Find 15 crops: the reward is a free statue.
  await owner(
    `insert into public.arena_farm_harvests(player_id, crop, harvests)
     select $1, c, 1 from unnest($2::text[]) c on conflict do nothing`,
    [player, CROPS.slice(0, 15).map((c) => c.id)],
  );
  await owner("select public.arena_farm_book_rewards($1)", [player]);
  let f = await farm();
  expect(f.bookRewards).toEqual([5, 10, 15]);
  expect(f.decorCredits).toEqual({ statue: 1 });
  const r = await act([{ a: "decor", slot: 0, item: "statue" }]);
  expect(r.results[0]).toEqual({
    ok: true,
    decor: "statue",
    slot: 0,
    cost: 0,
  });
  expect(r.farm.leaves).toBe(f.leaves);
  expect(r.farm.decorCredits).toEqual({});
  expect(r.farm.charm).toBe(15);
  // Only once.
  expect(await place(1, "statue")).toEqual({
    ok: false,
    error: "Unlocks at farm level 75",
  });
  await owner("select public.arena_farm_book_rewards($1)", [player]);
  f = await farm();
  expect(f.decorCredits).toEqual({});
});
