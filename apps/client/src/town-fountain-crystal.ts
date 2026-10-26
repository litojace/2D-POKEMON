import type Phaser from "phaser";
import { FOUNTAIN } from "./town-art";

/** A visible air gap remains above the stone socket throughout the hover. */
export function fountainCrystalPose(time: number, reduced = false) {
  const t = reduced ? 0 : time;
  return {
    y: FOUNTAIN.crystal.dy - 8 + Math.sin(t * 1.7) * 4,
    width: FOUNTAIN.crystal.rx * (0.96 + Math.cos(t * 0.85) * 0.04),
    seam: Math.sin(t * 0.85) * 2.4,
    glow: reduced ? 0.9 : 0.86 + Math.sin(t * 1.7 + 0.8) * 0.14,
    glint: reduced ? 0.6 : 0.35 + Math.sin(t * 1.05) ** 6 * 0.65,
  };
}

/** The same crystal is used by the actual town and its animation review. */
export function drawFountainCrystal(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  time: number,
  reduced: boolean,
) {
  const t = reduced ? 0 : time;
  const pose = fountainCrystalPose(t, reduced);
  const cy = pose.y,
    rx = pose.width,
    ry = FOUNTAIN.crystal.ry;
  g.clear().setPosition(x, y);
  // Overlapping low-opacity rings make a soft halo without per-frame textures.
  for (let ring = 10; ring > 0; ring--) {
    const radius = 21 + ring * 3.2;
    g.fillStyle(
      0x5cdbff,
      (0.012 + (10 - ring) * 0.002) * pose.glow,
    ).fillEllipse(0, cy, radius * 2, radius * 1.65);
  }
  g.fillStyle(0x98f4ff, 0.22 * pose.glow).fillEllipse(
    0,
    FOUNTAIN.spout.dy + 1,
    15,
    5,
  );
  const spark = (px: number, py: number, size: number, alpha: number) => {
    g.fillStyle(0x7feaff, alpha * 0.12).fillCircle(px, py, size * 3);
    g.lineStyle(0.8, 0xeaffff, alpha).lineBetween(px - size, py, px + size, py);
    g.lineBetween(px, py - size, px, py + size);
  };
  const motes = Array.from({ length: 4 }, (_, i) => {
    const a = t * 0.72 + (i * Math.PI) / 2;
    return {
      x: Math.cos(a) * 27,
      y: cy + 7 + Math.sin(a) * 9,
      front: Math.sin(a) >= 0,
    };
  });
  if (!reduced)
    for (const p of motes.filter((p) => !p.front)) spark(p.x, p.y, 1.1, 0.45);
  const seam = pose.seam;
  g.fillStyle(0x3fa5d0, 1).fillTriangle(0, cy - ry, -rx, cy, seam, cy + ry);
  g.fillStyle(0xd6fcff, 1).fillTriangle(0, cy - ry, seam - 4, cy - 3, -rx, cy);
  g.fillStyle(0x88e7fa, 1).fillTriangle(0, cy - ry, rx, cy, seam, cy + ry);
  g.fillStyle(0xf4ffff, 1).fillTriangle(0, cy - ry, seam + 4, cy - 3, rx, cy);
  g.fillStyle(0x9eeafb, 1).fillTriangle(
    -rx,
    cy,
    seam - 4,
    cy - 3,
    seam,
    cy + ry,
  );
  g.fillStyle(0x4aabc9, 1).fillTriangle(
    seam - 4,
    cy - 3,
    rx,
    cy,
    seam,
    cy + ry,
  );
  g.lineStyle(0.85, 0xedffff, 0.95).lineBetween(0, cy - ry, -rx, cy);
  g.lineStyle(0.65, 0xd9fcff, 0.7).lineBetween(-rx, cy, seam, cy + ry);
  spark(rx * 0.42, cy - 8, 2.3 + pose.glint, pose.glint);
  if (!reduced) {
    for (const p of motes.filter((p) => p.front)) spark(p.x, p.y, 1.3, 0.7);
    for (let i = 0; i < 3; i++) {
      const u = (t * 0.65 + i / 3) % 1;
      g.fillStyle(0xbffaff, (1 - u) * 0.65).fillCircle(
        Math.sin(t + i * 2) * 4,
        FOUNTAIN.spout.dy - u * 13,
        0.7,
      );
    }
  }
}
