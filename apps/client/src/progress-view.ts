import {
  CHARACTERS,
  FIGHTER_IDS,
} from "../../../packages/shared/src/index";
import {
  masteryTier,
  nextMastery,
  rankColor,
  RANKS,
  PLACEMENT_MATCHES,
  type Leaderboard,
  type Progress,
  type Rating,
} from "../../../packages/shared/src/accounts";

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

/** "2026-10" → "October 2026". */
export function seasonName(id: string) {
  const [year, month] = id.split("-").map(Number);
  if (!year || !month) return id;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Your rank, rating and what it takes to reach the next rank. */
export function ratingMarkup(rating: Rating | undefined) {
  if (!rating) return "";
  const color = rankColor(rating.rank);
  const placing = (rating.placementLeft ?? 0) > 0;
  const next = placing
    ? `${rating.placementLeft} placement ${rating.placementLeft === 1 ? "match" : "matches"} to go before you get a rank.`
    : rating.next
      ? rating.next.name === "Legendary Grandmaster" &&
        rating.rating >= rating.next.at
        ? "Reach #1 on the leaderboard to become Legendary Grandmaster."
        : `${rating.next.at - rating.rating} more rating for ${escape(rating.next.name)}.`
      : "Top of the ladder.";
  return `<div class="rating-card" style="--rank:${color}"><span class="rank-name">${escape(rating.rank)}</span><b>${rating.rating}</b><small>rating${rating.peak && rating.peak > rating.rating ? ` · best ${rating.peak}` : ""}</small><p>${next}</p></div>`;
}
/** Plain-language rules for ratings and ranks (leaderboard and help). */
export function ranksHelpMarkup() {
  const rows = RANKS.map(
    (r) =>
      `<li style="--rank:${r.color}"><b>${escape(r.name)}</b><span>${r.min ? `${r.min}+` : "under 950"}${r.name === "Legendary Grandmaster" ? " and #1" : ""}</span></li>`,
  ).join("");
  return `<details class="ranks-help"><summary>How ranks work</summary><ul><li>Everyone starts at a <b>1000</b> rating. Your first ${PLACEMENT_MATCHES} matches against other players are placement matches: your rating moves faster and you show as Unranked.</li><li>Win and you gain rating; lose and you drop. Beating a stronger player earns more (up to about +20), beating a much weaker one very little. In 2v2 your team's average rating is compared with theirs; in a free-for-all, you're compared with each opponent by final standings.</li><li>Only confirmed matches against other players count: bot matches and matches someone quit don't change ratings.</li><li>Reaching a rank gives you its title to keep, even if your rating drops later. Equip it from your profile.</li><li>Each month, everyone's rating moves a quarter of the way back towards 1000, so a new season is a fresh race. Titles you've earned stay.</li></ul><ol class="rank-ladder">${rows}</ol></details>`;
}
/** Totals, this season, achievements and fighter mastery for the profile. */
export function progressMarkup(progress: Progress) {
  const rate = progress.matches
    ? Math.round((100 * progress.wins) / progress.matches)
    : 0;
  const earned = progress.achievements.filter((a) => a.earnedAt).length;
  const totals = `<div class="progress-totals"><span><b>${progress.matches}</b>MATCHES</span><span><b>${progress.wins}</b>WINS</span><span><b>${rate}%</b>WIN RATE</span><span><b>${progress.season.wins}–${progress.season.matches - progress.season.wins}</b>${escape(seasonName(progress.season.id).toUpperCase())}</span></div>`;
  const achievements = `<h3>Achievements <small>${earned}/${progress.achievements.length} · each one unlocks its title</small></h3><ul class="achievements">${progress.achievements
    .map(
      (a) =>
        `<li class="${a.earnedAt ? "earned" : ""}"><b>${escape(a.name)}</b><span>${escape(a.description)}</span></li>`,
    )
    .join("")}</ul>`;
  const mastery = `<h3>Fighter mastery <small>badges for matches played</small></h3><ul class="mastery">${FIGHTER_IDS.map(
    (id) => {
      const record = progress.fighters[id] ?? { matches: 0, wins: 0 };
      const tier = masteryTier(record.matches);
      const next = nextMastery(record.matches);
      const color = `#${CHARACTERS[id].color.toString(16).padStart(6, "0")}`;
      return `<li style="--element:${color}${tier ? `;--tier:${tier.color}` : ""}" class="${tier ? "ranked" : ""}"><b>${CHARACTERS[id].name}</b><span>${tier ? `${tier.name} · ` : ""}${record.matches} played · ${record.wins} won</span><small>${next ? `${next.left} more for ${next.name}` : "Top tier"}</small></li>`;
    },
  ).join("")}</ul>`;
  return ratingMarkup(progress.rating) + totals + achievements + mastery;
}

/** The leaderboard: ranked players by rating, with this month's record. */
export function leaderboardMarkup(board: Leaderboard) {
  // Ratings arrive with migration 006; before that the board ranks by wins.
  if (board.rating) return ratedBoardMarkup(board);
  const rows = board.rows.length
    ? board.rows
        .map(
          (r) =>
            `<tr class="${r.me ? "me" : ""}"><td>${r.rank}</td><th scope="row">${escape(r.name)}${r.title ? ` <small style="color:${escape(r.titleColor ?? "#d5f778")}">${escape(r.title)}</small>` : ""}</th><td>${r.wins}</td><td>${r.matches}</td></tr>`,
        )
        .join("")
    : '<tr><td colspan="4" class="empty">No player-vs-player matches yet this season. Invite a friend!</td></tr>';
  const mine =
    board.me && !board.rows.some((r) => r.me)
      ? `<p class="muted">You: rank ${board.me.rank} · ${board.me.wins} wins in ${board.me.matches} matches.</p>`
      : board.me
        ? ""
        : '<p class="muted">Win a match against another player to join the standings.</p>';
  return `<table class="leaderboard"><thead><tr><th scope="col">#</th><th scope="col">Player</th><th scope="col">Wins</th><th scope="col">Played</th></tr></thead><tbody>${rows}</tbody></table>${mine}`;
}

function ratedBoardMarkup(board: Leaderboard) {
  const rows = board.rows.length
    ? board.rows
        .map(
          (r) =>
            `<tr class="${r.me ? "me" : ""}"><td>${r.rank}</td><th scope="row">${escape(r.name)}<small class="rank-tag" style="color:${rankColor(r.rankName)}">${escape(r.rankName ?? "")}</small></th><td><b>${r.rating ?? ""}</b></td><td>${r.wins}–${r.matches - r.wins}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="4" class="empty">Nobody is ranked yet: play ${PLACEMENT_MATCHES} matches against friends to get a rank.</td></tr>`;
  const unranked = board.unranked?.length
    ? `<p class="muted unranked">Placing: ${board.unranked
        .map(
          (u) =>
            `${escape(u.name)} (${u.left} to go)`,
        )
        .join(" · ")}</p>`
    : "";
  return `<div class="leaderboard-layout"><aside class="leaderboard-summary">${ratingMarkup(board.rating)}${ranksHelpMarkup()}</aside><div class="leaderboard-results"><table class="leaderboard"><thead><tr><th scope="col">#</th><th scope="col">Player</th><th scope="col">Rating</th><th scope="col" title="Wins and losses against players this month">This month</th></tr></thead><tbody>${rows}</tbody></table>${unranked}</div></div>`;
}
