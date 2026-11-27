/**
 * Settings → Reduce motion (owner, 27 Nov 2026): the game's own switch, off
 * by default. Before it, the game followed the device's accessibility
 * setting (`prefers-reduced-motion`), with no way back: a phone with
 * iPhone's Reduce Motion on, often left on for the system's own animations,
 * got a much stiller game without being told (fighters that don't swing
 * their limbs or squash, thinner skill effects, no camera shake, menus that
 * don't move). The owner's rule now: full motion for everyone, whatever the
 * device says, and one switch for players who want less.
 *
 * This is the only place the choice is kept and read:
 * - `reducedMotion()` for code (the battle rig, the effects engine, the
 *   menus' Web Animations);
 * - `<html data-motion="reduced">` for CSS: a rule that used to sit in
 *   `@media (prefers-reduced-motion: reduce)` is written under
 *   `:root[data-motion="reduced"]` (tests/unit/reduced-motion.test.ts fails
 *   on a new media query);
 * - `reducedMotionQuery`, shaped like the media query list it replaces, for
 *   code that listens for the change.
 * Kept on this device only (`ea-reduce-motion`), like Vibration.
 */
const KEY = "ea-reduce-motion";
type Listener = () => void;
const listeners = new Set<Listener>();

function stored() {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false; // No storage: full motion.
  }
}
let on = stored();

function apply() {
  // No page (a unit test, a worker): the code's own reads still follow.
  const root =
    typeof document === "undefined" ? undefined : document.documentElement;
  if (!root?.dataset) return;
  if (on) root.dataset.motion = "reduced";
  else delete root.dataset.motion;
}
apply();

/** Whether the player asked for less motion (never the device's setting). */
export const reducedMotion = () => on;

/**
 * Turn Reduce motion on or off, now and (unless `keep` is false) for the
 * next visits. Everything that listens follows at once.
 */
export function setReducedMotion(value: boolean, keep = true) {
  if (keep)
    try {
      if (value) localStorage.setItem(KEY, "on");
      else localStorage.removeItem(KEY);
    } catch {
      /* Private mode: the switch lasts this visit only. */
    }
  if (value === on) return;
  on = value;
  apply();
  for (const listener of [...listeners]) listener();
}

/**
 * The switch in the shape of the `matchMedia("(prefers-reduced-motion:
 * reduce)")` list it replaces: `.matches`, and "change" listeners.
 */
export const reducedMotionQuery = {
  get matches() {
    return on;
  },
  addEventListener(_type: "change", listener: Listener) {
    listeners.add(listener);
  },
  removeEventListener(_type: "change", listener: Listener) {
    listeners.delete(listener);
  },
};
