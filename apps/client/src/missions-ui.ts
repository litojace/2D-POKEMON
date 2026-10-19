import { COINS, MISSION_BY_ID, type Economy } from "../../../packages/shared/src/shop";
import { buttonIcon, iconLabel } from "./menu-icons";
import { coinChip, picksCountdown } from "./shop-ui";
import { missionFeatExamples, missionHelp } from "./mission-help";

/**
 * Daily missions, on their own screen (they used to be a Shop tab). Markup
 * only: AccountUI wires the re-roll and Shop buttons.
 */
const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const TIER_PIPS = { easy: 1, medium: 2, hard: 3 } as const;
/** Days in a streak that pay the streak bonus. */
const STREAK_DAYS = 7;

/** The three mission tickets, with progress and the one free re-roll. */
export function missionsBlock(e: Economy, compact = false) {
  return `<ul class="mission-list">${e.missions
    .map((m) => {
      const together = MISSION_BY_ID[m.id]?.solo === false;
      const action = compact
        ? ""
        : `<div class="mission-actions">${m.done ? `<span class="mission-complete">${iconLabel("check", "Completed")}</span>` : !e.rerolled ? `<button class="quiet" data-mission-reroll="${m.slot}">${iconLabel("shuffle", together ? "Swap for a solo mission" : "Re-roll")}</button>` : ""}</div>`;
      const examples = missionFeatExamples(m.id);
      const title = compact ? `<b class="mission-title">${escape(m.text)}</b>` : `<div class="mission-title-row"><b class="mission-title">${escape(m.text)}</b><button type="button" class="mission-help-icon" data-mission-help="${m.slot}" aria-label="How to complete: ${escape(m.text)}" aria-haspopup="dialog" aria-expanded="false" aria-controls="mission-guide-${m.slot}">${buttonIcon("help")}</button></div>`;
      const guide = compact ? "" : `<dialog class="mission-instructions" id="mission-guide-${m.slot}" data-mission-guide="${escape(m.id)}" aria-labelledby="mission-guide-title-${m.slot}" aria-describedby="mission-guide-steps-${m.slot}"><div class="mission-popup-head"><span>${iconLabel("help", "How to complete")}</span><button type="button" class="quiet mission-help-close" aria-label="Close mission instructions" autofocus>${buttonIcon("cancel")}</button></div><div class="mission-popup-body"><h3 id="mission-guide-title-${m.slot}">${escape(m.text)}</h3><p id="mission-guide-steps-${m.slot}">${escape(missionHelp(m.id))}</p>${examples.length ? `<ul>${examples.map((text) => `<li>${escape(text)}</li>`).join("")}</ul>` : ""}<p class="mission-save-note">Finish the match or raid to save progress. Solo test mode and attack practice do not count. Mission coins are added automatically when completed.</p></div></dialog>`;
      return `<li class="mission tier-${m.tier}${m.done ? " is-done" : ""}"><span class="mission-tier">${'<i aria-hidden="true"></i>'.repeat(TIER_PIPS[m.tier])}${m.tier[0].toUpperCase() + m.tier.slice(1)}${together ? '<span class="mission-together">With others</span>' : ""}</span>${title}<div class="mission-footer"><progress aria-label="${escape(m.text)} progress" max="${m.target}" value="${Math.min(m.progress, m.target)}"></progress><div class="mission-meta"><span>${Math.min(m.progress, m.target)}/${m.target}</span><span class="mission-reward">${buttonIcon("coin")}<span>${m.coins}<span class="sr-only"> coins</span></span></span></div>${action}</div>${guide}</li>`;
    })
    .join("")}</ul>`;
}

/** Bonuses: all three today (+50), and every 7th day in a row (+300). */
function bonuses(e: Economy) {
  const done = e.missions.filter((m) => m.done).length;
  const all = e.missions.length > 0 && done === e.missions.length;
  // The streak includes today once all three are done; until then it runs
  // to yesterday, and a finished week starts the track again.
  const into = all ? e.streak % STREAK_DAYS || (e.streak > 0 ? STREAK_DAYS : 0) : e.streak % STREAK_DAYS;
  const days = Array.from({ length: STREAK_DAYS }, (_, i) =>
    `<li class="${i < into ? "is-lit" : ""}${i === STREAK_DAYS - 1 ? " is-payday" : ""}"><span class="sr-only">Day ${i + 1}${i < into ? ", done" : ""}</span>${i === STREAK_DAYS - 1 ? `<b>+${COINS.streakBonus}</b>` : ""}</li>`,
  ).join("");
  return `<section class="missions-bonuses" aria-label="Bonuses">
    <div class="missions-bonus${all ? " is-earned" : ""}"><b>All three today</b><span class="mission-reward">${buttonIcon("coin")}<span>+${COINS.allMissionsBonus}</span></span><small>${all ? "Earned. See you tomorrow!" : `${done} of ${e.missions.length} done`}</small></div>
    <div class="missions-bonus missions-streak"><b>Streak · ${e.streak} day${e.streak === 1 ? "" : "s"}</b><ol class="streak-track" aria-label="${into} of ${STREAK_DAYS} days toward the streak bonus">${days}</ol><small>Finish all three every day: the 7th day pays +${COINS.streakBonus}.</small></div>
  </section>`;
}

export function missionsMarkup(e: Economy | null, problem = "") {
  const head = `<header class="missions-head"><h2>${iconLabel("missions", "Daily missions")}</h2>${coinChip(e?.balance, "", e?.unlimitedCoins)}</header>`;
  if (!e)
    return `<div class="missions-screen">${head}<p class="shop-intro">${problem ? escape(problem) : "Log in to get three daily missions that pay coins."}</p></div>`;
  const left = e.missions.filter((m) => !m.done).length;
  const together = e.missions.some((m) => MISSION_BY_ID[m.id]?.solo === false);
  const caps = `Coins today: raid clears ${Math.min(e.today.raidClears, COINS.raidClearsPaidPerDay)}/${COINS.raidClearsPaidPerDay} paid, matches against players ${Math.min(e.today.pvpMatches, COINS.pvpMatchesPaidPerDay)}/${COINS.pvpMatchesPaidPerDay} paid.`;
  return `<div class="missions-screen">${head}
    <p class="missions-sub">${left ? `${left} to go` : "All done for today"} · New missions in ${picksCountdown()}</p>
    ${missionsBlock(e)}
    <p class="missions-note">${e.rerolled ? "You've used today's re-roll." : "One free re-roll a day."} ${together ? "A mission marked <b>With others</b> needs friends; you can swap it for one you can do alone." : "If you've only played alone this week, every mission can be done alone (bots and solo raids count)."}</p>
    ${bonuses(e)}
    <p class="shop-note">${caps} Missions, raids and real matches pay coins; matches against bots count for missions but don't pay coins.</p>
    <p class="missions-shop"><button class="secondary" id="missions-shop">${iconLabel("shop", "Spend coins in the Shop")}</button></p>
    <p class="shop-status" role="status"></p>
  </div>`;
}
