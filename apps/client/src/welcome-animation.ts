import { WORLD_ART } from "../../../packages/shared/src/world-art";
import Phaser from "phaser";
import { FighterRig } from "./animation/rig";
import { rigAssets } from "./animation/assets";
import { profileViewBox } from "./creature-profile";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import type { Facing } from "./animation/controller";

export interface WelcomeAnimation {
  pause(hidden: boolean): void;
  destroy(): void;
}

/** One small, capped-rate renderer shared by the eight welcome fighters. */
export function mountWelcomeAnimation(camp: HTMLElement): WelcomeAnimation {
  const entries = Array.from(
    camp.querySelectorAll<HTMLElement>("[data-gate-champion]"),
  ).map((element) => ({
    element,
    id: element.dataset.gateChampion as CharacterId,
    dir: (element.dataset.gateView === "back"
      ? "up"
      : element.dataset.gateView) as Exclude<Facing, "down">,
    rig: undefined as FighterRig | undefined,
  }));
  const assets = new Map(
    entries.map((e) => [e.id, rigAssets(e.id, null, ["down", e.dir])]),
  );
  const host = document.createElement("div");
  host.className = "gate-camp-canvas";
  camp.append(host);
  const fire = camp.querySelector<SVGElement>(".gate-campfire > svg")!;
  const defs = fire.querySelector("defs")!.outerHTML;
  const ground = Array.from(fire.children)
    .filter(
      (e) =>
        e.tagName.toLowerCase() === "g" &&
        !e.classList.contains("gate-fire-flames"),
    )
    .map((e) => e.outerHTML)
    .join("");
  const pieces = [
    ground,
    fire.querySelector(".gate-fire-outer")!.outerHTML,
    fire.querySelector(".gate-fire-inner")!.outerHTML,
  ];
  const density = Math.min(1.5, devicePixelRatio || 1);
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let disposed = false,
    hidden = document.hidden,
    ready = false,
    clock = 0,
    needsFrame = true;
  let scene: Camp;
  class Camp extends Phaser.Scene {
    fireImages: Phaser.GameObjects.Image[] = [];
    preload() {
      for (const list of assets.values())
        for (const a of list)
          this.load.svg(a.key, a.url, { width: a.width, height: a.height });
      pieces.forEach((part, i) =>
        this.load.svg(
          `welcome-fire-${i}`,
          "data:image/svg+xml;base64," +
            btoa(
              `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 140">${defs}${part}</svg>`,
            ),
          { width: 120, height: 140 },
        ),
      );
    }
    create() {
      if (disposed) return;
      scene = this;
      this.cameras.main
        .setZoom(density)
        .centerOn(camp.clientWidth / 2, camp.clientHeight / 2);
      for (const e of entries)
        e.rig = new FighterRig(this, e.id, assets.get(e.id)!);
      this.fireImages = pieces.map((_, i) =>
        this.add
          .image(0, 0, `welcome-fire-${i}`)
          .setOrigin(0.5, 1)
          .setDepth(77 + i * 0.01),
      );
      ready = true;
      camp.setAttribute("data-live", "");
      needsFrame = true;
    }
    update(_time: number, delta: number) {
      if (!ready || disposed) return;
      const still = motion.matches;
      if (!needsFrame && (hidden || still)) return;
      clock += still ? 0 : Math.min(delta, 50);
      needsFrame = false;
      const bounds = camp.getBoundingClientRect();
      entries.forEach((e, i) => {
        const r = e.element.getBoundingClientRect();
        const vy = Number(profileViewBox(e.id, e.dir).split(" ")[1]);
        const scale = r.height / ((176 - vy) * 0.5);
        const x = r.x - bounds.x + r.width / 2,
          y = r.bottom - bounds.y - WORLD_ART.fighterFeet * scale;
        e.rig!.root.setScale(scale);
        e.rig!.setDepth(Number(e.element.style.getPropertyValue("--layer")));
        e.rig!.render(
          {
            hp: CHARACTERS[e.id].health,
            speed: 0,
            angle:
              e.dir === "up" ? -Math.PI / 2 : e.dir === "left" ? Math.PI : 0,
            dash: false,
            jump: false,
            ambient: false,
          },
          x,
          y,
          clock + i * 713,
          1,
          still,
        );
      });
      const f = camp
        .querySelector<HTMLElement>(".gate-campfire")!
        .getBoundingClientRect();
      const scale = f.height / 140;
      this.fireImages.forEach((image, i) =>
        image
          .setPosition(f.x - bounds.x + f.width / 2, f.bottom - bounds.y)
          .setScale(
            scale *
              (i && !still
                ? 1 + Math.sin(clock / (i === 1 ? 330 : 230)) * 0.025
                : 1),
            scale *
              (i && !still
                ? 1 + Math.cos(clock / (i === 1 ? 280 : 190)) * 0.035
                : 1),
          ),
      );
      if (still || hidden) this.game.loop.sleep();
    }
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: host,
    transparent: true,
    width: Math.max(1, camp.clientWidth * density),
    height: Math.max(1, camp.clientHeight * density),
    scene: [Camp],
    fps: { target: 30, forceSetTimeOut: true },
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    render: { antialias: true },
    banner: false,
  });
  const refresh = () => {
    if (disposed) return;
    needsFrame = true;
    if (scene)
      game.scale.resize(
        Math.max(1, camp.clientWidth * density),
        Math.max(1, camp.clientHeight * density),
      );
    scene?.cameras.main
      .setZoom(density)
      .centerOn(camp.clientWidth / 2, camp.clientHeight / 2);
    if (!hidden) game.loop.wake();
  };
  const resize = new ResizeObserver(refresh);
  resize.observe(camp);
  motion.addEventListener("change", refresh);
  return {
    pause(value) {
      hidden = value;
      if (ready) {
        if (hidden) game.loop.sleep();
        else refresh();
      }
    },
    destroy() {
      disposed = true;
      resize.disconnect();
      motion.removeEventListener("change", refresh);
      for (const e of entries) e.rig?.destroy();
      game.loop.wake();
      game.destroy(true);
      host.remove();
      camp.removeAttribute("data-live");
    },
  };
}
