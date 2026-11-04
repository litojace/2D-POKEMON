import {
  WORLD_ART,
  groundHeight,
} from "../../../packages/shared/src/world-art";
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
import { menuShadow } from "./fighter-art";
import { lowGraphics } from "./graphics-quality";
import type { AnimationPose } from "./animation/controller";
import type { SkinLook } from "./creature-design";
import {
  SELECTION_PREVIEW,
  SHOP_PREVIEW,
  previewZoom,
  shopPreviewZoom,
  previewViewBox,
  previewAuraScale,
  SHOP_SHADOW,
  SHOP_GROUND_FLAT,
} from "./shop-preview-layout";

export type PreviewPlacement = "shop" | "selection";
export interface ShopPreviewHandle {
  (): void;
  update(panel: HTMLElement, placement?: PreviewPlacement): void;
  suspend(value: boolean): void;
  replay(): void;
}

/** Shared idle rig for Shop and Home. Keep decoded textures when browsing. */
export function mountShopPreview(
  initialPanel: HTMLElement,
  placement: PreviewPlacement = "shop",
): ShopPreviewHandle {
  let selection = placement === "selection";
  let framing = selection ? SELECTION_PREVIEW : SHOP_PREVIEW;
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
  let viewportHeight: number = framing.height;
  /**
   * Canvas pixels per framing pixel. The framing is small (400 or 480 px
   * wide) and the canvas is shown much larger on a big stage or a sharp
   * screen, which blurred the fighter. The canvas now draws at the size it
   * is shown times the screen's density, in steps of a quarter, up to
   * 2.5× and about a million pixels; Low graphics stays at 1×. World
   * coordinates don't change: only the camera zooms by this much.
   */
  let resolution = 1;
  const resolutionFor = (height: number) => {
    if (lowGraphics() || typeof window === "undefined") return 1;
    const shown =
      game?.canvas?.getBoundingClientRect().width ||
      host.getBoundingClientRect().width;
    const density = Math.min(window.devicePixelRatio || 1, 3);
    const wanted = (shown * density) / framing.width,
      budget = Math.sqrt(1_000_000 / (framing.width * height));
    return Math.max(1, Math.floor(Math.min(wanted, budget, 2.5) * 4) / 4);
  };
  const cameraZoom = () =>
    selection ? previewZoom(action) : shopPreviewZoom(action, viewportHeight);
  const resizeStage = () => {
    if (
      disposed ||
      !game?.isRunning ||
      !scene ||
      host.classList.contains("is-frame") ||
      host.classList.contains("is-item")
    )
      return;
    const { width, height } = host.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    const nextHeight = selection
      ? framing.height
      : Math.max(1, Math.round((framing.width * height) / width));
    const nextResolution = resolutionFor(nextHeight);
    if (
      viewportHeight !== nextHeight ||
      resolution !== nextResolution ||
      game.scale.width !== Math.round(framing.width * nextResolution)
    ) {
      viewportHeight = nextHeight;
      resolution = nextResolution;
      game.scale.resize(
        Math.round(framing.width * resolution),
        Math.round(viewportHeight * resolution),
      );
    }
    if (!selection)
      host
        .querySelector(".shop-preview-fallback > svg")
        ?.setAttribute("viewBox", previewViewBox(action, viewportHeight));
    scene.paintFloor();
    dirty = true;
    syncLoop();
  };
  const sizeObserver = new ResizeObserver(resizeStage);
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
      !(
        host.classList.contains("is-frame") ||
        host.classList.contains("is-item")
      ) &&
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
      if (visible) resizeStage();
      dirty = true;
      syncLoop();
    },
    { threshold: 0 },
  );
  const failed = () => {
    if (disposed) return;
    ready = false;
    failedSelection = true;
    rig?.destroy();
    rig = undefined;
    scene?.trimCache();
    host.removeAttribute("aria-busy");
    host.classList.remove("is-ready");
    if (compare) compare.disabled = true;
    syncLoop();
  };
  const updatePanel = (next: HTMLElement, nextPlacement = placement) => {
    if (disposed) return;
    // Keep the last fully posed rig visible while the next look decodes. Hiding
    // it first caused a static-art flash on every skin/champion switch.
    const retainPose =
      placement === "shop" &&
      nextPlacement === "shop" &&
      !!rig &&
      !!host?.classList.contains("is-ready");
    const previousChampion = champion,
      previousAction = action;
    placement = nextPlacement;
    selection = placement === "selection";
    framing = selection ? SELECTION_PREVIEW : SHOP_PREVIEW;
    revision++;
    cancelSelection();
    panel = next;
    observer.disconnect();
    sizeObserver.disconnect();
    host?.classList.remove("is-ready");
    host = panel.querySelector<HTMLElement>(
      selection ? ".fighter-rig-stage" : ".shop-live-stage",
    )!;
    host.classList.remove("is-ready");
    observer.observe(host);
    sizeObserver.observe(host);
    visible = true;
    champion = host.dataset.previewChampion as CharacterId;
    id = host.dataset.previewItem!;
    const modelSkin = host.dataset.previewSkin ?? id;
    worn = CHAMPION_SKIN_BY_ID[modelSkin]
      ? { skin: modelSkin, stage: Number(host.dataset.previewStage) }
      : null;
    piece = LOOK_ITEM_BY_ID[id] ?? JOURNEY_ITEM_BY_ID[id];
    look =
      selection || host.dataset.previewLook !== undefined
        ? JSON.parse(decodeURIComponent(host.dataset.previewLook ?? "%7B%7D"))
        : piece
          ? { [piece.slot]: id }
          : {};
    action = host.dataset.previewAction!;
    originalLabel = host.getAttribute("aria-label")!;
    compare = panel.querySelector<HTMLButtonElement>("[data-preview-compare]");
    original = false;
    // Browsing skins on one champion should not restart its idle bob.
    if (
      !retainPose ||
      previousChampion !== champion ||
      previousAction !== action ||
      action !== "idle"
    )
      clock = 0;
    cycle = Math.floor(clock / 4400);
    ready = false;
    failedSelection = false;
    drawn = false;
    dirty = true;
    const showOriginal = (on: boolean, hold: boolean) => {
      if (on === original) return;
      original = on;
      compare!.setAttribute("aria-pressed", String(original));
      if (!hold)
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
    if (compare?.dataset?.previewCompare === "hold") {
      // The fitting room's "Hold to compare": the original look only while
      // the button is held down (pointer, Space or Enter).
      const on = () => showOriginal(true, true),
        off = () => showOriginal(false, true);
      compare.onclick = null;
      compare.onpointerdown = (event) => {
        event.preventDefault();
        compare!.setPointerCapture?.(event.pointerId);
        on();
      };
      compare.onpointerup = compare.onpointercancel = off;
      compare.onlostpointercapture = off;
      compare.onblur = off;
      compare.oncontextmenu = (event) => event.preventDefault();
      compare.onkeydown = (event) => {
        if ((event.key === " " || event.key === "Enter") && !event.repeat) {
          event.preventDefault();
          on();
        }
      };
      compare.onkeyup = (event) => {
        if (event.key === " " || event.key === "Enter") off();
      };
    } else if (compare) compare.onclick = () => showOriginal(!original, false);
    // Item-only effects use their own canvas; retain the fighter renderer
    // asleep, outside the DOM, for switching back to skins or Colors.
    if (
      host.classList.contains("is-frame") ||
      host.classList.contains("is-item")
    ) {
      rig?.destroy();
      rig = undefined;
      host.removeAttribute("aria-busy");
      game?.canvas?.remove();
    } else {
      if (retainPose) host.classList.add("is-ready");
      host.setAttribute("aria-busy", "true");
      if (game?.canvas) {
        host.appendChild(game.canvas);
        // Phaser also keeps its own parent for resize/bounds calculations.
        game.scale.parent = host;
        game.scale.refresh();
        resizeStage();
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
    syncControls();
    syncLoop();
  };
  class PreviewScene extends Phaser.Scene {
    private floor!: Phaser.GameObjects.Graphics;
    private aura!: Phaser.GameObjects.Graphics;
    /** The aura's near items, over the fighter. */
    private auraFront!: Phaser.GameObjects.Graphics;
    private loading = false;
    private selection = -1;
    create() {
      if (disposed) return;
      scene = this;
      this.floor = this.add.graphics().setDepth(0);
      this.aura = this.add
        .graphics()
        .setDepth(1)
        .setScale(previewAuraScale(framing));
      this.auraFront = this.add
        .graphics()
        .setDepth(4)
        .setScale(previewAuraScale(framing));
      this.game.canvas.setAttribute("aria-hidden", "true");
      resizeStage();
      // Selection may have changed while Phaser was booting.
      if (
        host.classList.contains("is-frame") ||
        host.classList.contains("is-item")
      )
        this.game.canvas.remove();
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
        host.classList.contains("is-frame") ||
        host.classList.contains("is-item")
      )
        return;
      const selected = (this.selection = revision);
      layers = assets(null);
      const requested = [...layers, ...(worn ? assets(worn) : [])];
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
        // Only replace the visible rig once the entire selected look is ready.
        rig?.destroy();
        rig = undefined;
        this.trimCache();
        this.paintFloor();
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
    /** A discarded rig no longer pins textures, even if image decoding failed. */
    trimCache() {
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
    }
    paintFloor() {
      this.floor.clear();
      if (selection) return;
      const feet = framing.y + WORLD_ART.fighterFeet * framing.scale;
      const zoom = cameraZoom();
      const worldWidth = framing.width / zoom;
      const top = framing.cameraY - viewportHeight / (2 * zoom);
      // The soft beam enters above the full stage's upper-right corner as a
      // narrow source and widens like a real light cone until it pools on
      // the floor around the fighter's shadow. Each layer is one shape (beam
      // plus the lower half of its pool), so the pool has one even tone;
      // drawn separately, the beam doubled the light above the foot line.
      const source = framing.x + worldWidth * 0.55;
      for (let i = 0; i < 24; i++) {
        const fade = 1 - i / 24;
        const rx = 110 * fade,
          ry = rx * SHOP_GROUND_FLAT;
        const pool: { x: number; y: number }[] = [];
        // The cone's edges land on the pool's widest points (0° and 180°),
        // so the light spreads as wide as the gold pool on the floor.
        for (let a = 0; a <= 180; a += 10)
          pool.push({
            x: framing.x + Math.cos((a * Math.PI) / 180) * rx,
            y: feet + Math.sin((a * Math.PI) / 180) * ry,
          });
        this.floor
          .fillStyle(0xffdc85, 0.028)
          .fillPoints(
            [
              { x: source - worldWidth * 0.045 * fade, y: top - 40 },
              { x: source + worldWidth * 0.045 * fade, y: top - 40 },
              ...pool,
            ],
            true,
          );
      }
      this.floor
        .fillStyle(0x040d20, 0.4)
        .fillEllipse(framing.x, feet, SHOP_SHADOW.width, SHOP_SHADOW.height);
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
        .setZoom(cameraZoom() * resolution)
        .centerOn(framing.x, framing.cameraY);
      this.aura.clear();
      this.auraFront.clear();
      const auraId = look.aura;
      // The aura lies on the fighter's own shadow: same centre, same
      // flatness, a ring a little wider than the shadow.
      let auraScale = previewAuraScale(framing),
        auraX = x,
        auraY = y + WORLD_ART.fighterFeet * framing.scale,
        flat: number = SHOP_GROUND_FLAT,
        lift: number | undefined;
      if (selection) {
        const shadow = menuShadow(champion);
        // SVG frame (-20 -40 240 250) at two canvas pixels per art unit;
        // the ring (about 48 aura units) spans 1.6 times the shadow.
        auraX = (shadow.cx + 20) * 2;
        auraY = (shadow.cy + 40) * 2;
        auraScale = (shadow.rx * 2 * 1.6) / 48;
        flat = shadow.ry / shadow.rx;
        lift = 0;
      }
      this.aura.setScale(auraScale);
      this.auraFront.setScale(auraScale);
      if (auraId)
        drawCollectionAura(
          this.aura,
          auraId,
          auraX / auraScale,
          auraY / auraScale,
          clock,
          paused,
          this.auraFront,
          flat,
          lift,
        );
      // Skin rings (Mythical Awakening) lie on the same floor as the aura.
      rig.groundFlat = flat;
      rig.root.setScale(framing.scale);
      rig.render(pose, x, y, clock, 1, paused && motion.matches);
      if (!drawn) {
        drawn = true;
        const selected = revision;
        // Reveal only a fully posed frame belonging to the latest selection.
        this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
          if (disposed || selected !== revision) return;
          host.classList.add("is-ready");
          host.removeAttribute("aria-busy");
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
      // Paced by the display (requestAnimationFrame). A 30 fps setTimeout
      // clock is not in step with a 60/120 Hz screen: frames were held for
      // uneven times, which reads as a jerky idle. The loop still sleeps
      // whenever the preview is hidden, covered or paused.
      fps: { target: 60, smoothStep: true },
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
      sizeObserver.disconnect();
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
      replay() {
        clock = 0;
        cycle = -1;
        dirty = true;
        rig?.controller.reset();
        syncLoop();
      },
      suspend(value: boolean) {
        suspended = value;
        syncLoop();
      },
    },
  );
  return dispose;
}
