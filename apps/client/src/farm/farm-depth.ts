/*
 * The Elemental Farm: which standing thing is drawn over which.
 *
 * Each thing has a footprint box on the ground (world px) and a height, as
 * in isometric engines (Shaun Lebron's IsometricBlocks, used by the Bistro's
 * street). Two things are put in order by a plane between their boxes. The
 * farm is seen from the south, looking down at a slant: a point's screen x
 * is its ground x, and the ground's depth is y alone. So
 *
 *  - boxes apart in y (one wholly farther, a.y1 <= b.y0): the farther one
 *    goes first, always;
 *  - boxes apart in x only: their pictures meet on screen only where one
 *    overhangs its box (a tree's crown), and the nearer front edge in front
 *    reads right;
 *  - boxes that overlap (a flat thing and what stands on it): the flat
 *    thing first, otherwise the nearer front edge.
 *
 * Every one of those orders is the order of one key: the front edge y1 (the
 * far edge y0 for a flat thing). The topological sort the isometric view
 * needs comes down to a stable sort here, as long as every footprint is
 * honest: a thing that is long in depth (a fence's side) is split into
 * pieces (`along`), never given one y for its whole length, which is what
 * drew cows and the dog over the pasture's nearer posts.
 */

export interface Drawable {
  /** The footprint on the ground (world px). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** How tall the picture stands above the ground (world px). */
  h: number;
  /** Half the picture's width when wider than the footprint (a crown). */
  sw?: number;
  /** Lifted off the ground (a bird, a hopping cow): px. */
  z?: number;
  /** Lies on the ground (a nest, a puddle): behind anything standing on it. */
  flat?: boolean;
  draw: () => void;
}
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Where a thing's picture can reach on screen (world px). */
export function screenBox(d: Drawable): Box {
  const z = d.z ?? 0,
    mid = (d.x0 + d.x1) / 2,
    sw = Math.max(d.sw ?? 0, (d.x1 - d.x0) / 2);
  return {
    x0: mid - sw,
    x1: mid + sw,
    y0: d.y0 - d.h - z,
    y1: d.y1 + 4 - z,
  };
}
/** The key the farm sorts by (see above). */
export const depthKey = (d: Drawable) => (d.flat ? d.y0 : d.y1);

const EPS = 1e-6;
/**
 * The separating-plane order of two things (tests check the sort against
 * it): -1 a goes first, 1 b goes first, 0 either (apart in x only, or the
 * same box).
 */
export function order(a: Drawable, b: Drawable): number {
  if (a.y1 <= b.y0 + EPS) return -1;
  if (b.y1 <= a.y0 + EPS) return 1;
  if (a.x1 <= b.x0 + EPS || b.x1 <= a.x0 + EPS) return 0;
  if (!!a.flat !== !!b.flat) return a.flat ? -1 : 1;
  const ka = depthKey(a),
    kb = depthKey(b);
  return ka < kb - EPS ? -1 : kb < ka - EPS ? 1 : 0;
}
/** The list in drawing order: farthest first, ties as they came. */
export function depthSort<T extends Drawable>(list: T[]): T[] {
  const keyed = list.map((d, i) => ({ d, k: depthKey(d), i }));
  keyed.sort((a, b) => a.k - b.k || a.i - b.i);
  return keyed.map((e) => e.d);
}
/** Whether a thing's picture reaches into the view (world px). */
export function inView(d: Drawable, v: Box) {
  const b = screenBox(d);
  return b.x1 > v.x0 && b.x0 < v.x1 && b.y1 > v.y0 && b.y0 < v.y1;
}
/** A thing standing at one spot (an animal, a sign): its footprint. */
export function spot(
  x: number,
  y: number,
  rx: number,
  ry: number,
  h: number,
  draw: () => void,
  extra: Partial<Drawable> = {},
): Drawable {
  return { x0: x - rx, x1: x + rx, y0: y - ry, y1: y, h, draw, ...extra };
}
/**
 * Something long in depth, split into one piece per step from y0 to y1
 * (a fence's side: a rail and the post at its near end), each with its own
 * footprint. `draw(ya, yb)` draws the piece from ya to yb.
 */
export function along(
  x: number,
  y0: number,
  y1: number,
  step: number,
  h: number,
  draw: (ya: number, yb: number) => void,
  half = 6,
): Drawable[] {
  const out: Drawable[] = [];
  for (let ya = y0; ya < y1 - EPS; ya += step) {
    const yb = Math.min(y1, ya + step);
    out.push({
      x0: x - half,
      x1: x + half,
      y0: ya,
      y1: yb,
      h,
      draw: () => draw(ya, yb),
    });
  }
  return out;
}
