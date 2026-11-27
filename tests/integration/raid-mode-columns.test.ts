import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";

// Migration 20261127200000 drops the retired raid modes' columns from
// arena_raid_runs (`weekly`, `week`, `daily`) and keeps `day`. The Raid
// Hub's answer must not change, old and new servers' receipts must both
// record, and 028's refusal of a daily receipt must stay.
let db: PGlite;
const MIGRATION = "20261127200000_drop_raid_mode_columns.sql";
const player = "00000000-0000-4000-8000-0000000007a1";
const run = (n: number) =>
  `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
/** A receipt as today's server sends it (no retired keys). */
const receipt = (n: number, extra: object = {}) => ({
  id: run(n),
  boss: "grumblecrag",
  peril: 3,
  trait: "ancient",
  gilded: false,
  day: "2026-11-27",
  feat: false,
  seed: 1,
  partySize: 1,
  seconds: 300 - n,
  downs: 0,
  revives: 0,
  result: "victory",
  players: [{ accountId: player, character: "voltkit", pillars: 2 }],
  ...extra,
});
/** As servers sent it before this migration. */
const oldServer = { weekly: false, week: "2026-11-23", daily: false };
const record = async (r: object) => {
  await db.exec("reset role;set role service_role");
  await db.query("select public.arena_record_raid($1::jsonb)", [
    JSON.stringify(r),
  ]);
  await db.exec("reset role");
};
const progress = async () => {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${player}',false);set role authenticated;`,
  );
  const p = (
    await db.query<{ p: Record<string, unknown> }>(
      "select public.arena_raid_progress() p",
    )
  ).rows[0].p;
  await db.exec("reset role");
  return p;
};
const columns = async () =>
  (
    await db.query<{ c: string }>(
      "select column_name c from information_schema.columns where table_schema='public' and table_name='arena_raid_runs' order by 1",
    )
  ).rows.map((r) => r.c);
const migrate = async () =>
  db.exec(await readFile(`supabase/migrations/${MIGRATION}`, "utf8"));

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;insert into auth.users values('${player}','{"display_name":"Raider"}');`,
  );
  const files = (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files.filter((f) => f < MIGRATION))
    await db.exec(await readFile(`supabase/migrations/${f}`, "utf8"));
  await db.exec(
    `select set_config('request.jwt.claim.sub','${player}',false);set role authenticated;select public.arena_me();reset role`,
  );
}, 60000);
afterAll(async () => db.close());

it("drops weekly, week and daily, keeps the Raid Hub's answer and the legacy solo title", async () => {
  // A solo Peril 3 clear from before one-difficulty raids, with a down:
  // Lone Mountain still counts it through `day` (migration 030).
  await db.exec(
    `insert into public.arena_raid_runs(id,boss,peril,trait,gilded,weekly,week,party_size,seconds,downs,revives,receipt,created_at,result,daily,day)
     values('${run(1)}','grumblecrag',3,'ancient',false,false,'2026-10-19',1,400,1,0,'{"weekly":false,"week":"2026-10-19","daily":false,"day":"2026-10-20"}','2026-10-20 18:00:00+00','victory',false,'2026-10-20');
     insert into public.arena_raid_players(run_id,player_id,character) values('${run(1)}','${player}','voltkit');`,
  );
  await record({ ...receipt(2), ...oldServer });
  const before = await progress();
  expect(before.earned).toContain("lone-mountain");
  expect(before).not.toHaveProperty("today");
  expect(before).not.toHaveProperty("dailyClears");
  expect(await columns()).toEqual(
    expect.arrayContaining(["weekly", "week", "daily", "day"]),
  );

  await migrate();
  await migrate();

  const cols = await columns();
  expect(cols).toContain("day");
  for (const gone of ["weekly", "week", "daily"])
    expect(cols).not.toContain(gone);
  const indexes = (
    await db.query<{ i: string }>(
      "select indexname i from pg_indexes where tablename='arena_raid_runs'",
    )
  ).rows.map((r) => r.i);
  expect(indexes).not.toContain("arena_raid_weekly");
  expect(indexes).not.toContain("arena_raid_daily");
  expect(await progress()).toEqual(before);

  // The values stay in each run's receipt, and `day` on the run.
  const kept = (
    await db.query<{ receipt: Record<string, unknown>; day: string }>(
      "select receipt, day::text from public.arena_raid_runs where id=$1",
      [run(2)],
    )
  ).rows[0];
  expect(kept.receipt).toMatchObject(oldServer);
  expect(kept.day).toBe("2026-11-27");
});

it("records receipts from new and old servers, and still refuses a daily one", async () => {
  await record(receipt(3));
  // An old server mid-deploy still sends the retired keys: ignored.
  await record({ ...receipt(4), ...oldServer });
  const stored = (
    await db.query<{ id: string; day: string }>(
      "select id::text, day::text from public.arena_raid_runs where id in ($1,$2) order by id",
      [run(3), run(4)],
    )
  ).rows;
  expect(stored).toEqual([
    { id: run(3), day: "2026-11-27" },
    { id: run(4), day: "2026-11-27" },
  ]);
  const p = (await progress()) as {
    bosses: Record<string, { clears: number; runs: number }>;
    stats: Record<string, { pillars: number }>;
  };
  expect(p.bosses.grumblecrag).toMatchObject({ clears: 4, runs: 4 });
  expect(p.stats.grumblecrag.pillars).toBe(6);
  // The same run twice is stored once.
  await record(receipt(3));
  expect((await progress()) as unknown).toEqual(p);

  await expect(record({ ...receipt(5), daily: true })).rejects.toThrow(
    "Daily raids have been retired",
  );
  await db.exec("reset role");
  expect(
    (
      await db.query<{ n: number }>(
        "select count(*)::int n from public.arena_raid_runs where id=$1",
        [run(5)],
      )
    ).rows[0].n,
  ).toBe(0);
  // The inner functions stay closed to every role but their wrappers.
  for (const name of [
    "arena_record_raid_before_mode_retirement(jsonb)",
    "arena_raid_progress_before_mode_retirement()",
  ])
    for (const role of ["service_role", "authenticated", "anon"])
      expect(
        (
          await db.query<{ ok: boolean }>(
            "select has_function_privilege($1,$2,'execute') ok",
            [role, "public." + name],
          )
        ).rows[0].ok,
      ).toBe(false);
});
