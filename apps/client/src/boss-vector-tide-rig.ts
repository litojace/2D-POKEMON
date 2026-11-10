/**
 * Tidewyrm's vector rig in the battle scene (boss-vector-tide.ts has the rig
 * and the drawing). As with Grumblecrag (boss-vector-rig.ts), every piece is
 * drawn once per phase into one atlas; each frame only moves, turns, scales,
 * crops (at the waterline) and re-sorts images from it, plus a few thin lines
 * (whiskers, beard, the mouth's snarl). Glows go in their own additive layer.
 * The images live in a container that follows the boss's graphics layer,
 * drawn just above it, and go away with that layer.
 */
import type Phaser from "phaser";
import { addCanvasTexture } from "./canvas-texture";
import type { Phase } from "./boss-vector-grumble";
import {
  TIDE_TILT,
  packPieces,
  paintPieces,
  tidePieces,
  tidePlacements,
  tidePose,
  tideTurn,
  type TideCue,
  type TideLine,
} from "./boss-vector-tide";

/** World pixels per rig unit. */
export const TIDE_SCALE = 0.75;
/** Texture pixels per world pixel: sharp on 2× screens and close cameras. */
const Q = 2;
const PX = TIDE_SCALE * Q;

export interface VectorTideLook extends Omit<TideCue, "clock"> {
  x: number;
  y: number;
  /** Where it faces (screen radians). */
  angle: number;
  clock: number;
  gilded: boolean;
  /** Is there water (true) or an island's sand (false) at this floor spot? */
  wet: (x: number, y: number) => boolean;
}

type Sorted = Phaser.GameObjects.Image & { vz: number };
type SortedG = Phaser.GameObjects.Graphics & { vz: number };
interface Rig {
  root: Phaser.GameObjects.Container;
  actor: Phaser.GameObjects.Container;
  glows: Phaser.GameObjects.Container;
  front: Phaser.GameObjects.Graphics;
  linesBack: SortedG;
  linesFront: SortedG;
  images: Map<string, Sorted>;
  frame: number;
  facing?: number;
  yaw: number;
  clock: number;
  flat: number;
  spin: number;
}
const rigs = new WeakMap<Phaser.GameObjects.Graphics, Rig>();
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const atlasKey = (phase: Phase) => `vtide-atlas-${phase}`;
const sizes = new Map(tidePieces(1).map((p) => [p.name, p]));

/** The phase's atlas, drawn once and kept while the phase lasts. */
function atlas(scene: Phaser.Scene, phase: Phase) {
  const key = atlasKey(phase);
  if (scene.textures.exists(key)) return key;
  const packed = packPieces(phase, PX);
  const canvas = document.createElement("canvas");
  canvas.width = packed.width;
  canvas.height = Math.max(1, packed.height);
  const ctx = canvas.getContext("2d");
  if (ctx) paintPieces(ctx, packed.spots, PX);
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
/** A CSS colour as Phaser's number and alpha. */
function cssColor(c: string) {
  if (c.startsWith("#")) return { color: parseInt(c.slice(1), 16), alpha: 1 };
  const m = c.match(/[\d.]+/g)?.map(Number) ?? [255, 255, 255, 1];
  return { color: (m[0] << 16) | (m[1] << 8) | m[2], alpha: m[3] ?? 1 };
}

/**
 * Show Tidewyrm for this frame in the graphics layer `g`. Returns where its
 * head and pearl are in that layer, or false when the layer is not in a
 * running scene.
 */
export function paintVectorTide(
  g: Phaser.GameObjects.Graphics,
  o: VectorTideLook,
) {
  const scene = g.scene;
  if (!scene?.sys?.isActive?.()) return false;
  const phase = clamp(Math.round(o.phase), 1, 3) as Phase;
  const rig = rigs.get(g) ?? createRig(g);
  const dt = clamp(o.clock - rig.clock, 0, 0.1);
  const first = rig.facing === undefined;
  const turn = tideTurn(o.angle, rig.facing, rig.yaw, dt, first || o.reduced);
  rig.facing = turn.facing;
  rig.yaw = turn.yaw;
  rig.clock = o.clock;
  // stranded eases flat; the undertow spins it, then it unwinds
  rig.flat +=
    ((o.stranded && !o.dead ? 1 : 0) - rig.flat) *
    (first || o.reduced ? 1 : Math.min(1, dt * 6));
  if (o.windKind === "undertow" && !o.reduced)
    rig.spin += dt * 3.2 * clamp(o.windup * 1.5);
  else {
    const home = Math.round(rig.spin / (Math.PI * 2)) * Math.PI * 2;
    rig.spin += (home - rig.spin) * Math.min(1, dt * 3);
  }
  const P = tidePose({ ...o, clock: o.clock });
  P.flat = rig.flat;
  P.spin = rig.spin;
  const S = TIDE_SCALE;
  const water = (x: number, z: number) =>
    o.wet(o.x + x * S, o.y + z * TIDE_TILT * S) ? 0 : null;
  const placed = tidePlacements(P, rig.yaw, phase, water);
  const sheet = atlas(scene, phase);

  rig.frame = scene.game.loop.frame;
  rig.root.setData("facing", turn.facing);
  rig.root.setDepth(g.depth + 0.001).setAlpha(g.alpha);
  rig.actor.setPosition(o.x, o.y);
  rig.glows.setPosition(o.x, o.y);
  const tint = o.dead
    ? 0x9b97a0
    : o.hurt > 0.65
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
      .setTint(p.glow ? (p.tint ?? 0xffffff) : tint);
    // under the water: keep only the part above the waterline
    if (p.waterY !== undefined) {
      const fh = img.frame.height,
        dh = fh * Math.abs(img.scaleY);
      const top = p.y * S - img.originY * dh;
      const keep = clamp((p.waterY * S - top) / (dh || 1));
      if (keep < 1) img.setCrop(0, 0, img.frame.width, fh * keep);
      else img.setCrop();
    } else if (img.isCropped) img.setCrop();
  }
  for (const [key, img] of rig.images)
    if (!seen.has(key)) img.setVisible(false);
  // the thin lines, behind and in front of the head
  const headZ = placed.head.w.z;
  rig.linesBack.vz = headZ - 0.6 + 0.0005;
  rig.linesFront.vz = headZ + 0.07;
  const stroke = (gr: Phaser.GameObjects.Graphics, ls: TideLine[]) => {
    gr.clear();
    for (const l of ls) {
      const c = cssColor(l.color);
      gr.lineStyle(l.width * S, c.color, c.alpha);
      gr.strokePoints(
        l.pts.map((q) => ({ x: q.x * S, y: q.y * S })),
        false,
      );
    }
  };
  stroke(
    rig.linesBack,
    placed.lines.filter((l) => !l.front),
  );
  stroke(
    rig.linesFront,
    placed.lines.filter((l) => l.front),
  );
  rig.actor.sort("vz");
  // the open weak point's ring, as every boss shows it
  const pearl = {
    x: o.x + placed.pearlScreen.x * S,
    y: o.y + placed.pearlScreen.y * S,
  };
  rig.front.clear();
  if (P.exposed > 0.02 && !o.dead) {
    rig.front.fillStyle(0xaaffdf, 0.15).fillCircle(pearl.x, pearl.y, 22);
    rig.front.lineStyle(2.5, 0xd9ffdb, 0.85).strokeCircle(pearl.x, pearl.y, 22);
  }
  dropOtherAtlases(scene, phase, rig);
  return {
    head: {
      x: o.x + placed.headScreen.x * S,
      y: o.y + placed.headScreen.y * S,
    },
    pearl,
  };
}

function createRig(g: Phaser.GameObjects.Graphics): Rig {
  const scene = g.scene;
  const actor = scene.add.container(0, 0);
  // The lines sit in the sorted body with the images (drawn relative to it).
  const linesBack = scene.add
    .graphics()
    .setName("vector-tide-lines-back") as SortedG;
  const linesFront = scene.add
    .graphics()
    .setName("vector-tide-lines-front") as SortedG;
  linesBack.vz = 0;
  linesFront.vz = 0;
  actor.add([linesBack, linesFront]);
  const glows = scene.add.container(0, 0).setBlendMode("ADD");
  const front = scene.add.graphics().setName("vector-boss-front");
  const root = scene.add
    .container(0, 0, [actor, glows, front])
    .setName("vector-boss-tidewyrm");
  const rig: Rig = {
    root,
    actor,
    glows,
    front,
    linesBack,
    linesFront,
    images: new Map(),
    frame: -1,
    yaw: 0,
    clock: 0,
    flat: 0,
    spin: 0,
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
