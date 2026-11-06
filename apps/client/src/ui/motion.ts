import { lowGraphics } from "../graphics-quality";

/**
 * UI motion for the hub (the UI remodel's polish pass): screens slide in
 * from the rail and settle, their contents arrive one after another, the
 * Lobby glides aside for a sheet and back, and dialogs pop. Like the hubs of
 * popular games: quick to start, soft to land, never in the way.
 *
 * Rules:
 * - Only `transform` and `opacity` move (the compositor's work, cheap on
 *   phones). Nothing waits on an animation: every change is applied at
 *   once, and the animation only plays from where things were.
 * - Off with the device's reduced-motion setting and on Low graphics.
 * - Web Animations (not CSS keyframes), so the Lobby's "pause under a
 *   screen" rule can't freeze a screen half-way in.
 */
export const uiMotion = () =>
  typeof matchMedia !== "undefined" &&
  !matchMedia("(prefers-reduced-motion: reduce)").matches &&
  !lowGraphics();

/** Quick start, soft landing (ease-out quint), and its mirror for exits. */
export const EASE_OUT = "cubic-bezier(.22,1,.36,1)";
export const EASE_IN = "cubic-bezier(.5,0,.75,0)";
export const DUR = {
  enter: 300,
  leave: 170,
  item: 260,
  stagger: 32,
  glide: 380,
  fade: 220,
} as const;
/** At most this many items arrive one by one; the rest come with the last. */
const STAGGER_MAX = 10;

const animate = (
  el: Element,
  frames: Keyframe[],
  options: KeyframeAnimationOptions,
) => (typeof el.animate === "function" ? el.animate(frames, options) : null);

/** Play `el` in from `from` to where it is now. */
export function enter(
  el: Element,
  from: Keyframe,
  options: KeyframeAnimationOptions = {},
) {
  if (!uiMotion()) return null;
  return animate(el, [from, { opacity: 1, transform: "none" }], {
    duration: DUR.enter,
    easing: EASE_OUT,
    ...options,
  });
}

/** Items arriving one after another: a short rise and fade each. */
export function stagger(
  els: Iterable<Element>,
  options: { delay?: number; rise?: number } = {},
) {
  if (!uiMotion()) return;
  const list = Array.from(els);
  const delay = options.delay ?? 60,
    rise = options.rise ?? 10;
  list.forEach((el, i) =>
    animate(
      el,
      [
        { opacity: 0, transform: `translateY(${rise}px)` },
        { opacity: 1, transform: "none" },
      ],
      {
        duration: DUR.item,
        delay: delay + Math.min(i, STAGGER_MAX) * DUR.stagger,
        easing: EASE_OUT,
        fill: "backwards",
      },
    ),
  );
}

/**
 * Play `el` out to `to`, then resolve. Resolves at once without motion, and
 * never later than the animation's length (a stalled clock can't keep a
 * closed screen on the page).
 */
export function leave(el: Element, to: Keyframe, duration: number = DUR.leave) {
  if (!uiMotion()) return Promise.resolve();
  const a = animate(el, [{ opacity: 1, transform: "none" }, to], {
    duration,
    easing: EASE_IN,
    fill: "forwards",
  });
  if (!a) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, duration + 80);
    a.finished.then(done, done);
  });
}

/** Fade `els` in from transparent (things coming back into view). */
export function fadeIn(els: Iterable<Element>, duration: number = DUR.fade) {
  if (!uiMotion()) return;
  for (const el of els)
    animate(el, [{ opacity: 0 }, { opacity: 1 }], {
      duration,
      easing: EASE_OUT,
    });
}

/**
 * Glide (FLIP): measure `anchor` in each target, make the change, then play
 * each target from where its anchor was to where it is now: moved, and
 * scaled about the anchor's new centre, so a fighter that shrinks into a
 * narrower stage glides and shrinks rather than jumping.
 */
export function glide(
  targets: { el: HTMLElement; anchor?: HTMLElement | null; scale?: boolean }[],
  change: () => void,
) {
  if (!uiMotion()) return change();
  const live = targets.filter((t) => t.el.isConnected);
  const before = live.map((t) => (t.anchor ?? t.el).getBoundingClientRect());
  change();
  live.forEach((t, i) => {
    const a = before[i],
      b = (t.anchor ?? t.el).getBoundingClientRect(),
      box = t.el.getBoundingClientRect();
    if (!a.width || !b.width || !box.width) return;
    const s = t.scale ? a.width / b.width : 1,
      dx = a.left + a.width / 2 - (b.left + b.width / 2),
      dy = a.top + a.height / 2 - (b.top + b.height / 2);
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(s - 1) < 0.01) return;
    const ox = b.left + b.width / 2 - box.left,
      oy = b.top + b.height / 2 - box.top;
    animate(
      t.el,
      [
        {
          transformOrigin: `${ox}px ${oy}px`,
          transform: `translate(${dx}px, ${dy}px) scale(${s})`,
        },
        { transformOrigin: `${ox}px ${oy}px`, transform: "none" },
      ],
      { duration: DUR.glide, easing: EASE_OUT },
    );
  });
}

/**
 * Run `fn` once `el` has finished sliding in (at once if it isn't moving).
 * A screen that redraws itself while its entry plays (fresh records that
 * arrive right after it opens) re-reads and re-lays its whole markup in the
 * middle of the slide, which stutters on a phone (owner, 6 Nov); it waits
 * the few hundred milliseconds instead. Never longer than the entry itself.
 */
export function whenSettled(el: Element, fn: () => void) {
  const moving =
    typeof el.getAnimations === "function"
      ? el.getAnimations().filter((a) => a.playState === "running")
      : [];
  if (!moving.length) return fn();
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    fn();
  };
  const timer = setTimeout(run, DUR.enter + 120);
  void Promise.all(moving.map((a) => a.finished.catch(() => {}))).then(run);
}
