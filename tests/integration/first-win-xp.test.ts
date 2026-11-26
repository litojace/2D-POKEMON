import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { levelThreshold, playerLevel } from "../../packages/shared/src/journey";

// The First Win XP (migration 20261126120000): a new player's short match
// against a bot ("intro" on its player), won, tops the account up to level 2
// and never past it by itself.
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000261";
let serial = 0;
const today = async () =>
  (await db.query<{ d: string }>("select public.arena_today()::text d")).rows[0]
    .d;
const receipt = async (
  fields: object = {},
  id = `match:intro-${++serial}`,
) => ({
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
      quick: null,
      intro: 1,
      mode: "duel",
      knockedOut: false,
      skillUses: 3,
      ults: 0,
      activeSeconds: 45,
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
type Row = { source: string; ref: string; amount: number };
const ledger = async () =>
  (
    await db.query<Row>(
      "select source, ref, amount from public.arena_xp_ledger where player_id=$1 order by source, ref",
      [player],
    )
  ).rows;
const firstWins = (rows: Row[]) => rows.filter((r) => r.source === "first-win");
/** XP from everything but the First Win and its Daily Spark. */
const otherXp = (rows: Row[]) =>
  rows
    .filter(
      (r) =>
        r.source !== "first-win" &&
        !(r.source === "spark" && r.ref.startsWith("first-win:")),
    )
    .reduce((n, r) => n + r.amount, 0);
const xp = async () =>
  Number(
    (
      await db.query<{ xp: string }>(
        "select coalesce((select xp from public.arena_player_xp where player_id=$1),0)::text xp",
        [player],
      )
    ).rows[0].xp,
  );
const coins = async (reason: string) =>
  (
    await db.query<{ amount: number }>(
      "select amount from public.arena_coin_ledger where player_id=$1 and reason=$2 order by id",
      [player, reason],
    )
  ).rows.map((r) => r.amount);
const LV2 = levelThreshold(2),
  LV3 = levelThreshold(3);

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
    { display_name: "First winner" },
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

it("the database's level 2 is the game's", async () => {
  const at = await db.query<{ n: string }>(
    "select public.arena_level_threshold(2)::text n",
  );
  expect(Number(at.rows[0].n)).toBe(LV2);
});

/**
 * Record a match for an account at `before` XP and check the top-up: what
 * was missing for level 2 after everything else the match gave (its own XP,
 * the day's missions, their Daily Spark), or nothing.
 */
async function recordAndCheck(r: Awaited<ReturnType<typeof receipt>>) {
  const before = await xp();
  const had = otherXp(await ledger());
  await record(r);
  const rows = await ledger();
  const others = before + otherXp(rows) - had;
  const mine = firstWins(rows).filter((x) => x.ref === r.id);
  if (others >= LV2) expect(mine).toEqual([]);
  else
    expect(mine).toEqual([
      { source: "first-win", ref: r.id, amount: LV2 - others },
    ]);
  return { others, paid: mine.length > 0 };
}
const setXp = (value: number) =>
  db.query(
    "insert into public.arena_player_xp(player_id, xp) values($1, $2) on conflict (player_id) do update set xp = excluded.xp",
    [player, value],
  );

it("a first win reaches level 2, topped up by exactly what was missing", async () => {
  const r = await receipt();
  const { others } = await recordAndCheck(r);
  // The match's own XP is there, as before.
  expect(await ledger()).toContainEqual({
    source: "match",
    ref: r.id,
    amount: 25,
  });
  expect(await xp()).toBeGreaterThanOrEqual(LV2);
  expect(playerLevel(await xp()).level).toBeGreaterThanOrEqual(2);
  // The top-up alone never reaches level 3, even doubled by the Spark.
  if (others < LV2) expect(await xp()).toBeLessThan(LV3);
  // The level's coins are paid as for any level-up.
  expect((await coins("level"))[0]).toBe(30);
});

it("a first win quicker than 20 seconds earns no match XP and still reaches level 2", async () => {
  const r = await receipt({ activeSeconds: 12 });
  await recordAndCheck(r);
  expect((await ledger()).some((x) => x.source === "match")).toBe(false);
  expect(await xp()).toBeGreaterThanOrEqual(LV2);
});

it("tops up only what is missing for an account part of the way", async () => {
  await setXp(40);
  const r = await receipt({ activeSeconds: 5 });
  const { others, paid } = await recordAndCheck(r);
  expect(others).toBeGreaterThanOrEqual(40);
  if (paid) expect(firstWins(await ledger())[0].amount).toBeLessThanOrEqual(60);
});

it("is paid at most once: the same match again, and the next short match", async () => {
  const first = await receipt({ activeSeconds: 12 });
  await recordAndCheck(first);
  await record(first);
  await record(await receipt({ intro: 2, activeSeconds: 12 }));
  // At level 2 after the first, whoever paid for it: nothing more.
  expect(firstWins(await ledger()).length).toBeLessThanOrEqual(1);
  expect(firstWins(await ledger()).every((x) => x.ref === first.id)).toBe(true);
});

it("an account already at level 2 gets none", async () => {
  await setXp(LV2);
  await record(await receipt({ activeSeconds: 12 }));
  expect(firstWins(await ledger())).toEqual([]);
});

it("a lost first match pays none; the second short match's win tops up", async () => {
  await record(await receipt({ won: false, activeSeconds: 12 }));
  expect(firstWins(await ledger())).toEqual([]);
  await recordAndCheck(await receipt({ intro: 2, activeSeconds: 12 }));
  expect(await xp()).toBeGreaterThanOrEqual(LV2);
});

it("only a short match against a bot, by someone who fought and stayed", async () => {
  const quick = { activeSeconds: 12 };
  await record(await receipt({ ...quick, intro: null }));
  await record(
    await receipt({ ...quick, intro: 1, botLevel: null, vsPeople: true }),
  );
  await record(await receipt({ ...quick, abandoned: true }));
  await record(await receipt({ ...quick, participated: false }));
  expect(firstWins(await ledger())).toEqual([]);
});

it("still pays the Quick Match bot's coins (migration 20261119170000)", async () => {
  const r = await receipt({ quick: "bot" });
  await record(r);
  await record(r);
  expect(await coins("pvp")).toEqual([5]);
  await record(await receipt({ quick: null, intro: null }));
  await record(await receipt({ quick: "bot", won: false }));
  expect(await coins("pvp")).toEqual([5]);
});
