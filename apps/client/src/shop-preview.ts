import Phaser from "phaser";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import {
  CHAMPION_SKIN_BY_ID,
  LOOK_ITEM_BY_ID,
} from "../../../packages/shared/src/shop";
import { rigAssets } from "./animation/assets";
import { FighterRig } from "./animation/rig";
import { drawCollectionAura } from "./skins/collection-fx";
import type { AnimationPose } from "./animation/controller";
import { SHOP_PREVIEW, previewZoom } from "./shop-preview-layout";

let pausedPreference: boolean | undefined;

/** One small, silent scene using the same layered rig and cosmetic effects as battle. */
export function mountShopPreview(panel: HTMLElement): () => void {
  const host = panel.querySelector<HTMLElement>(".shop-live-stage")!;
  if (host.classList.contains("is-frame")) return () => {};
  const champion = host.dataset.previewChampion as CharacterId;
  const id = host.dataset.previewItem!;
  const skin = CHAMPION_SKIN_BY_ID[id];
  const piece = LOOK_ITEM_BY_ID[id];
  const worn = skin
    ? { skin: id, stage: Number(host.dataset.previewStage) }
    : null;
  const look = piece ? { [piece.slot]: id } : {};
  const layers = rigAssets(champion);
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let paused = pausedPreference ?? motion.matches;
  let visible = true;
  let disposed = false;
  let ready = false;
  let loadFailed = false;
  let dirty = true;
  let drawn = false;
  let clock = 0;
  let cycle = 0;
  let original = false;
  const originalLabel = host.getAttribute("aria-label")!;
  const compare = panel.querySelector<HTMLButtonElement>("[data-preview-compare]");
  const action = host.dataset.previewAction!;
  let angle = Math.PI / 2;
  let rig: FighterRig | undefined;
  let game: Phaser.Game | undefined;
  const toggle = panel.querySelector<HTMLButtonElement>(
    "[data-preview-toggle]",
  )!;
  const syncToggle = () => {
    toggle.disabled = !ready;
    if (compare) compare.disabled = !ready;
    toggle.textContent = paused ? "Play animation" : "Pause animation";
    toggle.setAttribute("aria-label", toggle.textContent);
    toggle.setAttribute("aria-pressed", String(!paused));
    host.dataset.playing = String(!paused);
  };
  const reset = () => {
    clock = 0;
    cycle = -1;
    dirty = true;
    // Recreate only the rig, keeping loaded textures. This clears old trails and
    // entrance/victory state when replaying or choosing a different motion.
    if (rig) {
      const scene = rig.root.scene;
      rig.destroy();
      rig = new FighterRig(scene, champion, layers);
    }
  };
  toggle.onclick = () => {
    paused = !paused;
    pausedPreference = paused;
    dirty = true;
    syncToggle();
  };
  if (compare) compare.onclick = () => {
    original = !original;
    compare.setAttribute("aria-pressed", String(original));
    compare.textContent = original ? "Show selected look" : "Compare original";
    host.dataset.original = String(original);
    host.setAttribute("aria-label", original ? `${CHARACTERS[champion].name} original appearance` : originalLabel);
    reset();
  };
  const angles: Record<string, number> = {
    down: Math.PI / 2,
    left: Math.PI,
    right: 0,
    up: -Math.PI / 2,
  };
  for (const button of Array.from(
    panel.querySelectorAll<HTMLButtonElement>("button[data-preview-facing]"),
  ))
    button.onclick = () => {
      angle = angles[button.dataset.previewFacing!];
      for (const b of Array.from(
        panel.querySelectorAll("[data-preview-facing]"),
      ))
        b.setAttribute("aria-pressed", String(b === button));
      reset();
    };
  const onMotion = () => {
    paused = motion.matches;
    pausedPreference = paused;
    dirty = true;
    syncToggle();
  };
  motion.addEventListener("change", onMotion);
  // No offscreen particle updates; scrolling the catalog doesn't waste battery.
  const observer = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
    },
    { threshold: 0 },
  );
  observer.observe(host);
  const failed = () => {
    if (disposed) return;
    ready = false;
    host.classList.remove("is-ready");
    toggle.disabled = true;
    if (compare) compare.disabled = true;
    toggle.textContent = "Still preview";
  };
  class PreviewScene extends Phaser.Scene {
    private floor!: Phaser.GameObjects.Graphics;
    private aura!: Phaser.GameObjects.Graphics;
    preload() {
      this.load.once("loaderror", () => {
        loadFailed = true;
        failed();
      });
      for (const asset of [
        ...layers,
        ...(worn ? rigAssets(champion, worn) : []),
      ])
        this.load.svg(asset.key, asset.url, {
          width: asset.width,
          height: asset.height,
        });
    }
    create() {
      if (disposed || loadFailed) return;
      this.floor = this.add.graphics().setDepth(0);
      // The spotlit pedestal behind it is CSS (.shop-live-stage); this is its shadow.
      this.floor.fillStyle(0x040d20, 0.4).fillEllipse(200, 207, 160, 40);
      this.floor
        .lineStyle(1, CHARACTERS[champion].color, 0.3)
        .strokeEllipse(200, 207, 180, 48);
      this.aura = this.add.graphics().setDepth(1).setScale(1.5);
      rig = new FighterRig(this, champion, layers);
      ready = true;
      host.querySelector("canvas")?.setAttribute("aria-hidden", "true");
    }
    update(_time: number, delta: number) {
      if (
        !rig ||
        !ready ||
        disposed ||
        !visible ||
        document.hidden ||
        (paused && !dirty)
      )
        return;
      const step = paused ? 0 : Math.min(delta, 50);
      clock += step;
      // Only entrances/finales replay. Resetting idle would snap signature
      // poses (such as Auralynx's meditative float) back to their starting pose.
      const nextCycle = action === "idle" ? 0 : Math.floor(clock / 4400);
      if (nextCycle !== cycle) {
        rig.controller.reset();
        cycle = nextCycle;
      }
      const t = (clock % 4400) / 1000;
      // Stay on the pedestal: breathing, skin details and cosmetic effects
      // animate without walking, dashing or turning away from the chosen view.
      const { x, y } = SHOP_PREVIEW;
      const pose: AnimationPose = {
        hp: 100,
        speed: 0,
        angle,
        dash: false,
        jump: false,
        skin: original ? null : worn,
        look: original ? {} : look,
        ambient: true,
        greet: action === "entrance" && t < 3.5,
        victory: action === "victory" && t < 3.5,
      };
      // Entrances and finales need headroom for fireworks and falling particles.
      this.cameras.main
        .setZoom(previewZoom(action))
        .centerOn(SHOP_PREVIEW.x, SHOP_PREVIEW.cameraY);
      this.aura.clear();
      if (piece?.slot === "aura")
        drawCollectionAura(
          this.aura,
          id,
          x / 1.5,
          (y + 38) / 1.5,
          clock,
          paused,
        );
      rig.root.setScale(SHOP_PREVIEW.scale);
      rig.render(pose, x, y, clock, 1, paused && motion.matches);
      if (!drawn) {
        drawn = true;
        // create() has loaded textures but its canvas is still blank/unposed.
        // Keep the matching static art until this fully posed frame is drawn.
        this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
          if (disposed || loadFailed) return;
          host.classList.add("is-ready");
          syncToggle();
        });
      }
      host.dataset.animationTime = String(Math.round(clock));
      dirty = false;
    }
  }
  try {
    game = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: host,
      width: SHOP_PREVIEW.width,
      height: SHOP_PREVIEW.height,
      transparent: true,
      banner: false,
      audio: { noAudio: true },
      input: { keyboard: false, mouse: false, touch: false, gamepad: false },
      fps: { target: 30, forceSetTimeOut: true },
      scene: PreviewScene,
    });
  } catch {
    failed();
  }
  return () => {
    disposed = true;
    observer.disconnect();
    motion.removeEventListener("change", onMotion);
    game?.destroy(true);
  };
}
