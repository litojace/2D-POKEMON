import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from "vitest";
import type { FriendList } from "../../packages/shared/src/accounts";
let db: PGlite;
const ana = "a1a1a1a1-0000-4000-8000-000000000001",
  ben = "b2b2b2b2-0000-4000-8000-000000000002",
  cy = "c3c3c3c3-0000-4000-8000-000000000003";
const as = (id = ana) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`,
  );
const list = async () =>
  (await db.query<{ v: FriendList }>("select public.arena_friends() v")).rows[0]
    .v;
const attempt = async (run: () => Promise<unknown>) => {
  await db.exec("savepoint request");
  try {
    const v = await run();
    await db.exec("release savepoint request");
    return v;
  } catch (e) {
    await db.exec("rollback to savepoint request;release savepoint request");
    throw e;
  }
};
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
  );
  for (const m of [
    "001_arena_accounts.sql",
    "002_admin_cleanup_reports.sql",
    "003_titles.sql",
    "004_matches_achievements.sql",
    "005_friends.sql",
    "027_friends_last_online.sql",
  ])
    await db.exec(await readFile("supabase/migrations/" + m, "utf8"));
  for (const [id, name] of [
    [ana, "Ana"],
    [ben, "Ben"],
    [cy, "Cy"],
  ]) {
    await db.query("insert into auth.users values($1,$2)", [
      id,
      { display_name: name },
    ]);
    await as(id);
    await db.query("select public.arena_me()");
    await db.exec("reset role");
  }
  // Only the appearance columns read by the public friends projection are needed.
  await db.exec(
    `create table public.arena_raid_loadouts(player_id uuid primary key references public.arena_profiles(id),frame text);alter table public.arena_raid_loadouts enable row level security;revoke all on public.arena_raid_loadouts from anon,authenticated;`,
  );
  await db.exec(
    await readFile(
      "supabase/migrations/029_friend_portrait_frames.sql",
      "utf8",
    ),
  );
  await db.exec(
    `insert into public.arena_friendships(a,b)values('${ana}','${ben}');insert into public.arena_friend_requests(from_id,to_id)values('${cy}','${ana}')`,
  );
}, 30000);
beforeEach(async () => {
  await db.exec("begin");
  await as();
});
afterEach(async () => {
  await db.exec("rollback;reset role");
});
afterAll(async () => db.close());
it("shows a saved frame to accepted friends while offline without exposing request cosmetics", async () => {
  await db.exec("reset role");
  await db.query(
    "insert into public.arena_raid_loadouts values($1,$2),($3,$4)",
    [ben, "conqueror", cy, "galaxy-frame"],
  );
  await as();
  const friends = await list();
  expect(friends.friends[0]).toMatchObject({
    id: ben,
    frame: "conqueror",
    lastOnline: null,
  });
  expect(friends.incoming).toEqual([{ id: cy, name: "Cy" }]);
  await expect(
    attempt(() => db.query("select * from public.arena_raid_loadouts")),
  ).rejects.toThrow();
  await db.exec("reset role");
  await db.query(
    "update public.arena_raid_loadouts set frame=null where player_id=$1",
    [ben],
  );
  await as();
  expect((await list()).friends[0].frame).toBeNull();
});
it("does not invent history for existing friends or reveal request activity", async () => {
  const l = await list();
  expect(l.friends[0].lastOnline).toBeNull();
  expect(l.incoming).toEqual([{ id: cy, name: "Cy" }]);
  await as(cy);
  await db.query("select public.arena_touch_presence()");
  await as();
  expect((await list()).incoming).toEqual([{ id: cy, name: "Cy" }]);
});
it("stores only the caller’s current database timestamp and preserves it across calls", async () => {
  await as(ben);
  const before = Date.now();
  const r = await db.query<{ seen: Date }>(
    "select public.arena_touch_presence() seen",
  );
  expect(new Date(r.rows[0].seen).getTime()).toBeGreaterThanOrEqual(
    before - 1000,
  );
  await as();
  const first = (await list()).friends[0].lastOnline;
  expect(first).toBeTruthy();
  expect((await list()).friends[0].lastOnline).toBe(first);
  await db.exec("reset role");
  const own = (
    await db.query<{ last_online_at: Date | null }>(
      "select last_online_at from public.arena_profiles where id=$1",
      [ana],
    )
  ).rows[0];
  expect(own.last_online_at).toBeNull();
});
it("denies anonymous writes, forged parameters, direct table access and suspended accounts", async () => {
  await expect(
    attempt(() => db.query("select public.arena_touch_presence($1)", [ben])),
  ).rejects.toThrow();
  await expect(
    attempt(() => db.query("select last_online_at from public.arena_profiles")),
  ).rejects.toThrow();
  await db.exec("reset role;set role anon");
  await expect(
    attempt(() => db.query("select public.arena_touch_presence()")),
  ).rejects.toThrow();
  await db.exec(
    `reset role;update public.arena_profiles set suspended=true where id='${ana}'`,
  );
  await as();
  await expect(
    attempt(() => db.query("select public.arena_touch_presence()")),
  ).rejects.toThrow("Login required");
});
it("keeps history private after unfriend and can be reapplied without wiping it", async () => {
  await as(ben);
  await db.query("select public.arena_touch_presence()");
  await as();
  const before = (await list()).friends[0].lastOnline;
  await db.exec("reset role");
  const migration = await readFile(
    "supabase/migrations/027_friends_last_online.sql",
    "utf8",
  );
  await db.exec(migration.replace(/^begin;|^commit;/gm, ""));
  await as();
  expect((await list()).friends[0].lastOnline).toBe(before);
  await db.query("select public.arena_friend_remove($1)", [ben]);
  expect((await list()).friends).toEqual([]);
  await as(cy);
  expect((await list()).friends).toEqual([]);
});
