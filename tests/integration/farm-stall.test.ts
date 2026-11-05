import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";

// Migration 059: the Farm Stall and the Valley Paper.
let db: PGlite;
const ann = "00000000-0000-4000-8000-000000000591";
const ben = "00000000-0000-4000-8000-000000000592";
const dan = "00000000-0000-4000-8000-000000000593"; // not Ann's friend
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
const stall = (
  id: string,
  kind: string,
  slot: number,
  o: {
    crop?: string;
    mutation?: string;
    qty?: number;
    price?: number;
    seller?: string;
  } = {},
  request = randomUUID(),
) =>
  call(id, "public.arena_farm_stall_act($1, $2, $3, $4, $5, $6, $7, $8)", [
    request,
    kind,
    slot,
    o.crop ?? null,
    o.mutation ?? null,
    o.qty ?? null,
    o.price ?? null,
    o.seller ?? null,
  ]);
const unit = async (id: string, crop: string, mutation = "") =>
  Number(
    (
      await sql("select public.arena_farm_unit_price($1, $2, $3) u", [
        id,
        crop,
        mutation,
      ])
    )[0].u,
  );
const barn = async (id: string, crop: string, mutation = "") =>
  Number(
    (
      await sql(
        "select coalesce((select qty from public.arena_farm_barn where player_id = $1 and crop = $2 and mutation = $3), 0) n",
        [id, crop, mutation],
      )
    )[0].n,
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

it("lists crops from the barn at 0.5×–1.5× the Market price", async () => {
  await give(ann, "wheat", 20);
  const u = await unit(ann, "wheat");
  let r = await stall(ann, "list", 0, {
    crop: "wheat",
    qty: 10,
    price: Math.floor(u * 10 * 1.5) + 1,
  });
  expect(r).toMatchObject({
    ok: false,
    error: expect.stringMatching(/Price it between/),
  });
  r = await stall(ann, "list", 0, {
    crop: "wheat",
    qty: 10,
    price: Math.ceil(u * 10 * 0.5) - 1,
  });
  expect(r.ok).toBe(false);
  r = await stall(ann, "list", 0, { crop: "wheat", qty: 11, price: u * 11 });
  expect(r).toMatchObject({ ok: false, error: /1 to 10/ });
  r = await stall(ann, "list", 0, {
    crop: "carrot",
    qty: 2,
    price: (await unit(ann, "carrot")) * 2,
  });
  expect(r).toMatchObject({ ok: false, error: /don't have/ });
  r = await stall(ann, "list", 0, { crop: "wheat", qty: 10, price: u * 12 });
  expect(r.ok).toBe(true);
  expect(r.shelves).toEqual([
    expect.objectContaining({
      slot: 0,
      crop: "wheat",
      qty: 10,
      price: u * 12,
      sold: false,
    }),
  ]);
  expect(await barn(ann, "wheat")).toBe(10);
  r = await stall(ann, "list", 0, { crop: "wheat", qty: 1, price: u });
  expect(r).toMatchObject({ ok: false, error: /in use/ });
  // Take a shelf down: the crops go back.
  r = await stall(ann, "list", 1, { crop: "wheat", qty: 5, price: u * 5 });
  r = await stall(ann, "unlist", 1);
  expect(r.ok).toBe(true);
  expect(await barn(ann, "wheat")).toBe(10);
});

it("only friends see the shelf in the Valley Paper and buy it", async () => {
  const paper = (await call(ben, "public.arena_farm_stall()")).paper;
  expect(paper).toEqual([
    expect.objectContaining({
      seller: ann,
      name: "Ann",
      slot: 0,
      crop: "wheat",
      qty: 10,
    }),
  ]);
  expect((await call(dan, "public.arena_farm_stall()")).paper).toEqual([]);
  await expect(stall(dan, "buy", 0, { seller: ann })).rejects.toThrow(
    /Only friends/,
  );
  const price = paper[0].price;
  // Not enough leaves.
  await sql(
    "insert into public.arena_leaf_wallets(player_id, balance) values ($1, 0) on conflict (player_id) do update set balance = 0",
    [ben],
  );
  let r = await stall(ben, "buy", 0, { seller: ann });
  expect(r).toMatchObject({ ok: false, error: "Not enough Gold Leaves" });
  await sql(
    "insert into public.arena_leaf_wallets(player_id, balance) values ($1, 5000) on conflict (player_id) do update set balance = 5000",
    [ben],
  );
  r = await stall(ben, "buy", 0, { seller: ann });
  expect(r).toMatchObject({
    ok: true,
    gained: { crop: "wheat", qty: 10, price },
  });
  expect(await leaves(ben)).toBe(5000 - price);
  expect(await barn(ben, "wheat")).toBe(10);
  expect(r.paper).toEqual([]);
  r = await stall(ben, "buy", 0, { seller: ann });
  expect(r).toMatchObject({ ok: false, error: /bought that already/ });
  // Ann collects the price less the 10% fee.
  const ann0 = await leaves(ann);
  const view = await call(ann, "public.arena_farm_stall()");
  expect(view.shelves[0]).toMatchObject({
    sold: true,
    buyer: "Ben",
    collect: price - Math.ceil(price * 0.1),
  });
  r = await stall(ann, "unlist", 0);
  expect(r).toMatchObject({ ok: false, error: /Collect it/ });
  r = await stall(ann, "collect", 0);
  expect(r).toMatchObject({
    ok: true,
    gained: { leaves: price - Math.ceil(price * 0.1) },
  });
  expect((await leaves(ann)) - ann0).toBe(price - Math.ceil(price * 0.1));
  expect(r.shelves).toEqual([]);
  const [{ n }] = await sql(
    "select count(*)::int n from public.arena_farm_stall_sales where seller = $1",
    [ann],
  );
  expect(n).toBe(1);
});

it("caps stall earnings at 3,000 a day and buying at 10 shelves a day", async () => {
  const u = await unit(ann, "wheat");
  await stall(ann, "list", 2, { crop: "wheat", qty: 2, price: u * 2 });
  await stall(ben, "buy", 2, { seller: ann });
  await sql(
    "update public.arena_farm_stall_days set earned = 2999 where player_id = $1",
    [ann],
  );
  let r = await stall(ann, "collect", 2);
  expect(r).toMatchObject({ ok: false, error: /3,000/ });
  await sql(
    "update public.arena_farm_stall_days set bought = 10 where player_id = $1",
    [ben],
  );
  await stall(ann, "list", 3, { crop: "wheat", qty: 1, price: u });
  r = await stall(ben, "buy", 3, { seller: ann });
  expect(r).toMatchObject({ ok: false, error: /10 shelves today/ });
  // A retried request is answered, never applied twice.
  await sql(
    "update public.arena_farm_stall_days set bought = 0 where player_id = $1",
    [ben],
  );
  const req = randomUUID();
  const before = await leaves(ben);
  await stall(ben, "buy", 3, { seller: ann }, req);
  r = await stall(ben, "buy", 3, { seller: ann }, req);
  expect(r).toMatchObject({ ok: false, repeated: true });
  expect(before - (await leaves(ben))).toBe(u);
});
