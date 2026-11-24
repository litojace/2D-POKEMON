import type Phaser from "phaser";

/** Keep curve error below a fraction of a world pixel. Phaser's arc renderer
 * otherwise uses 100 segments even for a 2px spark or each HP-bar corner. */
export function curveSegments(radius: number) {
  if (!Number.isFinite(radius) || radius <= 0) return 16;
  const count = Math.ceil(Math.PI / Math.acos(Math.max(-1, 1 - 0.18 / radius)));
  return Math.max(16, Math.min(192, Math.ceil(count / 4) * 4));
}

/** Unit circle cos/sin per point count, computed once. */
const unitCircles = new Map<number, Float64Array>();
/** One reused point list per count (Phaser copies the numbers at once). */
const scratch = new Map<number, { x: number; y: number }[]>();
/**
 * A circle's outline points, exactly as Phaser's ellipse makes them (point
 * i at angle 2π·i/n), without its cos/sin per point and new objects every
 * call: battles draw hundreds of circles a frame, and that work and its
 * garbage showed in profiles. The list is reused: pass it straight to
 * fillPoints/strokePoints.
 */
export function circlePoints(x: number, y: number, radius: number, n: number) {
  let unit = unitCircles.get(n);
  if (!unit) {
    unit = new Float64Array(n * 2);
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2;
      unit[i * 2] = Math.cos(angle);
      unit[i * 2 + 1] = Math.sin(angle);
    }
    unitCircles.set(n, unit);
  }
  let points = scratch.get(n);
  if (!points) {
    points = Array.from({ length: n }, () => ({ x: 0, y: 0 }));
    scratch.set(n, points);
  }
  for (let i = 0; i < n; i++) {
    points[i].x = x + radius * unit[i * 2];
    points[i].y = y + radius * unit[i * 2 + 1];
  }
  return points;
}

export function roundedRectPoints(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  const steps = curveSegments(r) / 4;
  const corners = [
    [x + width - r, y + r, -Math.PI / 2],
    [x + width - r, y + height - r, 0],
    [x + r, y + height - r, Math.PI / 2],
    [x + r, y + r, Math.PI],
  ];
  return corners.flatMap(([cx, cy, start]) =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const angle = start + (i * Math.PI) / 2 / steps;
      return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    }),
  );
}

/** Per-instance optimization, never a global Phaser patch. Canvas retains its
 * native arcs; non-numeric and concave corner definitions retain Phaser's path. */
export function battleCurves<T extends Phaser.GameObjects.Graphics>(g: T): T {
  if (g.scene?.sys?.game?.renderer?.type !== 2) return g;
  const rounded = g.fillRoundedRect;
  g.fillCircle = function (x, y, radius) {
    return this.fillPoints(
      circlePoints(x, y, radius, curveSegments(radius)),
      true,
    );
  };
  g.strokeCircle = function (x, y, radius) {
    return this.strokePoints(
      circlePoints(x, y, radius, curveSegments(radius)),
      true,
    );
  };
  g.fillRoundedRect = function (x, y, width, height, radius = 20) {
    if (typeof radius !== "number" || radius < 0 || width < 0 || height < 0)
      return rounded.call(this, x, y, width, height, radius);
    if (width === 0 || height === 0) return this;
    if (radius === 0) return this.fillRect(x, y, width, height);
    return this.fillPoints(
      roundedRectPoints(x, y, width, height, radius),
      true,
    );
  };
  return g;
}
