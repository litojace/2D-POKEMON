/**
 * Freeze the page behind open dialogs (settings, help, controls, sign-in…).
 *
 * `overflow: hidden` alone does not stop touch scrolling on every iOS version,
 * so the page is pinned with `position: fixed` at its current offset and put
 * back at exactly the same scroll position when the dialog closes. The width
 * of a vanished desktop scrollbar is padded back so nothing shifts sideways.
 * The dialog itself still scrolls; `overscroll-behavior: contain` in the
 * stylesheet stops its scroll from chaining to the page.
 */
let locked = false;
let savedY = 0;

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
    const scrollbar = window.innerWidth - root.clientWidth;
    root.classList.add("scroll-locked");
    Object.assign(body.style, {
      position: "fixed",
      top: `-${savedY}px`,
      left: "0",
      right: "0",
      width: "100%",
      paddingRight: scrollbar > 0 ? `${scrollbar}px` : "",
    });
  } else {
    root.classList.remove("scroll-locked");
    for (const prop of [
      "position",
      "top",
      "left",
      "right",
      "width",
      "paddingRight",
    ] as const)
      body.style[prop] = "";
    window.scrollTo(0, savedY);
  }
}

/** Lock while the dialog is open; works for showModal()/close() and Esc. */
export function lockScrollWhileOpen(dialog: HTMLDialogElement) {
  const sync = () => setScrollLock(dialog.open);
  new MutationObserver(sync).observe(dialog, {
    attributes: true,
    attributeFilter: ["open"],
  });
  dialog.addEventListener("close", sync);
  sync();
}
