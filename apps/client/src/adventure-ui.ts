import {
  playerLevel,
  levelUpCoins,
  LEVEL_MILESTONES,
  MAX_PLAYER_LEVEL,
  milestoneNames,
  type Journey,
} from "../../../packages/shared/src/journey";

/**
 * Player XP on result cards and the profile: the level bar and what a
 * finished match or raid earned. The Journey screen itself is
 * screens/journey-view.ts (UI remodel step 4).
 */
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function levelBar(j: Journey, compact = false) {
  const p = playerLevel(j.xp),
    next = LEVEL_MILESTONES.find((m) => m.level > p.level);
  return `<div class="journey-level${compact ? " is-compact" : ""}"><span class="journey-level-badge"><small>LEVEL</small><b>${p.level}</b></span><div><div class="journey-level-line"><b>${p.level === MAX_PLAYER_LEVEL ? "Element Master" : "Your next adventure"}</b><small>${p.needed ? `${p.into.toLocaleString()} / ${p.needed.toLocaleString()} XP` : "MAX LEVEL"}</small></div><progress max="100" value="${p.percent}" aria-label="Player level ${p.level} progress"></progress>${compact ? "" : `<small>${next ? `Next milestone · Level ${next.level} · ${milestoneNames(next).map(escape).join(" + ")}` : "Every milestone earned. Seasonal journeys keep bringing new rewards."}</small>`}</div></div>`;
}
/** What a finished match or raid earned, from the journey's recent rows. */
export interface XpAward {
  /** The run's own XP (0 for a first win quicker than 20 seconds). */
  run: number;
  /** A new player's First Win XP (migration 20261126120000). */
  firstWin: number;
  /** Daily missions the run completed. */
  missions: number;
  /** Daily Spark on all of it. */
  spark: number;
  gained: number;
  /** Total XP just before and just after the award. */
  xpBefore: number;
  xpAfter: number;
  /** Levels before and after. */
  before: number;
  after: number;
}
/**
 * The award saved for `ref` ("match:<id>", a raid run), or null while it
 * hasn't arrived (or the run earned nothing).
 */
export function xpAward(
  j: Journey | undefined,
  ref: string | undefined,
): XpAward | null {
  if (!j || !ref) return null;
  // The run's own rows: its XP and, for a new player's first win, the First
  // Win XP that tops them up to level 2 (migration 20261126120000). A first
  // win quicker than 20 seconds has only the second.
  const own = j.recent.filter((r) => r.ref === ref && r.source !== "spark");
  const award = own[0];
  if (!award) return null;
  const batch = j.recent.filter(
    (r) => r.at === award.at && (r.ref === ref || r.source === "mission"),
  );
  // Daily Spark bonuses are their own rows, saved as "<source>:<ref>".
  const sparks = j.recent.filter(
    (r) =>
      r.source === "spark" &&
      batch.some((b) => r.ref === `${b.source}:${b.ref}`),
  );
  const sum = (rows: typeof own) => rows.reduce((n, r) => n + r.amount, 0);
  const firstWin = sum(own.filter((r) => r.source === "first-win")),
    run = sum(own) - firstWin,
    missions = sum(batch.filter((r) => r.ref !== ref)),
    spark = sum(sparks),
    gained = run + firstWin + missions + spark;
  const later = sum(
    j.recent.filter((r) => Date.parse(r.at) > Date.parse(award.at)),
  );
  const xpAfter = Math.max(0, j.xp - later),
    xpBefore = Math.max(0, xpAfter - gained);
  return {
    run,
    firstWin,
    missions,
    spark,
    gained,
    xpBefore,
    xpAfter,
    before: playerLevel(xpBefore).level,
    after: playerLevel(xpAfter).level,
  };
}
/** What made up an award, in words ("25 from this run · 75 First Win bonus"). */
export function xpParts(a: XpAward) {
  return [
    a.run && (a.missions || a.spark || a.firstWin)
      ? `${a.run} from this run`
      : "",
    a.firstWin ? `${a.firstWin} First Win bonus` : "",
    a.missions ? `${a.missions} from daily missions` : "",
    a.spark ? `${a.spark} Daily Spark bonus` : "",
  ].filter(Boolean);
}
export function resultXp(
  j: Journey | undefined,
  ref: string | undefined,
  status?: "saving" | "saved" | "unavailable",
  eligible = true,
) {
  if (!j || !ref) return "";
  const a = xpAward(j, ref);
  if (!a) return xpPending(status, eligible);
  const { before, after, gained } = a;
  const milestones = LEVEL_MILESTONES.filter(
    (m) => m.level > before && m.level <= after,
  ).flatMap(milestoneNames);
  const parts = xpParts(a);
  return `<section class="journey-result-xp" aria-label="Experience earned"><strong>+${gained} XP</strong>${parts.length ? `<small class="journey-xp-breakdown">${parts.join(" · ")}</small>` : ""}${after > before ? `<p class="journey-level-up">LEVEL UP · ${before} → ${after}<small>+${levelUpCoins(before, after)} coins${milestones.length ? ` · ${milestones.map(escape).join(" · ")}` : ""}</small></p>` : ""}${levelBar(j, true)}</section>`;
}
/** While the award hasn't arrived: saving, not earned, or not saved. */
export function xpPending(
  status?: "saving" | "saved" | "unavailable",
  eligible = true,
) {
  return `<p class="journey-xp-pending" role="status">${status === "saved" && !eligible ? "No XP earned · finish at least 20 seconds of active play to qualify." : status === "unavailable" ? "XP could not be saved. Check your connection and database update." : "Updating your XP…"}</p>`;
}
