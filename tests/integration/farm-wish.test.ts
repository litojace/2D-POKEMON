import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import { CROP_BY_ID } from "../../packages/shared/src/farm";

// Migration 042: the wishing well, once per Pacific day.
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000421";
const login = () =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${player}',false);set role authenticated`,
  );
const call = async (fn: string) => {
  await login();
  return (await db.query<{ r: any }>(`select public.${fn}() r`)).rows[0].r;
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
    `reset role;insert into auth.users values('${player}','{"display_name":"Wish tester"}')`,
  );
  await login();
  await db.query("select public.arena_me()");
}, 60000);
afterAll(async () => db.close());

it("grants 3 seeds once a day, from crops near your level", async () => {
  const before = await call("arena_farm");
  expect(before.wishReady).toBe(true);
  const r = await call("arena_farm_wish");
  expect(r.ok).toBe(true);
  expect(r.seeds).toHaveLength(3);
  for (const id of r.seeds)
    expect(CROP_BY_ID[id].level).toBeLessThanOrEqual(1 + 15);
  const count = (f: any) =>
    Object.values(f.seeds).reduce((a: number, n: any) => a + n, 0);
  expect(count(r.farm) - count(before)).toBe(3);
  expect(r.farm.wishReady).toBe(false);
  const again = await call("arena_farm_wish");
  expect(again).toMatchObject({
    ok: false,
    error: "You already made a wish today. Come back tomorrow",
  });
  expect(count(again.farm)).toBe(count(r.farm));
  // Tomorrow it is back.
  await db.exec(
    `reset role;update public.arena_farm_wishes set day = day - 1 where player_id = '${player}'`,
  );
  expect((await call("arena_farm")).wishReady).toBe(true);
});

it("mostly gives crops up to 3 levels above yours (8% of seeds may reach 15 above)", async () => {
  const levels: number[] = [];
  for (let i = 0; i < 300; i++) {
    await db.exec(
      `reset role;delete from public.arena_farm_wishes where player_id = '${player}'`,
    );
    const r = await call("arena_farm_wish");
    for (const id of r.seeds) levels.push(CROP_BY_ID[id].level);
  }
  expect(levels).toHaveLength(900);
  expect(Math.max(...levels)).toBeLessThanOrEqual(16);
  // At farm level 1: 8% of seeds may come from the 10 crops up to level 16,
  // half of which are above level 4, so about 4% are.
  const far = levels.filter((lv) => lv > 4).length / levels.length;
  expect(far).toBeGreaterThan(0.01);
  expect(far).toBeLessThan(0.08);
});
