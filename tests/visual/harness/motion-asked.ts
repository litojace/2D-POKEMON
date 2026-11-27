// Settings → Reduce motion is the game's own switch (reduced-motion.ts): the
// game no longer follows the device's accessibility setting. The suite's
// specs ask for less motion the way they always have, through the browser
// (`emulateMedia({ reducedMotion: "reduce" })`, a context's
// `reducedMotion`), so here, in the harness only, that request flips the
// switch for the visit (never stored). A spec about the device's setting
// itself sets `window.__deviceMotion = false` before the page loads, and
// then the browser's setting reaches nothing, as for players.
import { setReducedMotion } from "../../../apps/client/src/reduced-motion";

if ((window as { __deviceMotion?: boolean }).__deviceMotion !== false) {
  const device = matchMedia("(prefers-reduced-motion: reduce)");
  const follow = () => setReducedMotion(device.matches, false);
  if (device.matches) follow();
  device.addEventListener("change", follow);
}
