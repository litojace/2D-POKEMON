import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, it, expect } from "vitest";
import { pacificDate } from "../../packages/shared/src/raid";
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
  weekly: false,
  week: "2026-10-12",
  daily: true,
  day: pacificDate(),
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
    "008_raid_progress.sql",
    "009_raid_hub.sql",
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
  expect([...p.cosmetics].sort()).toEqual([
    "conqueror",
    "cragbound",
    "mountain-aura",
    "mountainborn",
  ]);
  expect(p.bosses.grumblecrag.clears).toBe(5);
  expect(p.today.board[0].names).toEqual(["Raider"]);
  expect(p.today.cleared).toBe(true);
  expect(p.dailyClears).toEqual([pacificDate()]);
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

it("saves losses for titles and tuning without counting them as clears", async () => {
  await db.exec("reset role;set role service_role");
  const loss = (n: number, pillars: number, revives: number) => ({
    ...receipt(100 + n),
    result: "defeat",
    phaseReached: 2,
    seconds: 60,
    downCauses: { volley: 2, share: 1 },
    players: [
      { accountId: player, character: "terradon", pillars, revives, damage: 900, downs: 2 },
    ],
  });
  for (let n = 0; n < 3; n++)
    await db.query("select public.arena_record_raid($1::jsonb)", [
      JSON.stringify(loss(n, 9, 7)),
    ]);
  const p = await progress();
  expect(p.clears).toBe(5);
  expect(p.runs).toBe(8);
  expect(p.pillars).toBe(27);
  expect(p.revives).toBe(21);
  // Losses never reach the daily clear board.
  expect(p.today.board.every((row: any) => row.seconds !== 60)).toBe(true);
  const titles = (
    await db.query<{ p: any }>("select public.arena_me() as p")
  ).rows[0].p.ownedTitles.map((t: any) => t.name);
  expect(titles).toContain("Pillar Breaker");
  expect(titles).toContain("Mountain Guardian");
  expect(p.titles).toContain("Pillar Breaker");
});
it("equips one item per slot and refuses unearned or misplaced items", async () => {
  await login();
  await db.query("select public.arena_equip_raid_slot('frame','conqueror')");
  await db.query("select public.arena_equip_raid_slot('entrance','mountainborn')");
  await expect(
    db.query("select public.arena_equip_raid_slot('skin','cragstone')"),
  ).rejects.toThrow("not earned");
  await expect(
    db.query("select public.arena_equip_raid_slot('skin','conqueror')"),
  ).rejects.toThrow("another slot");
  const p = await progress();
  expect(p.loadout).toEqual({
    skin: "cragbound",
    aura: null,
    entrance: "mountainborn",
    frame: "conqueror",
    victory: null,
  });
  await db.query("select public.arena_equip_raid_slot('skin',null)");
  expect((await progress()).loadout.skin).toBeNull();
});
it("keeps balance data for admins only", async () => {
  await login();
  await expect(db.query("select public.arena_raid_balance()")).rejects.toThrow();
  await db.exec(`reset role;insert into public.arena_admins values('${player}')`);
  await login();
  const balance = (
    await db.query<{ p: any }>("select public.arena_raid_balance() as p")
  ).rows[0].p;
  expect(balance.downCauses).toEqual({
    "grumblecrag:volley": 6,
    "grumblecrag:share": 3,
  });
  expect(
    balance.runs.find((r: any) => r.result === "defeat").phaseReached,
  ).toBe(2);
});

it("grants feat, speed and solo rewards from rules, and the Victory slot", async () => {
  await db.exec("reset role;set role service_role");
  const run = (n: number, extra: object) => ({
    ...receipt(200 + n),
    daily: false,
    peril: 2,
    seconds: 300,
    ...extra,
  });
  // Feat (every charge baited) and a fast solo Peril 2 clear.
  await db.query("select public.arena_record_raid($1::jsonb)", [
    JSON.stringify(run(1, { feat: true, seconds: 205 })),
  ]);
  // A feat claimed on a loss never counts.
  await db.query("select public.arena_record_raid($1::jsonb)", [
    JSON.stringify(run(2, { feat: true, result: "defeat" })),
  ]);
  const p = await progress();
  expect(p.earned).toContain("rockslide-flex");
  expect(p.earned).toContain("avalanche");
  expect(p.stats.grumblecrag.feats).toBe(1);
  expect(p.titles).toContain("Avalanche");
  await db.query("select public.arena_equip_raid_slot('victory','rockslide-flex')");
  expect((await progress()).loadout.victory).toBe("rockslide-flex");
  await expect(
    db.query("select public.arena_equip_raid_slot('victory','cragbound')"),
  ).rejects.toThrow("another slot");
});
it("only records bosses that can be played, and keeps the rule check internal", async () => {
  await db.exec("reset role;set role service_role");
  await expect(
    db.query("select public.arena_record_raid($1::jsonb)", [
      JSON.stringify({ ...receipt(300), boss: "tidewyrm" }),
    ]),
  ).rejects.toThrow("Invalid raid");
  await login();
  await expect(
    db.query(`select public.arena_raid_earned('${player}')`),
  ).rejects.toThrow();
});
