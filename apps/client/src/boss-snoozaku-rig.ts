/**
 * Snoozaku in the battle scene. Every piece (boss-snoozaku-art.ts) is
 * painted once into one atlas when the raid's scene starts; each frame only
 * places, turns, scales and fades images from it (boss-snoozaku.ts says
 * which and where). Glows go in their own additive layer. Like the other
 * bosses' rigs, the images live in a container that follows the boss's
 * graphics layer, just above it, and go away with that layer.
 */
import type Phaser from "phaser";
import { addCanvasTexture } from "./canvas-texture";
import { buildAtlas } from "./boss-snoozaku-art";
import { nextFacing } from "./boss-vector-grumble";
import {
  SNOOZAKU_FEET,
  SNOOZAKU_SCALE,
  snoozakuPlacements,
  snoozakuPose,
  type Phase,
  type SnoozakuCue,
} from "./boss-snoozaku";

export const SNOOZAKU_ATLAS = "snoozaku-atlas";

export interface SnoozakuLook extends Omit<SnoozakuCue, "stride" | "speed"> {
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
export let snoozakuAtlasBytes = 0;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/** Paint the atlas now (while the battle loads), not on the first frame. */
export const prewarmAtlas = (scene: Phaser.Scene, _phase?: Phase) => {
  atlas(scene);
};
function atlas(scene: Phaser.Scene) {
  if (scene.textures.exists(SNOOZAKU_ATLAS)) return SNOOZAKU_ATLAS;
  const A = buildAtlas(1) as {
    pages: HTMLCanvasElement[];
    pieces: Record<string, Frame & { sx: number; sy: number }>;
  };
  const canvas = A.pages[0];
  snoozakuAtlasBytes = canvas.width * canvas.height * 4;
  // A plain image source (canvas-texture.ts): no pixel read-back.
  const texture = addCanvasTexture(scene.textures, SNOOZAKU_ATLAS, canvas);
  for (const [name, p] of Object.entries(A.pieces)) {
    texture?.add(name, 0, p.sx, p.sy, p.w, p.h);
    frames.set(name, { w: p.w, h: p.h, q: p.q, ox: p.ox, oy: p.oy });
  }
  return SNOOZAKU_ATLAS;
}

/**
 * Show Snoozaku for this frame in the graphics layer `g`. Returns where its
 * star-heart, head and eyes are in that layer, or false when the layer is
 * not in a running scene.
 */
export function paintSnoozaku(g: Phaser.GameObjects.Graphics, o: SnoozakuLook) {
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
    rig.speed += (Math.min(400, moved / dt) - rig.speed) * Math.min(1, dt * 8);
  rig.stride += dt * Math.min(7.5, rig.speed * 0.12);
  rig.x = o.x;
  rig.y = o.y;
  rig.clock = o.time;
  const P = snoozakuPose({ ...o, stride: rig.stride, speed: rig.speed });
  const placed = snoozakuPlacements(P, facing, phase, o.time, o.reduced);
  const sheet = atlas(scene);
  const SC = SNOOZAKU_SCALE;
  rig.frame = scene.game.loop.frame;
  rig.root.setData("facing", facing);
  rig.root.setData("view", placed.view);
  rig.root.setData("expr", P.expr);
  rig.root.setDepth(g.depth + 0.001).setAlpha(g.alpha);
  const fy = o.y + SNOOZAKU_FEET;
  rig.actor.setPosition(o.x, fy);
  rig.glows.setPosition(o.x, fy);
  rig.front.setPosition(o.x, fy).clear();
  // beaten, it greys as it falls asleep
  const tint = o.dead
    ? lerpColor(0xffffff, 0xb4afc4, P.dim)
    : o.hurt > 0.65
      ? 0xffe5ef
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
        img.setName(`snoozaku-${p.key}`);
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
  const heart = { x: placed.heart.x * SC, y: placed.heart.y * SC };
  // the open weak point's ring, as every boss shows it
  if (o.exposed && !o.dead) {
    rig.front.fillStyle(0xaaffdf, 0.15).fillCircle(heart.x, heart.y, 22);
    rig.front.lineStyle(2.5, 0xd9ffdb, 0.85).strokeCircle(heart.x, heart.y, 22);
  }
  return {
    x: o.x + heart.x,
    y: fy + heart.y,
    head: { x: o.x + placed.head.x * SC, y: fy + placed.head.y * SC },
    eyes: placed.eyes.map((e) => ({ x: o.x + e.x * SC, y: fy + e.y * SC })),
  };
}
function lerpColor(a: number, b: number, t: number) {
  const k = clamp(t);
  const ch = (s: number) =>
    Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

function createRig(g: Phaser.GameObjects.Graphics): Rig {
  const scene = g.scene;
  const actor = scene.add.container(0, 0);
  const glows = scene.add.container(0, 0).setBlendMode("ADD");
  const front = scene.add.graphics().setName("snoozaku-front");
  const root = scene.add
    .container(0, 0, [actor, glows, front])
    .setName("snoozaku-boss");
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
