import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  ALL_BUNDLES,
  CHAMPION_SKINS,
  LOOK_ITEMS,
} from "../../packages/shared/src/shop";

/**
 * New Shop items stay out of Today's Picks until a migration opens them
 * (20261125120000_shop_picks_opt_in.sql): an app built before an item
 * existed cannot draw its tile, and the iOS app carries its own copy of the
 * game.
 */
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000431";
const OPT_IN = "20261125120000_shop_picks_opt_in.sql";
/** Every item picked on any of 400 days. */
const picked = async () =>
  (
    await db.query<{ id: string }>(
      `select distinct item_id as id from generate_series(0, 399) d, public.arena_shop_picks(date '2026-11-25' + d::int) order by 1`,
    )
  ).rows.map((r) => r.id);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;insert into auth.users values('${player}','{"display_name":"Picker"}');`,
  );
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
}, 60000);
afterAll(async () => db.close());

it("keeps every item that was on sale before the change in Today's Picks", async () => {
  const before = (
    await db.query<{ n: number }>(
      `select count(*)::int as n from public.arena_shop_items where active and in_picks and kind <> 'bundle'`,
    )
  ).rows[0].n;
  // 324 champion skins and 30 collection pieces were on sale that day.
  expect(before).toBeGreaterThanOrEqual(354);
  const ids = await picked();
  // 400 days of four picks reach nearly all of them.
  expect(ids.length).toBeGreaterThan(300);
});

it("leaves a new item out of the picks until it is opened, and sells it meanwhile", async () => {
  // The catalog seed's own statement (scripts/shop-seed.ts): no in_picks.
  await db.exec(
    `insert into public.arena_shop_items(id, kind, champion, slot, name, rarity, collection, price, items) values
      ('voltkit-test-new', 'champion', 'voltkit', null, 'Test', 'common', null, 500, null),
      ('testing-aura', 'look', null, 'aura', 'Test aura', 'rare', 'testing', 900, null)
     on conflict (id) do update set kind = excluded.kind, champion = excluded.champion, slot = excluded.slot,
      name = excluded.name, rarity = excluded.rarity, collection = excluded.collection, price = excluded.price, items = excluded.items;`,
  );
  const fresh = ["testing-aura", "voltkit-test-new"];
  expect((await picked()).filter((id) => fresh.includes(id))).toEqual([]);
  // The economy a player reads never names them as a pick either.
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${player}',false);set role authenticated`,
  );
  await db.query("select public.arena_me()");
  const e = (await db.query<{ e: any }>("select public.arena_economy() as e"))
    .rows[0].e;
  expect(e.picks.items).toHaveLength(4);
  for (const id of e.picks.items) expect(fresh).not.toContain(id);
  // On sale all the same: the price is its list price.
  await db.exec("reset role");
  await db.exec(
    `insert into public.arena_wallets(player_id, balance) values ('${player}', 5000) on conflict (player_id) do update set balance = 5000`,
  );
  await db.exec(
    `select set_config('request.jwt.claim.sub','${player}',false);set role authenticated`,
  );
  await db.query("select public.arena_buy_item('voltkit-test-new')");
  const after = (
    await db.query<{ e: any }>("select public.arena_economy() as e")
  ).rows[0].e;
  expect(after.owned).toContain("voltkit-test-new");
  // Opening it is one update.
  await db.exec("reset role");
  await db.exec(
    `update public.arena_shop_items set in_picks = true where id = 'testing-aura'`,
  );
  expect(await picked()).toContain("testing-aura");
  expect(await picked()).not.toContain("voltkit-test-new");
  await db.exec(
    `delete from public.arena_owned_items where item_id = 'voltkit-test-new'; delete from public.arena_shop_items where id in ('voltkit-test-new', 'testing-aura')`,
  );
});

it("running the migration again never opens the items held back", async () => {
  await db.exec("reset role");
  await db.exec(
    `insert into public.arena_shop_items(id, kind, slot, name, rarity, collection, price) values ('testing-frame', 'look', 'frame', 'Test frame', 'rare', 'testing', 800)`,
  );
  await db.exec(await readFile("supabase/migrations/" + OPT_IN, "utf8"));
  const row = (
    await db.query<{ in_picks: boolean }>(
      `select in_picks from public.arena_shop_items where id = 'testing-frame'`,
    )
  ).rows[0];
  expect(row.in_picks).toBe(false);
  await db.exec(
    `delete from public.arena_shop_items where id = 'testing-frame'`,
  );
});

it("has every catalog item on sale under its own kind: no reward or retired row was overwritten", async () => {
  // A reward item (Journey, season, collection frame) and a retired skin
  // are rows that are not on sale; the seed's upsert keeps `active` as it
  // was, so a catalog id that landed on one of them shows up here.
  await db.exec("reset role");
  const rows = (
    await db.query<{ id: string; kind: string; active: boolean }>(
      `select id, kind, active from public.arena_shop_items`,
    )
  ).rows;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const wrong: string[] = [];
  const check = (id: string, kind: string) => {
    const r = byId.get(id);
    if (!r || !r.active || r.kind !== kind) wrong.push(id);
  };
  for (const s of CHAMPION_SKINS) check(s.id, "champion");
  for (const i of LOOK_ITEMS) check(i.id, "look");
  for (const b of ALL_BUNDLES) check(b.id, "bundle");
  expect(wrong).toEqual([]);
  const raid = (
    await db.query<{ id: string }>(`select id from public.arena_raid_rewards`)
  ).rows.map((r) => r.id);
  const sold = new Set([...byId.keys()].filter((id) => byId.get(id)!.active));
  expect(raid.filter((id) => sold.has(id))).toEqual([]);
});

it("opens the eight collections of 25 Nov to Today's Picks, sets excepted, and runs again safely", async () => {
  // 20261125190000_open_new_picks.sql ran with every other migration.
  const OPENED = [
    "starlight-idol",
    "seaside",
    "steamworks",
    "borealis",
    "birthstone",
    "rainy-day",
    "grand-prix",
    "sun-dynasty",
  ];
  await db.exec("reset role");
  const counts = async () =>
    (
      await db.query<{
        collection: string;
        kind: string;
        opened: number;
        held: number;
      }>(
        `select collection, kind, count(*) filter (where in_picks)::int as opened, count(*) filter (where not in_picks)::int as held
           from public.arena_shop_items where collection = any($1::text[]) group by collection, kind order by collection, kind`,
        [OPENED],
      )
    ).rows;
  const rows = await counts();
  // Every skin and Look piece is opened; no set bundle ever is.
  for (const r of rows)
    expect(r, `${r.collection} ${r.kind}`).toMatchObject(
      r.kind === "bundle" ? { opened: 0 } : { held: 0 },
    );
  // 18 skins each in the five skin collections, 5 pieces in each Look set.
  const items = rows.filter((r) => r.kind !== "bundle");
  expect(items.reduce((n, r) => n + r.opened, 0)).toBe(5 * 18 + 3 * 5);
  // Over 400 days the picks reach them.
  const ids = await picked();
  expect(
    ids.filter((id) => id.endsWith("-sun-dynasty")).length,
  ).toBeGreaterThan(0);
  expect(ids).toContain("seaside-aura");
  // Running it again changes nothing, and a new item stays held back.
  await db.exec(
    `insert into public.arena_shop_items(id, kind, slot, name, rarity, collection, price) values ('testing-banner', 'look', 'frame', 'Test', 'rare', 'testing', 800)`,
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20261125190000_open_new_picks.sql",
      "utf8",
    ),
  );
  expect(await counts()).toEqual(rows);
  expect(
    (
      await db.query<{ in_picks: boolean }>(
        `select in_picks from public.arena_shop_items where id = 'testing-banner'`,
      )
    ).rows[0].in_picks,
  ).toBe(false);
  await db.exec(
    `delete from public.arena_shop_items where id = 'testing-banner'`,
  );
});
