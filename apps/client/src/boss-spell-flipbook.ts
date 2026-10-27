import type Phaser from "phaser";
import type { RaidBossId } from "../../../packages/shared/src/raid-roster";
import art from "./art/raid-spell-flipbook.webp";
import { setBossSkin } from "./boss-soft-mesh";
const KEY = "raid-spell-flipbook";
const queued = new WeakSet<Phaser.Scene>();
const failed = new WeakSet<Phaser.Scene>();
const cleanups = new WeakSet<Phaser.Scene>();
export function queueBossSpellArt(scene: Phaser.Scene) {
  if (scene.textures.exists(KEY) || queued.has(scene) || failed.has(scene))
    return false;
  queued.add(scene);
  if (!cleanups.has(scene)) {
    cleanups.add(scene);
    scene.events.once("shutdown", () => {
      queued.delete(scene);
      failed.delete(scene);
      cleanups.delete(scene);
    });
  }
  const complete = () => {
    queued.delete(scene);
    scene.load.off("loaderror", error);
  };
  const error = (file: Phaser.Loader.File) => {
    if (file.key !== KEY) return;
    complete();
    failed.add(scene);
    scene.load.off(`filecomplete-image-${KEY}`, complete);
  };
  scene.load.once(`filecomplete-image-${KEY}`, complete);
  scene.load.on("loaderror", error);
  scene.load.image(KEY, art);
  return true;
}
interface Pool {
  images: Phaser.GameObjects.Image[];
  frame: number;
  used: number;
}
const pools = new WeakMap<Phaser.Scene, Pool>();
/** Crossfade authored ignition/eruption/expansion/dissipation drawings. The
 * shared GPU atlas is 4 MiB; the pool is bounded by the live cast budget. */
export function drawBossSpellFlipbook(
  g: Phaser.GameObjects.Graphics,
  id: RaidBossId,
  x: number,
  y: number,
  radius: number,
  age: number,
  clock: number,
) {
  const scene = g.scene;
  if (!scene?.sys?.isActive?.() || age > 0.75) return;
  if (!scene.textures.exists(KEY)) {
    if (queueBossSpellArt(scene) && !scene.load.isLoading()) scene.load.start();
    return;
  }
  const texture = scene.textures.get(KEY);
  if (!texture.has("0"))
    for (let i = 0; i < 16; i++)
      texture.add(i, 0, (i % 4) * 256, Math.floor(i / 4) * 256, 256, 256);
  let pool = pools.get(scene);
  if (!pool) {
    pool = { images: [], frame: -1, used: 0 };
    pools.set(scene, pool);
    const own = pool;
    const sync = () => {
      for (let i = 0; i < own.images.length; i++)
        own.images[i].setVisible(
          own.frame === scene.game.loop.frame && i < own.used,
        );
    };
    scene.events.on("prerender", sync);
    scene.events.once("shutdown", () => {
      scene.events.off("prerender", sync);
      for (const image of own.images) image.destroy();
      pools.delete(scene);
      if (scene.textures.exists(KEY)) scene.textures.remove(KEY);
      queued.delete(scene);
      failed.delete(scene);
    });
  }
  if (pool.frame !== scene.game.loop.frame) {
    pool.frame = scene.game.loop.frame;
    pool.used = 0;
  }
  const row =
    id === "emberwing"
      ? 0
      : id === "tidewyrm" || id === "prismatail"
        ? 1
        : id === "gloomshade" || id === "somnara"
          ? 2
          : 3;
  const position = Math.min(3, age / 0.18),
    phase = Math.floor(position),
    mix = position - phase;
  const m = g.getWorldTransformMatrix(),
    p = m.transformPoint(x, y - 18);
  const size = Math.min(230, Math.max(120, radius * 1.7));
  const tint =
    id === "grumblecrag" ? 0xffd69c : id === "prismatail" ? 0xb5ffed : 0xffffff;
  for (let pass = 0; pass < 2; pass++) {
    const weight = pass ? mix : 1 - mix;
    if (weight < 0.005) continue;
    const cell = Math.min(3, phase + pass),
      index = pool.used++;
    if (index >= 32) continue;
    let image = pool.images[index];
    if (!image) {
      image = scene.add
        .image(0, 0, KEY, row * 4 + cell)
        .setName("boss-spell-flipbook")
        .setBlendMode(1)
        .setDepth(4.32);
      pool.images.push(image);
    }
    const originX = [0.47, 0.44, 0.51, 0.52][cell],
      originY = [0.61, 0.61, 0.55, 0.49][row];
    image
      .setTexture(KEY, row * 4 + cell)
      .setPosition(p.x, p.y)
      .setOrigin(originX, originY)
      .setRotation(0.04 * Math.sin(clock * 2 + row))
      .setScale((size * m.scaleX) / 256, ((size * m.scaleY) / 256) * 0.9)
      .setAlpha(weight * Math.max(0, 1 - age / 0.8) * 0.8)
      .setTint(tint)
      .setVisible(true);
    setBossSkin(image, {
      axis: "y",
      bend: 0.018,
      flutter: 0.025,
      phase: clock * 7,
      fadeEdges: true,
    });
  }
}
