/**
 * The game is not a page to copy from (owner, 6–7 Nov 2026). A long press
 * on a phone is a game action (hold to harvest or plant many on the Farm,
 * hold to compare in the Shop), and on a computer a drag or a right click
 * shouldn't select text or open the browser's menu. The stylesheet stops
 * text selection, iOS's callout and image dragging (style.css, "Not a page
 * to copy"); this cancels the context menu (a right click, or Android's
 * long-press menu: Copy, Save image, Open in new tab) and dragging a
 * picture, a link or text out of the page. Fields you type in keep their
 * menu (paste a friend code), and the Admin panel can be selected and
 * copied from. The right mouse button still dashes: only the menu is
 * cancelled, not the press.
 */
export const EDITABLE = 'input, textarea, select, [contenteditable="true"]';
/** The Admin panel (the shared dialog holding its tabs): admins copy
 * player ids and report text from it (owner, 7 Nov 2026). */
export const ADMIN = "dialog:has(.admin-tabs)";

/** Cancel this menu or drag? Everywhere but a field you type in and the
 * Admin panel. */
export function blocksMenu(
  target: { closest(selector: string): unknown } | null,
) {
  return !target?.closest(`${EDITABLE}, ${ADMIN}`);
}

let installed = false;

export function guardTouchHold(win: Window = window) {
  if (installed) return;
  installed = true;
  const cancel = (e: Event) => {
    const target = e.target instanceof Element ? e.target : null;
    if (blocksMenu(target)) e.preventDefault();
  };
  win.addEventListener("contextmenu", cancel, { capture: true });
  win.addEventListener("dragstart", cancel, { capture: true });
}
