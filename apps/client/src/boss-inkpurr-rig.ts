/**
 * Inkpurr's rig in the battle scene (boss-inkpurr.ts has the poses and
 * placements, boss-inkpurr-paint.ts the painters). Every piece is drawn once
 * into one atlas, at scene creation (`prewarmAtlas`); each frame only moves,
 * turns, scales, fades and re-sorts images from it. Glows go in their own
 * additive layer.
 *
 * Inkpurr splits into copies, so one graphics layer may hold several bodies:
 * each body (by its key) has its own rig, sharing the atlas. A rig follows
 * its graphics layer, drawn just above it, and goes away with that layer, or
 * when it has not been drawn for a while.
 */
import type Phaser from "phaser";
import { addCanvasTexture } from "./canvas-texture";
import {
  inkPlacements,
  inkPose,
  inkTurn,
  paintInkAtlas,
  type InkCue,
  type InkFrame,
} from "./boss-inkpurr";

export interface InkpurrLook extends Omit<InkCue, "clock"> {
  /** The floor under the body. */
  x: number;
  y: number;
  /** Where it faces (screen radians). */
  angle: number;
  clock: number;
  gilded: boolean;
  /** The body's own fade (a copy appearing or bursting). */
  alpha: number;
  /** A copy: drawn exactly alike, but without the idle drips. */
  cheap?: boolean;
  /** The real one in lantern light: the light it stands in, and its shadow's strength. */
  shadow?: { x: number; y: number };
  shadowAlpha?: number;
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
}
const rigs = new WeakMap<Phaser.GameObjects.Graphics, Map<string, Rig>>();
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const INK_ATLAS = "inkpurr-atlas";
const frames = new WeakMap<Phaser.Scene, Record<string, InkFrame>>();
/** Bytes held by the last atlas drawn (tests, the perf overlay). */
export let inkAtlasBytes = 0;

/** Draw the atlas now (when the battle scene is created), not on the first frame. */
export const prewarmAtlas = (scene: Phaser.Scene) => {
  atlas(scene);
};
function atlas(scene: Phaser.Scene) {
  const known = frames.get(scene);
  if (known && scene.textures.exists(INK_ATLAS)) return known;
  if (scene.textures.exists(INK_ATLAS)) scene.textures.remove(INK_ATLAS);
  const built = paintInkAtlas();
  inkAtlasBytes = built.bytes;
  // A plain image source (canvas-texture.ts): no pixel read-back each frame.
  const texture = addCanvasTexture(scene.textures, INK_ATLAS, built.canvas);
  for (const [name, f] of Object.entries(built.frames))
    texture?.add(name, 0, f.x, f.y, f.w, f.h);
  frames.set(scene, built.frames);
  return built.frames;
}

/**
 * Show one Inkpurr body for this frame in the graphics layer `g`. `key`
 * tells bodies drawn into the same layer apart (the real one and each copy).
 * Returns where its head, core and moon are in that layer, or false when the
 * layer is not in a running scene.
 */
export function paintInkpurr(
  g: Phaser.GameObjects.Graphics,
  key: string,
  o: InkpurrLook,
) {
  const scene = g.scene;
  if (!scene?.sys?.isActive?.()) return false;
  const F = atlas(scene);
  let group = rigs.get(g);
  if (!group) {
    group = new Map();
    rigs.set(g, group);
  }
  const rig = group.get(key) ?? createRig(g, key, group);
  const dt = clamp(o.clock - rig.clock, 0, 0.1);
  const first = rig.facing === undefined;
  const turn = inkTurn(o.angle, rig.facing, rig.yaw, dt, first || o.reduced);
  rig.facing = turn.facing;
  rig.yaw = turn.yaw;
  rig.clock = o.clock;
  const P = inkPose(o);
  let shadow: { dx: number; dy: number; alpha: number } | undefined;
  if (o.shadow) {
    const dx = o.x - o.shadow.x,
      dy = o.y - o.shadow.y,
      d = Math.hypot(dx, dy) || 1;
    shadow = { dx: dx / d, dy: dy / d, alpha: (o.shadowAlpha ?? 0.4) * 1.6 };
  }
  const placed = inkPlacements(P, {
    facing: turn.facing,
    phase: o.phase,
    clock: o.clock,
    cheap: o.cheap,
    shadow,
  });

  rig.frame = scene.game.loop.frame;
  rig.root.setData("facing", turn.facing);
  rig.root.setData("view", placed.view);
  rig.root.setDepth(g.depth + 0.001).setAlpha(g.alpha * clamp(o.alpha));
  rig.actor.setPosition(o.x, o.y);
  rig.glows.setPosition(o.x, o.y);
  const tint = o.dead
    ? 0xb9b4c4
    : o.hurt > 0.6
      ? 0xffe5ee
      : o.gilded
        ? 0xffe1ad
        : 0xffffff;
  const seen = new Set<string>();
  for (const p of placed.placements) {
    const f = F[p.piece];
    if (!f) continue;
    let img = rig.images.get(p.key);
    if (!img) {
      img = scene.add.image(0, 0, INK_ATLAS, p.piece) as Sorted;
      img.setName(`vector-part-${p.key}`);
      (p.glow ? rig.glows : rig.actor).add(img);
      rig.images.set(p.key, img);
    } else if (img.frame.name !== p.piece) img.setFrame(p.piece);
    seen.add(p.key);
    img.vz = p.z;
    img
      .setVisible(true)
      .setOrigin((f.ox * f.q) / f.w, (f.oy * f.q) / f.h)
      .setPosition(p.x, p.y)
      .setRotation(p.rot)
      .setScale(p.sx / f.q, p.sy / f.q)
      .setAlpha(clamp(p.alpha))
      .setTint(p.glow ? 0xffffff : tint);
  }
  for (const [k, img] of rig.images) if (!seen.has(k)) img.setVisible(false);
  rig.actor.sort("vz");
  // the open weak point's ring, as every boss shows it
  const core = { x: o.x + placed.core.x, y: o.y + placed.core.y };
  rig.front.clear();
  if (P.core > 0.02 && !o.dead) {
    rig.front.fillStyle(0xaaffdf, 0.15).fillCircle(core.x, core.y, 15);
    rig.front.lineStyle(2.5, 0xd9ffdb, 0.85).strokeCircle(core.x, core.y, 15);
  }
  return {
    head: { x: o.x + placed.head.x, y: o.y + placed.head.y },
    core,
    moon: { x: o.x + placed.moon.x, y: o.y + placed.moon.y },
    paw: { x: o.x + placed.paw.x, y: o.y + placed.paw.y },
    // its brow gem (the head, in the views that hide the face)
    gem: {
      x: o.x + (placed.gem ?? placed.head).x,
      y: o.y + (placed.gem ?? placed.head).y,
    },
    images: seen.size,
  };
}

function createRig(
  g: Phaser.GameObjects.Graphics,
  key: string,
  group: Map<string, Rig>,
): Rig {
  const scene = g.scene;
  const actor = scene.add.container(0, 0);
  const glows = scene.add.container(0, 0).setBlendMode("ADD");
  const front = scene.add.graphics().setName("vector-boss-front");
  const root = scene.add
    .container(0, 0, [actor, glows, front])
    .setName(`vector-boss-gloomshade:${key}`);
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
  group.set(key, rig);
  const dispose = () => {
    scene.events.off("prerender", sync);
    g.off("destroy", dispose);
    root.destroy();
    group.delete(key);
  };
  const sync = () => {
    // a copy that has burst, or a boss that has gone, lets its rig go
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
