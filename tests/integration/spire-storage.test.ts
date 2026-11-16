import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  spireStartFrom,
  type SpireMember,
} from "../../packages/shared/src/spire";

// The Spire's storage (migration 20261116120000): each cleared floor is
// saved at once, first-clear coins and titles are paid once per player, and
// the server reads checkpoints and raid clears before a climb.
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
  // Safe to run again.
  await db.exec(
    await readFile("supabase/migrations/20261116120000_spire.sql", "utf8"),
  );
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

it("pays floor 10's title once, and keeps checkpoint 1 until zone 2 exists", async () => {
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
  // Zone 1 is conquered, but floor 11 doesn't exist yet: climbs start at 1.
  expect(p.checkpoint).toBe(1);
  // Once zone 2's floors exist, the same clear opens checkpoint 11.
  await db.exec(
    `reset role;insert into public.arena_spire_rewards(season,floor,kind,item,amount) values(0,11,'coins','coins',1)`,
  );
  const next = (
    await db.query<{ c: number }>(
      "select public.arena_spire_checkpoint(0, 10) as c",
    )
  ).rows[0].c;
  await db.exec(
    "reset role;delete from public.arena_spire_rewards where season=0 and floor=11",
  );
  expect(next).toBe(11);
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
    [ana, 1, {}],
    [bo, 1, { grumblecrag: 1 }],
  ]);
  // Ana has no Cragmuff clear: the party can't climb yet.
  expect(spireStartFrom(members).ok).toBe(false);
  // Bo alone climbs from his own checkpoint.
  expect(spireStartFrom([members[1]])).toMatchObject({
    ok: true,
    startFloor: 1,
  });
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
