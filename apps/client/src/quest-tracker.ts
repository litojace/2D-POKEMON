import type { Economy } from "../../../packages/shared/src/shop";
import { buttonIcon } from "./menu-icons";

/**
 * The quest tracker under the player card in town, as in most adventure
 * games: today's missions at a glance (the closest to done first), a "!"
 * while some are left, a short "Mission complete" flash when one finishes,
 * and a tap to open the full Missions screen. It shows only in town (CSS)
 * and folds to its header; the choice is kept on this device.
 */
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const FOLD_KEY = "arena-quest-tracker-folded";
const folded = () => {
  try {
    return localStorage.getItem(FOLD_KEY) === "1";
  } catch {
    return false;
  }
};
/** Missions already seen as done, to flash the ones that just finished. */
let seenDone: Set<string> | undefined;
let seenDay = "";
let flashUntil = 0;
let flashIds = new Set<string>();

type Mission = Economy["missions"][number];
/** The missions to list: unfinished ones, closest to done first. */
export function trackedMissions(missions: Mission[], limit: number) {
  return missions
    .filter((m) => !m.done)
    .sort(
      (a, b) =>
        b.progress / b.target - a.progress / a.target || a.slot - b.slot,
    )
    .slice(0, limit);
}

export function syncQuestTracker(
  economy: Economy | undefined,
  open: () => void,
) {
  let root = document.getElementById("quest-tracker");
  const missions = economy?.missions ?? [];
  if (!missions.length) {
    root?.remove();
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
      setTimeout(() => syncQuestTracker(economy, open), 4600);
    }
  }
  seenDone = done;
  seenDay = day;
  const flashing = performance.now() < flashUntil;

  const finished = done.size,
    total = missions.length,
    left = total - finished;
  const isFolded = folded();
  const limit = matchMedia("(max-height: 500px)").matches ? 2 : 3;
  const rows = trackedMissions(missions, limit)
    .map((m) => {
      const value = Math.min(m.progress, m.target);
      return `<li class="quest"><span class="quest-text">${escape(m.text)}</span><span class="quest-bar" aria-hidden="true"><i style="width:${Math.round((value / m.target) * 100)}%"></i></span><span class="quest-meta"><span>${value}/${m.target}</span><span class="quest-coins">${buttonIcon("coin")}${m.coins}</span></span></li>`;
    })
    .join("");
  const flash = flashing
    ? missions
        .filter((m) => flashIds.has(m.id))
        .map(
          (m) =>
            `<li class="quest is-complete" role="status"><span class="quest-done-label">${buttonIcon("check")}Mission complete</span><span class="quest-text">${escape(m.text)}</span><span class="quest-coins">+${m.coins}</span></li>`,
        )
        .join("")
    : "";
  const allDone = left === 0;
  const summary = allDone
    ? `<li class="quest is-all-done"><span class="quest-done-label">${buttonIcon("check")}All done for today</span><span class="quest-text">New missions tomorrow · +50 for finishing them all</span></li>`
    : "";
  root.classList.toggle("is-folded", isFolded);
  root.classList.toggle("has-open", !allDone);
  root.innerHTML = `<div class="quest-head"><button type="button" class="quest-open" aria-label="Open daily missions: ${finished} of ${total} done">${allDone ? "" : '<span class="quest-alert" aria-hidden="true">!</span>'}<span class="quest-icon" aria-hidden="true">${buttonIcon("missions")}</span><span class="quest-title">Daily missions</span><span class="quest-count">${finished}/${total}</span></button><button type="button" class="quest-fold" aria-expanded="${!isFolded}" aria-label="${isFolded ? "Show" : "Hide"} missions">${buttonIcon(isFolded ? "more" : "cancel")}</button></div>${isFolded ? "" : `<ul class="quest-list">${flash}${rows}${summary}</ul>`}`;
  root.querySelector<HTMLButtonElement>(".quest-open")!.onclick = open;
  const list = root.querySelector<HTMLElement>(".quest-list");
  if (list) {
    list.onclick = open;
    list.setAttribute("role", "list");
  }
  root.querySelector<HTMLButtonElement>(".quest-fold")!.onclick = () => {
    try {
      localStorage.setItem(FOLD_KEY, isFolded ? "0" : "1");
    } catch {
      /* Folding still works for this visit. */
    }
    root!.classList.toggle("is-folded", !isFolded);
    syncQuestTracker(economy, open);
  };
}
