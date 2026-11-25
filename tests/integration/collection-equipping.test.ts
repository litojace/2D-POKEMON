import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { beforeAll, afterAll, it, expect } from "vitest";
import {
  CHAMPION_SKINS,
  LOOK_ITEMS,
  SHOP_BUNDLES,
} from "../../packages/shared/src/shop";

let db: PGlite;
/** The six Look sets of migration 010, on sale when 018 repaired equipping. */
const ORIGINAL_SETS = SHOP_BUNDLES.slice(0, 6);
/** Seaside, Steamworks and Borealis (25 Nov 2026). */
const NEW_SETS = SHOP_BUNDLES.slice(6);
const player = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const admin = "00000000-0000-4000-8000-000000000003";
const login = (id = player) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
const economy = async () =>
  (await db.query<{ e: any }>("select public.arena_economy() as e")).rows[0].e;
const progress = async () =>
  (await db.query<{ p: any }>("select public.arena_raid_progress() as p"))
    .rows[0].p;
const equip = (slot: string | null, item: string | null) =>
  db.query("select public.arena_equip_raid_slot($1,$2)", [slot, item]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
  );
  for (const file of (await readdir("supabase/migrations"))
    .filter((f) => /^\d{3}_.*\.sql$/.test(f) && Number(f.slice(0, 3)) <= 17)
    .sort())
    await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
  for (const [id, name] of [
    [player, "Collection tester"],
    [other, "Other player"],
    [admin, "Admin tester"],
  ]) {
    await db.exec(
      `reset role;insert into auth.users values('${id}','{"display_name":"${name}"}')`,
    );
    await login(id);
    await db.query("select public.arena_me()");
  }
  await db.exec(
    `reset role;insert into public.arena_admins values('${admin}');insert into public.arena_wallets(player_id,balance) values('${player}',100000)`,
  );
  await login();
  for (const bundle of ORIGINAL_SETS)
    await db.query("select public.arena_buy_item($1)", [bundle.id]);
}, 30000);
afterAll(async () => db.close());

it("reproduces the old slot error, then repairs all appearance functions without losing purchases or admin testing", async () => {
  await login();
  const before = await economy();
  expect(before.owned).toHaveLength(30);
  await db.exec("reset role");
  const oldEquip = await readFile(
    "supabase/migrations/009_raid_hub.sql",
    "utf8",
  );
  await db.exec(
    oldEquip.slice(
      oldEquip.indexOf(
        "create or replace function public.arena_equip_raid_slot(",
      ),
      oldEquip.indexOf(
        "create or replace function public.arena_raid_balance()",
      ),
    ),
  );
  const oldProgress = await readFile(
    "supabase/migrations/008_raid_progress.sql",
    "utf8",
  );
  await db.exec(
    oldProgress.slice(
      oldProgress.indexOf(
        "create or replace function public.arena_raid_progress()",
      ),
      oldProgress.indexOf(
        "create or replace function public.arena_equip_raid_slot(",
      ),
    ),
  );
  await login();
  await expect(equip("victory", "galaxy-victory")).rejects.toThrow(
    "That item belongs in another slot",
  );
  expect((await progress()).loadout).not.toHaveProperty("victory");
  await db.exec(
    "reset role;update public.arena_shop_items set slot='aura' where id='galaxy-victory'",
  );
  const migration = await readFile(
    "supabase/migrations/018_collection_equipping.sql",
    "utf8",
  );
  await db.exec(migration);
  const applied = await db.exec(migration);
  expect(applied.at(-1)!.rows).toEqual([
    {
      collection_equipping_enabled: true,
      five_slot_loadout_enabled: true,
      collection_slots_valid: true,
    },
  ]);
  await login();
  expect((await economy()).balance).toBe(before.balance);
  expect((await economy()).owned).toEqual(before.owned);
  await equip("victory", "galaxy-victory");
  expect((await progress()).loadout.victory).toBe("galaxy-victory");
  await login(admin);
  expect(await economy()).toMatchObject({
    unlimitedCoins: true,
    mythicTesting: true,
  });
});

it.each(ORIGINAL_SETS)(
  "equips all five $name pieces together and saves each change independently",
  async (bundle) => {
    await login();
    const expected = { ...(await progress()).loadout };
    for (const id of bundle.items) {
      const item = LOOK_ITEMS.find((i) => i.id === id)!;
      await equip(item.slot, item.id);
      expected[item.slot] = item.id;
      expect((await progress()).loadout).toEqual(expected);
    }
    // A fresh authenticated request reads the persisted five-slot loadout.
    await login();
    expect((await progress()).loadout).toEqual(expected);
  },
);

it("clears one slot at a time without clearing the others", async () => {
  await login();
  const expected = { ...(await progress()).loadout };
  for (const slot of ["skin", "aura", "entrance", "frame", "victory"]) {
    await equip(slot, null);
    expected[slot] = null;
    expect((await progress()).loadout).toEqual(expected);
  }
});

it("rejects wrong slots, unowned items, unknown items and suspended accounts", async () => {
  await login();
  await expect(equip("aura", "galaxy-victory")).rejects.toThrow("another slot");
  await expect(equip("skin", "voltkit-midnight")).rejects.toThrow(
    "Unknown cosmetic",
  );
  await expect(equip("victory", "not-an-item")).rejects.toThrow(
    "Unknown cosmetic",
  );
  await expect(equip("hat", null)).rejects.toThrow("Unknown slot");
  await expect(equip(null, null)).rejects.toThrow("Unknown slot");
  await login(other);
  await expect(equip("victory", "galaxy-victory")).rejects.toThrow(
    "not earned",
  );
  await expect(equip("skin", "cragbound")).rejects.toThrow("not earned");
  await db.exec(
    `reset role;update public.arena_profiles set suspended=true where id='${other}'`,
  );
  await login(other);
  await expect(equip("skin", null)).rejects.toThrow("Login required");
});

it("still equips earned raid rewards alongside collection pieces", async () => {
  await db.exec("reset role;set role service_role");
  for (let i = 1; i <= 5; i++) {
    await db.query("select public.arena_record_raid($1::jsonb)", [
      JSON.stringify({
        id: `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
        boss: "grumblecrag",
        peril: 1,
        trait: "ancient",
        gilded: false,
        weekly: false,
        partySize: 1,
        seconds: 300,
        downs: 0,
        revives: 0,
        players: [{ accountId: player, character: "voltkit" }],
      }),
    ]);
  }
  await login();
  await equip("aura", "galaxy-aura");
  await equip("victory", "galaxy-victory");
  await equip("skin", "cragbound");
  expect((await progress()).loadout).toMatchObject({
    skin: "cragbound",
    aura: "galaxy-aura",
    victory: "galaxy-victory",
  });
});

// It buys every champion skin (250+ purchases): about 6 s on a quiet machine,
// and past the default 10 s when CI runs the suite in parallel.
it("keeps every champion skin equippable through its separate champion slot", async () => {
  // The catalog includes the newest champions' skins, which 053 and 054
  // seed, the Cyber Mecha Epics (069), and the Nature champions' (070, 071;
  // 070's other changes need the farm tables, so just its skins).
  await db.exec("reset role");
  for (const file of [
    "053_new_champion_skins.sql",
    "054_new_champion_mythicals.sql",
    "069_cyber_mecha_epics.sql",
  ])
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  const nature = await readFile(
    "supabase/migrations/070_eighteen_champions.sql",
    "utf8",
  );
  await db.exec(
    nature.slice(
      nature.indexOf("insert into public.arena_shop_items"),
      nature.indexOf("items = excluded.items;") +
        "items = excluded.items;".length,
    ),
  );
  await db.exec(
    await readFile(
      "supabase/migrations/071_nature_void_knights_and_cyber.sql",
      "utf8",
    ),
  );
  // The fashion collections and Nova Vanguard skins (17 Nov 2026), the
  // Legendary rarity and the Sky Pirates (18 Nov).
  for (const file of [
    "20261117170000_fashion_collections.sql",
    "20261117170001_distinct_epic_collections.sql",
    "20261117170002_nova_vanguard.sql",
    // The Legendary rarity (Nova moves to it) and the Sky Pirates.
    "20261118100000_legendary_skins_and_skin_sets.sql",
    "20261118120000_sky_pirates.sql",
    // Hồn Việt (Epic).
    "20261118140000_hon_viet.sql",
    // Hero Squad (Epic).
    "20261118160000_hero_squad.sql",
    // Dream Carnival retired.
    "20261118170000_retire_dream_carnival.sql",
    // Neon Campus (Epic).
    "20261118180000_neon_campus.sql",
    // Stars & Stripes (Legendary).
    "20261118190000_stars_stripes.sql",
    // New items stay out of Today's Picks; Starlight Idol (Epic).
    "20261125120000_shop_picks_opt_in.sql",
    "20261125130000_starlight_idol.sql",
    // Birthstone (Common).
    "20261125150000_birthstone.sql",
    // Rainy Day (Rare).
    "20261125160000_rainy_day.sql",
    // Grand Prix (Epic).
    "20261125170000_grand_prix.sql",
    // Sun Dynasty (Legendary).
    "20261125180000_sun_dynasty.sql",
  ])
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await login(admin);
  for (const skin of CHAMPION_SKINS) {
    await db.query("select public.arena_buy_item($1)", [skin.id]);
    const stage = skin.rarity === "mythical" ? 3 : 1;
    await db.query("select public.arena_equip_champion_skin($1,$2,$3)", [
      skin.champion,
      skin.id,
      stage,
    ]);
    expect((await economy()).looks[skin.champion]).toEqual({
      skin: skin.id,
      stage,
    });
  }
  expect((await economy()).balance).toBe(0);
}, 60_000);

it("sells and equips every piece of the Look sets added on 25 Nov 2026", async () => {
  expect(NEW_SETS.map((b) => b.id)).toEqual([
    "seaside-set",
    "steamworks-set",
    "borealis-set",
  ]);
  await db.exec("reset role");
  await db.exec(
    await readFile(
      "supabase/migrations/20261125140000_seaside_steamworks_borealis.sql",
      "utf8",
    ),
  );
  await db.exec(
    `update public.arena_wallets set balance = 100000 where player_id = '${player}'`,
  );
  await login();
  for (const bundle of NEW_SETS) {
    await db.query("select public.arena_buy_item($1)", [bundle.id]);
    const expected = { ...(await progress()).loadout };
    for (const id of bundle.items) {
      const item = LOOK_ITEMS.find((i) => i.id === id)!;
      await equip(item.slot, item.id);
      expected[item.slot] = item.id;
      expect((await progress()).loadout).toEqual(expected);
    }
  }
});

it("sells and equips every single piece, one at a time and at its own price", async () => {
  const singles = LOOK_ITEMS.filter((i) => i.collection === "singles");
  expect(singles).toHaveLength(8);
  await db.exec("reset role");
  await db.exec(
    await readFile(
      "supabase/migrations/20261125200000_look_singles.sql",
      "utf8",
    ),
  );
  await db.exec(
    `update public.arena_wallets set balance = 100000 where player_id = '${player}'`,
  );
  await login();
  const expected = { ...(await progress()).loadout };
  let balance = (await economy()).balance;
  for (const item of singles) {
    await db.query("select public.arena_buy_item($1)", [item.id]);
    const after = await economy();
    expect(balance - after.balance, item.id).toBe(item.price);
    balance = after.balance;
    await equip(item.slot, item.id);
    expected[item.slot] = item.id;
    expect((await progress()).loadout).toEqual(expected);
  }
  // There is no set to buy them by.
  await expect(
    db.query("select public.arena_buy_item('singles-set')"),
  ).rejects.toThrow();
});
