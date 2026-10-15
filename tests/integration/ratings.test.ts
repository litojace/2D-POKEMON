import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, it, expect } from "vitest";
import { RANKS } from "../../packages/shared/src/accounts";

let db: PGlite;
const ids = Array.from(
  { length: 6 },
  (_, i) => `00000000-0000-4000-8000-0000000000${(i + 1).toString(16).padStart(2, "0")}`,
);
const [ana, ben, cy, dee, eve, fay] = ids;
const names = ["Ana", "Ben", "Cy", "Dee", "Eve", "Fay"];
async function as(id: string) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
}
let serial = 0;
type Rating = {
  rating: number;
  matches: number;
  rank: string;
  before?: number;
  previousRank?: string;
  placementLeft?: number;
};
/** Play a confirmed match: every human reports the same summary. */
async function play(
  players: { id: string | null; team: number }[],
  winnerTeam: number | null,
  mode = "duel",
  rounds?: (number | null)[],
) {
  const summary = {
    v: 1,
    mode,
    arena: "classic",
    bot: players.some((p) => !p.id) ? "hard" : null,
    winnerTeam,
    rounds: rounds ?? (winnerTeam === null ? [] : [winnerTeam, winnerTeam, winnerTeam]),
    players: players.map((p, i) => ({
      account: p.id,
      name: `P${i}`,
      character: "voltkit",
      team: p.team,
      dealt: 100,
      kos: 1,
      combos: 0,
    })),
  };
  const id = `rated-${++serial}`;
  const replies: Record<string, { rating?: Rating }> = {};
  for (const p of players)
    if (p.id) {
      await as(p.id);
      replies[p.id] = (
        await db.query<{ v: { rating?: Rating } }>(
          "select public.arena_report_match($1,$2::jsonb) as v",
          [id, JSON.stringify(summary)],
        )
      ).rows[0].v;
    }
  // The last reporter confirmed it; everyone re-checks to read the change.
  for (const p of players)
    if (p.id) {
      await as(p.id);
      replies[p.id] = (
        await db.query<{ v: { rating?: Rating } }>(
          "select public.arena_report_match($1,$2::jsonb) as v",
          [id, JSON.stringify(summary)],
        )
      ).rows[0].v;
    }
  return replies;
}
async function rating(id: string) {
  await db.exec("reset role");
  return (
    await db.query<{ v: Rating }>("select public.arena_rating_of($1) as v", [id])
  ).rows[0].v;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;insert into auth.users values ${ids.map((id, i) => `('${id}','{"display_name":"${names[i]}"}')`).join(",")};`,
  );
  for (const m of [
    "001_arena_accounts.sql",
    "002_admin_cleanup_reports.sql",
    "003_titles.sql",
    "004_matches_achievements.sql",
    "005_friends.sql",
    "006_ratings.sql",
  ])
    await db.exec(await readFile(`supabase/migrations/${m}`, "utf8"));
  for (const id of ids) {
    await as(id);
    await db.query("select public.arena_me()");
  }
}, 30000);
afterAll(async () => {
  await db.close();
});

it("keeps the database ladder and the game's ladder identical", async () => {
  await db.exec("reset role");
  const rows = await db.query<{ name: string; min_rating: number }>(
    "select name, min_rating from public.arena_rank_ladder order by sort",
  );
  expect(rows.rows.map((r) => [r.name, r.min_rating])).toEqual(
    RANKS.map((r) => [r.name, r.min]),
  );
});

it("moves ratings like Elo: placement swings bigger, wins against equals ~half K", async () => {
  const first = await play(
    [
      { id: ana, team: 0 },
      { id: ben, team: 1 },
    ],
    0,
  );
  // Placement K=40 between equals: ±20.
  expect(first[ana].rating).toMatchObject({ rating: 1020, before: 1000, rank: "Unranked" });
  expect(first[ben].rating).toMatchObject({ rating: 980, before: 1000 });
  expect(first[ana].rating?.placementLeft).toBe(4);
});

it("ranks after 5 matches, grants every title reached and says what rank you had", async () => {
  for (let i = 0; i < 4; i++)
    await play(
      [
        { id: ana, team: 0 },
        { id: ben, team: 1 },
      ],
      0,
    );
  const a = await rating(ana);
  expect(a.matches).toBe(5);
  expect(a.rating).toBeGreaterThan(1075);
  expect(["Expert", "Candidate Master"]).toContain(a.rank);
  await as(ana);
  const me = await db.query<{ v: { ownedTitles: { name: string }[] } }>(
    "select public.arena_me() as v",
  );
  const owned = me.rows[0].v.ownedTitles.map((t) => t.name);
  expect(owned).toEqual(expect.arrayContaining(["Newbie", "Pupil", "Specialist", "Expert"]));
  // Legendary needs #1 and 1550: not handed out.
  expect(owned).not.toContain("Legendary Grandmaster");
  const b = await rating(ben);
  expect(b.rating).toBeLessThan(950);
  expect(b.rank).toBe("Newbie");
});

it("barely rewards beating a much weaker player, and rewards upsets", async () => {
  // Ana (strong) beats Ben (weak) again: a small gain.
  const before = (await rating(ana)).rating;
  await play(
    [
      { id: ana, team: 0 },
      { id: ben, team: 1 },
    ],
    0,
  );
  const gain = (await rating(ana)).rating - before;
  expect(gain).toBeGreaterThanOrEqual(0);
  expect(gain).toBeLessThan(10);
  // Ben upsets Ana: a big gain.
  const benBefore = (await rating(ben)).rating;
  await play(
    [
      { id: ana, team: 0 },
      { id: ben, team: 1 },
    ],
    1,
  );
  expect((await rating(ben)).rating - benBefore).toBeGreaterThan(15);
});

it("2v2 moves both partners alike; free-for-all compares by standings; bots change nothing", async () => {
  const replies = await play(
    [
      { id: cy, team: 0 },
      { id: dee, team: 1 },
      { id: eve, team: 0 },
      { id: fay, team: 1 },
    ],
    0,
    "teams",
  );
  expect(replies[cy].rating?.rating).toBe(replies[eve].rating?.rating);
  expect(replies[dee].rating?.rating).toBe(replies[fay].rating?.rating);
  expect(replies[cy].rating!.rating).toBeGreaterThan(1000);
  // Free-for-all: winner up most, last place down most.
  const ffa = await play(
    [
      { id: cy, team: 0 },
      { id: dee, team: 1 },
      { id: eve, team: 2 },
    ],
    1,
    "ffa",
    [1, 0, 1, 1],
  );
  const delta = (id: string) =>
    ffa[id].rating!.rating - (ffa[id].rating!.before ?? 0);
  expect(delta(dee)).toBeGreaterThan(delta(cy));
  expect(delta(cy)).toBeGreaterThan(delta(eve));
  // A bot match leaves the rating alone.
  const fayBefore = (await rating(fay)).rating;
  await play(
    [
      { id: fay, team: 0 },
      { id: null, team: 1 },
    ],
    0,
  );
  expect((await rating(fay)).rating).toBe(fayBefore);
});

it("lists ranked players by rating, the unranked separately, and your own rating", async () => {
  await as(cy);
  const board = (
    await db.query<{
      v: {
        rows: { name: string; rating: number; rankName: string }[];
        unranked: { name: string; left: number }[];
        rating: Rating;
      };
    }>("select public.arena_leaderboard(null) as v")
  ).rows[0].v;
  expect(board.rows.map((r) => r.name)).toEqual(["Ana", "Ben"]);
  expect(board.rows[0].rating).toBeGreaterThan(board.rows[1].rating);
  expect(board.unranked.map((u) => u.name)).toEqual(
    expect.arrayContaining(["Cy", "Dee", "Eve", "Fay"]),
  );
  expect(board.rating.rank).toBe("Unranked");
});

it("softly resets ratings once a month, keeping titles", async () => {
  await db.exec("reset role");
  const before = (await rating(ana)).rating;
  await db.exec("delete from public.arena_rating_seasons");
  await db.query("select public.arena_season_reset()");
  const after = (await rating(ana)).rating;
  expect(after).toBe(Math.round(1000 + (before - 1000) * 0.75));
  // Only once per month.
  await db.query("select public.arena_season_reset()");
  expect((await rating(ana)).rating).toBe(after);
  await as(ana);
  const me = await db.query<{ v: { ownedTitles: { name: string }[] } }>(
    "select public.arena_me() as v",
  );
  expect(me.rows[0].v.ownedTitles.map((t) => t.name)).toContain("Expert");
});

it("keeps rating tables and helpers private", async () => {
  await as(ana);
  await expect(db.query("select * from public.arena_ratings")).rejects.toThrow();
  await expect(
    db.query("select public.arena_apply_ratings('x', '{}'::jsonb)"),
  ).rejects.toThrow();
  await expect(db.query("select public.arena_season_reset()")).rejects.toThrow();
  const mine = await db.query<{ v: Rating }>("select public.arena_my_rating() as v");
  expect(mine.rows[0].v.matches).toBeGreaterThan(0);
});
