/**
 * Ranks and the leaderboard (UI remodel step 6, docs/ui-remodel/PLAN.md).
 * Markup and rules only (no DOM); screens/ranks.ts wires it up.
 *
 * A panel: your rank card on the left (tier badge, rating, best rating,
 * progress to the next rank and the whole ladder with yours lit), the
 * leaderboard on the right with medals for the top three and your own row
 * pinned under it, wherever you stand. Everyone / Friends switches the
 * board; the Friends board comes from its own read-only endpoint. The
 * server owns every number; the season's countdown uses the server's clock.
 */
import {
  PLACEMENT_MATCHES,
  RANKS,
  rankColor,
  type FriendsBoard,
  type Leaderboard,
  type Rating,
} from "../../../../packages/shared/src/accounts";
import { seasonName } from "../progress-view";
import { serverNow } from "../server-clock";
import { countdownText } from "../ui/countdown";
import {
  bar,
  button,
  emptyState,
  esc,
  panel,
  segmented,
  tag,
} from "../ui/components";

export type RanksScope = "everyone" | "friends";
export interface RanksData {
  board: Leaderboard | null;
  /** null until loaded (it loads the first time Friends is picked). */
  friends: FriendsBoard | null;
  problem?: string;
  friendsProblem?: string;
  /** Your name, for your pinned row when you aren't in the top 20. */
  me: { name: string };
}
export interface RanksView {
  scope: RanksScope;
}
export const ranksView = (): RanksView => ({ scope: "everyone" });

const num = (n: number) => n.toLocaleString("en-US");

/**
 * When a rated season ("2026-11") ends: the database starts the next one
 * at midnight UTC on the first of the month (migration 006).
 */
export function ratedSeasonEndsAt(season: string, now = serverNow()) {
  const [y, m] = season.split("-").map(Number);
  if (!y || !m) return now;
  return Math.max(now, Date.UTC(y, m, 1));
}
export const ratedSeasonCountdown = (season: string, now = serverNow()) =>
  countdownText(ratedSeasonEndsAt(season, now) - now);

/** Where your rating sits between your rank and the next one. */
export function rankProgress(r: Rating) {
  const placing = (r.placementLeft ?? 0) > 0;
  if (placing) {
    const played = PLACEMENT_MATCHES - (r.placementLeft ?? 0);
    return {
      value: played,
      max: PLACEMENT_MATCHES,
      text: `${r.placementLeft} placement ${r.placementLeft === 1 ? "match" : "matches"} to go`,
    };
  }
  const index = RANKS.findIndex((x) => x.name === r.rank);
  const floor = index >= 0 ? RANKS[index].min : 0;
  if (!r.next) return { value: 1, max: 1, text: "Top of the ladder" };
  if (r.next.name === "Legendary Grandmaster" && r.rating >= r.next.at)
    return {
      value: 1,
      max: 1,
      text: "Reach #1 to become Legendary Grandmaster",
    };
  return {
    value: Math.max(0, r.rating - floor),
    max: Math.max(1, r.next.at - floor),
    text: `${num(r.next.at - r.rating)} more for ${r.next.name}`,
  };
}

/** The tier badge: a shield in the rank's colour with a star. */
const badge = () =>
  `<svg class="rk-badge" viewBox="0 0 100 110" aria-hidden="true"><path d="M50 4 94 26v38c0 24-20 38-44 44C26 102 6 88 6 64V26Z" fill="color-mix(in srgb, var(--rank) 30%, #121a33)" stroke="var(--rank)" stroke-width="5"/><path d="M50 30 58 46 76 48 63 60 66 78 50 69 34 78 37 60 24 48 42 46Z" fill="var(--rank)"/></svg>`;

function rules() {
  return `<details class="rk-rules"><summary>How ranks work</summary><ul><li>Everyone starts at a <b>1000</b> rating. Your first ${PLACEMENT_MATCHES} matches against other players are placement matches: your rating moves faster and you show as Unranked.</li><li>Win and you gain rating; lose and you drop. Beating a stronger player earns more (up to about +20), beating a much weaker one very little. In 2v2 your team's average rating is compared with theirs; in a free-for-all, you're compared with each opponent by final standings.</li><li>Only confirmed matches against other players count: bot matches and matches someone quit don't change ratings.</li><li>Reaching a rank gives you its title to keep, even if your rating drops later. Equip it from your profile.</li><li>Each month, everyone's rating moves a quarter of the way back towards 1000, so a new season is a fresh race. Titles you've earned stay.</li></ul></details>`;
}

/** Your rank card: badge, rating, best, progress, the ladder, the rules. */
export function rankCard(r: Rating | undefined) {
  if (!r)
    return `<aside class="rk-card" aria-label="Your rank" style="--rank:${rankColor(undefined)}">${badge()}<b class="rk-rank">Unranked</b><p class="ui-note rk-line">Play a match against another player to get a rating.</p>${ladder(undefined)}${rules()}</aside>`;
  const placing = (r.placementLeft ?? 0) > 0;
  const p = rankProgress(r);
  const best =
    r.peak !== undefined && r.peak > r.rating ? ` · best ${num(r.peak)}` : "";
  return `<aside class="rk-card${placing ? " is-placing" : ""}" aria-label="Your rank" style="--rank:${rankColor(r.rank)}">${badge()}<b class="rk-rank">${esc(r.rank)}</b><span class="rk-rating"><b class="ui-num">${num(r.rating)}</b><small>rating</small></span>${bar(p.value, p.max, { label: placing ? "Placement matches played" : "Progress to the next rank", color: "var(--rank)", thick: true })}<p class="ui-note rk-line">${esc(p.text)}${esc(best)}</p>${ladder(placing ? undefined : r.rank)}${rules()}</aside>`;
}

function ladder(current: string | undefined) {
  return `<ol class="rk-ladder" aria-label="Rank ladder">${[...RANKS]
    .reverse()
    .map(
      (r) =>
        `<li class="${r.name === current ? "is-cur" : ""}" style="--rank:${r.color}"${r.name === current ? ' aria-current="true"' : ""}><i aria-hidden="true"></i><span>${esc(r.name)}</span><small class="ui-num">${r.min ? `${num(r.min)}${r.name === "Legendary Grandmaster" ? " · #1" : "+"}` : "0+"}</small></li>`,
    )
    .join("")}</ol>`;
}

/** One leaderboard row (and the pinned "you" row). */
export interface BoardRow {
  place: number | null;
  name: string;
  rankName: string;
  rating: number | null;
  wins: number;
  matches: number;
  me: boolean;
  /** Under the name instead of the rank (placement). */
  sub?: string;
}
const monogram = (name: string, color: string) =>
  `<span class="rk-avatar" style="--rank:${color}" aria-hidden="true">${esc(Array.from(name.trim())[0]?.toUpperCase() ?? "?")}</span>`;
function placeCell(place: number | null) {
  if (place === null) return `<span class="rk-place ui-num">—</span>`;
  if (place <= 3)
    return `<span class="rk-place"><i class="rk-medal is-${place}" aria-label="#${place}">${place}</i></span>`;
  const text = num(place);
  return `<span class="rk-place ui-num${text.length > 4 ? " is-long" : ""}">${text}</span>`;
}
/** This month's wins–losses; a long record gets smaller type to fit. */
function wl(wins: number, losses: number) {
  const text = `${wins}–${Math.max(0, losses)}`;
  return `<span class="rk-wl ui-num${text.length > 7 ? " is-long" : ""}">${text}</span>`;
}
export function boardRow(r: BoardRow, pinned = false) {
  const color = rankColor(r.rankName);
  const sub = r.sub ?? r.rankName;
  return `<li class="rk-row${r.me ? " is-me" : ""}${pinned ? " is-pinned" : ""}${r.place !== null && r.place <= 3 ? ` is-top` : ""}"${pinned ? ' aria-label="Your row"' : ""}>${placeCell(r.place)}${monogram(r.name, color)}<span class="rk-name"><span class="rk-name-top"><b>${esc(r.name)}</b>${r.me ? tag("You", "new") : ""}</span><small style="color:${color}">${esc(sub)}</small></span><span class="rk-rating-cell ui-num">${r.rating === null ? "—" : num(r.rating)}</span>${wl(r.wins, r.matches - r.wins)}</li>`;
}

/** Everyone: the top 20 by rating, the players placing, and you, pinned. */
export function everyoneRows(
  board: Leaderboard,
  myName = "You",
): {
  rows: BoardRow[];
  me: BoardRow;
  placing: string;
} {
  const rated = !!board.rating;
  const rows = board.rows.map((r) => ({
    place: r.rank,
    name: r.name,
    rankName: r.rankName ?? "",
    rating: rated ? (r.rating ?? null) : r.wins,
    wins: r.wins,
    matches: r.matches,
    me: r.me,
  }));
  const mine = board.rows.find((r) => r.me);
  const rating = board.rating;
  const placing = (rating?.placementLeft ?? 0) > 0;
  const me: BoardRow = {
    place: board.me?.rank ?? mine?.rank ?? null,
    name: mine?.name ?? myName,
    rankName: rating?.rank ?? mine?.rankName ?? "Unranked",
    rating: rated ? (rating?.rating ?? null) : (board.me?.wins ?? 0),
    wins: board.me?.wins ?? mine?.wins ?? 0,
    matches: board.me?.matches ?? mine?.matches ?? 0,
    me: true,
    sub: placing
      ? `Placing · ${rating!.placementLeft} to go`
      : !rating && !board.me
        ? "Win a match against a player to join"
        : undefined,
  };
  const placingText = board.unranked?.length
    ? `Placing: ${board.unranked.map((u) => `${u.name} (${u.left} to go)`).join(" · ")}`
    : "";
  return { rows, me, placing: placingText };
}

/** Friends: you and your friends, ranked among yourselves. */
export function friendRows(board: FriendsBoard) {
  const rows: BoardRow[] = board.rows.map((r) => ({
    place: r.place,
    name: r.name,
    rankName: r.rankName,
    rating: r.rating,
    wins: r.wins,
    matches: r.matches,
    me: r.me,
    sub: r.place === null ? `Placing · ${r.placementLeft} to go` : undefined,
  }));
  return { rows, me: rows.find((r) => r.me)! };
}

function boardMarkup(
  rows: BoardRow[],
  me: BoardRow,
  o: { rated: boolean; empty: string; foot?: string },
) {
  const head = `<div class="rk-head" aria-hidden="true"><span>#</span><span></span><span>Player</span><span>${o.rated ? "Rating" : "Wins"}</span><span>${o.rated ? "W–L" : "W–L"}</span></div>`;
  const list = rows.length
    ? rows.map((r) => boardRow(r)).join("")
    : `<li class="rk-empty-row">${o.empty}</li>`;
  return `<div class="rk-board">${head}<ol class="rk-list" data-ranks-list aria-label="Leaderboard">${list}${o.foot ? `<li class="rk-foot ui-note">${esc(o.foot)}</li>` : ""}</ol><ol class="rk-pin">${boardRow(me, true)}</ol></div>`;
}

export function ranksMarkup(view: RanksView, d: RanksData) {
  const board = d.board;
  const season =
    board?.season ?? new Date(serverNow()).toISOString().slice(0, 7);
  const ends = ratedSeasonEndsAt(season) > serverNow();
  const kicker = `Season · ${seasonName(season)}${ends ? ` · ends in ${ratedSeasonCountdown(season)}` : ""}`;
  const seg = segmented(
    [
      {
        id: "everyone",
        label: "Everyone",
        selected: view.scope === "everyone",
      },
      { id: "friends", label: "Friends", selected: view.scope === "friends" },
    ],
    "Whose ranks",
    "scope",
  );
  let side = "",
    main = "";
  if (!board) {
    side = rankCard(undefined);
    main = d.problem
      ? emptyState(
          "Ranks aren't available",
          d.problem,
          button("Try again", {
            size: "s",
            attrs: { "data-ranks-retry": true },
          }),
        )
      : emptyState("Loading ranks", "One moment…");
  } else {
    side = rankCard(board.rating);
    if (view.scope === "everyone") {
      const e = everyoneRows(board, d.me.name);
      main = boardMarkup(e.rows, e.me, {
        rated: !!board.rating,
        empty: emptyState(
          "Nobody is ranked yet",
          `Play ${PLACEMENT_MATCHES} matches against other players to get a rank.`,
        ),
        foot: e.placing,
      });
    } else if (d.friends) {
      const f = friendRows(d.friends);
      const others = f.rows.length > 1;
      main = boardMarkup(others ? f.rows : [], f.me, {
        rated: true,
        empty: emptyState(
          "No friends to compare yet",
          "Add friends to see how you rank among them.",
          button("Friends", {
            size: "s",
            icon: "friends",
            attrs: { "data-ranks-friends": true },
          }),
        ),
      });
    } else
      main = d.friendsProblem
        ? emptyState(
            "Friends' ranks aren't available",
            d.friendsProblem,
            button("Try again", {
              size: "s",
              attrs: { "data-ranks-retry": true },
            }),
          )
        : emptyState("Loading your friends' ranks", "One moment…");
  }
  return panel({
    kicker,
    title: "Ranks",
    tools: seg,
    body: `${side}<div class="rk-main" data-ranks-main>${main}</div>`,
    attrs: { "data-ranks": true },
  }).replace('class="ui-panel"', 'class="ui-panel ranks-panel"');
}
