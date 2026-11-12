/**
 * Raid arena pieces as images, the way the vector bosses draw
 * (boss-vector-tide-rig.ts): every piece is painted once into one atlas
 * canvas (no pixel read-back, canvas-texture.ts), and each frame only
 * places, scales, turns and fades images from it, plus a few cheap lines.
 *
 * A stage is a pool of images that rides on a graphics layer: it takes that
 * layer's depth (so a lantern post still sorts with the raiders by its base)
 * and goes away with it. Images are drawn in the order they are placed this
 * frame; the stage's own lines draw over them.
 */
import type Phaser from "phaser";
import { addCanvasTexture } from "./canvas-texture";

export type Ctx = CanvasRenderingContext2D;
export interface PieceDef {
  name: string;
  /** Size in world pixels. */
  w: number;
  h: number;
  /** Anchor, in world pixels from the top-left: where the piece is placed. */
  ax: number;
  ay: number;
  /** Texture pixels per world pixel. */
  q: number;
  /** Paint it: 1 unit = 1 world px, origin at the cell's top-left; k = q. */
  draw: (c: Ctx, k: number) => void;
  /** Extra frames cut from this piece (world px rectangles inside it). */
  slices?: { name: string; x: number; y: number; w: number; h: number }[];
}
export interface Spot {
  def: PieceDef;
  /** The cell's top-left in the atlas, and its size (texture px). */
  x: number;
  y: number;
  pw: number;
  ph: number;
}
/** Texture size of a piece's cell. */
export const cellSize = (d: PieceDef) => ({
  pw: Math.max(1, Math.ceil(d.w * d.q)),
  ph: Math.max(1, Math.ceil(d.h * d.q)),
});
/** Shelf-pack the pieces (tallest first), a gap between cells. */
export function packPieces(defs: PieceDef[], width = 2048, gap = 2) {
  const list = defs
    .map((def) => ({ def, ...cellSize(def) }))
    .sort((a, b) => b.ph - a.ph || a.def.name.localeCompare(b.def.name));
  let x = 0,
    y = 0,
    shelf = 0;
  const spots: Spot[] = [];
  for (const it of list) {
    if (it.pw > width) throw new Error(`piece ${it.def.name} is too wide`);
    if (x + it.pw > width) {
      x = 0;
      y += shelf + gap;
      shelf = 0;
    }
    spots.push({ def: it.def, x, y, pw: it.pw, ph: it.ph });
    x += it.pw + gap;
    shelf = Math.max(shelf, it.ph);
  }
  return { width, height: Math.max(1, Math.ceil(y + shelf)), spots };
}
/** Paint every piece into its cell (each clipped to it). */
export function paintSpots(ctx: Ctx, spots: Spot[]) {
  for (const s of spots) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(s.x, s.y, s.pw, s.ph);
    ctx.clip();
    ctx.translate(s.x, s.y);
    ctx.scale(s.def.q, s.def.q);
    s.def.draw(ctx, s.def.q);
    ctx.restore();
  }
}

interface AtlasInfo {
  defs: Map<string, PieceDef>;
  width: number;
  height: number;
}
const atlases = new Map<string, AtlasInfo>();
/** Size of an atlas built in this page (texture px), for tests and notes. */
export const atlasSize = (key: string) => {
  const a = atlases.get(key);
  return a ? { width: a.width, height: a.height } : undefined;
};
/**
 * The atlas texture `key`, painted once: built now if it is missing. Frames
 * are named after the pieces (and their slices).
 */
export function pieceAtlas(
  scene: Phaser.Scene,
  key: string,
  defs: () => PieceDef[],
) {
  if (scene.textures.exists(key) && atlases.has(key)) return key;
  const list = defs();
  const packed = packPieces(list);
  const canvas = document.createElement("canvas");
  canvas.width = packed.width;
  canvas.height = packed.height;
  const ctx = canvas.getContext("2d");
  if (ctx) paintSpots(ctx, packed.spots);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  // A plain image source (canvas-texture.ts): no pixel read-back.
  const texture = addCanvasTexture(scene.textures, key, canvas);
  for (const s of packed.spots) {
    texture?.add(s.def.name, 0, s.x, s.y, s.pw, s.ph);
    for (const c of s.def.slices ?? [])
      texture?.add(
        c.name,
        0,
        s.x + Math.round(c.x * s.def.q),
        s.y + Math.round(c.y * s.def.q),
        Math.round(c.w * s.def.q),
        Math.round(c.h * s.def.q),
      );
  }
  canvas.dataset.pieceAtlas = key;
  atlases.set(key, {
    defs: new Map(list.map((d) => [d.name, d])),
    width: packed.width,
    height: packed.height,
  });
  return key;
}
/** Remove an atlas no longer needed (another look replaced it). */
export function dropAtlas(scene: Phaser.Scene, key: string) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  atlases.delete(key);
}

export interface PutOptions {
  alpha?: number;
  /** Scale (world size relative to the piece's own). */
  sx?: number;
  sy?: number;
  rot?: number;
  /** Additive light. */
  add?: boolean;
}
type Img = Phaser.GameObjects.Image;
/** One frame's pool of images from an atlas, riding on a host layer. */
export class PieceStage {
  readonly root: Phaser.GameObjects.Container;
  /** Thin lines drawn over this stage's images, cleared every frame. */
  readonly lines: Phaser.GameObjects.Graphics;
  private readonly images: Img[] = [];
  private used = 0;
  frame = -1;
  constructor(
    private readonly scene: Phaser.Scene,
    name: string,
  ) {
    this.lines = scene.add.graphics().setName(`${name}:lines`);
    this.root = scene.add.container(0, 0, [this.lines]).setName(name);
  }
  /** Start this frame (a second call in the same frame keeps going). */
  begin(depth: number) {
    const frame = this.scene.game.loop.frame;
    if (frame !== this.frame) {
      this.frame = frame;
      this.used = 0;
      this.lines.clear();
    }
    this.root.setDepth(depth).setVisible(true);
    return this;
  }
  /** Place one piece of the atlas at (x, y) (its anchor), this frame only. */
  put(atlas: string, frame: string, x: number, y: number, o: PutOptions = {}) {
    const alpha = o.alpha ?? 1;
    if (alpha <= 0.004) return;
    const def = atlases.get(atlas)?.defs.get(frame);
    let img = this.images[this.used];
    if (!img) {
      img = this.scene.add.image(0, 0, atlas, frame);
      this.root.addAt(img, this.used);
      this.images.push(img);
    }
    this.used++;
    if (img.texture.key !== atlas || img.frame.name !== frame)
      img.setTexture(atlas, frame);
    // Exact world size: the frame (whole texels) covers the piece's w × h.
    const fw = img.frame.width || 1,
      fh = img.frame.height || 1;
    const w = def?.w ?? fw,
      h = def?.h ?? fh;
    img
      .setVisible(true)
      .setOrigin(def ? def.ax / def.w : 0.5, def ? def.ay / def.h : 0.5)
      .setPosition(x, y)
      .setScale(((o.sx ?? 1) * w) / fw, ((o.sy ?? o.sx ?? 1) * h) / fh)
      .setRotation(o.rot ?? 0)
      .setAlpha(Math.min(1, alpha))
      .setBlendMode(o.add ? 1 : 0);
    img.setName(frame);
    return img;
  }
  /** Place a slice frame by its top-left corner, at its own size. */
  slice(
    atlas: string,
    frame: string,
    x: number,
    y: number,
    w: number,
    h: number,
    alpha: number,
  ) {
    const img = this.put(atlas, frame, x, y, { alpha });
    if (!img) return;
    img
      .setOrigin(0, 0)
      .setScale(w / (img.frame.width || 1), h / (img.frame.height || 1));
  }
  /** Stretch a strip piece from a to b (anchored at its left middle). */
  strip(
    atlas: string,
    frame: string,
    a: { x: number; y: number },
    b: { x: number; y: number },
    thick: number,
    o: PutOptions & { flip?: boolean } = {},
  ) {
    const def = atlases.get(atlas)?.defs.get(frame);
    if (!def) return;
    const dx = b.x - a.x,
      dy = b.y - a.y,
      len = Math.hypot(dx, dy) || 1;
    return this.put(atlas, frame, a.x, a.y, {
      ...o,
      rot: Math.atan2(dy, dx),
      sx: len / def.w,
      sy: (thick / def.h) * (o.flip ? -1 : 1),
    });
  }
  /** The pieces placed this frame (frame names), for tests and counts. */
  placed() {
    return this.images.slice(0, this.used).map((i) => i.frame.name);
  }
  /** After the frame's drawing: hide what was not placed. */
  settle() {
    for (let i = this.used; i < this.images.length; i++)
      this.images[i].setVisible(false);
  }
  destroy() {
    this.root.destroy();
  }
}

const stages = new WeakMap<
  Phaser.GameObjects.Graphics,
  Map<string, PieceStage>
>();
/**
 * The stage `name` on the host layer `host`, begun for this frame at
 * `depth` (default: just over the host, so it sorts where the host does).
 * Undefined when the host is not in a running scene (tests, a closed
 * battle): then nothing is drawn.
 */
export function stageOn(
  host: Phaser.GameObjects.Graphics,
  name: string,
  depth = host.depth + 0.000001,
) {
  const scene = host.scene;
  if (!scene?.sys?.isActive?.() || !scene.game?.loop) return undefined;
  let byName = stages.get(host);
  if (!byName) {
    byName = new Map();
    stages.set(host, byName);
  }
  let stage = byName.get(name);
  if (!stage) {
    const made = new PieceStage(scene, name);
    stage = made;
    byName.set(name, made);
    const map = byName;
    const dispose = () => {
      scene.events.off("prerender", sync);
      host.off("destroy", dispose);
      made.destroy();
      map.delete(name);
    };
    // Shown only on frames it was drawn in, while its host is shown.
    const sync = () => {
      const age = scene.game.loop.frame - made.frame;
      if (age > 120) return dispose();
      made.settle();
      made.root.setVisible(age === 0 && host.visible && host.active);
    };
    scene.events.on("prerender", sync);
    host.once("destroy", dispose);
  }
  return stage.begin(depth);
}
