import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from "vitest";

let db: PGlite;
const player = "00000000-0000-4000-8000-000000000091";
const earlier = "00000000-0000-4000-8000-000000000092";
const migration = () =>
  readFile("supabase/migrations/024_fast_bot_missions.sql", "utf8");
let serial = 0;
const give = async (ids: string[], pid = player) => {
  await db.exec("reset role");
  await db.query(
    "select public.arena_ensure_missions($1, public.arena_today())",
    [pid],
  );
  for (const [slot, id] of ids.entries())
    await db.query(
      "update public.arena_mission_progress set mission_id=$3, progress=0, done=false where player_id=$1 and day=public.arena_today() and slot=$2",
      [pid, slot, id],
    );
};
const progress = async (pid = player) => {
  await db.exec("reset role");
  return (
    await db.query<{ progress: number; done: boolean }>(
      "select progress,done from public.arena_mission_progress where player_id=$1 and day=public.arena_today() order by slot",
      [pid],
    )
  ).rows;
};
const receipt = async (fields: object = {}, pid = player) => {
  await db.exec("reset role");
  const d = (
    await db.query<{ d: string }>("select public.arena_today()::text d")
  ).rows[0].d;
  return {
    id: `fast-bot-${++serial}`,
    kind: "match",
    day: d,
    players: [
      {
        accountId: pid,
        character: "voltkit",
        won: true,
        vsPeople: false,
        botLevel: "hard",
        mode: "duel",
        knockedOut: false,
        skillUses: 1,
        ults: 0,
        activeSeconds: 5,
        participated: true,
        abandoned: false,
        ...fields,
      },
    ],
  };
};
const record = async (p: object) => {
  await db.exec("reset role;set role service_role");
  await db.query("select public.arena_record_activity($1::jsonb)", [
    JSON.stringify(p),
  ]);
};
const rows = async (table: string, pid = player) => {
  await db.exec("reset role");
  return (
    await db.query<any>(`select * from public.${table} where player_id=$1`, [
      pid,
    ])
  ).rows;
};
let oldReceipt: Awaited<ReturnType<typeof receipt>>;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
  );
  for (const file of (await readdir("supabase/migrations"))
    .filter((f) => /^\d{3}_.*\.sql$/.test(f) && Number(f.slice(0, 3)) < 24)
    .sort())
    await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
  for (const id of [player, earlier]) {
    await db.query("insert into auth.users values($1,$2)", [
      id,
      { display_name: "Fast bot tester" },
    ]);
    await db.exec(
      `select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`,
    );
    await db.query("select public.arena_me()");
    await db.exec("reset role");
  }
  await give(["play-2", "bot-wins-3", "hard-bots-3"], earlier);
  oldReceipt = await receipt({}, earlier);
  await record(oldReceipt);
  expect((await progress(earlier)).map((p) => p.progress)).toEqual([0, 0, 0]);
  await db.exec(await migration());
  await db.exec(await migration());
}, 60000);
beforeEach(async () => {
  await db.exec("begin");
  await give(["play-2", "bot-wins-3", "hard-bots-3"]);
});
afterEach(async () => db.exec("rollback;reset role"));
afterAll(async () => db.close());

it.each(["easy", "normal", "hard"])(
  "counts completed %s bot wins at zero, fractional and sub-20-second durations",
  async (botLevel) => {
    for (const [i, activeSeconds] of [0, 0.5, 19.99].entries()) {
      await record(await receipt({ botLevel, activeSeconds }));
      const p = await progress();
      expect(p[0].progress).toBe(Math.min(2, i + 1));
      expect(p[1].progress).toBe(i + 1);
      expect(p[2].progress).toBe(botLevel === "hard" ? i + 1 : 0);
    }
    expect((await progress())[1].done).toBe(true);
    expect(
      (await rows("arena_coin_ledger")).filter(
        (r) => r.reason === "mission" && r.ref.endsWith(":1"),
      ),
    ).toHaveLength(1);
    expect(
      (await rows("arena_xp_ledger")).filter((r) => r.source === "match"),
    ).toHaveLength(0);
    expect(await rows("arena_weekly_goals")).toHaveLength(0);
    expect(await rows("arena_champion_wins")).toHaveLength(0);
  },
);

it("counts fast fighter-specific and general wins, but not the wrong fighter", async () => {
  await give(["win-1", "electric-aura", "hard-bots-3"]);
  await record(await receipt({ character: "cindrake", botLevel: "easy" }));
  expect((await progress()).map((p) => p.progress)).toEqual([1, 0, 0]);
  await record(await receipt({ character: "auralynx", botLevel: "normal" }));
  expect((await progress()).map((p) => p.progress)).toEqual([1, 1, 0]);
});

it("counts a finished bot loss for completion missions but never as a win", async () => {
  await record(await receipt({ won: false }));
  expect((await progress()).map((p) => p.progress)).toEqual([1, 0, 0]);
});

it("keeps the PvP threshold, payouts and existing match XP intact", async () => {
  await give(["win-1", "pvp-wins-2", "pvp-wins-5"]);
  await record(
    await receipt({ vsPeople: true, botLevel: null, activeSeconds: 19.99 }),
  );
  expect((await progress()).map((p) => p.progress)).toEqual([0, 0, 0]);
  expect(
    (await rows("arena_coin_ledger")).filter((r) => r.reason === "pvp"),
  ).toHaveLength(0);
  await record(
    await receipt({ vsPeople: true, botLevel: null, activeSeconds: 20 }),
  );
  expect((await progress()).map((p) => p.progress)).toEqual([1, 1, 1]);
  expect(
    (await rows("arena_coin_ledger")).find((r) => r.reason === "pvp").amount,
  ).toBe(15);
  expect(
    (await rows("arena_xp_ledger")).find((r) => r.source === "match").amount,
  ).toBe(75);
});

it("ignores abandoned, idle, unrecognised and invalid-duration bot results", async () => {
  for (const fields of [
    { abandoned: true },
    { participated: false },
    { botLevel: null },
    { botLevel: "fake" },
    { activeSeconds: -1 },
  ])
    await record(await receipt(fields));
  expect((await progress()).map((p) => p.progress)).toEqual([0, 0, 0]);
});

it("does not double-count receipts or pay a completed mission twice, including after reapplying the migration", async () => {
  const p = await receipt();
  await record(p);
  await record(p);
  expect((await progress())[1].progress).toBe(1);
  await db.exec("reset role");
  await db.exec((await migration()).replace(/^begin;|^commit;/gm, ""));
  await record(p);
  for (let i = 0; i < 4; i++) await record(await receipt());
  expect((await progress()).map((p) => p.progress)).toEqual([2, 3, 3]);
  const ledger = await rows("arena_coin_ledger");
  expect(ledger.filter((r) => r.reason === "mission")).toHaveLength(3);
  expect(ledger.filter((r) => r.reason === "missions-bonus")).toHaveLength(1);
  expect(
    (await rows("arena_xp_ledger")).filter((r) => r.source === "mission"),
  ).toHaveLength(3);
});

it("preserves previous progress and receipts without retroactively granting rejected wins", async () => {
  await record(oldReceipt);
  expect((await progress(earlier)).map((p) => p.progress)).toEqual([0, 0, 0]);
  await record(await receipt({}, earlier));
  expect((await progress(earlier)).map((p) => p.progress)).toEqual([1, 1, 1]);
});

it("keeps the inner recorder private and the trusted wrapper service-only", async () => {
  await db.exec("reset role");
  const result = await db.query<{
    role: string;
    allowed: boolean;
    inner_allowed: boolean;
  }>(
    `select r as role, has_function_privilege(r,'public.arena_record_activity(jsonb)','execute') as allowed,has_function_privilege(r,'public.arena_record_activity_before_journey(jsonb)','execute') as inner_allowed from unnest(array['anon','authenticated','service_role']) r`,
  );
  expect(result.rows).toEqual([
    { role: "anon", allowed: false, inner_allowed: false },
    { role: "authenticated", allowed: false, inner_allowed: false },
    { role: "service_role", allowed: true, inner_allowed: false },
  ]);
});
