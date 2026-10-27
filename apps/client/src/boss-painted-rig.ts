import type Phaser from "phaser";
import type { RaidBossId } from "../../../packages/shared/src/raid-roster";
import type { BossLifePose } from "./raid-boss-life";
import { setBossSkin } from "./boss-soft-mesh";
import { paintBossAura } from "./boss-spell-art";
import {
  bossDirectionalFrame,
  type BossFrame,
  type BossArtMode,
} from "./boss-directions";
import frames from "./art/raid-whole-frames.json";
import grumblecrag from "./art/raid-whole-grumblecrag.webp";
import tidewyrm from "./art/raid-whole-tidewyrm.webp";
import gloomshade from "./art/raid-whole-gloomshade.webp";
import somnara from "./art/raid-whole-somnara.webp";
import prismatail from "./art/raid-whole-prismatail.webp";
import emberwing from "./art/raid-whole-emberwing.webp";
import stormTwins from "./art/raid-whole-storm-twins.webp";
import grumbleDirections from "./art/raid-directions-grumblecrag.webp";
import tideDirections from "./art/raid-directions-tidewyrm.webp";
import gloomDirections from "./art/raid-directions-gloomshade.webp";
import somnaraDirections from "./art/raid-directions-somnara.webp";
import prismaDirections from "./art/raid-directions-prismatail.webp";
import emberDirections from "./art/raid-directions-emberwing.webp";
import twinDirections from "./art/raid-directions-storm-twins.webp";
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
export const BOSS_DIRECTION_ART: Record<RaidBossId, string> = {
  grumblecrag: grumbleDirections,
  tidewyrm: tideDirections,
  gloomshade: gloomDirections,
  somnara: somnaraDirections,
  prismatail: prismaDirections,
  emberwing: emberDirections,
  "storm-twins": twinDirections,
};
const directionKey = (id: RaidBossId) => `raid-directions-${id}`;
const keysFor = (id: RaidBossId) => [keyFor(id), directionKey(id)];
const pending = new WeakMap<Phaser.Scene, Set<string>>(),
  failed = new WeakMap<Phaser.Scene, Set<string>>(),
  encounters = new WeakMap<Phaser.Scene, RaidBossId | undefined>();
export function retainBossArt(scene: Phaser.Scene, id: RaidBossId | undefined) {
  if (encounters.has(scene) && encounters.get(scene) === id) return;
  if (!encounters.has(scene))
    scene.events.once("shutdown", () => {
      for (const boss of Object.keys(BOSS_PAINTED_ART) as RaidBossId[])
        for (const key of keysFor(boss))
          if (scene.textures.exists(key)) scene.textures.remove(key);
      encounters.delete(scene);
      failed.delete(scene);
      pending.delete(scene);
    });
  encounters.set(scene, id);
  for (const boss of Object.keys(BOSS_PAINTED_ART) as RaidBossId[])
    if (boss !== id)
      for (const key of keysFor(boss))
        if (scene.textures.exists(key)) scene.textures.remove(key);
}
function queueImage(
  scene: Phaser.Scene,
  id: RaidBossId,
  key: string,
  url: string,
) {
  if (scene.textures.exists(key) || failed.get(scene)?.has(key)) return false;
  let queued = pending.get(scene);
  if (!queued) pending.set(scene, (queued = new Set()));
  if (queued.has(key)) return false;
  queued.add(key);
  const complete = () => {
    queued!.delete(key);
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
    misses.add(key);
  };
  scene.load.once(`filecomplete-image-${key}`, complete);
  scene.load.on("loaderror", error);
  scene.load.image(key, url);
  return true;
}
export function queueBossArt(scene: Phaser.Scene, id: RaidBossId) {
  const base = queueImage(scene, id, keyFor(id), BOSS_PAINTED_ART[id]);
  const directions = queueImage(
    scene,
    id,
    directionKey(id),
    BOSS_DIRECTION_ART[id],
  );
  return base || directions;
}
interface Rig {
  root: Phaser.GameObjects.Container;
  actor: Phaser.GameObjects.Container;
  images: Phaser.GameObjects.Image[];
  front: Phaser.GameObjects.Graphics;
  frame: number;
  pose: BossFrame;
  previous: BossFrame;
  changed: number;
}
const rigs = new WeakMap<Phaser.GameObjects.Graphics, Map<string, Rig>>();
export interface WholeBossLook {
  x: number;
  y: number;
  life: BossLifePose;
  key?: string;
  alpha?: number;
  gilded?: boolean;
  exposed?: boolean;
  dead?: boolean;
  hurt?: boolean;
  facing?: number;
  blue?: boolean;
  flight?: number;
  pose?: number;
  collapse?: number;
  flicker?: boolean;
}
function chooseAction(id: RaidBossId, o: WholeBossLook) {
  if (o.pose !== undefined) return 0;
  const a = o.life.action,
    last = a.casts[a.casts.length - 1];
  let pose = o.dead
    ? 3
    : last && last.age < 0.2
      ? 2
      : last && last.age < 0.48
        ? 3
        : a.gather > 0.12
          ? 1
          : 0;
  if (id === "emberwing") {
    if (
      (o.flight ?? 0) >= 0.1 &&
      !o.dead &&
      a.gather < 0.12 &&
      (!last || last.age > 0.48) &&
      o.life.move
    )
      pose = [0, 1, 0, 3][Math.floor(o.life.time * 4) % 4];
  }
  if (
    !o.dead &&
    o.life.move &&
    a.locomotion > 0.15 &&
    a.gather < 0.12 &&
    (!last || last.age > 0.48) &&
    (id === "grumblecrag" ||
      id === "prismatail" ||
      (id === "emberwing" && (o.flight ?? 0) < 0.1))
  )
    pose = [0, 3][
      Math.floor(o.life.time * (id === "grumblecrag" ? 2.8 : 3.6)) % 2
    ];
  return pose;
}
/** Every draw is a COMPLETE authored creature. A short whole-frame transition
 * and one continuous surface can never separate the head, neck or shoulders. */
export function paintWholeBoss(
  g: Phaser.GameObjects.Graphics,
  id: RaidBossId,
  o: WholeBossLook,
) {
  const scene = g.scene;
  if (!scene?.sys?.isActive?.()) return false;
  const key = keyFor(id);
  if (!scene.textures.exists(key)) {
    if (queueBossArt(scene, id) && !scene.load.isLoading()) scene.load.start();
    return false;
  }
  if (queueBossArt(scene, id) && !scene.load.isLoading()) scene.load.start();
  const mode: BossArtMode = o.blue
    ? "blue"
    : id === "emberwing" && (o.flight ?? 0) < 0.1
      ? "ground"
      : id === "tidewyrm" && o.pose === 4
        ? "stranded"
        : "body";
  const action = chooseAction(id, o);
  let pose = bossDirectionalFrame(id, mode, o.life.view, action);
  if (pose.atlas === "directions" && !scene.textures.exists(directionKey(id))) {
    // A failed optional turnaround retains the existing complete base sprite.
    const index =
      mode === "stranded"
        ? 4
        : action + (mode === "ground" || mode === "blue" ? 4 : 0);
    const flip =
      id === "somnara" ? o.life.view === "right" : o.life.view === "left";
    pose = {
      atlas: "base",
      index,
      flip,
      view: o.life.view,
      pose: frames[id].poses[index],
      signature: `fallback:${index}:${flip}`,
    };
  }
  const textureFor = (frame: BossFrame) => {
    const textureKey = frame.atlas === "base" ? key : directionKey(id);
    const texture = scene.textures.get(textureKey),
      name = `pose-${frame.index}`;
    if (!texture.has(name))
      texture.add(
        name,
        0,
        ...(frame.pose.rect as [number, number, number, number]),
      );
    return textureKey;
  };
  let group = rigs.get(g);
  if (!group) rigs.set(g, (group = new Map()));
  const actorKey = `${id}:${o.key ?? "body"}`;
  let rig = group.get(actorKey);
  const clock = o.life.time;
  if (!rig) {
    const images = [
      scene.add.image(0, 0, textureFor(pose), `pose-${pose.index}`),
      scene.add.image(0, 0, textureFor(pose), `pose-${pose.index}`),
    ];
    images.forEach((image, i) => image.setName(`complete-body-${i}`));
    const front = scene.add.graphics(),
      actor = scene.add.container(0, 0, [...images, front]),
      root = scene.add
        .container(0, 0, [actor])
        .setName(`painted-boss-${actorKey}`);
    rig = {
      root,
      actor,
      front,
      images,
      frame: -1,
      pose,
      previous: pose,
      changed: clock,
    };
    group.set(actorKey, rig);
    const own = rig;
    const dispose = () => {
      scene.events.off("prerender", sync);
      g.off("destroy", dispose);
      root.destroy();
      group!.delete(actorKey);
    };
    const sync = () => {
      if (scene.game.loop.frame - own.frame > 120) {
        dispose();
        return;
      }
      const m = g.getWorldTransformMatrix();
      own.root
        .setPosition(m.tx, m.ty)
        .setRotation(m.rotation)
        .setScale(m.scaleX, m.scaleY)
        .setVisible(
          g.visible && g.active && own.frame === scene.game.loop.frame,
        );
    };
    scene.events.on("prerender", sync);
    g.once("destroy", dispose);
  }
  if (
    clock < rig.changed ||
    !scene.textures.exists(
      rig.pose.atlas === "base" ? key : directionKey(id),
    ) ||
    !scene.textures.exists(
      rig.previous.atlas === "base" ? key : directionKey(id),
    )
  ) {
    rig.pose = pose;
    rig.previous = pose;
    rig.changed = clock;
  } else if (rig.pose.signature !== pose.signature) {
    rig.previous = rig.pose;
    rig.pose = pose;
    rig.changed = clock;
  }
  rig.frame = scene.game.loop.frame;
  rig.root.setData("bossView", pose.view);
  rig.root.setDepth(g.depth + 0.001).setAlpha(g.alpha * (o.alpha ?? 1));
  const collapse = o.collapse ?? 0;
  rig.actor
    .setPosition(o.x, o.y)
    .setScale(
      1 + collapse * 0.35 + o.life.breath * 0.004,
      (1 - collapse * 0.85) * (1 + o.life.breath * 0.008),
    );
  const blend = o.life.move
    ? Math.min(1, Math.max(0, (clock - rig.changed) / 0.065))
    : 1;
  for (let i = 0; i < 2; i++) {
    const choice = i === 0 ? rig.pose : rig.previous,
      opacity = i === 0 ? blend : 1 - blend,
      f = choice.pose,
      flip = choice.flip,
      image = rig.images[i];
    if (opacity <= 0.005) {
      image.setVisible(false);
      continue;
    }
    image
      .setTexture(textureFor(choice), `pose-${choice.index}`)
      .setOrigin(
        flip ? 1 - f.anchor[0] / f.rect[2] : f.anchor[0] / f.rect[2],
        f.anchor[1] / f.rect[3],
      )
      .setPosition(0, 0)
      .setScale(f.scale)
      .setFlipX(flip)
      .setRotation(0)
      .setAlpha(opacity)
      .setVisible(opacity > 0.005)
      .setTint(
        o.dead ? 0x9b97a0 : o.hurt ? 0xffe5d8 : o.gilded ? 0xffe1ad : 0xffffff,
      );
    if (o.life.move && id !== "grumblecrag") {
      setBossSkin(image, {
        axis: id === "somnara" ? "x" : "y",
        bend: 0.01,
        flutter: 0.018,
        phase: clock * (id === "emberwing" ? 4.8 : 1.8),
        whole:
          id === "emberwing"
            ? "wings"
            : id === "storm-twins"
              ? "tendrils"
              : "body",
      });
    } else setBossSkin(image, undefined);
  }
  const f = rig.pose.pose,
    flip = rig.pose.flip,
    coreX = (f.core[0] - f.anchor[0]) * f.scale * (flip ? -1 : 1),
    coreY = (f.core[1] - f.anchor[1]) * f.scale;
  rig.front.clear();
  if (o.exposed && !o.dead) {
    const r = id === "grumblecrag" ? 25 : 20;
    rig.front.fillStyle(0xaaffdf, 0.15).fillCircle(coreX, coreY, r);
    rig.front.lineStyle(2.5, 0xd9ffdb, 0.85).strokeCircle(coreX, coreY, r);
  }
  if (id === "prismatail" && !o.dead && !o.exposed) {
    rig.front
      .lineStyle(2, 0xb4e8ff, 0.45)
      .strokeEllipse(coreX, coreY - 5, 100, 123);
  }
  if (o.flicker && !o.dead) {
    const mx = (f.moon[0] - f.anchor[0]) * f.scale * (flip ? -1 : 1),
      my = (f.moon[1] - f.anchor[1]) * f.scale;
    const pulse =
      0.3 + 0.7 * Math.abs(Math.sin(clock * 7.3) * Math.sin(clock * 3.1 + 1));
    rig.front.fillStyle(0xffef9a, pulse * 0.35).fillCircle(mx, my, 13);
  }
  paintBossAura(
    g,
    id,
    o.x + coreX,
    o.y + coreY,
    o.life,
    o.alpha ?? 1,
    !!o.blue,
  );
  return true;
}
