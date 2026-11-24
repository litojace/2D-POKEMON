/**
 * Landscape safe areas on iPhones: room for the notch on its own side only.
 *
 * In landscape, iOS reports the same left and right safe-area inset (44–59px)
 * even though the notch or Dynamic Island is on one side only, so the page
 * used to leave that gap on both sides. Here the side away from the notch
 * keeps CORNER_ROOM, room for the screen's rounded corners, and the game
 * gets the rest. Many screens put their HUD right at --safe-* (the hub's
 * header: max(14px, safe area)), so CORNER_ROOM alone must clear a corner:
 * an iPhone's corners are arcs about 55pt across, and at 16px the gear's
 * 44px circle in the top corner came within 4px of the arc and looked cut
 * (seen on an iPhone); at 32px it keeps about 15px.
 *
 * Which side the notch is on comes from `window.orientation`: 90 means the
 * phone was turned counterclockwise, its top (and notch) to the left; -90
 * means clockwise, notch to the right. `screen.orientation.angle` is only a
 * fallback, since iOS 16.4 reported it the wrong way round (WebKit bug
 * 254863).
 *
 * Only the symmetric case is changed: Android reports the cutout's own side
 * already, iPads and desktops report nothing. The new values go inline into
 * --safe-left / --safe-right (ui/tokens.css), which everything reads; when
 * the case no longer applies they are removed again, so the env() defaults
 * come back. Values set there by anything else are never touched.
 */

/** What the side away from the notch keeps (px), for the rounded corners. */
export const CORNER_ROOM = 32;

export type NotchSide = "left" | "right" | null;

/** The notch's side from the screen's rotation, or null if unknown/portrait. */
export function notchSide(
  orientation: number | undefined,
  angle: number | undefined,
): NotchSide {
  const turn =
    typeof orientation === "number"
      ? orientation
      : typeof angle === "number"
        ? angle
        : undefined;
  if (turn === undefined) return null;
  const a = ((Math.round(turn) % 360) + 360) % 360;
  if (a === 90) return "left";
  if (a === 270) return "right";
  return null;
}

/**
 * The insets to use instead of the reported ones, or null to keep those.
 * Only for landscape with equal, non-zero left and right insets.
 */
export function trimmedInsets(
  reported: { left: number; right: number },
  side: NotchSide,
): { left: number; right: number } | null {
  const { left, right } = reported;
  if (!side || left <= CORNER_ROOM || Math.abs(left - right) > 1) return null;
  return side === "left"
    ? { left, right: CORNER_ROOM }
    : { left: CORNER_ROOM, right };
}

let probe: HTMLElement | null = null;
/** The environment's own insets (env()), whatever --safe-* says. */
function reportedInsets() {
  if (!probe) {
    probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText =
      "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
      "padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px)";
    document.body.appendChild(probe);
  }
  const style = getComputedStyle(probe);
  return {
    left: parseFloat(style.paddingLeft) || 0,
    right: parseFloat(style.paddingRight) || 0,
  };
}

/** The values this module last wrote, to tell them from anyone else's. */
let written: { left: string; right: string } | null = null;

/** Re-check and update --safe-left/right; true if they changed. */
export function applyNotchInsets(): boolean {
  if (!document.body) return false;
  const root = document.documentElement.style;
  const ours =
    written !== null &&
    root.getPropertyValue("--safe-left") === written.left &&
    root.getPropertyValue("--safe-right") === written.right;
  // Someone else (a test, a preview page) set the insets: leave them be.
  if (
    !ours &&
    (root.getPropertyValue("--safe-left") ||
      root.getPropertyValue("--safe-right"))
  )
    return false;
  const landscape = innerWidth > innerHeight;
  const next = landscape
    ? trimmedInsets(
        reportedInsets(),
        notchSide(
          (window as Window & { orientation?: number }).orientation,
          screen.orientation?.angle,
        ),
      )
    : null;
  if (!next) {
    if (!ours) return false;
    root.removeProperty("--safe-left");
    root.removeProperty("--safe-right");
    written = null;
    return true;
  }
  const values = { left: `${next.left}px`, right: `${next.right}px` };
  if (ours && values.left === written!.left && values.right === written!.right)
    return false;
  root.setProperty("--safe-left", values.left);
  root.setProperty("--safe-right", values.right);
  written = values;
  return true;
}

export function watchNotchInsets() {
  let busy = false;
  const update = () => {
    if (busy) return;
    if (!applyNotchInsets()) return;
    // Layouts measured in JS (touch controls, HUD) re-measure on resize. A
    // half turn (notch from one side to the other) doesn't change the size,
    // so no real resize comes.
    busy = true;
    try {
      window.dispatchEvent(new Event("resize"));
    } finally {
      busy = false;
    }
  };
  update();
  window.addEventListener("resize", update);
  window.addEventListener("orientationchange", update);
  screen.orientation?.addEventListener("change", update);
  // iOS can report the new rotation a moment after the event.
  window.addEventListener("orientationchange", () => {
    for (const ms of [120, 400, 900]) setTimeout(update, ms);
  });
}
