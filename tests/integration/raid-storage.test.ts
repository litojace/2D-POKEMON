import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, it, expect } from "vitest";
import { raidWeekly } from "../../packages/shared/src/raid";
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000001";
const login = async () =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${player}',false);set role authenticated;`,
  );
const progress = async () => {
  await login();
  return (
    await db.query<{ p: any }>("select public.arena_raid_progress() as p")
  ).rows[0].p;
};
const receipt = (id: number) => ({
  id: `10000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
  boss: "grumblecrag",
  peril: id === 5 ? 3 : 1,
  trait: "ancient",
  gilded: false,
  weekly: true,
  week: raidWeekly().week,
  seed: 100,
  partySize: 1,
  seconds: 330 - id,
  downs: 0,
  revives: 0,
  players: [{ accountId: player, character: "voltkit" }],
});
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
  ])
    await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
  await login();
  await db.query("select public.arena_me()");
}, 20000);
afterAll(async () => db.close());
it("rejects browser-forged clears and direct reward writes", async () => {
  await login();
  await expect(
    db.query("select public.arena_record_raid($1::jsonb)", [
      JSON.stringify(receipt(1)),
    ]),
  ).rejects.toThrow();
  await expect(
    db.query(
      `insert into public.arena_raid_runs(id,boss)values('${receipt(1).id}','grumblecrag')`,
    ),
  ).rejects.toThrow();
  await expect(
    db.query("select public.arena_equip_raid_cosmetic('mountain-aura')"),
  ).rejects.toThrow("not earned");
});
it("records verified clears once, grants guaranteed rewards, and leaves Elo unchanged", async () => {
  await db.exec("reset role;set role service_role");
  for (let id = 1; id <= 5; id++)
    await db.query("select public.arena_record_raid($1::jsonb)", [
      JSON.stringify(receipt(id)),
    ]);
  await db.query("select public.arena_record_raid($1::jsonb)", [
    JSON.stringify(receipt(5)),
  ]);
  const p = await progress();
  expect(p.clears).toBe(5);
  expect(p.highestPeril).toBe(3);
  expect(p.cosmetics).toEqual(["cragbound", "mountain-aura"]);
  expect(p.weekly[0].names).toEqual(["Raider"]);
  await db.query("select public.arena_equip_raid_cosmetic('cragbound')");
  expect((await progress()).equipped).toBe("cragbound");
  const account = (await db.query<{ p: any }>("select public.arena_me() as p"))
    .rows[0].p;
  expect(account.ownedTitles.map((t: any) => t.name)).toContain("Cragbreaker");
  expect(account.ownedTitles.map((t: any) => t.name)).toContain(
    "Mountain Conqueror",
  );
  const rating = (
    await db.query<{ p: any }>("select public.arena_my_rating() as p")
  ).rows[0].p;
  expect(rating.matches).toBe(0);
  expect(rating.rating).toBe(1000);
});
