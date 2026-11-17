import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  COOP,
  EGG,
  decorFits,
  eggPrice,
  henPrice,
  henState,
} from "../../packages/shared/src/farm";

// 20261117100000_farm_coop.sql: the Chicken Coop, its hens and Sunny Eggs.
const COOP_SQL = "20261117100000_farm_coop.sql";
let db: PGlite;
const player = "00000000-0000-4000-8000-000000001171";
const friend = "00000000-0000-4000-8000-000000001172";
const login = (who = player) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${who}',false);set role authenticated`,
  );
const farm = async (who = player) => {
  await login(who);
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
const one = async (a: object) => (await act([a])).results[0];
const barn = async (crop: string, mutation = "") =>
  Number(
    (
      await owner(
        "select coalesce(sum(qty), 0)::int n from public.arena_farm_barn where player_id = $1 and crop = $2 and mutation = $3",
        [player, crop, mutation],
      )
    )[0].n,
  );
const setBarn = (crop: string, qty: number, mutation = "") =>
  owner(
    `insert into public.arena_farm_barn(player_id, crop, mutation, qty) values ($1, $2, $3, $4)
     on conflict (player_id, crop, mutation) do update set qty = excluded.qty`,
    [player, crop, mutation, qty],
  );
const hatch = (idx: number) =>
  owner(
    "update public.arena_farm_hens set egg_at = now() - interval '1 second' where player_id = $1 and idx = $2",
    [player, idx],
  );
const migrate = async (f: string) =>
  db.exec(await readFile("supabase/migrations/" + f, "utf8"));

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
  );
  await db.exec("select set_config('arena.farm_bugs', 'off', false)");
  const files = (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  // Everything before the coop, then decorations where the coop goes, then the coop.
  const at = files.indexOf(COOP_SQL);
  expect(at).toBeGreaterThan(0);
  for (const f of files.slice(0, at)) await migrate(f);
  await db.exec(
    `reset role;insert into auth.users values('${player}','{"display_name":"Coop tester"}'),('${friend}','{"display_name":"Coop friend"}')`,
  );
  for (const who of [player, friend]) {
    await login(who);
    await db.query("select public.arena_me()");
    await db.query("select public.arena_farm()");
  }
  await owner(
    `insert into public.arena_farm_decor_pieces(player_id, item, x, y) values
     ($1, 'bench', 1100, 900), ($1, 'rock', 1240, 870), ($1, 'rock', 1100, 990), ($1, 'hay', 600, 900)`,
    [player],
  );
  await migrate(COOP_SQL);
  // Safe to run again.
  await migrate(COOP_SQL);
  for (const f of files.slice(at + 1)) await migrate(f);
  await owner(
    "select public.arena_grant_leaves($1, 100000, 'test', 'coop', public.arena_today())",
    [player],
  );
}, 60000);
afterAll(async () => db.close());

it("moves decorations standing where the coop goes into storage, once", async () => {
  const f = await farm();
  // The bench and the rock overlapped the coop; the others stay.
  expect(f.decor.map((p: any) => [p.item, p.x, p.y]).sort()).toEqual(
    [
      ["hay", 600, 900],
      ["rock", 1100, 990],
    ].sort(),
  );
  expect(f.decorCredits).toMatchObject({ bench: 1, rock: 1 });
  // Nothing can be placed there now, just as the shared rules say.
  for (const [item, x, y] of [
    ["rock", 1100, 900],
    ["bench", 1140, 960],
    ["rock", 1280, 850],
    ["rock", 980, 900],
  ] as const) {
    const sql = (
      await owner("select public.arena_farm_decor_fits($1, $2, $3, $4) e", [
        player,
        item,
        x,
        y,
      ])
    )[0].e;
    expect(sql, `${item} at ${x},${y}`).toBe(
      decorFits(
        item,
        x,
        y,
        f.decor.map((p: any) => ({ ...p, id: Number(p.id) })),
      ),
    );
  }
  expect(decorFits("rock", 1100, 900, [])).toBe("Something is in the way");
});

it("opens the coop at farm level 14 for 1500 leaves, with 3 hungry hens", async () => {
  let f = await farm();
  expect(f).toMatchObject({ coop: false, hens: [] });
  expect(await one({ a: "feed-hen", hen: 0 })).toEqual({
    ok: false,
    error: "Open the coop first",
  });
  expect(await one({ a: "buy-coop" })).toEqual({
    ok: false,
    error: `Unlocks at farm level ${COOP.level}`,
  });
  await owner(
    "update public.arena_farms set level = $2, xp = 0 where player_id = $1",
    [player, COOP.level],
  );
  f = await farm();
  const r = await act([{ a: "buy-coop" }, { a: "buy-coop" }]);
  expect(r.results[0]).toEqual({ ok: true, coop: true });
  expect(r.results[1]).toEqual({
    ok: false,
    error: "You already have the coop",
  });
  expect(f.leaves - r.farm.leaves).toBe(COOP.price);
  expect(r.farm.xp - f.xp).toBe(COOP.xp);
  expect(r.farm.coop).toBe(true);
  expect(r.farm.hens).toEqual(
    Array.from({ length: COOP.hens }, (_, i) => ({ i, eggAt: null })),
  );
  expect(
    r.farm.hens.map((h: any) => henState(h.eggAt, Date.parse(r.farm.now))),
  ).toEqual(["hungry", "hungry", "hungry"]);
});

it("feeds a hen 2 plain Breeze Wheat; she lays an egg 2 hours later", async () => {
  await setBarn("wheat", 3);
  await setBarn("wheat", 5, "wet");
  const before = await farm();
  const r = await act([
    { a: "feed-hen", hen: 0 },
    { a: "feed-hen", hen: 0 },
    { a: "feed-hen", hen: 1 },
    { a: "feed-hen", hen: 7 },
  ]);
  expect(r.results[0]).toMatchObject({ ok: true, fed: 0 });
  expect(r.results[1]).toEqual({
    ok: false,
    error: "This hen is already fed",
  });
  // Only 1 plain wheat left: a mutated crop is never fed to the hens.
  expect(r.results[2]).toEqual({
    ok: false,
    error: `You need ${COOP.feedQty} Breeze Wheat`,
  });
  expect(r.results[3]).toEqual({ ok: false, error: "Choose a hen" });
  expect(await barn("wheat")).toBe(1);
  expect(await barn("wheat", "wet")).toBe(5);
  expect(r.farm.xp).toBe(before.xp);
  const h0 = r.farm.hens[0];
  const wait = (Date.parse(h0.eggAt) - Date.parse(r.farm.now)) / 1000;
  expect(wait).toBeGreaterThan(COOP.laySeconds - 5);
  expect(wait).toBeLessThanOrEqual(COOP.laySeconds);
  expect(henState(h0.eggAt, Date.parse(r.farm.now))).toBe("laying");
  expect(await one({ a: "collect-egg", hen: 0 })).toEqual({
    ok: false,
    error: "This hen is still laying",
  });
  expect(await one({ a: "collect-egg", hen: 1 })).toEqual({
    ok: false,
    error: "Feed this hen first",
  });
});

it("collects the egg into the barn for 3 XP; the hen is hungry again", async () => {
  await hatch(0);
  let f = await farm();
  expect(henState(f.hens[0].eggAt, Date.parse(f.now))).toBe("egg");
  expect(await one({ a: "feed-hen", hen: 0 })).toEqual({
    ok: false,
    error: "Collect her egg first",
  });
  const r = await act([
    { a: "collect-egg", hen: 0 },
    { a: "collect-egg", hen: 0 },
  ]);
  expect(r.results[0]).toEqual({ ok: true, egg: 1, hen: 0 });
  expect(r.results[1]).toEqual({ ok: false, error: "Feed this hen first" });
  expect(r.farm.xp - f.xp).toBe(COOP.eggXp);
  expect(r.farm.barn).toContainEqual({ crop: EGG.id, mutation: "", qty: 1 });
  expect(r.farm.hens[0]).toEqual({ i: 0, eggAt: null });
  // Eggs take barn space: with the barn full, the egg waits in the coop.
  await setBarn("wheat", 2);
  await one({ a: "feed-hen", hen: 0 });
  await hatch(0);
  await setBarn("wheat", 0, "wet");
  const used = async () =>
    Number(
      (
        await owner(
          "select coalesce(sum(qty), 0)::int n from public.arena_farm_barn where player_id = $1",
          [player],
        )
      )[0].n,
    );
  await setBarn("carrot", 80 - (await used()));
  expect(await used()).toBe(80);
  expect(await one({ a: "collect-egg", hen: 0 })).toEqual({
    ok: false,
    error: "Your barn is full",
  });
  await setBarn("carrot", (await barn("carrot")) - 1);
  expect(await one({ a: "collect-egg", hen: 0 })).toEqual({
    ok: true,
    egg: 1,
    hen: 0,
  });
  await setBarn("carrot", 0);
});

it("sells eggs at their own price of the day", async () => {
  const f = await farm();
  const have = await barn("egg");
  expect(have).toBe(2);
  expect(f.eggMult).toBeGreaterThanOrEqual(EGG.multMin);
  expect(f.eggMult).toBeLessThanOrEqual(EGG.multMax);
  const r = await act([
    { a: "sell-eggs", qty: 1 },
    { a: "sell-eggs", qty: 5 },
    { a: "sell", crop: "egg", mutation: "", qty: 1 },
  ]);
  expect(r.results[0]).toEqual({
    ok: true,
    leaves: eggPrice(Number(f.eggMult)),
  });
  expect(r.results[1]).toEqual({
    ok: false,
    error: "You don't have that many",
  });
  // Not a crop: the crop market doesn't take it.
  expect(r.results[2]).toEqual({ ok: false, error: "Unknown crop" });
  expect(r.farm.leaves - f.leaves).toBe(eggPrice(Number(f.eggMult)));
  expect(await barn("egg")).toBe(1);
});

it("buys up to 6 more hens at rising prices", async () => {
  let f = await farm();
  const prices: number[] = [];
  for (let k = COOP.hens; k < COOP.maxHens; k++) {
    const r = await act([{ a: "buy-hen" }]);
    expect(r.results[0]).toEqual({ ok: true, hen: k, cost: henPrice(k) });
    prices.push(f.leaves - r.farm.leaves);
    expect(r.farm.hens).toHaveLength(k + 1);
    expect(r.farm.hens[k]).toEqual({ i: k, eggAt: null });
    f = r.farm;
  }
  expect(prices).toEqual(COOP.henPrices);
  expect(henPrice(COOP.maxHens)).toBeNull();
  expect(await one({ a: "buy-hen" })).toEqual({
    ok: false,
    error: "Your coop is full",
  });
  // A new hen is fed and lays like the first three.
  await setBarn("wheat", 2);
  expect(await one({ a: "feed-hen", hen: 8 })).toMatchObject({
    ok: true,
    fed: 8,
  });
});

it("a hen bought with too few leaves isn't added", async () => {
  // A second player, at level 14 with just enough for the coop.
  await owner("update public.arena_farms set level = 14 where player_id = $1", [
    friend,
  ]);
  await owner(
    "select public.arena_grant_leaves($1, $2, 'test', 'coop2', public.arena_today())",
    [friend, COOP.price],
  );
  await login(friend);
  const f = await farm(friend);
  await login(friend);
  const r = (
    await db.query<{ r: any }>("select public.arena_farm_act($1,$2::jsonb) r", [
      randomUUID(),
      JSON.stringify([{ a: "buy-coop" }, { a: "buy-hen" }]),
    ])
  ).rows[0].r;
  expect(r.results[0]).toEqual({ ok: true, coop: true });
  expect(r.results[1]).toEqual({ ok: false, error: "Not enough Gold Leaves" });
  expect(r.farm.hens).toHaveLength(COOP.hens);
  expect(r.farm.leaves).toBe(f.leaves - COOP.price);
});

it("asks for eggs on some orders once there is a coop, and checks them on delivery", async () => {
  // Fresh orders until one asks for eggs (about a third do).
  let order: any = null;
  for (let k = 0; k < 60 && !order; k++) {
    await owner("select public.arena_farm_new_order($1, 0, 14)", [player]);
    const o = (
      await owner(
        "select items, leaves, xp from public.arena_farm_orders where player_id = $1 and slot = 0",
        [player],
      )
    )[0];
    if (o.items.some(([id]: [string]) => id === "egg")) order = o;
  }
  expect(order).not.toBeNull();
  const eggs = order.items.find(([id]: [string]) => id === "egg")[1];
  expect(eggs).toBeGreaterThanOrEqual(2);
  expect(eggs).toBeLessThanOrEqual(4);
  // Every crop it asks for, but one egg short.
  for (const [id, n] of order.items) if (id !== "egg") await setBarn(id, n);
  await setBarn("egg", eggs - 1);
  const deliver = async () => {
    await login();
    return (
      await db.query<{ r: any }>(
        "select public.arena_farm_order($1, 0, 'deliver') r",
        [randomUUID()],
      )
    ).rows[0].r;
  };
  const short = await deliver();
  expect(short).toMatchObject({
    ok: false,
    error: `You need ${eggs} ${EGG.name}`,
  });
  expect(await barn("egg")).toBe(eggs - 1);
  await setBarn("egg", eggs + 1);
  const before = await farm();
  const done = await deliver();
  expect(done).toMatchObject({ ok: true });
  expect(await barn("egg")).toBe(1);
  expect(done.farm.leaves - before.leaves).toBe(order.leaves);
  // A farm without a coop never gets eggs.
  for (let k = 0; k < 30; k++) {
    await owner(
      "update public.arena_farms set coop = false where player_id = $1",
      [friend],
    );
    await owner("select public.arena_farm_new_order($1, 1, 14)", [friend]);
    const o = (
      await owner(
        "select items from public.arena_farm_orders where player_id = $1 and slot = 1",
        [friend],
      )
    )[0];
    expect(o.items.some(([id]: [string]) => id === "egg")).toBe(false);
  }
});

it("shows a friend your coop and how many hens live in it", async () => {
  const v = (
    await owner("select public.arena_farm_view($1, $2) v", [friend, player])
  )[0].v;
  expect(v).toMatchObject({ coop: true, hens: COOP.maxHens, pasture: false });
});
