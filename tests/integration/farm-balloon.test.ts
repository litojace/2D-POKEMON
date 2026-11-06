import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";

// Migration 058: the Supply Balloon and friends' help.
let db: PGlite;
const ann = "00000000-0000-4000-8000-000000000581";
const ben = "00000000-0000-4000-8000-000000000582";
const dan = "00000000-0000-4000-8000-000000000583"; // not Ann's friend
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
const give = (id: string, crop: string, qty: number, mutation = "") =>
  sql(
    "insert into public.arena_farm_barn(player_id, crop, mutation, qty) values ($1, $2, $3, $4) on conflict (player_id, crop, mutation) do update set qty = excluded.qty",
    [id, crop, mutation, qty],
  );
const balloonAct = (id: string, kind: string, slot?: number) =>
  call(id, "public.arena_farm_balloon_act($1, $2, $3)", [
    randomUUID(),
    kind,
    slot ?? null,
  ]);

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
  await sql("update public.arena_farms set level = 20 where player_id = $1", [
    ann,
  ]);
}, 60000);
afterAll(async () => db.close());

it("a balloon has six crates: five you grow and one you can't yet", async () => {
  const b = await call(ann, "public.arena_farm_balloon()");
  expect(b.crates).toHaveLength(6);
  const levels = await sql(
    "select id, level from public.arena_farm_crops where id = any($1::text[])",
    [b.crates.map((c: any) => c.crop)],
  );
  const lv = Object.fromEntries(levels.map((r: any) => [r.id, r.level]));
  const crates = b.crates.map((c: any) => lv[c.crop]);
  expect(crates.slice(0, 5).every((l: number) => l <= 20)).toBe(true);
  expect(crates[5]).toBeGreaterThan(20);
  expect(crates[5]).toBeLessThanOrEqual(40);
  expect(b.crates.every((c: any) => c.state === "open" && c.qty >= 2)).toBe(
    true,
  );
  expect(b.leaves).toBeGreaterThan(0);
  // A level 1 farm still gets six crates.
  const small = await call(dan, "public.arena_farm_balloon()");
  expect(small.crates).toHaveLength(6);
});

it("fills crates from the barn, plain crops first", async () => {
  const b = await call(ann, "public.arena_farm_balloon()");
  const c0 = b.crates[0];
  let r = await balloonAct(ann, "fill", 0);
  expect(r).toMatchObject({
    ok: false,
    error: expect.stringMatching(/You need/),
  });
  await give(ann, c0.crop, c0.qty - 1);
  await give(ann, c0.crop, 5, "gold");
  r = await balloonAct(ann, "fill", 0);
  expect(r.ok).toBe(true);
  expect(r.balloon.crates[0].state).toBe("done");
  const rows = await sql(
    "select mutation, qty from public.arena_farm_barn where player_id = $1 and crop = $2 order by mutation",
    [ann, c0.crop],
  );
  expect(rows).toEqual([
    { mutation: "", qty: 0 },
    { mutation: "gold", qty: 4 },
  ]);
  r = await balloonAct(ann, "fill", 0);
  expect(r).toMatchObject({ ok: false, error: "This crate is full" });
  r = await balloonAct(ann, "launch");
  expect(r).toMatchObject({ ok: false, error: "Fill all six crates first" });
});

it("asks friends for up to 3 crates; a friend fills one for leaves and a star", async () => {
  for (const s of [1, 2, 3])
    expect((await balloonAct(ann, "ask", s)).ok).toBe(true);
  let r = await balloonAct(ann, "ask", 4);
  expect(r).toMatchObject({ ok: false, error: /3 crates/ });
  r = await balloonAct(ann, "ask", 1);
  expect(r.ok).toBe(false);
  // Ben sees them; Dan, not a friend, can't help.
  const list = await call(ben, "public.arena_farm_help_list()");
  expect(list.requests.map((x: any) => x.slot)).toEqual([1, 2, 3]);
  expect(list.requests[0]).toMatchObject({ friend: ann, name: "Ann", have: 0 });
  await expect(
    call(dan, "public.arena_farm_help_fill($1, $2, $3)", [
      randomUUID(),
      ann,
      1,
    ]),
  ).rejects.toThrow(/Only friends/);
  const crate = list.requests[0];
  r = await call(ben, "public.arena_farm_help_fill($1, $2, $3)", [
    randomUUID(),
    ann,
    1,
  ]);
  expect(r).toMatchObject({
    ok: false,
    error: expect.stringMatching(/You need/),
  });
  await give(ben, crate.crop, crate.qty);
  const ben0 = await leaves(ben);
  r = await call(ben, "public.arena_farm_help_fill($1, $2, $3)", [
    randomUUID(),
    ann,
    1,
  ]);
  expect(r).toMatchObject({
    ok: true,
    gained: { leaves: crate.reward, star: 1 },
  });
  expect((await leaves(ben)) - ben0).toBe(crate.reward);
  expect(r.help.map((x: any) => x.slot)).toEqual([2, 3]);
  // Filled once: a second helper is too late.
  r = await call(ben, "public.arena_farm_help_fill($1, $2, $3)", [
    randomUUID(),
    ann,
    1,
  ]);
  expect(r).toMatchObject({ ok: false, error: /already filled/ });
  const b = await call(ann, "public.arena_farm_balloon()");
  expect(b.crates[1]).toMatchObject({ state: "done", by: ben });
  expect(b.helpers).toEqual({ [ben]: "Ben" });
  expect((await call(ben, "public.arena_farm_help_list()")).helperStars).toBe(
    1,
  );
});

it("helper leaves stop at 600 a day, stars don't", async () => {
  await sql(
    "update public.arena_farm_help_days set leaves = 595 where player_id = $1",
    [ben],
  );
  const crate = (await call(ben, "public.arena_farm_help_list()")).requests[0];
  await give(ben, crate.crop, crate.qty);
  const r = await call(ben, "public.arena_farm_help_fill($1, $2, $3)", [
    randomUUID(),
    ann,
    crate.slot,
  ]);
  expect(r.gained).toEqual({ leaves: Math.min(5, crate.reward), star: 1 });
  expect((await call(ben, "public.arena_farm_help_list()")).helperStars).toBe(
    2,
  );
});

it("six full crates launch for leaves, XP and a Gold Fertilizer; the next comes an hour later", async () => {
  let b = await call(ann, "public.arena_farm_balloon()");
  for (const [k, c] of b.crates.entries()) {
    if (c.state === "done") continue;
    await give(ann, c.crop, c.qty);
    const r = await balloonAct(ann, "fill", k);
    expect(r.ok).toBe(true);
  }
  const ann0 = await leaves(ann);
  const [{ fert_gold: g0 }] = await sql(
    "select fert_gold from public.arena_farms where player_id = $1",
    [ann],
  );
  const request = randomUUID();
  let r = await call(ann, "public.arena_farm_balloon_act($1, 'launch', null)", [
    request,
  ]);
  expect(r).toMatchObject({ ok: true, gained: { leaves: b.leaves, xp: b.xp } });
  expect((await leaves(ann)) - ann0).toBe(b.leaves);
  const [{ fert_gold: g1 }] = await sql(
    "select fert_gold from public.arena_farms where player_id = $1",
    [ann],
  );
  expect(g1).toBe(g0 + 1);
  // A retried launch is answered, not paid twice.
  r = await call(ann, "public.arena_farm_balloon_act($1, 'launch', null)", [
    request,
  ]);
  expect(r).toMatchObject({ ok: false, repeated: true });
  expect((await leaves(ann)) - ann0).toBe(b.leaves);
  b = await call(ann, "public.arena_farm_balloon()");
  expect(b).toMatchObject({ crates: null, launches: 1 });
  expect(new Date(b.arrivesAt).getTime()).toBeGreaterThan(
    Date.now() + 55 * 60_000,
  );
  r = await balloonAct(ann, "fill", 0);
  expect(r).toMatchObject({ ok: false, error: /on its way/ });
  await sql(
    "update public.arena_farm_balloons set arrives_at = now() - interval '1 minute' where player_id = $1",
    [ann],
  );
  b = await call(ann, "public.arena_farm_balloon()");
  expect(b.crates).toHaveLength(6);
  // Every crate filled is logged.
  const [{ n }] = await sql(
    "select count(*)::int n from public.arena_farm_crate_log where player_id = $1",
    [ann],
  );
  expect(n).toBe(4);
});
