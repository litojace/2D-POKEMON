/**
 * Aim helpers for the ★★★ bosses' own AI (Prismatail, Emberwing, Storm
 * Twins): where a raider is heading, and where raiders bunch up. The shared
 * boss core grows generic versions of these (predictive lead, steering a
 * shape by where raiders stand); these are kept small so they fold into it.
 */
import type { Fighter } from "../../../packages/shared/src/index.js";

export interface Point {
  x: number;
  y: number;
}
/** The slowest champion's speed: every dodge must work at this pace. */
export const SLOWEST_RAIDER = 222;
/** How long a raider takes to react to a new telegraph. */
export const REACTION = 0.45;
/** ★★★ lead: a share of the way the raider runs during the warning, capped. */
export const LEAD = { fraction: 0.7, cap: 140, minSpeed: 120 };

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/**
 * Where `p` will be in `t` seconds if it keeps running the same way: only a
 * raider moving at a run is led, by part of the way, never past `cap`.
 * Standing still or turning back always beats a led shot.
 */
export function leadPoint(
  p: Pick<Fighter, "x" | "y" | "vx" | "vy">,
  t: number,
  box = { x0: 60, y0: 60, x1: 1540, y1: 840 },
): Point {
  const v = Math.hypot(p.vx ?? 0, p.vy ?? 0);
  if (v < LEAD.minSpeed || t <= 0) return { x: p.x, y: p.y };
  const d = Math.min(v * t * LEAD.fraction, LEAD.cap);
  return {
    x: clamp(p.x + (p.vx / v) * d, box.x0, box.x1),
    y: clamp(p.y + (p.vy / v) * d, box.y0, box.y1),
  };
}

/**
 * The biggest bunch of raiders: the one with the most others within
 * `radius`, and the centre of that bunch (ties go to the first raider).
 */
export function biggestGroup(raiders: Point[], radius = 150) {
  let best: Point[] = [];
  for (const p of raiders) {
    const near = raiders.filter(
      (q) => Math.hypot(q.x - p.x, q.y - p.y) <= radius,
    );
    if (near.length > best.length) best = near;
  }
  if (!best.length) return undefined;
  return {
    x: best.reduce((s, p) => s + p.x, 0) / best.length,
    y: best.reduce((s, p) => s + p.y, 0) / best.length,
    count: best.length,
  };
}

/**
 * The ray from `from` through `through`, clipped to a box: a lane aimed at
 * a raider that runs on to the arena's edge.
 */
export function rayToBox(
  from: Point,
  through: Point,
  box: { x0: number; y0: number; x1: number; y1: number },
): Point {
  let dx = through.x - from.x,
    dy = through.y - from.y;
  if (Math.hypot(dx, dy) < 1) {
    dx = 800 - from.x || 1;
    dy = 450 - from.y;
  }
  const tx =
    dx > 0
      ? (box.x1 - from.x) / dx
      : dx < 0
        ? (box.x0 - from.x) / dx
        : Infinity;
  const ty =
    dy > 0
      ? (box.y1 - from.y) / dy
      : dy < 0
        ? (box.y0 - from.y) / dy
        : Infinity;
  const t = Math.max(0, Math.min(tx, ty));
  return {
    x: clamp(from.x + dx * t, box.x0, box.x1),
    y: clamp(from.y + dy * t, box.y0, box.y1),
  };
}
