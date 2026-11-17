import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  spireStartFrom,
  type SpireMember,
} from "../../packages/shared/src/spire";

// The Spire's storage (migrations 20261116150000 and, for zones 2 to 4,
// 20261116180000, 20261117090000 and 20261117150000): each cleared floor is saved at once, first-clear coins
// and titles are paid once per player, and the server reads checkpoints and
// raid clears before a climb.
let db: PGlite;
const ana = "00000000-0000-4000-8000-0000000051a1";
const bo = "00000000-0000-4000-8000-0000000051a2";
const run = (n: number) =>
  `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const as = (id: string) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
const server = async <T>(sql: string, args: unknown[] = []) => {
  await db.exec("reset role;set role service_role;");
  const r = await db.query<{ v: T }>(sql, args);
  await db.exec("reset role");
  return r.rows[0]?.v as T;
};
const floor = (runId: string, f: number, players = [ana]) => ({
  runId,
  season: 0,
  floor: f,
  startFloor: 1,
  partySize: players.length,
  seconds: 40 * f,
  blessings: { [players[0]]: { keen: 1 } },
  players: players.map((accountId) => ({ accountId, character: "terradon" })),
});
const record = (receipt: object) =>
  server<{
    newClaims: {
      accountId: string;
      floor: number;
      coins: number;
      titles: string[];
    }[];
  }>("select public.arena_record_spire_floor($1::jsonb) as v", [
    JSON.stringify(receipt),
  ]);
const progress = async (id: string) => {
  await as(id);
  return (
    await db.query<{ p: any }>("select public.arena_spire_progress() as p")
  ).rows[0].p;
};
const balance = async (id: string) => {
  await db.exec("reset role");
  return (
    await db.query<{ b: number }>(
      `select coalesce((select balance from public.arena_wallets where player_id='${id}'),0) as b`,
    )
  ).rows[0].b;
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
  );
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
  // Safe to run again, in order. (Zone 1's applied migration resets every
  // season-0 reward row, so zones 2 to 4's, which restore their own, run
  // after.)
  for (const f of [
    "20261116150000_spire.sql",
    "20261116180000_spire_zone2.sql",
    "20261117090000_spire_zone3.sql",
    "20261117150000_spire_zone4.sql",
  ])
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
  await db.exec(
    `reset role;insert into auth.users values('${ana}','{"display_name":"Ana"}'),('${bo}','{"display_name":"Bo"}')`,
  );
  for (const id of [ana, bo]) {
    await as(id);
    await db.query("select public.arena_me()");
  }
}, 120000);
afterAll(async () => db.close());

it("starts everyone at floor 1 with nothing claimed", async () => {
  expect(await progress(ana)).toMatchObject({
    season: 0,
    highestFloor: 0,
    checkpoint: 1,
    attempts: 0,
    claimed: [],
    clears: {},
  });
});

it("keeps browsers away from the server's calls and the tables", async () => {
  await as(ana);
  await expect(
    db.query("select public.arena_record_spire_floor($1::jsonb)", [
      JSON.stringify(floor(run(1), 1)),
    ]),
  ).rejects.toThrow(/permission denied/);
  await expect(
    db.query(`select public.arena_spire_start(array['${ana}']::uuid[])`),
  ).rejects.toThrow(/permission denied/);
  await expect(
    db.query("select * from public.arena_spire_claims"),
  ).rejects.toThrow(/permission denied/);
  await expect(
    db.query("select * from public.arena_spire_rewards"),
  ).rejects.toThrow(/permission denied/);
});

it("saves each floor at once and pays its first clear only once", async () => {
  const before = await balance(ana);
  const first = await record(floor(run(1), 1));
  expect(first.newClaims).toEqual([
    { accountId: ana, floor: 1, coins: 20, titles: [] },
  ]);
  // The same floor again (a retried save, or a later climb): nothing new.
  expect((await record(floor(run(1), 1))).newClaims).toEqual([]);
  expect((await record(floor(run(2), 1))).newClaims).toEqual([]);
  expect(await balance(ana)).toBe(before + 20);
  for (const f of [2, 3, 4, 5]) await record(floor(run(2), f));
  const p = await progress(ana);
  expect(p.highestFloor).toBe(5);
  expect(p.checkpoint).toBe(1);
  // Two climbs (run 1 and run 2), whatever the number of floors saved.
  expect(p.attempts).toBe(2);
  expect(p.claimed).toEqual([1, 2, 3, 4, 5]);
  expect(await balance(ana)).toBe(before + 20 + 20 + 25 + 25 + 60);
  // Floor 5's title.
  await as(ana);
  const me = (await db.query<{ p: any }>("select public.arena_me() as p"))
    .rows[0].p;
  expect(me.ownedTitles.map((t: any) => t.name)).toContain("Echo Breaker");
  // The climb's row keeps its highest floor.
  await db.exec("reset role");
  const row = (
    await db.query<{ floor_reached: number; party_size: number }>(
      `select floor_reached, party_size from public.arena_spire_runs where id='${run(2)}'`,
    )
  ).rows[0];
  expect(row).toEqual({ floor_reached: 5, party_size: 1 });
});

it("pays each member of a party, and only their own first clears", async () => {
  const before = { ana: await balance(ana), bo: await balance(bo) };
  const result = await record(floor(run(3), 1, [ana, bo]));
  expect(result.newClaims).toEqual([
    { accountId: bo, floor: 1, coins: 20, titles: [] },
  ]);
  expect(await balance(ana)).toBe(before.ana);
  expect(await balance(bo)).toBe(before.bo + 20);
});

it("pays floor 10's title once, and opens checkpoint 11 (zone 2)", async () => {
  const before = await balance(ana);
  for (const f of [6, 7, 8, 9]) await record(floor(run(4), f));
  const boss = await record(floor(run(4), 10));
  expect(boss.newClaims).toEqual([
    {
      accountId: ana,
      floor: 10,
      coins: 120,
      titles: ["Earthshaker of the Spire"],
    },
  ]);
  // A second clear of the Ascendant pays nothing more.
  expect((await record(floor(run(6), 10))).newClaims).toEqual([]);
  expect(await balance(ana)).toBe(before + 30 + 30 + 35 + 35 + 120);
  await as(ana);
  const me = (await db.query<{ p: any }>("select public.arena_me() as p"))
    .rows[0].p;
  expect(me.ownedTitles.map((t: any) => t.name)).toContain(
    "Earthshaker of the Spire",
  );
  const p = await progress(ana);
  expect(p.highestFloor).toBe(10);
  expect(p.claimed).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  // Zone 1 is conquered: climbs may start at floor 11 (zone 2).
  expect(p.checkpoint).toBe(11);
  // Zone 2's floors pay their own first clears; floor 20 its title.
  const before2 = await balance(ana);
  for (const f of [11, 12, 13, 14, 15, 16, 17, 18, 19])
    await record({ ...floor(run(7), f), startFloor: 11 });
  const top = await record({ ...floor(run(7), 20), startFloor: 11 });
  expect(top.newClaims).toEqual([
    {
      accountId: ana,
      floor: 20,
      coins: 200,
      titles: ["Tidecaller of the Spire"],
    },
  ]);
  expect(await balance(ana)).toBe(
    before2 + 40 + 40 + 45 + 45 + 100 + 50 + 50 + 55 + 55 + 200,
  );
  const p2 = await progress(ana);
  expect(p2.highestFloor).toBe(20);
  // Zone 2 is conquered: climbs may start at floor 21 (zone 3).
  expect(p2.checkpoint).toBe(21);
  // Replaying zone 1 keeps the highest floor and the checkpoint.
  await record(floor(run(8), 3));
  expect(await progress(ana)).toMatchObject({
    highestFloor: 20,
    checkpoint: 21,
  });
  // Zone 3's floors pay their own first clears; floor 30 its title.
  const before3 = await balance(ana);
  for (const f of [21, 22, 23, 24, 25, 26, 27, 28, 29])
    await record({ ...floor(run(9), f), startFloor: 21 });
  const summit = await record({ ...floor(run(9), 30), startFloor: 21 });
  expect(summit.newClaims).toEqual([
    {
      accountId: ana,
      floor: 30,
      coins: 250,
      titles: ["Lanternbane of the Spire"],
    },
  ]);
  // A second clear of the Ascendant Inkpurr pays nothing more.
  expect(
    (await record({ ...floor(run(10), 30), startFloor: 21 })).newClaims,
  ).toEqual([]);
  expect(await balance(ana)).toBe(
    before3 + 55 + 55 + 60 + 60 + 130 + 65 + 65 + 70 + 70 + 250,
  );
  await as(ana);
  const me2 = (await db.query<{ p: any }>("select public.arena_me() as p"))
    .rows[0].p;
  expect(me2.ownedTitles.map((t: any) => t.name)).toContain(
    "Lanternbane of the Spire",
  );
  const p3 = await progress(ana);
  expect(p3.highestFloor).toBe(30);
  // Zone 3 is conquered: climbs may start at floor 31 (zone 4).
  expect(p3.checkpoint).toBe(31);
  // Zone 4's floors pay their own first clears; floor 40 its title.
  const before4 = await balance(ana);
  for (const f of [31, 32, 33, 34, 35, 36, 37, 38, 39])
    await record({ ...floor(run(11), f), startFloor: 31 });
  const forty = await record({ ...floor(run(11), 40), startFloor: 31 });
  expect(forty.newClaims).toEqual([
    {
      accountId: ana,
      floor: 40,
      coins: 300,
      titles: ["Dreambreaker of the Spire"],
    },
  ]);
  // A second clear of the Ascendant Snoozaku pays nothing more.
  expect(
    (await record({ ...floor(run(12), 40), startFloor: 31 })).newClaims,
  ).toEqual([]);
  expect(await balance(ana)).toBe(
    before4 + 70 + 70 + 75 + 75 + 160 + 80 + 80 + 85 + 85 + 300,
  );
  await as(ana);
  const me3 = (await db.query<{ p: any }>("select public.arena_me() as p"))
    .rows[0].p;
  expect(me3.ownedTitles.map((t: any) => t.name)).toContain(
    "Dreambreaker of the Spire",
  );
  const p4 = await progress(ana);
  expect(p4.highestFloor).toBe(40);
  // Zone 5 isn't built: the checkpoint stays at 31.
  expect(p4.checkpoint).toBe(31);
});

it("gives checkpoint 11 to players who conquered zone 1 before zone 2 existed", async () => {
  // As before zone 2's migration ran: floor 10 cleared, checkpoint 1.
  const old = "00000000-0000-4000-8000-0000000051a3";
  await db.exec(
    `reset role;insert into auth.users values('${old}','{"display_name":"Old"}')`,
  );
  await as(old);
  await db.query("select public.arena_me()");
  await db.exec(
    `reset role;insert into public.arena_spire_progress(player_id,season,highest_floor,checkpoint,attempts)
     values('${old}',0,10,1,3),('${bo}',0,4,1,1)
     on conflict (player_id, season) do update set highest_floor=excluded.highest_floor, checkpoint=excluded.checkpoint`,
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20261116180000_spire_zone2.sql",
      "utf8",
    ),
  );
  expect(await progress(old)).toMatchObject({
    highestFloor: 10,
    checkpoint: 11,
    attempts: 3,
  });
  // Below floor 10 nothing changes.
  expect((await progress(bo)).checkpoint).toBe(1);
  // Its server-side read agrees: Old may start zone 2.
  const [m] = await server<(SpireMember & { id: string })[]>(
    `select public.arena_spire_start(array['${old}']::uuid[]) as v`,
  );
  expect(m.checkpoint).toBe(11);
  await db.exec(`reset role;delete from auth.users where id='${old}'`);
});

it("gives checkpoint 21 to players who conquered zone 2 before zone 3 existed", async () => {
  // As before zone 3's migration ran: floor 20 cleared, checkpoint 11.
  const old = "00000000-0000-4000-8000-0000000051a4";
  await db.exec(
    `reset role;insert into auth.users values('${old}','{"display_name":"Older"}')`,
  );
  await as(old);
  await db.query("select public.arena_me()");
  await db.exec(
    `reset role;insert into public.arena_spire_progress(player_id,season,highest_floor,checkpoint,attempts)
     values('${old}',0,20,11,7)
     on conflict (player_id, season) do update set highest_floor=excluded.highest_floor, checkpoint=excluded.checkpoint`,
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20261117090000_spire_zone3.sql",
      "utf8",
    ),
  );
  expect(await progress(old)).toMatchObject({
    highestFloor: 20,
    checkpoint: 21,
    attempts: 7,
  });
  // Its server-side read agrees: Older may start zone 3.
  const [m] = await server<(SpireMember & { id: string })[]>(
    `select public.arena_spire_start(array['${old}']::uuid[]) as v`,
  );
  expect(m.checkpoint).toBe(21);
  expect(
    spireStartFrom([{ ...m, clears: { grumblecrag: 1 } }], 3),
  ).toMatchObject({ ok: true, startFloor: 21, ceiling: 29 });
  // Running it again changes nothing, and keeps one row per reward.
  await db.exec(
    await readFile(
      "supabase/migrations/20261117090000_spire_zone3.sql",
      "utf8",
    ),
  );
  expect((await progress(old)).checkpoint).toBe(21);
  await db.exec("reset role");
  const rows = (
    await db.query<{ n: number }>(
      "select count(*)::int as n from public.arena_spire_rewards where season = 0 and floor between 21 and 30",
    )
  ).rows[0].n;
  expect(rows).toBe(11);
  const titles = (
    await db.query<{ n: number }>(
      "select count(*)::int as n from public.arena_titles where name = 'Lanternbane of the Spire'",
    )
  ).rows[0].n;
  expect(titles).toBe(1);
  await db.exec(`reset role;delete from auth.users where id='${old}'`);
});

it("gives checkpoint 31 to players who conquered zone 3 before zone 4 existed", async () => {
  // As before zone 4's migration ran: floor 30 cleared, checkpoint 21.
  const old = "00000000-0000-4000-8000-0000000051a5";
  await db.exec(
    `reset role;insert into auth.users values('${old}','{"display_name":"Oldest"}')`,
  );
  await as(old);
  await db.query("select public.arena_me()");
  await db.exec(
    `reset role;insert into public.arena_spire_progress(player_id,season,highest_floor,checkpoint,attempts)
     values('${old}',0,30,21,11)
     on conflict (player_id, season) do update set highest_floor=excluded.highest_floor, checkpoint=excluded.checkpoint`,
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20261117150000_spire_zone4.sql",
      "utf8",
    ),
  );
  expect(await progress(old)).toMatchObject({
    highestFloor: 30,
    checkpoint: 31,
    attempts: 11,
  });
  // Its server-side read agrees: Oldest may start zone 4.
  const [m] = await server<(SpireMember & { id: string })[]>(
    `select public.arena_spire_start(array['${old}']::uuid[]) as v`,
  );
  expect(m.checkpoint).toBe(31);
  expect(
    spireStartFrom([{ ...m, clears: { grumblecrag: 1 } }], 4),
  ).toMatchObject({ ok: true, startFloor: 31, ceiling: 39 });
  // Running it again changes nothing, and keeps one row per reward.
  await db.exec(
    await readFile(
      "supabase/migrations/20261117150000_spire_zone4.sql",
      "utf8",
    ),
  );
  expect((await progress(old)).checkpoint).toBe(31);
  await db.exec("reset role");
  const rows = (
    await db.query<{ n: number }>(
      "select count(*)::int as n from public.arena_spire_rewards where season = 0 and floor between 31 and 40",
    )
  ).rows[0].n;
  expect(rows).toBe(11);
  const titles = (
    await db.query<{ n: number }>(
      "select count(*)::int as n from public.arena_titles where name = 'Dreambreaker of the Spire'",
    )
  ).rows[0].n;
  expect(titles).toBe(1);
  await db.exec(`reset role;delete from auth.users where id='${old}'`);
});

it("rejects broken receipts", async () => {
  await expect(record({ ...floor(run(5), 1), floor: 0 })).rejects.toThrow(
    /Invalid Spire floor/,
  );
  await expect(record({ ...floor(run(5), 1), players: [] })).rejects.toThrow(
    /Invalid Spire party/,
  );
});

it("reads checkpoints and raid clears before a climb (lowest among the party)", async () => {
  // Bo has cleared Cragmuff once; Ana never has.
  await db.exec(
    `reset role;insert into public.arena_raid_runs(id,boss,peril,trait,gilded,weekly,week,party_size,seconds,downs,revives,receipt,result)
     values('${run(90)}','grumblecrag',3,'ancient',false,false,'2026-11-09',1,200,0,0,'{}','victory');
     insert into public.arena_raid_players(run_id,player_id,character) values('${run(90)}','${bo}','terradon');`,
  );
  const members = await server<(SpireMember & { id: string })[]>(
    `select public.arena_spire_start(array['${ana}','${bo}']::uuid[]) as v`,
  );
  expect(members.map((m) => [m.id, m.checkpoint, m.clears])).toEqual([
    [ana, 31, {}],
    [bo, 1, { grumblecrag: 1 }],
  ]);
  // Ana has no Cragmuff clear: the party can't climb yet.
  expect(spireStartFrom(members).ok).toBe(false);
  // Bo alone climbs from his own checkpoint.
  expect(spireStartFrom([members[1]])).toMatchObject({
    ok: true,
    startFloor: 1,
  });
  // Zone 2 needs floor 11 from Bo too, zone 3 floor 21 and zone 4 floor 31.
  expect(spireStartFrom([members[1]], 2)).toMatchObject({ ok: false });
  expect(spireStartFrom([members[1]], 3)).toMatchObject({ ok: false });
  expect(spireStartFrom([members[1]], 4)).toMatchObject({ ok: false });
  expect((await progress(bo)).clears).toEqual({ grumblecrag: 1 });
});

it("deletes a player's climb with their account", async () => {
  await db.exec(`reset role;delete from auth.users where id='${bo}'`);
  const left = (
    await db.query<{ n: number }>(
      `select (select count(*) from public.arena_spire_claims where player_id='${bo}')
        + (select count(*) from public.arena_spire_progress where player_id='${bo}')
        + (select count(*) from public.arena_spire_players where player_id='${bo}') as n`,
    )
  ).rows[0].n;
  expect(Number(left)).toBe(0);
});
