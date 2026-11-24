import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";

// Quick Match's fallback bot (migration 20261119170000): a won match pays 5
// coins under the shared PvP cap; bot matches from the menu still pay none.
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000171";
let serial = 0;
const today = async () =>
  (await db.query<{ d: string }>("select public.arena_today()::text d")).rows[0]
    .d;
const receipt = async (fields: object = {}, id = `quick-${++serial}`) => ({
  id,
  kind: "match",
  day: await today(),
  players: [
    {
      accountId: player,
      character: "voltkit",
      won: true,
      vsPeople: false,
      botLevel: "easy",
      quick: "bot",
      mode: "duel",
      knockedOut: false,
      skillUses: 3,
      ults: 0,
      activeSeconds: 90,
      participated: true,
      abandoned: false,
      ...fields,
    },
  ],
});
const record = async (p: object) => {
  await db.exec("reset role;set role service_role");
  await db.query("select public.arena_record_activity($1::jsonb)", [
    JSON.stringify(p),
  ]);
  await db.exec("reset role");
};
const pvpCoins = async () =>
  (
    await db.query<{ amount: number }>(
      "select amount from public.arena_coin_ledger where player_id=$1 and reason='pvp' order by id",
      [player],
    )
  ).rows.map((r) => r.amount);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
  );
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(`supabase/migrations/${f}`, "utf8"));
  await db.query("insert into auth.users values($1,$2)", [
    player,
    { display_name: "Quick tester" },
  ]);
  await db.exec(
    `select set_config('request.jwt.claim.sub','${player}',false);set role authenticated`,
  );
  await db.query("select public.arena_me()");
  await db.exec("reset role");
}, 120000);
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback;reset role"));
afterAll(async () => db.close());

it("a won Quick Match bot pays 5 coins, once per match", async () => {
  const r = await receipt();
  await record(r);
  await record(r);
  expect(await pvpCoins()).toEqual([5]);
});

it("menu bot matches, losses and abandoned matches pay no PvP coins", async () => {
  await record(await receipt({ quick: null }));
  await record(await receipt({ won: false }));
  await record(await receipt({ abandoned: true }));
  expect(await pvpCoins()).toEqual([]);
});

it("shares the PvP cap of 10 paid matches a day", async () => {
  for (let i = 0; i < 12; i++) await record(await receipt());
  expect(await pvpCoins()).toHaveLength(10);
});

it("still records missions and XP through the earlier function", async () => {
  await record(await receipt());
  const xp = await db.query<{ n: number }>(
    "select count(*)::int n from public.arena_xp_ledger where player_id=$1",
    [player],
  );
  expect(xp.rows[0].n).toBeGreaterThan(0);
});
