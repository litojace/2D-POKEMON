import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import {
  DAILY_GIFTS,
  DAILY_GIFT_DAYS,
  DAILY_GIFT_GRACE,
  giftOn,
  nextGiftDay,
} from "../../packages/shared/src/daily-gifts";

// The daily gift (migration 20261126150000): one a Pacific day, the next
// day's gift each day in a row, one missed day forgiven, the cosmetic in
// the first week only, and never twice in a day.
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000301";
const other = "00000000-0000-4000-8000-000000000302";
const as = async (id: string) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`,
  );
const call = async <T>(fn: string, id = player) => {
  await as(id);
  // (A refused call leaves the role to `refused`, which rolls back first.)
  const value = (await db.query<{ v: T }>(`select public.${fn}() as v`)).rows[0]
    .v;
  await db.exec("reset role");
  return value;
};
type State = {
  today: string;
  claimed: boolean;
  day: number;
  weeks: number;
  ownsItem: boolean;
  given?: { day: number; coins: number; xp: number; item: string | null };
};
const state = (id = player) => call<State>("arena_daily_gift", id);
const claim = (id = player) => call<State>("arena_daily_gift_claim", id);
/**
 * Pretend `days` days pass: the last gift and everything it paid move that
 * far into the past (the ledgers key a gift by its day, as they would on
 * real days).
 */
async function daysPass(days: number, id = player) {
  await db.query(
    "update public.arena_daily_gifts set last_claim = last_claim - $2::int where player_id = $1",
    [id, days],
  );
  await db.query(
    "update public.arena_coin_ledger set ref = (ref::date - $2::int)::text, day = day - $2::int where player_id = $1 and reason = 'daily-gift'",
    [id, days],
  );
  await db.query(
    "update public.arena_xp_ledger set ref = (ref::date - $2::int)::text, day = day - $2::int where player_id = $1 and source = 'daily-gift'",
    [id, days],
  );
  await db.query(
    "update public.arena_xp_ledger set ref = 'daily-gift:' || (substr(ref, 12)::date - $2::int)::text, day = day - $2::int where player_id = $1 and source = 'spark' and ref like 'daily-gift:%'",
    [id, days],
  );
}
/** A call that must fail, without ending the test's transaction. */
async function refused(run: () => Promise<unknown>) {
  await db.exec("savepoint refused");
  let message = "";
  try {
    await run();
  } catch (e) {
    message = String((e as Error).message);
  }
  await db.exec("rollback to savepoint refused;reset role");
  return message;
}
const coins = async (id = player) =>
  (
    await db.query<{ amount: number }>(
      "select amount from public.arena_coin_ledger where player_id=$1 and reason='daily-gift' order by id",
      [id],
    )
  ).rows.map((r) => r.amount);
const xpRows = async (id = player) =>
  (
    await db.query<{ amount: number }>(
      "select amount from public.arena_xp_ledger where player_id=$1 and source='daily-gift' order by created_at, ref",
      [id],
    )
  ).rows.map((r) => r.amount);
const owns = async (item: string, id = player) =>
  (
    await db.query(
      "select 1 from public.arena_owned_items where player_id=$1 and item_id=$2",
      [id, item],
    )
  ).rows.length > 0;
const ITEM = DAILY_GIFTS[6].item!;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
  );
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(`supabase/migrations/${f}`, "utf8"));
  for (const id of [player, other]) {
    await db.query("insert into auth.users values($1,$2)", [
      id,
      { display_name: `Gift ${id.slice(-3)}` },
    ]);
    await as(id);
    await db.query("select public.arena_me()");
    await db.exec("reset role");
  }
}, 120000);
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback;reset role"));
afterAll(async () => db.close());

it("the database's calendar is the game's", async () => {
  const table = (
    await db.query<{ v: object[] }>(
      "select public.arena_daily_gift_table() as v",
    )
  ).rows[0].v;
  expect(table).toEqual(DAILY_GIFTS.map((g) => ({ ...g })));
  expect(DAILY_GIFT_DAYS).toBe(7);
  // And its "next day" rule, for every last day and gap.
  for (let last = 0; last <= 7; last++)
    for (const gap of [null, 0, 1, 2, 3, 10]) {
      const sql = (
        await db.query<{ v: number }>(
          "select public.arena_daily_gift_next($1::int, case when $2::int is null then null else public.arena_today() - $2::int end, public.arena_today()) as v",
          [last, gap],
        )
      ).rows[0].v;
      expect(sql, `last ${last}, ${gap} days ago`).toBe(nextGiftDay(last, gap));
    }
  expect(DAILY_GIFT_GRACE).toBe(2);
});

it("a first visit: day 1 waits, and taking it pays 50 coins once", async () => {
  expect(await state()).toMatchObject({
    claimed: false,
    day: 1,
    weeks: 0,
    ownsItem: false,
  });
  const got = await claim();
  expect(got).toMatchObject({ claimed: true, day: 1, weeks: 0 });
  expect(got.given).toEqual({ day: 1, coins: 50, xp: 0, item: null });
  expect(await coins()).toEqual([50]);
  expect(await state()).toMatchObject({ claimed: true, day: 1 });
});

it("never twice in a day", async () => {
  await claim();
  expect(await refused(claim)).toMatch(/already yours/);
  expect(await refused(claim)).toMatch(/already yours/);
  expect(await coins()).toEqual([50]);
  const row = await db.query<{ total: number; day: number }>(
    "select total, day from public.arena_daily_gifts where player_id=$1",
    [player],
  );
  expect(row.rows[0]).toEqual({ total: 1, day: 1 });
});

it("seven days in a row: every gift in order, the cosmetic on the seventh", async () => {
  const given: State["given"][] = [];
  for (let day = 1; day <= 7; day++) {
    if (day > 1) await daysPass(1);
    expect(await state()).toMatchObject({ claimed: false, day });
    given.push((await claim()).given);
  }
  expect(given).toEqual(
    DAILY_GIFTS.map((_, i) => ({
      day: i + 1,
      ...giftOn(i + 1, { weeks: 0, ownsItem: false }),
    })),
  );
  // Coins on days 1, 3 and 5; XP on 2, 4 and 6; the cosmetic, not its coins.
  expect(await coins()).toEqual([50, 75, 100]);
  expect((await xpRows()).sort((a, b) => a - b)).toEqual([100, 150, 200]);
  expect(await owns(ITEM)).toBe(true);
  expect(await state()).toMatchObject({
    claimed: true,
    day: 7,
    weeks: 1,
    ownsItem: true,
  });
});

it("the second week starts at day 1 again, and its seventh day pays coins", async () => {
  await db.query(
    "insert into public.arena_daily_gifts(player_id, day, last_claim, weeks, total) values($1, 7, public.arena_today() - 1, 1, 7)",
    [player],
  );
  await db.query(
    "insert into public.arena_owned_items(player_id, item_id) values($1, $2)",
    [player, ITEM],
  );
  expect(await state()).toMatchObject({ claimed: false, day: 1, weeks: 1 });
  expect((await claim()).given).toEqual({
    day: 1,
    coins: 50,
    xp: 0,
    item: null,
  });
  await db.query(
    "update public.arena_daily_gifts set day = 6, last_claim = public.arena_today() - 1 where player_id=$1",
    [player],
  );
  expect((await claim()).given).toEqual({
    day: 7,
    coins: 200,
    xp: 0,
    item: null,
  });
  expect(await state()).toMatchObject({ day: 7, weeks: 2 });
});

it("a first week whose cosmetic is already owned pays the coins", async () => {
  await db.query(
    "insert into public.arena_owned_items(player_id, item_id) values($1, $2)",
    [player, ITEM],
  );
  await db.query(
    "insert into public.arena_daily_gifts(player_id, day, last_claim, weeks, total) values($1, 6, public.arena_today() - 1, 0, 6)",
    [player],
  );
  expect(await state()).toMatchObject({ day: 7, ownsItem: true, weeks: 0 });
  expect((await claim()).given).toEqual({
    day: 7,
    coins: 200,
    xp: 0,
    item: null,
  });
});

it("one missed day is forgiven; more starts over", async () => {
  await claim();
  // Yesterday missed: two days since the last gift, the row goes on.
  await daysPass(2);
  expect(await state()).toMatchObject({ claimed: false, day: 2 });
  expect((await claim()).given).toMatchObject({ day: 2, xp: 100 });
  // Three days away: day 1 again, the weeks kept.
  await daysPass(3);
  expect(await state()).toMatchObject({ claimed: false, day: 1, weeks: 0 });
  expect((await claim()).given).toMatchObject({ day: 1, coins: 50 });
  expect(await coins()).toEqual([50, 50]);
});

it("each player has their own calendar", async () => {
  await claim(player);
  expect(await state(other)).toMatchObject({ claimed: false, day: 1 });
  expect((await claim(other)).given).toMatchObject({ day: 1, coins: 50 });
  expect(await coins(other)).toEqual([50]);
});

it("needs a signed-in player, and the table can't be read or written directly", async () => {
  const signedOut = async (sql: string, role = "authenticated") =>
    refused(async () => {
      await db.exec(
        `reset role;select set_config('request.jwt.claim.sub','',false);set role ${role}`,
      );
      await db.query(sql);
    });
  expect(await signedOut("select public.arena_daily_gift()")).toMatch(
    /Login required/,
  );
  expect(await signedOut("select public.arena_daily_gift_claim()")).toMatch(
    /Login required/,
  );
  expect(await signedOut("select public.arena_daily_gift()", "anon")).toMatch(
    /permission denied/,
  );
  const asPlayer = (sql: string) =>
    refused(async () => {
      await as(player);
      await db.query(sql);
    });
  expect(await asPlayer("select * from public.arena_daily_gifts")).toMatch(
    /permission denied/,
  );
  expect(
    await asPlayer(
      `update public.arena_daily_gifts set last_claim = null where player_id = '${player}'`,
    ),
  ).toMatch(/permission denied/);
  expect(
    await asPlayer(`select public.arena_daily_gift_state('${other}')`),
  ).toMatch(/permission denied/);
});
