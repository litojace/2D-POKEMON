/*
 * Element Bistro: pictures drawn once and copied every frame.
 *
 * Whatever is drawn every frame but never changes shape (a lamp, a tree, a
 * parked car, a car driving along: it only moves) is drawn once into its
 * own little canvas at the screen's scale and copied after that, as games
 * draw sprites. A picture is drawn again when the light, the season or the
 * zoom (in steps of a fifth) moves on; one not drawn for ten seconds or so
 * is let go.
 */
type Ctx = CanvasRenderingContext2D;

interface Pic {
  cv: HTMLCanvasElement;
  key: string;
  x: number;
  y: number;
  s: number;
  used: number;
}
const pics = new Map<string, Pic>();
let frame = 0;
/** The scale step a picture is drawn at for this transform. */
export const picScale = (ctx: Ctx) =>
  Math.min(
    2.5,
    Math.pow(2, Math.round(Math.log2(ctx.getTransform().a) * 4) / 4),
  );

/**
 * Copy the picture `id` (drawn by `paint` in world units around the origin,
 * within `box`) to world (ox, oy). `key` says when it must be drawn again.
 * `shear` leans it from its foot (a tree in the wind).
 */
export function picture(
  ctx: Ctx,
  id: string,
  key: string,
  box: { x0: number; y0: number; x1: number; y1: number },
  paint: (g: Ctx) => void,
  ox = 0,
  oy = 0,
  shear = 0,
) {
  const scale = picScale(ctx);
  const k = `${key}:${scale}`;
  const pad = 12;
  let pic = pics.get(id);
  if (!pic || pic.key !== k) {
    const w = Math.max(1, Math.ceil((box.x1 - box.x0 + pad * 2) * scale)),
      h = Math.max(1, Math.ceil((box.y1 - box.y0 + pad * 2) * scale));
    const cv = pic?.cv ?? document.createElement("canvas");
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
    const g = cv.getContext("2d")!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    g.setTransform(
      scale,
      0,
      0,
      scale,
      (-box.x0 + pad) * scale,
      (-box.y0 + pad) * scale,
    );
    paint(g);
    pic = {
      cv,
      key: k,
      x: box.x0 - pad,
      y: box.y0 - pad,
      s: scale,
      used: frame,
    };
    pics.set(id, pic);
  }
  pic.used = frame;
  const w = pic.cv.width / pic.s,
    h = pic.cv.height / pic.s;
  if (shear) {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.transform(1, 0, shear, 1, 0, 0);
    ctx.drawImage(pic.cv, pic.x, pic.y, w, h);
    ctx.restore();
  } else ctx.drawImage(pic.cv, pic.x + ox, pic.y + oy, w, h);
}
/** Once a frame: let pictures not drawn for a while go. */
export function tickPics() {
  frame++;
  if (frame % 120) return;
  for (const [k, p] of pics) if (frame - p.used > 600) pics.delete(k);
}
/** How many pictures are kept (tests). */
export const picCount = () => pics.size;
/** The light's part of a picture's key. */
export const lightKey = (l: { night: number; gold: number; season?: string }) =>
  `${Math.round(l.night * 20)}:${Math.round(l.gold * 4)}:${l.season}`;
