import Phaser from "phaser";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import {
  CHAMPION_SKIN_BY_ID,
  LOOK_ITEM_BY_ID,
} from "../../../packages/shared/src/shop";
import { rigAssets, skinSuffix, type RigAsset } from "./animation/assets";
import { FighterRig } from "./animation/rig";
import { SKINS } from "./animation/cosmetics";
import { drawCollectionAura } from "./skins/collection-fx";
import type { AnimationPose } from "./animation/controller";
import type { SkinLook } from "./creature-design";
import { SHOP_PREVIEW, previewZoom } from "./shop-preview-layout";

let pausedPreference: boolean | undefined;
export interface ShopPreviewHandle {
  (): void;
  update(panel: HTMLElement): void;
}

/** One silent renderer per Shop visit. Keep decoded textures when browsing. */
export function mountShopPreview(initialPanel: HTMLElement): ShopPreviewHandle {
  let panel: HTMLElement;
  let host: HTMLElement;
  let champion: CharacterId;
  let id: string;
  let worn: SkinLook | null;
  let piece: (typeof LOOK_ITEM_BY_ID)[string] | undefined;
  let look = {};
  let action: string;
  let originalLabel: string;
  let toggle: HTMLButtonElement | null;
  let compare: HTMLButtonElement | null;
  let layers: RigAsset[] = [];
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const portraitCover = matchMedia(
    "(orientation: portrait) and (pointer: coarse) and (hover: none)",
  );
  let paused = pausedPreference ?? motion.matches;
  let visible = true;
  let disposed = false;
  let ready = false;
  let dirty = true;
  let drawn = false;
  let clock = 0;
  let cycle = 0;
  let original = false;
  let revision = 0;
  let rig: FighterRig | undefined;
  let game: Phaser.Game | undefined;
  let scene: PreviewScene | undefined;
  let selectionFrame: number | undefined;
  let selectionTask: ReturnType<typeof setTimeout> | undefined;
  const cancelSelection = () => {
    if (selectionFrame !== undefined) cancelAnimationFrame(selectionFrame);
    if (selectionTask !== undefined) clearTimeout(selectionTask);
    selectionFrame = undefined;
    selectionTask = undefined;
  };
  // Bounded to eight complete looks, including originals. No catalog-sized
  // texture cache, and all of it is released when the Shop closes.
  const cached = new Map<string, RigAsset[]>();
  const assets = (skin: SkinLook | null) => {
    const key = champion + skinSuffix(champion, skin);
    const found = cached.get(key);
    cached.delete(key);
    const value = found ?? rigAssets(champion, skin);
    cached.set(key, value);
    return value;
  };
  const syncToggle = () => {
    if (!toggle) return;
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
    if (rig && scene) {
      rig.destroy();
      rig = new FighterRig(scene, champion, layers);
    }
  };
  const onMotion = () => {
    paused = motion.matches;
    pausedPreference = paused;
    dirty = true;
    if (ready) syncToggle();
  };
  motion.addEventListener("change", onMotion);
  const observer = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      dirty = true;
    },
    { threshold: 0 },
  );
  const failed = () => {
    if (disposed) return;
    ready = false;
    host.classList.remove("is-ready");
    if (toggle) {
      toggle.disabled = true;
      toggle.textContent = "Still preview";
    }
    if (compare) compare.disabled = true;
  };
  const updatePanel = (next: HTMLElement) => {
    if (disposed) return;
    revision++;
    cancelSelection();
    panel = next;
    observer.disconnect();
    host = panel.querySelector<HTMLElement>(".shop-live-stage")!;
    observer.observe(host);
    visible = true;
    champion = host.dataset.previewChampion as CharacterId;
    id = host.dataset.previewItem!;
    worn = CHAMPION_SKIN_BY_ID[id]
      ? { skin: id, stage: Number(host.dataset.previewStage) }
      : null;
    piece = LOOK_ITEM_BY_ID[id];
    look = piece ? { [piece.slot]: id } : {};
    action = host.dataset.previewAction!;
    originalLabel = host.getAttribute("aria-label")!;
    toggle = panel.querySelector<HTMLButtonElement>("[data-preview-toggle]");
    compare = panel.querySelector<HTMLButtonElement>("[data-preview-compare]");
    original = false;
    clock = 0;
    cycle = 0;
    ready = false;
    drawn = false;
    dirty = true;
    rig?.destroy();
    rig = undefined;
    if (toggle)
      toggle.onclick = () => {
        paused = !paused;
        pausedPreference = paused;
        dirty = true;
        syncToggle();
      };
    if (compare)
      compare.onclick = () => {
        original = !original;
        compare!.setAttribute("aria-pressed", String(original));
        compare!.textContent = original
          ? "Show selected look"
          : "Compare original";
        host.dataset.original = String(original);
        host.setAttribute(
          "aria-label",
          original
            ? `${CHARACTERS[champion].name} original appearance`
            : originalLabel,
        );
        reset();
      };
    // Frames are static. Keep the renderer available, but outside the DOM.
    if (host.classList.contains("is-frame")) game?.canvas?.remove();
    else {
      if (game?.canvas) {
        host.appendChild(game.canvas);
        // Phaser also keeps its own parent for resize/bounds calculations.
        game.scale.parent = host;
        game.scale.refresh();
      }
      // Let the selected card and matching fallback paint before generating
      // any uncached SVG parts. Rapid taps coalesce into the newest selection.
      if (scene)
        selectionFrame = requestAnimationFrame(() => {
          selectionFrame = undefined;
          selectionTask = setTimeout(() => {
            selectionTask = undefined;
            scene?.select();
          }, 0);
        });
    }
  };
  class PreviewScene extends Phaser.Scene {
    private floor!: Phaser.GameObjects.Graphics;
    private aura!: Phaser.GameObjects.Graphics;
    private loading = false;
    private selection = -1;
    create() {
      if (disposed) return;
      scene = this;
      this.floor = this.add.graphics().setDepth(0);
      this.aura = this.add.graphics().setDepth(1).setScale(1.5);
      this.game.canvas.setAttribute("aria-hidden", "true");
      // Selection may have changed while Phaser was booting.
      if (host.classList.contains("is-frame")) this.game.canvas.remove();
      else {
        host.appendChild(this.game.canvas);
        this.select();
      }
    }
    select() {
      if (
        disposed ||
        this.loading ||
        this.selection === revision ||
        host.classList.contains("is-frame")
      )
        return;
      const selected = (this.selection = revision);
      layers = assets(null);
      const requested = [...layers, ...(worn ? assets(worn) : [])];
      // The previous rig is gone, so no displayed texture can be evicted here.
      while (cached.size > 8) {
        const key = cached.keys().next().value!;
        for (const asset of cached.get(key)!) {
          for (const texture of [
            asset.key,
            ...SKINS.map((skin) => `${skin}:${asset.key}`),
          ])
            if (this.textures.exists(texture)) this.textures.remove(texture);
        }
        cached.delete(key);
      }
      const missing = requested.filter((a) => !this.textures.exists(a.key));
      const complete = () => {
        if (disposed) return;
        if (selected !== revision) {
          this.select();
          return;
        }
        if (requested.some((a) => !this.textures.exists(a.key))) {
          failed();
          return;
        }
        this.floor.clear();
        this.floor.fillStyle(0x040d20, 0.4).fillEllipse(200, 207, 160, 40);
        this.floor
          .lineStyle(1, CHARACTERS[champion].color, 0.3)
          .strokeEllipse(200, 207, 180, 48);
        rig = new FighterRig(this, champion, layers);
        ready = true;
      };
      if (!missing.length) {
        complete();
        return;
      }
      this.loading = true;
      for (const asset of missing)
        this.load.svg(asset.key, asset.url, {
          width: asset.width,
          height: asset.height,
        });
      this.load.once("complete", () => {
        this.loading = false;
        complete();
      });
      this.load.start();
    }
    update(_time: number, delta: number) {
      if (
        !rig ||
        !ready ||
        disposed ||
        !visible ||
        document.hidden ||
        portraitCover.matches ||
        (paused && !dirty)
      )
        return;
      clock += paused ? 0 : Math.min(delta, 50);
      const nextCycle = action === "idle" ? 0 : Math.floor(clock / 4400);
      if (nextCycle !== cycle) {
        rig.controller.reset();
        cycle = nextCycle;
      }
      const t = (clock % 4400) / 1000;
      const { x, y } = SHOP_PREVIEW;
      const pose: AnimationPose = {
        hp: 100,
        speed: 0,
        angle: Math.PI / 2,
        dash: false,
        jump: false,
        skin: original ? null : worn,
        look: original ? {} : look,
        ambient: true,
        greet: action === "entrance" && t < 3.5,
        victory: action === "victory" && t < 3.5,
      };
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
        const selected = revision;
        // Reveal only a fully posed frame belonging to the latest selection.
        this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
          if (disposed || selected !== revision) return;
          host.classList.add("is-ready");
          syncToggle();
        });
      }
      host.dataset.animationTime = String(Math.round(clock));
      dirty = false;
    }
  }
  updatePanel(initialPanel);
  // A static frame can be the first item on reopening the Shop. Boot once;
  // no fighter textures are decoded until an animated item is selected.
  try {
    game = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: host!,
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
  const dispose: ShopPreviewHandle = Object.assign(
    () => {
      disposed = true;
      cancelSelection();
      observer.disconnect();
      motion.removeEventListener("change", onMotion);
      game?.destroy(true);
      cached.clear();
    },
    { update: updatePanel },
  );
  return dispose;
}
