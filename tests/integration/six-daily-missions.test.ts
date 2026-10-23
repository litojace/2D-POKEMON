import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import {
  DAILY_MISSION_COUNT,
  MISSION_BY_ID,
  type Economy,
} from "../../packages/shared/src/shop";

let db: PGlite;
const player = "00000000-0000-4000-8000-000000000111";
const previous = "00000000-0000-4000-8000-000000000112";
const admin = "00000000-0000-4000-8000-000000000113";
const migration = () =>
  readFile("supabase/migrations/026_six_daily_missions.sql", "utf8");
const login = (id = player) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`,
  );
const economy = async () =>
  (await db.query<{ e: Economy }>("select public.arena_economy() e")).rows[0].e;
const attempt = async <T>(run: () => Promise<T>) => {
  await db.exec("savepoint request");
  try {
    const value = await run();
    await db.exec("release savepoint request");
    return value;
  } catch (error) {
    await db.exec("rollback to savepoint request;release savepoint request");
    throw error;
  }
};
const change = (slot: number | null) =>
  attempt(
    async () =>
      (
        await db.query<{ e: Economy }>(
          "select public.arena_reroll_mission($1) e",
          [slot],
        )
      ).rows[0].e,
  );
const bump = async (metric: string, amount: number, character = "voltkit") => {
  await db.exec("reset role");
  await db.query(
    "select public.arena_mission_bump($1,public.arena_today(),$2,$3,$4)",
    [player, metric, amount, character],
  );
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
  );
  for (const file of (await readdir("supabase/migrations"))
    .filter((f) => /^\d{3}_.*\.sql$/.test(f) && Number(f.slice(0, 3)) < 26)
    .sort())
    await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
  for (const id of [player, previous, admin]) {
    await db.query("insert into auth.users values($1,$2)", [
      id,
      { display_name: "Daily tester" },
    ]);
    await login(id);
    await db.query("select public.arena_me()");
    await economy();
    await db.exec("reset role");
  }
  await login(previous);
  await db.query("select public.arena_reroll_mission(0)");
  await db.exec(
    `reset role;update public.arena_mission_progress set progress=1,time_remainder_ms=45000 where player_id='${previous}' and slot=1;update public.arena_mission_days set bonus=true where player_id='${previous}';insert into public.arena_admins values('${admin}')`,
  );
  await db.exec(await migration());
  const reapplied = await db.exec(await migration());
  expect(reapplied.at(-1)!.rows).toEqual([
    {
      six_daily_missions_enabled: true,
      five_free_changes_enabled: true,
      all_six_streak_goal_enabled: true,
    },
  ]);
}, 60000);
beforeEach(async () => {
  await db.exec("begin");
  await login();
});
afterEach(async () => db.exec("rollback;reset role"));
afterAll(async () => db.close());

it("adds distinct missions without replacing existing progress, time, changes or earned streaks", async () => {
  await login(previous);
  const e = await economy();
  expect(e.missions).toHaveLength(DAILY_MISSION_COUNT);
  expect(e.missions[1].progress).toBe(1);
  expect(e.rerollsUsed).toBe(1);
  expect(e.rerollLimit).toBe(5);
  expect(e.streak).toBe(1);
  await db.exec("reset role");
  expect(
    (
      await db.query<{ time_remainder_ms: number }>(
        "select time_remainder_ms from public.arena_mission_progress where player_id=$1 and slot=1",
        [previous],
      )
    ).rows[0].time_remainder_ms,
  ).toBe(45000);
  await login(previous);
  const before = await economy();
  await change(5);
  await db.exec("reset role");
  await db.exec((await migration()).replace(/^begin;|^commit;/gm, ""));
  await login(previous);
  const after = await economy();
  expect(after.rerollsUsed).toBe(2);
  expect(after.balance).toBe(before.balance);
  expect(after.missions.slice(0, 5)).toEqual(before.missions.slice(0, 5));
});

it("gives two missions per tier, six different IDs and solo options across many mission days", async () => {
  await db.exec("reset role");
  for (let day = 0; day < 60; day++) {
    await db.query(
      "select public.arena_ensure_missions($1,public.arena_today()+$2::int)",
      [player, day],
    );
    const rows = (
      await db.query<{ mission_id: string }>(
        "select mission_id from public.arena_mission_progress where player_id=$1 and day=public.arena_today()+$2::int order by slot",
        [player, day],
      )
    ).rows;
    expect(rows).toHaveLength(6);
    expect(new Set(rows.map((r) => r.mission_id)).size).toBe(6);
    expect(rows.map((r) => MISSION_BY_ID[r.mission_id].tier)).toEqual([
      "easy",
      "medium",
      "hard",
      "easy",
      "medium",
      "hard",
    ]);
    expect(rows.every((r) => MISSION_BY_ID[r.mission_id].solo)).toBe(true);
  }
});

it("keeps a solo-friendly mission per tier for social players and swaps social missions to solo", async () => {
  await db.exec("reset role");
  await db.query(
    "update public.arena_mission_days set social=true where player_id=$1",
    [player],
  );
  await db.query(
    "update public.arena_mission_progress set mission_id='pvp-wins-2' where player_id=$1 and slot=1",
    [player],
  );
  await login();
  const e = await economy();
  expect(e.missions.slice(3).every((m) => MISSION_BY_ID[m.id].solo)).toBe(true);
  const next = await change(1);
  expect(MISSION_BY_ID[next.missions[1].id].solo).toBe(true);
  expect(new Set(next.missions.map((m) => m.id)).size).toBe(6);
});

it("allows five changes across all six slots, prevents duplicates, and rejects a sixth atomically", async () => {
  const before = await economy();
  expect(before.rerollLimit).toBe(5);
  for (const [i, slot] of [5, 4, 3, 2, 1].entries()) {
    const prior = await economy();
    const e = await change(slot);
    expect(e.rerollsUsed).toBe(i + 1);
    expect(e.missions[slot].id).not.toBe(prior.missions[slot].id);
    expect(e.missions.filter((m) => m.slot !== slot)).toEqual(
      prior.missions.filter((m) => m.slot !== slot),
    );
    expect(new Set(e.missions.map((m) => m.id)).size).toBe(6);
    expect(e.balance).toBe(before.balance);
  }
  const exhausted = await economy();
  await expect(change(0)).rejects.toThrow("all 5 free mission changes");
  expect(await economy()).toEqual(exhausted);
});

it("protects completed missions, validates slots and resets only changed progress/time", async () => {
  await economy();
  await db.exec("reset role");
  await db.query(
    "update public.arena_mission_progress set mission_id='minutes-30',progress=1,time_remainder_ms=45000 where player_id=$1 and slot=5",
    [player],
  );
  await db.query(
    "update public.arena_mission_progress set done=true where player_id=$1 and slot=0",
    [player],
  );
  await login();
  const before = await economy();
  await expect(change(0)).rejects.toThrow("already done");
  for (const slot of [-1, 6, 100, null])
    await expect(change(slot)).rejects.toThrow("Unknown mission");
  expect(await economy()).toEqual(before);
  const after = await change(5);
  expect(after.missions[5].progress).toBe(0);
  expect(after.missions.slice(0, 5)).toEqual(before.missions.slice(0, 5));
  await db.exec("reset role");
  expect(
    (
      await db.query<{ time_remainder_ms: number }>(
        "select time_remainder_ms from public.arena_mission_progress where player_id=$1 and slot=5",
        [player],
      )
    ).rows[0].time_remainder_ms,
  ).toBe(0);
});

it("requires all six for the daily bonus and seventh-day streak reward, paying each once", async () => {
  await economy();
  await db.exec("reset role");
  for (const [slot, id] of [
    "play-2",
    "ults-8",
    "minutes-30",
    "skills-30",
    "bot-wins-3",
    "hard-bots-3",
  ].entries())
    await db.query(
      "update public.arena_mission_progress set mission_id=$2 where player_id=$1 and slot=$3",
      [player, id, slot],
    );
  await login();
  const e = await economy();
  await db.exec("reset role");
  await db.query(
    "insert into public.arena_mission_days(player_id,day,bonus) select $1,public.arena_today()-n,true from generate_series(1,6) n",
    [player],
  );
  for (const [i, m] of e.missions.entries()) {
    const def = MISSION_BY_ID[m.id];
    await bump(def.metric, def.target, def.champions?.[0]);
    await login();
    const updated = await economy();
    const complete = updated.missions.filter((m) => m.done).length;
    expect(updated.streak).toBe(complete === 6 ? 7 : 6);
    await db.exec("reset role");
    const ledger = (
      await db.query<{ reason: string }>(
        "select reason from public.arena_coin_ledger where player_id=$1 and day=public.arena_today() and reason in ('missions-bonus','streak')",
        [player],
      )
    ).rows;
    expect(ledger.map((r) => r.reason).sort()).toEqual(
      complete === 6 ? ["missions-bonus", "streak"] : [],
    );
    if (i === 5) expect(complete).toBe(6);
  }
  for (const m of e.missions) {
    const def = MISSION_BY_ID[m.id];
    await bump(def.metric, def.target, def.champions?.[0]);
  }
  const ledger = (
    await db.query<{ reason: string; amount: number }>(
      "select reason,amount from public.arena_coin_ledger where player_id=$1 and day=public.arena_today()",
      [player],
    )
  ).rows;
  expect(ledger.filter((r) => r.reason === "mission")).toHaveLength(6);
  expect(ledger.filter((r) => r.reason === "missions-bonus")).toEqual([
    { reason: "missions-bonus", amount: 50 },
  ]);
  expect(ledger.filter((r) => r.reason === "streak")).toEqual([
    { reason: "streak", amount: 300 },
  ]);
});

it("credits new slots from fast bot results and accumulates fractional play time without duplicate receipts", async () => {
  await economy();
  await db.exec("reset role");
  for (const [slot, id] of [
    [3, "play-2"],
    [4, "bot-wins-3"],
    [5, "minutes-30"],
  ] as const)
    await db.query(
      "update public.arena_mission_progress set mission_id=$2 where player_id=$1 and slot=$3",
      [player, id, slot],
    );
  const day = (
    await db.query<{ d: string }>("select public.arena_today()::text d")
  ).rows[0].d;
  await db.exec("set role service_role");
  for (let i = 0; i < 3; i++) {
    const p = {
      id: `six-missions-${i}`,
      kind: "match",
      day,
      players: [
        {
          accountId: player,
          character: "voltkit",
          won: true,
          vsPeople: false,
          botLevel: "hard",
          mode: "duel",
          knockedOut: false,
          skillUses: 1,
          ults: 0,
          activeSeconds: 12.5,
          participated: true,
          abandoned: false,
        },
      ],
    };
    for (let repeat = 0; repeat < 2; repeat++)
      await db.query("select public.arena_record_activity($1::jsonb)", [
        JSON.stringify(p),
      ]);
  }
  await login();
  const e = await economy();
  expect(e.missions.slice(3).map((m) => m.progress)).toEqual([2, 3, 0]);
  await db.exec("reset role");
  expect(
    (
      await db.query<{ time_remainder_ms: number }>(
        "select time_remainder_ms from public.arena_mission_progress where player_id=$1 and slot=5",
        [player],
      )
    ).rows[0].time_remainder_ms,
  ).toBe(37500);
});

it("starts a fresh six-slot day with five changes, preserving yesterday", async () => {
  const before = await economy();
  for (let i = 0; i < 5; i++) await change(0);
  await db.exec("reset role");
  const day = (
    await db.query<{ d: string }>("select (public.arena_today()+1)::text d")
  ).rows[0].d;
  await db.exec(
    `create or replace function public.arena_today() returns date language sql stable as $$select '${day}'::date$$`,
  );
  await login();
  const next = await economy();
  expect(next.rerollsUsed).toBe(0);
  expect(next.missions).toHaveLength(6);
  expect(next.missions.every((m) => m.day !== before.missions[0].day)).toBe(
    true,
  );
});

it("retains admin testing, denies anonymous calls and prevents direct counter edits", async () => {
  await login(admin);
  const e = await change(5);
  expect(e.unlimitedCoins).toBe(true);
  expect(e.mythicTesting).toBe(true);
  expect(e.journey).toBeDefined();
  await login();
  await expect(
    attempt(() =>
      db.query("update public.arena_mission_days set rerolls_used=0"),
    ),
  ).rejects.toThrow("permission denied");
  await db.exec("reset role;set role anon");
  await expect(change(5)).rejects.toThrow("permission denied");
});
