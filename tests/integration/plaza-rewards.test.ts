import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  ORB_SHOWER,
  PLAZA,
  PLAZA_QUESTS,
} from "../../packages/shared/src/plaza";

// Migration 038: Plaza today quests, Orb Shower leaves, TOP DASH and Volt Boba.
let db: PGlite;
const runner = "00000000-0000-4000-8000-000000000381",
  rival = "00000000-0000-4000-8000-000000000382",
  banned = "00000000-0000-4000-8000-000000000383";
const login = (id: string) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`,
  );
/** What the game server does: report an event with the service role. */
const record = async (p: Record<string, unknown>) => {
  await db.exec("reset role;set role service_role");
  return (
    await db.query<{ v: any }>("select public.arena_plaza_record($1) v", [
      JSON.stringify(p),
    ])
  ).rows[0].v;
};
const progress = async (id: string) => {
  await login(id);
  return (await db.query<{ v: any }>("select public.arena_plaza() v")).rows[0]
    .v;
};
const ledger = async (id: string, reason: string) => {
  await db.exec("reset role");
  return (
    await db.query<{ n: number; s: number }>(
      "select count(*)::int n, coalesce(sum(amount),0)::int s from public.arena_leaf_ledger where player_id=$1 and reason=$2",
      [id, reason],
    )
  ).rows[0];
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
  for (const [id, name] of [
    [runner, "Runner"],
    [rival, "Rival"],
    [banned, "Banned"],
  ]) {
    await db.exec(
      `reset role;insert into auth.users values('${id}','{"display_name":"${name}"}')`,
    );
    await login(id);
    await db.query("select public.arena_me()");
  }
  await db.exec(
    `reset role;update public.arena_profiles set suspended=true where id='${banned}'`,
  );
}, 60000);
afterAll(async () => db.close());

it("matches the shared quest list", async () => {
  await db.exec("reset role");
  const rows = (
    await db.query<{ id: string; needed: number; leaves: number }>(
      "select * from public.arena_plaza_quests()",
    )
  ).rows;
  expect(rows).toEqual(
    PLAZA_QUESTS.map((q) => ({ id: q.id, needed: q.max, leaves: q.leaves })),
  );
});

it("pays 2 leaves an orb, at most 10 a shower and 50 a day, and the orbs quest once", async () => {
  const shower = (k: number) => String(29_000_000 + k * 15);
  for (let i = 0; i < 12; i++)
    await record({ player: runner, kind: "orb", ref: `${shower(0)}-${i}` });
  expect(await ledger(runner, "plaza-orb")).toEqual({
    n: ORB_SHOWER.perShower,
    s: ORB_SHOWER.perShower * ORB_SHOWER.leaves,
  });
  // The same orb never pays twice.
  await record({ player: runner, kind: "orb", ref: `${shower(1)}-1` });
  await record({ player: runner, kind: "orb", ref: `${shower(1)}-1` });
  expect((await ledger(runner, "plaza-orb")).n).toBe(11);
  for (let k = 2; k < 8; k++)
    for (let i = 0; i < 10; i++)
      await record({ player: runner, kind: "orb", ref: `${shower(k)}-${i}` });
  expect((await ledger(runner, "plaza-orb")).n).toBe(ORB_SHOWER.perDay);
  const p = await progress(runner);
  expect(p.orbsToday).toBe(50);
  expect(p.quests.orbs).toEqual({ n: 10, done: true });
  expect(await ledger(runner, "plaza-quest")).toEqual({ n: 1, s: 25 });
  await expect(
    record({ player: runner, kind: "orb", ref: "bogus" }),
  ).rejects.toThrow(/Bad orb/);
});

it("pays each quest once a day and keeps the best lap of the week", async () => {
  await record({ player: runner, kind: "goal" });
  await record({ player: runner, kind: "goal" });
  await record({ player: runner, kind: "photo" });
  await record({ player: runner, kind: "cheers", n: 9 });
  let p = await record({ player: runner, kind: "cheers", n: 3 });
  expect(p.quests.cheers).toEqual({ n: 9, done: false });
  p = await record({ player: runner, kind: "cheers", n: 40 });
  expect(p.quests.cheers).toEqual({ n: 15, done: true });
  // A slow lap sets a time but not the quest; a fast one does both.
  p = await record({ player: runner, kind: "lap", ms: 31_000 });
  expect(p.bestLapMs).toBe(31_000);
  expect(p.quests.lap.done).toBe(false);
  p = await record({ player: runner, kind: "lap", ms: 6_420 });
  p = await record({ player: runner, kind: "lap", ms: 9_000 });
  expect(p.bestLapMs).toBe(6_420);
  expect(p.quests.lap.done).toBe(true);
  expect(await ledger(runner, "plaza-quest")).toEqual({
    n: 5,
    s: PLAZA_QUESTS.reduce((s, q) => s + q.leaves, 0),
  });
  await record({ player: rival, kind: "lap", ms: 5_900 });
  expect((await progress(runner)).board).toEqual([
    { name: "Rival", ms: 5_900, me: false },
    { name: "Runner", ms: 6_420, me: true },
  ]);
  await expect(record({ player: runner, kind: "lap", ms: 10 })).rejects.toThrow(
    /Bad lap/,
  );
  await expect(record({ player: runner, kind: "fly" })).rejects.toThrow(
    /Unknown/,
  );
  // Suspended players get nothing.
  expect(await record({ player: banned, kind: "goal" })).toBeNull();
});

it("only the game server can record Plaza events", async () => {
  await login(runner);
  await expect(
    db.query("select public.arena_plaza_record($1)", [
      JSON.stringify({ player: runner, kind: "goal" }),
    ]),
  ).rejects.toThrow(/permission denied/);
  await db.exec("reset role;set role anon");
  await expect(db.query("select public.arena_plaza()")).rejects.toThrow(
    /permission denied/,
  );
});

it("sells Volt Boba for 10 leaves, once per request id", async () => {
  await login(rival);
  const buy = async (ref: string) =>
    (await db.query<{ v: any }>("select public.arena_plaza_boba($1) v", [ref]))
      .rows[0].v;
  const id = (n: number) =>
    `6f1c2b9e-3a4d-4c5e-8f60-7182930000${n}0`.slice(0, 36);
  // The rival has 40 leaves from the lap quest above.
  expect(await buy(id(1))).toEqual({
    ok: true,
    leaves: 40 - PLAZA.boba.leaves,
  });
  expect(await buy(id(1))).toEqual({ ok: false, leaves: 30 });
  for (const n of [2, 3, 4]) expect((await buy(id(n))).ok).toBe(true);
  expect(await buy(id(5))).toEqual({ ok: false, leaves: 0 });
  await expect(buy("not-an-id")).rejects.toThrow(/Bad request/);
});
