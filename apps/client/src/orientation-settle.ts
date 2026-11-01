import { lockedViewport } from "./zoom-guard";

/**
 * Re-measure the game for a while after the phone turns.
 *
 * iPhone and iPad (Safari and home-screen apps) report the new size late
 * after a rotation: the last resize event can still carry the old, portrait
 * numbers, and nothing fires once the real size settles. The town canvas,
 * touch controls and HUD then kept a mixed-up layout until the phone was
 * turned again. A portrait detour can also leave the page zoomed or scrolled.
 *
 * So after each rotation this sends a few extra resize events as the size
 * settles (everything that lays itself out already listens for "resize"),
 * puts a page that cannot scroll back at the top, and undoes a leftover zoom.
 */
export const SETTLE_DELAYS = [60, 180, 400, 800, 1400];

/** Did the screen switch between portrait and landscape? */
export function orientationFlipped(
  before: { width: number; height: number },
  after: { width: number; height: number },
) {
  return before.width > before.height !== after.width > after.height;
}

let timers: ReturnType<typeof setTimeout>[] = [];
let dispatching = false;

function nudge() {
  const root = document.documentElement;
  // A page that cannot scroll (town, lobby, battle) belongs at the top.
  if (
    root.scrollHeight <= root.clientHeight + 1 &&
    root.scrollWidth <= root.clientWidth + 1 &&
    (window.scrollX || window.scrollY)
  )
    window.scrollTo(0, 0);
  // Undo a zoom left over from portrait: briefly cap the scale at 1.
  const scale = window.visualViewport?.scale ?? 1;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (meta && Math.abs(scale - 1) > 0.01) {
    const original = meta.content;
    meta.content = lockedViewport(original);
    setTimeout(() => {
      // A battle's zoom lock may have changed it meanwhile; keep theirs.
      if (meta.content === lockedViewport(original)) meta.content = original;
    }, 350);
  }
  dispatching = true;
  try {
    window.dispatchEvent(new Event("resize"));
  } finally {
    dispatching = false;
  }
}

export function settleAfterRotation() {
  timers.forEach(clearTimeout);
  timers = SETTLE_DELAYS.map((ms) => setTimeout(nudge, ms));
}

export function watchRotation() {
  let last = { width: innerWidth, height: innerHeight };
  const check = () => {
    if (dispatching) return;
    const now = { width: innerWidth, height: innerHeight };
    if (orientationFlipped(last, now)) settleAfterRotation();
    last = now;
  };
  window.addEventListener("resize", check);
  window.visualViewport?.addEventListener("resize", check);
  // These fire even when the reported size has not caught up yet.
  window.addEventListener("orientationchange", settleAfterRotation);
  screen.orientation?.addEventListener("change", settleAfterRotation);
}
