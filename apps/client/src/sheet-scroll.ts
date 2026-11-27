/**
 * The middle of a whole-screen sheet (the results of PvP, a raid or the
 * Spire, and a briefing: match-sheet.css) scrolls by itself when it is
 * taller than the screen, as it is on a phone. Its edges fade where more is
 * hidden past them (`has-more-above` / `has-more-below`, match-sheet.css),
 * as a sideways row's do (ui/scroll-rows.ts): a line cut in half by the
 * foot or the title read as broken, not as more to scroll to (audit A06–A08,
 * 27 Nov 2026).
 *
 * Only the sheet that is up is watched. The overlay writes new markup for
 * each change (overlay.ts), so a new middle replaces the watched one. Its
 * size is read once per scroll frame, and when it or its content resizes
 * (the reward tiles arriving), never every frame of a battle.
 */
const MIDDLE = ".rc-card > .rc-body, .overlay-card > .panel-scroll";

let watched: HTMLElement | null = null;
let sizes: ResizeObserver | null = null;
let frame = 0;

function mark() {
  frame = 0;
  const el = watched;
  if (!el?.isConnected) return;
  const max = el.scrollHeight - el.clientHeight;
  const top = el.scrollTop;
  // toggle() with the state it already has changes nothing (no mutation).
  el.classList.toggle("has-more-above", max > 1 && top > 1);
  el.classList.toggle("has-more-below", max > 1 && top < max - 1);
}
function markSoon() {
  if (!frame) frame = requestAnimationFrame(mark);
}

function stop() {
  watched?.removeEventListener("scroll", markSoon);
  sizes?.disconnect();
  sizes = null;
  watched = null;
}

/** Watch the middle of the sheet `overlay` shows now (none: stop). */
export function watchSheetScroll(overlay: HTMLElement) {
  const middle = overlay.classList.contains("is-sheet")
    ? overlay.querySelector<HTMLElement>(MIDDLE)
    : null;
  if (middle === watched) return;
  stop();
  if (!middle) return;
  watched = middle;
  middle.addEventListener("scroll", markSoon, { passive: true });
  if (typeof ResizeObserver === "function") {
    sizes = new ResizeObserver(markSoon);
    sizes.observe(middle);
    for (const child of Array.from(middle.children)) sizes.observe(child);
  }
  markSoon();
}
