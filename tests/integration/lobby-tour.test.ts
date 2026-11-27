import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";

// Migration 20261121090000: how a player's Lobby tour ended, kept with the
// account, beside the fighter they picked (migration 108).
let db: PGlite;
const ana = "00000000-0000-4000-8000-000000000001";
const ben = "00000000-0000-4000-8000-000000000002";
async function as(id: string | null) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id ?? ""}',false);set role authenticated;`,
  );
}
async function mine(id: string) {
  await as(id);
  return (
    await db.query<{ v: string | null }>("select public.arena_my_tour() as v")
  ).rows[0].v;
}
async function save(id: string | null, result: string, reached: number) {
  await as(id);
  await db.query("select public.arena_save_tour($1, $2)", [result, reached]);
}
/** The stored row, read as the database owner (players can't). */
async function row(id: string) {
  await db.exec("reset role;");
  return (
    await db.query<{
      fighter: string | null;
      tour: string | null;
      tour_reached: number | null;
      tour_at: string | null;
    }>(
      "select fighter, tour, tour_reached, tour_at from public.arena_preferences where user_id=$1",
      [id],
    )
  ).rows[0];
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;insert into auth.users values ('${ana}','{"display_name":"Ana"}'),('${ben}','{"display_name":"Ben"}');`,
  );
  for (const m of [
    "001_arena_accounts.sql",
    "002_admin_cleanup_reports.sql",
    "003_titles.sql",
    "004_matches_achievements.sql",
    "005_friends.sql",
    "108_selected_fighter.sql",
    "20261121090000_lobby_tour.sql",
  ])
    await db.exec(await readFile(`supabase/migrations/${m}`, "utf8"));
  for (const id of [ana, ben]) {
    await as(id);
    await db.query("select public.arena_me()");
  }
}, 30000);
afterAll(async () => {
  await db.close();
});

it("is null until the tour ends, then keeps how it ended and how far", async () => {
  expect(await mine(ana)).toBeNull();
  await save(ana, "skipped", 2);
  expect(await mine(ana)).toBe("skipped");
  expect(await row(ana)).toMatchObject({ tour: "skipped", tour_reached: 2 });
  expect((await row(ana)).tour_at).not.toBeNull();
  // A replay that is finished replaces it.
  await save(ana, "done", 6);
  expect(await mine(ana)).toBe("done");
  expect(await row(ana)).toMatchObject({ tour: "done", tour_reached: 6 });
  expect(await mine(ben)).toBeNull();
});

it("shares the row with the saved fighter without touching it", async () => {
  await as(ben);
  await db.query("select public.arena_save_fighter('tidefin')");
  await save(ben, "done", 6);
  expect(await row(ben)).toMatchObject({ fighter: "tidefin", tour: "done" });
  await as(ben);
  await db.query("select public.arena_save_fighter('cindrake')");
  expect(await row(ben)).toMatchObject({ fighter: "cindrake", tour: "done" });
});

it("refuses an unknown ending, a bad step and a signed-out caller", async () => {
  for (const bad of ["", "Done", "finished", "'; drop table x; --"])
    await expect(save(ana, bad, 3)).rejects.toThrow(/not how a tour ends/);
  for (const reached of [-1, 21])
    await expect(save(ana, "done", reached)).rejects.toThrow(/not a tour step/);
  expect(await mine(ana)).toBe("done");
  await expect(save(null, "done", 1)).rejects.toThrow(/Login required/);
});

it("can't be read or written around the functions", async () => {
  await as(ana);
  await expect(
    db.query("select tour from public.arena_preferences"),
  ).rejects.toThrow(/permission denied/);
  await expect(
    db.query("update public.arena_preferences set tour='done'"),
  ).rejects.toThrow(/permission denied/);
});
