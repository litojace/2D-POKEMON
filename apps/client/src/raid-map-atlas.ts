/**
 * Raid arena components drawn as painted pieces (Tidewyrm's Lagoon Court,
 * Somnara's Cloud Deck), the same way the vector bosses are
 * (boss-vector-tide-rig.ts): every piece is drawn once into one atlas canvas
 * per look, added as a texture without reading its pixels back
 * (canvas-texture.ts), and each frame only places, scales, rotates and fades
 * images from it, plus a few cheap lines.
 *
 * The images live in containers that follow the arena's graphics layer:
 * `under` and `over` sit just below it (so live warnings drawn in it stay on
 * top of the floor art), with `lines` between them; `top` floats above the
 * fighters (bubbles, overhead markers, a shockwave).
 */
import type Phaser from "phaser";
import { addCanvasTexture } from "./canvas-texture";

export type Ctx = CanvasRenderingContext2D;
export interface MapPiece {
  name: string;
  /** Size in world units. */
  w: number;
  h: number;
  /** Anchor in world units from the piece's top left (default: its centre). */
  ax?: number;
  ay?: number;
  /** Texture resolution relative to the atlas (soft glows use less). */
  res?: number;
  /** Draws around the anchor; ctx is already scaled to world units. */
  draw: (c: Ctx, k: number) => void;
}
export interface PackedPiece {
  name: string;
  w: number;
  h: number;
  ax: number;
  ay: number;
  res: number;
  x: number;
  y: number;
  pw: number;
  ph: number;
  draw: MapPiece["draw"];
}
const GAP = 2;
/** Shelf-pack pieces (tallest first) into a canvas `maxW` wide, at k texels per unit. */
export function packMapPieces(pieces: MapPiece[], k: number, maxW = 2048) {
  const spots: PackedPiece[] = pieces.map((p) => {
    const res = p.res ?? 1;
    return {
      name: p.name,
      w: p.w,
      h: p.h,
      ax: p.ax ?? p.w / 2,
      ay: p.ay ?? p.h / 2,
      res,
      x: 0,
      y: 0,
      pw: Math.ceil(p.w * k * res),
      ph: Math.ceil(p.h * k * res),
      draw: p.draw,
    };
  });
  let x = GAP,
    y = GAP,
    row = 0;
  for (const s of [...spots].sort((a, b) => b.ph - a.ph)) {
    if (x + s.pw + GAP > maxW) {
      x = GAP;
      y += row + GAP;
      row = 0;
    }
    s.x = x;
    s.y = y;
    x += s.pw + GAP;
    row = Math.max(row, s.ph);
  }
  return { width: maxW, height: y + row + GAP, spots };
}
/** Draw every packed piece once into its own clipped cell. */
export function paintMapPieces(ctx: Ctx, spots: PackedPiece[], k: number) {
  for (const s of spots) {
    const q = k * s.res;
    ctx.save();
    ctx.beginPath();
    ctx.rect(s.x, s.y, s.pw, s.ph);
    ctx.clip();
    ctx.translate(s.x + s.ax * q, s.y + s.ay * q);
    ctx.scale(q, q);
    s.draw(ctx, q);
    ctx.restore();
  }
}

export interface MapAtlas {
  key: string;
  k: number;
  width: number;
  height: number;
  spots: Map<string, PackedPiece>;
}
const atlases = new Map<string, MapAtlas>();
/** The atlas `key`, drawn now if it is not there yet (never per frame). */
export function mapAtlas(
  scene: Phaser.Scene,
  key: string,
  pieces: () => MapPiece[],
  k: number,
): MapAtlas | undefined {
  const known = atlases.get(key);
  if (known && scene.textures.exists(key)) return known;
  if (typeof document === "undefined") return undefined;
  const packed = packMapPieces(pieces(), k);
  const canvas = document.createElement("canvas");
  canvas.width = packed.width;
  canvas.height = Math.max(1, packed.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  paintMapPieces(ctx, packed.spots, k);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  // A plain image source (canvas-texture.ts): no pixel read-back.
  const texture = addCanvasTexture(scene.textures, key, canvas);
  for (const s of packed.spots) texture?.add(s.name, 0, s.x, s.y, s.pw, s.ph);
  // For tests: its size, and whether it was drawn while the scene was being
  // created (Phaser's CREATING, 4) or later, mid-battle (RUNNING, 5).
  if (texture)
    (texture.customData as Record<string, unknown>).mapAtlas = {
      width: packed.width,
      height: canvas.height,
      k,
      pieces: packed.spots.length,
      builtWhile: scene.sys.settings.status,
    };
  const atlas: MapAtlas = {
    key,
    k,
    width: packed.width,
    height: canvas.height,
    spots: new Map(packed.spots.map((s) => [s.name, s])),
  };
  atlases.set(key, atlas);
  return atlas;
}
/** What has been built (for tests and the report). */
export function mapAtlasInfo(key: string) {
  const a = atlases.get(key);
  return (
    a && { width: a.width, height: a.height, k: a.k, pieces: a.spots.size }
  );
}

// ---------------------------------------------------------------- Quality
let low = false;
/** Battle graphics at Low: fewer decorative glows and sparkles. */
export function setRaidMapLow(value: boolean) {
  low = value;
}
export const raidMapLow = () => low;

// ---------------------------------------------------------------- Layers
export interface PutOptions {
  /** Uniform scale, or per axis. */
  s?: number;
  sx?: number;
  sy?: number;
  rot?: number;
  /** Alpha (0..1). */
  a?: number;
  /** Additive blending (only over dark ground: it turns white on bright floors). */
  add?: boolean;
}
type Img = Phaser.GameObjects.Image;
const NORMAL = 0,
  ADD = 1;
export class PiecePool {
  images: Img[] = [];
  n = 0;
  atlas?: MapAtlas;
  constructor(
    private scene: Phaser.Scene,
    readonly container: Phaser.GameObjects.Container,
  ) {}
  /** Place one atlas piece with its anchor at (x, y). */
  put(name: string, x: number, y: number, o: PutOptions = {}) {
    const atlas = this.atlas;
    const s = atlas?.spots.get(name);
    const a = Math.min(1, o.a ?? 1);
    if (!atlas || !s || a <= 0.004) return;
    let img = this.images[this.n];
    if (!img) {
      img = this.scene.add.image(0, 0, atlas.key, name);
      this.container.add(img);
      this.images.push(img);
    } else if (img.texture.key !== atlas.key || img.frame.name !== name)
      img.setTexture(atlas.key, name);
    this.n++;
    const q = atlas.k * s.res,
      scale = o.s ?? 1;
    img
      .setVisible(true)
      .setOrigin((s.ax * q) / s.pw, (s.ay * q) / s.ph)
      .setPosition(x, y)
      .setRotation(o.rot ?? 0)
      .setScale(((o.sx ?? 1) * scale) / q, ((o.sy ?? 1) * scale) / q)
      .setAlpha(a);
    const blend = o.add ? ADD : NORMAL;
    if (img.blendMode !== blend) img.setBlendMode(blend);
  }
  /** Stretch a piece over the rectangle (x, y, w, h), anchor ignored. */
  stretch(
    name: string,
    x: number,
    y: number,
    w: number,
    h: number,
    o: PutOptions = {},
  ) {
    const s = this.atlas?.spots.get(name);
    if (!s) return;
    this.put(name, x + s.ax * (w / s.w), y + s.ay * (h / s.h), {
      ...o,
      sx: w / s.w,
      sy: h / s.h,
    });
  }
  hideFrom(n: number) {
    for (let i = n; i < this.images.length; i++)
      if (this.images[i].visible) this.images[i].setVisible(false);
  }
}
export interface MapLayers {
  under: PiecePool;
  lines: Phaser.GameObjects.Graphics;
  over: PiecePool;
  top: PiecePool;
  /** The game frame these were last begun in. */
  frame: number;
}
const rigs = new WeakMap<Phaser.GameObjects.Graphics, MapLayers>();
/** Depth of the `top` layer: above every fighter (2 + y / 10000), under the HUD. */
const TOP_DEPTH = 3;

/**
 * Start this frame's floor art on the graphics layer `g`: every pool starts
 * empty and the lines are cleared. Pieces not placed again by the end of the
 * frame are hidden. Undefined outside a running scene.
 */
export function beginMapFrame(
  g: Phaser.GameObjects.Graphics,
  atlas: MapAtlas | undefined,
) {
  const scene = g.scene;
  if (!scene?.sys?.isActive?.() || !atlas) return undefined;
  const rig = rigs.get(g) ?? createRig(g);
  rig.frame = scene.game.loop.frame;
  for (const pool of [rig.under, rig.over, rig.top]) {
    pool.n = 0;
    pool.atlas = atlas;
  }
  rig.lines.clear();
  return rig;
}
/** This frame's layers on `g`, if beginMapFrame ran this frame. */
export function mapLayers(g: Phaser.GameObjects.Graphics) {
  const rig = rigs.get(g);
  return rig && rig.frame === g.scene?.game.loop.frame ? rig : undefined;
}
/** Every image placed this frame on `g` (for tests). */
export function mapImagesDrawn(g: Phaser.GameObjects.Graphics) {
  const rig = mapLayers(g);
  return rig ? rig.under.n + rig.over.n + rig.top.n : 0;
}

function createRig(g: Phaser.GameObjects.Graphics): MapLayers {
  const scene = g.scene;
  const under = scene.add.container(0, 0).setName("raid-map-under-images");
  const lines = scene.add.graphics().setName("raid-map-lines");
  const over = scene.add.container(0, 0).setName("raid-map-over-images");
  const floor = scene.add
    .container(0, 0, [under, lines, over])
    .setName("raid-map-floor");
  const topImages = scene.add.container(0, 0).setName("raid-map-top-images");
  const top = scene.add.container(0, 0, [topImages]).setName("raid-map-top");
  const rig: MapLayers = {
    under: new PiecePool(scene, under),
    lines,
    over: new PiecePool(scene, over),
    top: new PiecePool(scene, topImages),
    frame: -1,
  };
  rigs.set(g, rig);
  const dispose = () => {
    scene.events.off("prerender", sync);
    g.off("destroy", dispose);
    floor.destroy();
    top.destroy();
    rigs.delete(g);
  };
  const sync = () => {
    const current = rig.frame === scene.game.loop.frame;
    if (scene.game.loop.frame - rig.frame > 120) {
      dispose();
      return;
    }
    for (const pool of [rig.under, rig.over, rig.top])
      pool.hideFrom(current ? pool.n : 0);
    if (!current) lines.clear();
    const m = g.getWorldTransformMatrix();
    const shown = g.visible && g.active && current;
    for (const root of [floor, top])
      root
        .setPosition(m.tx, m.ty)
        .setRotation(m.rotation)
        .setScale(m.scaleX, m.scaleY)
        .setAlpha(g.alpha)
        .setVisible(shown);
    floor.setDepth(g.depth - 0.001);
    top.setDepth(Math.max(TOP_DEPTH, g.depth + 0.001));
  };
  scene.events.on("prerender", sync);
  g.once("destroy", dispose);
  return rig;
}
