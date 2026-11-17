import { perfMode, setPerfMode } from "./battle-perf";
import { PreviewPerf } from "./preview-perf";
import { isIOSDevice, largeIPad } from "./render-budget";
import { lowGraphics } from "./graphics-quality";

/**
 * The frame-rate read-out (five taps on Settings → Graphics' title): a small
 * table beside the rail, over every screen (the Lobby, the Plaza, the Farm,
 * the Bistro, the Shop, a battle), for a player to screenshot. It shows the
 * whole page's frame rate, what the screen underneath adds
 * (`setPerfSource`: the Lobby's fighter) and the device. Touches go through
 * it, except its × button, which turns it off. Battles also have their own
 * read-out (perf-overlay.ts).
 *
 * It found the Lobby's 30 Hz aura on an iPhone 17 Pro Max: the page ran at
 * 27 frames a second while our drawing took 1 ms, until the fighter's canvas
 * got its own compositing layer (lobby.css; owner, 17 Nov 2026). Text only,
 * updated twice a second; its own animation loop only notes the time.
 */
let hud: { close(): void } | undefined;
let source: (() => string | undefined) | undefined;

/** Lines the screen underneath adds to the table (undefined: none). */
export function setPerfSource(next: (() => string | undefined) | undefined) {
  source = next;
}

/** Show or hide the table to match the saved setting. */
export function syncPerfHud() {
  if (perfMode() && !hud) hud = openPerfHud();
  else if (!perfMode() && hud) {
    hud.close();
    hud = undefined;
  }
}

function openPerfHud() {
  const box = document.createElement("div");
  box.className = "perf-hud";
  box.innerHTML = `<pre aria-hidden="true"></pre><button type="button" class="perf-hud-close" aria-label="Turn off the frame rate read-out">×</button>`;
  document.body.append(box);
  const text = box.querySelector("pre")!;
  box.querySelector("button")!.onclick = () => {
    setPerfMode(false);
    syncPerfHud();
  };
  const page = new PreviewPerf();
  let frame = requestAnimationFrame(function tick(now) {
    page.frame(now);
    frame = requestAnimationFrame(tick);
  });
  const ios = isIOSDevice();
  const device = `dpr ${devicePixelRatio} ${screen.width}x${screen.height}${ios ? (largeIPad(ios) ? " iPad-L" : " iOS") : ""}${lowGraphics() ? " Low" : ""}`;
  const show = () => {
    let extra: string | undefined;
    try {
      extra = source?.();
    } catch {
      extra = undefined;
    }
    const value = `page ${page.stats().screenHz || "?"} Hz\n${extra ? `${extra}\n` : ""}${device}`;
    if (text.textContent !== value) text.textContent = value;
  };
  show();
  const timer = setInterval(show, 500);
  return {
    close() {
      clearInterval(timer);
      cancelAnimationFrame(frame);
      box.remove();
    },
  };
}
