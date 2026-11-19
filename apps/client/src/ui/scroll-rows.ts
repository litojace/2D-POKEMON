/**
 * Rows that scroll sideways, everywhere in the game: chip and tab rows, the
 * raid gallery on phones, quick chat, the Journey road, the Spire's route…
 *
 * One behaviour for all of them, wired once for the whole page
 * (watchScrollRows, from main.ts):
 * - an edge fades wherever more of the row is hidden past it
 *   (`has-more-left` / `has-more-right`, ui/components.css), so a player
 *   sees there is more to swipe to;
 * - a mouse reaches what they hide: the wheel scrolls them sideways, a press
 *   and drag pans them (the click that ends a drag is not a click). Touch
 *   and trackpads scroll them natively.
 * Their CSS keeps them from scrolling up and down (overflow-y: hidden), so a
 * vertical swipe on one moves the panel around it instead.
 *
 * A new sideways row joins by adding its selector to ROWS, or by carrying
 * `data-h-scroll`. A row that only scrolls sideways on some screens (the raid
 * gallery on phones) is fine: the edges fade only while it overflows.
 */
export const ROWS = [
  "[data-h-scroll]",
  ".ui-chips",
  ".ui-tabs",
  ".rh-grid",
  ".chat-quick",
  ".chat-tabs",
  ".admin-tabs",
  ".journey-road",
  ".sp-route",
].join(",");

const room = (row: HTMLElement) => row.scrollWidth - row.clientWidth;

/** Mark the edges of `row` that have more past them. */
export function fadeRow(row: HTMLElement) {
  const max = room(row);
  // toggle() with the state it already has changes nothing (no mutation).
  row.classList.toggle("has-more-left", max > 1 && row.scrollLeft > 1);
  row.classList.toggle("has-more-right", max > 1 && row.scrollLeft < max - 1);
}

interface Wired {
  stop(): void;
}
const wired = new Map<HTMLElement, Wired>();

/** One row: its fades, wheel and mouse drag. */
function wire(row: HTMLElement): Wired {
  let frame = 0;
  const fade = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => fadeRow(row));
  };
  const onWheel = (event: WheelEvent) => {
    if (event.ctrlKey) return;
    if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    const max = room(row);
    const next = Math.max(0, Math.min(max, row.scrollLeft + event.deltaY));
    // At either end the page (the screen's body) scrolls as usual.
    if (max <= 1 || next === row.scrollLeft) return;
    event.preventDefault();
    row.scrollLeft = next;
  };
  let drag: { x: number; left: number; id: number; moved: boolean } | null =
    null;
  const onDown = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    if (room(row) <= 1) return;
    drag = {
      x: event.clientX,
      left: row.scrollLeft,
      id: event.pointerId,
      moved: false,
    };
  };
  const onMove = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 6) return;
    drag.moved = true;
    row.scrollLeft = drag.left - dx;
  };
  const onUp = () => {
    if (drag?.moved) {
      const swallow = (click: Event) => {
        click.preventDefault();
        click.stopPropagation();
      };
      // The click that ends a drag comes right after this pointerup.
      row.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => row.removeEventListener("click", swallow, true), 0);
    }
    drag = null;
  };
  const onCancel = () => (drag = null);
  row.addEventListener("scroll", fade, { passive: true });
  row.addEventListener("wheel", onWheel, { passive: false });
  row.addEventListener("pointerdown", onDown);
  row.addEventListener("pointermove", onMove);
  row.addEventListener("pointerup", onUp);
  row.addEventListener("pointercancel", onCancel);
  // Its size (shown, hidden, the screen turning) and its content (cards
  // added, a re-render, which patches the markup in place and resets the
  // row's classes, ui/patch.ts) change what is hidden past its edges.
  const sizes = new ResizeObserver(fade);
  sizes.observe(row);
  // The fade's mask keeps the browser from loading lazy pictures just past
  // the row's edge, as it does in a row without one (Chromium: the raid
  // gallery's off-screen cards never loaded, so a swipe showed them blank):
  // a picture within one row's width of either edge loads now.
  const nearby = new IntersectionObserver(
    (entries) => {
      for (const e of entries)
        if (e.isIntersecting) {
          (e.target as HTMLImageElement).loading = "eager";
          nearby.unobserve(e.target);
        }
    },
    { root: row, rootMargin: "0px 100% 0px 100%" },
  );
  const watchPictures = () =>
    row
      .querySelectorAll<HTMLImageElement>('img[loading="lazy"]')
      .forEach((img) => nearby.observe(img));
  const changes = new MutationObserver(() => {
    watchPictures();
    fade();
  });
  changes.observe(row, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });
  watchPictures();
  fadeRow(row);
  return {
    stop() {
      cancelAnimationFrame(frame);
      sizes.disconnect();
      changes.disconnect();
      nearby.disconnect();
      row.removeEventListener("scroll", fade);
      row.removeEventListener("wheel", onWheel);
      row.removeEventListener("pointerdown", onDown);
      row.removeEventListener("pointermove", onMove);
      row.removeEventListener("pointerup", onUp);
      row.removeEventListener("pointercancel", onCancel);
    },
  };
}

/** Wire every row in the page now, and each one that appears later. */
export function scanRows(root: ParentNode = document) {
  for (const [row, w] of wired)
    if (!row.isConnected) {
      w.stop();
      wired.delete(row);
    }
  root.querySelectorAll<HTMLElement>(ROWS).forEach((row) => {
    if (!wired.has(row)) wired.set(row, wire(row));
  });
}

export function watchScrollRows() {
  let frame = 0;
  const scan = () => {
    frame = 0;
    // Battles have no sideways rows, and their HUD changes many times a
    // second: no scans there (a battle's rows, if any, are wired after).
    if (document.body.classList.contains("battle-active")) return;
    scanRows();
  };
  const later = () => {
    if (!frame) frame = requestAnimationFrame(scan);
  };
  new MutationObserver(later).observe(document.body, {
    childList: true,
    subtree: true,
  });
  scanRows();
}
