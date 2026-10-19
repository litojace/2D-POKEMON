import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000001";
const admin = "00000000-0000-4000-8000-000000000002";
const login = async (id = player) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
const economy = async () => {
  await login();
  return (await db.query<{ e: any }>("select public.arena_economy() as e")).rows[0].e;
};
const today = async () =>
  (await db.query<{ d: string }>("select public.arena_today()::text as d")).rows[0].d;
const me = (extra: object = {}) => ({
  accountId: player,
  character: "voltkit",
  won: false,
  vsPeople: false,
  botLevel: null,
  mode: "duel",
  knockedOut: false,
  skillUses: 0,
  ults: 0,
  activeSeconds: 90,
  ...extra,
});
const act = async (id: string, kind: "match" | "raid", player: object) => {
  await db.exec("reset role;set role service_role");
  await db.query("select public.arena_record_activity($1::jsonb)", [
    JSON.stringify({ id, kind, day: await today(), players: [player] }),
  ]);
};
/**
 * Coins excluding daily-mission rewards. Missions are picked by date, so on
 * some days these raid clears also finish a mission (and pay it); the raid
 * pay itself must not depend on the day the tests run.
 */
const paidExceptMissions = async () => {
  const balance = (await economy()).balance;
  await db.exec("reset role");
  const missions = (
    await db.query<{ coins: number }>(
      `select coalesce(sum(amount), 0)::int as coins from public.arena_coin_ledger where player_id = '${player}' and reason in ('mission', 'missions-bonus', 'streak')`,
    )
  ).rows[0].coins;
  return balance - missions;
};
const raidClear = (peril: number, daily = false) =>
  me({ raid: { cleared: true, daily, peril, flawless: true, feat: true, revives: 4 } });
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;insert into auth.users values('${player}','{"display_name":"Raider"}');`,
  );
  for (const file of [
    "001_arena_accounts.sql",
    "002_admin_cleanup_reports.sql",
    "003_titles.sql",
    "004_matches_achievements.sql",
    "005_friends.sql",
    "006_ratings.sql",
    "007_raids.sql",
    "008_raid_progress.sql",
    "009_raid_hub.sql",
    "010_shop.sql",
    "011_collection_bonus.sql",
    "012_tidewyrm.sql",
    "013_gloomshade.sql",
    "014_missions.sql",
    "015_somnara.sql",
    "016_admin_shop_coins.sql",
  ])
    await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
  await login();
  await db.query("select public.arena_me()");
}, 30000);
afterAll(async () => db.close());

it("pays raid clears with a daily cap, the daily bonus once, and ignores repeats", async () => {
  await act("r1", "raid", raidClear(2, true));
  await act("r1", "raid", raidClear(2, true));
  expect(await paidExceptMissions()).toBe(45 + 50);
  for (let n = 2; n <= 7; n++) await act(`r${n}`, "raid", raidClear(3, true));
  const e = await economy();
  // Five paid clears a day: 45 + four Peril 3 clears at 60.
  expect(e.today.raidClears).toBe(5);
  expect(await paidExceptMissions()).toBe(45 + 50 + 4 * 60);
});

it("pays real matches against people only, up to ten a day", async () => {
  for (let n = 1; n <= 11; n++)
    await act(`m${n}`, "match", me({ won: n <= 6, vsPeople: true }));
  await act("idle", "match", me({ won: true, vsPeople: true, activeSeconds: 5 }));
  await act("bot", "match", me({ won: true, botLevel: "hard" }));
  expect((await economy()).today.pvpMatches).toBe(10);
  await db.exec("reset role");
  const pvp = (
    await db.query<{ n: number; coins: number }>(
      "select count(*)::int as n, sum(amount)::int as coins from public.arena_coin_ledger where reason = 'pvp'",
    )
  ).rows[0];
  // 6 wins × 15 + 4 losses × 6; the 11th, the idle and the bot match pay nothing.
  expect(pvp).toEqual({ n: 10, coins: 90 + 24 });
});

it("counts Mythic Trial wins from wins against people and raid clears, not bots", async () => {
  const e = await economy();
  expect(e.trialWins.voltkit).toBe(6 + 7);
});

it("sells items once, checks coins and Mythic Trials, and keeps coins server-side", async () => {
  await login();
  await expect(db.query("select public.arena_buy_item('voltkit-stormcrown')")).rejects.toThrow("Mythic Trial");
  await expect(db.query("select public.arena_buy_item('nope')")).rejects.toThrow("not for sale");
  await expect(db.query("select public.arena_record_activity('{}'::jsonb)")).rejects.toThrow();
  await expect(db.query("select * from public.arena_wallets")).rejects.toThrow();
  await db.exec(`reset role;update public.arena_wallets set balance = 20000 where player_id = '${player}';update public.arena_champion_wins set wins = 30 where champion = 'voltkit'`);
  await login();
  const bought = (await db.query<{ e: any }>("select public.arena_buy_item('voltkit-stormcrown') as e")).rows[0].e;
  expect(bought.owned).toContain("voltkit-stormcrown");
  expect(bought.awakening["voltkit-stormcrown"].stage).toBe(1);
  await expect(db.query("select public.arena_buy_item('voltkit-stormcrown')")).rejects.toThrow("already own");
  // A set costs 80% of the pieces not yet owned.
  await db.query("select public.arena_buy_item('candy-aura')");
  const before = (await economy()).balance;
  await login();
  await db.query("select public.arena_buy_item('candy-set')");
  expect(before - (await economy()).balance).toBe(3120);
});

it("equips champion skins and collection pieces only when owned", async () => {
  await login();
  await db.query("select public.arena_equip_champion_skin('voltkit','voltkit-stormcrown',1)");
  await expect(
    db.query("select public.arena_equip_champion_skin('voltkit','voltkit-stormcrown',3)"),
  ).rejects.toThrow("not unlocked");
  await expect(
    db.query("select public.arena_equip_champion_skin('voltkit','voltkit-snowcap',1)"),
  ).rejects.toThrow("do not own");
  await expect(
    db.query("select public.arena_equip_champion_skin('cindrake','voltkit-stormcrown',1)"),
  ).rejects.toThrow("another champion");
  const looks = (await db.query<{ l: any }>("select public.arena_my_looks() as l")).rows[0].l;
  expect(looks.voltkit).toEqual({ skin: "voltkit-stormcrown", stage: 1 });
  await db.query("select public.arena_equip_raid_slot('victory','candy-victory')");
  await expect(db.query("select public.arena_equip_raid_slot('aura','galaxy-aura')")).rejects.toThrow("not earned");
  const progress = (await db.query<{ p: any }>("select public.arena_raid_progress() as p")).rows[0].p;
  expect(progress.loadout.victory).toBe("candy-victory");
});

it("advances Awakening with wins wearing the Mythical", async () => {
  for (let n = 0; n < 25; n++)
    await act(`aw${n}`, "match", me({ won: true, vsPeople: true, skin: "voltkit-stormcrown" }));
  const e = await economy();
  expect(e.awakening["voltkit-stormcrown"].wins).toBe(25);
  expect(e.awakening["voltkit-stormcrown"].stage).toBe(2);
});

it("offers three daily missions and one re-roll", async () => {
  const e = await economy();
  expect(e.missions.map((m: any) => m.tier)).toEqual(["easy", "medium", "hard"]);
  const open = e.missions.find((m: any) => !m.done);
  await login();
  if (open) {
    const after = (await db.query<{ e: any }>(`select public.arena_reroll_mission(${open.slot}) as e`)).rows[0].e;
    expect(after.rerolled).toBe(true);
    expect(after.missions[open.slot].id).not.toBe(open.id);
    await expect(db.query(`select public.arena_reroll_mission(${open.slot})`)).rejects.toThrow("already re-rolled");
  } else
    await expect(db.query("select public.arena_reroll_mission(0)")).rejects.toThrow("already done");
});

it("gives a collection's frame free once every champion skin in it is owned", async () => {
  await db.exec(`reset role;insert into public.arena_owned_items(player_id, item_id) select '${player}', id from public.arena_shop_items where kind = 'champion' and collection = 'winter' and id <> 'terradon-snowball' on conflict do nothing;update public.arena_wallets set balance = 5000 where player_id = '${player}'`);
  expect((await economy()).owned).not.toContain("winter-frame");
  await login();
  const after = (await db.query<{ e: any }>("select public.arena_buy_item('terradon-snowball') as e")).rows[0].e;
  expect(after.owned).toContain("winter-frame");
  expect(after.balance).toBe(5000 - 1500);
  // Owning the frame takes it off the set's price.
  await db.exec("reset role");
  const price = (await db.query<{ p: number }>(`select public.arena_item_price('${player}', 'winter-set', public.arena_today()) as p`)).rows[0].p;
  expect(price).toBe(Math.round(((300 + 900 + 1000 + 1800) * 0.8) / 10) * 10);
});


it("gives only database-verified admins unlimited spending and ends it on revocation", async () => {
  await db.exec(`reset role;insert into auth.users values ('${admin}', '{"display_name":"Shop tester","isAdmin":true}');`);
  await login(admin);
  await db.query("select public.arena_me()");
  const state = async () => (await db.query<{ e: any }>("select public.arena_economy() as e")).rows[0].e;
  expect((await state()).unlimitedCoins).toBe(false);
  await expect(db.query(`insert into public.arena_admins values ('${admin}')`)).rejects.toThrow();
  await expect(db.query("select public.arena_buy_item('voltkit-midnight')")).rejects.toThrow("Not enough coins");

  await db.exec(`reset role;insert into public.arena_admins values ('${admin}');`);
  // Reapplying the migration preserves data and permissions.
  await db.exec(await readFile("supabase/migrations/016_admin_shop_coins.sql", "utf8"));
  await login(admin);
  expect(await state()).toMatchObject({ unlimitedCoins: true, balance: 0 });
  const bought = (await db.query<{ e: any }>("select public.arena_buy_item('voltkit-midnight') as e")).rows[0].e;
  expect(bought).toMatchObject({ unlimitedCoins: true, balance: 0 });
  expect(bought.owned).toContain("voltkit-midnight");
  await db.query("select public.arena_equip_champion_skin('voltkit','voltkit-midnight',1)");
  expect((await state()).looks.voltkit.skin).toBe("voltkit-midnight");
  await db.query("select public.arena_buy_item('candy-set')");
  expect((await state()).owned).toEqual(expect.arrayContaining(["candy-aura", "candy-frame", "candy-victory", "candy-entrance", "candy-colours"]));
  await expect(db.query("select public.arena_buy_item('voltkit-midnight')")).rejects.toThrow("already own");
  await expect(db.query("select public.arena_buy_item('nope')")).rejects.toThrow("not for sale");
  await expect(db.query("select public.arena_buy_item('voltkit-stormcrown')")).rejects.toThrow("Mythic Trial");

  await db.exec(`reset role;insert into public.arena_wallets(player_id,balance) values ('${admin}',275);`);
  await login(admin);
  await db.query("select public.arena_buy_item('voltkit-snowcap')");
  expect((await state()).balance).toBe(275);
  await db.exec("reset role");
  expect((await db.query<{ balance: number }>(`select balance from public.arena_wallets where player_id='${admin}'`)).rows[0].balance).toBe(275);
  expect((await db.query<{ n: number }>(`select count(*)::int as n from public.arena_coin_ledger where player_id='${admin}'`)).rows[0].n).toBe(0);
  const audits = (await db.query<{ details: { item: string; price: number } }>(`select details from public.arena_admin_audit where actor_id='${admin}' and action='shop_test_purchase' order by id`)).rows;
  expect(audits.map(a => a.details.item)).toEqual(["voltkit-midnight", "candy-set", "voltkit-snowcap"]);
  expect(audits.every(a => a.details.price > 0)).toBe(true);

  await db.exec(`delete from public.arena_admins where user_id='${admin}'`);
  await login(admin);
  expect(await state()).toMatchObject({ unlimitedCoins: false, balance: 275 });
  await expect(db.query("select public.arena_buy_item('cindrake-ashen')")).rejects.toThrow("Not enough coins");
  await db.exec(`reset role;insert into public.arena_admins values ('${admin}');update public.arena_profiles set suspended=true where id='${admin}'`);
  await login(admin);
  expect((await state()).unlimitedCoins).toBe(false);
  await expect(db.query("select public.arena_buy_item('cindrake-ashen')")).rejects.toThrow("Login required");
});

it("lets admins test all Mythic stages without changing earned wins or raid clears", async () => {
  const tester = "00000000-0000-4000-8000-000000000003";
  await db.exec("reset role");
  const migration = await readFile("supabase/migrations/017_admin_mythic_testing.sql", "utf8");
  await db.exec(migration);
  const repeated = await db.exec(migration);
  expect(repeated.at(-1)!.rows).toEqual([{ mythic_testing_enabled: true, admin_stages_enabled: true }]);
  await db.exec(`insert into auth.users values ('${tester}', '{"display_name":"Mythic tester","isAdmin":true}');`);
  await login(tester);
  await db.query("select public.arena_me()");
  const state = async () => (await db.query<{ e: any }>("select public.arena_economy() as e")).rows[0].e;
  expect(await state()).toMatchObject({ mythicTesting: false, unlimitedCoins: false });
  await expect(db.query("select public.arena_buy_item('auralynx-celestial-sage')")).rejects.toThrow("Mythic Trial");
  await db.exec(`reset role;insert into public.arena_admins values ('${tester}')`);
  const skins = (await db.query<{ id: string; champion: string }>("select id, champion from public.arena_shop_items where rarity='mythical' order by id")).rows;
  expect(skins).toHaveLength(8);
  await login(tester);
  const before = await state();
  expect(before).toMatchObject({ mythicTesting: true, unlimitedCoins: true, balance: 0 });
  for (const skin of skins) {
    await db.query("select public.arena_buy_item($1)", [skin.id]);
    for (const stage of [1, 2, 3]) {
      await db.query("select public.arena_equip_champion_skin($1,$2,$3)", [skin.champion, skin.id, stage]);
      expect((await state()).looks[skin.champion]).toEqual({ skin: skin.id, stage });
    }
  }
  const after = await state();
  expect(after.balance).toBe(0);
  expect(after.trialWins).toEqual(before.trialWins);
  for (const skin of skins)
    expect(after.awakening[skin.id]).toEqual({ wins: 0, peril3: false, stage: 1 });
  const visible = (await db.query<{ looks: any }>("select public.arena_my_looks() as looks")).rows[0].looks;
  expect(visible.auralynx).toEqual({ skin: "auralynx-celestial-sage", stage: 3 });
  await expect(db.query("select public.arena_equip_champion_skin('auralynx','auralynx-celestial-sage',4)")).rejects.toThrow("not unlocked");
  await expect(db.query("select public.arena_equip_champion_skin('auralynx','auralynx-celestial-sage',0)")).rejects.toThrow("not unlocked");
  await expect(db.query("select public.arena_equip_champion_skin('voltkit','auralynx-celestial-sage',3)")).rejects.toThrow("another champion");
  await expect(db.query("select public.arena_equip_champion_skin('voltkit','voltkit-snowcap',1)")).rejects.toThrow("do not own");
  await db.query("select public.arena_buy_item('voltkit-snowcap')");
  await expect(db.query("select public.arena_equip_champion_skin('voltkit','voltkit-snowcap',3)")).rejects.toThrow("not unlocked");

  await db.exec(`reset role;delete from public.arena_admins where user_id='${tester}'`);
  await login(tester);
  expect((await state()).mythicTesting).toBe(false);
  await expect(db.query("select public.arena_equip_champion_skin('auralynx','auralynx-celestial-sage',3)")).rejects.toThrow("not unlocked");
  await db.query("select public.arena_equip_champion_skin('auralynx','auralynx-celestial-sage',1)");
  await login();
  expect((await state()).mythicTesting).toBe(false);
  await expect(db.query("select public.arena_equip_champion_skin('voltkit','voltkit-stormcrown',3)")).rejects.toThrow("not unlocked");
  await expect(db.query("select public.arena_buy_item('lumoth-starweaver')")).rejects.toThrow("Mythic Trial");

  await db.exec(`reset role;insert into public.arena_admins values ('${tester}');update public.arena_profiles set suspended=true where id='${tester}'`);
  await login(tester);
  expect((await state()).mythicTesting).toBe(false);
  await expect(db.query("select public.arena_equip_champion_skin('auralynx','auralynx-celestial-sage',3)")).rejects.toThrow("Login required");
  await expect(db.query("select public.arena_buy_item('cindrake-ashen')")).rejects.toThrow("Login required");
});
