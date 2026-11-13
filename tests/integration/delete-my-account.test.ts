import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { MatchSummary } from "../../packages/shared/src/accounts";

// Migration 109: a player deletes their own account (App Store 5.1.1(v)).
// Runs every migration, so a table added later that keeps a player's data
// without letting it go on delete fails here.
let db: PGlite;
const ana = "00000000-0000-4000-8000-000000000a01";
const ben = "00000000-0000-4000-8000-000000000b01";
const boss = "00000000-0000-4000-8000-000000000c01";
const raid = "10000000-0000-4000-8000-000000000109";
async function as(id: string) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
}
const duel: MatchSummary = {
  v: 1,
  mode: "duel",
  arena: "classic",
  bot: null,
  winnerTeam: 0,
  rounds: [0, 0, 0],
  players: [
    {
      account: ana,
      name: "Ana",
      character: "voltkit",
      team: 0,
      dealt: 900,
      kos: 3,
      combos: 1,
    },
    {
      account: ben,
      name: "Ben",
      character: "tidefin",
      team: 1,
      dealt: 400,
      kos: 0,
      combos: 0,
    },
  ],
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
  await db.exec(
    `reset role;insert into auth.users values('${ana}','{"display_name":"Ana"}'),('${ben}','{"display_name":"Ben"}'),('${boss}','{"display_name":"Boss"}')`,
  );
  for (const id of [ana, ben, boss]) {
    await as(id);
    await db.query("select public.arena_me()");
  }
  await db.exec(`reset role;insert into public.arena_admins values('${boss}')`);
  // Ana leaves a trail: a friend, a report, a saved fighter, a match with
  // Ben (both report it, so it's confirmed) and a raid.
  await as(ana);
  await db.query("select public.arena_friend_request(null,$1)", [ben]);
  await as(ben);
  await db.query("select public.arena_friend_respond($1,true)", [ana]);
  await as(ana);
  await db.query(
    "select public.arena_submit_report('bug','It froze once','{}')",
  );
  await db.query("select public.arena_save_fighter('voltkit')");
  for (const id of [ana, ben]) {
    await as(id);
    await db.query("select public.arena_report_match($1,$2::jsonb)", [
      "match-delete-1",
      JSON.stringify(duel),
    ]);
  }
  // A second match only Ben has reported so far: it waits for Ana's report.
  await as(ben);
  await db.query("select public.arena_report_match($1,$2::jsonb)", [
    "match-delete-2",
    JSON.stringify(duel),
  ]);
  await db.exec("reset role;set role service_role");
  await db.query("select public.arena_record_raid($1::jsonb)", [
    JSON.stringify({
      id: raid,
      boss: "grumblecrag",
      peril: 1,
      trait: "ancient",
      gilded: false,
      weekly: false,
      partySize: 2,
      seconds: 300,
      downs: 0,
      revives: 0,
      players: [
        { accountId: ana, character: "voltkit" },
        { accountId: ben, character: "tidefin" },
      ],
    }),
  ]);
}, 120000);
afterAll(async () => db.close());

/** Every foreign key that points at a player's login or profile. */
async function playerKeys() {
  await db.exec("reset role");
  return (
    await db.query<{ tbl: string; col: string; action: string }>(`
      select c.conrelid::regclass::text as tbl, a.attname as col, c.confdeltype as action
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f' and array_length(c.conkey, 1) = 1
        and c.confrelid in ('auth.users'::regclass, 'public.arena_profiles'::regclass)
      order by 1, 2`)
  ).rows;
}

it("lets every player's row go when the player does (cascade or set null)", async () => {
  const keys = await playerKeys();
  expect(keys.length).toBeGreaterThan(50);
  expect(keys.filter((k) => k.action !== "c" && k.action !== "n")).toEqual([]);
});

it("is only for signed-in players, and never deletes an administrator", async () => {
  await db.exec("reset role;set role anon");
  await expect(
    db.query("select public.arena_delete_my_account()"),
  ).rejects.toThrow();
  await as(boss);
  await expect(
    db.query("select public.arena_delete_my_account()"),
  ).rejects.toThrow("Administrators");
  // The helper that rewrites shared records is not callable by players.
  await expect(
    db.query("select public.arena_forget_player_in('[]'::jsonb,'account',$1)", [
      ana,
    ]),
  ).rejects.toThrow();
});

it("deletes the player and everything that is theirs, and keeps Ben's records", async () => {
  await as(ana);
  await db.query("select public.arena_delete_my_account()");
  await db.exec("reset role");
  const count = async (sql: string) =>
    (await db.query<{ n: number }>(`select count(*)::int as n from ${sql}`))
      .rows[0].n;
  expect(await count(`auth.users where id='${ana}'`)).toBe(0);
  expect(await count(`public.arena_profiles where id='${ana}'`)).toBe(0);
  // No table keeps a row that points at Ana.
  const left: string[] = [];
  for (const k of await playerKeys())
    if (await count(`${k.tbl} where ${k.col}='${ana}'`))
      left.push(`${k.tbl}.${k.col}`);
  expect(left).toEqual([]);
  // Her report stays for the admins, without her.
  expect(await count("public.arena_reports where reporter_id is null")).toBe(1);
  // Ben keeps the match and the raid; Ana is a "Deleted player" in them.
  const match = (
    await db.query<{ summary: MatchSummary }>(
      "select summary from public.arena_matches where id='match-delete-1'",
    )
  ).rows[0].summary;
  expect(match.players[0]).toMatchObject({
    account: null,
    name: "Deleted player",
    kos: 3,
  });
  expect(match.players[1]).toMatchObject({ account: ben, name: "Ben" });
  const reports = (
    await db.query<{ summary: MatchSummary }>(
      "select summary from public.arena_match_reports where match_id='match-delete-2'",
    )
  ).rows;
  // Ben's waiting report stays, without Ana's id or name.
  expect(reports).toHaveLength(1);
  expect(reports[0].summary.players[1]).toMatchObject({
    account: ben,
    name: "Ben",
  });
  expect(JSON.stringify(reports)).not.toContain(ana);
  expect(JSON.stringify(reports)).not.toContain('"Ana"');
  expect(
    await count(`public.arena_match_players where player_id='${ben}'`),
  ).toBe(1);
  const receipt = (
    await db.query<{ receipt: { players: { accountId: string | null }[] } }>(
      `select receipt from public.arena_raid_runs where id='${raid}'`,
    )
  ).rows[0].receipt;
  expect(receipt.players.map((p) => p.accountId)).toEqual([null, ben]);
  expect(
    await count(`public.arena_raid_players where player_id='${ben}'`),
  ).toBe(1);
  // Ben's profile is untouched; Ana is no longer his friend.
  await as(ben);
  const friends = await db.query<{ value: unknown }>(
    "select public.arena_friends() as value",
  );
  expect(JSON.stringify(friends.rows[0].value)).not.toContain(ana);
});
