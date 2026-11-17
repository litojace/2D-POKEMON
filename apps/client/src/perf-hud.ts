import { perfMode } from "./battle-perf";
import { PreviewPerf } from "./preview-perf";

/**
 * The frame-rate line (five taps on Settings → Graphics' title): one line
 * along the top edge, over every screen (the Lobby, the Plaza, the Farm, the
 * Bistro, the Shop, a battle), that ignores touches. It shows the whole
 * page's frame rate, and what the screen underneath adds (`setPerfSource`:
 * the Lobby's fighter). Battles also have their own read-out
 * (perf-overlay.ts).
 *
 * It found the Lobby's 30 Hz aura on an iPhone 17 Pro Max: the page ran at
 * 27 frames a second while our drawing took 1 ms, until the fighter's canvas
 * got its own compositing layer (lobby.css; owner, 17 Nov 2026). Text only,
 * updated twice a second; its own animation loop only notes the time.
 */
let hud: { close(): void } | undefined;
let source: (() => string | undefined) | undefined;

/** What the screen underneath adds to the line (undefined: nothing). */
export function setPerfSource(next: (() => string | undefined) | undefined) {
  source = next;
}

/** Show or hide the line to match the saved setting. */
export function syncPerfHud() {
  if (perfMode() && !hud) hud = openPerfHud();
  else if (!perfMode() && hud) {
    hud.close();
    hud = undefined;
  }
}

function openPerfHud() {
  const line = document.createElement("div");
  line.className = "perf-hud";
  line.setAttribute("aria-hidden", "true");
  document.body.append(line);
  const page = new PreviewPerf();
  let frame = requestAnimationFrame(function tick(now) {
    page.frame(now);
    frame = requestAnimationFrame(tick);
  });
  const show = () => {
    let extra: string | undefined;
    try {
      extra = source?.();
    } catch {
      extra = undefined;
    }
    const text = `${page.stats().screenHz || "?"} Hz${extra ? ` · ${extra}` : ""}`;
    if (line.textContent !== text) line.textContent = text;
  };
  show();
  const timer = setInterval(show, 500);
  return {
    close() {
      clearInterval(timer);
      cancelAnimationFrame(frame);
      line.remove();
    },
  };
}
