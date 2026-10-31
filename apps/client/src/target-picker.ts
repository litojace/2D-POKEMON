/**
 * The target row on phones: one button per enemy when there are two or
 * more, so a team fight or free-for-all target can be picked without
 * tapping the fighter itself. The locked one is pressed; pressing it again
 * returns to automatic aiming. Rebuilt only when the enemies change; each
 * frame just updates pressed/disabled states.
 */
export interface PickerEnemy {
  id: string;
  name: string;
  color: string;
  /** Alive and visible: can be aimed at now. */
  available: boolean;
}
const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderTargetPicker(
  frame: HTMLElement,
  show: boolean,
  enemies: PickerEnemy[],
  lockedId: string | undefined,
  pick: (id: string) => void,
) {
  let panel = frame.querySelector<HTMLElement>("#target-picker");
  if (!show || enemies.length < 2) {
    if (panel && !panel.hidden) panel.hidden = true;
    return;
  }
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "target-picker";
    panel.setAttribute("role", "group");
    panel.setAttribute("aria-label", "Choose who to aim at");
    frame.append(panel);
  }
  if (panel.hidden) panel.hidden = false;
  const key = enemies.map((e) => `${e.id}:${e.name}:${e.color}`).join("|");
  if (panel.dataset.enemies !== key) {
    panel.dataset.enemies = key;
    panel.innerHTML = enemies
      .map(
        (e) =>
          `<button type="button" data-target-id="${escape(e.id)}" style="--target-color:${escape(e.color)}" aria-pressed="false"><i aria-hidden="true"></i><span>${escape(e.name)}</span></button>`,
      )
      .join("");
    for (const b of Array.from(panel.querySelectorAll<HTMLButtonElement>("button")))
      b.onclick = () => pick(b.dataset.targetId!);
  }
  for (const b of Array.from(panel.querySelectorAll<HTMLButtonElement>("button"))) {
    const e = enemies.find((x) => x.id === b.dataset.targetId);
    const pressed = String(lockedId === b.dataset.targetId);
    if (b.getAttribute("aria-pressed") !== pressed) b.setAttribute("aria-pressed", pressed);
    const disabled = !e?.available;
    if (b.disabled !== disabled) b.disabled = disabled;
    const title = lockedId === b.dataset.targetId ? `Aiming at ${e?.name}. Tap again for automatic aiming.` : `Aim at ${e?.name}`;
    if (b.title !== title) b.title = title;
  }
}
