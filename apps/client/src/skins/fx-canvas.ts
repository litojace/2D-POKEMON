import type Phaser from "phaser";

/**
 * The Phaser Graphics calls the cosmetic effects use, drawn on a plain 2D
 * canvas. The Shop, Wardrobe and reward thumbnails run the real in-game
 * aura, entrance and victory code through this, and the Plaza every skin's
 * own effects too, so they always show exactly what the effect does in
 * play. A call missing here throws: tests/unit/plaza-skin-fx.test.ts runs
 * every skin, entrance and victory through it.
 */
type Pt = { x: number; y: number };
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
    arc(
      x: number,
      y: number,
      r: number,
      start: number,
      end: number,
      anticlockwise = false,
    ) {
      if (!path) ctx.beginPath();
      ctx.arc(x, y, Math.abs(r), start, end, anticlockwise);
      return g;
    },
    moveTo(x: number, y: number) {
      if (!path) ctx.beginPath();
      path = true;
      ctx.moveTo(x, y);
      return g;
    },
    lineTo(x: number, y: number) {
      if (!path) ctx.beginPath();
      path = true;
      ctx.lineTo(x, y);
      return g;
    },
    closePath() {
      ctx.closePath();
      return g;
    },
    /** A pie slice as a new path (fill or stroke it after), as Phaser's. */
    slice(
      x: number,
      y: number,
      r: number,
      start: number,
      end: number,
      anticlockwise = false,
    ) {
      ctx.beginPath();
      path = true;
      ctx.moveTo(x, y);
      ctx.arc(x, y, Math.abs(r), start, end, anticlockwise);
      ctx.closePath();
      return g;
    },
    strokePath() {
      ctx.stroke();
      path = false;
      return g;
    },
    fillPath() {
      ctx.fill();
      path = false;
      return g;
    },
    strokePoints(pts: Pt[], closeShape = false, closePath = false) {
      if (pts.length) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        if (closeShape) ctx.lineTo(pts[0].x, pts[0].y);
        if (closePath) ctx.closePath();
        ctx.stroke();
      }
      path = false;
      return g;
    },
    fillPoints(pts: Pt[], closeShape = false, closePath = false) {
      if (pts.length) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        if (closeShape) ctx.lineTo(pts[0].x, pts[0].y);
        if (closePath) ctx.closePath();
        ctx.fill();
      }
      path = false;
      return g;
    },
    strokeTriangle(
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
      ctx.stroke();
      return g;
    },
    strokeRect(x: number, y: number, w: number, h: number) {
      ctx.strokeRect(x, y, w, h);
      return g;
    },
    clear() {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      return g;
    },
  };
  return g as unknown as Phaser.GameObjects.Graphics;
}
