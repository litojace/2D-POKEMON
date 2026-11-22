import { CHARACTERS, type CharacterId } from "@arena/shared";
import { iconLabel, menuIcon } from "./menu-icons";
import { PRACTICE_DPS_WINDOW } from "./practice-meter";
import "./practice-panel.css";

/**
 * Solo test mode's panel: the numbers on top, then the set-up (fighter and
 * three switches, two by two), then Reset and Exit. Laid out to fit a phone
 * held sideways without scrolling (practice-panel.css). The ids are the
 * ones main.ts wires up.
 */
export const PRACTICE_STATS = [
  ["last", "Last hit"],
  ["dps", `DPS ${PRACTICE_DPS_WINDOW}s`],
  ["dealt", "Dealt"],
  ["taken", "Taken"],
  ["skills", "Skills"],
] as const;
export type PracticeStat = (typeof PRACTICE_STATS)[number][0];

/** One switch: a real checkbox (tests and keyboards use it), drawn as a toggle. */
function toggle(id: string, label: string, hint: string) {
  return `<label class="pp-item pp-toggle" for="${id}"><span class="pp-item-text"><b>${label}</b><small>${hint}</small></span><input id="${id}" type="checkbox" role="switch"></label>`;
}

export function practicePanelMarkup(current: CharacterId) {
  const options = Object.values(CHARACTERS)
    .map(
      (c) =>
        `<option value="${c.id}"${current === c.id ? " selected" : ""}>${c.name}</option>`,
    )
    .join("");
  const stats = PRACTICE_STATS.map(
    ([id, label]) =>
      `<span class="pp-stat"><b class="ui-num" id="practice-${id}">0</b><small>${label}</small></span>`,
  ).join("");
  return (
    `<details id="practice-settings" class="practice-settings"><summary>Practice</summary>` +
    `<div class="practice-panel pp" role="group" aria-labelledby="pp-title">` +
    `<header class="pp-head"><span class="pp-title"><span class="pp-icon" aria-hidden="true">${menuIcon("target")}</span><span><b id="pp-title">Solo test</b><small>The target respawns · no XP or rank here</small></span></span><button type="button" class="pp-close" id="practice-close" aria-label="Close Practice">×</button></header>` +
    `<div class="pp-stats" id="practice-stats" role="group" aria-label="Your numbers">${stats}</div>` +
    `<div class="pp-grid">` +
    `<label class="pp-item pp-fighter" for="practice-character"><span class="pp-item-text"><b>Fighter</b><small>Resets the arena</small></span><select id="practice-character">${options}</select></label>` +
    toggle(
      "practice-unlimited",
      "No cooldowns",
      "Skills and ultimate always ready",
    ) +
    toggle(
      "practice-attacks",
      "Target attacks",
      "It fights back and drops ground fire",
    ) +
    toggle("practice-ex", "EX skills", "Skills 1–3 cast as their EX version") +
    `</div>` +
    `<div class="pp-actions"><button type="button" class="secondary btn-secondary" id="practice-reset">${iconLabel("again", "Reset arena")}</button><button type="button" class="quiet leave-button" id="practice-exit">${iconLabel("leave", "Exit test mode")}</button></div>` +
    `</div></details>`
  );
}
