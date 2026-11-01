import type Phaser from "phaser";

/**
 * The few Phaser Graphics calls the cosmetic effects use, drawn on a plain
 * 2D canvas. The Shop, Wardrobe and reward thumbnails run the real in-game
 * aura, entrance and victory code through this, so a preview always shows
 * exactly what the effect does in play.
 */
export function canvasGraphics(ctx: CanvasRenderingContext2D) {
  const rgba = (color: number, alpha = 1) =>
    `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${Math.max(0, Math.min(1, alpha))})`;
  let path = false;
  const g = {
    fillStyle(color: number, alpha = 1) {
      ctx.fillStyle = rgba(color, alpha);
      return g;
    },
    lineStyle(width: number, color: number, alpha = 1) {
      ctx.lineWidth = width;
      ctx.strokeStyle = rgba(color, alpha);
      return g;
    },
    fillEllipse(x: number, y: number, w: number, h: number) {
      ctx.beginPath();
      ctx.ellipse(x, y, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      return g;
    },
    strokeEllipse(x: number, y: number, w: number, h: number) {
      ctx.beginPath();
      ctx.ellipse(x, y, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      return g;
    },
    fillCircle(x: number, y: number, r: number) {
      ctx.beginPath();
      ctx.arc(x, y, Math.abs(r), 0, Math.PI * 2);
      ctx.fill();
      return g;
    },
    strokeCircle(x: number, y: number, r: number) {
      ctx.beginPath();
      ctx.arc(x, y, Math.abs(r), 0, Math.PI * 2);
      ctx.stroke();
      return g;
    },
    fillTriangle(
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
    ) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.closePath();
      ctx.fill();
      return g;
    },
    lineBetween(x0: number, y0: number, x1: number, y1: number) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      return g;
    },
    fillRect(x: number, y: number, w: number, h: number) {
      ctx.fillRect(x, y, w, h);
      return g;
    },
    fillRoundedRect(x: number, y: number, w: number, h: number, r = 4) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
      return g;
    },
    beginPath() {
      ctx.beginPath();
      path = true;
      return g;
    },
    arc(x: number, y: number, r: number, start: number, end: number) {
      if (!path) ctx.beginPath();
      ctx.arc(x, y, r, start, end);
      return g;
    },
    strokePath() {
      ctx.stroke();
      path = false;
      return g;
    },
    clear() {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      return g;
    },
  };
  return g as unknown as Phaser.GameObjects.Graphics;
}
