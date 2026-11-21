import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { MatchSummary } from "../../packages/shared/src/accounts";

// Match history (migration 20261120140000, docs/match-history.md): newest
// first, a page at a time, for you and your friends only. Runs every
// migration so the function sees the tables as production has them.
let db: PGlite;
const ana = "00000000-0000-4000-8000-0000000a0001";
const ben = "00000000-0000-4000-8000-0000000b0001";
const cy = "00000000-0000-4000-8000-0000000c0001";
async function as(id: string) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
}
type Page = {
  matches: {
    id: string;
    playedAt: string;
    mode: string;
    vsBot: boolean;
    team: number;
    won: boolean;
    character: string;
    summary: MatchSummary;
    ratingBefore: number | null;
    ratingAfter: number | null;
  }[];
  more: boolean;
  people: Record<string, { name: string; avatar: string | null }>;
  totals: {
    matches: number;
    wins: number;
    fighters: Record<string, { matches: number; wins: number }>;
  } | null;
  rating: { rating: number; rank: string } | null;
};
async function history(
  viewer: string,
  player: string,
  o: { at?: string; id?: string; limit?: number; kind?: string } = {},
) {
  await as(viewer);
  return (
    await db.query<{ v: Page }>(
      "select public.arena_match_history($1,$2,$3,$4,$5) as v",
      [player, o.at ?? null, o.id ?? null, o.limit ?? 10, o.kind ?? "all"],
    )
  ).rows[0].v;
}
const summary = (
  winnerTeam: number | null,
  other: string | null,
  bot: MatchSummary["bot"] = null,
): MatchSummary => ({
  v: 1,
  mode: "duel",
  arena: "classic",
  bot,
  winnerTeam,
  rounds: winnerTeam === null ? [0, 1, null] : [winnerTeam, winnerTeam],
  players: [
    {
      account: ana,
      name: "Ana",
      character: "voltkit",
      team: 0,
      dealt: 900,
      kos: 2,
      combos: 1,
    },
    {
      account: other,
      name: other ? "Ben then" : "Bot",
      character: "tidefin",
      team: 1,
      dealt: 400,
      kos: 0,
      combos: 0,
    },
  ],
});
/** A finished match, as the report function files it, at a set time. */
async function file(id: string, minutesAgo: number, s: MatchSummary) {
  await db.exec("reset role");
  const at = new Date(Date.now() - minutesAgo * 60_000).toISOString();
  await db.query(
    "insert into public.arena_matches(id,played_at,mode,arena,vs_bot,summary) values($1,$2,$3,$4,$5,$6)",
    [id, at, s.mode, s.arena, s.bot !== null, JSON.stringify(s)],
  );
  for (const p of s.players)
    if (p.account)
      await db.query(
        "insert into public.arena_match_players values($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          id,
          p.account,
          p.character,
          p.team,
          s.winnerTeam === p.team,
          p.dealt,
          p.kos,
          p.combos,
        ],
      );
  return at;
}

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
    `reset role;insert into auth.users values('${ana}','{"display_name":"Ana"}'),('${ben}','{"display_name":"Ben"}'),('${cy}','{"display_name":"Cy"}')`,
  );
  for (const id of [ana, ben, cy]) {
    await as(id);
    await db.query("select public.arena_me()");
  }
  // Ana and Ben are friends; Cy is a stranger to both.
  await as(ana);
  await db.query("select public.arena_friend_request(null,$1)", [ben]);
  await as(ben);
  await db.query("select public.arena_friend_respond($1,true)", [ana]);
  // Ana: five PvP matches with Ben and two against bots, a minute apart.
  await file("match-pvp-1", 70, summary(0, ben));
  await file("match-pvp-2", 60, summary(1, ben));
  await file("match-bot-1", 50, summary(0, null, "hard"));
  await file("match-pvp-3", 40, summary(null, ben));
  await file("match-pvp-4", 30, summary(0, ben));
  await file("match-bot-2", 20, summary(1, null, "easy"));
  await file("match-pvp-5", 10, summary(0, ben));
  await db.exec(
    `reset role;insert into public.arena_rating_changes(match_id,player_id,before,after) values('match-pvp-5','${ana}',1000,1016)`,
  );
}, 60_000);
afterAll(async () => {
  await db.close();
});

it("lists your matches newest first, with the rating each one moved", async () => {
  const page = await history(ana, ana, { limit: 3 });
  expect(page.matches.map((m) => m.id)).toEqual([
    "match-pvp-5",
    "match-bot-2",
    "match-pvp-4",
  ]);
  expect(page.more).toBe(true);
  expect(page.matches[0]).toMatchObject({
    team: 0,
    won: true,
    character: "voltkit",
    vsBot: false,
    ratingBefore: 1000,
    ratingAfter: 1016,
  });
  expect(page.matches[1]).toMatchObject({ vsBot: true, won: false });
  expect(page.matches[1].ratingBefore).toBeNull();
  expect(page.matches[0].summary.players).toHaveLength(2);
  // Everyone in the page as they are now (Ben's current name, not the
  // name saved in the summary).
  expect(page.people[ben].name).toBe("Ben");
  expect(page.people[ana].name).toBe("Ana");
  // The first page carries the card's totals: seven played, four won
  // (the draw is no win).
  expect(page.totals).toEqual({
    matches: 7,
    wins: 4,
    fighters: { voltkit: { matches: 7, wins: 4 } },
  });
  expect(page.rating?.rank).toBeTruthy();
});

it("pages on from the last match shown, without repeats or gaps", async () => {
  const seen: string[] = [];
  let cursor: { at?: string; id?: string } = {};
  for (let i = 0; i < 5; i++) {
    const page = await history(ana, ana, { ...cursor, limit: 3 });
    seen.push(...page.matches.map((m) => m.id));
    if (i > 0) expect(page.totals).toBeNull();
    if (!page.more) break;
    const last = page.matches.at(-1)!;
    cursor = { at: last.playedAt, id: last.id };
  }
  expect(seen).toEqual([
    "match-pvp-5",
    "match-bot-2",
    "match-pvp-4",
    "match-pvp-3",
    "match-bot-1",
    "match-pvp-2",
    "match-pvp-1",
  ]);
});

it("two matches at the same moment both show, split across pages", async () => {
  const at = await file("match-tie-b", 5, summary(0, ben));
  await db.query(
    "insert into public.arena_matches(id,played_at,mode,arena,vs_bot,summary) values($1,$2,'duel','classic',false,$3)",
    ["match-tie-a", at, JSON.stringify(summary(0, ben))],
  );
  await db.query(
    "insert into public.arena_match_players values($1,$2,'voltkit',0,true,1,1,1)",
    ["match-tie-a", ana],
  );
  const first = await history(ana, ana, { limit: 1 });
  expect(first.matches.map((m) => m.id)).toEqual(["match-tie-b"]);
  const next = await history(ana, ana, {
    at: first.matches[0].playedAt,
    id: first.matches[0].id,
    limit: 1,
  });
  expect(next.matches.map((m) => m.id)).toEqual(["match-tie-a"]);
  await db.exec(
    "reset role;delete from public.arena_matches where id in ('match-tie-a','match-tie-b')",
  );
});

it("filters to player-vs-player or bot matches", async () => {
  const pvp = await history(ana, ana, { kind: "pvp" });
  expect(pvp.matches.map((m) => m.id)).toEqual([
    "match-pvp-5",
    "match-pvp-4",
    "match-pvp-3",
    "match-pvp-2",
    "match-pvp-1",
  ]);
  const bots = await history(ana, ana, { kind: "bot" });
  expect(bots.matches.map((m) => m.id)).toEqual(["match-bot-2", "match-bot-1"]);
  expect(bots.more).toBe(false);
});

it("a friend may read your history; a stranger is refused", async () => {
  const seen = await history(ben, ana, { limit: 2 });
  expect(seen.matches.map((m) => m.id)).toEqual(["match-pvp-5", "match-bot-2"]);
  await expect(history(cy, ana)).rejects.toThrow(/Only friends/);
  await expect(history(cy, ben)).rejects.toThrow(/Only friends/);
  // Not even a client calling the function without logging in.
  await db.exec(
    "reset role;select set_config('request.jwt.claim.sub','',false);set role anon;",
  );
  await expect(
    db.query("select public.arena_match_history($1)", [ana]),
  ).rejects.toThrow(/permission denied/);
});

it("ending the friendship ends the access", async () => {
  await as(ben);
  await db.query("select public.arena_friend_remove($1)", [ana]);
  await expect(history(ben, ana)).rejects.toThrow(/Only friends/);
  // Your own history stays yours.
  expect((await history(ben, ben)).totals?.matches).toBe(5);
});
