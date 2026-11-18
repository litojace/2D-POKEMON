/*
 * Element Bistro: which standing thing is drawn over which.
 *
 * Sorting by one number per thing (its x + y) breaks for long or wide
 * things: a bus five tiles long has its middle "behind" a lamp it actually
 * stands in front of. As isometric engines do (Shaun Lebron's
 * IsometricBlocks), each thing has a footprint box on the ground; two things
 * whose pictures overlap on screen are put in order by a plane between their
 * boxes (one lies wholly at smaller x, or wholly at smaller y, than the
 * other), and the whole list is then put in topological order. Things whose
 * boxes overlap (someone on a bench) fall back to their middles.
 */
import { iso } from "./bistro-geom";

export interface Drawable {
  /** The footprint on the ground (grid units, edges). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Height (world px), for the box on screen. */
  h: number;
  /** Raised base (world px): someone on the footbridge. */
  z?: number;
  /** Half width on screen when wider than the footprint (a tree's crown; world px). */
  sw?: number;
  draw: () => void;
}

export interface ScreenBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
/** Where a thing's picture can reach on screen (world px). */
export function screenBox(d: Drawable): ScreenBox {
  const z = d.z ?? 0;
  const l = iso(d.x0, d.y1),
    r = iso(d.x1, d.y0),
    t = iso(d.x0, d.y0),
    b = iso(d.x1, d.y1);
  let x0 = l.x,
    x1 = r.x;
  if (d.sw) {
    const mid = (l.x + r.x) / 2;
    x0 = Math.min(x0, mid - d.sw);
    x1 = Math.max(x1, mid + d.sw);
  }
  return { x0, x1, y0: t.y - d.h - z, y1: b.y - z + 4 };
}
const EPS = 1e-3;
/** -1: a is behind b; 1: b is behind a. */
export function order(a: Drawable, b: Drawable): number {
  if (a.x1 <= b.x0 + EPS) return -1;
  if (b.x1 <= a.x0 + EPS) return 1;
  if (a.y1 <= b.y0 + EPS) return -1;
  if (b.y1 <= a.y0 + EPS) return 1;
  // Footprints overlap: the one whose middle is nearer the viewer in front,
  // the lower one first when level.
  const da = a.x0 + a.x1 + a.y0 + a.y1,
    db = b.x0 + b.x1 + b.y0 + b.y1;
  if (Math.abs(da - db) > EPS) return da < db ? -1 : 1;
  return (a.z ?? 0) <= (b.z ?? 0) ? -1 : 1;
}
const overlaps = (a: ScreenBox, b: ScreenBox) =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * The list in drawing order: anything behind another it overlaps on screen
 * comes first. Among things free to go, the farthest (smallest x + y)
 * first, so the order is stable from frame to frame. A cycle (rare: three
 * long things crossing) is broken at its farthest member.
 */
export function depthSort(list: Drawable[]): Drawable[] {
  const n = list.length;
  if (n < 2) return list.slice();
  const box = list.map(screenBox);
  const key = list.map((d) => d.x0 + d.x1 + d.y0 + d.y1);
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
      if (!done[i] && need[i] === 0 && (pick < 0 || key[i] < key[pick]))
        pick = i;
    if (pick < 0)
      for (let i = 0; i < n; i++)
        if (!done[i] && (pick < 0 || key[i] < key[pick])) pick = i;
    done[pick] = true;
    out.push(list[pick]);
    for (const j of after[pick]) need[j]--;
  }
  return out;
}
/** A small thing standing at one spot (a person, a lamp): its footprint. */
export function spot(
  gx: number,
  gy: number,
  r: number,
  h: number,
  draw: () => void,
  extra: Partial<Drawable> = {},
): Drawable {
  return { x0: gx - r, y0: gy - r, x1: gx + r, y1: gy + r, h, draw, ...extra };
}
