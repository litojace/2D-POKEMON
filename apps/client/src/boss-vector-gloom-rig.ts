/**
 * Gloomshade's vector rig in the battle scene (boss-vector-gloom.ts has the
 * rig and the drawing). As with Tidewyrm (boss-vector-tide-rig.ts), every
 * piece is drawn once per phase into one atlas; each frame only moves, turns,
 * scales and re-sorts images from it. Glows go in their own additive layer.
 *
 * Gloomshade splits into copies, so one graphics layer may hold several
 * bodies: each body (by its key) has its own rig, sharing the phase's atlas.
 * A rig follows its graphics layer, drawn just above it, and goes away with
 * that layer, or when it has not been drawn for a while.
 */
import type Phaser from "phaser";
import { addCanvasTexture } from "./canvas-texture";
import type { Phase } from "./boss-vector-grumble";
import type { FaceView } from "./boss-vector-face";
import {
  gloomPieces,
  gloomPlacements,
  gloomPose,
  gloomTurn,
  packGloom,
  paintGloom,
  type GloomCue,
} from "./boss-vector-gloom";

/** World pixels per rig unit: the painted Gloomshade's size in battle. */
export const GLOOM_SCALE = 1.1;
/** Texture pixels per world pixel: sharp on 2x screens and close cameras. */
const Q = 2;
const PX = GLOOM_SCALE * Q;

export interface VectorGloomLook extends Omit<GloomCue, "clock"> {
  /** The floor under the body. */
  x: number;
  y: number;
  /** Where it faces (screen radians). */
  angle: number;
  clock: number;
  gilded: boolean;
  /** The body's own fade (a copy appearing or bursting, dawn). */
  alpha: number;
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
const rigs = new WeakMap<Phaser.GameObjects.Graphics, Map<string, Rig>>();
const live = new Set<Rig>();
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const atlasKey = (phase: Phase) => `vgloom-atlas-${phase}`;
const sizes = new Map(gloomPieces(1).map((p) => [p.name, p]));

/** The phase's atlas, drawn once and kept while the phase lasts. */
function atlas(scene: Phaser.Scene, phase: Phase) {
  const key = atlasKey(phase);
  if (scene.textures.exists(key)) return key;
  const packed = packGloom(phase, PX);
  const canvas = document.createElement("canvas");
  canvas.width = packed.width;
  canvas.height = Math.max(1, packed.height);
  const ctx = canvas.getContext("2d");
  if (ctx) paintGloom(ctx, packed.spots, PX);
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
function dropOtherAtlases(scene: Phaser.Scene, phase: Phase) {
  for (const other of [1, 2, 3] as Phase[]) {
    const key = atlasKey(other);
    if (other === phase || !scene.textures.exists(key)) continue;
    for (const rig of live)
      for (const img of rig.images.values())
        if (img.texture.key === key) img.setTexture(atlasKey(phase), "glint");
    scene.textures.remove(key);
  }
}

/**
 * Show one Gloomshade body for this frame in the graphics layer `g`. `key`
 * tells bodies drawn into the same layer apart (the real one and each copy).
 * Returns where its head, core and moon are in that layer, or false when the
 * layer is not in a running scene.
 */
export function paintVectorGloom(
  g: Phaser.GameObjects.Graphics,
  key: string,
  o: VectorGloomLook,
) {
  const scene = g.scene;
  if (!scene?.sys?.isActive?.()) return false;
  const phase = clamp(Math.round(o.phase), 1, 3) as Phase;
  let group = rigs.get(g);
  if (!group) {
    group = new Map();
    rigs.set(g, group);
  }
  const rig = group.get(key) ?? createRig(g, key, group);
  const dt = clamp(o.clock - rig.clock, 0, 0.1);
  const first = rig.facing === undefined;
  const turn = gloomTurn(o.angle, rig.facing, rig.yaw, dt, first || o.reduced);
  rig.facing = turn.facing;
  rig.yaw = turn.yaw;
  rig.clock = o.clock;
  const P = gloomPose(o);
  const placed = gloomPlacements(P, rig.yaw, phase, rig.view);
  rig.view = placed.view;
  const sheet = atlas(scene, phase);
  const S = GLOOM_SCALE;

  rig.frame = scene.game.loop.frame;
  rig.root.setData("facing", turn.facing);
  rig.root.setDepth(g.depth + 0.001).setAlpha(g.alpha * clamp(o.alpha));
  rig.actor.setPosition(o.x, o.y);
  rig.glows.setPosition(o.x, o.y);
  const tint = o.dead
    ? 0x9b97a0
    : o.hurt > 0.6
      ? 0xffe5d8
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
      .setTint(p.glow ? 0xffffff : tint);
  }
  for (const [k, img] of rig.images) if (!seen.has(k)) img.setVisible(false);
  rig.actor.sort("vz");
  // the open weak point's ring, as every boss shows it
  const core = { x: o.x + placed.core.x * S, y: o.y + placed.core.y * S };
  rig.front.clear();
  if (P.core > 0.02 && !o.dead) {
    rig.front.fillStyle(0xaaffdf, 0.15).fillCircle(core.x, core.y, 20);
    rig.front.lineStyle(2.5, 0xd9ffdb, 0.85).strokeCircle(core.x, core.y, 20);
  }
  dropOtherAtlases(scene, phase);
  return {
    head: { x: o.x + placed.head.x * S, y: o.y + placed.head.y * S },
    core,
    moon: { x: o.x + placed.moon.x * S, y: o.y + placed.moon.y * S },
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
  live.add(rig);
  const dispose = () => {
    scene.events.off("prerender", sync);
    g.off("destroy", dispose);
    root.destroy();
    group.delete(key);
    live.delete(rig);
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
