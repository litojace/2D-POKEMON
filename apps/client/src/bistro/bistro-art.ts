/*
 * Element Bistro (demo): the drawing. Everything is painted in code on a 2D
 * canvas, in world units on an isometric grid: a tile is 96 × 48, tile
 * (x, y) has its centre at iso(x, y), and walls stand on the grid's back
 * edges. Nothing here knows the rules; the scene passes what to draw.
 */
import { COLD_DISHES, drawDishBody, drawDishLive } from "./bistro-dishes";
import {
  drawPlant,
  drawBonsai,
  drawVase,
  drawTipJar,
  drawEspresso,
  drawCart,
  drawArcade,
  drawFreezer,
  drawMassage,
  drawPodium,
  drawRobot,
  drawScreen,
  drawBookshelf,
  drawKoi,
  drawChandelier,
  drawHayBale,
  drawTrophy,
  lampBody,
  lampLive,
  luckyCatBody,
  luckyCatLive,
  jukeboxBody,
  jukeboxLive,
  aquariumBody,
  aquariumLive,
  fountainBody,
  fountainLive,
  neonBody,
  neonLive,
  statueBody,
  statueLive,
  cornerBody,
  cornerLive,
  pumpkinBody,
  pumpkinLive,
  lanternStandBody,
  lanternStandLive,
  blossomBody,
  blossomLive,
  drawPiano,
} from "./bistro-furniture";
import {
  TH,
  TW,
  ellipse,
  iso,
  isoBox,
  lin,
  poly,
  rad,
  shade,
  softShadow,
} from "./bistro-geom";
export { TH, TW, iso, isoBox, shade, softShadow } from "./bistro-geom";
import {
  COLS,
  ROWS,
  type RoomSize,
  COUNTER_X0,
  kitchenX1Of,
  COUNTER_ROW,
  DOOR,
  ITEM_BY_KIND,
  type DishId,
  type FloorId,
  type ItemKind,
  type StoveModel,
  type WallId,
} from "./bistro-model";

type Ctx = CanvasRenderingContext2D;
export const WALL_H = 168;
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
    for (let g = kitchenX1Of(R) + 1.3; g + 1.6 <= R.cols - 0.6; g += 2.4)
      out.push([g, g + 1.6]);
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
  for (let x = COUNTER_X0; x <= kitchenX1Of(R); x++)
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
  for (let gx = -0.5; gx < kitchenX1Of(R) + 0.5; gx += 0.25)
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
  // Range hood: a trapezoid of brushed steel over the stove spots (it
  // grows with the kitchen).
  {
    const end = kitchenX1Of(R) - 0.6;
    const a = rightWallPt(0.6, WAIN + 92),
      b = rightWallPt(end, WAIN + 92),
      c = rightWallPt(end - 0.3, WAIN + 128),
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
        // Each puff its own sub-path (joined, the lines between them made
        // a hole where they wound the other way).
        ctx.ellipse(x, y, 16, 6, 0, 0, Math.PI * 2);
        ctx.moveTo(x + 20, y - 4);
        ctx.ellipse(x + 10, y - 4, 10, 6, 0, 0, Math.PI * 2);
        ctx.moveTo(x - 1, y - 2);
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
  /** Today's special: drawn on the board, which glows to say so. */
  dish?: DishId,
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

  // Menu board: a chalkboard in a gilded frame that glows with today's
  // special (the dish that pays ×1.5).
  const b = quadOnWall("left", BOARD[0], BOARD[1], 74, 140);
  const outer = quadOnWall("left", BOARD[0] - 0.08, BOARD[1] + 0.08, 68, 146);
  const pulse = 0.5 + 0.5 * Math.sin(l.t * 3);
  ctx.save();
  ctx.shadowColor = `rgba(255,200,80,${0.55 + 0.35 * pulse})`;
  ctx.shadowBlur = 10 + 8 * pulse;
  ctx.fillStyle = "#c98f2e";
  poly(ctx, outer);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = lin(ctx, outer[0].x, 0, outer[1].x, 0, [
    [0, "#f6d36a"],
    [0.5, "#c98f2e"],
    [1, "#f6d36a"],
  ]);
  poly(ctx, outer);
  ctx.fill();
  ctx.fillStyle = "#6d4025";
  poly(ctx, quadOnWall("left", BOARD[0] - 0.03, BOARD[1] + 0.03, 71, 143));
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
  ctx.fillStyle = "rgba(255,255,255,.7)";
  ctx.font = "700 9px 'DM Sans', sans-serif";
  ctx.fillText("× 1.5 coins", len / 2, 50);
  ctx.restore();
  if (!dish) return;
  // The dish itself on a little shelf under the board, and a gold badge.
  const shelf = leftWallPt((BOARD[0] + BOARD[1]) / 2, 70);
  ctx.fillStyle = "#8a5530";
  ctx.beginPath();
  ctx.ellipse(shelf.x, shelf.y + 2, 18, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  drawDish(ctx, dish, shelf.x, shelf.y - 2, 13, l.t, false);
  const top = b[3];
  const bx = top.x + 2,
    by = top.y - 10;
  const s = 1 + 0.08 * pulse;
  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(s, s);
  ctx.rotate(l.t * 0.6);
  ctx.fillStyle = "#ffd65b";
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? 13 : 19;
    const a = (i / 16) * Math.PI * 2;
    ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#5a2a00";
  ctx.font = "900 12px 'Barlow Condensed', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("×1.5", bx, by + 0.5);
  ctx.textBaseline = "alphabetic";
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
/** Each stove model's look (STOVES in the shared rules). */
const STOVE_LOOK: Record<
  StoveModel | "locked",
  { top: string; left: string; right: string; door: string; trim?: string }
> = {
  locked: {
    top: "#2d2f36",
    left: "#1c1d22",
    right: "#16171b",
    door: "#3b3e47",
  },
  clay: { top: "#9a5638", left: "#7a4029", right: "#663421", door: "#b5694a" },
  steel: { top: "#a9b2ba", left: "#87919a", right: "#737d86", door: "#c9d0d6" },
  dragon: {
    top: "#5a1c1c",
    left: "#431313",
    right: "#370f0f",
    door: "#7a2420",
    trim: "#e8b84a",
  },
};
export function drawFixture(
  ctx: Ctx,
  kind: Fixture,
  x: number,
  y: number,
  t: number,
  fire: number,
  model: StoveModel = "clay",
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
  // Stove: the model's body, a burner, an oven door.
  const look = STOVE_LOOK[kind === "stove-locked" ? "locked" : model];
  isoBox(ctx, x - 0.5, y - 0.44, x + 0.5, y + 0.44, 40, 4, {
    top: look.top,
    left: look.left,
    right: look.right,
  });
  if (look.trim) {
    // A gold rim round the top.
    ctx.strokeStyle = look.trim;
    ctx.lineWidth = 2;
    poly(
      ctx,
      [
        iso(x - 0.5, y - 0.44),
        iso(x + 0.5, y - 0.44),
        iso(x + 0.5, y + 0.44),
        iso(x - 0.5, y + 0.44),
      ].map((p) => ({ x: p.x, y: p.y - 44 })),
    );
    ctx.stroke();
  }
  const d = iso(x, y + 0.42);
  ctx.fillStyle = look.door;
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

/** A woven look over a rug: fine threads both ways and a soft pile sheen. */
function weave(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  dark: string,
) {
  const pts = [iso(x0, y0), iso(x1, y0), iso(x1, y1), iso(x0, y1)];
  ctx.save();
  poly(ctx, pts);
  ctx.clip();
  const c = iso((x0 + x1) / 2, (y0 + y1) / 2);
  ctx.fillStyle = rad(ctx, c.x - 20, c.y - 12, 90, [
    [0, "rgba(255,255,255,.14)"],
    [1, "rgba(0,0,0,.12)"],
  ]);
  poly(ctx, pts);
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let f = 0; f <= 1.0001; f += 1 / 26) {
    const a = iso(x0 + (x1 - x0) * f, y0),
      b = iso(x0 + (x1 - x0) * f, y1);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    const d = iso(x0, y0 + (y1 - y0) * f),
      e = iso(x1, y0 + (y1 - y0) * f);
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(e.x, e.y);
  }
  ctx.stroke();
  ctx.restore();
}
/** Tassels along a rug's edge from grid point a to b. */
function fringe(
  ctx: Ctx,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  n: number,
  col: string,
  /** Which way the tassels hang (out from the edge). */
  out: [number, number] = [-2, 4],
) {
  ctx.strokeStyle = col;
  ctx.lineWidth = 1;
  ctx.lineCap = "round";
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const p = iso(ax + (bx - ax) * f, ay + (by - ay) * f);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + out[0], p.y + out[1]);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}
/** Two bands across a 2 × 2 rug, near the ends that have tassels. */
function endBands(
  ctx: Ctx,
  x: number,
  y: number,
  m: number,
  [a, b]: [string, string],
) {
  for (const [x0, x1, col] of [
    [x - m + 0.1, x - m + 0.2, a],
    [x - m + 0.24, x - m + 0.28, b],
    [x + 1 + m - 0.2, x + 1 + m - 0.1, a],
    [x + 1 + m - 0.28, x + 1 + m - 0.24, b],
  ] as const) {
    ctx.fillStyle = col;
    poly(ctx, [
      iso(x0, y - m + 0.06),
      iso(x1, y - m + 0.06),
      iso(x1, y + 1 + m - 0.06),
      iso(x0, y + 1 + m - 0.06),
    ]);
    ctx.fill();
  }
}
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
  // A row of little diamonds in the border.
  ctx.fillStyle = "#1f5d73";
  for (let i = 0; i < 8; i++) {
    for (const [gx, gy] of [
      [x - 0.28 + (i + 0.5) * 0.2, y - 0.28],
      [x - 0.28 + (i + 0.5) * 0.2, y + 1.28],
      [x - 0.28, y - 0.28 + (i + 0.5) * 0.2],
      [x + 1.28, y - 0.28 + (i + 0.5) * 0.2],
    ]) {
      const p = iso(gx, gy);
      poly(ctx, [
        { x: p.x, y: p.y - 2 },
        { x: p.x + 4, y: p.y },
        { x: p.x, y: p.y + 2 },
        { x: p.x - 4, y: p.y },
      ]);
      ctx.fill();
    }
  }
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
  ctx.fillStyle = "#f2c66d";
  poly(ctx, [
    { x: c.x, y: c.y - 4 },
    { x: c.x + 8, y: c.y },
    { x: c.x, y: c.y + 4 },
    { x: c.x - 8, y: c.y },
  ]);
  ctx.fill();
  weave(ctx, x - 0.35, y - 0.35, x + 1.35, y + 1.35, "#2a0a0e");
  // Woven bands and tassels on its two ends, as a kilim has them (so it
  // shows which way it lies).
  endBands(ctx, x, y, 0.35, ["#1f5d73", "#f2c66d"]);
  fringe(ctx, x - 0.35, y - 0.35, x - 0.35, y + 1.35, 14, "#f3e2c0", [-4, -2]);
  fringe(ctx, x + 1.35, y - 0.35, x + 1.35, y + 1.35, 14, "#f3e2c0", [4, 2]);
}

/** Table looks (each table kind of the shop): cloth, trim, top, pedestal. */
export type TableStyle = "round" | "garden" | "marble" | "gold";
const TABLE_LOOK: Record<
  TableStyle,
  {
    cloth: [string, string, string];
    trim: string;
    top: [string, string];
    post: [string, string];
  }
> = {
  round: {
    cloth: ["#e9e2d6", "#fffdf8", "#ddd4c5"],
    trim: "#d24c4c",
    top: ["#ffffff", "#efe7da"],
    post: ["#5c3520", "#8a5534"],
  },
  garden: {
    cloth: ["#cfe8c4", "#eef8e8", "#bcdcae"],
    trim: "#3f9a4f",
    top: ["#f6fff0", "#dcefd2"],
    post: ["#4f6b3a", "#7a9a58"],
  },
  marble: {
    cloth: ["#d9dde0", "#f6f7f8", "#c9cfd3"],
    trim: "#7c8790",
    top: ["#ffffff", "#e3e7ea"],
    post: ["#6b737a", "#a3abb2"],
  },
  gold: {
    cloth: ["#f2dc8c", "#fff6cc", "#e3c766"],
    trim: "#b8860b",
    top: ["#fffbe6", "#f3e2a0"],
    post: ["#9a7410", "#e0b83a"],
  },
};
export function drawTable(
  ctx: Ctx,
  x: number,
  y: number,
  style: TableStyle = "round",
) {
  const look = TABLE_LOOK[style];
  const c = iso(x, y);
  const ty = c.y - 32;
  softShadow(ctx, c.x, c.y + 2, 36, 15, 0.32);
  if (style === "garden" || style === "marble") {
    // No cloth: a pedestal on a foot, and the top's own material.
    if (style === "garden") {
      // Cast iron: three curled legs and a slim post.
      ctx.strokeStyle = "#2e3a2a";
      ctx.lineWidth = 2.6;
      ctx.lineCap = "round";
      for (const a of [0.4, 2.5, 4.6]) {
        const ex = c.x + Math.cos(a) * 16,
          ey = c.y + Math.sin(a) * 6;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y - 10);
        ctx.quadraticCurveTo(
          c.x + Math.cos(a) * 12,
          c.y + Math.sin(a) * 4 - 8,
          ex,
          ey,
        );
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ex + Math.cos(a) * 1.5, ey - 2, 2, 0, Math.PI * 1.5);
        ctx.stroke();
      }
      ctx.fillStyle = lin(ctx, c.x - 3, 0, c.x + 3, 0, [
        [0, "#3a4a34"],
        [0.5, "#6a7d5e"],
        [1, "#26301f"],
      ]);
      ctx.fillRect(c.x - 2.5, c.y - 30, 5, 22);
    } else {
      // A black steel pedestal on a round plate.
      ctx.fillStyle = "#1c1c20";
      ellipse(ctx, c.x, c.y, 15, 6);
      ctx.fill();
      ctx.fillStyle = "#34343a";
      ellipse(ctx, c.x, c.y - 1.5, 14, 5.4);
      ctx.fill();
      ctx.fillStyle = lin(ctx, c.x - 4, 0, c.x + 4, 0, [
        [0, "#18181c"],
        [0.45, "#55555e"],
        [1, "#141418"],
      ]);
      ctx.fillRect(c.x - 3.5, c.y - 30, 7, 29);
    }
    // The top's edge, then its face.
    ctx.fillStyle =
      style === "garden"
        ? "#7a4e2c"
        : lin(ctx, c.x - 32, 0, c.x + 32, 0, [
            [0, "#b9bec2"],
            [0.5, "#eef0f1"],
            [1, "#9aa1a6"],
          ]);
    ellipse(ctx, c.x, ty + 3.5, 32, 15);
    ctx.fill();
    if (style === "garden") {
      ctx.fillStyle = lin(ctx, c.x - 32, ty - 15, c.x + 32, ty + 15, [
        [0, "#c8905a"],
        [0.5, "#a8703e"],
        [1, "#8a5a30"],
      ]);
      ellipse(ctx, c.x, ty, 32, 15);
      ctx.fill();
      // Slats with gaps.
      ctx.save();
      ellipse(ctx, c.x, ty, 32, 15);
      ctx.clip();
      ctx.strokeStyle = "rgba(60,32,12,.55)";
      ctx.lineWidth = 1.2;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(c.x - 34 + i * 9, ty - 16);
        ctx.lineTo(c.x + 2 + i * 9, ty + 16);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(255,225,180,.25)";
      ctx.lineWidth = 0.6;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(c.x - 31 + i * 9, ty - 16);
        ctx.lineTo(c.x + 5 + i * 9, ty + 16);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      ctx.fillStyle = rad(ctx, c.x - 10, ty - 6, 42, [
        [0, "#ffffff"],
        [0.7, "#f1f2f3"],
        [1, "#dadde0"],
      ]);
      ellipse(ctx, c.x, ty, 32, 15);
      ctx.fill();
      // Marble veins.
      ctx.save();
      ellipse(ctx, c.x, ty, 32, 15);
      ctx.clip();
      ctx.strokeStyle = "rgba(120,128,138,.45)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(c.x - 30, ty - 4);
      ctx.bezierCurveTo(c.x - 14, ty - 10, c.x - 4, ty + 6, c.x + 12, ty - 2);
      ctx.bezierCurveTo(c.x + 20, ty - 6, c.x + 26, ty + 4, c.x + 34, ty + 2);
      ctx.moveTo(c.x - 8, ty + 3);
      ctx.quadraticCurveTo(c.x - 2, ty + 10, c.x + 8, ty + 14);
      ctx.stroke();
      ctx.strokeStyle = "rgba(160,150,120,.35)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(c.x - 22, ty + 8);
      ctx.bezierCurveTo(c.x - 10, ty + 2, c.x + 4, ty - 12, c.x + 20, ty - 10);
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,.9)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(c.x, ty, 31, 14, 0, Math.PI * 1.05, Math.PI * 1.5);
      ctx.stroke();
    }
  } else {
    // Pedestal under a cloth that falls in soft folds to a scalloped hem.
    ctx.fillStyle = "#4a2b19";
    ellipse(ctx, c.x, c.y, 14, 6);
    ctx.fill();
    ctx.fillStyle = lin(ctx, c.x - 4, 0, c.x + 4, 0, [
      [0, look.post[0]],
      [1, look.post[1]],
    ]);
    ctx.fillRect(c.x - 4, c.y - 30, 8, 30);
    const skirt = () => {
      ctx.beginPath();
      ctx.ellipse(c.x, ty, 34, 16, 0, 0, Math.PI);
      ctx.lineTo(c.x - 34, ty);
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI - (i / 10) * Math.PI;
        const px = c.x + Math.cos(a) * 35,
          py = ty + Math.sin(a) * 16 + 10 + (i % 2) * 2.5;
        ctx.lineTo(px, py);
      }
      ctx.closePath();
    };
    ctx.fillStyle = lin(ctx, c.x - 34, 0, c.x + 34, 0, [
      [0, look.cloth[0]],
      [0.45, look.cloth[1]],
      [1, look.cloth[2]],
    ]);
    skirt();
    ctx.fill();
    // Folds: soft shadow and light down the drape.
    ctx.save();
    skirt();
    ctx.clip();
    for (let i = 1; i < 10; i++) {
      const a = Math.PI - (i / 10) * Math.PI;
      const px = c.x + Math.cos(a) * 34;
      const g = ctx.createLinearGradient(px - 3, 0, px + 3, 0);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(
        0.5,
        i % 2 ? "rgba(60,40,30,.12)" : "rgba(255,255,255,.22)",
      );
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(px - 3, ty, 6, 32);
    }
    ctx.restore();
    ctx.strokeStyle = look.trim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(c.x, ty + 9, 34.5, 16, 0, 0.1, Math.PI - 0.1);
    ctx.stroke();
    ctx.fillStyle = rad(ctx, c.x - 8, ty - 4, 40, [
      [0, look.top[0]],
      [1, look.top[1]],
    ]);
    ellipse(ctx, c.x, ty, 32, 15);
    ctx.fill();
    if (style === "gold") {
      // Damask: a ring of little gold motifs.
      ctx.fillStyle = "rgba(184,134,11,.4)";
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ellipse(ctx, c.x + Math.cos(a) * 24, ty + Math.sin(a) * 11, 1.6, 0.9);
        ctx.fill();
      }
    }
    // The cloth's sheen.
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.beginPath();
    ctx.ellipse(c.x - 9, ty - 5, 14, 4, -0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  // A salt and pepper pair and a little menu card, to one side (so a
  // round table shows which way it was turned).
  for (const [dx, col] of [
    [11, "#ece6d8"],
    [16.5, "#3a3430"],
  ] as const) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect(c.x + dx - 2.2, ty - 9, 4.4, 8, 1.6);
    ctx.fill();
    ctx.strokeStyle = "rgba(60,50,40,.55)";
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.fillStyle = "#c9ccd0";
    ctx.fillRect(c.x + dx - 2.2, ty - 10.4, 4.4, 1.8);
  }
  ctx.fillStyle = "#8a2a1e";
  ctx.beginPath();
  ctx.moveTo(c.x + 19, ty + 1);
  ctx.lineTo(c.x + 22, ty - 9);
  ctx.lineTo(c.x + 28, ty - 6);
  ctx.lineTo(c.x + 26, ty + 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#f2c66d";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.fillStyle = "#f2c66d";
  ctx.fillRect(c.x + 22, ty - 5, 3, 1);
  ctx.fillRect(c.x + 21.6, ty - 3, 3, 0.8);
  // A bud vase with a flower.
  ctx.fillStyle = lin(ctx, c.x - 3, 0, c.x + 3, 0, [
    [0, "#3a7fb0"],
    [0.4, "#8cc6ec"],
    [1, "#2f6a96"],
  ]);
  ctx.beginPath();
  ctx.moveTo(c.x - 1.5, ty - 12);
  ctx.quadraticCurveTo(c.x - 4.5, ty - 6, c.x - 3, ty - 3);
  ctx.lineTo(c.x + 3, ty - 3);
  ctx.quadraticCurveTo(c.x + 4.5, ty - 6, c.x + 1.5, ty - 12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#3f8c3a";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(c.x, ty - 12);
  ctx.lineTo(c.x + 1, ty - 19);
  ctx.stroke();
  ctx.fillStyle = "#4f9f3f";
  ctx.beginPath();
  ctx.ellipse(c.x + 2.5, ty - 15, 2.2, 1, -0.5, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.fillStyle = i % 2 ? "#ff7aa8" : "#ff92b8";
    ellipse(
      ctx,
      c.x + 1 + Math.cos(a) * 2,
      ty - 20 + Math.sin(a) * 1.6,
      1.8,
      1.4,
    );
    ctx.fill();
  }
  ctx.fillStyle = "#ffd65b";
  ellipse(ctx, c.x + 1, ty - 20, 1, 0.9);
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
/** Which cushion colour a chair on (x, y) gets (drawn at (0, 0) with it as the tint). */
const cushionIndex = (x: number, y: number, tint: number) =>
  (((x * 7 + y * 3 + tint) % CUSHIONS.length) + CUSHIONS.length) %
  CUSHIONS.length;
/** Chair looks (each chair kind of the shop). */
export type ChairStyle = "cushion" | "stool" | "armchair" | "throne";
const CHAIR_LOOK: Record<
  ChairStyle,
  {
    back?: [string, string];
    backH: number;
    seat: { top: string; left: string; right: string };
    legs: string;
    cushion?: string;
    trim?: string;
  }
> = {
  cushion: {
    back: ["#a8683f", "#6e3f24"],
    backH: 52,
    seat: { top: "#8a5232", left: "#6a3c22", right: "#5a321c" },
    legs: "#5a321c",
  },
  stool: {
    // A low padded back (it shows which way the stool faces).
    back: ["#e05a4c", "#9e3229"],
    backH: 38,
    seat: { top: "#c8473b", left: "#9e3229", right: "#86281f" },
    legs: "#a9b2ba",
    cushion: "#e05a4c",
  },
  armchair: {
    back: ["#8a58b8", "#4e2a73"],
    backH: 56,
    seat: { top: "#6b3f96", left: "#53307a", right: "#45276a" },
    legs: "#3a2418",
    cushion: "#9c6ccb",
  },
  throne: {
    back: ["#f6d36b", "#b8860b"],
    backH: 68,
    seat: { top: "#c8a032", left: "#a8821e", right: "#916f16" },
    legs: "#8a6a10",
    cushion: "#b0262b",
    trim: "#fff1b0",
  },
};
function drawChairRaw(
  ctx: Ctx,
  x: number,
  y: number,
  dir: number,
  back: "behind" | "front" | "all",
  tint = 0,
  style: ChairStyle = "cushion",
) {
  const look = CHAIR_LOOK[style];
  const c = iso(x, y);
  // `dir` faces the table; the backrest sits on the opposite side.
  // (A stool's low back sits at its round seat's edge.)
  const off = style === "stool" ? 0.22 : 0.32;
  const bx = [-1, 0, 1, 0][dir] * off,
    by = [0, -1, 0, 1][dir] * off;
  const backIsFar = dir === 0 || dir === 1; // back toward the wall side
  const cu = look.cushion ?? CUSHIONS[(x * 7 + y * 3 + tint) % CUSHIONS.length];
  const drawBack = () => {
    if (!look.back) return;
    const H = look.backH;
    const half = style === "stool" ? 0.18 : 0.3;
    const along = dir % 2 === 0 ? { x: 0, y: half } : { x: half, y: 0 };
    const p0 = iso(x + bx - along.x, y + by - along.y),
      p1 = iso(x + bx + along.x, y + by + along.y);
    const at = (f: number, h: number) => ({
      x: p0.x + (p1.x - p0.x) * f,
      y: p0.y + (p1.y - p0.y) * f - h,
    });
    if (style === "cushion") {
      // A wooden back: two posts, a curved top rail and three slats.
      const wood = lin(ctx, 0, p0.y - H, 0, p0.y, [
        [0, look.back[0]],
        [1, look.back[1]],
      ]);
      ctx.strokeStyle = wood;
      ctx.lineCap = "round";
      ctx.lineWidth = 2;
      for (const f of [0.3, 0.5, 0.7]) {
        const q0 = at(f, 22),
          q1 = at(f, H - 7);
        ctx.beginPath();
        ctx.moveTo(q0.x, q0.y);
        ctx.lineTo(q1.x, q1.y);
        ctx.stroke();
      }
      ctx.lineWidth = 3.4;
      for (const f of [0.04, 0.96]) {
        const q0 = at(f, 18),
          q1 = at(f, H);
        ctx.beginPath();
        ctx.moveTo(q0.x, q0.y);
        ctx.lineTo(q1.x, q1.y);
        ctx.stroke();
      }
      ctx.fillStyle = wood;
      const r0 = at(0, H + 1),
        r1 = at(1, H + 1),
        m = at(0.5, H + 4);
      ctx.beginPath();
      ctx.moveTo(r0.x, r0.y + 7);
      ctx.quadraticCurveTo(m.x, m.y + 6, r1.x, r1.y + 7);
      ctx.lineTo(r1.x, r1.y);
      ctx.quadraticCurveTo(m.x, m.y - 2, r0.x, r0.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,225,190,.35)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(r0.x, r0.y + 1);
      ctx.quadraticCurveTo(m.x, m.y - 1, r1.x, r1.y + 1);
      ctx.stroke();
      return;
    }
    // Padded backs: a panel with a rounded or crested top.
    const crest = style === "throne" ? 12 : 6;
    const panel = (inset: number) => {
      const q0 = at(inset, 20),
        q1 = at(1 - inset, 20),
        t1 = at(1 - inset, H - inset * 30),
        t0 = at(inset, H - inset * 30),
        m = at(0.5, H + crest - inset * 30);
      ctx.beginPath();
      ctx.moveTo(q0.x, q0.y);
      ctx.lineTo(q1.x, q1.y);
      ctx.lineTo(t1.x, t1.y);
      ctx.quadraticCurveTo((t1.x + m.x) / 2, m.y, m.x, m.y);
      ctx.quadraticCurveTo((t0.x + m.x) / 2, m.y, t0.x, t0.y);
      ctx.closePath();
    };
    ctx.fillStyle = lin(ctx, 0, p0.y - H - crest, 0, p0.y, [
      [0, look.back[0]],
      [1, look.back[1]],
    ]);
    panel(0);
    ctx.fill();
    if (style === "throne") {
      // Carved gold frame round a velvet panel, a gem on the crest.
      ctx.fillStyle = lin(ctx, 0, p0.y - H, 0, p0.y, [
        [0, "#c8303a"],
        [1, "#7a141a"],
      ]);
      panel(0.14);
      ctx.fill();
      ctx.strokeStyle = look.trim ?? "#fff1b0";
      ctx.lineWidth = 1;
      panel(0.06);
      ctx.stroke();
      const g = at(0.5, H + crest - 3);
      ctx.fillStyle = "#4ad0ff";
      ellipse(ctx, g.x, g.y, 2.4, 2.4);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.8)";
      ellipse(ctx, g.x - 0.8, g.y - 0.8, 0.8, 0.8);
      ctx.fill();
    } else {
      // Velvet with piping and tufted buttons.
      ctx.strokeStyle = "rgba(255,255,255,.28)";
      ctx.lineWidth = 1;
      panel(0.05);
      ctx.stroke();
      ctx.fillStyle = "rgba(30,10,50,.55)";
      for (const [f, h] of [
        [0.3, H * 0.62],
        [0.7, H * 0.62],
        [0.5, H * 0.8],
        [0.3, H * 0.44],
        [0.7, H * 0.44],
      ] as const) {
        const q = at(f, h);
        ellipse(ctx, q.x, q.y, 1.2, 1.2);
        ctx.fill();
      }
    }
  };
  const legs = () => {
    if (style === "stool") {
      // Chrome legs and a foot ring.
      ctx.lineCap = "round";
      for (const [lx, ly] of [
        [-0.22, -0.22],
        [0.22, -0.22],
        [0.22, 0.22],
        [-0.22, 0.22],
      ]) {
        const p = iso(x + lx, y + ly);
        ctx.strokeStyle = lin(ctx, p.x - 1.5, 0, p.x + 1.5, 0, [
          [0, "#7d868e"],
          [0.5, "#eef1f3"],
          [1, "#6e777f"],
        ]);
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(c.x + (p.x - c.x) * 0.55, c.y - 24 + (p.y - c.y) * 0.55);
        ctx.stroke();
      }
      ctx.strokeStyle = "#c9d0d6";
      ctx.lineWidth = 1.6;
      ellipse(ctx, c.x, c.y - 9, 11, 5);
      ctx.stroke();
      return;
    }
    // Tapered wooden (or gilded) legs, lit on one side.
    for (const [lx, ly] of [
      [-0.27, -0.27],
      [0.27, -0.27],
      [0.27, 0.27],
      [-0.27, 0.27],
    ]) {
      const p = iso(x + lx, y + ly);
      ctx.fillStyle = look.legs;
      ctx.beginPath();
      ctx.moveTo(p.x - 1.9, p.y - 20);
      ctx.lineTo(p.x + 1.9, p.y - 20);
      ctx.lineTo(p.x + 1.1, p.y);
      ctx.lineTo(p.x - 1.1, p.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,235,200,.3)";
      ctx.fillRect(p.x - 1.6, p.y - 19, 1, 18);
    }
  };
  const seat = () => {
    const s0 = iso(x, y);
    if (style === "stool") {
      // A round seat: a chrome rim and a buttoned leather top.
      ctx.fillStyle = "#8d969e";
      ellipse(ctx, s0.x, s0.y - 23, 15, 7);
      ctx.fill();
      ctx.fillStyle = shade(cu, -0.35);
      ellipse(ctx, s0.x, s0.y - 25, 15, 7);
      ctx.fill();
      ctx.fillStyle = rad(ctx, s0.x - 4, s0.y - 29, 16, [
        [0, shade(cu, 0.3)],
        [0.7, cu],
        [1, shade(cu, -0.2)],
      ]);
      ellipse(ctx, s0.x, s0.y - 27, 14, 6.4);
      ctx.fill();
      ctx.fillStyle = shade(cu, -0.45);
      ellipse(ctx, s0.x, s0.y - 27, 1.2, 0.8);
      ctx.fill();
      return;
    }
    isoBox(ctx, x - 0.32, y - 0.32, x + 0.32, y + 0.32, 18, 4, look.seat);
    // A cushion that follows the seat: rounded, piped, with a button.
    const corner = (gx: number, gy: number) => {
      const p = iso(x + gx, y + gy);
      return { x: p.x, y: p.y - 24 };
    };
    const N = corner(-0.27, -0.27),
      E = corner(0.27, -0.27),
      S = corner(0.27, 0.27),
      W = corner(-0.27, 0.27);
    const cushion = () => {
      const mid = (
        a: { x: number; y: number },
        b: { x: number; y: number },
      ) => ({
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      });
      const pts = [N, E, S, W];
      ctx.beginPath();
      const m0 = mid(W, N);
      ctx.moveTo(m0.x, m0.y);
      for (let i = 0; i < 4; i++) {
        const cpt = pts[i],
          nxt = mid(pts[i], pts[(i + 1) % 4]);
        ctx.quadraticCurveTo(cpt.x, cpt.y, nxt.x, nxt.y);
      }
      ctx.closePath();
    };
    ctx.fillStyle = shade(cu, -0.35);
    ctx.save();
    ctx.translate(0, 2);
    cushion();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = rad(ctx, s0.x - 4, s0.y - 28, 20, [
      [0, shade(cu, 0.3)],
      [0.65, cu],
      [1, shade(cu, -0.15)],
    ]);
    cushion();
    ctx.fill();
    ctx.strokeStyle = shade(cu, 0.35);
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.fillStyle = shade(cu, -0.45);
    ellipse(ctx, s0.x, s0.y - 24, 1.3, 0.8);
    ctx.fill();
  };
  if (back === "all" || back === "behind") {
    softShadow(ctx, c.x, c.y + 2, 24, 11, 0.24);
    if (backIsFar) drawBack();
    legs();
    seat();
  }
  if ((back === "all" || back === "front") && !backIsFar) drawBack();
}

/* ───────────── furniture, drawn once per look ───────────── */

/**
 * The furniture is detailed (wood grain, woven rugs, fern leaflets), too much
 * to draw every frame for a room full of it. Each piece is drawn once per
 * look (kind, turn, cushion colour, size on screen) into a bitmap at grid
 * (0, 0) and copied where it stands (the drawings are the same anywhere on
 * the grid). Pieces that sway gently keep a loop of frames; the few that
 * move a lot (fish, water, flames, screens) are drawn live.
 */
const LIVE_ITEMS: ReadonlySet<ItemKind> = new Set<ItemKind>([
  "koi",
  "chandelier",
  "arcade",
  "trophy",
  "robot",
  "espresso",
  "tipjar",
  "podium",
]);
/** Pieces with a still body (kept as a bitmap) and a moving part drawn live. */
const HYBRID: Partial<
  Record<
    ItemKind,
    [
      (ctx: Ctx, x: number, y: number) => void,
      (ctx: Ctx, x: number, y: number, t: number) => void,
    ]
  >
> = {
  lamp: [lampBody, lampLive],
  luckycat: [luckyCatBody, luckyCatLive],
  jukebox: [jukeboxBody, jukeboxLive],
  aquarium: [aquariumBody, aquariumLive],
  fountain: [fountainBody, fountainLive],
  neon: [neonBody, neonLive],
  statue: [statueBody, statueLive],
  corner: [cornerBody, cornerLive],
  pumpkin: [pumpkinBody, pumpkinLive],
  lantern: [lanternStandBody, lanternStandLive],
  blossom: [blossomBody, blossomLive],
};
/** Pieces that sway: the loop's length (s), drawn in SWAY_FRAMES frames. */
const SWAY: Partial<Record<ItemKind, number>> = {
  plant: (Math.PI * 2) / 1.3,
  bonsai: (Math.PI * 2) / 1.2,
  vase: (Math.PI * 2) / 1.5,
  sakura: (Math.PI * 2) / 1.2,
};
const SWAY_FRAMES = 12;
const sprites = new Map<string, HTMLCanvasElement | null>();
/** Let go of the cached furniture and dish drawings (bistro-scene.ts,
 *  releaseBistroArt). */
export function releaseFurnitureArt() {
  sprites.clear();
  dishBodies.clear();
}
/** The box round a piece at grid (0, 0), in world units: [x0, y0, x1, y1]. */
const BOX_ITEM = [-62, -128, 62, 26] as const;
const BOX_FLOOR = [-96, -30, 96, 84] as const;
function sprite(
  ctx: Ctx,
  key: string,
  floor: boolean,
  gx: number,
  gy: number,
  render: (g: Ctx) => void,
) {
  const m = ctx.getTransform();
  const scale = Math.hypot(m.a, m.b) || 1;
  // Very big on screen (or no DOM): draw it as it is.
  if (scale > 4 || scale < 0.2 || typeof document === "undefined") {
    ctx.save();
    const o = iso(gx, gy);
    ctx.translate(o.x, o.y);
    render(ctx);
    ctx.restore();
    return;
  }
  const step = Math.round(Math.log(scale) / Math.log(1.12));
  const k = `${key}:${step}`;
  const [x0, y0, x1, y1] = floor ? BOX_FLOOR : BOX_ITEM;
  let cv = sprites.get(k);
  if (cv === undefined) {
    const q = Math.pow(1.12, step);
    cv = document.createElement("canvas");
    cv.width = Math.ceil((x1 - x0) * q);
    cv.height = Math.ceil((y1 - y0) * q);
    const g = cv.getContext("2d");
    if (g) {
      g.setTransform(q, 0, 0, q, -x0 * q, -y0 * q);
      render(g);
    } else cv = null;
    if (sprites.size > 360) sprites.clear();
    sprites.set(k, cv);
  }
  const o = iso(gx, gy);
  if (!cv) {
    ctx.save();
    ctx.translate(o.x, o.y);
    render(ctx);
    ctx.restore();
    return;
  }
  ctx.drawImage(cv, o.x + x0, o.y + y0, x1 - x0, y1 - y0);
}
/** Does a piece turned this way show mirrored? (A chair has four drawings.) */
export const itemFlipped = (kind: ItemKind, rot: number) =>
  ITEM_BY_KIND[kind]?.seat !== "chair" && rot % 2 === 1;
/**
 * How many ways a piece can face, as it's turned when placed: a chair four
 * (it has a drawing for each); anything else two, seen from the other side
 * (mirrored, as isometric games turn their furniture). Each piece has
 * something that shows which way it faces (a round table its salt and
 * pepper, a rug the tassels on its ends): the visual tests check that a
 * turn shows on every one.
 */
export function itemTurns(kind: ItemKind): number {
  return ITEM_BY_KIND[kind]?.seat === "chair" ? 4 : 2;
}
/** A piece of furniture on tile (x, y) (the rugs: their top corner tile). */
export function drawItem(
  ctx: Ctx,
  kind: ItemKind,
  x: number,
  y: number,
  t: number,
  rot = 0,
) {
  // Turned to face the other way: the same piece, mirrored about its tile.
  if (itemFlipped(kind, rot)) {
    const cx = iso(x, y).x;
    ctx.save();
    ctx.translate(cx, 0);
    ctx.scale(-1, 1);
    ctx.translate(-cx, 0);
    drawItemFacing(ctx, kind, x, y, t, 0);
    ctx.restore();
    return;
  }
  drawItemFacing(ctx, kind, x, y, t, rot);
}
function drawItemFacing(
  ctx: Ctx,
  kind: ItemKind,
  x: number,
  y: number,
  t: number,
  rot: number,
) {
  if (LIVE_ITEMS.has(kind)) return drawItemRaw(ctx, kind, x, y, t, rot);
  const hy = HYBRID[kind];
  if (hy) {
    sprite(ctx, `h:${kind}`, false, x, y, (g) => hy[0](g, 0, 0));
    return hy[1](ctx, x, y, t);
  }
  const loop = SWAY[kind];
  const frame = loop
    ? Math.floor(((((t % loop) + loop) % loop) / loop) * SWAY_FRAMES)
    : 0;
  const tf = loop ? (frame / SWAY_FRAMES) * loop : 0;
  // A chair's cushion colour depends on where it stands: keep it.
  const cu = ITEM_BY_KIND[kind]?.seat === "chair" ? cushionIndex(x, y, 0) : 0;
  sprite(
    ctx,
    `i:${kind}:${rot}:${frame}:${cu}`,
    !!ITEM_BY_KIND[kind]?.floor,
    x,
    y,
    (g) =>
      ITEM_BY_KIND[kind]?.seat === "chair"
        ? drawChairRaw(g, 0, 0, rot, "all", cu, chairStyleOf(kind))
        : drawItemRaw(g, kind, 0, 0, tf, rot),
  );
}
/** A chair (or its back alone, drawn in front of who sits on it). */
export function drawChair(
  ctx: Ctx,
  x: number,
  y: number,
  dir: number,
  back: "behind" | "front" | "all",
  tint = 0,
  style: ChairStyle = "cushion",
) {
  const cu = cushionIndex(x, y, tint);
  sprite(ctx, `c:${style}:${dir}:${back}:${cu}`, false, x, y, (g) =>
    drawChairRaw(g, 0, 0, dir, back, cu, style),
  );
}

function drawItemRaw(
  ctx: Ctx,
  kind: ItemKind,
  x: number,
  y: number,
  t: number,
  rot = 0,
) {
  switch (kind) {
    case "table":
    case "gardentable":
    case "marbletable":
    case "goldtable":
      return drawTable(ctx, x, y, tableStyleOf(kind));
    case "chair":
    case "stool":
    case "armchair":
    case "throne":
      return drawChairRaw(ctx, x, y, rot, "all", 0, chairStyleOf(kind));
    case "tipjar":
      return drawTipJar(ctx, x, y, t);
    case "espresso":
      return drawEspresso(ctx, x, y, t);
    case "cart":
      return drawCart(ctx, x, y);
    case "arcade":
      return drawArcade(ctx, x, y, t);
    case "neon":
      return (neonBody(ctx, x, y), neonLive(ctx, x, y, t));
    case "freezer":
      return drawFreezer(ctx, x, y);
    case "massage":
      return drawMassage(ctx, x, y);
    case "piano":
      return drawPiano(ctx, x, y);
    case "podium":
      return drawPodium(ctx, x, y, t);
    case "robot":
      return drawRobot(ctx, x, y, t);
    case "vase":
      return drawVase(ctx, x, y, t);
    case "screen":
      return drawScreen(ctx, x, y);
    case "bookshelf":
      return drawBookshelf(ctx, x, y);
    case "carpet":
      return drawCarpet(ctx, x, y);
    case "koi":
      return drawKoi(ctx, x, y, t);
    case "chandelier":
      return drawChandelier(ctx, x, y, t);
    case "sakura":
      return drawSakura(ctx, x, y, t);
    case "statue":
      return (statueBody(ctx, x, y), statueLive(ctx, x, y, t));
    case "plant":
      return drawPlant(ctx, x, y, t);
    case "lamp":
      return (lampBody(ctx, x, y), lampLive(ctx, x, y, t));
    case "bonsai":
      return drawBonsai(ctx, x, y, t);
    case "luckycat":
      return (luckyCatBody(ctx, x, y), luckyCatLive(ctx, x, y, t));
    case "jukebox":
      return (jukeboxBody(ctx, x, y), jukeboxLive(ctx, x, y, t));
    case "aquarium":
      return (aquariumBody(ctx, x, y), aquariumLive(ctx, x, y, t));
    case "fountain":
      return (fountainBody(ctx, x, y), fountainLive(ctx, x, y, t));
    case "rug":
      return drawRug(ctx, x, y);
    case "corner":
      return (cornerBody(ctx, x, y), cornerLive(ctx, x, y, t));
    case "pumpkin":
      return (pumpkinBody(ctx, x, y), pumpkinLive(ctx, x, y, t));
    case "haybale":
      return drawHayBale(ctx, x, y);
    case "lantern":
      return (lanternStandBody(ctx, x, y), lanternStandLive(ctx, x, y, t));
    case "blossom":
      return (blossomBody(ctx, x, y), blossomLive(ctx, x, y, t));
    case "trophy":
      return drawTrophy(ctx, x, y, t);
  }
}
/** Light sources an item gives off at night: [dx, dy from the tile centre, radius, rgb]. */
export function itemGlow(
  kind: ItemKind,
): [number, number, number, string] | null {
  switch (kind) {
    case "lamp":
      return [14, -66, 130, "255,150,90"];
    case "pumpkin":
      return [0, -20, 80, "255,170,80"];
    case "lantern":
      return [12, -52, 100, "255,90,60"];
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
/**
 * A dish's still part, drawn once per size into a bitmap (the drawings are
 * detailed: a table full of guests shouldn't redraw every grain of rice each
 * frame). Sizes are rounded to steps of about 12%.
 */
const dishBodies = new Map<string, HTMLCanvasElement | null>();
function dishBody(ctx: Ctx, id: DishId, x: number, y: number, s: number) {
  const m = ctx.getTransform();
  const scale = Math.hypot(m.a, m.b) || 1;
  const px = s * scale;
  // Tiny or huge: just draw it.
  if (px < 4 || px > 400 || typeof document === "undefined")
    return drawDishBody(ctx, id, x, y, s);
  const step = Math.round(Math.log(px) / Math.log(1.12));
  const key = `${id}:${step}`;
  let cv = dishBodies.get(key);
  // The box around any dish: 1.25 radii to each side, 1.75 up, 0.6 down.
  if (cv === undefined) {
    const q = Math.pow(1.12, step);
    cv = document.createElement("canvas");
    cv.width = Math.ceil(q * 2.5);
    cv.height = Math.ceil(q * 2.35);
    const g = cv.getContext("2d");
    if (g) {
      g.setTransform(q / s, 0, 0, q / s, q * 1.25, q * 1.75);
      drawDishBody(g, id, 0, 0, s);
    } else cv = null;
    if (dishBodies.size > 400) dishBodies.clear();
    dishBodies.set(key, cv);
  }
  if (!cv) return drawDishBody(ctx, id, x, y, s);
  ctx.drawImage(cv, x - s * 1.25, y - s * 1.75, s * 2.5, s * 2.35);
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
  dishBody(ctx, id, x, y, s);
  drawDishLive(ctx, id, x, y, s, t);
  if (steam && s >= 10 && !COLD_DISHES.has(id)) {
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
/** A stove model's picture, for the Shop and Decorate (as itemIconUrl). */
const stoveUrls = new Map<string, string>();
export function stoveIconUrl(model: StoveModel, px = 72): string {
  const key = `${model}:${px}`;
  const hit = stoveUrls.get(key);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = cv.height = px;
  const ctx = cv.getContext("2d");
  if (!ctx) return "";
  const k = px / 120;
  ctx.scale(k, k);
  const c = iso(0, 0);
  ctx.translate(60 - c.x, 96 - c.y);
  drawFixture(ctx, "stove", 0, 0, 0.3, 0.6, model);
  const url = cv.toDataURL();
  stoveUrls.set(key, url);
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
  // The 2 × 2 floor pieces (rugs): scaled down, their middle (the centre of
  // the four tiles, iso(0.5, 0.5)) at (60, 64).
  if (ITEM_BY_KIND[kind]?.floor) {
    const m = iso(0.5, 0.5);
    ctx.translate(0, -28);
    ctx.scale(0.58, 0.58);
    ctx.translate(-m.x, -m.y);
  }
  drawItem(ctx, kind, 0, 0, 0.3, 1);
  const url = cv.toDataURL();
  itemUrls.set(key, url);
  return url;
}

/* ───────────── migration 104: machines and decor ───────────── */

/** The chair and table look for each seat kind of the shop. */
export const chairStyleOf = (kind: ItemKind): ChairStyle =>
  kind === "stool"
    ? "stool"
    : kind === "armchair"
      ? "armchair"
      : kind === "throne"
        ? "throne"
        : "cushion";
export const tableStyleOf = (kind: ItemKind): TableStyle =>
  kind === "gardentable"
    ? "garden"
    : kind === "marbletable"
      ? "marble"
      : kind === "goldtable"
        ? "gold"
        : "round";

/** A small stand (a cabinet) things sit on. */
export function drawCarpet(ctx: Ctx, x: number, y: number) {
  const pts = [
    iso(x - 0.4, y - 0.4),
    iso(x + 1.4, y - 0.4),
    iso(x + 1.4, y + 1.4),
    iso(x - 0.4, y + 1.4),
  ];
  ctx.fillStyle = lin(ctx, pts[3].x, pts[3].y, pts[1].x, pts[1].y, [
    [0, "#8e0c1f"],
    [0.5, "#c4162f"],
    [1, "#9a0f24"],
  ]);
  poly(ctx, pts);
  ctx.fill();
  // A gold border with a braid, and a plush sheen down the middle.
  ctx.strokeStyle = "#e8b84a";
  ctx.lineWidth = 3;
  poly(ctx, [
    iso(x - 0.28, y - 0.28),
    iso(x + 1.28, y - 0.28),
    iso(x + 1.28, y + 1.28),
    iso(x - 0.28, y + 1.28),
  ]);
  ctx.stroke();
  ctx.strokeStyle = "#fff0b8";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  poly(ctx, [
    iso(x - 0.22, y - 0.22),
    iso(x + 1.22, y - 0.22),
    iso(x + 1.22, y + 1.22),
    iso(x - 0.22, y + 1.22),
  ]);
  ctx.stroke();
  ctx.setLineDash([]);
  weave(ctx, x - 0.4, y - 0.4, x + 1.4, y + 1.4, "#3a0008");
  endBands(ctx, x, y, 0.4, ["#f2d27a", "#5a0010"]);
  fringe(ctx, x - 0.4, y - 0.4, x - 0.4, y + 1.4, 16, "#f2d27a", [-4, -2]);
  fringe(ctx, x + 1.4, y - 0.4, x + 1.4, y + 1.4, 16, "#f2d27a", [4, 2]);
}
export function drawSakura(ctx: Ctx, x: number, y: number, t: number) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 30, 12, 0.28);
  // Trunk and two branches run up into the crown, so the blossoms sit on
  // the wood (no gap between them).
  ctx.fillStyle = lin(ctx, c.x - 6, 0, c.x + 6, 0, [
    [0, "#8a5a36"],
    [0.5, "#6b4226"],
    [1, "#4a2a16"],
  ]);
  ctx.beginPath();
  ctx.moveTo(c.x - 7, c.y);
  ctx.quadraticCurveTo(c.x - 3, c.y - 4, c.x - 3, c.y - 12);
  ctx.lineTo(c.x - 2, c.y - 70);
  ctx.lineTo(c.x + 2, c.y - 70);
  ctx.lineTo(c.x + 3, c.y - 12);
  ctx.quadraticCurveTo(c.x + 3, c.y - 4, c.x + 8, c.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#5a3520";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - 34);
  ctx.quadraticCurveTo(c.x - 10, c.y - 44, c.x - 18, c.y - 58);
  ctx.moveTo(c.x + 1, c.y - 40);
  ctx.quadraticCurveTo(c.x + 10, c.y - 48, c.x + 17, c.y - 58);
  ctx.stroke();
  const sw = (dy: number) => Math.sin(t * 1.2) * (-dy / 60);
  // A darker underside first, then the lit clumps.
  for (const [dx, dy, r] of [
    [-16, -58, 15],
    [16, -57, 15],
    [0, -56, 14],
  ] as const) {
    ctx.fillStyle = "#d9799f";
    ellipse(ctx, c.x + dx + sw(dy), c.y + dy, r, r * 0.8);
    ctx.fill();
  }
  for (const [dx, dy, r] of [
    [0, -76, 24],
    [-20, -66, 17],
    [20, -64, 17],
    [-9, -92, 16],
    [12, -90, 15],
    [0, -60, 13],
  ] as const) {
    const px = c.x + dx + sw(dy);
    ctx.fillStyle = rad(ctx, px + r * 0.3, c.y + dy - r * 0.35, r * 1.1, [
      [0, "#ffe6ef"],
      [0.65, "#f6a6c8"],
      [1, "#e284ac"],
    ]);
    ellipse(ctx, px, c.y + dy, r, r * 0.8);
    ctx.fill();
  }
  // Blossoms dotted over the crown.
  ctx.fillStyle = "rgba(255,246,250,0.9)";
  for (let i = 0; i < 12; i++) {
    const a = i * 2.4,
      d = 6 + ((i * 7) % 20);
    const dy = -78 + Math.sin(a) * d * 0.7;
    ctx.beginPath();
    ctx.arc(c.x + Math.cos(a) * d + 4 + sw(dy), c.y + dy, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}
