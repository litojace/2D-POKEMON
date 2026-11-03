import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import { FIGHTER_IDS } from "../../packages/shared/src/index";

// Migration 052: the new champions can be your portrait and your farmer, and
// SQL's roster matches FIGHTER_IDS.
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000511";
const login = () =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${player}',false);set role authenticated`,
  );
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
    `reset role;insert into auth.users values('${player}','{"display_name":"Roster tester"}')`,
  );
  await login();
  await db.query("select public.arena_me()");
  await db.query("select public.arena_farm()");
}, 60000);
afterAll(async () => db.close());

it("knows the same sixteen champions as the game", async () => {
  const [{ ids }] = await owner("select public.arena_champion_ids() ids");
  expect([...ids].sort()).toEqual([...FIGHTER_IDS].sort());
});

it("lets every champion be your portrait, and nothing else", async () => {
  for (const id of FIGHTER_IDS) {
    await login();
    await db.query("select public.arena_set_portrait_character($1)", [id]);
    const [row] = await owner(
      "select portrait_character from public.arena_profiles where id = $1",
      [player],
    );
    expect(row.portrait_character).toBe(id);
  }
  await login();
  await expect(
    db.query("select public.arena_set_portrait_character('pikachu')"),
  ).rejects.toThrow(/valid champion/);
  await expect(
    owner(
      "update public.arena_profiles set portrait_character = 'nobody' where id = $1",
      [player],
    ),
  ).rejects.toThrow(/check/);
});

it("lets every champion farm (the new eight without a perk)", async () => {
  for (const id of FIGHTER_IDS) {
    const r = await act([{ a: "farmer", id }]);
    expect(r.results[0]?.error, id).toBeUndefined();
    expect(r.farm.farmer).toBe(id);
  }
  expect(
    (await act([{ a: "farmer", id: "pikachu" }])).results[0].error,
  ).toBeTruthy();
  await expect(
    owner(
      "update public.arena_farms set farmer = 'nobody' where player_id = $1",
      [player],
    ),
  ).rejects.toThrow(/check/);
});

it("draws order faces from all sixteen", async () => {
  await owner("delete from public.arena_farm_orders where player_id = $1", [
    player,
  ]);
  const faces = new Set<string>();
  for (let i = 0; i < 400 && faces.size < 16; i++) {
    await owner("select public.arena_farm_new_order($1, 0, 10)", [player]);
    const [o] = await owner(
      "select face, who from public.arena_farm_orders where player_id = $1 and slot = 0",
      [player],
    );
    faces.add(o.face);
  }
  expect([...faces].sort()).toEqual([...FIGHTER_IDS].sort());
});
