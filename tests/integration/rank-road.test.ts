import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import {
  LEGACY_RANKS,
  RANKS,
  RANK_TIERS,
  rankAt,
  tierFloor,
} from "../../packages/shared/src/accounts";

// The rank road (migration 20261127090000): seven tiers of three steps on
// the old rating, titles earned under the old names kept, a title and coins
// per tier once, and a shield after a promotion.
let db: PGlite;
const ids = Array.from(
  { length: 4 },
  (_, i) =>
    `00000000-0000-4000-8000-0000000004${(i + 1).toString(16).padStart(2, "0")}`,
);
const [ana, ben, cy, dee] = ids;
const MIGRATION = "20261127090000_rank_road.sql";
const as = (id: string) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
type Rating = {
  rating: number;
  matches: number;
  rank: string;
  shield?: boolean;
  shielded?: boolean;
  next?: { name: string; at: number } | null;
  before?: number;
  previousRank?: string;
};
let serial = 0;
/** A confirmed 1v1: both report the same summary; `winner` won. */
async function duel(winner: string, loser: string) {
  const summary = {
    v: 1,
    mode: "duel",
    arena: "classic",
    bot: null,
    winnerTeam: 0,
    rounds: [0, 0, 0],
    players: [winner, loser].map((account, team) => ({
      account,
      name: `P${team}`,
      character: "voltkit",
      team,
      dealt: 100,
      kos: 1,
      combos: 0,
    })),
  };
  const id = `rank-road-match-${++serial}`;
  const replies: Record<string, { rating?: Rating }> = {};
  for (let pass = 0; pass < 2; pass++)
    for (const p of [winner, loser]) {
      await as(p);
      replies[p] = (
        await db.query<{ v: { rating?: Rating } }>(
          "select public.arena_report_match($1,$2::jsonb) as v",
          [id, JSON.stringify(summary)],
        )
      ).rows[0].v;
    }
  await db.exec("reset role");
  return replies;
}
/** Put a player at a rating, ranked (or with `matches` played). */
async function place(
  id: string,
  rating: number,
  matches = 20,
  shield: number | null = null,
) {
  await db.exec("reset role");
  await db.query(
    `insert into public.arena_ratings(player_id, rating, matches, peak, shield) values($1,$2,$3,$2,$4)
     on conflict (player_id) do update set rating = excluded.rating, matches = excluded.matches, shield = excluded.shield`,
    [id, rating, matches, shield],
  );
}
const rating = async (id: string) => {
  await db.exec("reset role");
  return (
    await db.query<{ v: Rating }>("select public.arena_rating_of($1) as v", [
      id,
    ])
  ).rows[0].v;
};
const titles = async (id: string) =>
  (
    await db.query<{ name: string }>(
      "select t.name from public.arena_player_titles pt join public.arena_titles t on t.id = pt.title_id where pt.player_id = $1 order by t.name",
      [id],
    )
  ).rows.map((r) => r.name);
const tierCoins = async (id: string) =>
  (
    await db.query<{ ref: string; amount: number }>(
      "select ref, amount from public.arena_coin_ledger where player_id = $1 and reason = 'rank-tier' order by ref::int",
      [id],
    )
  ).rows.map((r) => [Number(r.ref), r.amount]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;insert into auth.users values ${ids.map((id, i) => `('${id}','{"display_name":"Road ${i}"}')`).join(",")};`,
  );
  const files = (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  // Up to the rank road: two players as production has them, ranked under
  // the first ladder with its titles.
  for (const f of files.filter((f) => f < MIGRATION))
    await db.exec(await readFile(`supabase/migrations/${f}`, "utf8"));
  for (const id of ids) {
    await as(id);
    await db.query("select public.arena_me()");
  }
  await db.exec("reset role");
  await db.query(
    "insert into public.arena_ratings(player_id, rating, matches, peak) values($1, 1044, 68, 1240), ($2, 961, 48, 1010), ($3, 1020, 1, 1020)",
    [ana, ben, cy],
  );
  await db.query("select public.arena_grant_rank_titles($1)", [ana]);
  await db.query("select public.arena_grant_rank_titles($1)", [ben]);
  // A title from a rank reached earlier and since lost, and one an admin gave.
  await db.query(
    "insert into public.arena_player_titles(player_id, title_id) select $1, id from public.arena_titles where name in ('Master', 'Legendary Grandmaster') on conflict do nothing",
    [ana],
  );
  await db.exec(await readFile(`supabase/migrations/${MIGRATION}`, "utf8"));
  // And once more, as a migration run twice.
  await db.exec(await readFile(`supabase/migrations/${MIGRATION}`, "utf8"));
}, 120000);
afterAll(async () => db.close());
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback;reset role"));

it("the database's road is the game's: 21 ranks, seven tiers of three", async () => {
  const rows = await db.query<{
    name: string;
    min_rating: number;
    tier: number;
    step: number;
    coins: number;
    title: string | null;
  }>(
    "select l.name, l.min_rating, l.tier, l.step, l.coins, t.name as title from public.arena_rank_ladder l left join public.arena_titles t on t.id = l.title_id order by l.sort",
  );
  expect(rows.rows).toHaveLength(21);
  expect(
    rows.rows.map((r) => [r.name, r.min_rating, r.tier - 1, r.step]),
  ).toEqual(RANKS.map((r) => [r.name, r.min, r.tier, r.step]));
  // Each rank carries its tier's title and coins.
  expect(rows.rows.map((r) => [r.title, r.coins])).toEqual(
    RANKS.map((r) => [RANK_TIERS[r.tier].name, RANK_TIERS[r.tier].coins]),
  );
  // No old rank left on it.
  for (const old of LEGACY_RANKS)
    expect(rows.rows.some((r) => r.name === old.name)).toBe(false);
});

it("the game's road rises: every rank above the last, 1000 lands on Spark III", () => {
  for (let i = 1; i < RANKS.length; i++)
    expect(RANKS[i].min).toBeGreaterThan(RANKS[i - 1].min);
  expect(rankAt(1000).name).toBe("Spark III");
  expect(rankAt(999).name).toBe("Sprout I");
  expect(rankAt(100).name).toBe("Sprout III");
  expect(rankAt(5000).name).toBe("Legend I");
  expect(tierFloor(1)).toBe(1000);
  // Every name fits a phone's chip: the longest was 25 letters.
  for (const r of RANKS) expect(r.name.length).toBeLessThanOrEqual(11);
});

it("keeps every title earned under the old names, and the titles themselves", async () => {
  const mine = await titles(ana);
  // Earned by rating, reached and lost, and given: all still hers.
  expect(mine).toEqual(
    expect.arrayContaining([
      "Newbie",
      "Pupil",
      "Specialist",
      "Master",
      "Legendary Grandmaster",
    ]),
  );
  expect(await titles(ben)).toEqual(
    expect.arrayContaining(["Newbie", "Pupil"]),
  );
  const kept = await db.query<{ name: string; active: boolean }>(
    "select name, active from public.arena_titles where name = any($1)",
    [LEGACY_RANKS.map((r) => r.name)],
  );
  expect(kept.rows).toHaveLength(LEGACY_RANKS.length);
  expect(kept.rows.every((r) => r.active)).toBe(true);
  // A worn old title stays worn.
  await as(ana);
  const me = (
    await db.query<{ v: { ownedTitles: { name: string }[] } }>(
      "select public.arena_me() as v",
    )
  ).rows[0].v;
  expect(me.ownedTitles.map((t) => t.name)).toContain("Legendary Grandmaster");
});

it("ranked players got their tier's title and coins with the migration, once", async () => {
  // 1044: Spark II. Sprout and Spark; Spark's 100 coins (Sprout pays none).
  expect(await titles(ana)).toEqual(
    expect.arrayContaining(["Sprout", "Spark"]),
  );
  expect(await titles(ana)).not.toContain("Flare");
  expect(await tierCoins(ana)).toEqual([[2, 100]]);
  // 961: Sprout I.
  expect(await titles(ben)).toContain("Sprout");
  expect(await titles(ben)).not.toContain("Spark");
  expect(await tierCoins(ben)).toEqual([]);
  // Still in placement: nothing yet.
  expect((await titles(cy)).filter((t) => t === "Sprout")).toEqual([]);
  expect(await rating(ana)).toMatchObject({
    rating: 1044,
    rank: "Spark II",
    next: { name: "Spark I", at: 1070 },
    shield: false,
  });
  expect(await rating(ben)).toMatchObject({ rank: "Sprout I" });
  expect(await rating(cy)).toMatchObject({ rank: "Unranked" });
  expect((await rating(dee)).shield).toBe(false);
});

it("a new tier gives its title for good, its coins once, and a shield", async () => {
  await place(ana, 1098);
  await place(ben, 1100);
  const won = await duel(ana, ben);
  expect(won[ana].rating).toMatchObject({
    before: 1098,
    previousRank: "Spark I",
    rank: "Flare III",
    shield: true,
  });
  expect(won[ana].rating!.rating).toBeGreaterThanOrEqual(1105);
  expect(await titles(ana)).toContain("Flare");
  expect(await tierCoins(ana)).toEqual([
    [2, 100],
    [3, 150],
  ]);
  // Dropping out and climbing back pays nothing more; the title stays.
  await place(ana, 1098, 21, null);
  await place(ben, 1100);
  await duel(ana, ben);
  expect((await rating(ana)).rank).toBe("Flare III");
  expect(await tierCoins(ana)).toEqual([
    [2, 100],
    [3, 150],
  ]);
});

it("several tiers at once pay each of them", async () => {
  await place(dee, 1340);
  await db.query("select public.arena_grant_rank_titles($1)", [dee]);
  expect(await tierCoins(dee)).toEqual([
    [2, 100],
    [3, 150],
    [4, 250],
    [5, 400],
  ]);
  expect(await titles(dee)).toEqual(
    expect.arrayContaining(["Sprout", "Spark", "Flare", "Tempest", "Prism"]),
  );
});

it("the shield: the first loss that would drop you out of the tier holds you on its first step", async () => {
  // Just promoted to Flare (tier 3, from 1105), shield in hand.
  await place(ana, 1108, 30, 3);
  await place(ben, 1108, 30);
  expect((await rating(ana)).shield).toBe(true);
  const lost = await duel(ben, ana);
  expect(lost[ana].rating).toMatchObject({
    before: 1108,
    rating: 1105,
    rank: "Flare III",
    shield: false,
    shielded: true,
  });
  // The winner's gain is the usual one.
  expect(lost[ben].rating!.rating).toBe(1120);
  // The next such loss drops her: the shield is used up.
  await place(ben, 1105, 31);
  const again = await duel(ben, ana);
  expect(again[ana].rating!.rating).toBeLessThan(1105);
  expect(again[ana].rating!.rank).toBe("Spark I");
  expect(again[ana].rating!.shielded).toBe(false);
});

it("a loss that stays inside the tier keeps the shield for later", async () => {
  await place(ana, 1190, 30, 3);
  await place(ben, 1190, 30);
  const lost = await duel(ben, ana);
  expect(lost[ana].rating).toMatchObject({
    rating: 1178,
    shield: true,
    shielded: false,
  });
});

it("no shield, no hold; and a shield for another tier does nothing", async () => {
  await place(ana, 1108, 30, null);
  await place(ben, 1108, 30);
  expect((await duel(ben, ana))[ana].rating!.rating).toBe(1096);
  // A shield kept from Tempest, since lost to the monthly reset.
  await place(ana, 1108, 31, 4);
  await place(ben, 1108, 31);
  expect((await rating(ana)).shield).toBe(false);
  expect((await duel(ben, ana))[ana].rating!.rating).toBe(1096);
});

it("moving up a step inside a tier gives no shield; placement matches neither", async () => {
  await place(ana, 1030);
  await place(ben, 1030);
  const up = await duel(ana, ben);
  expect(up[ana].rating).toMatchObject({ rank: "Spark II", shield: false });
  // Her fifth match takes her from Unranked to a rank: not a promotion.
  await place(cy, 1090, 4);
  await place(dee, 1090, 30);
  const fifth = await duel(cy, dee);
  expect(fifth[cy].rating).toMatchObject({ matches: 5, shield: false });
  expect(fifth[cy].rating!.rank).toMatch(/^Flare/);
  // And she has her tiers' titles and coins from that match.
  expect(await titles(cy)).toEqual(
    expect.arrayContaining(["Sprout", "Spark", "Flare"]),
  );
});

it("the helpers stay private", async () => {
  await as(ana);
  for (const sql of [
    "select public.arena_rank_tier(1200)",
    "select public.arena_rank_tier_floor(3)",
    "select public.arena_grant_rank_titles(auth.uid())",
    "update public.arena_ratings set shield = 7 where player_id = auth.uid()",
  ]) {
    await db.exec("savepoint s");
    await expect(db.query(sql)).rejects.toThrow(/permission denied/);
    await db.exec("rollback to savepoint s");
  }
});
