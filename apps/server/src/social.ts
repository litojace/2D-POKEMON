/**
 * Friends' ratings and recent players (UI remodel step 6, decision 4): two
 * read-only views the server builds from tables that already exist
 * (`arena_ratings`, `arena_match_players`, `arena_matches`, `arena_profiles`;
 * migrations 001, 004 and 006). No schema change and nothing is written.
 *
 * The rows come from a `SocialStore` (the service-role client in
 * production, a fake in tests); everything else here is plain functions, so
 * the rules (who ranks where, which players count as recent) are tested
 * without a database.
 */
import { createClient } from "@supabase/supabase-js";
import {
  PLACEMENT_MATCHES,
  RANKS,
  type Friend,
  type FriendList,
  type FriendsBoard,
  type Rating,
  type RecentPlayer,
} from "../../../packages/shared/src/accounts.js";

export interface RatingRow {
  player_id: string;
  rating: number;
  matches: number;
}
export interface MatchResultRow {
  player_id: string;
  won: boolean;
}
export interface MyMatchRow {
  match_id: string;
  team: number;
  won: boolean;
  played_at: string;
}
export interface MatchPlayerRow {
  match_id: string;
  player_id: string;
  team: number;
  character: string;
}
export interface ProfileRow {
  id: string;
  display_name: string;
  suspended: boolean;
}
export interface SocialStore {
  /** Saved ratings of these players (players who never played have none). */
  ratings(ids: string[]): Promise<RatingRow[]>;
  /** The #1 ranked player (ranked, not a guest, not suspended), if any. */
  topRated(): Promise<string | null>;
  /** Results of these players in player-vs-player matches in [from, to). */
  monthResults(
    ids: string[],
    from: string,
    to: string,
  ): Promise<MatchResultRow[]>;
  /** This player's matches played since `since`. */
  myMatches(me: string, since: string): Promise<MyMatchRow[]>;
  /** Everyone else in these matches. */
  matchPlayers(matchIds: string[], me: string): Promise<MatchPlayerRow[]>;
  profiles(ids: string[]): Promise<ProfileRow[]>;
}

/** The rank for a rating, as `arena_rank_name` (migration 006) names it. */
export function rankName(rating: number, matches: number, top: boolean) {
  if (matches < PLACEMENT_MATCHES) return "Unranked";
  let name: string = RANKS[0].name;
  for (const r of RANKS)
    if (rating >= r.min && (r.name !== "Legendary Grandmaster" || top))
      name = r.name;
  return name;
}

/** "2026-11" for a time, in UTC (the season the database uses). */
export const seasonOf = (now: number) =>
  new Date(now).toISOString().slice(0, 7);
/** The first instant of a season and of the next one (ISO). */
export function seasonBounds(season: string) {
  const [y, m] = season.split("-").map(Number);
  return {
    from: new Date(Date.UTC(y, m - 1, 1)).toISOString(),
    to: new Date(Date.UTC(y, m, 1)).toISOString(),
  };
}

/**
 * You and your friends, ranked among yourselves by rating (ties share a
 * place, as the global board's `rank()` does); players still in placement
 * come after, without a place.
 */
export function buildFriendsBoard(o: {
  me: {
    id: string;
    name: string;
    title?: string | null;
    titleColor?: string | null;
  };
  friends: Pick<Friend, "id" | "name" | "title" | "titleColor">[];
  ratings: RatingRow[];
  top: string | null;
  month: MatchResultRow[];
  season: string;
  rating?: Rating;
}): FriendsBoard {
  const byId = new Map(o.ratings.map((r) => [r.player_id, r]));
  const record = new Map<string, { wins: number; matches: number }>();
  for (const r of o.month) {
    const n = record.get(r.player_id) ?? { wins: 0, matches: 0 };
    n.matches++;
    if (r.won) n.wins++;
    record.set(r.player_id, n);
  }
  const people = [
    { ...o.me, me: true },
    ...o.friends
      .filter((f) => f.id !== o.me.id)
      .map((f) => ({ ...f, me: false })),
  ];
  const rows = people.map((p) => {
    const saved = byId.get(p.id);
    const rating = saved?.rating ?? 1000,
      matches = saved?.matches ?? 0;
    const month = record.get(p.id) ?? { wins: 0, matches: 0 };
    return {
      id: p.id,
      place: null as number | null,
      name: p.name,
      title: p.title ?? null,
      titleColor: p.titleColor ?? null,
      rating,
      rankName: rankName(rating, matches, o.top === p.id),
      placementLeft: Math.max(0, PLACEMENT_MATCHES - matches),
      wins: month.wins,
      matches: month.matches,
      me: p.me,
      rated: matches,
    };
  });
  const ranked = rows
    .filter((r) => r.placementLeft === 0)
    .sort(
      (a, b) =>
        b.rating - a.rating ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    );
  ranked.forEach((r, i) => {
    r.place =
      i > 0 && ranked[i - 1].rating === r.rating ? ranked[i - 1].place : i + 1;
  });
  const placing = rows
    .filter((r) => r.placementLeft > 0)
    .sort(
      (a, b) =>
        b.rated - a.rated ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    );
  return {
    season: o.season,
    rows: [...ranked, ...placing].map(({ rated: _rated, ...r }) => r),
    ...(o.rating ? { rating: o.rating } : {}),
  };
}

/** How far back Recent looks, and how much it keeps. */
export const RECENT_DAYS = 30;
export const RECENT_MATCHES = 20;
export const RECENT_PLAYERS = 20;

/**
 * The players in your latest matches, newest first: the fighter they played
 * last time, how often you met, your record against them, and whether you
 * are friends already. Suspended players are left out.
 */
export function buildRecentPlayers(o: {
  mine: MyMatchRow[];
  others: MatchPlayerRow[];
  profiles: ProfileRow[];
  friends: Pick<FriendList, "friends" | "incoming" | "outgoing">;
  presence?: (id: string) => Partial<Friend>;
}): RecentPlayer[] {
  const matches = [...o.mine]
    .sort(
      (a, b) =>
        Date.parse(b.played_at) - Date.parse(a.played_at) ||
        b.match_id.localeCompare(a.match_id),
    )
    .slice(0, RECENT_MATCHES);
  const order = new Map(matches.map((m, i) => [m.match_id, i]));
  const profile = new Map(o.profiles.map((p) => [p.id, p]));
  const friend = new Set(o.friends.friends.map((f) => f.id));
  const sent = new Set(o.friends.outgoing.map((f) => f.id));
  const received = new Set(o.friends.incoming.map((f) => f.id));
  const people = new Map<string, RecentPlayer & { latest: number }>();
  for (const row of [...o.others].sort(
    (a, b) => (order.get(a.match_id) ?? 1e9) - (order.get(b.match_id) ?? 1e9),
  )) {
    const index = order.get(row.match_id);
    const p = profile.get(row.player_id);
    if (index === undefined || !p || p.suspended) continue;
    const match = matches[index];
    const same = row.team === match.team;
    let entry = people.get(row.player_id);
    if (!entry) {
      entry = {
        id: row.player_id,
        name: p.display_name,
        fighter: row.character || null,
        lastPlayed: match.played_at,
        matches: 0,
        together: 0,
        wins: 0,
        losses: 0,
        relation: friend.has(row.player_id)
          ? "friend"
          : sent.has(row.player_id)
            ? "sent"
            : received.has(row.player_id)
              ? "received"
              : "none",
        latest: index,
      };
      const live = o.presence?.(row.player_id);
      if (live?.online !== undefined) entry.online = !!live.online;
      people.set(row.player_id, entry);
    }
    entry.matches++;
    if (same) entry.together++;
    else if (match.won) entry.wins++;
    else entry.losses++;
  }
  return [...people.values()]
    .sort((a, b) => a.latest - b.latest || a.name.localeCompare(b.name))
    .slice(0, RECENT_PLAYERS)
    .map(({ latest: _latest, ...p }) => p);
}

/** Read every page of a query (PostgREST answers at most 1,000 rows). */
async function pages<T>(
  read: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: unknown }>,
  cap = 10_000,
): Promise<T[]> {
  const size = 1000,
    out: T[] = [];
  for (let from = 0; from < cap; from += size) {
    const { data, error } = await read(from, from + size - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}
const chunks = <T>(list: T[], n = 100) =>
  Array.from({ length: Math.ceil(list.length / n) }, (_, i) =>
    list.slice(i * n, i * n + n),
  );

/** The production store: reads with the service-role key (never writes). */
export function supabaseSocialStore(): SocialStore | undefined {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return undefined;
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    async ratings(ids) {
      const out: RatingRow[] = [];
      for (const part of chunks(ids))
        out.push(
          ...(await pages<RatingRow>((a, b) =>
            db
              .from("arena_ratings")
              .select("player_id,rating,matches")
              .in("player_id", part)
              .range(a, b),
          )),
        );
      return out;
    },
    async topRated() {
      const { data, error } = await db
        .from("arena_ratings")
        .select("player_id,arena_profiles!inner(guest,suspended)")
        .gte("matches", PLACEMENT_MATCHES)
        .eq("arena_profiles.guest", false)
        .eq("arena_profiles.suspended", false)
        .order("rating", { ascending: false })
        .order("updated_at", { ascending: true })
        .limit(1);
      if (error) throw error;
      return (
        (data?.[0] as { player_id?: string } | undefined)?.player_id ?? null
      );
    },
    async monthResults(ids, from, to) {
      const out: MatchResultRow[] = [];
      for (const part of chunks(ids))
        out.push(
          ...(await pages<MatchResultRow>((a, b) =>
            db
              .from("arena_match_players")
              .select("player_id,won,arena_matches!inner(played_at,vs_bot)")
              .in("player_id", part)
              .eq("arena_matches.vs_bot", false)
              .gte("arena_matches.played_at", from)
              .lt("arena_matches.played_at", to)
              .range(a, b),
          )),
        );
      return out.map(({ player_id, won }) => ({ player_id, won }));
    },
    async myMatches(me, since) {
      const rows = await pages<{
        match_id: string;
        team: number;
        won: boolean;
        arena_matches: { played_at: string };
      }>(
        (a, b) =>
          db
            .from("arena_match_players")
            .select("match_id,team,won,arena_matches!inner(played_at)")
            .eq("player_id", me)
            .gte("arena_matches.played_at", since)
            .range(a, b),
        5000,
      );
      return rows.map((r) => ({
        match_id: r.match_id,
        team: r.team,
        won: r.won,
        played_at: r.arena_matches.played_at,
      }));
    },
    async matchPlayers(matchIds, me) {
      if (!matchIds.length) return [];
      const { data, error } = await db
        .from("arena_match_players")
        .select("match_id,player_id,team,character")
        .in("match_id", matchIds)
        .neq("player_id", me);
      if (error) throw error;
      return (data ?? []) as MatchPlayerRow[];
    },
    async profiles(ids) {
      if (!ids.length) return [];
      const { data, error } = await db
        .from("arena_profiles")
        .select("id,display_name,suspended")
        .in("id", ids);
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  };
}
