import type { ShopPreviewHandle } from "./shop-preview";
import { isIOSDevice, largeIPad } from "./render-budget";
import { lowGraphics } from "./graphics-quality";

/**
 * The Lobby's frame-rate read-out (Settings → Graphics → "Show frame rate"),
 * for a player to screenshot. On an iPhone 17 Pro Max the Lobby's aura
 * turned like a 30 Hz screen and the phone ran hot, while the same preview
 * in the Shop was smooth and a desktop was smooth too (owner, 17 Nov 2026).
 * The numbers (preview-perf.ts) say whether the time goes to our own drawing
 * or to the browser; the buttons switch one suspect off at a time, on this
 * device and until the Lobby closes:
 *
 * - Blur: every frosted-glass panel's backdrop blur (the rail, the cards,
 *   the mode button, the chat button).
 * - PLAY: the PLAY button's pulsing glow and light sweep.
 * - Aura: the aura under your fighter.
 * - Cap: the preview at every frame the browser offers, 60 or 30 a second.
 *
 * Text only, updated twice a second (no animation loop of its own).
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
  box.innerHTML = `<pre class="lobby-perf-text" aria-live="off"></pre><div class="lobby-perf-buttons"><button type="button" data-perf="blur"></button><button type="button" data-perf="play"></button><button type="button" data-perf="aura"></button><button type="button" data-perf="cap"></button></div>`;
  layer.append(box);
  const text = box.querySelector("pre")!;
  const state = { blur: true, play: true, aura: true, fps: 0 as 0 | 30 | 60 };
  const label = () => {
    const set = (key: string, value: string) =>
      (box.querySelector(`[data-perf="${key}"]`)!.textContent = value);
    set("blur", `Blur ${state.blur ? "on" : "off"}`);
    set("play", `PLAY fx ${state.play ? "on" : "off"}`);
    set("aura", `Aura ${state.aura ? "on" : "off"}`);
    set("cap", `Cap ${state.fps || "off"}`);
  };
  const apply = () => {
    document.body.classList.toggle("perf-no-blur", !state.blur);
    layer.classList.toggle("perf-no-play", !state.play);
    for (const rig of rigs()) rig?.tune({ aura: state.aura, fps: state.fps });
    label();
  };
  box.addEventListener("click", (event) => {
    const key = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-perf]",
    )?.dataset.perf;
    if (key === "blur") state.blur = !state.blur;
    else if (key === "play") state.play = !state.play;
    else if (key === "aura") state.aura = !state.aura;
    else if (key === "cap")
      state.fps = state.fps === 0 ? 60 : state.fps === 60 ? 30 : 0;
    else return;
    event.stopPropagation();
    apply();
  });
  const ios = isIOSDevice();
  const device = `dpr ${devicePixelRatio} ${screen.width}x${screen.height}${ios ? (largeIPad(ios) ? " iPad-L" : " iOS") : ""}${lowGraphics() ? " Low" : ""}`;
  const show = () => {
    // A rig that loaded (or a seat that filled) after a button was pressed.
    if (!state.aura || state.fps)
      for (const r of rigs()) r?.tune({ aura: state.aura, fps: state.fps });
    const rig = rigs()[0];
    if (!rig) {
      text.textContent = `${device}\nfighter: still art (no live rig)`;
      return;
    }
    const p = rig.perf();
    // Screen refresh and frames drawn; our own work per frame (median and
    // slowest); late frames; the canvas, its density and texture scale.
    text.textContent =
      `screen ${p.screenHz || "?"} Hz  drawn ${p.fps} fps  late ${Math.round(p.late * 100)}%\n` +
      `ours ${p.stepMs} ms (max ${p.stepMaxMs})\n` +
      `canvas ${p.canvas} @${p.resolution}x tex ${p.textures}x\n` +
      device;
  };
  apply();
  show();
  const timer = setInterval(show, 500);
  return {
    close() {
      clearInterval(timer);
      document.body.classList.remove("perf-no-blur");
      layer.classList.remove("perf-no-play");
      for (const rig of rigs()) rig?.tune({ aura: true, fps: 0 });
      box.remove();
    },
  };
}
