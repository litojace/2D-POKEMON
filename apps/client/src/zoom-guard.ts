/**
 * No accidental zoom during touch battles.
 *
 * Menus keep pinch zoom for accessibility (`touch-action: manipulation`).
 * In a touch battle a second finger landing on the HUD or a screen edge while
 * the thumb holds the joystick reads as a pinch, and two quick taps that miss
 * a button can double-tap-zoom on some iOS versions. While a touch battle is
 * on screen this module:
 *  - adds `zoom-locked` to <html>, which the stylesheet turns into
 *    `touch-action: none` everywhere (scrollable panels keep pan-x/pan-y);
 *  - sets the viewport to maximum-scale=1, user-scalable=no (Android honours
 *    it and snaps an existing zoom back; iOS uses it to reset a zoom);
 *  - cancels Safari's proprietary pinch `gesture*` events, pinch touchmoves
 *    and a second quick tap on non-controls (iOS fallbacks).
 * Everything is undone when the battle ends.
 */
export const LOCKED_VIEWPORT_EXTRA = "maximum-scale=1,user-scalable=no";
const DOUBLE_TAP_MS = 350;

/** Viewport content with zoom locked, keeping the page's own settings. */
export function lockedViewport(content: string) {
  const kept = content
    .split(",")
    .map((part) => part.trim())
    .filter(
      (part) =>
        part && !/^(maximum-scale|minimum-scale|user-scalable)\s*=/i.test(part),
    );
  return [...kept, LOCKED_VIEWPORT_EXTRA].join(",");
}

/** Real controls keep their own quick taps (menu buttons, inputs, sliders). */
export const INTERACTIVE =
  "button, a, input, select, textarea, label, summary, [role='button'], .joystick-area";

/** A second tap within the double-tap window on something that is not a control. */
export function blocksDoubleTap(
  lastTap: number,
  now: number,
  onControl: boolean,
) {
  return !onControl && now - lastTap < DOUBLE_TAP_MS;
}

let locked = false;
let originalViewport: string | null = null;
let lastTap = -Infinity;
const cancel = (e: Event) => {
  if (e.cancelable) e.preventDefault();
};
const onTouchMove = (e: TouchEvent) => {
  // iOS reports pinch scale on touch events; anything but 1 is a zoom.
  const scale = (e as TouchEvent & { scale?: number }).scale;
  if (e.touches.length > 1 && scale !== undefined && scale !== 1) cancel(e);
};
const onTouchEnd = (e: TouchEvent) => {
  const now = e.timeStamp || performance.now();
  const target = e.target instanceof Element ? e.target : null;
  if (blocksDoubleTap(lastTap, now, !!target?.closest(INTERACTIVE))) cancel(e);
  lastTap = now;
};
const passiveOff = { passive: false } as const;

export function setZoomLock(on: boolean) {
  if (on === locked || typeof document === "undefined") return;
  locked = on;
  document.documentElement.classList.toggle("zoom-locked", on);
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (meta) {
    if (on) {
      originalViewport = meta.content;
      meta.content = lockedViewport(meta.content);
    } else if (originalViewport !== null) meta.content = originalViewport;
  }
  const listeners: [string, EventListener][] = [
    ["gesturestart", cancel],
    ["gesturechange", cancel],
    ["gestureend", cancel],
    ["touchmove", onTouchMove as EventListener],
    ["touchend", onTouchEnd as EventListener],
    ["dblclick", cancel],
  ];
  for (const [type, listener] of listeners)
    if (on) document.addEventListener(type, listener, passiveOff);
    else document.removeEventListener(type, listener, passiveOff);
  lastTap = -Infinity;
}

/** Lock while <body> has both `battle-active` and `touch-mode`. */
export function watchBattleZoom(body: HTMLElement = document.body) {
  const sync = () =>
    setZoomLock(
      body.classList.contains("battle-active") &&
        body.classList.contains("touch-mode"),
    );
  new MutationObserver(sync).observe(body, {
    attributes: true,
    attributeFilter: ["class"],
  });
  sync();
}
