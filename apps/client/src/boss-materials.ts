import type Phaser from "phaser";
type G = Phaser.GameObjects.Graphics;
export type BossMaterial = "scales" | "feathers" | "cloud" | "velvet" | "pearl";
const mix = (a: number, b: number, t: number) => {
  const channel = (shift: number) =>
    Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
};

/**
 * Nested, tangent ellipses approximate a warm key light and cool ambient shade.
 * Every mark is inside the original actor silhouette. The caller still owns
 * all poses, shadows, faces, damage flashes and attack telegraphs.
 */
export function bossSurface(
  g: G,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  material: BossMaterial,
  alpha = 1,
) {
  // Fading bosses and translucent doubles must retain their exact opacity.
  if (alpha < 0.98) {
    g.fillStyle(color, alpha).fillEllipse(x, y, w, h);
    return;
  }
  const rx = w / 2,
    ry = h / 2;
  const dark = mix(color, 0x172a40, material === "cloud" ? 0.16 : 0.34);
  const light = mix(color, 0xfff1c9, material === "pearl" ? 0.42 : 0.26);
  g.fillStyle(dark, alpha).fillEllipse(x, y, w, h);
  for (let k = 1; k <= 10; k++) {
    const t = k / 10,
      s = 1 - t * 0.68;
    g.fillStyle(
      mix(dark, light, Math.sin((t * Math.PI) / 2)),
      alpha,
    ).fillEllipse(
      x - rx * (1 - s) * 0.32,
      y - ry * (1 - s) * 0.62,
      w * s,
      h * s,
    );
  }
  if (
    material === "scales" ||
    material === "feathers" ||
    material === "velvet"
  ) {
    // Fixed local coordinates: texture follows each animated body segment.
    for (let row = -2; row <= 2; row++) {
      for (let col = -3; col <= 3; col++) {
        const u = (col + (row % 2) * 0.5) / 4,
          v = row / 3.4;
        if (u * u + v * v > 0.65) continue;
        const px = x + u * rx,
          py = y + v * ry;
        const size = Math.min(3.2, w * 0.045, h * 0.06);
        g.lineStyle(material === "velvet" ? 0.6 : 0.8, light, alpha * 0.28);
        if (material === "scales")
          g.beginPath()
            .arc(px, py, size, 0.2, Math.PI - 0.2, false)
            .strokePath();
        else
          g.beginPath()
            .moveTo(px - size, py - size * 0.45)
            .lineTo(px, py + size * 0.45)
            .lineTo(px + size * 0.6, py - size)
            .strokePath();
      }
    }
  }
  if (material === "pearl" || material === "scales") {
    g.fillStyle(0xfff9e6, alpha * 0.22).fillEllipse(
      x - rx * 0.3,
      y - ry * 0.45,
      w * 0.19,
      h * 0.08,
    );
  }
  // Restore the body colour before the caller paints facial marks.
  g.fillStyle(color, alpha);
}

/** Mineral flecks stay away from polygon edges so rock joints remain crisp. */
export function rockGrain(
  g: G,
  cx: number,
  cy: number,
  points: readonly number[],
  color: number,
  alpha: number,
) {
  const n = points.length / 2;
  let x = 0,
    y = 0;
  for (let k = 0; k < points.length; k += 2) {
    x += points[k] / n;
    y += points[k + 1] / n;
  }
  // The rock facets here are convex; points between centroid and vertices stay inside.
  for (let k = 0; k < n; k++) {
    const px = cx + x * 0.6 + points[k * 2] * 0.4,
      py = cy + y * 0.6 + points[k * 2 + 1] * 0.4;
    g.fillStyle(
      mix(color, k % 2 ? 0xffefce : 0x17293a, 0.27),
      alpha * 0.45,
    ).fillEllipse(px, py, 2.1, 1.1);
  }
  g.fillStyle(color, alpha);
}
