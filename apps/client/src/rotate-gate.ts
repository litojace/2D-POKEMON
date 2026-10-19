import { fullscreenLandscape } from "./orientation";

/**
 * Landscape only on touch devices. The cover itself is pure CSS (it shows in
 * portrait on touch screens, so it appears before any script runs). Here:
 * where the browser can lock orientation (Android Chrome, Edge, Samsung
 * Internet), offer a button that goes fullscreen and turns the game sideways.
 * iPhone and iPad can't be rotated by a web page, so they only see the hint.
 */
export function wireRotateGate() {
  const button = document.getElementById("rotate-gate-lock") as HTMLButtonElement | null;
  if (!button) return;
  const orientation = screen.orientation as (ScreenOrientation & { lock?: unknown }) | undefined;
  const canTry = typeof orientation?.lock === "function" && document.fullscreenEnabled !== false;
  button.hidden = !canTry;
  button.onclick = async () => {
    button.disabled = true;
    const locked = await fullscreenLandscape();
    button.disabled = false;
    // Refused (or nothing changed): the hint stays; turning the phone still works.
    if (!locked) button.hidden = true;
  };
}
