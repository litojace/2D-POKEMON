import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import { CROPS } from "../../packages/shared/src/farm";

// Migration 041: crop book rewards, paid once each right after the harvest
// that finds the crop.
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000411";
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
/** Mark crops as already found (harvested once). */
const found = (ids: string[]) =>
  owner(
    `insert into public.arena_farm_harvests(player_id, crop, harvests)
     select $1, c, 1 from unnest($2::text[]) c on conflict do nothing`,
    [player, ids],
  );
const ripeWheat = async (plot: number) => {
  await act([{ a: "plant", plot, crop: "wheat" }]);
  await owner(
    "update public.arena_farm_plots set progress = 1, progress_at = now() - interval '1 minute' where player_id = $1 and idx = $2",
    [player, plot],
  );
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
    "reset role;insert into public.arena_farm_weather_pin(id, weather) values (1, 'none')",
  );
  await db.exec(
    `reset role;insert into auth.users values('${player}','{"display_name":"Book tester"}')`,
  );
  await login();
  await db.query("select public.arena_me()");
}, 60000);
afterAll(async () => db.close());

it("pays the 5-crop reward with the harvest that finds the fifth crop", async () => {
  const before = await farm();
  expect(before.bookRewards).toEqual([]);
  await ripeWheat(0);
  await found(["carrot", "voltberry", "mint", "pepper"]);
  const r = await act([{ a: "harvest", plot: 0 }]);
  expect(r.results[0]).toMatchObject({ ok: true, crop: "wheat" });
  expect(r.book).toEqual([5]);
  expect(r.farm.bookRewards).toEqual([5]);
  expect(r.farm.leaves - before.leaves).toBe(100);
  // Another harvest pays nothing more.
  await ripeWheat(0);
  const again = await act([{ a: "harvest", plot: 0 }]);
  expect(again.book).toBeUndefined();
  expect(again.farm.leaves).toBe(r.farm.leaves);
});

it("pays 10, 15, 20 and 25 once each, and the title at 25", async () => {
  const before = await farm();
  // (In play only a harvest finds a crop; here they are marked found after planting.)
  await ripeWheat(1);
  await found(CROPS.slice(0, 24).map((c) => c.id));
  const r = await act([{ a: "harvest", plot: 1 }]);
  // 15 is the Golden Voltkit Statue (migration 048).
  expect(r.book).toEqual([10, 15, 20]);
  expect(r.farm.fertilizer.gold - before.fertilizer.gold).toBe(2);
  expect(r.farm.leaves - before.leaves).toBe(1000);
  await ripeWheat(1);
  await found(CROPS.map((c) => c.id));
  const last = await act([{ a: "harvest", plot: 1 }]);
  expect(last.book).toEqual([25]);
  expect(last.farm.bookRewards).toEqual([5, 10, 15, 20, 25]);
  const titles = await owner(
    `select t.name from public.arena_player_titles p join public.arena_titles t on t.id = p.title_id
     where p.player_id = $1 and t.name = 'Elemental Botanist'`,
    [player],
  );
  expect(titles).toHaveLength(1);
  // Running the migration again pays nothing twice.
  const leaves = last.farm.leaves;
  await db.exec(
    "reset role;" +
      (await readFile("supabase/migrations/041_farm_book.sql", "utf8")),
  );
  expect((await farm()).leaves).toBe(leaves);
});
