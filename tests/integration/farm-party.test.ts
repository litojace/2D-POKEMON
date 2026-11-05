import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";

// Migration 061: live visits, Harvest Parties and farm likes.
let db: PGlite;
const ann = "00000000-0000-4000-8000-000000000611";
const ben = "00000000-0000-4000-8000-000000000612";
const dan = "00000000-0000-4000-8000-000000000613"; // not Ann's friend
const as = (id: string) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`,
  );
const call = async (id: string, q: string, params: unknown[] = []) => {
  await as(id);
  return (await db.query<{ r: any }>(`select ${q} r`, params)).rows[0].r;
};
const sql = async (q: string, params: unknown[] = []) => {
  await db.exec("reset role");
  return (await db.query<any>(q, params)).rows;
};
const leaves = async (id: string) =>
  Number(
    (
      await sql(
        "select coalesce((select balance from public.arena_leaf_wallets where player_id = $1), 0) b",
        [id],
      )
    )[0].b,
  );
const act = (id: string, actions: object[]) =>
  call(id, "public.arena_farm_act($1, $2::jsonb)", [
    randomUUID(),
    JSON.stringify(actions),
  ]);
const here = (id: string, owner: string, emote: string | null = null) =>
  call(id, "public.arena_farm_here($1, $2)", [owner, emote]);
const wheat = async (id: string) =>
  Number(
    (
      await sql(
        "select coalesce(sum(qty), 0)::int n from public.arena_farm_barn where player_id = $1 and crop = 'wheat'",
        [id],
      )
    )[0].n,
  );
/** Plant wheat on plot 0 and make it ripe. */
async function ripe(id: string) {
  await sql(
    "update public.arena_farm_plots set owned = true where player_id = $1 and idx = 0",
    [id],
  );
  await sql(
    "insert into public.arena_farm_seeds(player_id, crop, qty) values ($1, 'wheat', 10) on conflict (player_id, crop) do update set qty = 10",
    [id],
  );
  await act(id, [{ a: "plant", plot: 0, crop: "wheat" }]);
  await sql(
    "update public.arena_farm_plots set progress = 1, progress_at = now() - interval '1 minute' where player_id = $1 and idx = 0",
    [id],
  );
}

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
  for (const [id, name] of [
    [ann, "Ann"],
    [ben, "Ben"],
    [dan, "Dan"],
  ]) {
    await sql(
      `insert into auth.users values($1, jsonb_build_object('display_name', $2::text))`,
      [id, name],
    );
    await as(id);
    await db.query("select public.arena_me()");
    await db.query("select public.arena_farm()");
  }
  await sql("insert into public.arena_friendships(a, b) values ($1, $2)", [
    ann,
    ben,
  ]);
}, 60000);
afterAll(async () => db.close());

it("only friends can be on your farm; everyone there sees each other and emotes", async () => {
  await expect(here(dan, ann)).rejects.toThrow(/Only friends/);
  let v = await here(ann, ann);
  expect(v).toMatchObject({ owner: ann, present: [], party: false });
  v = await here(ben, ann, "wave");
  expect(v.present).toEqual([
    expect.objectContaining({ id: ann, name: "Ann", owner: true }),
  ]);
  v = await here(ann, ann);
  expect(v.present).toEqual([
    expect.objectContaining({
      id: ben,
      name: "Ben",
      owner: false,
      emote: "wave",
    }),
  ]);
  expect(v.party).toBe(true);
  await expect(here(ben, ann, "<b>")).rejects.toThrow(/Unknown emote/);
});

it("a Harvest Party gives one more crop per harvest", async () => {
  await ripe(ann);
  const w0 = await wheat(ann);
  await act(ann, [{ a: "harvest", plot: 0 }]);
  expect((await wheat(ann)) - w0).toBe(3);
  // Ben leaves: back to 2.
  await call(ben, "public.arena_farm_gone()");
  expect((await here(ann, ann)).party).toBe(false);
  await ripe(ann);
  const w1 = await wheat(ann);
  await act(ann, [{ a: "harvest", plot: 0 }]);
  expect((await wheat(ann)) - w1).toBe(2);
});

it("party time stops at 60 minutes a day", async () => {
  await here(ben, ann);
  await here(ann, ann);
  await sql(
    "insert into public.arena_farm_party_days(owner, day, seconds) values ($1, public.arena_today(), 3600) on conflict (owner, day) do update set seconds = 3600",
    [ann],
  );
  const v = await here(ann, ann);
  expect(v).toMatchObject({ party: false, partyLeft: 0 });
  await ripe(ann);
  const w0 = await wheat(ann);
  await act(ann, [{ a: "harvest", plot: 0 }]);
  expect((await wheat(ann)) - w0).toBe(2);
});

it("being on one farm ends being on another", async () => {
  await here(ben, ann);
  await here(ben, ben);
  const v = await here(ann, ann);
  expect(v.present).toEqual([]);
});

it("friends like a farm once a week; the Farm Tour ranks by likes", async () => {
  await expect(call(dan, "public.arena_farm_like($1)", [ann])).rejects.toThrow(
    /Only friends/,
  );
  let r = await call(ben, "public.arena_farm_like($1)", [ann]);
  expect(r.ok).toBe(true);
  r = await call(ben, "public.arena_farm_like($1)", [ann]);
  expect(r).toMatchObject({ ok: false, error: /this week/ });
  const tour = await call(ben, "public.arena_farm_tour()");
  expect(tour.map((x: any) => [x.name, x.likes, x.liked, x.me])).toEqual([
    ["Ann", 1, true, false],
    ["Ben", 0, false, true],
  ]);
});
