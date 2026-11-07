/*
 * Element Bistro's drawing basics: the isometric grid (a tile is 96 × 48,
 * tile (x, y) has its centre at iso(x, y)), colours, gradients and the box
 * every piece of furniture is built from. Shared by bistro-art (the room),
 * bistro-furniture (the items) and bistro-scenery (the street).
 */
type Ctx = CanvasRenderingContext2D;
export const TW = 96;
export const TH = 48;
export const iso = (gx: number, gy: number) => ({
  x: (gx - gy) * (TW / 2),
  y: (gx + gy) * (TH / 2),
});

/* ───────────── colour helpers ───────────── */

export function shade(col: string, f: number): string {
  // "#rrggbb" or "rgb(r,g,b)".
  let r: number, g: number, b: number;
  if (col.startsWith("#")) {
    const n = parseInt(col.slice(1), 16);
    r = (n >> 16) & 255;
    g = (n >> 8) & 255;
    b = n & 255;
  } else {
    [r, g, b] = (col.match(/[\d.]+/g) ?? ["0", "0", "0"]).map(Number);
  }
  if (f >= 0) {
    r += (255 - r) * f;
    g += (255 - g) * f;
    b += (255 - b) * f;
  } else {
    r *= 1 + f;
    g *= 1 + f;
    b *= 1 + f;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
export const lin = (
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: [number, string][],
) => {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
};
export const rad = (
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  stops: [number, string][],
  r0 = 0,
) => {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
};
export function poly(ctx: Ctx, pts: { x: number; y: number }[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}
export function ellipse(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
}
export function softShadow(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  a = 0.28,
) {
  ctx.fillStyle = rad(ctx, x, y, rx, [
    [0, `rgba(40,20,10,${a})`],
    [0.6, `rgba(40,20,10,${a * 0.55})`],
    [1, "rgba(40,20,10,0)"],
  ]);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.translate(-x, -y);
  ellipse(ctx, x, y, rx, rx);
  ctx.fill();
  ctx.restore();
}

/**
 * An iso box over the tile span [gx0, gx1] × [gy0, gy1] (grid units, edges),
 * h tall, its base lifted by z. Draws the two faces toward the viewer and the top.
 */
export function isoBox(
  ctx: Ctx,
  gx0: number,
  gy0: number,
  gx1: number,
  gy1: number,
  z: number,
  h: number,
  col: {
    top: string | CanvasGradient;
    left: string | CanvasGradient;
    right: string | CanvasGradient;
  },
  faces = { left: true, right: true },
) {
  const A = iso(gx0, gy0),
    B = iso(gx1, gy0),
    C = iso(gx1, gy1),
    D = iso(gx0, gy1);
  const up = (p: { x: number; y: number }, d: number) => ({
    x: p.x,
    y: p.y - d,
  });
  if (faces.left) {
    ctx.fillStyle = col.left;
    poly(ctx, [up(D, z), up(C, z), up(C, z + h), up(D, z + h)]);
    ctx.fill();
  }
  if (faces.right) {
    ctx.fillStyle = col.right;
    poly(ctx, [up(B, z), up(C, z), up(C, z + h), up(B, z + h)]);
    ctx.fill();
  }
  // Light falls from above: the sides darken toward the floor (a soft
  // contact shade), and the near edges catch a thin highlight.
  if (h >= 6) {
    const shadeSide = (
      p0: { x: number; y: number },
      p1: { x: number; y: number },
    ) => {
      const g = ctx.createLinearGradient(0, p1.y - z - h, 0, p1.y - z);
      g.addColorStop(0, "rgba(255,255,255,.07)");
      g.addColorStop(0.55, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,.16)");
      ctx.fillStyle = g;
      poly(ctx, [up(p0, z), up(p1, z), up(p1, z + h), up(p0, z + h)]);
      ctx.fill();
    };
    if (faces.left) shadeSide(D, C);
    if (faces.right) shadeSide(B, C);
  }
  ctx.fillStyle = col.top;
  poly(ctx, [up(A, z + h), up(B, z + h), up(C, z + h), up(D, z + h)]);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.28)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const dt = up(D, z + h),
    ct = up(C, z + h),
    bt = up(B, z + h);
  ctx.moveTo(faces.left ? dt.x : ct.x, faces.left ? dt.y : ct.y);
  ctx.lineTo(ct.x, ct.y);
  if (faces.right) ctx.lineTo(bt.x, bt.y);
  if (faces.left && faces.right && h >= 6) {
    ctx.moveTo(ct.x, ct.y);
    ctx.lineTo(ct.x, ct.y + h);
  }
  ctx.stroke();
}
