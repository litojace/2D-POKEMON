/**
 * Cragmuff in the battle scene. Every piece (boss-cragmuff-art.ts) is
 * painted once into one atlas when the raid's scene starts; each frame only
 * places, turns, scales and fades images from it (boss-cragmuff.ts says
 * which and where). Glows go in their own additive layer. Like the other
 * bosses' rigs, the images live in a container that follows the boss's
 * graphics layer, just above it, and go away with that layer.
 */
import type Phaser from "phaser";
import { addCanvasTexture } from "./canvas-texture";
import { buildAtlas } from "./boss-cragmuff-art";
import { nextFacing } from "./boss-vector-grumble";
import {
  CRAGMUFF_FEET,
  CRAGMUFF_SCALE,
  cragmuffPlacements,
  cragmuffPose,
  type CragmuffCue,
  type Phase,
} from "./boss-cragmuff";

export const CRAGMUFF_ATLAS = "cragmuff-atlas";

export interface CragmuffLook extends Omit<CragmuffCue, "stride" | "speed"> {
  /** The boss's position in the graphics layer (the floor is FEET below). */
  x: number;
  y: number;
  /** Where it faces (screen radians). */
  angle: number;
  gilded: boolean;
}

type Frame = { w: number; h: number; q: number; ox: number; oy: number };
type Sorted = Phaser.GameObjects.Image & { vz: number };
interface Rig {
  root: Phaser.GameObjects.Container;
  actor: Phaser.GameObjects.Container;
  glows: Phaser.GameObjects.Container;
  front: Phaser.GameObjects.Graphics;
  images: Map<string, Sorted>;
  frame: number;
  facing?: number;
  clock: number;
  x: number;
  y: number;
  speed: number;
  stride: number;
}
const rigs = new WeakMap<Phaser.GameObjects.Graphics, Rig>();
const frames = new Map<string, Frame>();
/** Bytes held by the atlas (for the budget checks). */
export let cragmuffAtlasBytes = 0;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/** Paint the atlas now (while the battle loads), not on the first frame. */
export const prewarmAtlas = (scene: Phaser.Scene, _phase?: Phase) => {
  atlas(scene);
};
function atlas(scene: Phaser.Scene) {
  if (scene.textures.exists(CRAGMUFF_ATLAS)) return CRAGMUFF_ATLAS;
  const A = buildAtlas(1);
  const canvas: HTMLCanvasElement = A.pages[0];
  cragmuffAtlasBytes = canvas.width * canvas.height * 4;
  // A plain image source (canvas-texture.ts): no pixel read-back.
  const texture = addCanvasTexture(scene.textures, CRAGMUFF_ATLAS, canvas);
  for (const [name, p] of Object.entries(
    A.pieces as Record<string, (Frame & { sx: number; sy: number }) | null>,
  )) {
    if (!p) continue;
    texture?.add(name, 0, p.sx, p.sy, p.w, p.h);
    frames.set(name, { w: p.w, h: p.h, q: p.q, ox: p.ox, oy: p.oy });
  }
  return CRAGMUFF_ATLAS;
}

/**
 * Show Cragmuff for this frame in the graphics layer `g`. Returns where its
 * core is in that layer (for the cast aura), or false when the layer is not
 * in a running scene.
 */
export function paintCragmuff(g: Phaser.GameObjects.Graphics, o: CragmuffLook) {
  const scene = g.scene;
  if (!scene?.sys?.isActive?.()) return false;
  const phase = clamp(Math.round(o.phase), 1, 3) as Phase;
  const rig = rigs.get(g) ?? createRig(g);
  const dt = clamp(o.time - rig.clock, 0, 0.1);
  const first = rig.facing === undefined;
  const facing = nextFacing(o.angle, rig.facing);
  rig.facing = facing;
  const moved = Math.hypot(o.x - rig.x, o.y - rig.y);
  if (!first && dt > 0)
    rig.speed += (Math.min(800, moved / dt) - rig.speed) * Math.min(1, dt * 8);
  rig.stride += dt * (o.charging ? 15 : Math.min(7.5, rig.speed * 0.06));
  rig.x = o.x;
  rig.y = o.y;
  rig.clock = o.time;
  const P = cragmuffPose({ ...o, stride: rig.stride, speed: rig.speed });
  const placed = cragmuffPlacements(P, facing, phase, o.time, o.reduced);
  const sheet = atlas(scene);
  const SC = CRAGMUFF_SCALE;
  rig.frame = scene.game.loop.frame;
  rig.root.setData("facing", facing);
  rig.root.setData("view", placed.view);
  rig.root.setData("expr", P.expr);
  rig.root.setDepth(g.depth + 0.001).setAlpha(g.alpha);
  const fy = o.y + CRAGMUFF_FEET;
  rig.actor.setPosition(o.x, fy);
  rig.glows.setPosition(o.x, fy);
  rig.front.setPosition(o.x, fy).clear();
  const tint = o.dead
    ? 0xe2dcd4
    : o.hurt > 0.65
      ? 0xffe5d8
      : o.gilded
        ? 0xffe1ad
        : 0xffffff;
  const seen = new Set<string>();
  let z = 0;
  const show = (
    list: typeof placed.images,
    layer: Phaser.GameObjects.Container,
  ) => {
    for (const p of list) {
      const f = frames.get(p.piece);
      if (!f) continue;
      let img = rig.images.get(p.key);
      if (!img) {
        img = scene.add.image(0, 0, sheet, p.piece) as Sorted;
        img.setName(`cragmuff-${p.key}`);
        layer.add(img);
        rig.images.set(p.key, img);
      } else if (img.frame.name !== p.piece) img.setTexture(sheet, p.piece);
      seen.add(p.key);
      img.vz = z++;
      img
        .setVisible(true)
        .setOrigin((f.ox * f.q) / f.w, (f.oy * f.q) / f.h)
        .setPosition(p.x * SC, p.y * SC)
        .setRotation(p.rot)
        .setScale((p.sx * SC) / f.q, (p.sy * SC) / f.q)
        .setAlpha(clamp(p.alpha))
        .setTint(p.glow ? 0xffffff : tint);
    }
  };
  show(placed.images, rig.actor);
  show(placed.glows, rig.glows);
  for (const [key, img] of rig.images)
    if (!seen.has(key)) img.setVisible(false);
  rig.actor.sort("vz");
  const core = { x: placed.core.x * SC, y: placed.core.y * SC };
  // the open weak point's ring, as every boss shows it
  if (o.exposed && !o.dead) {
    rig.front.fillStyle(0xaaffdf, 0.15).fillCircle(core.x, core.y, 22);
    rig.front.lineStyle(2.5, 0xd9ffdb, 0.85).strokeCircle(core.x, core.y, 22);
  }
  return {
    x: o.x + core.x,
    y: fy + core.y,
    head: { x: o.x + placed.head.x * SC, y: fy + placed.head.y * SC },
    eyes: placed.eyes.map((e) => ({ x: o.x + e.x * SC, y: fy + e.y * SC })),
  };
}

function createRig(g: Phaser.GameObjects.Graphics): Rig {
  const scene = g.scene;
  const actor = scene.add.container(0, 0);
  const glows = scene.add.container(0, 0).setBlendMode("ADD");
  const front = scene.add.graphics().setName("cragmuff-front");
  const root = scene.add
    .container(0, 0, [actor, glows, front])
    .setName("cragmuff-boss");
  const rig: Rig = {
    root,
    actor,
    glows,
    front,
    images: new Map(),
    frame: -1,
    clock: 0,
    x: 0,
    y: 0,
    speed: 0,
    stride: 0,
  };
  rigs.set(g, rig);
  const dispose = () => {
    scene.events.off("prerender", sync);
    g.off("destroy", dispose);
    root.destroy();
    rigs.delete(g);
  };
  // Follow the layer (camera, scale) and show only when drawn this frame.
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
