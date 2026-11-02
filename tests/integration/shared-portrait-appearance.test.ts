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
    `create table public.arena_raid_loadouts(player_id uuid primary key references public.arena_profiles(id),frame text, skin text, aura text, entrance text, victory text);alter table public.arena_raid_loadouts enable row level security;revoke all on public.arena_raid_loadouts from anon,authenticated;`,
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
  await db.exec(`
    create table public.arena_champion_looks(player_id uuid,champion text,skin text,stage int);
    create table public.arena_raid_runs(id uuid primary key,boss text,result text);
    create table public.arena_raid_players(run_id uuid,player_id uuid);
    alter table public.arena_champion_looks enable row level security;
    alter table public.arena_raid_runs enable row level security;
    alter table public.arena_raid_players enable row level security;
    revoke all on public.arena_champion_looks,public.arena_raid_runs,public.arena_raid_players from anon,authenticated;
  `);
  await db.exec(
    await readFile(
      "supabase/migrations/033_shared_portrait_appearance.sql",
      "utf8",
    ),
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
it("persists only the caller's valid portrait champion", async () => {
  await as(ben);
  await db.query("select public.arena_set_portrait_character($1)", ["tidefin"]);
  await as();
  expect((await list()).friends[0].fighter).toBe("tidefin");
  await expect(
    attempt(() =>
      db.query("select public.arena_set_portrait_character($1)", ["fake"]),
    ),
  ).rejects.toThrow("valid champion");
  await expect(
    attempt(() =>
      db.query("select public.arena_set_portrait_character($1)", [null]),
    ),
  ).rejects.toThrow();
  await expect(
    attempt(() =>
      db.query("select public.arena_set_portrait_character($1,$2)", [
        "terradon",
        ben,
      ]),
    ),
  ).rejects.toThrow();
  await expect(
    attempt(() =>
      db.query(
        "update public.arena_profiles set portrait_character='terradon' where id=$1",
        [ben],
      ),
    ),
  ).rejects.toThrow();
  await db.exec("reset role;set role anon");
  await expect(
    attempt(() =>
      db.query("select public.arena_set_portrait_character('terradon')"),
    ),
  ).rejects.toThrow();
});
it("projects equipped skin, Colors, all wardrobe slots and victory counts only to accepted friends", async () => {
  await db.exec("reset role");
  await db.query(
    "insert into public.arena_raid_loadouts(player_id,skin,aura,entrance,victory,frame) values($1,'candy-colours','galaxy-aura','firefall','twin-spark','conqueror')",
    [ben],
  );
  await db.query(
    "insert into public.arena_champion_looks values($1,'tidefin','tidefin-moontide',3),($1,'voltkit','voltkit-midnight',1)",
    [ben],
  );
  await db.query(
    "insert into public.arena_raid_runs select gen_random_uuid(),'grumblecrag',case when i<=40 then 'victory' else 'defeat' end from generate_series(1,45) i",
  );
  await db.query(
    "insert into public.arena_raid_players select id,$1 from public.arena_raid_runs",
    [ben],
  );
  await as(ben);
  await db.query("select public.arena_set_portrait_character('tidefin')");
  await as();
  const friend = (await list()).friends[0];
  expect(friend).toMatchObject({
    fighter: "tidefin",
    frame: "conqueror",
    look: {
      skin: "candy-colours",
      aura: "galaxy-aura",
      entrance: "firefall",
      victory: "twin-spark",
      frame: "conqueror",
    },
    championLooks: { tidefin: { skin: "tidefin-moontide", stage: 3 } },
    raidClears: { grumblecrag: 40 },
  });
  expect(Object.keys(friend.championLooks!)).toEqual(["tidefin"]);
  expect((await list()).incoming).toEqual([{ id: cy, name: "Cy" }]);
  await as(cy);
  expect((await list()).friends).toEqual([]);
  await expect(
    attempt(() => db.query("select * from public.arena_champion_looks")),
  ).rejects.toThrow();
  await expect(
    attempt(() => db.query("select * from public.arena_raid_players")),
  ).rejects.toThrow();
  await db.exec("reset role");
  await db.query(
    "update public.arena_raid_loadouts set frame=null,skin=null where player_id=$1",
    [ben],
  );
  await db.query("delete from public.arena_champion_looks where player_id=$1", [
    ben,
  ]);
  await as();
  expect((await list()).friends[0]).toMatchObject({
    frame: null,
    look: { frame: null, skin: null },
    championLooks: {},
  });
});
it("blocks suspended accounts and excludes suspended friends", async () => {
  await db.exec("reset role");
  await db.query(
    "update public.arena_profiles set suspended=true where id=$1",
    [ben],
  );
  await as();
  expect((await list()).friends).toEqual([]);
  await as(ben);
  await expect(
    attempt(() =>
      db.query("select public.arena_set_portrait_character('lumoth')"),
    ),
  ).rejects.toThrow();
});
