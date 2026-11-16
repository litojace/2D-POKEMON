/**
 * The target portraits on phones: with two or more enemies, a small round
 * portrait per enemy in one straight row just above the combat buttons
 * (lockSlots in mobile-input.ts), like the hero lock of console-style MOBAs. Tap one to
 * aim at it; tap the locked one again for automatic aiming. A tap on the
 * fighter itself on the court still locks it too.
 *
 * Each enemy keeps its slot (fixed display: the same enemy, the same place,
 * for muscle memory), in the scoreboard's order from left to right. With more enemies than slots, the nearest are shown
 * (the locked one always), still in their fixed order, and one off the row
 * comes on only when it is clearly nearer than one in it, so the portraits
 * do not shuffle while fighters walk about. The rest stay a tap away on the
 * court.
 *
 * Rebuilt only when the shown enemies change; each frame just updates
 * pressed/disabled states, and nothing reads layout.
 */
export interface PickerEnemy {
  id: string;
  /** Spoken and in the tooltip; never written on the portrait. */
  name: string;
  color: string;
  /** Alive and visible: can be aimed at now. */
  available: boolean;
  /** The face (an image URL), when there is one. */
  art?: string;
  /** Otherwise a letter or short mark on a coloured disc. */
  glyph?: string;
  /** For the disc's look: a fighter, a body, a lantern, a bubble, a boss. */
  kind?: "fighter" | "shade" | "lantern" | "bubble" | "boss";
  /** From the player, in world units (which to show when slots run out). */
  distance: number;
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
/** How much nearer (world units) an enemy off the row must be to take the
 * place of one in it. */
export const SWAP_MARGIN = 120;

/**
 * Pick on the finger's touch, like the skill buttons: a browser makes a
 * click only from the first finger on the screen, so with a thumb on the
 * joystick (moving) a tap on a portrait never clicked. A mouse and the
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

/**
 * Which enemies get a portrait: all of them when they fit; otherwise the
 * locked one and the nearest, where one already shown keeps its place
 * unless another is SWAP_MARGIN nearer. Returned in the enemies' own
 * (fixed) order.
 */
export function shownEnemies(
  enemies: PickerEnemy[],
  slots: number,
  lockedId: string | undefined,
  shown: ReadonlySet<string> = new Set(),
) {
  if (enemies.length <= slots) return enemies;
  const score = (e: PickerEnemy) =>
    e.id === lockedId
      ? -Infinity
      : e.distance - (shown.has(e.id) ? SWAP_MARGIN : 0);
  const keep = new Set(
    enemies
      .slice()
      .sort((a, b) => score(a) - score(b))
      .slice(0, Math.max(0, slots))
      .map((e) => e.id),
  );
  return enemies.filter((e) => keep.has(e.id));
}

const LANTERN = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6M12 3v2M8 7h8l1 3v7l-1 3H8l-1-3v-7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10c1.6 1.6 1.6 3.6 0 5-1.6-1.4-1.6-3.4 0-5z" fill="currentColor"/></svg>`;

function face(e: PickerEnemy) {
  if (e.art)
    return `<img src="${escape(e.art)}" alt="" draggable="false" decoding="async">`;
  if (e.kind === "lantern")
    return `${LANTERN}${e.glyph ? `<b>${escape(e.glyph)}</b>` : ""}`;
  return `<b>${escape(e.glyph ?? e.name.slice(0, 1))}</b>`;
}

let lastShown = new Set<string>();

export function renderTargetPicker(
  host: HTMLElement,
  show: boolean,
  enemies: PickerEnemy[],
  lockedId: string | undefined,
  slots: number,
  pick: (id: string) => void,
) {
  let panel = host.querySelector<HTMLElement>("#target-picker");
  if (!show || enemies.length < 2 || slots < 1) {
    if (panel && !panel.hidden) {
      panel.hidden = true;
      panel.dataset.enemies = "";
      lastShown = new Set();
    }
    return;
  }
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "target-picker";
    panel.setAttribute("role", "group");
    panel.setAttribute("aria-label", "Choose who to aim at");
    host.append(panel);
  }
  if (panel.hidden) panel.hidden = false;
  const shown = shownEnemies(enemies, slots, lockedId, lastShown);
  const key = shown
    .map((e) => `${e.id}:${e.name}:${e.color}:${e.art ?? e.glyph ?? ""}`)
    .join("|");
  if (panel.dataset.enemies !== key) {
    panel.dataset.enemies = key;
    lastShown = new Set(shown.map((e) => e.id));
    panel.innerHTML = shown
      .map(
        (e, i) =>
          // Read left to right in the enemies' order (the scoreboard's), on
          // the rightmost slots: slot 0 is the row's right end.
          `<button type="button" data-target-id="${escape(e.id)}" data-slot="${shown.length - 1 - i}" data-kind="${e.kind ?? "fighter"}" style="--target-color:${escape(e.color)}" aria-pressed="false" aria-label="${escape(e.name)}"><span class="target-face">${face(e)}</span></button>`,
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
    const e = shown.find((x) => x.id === b.dataset.targetId);
    const locked = lockedId === b.dataset.targetId;
    const pressed = String(locked);
    if (b.getAttribute("aria-pressed") !== pressed)
      b.setAttribute("aria-pressed", pressed);
    const disabled = !e?.available;
    if (b.disabled !== disabled) b.disabled = disabled;
    const title = locked
      ? `Aiming at ${e?.name}. Tap again for automatic aiming.`
      : `Aim at ${e?.name}`;
    if (b.title !== title) b.title = title;
  }
}
