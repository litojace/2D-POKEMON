/**
 * Prismatail's vector rig in the battle scene (boss-vector-prisma.ts has the
 * rig and the drawing). As with Grumblecrag and Tidewyrm, every piece is drawn
 * once per phase into one atlas; each frame only moves, turns, scales and
 * re-sorts images from it. Glows (the train's shine, the crown, a glare) go in
 * their own additive layer. The images live in a container that follows the
 * boss's graphics layer, drawn just above it, and go away with that layer.
 */
import type Phaser from "phaser";
import { addCanvasTexture } from "./canvas-texture";
import type { Phase } from "./boss-vector-grumble";
import type { FaceView } from "./boss-vector-face";
import {
  packPrisma,
  paintPrisma,
  prismaPieces,
  prismaPlacements,
  prismaPose,
  prismaTurn,
  type PrismaCue,
} from "./boss-vector-prisma";

/** World pixels per rig unit: the size of the painted peacock it replaces. */
export const PRISMA_SCALE = 1.4;
/** Texture pixels per world pixel: sharp on 2× screens and close cameras. */
const Q = 2;
const PX = PRISMA_SCALE * Q;

export interface VectorPrismaLook extends Omit<PrismaCue, "clock"> {
  x: number;
  y: number;
  /** Where it faces (screen radians). */
  angle: number;
  clock: number;
  gilded: boolean;
}

type Sorted = Phaser.GameObjects.Image & { vz: number };
interface Rig {
  root: Phaser.GameObjects.Container;
  actor: Phaser.GameObjects.Container;
  glows: Phaser.GameObjects.Container;
  front: Phaser.GameObjects.Graphics;
  images: Map<string, Sorted>;
  frame: number;
  facing?: number;
  yaw: number;
  clock: number;
  view?: FaceView;
}
const rigs = new WeakMap<Phaser.GameObjects.Graphics, Rig>();
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const atlasKey = (phase: Phase) => `vprisma-atlas-${phase}`;
const sizes = new Map(prismaPieces(1).map((p) => [p.name, p]));

/** The phase's atlas, drawn once and kept while the phase lasts. */
/** Draw the phase's atlas now (while the battle loads), not on the first frame. */
export const prewarmAtlas = (scene: Phaser.Scene, phase: Phase) => {
  atlas(scene, phase);
};
function atlas(scene: Phaser.Scene, phase: Phase) {
  const key = atlasKey(phase);
  if (scene.textures.exists(key)) return key;
  const packed = packPrisma(phase, PX);
  const canvas = document.createElement("canvas");
  canvas.width = packed.width;
  canvas.height = Math.max(1, packed.height);
  const ctx = canvas.getContext("2d");
  if (ctx) paintPrisma(ctx, packed.spots, PX);
  // A plain image source (canvas-texture.ts): no pixel read-back.
  const texture = addCanvasTexture(scene.textures, key, canvas);
  for (const s of packed.spots)
    texture?.add(
      s.piece.name,
      0,
      s.x + 1,
      s.y + 1,
      Math.ceil(s.piece.w * PX),
      Math.ceil(s.piece.h * PX),
    );
  return key;
}
function dropOtherAtlases(scene: Phaser.Scene, phase: Phase, rig: Rig) {
  for (const other of [1, 2, 3] as Phase[]) {
    const key = atlasKey(other);
    if (other === phase || !scene.textures.exists(key)) continue;
    for (const img of rig.images.values())
      if (img.texture.key === key) img.setTexture(atlasKey(phase), "glow");
    scene.textures.remove(key);
  }
}

/**
 * Show Prismatail for this frame in the graphics layer `g`. Returns where its
 * head and its heart (the weak point) are in that layer, or false when the
 * layer is not in a running scene.
 */
export function paintVectorPrisma(
  g: Phaser.GameObjects.Graphics,
  o: VectorPrismaLook,
) {
  const scene = g.scene;
  if (!scene?.sys?.isActive?.()) return false;
  const phase = clamp(Math.round(o.phase), 1, 3) as Phase;
  const rig = rigs.get(g) ?? createRig(g);
  const dt = clamp(o.clock - rig.clock, 0, 0.1);
  const first = rig.facing === undefined;
  const turn = prismaTurn(o.angle, rig.facing, rig.yaw, dt, first || o.reduced);
  rig.facing = turn.facing;
  rig.yaw = turn.yaw;
  rig.clock = o.clock;
  const P = prismaPose({ ...o, clock: o.clock });
  const placed = prismaPlacements(P, rig.yaw, phase, rig.view);
  rig.view = placed.view;
  const sheet = atlas(scene, phase);
  const S = PRISMA_SCALE;

  rig.frame = scene.game.loop.frame;
  rig.root.setData("facing", turn.facing);
  rig.root.setDepth(g.depth + 0.001).setAlpha(g.alpha);
  rig.actor.setPosition(o.x, o.y);
  rig.glows.setPosition(o.x, o.y);
  const tint = o.dead
    ? 0x9b97a0
    : o.hurt > 0.65
      ? 0xe5faff
      : o.gilded
        ? 0xffe1ad
        : 0xffffff;
  const seen = new Set<string>();
  for (const p of placed.placements) {
    let img = rig.images.get(p.key);
    if (!img) {
      img = scene.add.image(0, 0, sheet, p.piece) as Sorted;
      img.setName(`vector-part-${p.key}`);
      (p.glow ? rig.glows : rig.actor).add(img);
      rig.images.set(p.key, img);
    } else if (img.texture.key !== sheet || img.frame.name !== p.piece)
      img.setTexture(sheet, p.piece);
    const piece = sizes.get(p.piece);
    seen.add(p.key);
    img.vz = p.z;
    img
      .setVisible(true)
      .setOrigin(piece?.ox ?? 0.5, piece?.oy ?? 0.5)
      .setPosition(p.x * S, p.y * S)
      .setRotation(p.rot)
      .setScale(p.sx / Q, p.sy / Q)
      .setAlpha(clamp(p.alpha))
      .setTint(p.glow ? (p.tint ?? 0xffffff) : tint);
  }
  for (const [key, img] of rig.images)
    if (!seen.has(key)) img.setVisible(false);
  rig.actor.sort("vz");
  const heart = {
    x: o.x + placed.heartScreen.x * S,
    y: o.y + placed.heartScreen.y * S,
  };
  rig.front.clear();
  if (!o.dead) {
    if (P.exposed > 0.02) {
      // the open weak point's ring, as every boss shows it
      rig.front.fillStyle(0xaaffdf, 0.15).fillCircle(heart.x, heart.y, 20);
      rig.front
        .lineStyle(2.5, 0xd9ffdb, 0.85)
        .strokeCircle(heart.x, heart.y, 20);
    } else {
      // while the heart is closed, a crystal shield stands over it
      const sh = placed.shield;
      rig.front
        .lineStyle(2, 0xb4e8ff, 0.45)
        .strokeEllipse(o.x + sh.x * S, o.y + sh.y * S, sh.w * S, sh.h * S);
    }
  }
  dropOtherAtlases(scene, phase, rig);
  return {
    head: {
      x: o.x + placed.headScreen.x * S,
      y: o.y + placed.headScreen.y * S,
    },
    heart,
  };
}

function createRig(g: Phaser.GameObjects.Graphics): Rig {
  const scene = g.scene;
  const actor = scene.add.container(0, 0);
  const glows = scene.add.container(0, 0).setBlendMode("ADD");
  const front = scene.add.graphics().setName("vector-boss-front");
  const root = scene.add
    .container(0, 0, [actor, glows, front])
    .setName("vector-boss-prismatail");
  const rig: Rig = {
    root,
    actor,
    glows,
    front,
    images: new Map(),
    frame: -1,
    yaw: 0,
    clock: 0,
  };
  rigs.set(g, rig);
  const dispose = () => {
    scene.events.off("prerender", sync);
    g.off("destroy", dispose);
    root.destroy();
    rigs.delete(g);
  };
  const sync = () => {
    if (scene.game.loop.frame - rig.frame > 120) {
      dispose();
      return;
    }
    const m = g.getWorldTransformMatrix();
    root
      .setPosition(m.tx, m.ty)
      .setRotation(m.rotation)
      .setScale(m.scaleX, m.scaleY)
      .setVisible(g.visible && g.active && rig.frame === scene.game.loop.frame);
  };
  scene.events.on("prerender", sync);
  g.once("destroy", dispose);
  return rig;
}
