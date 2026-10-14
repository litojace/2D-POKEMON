import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, it, expect } from "vitest";
import type { MatchSummary } from "../../packages/shared/src/accounts";

let db: PGlite;
const ana = "00000000-0000-4000-8000-0000000000a1",
  ben = "00000000-0000-4000-8000-0000000000b2",
  cy = "00000000-0000-4000-8000-0000000000c3",
  dee = "00000000-0000-4000-8000-0000000000d4",
  guest = "00000000-0000-4000-8000-0000000000e5";
async function asUser(id: string, anonymous = false) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);select set_config('request.jwt.claims','${JSON.stringify({ sub: id, is_anonymous: anonymous })}',false);set role authenticated;`,
  );
}
type Report = {
  confirmed: boolean;
  records: { id: string; name: string; wins: number; losses: number; together?: number }[];
  achievements: string[];
};
async function report(user: string, id: string, summary: MatchSummary) {
  await asUser(user, user === guest);
  const result = await db.query<{ value: Report }>(
    "select public.arena_report_match($1,$2::jsonb) as value",
    [id, JSON.stringify(summary)],
  );
  return result.rows[0].value;
}
const duel = (
  winnerTeam: number,
  rounds: number[],
  a = ana,
  b: string | null = ben,
  extra: Partial<MatchSummary> = {},
  character = "voltkit",
): MatchSummary => ({
  v: 1,
  mode: "duel",
  arena: "classic",
  bot: null,
  winnerTeam,
  rounds,
  players: [
    { account: a, name: "A", character, team: 0, dealt: 900, kos: 3, combos: 2 },
    { account: b, name: "B", character: "tidefin", team: 1, dealt: 500, kos: 1, combos: 0 },
  ],
  ...extra,
});
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;insert into auth.users values('${ana}','{"display_name":"Ana"}'),('${ben}','{"display_name":"Ben"}'),('${cy}','{"display_name":"Cy"}'),('${dee}','{"display_name":"Dee"}'),('${guest}','{}');`,
  );
  for (const migration of [
    "001_arena_accounts.sql",
    "002_admin_cleanup_reports.sql",
    "003_titles.sql",
    "004_matches_achievements.sql",
  ])
    await db.exec(await readFile(`supabase/migrations/${migration}`, "utf8"));
  for (const id of [ana, ben, cy, dee, guest]) {
    await asUser(id, id === guest);
    await db.query("select public.arena_me()");
  }
}, 30000);
afterAll(async () => {
  await db.close();
});

it("names guests and flags them; ordinary logins are not guests", async () => {
  await asUser(guest, true);
  const me = await db.query<{ value: { displayName: string; guest: boolean } }>(
    "select public.arena_me() as value",
  );
  expect(me.rows[0].value.guest).toBe(true);
  expect(me.rows[0].value.displayName).toMatch(/^Guest [0-9A-F]{4}$/);
  await asUser(ana);
  const a = await db.query<{ value: { guest: boolean } }>(
    "select public.arena_me() as value",
  );
  expect(a.rows[0].value.guest).toBe(false);
});

it("counts a match only once every player has reported the same summary", async () => {
  const summary = duel(0, [0, 1, 0, 0]);
  const first = await report(ana, "match-0001", summary);
  expect(first.confirmed).toBe(false);
  expect(first.records).toEqual([
    expect.objectContaining({ id: ben, wins: 0, losses: 0 }),
  ]);
  // A tampered copy from the other side never confirms the match.
  const forged = await report(ben, "match-0001", duel(1, [1, 1, 1]));
  expect(forged.confirmed).toBe(false);
  await db.exec("reset role");
  expect(
    (await db.query("select * from public.arena_matches")).rows,
  ).toHaveLength(0);
  // Ben's honest copy (a fresh match id) confirms a separate, real match.
  await report(ana, "match-0002", summary);
  const second = await report(ben, "match-0002", summary);
  expect(second.confirmed).toBe(true);
  expect(second.records[0]).toMatchObject({ id: ana, wins: 0, losses: 1 });
  const again = await report(ana, "match-0002", summary);
  expect(again.confirmed).toBe(true);
  expect(again.records[0]).toMatchObject({ id: ben, wins: 1, losses: 0 });
  // Both players heard about Ana's first win.
  expect(again.achievements).toContain("First Victory");
});

it("refuses reports from people who were not in the match", async () => {
  await asUser(cy);
  await expect(
    db.query("select public.arena_report_match($1,$2::jsonb)", [
      "match-0003",
      JSON.stringify(duel(0, [0, 0, 0])),
    ]),
  ).rejects.toThrow("did not play");
  await expect(
    db.query("select public.arena_report_match($1,$2::jsonb)", [
      "x",
      JSON.stringify(duel(0, [0, 0, 0], cy)),
    ]),
  ).rejects.toThrow("Invalid match");
  await expect(
    db.query("select public.arena_report_match($1,$2::jsonb)", [
      "match-0004",
      JSON.stringify({ ...duel(0, [0], cy), mode: "chaos" }),
    ]),
  ).rejects.toThrow("Invalid match summary");
});

it("grants achievement titles: flawless, comeback, combo artist and bot breaker", async () => {
  const flawless = duel(0, [0, 0, 0], cy, dee);
  flawless.players[0].combos = 6;
  await report(cy, "match-0010", flawless);
  const done = await report(dee, "match-0010", flawless);
  expect(done.confirmed).toBe(true);
  const cyNow = await report(cy, "match-0010", flawless);
  expect(cyNow.achievements).toEqual(
    expect.arrayContaining(["First Victory", "Flawless", "Combo Artist"]),
  );
  const comeback = duel(1, [0, 0, 1, 1, 1], cy, dee);
  await report(cy, "match-0011", comeback);
  await report(dee, "match-0011", comeback);
  // A bot match needs only its one human.
  const bot = duel(0, [0, 1, 0, 0], dee, null, { bot: "hard" });
  const solo = await report(dee, "match-0012", bot);
  expect(solo.confirmed).toBe(true);
  expect(solo.records).toEqual([]);
  expect(solo.achievements).toEqual(
    expect.arrayContaining(["Comeback Kid", "Bot Breaker"]),
  );
  // Titles land in the player's owned titles.
  await asUser(dee);
  const me = await db.query<{ value: { ownedTitles: { name: string }[] } }>(
    "select public.arena_me() as value",
  );
  const owned = me.rows[0].value.ownedTitles.map((t) => t.name);
  expect(owned).toEqual(
    expect.arrayContaining(["Comeback Kid", "Bot Breaker", "First Victory"]),
  );
  expect(owned).not.toContain("Flawless");
});

it("reports progress, mastery and a season leaderboard without bots or guests", async () => {
  const withGuest = duel(0, [0, 0, 0], guest, ana);
  await report(guest, "match-0020", withGuest);
  expect((await report(ana, "match-0020", withGuest)).confirmed).toBe(true);
  await asUser(dee);
  const progress = await db.query<{
    value: {
      matches: number;
      wins: number;
      fighters: Record<string, { matches: number; wins: number }>;
      achievements: { id: string; earnedAt: string | null }[];
      season: { matches: number; wins: number };
    };
  }>("select public.arena_my_progress() as value");
  const p = progress.rows[0].value;
  expect(p.matches).toBe(3);
  expect(p.wins).toBe(2);
  expect(p.fighters.tidefin).toEqual({ matches: 2, wins: 1 });
  expect(p.fighters.voltkit).toEqual({ matches: 1, wins: 1 });
  // The bot match is left out of the season.
  expect(p.season).toEqual({ ...p.season, matches: 2, wins: 1 });
  expect(p.achievements.find((a) => a.id === "bot-breaker")?.earnedAt).toBeTruthy();
  const board = await db.query<{
    value: {
      rows: { name: string; wins: number; matches: number; me: boolean }[];
      me: { rank: number } | null;
    };
  }>("select public.arena_leaderboard(null) as value");
  const names = board.rows[0].value.rows.map((r) => r.name);
  expect(names.some((n) => n.startsWith("Guest"))).toBe(false);
  expect(board.rows[0].value.rows[0]).toMatchObject({ name: "Ana", wins: 1 });
  expect(board.rows[0].value.me).toBeTruthy();
  await expect(
    db.query("select public.arena_leaderboard('bad')"),
  ).rejects.toThrow("Invalid season");
});

it("keeps match tables private to the database functions", async () => {
  await asUser(ana);
  await expect(db.query("select * from public.arena_matches")).rejects.toThrow();
  await expect(
    db.query(
      "insert into public.arena_match_players values('m',$1,'voltkit',0,true,0,0,0)",
      [ana],
    ),
  ).rejects.toThrow();
  await expect(
    db.query("select public.arena_check_achievements($1)", [ana]),
  ).rejects.toThrow();
});
