import type { Economy } from "../../../packages/shared/src/shop";
import { buttonIcon } from "./menu-icons";

/**
 * The missions button under the player card in town. Small like the town's
 * MENU button, with a gold "!" while some of today's missions are left. A
 * tap expands today's whole list beside it; the "Daily missions" title in
 * that list opens the full Missions screen. A mission that just finished
 * flashes a short "Mission complete" note. Shown only in town (CSS).
 */
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
/** Missions already seen as done, to flash the ones that just finished. */
let seenDone: Set<string> | undefined;
let seenDay = "";
let flashUntil = 0;
let flashIds = new Set<string>();
let flashTimer: ReturnType<typeof setTimeout> | undefined;
let expanded = false;
let last: { economy: Economy | undefined; open: () => void } | undefined;

type Mission = Economy["missions"][number];
/** Unfinished missions, closest to done first (then in their usual order). */
export function trackedMissions(missions: Mission[], limit = Infinity) {
  return missions
    .filter((m) => !m.done)
    .sort(
      (a, b) =>
        b.progress / b.target - a.progress / a.target || a.slot - b.slot,
    )
    .slice(0, limit);
}
/** The expanded list: what's left (closest to done first), then what's done. */
export function listedMissions(missions: Mission[]) {
  return [
    ...trackedMissions(missions),
    ...missions.filter((m) => m.done).sort((a, b) => a.slot - b.slot),
  ];
}

function setExpanded(next: boolean) {
  if (expanded === next) return;
  expanded = next;
  if (last) syncQuestTracker(last.economy, last.open);
}
// A tap anywhere else, or Escape, folds the list back into the button.
let listening = false;
function listen() {
  if (listening) return;
  listening = true;
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!expanded) return;
      const root = document.getElementById("quest-tracker");
      if (root && !root.contains(e.target as Node)) setExpanded(false);
    },
    true,
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && expanded) setExpanded(false);
  });
}

const row = (m: Mission, fresh: boolean) => {
  const value = Math.min(m.progress, m.target);
  const cls = m.done ? (fresh ? "quest is-done is-complete" : "quest is-done") : "quest";
  const state = m.done
    ? `<span class="quest-check" aria-label="Done">${buttonIcon("check")}</span>`
    : `<span>${value}/${m.target}</span>`;
  return `<li class="${cls}"><span class="quest-text">${escape(m.text)}</span>${m.done ? "" : `<span class="quest-bar" aria-hidden="true"><i style="width:${Math.round((value / m.target) * 100)}%"></i></span>`}<span class="quest-meta">${state}<span class="quest-coins">${buttonIcon("coin")}${m.coins}</span></span></li>`;
};

export function syncQuestTracker(
  economy: Economy | undefined,
  open: () => void,
) {
  last = { economy, open };
  listen();
  let root = document.getElementById("quest-tracker");
  const missions = economy?.missions ?? [];
  if (!missions.length) {
    root?.remove();
    expanded = false;
    return;
  }
  if (!root) {
    root = document.createElement("aside");
    root.id = "quest-tracker";
    root.setAttribute("aria-label", "Daily missions");
    document.body.append(root);
  }
  // Which missions finished since we last looked (not on first load).
  const day = missions[0].day;
  const done = new Set(missions.filter((m) => m.done).map((m) => m.id));
  if (seenDone && seenDay === day) {
    const fresh = [...done].filter((id) => !seenDone!.has(id));
    if (fresh.length) {
      flashIds = new Set(fresh);
      flashUntil = performance.now() + 4500;
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        if (last) syncQuestTracker(last.economy, last.open);
      }, 4600);
    }
  }
  seenDone = done;
  seenDay = day;
  const flashing = performance.now() < flashUntil;

  const finished = done.size,
    total = missions.length,
    allDone = finished === total;
  const toast =
    flashing && !expanded
      ? missions
          .filter((m) => flashIds.has(m.id))
          .map(
            (m) =>
              `<div class="quest-toast" role="status"><span class="quest-done-label">${buttonIcon("check")}Mission complete</span><span class="quest-text">${escape(m.text)}</span><span class="quest-coins">+${m.coins}</span></div>`,
          )
          .join("")
      : "";
  const panel = expanded
    ? `<div class="quest-panel" id="quest-panel"><button type="button" class="quest-title" title="Open daily missions"><span>Daily missions</span><span class="quest-count">${finished}/${total}</span><svg class="quest-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button><ul class="quest-list">${listedMissions(missions)
        .map((m) => row(m, flashing && flashIds.has(m.id)))
        .join("")}</ul>${allDone ? `<p class="quest-all-done">${buttonIcon("check")}All done for today · new missions tomorrow</p>` : ""}</div>`
    : "";
  root.classList.toggle("is-expanded", expanded);
  root.classList.toggle("has-open", !allDone);
  root.innerHTML = `<button type="button" class="quest-toggle" aria-expanded="${expanded}" aria-controls="quest-panel" aria-label="Daily missions: ${finished} of ${total} done">${buttonIcon("missions")}<span>Missions</span>${allDone ? "" : '<span class="quest-alert" aria-hidden="true">!</span>'}</button>${panel}${toast}`;
  root.querySelector<HTMLButtonElement>(".quest-toggle")!.onclick = () =>
    setExpanded(!expanded);
  const title = root.querySelector<HTMLButtonElement>(".quest-title");
  if (title)
    title.onclick = () => {
      expanded = false;
      open();
    };
}
