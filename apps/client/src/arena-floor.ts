import { OBSTACLES, RULES } from "@arena/shared";
/** The subset of Phaser.GameObjects.Graphics the floor painter uses. */
export interface FloorPainter {
  fillStyle(color: number, alpha?: number): FloorPainter;
  lineStyle(width: number, color: number, alpha?: number): FloorPainter;
  fillRect(x: number, y: number, w: number, h: number): FloorPainter;
  fillRoundedRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r?: number,
  ): FloorPainter;
  strokeRoundedRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r?: number,
  ): FloorPainter;
  fillCircle(x: number, y: number, r: number): FloorPainter;
  strokeCircle(x: number, y: number, r: number): FloorPainter;
  fillEllipse(x: number, y: number, w: number, h: number): FloorPainter;
  fillTriangle(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): FloorPainter;
  lineBetween(x0: number, y0: number, x1: number, y1: number): FloorPainter;
  fillPoints(points: { x: number; y: number }[], close?: boolean): FloorPainter;
  strokePoints(
    points: { x: number; y: number }[],
    close?: boolean,
  ): FloorPainter;
}
const COLS = 19,
  ROWS = 10;
const BORDER = 36;
/**
 * Paints the cosmetic stone-tile court with grass edges. Deterministic, drawn once
 * and baked into a texture; collision geometry stays in the shared OBSTACLES list.
 */
export function paintArenaFloor(g: FloorPainter) {
  const { width: W, height: H } = RULES;
  let seed = 42;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // Grass surround.
  g.fillStyle(0x2f6a35).fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    const x = random() * W,
      y = random() * H;
    if (x > BORDER && x < W - BORDER && y > BORDER && y < H - BORDER) continue;
    g.fillStyle([0x3f8a43, 0x27582c, 0x4d9a4c][i % 3], 0.8);
    const h = 5 + random() * 7;
    g.fillTriangle(x - 2, y, x + 2, y, x + (random() - 0.5) * 4, y - h);
  }
  // Stone tiles with grout, bevels and per-tile tone variation.
  g.fillStyle(0x30372f).fillRect(
    BORDER,
    BORDER,
    W - BORDER * 2,
    H - BORDER * 2,
  );
  // Whole tiles only: the court divides evenly into COLS x ROWS.
  const tileW = (W - BORDER * 2) / COLS,
    tileH = (H - BORDER * 2) / ROWS;
  const tones = [0x7b8279, 0x858c81, 0x737a72, 0x80877c];
  for (let row = 0; row < ROWS; row++)
    for (let col = 0; col < COLS; col++) {
      const x = BORDER + col * tileW,
        y = BORDER + row * tileH,
        w = tileW - 3,
        h = tileH - 3;
      g.fillStyle(tones[Math.floor(random() * tones.length)]).fillRoundedRect(
        x + 1.5,
        y + 1.5,
        w,
        h,
        6,
      );
      g.fillStyle(0xffffff, 0.09).fillRoundedRect(x + 3, y + 3, w - 4, 7, 4);
      g.fillStyle(0x1e2622, 0.16).fillRoundedRect(
        x + 3,
        y + h - 5,
        w - 4,
        6,
        3,
      );
      for (let k = 0; k < 4; k++)
        g.fillStyle(0x6c756e, 0.35).fillCircle(
          x + 8 + random() * (w - 16),
          y + 8 + random() * (h - 16),
          1 + random() * 2,
        );
      if (random() < 0.12) {
        const cx = x + 15 + random() * (w - 30),
          cy = y + 15 + random() * (h - 30);
        g.lineStyle(1.5, 0x5a625c, 0.6)
          .lineBetween(cx, cy, cx + 10, cy + 6)
          .lineBetween(cx + 10, cy + 6, cx + 14, cy + 15);
      }
    }
  // Moss creeping in from the edges.
  for (let i = 0; i < 70; i++) {
    const side = i % 4,
      t = random();
    const x =
      side === 0
        ? BORDER + random() * 30
        : side === 1
          ? W - BORDER - random() * 30
          : t * W;
    const y =
      side === 2
        ? BORDER + random() * 26
        : side === 3
          ? H - BORDER - random() * 26
          : t * H;
    g.fillStyle(0x4f8a46, 0.35).fillEllipse(
      x,
      y,
      14 + random() * 22,
      8 + random() * 10,
    );
  }
  // Court markings.
  g.lineStyle(4, 0xf3f6ef, 0.5).strokeRoundedRect(46, 46, W - 92, H - 92, 14);
  g.lineStyle(4, 0xf3f6ef, 0.45).lineBetween(W / 2, 50, W / 2, H - 50);
  g.fillStyle(0xffffff, 0.06).fillCircle(W / 2, H / 2, 235);
  g.lineStyle(3, 0xf3f6ef, 0.45).strokeCircle(W / 2, H / 2, 165);
  g.lineStyle(2, 0xf3f6ef, 0.25).strokeCircle(W / 2, H / 2, 230);
  for (const x of [260, 1340]) {
    g.fillStyle(x === 260 ? 0xffd65b : 0x63dce8, 0.12).fillCircle(x, 450, 70);
    g.lineStyle(3, x === 260 ? 0xffd65b : 0x63dce8, 0.6).strokeCircle(
      x,
      450,
      70,
    );
  }
  // Stone pillars (cosmetic look of the shared obstacles).
  for (const o of OBSTACLES) {
    g.fillStyle(0x10170f, 0.35).fillEllipse(
      o.x + o.w / 2 + 10,
      o.y + o.h + 6,
      o.w + 40,
      34,
    );
    g.fillStyle(0x5d665f).fillRoundedRect(o.x, o.y, o.w, o.h, 12);
    g.fillStyle(0x737d75).fillRoundedRect(
      o.x + 5,
      o.y + 5,
      o.w - 10,
      o.h - 22,
      9,
    );
    g.fillStyle(0xa7b0a6).fillRoundedRect(o.x + 6, o.y + 4, o.w - 12, 22, 8);
    g.fillStyle(0x4f8a46, 0.85).fillEllipse(
      o.x + o.w * 0.3,
      o.y + 9,
      o.w * 0.45,
      12,
    );
    g.lineStyle(2, 0x4a524c, 0.8)
      .lineBetween(o.x + 18, o.y + 40, o.x + 30, o.y + 62)
      .lineBetween(o.x + 30, o.y + 62, o.x + 24, o.y + 80);
    for (let k = 0; k < 6; k++) {
      const gx = o.x + 4 + random() * (o.w - 8);
      g.fillStyle(0x3f8a43).fillTriangle(
        gx - 3,
        o.y + o.h + 2,
        gx + 3,
        o.y + o.h + 2,
        gx,
        o.y + o.h - 8,
      );
    }
  }
  // Soft vignette keeps fighters readable in the centre.
  for (let i = 0; i < 6; i++)
    g.lineStyle(14, 0x0b1209, 0.05 + i * 0.015).strokeRoundedRect(
      i * 7,
      i * 7,
      W - i * 14,
      H - i * 14,
      20,
    );
}
