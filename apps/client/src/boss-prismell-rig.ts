/**
 * Prismell in the battle scene. Every piece (boss-prismell-paint.ts) is
 * painted once into one atlas when the raid's scene starts (fixed density,
 * never read back); each frame only places, turns, scales and fades images
 * from it (boss-prismell.ts says which and where). Glows go in their own
 * additive layer. Like the other bosses' rigs, the images live in a
 * container that follows the boss's graphics layer, just above it, and go
 * away with that layer.
 */
import type Phaser from "phaser";
import { addCanvasTexture } from "./canvas-texture";
import {
  PRISMELL_SCALE,
  paintPrismellAtlas,
  prismellFacing,
  prismellPlacements,
  prismellPose,
  type PrismellCue,
  type PrismellFrame,
} from "./boss-prismell";

export const PRISMELL_ATLAS = "prismell-atlas";

export interface PrismellLook extends PrismellCue {
  /** The boss's position in the graphics layer (its floor point). */
  x: number;
  y: number;
  /** Where it faces (screen radians). */
  angle: number;
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
}
const rigs = new WeakMap<Phaser.GameObjects.Graphics, Rig>();
const frames = new Map<string, PrismellFrame>();
/** Bytes held by the atlas (for the budget checks). */
export let prismellAtlasBytes = 0;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/** Paint the atlas now (while the battle loads), not on the first frame. */
export const prewarmAtlas = (scene: Phaser.Scene) => {
  atlas(scene);
};
function atlas(scene: Phaser.Scene) {
  if (scene.textures.exists(PRISMELL_ATLAS)) return PRISMELL_ATLAS;
  const A = paintPrismellAtlas();
  prismellAtlasBytes = A.bytes;
  // A plain image source (canvas-texture.ts): no pixel read-back.
  const texture = addCanvasTexture(scene.textures, PRISMELL_ATLAS, A.canvas);
  for (const [name, f] of Object.entries(A.frames)) {
    texture?.add(name, 0, f.x, f.y, f.w, f.h);
    frames.set(name, f);
  }
  return PRISMELL_ATLAS;
}

/**
 * Show Prismell for this frame in the graphics layer `g`. Returns where its
 * head, heart (the weak point), shell and eyes are in that layer, or false
 * when the layer is not in a running scene.
 */
export function paintPrismell(g: Phaser.GameObjects.Graphics, o: PrismellLook) {
  const scene = g.scene;
  if (!scene?.sys?.isActive?.()) return false;
  const rig = rigs.get(g) ?? createRig(g);
  const facing = prismellFacing(o.angle, rig.facing);
  rig.facing = facing;
  const P = prismellPose(o);
  const placed = prismellPlacements(P, facing, o.phase);
  const sheet = atlas(scene);
  rig.frame = scene.game.loop.frame;
  rig.root.setData("facing", facing);
  rig.root.setData("view", placed.view);
  rig.root.setData("expr", P.look);
  rig.root.setDepth(g.depth + 0.001).setAlpha(g.alpha);
  rig.actor.setPosition(o.x, o.y);
  rig.glows.setPosition(o.x, o.y);
  rig.front.setPosition(o.x, o.y).clear();
  const tint =
    o.hurt > 0.65 && !o.dead ? 0xffe8f4 : o.gilded ? 0xffe6b8 : 0xffffff;
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
        img.setName(`prismell-${p.key}`);
        layer.add(img);
        rig.images.set(p.key, img);
      } else if (img.frame.name !== p.piece) img.setTexture(sheet, p.piece);
      seen.add(p.key);
      img.vz = z++;
      img
        .setVisible(true)
        .setOrigin((f.ox * f.q) / f.w, (f.oy * f.q) / f.h)
        .setPosition(p.x, p.y)
        .setRotation(p.rot)
        .setScale(p.sx / f.q, p.sy / f.q)
        .setAlpha(clamp(p.alpha))
        .setTint(p.tint ?? (p.glow ? 0xffffff : tint));
    }
  };
  show(placed.images, rig.actor);
  show(placed.glows, rig.glows);
  for (const [key, img] of rig.images)
    if (!seen.has(key)) img.setVisible(false);
  rig.actor.sort("vz");
  const heart = placed.heart;
  if (!o.dead) {
    if (P.open > 0.5) {
      // the open weak point's ring, as every boss shows it
      rig.front.fillStyle(0xaaffdf, 0.15).fillCircle(heart.x, heart.y, 20);
      rig.front
        .lineStyle(2.5, 0xd9ffdb, 0.85)
        .strokeCircle(heart.x, heart.y, 20);
    } else {
      // while the heart is closed, a crystal shield stands over the shell
      rig.front
        .lineStyle(2, 0xb4e8ff, 0.4)
        .strokeEllipse(
          placed.shell.x,
          placed.shell.y,
          150 * PRISMELL_SCALE,
          160 * PRISMELL_SCALE,
        );
    }
  }
  const at = (q: { x: number; y: number }) => ({ x: o.x + q.x, y: o.y + q.y });
  return {
    head: at(placed.head),
    heart: at(heart),
    shell: at(placed.shell),
    shellTop: at(placed.shellTop),
    eyes: placed.eyes.map(at),
    open: P.open,
    dim: P.dim,
    shine: P.shine,
  };
}

function createRig(g: Phaser.GameObjects.Graphics): Rig {
  const scene = g.scene;
  const actor = scene.add.container(0, 0);
  const glows = scene.add.container(0, 0).setBlendMode("ADD");
  const front = scene.add.graphics().setName("prismell-front");
  const root = scene.add
    .container(0, 0, [actor, glows, front])
    .setName("prismell-boss");
  const rig: Rig = {
    root,
    actor,
    glows,
    front,
    images: new Map(),
    frame: -1,
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
