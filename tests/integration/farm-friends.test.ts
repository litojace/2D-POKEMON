import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";

// Migration 047: visiting friends' farms.
let db: PGlite;
const owner = "00000000-0000-4000-8000-000000000471"; // the farm visited
const visitor = "00000000-0000-4000-8000-000000000472";
const third = "00000000-0000-4000-8000-000000000473";
const stranger = "00000000-0000-4000-8000-000000000474";
const as = (id: string) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`,
  );
const farm = async (id: string) => {
  await as(id);
  return (await db.query<{ f: any }>("select public.arena_farm() f")).rows[0].f;
};
const act = async (id: string, actions: object[]) => {
  await as(id);
  return (
    await db.query<{ r: any }>("select public.arena_farm_act($1,$2::jsonb) r", [
      randomUUID(),
      JSON.stringify(actions),
    ])
  ).rows[0].r;
};
const visit = async (id: string, friend: string) => {
  await as(id);
  return (
    await db.query<{ f: any }>("select public.arena_farm_friend($1) f", [
      friend,
    ])
  ).rows[0].f;
};
const friendAct = async (
  id: string,
  friend: string,
  actions: object[],
  request = randomUUID(),
) => {
  await as(id);
  return (
    await db.query<{ r: any }>(
      "select public.arena_farm_friend_act($1,$2,$3::jsonb) r",
      [request, friend, JSON.stringify(actions)],
    )
  ).rows[0].r;
};
const sql = async (q: string, params: unknown[] = []) => {
  await db.exec("reset role");
  return (await db.query<any>(q, params)).rows;
};
const plots = (id: string, set: string, idx: number[]) =>
  sql(
    `update public.arena_farm_plots set ${set} where player_id = $1 and idx = any($2::int[])`,
    [id, idx],
  );
const leaves = async (id: string) =>
  Number(
    (
      await sql(
        "select coalesce((select balance from public.arena_leaf_wallets where player_id = $1), 0) b",
        [id],
      )
    )[0].b,
  );
const barn = async (id: string, crop: string) =>
  Number(
    (
      await sql(
        "select coalesce(sum(qty), 0)::int n from public.arena_farm_barn where player_id = $1 and crop = $2",
        [id, crop],
      )
    )[0].n,
  );
const xp = async (id: string) =>
  Number(
    (
      await sql(
        "select coalesce((select xp from public.arena_farms where player_id = $1), 0) xp",
        [id],
      )
    )[0].xp,
  );

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
    [owner, "Owner"],
    [visitor, "Visitor"],
    [third, "Third"],
    [stranger, "Stranger"],
  ]) {
    await sql(
      `insert into auth.users values($1, jsonb_build_object('display_name', $2::text))`,
      [id, name],
    );
    await as(id);
    await db.query("select public.arena_me()");
  }
  // Owner–visitor and owner–third are friends; the stranger is not.
  await sql(
    "insert into public.arena_friendships(a, b) values ($1, $2), ($1, $3)",
    [owner, visitor, third],
  );
  await farm(owner);
  await sql(
    "insert into public.arena_farm_seeds(player_id, crop, qty) values ($1, 'wheat', 100) on conflict (player_id, crop) do update set qty = 100",
    [owner],
  );
  await plots(owner, "owned = true", [...Array(50).keys()]);
}, 60000);
afterAll(async () => db.close());

it("only friends visit, and only farms that exist", async () => {
  await expect(visit(stranger, owner)).rejects.toThrow(
    /Only friends can visit/,
  );
  await expect(
    friendAct(stranger, owner, [{ a: "water", plot: 0 }]),
  ).rejects.toThrow(/Only friends can visit/);
  await expect(visit(owner, visitor)).rejects.toThrow(/no farm yet/);
  const v = await visit(visitor, owner);
  expect(v).toMatchObject({ id: owner, name: "Owner", level: 1, dog: null });
  expect(v.plots).toHaveLength(50);
  // The Friends sheet lists friends with a farm.
  await as(visitor);
  const list = (
    await db.query<{ f: any }>("select public.arena_farm_friends() f")
  ).rows[0].f;
  expect(list).toEqual([
    expect.objectContaining({ id: owner, name: "Owner", bugs: 0, ripe: 0 }),
  ]);
});

it("watering and catching bugs pay the visitor XP, up to 60 a day", async () => {
  await act(
    owner,
    [0, 1, 2].map((plot) => ({ a: "plant", plot, crop: "wheat" })),
  );
  await plots(owner, "pests = 2", [1]);
  const before = await xp(visitor);
  let r = await friendAct(visitor, owner, [
    { a: "water", plot: 0 },
    { a: "water", plot: 0 },
    { a: "catch", plot: 1 },
    { a: "catch", plot: 5 },
  ]);
  expect(r.results).toEqual([
    { ok: true, xp: 2 },
    { ok: false, error: "Already watered" },
    { ok: true, xp: 3 },
    { ok: false, error: "No bugs here" },
  ]);
  expect((await xp(visitor)) - before).toBe(5);
  expect(r.farm.plots[0].wet).toBe(true);
  expect(r.farm.plots[1].pests).toBe(1);
  // Near the cap: only what is left of the 60.
  await sql(
    "update public.arena_farm_friend_days set help_xp = 59 where player_id = $1",
    [visitor],
  );
  r = await friendAct(visitor, owner, [
    { a: "catch", plot: 1 },
    { a: "water", plot: 2 },
  ]);
  expect(r.results).toEqual([
    { ok: true, xp: 1 },
    { ok: true, xp: 0 },
  ]);
  // The owner sees who came and what they did.
  const f = await farm(owner);
  expect(f.visits.map((v: any) => [v.name, v.kind])).toEqual([
    ["Visitor", "water"],
    ["Visitor", "catch"],
    ["Visitor", "catch"],
    ["Visitor", "water"],
  ]);
  // A retried request changes nothing.
  const request = randomUUID();
  await plots(owner, "pests = 1", [2]);
  await friendAct(visitor, owner, [{ a: "catch", plot: 2 }], request);
  const again = await friendAct(
    visitor,
    owner,
    [{ a: "catch", plot: 2 }],
    request,
  );
  expect(again.repeated).toBe(true);
  expect(again.farm.plots[2].pests).toBe(0);
});

it("a friend sneaks one crop from a ripe planting, once; the harvest gives one less", async () => {
  await plots(
    owner,
    "progress = 1, progress_at = now() - interval '1 minute'",
    [0],
  );
  let v = await visit(visitor, owner);
  expect(v.plots[0].sneak).toBe(true);
  let r = await friendAct(visitor, owner, [{ a: "sneak", plot: 0 }]);
  expect(r.results[0]).toEqual({
    ok: true,
    crop: "wheat",
    qty: 1,
    mutation: "",
  });
  expect(await barn(visitor, "wheat")).toBe(1);
  expect(r.farm.plots[0].sneak).toBe(false);
  expect(
    (await friendAct(visitor, owner, [{ a: "sneak", plot: 0 }])).results[0],
  ).toEqual({
    ok: false,
    error: "Someone already snuck a crop from this plot",
  });
  expect(
    (await friendAct(third, owner, [{ a: "sneak", plot: 0 }])).results[0].error,
  ).toBe("Someone already snuck a crop from this plot");
  expect(
    (await friendAct(visitor, owner, [{ a: "sneak", plot: 1 }])).results[0],
  ).toEqual({ ok: false, error: "Nothing ripe here" });
  const before = await barn(owner, "wheat");
  r = await act(owner, [{ a: "harvest", plot: 0 }]);
  expect(r.results[0]).toMatchObject({ ok: true, qty: 1 });
  expect((await barn(owner, "wheat")) - before).toBe(1);
  // A new planting can be snuck from again.
  await act(owner, [{ a: "plant", plot: 0, crop: "wheat" }]);
  await plots(
    owner,
    "progress = 1, progress_at = now() - interval '1 minute'",
    [0],
  );
  expect(
    (await friendAct(third, owner, [{ a: "sneak", plot: 0 }])).results[0].ok,
  ).toBe(true);
});

it("a guard dog catches sneaking friends, who pay the owner a fine", async () => {
  await act(
    owner,
    [...Array(20).keys()]
      .map((k) => k + 10)
      .map((plot) => ({ a: "plant", plot, crop: "wheat" })),
  );
  await plots(
    owner,
    "progress = 1, progress_at = now() - interval '1 minute'",
    [...Array(20).keys()].map((k) => k + 10),
  );
  await sql(
    `insert into public.arena_farm_dog_hires(player_id, dog, started_at, ends_at, dug_at)
     values ($1, 'black', now(), now() + interval '1 day', now())`,
    [owner],
  );
  await sql(
    "select public.arena_grant_leaves($1, 1000, 'test', 'fines', public.arena_today())",
    [visitor],
  );
  const [vBefore, oBefore, cropsBefore] = [
    await leaves(visitor),
    await leaves(owner),
    await barn(visitor, "wheat"),
  ];
  await sql("select setseed(0.3)");
  // The visitor already snuck once today (above): 9 more are allowed.
  const r = await friendAct(
    visitor,
    owner,
    [...Array(10).keys()].map((k) => ({ a: "sneak", plot: k + 10 })),
  );
  const caught = r.results.filter((x: any) => x.caught).length,
    got = r.results.filter((x: any) => x.crop).length;
  expect(r.results[9]).toEqual({
    ok: false,
    error: "That's enough sneaking for today",
  });
  expect(caught + got).toBe(9);
  // Inky catches 80%.
  expect(caught).toBeGreaterThanOrEqual(4);
  for (const x of r.results.filter((x: any) => x.caught))
    expect(x).toEqual({ ok: true, caught: "black", fine: 20 });
  expect(vBefore - (await leaves(visitor))).toBe(20 * caught);
  expect((await leaves(owner)) - oBefore).toBe(20 * caught);
  expect((await barn(visitor, "wheat")) - cropsBefore).toBe(got);
  const f = await farm(owner);
  expect(f.visits.filter((v: any) => v.kind === "caught")).toHaveLength(caught);
});

it("pranks drop bugs on growing crops, 3 a day, unless Auralynx shields the farm", async () => {
  await act(owner, [{ a: "plant", plot: 40, crop: "wheat" }]);
  let r = await friendAct(third, owner, [
    { a: "prank", plot: 40 },
    { a: "prank", plot: 10 },
    { a: "prank", plot: 40 },
    { a: "prank", plot: 40 },
    { a: "prank", plot: 40 },
  ]);
  expect(r.results).toEqual([
    { ok: true, pranksLeft: 2 },
    { ok: false, error: "Bugs only go on growing crops" },
    { ok: true, pranksLeft: 1 },
    { ok: true, pranksLeft: 0 },
    { ok: false, error: "No pranks left today" },
  ]);
  expect(r.farm.plots[40].pests).toBe(3);
  await act(owner, [{ a: "farmer", id: "auralynx" }]);
  r = await friendAct(visitor, owner, [{ a: "prank", plot: 40 }]);
  expect(r.results[0]).toEqual({
    ok: false,
    error: "Their Shield blocks pranks",
  });
});
