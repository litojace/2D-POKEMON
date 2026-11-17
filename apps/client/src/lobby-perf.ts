import type { ShopPreviewHandle } from "./shop-preview";
import { isIOSDevice, largeIPad } from "./render-budget";
import { lowGraphics } from "./graphics-quality";
import { PreviewPerf } from "./preview-perf";

/**
 * The Lobby's frame-rate read-out (five taps on Settings → Graphics' title),
 * for a player to screenshot. On an iPhone 17 Pro Max the Lobby's aura
 * turned like a 30 Hz screen and the phone ran hot, while the same preview
 * in the Shop was smooth and a desktop was smooth too (owner, 17 Nov 2026).
 *
 * First screenshots: the browser itself ran its frames at 27 a second
 * ("screen 27 Hz") while our drawing took 1 ms, and switching off the blur,
 * PLAY's animations or the aura changed nothing. So it shows the whole
 * page's frame rate too ("page"), and stays on screen over the Shop and the
 * Wardrobe: if the Shop also runs at 27, iOS is holding the page to 30 (Low
 * Power Mode, a hot phone); if only the Lobby does, the browser spends the
 * frame repainting the Lobby around the fighter.
 *
 * The buttons switch one suspect off at a time, on this device and until the
 * Lobby closes:
 *
 * - Layer: the fighter's canvas on its own compositing layer (lobby.css),
 *   so the browser repaints only the canvas each frame.
 * - Blur: every frosted-glass panel's backdrop blur.
 * - PLAY: the PLAY button's pulsing glow and light sweep.
 * - Aura: the aura under your fighter.
 * - Cap: the preview at every frame the browser offers, 60 or 30 a second.
 */
export interface LobbyPerfHandle {
  close(): void;
}

export function openLobbyPerf(
  layer: HTMLElement,
  rigs: () => (ShopPreviewHandle | undefined)[],
): LobbyPerfHandle {
  const box = document.createElement("div");
  box.className = "lobby-perf";
  box.setAttribute("aria-hidden", "true");
  box.innerHTML = `<pre class="lobby-perf-text"></pre><div class="lobby-perf-buttons">${["layer", "blur", "play", "aura", "cap"].map((k) => `<button type="button" data-perf="${k}"></button>`).join("")}</div>`;
  // On the page, not in the Lobby: it stays over the Shop and the Wardrobe.
  document.body.append(box);
  const text = box.querySelector("pre")!;
  const state = {
    layer: true,
    blur: true,
    play: true,
    aura: true,
    fps: 0 as 0 | 30 | 60,
  };
  const label = () => {
    const set = (key: string, value: string) =>
      (box.querySelector(`[data-perf="${key}"]`)!.textContent = value);
    set("layer", `Layer ${state.layer ? "on" : "off"}`);
    set("blur", `Blur ${state.blur ? "on" : "off"}`);
    set("play", `PLAY fx ${state.play ? "on" : "off"}`);
    set("aura", `Aura ${state.aura ? "on" : "off"}`);
    set("cap", `Cap ${state.fps || "off"}`);
  };
  const apply = () => {
    layer.classList.toggle("perf-no-layer", !state.layer);
    document.body.classList.toggle("perf-no-blur", !state.blur);
    layer.classList.toggle("perf-no-play", !state.play);
    for (const rig of rigs()) rig?.tune({ aura: state.aura, fps: state.fps });
    label();
  };
  box.addEventListener("click", (event) => {
    const key = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-perf]",
    )?.dataset.perf;
    if (key === "layer") state.layer = !state.layer;
    else if (key === "blur") state.blur = !state.blur;
    else if (key === "play") state.play = !state.play;
    else if (key === "aura") state.aura = !state.aura;
    else if (key === "cap")
      state.fps = state.fps === 0 ? 60 : state.fps === 60 ? 30 : 0;
    else return;
    event.stopPropagation();
    apply();
  });
  // The whole page's frames: a loop of its own, only while the read-out is
  // on, doing nothing but note the time.
  const page = new PreviewPerf();
  let frame = requestAnimationFrame(function tick(now) {
    page.frame(now);
    frame = requestAnimationFrame(tick);
  });
  const ios = isIOSDevice();
  const device = `dpr ${devicePixelRatio} ${screen.width}x${screen.height}${ios ? (largeIPad(ios) ? " iPad-L" : " iOS") : ""}${lowGraphics() ? " Low" : ""}`;
  const show = () => {
    // A rig that loaded (or a seat that filled) after a button was pressed.
    if (!state.aura || state.fps)
      for (const r of rigs()) r?.tune({ aura: state.aura, fps: state.fps });
    const hz = page.stats().screenHz || "?";
    const rig = rigs()[0];
    let fighter: string;
    if (layer.classList.contains("is-covered"))
      fighter = "fighter: asleep (a screen is open)";
    else if (!rig) fighter = "fighter: still art (no live rig)";
    else {
      const p = rig.perf();
      // Frames the fighter drew, late ones; our own work per frame (median
      // and slowest); the canvas, its density and texture scale.
      fighter =
        `fighter ${p.fps} fps  late ${Math.round(p.late * 100)}%\n` +
        `ours ${p.stepMs} ms (max ${p.stepMaxMs})\n` +
        `canvas ${p.canvas} @${p.resolution}x tex ${p.textures}x`;
    }
    text.textContent = `page ${hz} Hz\n${fighter}\n${device}`;
  };
  apply();
  show();
  const timer = setInterval(show, 500);
  return {
    close() {
      clearInterval(timer);
      cancelAnimationFrame(frame);
      layer.classList.remove("perf-no-layer", "perf-no-play");
      document.body.classList.remove("perf-no-blur");
      for (const rig of rigs()) rig?.tune({ aura: true, fps: 0 });
      box.remove();
    },
  };
}
