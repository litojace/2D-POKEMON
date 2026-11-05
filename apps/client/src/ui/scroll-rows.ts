/**
 * Rows of chips that scroll sideways (`.ui-chips`: fighters, filters,
 * collections) hide their scrollbar, so a mouse had no way to reach what
 * they hide: touch and trackpads scroll them, a wheel and a mouse did not.
 * Inside a hub screen the wheel now scrolls them sideways, a press and drag
 * pans them (the click that ends a drag is not a click), and an edge fades
 * wherever more is hidden past it.
 */
const ROWS = ".ui-chips";
const rowOf = (target: EventTarget | null) =>
  target instanceof Element
    ? (target.closest(ROWS) as HTMLElement | null)
    : null;
const room = (row: HTMLElement) => row.scrollWidth - row.clientWidth;

/** Mark the edges of `row` that have more past them. */
export function fadeRow(row: HTMLElement) {
  const max = room(row);
  row.classList.toggle("has-more-left", max > 1 && row.scrollLeft > 1);
  row.classList.toggle("has-more-right", max > 1 && row.scrollLeft < max - 1);
}

/** Wire every chip row inside `root`, now and as its content changes. */
export function scrollRows(root: HTMLElement) {
  let frame = 0;
  const fadeAll = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() =>
      root.querySelectorAll<HTMLElement>(ROWS).forEach(fadeRow),
    );
  };
  const onScroll = (event: Event) => {
    const row = event.target;
    if (row instanceof HTMLElement && row.matches(ROWS)) fadeRow(row);
  };
  const onWheel = (event: WheelEvent) => {
    const row = rowOf(event.target);
    if (!row || event.ctrlKey) return;
    if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    const max = room(row);
    const next = Math.max(0, Math.min(max, row.scrollLeft + event.deltaY));
    // At either end the page (the screen's body) scrolls as usual.
    if (max <= 1 || next === row.scrollLeft) return;
    event.preventDefault();
    row.scrollLeft = next;
  };
  let drag: {
    row: HTMLElement;
    x: number;
    left: number;
    id: number;
    moved: boolean;
  } | null = null;
  const onDown = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const row = rowOf(event.target);
    if (!row || room(row) <= 1) return;
    drag = {
      row,
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
    drag.row.scrollLeft = drag.left - dx;
  };
  const onUp = () => {
    if (drag?.moved) {
      const row = drag.row;
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
  root.addEventListener("scroll", onScroll, true);
  root.addEventListener("wheel", onWheel, { passive: false });
  root.addEventListener("pointerdown", onDown);
  root.addEventListener("pointermove", onMove);
  root.addEventListener("pointerup", onUp);
  root.addEventListener("pointercancel", onCancel);
  const changes = new MutationObserver(fadeAll);
  // A re-render patches the markup in place (ui/patch.ts), which also
  // resets a row's classes: fade again after any change.
  changes.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });
  const sizes = new ResizeObserver(fadeAll);
  sizes.observe(root);
  fadeAll();
  return () => {
    cancelAnimationFrame(frame);
    changes.disconnect();
    sizes.disconnect();
    root.removeEventListener("scroll", onScroll, true);
    root.removeEventListener("wheel", onWheel);
    root.removeEventListener("pointerdown", onDown);
    root.removeEventListener("pointermove", onMove);
    root.removeEventListener("pointerup", onUp);
    root.removeEventListener("pointercancel", onCancel);
  };
}
