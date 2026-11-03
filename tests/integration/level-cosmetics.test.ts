import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  JOURNEY_ITEM_BY_ID,
  LEVEL_MILESTONES,
  levelThreshold,
  playerLevel,
} from "../../packages/shared/src/journey";

// Migration 051: the Journey's Lv 55–100 cosmetics, granted on the way up
// and backfilled for everyone already past their level.
const MIGRATION = "051_level_cosmetics.sql";
const NEW_ITEMS = [
  "prism-frame",
  "nova-entrance",
  "starlit-colors",
  "solar-aura",
  "eclipse-finale",
  "prismatic-laurel",
  "element-master-frame",
];
let db: PGlite;
const id = (n: number) =>
  `00000000-0000-4000-8000-0000000005${String(n).padStart(2, "0")}`;
/** Saved XP before 051 runs, written straight to the table. */
const players = {
  below: { id: id(1), xp: levelThreshold(55) - 1 },
  at55: { id: id(2), xp: levelThreshold(55) },
  mid: { id: id(3), xp: levelThreshold(80) + 123 },
  max: { id: id(4), xp: levelThreshold(100) + 5000 },
  suspended: { id: id(5), xp: levelThreshold(72) },
  fresh: { id: id(6), xp: 0 },
};
const login = (pid: string) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${pid}',false);set role authenticated`,
  );
/** A player's level cosmetics (saved XP also advances the season, whose
 * own rewards are left out here). */
const owned = async (pid: string) => {
  await db.exec("reset role");
  return (
    await db.query<{ item_id: string }>(
      "select item_id from public.arena_owned_items where player_id=$1 and item_id not like 'season-%' order by item_id",
      [pid],
    )
  ).rows.map((r) => r.item_id);
};
/** The level cosmetics a player at this XP should own, from the shared data. */
const expected = (xp: number) =>
  LEVEL_MILESTONES.filter((m) => m.item && m.level <= playerLevel(xp).level)
    .map((m) => m.item!)
    .sort();
const run = async (file: string) =>
  db.exec(
    "reset role;" + (await readFile("supabase/migrations/" + file, "utf8")),
  );
const totals = async () => {
  await db.exec("reset role");
  return (
    await db.query<{ coins: number; titles: number; xp: number }>(
      `select (select coalesce(sum(amount),0)::int from public.arena_coin_ledger) coins,
              (select count(*)::int from public.arena_player_titles) titles,
              (select coalesce(sum(xp),0)::int from public.arena_player_xp) xp`,
    )
  ).rows[0];
};
let before: Awaited<ReturnType<typeof totals>>;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
  );
  const files = (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  expect(files).toContain(MIGRATION);
  // The database as it is before this migration.
  for (const f of files.filter((f) => f < MIGRATION)) await run(f);
  for (const p of Object.values(players)) {
    await db.exec(
      `reset role;insert into auth.users values('${p.id}','{"display_name":"Level tester"}')`,
    );
    await login(p.id);
    await db.query("select public.arena_me()");
    await db.exec("reset role");
    if (p.xp)
      await db.query(
        "insert into public.arena_player_xp(player_id,xp) values($1,$2)",
        [p.id, p.xp],
      );
  }
  await db.exec(
    `reset role;update public.arena_profiles set suspended=true where id='${players.suspended.id}'`,
  );
  // One player already owns a Lv 10 piece: the backfill must not trip on it.
  await db.query(
    "insert into public.arena_owned_items(player_id,item_id) values($1,'wayfarer-frame')",
    [players.mid.id],
  );
  before = await totals();
  await run(MIGRATION);
}, 120000);
afterAll(async () => db.close());

it("names the same cosmetic for every level as the shared milestones", async () => {
  await db.exec("reset role");
  const rows = (
    await db.query<{ l: number; item: string | null }>(
      "select l, public.arena_level_item(l) item from generate_series(1,100) l",
    )
  ).rows;
  const byLevel = new Map<number, string>(
    LEVEL_MILESTONES.filter((m) => m.item).map((m) => [m.level, m.item!]),
  );
  for (const { l, item } of rows)
    expect(item, `level ${l}`).toBe(byLevel.get(l) ?? null);
});

it("seeds the seven new cosmetics as reward-only items in their real slots", async () => {
  await db.exec("reset role");
  for (const item of NEW_ITEMS) {
    const rows = (
      await db.query<{
        slot: string;
        active: boolean;
        price: number;
        kind: string;
        name: string;
      }>(
        "select slot,active,price,kind,name from public.arena_shop_items where id=$1",
        [item],
      )
    ).rows;
    expect(rows).toEqual([
      {
        slot: JOURNEY_ITEM_BY_ID[item].slot,
        active: false,
        price: 0,
        kind: "look",
        name: JOURNEY_ITEM_BY_ID[item].name,
      },
    ]);
  }
  await login(players.max.id);
  await expect(
    db.query("select public.arena_buy_item('prism-frame')"),
  ).rejects.toThrow("not for sale");
});

it("backfills every player already past a level, and only them", async () => {
  for (const [name, p] of Object.entries(players))
    expect(await owned(p.id), name).toEqual(expected(p.xp));
  expect(await owned(players.below.id)).not.toContain("prism-frame");
  expect(await owned(players.at55.id)).toContain("prism-frame");
  expect(await owned(players.mid.id)).toEqual(
    expect.arrayContaining([
      "prism-frame",
      "nova-entrance",
      "starlit-colors",
      "solar-aura",
    ]),
  );
  expect(await owned(players.mid.id)).not.toContain("eclipse-finale");
  expect(await owned(players.max.id)).toEqual(
    expect.arrayContaining(NEW_ITEMS),
  );
  // A suspended account keeps its place for when the suspension is lifted.
  expect(await owned(players.suspended.id)).toContain("starlit-colors");
  expect(await owned(players.fresh.id)).toEqual([]);
});

it("changes no coins, XP or titles, and is safe to run again", async () => {
  expect(await totals()).toEqual(before);
  const counts = async () => {
    await db.exec("reset role");
    return (
      await db.query<{ n: number }>(
        "select count(*)::int n from public.arena_owned_items",
      )
    ).rows[0].n;
  };
  const n = await counts();
  await run(MIGRATION);
  expect(await counts()).toBe(n);
  expect(await totals()).toEqual(before);
  // The file's own closing check.
  const sql = await readFile("supabase/migrations/" + MIGRATION, "utf8");
  const check = sql.slice(sql.lastIndexOf("select\n"));
  await db.exec("reset role");
  expect((await db.query(check)).rows[0]).toEqual({
    level_cosmetics_seeded: true,
    level_cosmetics_granted: true,
    everyone_past_a_level_owns_it: true,
  });
});

it("grants each new cosmetic on the level-up that reaches it, never earlier", async () => {
  const p = players.below.id;
  let xp = players.below.xp,
    spark = 500,
    n = 0;
  /** Save XP until the player reaches `target`, overshooting by at most 1. */
  const reach = async (target: number) => {
    while (xp < target) {
      const need = target - xp;
      // The Daily Spark doubles the first 500 XP of the day; one saved row
      // holds at most 10,000.
      const amount = Math.min(
        10000,
        need <= 2 * spark ? Math.ceil(need / 2) : need - spark,
      );
      const bonus = Math.min(spark, amount);
      await db.exec("reset role");
      await db.query(
        "select public.arena_add_xp($1,$2,'test',$3,public.arena_today())",
        [p, amount, "climb-" + ++n],
      );
      spark -= bonus;
      xp += amount + bonus;
    }
  };
  expect(await owned(p)).toEqual(expected(xp));
  for (let level = 55; level <= 100; level++) {
    await reach(levelThreshold(level));
    expect(playerLevel(xp).level).toBe(level);
    const mine = await owned(p);
    expect(mine, `level ${level}`).toEqual(expected(xp));
    // The next cosmetic stays locked until its own level.
    const next = LEVEL_MILESTONES.find((m) => m.item && m.level > level);
    if (next) expect(mine).not.toContain(next.item);
  }
  await db.exec("reset role");
  expect(
    (
      await db.query<{ xp: number }>(
        "select xp::int from public.arena_player_xp where player_id=$1",
        [p],
      )
    ).rows[0].xp,
  ).toBe(xp);
  expect(await owned(p)).toEqual(expect.arrayContaining(NEW_ITEMS));
  // Level coins were paid once each on the way, 100 a level.
  expect(
    (
      await db.query<{ n: number; total: number }>(
        "select count(*)::int n, sum(amount)::int total from public.arena_coin_ledger where player_id=$1 and reason='level' and ref::int>=55",
        [p],
      )
    ).rows[0],
  ).toEqual({ n: 46, total: 4600 });
});

it("hands a missing level cosmetic back the next time XP is saved", async () => {
  const p = players.max.id;
  await db.exec("reset role");
  await db.query(
    "delete from public.arena_owned_items where player_id=$1 and item_id in ('solar-aura','wayfarer-frame')",
    [p],
  );
  expect(await owned(p)).not.toContain("solar-aura");
  await db.query(
    "select public.arena_add_xp($1,25,'test','heal',public.arena_today())",
    [p],
  );
  expect(await owned(p)).toEqual(
    expect.arrayContaining(["solar-aura", "wayfarer-frame"]),
  );
});

it("lets an owner equip each new cosmetic in its own slot, and nobody else", async () => {
  await login(players.max.id);
  for (const item of NEW_ITEMS) {
    const slot = JOURNEY_ITEM_BY_ID[item].slot;
    await db.query("select public.arena_equip_raid_slot($1,$2)", [slot, item]);
    const progress = (
      await db.query<{ p: any }>("select public.arena_raid_progress() p")
    ).rows[0].p;
    expect(progress.loadout[slot]).toBe(item);
  }
  await expect(
    db.query("select public.arena_equip_raid_slot('aura','prism-frame')"),
  ).rejects.toThrow("another slot");
  const journey = (
    await db.query<{ j: any }>("select public.arena_journey() j")
  ).rows[0].j;
  expect(journey.unlocked).toEqual(expect.arrayContaining(NEW_ITEMS));
  await login(players.at55.id);
  await db.query("select public.arena_equip_raid_slot('frame','prism-frame')");
  await expect(
    db.query(
      "select public.arena_equip_raid_slot('frame','element-master-frame')",
    ),
  ).rejects.toThrow("not earned");
  await expect(
    db.query("select public.arena_equip_raid_slot('aura','solar-aura')"),
  ).rejects.toThrow("not earned");
});
