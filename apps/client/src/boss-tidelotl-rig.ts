/**
 * Tidelotl in the battle scene (boss-tidelotl.ts has the pose and the
 * placements, boss-tidelotl-paint.ts the painters). Every piece is painted
 * once into two atlases when the battle loads: a main one (face, gills,
 * pearl, water) and a skin one (head, body, legs, tail), whose colours
 * follow the phase. A new phase repaints the skin atlas in place, a few
 * milliseconds a frame and never while an attack is winding up, and uploads
 * it once when it is done, so the whole body changes colour together and no
 * second atlas is ever held. Each frame only moves, turns, scales, fades and
 * crops (at the waterline) images from the two atlases. Glows go through
 * the effects engine.
 */
import type Phaser from "phaser";
import { addCanvasTexture, updateCanvasTexture } from "./canvas-texture";
import { fxFor } from "./fx-engine";
import {
  LOTL_SCALE,
  lotlFacing,
  tidelotlPieces,
  tidelotlPlacements,
  tidelotlPose,
  paintPiece,
  pack,
  type LotlCue,
  type LotlPiece,
} from "./boss-tidelotl";

const MAIN = "lotl-main",
  SKIN = "lotl-skin";

export interface TidelotlLook extends Omit<LotlCue, "clock"> {
  x: number;
  y: number;
  /** Where it faces (screen radians). */
  angle: number;
  clock: number;
  gilded: boolean;
  /** Is there water (true) or an island's sand (false) at this floor spot? */
  wet: (x: number, y: number) => boolean;
}

// ── the atlases ──
interface Slot {
  sx: number;
  sy: number;
  w: number;
  h: number;
  q: number;
  /** The piece's origin inside its frame (0–1). */
  ox: number;
  oy: number;
}
interface Atlas {
  slots: Map<string, Slot>;
  page: HTMLCanvasElement;
  key: string;
}
interface SceneAtlas {
  main: Atlas;
  skin: Atlas;
  phase: number;
  /** A phase repaint under way: the skin pieces still to paint. */
  job?: { phase: number; todo: LotlPiece[] };
  bytes: number;
}
const atlases = new WeakMap<Phaser.Scene, SceneAtlas>();
const pieceList = () => tidelotlPieces();
function addFrames(scene: Phaser.Scene, a: Atlas) {
  const tex = addCanvasTexture(scene.textures, a.key, a.page);
  for (const [name, s] of a.slots) tex?.add(name, 0, s.sx, s.sy, s.w, s.h);
}
/** Paint both atlases now (while the battle loads), for the raid's phase. */
export function prewarmAtlas(scene: Phaser.Scene, phase: number) {
  atlasFor(scene, phase);
}
function atlasFor(scene: Phaser.Scene, phase: number): SceneAtlas | undefined {
  let A = atlases.get(scene);
  if (A && scene.textures.exists(MAIN) && scene.textures.exists(SKIN)) return A;
  if (typeof document === "undefined") return undefined;
  const all = pieceList();
  const paintAll = (list: LotlPiece[]) =>
    list.flatMap((p) => {
      const out = paintPiece(p, phase);
      return out ? [{ name: p.name, p: out }] : [];
    });
  for (const key of [MAIN, SKIN])
    if (scene.textures.exists(key)) scene.textures.remove(key);
  const m = pack(paintAll(all.filter((p) => !p.skin))),
    s = pack(paintAll(all.filter((p) => p.skin)));
  A = {
    main: { ...m, key: MAIN },
    skin: { ...s, key: SKIN },
    phase,
    bytes: (m.page.width * m.page.height + s.page.width * s.page.height) * 4,
  };
  addFrames(scene, A.main);
  addFrames(scene, A.skin);
  atlases.set(scene, A);
  return A;
}
/** Repaint skin pieces for a new phase into their own slots, within `ms`; upload once when all are done. */
function stepRepaint(scene: Phaser.Scene, A: SceneAtlas, ms: number) {
  const J = A.job;
  if (!J) return;
  const until = performance.now() + ms,
    g = A.skin.page.getContext("2d")!;
  while (J.todo.length && performance.now() < until) {
    const p = J.todo.shift()!,
      s = A.skin.slots.get(p.name),
      out = paintPiece(p, J.phase);
    if (!s || !out) continue;
    g.save();
    g.beginPath();
    g.rect(s.sx, s.sy, s.w, s.h);
    g.clip();
    g.clearRect(s.sx, s.sy, s.w, s.h);
    g.drawImage(
      out.canvas,
      Math.round(s.sx + s.ox * s.w - out.ox),
      Math.round(s.sy + s.oy * s.h - out.oy),
    );
    g.restore();
    out.canvas.width = out.canvas.height = 0;
  }
  if (!J.todo.length) {
    A.phase = J.phase;
    A.job = undefined;
    updateCanvasTexture(scene.textures, SKIN);
  }
}
/** The atlas's memory in bytes (both pages), for tests. */
export function tidelotlAtlasBytes(scene: Phaser.Scene) {
  return atlases.get(scene)?.bytes ?? 0;
}
/** The phase the skin atlas currently shows, for tests. */
export function tidelotlSkinPhase(scene: Phaser.Scene) {
  const A = atlases.get(scene);
  return A ? (A.job ? -A.job.phase : A.phase) : 0;
}

// ── the rig ──
type Sorted = Phaser.GameObjects.Image & { vz: number };
interface Rig {
  root: Phaser.GameObjects.Container;
  actor: Phaser.GameObjects.Container;
  front: Phaser.GameObjects.Graphics;
  images: Map<string, Sorted>;
  frame: number;
  facing?: number;
  spin: number;
  clock: number;
}
const rigs = new WeakMap<Phaser.GameObjects.Graphics, Rig>();
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
/** Below this local y the water hides the body (the fade and foam cover the cut). */
const WATER_Y = 6;

/**
 * Show Tidelotl for this frame in the graphics layer `g`. Returns where its
 * head and pearl are in that layer, or false when the layer is not in a
 * running scene.
 */
export function paintTidelotl(g: Phaser.GameObjects.Graphics, o: TidelotlLook) {
  const scene = g.scene;
  if (!scene?.sys?.isActive?.()) return false;
  const phase = clamp(Math.round(o.phase), 1, 3);
  const A = atlasFor(scene, phase);
  if (!A) return false;
  // a new phase repaints the skin, but never while an attack winds up
  if (phase !== A.phase && (!A.job || A.job.phase !== phase))
    A.job = { phase, todo: pieceList().filter((p) => p.skin) };
  if (A.job && !o.windKind) stepRepaint(scene, A, o.reduced ? 12 : 4);
  const rig = rigs.get(g) ?? createRig(g);
  const dt = clamp(o.clock - rig.clock, 0, 0.1);
  rig.clock = o.clock;
  rig.facing = lotlFacing(o.angle, rig.facing);
  // spins: the Undertow winds up and pulls; the tail sweep turns once round
  const spinning =
    !o.reduced &&
    !o.dead &&
    (o.windKind === "undertow" || (o.castKind === "undertow" && o.castAge < 3));
  if (spinning)
    rig.spin +=
      dt * 9 * (o.windKind === "undertow" ? clamp(o.windup * 1.4) : 1);
  else rig.spin = Math.round(rig.spin);
  const sweep =
    !o.reduced && o.castKind === "slam" && o.castAge < 0.6
      ? 8 * clamp(o.castAge / 0.6) ** 0.8
      : 0;
  const facing = rig.facing + (rig.spin % 8) + sweep;
  const P = tidelotlPose({ ...o, clock: o.clock });
  const wet = !o.stranded && o.wet(o.x, o.y);
  const layout = tidelotlPlacements(
    P,
    spinning || sweep ? facing : Math.round(facing) % 8,
    phase,
    wet,
  );

  rig.frame = scene.game.loop.frame;
  rig.root.setData("facing", Math.round(facing) % 8);
  rig.root.setDepth(g.depth + 0.001).setAlpha(g.alpha);
  rig.actor.setPosition(o.x, o.y);
  const tint = o.dead
    ? 0x9b97a0
    : o.hurt > 0.65
      ? 0xffe5d8
      : o.gilded
        ? 0xffe1ad
        : 0xffffff;
  const seen = new Set<string>();
  let order = 0;
  for (const p of layout.placements) {
    const atlas = A.main.slots.has(p.piece) ? A.main : A.skin,
      slot = atlas.slots.get(p.piece);
    if (!slot) continue;
    let img = rig.images.get(p.key);
    if (!img) {
      img = scene.add.image(0, 0, atlas.key, p.piece) as Sorted;
      img.setName(`vector-part-${p.key}`);
      rig.actor.add(img);
      rig.images.set(p.key, img);
    } else if (img.texture.key !== atlas.key || img.frame.name !== p.piece)
      img.setTexture(atlas.key, p.piece);
    seen.add(p.key);
    img.vz = order++;
    const isx = p.sx / slot.q,
      isy = p.sy / slot.q;
    img
      .setVisible(true)
      .setOrigin(slot.ox, slot.oy)
      .setPosition(p.x, p.y)
      .setRotation(p.rot)
      .setScale(isx, isy)
      .setAlpha(clamp(p.alpha))
      .setTint(
        p.piece.startsWith("swirl") ||
          p.piece.startsWith("foam") ||
          p.piece === "fade"
          ? 0xffffff
          : tint,
      );
    // in the water: keep only what is above the waterline
    if (p.water && isy > 0) {
      const fh = slot.h,
        top = p.y - slot.oy * fh * isy,
        keep = clamp((WATER_Y - top) / (fh * isy || 1));
      if (keep <= 0) img.setVisible(false);
      else if (keep < 1) img.setCrop(0, 0, slot.w, fh * keep);
      else if (img.isCropped) img.setCrop();
    } else if (img.isCropped) img.setCrop();
  }
  for (const [key, img] of rig.images)
    if (!seen.has(key)) img.setVisible(false);
  rig.actor.sort("vz");
  const pearl = { x: o.x + layout.pearl.x, y: o.y + layout.pearl.y };
  // the pearl's glow and, in the last phase, the top gills' (the effects engine's light)
  const fx = fxFor(scene);
  if (!o.dead && P.h > -40 && (layout.pearlVisible || P.exposed > 0.05))
    fx.glow(
      pearl.x,
      pearl.y,
      (16 + P.exposed * 12) * LOTL_SCALE,
      0xc8fffa,
      (0.25 + 0.35 * P.pearl + 0.1 * (phase - 1)) *
        (layout.pearlVisible ? 1 : 0.5),
    );
  if (phase >= 3 && !o.dead && P.h > -30)
    fx.glow(o.x + layout.gillTip.x, o.y + layout.gillTip.y, 14, 0xff78b8, 0.45);
  // the open weak point's ring, as every boss shows it
  rig.front.clear();
  if (P.exposed > 0.02 && !o.dead) {
    rig.front.fillStyle(0xaaffdf, 0.15).fillCircle(pearl.x, pearl.y, 22);
    rig.front.lineStyle(2.5, 0xd9ffdb, 0.85).strokeCircle(pearl.x, pearl.y, 22);
  }
  return {
    head: { x: o.x + layout.head.x, y: o.y + layout.head.y },
    top: { x: o.x + layout.top.x, y: o.y + layout.top.y },
    pearl,
    mouth: { x: o.x + layout.mouth.x, y: o.y + layout.mouth.y },
  };
}

function createRig(g: Phaser.GameObjects.Graphics): Rig {
  const scene = g.scene;
  const actor = scene.add.container(0, 0);
  const front = scene.add.graphics().setName("vector-boss-front");
  const root = scene.add
    .container(0, 0, [actor, front])
    .setName("vector-boss-tidewyrm");
  const rig: Rig = {
    root,
    actor,
    front,
    images: new Map(),
    frame: -1,
    spin: 0,
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
