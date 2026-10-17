/**
 * Freeze the page behind the Menu dropdown and its dialogs.
 *
 * `overflow: hidden` alone does not stop touch scrolling on every iOS version,
 * so the page is pinned with `position: fixed` at its current offset and put
 * back at exactly the same scroll position when the dialog closes. The width
 * of a vanished desktop scrollbar is reserved so nothing shifts sideways.
 * The dialog itself still scrolls; `overscroll-behavior: contain` in the
 * stylesheet stops its scroll from chaining to the page.
 */
let locked = false;
let savedY = 0;
let savedX = 0;
const properties = ["position", "top", "left", "right", "width"] as const;
let savedStyles: string[] = [];
let savedGutter = "";
let bodyWidthInset = 0;
const resizeLockedPage = () => {
  if (!locked) return;
  document.body.style.width = `${Math.max(0, document.documentElement.clientWidth - bodyWidthInset)}px`;
};

export function isScrollLocked() {
  return locked;
}

export function setScrollLock(on: boolean) {
  if (on === locked || typeof document === "undefined") return;
  locked = on;
  const body = document.body,
    root = document.documentElement;
  if (on) {
    savedY = window.scrollY;
    savedX = window.scrollX;
    savedStyles = properties.map((property) => body.style[property]);
    savedGutter = root.style.scrollbarGutter;
    const scrollbar = window.innerWidth - root.clientWidth;
    const width = body.getBoundingClientRect().width;
    bodyWidthInset = root.clientWidth - width;
    // Keep classic desktop scrollbars' space, including fixed backgrounds.
    if (scrollbar > 0) root.style.scrollbarGutter = "stable";
    root.classList.add("scroll-locked");
    Object.assign(body.style, {
      position: "fixed",
      top: `-${savedY}px`,
      left: `-${savedX}px`,
      right: "auto",
      width: `${width}px`,
    });
    window.addEventListener("resize", resizeLockedPage);
  } else {
    window.removeEventListener("resize", resizeLockedPage);
    root.classList.remove("scroll-locked");
    properties.forEach((property, index) => {
      body.style[property] = savedStyles[index];
    });
    root.style.scrollbarGutter = savedGutter;
    window.scrollTo({ left: savedX, top: savedY, behavior: "instant" });
  }
}

/** Hold one lock until every tracked menu/dialog closes, including Esc. */
export function lockScrollWhileOpen(
  ...panels: (HTMLDialogElement | HTMLDetailsElement)[]
) {
  const sync = () => setScrollLock(panels.some((panel) => panel.open));
  const observer = new MutationObserver(sync);
  panels.forEach((panel) => {
    observer.observe(panel, { attributes: true, attributeFilter: ["open"] });
    panel.addEventListener("close", sync);
    panel.addEventListener("toggle", sync);
  });
  sync();
}
