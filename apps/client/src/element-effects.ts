import type Phaser from "phaser";
export const elementShapes = {
  electric: "bolt",
  fire: "flame",
  water: "drop",
  energy: "prism",
  nature: "leaf",
  ice: "snowflake",
  shadow: "wisp",
  earth: "stone",
} as const;
export function drawElementGlyph(
  g: Phaser.GameObjects.Graphics,
  element: string,
  x: number,
  y: number,
  r: number,
  color: number,
  alpha = 0.8,
  time = 0,
) {
  g.lineStyle(Math.max(1, r * 0.13), color, alpha);
  g.fillStyle(color, alpha * 0.65);
  switch (element.toLowerCase()) {
    case "electric":
      g.fillTriangle(
        x + r * 0.3,
        y - r,
        x - r * 0.65,
        y + r * 0.2,
        x + r * 0.2,
        y + r * 0.05,
      );
      g.fillTriangle(
        x - r * 0.2,
        y - r * 0.05,
        x + r * 0.65,
        y - r * 0.2,
        x - r * 0.3,
        y + r,
      );
      break;
    case "fire":
      g.fillEllipse(x, y + r * 0.2, r * 1.25, r * 1.5);
      g.fillTriangle(
        x - r * 0.65,
        y + r * 0.3,
        x + r * 0.6,
        y + r * 0.3,
        x + r * 0.2,
        y - r,
      );
      break;
    case "water":
      g.strokeEllipse(x, y + r * 0.25, r * 1.35, r * 1.3);
      g.lineBetween(x - r * 0.55, y - r * 0.2, x, y - r);
      g.lineBetween(x + r * 0.55, y - r * 0.2, x, y - r);
      break;
    case "energy":
      g.strokePoints(
        [
          { x, y: y - r },
          { x: x + r, y },
          { x, y: y + r },
          { x: x - r, y },
        ],
        true,
      );
      g.fillCircle(x, y, r * 0.3);
      break;
    case "nature":
      g.strokeEllipse(x, y, r * 1.25, r * 1.8);
      g.lineBetween(x - r * 0.5, y + r * 0.9, x + r * 0.35, y - r * 0.6);
      g.lineBetween(x, y, x + r * 0.6, y + r * 0.15);
      break;
    case "ice":
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        g.lineBetween(x, y, x + Math.cos(a) * r, y + Math.sin(a) * r);
        g.fillCircle(
          x + Math.cos(a) * r * 0.7,
          y + Math.sin(a) * r * 0.7,
          r * 0.12,
        );
      }
      break;
    case "shadow":
      g.strokeEllipse(x, y, r * 1.4, r * 1.8);
      g.fillCircle(x - r * 0.25, y - r * 0.15, r * 0.13);
      g.fillCircle(x + r * 0.25, y - r * 0.15, r * 0.13);
      g.lineBetween(x - r * 0.6, y + r * 0.65, x - r, y + r);
      g.lineBetween(x + r * 0.6, y + r * 0.65, x + r, y + r);
      break;
    case "earth":
      g.strokePoints(
        [
          { x: x - r * 0.8, y: y - r * 0.5 },
          { x: x + r * 0.4, y: y - r },
          { x: x + r, y: y + r * 0.2 },
          { x: x + r * 0.4, y: y + r },
          { x: x - r * 0.6, y: y + r * 0.6 },
        ],
        true,
      );
      g.lineBetween(x - r * 0.8, y - r * 0.5, x + r * 0.4, y + r);
      break;
  }
}
