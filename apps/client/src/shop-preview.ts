import { JOURNEY_ITEM_BY_ID } from "../../../packages/shared/src/journey";
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
import { HOME_PREVIEW, SHOP_PREVIEW, previewZoom } from "./shop-preview-layout";

export type PreviewPlacement = "shop" | "home" | "selection";
export interface ShopPreviewHandle {
  (): void;
  update(panel: HTMLElement, placement?: PreviewPlacement): void;
  suspend(value: boolean): void;
}

/** Shared idle rig for Shop and Home. Keep decoded textures when browsing. */
export function mountShopPreview(
  initialPanel: HTMLElement,
  placement: PreviewPlacement = "shop",
): ShopPreviewHandle {
  let home = placement !== "shop";
  let framing = home ? HOME_PREVIEW : SHOP_PREVIEW;
  let suspended = false;
  let panel: HTMLElement;
  let host: HTMLElement;
  let champion: CharacterId;
  let id: string;
  let worn: SkinLook | null;
  let piece: { slot: string } | undefined;
  let look: NonNullable<AnimationPose["look"]> = {};
  let action: string;
  let originalLabel: string;
  let compare: HTMLButtonElement | null;
  let layers: RigAsset[] = [];
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const portraitCover = matchMedia(
    "(orientation: portrait) and (pointer: coarse) and (hover: none)",
  );
  let paused = motion.matches;
  let visible = true;
  let disposed = false;
  let failedSelection = false;
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
  // texture cache, and all of it is released when the preview is disposed.
  const cached = new Map<string, RigAsset[]>();
  const assets = (skin: SkinLook | null) => {
    const key = champion + skinSuffix(champion, skin);
    const found = cached.get(key);
    cached.delete(key);
    const value = found ?? rigAssets(champion, skin, ["down"]);
    cached.set(key, value);
    return value;
  };
  const syncControls = () => {
    if (compare) compare.disabled = !ready;
    host.dataset.playing = String(!paused);
  };
  const syncLoop = () => {
    if (!game?.isRunning || disposed) return;
    const running =
      visible &&
      !suspended &&
      !document.hidden &&
      !portraitCover.matches &&
      !failedSelection &&
      !host.classList.contains("is-frame") &&
      (!paused || dirty || !drawn);
    host.dataset.rendering = String(running);
    if (running && !game.loop.running) game.loop.wake();
    else if (!running && game.loop.running) game.loop.sleep();
  };
  const reset = () => {
    clock = 0;
    cycle = -1;
    dirty = true;
    if (rig && scene) {
      rig.destroy();
      rig = new FighterRig(scene, champion, layers);
    }
    syncLoop();
  };
  const onMotion = () => {
    paused = motion.matches;
    dirty = true;
    if (ready) syncControls();
    syncLoop();
  };
  motion.addEventListener("change", onMotion);
  portraitCover.addEventListener("change", syncLoop);
  document.addEventListener("visibilitychange", syncLoop);
  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries.find((entry) => entry.target === host);
      if (!entry) return;
      visible = entry.isIntersecting;
      dirty = true;
      syncLoop();
    },
    { threshold: 0 },
  );
  const failed = () => {
    if (disposed) return;
    ready = false;
    failedSelection = true;
    host.classList.remove("is-ready");
    if (compare) compare.disabled = true;
    syncLoop();
  };
  const updatePanel = (next: HTMLElement, nextPlacement = placement) => {
    if (disposed) return;
    placement = nextPlacement;
    home = placement !== "shop";
    framing = home ? HOME_PREVIEW : SHOP_PREVIEW;
    revision++;
    cancelSelection();
    panel = next;
    observer.disconnect();
    host?.classList.remove("is-ready");
    host = panel.querySelector<HTMLElement>(
      placement === "selection"
        ? ".fighter-rig-stage"
        : home
          ? ".home-fighter-art"
          : ".shop-live-stage",
    )!;
    host.classList.remove("is-ready");
    observer.observe(host);
    visible = true;
    champion = host.dataset.previewChampion as CharacterId;
    id = host.dataset.previewItem!;
    worn = CHAMPION_SKIN_BY_ID[id]
      ? { skin: id, stage: Number(host.dataset.previewStage) }
      : null;
    piece = LOOK_ITEM_BY_ID[id] ?? JOURNEY_ITEM_BY_ID[id];
    look =
      home || host.dataset.previewLook !== undefined
        ? JSON.parse(decodeURIComponent(host.dataset.previewLook ?? "%7B%7D"))
        : piece
          ? { [piece.slot]: id }
          : {};
    action = host.dataset.previewAction!;
    originalLabel = host.getAttribute("aria-label")!;
    compare = panel.querySelector<HTMLButtonElement>("[data-preview-compare]");
    original = false;
    clock = 0;
    cycle = 0;
    ready = false;
    failedSelection = false;
    drawn = false;
    dirty = true;
    rig?.destroy();
    rig = undefined;
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
    syncLoop();
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
      this.aura = this.add
        .graphics()
        .setDepth(1)
        .setScale(framing.scale / 1.2);
      this.game.canvas.setAttribute("aria-hidden", "true");
      // Selection may have changed while Phaser was booting.
      if (host.classList.contains("is-frame")) this.game.canvas.remove();
      else {
        host.appendChild(this.game.canvas);
        this.select();
      }
      syncLoop();
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
        if (!home) {
          this.floor.fillStyle(0x040d20, 0.4).fillEllipse(200, 207, 160, 40);
          this.floor
            .lineStyle(1, CHARACTERS[champion].color, 0.3)
            .strokeEllipse(200, 207, 180, 48);
        }
        rig = new FighterRig(this, champion, layers);
        ready = true;
        dirty = true;
        syncLoop();
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
        suspended ||
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
      const { x, y } = framing;
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
        .centerOn(framing.x, framing.cameraY);
      this.aura.clear();
      const auraId = look.aura;
      const auraScale = framing.scale / 1.2;
      if (auraId === "mountain-aura")
        this.aura
          .lineStyle(3, 0xffd28c, 0.7)
          .strokeEllipse(
            x / auraScale,
            (y + (home ? 21 * framing.scale : 38)) / auraScale,
            95,
            45,
          );
      else if (auraId)
        drawCollectionAura(
          this.aura,
          auraId,
          x / auraScale,
          (y + (home ? 21 * framing.scale : 38)) / auraScale,
          clock,
          paused,
        );
      rig.root.setScale(framing.scale);
      rig.render(pose, x, y, clock, 1, paused && motion.matches);
      if (!drawn) {
        drawn = true;
        const selected = revision;
        // Reveal only a fully posed frame belonging to the latest selection.
        this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
          if (disposed || selected !== revision) return;
          host.classList.add("is-ready");
          syncControls();
        });
      }
      host.dataset.animationTime = String(Math.round(clock));
      dirty = false;
      // A still frame needs one complete render, then no timer or canvas work.
      if (paused)
        this.game.events.once(Phaser.Core.Events.POST_RENDER, syncLoop);
    }
  }
  updatePanel(initialPanel);
  // A static frame can be the first item on reopening the Shop. Boot once;
  // no fighter textures are decoded until an animated item is selected.
  try {
    game = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: host!,
      width: framing.width,
      height: framing.height,
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
      host.classList.remove("is-ready");
      cancelSelection();
      observer.disconnect();
      motion.removeEventListener("change", onMotion);
      portraitCover.removeEventListener("change", syncLoop);
      document.removeEventListener("visibilitychange", syncLoop);
      game?.destroy(true);
      // Phaser completes destruction on its next tick, including when asleep.
      if (game?.isRunning && !game.loop.running) game.loop.wake();
      cached.clear();
    },
    {
      update: updatePanel,
      suspend(value: boolean) {
        suspended = value;
        syncLoop();
      },
    },
  );
  return dispose;
}
