import type { Snapshot, Fighter } from "@arena/shared";
import {
  DREAM_RUNES,
  DREAM_RUNE_NAMES,
  type DreamRune,
} from "../../../packages/shared/src/raid";
const paths: Record<DreamRune, string> = {
  circle: '<circle cx="12" cy="12" r="7"/>',
  star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L2.2 9.4l6.1-.9Z"/>',
  moon: '<path d="M18.8 16.2A8 8 0 0 1 9 4.1a8 8 0 1 0 9.8 12.1Z"/>',
  wave: '<path d="M3 8q3-4 6 0t6 0 6 0M3 15q3-4 6 0t6 0 6 0"/>',
};
export const runeIcon = (rune: DreamRune) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${paths[rune]}</svg>`;
/** Numeric skill aliases become rune calls only for the active Dreamer. Q/E/R/F still work. */
export function dreamRuneKey(
  state: Snapshot | null | undefined,
  myId: string | null | undefined,
  code: string,
): DreamRune | undefined {
  const r = state?.raid;
  if (
    state?.phase !== "playing" ||
    r?.boss !== "somnara" ||
    !r.dream ||
    r.dream.dreamerId !== myId
  )
    return;
  const index = /^(?:Digit|Numpad)([1-4])$/.exec(code);
  return index ? DREAM_RUNES[Number(index[1]) - 1] : undefined;
}
export function renderSomnaraControls(
  state: Snapshot,
  me: Fighter,
  frame: HTMLElement,
  request: (event: string, data?: unknown) => Promise<unknown>,
) {
  let panel = frame.querySelector<HTMLElement>("#raid-dream-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "raid-dream-panel";
    frame.append(panel);
  }
  const r = state.raid!,
    d = r.dream,
    view = state.raidDream;
  panel.hidden =
    r.boss !== "somnara" ||
    state.phase !== "playing" ||
    !d ||
    me.hp <= 0 ||
    !view ||
    view.id !== d.id;
  if (panel.hidden || !d || !view) return;
  const caller = d.dreamerId === me.id;
  const sleeping = (r.drowsy?.[me.id]?.sleepUntil ?? 0) > state.time;
  const seconds = Math.max(0, Math.ceil(d.until - state.time));
  const key = `${d.id}|${caller}|${view.full}|${view.backwards}|${view.runes.join(",")}`;
  if (panel.dataset.key !== key) {
    panel.dataset.key = key;
    const names = view.runes.map((rune) => DREAM_RUNE_NAMES[rune]).join(", ");
    panel.innerHTML = `<div class="dream-strip"><span>${view.full ? (caller ? "Your dream" : "Revealed dream") : "Lucid hint"}</span><div class="dream-private-runes" aria-label="${view.backwards ? "Read right to left: " : ""}${names}">${view.backwards ? '<b title="Read right to left" aria-hidden="true">←</b>' : ""}${view.runes.map((rune) => `<i data-rune="${rune}">${runeIcon(rune)}</i>`).join("")}</div><b data-dream-seconds aria-label="${seconds} seconds remaining">${seconds}s</b><small data-dream-progress>${d.step}/${d.length}</small></div>${caller ? `<div class="dream-rune-buttons" role="group" aria-label="Call a rune to your team">${DREAM_RUNES.map((rune, i) => `<button type="button" data-raid-rune="${rune}" data-rune="${rune}" aria-label="Call ${DREAM_RUNE_NAMES[rune]} (${i + 1})" title="Call ${DREAM_RUNE_NAMES[rune]} (${i + 1})" ${sleeping ? "disabled" : ""}>${runeIcon(rune)}<kbd>${i + 1}</kbd></button>`).join("")}</div>` : ""}`;
    for (const b of Array.from(
      panel.querySelectorAll<HTMLButtonElement>("[data-raid-rune]"),
    ))
      b.onclick = () => void request("raid-rune", { rune: b.dataset.raidRune });
  }
  // Keep pressed/focused buttons alive across timer and progress updates.
  const timer = panel.querySelector<HTMLElement>("[data-dream-seconds]")!;
  timer.textContent = `${seconds}s`;
  timer.setAttribute("aria-label", `${seconds} seconds remaining`);
  panel.querySelector<HTMLElement>("[data-dream-progress]")!.textContent =
    `${d.step}/${d.length}`;
  for (const b of Array.from(
    panel.querySelectorAll<HTMLButtonElement>("[data-raid-rune]"),
  ))
    b.disabled = sleeping;
}
