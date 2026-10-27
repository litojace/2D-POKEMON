import type Phaser from "phaser";
import type { RaidBossId } from "../../../packages/shared/src/raid-roster";
import frames from "./art/raid-painted-frames.json";
import grumblecrag from "./art/raid-painted-grumblecrag.webp";
import tidewyrm from "./art/raid-painted-tidewyrm.webp";
import gloomshade from "./art/raid-painted-gloomshade.webp";
import somnara from "./art/raid-painted-somnara.webp";
import prismatail from "./art/raid-painted-prismatail.webp";
import emberwing from "./art/raid-painted-emberwing.webp";
import stormTwins from "./art/raid-painted-storm-twins.webp";

export const BOSS_PAINTED_ART: Record<RaidBossId, string> = {
  grumblecrag,
  tidewyrm,
  gloomshade,
  somnara,
  prismatail,
  emberwing,
  "storm-twins": stormTwins,
};
const keyFor = (id: RaidBossId) => `raid-painted-${id}`;
const pending = new WeakMap<Phaser.Scene, Set<RaidBossId>>();
const failed = new WeakMap<Phaser.Scene, Set<RaidBossId>>();
const encounters = new WeakMap<Phaser.Scene, RaidBossId | undefined>();

/** Expeditions replace encounters without destroying ArenaScene. Release the old
 * boss's GPU atlas instead of accumulating all seven on a phone. */
export function retainBossArt(scene: Phaser.Scene, id: RaidBossId | undefined) {
  if (encounters.has(scene) && encounters.get(scene) === id) return;
  if (!encounters.has(scene))
    scene.events.once("shutdown", () => {
      for (const boss of Object.keys(BOSS_PAINTED_ART) as RaidBossId[])
        if (scene.textures.exists(keyFor(boss)))
          scene.textures.remove(keyFor(boss));
      encounters.delete(scene);
      failed.delete(scene);
      pending.delete(scene);
    });
  encounters.set(scene, id);
  for (const boss of Object.keys(BOSS_PAINTED_ART) as RaidBossId[])
    if (boss !== id && scene.textures.exists(keyFor(boss)))
      scene.textures.remove(keyFor(boss));
}

/** Preload only this encounter's atlas, rather than keeping seven bosses in VRAM. */
export function queueBossArt(scene: Phaser.Scene, id: RaidBossId) {
  const key = keyFor(id);
  if (scene.textures.exists(key) || failed.get(scene)?.has(id)) return false;
  let queued = pending.get(scene);
  if (!queued) pending.set(scene, (queued = new Set()));
  if (queued.has(id)) return false;
  queued.add(id);
  const complete = () => {
    queued!.delete(id);
    scene.load.off("loaderror", error);
    if (
      encounters.has(scene) &&
      encounters.get(scene) !== id &&
      scene.textures.exists(key)
    )
      scene.textures.remove(key);
  };
  const error = (file: Phaser.Loader.File) => {
    if (file.key !== key) return;
    complete();
    scene.load.off(`filecomplete-image-${key}`, complete);
    let misses = failed.get(scene);
    if (!misses) failed.set(scene, (misses = new Set()));
    misses.add(id);
  };
  scene.load.once(`filecomplete-image-${key}`, complete);
  scene.load.on("loaderror", error);
  scene.load.image(key, BOSS_PAINTED_ART[id]);
  return true;
}

export interface BossPart {
  name: string;
  art: string;
  x: number;
  y: number;
  width: number;
  ox?: number;
  oy?: number;
  rotation?: number;
  flip?: boolean;
  stretch?: number;
  alpha?: number;
  tint?: number;
}
interface Rig {
  root: Phaser.GameObjects.Container;
  actor: Phaser.GameObjects.Container;
  front: Phaser.GameObjects.Graphics;
  parts: Map<string, Phaser.GameObjects.Image>;
  frame: number;
}
const rigs = new WeakMap<Phaser.GameObjects.Graphics, Map<string, Rig>>();
export interface BossPaint {
  key?: string;
  alpha?: number;
  tint?: number;
  pivot?: { x: number; y: number; sx: number; sy: number };
  front?: (g: Phaser.GameObjects.Graphics) => void;
}

/** Each texture is a complete painted anatomical part with an overlapping joint.
 * No moving masks or bands cut across the head, chest, feathers or fur. */
export function paintBoss(
  g: Phaser.GameObjects.Graphics,
  id: RaidBossId,
  parts: BossPart[],
  options: BossPaint = {},
): boolean {
  const scene = g.scene;
  // Geometry-only tests and a failed/unfinished asset request keep the old painter.
  if (!scene?.sys?.isActive?.()) return false;
  const key = keyFor(id);
  if (!scene.textures.exists(key)) {
    if (queueBossArt(scene, id) && !scene.load.isLoading()) scene.load.start();
    return false;
  }
  const texture = scene.textures.get(key);
  for (const [name, rect] of Object.entries(frames[id])) {
    if (!texture.has(name))
      texture.add(name, 0, ...(rect as [number, number, number, number]));
  }
  let group = rigs.get(g);
  if (!group) rigs.set(g, (group = new Map()));
  const actorKey = `${id}:${options.key ?? "body"}`;
  let rig = group.get(actorKey);
  if (!rig) {
    const actor = scene.add.container();
    const front = scene.add.graphics();
    const root = scene.add
      .container(0, 0, [actor])
      .setName(`painted-boss-${actorKey}`);
    actor.add(front);
    rig = { root, actor, front, parts: new Map(), frame: -1 };
    group.set(actorKey, rig);
    const own = rig;
    const dispose = () => {
      scene.events.off("prerender", sync);
      g.off("destroy", dispose);
      root.destroy();
      group!.delete(actorKey);
    };
    // A disappeared clone, submerged serpent or completed collapse cannot leave
    // a sprite behind after its Graphics layer is cleared on the next frame.
    const sync = () => {
      // Decoy IDs change on each split. Retire their old sprite pools rather
      // than retaining one container and event listener per historical copy.
      if (scene.game.loop.frame - own.frame > 120) {
        dispose();
        return;
      }
      const m = g.getWorldTransformMatrix();
      own.root
        .setPosition(m.tx, m.ty)
        .setRotation(m.rotation)
        .setScale(m.scaleX, m.scaleY)
        .setDepth(g.depth + 0.001)
        .setVisible(
          g.visible && g.active && own.frame === scene.game.loop.frame,
        );
    };
    scene.events.on("prerender", sync);
    g.once("destroy", dispose);
  }
  rig.frame = scene.game.loop.frame;
  // Alpha changes (copy fade / defeat) must be sampled every pose, not captured
  // by the first render listener.
  // Set depth before Systems.render sorts the display list (PRE_RENDER is later).
  rig.root.setDepth(g.depth + 0.001).setAlpha(g.alpha * (options.alpha ?? 1));
  const pivot = options.pivot;
  rig.actor
    .setPosition(pivot?.x ?? 0, pivot?.y ?? 0)
    .setScale(pivot?.sx ?? 1, pivot?.sy ?? 1);
  for (const image of rig.parts.values()) image.setVisible(false);
  for (const part of parts) {
    let image = rig.parts.get(part.name);
    if (!image) {
      image = scene.add.image(0, 0, key, part.art).setName(part.name);
      rig.actor.add(image);
      rig.parts.set(part.name, image);
    }
    image
      .setTexture(key, part.art)
      .setVisible(true)
      .setPosition(part.x - (pivot?.x ?? 0), part.y - (pivot?.y ?? 0))
      .setOrigin(part.ox ?? 0.5, part.oy ?? 0.5)
      .setRotation(part.rotation ?? 0)
      .setFlipX(part.flip ?? false)
      .setAlpha(part.alpha ?? 1)
      .setTint(part.tint ?? options.tint ?? 0xffffff);
    const scale = part.width / image.frame.cutWidth;
    image.setScale(scale, scale * (part.stretch ?? 1));
    rig.actor.bringToTop(image);
  }
  rig.front.clear().setPosition(-(pivot?.x ?? 0), -(pivot?.y ?? 0));
  options.front?.(rig.front);
  rig.actor.bringToTop(rig.front);
  return true;
}
