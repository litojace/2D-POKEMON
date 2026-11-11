import { isScrollLocked } from "./scroll-lock";

/**
 * Keep a fixed-screen page (the hub: Lobby, Plaza, Farm, Bistro and their
 * panels; a battle) at the top of the window.
 *
 * Those screens are exactly the window and never scroll, but iPhone and
 * iPad Safari still move the page: the on-screen keyboard lifts it to show
 * the field being typed in (a name, a room code, chat) and often leaves it
 * lifted after the keyboard closes, and the toolbars growing or shrinking can
 * nudge it too. Then the whole interface sits too high, panels out of place,
 * with a band of nothing at the bottom, until the page is reloaded (owner's
 * iPad Pro 13" M4 on iPadOS 27, landscape, 11 Nov 2026). `overflow: hidden`
 * on the body does not stop it there.
 *
 * So whenever the page has moved, and no text field is being typed in (the
 * keyboard needs that lift), put it back at the top: after the keyboard
 * closes, after a scroll settles, when the visible area changes size, and
 * when the page is shown again.
 */
export interface PinWindow {
  scrollX: number;
  scrollY: number;
  scrollTo(x: number, y: number): void;
}

/** A field the on-screen keyboard is open for. */
export function typingIn(el: Element | null) {
  if (!el || typeof HTMLElement === "undefined") return false;
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLSelectElement) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  return ![
    "button",
    "checkbox",
    "color",
    "file",
    "hidden",
    "image",
    "radio",
    "range",
    "reset",
    "submit",
  ].includes(el.type);
}

/** The body classes of screens that are exactly the window. */
const FIXED_SCREENS = ["hub-active", "battle-active"];

/**
 * Put a moved fixed-screen page back at the top. Returns true when it did.
 * Leaves it alone while typing, while a dialog has pinned the page
 * (scroll-lock.ts restores its own position), and on pages that scroll.
 */
export function pinScreen(
  win: PinWindow,
  fixedScreen: boolean,
  typing: boolean,
  locked: boolean,
) {
  if (!fixedScreen || typing || locked) return false;
  if (!win.scrollX && !win.scrollY) return false;
  win.scrollTo(0, 0);
  return true;
}

function pinNow() {
  pinScreen(
    window,
    FIXED_SCREENS.some((name) => document.body.classList.contains(name)),
    typingIn(document.activeElement),
    isScrollLocked(),
  );
}

let settle: ReturnType<typeof setTimeout> | undefined;
/** Pin once things have stopped moving (a scroll's momentum, the keyboard). */
function pinSoon(ms = 150) {
  clearTimeout(settle);
  settle = setTimeout(pinNow, ms);
}

export function watchScreenPin() {
  if (typeof window === "undefined") return;
  window.addEventListener("scroll", () => pinSoon(), { passive: true });
  // The keyboard closing: it animates away, and Safari settles the page
  // after it, so look again a little later too.
  document.addEventListener("focusout", () => {
    pinSoon(120);
    setTimeout(pinNow, 600);
  });
  window.visualViewport?.addEventListener("resize", () => pinSoon());
  window.visualViewport?.addEventListener("scroll", () => pinSoon());
  window.addEventListener("resize", () => pinSoon());
  window.addEventListener("pageshow", () => pinSoon(0));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) pinSoon(0);
  });
}
