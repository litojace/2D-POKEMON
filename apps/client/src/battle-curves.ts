import type Phaser from "phaser";

/** Keep curve error below a fraction of a world pixel. Phaser's arc renderer
 * otherwise uses 100 segments even for a 2px spark or each HP-bar corner. */
export function curveSegments(radius: number) {
  if (!Number.isFinite(radius) || radius <= 0) return 16;
  const count = Math.ceil(Math.PI / Math.acos(Math.max(-1, 1 - 0.18 / radius)));
  return Math.max(16, Math.min(192, Math.ceil(count / 4) * 4));
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
    return this.fillEllipse(
      x,
      y,
      radius * 2,
      radius * 2,
      curveSegments(radius),
    );
  };
  g.strokeCircle = function (x, y, radius) {
    return this.strokeEllipse(
      x,
      y,
      radius * 2,
      radius * 2,
      curveSegments(radius),
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
