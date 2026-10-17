import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000001";
const login = async () =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${player}',false);set role authenticated;`,
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
  ])
    await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
  await login();
  await db.query("select public.arena_me()");
}, 30000);
afterAll(async () => db.close());

it("pays raid clears with a daily cap, the daily bonus once, and ignores repeats", async () => {
  await act("r1", "raid", raidClear(2, true));
  await act("r1", "raid", raidClear(2, true));
  expect((await economy()).balance).toBe(45 + 50);
  for (let n = 2; n <= 7; n++) await act(`r${n}`, "raid", raidClear(3, true));
  const e = await economy();
  // Five paid clears a day: 45 + four Peril 3 clears at 60.
  expect(e.today.raidClears).toBe(5);
  expect(e.balance).toBe(45 + 50 + 4 * 60);
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
