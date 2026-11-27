/**
 * The window's size for code that runs every frame.
 *
 * Reading `innerWidth` or `innerHeight` makes the browser bring the page's
 * styles and layout up to date first. In a battle the HUD has just been
 * written to (cooldowns, nameplates), so a read in the scene's update paid
 * for a whole style recalculation in the middle of every frame, and the
 * frame's own came on top: 340 of the 400 ms the update spent in a 12 s
 * duel, and nearly two recalculations a frame (25 Nov 2026,
 * docs/network-performance.md section 20).
 *
 * The size changes only when the window does, so it is kept: read again on
 * a resize (the extra ones after a phone turns included,
 * orientation-settle.ts) and at most every `MAX_AGE_MS` otherwise, in case
 * a size settled without an event (iPhones after a rotation).
 */
export const MAX_AGE_MS = 250;

let width = 0,
  height = 0,
  readAt = -Infinity,
  watching = false;

function read(now: number) {
  width = window.innerWidth;
  height = window.innerHeight;
  readAt = now;
}
function watch() {
  if (watching) return;
  watching = true;
  const stale = () => (readAt = -Infinity);
  window.addEventListener("resize", stale);
  window.addEventListener("orientationchange", stale);
  window.visualViewport?.addEventListener("resize", stale);
}
function current(now = performance.now()) {
  watch();
  if (now - readAt >= MAX_AGE_MS) read(now);
}
/** The window's inner size, read at most every `MAX_AGE_MS`. */
export function viewportSize(now?: number) {
  current(now);
  return { width, height };
}
/** Wider than tall. */
export function viewportLandscape(now?: number) {
  current(now);
  return width > height;
}
/** The window's inner height. */
export function viewportHeight(now?: number) {
  current(now);
  return height;
}
/** Tests: forget what was read, and which window was listened to. */
export function resetViewportSize() {
  readAt = -Infinity;
  watching = false;
}
