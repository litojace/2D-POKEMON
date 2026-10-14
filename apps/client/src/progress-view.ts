import {
  CHARACTERS,
  FIGHTER_IDS,
} from "../../../packages/shared/src/index";
import {
  masteryTier,
  nextMastery,
  type Leaderboard,
  type Progress,
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
  return totals + achievements + mastery;
}

/** The monthly season standings (player-vs-player wins). */
export function leaderboardMarkup(board: Leaderboard) {
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
