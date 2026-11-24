import { perfMode, setPerfMode } from "./battle-perf";
import { PreviewPerf } from "./preview-perf";
import { isIOSDevice, largeIPad } from "./render-budget";
import {
  AUTO_SLOW_WINDOWS,
  autoLowWhy,
  graphicsSetting,
  lowGraphics,
  type FrameRateProbe,
} from "./graphics-quality";

/**
 * The frame-rate read-out (five taps on Settings → Graphics' title): a small
 * table beside the rail, over every screen (the Lobby, the Plaza, the Shop,
 * a battle), for a player to screenshot. It shows the
 * whole page's frame rate, what the screen underneath adds
 * (`setPerfSource`: the Lobby's fighter, the Plaza's frames
 * and Auto's measuring), the device, and why Auto chose Low if it did. Touches go through
 * it, except its × button, which turns it off. Battles also have their own
 * read-out (perf-overlay.ts).
 *
 * It found the Lobby's 30 Hz aura on an iPhone 17 Pro Max: the page ran at
 * 27 frames a second while our drawing took 1 ms, until the fighter's canvas
 * got its own compositing layer (lobby.css; owner, 17 Nov 2026). Text only,
 * updated twice a second; its own animation loop only notes the time.
 */
let hud: { close(): void } | undefined;
const sources = new Map<string, () => string | undefined>();

/** Lines a screen adds to the table while it shows (it returns undefined
 *  when hidden); `undefined` takes the screen's lines away. */
export function setPerfSource(
  key: string,
  next: (() => string | undefined) | undefined,
) {
  if (next) sources.set(key, next);
  else sources.delete(key);
}

/**
 * A walkable scene's lines (the Plaza): the frames it drew, its
 * canvas, and Auto's measuring ("auto 57 fps", "slow 1/3" while it counts
 * slow windows towards Low; "auto off" when High or Low was picked, or once
 * the scene is Low).
 */
export function sceneLines(
  name: string,
  drawn: PreviewPerf,
  canvas: HTMLCanvasElement,
  probe: FrameRateProbe | undefined,
) {
  const auto = probe
    ? `auto ${probe.lastFps ? `${Math.round(probe.lastFps)} fps` : "measuring"}${probe.slow ? `, slow ${probe.slow}/${AUTO_SLOW_WINDOWS}` : ""}`
    : "auto off";
  return `${name} ${drawn.stats().fps} fps · ${canvas.width}x${canvas.height}\n${auto}`;
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
  // (Low read each time: Settings or Auto can change it while it shows.)
  const device = () =>
    `dpr ${devicePixelRatio} ${screen.width}x${screen.height}${ios ? (largeIPad(ios) ? " iPad-L" : " iOS") : ""}${lowGraphics() ? " Low" : ""}`;
  const show = () => {
    const lines = [`page ${page.stats().screenHz || "?"} Hz`];
    for (const source of sources.values()) {
      try {
        const extra = source();
        if (extra) lines.push(extra);
      } catch {
        /* A screen closing mid-read: its lines are left out. */
      }
    }
    lines.push(device());
    const why = graphicsSetting() === "auto" ? autoLowWhy() : "";
    if (why) lines.push(`Auto Low: ${why}`);
    const value = lines.join("\n");
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
