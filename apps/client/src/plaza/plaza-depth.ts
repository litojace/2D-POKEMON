/*
 * The Plaza: which standing thing is drawn over which.
 *
 * The Plaza is seen from the front and above (screen x = world x, screen y =
 * world y − height). Sorting by one number per thing (its foot's y) breaks
 * for long things: a hurdle laid at a slant across the lane, a goal or a
 * gantry running away from the viewer, a food truck several metres long.
 * As in Element Bistro (bistro-depth.ts, after Shaun Lebron's
 * IsometricBlocks), each thing has a footprint on the ground: a box, or a
 * thin line (a hurdle). Two things whose pictures overlap on screen are put
 * in order by their footprints where they meet along x (the one wholly
 * farther, at smaller y, goes first), and the whole list is then put in
 * topological order. Footprints that overlap (someone in a goal's mouth)
 * fall back to their middles. A long thing that people can stand inside
 * (a goal) is drawn as slices, each its own footprint. The lap gantry is
 * the exception: overhead and running along the view's depth, its slices
 * striped the runners under it, so it is one picture at the lane's far
 * edge, its near post reaching down past its footprint (`below`).
 */

export interface Drawable {
  /** The footprint on the ground (world px). For a `line`, its two ends. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** The footprint is the thin line from (x0, y0) to (x1, y1). */
  line?: boolean;
  /** Height (world px), for the picture's box on screen. */
  h: number;
  /** Raised base (world px): someone jumping, a bird in the air. */
  z?: number;
  /** Half width on screen when wider than the footprint (a crown, a sign). */
  sw?: number;
  /**
   * How far the picture reaches below its footprint (world px): a part
   * nearer the viewer drawn at a farther thing's depth (the gantry's near
   * post, drawn with its far edge).
   */
  below?: number;
  /** Drawn even when its foot is off screen (beams reaching in). */
  always?: boolean;
  /** For tests and the debug order. */
  name?: string;
  draw: () => void;
}

export interface ScreenBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const lo = (d: Drawable) => ({
  x0: Math.min(d.x0, d.x1),
  x1: Math.max(d.x0, d.x1),
  y0: Math.min(d.y0, d.y1),
  y1: Math.max(d.y0, d.y1),
});
/** Where a thing's picture can reach on screen (world px). */
export function screenBox(d: Drawable): ScreenBox {
  const b = lo(d),
    z = d.z ?? 0;
  let x0 = b.x0,
    x1 = b.x1;
  if (d.sw) {
    const mid = (x0 + x1) / 2;
    x0 = Math.min(x0, mid - d.sw);
    x1 = Math.max(x1, mid + d.sw);
  }
  return { x0, x1, y0: b.y0 - z - d.h, y1: b.y1 - z + 4 + (d.below ?? 0) };
}
/** The footprint's ground y over [xa, xb] (where two things meet). */
function yRange(d: Drawable, xa: number, xb: number): [number, number] {
  if (!d.line) {
    const b = lo(d);
    return [b.y0, b.y1];
  }
  const dx = d.x1 - d.x0;
  const at = (x: number) => {
    if (Math.abs(dx) < 1e-6) return null;
    const t = Math.max(0, Math.min(1, (x - d.x0) / dx));
    return d.y0 + (d.y1 - d.y0) * t;
  };
  const a = at(xa),
    b = at(xb);
  if (a === null || b === null) {
    const r = lo(d);
    return [r.y0, r.y1];
  }
  return [Math.min(a, b), Math.max(a, b)];
}
const EPS = 1e-3;
/** -1: a is behind b (drawn first); 1: b is behind a. */
export function order(a: Drawable, b: Drawable): number {
  const A = lo(a),
    B = lo(b);
  // Where along x they meet; side by side (pictures overlapping only by a
  // crown or a sign), the gap between them.
  let xa = Math.max(A.x0, B.x0),
    xb = Math.min(A.x1, B.x1);
  if (xa > xb) {
    const m = (xa + xb) / 2;
    xa = xb = m;
  }
  const ra = yRange(a, xa, xb),
    rb = yRange(b, xa, xb);
  if (ra[1] <= rb[0] + EPS) return -1;
  if (rb[1] <= ra[0] + EPS) return 1;
  // Footprints overlap: the one whose middle is nearer the viewer in front,
  // the lower one first when level.
  const ca = ra[0] + ra[1],
    cb = rb[0] + rb[1];
  if (Math.abs(ca - cb) > EPS) return ca < cb ? -1 : 1;
  const za = a.z ?? 0,
    zb = b.z ?? 0;
  if (Math.abs(za - zb) > EPS) return za < zb ? -1 : 1;
  // Level and side by side: west first, so the order never depends on the list's.
  return a.x0 + a.x1 <= b.x0 + b.x1 ? -1 : 1;
}
const overlaps = (a: ScreenBox, b: ScreenBox) =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * The list in drawing order: anything behind another it overlaps on screen
 * comes first. Among things free to go, the farthest (smallest y) first, so
 * the order is stable from frame to frame. A cycle (rare: long things
 * crossing) is broken at its farthest member.
 */
export function depthSort(list: Drawable[]): Drawable[] {
  const n = list.length;
  if (n < 2) return list.slice();
  const box = list.map(screenBox);
  const key = list.map((d) => d.y0 + d.y1);
  // Level things go west to east, whatever order they came in.
  const kx = list.map((d) => d.x0 + d.x1);
  const first = (i: number, p: number) =>
    p < 0 || key[i] < key[p] || (key[i] === key[p] && kx[i] < kx[p]);
  const after: number[][] = list.map(() => []);
  const need = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (!overlaps(box[i], box[j])) continue;
      if (order(list[i], list[j]) < 0) {
        after[i].push(j);
        need[j]++;
      } else {
        after[j].push(i);
        need[i]++;
      }
    }
  const done = new Array<boolean>(n).fill(false);
  const out: Drawable[] = [];
  for (let k = 0; k < n; k++) {
    let pick = -1;
    for (let i = 0; i < n; i++)
      if (!done[i] && need[i] === 0 && first(i, pick)) pick = i;
    if (pick < 0)
      for (let i = 0; i < n; i++) if (!done[i] && first(i, pick)) pick = i;
    done[pick] = true;
    out.push(list[pick]);
    for (const j of after[pick]) need[j]--;
  }
  return out;
}
/** A small thing standing at one spot (a person, a lamp): its footprint. */
export function spot(
  x: number,
  y: number,
  r: number,
  h: number,
  draw: () => void,
  extra: Partial<Drawable> = {},
): Drawable {
  return { x0: x - r, y0: y - r * 0.5, x1: x + r, y1: y, h, draw, ...extra };
}
/**
 * A long thing running away from the viewer (along y), cut into `n` slices
 * so someone standing inside it is drawn between its far and near parts.
 * `draw(ya, yb)` draws the part between those ground ys.
 */
export function slices(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  n: number,
  h: number,
  draw: (ya: number, yb: number, i: number) => void,
  extra: Partial<Drawable> = {},
): Drawable[] {
  const out: Drawable[] = [];
  for (let i = 0; i < n; i++) {
    const ya = y0 + ((y1 - y0) * i) / n,
      yb = y0 + ((y1 - y0) * (i + 1)) / n;
    out.push({
      x0,
      x1,
      y0: ya,
      y1: yb,
      h,
      draw: () => draw(ya, yb, i),
      ...extra,
    });
  }
  return out;
}
