import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import { CROP_BY_ID } from "../../packages/shared/src/farm";

// Migration 040: the order board, made and settled on the server.
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000401";
const login = () =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${player}',false);set role authenticated`,
  );
const farm = async () => {
  await login();
  return (await db.query<{ f: any }>("select public.arena_farm() f")).rows[0].f;
};
const order = async (slot: number, kind: string, request = randomUUID()) => {
  await login();
  return (
    await db.query<{ r: any }>("select public.arena_farm_order($1,$2,$3) r", [
      request,
      slot,
      kind,
    ])
  ).rows[0].r;
};
const owner = async (sql: string, params: unknown[] = []) => {
  await db.exec("reset role");
  return (await db.query<any>(sql, params)).rows;
};
const stock = (crop: string, mutation: string, qty: number) =>
  owner(
    `insert into public.arena_farm_barn(player_id, crop, mutation, qty) values ($1,$2,$3,$4)
     on conflict (player_id, crop, mutation) do update set qty = $4`,
    [player, crop, mutation, qty],
  );

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
    `reset role;insert into auth.users values('${player}','{"display_name":"Order tester"}')`,
  );
  await login();
  await db.query("select public.arena_me()");
}, 60000);
afterAll(async () => db.close());

it("fills three slots with orders for crops you can grow, priced like the prototype", async () => {
  const f = await farm();
  expect(f.orders).toHaveLength(3);
  for (const o of f.orders) {
    expect(o.items.length).toBeGreaterThanOrEqual(1);
    expect(o.items.length).toBeLessThanOrEqual(2); // only wheat and carrot at Lv 1
    expect(new Set(o.items.map((i: any) => i[0])).size).toBe(o.items.length);
    let val = 0,
      xp = 0;
    for (const [crop, n] of o.items) {
      expect(CROP_BY_ID[crop].level).toBeLessThanOrEqual(f.level);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(8);
      val += CROP_BY_ID[crop].sell * n;
      xp += CROP_BY_ID[crop].xp * n;
    }
    expect(o.leaves).toBe(Math.round((val * 1.45) / 5) * 5);
    expect(o.xp).toBe(xp);
    expect(o.waitUntil).toBeNull();
    expect(o.who).toEqual(expect.any(String));
  }
});

it("delivers from the barn, plain crops first, and pays once per request", async () => {
  // A known order in slot 0.
  await owner(
    `update public.arena_farm_orders set items = '[["wheat",3],["carrot",2]]', leaves = 35, xp = 17, bonus = 'super'
     where player_id = $1 and slot = 0`,
    [player],
  );
  let r = await order(0, "deliver");
  expect(r).toMatchObject({ ok: false, error: "You need 3 Breeze Wheat" });
  await stock("wheat", "", 2);
  await stock("wheat", "gold", 4);
  await stock("carrot", "", 2);
  const before = await farm();
  const request = randomUUID();
  r = await order(0, "deliver", request);
  expect(r).toMatchObject({
    ok: true,
    gained: { leaves: 35, xp: 17, bonus: "super" },
  });
  expect(r.farm.leaves - before.leaves).toBe(35);
  expect(r.farm.xp - before.xp).toBe(17);
  expect(r.farm.fertilizer.super).toBe(before.fertilizer.super + 1);
  // 2 plain wheat, then 1 Gold; the other 3 Gold are kept.
  expect(r.farm.barn).toEqual([{ crop: "wheat", mutation: "gold", qty: 3 }]);
  const slot0 = r.farm.orders.find((o: any) => o.slot === 0);
  expect(slot0.items).toBeNull();
  expect(
    (Date.parse(slot0.waitUntil) - Date.parse(r.farm.now)) / 60000,
  ).toBeCloseTo(80, 0);
  // The same request again: answered, not paid again.
  const again = await order(0, "deliver", request);
  expect(again).toMatchObject({ ok: false, repeated: true });
  expect(again.farm.leaves).toBe(r.farm.leaves);
  expect((await order(0, "deliver")).error).toBe("A new order is on its way");
});

it("skips for five minutes, then brings a new order", async () => {
  const r = await order(1, "skip");
  expect(r.ok).toBe(true);
  const slot1 = r.farm.orders.find((o: any) => o.slot === 1);
  expect(slot1.items).toBeNull();
  expect(
    (Date.parse(slot1.waitUntil) - Date.parse(r.farm.now)) / 60000,
  ).toBeCloseTo(5, 0);
  await owner(
    "update public.arena_farm_orders set wait_until = now() - interval '1 second' where player_id = $1 and slot = 1",
    [player],
  );
  const f = await farm();
  expect(f.orders.find((o: any) => o.slot === 1).items.length).toBeGreaterThan(
    0,
  );
  await expect(order(5, "skip")).rejects.toThrow(/Invalid order/);
  await expect(order(1, "steal")).rejects.toThrow(/Invalid order/);
});
