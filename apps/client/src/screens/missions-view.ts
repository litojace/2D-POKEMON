/**
 * Daily missions (UI remodel step 4, docs/ui-remodel/PLAN.md): the hub's
 * first *sheet*, so the Lobby fighter and PLAY stay in view beside it.
 * Markup and rules only (no DOM); screens/missions.ts wires it up.
 *
 * A top line with done / six, the all-six bonus and the changes left; one
 * row per mission (difficulty, progress, coins and XP, then Paid or a change
 * button); the 7-day streak. Payouts are automatic (decision 11): "Paid" is
 * a state, never a Claim button. The countdown is the server's clock.
 */
import {
  COINS,
  DAILY_MISSION_COUNT,
  MISSION_BY_ID,
  type Economy,
} from "../../../../packages/shared/src/shop";
import { missionFeatExamples, missionHelp } from "../mission-help";
import { menuIcon } from "../menu-icons";
import { picksCountdown } from "../shop-ui";
import {
  bar,
  emptyState,
  esc,
  iconButton,
  panelHead,
  price,
  tag,
} from "../ui/components";

/** Days in a streak that pay the streak bonus. */
export const STREAK_DAYS = 7;
/** XP each finished mission adds (the server's mission XP). */
export const MISSION_XP = 50;
const TIER_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard" } as const;

export interface MissionsData {
  economy: Economy | null;
  /** Why missions couldn't load (shown instead of the list). */
  problem?: string;
  /** Not loaded yet. */
  loading?: boolean;
}
export interface MissionsView {
  /** The mission whose "how to complete" is open (its slot), if any. */
  help: number | null;
  /** A change on its way (its slot): every change button waits. */
  busy: number | null;
  /** The last change's answer ("New mission ready." or the server's reason). */
  status: string;
}
export const missionsView = (): MissionsView => ({
  help: null,
  busy: null,
  status: "",
});

/** Older databases keep their one-change limit until migration 023 is applied. */
export function changesLeft(e: Economy) {
  return Math.max(
    0,
    (e.rerollLimit ?? 1) - (e.rerollsUsed ?? (e.rerolled ? 1 : 0)),
  );
}
/**
 * Days lit on the streak track. The streak counts today once every mission
 * is done; until then it runs to yesterday, and a finished week starts the
 * track again.
 */
export function streakLit(e: Economy) {
  const all = e.missions.length > 0 && e.missions.every((m) => m.done);
  return all
    ? e.streak % STREAK_DAYS || (e.streak > 0 ? STREAK_DAYS : 0)
    : e.streak % STREAK_DAYS;
}

function missionRow(
  m: Economy["missions"][number],
  e: Economy,
  view: MissionsView,
) {
  const together = MISSION_BY_ID[m.id]?.solo === false;
  const n = Math.min(m.progress, m.target);
  const open = view.help === m.slot;
  const left = changesLeft(e);
  const side = m.done
    ? `<span class="missions-paid">${menuIcon("check")}<span>Paid</span></span>`
    : left > 0
      ? iconButton(
          "shuffle",
          together
            ? `Swap for a solo mission: ${m.text}`
            : `Change this mission: ${m.text}`,
          {
            class: "missions-change",
            "data-mission-change": m.slot,
            disabled: view.busy !== null,
            "aria-busy": view.busy === m.slot ? "true" : undefined,
          },
        )
      : "<span></span>";
  const examples = missionFeatExamples(m.id);
  // Always in the markup (hidden when closed), so opening it changes one
  // attribute and the row's button keeps focus.
  const guide = `<div class="missions-guide" id="mission-guide-${m.slot}" role="region" aria-label="How to complete: ${esc(m.text)}"${open ? "" : " hidden"}><p>${esc(missionHelp(m.id))}</p>${examples.length ? `<ul>${examples.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}<p class="ui-note">Finish the match or raid to save progress. Solo test mode and attack practice do not count.</p></div>`;
  return `<li class="missions-row${m.done ? " is-done" : ""}" data-tier="${m.tier}" data-mission-slot="${m.slot}"><button type="button" class="missions-main" data-mission-help="${m.slot}" aria-expanded="${open}" aria-controls="mission-guide-${m.slot}" aria-label="${esc(m.text)}: ${n} of ${m.target}. How to complete it"><span class="missions-top"><b>${esc(m.text)}</b><span class="ui-num">${n}/${m.target}</span></span>${bar(n, m.target, { label: `${m.text} progress`, color: m.done ? "var(--ui-ok)" : "var(--tier)" })}<span class="missions-pay"><span class="missions-diff">${TIER_LABEL[m.tier]}</span>${price(m.coins)}<span>+${MISSION_XP} XP</span>${together ? tag("With others") : ""}</span></button>${side}${guide}</li>`;
}

function streak(e: Economy) {
  const lit = streakLit(e);
  const days = Array.from(
    { length: STREAK_DAYS },
    (_, i) =>
      `<i class="${i < lit ? "is-on" : ""}${i === STREAK_DAYS - 1 ? " is-pay" : ""}">${i === STREAK_DAYS - 1 ? `+${COINS.streakBonus}` : ""}</i>`,
  ).join("");
  return `<div class="missions-streak-row"><span class="missions-streak-text"><b>Streak</b> · ${e.streak} day${e.streak === 1 ? "" : "s"}</span><span class="missions-streak-days" role="img" aria-label="${lit} of ${STREAK_DAYS} days toward the +${COINS.streakBonus} streak bonus">${days}</span></div>`;
}

function list(e: Economy, view: MissionsView) {
  const total = e.missions.length;
  const done = e.missions.filter((m) => m.done).length;
  const all = total > 0 && done === total;
  const left = changesLeft(e);
  const limit = e.rerollLimit ?? 1;
  const together = e.missions.some((m) => MISSION_BY_ID[m.id]?.solo === false);
  const summary = `<div class="missions-sum"><span><b class="ui-num">${done}/${total}</b> done · ${all ? `all ${total} paid` : `all ${total}:`} ${price(COINS.allMissionsBonus)}</span><span class="ui-note">${left} change${left === 1 ? "" : "s"} left</span></div>`;
  const rows = `<ul class="missions-list">${e.missions.map((m) => missionRow(m, e, view)).join("")}</ul>`;
  const caps = `Coins today: raid clears ${Math.min(e.today.raidClears, COINS.raidClearsPaidPerDay)}/${COINS.raidClearsPaidPerDay} paid, matches against players ${Math.min(e.today.pvpMatches, COINS.pvpMatchesPaidPerDay)}/${COINS.pvpMatchesPaidPerDay} paid. Matches against bots count for missions but don't pay coins.`;
  const notes = `<p class="ui-note">${all ? "All done for today. " : ""}Coins and XP are added the moment a mission is done. Finish all ${total} every day: the ${STREAK_DAYS}th day pays +${COINS.streakBonus}.</p><p class="ui-note">${limit} free mission change${limit === 1 ? "" : "s"} per day; changing a mission resets its progress. ${together ? "A mission marked With others needs friends: swap it for one you can do alone." : "Tap a mission to see how to complete it."}</p><p class="ui-note">${caps}</p>`;
  return `${summary}${rows}${streak(e)}<p class="ui-note missions-status" role="status">${esc(view.status)}</p>${notes}`;
}

export function missionsMarkup(view: MissionsView, d: MissionsData) {
  const e = d.economy;
  const body = e
    ? e.missions.length
      ? list(e, view)
      : emptyState(
          "No missions yet",
          "Today's missions arrive with your first answer from the server.",
        )
    : d.loading
      ? emptyState("Loading missions", "One moment…")
      : emptyState(
          d.problem ? "Missions aren't available" : "Log in for missions",
          d.problem ||
            `Log in to get ${DAILY_MISSION_COUNT} daily missions that pay coins.`,
        );
  return `<section class="ui-panel ui-sheet missions-sheet" role="dialog" aria-label="Missions">${panelHead("Missions", `Daily · new in ${picksCountdown()}`)}<div class="ui-panel-body missions-body" data-missions-region="body">${body}</div></section>`;
}
