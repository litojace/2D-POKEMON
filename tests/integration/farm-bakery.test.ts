import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  DECOR_AREA,
  FARM_DECOR,
  decorFits,
  type FarmDecorPiece,
} from "../../packages/shared/src/farm";
import {
  BAKERY,
  BAKERY_RECIPES,
  BAKERY_RECIPE_BY_ID,
  bakeError,
  bakeSlotPrice,
  bakeStart,
  collectError,
  freeBakeSlot,
  rushError,
  rushPrice,
} from "../../packages/shared/src/farm-bakery";

// Migration 20261117120000: the Bakery, its oven's queue and baked goods.
const MIGRATION = "20261117120000_farm_bakery.sql";
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000b01";
const login = (who = player) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${who}',false);set role authenticated`,
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
const one = async (a: object) => (await act([a])).results[0];
const setBarn = async (crop: string, qty: number, mutation = "") =>
  owner(
    `insert into public.arena_farm_barn(player_id, crop, mutation, qty) values ($1, $2, $3, $4)
     on conflict (player_id, crop, mutation) do update set qty = excluded.qty`,
    [player, crop, mutation, qty],
  );
const emptyBarn = () =>
  owner("delete from public.arena_farm_barn where player_id = $1", [player]);
const stock = (f: any, crop: string, mutation = "") =>
  f.barn.find((b: any) => b.crop === crop && b.mutation === mutation)?.qty ?? 0;
const level = (lv: number) =>
  owner(
    "update public.arena_farms set level = $2, xp = 0 where player_id = $1",
    [player, lv],
  );
/** The player is away: everything in the oven started `s` seconds earlier. */
const away = (s: number) =>
  owner(
    `update public.arena_farm_bakery_queue set started_at = started_at - make_interval(secs => $2),
       ready_at = ready_at - make_interval(secs => $2) where player_id = $1`,
    [player, s],
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
    `reset role;insert into auth.users values('${player}','{"display_name":"Bakery tester"}')`,
  );
  await login();
  await db.query("select public.arena_me()");
  await db.query("select public.arena_farm()");
  await owner(
    "select public.arena_grant_leaves($1, 100000, 'test', 'bakery', public.arena_today())",
    [player],
  );
}, 60000);
afterAll(async () => db.close());

it("has the shared recipes: ingredients, time, XP, price and level", async () => {
  const rows = await owner(
    "select id, name, level, seconds, xp, sell, items from public.arena_farm_bakery_recipes order by level, id",
  );
  expect(rows).toEqual(
    [...BAKERY_RECIPES]
      .sort((a, b) => a.level - b.level || a.id.localeCompare(b.id))
      .map((r) => ({
        id: r.id,
        name: r.name,
        level: r.level,
        seconds: r.seconds,
        xp: r.xp,
        sell: r.sell,
        items: r.items,
      })),
  );
  // Every ingredient is a barn good, and so is every baked good.
  const goods = new Set(
    (await owner("select id from public.arena_farm_goods")).map(
      (r: any) => r.id,
    ),
  );
  for (const r of BAKERY_RECIPES) {
    expect(goods.has(r.id)).toBe(true);
    for (const [id] of r.items) expect(goods.has(id)).toBe(true);
  }
});

it("is built at farm level 10 for its price, once, for farm XP", async () => {
  let f = await farm();
  expect(f.bakery).toEqual({ owned: false, slots: 2, queue: [] });
  expect(await one({ a: "bake", recipe: "bread" })).toEqual({
    ok: false,
    error: "Build the bakery first",
  });
  expect(await one({ a: "buy-bake-slot" })).toEqual({
    ok: false,
    error: "Build the bakery first",
  });
  await level(BAKERY.level - 1);
  expect(await one({ a: "buy-bakery" })).toEqual({
    ok: false,
    error: `Unlocks at farm level ${BAKERY.level}`,
  });
  await level(BAKERY.level);
  f = await farm();
  const r = await act([{ a: "buy-bakery" }, { a: "buy-bakery" }]);
  expect(r.results[0]).toMatchObject({ ok: true, bakery: true });
  expect(r.results[1]).toEqual({
    ok: false,
    error: "You already have the bakery",
  });
  expect(f.leaves - r.farm.leaves).toBe(BAKERY.price);
  expect(r.farm.xp - f.xp).toBe(BAKERY.xp);
  expect(r.farm.bakery).toEqual({
    owned: true,
    slots: BAKERY.startSlots,
    queue: [],
  });
});

it("answers bake the way the shared rules do, and takes only plain goods", async () => {
  await emptyBarn();
  await level(BAKERY.level);
  const cases: [string, () => Promise<unknown>][] = [
    ["bread", async () => setBarn("wheat", 2)],
    ["bread", async () => setBarn("wheat", 5, "gold")],
    ["carrotcake", async () => level(14)],
    ["carrotcake", async () => setBarn("carrot", 3)],
    ["milkbun", async () => setBarn("milk", 0)],
    ["pumpkinpie", async () => level(BAKERY.level)],
    ["nope", async () => {}],
  ];
  for (const [recipe, setup] of cases) {
    await setup();
    const f = await farm();
    const shared = bakeError(f, recipe);
    expect(shared).not.toBeNull();
    expect(await one({ a: "bake", recipe })).toEqual({
      ok: false,
      error: shared,
    });
  }
  // Short of one ingredient: nothing was taken.
  const f = await farm();
  expect(stock(f, "wheat")).toBe(2);
  expect(stock(f, "wheat", "gold")).toBe(5);
  expect(stock(f, "carrot")).toBe(3);
});

it("bakes one at a time from a queue on the server's clock, and fills up", async () => {
  await level(14);
  await emptyBarn();
  await setBarn("wheat", 20);
  await setBarn("wheat", 4, "gold");
  await setBarn("voltberry", 3);
  const before = await farm();
  const r = await act([
    { a: "bake", recipe: "bread" },
    { a: "bake", recipe: "berrytart" },
    { a: "bake", recipe: "bread" },
  ]);
  expect(r.results[0]).toMatchObject({ ok: true, baking: "bread", slot: 0 });
  expect(r.results[1]).toMatchObject({
    ok: true,
    baking: "berrytart",
    slot: 1,
  });
  expect(r.results[2]).toEqual({
    ok: false,
    error: "The bakery queue is full",
  });
  expect(bakeError(r.farm, "bread")).toBe("The bakery queue is full");
  // Ingredients left the barn: plain only, the gold wheat stays.
  expect(stock(r.farm, "wheat")).toBe(20 - 3 - 2);
  expect(stock(r.farm, "wheat", "gold")).toBe(4);
  expect(stock(r.farm, "voltberry")).toBe(0);
  // The bread starts now; the tart when the bread is done.
  const [bread, tart] = r.farm.bakery.queue;
  const now = Date.parse(r.farm.now);
  expect(bread).toMatchObject({ slot: 0, recipe: "bread" });
  expect(Math.abs(Date.parse(bread.startedAt) - now)).toBeLessThan(5000);
  expect(Date.parse(bread.readyAt) - Date.parse(bread.startedAt)).toBe(
    BAKERY_RECIPE_BY_ID.bread.seconds * 1000,
  );
  expect(tart.startedAt).toBe(bread.readyAt);
  expect(Date.parse(tart.readyAt) - Date.parse(tart.startedAt)).toBe(
    BAKERY_RECIPE_BY_ID.berrytart.seconds * 1000,
  );
  expect(r.results[1].readyAt).toBe(tart.readyAt);
  expect(bakeStart([bread], Date.parse(bread.startedAt))).toBe(
    Date.parse(tart.startedAt),
  );
  // Nothing is ready yet.
  expect(await one({ a: "bake-collect", slot: 0 })).toEqual({
    ok: false,
    error: "Still baking",
  });
  expect(before.leaves).toBe(r.farm.leaves);
});

it("keeps baking while the player is away, and collects into the barn for XP", async () => {
  // Away long enough for the bread, not the tart.
  await away(BAKERY_RECIPE_BY_ID.bread.seconds + 5);
  let f = await farm();
  const now = Date.parse(f.now);
  expect(collectError(f, 0, now)).toBeNull();
  expect(collectError(f, 1, now)).toBe("Still baking");
  expect(collectError(f, 3, now)).toBe("Nothing in that slot");
  const r = await act([
    { a: "bake-collect", slot: 0 },
    { a: "bake-collect", slot: 0 },
    { a: "bake-collect", slot: 1 },
    { a: "bake-collect", slot: "1" },
    { a: "bake-collect", slot: 1.5 },
    { a: "bake-collect" },
  ]);
  expect(r.results[0]).toEqual({
    ok: true,
    baked: "bread",
    qty: 1,
    slot: 0,
    xp: BAKERY_RECIPE_BY_ID.bread.xp,
  });
  expect(r.results.slice(1)).toEqual([
    { ok: false, error: "Nothing in that slot" },
    { ok: false, error: "Still baking" },
    { ok: false, error: "Nothing in that slot" },
    { ok: false, error: "Nothing in that slot" },
    { ok: false, error: "Nothing in that slot" },
  ]);
  expect(r.farm.xp - f.xp).toBe(BAKERY_RECIPE_BY_ID.bread.xp);
  expect(stock(r.farm, "bread")).toBe(1);
  // The freed slot takes the next one: after the tart.
  const b = await one({ a: "bake", recipe: "bread" });
  expect(b).toMatchObject({ ok: true, slot: 0 });
  f = await farm();
  const tart = f.bakery.queue.find((q: any) => q.recipe === "berrytart");
  expect(f.bakery.queue.map((q: any) => q.recipe)).toEqual([
    "berrytart",
    "bread",
  ]);
  expect(f.bakery.queue[1].startedAt).toBe(tart.readyAt);
  // Away all night: both are done, collected in any order.
  await away(24 * 3600);
  const c = await act([
    { a: "bake-collect", slot: 0 },
    { a: "bake-collect", slot: 1 },
  ]);
  expect(c.results.map((x: any) => x.baked)).toEqual(["bread", "berrytart"]);
  expect(c.farm.bakery.queue).toEqual([]);
  expect(stock(c.farm, "bread")).toBe(2);
  expect(stock(c.farm, "berrytart")).toBe(1);
  // An idle oven starts the next one now, not in the past.
  const d = await act([{ a: "bake", recipe: "bread" }]);
  expect(
    Math.abs(
      Date.parse(d.farm.bakery.queue[0].startedAt) - Date.parse(d.farm.now),
    ),
  ).toBeLessThan(5000);
});

it("waits in the oven while the barn is full", async () => {
  await away(24 * 3600);
  const f = await farm();
  const used = f.barn.reduce((a: number, b: any) => a + b.qty, 0);
  await setBarn("carrot", f.barnCap - used + stock(f, "carrot"));
  const full = await farm();
  expect(collectError(full, 0, Date.parse(full.now))).toBe("Your barn is full");
  expect(await one({ a: "bake-collect", slot: 0 })).toEqual({
    ok: false,
    error: "Your barn is full",
  });
  expect((await farm()).bakery.queue).toHaveLength(1);
  await setBarn("carrot", 0);
  expect(await one({ a: "bake-collect", slot: 0 })).toMatchObject({
    ok: true,
    baked: "bread",
  });
});

it("sells more queue slots, up to 5, at their prices", async () => {
  let f = await farm();
  for (let slots = BAKERY.startSlots; slots < BAKERY.maxSlots; slots++) {
    const price = bakeSlotPrice(slots)!;
    const r = await act([{ a: "buy-bake-slot" }]);
    expect(r.results[0]).toEqual({
      ok: true,
      bakeSlots: slots + 1,
      cost: price,
    });
    expect(f.leaves - r.farm.leaves).toBe(price);
    expect(r.farm.bakery.slots).toBe(slots + 1);
    f = r.farm;
  }
  expect(bakeSlotPrice(BAKERY.maxSlots)).toBeNull();
  expect(await one({ a: "buy-bake-slot" })).toEqual({
    ok: false,
    error: "Your bakery has every slot",
  });
  // Five in the queue, each after the one before.
  await emptyBarn();
  await setBarn("wheat", 30);
  const r = await act(
    Array.from({ length: 6 }, () => ({ a: "bake", recipe: "bread" })),
  );
  expect(r.results.filter((x: any) => x.ok)).toHaveLength(5);
  expect(r.results[5]).toEqual({
    ok: false,
    error: "The bakery queue is full",
  });
  const q = r.farm.bakery.queue;
  expect(q.map((x: any) => x.slot).sort()).toEqual([0, 1, 2, 3, 4]);
  for (let k = 1; k < q.length; k++)
    expect(q[k].startedAt).toBe(q[k - 1].readyAt);
  expect(freeBakeSlot(q, 5)).toBe(-1);
  await away(24 * 3600);
  await act(q.map((x: any) => ({ a: "bake-collect", slot: x.slot })));
});

it("finishes what's in the oven for leaves, and moves the queue up", async () => {
  await level(14);
  await emptyBarn();
  await setBarn("wheat", 9);
  await setBarn("voltberry", 3);
  const r = await act([
    { a: "bake", recipe: "bread" },
    { a: "bake", recipe: "berrytart" },
    { a: "bake", recipe: "bread" },
  ]);
  const slotOf = (recipe: string, k = 0) =>
    r.farm.bakery.queue.filter((q: any) => q.recipe === recipe)[k].slot;
  const [bread, tart, last] = [
    slotOf("bread"),
    slotOf("berrytart"),
    slotOf("bread", 1),
  ];
  let f = await farm();
  const now = Date.parse(f.now);
  // Only what's in the oven now; the shared rules say the same.
  for (const [slot, error] of [
    [tart, "Not in the oven yet"],
    [4, "Nothing in that slot"],
  ] as const) {
    expect(rushError(f, slot, now)).toBe(error);
    expect(await one({ a: "bake-rush", slot })).toEqual({ ok: false, error });
  }
  // A fresh bread (10 minutes left) costs 2 leaves a minute: 20.
  const q0 = f.bakery.queue.find((q: any) => q.slot === bread);
  const price = rushPrice((Date.parse(q0.readyAt) - now) / 1000);
  expect(price).toBe(20);
  expect(rushError(f, bread, now)).toBeNull();
  const tartBefore = f.bakery.queue.find((q: any) => q.slot === tart);
  const lastBefore = f.bakery.queue.find((q: any) => q.slot === last);
  const x = await act([
    { a: "bake-rush", slot: bread },
    { a: "bake-rush", slot: bread },
    { a: "bake-rush", slot: "0" },
  ]);
  expect(x.results).toEqual([
    { ok: true, rushed: "bread", slot: bread, cost: price },
    { ok: false, error: "Already done" },
    { ok: false, error: "Nothing in that slot" },
  ]);
  expect(f.leaves - x.farm.leaves).toBe(price);
  // It's ready now; the tart starts now instead of in 10 minutes, and the
  // last bread moves up by the same time.
  const after = (slot: number) =>
    x.farm.bakery.queue.find((q: any) => q.slot === slot);
  const saved = Date.parse(q0.readyAt) - Date.parse(after(bread).readyAt);
  expect(saved).toBeGreaterThan(590_000);
  expect(Date.parse(after(bread).readyAt)).toBeLessThanOrEqual(
    Date.parse(x.farm.now),
  );
  expect(after(tart).startedAt).toBe(after(bread).readyAt);
  expect(Date.parse(tartBefore.readyAt) - Date.parse(after(tart).readyAt)).toBe(
    saved,
  );
  expect(
    Date.parse(lastBefore.startedAt) - Date.parse(after(last).startedAt),
  ).toBe(saved);
  expect(after(last).startedAt).toBe(after(tart).readyAt);
  expect(await one({ a: "bake-collect", slot: bread })).toMatchObject({
    ok: true,
    baked: "bread",
  });
  // Short of leaves: nothing changes.
  const wallet = await owner(
    "select balance from public.arena_leaf_wallets where player_id = $1",
    [player],
  );
  await owner(
    "update public.arena_leaf_wallets set balance = 5 where player_id = $1",
    [player],
  );
  f = await farm();
  expect(rushError(f, tart, Date.parse(f.now))).toBe("Not enough Gold Leaves");
  expect(await one({ a: "bake-rush", slot: tart })).toEqual({
    ok: false,
    error: "Not enough Gold Leaves",
  });
  expect((await farm()).bakery.queue).toEqual(f.bakery.queue);
  await owner(
    "update public.arena_leaf_wallets set balance = $2 where player_id = $1",
    [player, wallet[0].balance],
  );
  await away(24 * 3600);
  await act([
    { a: "bake-collect", slot: tart },
    { a: "bake-collect", slot: last },
  ]);
  expect((await farm()).bakery.queue).toEqual([]);
});

it("sells baked goods at the market at their fixed price", async () => {
  await emptyBarn();
  await setBarn("bread", 3);
  await setBarn("carrotcake", 1);
  const f = await farm();
  const r = await act([
    { a: "sell-good", good: "bread", qty: 2 },
    { a: "sell-good", good: "carrotcake", qty: 2 },
    { a: "sell-good", good: "wheat", qty: 1 },
    { a: "sell-good", good: "bread", qty: 0 },
    { a: "sell-good", good: "bread", qty: 1.5 },
    { a: "sell-good", good: "bread", qty: "1" },
    { a: "sell", crop: "bread", mutation: "", qty: 1 },
  ]);
  expect(r.results).toEqual([
    { ok: true, leaves: 2 * BAKERY_RECIPE_BY_ID.bread.sell },
    { ok: false, error: "You don't have that many" },
    { ok: false, error: "Unknown good" },
    { ok: false, error: "Choose how many to sell" },
    { ok: false, error: "Choose how many to sell" },
    { ok: false, error: "Choose how many to sell" },
    { ok: false, error: "Unknown crop" },
  ]);
  expect(r.farm.leaves - f.leaves).toBe(2 * BAKERY_RECIPE_BY_ID.bread.sell);
  expect(stock(r.farm, "bread")).toBe(1);
  expect(stock(r.farm, "carrotcake")).toBe(1);
});

it("puts baked goods in orders, and delivers them from the barn", async () => {
  await level(20);
  await owner("delete from public.arena_farm_orders where player_id = $1", [
    player,
  ]);
  let found: any = null;
  for (let k = 0; k < 60 && !found; k++) {
    await owner(
      "update public.arena_farm_orders set items = null, wait_until = now() - interval '1 second' where player_id = $1",
      [player],
    );
    const f = await farm();
    found = f.orders.find((o: any) =>
      o.items?.some(([id]: [string]) => BAKERY_RECIPE_BY_ID[id]),
    );
  }
  expect(found).toBeTruthy();
  const goods = found.items.filter(([id]: [string]) => BAKERY_RECIPE_BY_ID[id]);
  expect(goods).toHaveLength(1);
  const [good, n] = goods[0];
  expect(n === 1 || n === 2).toBe(true);
  expect(BAKERY_RECIPE_BY_ID[good].level).toBeLessThanOrEqual(20);
  // Every crop it asks for, but not the baked good: the answer names it.
  await emptyBarn();
  for (const [id, m] of found.items)
    if (!BAKERY_RECIPE_BY_ID[id]) await setBarn(id, m);
  await login();
  const deliver = async () =>
    (
      await db.query<{ r: any }>(
        "select public.arena_farm_order($1, $2, 'deliver') r",
        [randomUUID(), found.slot],
      )
    ).rows[0].r;
  const no = await deliver();
  expect(no).toMatchObject({
    ok: false,
    error: `You need ${n} ${BAKERY_RECIPE_BY_ID[good].name}`,
  });
  await setBarn(good, n);
  const before = await farm();
  const yes = await deliver();
  expect(yes.ok).toBe(true);
  expect(yes.farm.leaves - before.leaves).toBe(found.leaves);
  expect(stock(yes.farm, good)).toBe(0);
});

it("keeps decorations off the Bakery, and moved any that stood there into storage", async () => {
  // The same answers as decorFits on and around its ground.
  const placed: FarmDecorPiece[] = [];
  const checks: [string, number, number][] = [];
  for (let x = BAKERY.ground.x0 - 120; x <= BAKERY.ground.x1 + 120; x += 30)
    for (let y = BAKERY.ground.y0 - 60; y <= DECOR_AREA.y1; y += 20)
      checks.push([FARM_DECOR[(x + y) % FARM_DECOR.length].id, x, y]);
  await owner(
    "delete from public.arena_farm_decor_pieces where player_id = $1",
    [player],
  );
  const sql = await owner(
    `select c.ord, public.arena_farm_decor_fits($1, c.item, c.x, c.y) e
       from jsonb_to_recordset($2::jsonb) c(ord int, item text, x int, y int) order by c.ord`,
    [
      player,
      JSON.stringify(checks.map(([item, x, y], ord) => ({ ord, item, x, y }))),
    ],
  );
  expect(sql.map((r: any) => r.e)).toEqual(
    checks.map(([item, x, y]) => decorFits(item, x, y, placed)),
  );
  expect(decorFits("rock", 1180, BAKERY.y - 25, [])).toBe(
    "Something is in the way",
  );
  // A rock on its ground and a bench beside it; the migration runs again.
  await owner(
    `insert into public.arena_farm_decor_pieces(player_id, item, x, y) values
       ($1, 'rock', 1180, $2), ($1, 'bench', 1000, 1000)`,
    [player, BAKERY.y - 25],
  );
  await owner(
    "delete from public.arena_farm_decor_credits where player_id = $1",
    [player],
  );
  await db.exec(await readFile(`supabase/migrations/${MIGRATION}`, "utf8"));
  await db.exec(await readFile(`supabase/migrations/${MIGRATION}`, "utf8"));
  const f = await farm();
  expect(f.decor.map((p: any) => p.item)).toEqual(["bench"]);
  expect(f.decorCredits).toEqual({ rock: 1 });
  // Running it again kept the Bakery, its slots and its goods.
  expect(f.bakery.owned).toBe(true);
  expect(f.bakery.slots).toBe(BAKERY.maxSlots);
});
