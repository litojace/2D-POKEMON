/**
 * The Storm Twins' vector rigs in the battle scene (boss-vector-twins.ts has
 * the pose and the drawing). As with Tidewyrm (boss-vector-tide-rig.ts), every
 * piece is drawn once per phase into one atlas, shared by both twins; each
 * frame only moves, turns, scales and re-sorts images from it. Glows (the
 * aura and the sparks) go in their own additive layer. Each twin has its own
 * rig, in a container that follows the graphics layer it is drawn for, just
 * above it, and goes away with that layer.
 */
import type Phaser from "phaser";
import { addCanvasTexture } from "./canvas-texture";
import type { Phase } from "./boss-vector-grumble";
import type { FaceView } from "./boss-vector-face";
import {
  packTwinPieces,
  paintTwinPieces,
  twinPlacements,
  twinPose,
  twinTurn,
  twinsPieces,
  type TwinCue,
  type TwinIndex,
} from "./boss-vector-twins";

/** World pixels per rig unit: as tall as the painted twins were. */
export const TWINS_SCALE = 1.15;
/** Texture pixels per world pixel: sharp on 2× screens and close cameras. */
const Q = 2;
const PX = TWINS_SCALE * Q;

export interface VectorTwinLook extends Omit<TwinCue, "clock"> {
  /** The floor under the twin. */
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
  /** The aura, behind the body (the sparks glow in front). */
  halo: Phaser.GameObjects.Container;
  front: Phaser.GameObjects.Graphics;
  images: Map<string, Sorted>;
  frame: number;
  facing?: number;
  yaw: number;
  clock: number;
  view?: FaceView;
}
const rigs = new WeakMap<Phaser.GameObjects.Graphics, Map<TwinIndex, Rig>>();
/** Every live rig, so a phase change can move all of them off an old atlas. */
const live = new Set<Rig>();
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const atlasKey = (phase: Phase) => `vtwins-atlas-${phase}`;
const sizes = new Map(twinsPieces(1).map((p) => [p.name, p]));

/** The phase's atlas, drawn once and kept while the phase lasts. */
/** Draw the phase's atlas now (while the battle loads), not on the first frame. */
export const prewarmAtlas = (scene: Phaser.Scene, phase: Phase) => {
  atlas(scene, phase);
};
function atlas(scene: Phaser.Scene, phase: Phase) {
  const key = atlasKey(phase);
  if (scene.textures.exists(key)) return key;
  const packed = packTwinPieces(phase, PX);
  const canvas = document.createElement("canvas");
  canvas.width = packed.width;
  canvas.height = Math.max(1, packed.height);
  const ctx = canvas.getContext("2d");
  if (ctx) paintTwinPieces(ctx, packed.spots, PX);
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
      if (rig.root.scene === scene)
        for (const img of rig.images.values())
          if (img.texture.key === key) img.setTexture(atlasKey(phase), "glint");
    scene.textures.remove(key);
  }
}

/**
 * Show one twin for this frame in the graphics layer `g`. Returns where its
 * head and core are in that layer, or false when the layer is not in a
 * running scene.
 */
export function paintVectorTwin(
  g: Phaser.GameObjects.Graphics,
  o: VectorTwinLook,
) {
  const scene = g.scene;
  if (!scene?.sys?.isActive?.()) return false;
  const phase = clamp(Math.round(o.phase), 1, 3) as Phase;
  const twin = o.twin;
  const rig = rigs.get(g)?.get(twin) ?? createRig(g, twin);
  const dt = clamp(o.clock - rig.clock, 0, 0.1);
  const first = rig.facing === undefined;
  const turn = twinTurn(o.angle, rig.facing, rig.yaw, dt, first || o.reduced);
  rig.facing = turn.facing;
  rig.yaw = turn.yaw;
  rig.clock = o.clock;
  const P = twinPose({ ...o, clock: o.clock });
  const placed = twinPlacements(P, rig.yaw, twin, rig.view);
  rig.view = placed.view;
  const sheet = atlas(scene, phase);
  const S = TWINS_SCALE;

  rig.frame = scene.game.loop.frame;
  rig.root.setData("facing", turn.facing);
  rig.root.setData("view", placed.view);
  rig.root.setDepth(g.depth + 0.001).setAlpha(g.alpha);
  rig.actor.setPosition(o.x, o.y);
  rig.glows.setPosition(o.x, o.y);
  rig.halo.setPosition(o.x, o.y);
  const tint =
    o.dead || o.down
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
      (p.glow ? (p.key === "aura" ? rig.halo : rig.glows) : rig.actor).add(img);
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
  for (const [key, img] of rig.images)
    if (!seen.has(key)) img.setVisible(false);
  rig.actor.sort("vz");
  const head = { x: o.x + placed.head.x * S, y: o.y + placed.head.y * S },
    core = { x: o.x + placed.core.x * S, y: o.y + placed.core.y * S };
  // the open weak point's ring, as every boss shows it
  rig.front.clear();
  if (P.exposed > 0.02 && !o.dead && !o.down) {
    rig.front.fillStyle(0xaaffdf, 0.15).fillCircle(core.x, core.y, 22);
    rig.front.lineStyle(2.5, 0xd9ffdb, 0.85).strokeCircle(core.x, core.y, 22);
  }
  dropOtherAtlases(scene, phase);
  return { head, core };
}

function createRig(g: Phaser.GameObjects.Graphics, twin: TwinIndex): Rig {
  const scene = g.scene;
  const actor = scene.add.container(0, 0);
  const glows = scene.add.container(0, 0).setBlendMode("ADD");
  const halo = scene.add.container(0, 0).setBlendMode("ADD");
  const front = scene.add.graphics().setName("vector-boss-front");
  const root = scene.add
    .container(0, 0, [halo, actor, glows, front])
    .setName(`vector-boss-twin-${twin}`);
  const rig: Rig = {
    root,
    actor,
    glows,
    halo,
    front,
    images: new Map(),
    frame: -1,
    yaw: 0,
    clock: 0,
  };
  let byTwin = rigs.get(g);
  if (!byTwin) rigs.set(g, (byTwin = new Map()));
  byTwin.set(twin, rig);
  live.add(rig);
  const dispose = () => {
    scene.events.off("prerender", sync);
    g.off("destroy", dispose);
    root.destroy();
    live.delete(rig);
    const m = rigs.get(g);
    m?.delete(twin);
    if (m && !m.size) rigs.delete(g);
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
