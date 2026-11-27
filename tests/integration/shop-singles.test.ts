import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import { LOOK_ITEMS, SHOP_BUNDLES } from "../../packages/shared/src/shop";

/**
 * Singles: Look pieces sold on their own, outside any set. Every migration
 * runs, in order, as production has them.
 */
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000481";
const singles = LOOK_ITEMS.filter((i) => i.collection === "singles");

const economy = async () =>
  (await db.query<{ e: any }>("select public.arena_economy() as e")).rows[0].e;
const progress = async () =>
  (await db.query<{ p: any }>("select public.arena_raid_progress() as p"))
    .rows[0].p;
const equip = (slot: string, item: string) =>
  db.query("select public.arena_equip_raid_slot($1,$2)", [slot, item]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;insert into auth.users values('${player}','{"display_name":"Collector"}');`,
  );
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
  await db.exec(
    `select set_config('request.jwt.claim.sub','${player}',false);set role authenticated`,
  );
  await db.query("select public.arena_me()");
  await db.exec("reset role");
  await db.exec(
    `insert into public.arena_wallets(player_id, balance) values ('${player}', 100000) on conflict (player_id) do update set balance = 100000`,
  );
  await db.exec(
    `select set_config('request.jwt.claim.sub','${player}',false);set role authenticated`,
  );
}, 60000);
afterAll(async () => db.close());

it("seeds every single as the catalogue has them, opened to Today's Picks", async () => {
  // The 8 of 25 Nov and the 6 of 26 Nov.
  expect(singles).toHaveLength(14);
  await db.exec("reset role");
  const rows = (
    await db.query<any>(
      "select id, kind, champion, slot, rarity, price, items, in_picks, active from public.arena_shop_items where collection = 'singles' order by id",
    )
  ).rows;
  await db.exec("set role authenticated");
  expect(rows).toEqual(
    [...singles]
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .map((i) => ({
        id: i.id,
        kind: "look",
        champion: null,
        slot: i.slot,
        rarity: i.rarity,
        price: i.price,
        items: null,
        // Opened by 20261126004500_open_new_picks.sql, or seeded open by
        // 20261126023000_more_singles.sql (owner, 25 Nov).
        in_picks: true,
        active: true,
      })),
  );
  // No set sells them together.
  expect(SHOP_BUNDLES.some((b) => b.collection === "singles")).toBe(false);
});

it("sells and equips every single piece, one at a time and at its own price", async () => {
  const expected = { ...(await progress()).loadout };
  let balance = (await economy()).balance;
  for (const item of singles) {
    await db.query("select public.arena_buy_item($1)", [item.id]);
    const after = await economy();
    expect(after.owned, item.id).toContain(item.id);
    expect(balance - after.balance, item.id).toBe(item.price);
    balance = after.balance;
    await equip(item.slot, item.id);
    expected[item.slot] = item.id;
    expect((await progress()).loadout).toEqual(expected);
  }
  // Owning them all gives no collection frame away: Singles has no skins.
  const owned: string[] = (await economy()).owned;
  expect(owned.filter((id) => id.endsWith("-frame")).sort()).toEqual([
    "crown-frame",
    "laurel-frame",
  ]);
});
