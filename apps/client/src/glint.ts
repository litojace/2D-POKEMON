/**
 * The glint on the Lobby's PLAY and the title's "Tap to start" (Poster:
 * themes/poster/lobby.css and screens.css): a hard bar of light crosses the
 * button about every five seconds, for as long as the button is on screen
 * (owner, 27 Nov 2026). It is the second motion in Poster that never ends,
 * beside the title cover's turn (docs/ui-themes.md).
 *
 * It is not a CSS animation that runs for ever: such an animation keeps the
 * browser producing frames through the still part of its keyframes too. A
 * timer puts GLINT_CLASS on the button for one sweep and takes it off again,
 * so between sweeps nothing of the glint animates and a still screen can
 * rest.
 *
 * The timer stops by itself when no watched button shows (the Lobby is
 * covered by a panel, or gone for a battle or the Plaza; the title is gone),
 * while the page is hidden, with the player's Reduce motion and on Low
 * graphics. wakeGlint() starts it again; the module calls it when the page
 * shows again and when either setting changes, and the Lobby when it is
 * uncovered.
 */
import { lowGraphics } from "./graphics-quality";
import { reducedMotion, reducedMotionQuery } from "./reduced-motion";

/** On a button for the length of one sweep; the look animates on it. */
export const GLINT_CLASS = "is-glinting";
/** From one sweep's start to the next. */
export const GLINT_EVERY_MS = 5000;
/** One sweep (the looks' keyframes run this long). */
export const GLINT_SWEEP_MS = 700;
/** From a button showing to its first sweep. */
export const GLINT_FIRST_MS = 900;

interface GlintTarget {
  readonly isConnected: boolean;
  classList: { add(name: string): void; remove(name: string): void };
}
interface Watched {
  el: GlintTarget;
  shown: () => boolean;
}
interface GlintEnv {
  /** Nothing should move now: hidden page, Reduce motion, Low graphics. */
  still: () => boolean;
  setTimeout: (run: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

/** The glint's clock, apart from the page so a test can drive it. */
export function createGlint(env: GlintEnv) {
  const watched = new Set<Watched>();
  let timer: unknown;
  let waiting = false;
  const stop = () => {
    if (waiting) env.clearTimeout(timer);
    waiting = false;
  };
  const sweep = () => {
    waiting = false;
    if (env.still()) return;
    let any = false;
    for (const w of [...watched]) {
      // Its screen was rebuilt (the title, each time it is drawn).
      if (!w.el.isConnected) {
        watched.delete(w);
        continue;
      }
      if (!w.shown()) continue;
      any = true;
      w.el.classList.add(GLINT_CLASS);
      env.setTimeout(
        () => w.el.classList.remove(GLINT_CLASS),
        GLINT_SWEEP_MS + 100,
      );
    }
    // Nothing shown: the clock rests until wake().
    if (!any) return;
    timer = env.setTimeout(sweep, GLINT_EVERY_MS);
    waiting = true;
  };
  const wake = (delay = GLINT_FIRST_MS) => {
    if (waiting || !watched.size || env.still()) return;
    timer = env.setTimeout(sweep, delay);
    waiting = true;
  };
  return {
    /**
     * Glint on `el` while `shown()` holds. Returns the way to stop watching
     * it (a screen's own close).
     */
    watch(el: GlintTarget, shown: () => boolean = () => true) {
      const w = { el, shown };
      watched.add(w);
      wake();
      return () => {
        watched.delete(w);
        el.classList.remove(GLINT_CLASS);
        if (!watched.size) stop();
      };
    },
    wake,
    /** Whether a sweep is on its way (tests, and the frame-cost check). */
    running: () => waiting,
  };
}

const page = typeof document === "undefined" ? undefined : document;
const glint = createGlint({
  still: () => !page || page.hidden || reducedMotion() || lowGraphics(),
  setTimeout: (run, ms) => setTimeout(run, ms),
  clearTimeout: (handle) =>
    clearTimeout(handle as ReturnType<typeof setTimeout>),
});
if (page) {
  const wake = () => glint.wake();
  page.addEventListener("visibilitychange", wake);
  page.addEventListener("ea-graphics-change", wake);
  reducedMotionQuery.addEventListener("change", wake);
}

export const watchGlint = glint.watch;
export const wakeGlint = () => glint.wake();
export const glintRunning = glint.running;
