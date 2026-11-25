/**
 * Writes to the battle HUD, many times a second (docs/network-performance.md,
 * section 20). Each keeps the page's style work to the one element that
 * changed:
 *
 * - Nothing is written when the value is the same. Even an unchanged
 *   `hidden` restyles its element, and unchanged text is a new text node.
 * - Text changes in place, in the element's own text node. `textContent =`
 *   takes the old node out and puts a new one in, and Chromium answers any
 *   node going in or out by restyling everything a `:has()` rule could
 *   reach: about 55 elements for each cooldown number, each frame of the
 *   enemy arrow's name (measured 25 Nov 2026).
 */
export function setHudText(element: HTMLElement, value: string) {
  const only = element.firstChild;
  // (3: a text node. No `Node` global where unit tests stand in for the page.)
  if (only && only === element.lastChild && only.nodeType === 3) {
    const text = only as Text;
    if (text.data === value) return;
    // Emptying keeps `:empty` true to the markup: the node goes.
    if (value) text.data = value;
    else text.remove();
    return;
  }
  if (element.textContent !== value) element.textContent = value;
}
export function setHudAttribute(element: Element, name: string, value: string) {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}
export function setHudStyle(element: HTMLElement, name: string, value: string) {
  if (element.style.getPropertyValue(name) !== value)
    element.style.setProperty(name, value);
}
/** `hidden`, written only when it changes. */
export function setHudHidden(element: HTMLElement, hidden: boolean) {
  if (element.hidden !== hidden) element.hidden = hidden;
}
/**
 * A cooldown ring's sweep, in half percents (under 2° of the ring): a long
 * cooldown, or the ultimate's meter, then moves the ring a few times a
 * second, not at every snapshot.
 */
export const sweepPercent = (share: number) =>
  `${Math.round(Math.max(0, Math.min(100, share)) * 2) / 2}%`;
