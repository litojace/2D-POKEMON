/**
 * Lumiwick in the battle scene (boss-lumiwick.ts has the pose and the
 * placements, boss-lumiwick-paint.ts the painters). Every piece is painted
 * once into one atlas when the scene is created (prewarm); each frame only
 * moves, turns, scales and fades images from it. The images live in a
 * container that follows the boss's graphics layer, drawn just above it.
 */
import type Phaser from "phaser";
import { addCanvasTexture } from "./canvas-texture";
import { paintLumiwickAtlas, type AtlasFrame } from "./boss-lumiwick-paint";
import {
  lumiwickFacing,
  lumiwickPlacements,
  lumiwickPose,
  type LumiCue,
  type LumiFrame,
} from "./boss-lumiwick";

export const LUMI_ATLAS = "lumiwick-atlas";
/** Atlas bytes and frames, per texture manager (the frames carry each piece's density and origin). */
const atlases = new WeakMap<
  Phaser.Textures.TextureManager,
  { frames: Record<string, AtlasFrame>; bytes: number }
>();

export interface LumiwickLook extends Omit<LumiCue, "clock"> {
  /** The boss's spot on the floor. */
  x: number;
  y: number;
  /** Where it faces (screen radians): its travel, or its attack's aim. */
  angle: number;
  clock: number;
  gilded: boolean;
}
type Img = Phaser.GameObjects.Image;
interface Rig {
  root: Phaser.GameObjects.Container;
  actor: Phaser.GameObjects.Container;
  front: Phaser.GameObjects.Graphics;
  images: Map<string, Img>;
  frame: number;
  facing?: number;
}
const rigs = new WeakMap<Phaser.GameObjects.Graphics, Rig>();

/** Paint the atlas now (when the battle scene is created), not on the first frame. */
export function prewarmLumiwick(scene: Phaser.Scene) {
  atlas(scene);
}
/** The atlas's size in bytes (RGBA), once painted. */
export const lumiwickAtlasBytes = (scene: Phaser.Scene) =>
  atlases.get(scene.textures)?.bytes ?? 0;
function atlas(scene: Phaser.Scene) {
  const known = atlases.get(scene.textures);
  if (known && scene.textures.exists(LUMI_ATLAS)) return known.frames;
  const painted = paintLumiwickAtlas();
  const texture = addCanvasTexture(scene.textures, LUMI_ATLAS, painted.canvas);
  for (const [name, f] of Object.entries(painted.frames))
    texture?.add(name, 0, f.x, f.y, f.w, f.h);
  atlases.set(scene.textures, { frames: painted.frames, bytes: painted.bytes });
  return painted.frames;
}

/**
 * Show Lumiwick for this frame in the graphics layer `g`. Returns where its
 * head, heart, hem and eyes are in that layer, or false when the layer is
 * not in a running scene.
 */
export function paintLumiwick(
  g: Phaser.GameObjects.Graphics,
  o: LumiwickLook,
): (LumiFrame & { core: { x: number; y: number } }) | false {
  const scene = g.scene;
  if (!scene?.sys?.isActive?.()) return false;
  const frames = atlas(scene);
  const rig = rigs.get(g) ?? createRig(g);
  const facing = lumiwickFacing(o.angle, rig.facing);
  rig.facing = facing;
  const P = lumiwickPose(o);
  const dir = { x: Math.cos(o.angle), y: Math.sin(o.angle) };
  const placed = lumiwickPlacements(P, facing, dir);
  rig.frame = scene.game.loop.frame;
  rig.root.setData("facing", facing).setData("action", P.action);
  rig.root.setDepth(g.depth + 0.001).setAlpha(g.alpha);
  rig.actor.setPosition(o.x, o.y);
  const tint = o.dead
    ? 0xb8b0a8
    : o.hurt > 0.65
      ? 0xffe9dc
      : o.gilded
        ? 0xffe8b8
        : 0xffffff;
  const seen = new Set<string>();
  let n = 0;
  for (const p of placed.placements) {
    const f = frames[p.piece];
    if (!f) continue;
    let img = rig.images.get(p.key);
    if (!img) {
      img = scene.add.image(0, 0, LUMI_ATLAS, p.piece);
      img.setName(`vector-part-${p.key}`);
      rig.images.set(p.key, img);
    } else if (img.frame.name !== p.piece) img.setTexture(LUMI_ATLAS, p.piece);
    seen.add(p.key);
    img
      .setVisible(true)
      .setOrigin(f.ox, f.oy)
      .setPosition(p.x, p.y)
      .setRotation(p.rot)
      .setScale(p.sx / f.q, p.sy / f.q)
      .setAlpha(p.alpha)
      .setBlendMode(p.add ? 1 : 0)
      .setTint(p.add ? 0xffffff : tint);
    // keep the container's order the placements' order (back to front)
    if (rig.actor.list[n] !== img) {
      if (img.parentContainer === rig.actor) rig.actor.moveTo(img, n);
      else rig.actor.addAt(img, n);
    }
    n++;
  }
  for (const [key, img] of rig.images)
    if (!seen.has(key)) img.setVisible(false);
  const core = { x: o.x + placed.heart.x, y: o.y + placed.heart.y };
  rig.front.clear();
  if (o.exposed && !o.dead) {
    rig.front.fillStyle(0xaaffdf, 0.15).fillCircle(core.x, core.y, 26);
    rig.front.lineStyle(2.5, 0xd9ffdb, 0.85).strokeCircle(core.x, core.y, 26);
  }
  return { ...placed, core };
}

function createRig(g: Phaser.GameObjects.Graphics): Rig {
  const scene = g.scene;
  const actor = scene.add.container(0, 0);
  const front = scene.add.graphics().setName("vector-boss-front");
  const root = scene.add
    .container(0, 0, [actor, front])
    .setName("vector-boss-emberwing");
  const rig: Rig = { root, actor, front, images: new Map(), frame: -1 };
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
