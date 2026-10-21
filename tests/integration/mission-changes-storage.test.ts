import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import type { Economy } from "../../packages/shared/src/shop";

let db: PGlite;
const player = "00000000-0000-4000-8000-000000000081";
const previous = "00000000-0000-4000-8000-000000000082";
const admin = "00000000-0000-4000-8000-000000000083";
const migration = () =>
  readFile("supabase/migrations/023_three_mission_changes.sql", "utf8");
const login = (id = player) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
const economy = async () =>
  (await db.query<{ e: Economy }>("select public.arena_economy() as e")).rows[0]
    .e;
// Keep expected database errors from aborting the surrounding test fixture.
const attempt = async <T>(run: () => Promise<T>) => {
  await db.exec("savepoint request");
  try {
    const result = await run();
    await db.exec("release savepoint request");
    return result;
  } catch (error) {
    await db.exec("rollback to savepoint request;release savepoint request");
    throw error;
  }
};
const change = async (slot: number | null) =>
  attempt(
    async () =>
      (
        await db.query<{ e: Economy }>(
          "select public.arena_reroll_mission($1) as e",
          [slot],
        )
      ).rows[0].e,
  );

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
  );
  for (const file of (await readdir("supabase/migrations"))
    .filter((f) => /^\d{3}_.*\.sql$/.test(f) && Number(f.slice(0, 3)) < 23)
    .sort())
    await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
  for (const id of [player, previous, admin]) {
    await db.query("insert into auth.users values ($1, $2)", [
      id,
      { display_name: "Mission tester" },
    ]);
    await login(id);
    await db.query("select public.arena_me()");
    await economy();
    await db.exec("reset role");
  }
  // Simulate a change used before the new migration is installed.
  await login(previous);
  await db.query("select public.arena_reroll_mission(0)");
  await db.exec(
    `reset role;insert into public.arena_admins values('${admin}');`,
  );
  await db.exec(await migration());
  await db.exec(await migration());
}, 60000);
beforeEach(async () => {
  await db.exec("begin");
  await login();
});
afterEach(async () => db.exec("rollback;reset role"));
afterAll(async () => db.close());

it("allows three free changes across slots and rejects a fourth without changing rewards", async () => {
  const before = await economy();
  expect(before.rerollsUsed).toBe(0);
  expect(before.rerollLimit).toBe(3);
  for (const slot of [0, 1, 2]) {
    const after = await change(slot);
    expect(after.rerollsUsed).toBe(slot + 1);
    expect(after.rerollLimit).toBe(3);
    expect(after.rerolled).toBe(true);
    expect(after.missions[slot].id).not.toBe(before.missions[slot].id);
    expect(after.balance).toBe(before.balance);
    expect(after.owned).toEqual(before.owned);
    expect(after.journey).toEqual(before.journey);
  }
  const exhausted = await economy();
  await expect(change(1)).rejects.toThrow("all 3 free mission changes");
  expect(await economy()).toEqual(exhausted);
});

it("can spend all three on one slot with different picks, preserving the other slots", async () => {
  await db.exec("reset role");
  await db.query(
    "update public.arena_mission_progress set progress = 1 where player_id = $1 and day = public.arena_today() and slot = 2",
    [player],
  );
  await login();
  const before = await economy();
  const seen = new Set([before.missions[2].id]);
  for (let i = 0; i < 3; i++) {
    const after = await change(2);
    expect(seen.has(after.missions[2].id)).toBe(false);
    seen.add(after.missions[2].id);
    expect(after.missions[2].progress).toBe(0);
    expect(after.missions.slice(0, 2)).toEqual(before.missions.slice(0, 2));
  }
});

it("protects completed missions and does not spend changes on invalid requests", async () => {
  await db.exec("reset role");
  await db.query(
    "update public.arena_mission_progress set done = true where player_id = $1 and day = public.arena_today() and slot = 0",
    [player],
  );
  await login();
  const before = await economy();
  await expect(change(0)).rejects.toThrow("already done");
  for (const slot of [-1, 3, 2147483647, null])
    await expect(change(slot)).rejects.toThrow("Unknown mission");
  expect(await economy()).toEqual(before);
});

it("keeps the old change spent and does not reset the allowance when reapplied", async () => {
  await login(previous);
  expect((await economy()).rerollsUsed).toBe(1);
  await change(1);
  await db.exec("reset role");
  await db.exec((await migration()).replace(/^begin;|^commit;/gm, ""));
  await login(previous);
  expect((await economy()).rerollsUsed).toBe(2);
  await change(2);
  await expect(change(1)).rejects.toThrow("all 3 free mission changes");
  await login();
  expect((await economy()).rerollsUsed).toBe(0);
});

it("resets the allowance on the next Pacific mission day", async () => {
  for (let i = 0; i < 3; i++) await change(0);
  await db.exec("reset role");
  const day = (
    await db.query<{ d: string }>(
      "select (public.arena_today() + 1)::text as d",
    )
  ).rows[0].d;
  await db.exec(
    `create or replace function public.arena_today() returns date language sql stable as $$ select '${day}'::date $$;`,
  );
  await login();
  const next = await economy();
  expect(next.rerollsUsed).toBe(0);
  expect(next.rerolled).toBe(false);
  expect(next.missions.every((m) => m.day === day)).toBe(true);
  expect((await change(0)).rerollsUsed).toBe(1);
});

it("preserves solo-friendly changes, including when replacing a social mission", async () => {
  await db.exec("reset role");
  await db.query(
    "update public.arena_mission_days set social = true where player_id = $1 and day = public.arena_today()",
    [player],
  );
  await db.query(
    "update public.arena_mission_progress set mission_id = 'pvp-wins-2' where player_id = $1 and day = public.arena_today() and slot = 1",
    [player],
  );
  await login();
  const after = await change(1);
  expect(after.missions[1].id).not.toBe("pvp-wins-2");
  await db.exec("reset role");
  const solo = await db.query<{ solo: boolean }>(
    "select solo from public.arena_missions where id = $1",
    [after.missions[1].id],
  );
  expect(solo.rows[0].solo).toBe(true);
  await db.query(
    "update public.arena_mission_days set social = false where player_id = $1 and day = public.arena_today()",
    [player],
  );
  await login();
  for (let i = 0; i < 2; i++) {
    const e = await change(1);
    await db.exec("reset role");
    expect(
      (
        await db.query<{ solo: boolean }>(
          "select solo from public.arena_missions where id = $1",
          [e.missions[1].id],
        )
      ).rows[0].solo,
    ).toBe(true);
    await login();
  }
});

it("keeps admin testing state and prevents direct counter edits", async () => {
  await login(admin);
  const e = await change(0);
  expect(e.unlimitedCoins).toBe(true);
  expect(e.mythicTesting).toBe(true);
  expect(e.journey).toBeDefined();
  await login();
  await expect(
    attempt(() =>
      db.query("update public.arena_mission_days set rerolls_used = 0"),
    ),
  ).rejects.toThrow("permission denied");
  await db.exec("reset role;set role anon");
  await expect(change(0)).rejects.toThrow("permission denied");
});
