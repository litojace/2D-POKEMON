/*
 * Element Bistro (demo): the drawing. Everything is painted in code on a 2D
 * canvas, in world units on an isometric grid: a tile is 96 × 48, tile
 * (x, y) has its centre at iso(x, y), and walls stand on the grid's back
 * edges. Nothing here knows the rules; the scene passes what to draw.
 */
import {
  COLS,
  ROWS,
  type RoomSize,
  COUNTER_X0,
  COUNTER_X1,
  COUNTER_ROW,
  DOOR,
  type DishId,
  type FloorId,
  type ItemKind,
  type WallId,
} from "./bistro-model";

type Ctx = CanvasRenderingContext2D;
export const TW = 96;
export const TH = 48;
export const WALL_H = 168;
export const iso = (gx: number, gy: number) => ({
  x: (gx - gy) * (TW / 2),
  y: (gx + gy) * (TH / 2),
});
/** The room's corners on the floor. */
/**
 * The dining room's size being drawn (it grows when the room is expanded,
 * and a friend's may differ): set by the scene before drawing.
 */
export const R: RoomSize = { cols: COLS, rows: ROWS };
export function setRoomSize(z: RoomSize): boolean {
  if (z.cols === R.cols && z.rows === R.rows) return false;
  R.cols = z.cols;
  R.rows = z.rows;
  return true;
}
/** The room's corners on the floor. */
export const ROOM = {
  get top() {
    return iso(-0.5, -0.5);
  },
  get right() {
    return iso(R.cols - 0.5, -0.5);
  },
  get left() {
    return iso(-0.5, R.rows - 0.5);
  },
  get bottom() {
    return iso(R.cols - 0.5, R.rows - 0.5);
  },
};
/** World bounds worth showing (the room, its walls and the base). */
export const BOUNDS = {
  get x0() {
    return ROOM.left.x - 30;
  },
  get x1() {
    return ROOM.right.x + 30;
  },
  get y0() {
    return ROOM.top.y - WALL_H - 30;
  },
  get y1() {
    return ROOM.bottom.y + 50;
  },
};

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
const lin = (
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
const rad = (
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
function poly(ctx: Ctx, pts: { x: number; y: number }[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}
function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number) {
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
  ctx.fillStyle = col.top;
  poly(ctx, [up(A, z + h), up(B, z + h), up(C, z + h), up(D, z + h)]);
  ctx.fill();
}

/* ───────────── sky and backdrop ───────────── */

export interface Light {
  /** 0 day … 1 night. */
  night: number;
  /** 0 … 1 golden hour. */
  gold: number;
  t: number;
}
export function skyColours(l: Light): [string, string] {
  const mix = (a: number[], b: number[], f: number) =>
    `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * f)).join(",")})`;
  const dayTop = [120, 190, 245],
    dayBot = [205, 236, 255];
  const goldTop = [250, 160, 120],
    goldBot = [255, 214, 150];
  const nightTop = [18, 24, 58],
    nightBot = [52, 46, 96];
  const g = l.gold * (1 - l.night * 0.6);
  const top = mix(
    mix(dayTop, goldTop, g).match(/\d+/g)!.map(Number),
    nightTop,
    l.night,
  );
  const bot = mix(
    mix(dayBot, goldBot, g).match(/\d+/g)!.map(Number),
    nightBot,
    l.night,
  );
  return [top, bot];
}
/** The page behind the diorama: a warm room-light gradient and soft bokeh. */
export function drawBackdrop(
  ctx: Ctx,
  w: number,
  h: number,
  l: Light,
  low: boolean,
) {
  const day = 1 - l.night;
  const top = l.night > 0.5 ? "#1b1630" : "#ffe6c4";
  ctx.fillStyle = lin(ctx, 0, 0, 0, h, [
    [0, l.night > 0.5 ? "#141128" : day > 0.5 ? "#f8d9a8" : "#3a2b48"],
    [0.55, l.night > 0.5 ? "#2a1f3a" : "#f0b981"],
    [1, l.night > 0.5 ? "#3b2436" : "#c9784e"],
  ]);
  ctx.fillRect(0, 0, w, h);
  void top;
  if (low) return;
  // Bokeh: soft discs drifting very slowly (the same on every visit).
  for (let i = 0; i < 18; i++) {
    const sx = ((i * 0.618 + 0.13) % 1) * w + Math.sin(l.t * 0.05 + i) * 18;
    const sy = ((i * 0.377 + 0.21) % 1) * h + Math.cos(l.t * 0.04 + i * 2) * 12;
    const r = (14 + ((i * 37) % 40)) * (Math.min(w, h) / 700);
    const a = l.night > 0.5 ? 0.16 : 0.13;
    const c =
      i % 3 === 0 ? "255,220,150" : i % 3 === 1 ? "255,170,120" : "255,245,220";
    ctx.fillStyle = rad(ctx, sx, sy, r, [
      [0, `rgba(${c},${a})`],
      [0.7, `rgba(${c},${a * 0.6})`],
      [1, `rgba(${c},0)`],
    ]);
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ───────────── the room shell (cached) ───────────── */

const FLOOR_STYLE: Record<FloorId, { a: string; b: string; grout: string }> = {
  checker: { a: "#f6ead2", b: "#d9705a", grout: "#c9b598" },
  wood: { a: "#d9a066", b: "#c88a52", grout: "#9b6236" },
  teal: { a: "#5fb6ad", b: "#e9f3ea", grout: "#3f8a83" },
};
const WALL_STYLE: Record<
  WallId,
  { base: string; light: string; trim: string; low: string }
> = {
  butter: {
    base: "#f6d98c",
    light: "#fbe6ae",
    trim: "#8c5a34",
    low: "#a8643c",
  },
  mint: { base: "#bfe6cf", light: "#dff4e6", trim: "#3f6f5c", low: "#4f8a6f" },
  brick: { base: "#c4664d", light: "#d77e62", trim: "#5d3226", low: "#6e3a2b" },
};

/** Windows: on the right wall (x span) and the left wall (y span), grid units. */
export const WINDOWS = {
  /** Along the right wall, past the kitchen: one every 2.4 tiles. */
  get right(): [number, number][] {
    const out: [number, number][] = [];
    for (let g = 6.3; g + 1.6 <= R.cols - 0.6; g += 2.4) out.push([g, g + 1.6]);
    return out;
  },
  /** Along the left wall: by the counter, and past the door in a bigger room. */
  get left(): [number, number][] {
    const out: [number, number][] = [[3.0, 4.6]];
    const end = Math.min(R.rows - 0.7, 9.9);
    if (end - 8.2 >= 1) out.push([8.2, end]);
    return out;
  },
};
/** The menu board on the left wall (y span). */
const BOARD = [5.1, 6.2] as const;

function rightWallPt(gx: number, h: number) {
  const p = iso(gx, -0.5);
  return { x: p.x, y: p.y - h };
}
function leftWallPt(gy: number, h: number) {
  const p = iso(-0.5, gy);
  return { x: p.x, y: p.y - h };
}

/** The soft shadow the diorama casts on the backdrop (drawn live: it is wider than the cache). */
export function drawGroundShadow(ctx: Ctx) {
  softShadow(ctx, ROOM.bottom.x - 30, ROOM.bottom.y + 40, 620, 120, 0.35);
}
/** The diorama's base slab, the floor and the walls (no windows' glass). */
export function drawShell(ctx: Ctx, floor: FloorId, wall: WallId) {
  const { top, right, left, bottom } = ROOM;
  const SLAB = 34;
  // The slab's sides.
  ctx.fillStyle = lin(ctx, left.x, 0, bottom.x, 0, [
    [0, "#6b4630"],
    [1, "#83563a"],
  ]);
  poly(ctx, [
    left,
    bottom,
    { x: bottom.x, y: bottom.y + SLAB },
    { x: left.x, y: left.y + SLAB },
  ]);
  ctx.fill();
  ctx.fillStyle = lin(ctx, bottom.x, 0, right.x, 0, [
    [0, "#5a3a28"],
    [1, "#4a2f21"],
  ]);
  poly(ctx, [
    bottom,
    right,
    { x: right.x, y: right.y + SLAB },
    { x: bottom.x, y: bottom.y + SLAB },
  ]);
  ctx.fill();
  // A lighter lip on the slab.
  ctx.strokeStyle = "rgba(255,230,190,.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left.x, left.y + 1);
  ctx.lineTo(bottom.x, bottom.y + 1);
  ctx.lineTo(right.x, right.y + 1);
  ctx.stroke();

  // The floor.
  const fs = FLOOR_STYLE[floor];
  for (let x = 0; x < R.cols; x++)
    for (let y = 0; y < R.rows; y++) {
      const a = iso(x - 0.5, y - 0.5),
        b = iso(x + 0.5, y - 0.5),
        c = iso(x + 0.5, y + 0.5),
        d = iso(x - 0.5, y + 0.5);
      let fill = (x + y) % 2 ? fs.b : fs.a;
      if (floor === "wood") fill = (y + ((x * 3) % 5)) % 3 === 0 ? fs.b : fs.a;
      ctx.fillStyle = fill;
      poly(ctx, [a, b, c, d]);
      ctx.fill();
      if (floor === "wood") {
        // Planks run along x: two seams per tile.
        ctx.strokeStyle = "rgba(110,60,25,.35)";
        ctx.lineWidth = 1.2;
        for (const f of [1 / 3, 2 / 3]) {
          const p = iso(x - 0.5, y - 0.5 + f),
            q = iso(x + 0.5, y - 0.5 + f);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }
    }
  // Kitchen floor: small grey tiles behind the counter.
  for (let x = COUNTER_X0; x <= COUNTER_X1; x++)
    for (let y = 0; y < COUNTER_ROW; y++) {
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          const gx = x - 0.5 + i / 2,
            gy = y - 0.5 + j / 2;
          ctx.fillStyle = (i + j) % 2 ? "#cfd5da" : "#e7ebee";
          poly(ctx, [
            iso(gx, gy),
            iso(gx + 0.5, gy),
            iso(gx + 0.5, gy + 0.5),
            iso(gx, gy + 0.5),
          ]);
          ctx.fill();
        }
    }
  // Grout lines.
  ctx.strokeStyle = fs.grout;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= R.cols; x++) {
    const p = iso(x - 0.5, -0.5),
      q = iso(x - 0.5, R.rows - 0.5);
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
  }
  for (let y = 0; y <= R.rows; y++) {
    const p = iso(-0.5, y - 0.5),
      q = iso(R.cols - 0.5, y - 0.5);
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  // Ambient occlusion along the walls, and a soft vignette on the floor.
  ctx.save();
  poly(ctx, [top, right, bottom, left]);
  ctx.clip();
  const ao = 46;
  ctx.fillStyle = lin(ctx, 0, top.y, 0, top.y + ao, [
    [0, "rgba(70,35,15,.32)"],
    [1, "rgba(70,35,15,0)"],
  ]);
  // Along the right wall (y = -0.5): a band toward +y.
  poly(ctx, [top, right, iso(R.cols - 0.5, 0.45), iso(-0.5, 0.45)]);
  ctx.fillStyle = lin(
    ctx,
    iso(0, -0.5).x,
    iso(0, -0.5).y,
    iso(0, 0.45).x,
    iso(0, 0.45).y,
    [
      [0, "rgba(70,35,15,.3)"],
      [1, "rgba(70,35,15,0)"],
    ],
  );
  ctx.fill();
  poly(ctx, [top, iso(0.45, -0.5), iso(0.45, R.rows - 0.5), left]);
  ctx.fillStyle = lin(
    ctx,
    iso(-0.5, 0).x,
    iso(-0.5, 0).y,
    iso(0.45, 0).x,
    iso(0.45, 0).y,
    [
      [0, "rgba(70,35,15,.3)"],
      [1, "rgba(70,35,15,0)"],
    ],
  );
  ctx.fill();
  ctx.fillStyle = rad(ctx, iso(5, 4).x, iso(5, 4).y, 620, [
    [0.4, "rgba(0,0,0,0)"],
    [1, "rgba(60,25,10,.22)"],
  ]);
  ctx.fillRect(left.x, top.y, right.x - left.x, bottom.y - top.y);
  ctx.restore();

  drawWalls(ctx, wall);
}

function drawWalls(ctx: Ctx, wall: WallId) {
  const ws = WALL_STYLE[wall];
  const { top, right, left } = ROOM;
  const H = WALL_H,
    WAIN = 54,
    THICK = 14;
  // Right wall (along x, facing +y: lit).
  const rw = [
    right,
    top,
    { x: top.x, y: top.y - H },
    { x: right.x, y: right.y - H },
  ];
  ctx.fillStyle = lin(ctx, top.x, 0, right.x, 0, [
    [0, ws.base],
    [1, ws.light],
  ]);
  poly(ctx, rw);
  ctx.fill();
  // Left wall (along y, facing +x: in shade).
  const lw = [
    top,
    left,
    { x: left.x, y: left.y - H },
    { x: top.x, y: top.y - H },
  ];
  ctx.fillStyle = lin(ctx, left.x, 0, top.x, 0, [
    [0, shade(ws.base, -0.2)],
    [1, shade(ws.base, -0.08)],
  ]);
  poly(ctx, lw);
  ctx.fill();
  // Wall patterns.
  ctx.save();
  poly(ctx, rw);
  ctx.clip();
  wallPattern(ctx, wall, "right");
  ctx.restore();
  ctx.save();
  poly(ctx, lw);
  ctx.clip();
  wallPattern(ctx, wall, "left");
  ctx.restore();
  // Wainscot panels.
  const wainR = [
    right,
    top,
    { x: top.x, y: top.y - WAIN },
    { x: right.x, y: right.y - WAIN },
  ];
  ctx.fillStyle = lin(ctx, 0, top.y - WAIN, 0, right.y, [
    [0, ws.low],
    [1, shade(ws.low, -0.15)],
  ]);
  poly(ctx, wainR);
  ctx.fill();
  const wainL = [
    top,
    left,
    { x: left.x, y: left.y - WAIN },
    { x: top.x, y: top.y - WAIN },
  ];
  ctx.fillStyle = shade(ws.low, -0.25);
  poly(ctx, wainL);
  ctx.fill();
  // Panel grooves.
  ctx.strokeStyle = "rgba(0,0,0,.18)";
  ctx.lineWidth = 1.5;
  for (let gx = 0; gx < R.cols; gx += 1) {
    const a = rightWallPt(gx - 0.1, 10),
      b = rightWallPt(gx + 0.6, 10),
      c = rightWallPt(gx + 0.6, WAIN - 10),
      d = rightWallPt(gx - 0.1, WAIN - 10);
    poly(ctx, [a, b, c, d]);
    ctx.stroke();
  }
  for (let gy = 0; gy < R.rows; gy += 1) {
    if (Math.abs(gy - DOOR.y) < 1) continue;
    const a = leftWallPt(gy - 0.1, 10),
      b = leftWallPt(gy + 0.6, 10),
      c = leftWallPt(gy + 0.6, WAIN - 10),
      d = leftWallPt(gy - 0.1, WAIN - 10);
    poly(ctx, [a, b, c, d]);
    ctx.stroke();
  }
  // Dado rail.
  ctx.strokeStyle = ws.trim;
  ctx.lineWidth = 5;
  ctx.beginPath();
  const r0 = rightWallPt(R.cols - 0.5, WAIN),
    r1 = rightWallPt(-0.5, WAIN),
    l1 = leftWallPt(R.rows - 0.5, WAIN);
  ctx.moveTo(r0.x, r0.y);
  ctx.lineTo(r1.x, r1.y);
  ctx.lineTo(l1.x, l1.y);
  ctx.stroke();
  // Wall caps (thickness) on top, and the end edges.
  const capR = [
    { x: right.x, y: right.y - H },
    { x: top.x, y: top.y - H },
    { x: top.x, y: top.y - H - THICK / 2 },
    { x: right.x + THICK, y: right.y - H - THICK / 2 },
  ];
  ctx.fillStyle = shade(ws.trim, 0.25);
  poly(ctx, capR);
  ctx.fill();
  const capL = [
    { x: top.x, y: top.y - H },
    { x: left.x, y: left.y - H },
    { x: left.x - THICK, y: left.y - H - THICK / 2 },
    { x: top.x, y: top.y - H - THICK / 2 },
  ];
  ctx.fillStyle = shade(ws.trim, 0.1);
  poly(ctx, capL);
  ctx.fill();
  // Wall end faces (the cut edges of the diorama).
  ctx.fillStyle = shade(ws.trim, -0.1);
  poly(ctx, [
    right,
    { x: right.x + THICK, y: right.y - THICK / 2 },
    { x: right.x + THICK, y: right.y - H - THICK / 2 },
    { x: right.x, y: right.y - H },
  ]);
  ctx.fill();
  ctx.fillStyle = shade(ws.trim, -0.3);
  poly(ctx, [
    left,
    { x: left.x - THICK, y: left.y - THICK / 2 },
    { x: left.x - THICK, y: left.y - H - THICK / 2 },
    { x: left.x, y: left.y - H },
  ]);
  ctx.fill();
  // Corner shading.
  ctx.fillStyle = lin(ctx, top.x - 30, 0, top.x + 30, 0, [
    [0, "rgba(0,0,0,0)"],
    [0.5, "rgba(60,30,10,.18)"],
    [1, "rgba(0,0,0,0)"],
  ]);
  ctx.fillRect(top.x - 30, top.y - H, 60, H);

  // Kitchen: tiled splashback and a range hood over the stoves.
  for (let gx = -0.5; gx < COUNTER_X1 + 0.5; gx += 0.25)
    for (let h = WAIN; h < WAIN + 60; h += 15) {
      const a = rightWallPt(gx, h),
        b = rightWallPt(gx + 0.25, h),
        c = rightWallPt(gx + 0.25, h + 15),
        d = rightWallPt(gx, h + 15);
      ctx.fillStyle = ((gx * 4 + h / 15) | 0) % 2 ? "#eef6f7" : "#d9eef0";
      poly(ctx, [a, b, c, d]);
      ctx.fill();
      ctx.strokeStyle = "rgba(90,120,130,.35)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  // Range hood: a trapezoid of brushed steel over stoves 1..4.
  {
    const a = rightWallPt(0.6, WAIN + 92),
      b = rightWallPt(4.4, WAIN + 92),
      c = rightWallPt(4.1, WAIN + 128),
      d = rightWallPt(0.9, WAIN + 128);
    const off = { x: -10, y: 5 };
    ctx.fillStyle = lin(ctx, a.x, 0, b.x, 0, [
      [0, "#9aa5ad"],
      [0.5, "#dfe6ea"],
      [1, "#aab4bb"],
    ]);
    poly(ctx, [
      { x: a.x + off.x, y: a.y + off.y },
      { x: b.x + off.x, y: b.y + off.y },
      c,
      d,
    ]);
    ctx.fill();
    ctx.fillStyle = "#6f7b84";
    poly(ctx, [
      a,
      b,
      { x: b.x + off.x, y: b.y + off.y },
      { x: a.x + off.x, y: a.y + off.y },
    ]);
    ctx.fill();
    // Chimney.
    const e = rightWallPt(2.2, WAIN + 128),
      f = rightWallPt(2.8, WAIN + 128),
      g2 = rightWallPt(2.8, H),
      h2 = rightWallPt(2.2, H);
    ctx.fillStyle = lin(ctx, e.x, 0, f.x, 0, [
      [0, "#aeb8bf"],
      [1, "#d5dde2"],
    ]);
    poly(ctx, [e, f, g2, h2]);
    ctx.fill();
  }
  // Shelf with jars over the fridge corner (left wall, near the kitchen).
  {
    const a = leftWallPt(0.2, WAIN + 70),
      b = leftWallPt(1.8, WAIN + 70);
    ctx.fillStyle = "#7a4a2a";
    poly(ctx, [a, b, { x: b.x + 8, y: b.y + 4 }, { x: a.x + 8, y: a.y + 4 }]);
    ctx.fill();
    const jars = ["#e88b4a", "#f2d15a", "#8fc66b", "#d85a5a", "#f4efe6"];
    for (let i = 0; i < 5; i++) {
      const p = leftWallPt(0.4 + i * 0.3, WAIN + 70);
      ctx.fillStyle = jars[i];
      ctx.beginPath();
      ctx.roundRect(p.x - 5 + 4, p.y - 18, 10, 18, 3);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.45)";
      ctx.fillRect(p.x - 3 + 4, p.y - 15, 2.5, 11);
      ctx.fillStyle = "#6b3d22";
      ctx.fillRect(p.x - 5 + 4, p.y - 21, 10, 4);
    }
  }
}

function wallPattern(ctx: Ctx, wall: WallId, side: "left" | "right") {
  const pt = side === "right" ? rightWallPt : leftWallPt;
  const span = side === "right" ? R.cols : R.rows;
  if (wall === "mint") {
    for (let g = -0.5; g < span; g += 0.5) {
      const a = pt(g, 0),
        b = pt(g + 0.22, 0),
        c = pt(g + 0.22, WALL_H),
        d = pt(g, WALL_H);
      ctx.fillStyle = "rgba(255,255,255,.35)";
      poly(ctx, [a, b, c, d]);
      ctx.fill();
    }
  } else if (wall === "brick") {
    for (let h = 0, row = 0; h < WALL_H; h += 13, row++)
      for (let g = -0.5 + (row % 2) * 0.17; g < span; g += 0.34) {
        const a = pt(g + 0.01, h + 1),
          b = pt(g + 0.32, h + 1),
          c = pt(g + 0.32, h + 12),
          d = pt(g + 0.01, h + 12);
        ctx.fillStyle =
          (row * 7 + Math.round(g * 9)) % 5 === 0
            ? "rgba(90,30,20,.22)"
            : "rgba(255,190,160,.1)";
        poly(ctx, [a, b, c, d]);
        ctx.fill();
        ctx.strokeStyle = "rgba(240,215,200,.35)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
  } else {
    // Butter: a fine damask of small diamonds.
    ctx.fillStyle = "rgba(200,140,60,.13)";
    for (let h = 70; h < WALL_H - 6; h += 22)
      for (let g = -0.5 + ((h / 22) % 2) * 0.25; g < span; g += 0.5) {
        const c = pt(g, h);
        ctx.beginPath();
        ctx.moveTo(c.x, c.y - 5);
        ctx.lineTo(c.x + 3.5 * (side === "right" ? 1 : -1), c.y - 1);
        ctx.lineTo(c.x, c.y + 4);
        ctx.lineTo(c.x - 3.5 * (side === "right" ? 1 : -1), c.y);
        ctx.closePath();
        ctx.fill();
      }
  }
}

/* ───────────── windows, the door and the menu board (live) ───────────── */

function quadOnWall(
  side: "left" | "right",
  g0: number,
  g1: number,
  h0: number,
  h1: number,
) {
  const pt = side === "right" ? rightWallPt : leftWallPt;
  return [pt(g0, h0), pt(g1, h0), pt(g1, h1), pt(g0, h1)];
}
/** Glass with the sky, clouds or stars, then frames and curtains. */
export function drawWindows(ctx: Ctx, l: Light, low: boolean) {
  const [skyTop, skyBot] = skyColours(l);
  const H0 = 66,
    H1 = 146;
  const all: ["left" | "right", number, number][] = [
    ...WINDOWS.right.map(
      ([a, b]) => ["right", a, b] as ["right", number, number],
    ),
    ...WINDOWS.left.map(([a, b]) => ["left", a, b] as ["left", number, number]),
  ];
  for (const [side, g0, g1] of all) {
    const q = quadOnWall(side, g0, g1, H0, H1);
    ctx.save();
    poly(ctx, q);
    ctx.clip();
    const ys = Math.min(q[0].y, q[1].y) - (H1 - H0),
      ye = Math.max(q[0].y, q[1].y);
    ctx.fillStyle = lin(ctx, 0, ys, 0, ye, [
      [0, skyTop],
      [1, skyBot],
    ]);
    ctx.fillRect(
      Math.min(q[0].x, q[1].x) - 5,
      ys - 5,
      Math.abs(q[1].x - q[0].x) + 10,
      ye - ys + 10,
    );
    const cx = (q[0].x + q[1].x) / 2,
      cy = (q[0].y + q[2].y) / 2;
    if (l.night > 0.4) {
      // Stars and, in the first window, the moon.
      for (let i = 0; i < 14; i++) {
        const sx = cx - 50 + ((i * 37) % 100),
          sy = cy - 50 + ((i * 53) % 90);
        const tw = 0.5 + 0.5 * Math.sin(l.t * 2 + i * 1.7);
        ctx.fillStyle = `rgba(255,250,220,${(0.4 + tw * 0.6) * l.night})`;
        ctx.fillRect(sx, sy, 1.6, 1.6);
      }
      if (side === "right" && g0 === WINDOWS.right[1]?.[0]) {
        ctx.fillStyle = rad(ctx, cx + 10, cy - 18, 26, [
          [0, `rgba(255,248,220,${0.35 * l.night})`],
          [1, "rgba(255,248,220,0)"],
        ]);
        ctx.fillRect(cx - 20, cy - 48, 60, 60);
        ctx.fillStyle = `rgba(255,248,225,${l.night})`;
        ctx.beginPath();
        ctx.arc(cx + 10, cy - 18, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Drifting clouds; a sun glow by day.
      const drift = low ? 0 : l.t * 4;
      for (let i = 0; i < 3; i++) {
        const x = cx - 80 + ((drift + i * 61 + g0 * 40) % 170),
          y = cy - 22 + i * 14;
        ctx.fillStyle = `rgba(255,255,255,${0.75 - l.gold * 0.25})`;
        ctx.beginPath();
        ctx.ellipse(x, y, 16, 6, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 10, y - 4, 10, 6, 0, 0, Math.PI * 2);
        ctx.ellipse(x - 9, y - 2, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Rooftops and a tree line outside.
    ctx.fillStyle =
      l.night > 0.5 ? "rgba(20,18,40,.85)" : "rgba(90,140,110,.55)";
    ctx.beginPath();
    const base = Math.max(q[0].y, q[1].y);
    for (
      let x = Math.min(q[0].x, q[1].x) - 4;
      x < Math.max(q[0].x, q[1].x) + 6;
      x += 9
    ) {
      ctx.arc(x, base - 14 - ((x * 7) % 9), 8, 0, Math.PI * 2);
    }
    ctx.fill();
    // Glass sheen.
    ctx.fillStyle = "rgba(255,255,255,.16)";
    const s0 = quadOnWall(
      side,
      g0 + (g1 - g0) * 0.15,
      g0 + (g1 - g0) * 0.32,
      H0,
      H1,
    );
    poly(ctx, [s0[0], s0[1], { x: s0[2].x, y: s0[2].y }, s0[3]]);
    ctx.fill();
    ctx.restore();
    // Frame and muntins.
    const ws = "#fff8ec";
    ctx.strokeStyle = ws;
    ctx.lineWidth = 6;
    poly(ctx, q);
    ctx.stroke();
    ctx.lineWidth = 3;
    const m = quadOnWall(side, (g0 + g1) / 2, (g0 + g1) / 2, H0, H1);
    ctx.beginPath();
    ctx.moveTo(m[0].x, m[0].y);
    ctx.lineTo(m[3].x, m[3].y);
    const mid = quadOnWall(side, g0, g1, (H0 + H1) / 2, (H0 + H1) / 2);
    ctx.moveTo(mid[0].x, mid[0].y);
    ctx.lineTo(mid[1].x, mid[1].y);
    ctx.stroke();
    // Sill.
    const sill = quadOnWall(side, g0 - 0.08, g1 + 0.08, H0 - 6, H0);
    ctx.fillStyle = "#f3e2c6";
    poly(ctx, sill);
    ctx.fill();
    // Curtains: two soft drapes with folds.
    for (const end of [0, 1]) {
      const a = end ? g1 - 0.32 : g0 - 0.12,
        b = end ? g1 + 0.12 : g0 + 0.32;
      const c = quadOnWall(side, a, b, H0 - 8, H1 + 10);
      ctx.fillStyle = lin(ctx, c[0].x, 0, c[1].x, 0, [
        [0, "#c8463e"],
        [0.3, "#e0645a"],
        [0.55, "#b83a33"],
        [0.8, "#e0645a"],
        [1, "#a6322c"],
      ]);
      ctx.beginPath();
      ctx.moveTo(c[3].x, c[3].y);
      ctx.lineTo(c[2].x, c[2].y);
      const tie = quadOnWall(
        side,
        end ? g1 - 0.05 : g0 + 0.05,
        end ? g1 - 0.05 : g0 + 0.05,
        H0 + 30,
        H0 + 30,
      )[0];
      ctx.quadraticCurveTo(tie.x + (end ? 4 : -4), tie.y, c[1].x, c[1].y);
      ctx.lineTo(c[0].x, c[0].y);
      ctx.quadraticCurveTo(tie.x, tie.y + 6, c[3].x, c[3].y);
      ctx.fill();
    }
    // Valance rod.
    const rod = quadOnWall(side, g0 - 0.2, g1 + 0.2, H1 + 10, H1 + 14);
    ctx.fillStyle = "#6b3d22";
    poly(ctx, rod);
    ctx.fill();
  }
}

/** The door (open when someone passes) and the menu board on the left wall. */
export function drawDoorAndBoard(
  ctx: Ctx,
  open: number,
  special: string,
  l: Light,
) {
  const g0 = DOOR.y - 0.42,
    g1 = DOOR.y + 0.42;
  const frame = quadOnWall("left", g0 - 0.08, g1 + 0.08, 0, 128);
  ctx.fillStyle = "#5b3420";
  poly(ctx, frame);
  ctx.fill();
  const hole = quadOnWall("left", g0, g1, 0, 120);
  ctx.fillStyle = l.night > 0.5 ? "#1a1830" : "#9fd2ef";
  poly(ctx, hole);
  ctx.fill();
  // Street outside: a hint of pavement and light.
  ctx.save();
  poly(ctx, hole);
  ctx.clip();
  ctx.fillStyle = l.night > 0.5 ? "#2c2a3c" : "#c7b9a0";
  ctx.fillRect(hole[0].x - 40, hole[0].y - 26, 80, 40);
  ctx.restore();
  // The door leaf swings in (toward +x) as it opens.
  const swing = Math.min(1, Math.max(0, open));
  const hinge = leftWallPt(g1, 0);
  const closedEnd = leftWallPt(g0, 0);
  const openEnd = iso(-0.5 + 0.84, g1);
  const end = {
    x: closedEnd.x + (openEnd.x - closedEnd.x) * swing,
    y: closedEnd.y + (openEnd.y - closedEnd.y) * swing,
  };
  const leaf = [
    hinge,
    end,
    { x: end.x, y: end.y - 118 },
    { x: hinge.x, y: hinge.y - 118 },
  ];
  ctx.fillStyle = lin(ctx, hinge.x, 0, end.x, 0, [
    [0, "#7a4527"],
    [1, "#a1613a"],
  ]);
  poly(ctx, leaf);
  ctx.fill();
  // Its glass panel.
  const lerp = (
    p: { x: number; y: number },
    q: { x: number; y: number },
    f: number,
  ) => ({
    x: p.x + (q.x - p.x) * f,
    y: p.y + (q.y - p.y) * f,
  });
  const gA = lerp(hinge, end, 0.2),
    gB = lerp(hinge, end, 0.8);
  ctx.fillStyle =
    l.night > 0.5 ? "rgba(255,210,140,.55)" : "rgba(190,230,250,.75)";
  poly(ctx, [
    { x: gA.x, y: gA.y - 62 },
    { x: gB.x, y: gB.y - 62 },
    { x: gB.x, y: gB.y - 104 },
    { x: gA.x, y: gA.y - 104 },
  ]);
  ctx.fill();
  // Knob.
  const kn = lerp(hinge, end, 0.88);
  ctx.fillStyle = "#f2c14e";
  ctx.beginPath();
  ctx.arc(kn.x, kn.y - 56, 3.2, 0, Math.PI * 2);
  ctx.fill();
  // Bell over the door.
  const bell = leftWallPt(DOOR.y, 132);
  ctx.fillStyle = "#e6b33c";
  ctx.beginPath();
  ctx.moveTo(bell.x - 6, bell.y + 6);
  ctx.quadraticCurveTo(bell.x, bell.y - 10, bell.x + 6, bell.y + 6);
  ctx.closePath();
  ctx.fill();

  // Menu board: a chalkboard in a wooden frame.
  const b = quadOnWall("left", BOARD[0], BOARD[1], 74, 140);
  ctx.fillStyle = "#6d4025";
  poly(ctx, quadOnWall("left", BOARD[0] - 0.06, BOARD[1] + 0.06, 70, 144));
  ctx.fill();
  ctx.fillStyle = "#24362d";
  poly(ctx, b);
  ctx.fill();
  // Chalk text in the wall's plane (a skew transform).
  // Text runs left to right on screen: from the board's far (g1) edge.
  const o = b[2],
    u = { x: b[3].x - b[2].x, y: b[3].y - b[2].y };
  const len = Math.hypot(u.x, u.y);
  ctx.save();
  ctx.setTransform(
    ctx
      .getTransform()
      .multiply(new DOMMatrix([u.x / len, u.y / len, 0, 1, o.x, o.y])),
  );
  ctx.fillStyle = "rgba(255,255,255,.9)";
  ctx.font = "700 11px 'Barlow Condensed', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("TODAY'S SPECIAL", len / 2, 18);
  ctx.fillStyle = "#ffd65b";
  // Long names shrink to fit the board.
  let size = 13;
  ctx.font = `800 ${size}px 'Barlow Condensed', sans-serif`;
  while (size > 7 && ctx.measureText(special.toUpperCase()).width > len - 10) {
    size -= 0.5;
    ctx.font = `800 ${size}px 'Barlow Condensed', sans-serif`;
  }
  ctx.fillText(special.toUpperCase(), len / 2, 36);
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.font = "600 9px 'DM Sans', sans-serif";
  ctx.fillText("× 1.5 coins", len / 2, 52);
  ctx.restore();
}

/** Festoon bulbs along the top of both walls (they glow at night). */
export function festoonPoints(): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let g = R.rows - 0.8; g > -0.5; g -= 0.55)
    pts.push(leftWallPt(g, WALL_H - 18 - Math.abs(Math.sin(g * 2.86)) * 10));
  for (let g = -0.2; g < R.cols - 0.4; g += 0.55)
    pts.push(rightWallPt(g, WALL_H - 18 - Math.abs(Math.sin(g * 2.86)) * 10));
  return pts;
}
export function drawFestoon(ctx: Ctx, l: Light) {
  const pts = festoonPoints();
  ctx.strokeStyle = "rgba(60,35,20,.7)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i];
    ctx.quadraticCurveTo((a.x + b.x) / 2, Math.max(a.y, b.y) + 6, b.x, b.y);
  }
  ctx.stroke();
  const cols = ["#ffd36b", "#ff8f6b", "#9fe3ff", "#c6ff8f", "#ffb3e6"];
  pts.forEach((p, i) => {
    const on = 0.55 + 0.45 * l.night;
    ctx.fillStyle = cols[i % cols.length];
    ctx.globalAlpha = on;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 6, 2.6, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

/* ───────────── kitchen fixtures ───────────── */

export function drawCounterTile(ctx: Ctx, x: number, last: boolean) {
  const y = COUNTER_ROW;
  // Body: wood with tile inlay, then a marble top that overhangs.
  isoBox(
    ctx,
    x - 0.5,
    y - 0.36,
    x + 0.5,
    y + 0.36,
    0,
    40,
    {
      top: "#7a4a2b",
      left: lin(ctx, 0, iso(x, y).y - 40, 0, iso(x, y).y + 20, [
        [0, "#b06a3c"],
        [1, "#7f4526"],
      ]),
      right: "#6e3c20",
    },
    { left: true, right: last },
  );
  // Front inlay: little blue tiles.
  for (let i = 0; i < 4; i++) {
    const a = iso(x - 0.5 + i * 0.25 + 0.03, y + 0.36),
      b = iso(x - 0.5 + (i + 1) * 0.25 - 0.03, y + 0.36);
    ctx.fillStyle = i % 2 ? "#2f7fa8" : "#f1e7d0";
    poly(ctx, [
      { x: a.x, y: a.y - 14 },
      { x: b.x, y: b.y - 14 },
      { x: b.x, y: b.y - 28 },
      { x: a.x, y: a.y - 28 },
    ]);
    ctx.fill();
  }
  isoBox(
    ctx,
    x - 0.52,
    y - 0.42,
    x + 0.52,
    y + 0.42,
    40,
    6,
    {
      top: lin(ctx, iso(x, y).x - 40, 0, iso(x, y).x + 40, 0, [
        [0, "#f4f1ea"],
        [0.5, "#ffffff"],
        [1, "#e4dfd4"],
      ]),
      left: "#cfc8bb",
      right: "#bdb5a7",
    },
    { left: true, right: last },
  );
}

export type Fixture = "fridge" | "sink" | "stove" | "stove-locked";
export function drawFixture(
  ctx: Ctx,
  kind: Fixture,
  x: number,
  y: number,
  t: number,
  fire: number,
) {
  if (kind === "fridge") {
    isoBox(ctx, x - 0.42, y - 0.42, x + 0.42, y + 0.42, 0, 104, {
      top: "#e9eef1",
      left: lin(ctx, 0, iso(x, y).y - 100, 0, iso(x, y).y, [
        [0, "#f7fbfc"],
        [1, "#cfd8dd"],
      ]),
      right: "#b9c4ca",
    });
    const p = iso(x, y + 0.42);
    ctx.fillStyle = "#9aa7ae";
    ctx.fillRect(p.x + 10, p.y - 82, 3, 26);
    ctx.fillRect(p.x + 10, p.y - 44, 3, 18);
    ctx.strokeStyle = "rgba(0,0,0,.15)";
    ctx.beginPath();
    const a = iso(x - 0.42, y + 0.42),
      b = iso(x + 0.42, y + 0.42);
    ctx.moveTo(a.x, a.y - 60);
    ctx.lineTo(b.x, b.y - 60);
    ctx.stroke();
    // Magnets.
    ctx.fillStyle = "#ff6b6b";
    ctx.beginPath();
    ctx.arc(p.x - 12, p.y - 76, 3, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#ffd65b";
    ctx.fillRect(p.x - 6, p.y - 90, 10, 8);
    return;
  }
  // Worktop cabinets for the sink and the stoves.
  isoBox(ctx, x - 0.48, y - 0.42, x + 0.48, y + 0.42, 0, 40, {
    top: "#ccd3d8",
    left: lin(ctx, 0, iso(x, y).y - 40, 0, iso(x, y).y + 10, [
      [0, "#eef1f3"],
      [1, "#c3cbd1"],
    ]),
    right: "#aab4bb",
  });
  const c = iso(x, y);
  if (kind === "sink") {
    isoBox(ctx, x - 0.5, y - 0.44, x + 0.5, y + 0.44, 40, 4, {
      top: "#e7ebee",
      left: "#c0c8ce",
      right: "#aeb7bd",
    });
    ctx.fillStyle = "#9fb0bb";
    ellipse(ctx, c.x, c.y - 44, 22, 10);
    ctx.fill();
    ctx.fillStyle = "#c6d6df";
    ellipse(ctx, c.x, c.y - 46, 18, 7);
    ctx.fill();
    ctx.strokeStyle = "#8a959d";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(c.x + 4, c.y - 56);
    ctx.lineTo(c.x + 4, c.y - 70);
    ctx.quadraticCurveTo(c.x + 4, c.y - 76, c.x - 4, c.y - 70);
    ctx.stroke();
    return;
  }
  // Stove: dark enamel top, two burners, an oven door.
  isoBox(ctx, x - 0.5, y - 0.44, x + 0.5, y + 0.44, 40, 4, {
    top: "#2d2f36",
    left: "#1c1d22",
    right: "#16171b",
  });
  const d = iso(x, y + 0.42);
  ctx.fillStyle = "#3b3e47";
  ctx.beginPath();
  ctx.roundRect(d.x - 26, d.y - 34, 30, 20, 3);
  ctx.fill();
  ctx.fillStyle =
    kind === "stove-locked"
      ? "#2a2c33"
      : `rgba(255,140,60,${0.25 + fire * 0.45})`;
  ctx.beginPath();
  ctx.roundRect(d.x - 22, d.y - 30, 22, 12, 2);
  ctx.fill();
  // Knobs.
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = "#c9ced3";
    ctx.beginPath();
    ctx.arc(d.x + 10 + i * 8, d.y - 32 + i * -4 + 6, 2.4, 0, 7);
    ctx.fill();
  }
  // Burner ring.
  ctx.strokeStyle = "#555a64";
  ctx.lineWidth = 3;
  ellipse(ctx, c.x, c.y - 45, 15, 7);
  ctx.stroke();
  if (fire > 0) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const fx = c.x + Math.cos(a) * 14,
        fy = c.y - 45 + Math.sin(a) * 6.5;
      const fl = (5 + Math.sin(t * 14 + i * 2.1) * 2.2) * fire;
      ctx.fillStyle = lin(ctx, 0, fy - fl, 0, fy, [
        [0, "rgba(255,240,180,0)"],
        [0.4, "rgba(120,190,255,.85)"],
        [1, "rgba(60,110,255,.95)"],
      ]);
      ctx.beginPath();
      ctx.moveTo(fx - 2, fy);
      ctx.quadraticCurveTo(fx, fy - fl * 1.4, fx + 2, fy);
      ctx.fill();
    }
  }
  if (kind === "stove-locked") {
    ctx.fillStyle = "rgba(20,20,30,.45)";
    poly(
      ctx,
      [
        iso(x - 0.5, y - 0.44),
        iso(x + 0.5, y - 0.44),
        iso(x + 0.5, y + 0.44),
        iso(x - 0.5, y + 0.44),
      ].map((p) => ({ x: p.x, y: p.y - 44 })),
    );
    ctx.fill();
  }
}

/** The pot on a stove: lid jiggles while it cooks; gold rim in the perfect window. */
export function drawPot(
  ctx: Ctx,
  x: number,
  y: number,
  t: number,
  cooking: boolean,
  golden: number,
  ready: boolean,
) {
  const c = iso(x, y);
  const by = c.y - 46;
  const jig = cooking ? Math.sin(t * 22) * 1.2 : 0;
  // Body.
  ctx.fillStyle = lin(ctx, c.x - 18, 0, c.x + 18, 0, [
    [0, "#7c858f"],
    [0.35, "#e8edf1"],
    [0.6, "#b9c2ca"],
    [1, "#6e7781"],
  ]);
  ctx.beginPath();
  ctx.moveTo(c.x - 17, by - 22);
  ctx.lineTo(c.x - 15, by - 2);
  ctx.quadraticCurveTo(c.x, by + 6, c.x + 15, by - 2);
  ctx.lineTo(c.x + 17, by - 22);
  ctx.closePath();
  ctx.fill();
  // Handles.
  ctx.fillStyle = "#3a3d44";
  ctx.fillRect(c.x - 23, by - 18, 6, 3);
  ctx.fillRect(c.x + 17, by - 18, 6, 3);
  // Lid.
  const ly = by - 22 + (cooking ? Math.abs(jig) * -1.5 : 0);
  ctx.fillStyle =
    golden > 0
      ? `rgb(${200 + golden * 55},${190 + golden * 30},${110})`
      : "#aab3bb";
  ellipse(ctx, c.x + jig * 0.5, ly, 18, 6);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.45)";
  ellipse(ctx, c.x - 5 + jig * 0.5, ly - 1.5, 8, 2);
  ctx.fill();
  ctx.fillStyle = "#33363d";
  ellipse(ctx, c.x + jig * 0.5, ly - 4, 4, 2.5);
  ctx.fill();
  if (golden > 0) {
    ctx.strokeStyle = `rgba(255,214,91,${0.5 + 0.5 * Math.sin(t * 10)})`;
    ctx.lineWidth = 3;
    ellipse(ctx, c.x, ly, 22, 8);
    ctx.stroke();
  }
  if (ready) {
    // A cheerful glint on a finished pot.
    ctx.fillStyle = `rgba(255,255,255,${0.6 + 0.4 * Math.sin(t * 6)})`;
    drawSparkle(ctx, c.x + 12, by - 28, 6);
  }
}
export function drawSparkle(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

/* ───────────── furniture and decorations ───────────── */

export function drawRug(ctx: Ctx, x: number, y: number) {
  const pts = [
    iso(x - 0.35, y - 0.35),
    iso(x + 1.35, y - 0.35),
    iso(x + 1.35, y + 1.35),
    iso(x - 0.35, y + 1.35),
  ];
  ctx.fillStyle = "#8f2f3a";
  poly(ctx, pts);
  ctx.fill();
  const inner = [
    iso(x - 0.2, y - 0.2),
    iso(x + 1.2, y - 0.2),
    iso(x + 1.2, y + 1.2),
    iso(x - 0.2, y + 1.2),
  ];
  ctx.strokeStyle = "#f2c66d";
  ctx.lineWidth = 3;
  poly(ctx, inner);
  ctx.stroke();
  const c = iso(x + 0.5, y + 0.5);
  ctx.fillStyle = "#d9a441";
  poly(ctx, [
    { x: c.x, y: c.y - 22 },
    { x: c.x + 44, y: c.y },
    { x: c.x, y: c.y + 22 },
    { x: c.x - 44, y: c.y },
  ]);
  ctx.fill();
  ctx.fillStyle = "#1f5d73";
  poly(ctx, [
    { x: c.x, y: c.y - 12 },
    { x: c.x + 24, y: c.y },
    { x: c.x, y: c.y + 12 },
    { x: c.x - 24, y: c.y },
  ]);
  ctx.fill();
  // Fringe.
  ctx.strokeStyle = "#f3e2c0";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 12; i++) {
    const p = iso(x - 0.35 + (i / 12) * 1.7, y + 1.35);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - 2, p.y + 4);
    ctx.stroke();
  }
}

export function drawTable(ctx: Ctx, x: number, y: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 36, 15, 0.3);
  // Pedestal and foot.
  ctx.fillStyle = "#4a2b19";
  ellipse(ctx, c.x, c.y, 14, 6);
  ctx.fill();
  ctx.fillStyle = lin(ctx, c.x - 4, 0, c.x + 4, 0, [
    [0, "#5c3520"],
    [1, "#8a5534"],
  ]);
  ctx.fillRect(c.x - 4, c.y - 30, 8, 30);
  // Cloth: a round top with a skirt that falls in soft scallops.
  const ty = c.y - 32;
  ctx.fillStyle = lin(ctx, c.x - 34, 0, c.x + 34, 0, [
    [0, "#e9e2d6"],
    [0.5, "#fffdf8"],
    [1, "#ddd4c5"],
  ]);
  ctx.beginPath();
  ctx.ellipse(c.x, ty, 34, 16, 0, 0, Math.PI);
  ctx.lineTo(c.x - 34, ty);
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI - (i / 8) * Math.PI;
    const px = c.x + Math.cos(a) * 35,
      py = ty + Math.sin(a) * 16 + 10 + (i % 2) * 2;
    ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  // Red trim.
  ctx.strokeStyle = "#d24c4c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(c.x, ty + 9, 34.5, 16, 0, 0.1, Math.PI - 0.1);
  ctx.stroke();
  // Top.
  ctx.fillStyle = rad(ctx, c.x - 8, ty - 4, 40, [
    [0, "#ffffff"],
    [1, "#efe7da"],
  ]);
  ellipse(ctx, c.x, ty, 32, 15);
  ctx.fill();
  // A little vase with a flower.
  ctx.fillStyle = "#4f9fd1";
  ctx.beginPath();
  ctx.roundRect(c.x - 3, ty - 12, 6, 9, 2);
  ctx.fill();
  ctx.strokeStyle = "#3f8c3a";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(c.x, ty - 12);
  ctx.lineTo(c.x + 1, ty - 19);
  ctx.stroke();
  ctx.fillStyle = "#ff7aa8";
  ctx.beginPath();
  ctx.arc(c.x + 1, ty - 20, 3, 0, 7);
  ctx.fill();
}
/** Where a plate goes on a table, on the side toward the chair in direction `dir` from the table. */
export function tableSpot(x: number, y: number, dirFromTable: number) {
  const c = iso(x, y);
  const off = [
    { x: 12, y: 5 },
    { x: -12, y: 5 },
    { x: -12, y: -5 },
    { x: 12, y: -5 },
  ][dirFromTable];
  return { x: c.x + off.x, y: c.y - 34 + off.y };
}

const CUSHIONS = ["#e0594d", "#3d8fd1", "#f2b53c", "#5cb36b"];
export function drawChair(
  ctx: Ctx,
  x: number,
  y: number,
  dir: number,
  back: "behind" | "front" | "all",
  tint = 0,
) {
  const c = iso(x, y);
  // `dir` faces the table; the backrest sits on the opposite side.
  const bx = [-1, 0, 1, 0][dir] * 0.32,
    by = [0, -1, 0, 1][dir] * 0.32;
  const bp = iso(x + bx, y + by);
  const backIsFar = dir === 0 || dir === 1; // back toward the wall side
  const drawBack = () => {
    // Backrest: a slatted panel, drawn as a vertical quad along the back edge.
    const along = dir % 2 === 0 ? { x: 0, y: 0.32 } : { x: 0.32, y: 0 };
    const p0 = iso(x + bx - along.x, y + by - along.y),
      p1 = iso(x + bx + along.x, y + by + along.y);
    ctx.fillStyle = lin(ctx, 0, p0.y - 52, 0, p0.y, [
      [0, "#a8683f"],
      [1, "#6e3f24"],
    ]);
    poly(ctx, [
      { x: p0.x, y: p0.y - 20 },
      { x: p1.x, y: p1.y - 20 },
      { x: p1.x, y: p1.y - 52 },
      { x: p0.x, y: p0.y - 52 },
    ]);
    ctx.fill();
    ctx.fillStyle = "rgba(255,230,200,.25)";
    poly(ctx, [
      { x: p0.x, y: p0.y - 46 },
      { x: p1.x, y: p1.y - 46 },
      { x: p1.x, y: p1.y - 52 },
      { x: p0.x, y: p0.y - 52 },
    ]);
    ctx.fill();
    void bp;
  };
  if (back === "all" || back === "behind") {
    softShadow(ctx, c.x, c.y + 2, 24, 11, 0.22);
    if (backIsFar) drawBack();
    // Legs.
    ctx.strokeStyle = "#5a321c";
    ctx.lineWidth = 3;
    for (const [lx, ly] of [
      [-0.28, -0.28],
      [0.28, -0.28],
      [0.28, 0.28],
      [-0.28, 0.28],
    ]) {
      const p = iso(x + lx, y + ly);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - 20);
      ctx.stroke();
    }
    // Seat with a cushion.
    isoBox(ctx, x - 0.32, y - 0.32, x + 0.32, y + 0.32, 18, 4, {
      top: "#8a5232",
      left: "#6a3c22",
      right: "#5a321c",
    });
    const cu = CUSHIONS[(x * 7 + y * 3 + tint) % CUSHIONS.length];
    ctx.fillStyle = cu;
    const s = iso(x, y);
    ctx.beginPath();
    ctx.ellipse(s.x, s.y - 24, 17, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.3)";
    ctx.beginPath();
    ctx.ellipse(s.x - 4, s.y - 26, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if ((back === "all" || back === "front") && !backIsFar) drawBack();
}

export function drawPlant(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 20, 9, 0.26);
  // Terracotta pot.
  ctx.fillStyle = lin(ctx, c.x - 14, 0, c.x + 14, 0, [
    [0, "#a24e2c"],
    [0.4, "#de7d4f"],
    [1, "#8f4325"],
  ]);
  ctx.beginPath();
  ctx.moveTo(c.x - 14, c.y - 26);
  ctx.lineTo(c.x - 10, c.y);
  ctx.quadraticCurveTo(c.x, c.y + 4, c.x + 10, c.y);
  ctx.lineTo(c.x + 14, c.y - 26);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#b65b33";
  ellipse(ctx, c.x, c.y - 26, 15, 5);
  ctx.fill();
  ctx.fillStyle = "#4a2a18";
  ellipse(ctx, c.x, c.y - 26, 12, 3.5);
  ctx.fill();
  // Fern fronds, swaying.
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.33 + Math.sin(t * 1.3 + i) * 0.04;
    const len = 30 + ((i * 7) % 11);
    const ex = c.x + Math.cos(a) * len,
      ey = c.y - 28 + Math.sin(a) * len;
    ctx.strokeStyle = i % 2 ? "#3f8f45" : "#58ad4f";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - 26);
    ctx.quadraticCurveTo(
      c.x + Math.cos(a) * len * 0.5,
      c.y - 34 + Math.sin(a) * len * 0.8,
      ex,
      ey + 6,
    );
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}

export function drawLamp(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 16, 7, 0.24);
  ctx.fillStyle = "#3a2618";
  ellipse(ctx, c.x, c.y, 10, 4);
  ctx.fill();
  ctx.fillStyle = "#4b301d";
  ctx.fillRect(c.x - 1.5, c.y - 74, 3, 74);
  // A hooked arm with a red paper lantern.
  ctx.strokeStyle = "#4b301d";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - 74);
  ctx.quadraticCurveTo(c.x + 2, c.y - 86, c.x + 14, c.y - 84);
  ctx.stroke();
  const sw = Math.sin(t * 1.6) * 1.5;
  const lx = c.x + 14 + sw,
    ly = c.y - 66;
  ctx.fillStyle = rad(ctx, lx - 4, ly - 4, 18, [
    [0, "#ff9a6a"],
    [0.7, "#e2453a"],
    [1, "#a92a25"],
  ]);
  ellipse(ctx, lx, ly, 13, 15);
  ctx.fill();
  ctx.strokeStyle = "rgba(120,20,15,.5)";
  ctx.lineWidth = 1;
  for (const k of [-6, 0, 6]) {
    ctx.beginPath();
    ctx.ellipse(
      lx,
      ly,
      Math.abs(13 - Math.abs(k)) * 0.9 + 1,
      15,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    void k;
  }
  ctx.fillStyle = "#f2c14e";
  ctx.fillRect(lx - 6, ly - 17, 12, 3);
  ctx.fillRect(lx - 6, ly + 14, 12, 3);
  ctx.strokeStyle = "#f2c14e";
  ctx.beginPath();
  ctx.moveTo(lx, ly + 17);
  ctx.lineTo(lx, ly + 25);
  ctx.stroke();
}

export function drawBonsai(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 22, 10, 0.26);
  isoBox(ctx, x - 0.3, y - 0.3, x + 0.3, y + 0.3, 0, 28, {
    top: "#5b3420",
    left: "#7c4a2b",
    right: "#4f2d1a",
  });
  ctx.fillStyle = "#2f4f6e";
  ctx.beginPath();
  ctx.roundRect(c.x - 15, c.y - 38, 30, 9, 3);
  ctx.fill();
  ctx.strokeStyle = "#6b4026";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - 37);
  ctx.bezierCurveTo(c.x - 10, c.y - 46, c.x + 10, c.y - 54, c.x - 4, c.y - 62);
  ctx.stroke();
  const pads: [number, number, number][] = [
    [-12, -62, 11],
    [6, -66, 12],
    [-2, -74, 10],
    [12, -54, 8],
  ];
  for (const [dx, dy, r] of pads) {
    const s = Math.sin(t * 1.2 + dx) * 0.6;
    ctx.fillStyle = rad(ctx, c.x + dx - 3, c.y + dy - 3, r + 2, [
      [0, "#9be08a"],
      [1, "#3f8a3c"],
    ]);
    ellipse(ctx, c.x + dx + s, c.y + dy, r, r * 0.6);
    ctx.fill();
  }
}

export function drawLuckyCat(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 20, 9, 0.26);
  isoBox(ctx, x - 0.26, y - 0.26, x + 0.26, y + 0.26, 0, 22, {
    top: "#c63b35",
    left: "#a92f2a",
    right: "#8e2622",
  });
  const by = c.y - 22;
  // Body.
  ctx.fillStyle = rad(ctx, c.x - 4, by - 18, 22, [
    [0, "#ffffff"],
    [1, "#e6e1da"],
  ]);
  ellipse(ctx, c.x, by - 14, 13, 15);
  ctx.fill();
  // Head.
  ellipse(ctx, c.x, by - 34, 12, 10);
  ctx.fill();
  // Ears.
  ctx.beginPath();
  ctx.moveTo(c.x - 11, by - 38);
  ctx.lineTo(c.x - 8, by - 48);
  ctx.lineTo(c.x - 3, by - 42);
  ctx.moveTo(c.x + 11, by - 38);
  ctx.lineTo(c.x + 8, by - 48);
  ctx.lineTo(c.x + 3, by - 42);
  ctx.fill();
  ctx.fillStyle = "#f29aa6";
  ctx.beginPath();
  ctx.moveTo(c.x - 9, by - 40);
  ctx.lineTo(c.x - 8, by - 45);
  ctx.lineTo(c.x - 5, by - 42);
  ctx.fill();
  // Face.
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(c.x - 4.5, by - 34, 2, Math.PI, 0);
  ctx.moveTo(c.x + 2.5, by - 34);
  ctx.arc(c.x + 4.5, by - 34, 2, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = "#ff8a8a";
  ctx.beginPath();
  ctx.arc(c.x, by - 30.5, 1.4, 0, 7);
  ctx.fill();
  // Gold coin and red collar with a bell.
  ctx.fillStyle = "#d2302d";
  ctx.fillRect(c.x - 10, by - 26, 20, 3);
  ctx.fillStyle = "#f2c14e";
  ctx.beginPath();
  ctx.arc(c.x, by - 21, 2.6, 0, 7);
  ctx.fill();
  ctx.fillStyle = lin(ctx, 0, by - 16, 0, by - 4, [
    [0, "#ffe27a"],
    [1, "#d39b22"],
  ]);
  ellipse(ctx, c.x, by - 10, 7, 6);
  ctx.fill();
  // The waving paw.
  const wave = Math.sin(t * 4) * 0.45;
  ctx.save();
  ctx.translate(c.x + 9, by - 22);
  ctx.rotate(-0.5 + wave);
  ctx.fillStyle = "#fbf8f4";
  ctx.beginPath();
  ctx.roundRect(-3.5, -18, 7, 18, 3.5);
  ctx.fill();
  ctx.restore();
}

export function drawJukebox(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 26, 12, 0.3);
  isoBox(ctx, x - 0.34, y - 0.3, x + 0.34, y + 0.3, 0, 62, {
    top: "#7c3f1e",
    left: lin(ctx, 0, c.y - 60, 0, c.y, [
      [0, "#b4602d"],
      [1, "#7c3f1e"],
    ]),
    right: "#5d2f16",
  });
  // The arched front with neon tubes cycling colour.
  const f = iso(x, y + 0.3);
  const hue = (t * 60) % 360;
  ctx.fillStyle = `hsl(${hue},90%,62%)`;
  ctx.beginPath();
  ctx.moveTo(f.x - 18, f.y - 36);
  ctx.quadraticCurveTo(f.x, f.y - 90, f.x + 18, f.y - 48);
  ctx.lineTo(f.x + 14, f.y - 46);
  ctx.quadraticCurveTo(f.x, f.y - 80, f.x - 14, f.y - 34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#2d1a10";
  ctx.beginPath();
  ctx.roundRect(f.x - 12, f.y - 40, 24, 16, 3);
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = `hsl(${(hue + i * 50) % 360},90%,65%)`;
    ctx.fillRect(
      f.x - 10 + i * 4.4,
      f.y - 30 - Math.abs(Math.sin(t * 6 + i)) * 7,
      3,
      3 + Math.abs(Math.sin(t * 6 + i)) * 7,
    );
  }
  ctx.fillStyle = "#e7d2a8";
  ctx.beginPath();
  ctx.roundRect(f.x - 10, f.y - 20, 20, 8, 2);
  ctx.fill();
}

export function drawAquarium(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 34, 15, 0.3);
  // Stand.
  isoBox(ctx, x - 0.44, y - 0.3, x + 0.44, y + 0.3, 0, 24, {
    top: "#3a2a22",
    left: "#5a3d2c",
    right: "#46301f",
  });
  // Water tank (translucent faces).
  const tankCol = {
    top: "rgba(170,230,255,.55)",
    left: lin(ctx, 0, c.y - 80, 0, c.y - 24, [
      [0, "rgba(120,210,245,.75)"],
      [1, "rgba(30,110,170,.9)"],
    ]),
    right: "rgba(30,100,160,.85)",
  };
  isoBox(ctx, x - 0.44, y - 0.3, x + 0.44, y + 0.3, 24, 48, tankCol);
  // Fish swimming along the front.
  const a = iso(x - 0.4, y + 0.3),
    b = iso(x + 0.4, y + 0.3);
  const fishes = [
    ["#ff8a3d", 0.0, 0.0],
    ["#ffd65b", 0.45, 12],
    ["#ff5a7a", 0.8, 22],
  ] as const;
  for (const [col, ph, dz] of fishes) {
    const u = (Math.sin(t * 0.7 + ph * 6) + 1) / 2;
    const dirR = Math.cos(t * 0.7 + ph * 6) > 0;
    const px = a.x + (b.x - a.x) * u,
      py = a.y + (b.y - a.y) * u - 36 - dz * 0.6;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(px, py, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    const tx = dirR ? px - 5 : px + 5;
    ctx.moveTo(tx, py);
    ctx.lineTo(tx + (dirR ? -4 : 4), py - 3);
    ctx.lineTo(tx + (dirR ? -4 : 4), py + 3);
    ctx.fill();
  }
  // Weed and bubbles.
  ctx.strokeStyle = "#3fae6a";
  ctx.lineWidth = 2;
  for (const k of [0.2, 0.75]) {
    const p = iso(x - 0.44 + k * 0.88, y + 0.3);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 26);
    ctx.quadraticCurveTo(
      p.x + Math.sin(t * 2 + k * 9) * 4,
      p.y - 40,
      p.x,
      p.y - 54,
    );
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,.7)";
  for (let i = 0; i < 4; i++) {
    const ph = (t * 0.6 + i * 0.25) % 1;
    const p = iso(x + 0.25, y + 0.3);
    ctx.beginPath();
    ctx.arc(p.x + Math.sin(ph * 12) * 1.5, p.y - 28 - ph * 42, 1.4 + ph, 0, 7);
    ctx.fill();
  }
  // Glass highlight and lid.
  ctx.fillStyle = "rgba(255,255,255,.22)";
  poly(ctx, [
    { x: a.x + 6, y: a.y - 70 },
    { x: a.x + 14, y: a.y - 74 },
    { x: a.x + 14, y: a.y - 30 },
    { x: a.x + 6, y: a.y - 26 },
  ]);
  ctx.fill();
  isoBox(ctx, x - 0.46, y - 0.32, x + 0.46, y + 0.32, 72, 3, {
    top: "#2a2f36",
    left: "#1f2328",
    right: "#171a1e",
  });
}

export function drawFountain(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 36, 16, 0.28);
  // Stone basin.
  ctx.fillStyle = lin(ctx, c.x - 34, 0, c.x + 34, 0, [
    [0, "#9aa4b5"],
    [0.5, "#dfe5ee"],
    [1, "#8b95a6"],
  ]);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - 4, 34, 15, 0, 0, Math.PI);
  ctx.lineTo(c.x - 34, c.y - 18);
  ctx.ellipse(c.x, c.y - 18, 34, 15, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#c9d1dc";
  ellipse(ctx, c.x, c.y - 18, 34, 15);
  ctx.fill();
  ctx.fillStyle = lin(ctx, 0, c.y - 30, 0, c.y - 6, [
    [0, "#7fd9ff"],
    [1, "#2f8fd1"],
  ]);
  ellipse(ctx, c.x, c.y - 18, 29, 12);
  ctx.fill();
  // Ripples.
  ctx.strokeStyle = "rgba(255,255,255,.5)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 2; i++) {
    const ph = (t * 0.6 + i * 0.5) % 1;
    ctx.globalAlpha = 1 - ph;
    ellipse(ctx, c.x, c.y - 18, 6 + ph * 22, 2.5 + ph * 9);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // The crystal on a plinth, slowly turning colour.
  ctx.fillStyle = "#b9c2cf";
  ctx.fillRect(c.x - 4, c.y - 44, 8, 26);
  const hue = (t * 40) % 360;
  ctx.fillStyle = lin(ctx, c.x - 10, c.y - 80, c.x + 10, c.y - 46, [
    [0, `hsl(${hue},95%,85%)`],
    [1, `hsl(${(hue + 60) % 360},85%,55%)`],
  ]);
  const by = c.y - 50 + Math.sin(t * 2) * 2;
  ctx.beginPath();
  ctx.moveTo(c.x, by - 30);
  ctx.lineTo(c.x + 9, by - 14);
  ctx.lineTo(c.x, by);
  ctx.lineTo(c.x - 9, by - 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.beginPath();
  ctx.moveTo(c.x, by - 30);
  ctx.lineTo(c.x - 9, by - 14);
  ctx.lineTo(c.x - 2, by - 14);
  ctx.closePath();
  ctx.fill();
  // Water arcs.
  ctx.strokeStyle = "rgba(190,240,255,.8)";
  ctx.lineWidth = 2;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(c.x + s * 4, c.y - 42);
    ctx.quadraticCurveTo(
      c.x + s * 18,
      c.y - 56 + Math.sin(t * 8) * 1.5,
      c.x + s * 24,
      c.y - 20,
    );
    ctx.stroke();
  }
}

export function drawItem(
  ctx: Ctx,
  kind: ItemKind,
  x: number,
  y: number,
  t: number,
  rot = 0,
) {
  switch (kind) {
    case "table":
      return drawTable(ctx, x, y);
    case "chair":
      return drawChair(ctx, x, y, rot, "all");
    case "plant":
      return drawPlant(ctx, x, y, t);
    case "lamp":
      return drawLamp(ctx, x, y, t);
    case "bonsai":
      return drawBonsai(ctx, x, y, t);
    case "luckycat":
      return drawLuckyCat(ctx, x, y, t);
    case "jukebox":
      return drawJukebox(ctx, x, y, t);
    case "aquarium":
      return drawAquarium(ctx, x, y, t);
    case "fountain":
      return drawFountain(ctx, x, y, t);
    case "rug":
      return drawRug(ctx, x, y);
  }
}
/** Light sources an item gives off at night: [dx, dy from the tile centre, radius, rgb]. */
export function itemGlow(
  kind: ItemKind,
): [number, number, number, string] | null {
  switch (kind) {
    case "lamp":
      return [14, -66, 130, "255,150,90"];
    case "jukebox":
      return [0, -50, 90, "255,120,220"];
    case "aquarium":
      return [0, -48, 100, "90,200,255"];
    case "fountain":
      return [0, -60, 110, "170,240,255"];
    case "table":
      return [0, -40, 60, "255,210,150"];
    default:
      return null;
  }
}

/* ───────────── dishes ───────────── */

function bowl(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  col: string,
  rim = "#ffffff",
) {
  ctx.fillStyle = lin(ctx, x - r, 0, x + r, 0, [
    [0, shade(col, -0.25)],
    [0.4, col],
    [1, shade(col, -0.35)],
  ]);
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.quadraticCurveTo(x - r * 0.9, y + r * 0.85, x, y + r * 0.9);
  ctx.quadraticCurveTo(x + r * 0.9, y + r * 0.85, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rim;
  ellipse(ctx, x, y, r, r * 0.36);
  ctx.fill();
}
function plateDisc(ctx: Ctx, x: number, y: number, r: number) {
  ctx.fillStyle = "rgba(0,0,0,.18)";
  ellipse(ctx, x, y + r * 0.12, r, r * 0.42);
  ctx.fill();
  ctx.fillStyle = rad(ctx, x - r * 0.2, y - r * 0.1, r, [
    [0, "#ffffff"],
    [0.8, "#f1ece4"],
    [1, "#d8cfc2"],
  ]);
  ellipse(ctx, x, y, r, r * 0.4);
  ctx.fill();
  ctx.strokeStyle = "rgba(60,120,180,.45)";
  ctx.lineWidth = Math.max(0.6, r * 0.05);
  ellipse(ctx, x, y, r * 0.84, r * 0.33);
  ctx.stroke();
}
/** A dish at (x, y) (its plate's centre), `s` its radius in world units. */
export function drawDish(
  ctx: Ctx,
  id: DishId,
  x: number,
  y: number,
  s: number,
  t = 0,
  steam = true,
) {
  const k = s / 20;
  switch (id) {
    case "goicuon": {
      plateDisc(ctx, x, y, s);
      for (let i = 0; i < 3; i++) {
        const px = x - 9 * k + i * 9 * k,
          py = y - 2 * k + (i % 2) * 2 * k;
        ctx.fillStyle = "rgba(245,240,230,.95)";
        ctx.beginPath();
        ctx.ellipse(px, py, 4.2 * k, 9 * k, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f08a7a";
        ctx.beginPath();
        ctx.ellipse(
          px + 1 * k,
          py - 2 * k,
          2.2 * k,
          3.6 * k,
          0.5,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.fillStyle = "#6cc35a";
        ctx.beginPath();
        ctx.ellipse(
          px - 1.2 * k,
          py + 2.4 * k,
          2 * k,
          3.2 * k,
          0.5,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.55)";
        ctx.beginPath();
        ctx.ellipse(
          px - 1.5 * k,
          py - 3 * k,
          1 * k,
          4 * k,
          0.5,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      // Dipping sauce.
      ctx.fillStyle = "#fff";
      ellipse(ctx, x + 12 * k, y + 3 * k, 4.5 * k, 2.2 * k);
      ctx.fill();
      ctx.fillStyle = "#c46a2a";
      ellipse(ctx, x + 12 * k, y + 3 * k, 3.4 * k, 1.5 * k);
      ctx.fill();
      break;
    }
    case "banhmi": {
      plateDisc(ctx, x, y, s);
      ctx.save();
      ctx.translate(x, y - 2 * k);
      ctx.rotate(-0.25);
      ctx.fillStyle = lin(ctx, 0, -6 * k, 0, 6 * k, [
        [0, "#f6c06a"],
        [0.5, "#d98c33"],
        [1, "#a8601e"],
      ]);
      ctx.beginPath();
      ctx.ellipse(0, 0, 15 * k, 5.5 * k, 0, 0, Math.PI * 2);
      ctx.fill();
      // Filling peeking out of the slit.
      ctx.fillStyle = "#6cc35a";
      ctx.beginPath();
      ctx.ellipse(0, -2.5 * k, 12 * k, 1.6 * k, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ef8a5a";
      ctx.beginPath();
      ctx.ellipse(-3 * k, -3 * k, 7 * k, 1.1 * k, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,230,170,.8)";
      ctx.lineWidth = 1 * k;
      for (const dx of [-7, -1, 5]) {
        ctx.beginPath();
        ctx.moveTo(dx * k, 2 * k);
        ctx.lineTo((dx + 3) * k, -0.5 * k);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case "pho": {
      bowl(ctx, x, y - 4 * k, 15 * k, "#f2f2ee");
      ctx.fillStyle = "#e9a95a";
      ellipse(ctx, x, y - 4 * k, 13 * k, 4.4 * k);
      ctx.fill();
      ctx.strokeStyle = "#fff7e6";
      ctx.lineWidth = 1.2 * k;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(x - 9 * k, y - 4 * k + i * 0.8 * k);
        ctx.quadraticCurveTo(
          x,
          y - 6 * k + i * k,
          x + 9 * k,
          y - 4 * k + i * 0.8 * k,
        );
        ctx.stroke();
      }
      ctx.fillStyle = "#9b4a3a";
      ctx.beginPath();
      ctx.ellipse(x - 4 * k, y - 5 * k, 4 * k, 1.6 * k, 0.2, 0, Math.PI * 2);
      ctx.ellipse(x + 3 * k, y - 3.5 * k, 4 * k, 1.5 * k, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5fbf4f";
      for (const [dx, dy] of [
        [6, -6],
        [-8, -3],
        [1, -7],
      ])
        (ellipse(ctx, x + dx * k, y + dy * k, 2 * k, 1 * k), ctx.fill());
      // Lime wedge on the rim.
      ctx.fillStyle = "#9bd84a";
      ctx.beginPath();
      ctx.arc(x + 13 * k, y - 6 * k, 3 * k, Math.PI, 0);
      ctx.fill();
      // Chopsticks.
      ctx.strokeStyle = "#a8683f";
      ctx.lineWidth = 1.4 * k;
      ctx.beginPath();
      ctx.moveTo(x - 4 * k, y - 4 * k);
      ctx.lineTo(x + 14 * k, y - 16 * k);
      ctx.moveTo(x - 1 * k, y - 4 * k);
      ctx.lineTo(x + 17 * k, y - 14 * k);
      ctx.stroke();
      break;
    }
    case "buncha": {
      plateDisc(ctx, x - 5 * k, y + 1 * k, s * 0.7);
      ctx.strokeStyle = "#fbf7ef";
      ctx.lineWidth = 1.4 * k;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(
          x - 6 * k + (i % 3) * 2 * k,
          y - 1 * k,
          3 * k + (i % 2) * k,
          0,
          Math.PI * 1.6,
        );
        ctx.stroke();
      }
      bowl(ctx, x + 7 * k, y - 3 * k, 9 * k, "#3e7cc0");
      ctx.fillStyle = "#d98c5a";
      ellipse(ctx, x + 7 * k, y - 3 * k, 7.5 * k, 2.6 * k);
      ctx.fill();
      ctx.fillStyle = "#7a3a1e";
      for (const dx of [-3, 1, 4]) {
        ctx.beginPath();
        ctx.arc(x + (7 + dx) * k, y - 3.4 * k, 2 * k, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "comtam": {
      plateDisc(ctx, x, y, s);
      ctx.fillStyle = "#fffdf6";
      ctx.beginPath();
      ctx.ellipse(x - 5 * k, y - 2 * k, 8 * k, 4.6 * k, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(220,215,200,.8)";
      for (let i = 0; i < 6; i++)
        ctx.fillRect(
          x + (-10 + i * 2.5) * k,
          y + (-3 + (i % 2)) * k,
          1 * k,
          1 * k,
        );
      // Grilled chop.
      ctx.fillStyle = lin(ctx, 0, y - 6 * k, 0, y + 3 * k, [
        [0, "#c76a2c"],
        [1, "#7d3a14"],
      ]);
      ctx.beginPath();
      ctx.ellipse(x + 7 * k, y, 8 * k, 3.6 * k, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(60,20,5,.6)";
      ctx.lineWidth = 0.8 * k;
      for (const dx of [-3, 0, 3]) {
        ctx.beginPath();
        ctx.moveTo(x + (7 + dx) * k, y - 2.5 * k);
        ctx.lineTo(x + (9 + dx) * k, y + 2 * k);
        ctx.stroke();
      }
      // Fried egg.
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(x - 1 * k, y + 5 * k, 5 * k, 2.4 * k, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffbf2f";
      ctx.beginPath();
      ctx.arc(x - 1 * k, y + 4.6 * k, 1.8 * k, 0, Math.PI * 2);
      ctx.fill();
      // Cucumber and tomato.
      ctx.fillStyle = "#7ccf6a";
      ellipse(ctx, x - 12 * k, y + 3 * k, 2.4 * k, 1.2 * k);
      ctx.fill();
      ctx.fillStyle = "#e84a3c";
      ellipse(ctx, x - 9 * k, y + 5 * k, 2.2 * k, 1.1 * k);
      ctx.fill();
      break;
    }
    case "che": {
      // A tall glass with three layers.
      ctx.fillStyle = "rgba(0,0,0,.18)";
      ellipse(ctx, x, y + 2 * k, 9 * k, 3 * k);
      ctx.fill();
      const top = y - 22 * k;
      const layer = (y0: number, y1: number, col: string) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(x - 7 * k - (y0 - top) * 0.04, y0);
        ctx.lineTo(x + 7 * k + (y0 - top) * 0.04, y0);
        ctx.lineTo(x + 6 * k, y1);
        ctx.lineTo(x - 6 * k, y1);
        ctx.closePath();
        ctx.fill();
      };
      layer(top + 4 * k, top + 9 * k, "#fff4dc");
      layer(top + 9 * k, top + 14 * k, "#7bd06a");
      layer(top + 14 * k, top + 19 * k, "#f3c64b");
      layer(top + 19 * k, y, "#9a4a6a");
      ctx.fillStyle = "rgba(255,255,255,.35)";
      ctx.fillRect(x - 5 * k, top + 4 * k, 2 * k, 16 * k);
      ctx.strokeStyle = "rgba(255,255,255,.7)";
      ctx.lineWidth = 0.8 * k;
      ctx.strokeRect(x - 7.5 * k, top, 15 * k, 22 * k);
      // Crushed ice and a spoon.
      ctx.fillStyle = "rgba(230,248,255,.95)";
      for (const dx of [-4, 0, 4])
        (ellipse(ctx, x + dx * k, top + 2 * k, 2.6 * k, 1.8 * k), ctx.fill());
      ctx.strokeStyle = "#c9ced3";
      ctx.lineWidth = 1.3 * k;
      ctx.beginPath();
      ctx.moveTo(x + 2 * k, top);
      ctx.lineTo(x + 6 * k, top - 9 * k);
      ctx.stroke();
      steam = false;
      break;
    }
    case "caphe": {
      ctx.fillStyle = "rgba(0,0,0,.18)";
      ellipse(ctx, x, y + 2 * k, 8 * k, 2.6 * k);
      ctx.fill();
      const top = y - 20 * k;
      ctx.fillStyle = lin(ctx, 0, top, 0, y, [
        [0, "#c48a55"],
        [0.35, "#7a4424"],
        [0.75, "#4a2412"],
        [1, "#f0e2c8"],
      ]);
      ctx.beginPath();
      ctx.moveTo(x - 7 * k, top);
      ctx.lineTo(x + 7 * k, top);
      ctx.lineTo(x + 5.5 * k, y);
      ctx.lineTo(x - 5.5 * k, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(235,248,255,.85)";
      for (const [dx, dy] of [
        [-3, 3],
        [2, 5],
        [-1, 8],
      ])
        ctx.fillRect(x + dx * k, top + dy * k, 3 * k, 3 * k);
      ctx.fillStyle = "rgba(255,255,255,.3)";
      ctx.fillRect(x - 5 * k, top + 1 * k, 1.6 * k, 17 * k);
      // Phin filter on top.
      ctx.fillStyle = "#b8c0c8";
      ellipse(ctx, x, top - 1 * k, 8 * k, 2.4 * k);
      ctx.fill();
      ctx.fillStyle = "#8f98a1";
      ctx.fillRect(x - 4.5 * k, top - 8 * k, 9 * k, 7 * k);
      ctx.fillStyle = "#cfd6dc";
      ellipse(ctx, x, top - 8 * k, 4.5 * k, 1.4 * k);
      ctx.fill();
      steam = false;
      break;
    }
    case "lau": {
      // A clay hotpot with a coloured broth (the element mix).
      ctx.fillStyle = "rgba(0,0,0,.2)";
      ellipse(ctx, x, y + 3 * k, 18 * k, 5.6 * k);
      ctx.fill();
      bowl(ctx, x, y - 4 * k, 17 * k, "#5b3a4a", "#7a4c5e");
      const hue = (t * 30) % 360;
      ctx.fillStyle = lin(ctx, x - 14 * k, 0, x + 14 * k, 0, [
        [0, "#e8452c"],
        [0.5, `hsl(${(hue + 30) % 360},80%,55%)`],
        [1, "#f2a23a"],
      ]);
      ellipse(ctx, x, y - 4 * k, 14.5 * k, 4.8 * k);
      ctx.fill();
      // Ingredients bobbing.
      const items: [number, number, string][] = [
        [-7, -5, "#ffffff"],
        [-2, -3, "#5fbf4f"],
        [4, -5, "#f7d35a"],
        [8, -3, "#ff8a8a"],
        [1, -6, "#a2582f"],
      ];
      for (const [dx, dy, col] of items) {
        ctx.fillStyle = col;
        ellipse(
          ctx,
          x + dx * k,
          y + dy * k + Math.sin(t * 4 + dx) * 0.6 * k,
          2.4 * k,
          1.4 * k,
        );
        ctx.fill();
      }
      // Bubbles.
      ctx.fillStyle = "rgba(255,255,255,.7)";
      for (let i = 0; i < 3; i++) {
        const ph = (t * 1.5 + i * 0.33) % 1;
        ctx.beginPath();
        ctx.arc(x + (-6 + i * 6) * k, y - 4 * k, ph * 1.8 * k, 0, 7);
        ctx.fill();
      }
      break;
    }
  }
  if (steam && s >= 10) {
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.7 + i / 3) % 1;
      ctx.strokeStyle = `rgba(255,255,255,${0.45 * (1 - ph)})`;
      ctx.lineWidth = 1.6 * k;
      ctx.beginPath();
      const sx = x + (i - 1) * 6 * k,
        sy = y - 10 * k - ph * 18 * k;
      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(
        sx - 3 * k,
        sy - 4 * k,
        sx + 3 * k,
        sy - 8 * k,
        sx,
        sy - 12 * k,
      );
      ctx.stroke();
    }
  }
}
/** A dirty plate with a stack of coins (left after a meal). */
export function drawLeftovers(
  ctx: Ctx,
  x: number,
  y: number,
  coins: number,
  t: number,
  glow: number,
) {
  plateDisc(ctx, x, y, 11);
  ctx.fillStyle = "rgba(180,120,60,.5)";
  ellipse(ctx, x + 2, y, 3, 1.3);
  ctx.fill();
  ellipse(ctx, x - 4, y + 1, 2, 1);
  ctx.fill();
  const n = Math.min(5, 1 + Math.floor(coins / 12));
  for (let i = 0; i < n; i++) {
    const cy = y - 4 - i * 2.6;
    ctx.fillStyle = "#b98314";
    ellipse(ctx, x + 6, cy + 1.2, 6, 2.6);
    ctx.fill();
    ctx.fillStyle = lin(ctx, x, 0, x + 12, 0, [
      [0, "#ffe27a"],
      [1, "#e0a520"],
    ]);
    ellipse(ctx, x + 6, cy, 6, 2.6);
    ctx.fill();
  }
  if (glow > 0) {
    ctx.fillStyle = `rgba(255,240,170,${glow * (0.6 + 0.4 * Math.sin(t * 8))})`;
    drawSparkle(ctx, x + 12, y - 12 - n * 2.6, 5);
  }
}

/** A dish drawn into a small canvas for the HUD (as a data URL). */
const dishUrls = new Map<string, string>();
export function dishIconUrl(id: DishId, px = 64): string {
  const key = `${id}:${px}`;
  const hit = dishUrls.get(key);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = cv.height = px;
  const ctx = cv.getContext("2d");
  if (!ctx) return "";
  const k = px / 64;
  ctx.scale(k, k);
  drawDish(ctx, id, 32, 40, 24, 0.4, false);
  const url = cv.toDataURL();
  dishUrls.set(key, url);
  return url;
}
const itemUrls = new Map<string, string>();
export function itemIconUrl(kind: ItemKind, px = 72): string {
  const key = `${kind}:${px}`;
  const hit = itemUrls.get(key);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = cv.height = px;
  const ctx = cv.getContext("2d");
  if (!ctx) return "";
  const k = px / 120;
  ctx.scale(k, k);
  // Centre the tile at (60, 92) in a 120 box.
  const c = iso(0, 0);
  ctx.translate(60 - c.x, 92 - c.y);
  if (kind === "rug") {
    ctx.translate(-0, -24);
    ctx.scale(0.62, 0.62);
    ctx.translate(30, 40);
  }
  drawItem(ctx, kind, 0, 0, 0.3, 1);
  const url = cv.toDataURL();
  itemUrls.set(key, url);
  return url;
}
