/**
 * On a touch screen a long press is a game action (hold to harvest or plant
 * many on the Farm, hold to compare in the Shop), not a request for the
 * phone's menu. The stylesheet stops text selection and iOS's callout
 * (style.css, "Touch screens"); this cancels the context menu a long press
 * opens on Android (Copy, Save image, Open in new tab) while a finger is
 * down. A mouse's right click and fields you type in keep their menu.
 */
export const EDITABLE = 'input, textarea, select, [contenteditable="true"]';

/** Cancel this context menu? Only from a finger, and not in a text field. */
export function blocksTouchMenu(
  fromTouch: boolean,
  target: { closest(selector: string): unknown } | null,
) {
  return fromTouch && !target?.closest(EDITABLE);
}

let fingers = 0;
let installed = false;

export function guardTouchHold(win: Window = window) {
  if (installed) return;
  installed = true;
  const count = (e: TouchEvent) => {
    fingers = e.touches.length;
  };
  win.addEventListener("touchstart", count, { capture: true, passive: true });
  win.addEventListener("touchend", count, { capture: true, passive: true });
  win.addEventListener("touchcancel", count, { capture: true, passive: true });
  win.addEventListener(
    "contextmenu",
    (e) => {
      // Chrome says which pointer opened the menu; Safari and older Chrome
      // don't, so a finger still on the screen counts as a touch.
      const type = (e as PointerEvent).pointerType;
      const fromTouch = type ? type === "touch" : fingers > 0;
      const target = e.target instanceof Element ? e.target : null;
      if (blocksTouchMenu(fromTouch, target)) e.preventDefault();
    },
    { capture: true },
  );
}
