/**
 * The Sun Atrium's pieces in the battle scene (raid-prismatail-atrium.ts has
 * the drawing and the layout). As with the vector bosses, every piece is
 * drawn once into one atlas, when the battle scene is created
 * (boss-vector-prewarm.ts); each frame only places, turns, scales and fades
 * images from it, in normal blending (added light washes out on the bright
 * marble):
 *
 * - the floor layer, just under the battle graphics, so live warnings stay
 *   on top: range rings, medallions, arrows, beams;
 * - one layer per standing thing (mirror, pillar, skylight), sorted with the
 *   raiders by its ground line through the scene's LayerAt;
 * - the light layer over the raiders (still under skill effects and the HUD):
 *   sunbeams, chimes, sparks, flares and the Blinded marker.
 */
import type Phaser from "phaser";
import type { Snapshot } from "@arena/shared";
import { addCanvasTexture } from "./canvas-texture";
import { fxFor } from "./fx-engine";
import type { LayerAt } from "./raid-layers";
import {
  atriumFrame,
  atriumPieces,
  atriumRange,
  atriumSources,
  packAtrium,
  paintAtrium,
  type Placement,
} from "./raid-prismatail-atrium";

/** Texture pixels per world unit: sharp on 2× screens and close cameras. */
const Q = 2;
export const ATRIUM_ATLAS = "atrium-prisma-atlas";
/** The light layer: over the raiders (≈2.0–2.1), under skill effects (3.6). */
const TOP_DEPTH = 2.5;
const pieces = new Map(atriumPieces().map((p) => [p.name, p]));

type Img = Phaser.GameObjects.Image;
interface Layer {
  box: Phaser.GameObjects.Container;
  images: Img[];
}
interface Rig {
  floor: Layer;
  top: Layer;
  stands: Map<string, Layer>;
  frame: number;
  clock: number;
  angles: number[];
  shown: number[];
  turnedAt: number[];
}
const rigs = new WeakMap<Phaser.GameObjects.Graphics, Rig>();

/** Draw the atlas now (the battle scene is being created), not on the first frame. */
export function prewarmAtriumAtlas(scene: Phaser.Scene) {
  atlas(scene);
}
function atlas(scene: Phaser.Scene) {
  if (scene.textures.exists(ATRIUM_ATLAS)) return ATRIUM_ATLAS;
  const packed = packAtrium(Q);
  const canvas = document.createElement("canvas");
  canvas.width = packed.width;
  canvas.height = Math.max(1, packed.height);
  const ctx = canvas.getContext("2d");
  if (ctx) paintAtrium(ctx, packed.spots, Q);
  // A plain image source (canvas-texture.ts): no pixel read-back.
  const texture = addCanvasTexture(scene.textures, ATRIUM_ATLAS, canvas);
  for (const s of packed.spots)
    texture?.add(s.piece.name, 0, s.x, s.y, s.w, s.h);
  return ATRIUM_ATLAS;
}

/**
 * Show the atrium's pieces for this frame. Returns false when the layer is
 * not in a running scene (nothing is drawn then).
 */
export function paintAtriumRig(
  g: Phaser.GameObjects.Graphics,
  state: Snapshot,
  reduced: boolean,
  at: LayerAt | undefined,
  clock: number,
) {
  const scene = g.scene;
  const r = state.raid;
  if (!r || !scene?.sys?.isActive?.()) return false;
  const sheet = atlas(scene);
  const rig = rigs.get(g) ?? createRig(g);
  const dt = Math.max(0, Math.min(0.1, clock - rig.clock));
  rig.clock = clock;
  rig.frame = scene.game.loop.frame;
  const mirrors = (r.mirrors ?? []).map((m, i) => {
    const last = rig.angles[i];
    // a turn: ring the chime (the server turns a mirror 45° per hit)
    if (last !== undefined && Math.abs(last - m.angle) > 0.01)
      rig.turnedAt[i] = clock;
    rig.angles[i] = m.angle;
    let shown = rig.shown[i];
    if (shown === undefined || reduced) shown = m.angle;
    else {
      const d = Math.atan2(
        Math.sin(m.angle - shown),
        Math.cos(m.angle - shown),
      );
      shown += d * Math.min(1, dt * 16);
    }
    rig.shown[i] = shown;
    return {
      x: m.x,
      y: m.y,
      angle: m.angle,
      shown,
      turnAge: clock - (rig.turnedAt[i] ?? -Infinity),
    };
  });
  const frame = atriumFrame({
    mirrors,
    links: r.lightLinks ?? [],
    sources: atriumSources(r),
    range: atriumRange(r.trait),
    lit: r.exposedUntil <= state.time,
    pillars: r.sunPillars ?? [],
    blinded: state.players.filter((p) => (r.blinded?.[p.id] ?? 0) > state.time),
    time: state.time,
    anim: clock,
    // Low's glow budget is finite (battle-quality.ts).
    low: Number.isFinite(fxFor(scene).glowBudget),
    reduced,
  });
  rig.floor.box.setDepth(g.depth - 0.002);
  show(scene, sheet, rig.floor, frame.floor);
  show(scene, sheet, rig.top, frame.top);
  const seen = new Set<string>();
  for (const s of frame.stands) {
    let layer = rig.stands.get(s.key);
    if (!layer) {
      layer = makeLayer(scene, `atrium-${s.key}`);
      rig.stands.set(s.key, layer);
    }
    seen.add(s.key);
    // sorts with the raiders exactly as the scene's own layer for it would
    const depth = at ? at(s.key, s.groundY).depth : 2 + s.groundY / 10000;
    layer.box.setDepth(depth + 0.00001).setVisible(true);
    show(scene, sheet, layer, s.items);
  }
  for (const [key, layer] of rig.stands)
    if (!seen.has(key)) layer.box.setVisible(false);
  return true;
}
function show(
  scene: Phaser.Scene,
  sheet: string,
  layer: Layer,
  list: Placement[],
) {
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    let img = layer.images[i];
    if (!img) {
      img = scene.add.image(0, 0, sheet, p.piece);
      layer.box.add(img);
      layer.images.push(img);
    } else if (img.frame.name !== p.piece || img.texture.key !== sheet)
      img.setTexture(sheet, p.piece);
    const piece = pieces.get(p.piece)!;
    const k = Q * piece.q;
    img
      .setName(`atrium-${p.piece}`)
      .setVisible(true)
      .setOrigin(piece.ox / piece.w, piece.oy / piece.h)
      .setPosition(p.x, p.y)
      .setRotation(p.rot ?? 0)
      .setScale((p.sx ?? 1) / k, (p.sy ?? 1) / k)
      .setAlpha(Math.max(0, Math.min(1, p.alpha ?? 1)))
      .setTint(p.tint ?? 0xffffff);
  }
  for (let i = list.length; i < layer.images.length; i++)
    layer.images[i].setVisible(false);
}
function makeLayer(scene: Phaser.Scene, name: string): Layer {
  return { box: scene.add.container(0, 0).setName(name), images: [] };
}
function createRig(g: Phaser.GameObjects.Graphics): Rig {
  const scene = g.scene;
  const rig: Rig = {
    floor: makeLayer(scene, "atrium-floor"),
    top: makeLayer(scene, "atrium-light"),
    stands: new Map(),
    frame: -1,
    clock: 0,
    angles: [],
    shown: [],
    turnedAt: [],
  };
  rig.top.box.setDepth(TOP_DEPTH);
  rigs.set(g, rig);
  const boxes = () => [
    rig.floor.box,
    rig.top.box,
    ...[...rig.stands.values()].map((l) => l.box),
  ];
  const dispose = () => {
    scene.events.off("prerender", sync);
    g.off("destroy", dispose);
    for (const box of boxes()) box.destroy();
    rigs.delete(g);
  };
  // Shown only on frames the atrium was drawn (it is a raid's floor).
  const sync = () => {
    if (scene.game.loop.frame - rig.frame > 120) {
      dispose();
      return;
    }
    const on = g.visible && g.active && rig.frame === scene.game.loop.frame;
    rig.floor.box.setVisible(on);
    rig.top.box.setVisible(on);
    if (!on) for (const l of rig.stands.values()) l.box.setVisible(false);
  };
  scene.events.on("prerender", sync);
  g.once("destroy", dispose);
  return rig;
}
