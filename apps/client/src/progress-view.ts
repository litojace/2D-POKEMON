import { levelBar } from "./adventure-ui";
import type { Journey } from "../../../packages/shared/src/journey";
import { CHARACTERS, FIGHTER_IDS } from "../../../packages/shared/src/index";
import {
  masteryTier,
  nextMastery,
  rankColor,
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
/** Totals, this season, achievements and fighter mastery for the profile. */
export function progressMarkup(progress: Progress, journey?: Journey) {
  const rate = progress.matches
    ? Math.round((100 * progress.wins) / progress.matches)
    : 0;
  const earned = progress.achievements.filter((a) => a.earnedAt).length;
  const totals = `<div class="progress-totals"><span><b>${progress.matches}</b>Matches</span><span><b>${progress.wins}</b>Wins</span><span><b>${rate}%</b>Win rate</span><span><b>${progress.season.wins}–${progress.season.matches - progress.season.wins}</b>${escape(seasonName(progress.season.id))}</span></div>`;
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
  return (
    (journey
      ? levelBar(journey) +
        '<p><button class="secondary" id="profile-adventure">Player levels & seasonal rewards →</button></p>'
      : "") +
    ratingMarkup(progress.rating) +
    totals +
    achievements +
    mastery
  );
}
