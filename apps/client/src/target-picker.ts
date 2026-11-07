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
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

/** A tap's own click arrives right after its touch; within this window the
 * click repeats the pick the touch already made. */
export const TOUCH_CLICK_MS = 700;

/**
 * Pick on the finger's touch, like the skill buttons: a browser makes a
 * click only from the first finger on the screen, so with a thumb on the
 * joystick (moving) a tap on the row never clicked. A mouse and the
 * keyboard (Enter, Space) still pick by click; a touch's own click is
 * skipped so one tap never picks twice.
 */
export function wirePick(button: HTMLButtonElement, pick: () => void) {
  let touchedAt = -Infinity;
  button.onpointerdown = (event) => {
    if (event.pointerType === "mouse" || button.disabled) return;
    event.preventDefault();
    touchedAt = event.timeStamp;
    pick();
  };
  button.onclick = (event) => {
    if (event.timeStamp - touchedAt < TOUCH_CLICK_MS) return;
    pick();
  };
}

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
    for (const b of Array.from(
      panel.querySelectorAll<HTMLButtonElement>("button"),
    ))
      wirePick(b, () => pick(b.dataset.targetId!));
  }
  for (const b of Array.from(
    panel.querySelectorAll<HTMLButtonElement>("button"),
  )) {
    const e = enemies.find((x) => x.id === b.dataset.targetId);
    const pressed = String(lockedId === b.dataset.targetId);
    if (b.getAttribute("aria-pressed") !== pressed)
      b.setAttribute("aria-pressed", pressed);
    const disabled = !e?.available;
    if (b.disabled !== disabled) b.disabled = disabled;
    const title =
      lockedId === b.dataset.targetId
        ? `Aiming at ${e?.name}. Tap again for automatic aiming.`
        : `Aim at ${e?.name}`;
    if (b.title !== title) b.title = title;
  }
}
