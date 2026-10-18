import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { beforeAll, afterAll, it, expect } from "vitest";
import { MISSION_BY_ID } from "../../packages/shared/src/shop";

/** Daily missions after migration 014: solo-friendly picks and new metrics. */
let db: PGlite;
const solo = "00000000-0000-4000-8000-000000000011";
const social = "00000000-0000-4000-8000-000000000012";
const as = async (pid: string) =>
  db.exec(`reset role;select set_config('request.jwt.claim.sub','${pid}',false);set role authenticated;`);
const today = async () => {
  await db.exec("reset role");
  return (await db.query<{ d: string }>("select public.arena_today()::text as d")).rows[0].d;
};
const missionsOn = async (pid: string, day: string) => {
  await db.exec("reset role");
  await db.query("select public.arena_ensure_missions($1::uuid, $2::date)", [pid, day]);
  return (
    await db.query<{ slot: number; mission_id: string; progress: number; done: boolean }>(
      "select slot, mission_id, progress, done from public.arena_mission_progress where player_id = $1 and day = $2 order by slot",
      [pid, day],
    )
  ).rows;
};
/** Put a specific mission in a slot (tests only). */
const give = async (pid: string, slot: number, id: string) => {
  const day = await today();
  await missionsOn(pid, day);
  await db.query("update public.arena_mission_progress set mission_id = $3, progress = 0, done = false where player_id = $1 and day = $2::date and slot = $4", [pid, day, id, slot]);
};
const progressOf = async (pid: string, slot: number) => (await missionsOn(pid, await today()))[slot];
let receipts = 0;
const report = async (kind: "match" | "raid", players: object[]) => {
  await db.exec("reset role;set role service_role");
  await db.query("select public.arena_record_activity($1::jsonb)", [
    JSON.stringify({ id: `t${++receipts}`, kind, day: await today(), players }),
  ]);
};
const fighter = (pid: string, extra: object = {}) => ({
  accountId: pid, character: "voltkit", won: false, vsPeople: false, botLevel: null, mode: "duel",
  knockedOut: false, skillUses: 0, ults: 0, activeSeconds: 90, ...extra,
});
const raider = (pid: string, peril = 1) =>
  fighter(pid, { mode: "raid", won: true, activeSeconds: 200, raid: { cleared: true, daily: false, peril, flawless: false, feat: false, revives: 0 } });

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;insert into auth.users values('${solo}','{"display_name":"Solo"}'),('${social}','{"display_name":"Social"}');`,
  );
  for (const file of (await readdir("supabase/migrations")).filter((f: string) => f.endsWith(".sql")).sort())
    await db.exec("reset role;" + (await readFile("supabase/migrations/" + file, "utf8")));
  for (const pid of [solo, social]) {
    await as(pid);
    await db.query("select public.arena_me()");
  }
  // The social player played a match against people yesterday.
  await db.exec(`reset role;insert into public.arena_coin_ledger(player_id, amount, reason, ref, day) values ('${social}', 15, 'pvp', 'old-match', public.arena_today() - 1)`);
}, 60000);
afterAll(async () => db.close());

it("never gives a solo player a mission that needs other people", async () => {
  const start = new Date(`${await today()}T12:00:00Z`);
  let socialSawOne = false;
  for (let i = 1; i <= 60; i++) {
    const day = new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    for (const m of (await missionsOn(solo, day)) as { mission_id: string }[]) expect(MISSION_BY_ID[m.mission_id].solo, `${day} ${m.mission_id}`).toBe(true);
    // A social player's history only counts the week before the day.
    await db.exec(`reset role;insert into public.arena_coin_ledger(player_id, amount, reason, ref, day) values ('${social}', 15, 'pvp', 'm${day}', '${day}'::date - 1)`);
    if (((await missionsOn(social, day)) as { mission_id: string }[]).some((m) => !MISSION_BY_ID[m.mission_id].solo)) socialSawOne = true;
  }
  expect(socialSawOne).toBe(true);
});

it("re-rolls a mission that needs people into one you can do alone", async () => {
  await give(social, 1, "pvp-wins-2");
  await as(social);
  const e = (await db.query<{ e: any }>("select public.arena_reroll_mission(1) as e")).rows[0].e;
  const next = e.missions.find((m: any) => m.slot === 1).id;
  expect(next).not.toBe("pvp-wins-2");
  expect(MISSION_BY_ID[next].solo).toBe(true);
});

it("counts wins, bot wins and time played from a bot match", async () => {
  await give(solo, 0, "win-1");
  await give(solo, 1, "bot-wins-3");
  await give(solo, 2, "minutes-30");
  await report("match", [fighter(solo, { won: true, botLevel: "easy", activeSeconds: 610 })]);
  expect((await progressOf(solo, 0)).done).toBe(true);
  expect((await progressOf(solo, 1)).progress).toBe(1);
  expect((await progressOf(solo, 2)).progress).toBe(10);
});

it("tells solo raid clears from party ones, and counts raids played", async () => {
  await give(solo, 0, "raid-play-1");
  await give(solo, 1, "raid-solo-1");
  await give(solo, 2, "raid-solo-p2");
  await give(social, 1, "raid-party");
  await give(social, 2, "raid-solo-p2");
  // A Peril 1 solo clear finishes the first two, not the Peril 2 one.
  await report("raid", [raider(solo, 1)]);
  expect((await progressOf(solo, 0)).done).toBe(true);
  expect((await progressOf(solo, 1)).done).toBe(true);
  expect((await progressOf(solo, 2)).progress).toBe(0);
  await report("raid", [raider(solo, 2)]);
  expect((await progressOf(solo, 2)).done).toBe(true);
  // Together, it's a party clear for both, and not a solo one.
  await report("raid", [raider(social, 2), raider(solo, 2)]);
  expect((await progressOf(social, 1)).done).toBe(true);
  expect((await progressOf(social, 2)).progress).toBe(0);
});

it("counts free-for-all wins only against people", async () => {
  await give(social, 0, "ffa-win");
  // Missions are per tier; any slot can hold one in tests.
  await report("match", [fighter(social, { won: true, mode: "ffa", vsPeople: false, botLevel: "hard" })]);
  expect((await progressOf(social, 0)).progress).toBe(0);
  await report("match", [fighter(social, { won: true, mode: "ffa", vsPeople: true }), fighter(solo, { mode: "ffa", vsPeople: true })]);
  expect((await progressOf(social, 0)).done).toBe(true);
});
