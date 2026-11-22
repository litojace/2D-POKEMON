/**
 * Match history (docs/match-history.md): turns one page from
 * `arena_match_history` (migration 20261120140000) into what the player
 * card shows, seen from the side of the player whose history it is: the
 * result, each round won or lost, their numbers, the rating the match
 * moved and everyone in it, with the MVP marked. Plain functions, tested
 * without a database (tests/unit/match-history.test.ts).
 */
import {
  matchHistoryEntrySchema,
  ratingSchema,
  type MatchHistory,
  type MatchHistoryEntry,
  type MatchSummary,
} from "../../../packages/shared/src/accounts.js";

export interface MatchHistoryRow {
  id: string;
  playedAt: string;
  mode: string;
  arena: string;
  vsBot: boolean;
  team: number;
  won: boolean;
  character: string;
  summary: MatchSummary;
  ratingBefore: number | null;
  ratingAfter: number | null;
}
export interface MatchHistoryPage {
  matches: MatchHistoryRow[];
  more: boolean;
  people: Record<string, { name: string; avatar: string | null }>;
  totals: MatchHistory["totals"];
  rating: unknown;
}

const outcome = (winner: number | null, team: number) =>
  winner === null ? "draw" : winner === team ? "win" : "loss";

/** One match from `player`'s side; null if it can't be read. */
export function historyEntry(
  row: MatchHistoryRow,
  player: string,
  people: MatchHistoryPage["people"],
): MatchHistoryEntry | null {
  const s = row.summary;
  if (!s || !Array.isArray(s.players)) return null;
  const list = s.players.map((p) => ({
    id: p.account ?? null,
    // No account: a bot, or (in a match between players) a deleted
    // account (migration 109 clears it).
    bot: !p.account && row.vsBot,
    team: Number(p.team) || 0,
    character: String(p.character ?? ""),
    dealt: Math.max(0, Math.round(Number(p.dealt) || 0)),
    kos: Math.max(0, Math.round(Number(p.kos) || 0)),
    combos: Math.max(0, Math.round(Number(p.combos) || 0)),
    saved: String(p.name ?? ""),
  }));
  const winner =
    s.winnerTeam === null || s.winnerTeam === undefined
      ? null
      : Number(s.winnerTeam);
  // The MVP comes from the winning side (everyone on a draw): most damage,
  // then most knock-outs; nobody when no one hit. A loser marked MVP read
  // as a contradiction on the board ("Defeat" beside "MVP").
  let mvp = -1;
  list.forEach((p, i) => {
    const b = list[mvp];
    if (
      (winner === null || p.team === winner) &&
      (p.dealt > 0 || p.kos > 0) &&
      (!b || p.dealt > b.dealt || (p.dealt === b.dealt && p.kos > b.kos))
    )
      mvp = i;
  });
  const players = list.map((p, i) => {
    const now = p.id ? people[p.id] : undefined;
    return {
      // A deleted account (migration 109) is no longer anyone.
      id: now ? p.id : null,
      name:
        now?.name ??
        (p.bot
          ? p.saved || "Bot"
          : p.id
            ? "Deleted player"
            : p.saved || "Deleted player"),
      avatar: now?.avatar ?? null,
      character: p.character,
      team: p.team,
      dealt: p.dealt,
      kos: p.kos,
      combos: p.combos,
      bot: p.bot,
      owner: p.id === player,
      mvp: i === mvp,
    };
  });
  const me = list.find((p) => p.id === player);
  const parsed = matchHistoryEntrySchema.safeParse({
    id: row.id,
    playedAt: new Date(row.playedAt).toISOString(),
    mode: row.mode,
    arena: row.arena,
    bot: row.vsBot ? (s.bot ?? "normal") : null,
    result: outcome(winner, row.team),
    character: row.character,
    team: row.team,
    rounds: (Array.isArray(s.rounds) ? s.rounds : []).map((r) =>
      outcome(r === null || r === undefined ? null : Number(r), row.team),
    ),
    dealt: me?.dealt ?? 0,
    kos: me?.kos ?? 0,
    combos: me?.combos ?? 0,
    rating:
      row.ratingBefore !== null && row.ratingAfter !== null
        ? { before: row.ratingBefore, after: row.ratingAfter }
        : null,
    // Your side first, then the rest by team.
    players: players.sort(
      (a, b) =>
        Number(b.team === row.team) - Number(a.team === row.team) ||
        a.team - b.team ||
        Number(b.owner) - Number(a.owner),
    ),
  });
  return parsed.success ? parsed.data : null;
}

/** The page the client gets. */
export function buildMatchHistory(
  page: MatchHistoryPage,
  player: string,
): MatchHistory {
  const matches = page.matches
    .map((m) => historyEntry(m, player, page.people ?? {}))
    .filter((m): m is MatchHistoryEntry => m !== null);
  const last = page.matches.at(-1);
  const rating = ratingSchema.safeParse(page.rating);
  return {
    matches,
    next:
      page.more && last
        ? // As the database wrote it: microseconds a Date would round away.
          { at: String(last.playedAt), id: last.id }
        : null,
    totals: page.totals ?? null,
    rating: rating.success ? rating.data : null,
  };
}
