/*
 * Element Bistro: the neighbourhood around the street corner. A row of shops
 * across the road (flowers, bread, books, tea, toys, gelato) with awnings and
 * signs that light up at night, a canal crossed by the road's bridge and a
 * little footbridge, a square with a fountain, benches and pigeons, and a bus
 * stop. Then what moves through it: creatures of the game walking (some with
 * a dog), riding bikes, sitting on the benches or waiting for the bus, the
 * bus itself, pigeons, ducks, and the season's weather.
 *
 * Only pictures: nothing here touches the game's rules. The layout follows
 * the room's size (R) so a bigger room pushes the street out with it.
 * World units, the isometric grid of bistro-art.ts. What never moves is
 * baked with the rest of the street (bistro-scene's sceneryCanvas); what
 * moves is drawn every frame, fewer of everything on Low graphics.
 */
import type { Facing } from "../animation/controller";
import {
  R,
  iso,
  isoBox,
  shade,
  softShadow,
  type Light,
  type Season,
} from "./bistro-art";
import { poly } from "./bistro-geom";

type Ctx = CanvasRenderingContext2D;
type Pt = { x: number; y: number };

/* ───────────── the layout (grid units) ───────────── */

/** The level horizon (world y): the sky above, the ground below. */
export const HORIZON = -150;
/** The road on the far side of the door: x from ROAD0 to ROAD1, along y. */
export const ROAD0 = -5.6,
  ROAD1 = -3.3;
/** The building's left face: the near sidewalk runs from ROAD1 to here. */
export const WALK = -0.5;
/** The shopfronts across the road (the far sidewalk runs from here to ROAD0) and their backs. */
export const FRONTS = -6.7,
  BACKS = -8.8;
export const FAR = 4000;
/** How far the canal's water lies below the street (world px). */
export const WATER = 16;
/** The footbridge's middle (grid x). */
export const FOOT_X = 4.7;
/** World px along a wall per grid tile. */
const TILE = Math.hypot(48, 24);

/** The canal across the front: along x, from grid y y0 to y1. */
export const canal = () => ({ y0: R.rows + 2.7, y1: R.rows + 4.1 });
/** The square's fountain (grid) and the paved circle's radius (tiles). */
export const plaza = () => ({ x: R.cols + 3.8, y: 2.4, r: 1.9 });
/** Where the bus stops (grid y, near lane). */
export const stopY = () => R.rows + 0.8;
/** The lane a vehicle drives in: going +y the far lane, -y the near one. */
export const laneOf = (v: number) => (v > 0 ? ROAD0 + 0.6 : ROAD1 - 0.6);

/** A spot on the ground on this side of the horizon (things stand there, not in the sky). */
export const onGround = (gx: number, gy: number, margin = 12) =>
  iso(gx, gy).y > HORIZON + margin;
/** In front of the room's base: drawn after the room. */
export const inFront = (x: number, y: number) =>
  y > R.rows - 0.5 || x > R.cols - 0.5;

export const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};
export const lerpRgb = (a: number[], b: number[], f: number) =>
  `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * f)).join(",")})`;
/** A ground quad over grid span [x0, x1] × [y0, y1]. */
export function quad(ctx: Ctx, x0: number, y0: number, x1: number, y1: number) {
  poly(ctx, [iso(x0, y0), iso(x1, y0), iso(x1, y1), iso(x0, y1)]);
}
const up = (p: Pt, z: number) => ({ x: p.x, y: p.y - z });
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * The season of a day ("2026-11-17", the server's Pacific day): March to May
 * spring, June to August summer, September to November autumn, else winter.
 */
export function seasonOf(day: string): Season {
  const m = Number(day.slice(5, 7));
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "autumn";
  return "winter";
}

/** The world rectangle the canvas shows (scale and translate only). */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export function viewRect(ctx: Ctx): Rect {
  const m = ctx.getTransform();
  const w = ctx.canvas.width,
    h = ctx.canvas.height;
  return {
    x0: -m.e / m.a,
    y0: -m.f / m.d,
    x1: (w - m.e) / m.a,
    y1: (h - m.f) / m.d,
  };
}
export const meets = (
  r: Rect,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) => x1 >= r.x0 && x0 <= r.x1 && y1 >= r.y0 && y0 <= r.y1;

/**
 * Draw in a wall's plane. Local x runs along the wall in world px, as seen
 * from the street (left to right), local y is screen-down (so height z is
 * at y = -z). `along: "y"`: the face at grid x = `at`, facing +x, from grid
 * y = `from` toward -y. `along: "x"`: the face at grid y = `at`, facing +y,
 * from grid x = `from` toward +x.
 */
function onWall(
  ctx: Ctx,
  along: "x" | "y",
  at: number,
  from: number,
  fn: () => void,
) {
  const o = along === "y" ? iso(at, from) : iso(from, at);
  const k = 1 / Math.sqrt(5);
  ctx.save();
  ctx.transform(2 * k, along === "y" ? -k : k, 0, 1, o.x, o.y);
  fn();
  ctx.restore();
}

/* ───────────── the shops across the road ───────────── */

type Goods = "flowers" | "bread" | "books" | "tea" | "toys" | "ice";
interface Look {
  wall: string;
  trim: string;
  awning: [string, string];
  sign: string;
  text: string;
  goods: Goods;
}
/** The neighbours, in order down the street (data: add a look to add a shop). */
const LOOKS: readonly Look[] = [
  {
    wall: "#f6d3dc",
    trim: "#3f7a4e",
    awning: ["#4f9a62", "#f4f1ea"],
    sign: "#2f5d3c",
    text: "FLOWERS",
    goods: "flowers",
  },
  {
    wall: "#f3e1bf",
    trim: "#8a4b2a",
    awning: ["#d94a3a", "#fbf3e6"],
    sign: "#6b3a1e",
    text: "BAKERY",
    goods: "bread",
  },
  {
    wall: "#c9d6e8",
    trim: "#2c3e66",
    awning: ["#2f4c86", "#e9eef6"],
    sign: "#1f2d4f",
    text: "BOOKS",
    goods: "books",
  },
  {
    wall: "#dfe9d0",
    trim: "#5a7a3a",
    awning: ["#e2a33a", "#fff6e0"],
    sign: "#40562a",
    text: "TEA HOUSE",
    goods: "tea",
  },
  {
    wall: "#fde6b8",
    trim: "#b8452f",
    awning: ["#7b5ad1", "#fdf6ff"],
    sign: "#4b2f86",
    text: "TOYS",
    goods: "toys",
  },
  {
    wall: "#d7f0ee",
    trim: "#2e8a86",
    awning: ["#ef7fa6", "#fff4f8"],
    sign: "#1f6663",
    text: "GELATO",
    goods: "ice",
  },
];
export interface Shop {
  y0: number;
  y1: number;
  /** Height (world px). */
  h: number;
  k: number;
  look: Look;
}
/** The shops along the far sidewalk, leaving a gap where the canal runs. */
export function shops(): Shop[] {
  const c = canal();
  const out: Shop[] = [];
  for (let k = 0; k < 11; k++) {
    const y0 = 0.8 + k * 2.5,
      y1 = y0 + 2.4;
    if (y1 > c.y0 - 0.15 && y0 < c.y1 + 0.15) continue;
    out.push({
      y0,
      y1,
      k,
      h: 112 + Math.floor(hash(k + 70) * 3) * 16,
      look: LOOKS[k % LOOKS.length],
    });
  }
  return out;
}
/** A shop's box on screen (world px), for culling. */
export function shopBox(s: Shop): Rect {
  const a = iso(BACKS, s.y0),
    b = iso(FRONTS + 0.6, s.y0),
    c = iso(FRONTS + 0.6, s.y1),
    d = iso(BACKS, s.y1);
  return {
    x0: d.x,
    y0: a.y - s.h - 30,
    x1: b.x,
    y1: c.y,
  };
}
function drawGoods(ctx: Ctx, g: Goods, x: number, w: number, n: number) {
  // Local wall coordinates: the window spans x .. x + w, z 10 .. 52.
  const dk = (c: string) => shade(c, -0.35 * n);
  const shelf = (z: number) => {
    ctx.fillStyle = dk("#8a6a4a");
    ctx.fillRect(x + 2, -z, w - 4, 2);
  };
  if (g === "flowers") {
    const cols = ["#ff7aa8", "#ffd65b", "#ffffff", "#b49cff", "#ff9a5b"];
    for (let i = 0; i < 6; i++) {
      const cx = x + 6 + (i * (w - 12)) / 5;
      ctx.fillStyle = dk("#3f8a45");
      ctx.fillRect(cx - 0.6, -24, 1.2, 10);
      ctx.fillStyle = dk(cols[i % cols.length]);
      ctx.beginPath();
      ctx.arc(cx, -26, 3.4, 0, Math.PI * 2);
      ctx.arc(cx + 2.6, -29, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = dk("#b0785a");
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 4 + i * (w / 3), -15, 9, 5);
  } else if (g === "bread") {
    shelf(30);
    ctx.fillStyle = dk("#c98a3e");
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(x + 8 + i * ((w - 14) / 3), -34, 5.5, 3.4, 0, 0, 7);
      ctx.fill();
    }
    ctx.fillStyle = dk("#f6e7d0");
    ctx.fillRect(x + w / 2 - 7, -22, 14, 8);
    ctx.fillStyle = dk("#ff7aa8");
    ctx.fillRect(x + w / 2 - 7, -24, 14, 2.5);
  } else if (g === "books") {
    const cols = ["#d94a3a", "#2f4c86", "#f2c14e", "#4f9a62", "#7b5ad1"];
    for (const z of [16, 34]) {
      shelf(z - 2);
      for (let i = 0; i * 4 < w - 8; i++) {
        ctx.fillStyle = dk(cols[(i + z) % cols.length]);
        const bh = 9 + hash(i + z) * 4;
        ctx.fillRect(x + 4 + i * 4, -z - bh, 3.2, bh);
      }
    }
  } else if (g === "tea") {
    shelf(26);
    ctx.fillStyle = dk("#fbf6ec");
    for (let i = 0; i < 3; i++) {
      const cx = x + 10 + i * ((w - 20) / 2);
      ctx.fillRect(cx - 3, -33, 6, 6);
      ctx.fillRect(cx + 3, -31, 2, 2);
    }
    ctx.fillStyle = dk("#4f8a5b");
    ctx.beginPath();
    ctx.ellipse(x + w / 2, -18, 8, 6, 0, 0, 7);
    ctx.fill();
    ctx.fillRect(x + w / 2 + 6, -21, 6, 2);
  } else if (g === "toys") {
    ctx.fillStyle = dk("#f2c14e");
    ctx.beginPath();
    ctx.arc(x + 12, -24, 7, 0, 7);
    ctx.arc(x + 7, -30, 2.6, 0, 7);
    ctx.arc(x + 17, -30, 2.6, 0, 7);
    ctx.fill();
    ctx.fillStyle = dk("#3d8fd1");
    ctx.beginPath();
    ctx.arc(x + w - 12, -18, 6, 0, 7);
    ctx.fill();
    ctx.fillStyle = dk("#e2453a");
    ctx.fillRect(x + w / 2 - 5, -20, 9, 9);
    ctx.fillStyle = dk("#4fb36b");
    ctx.fillRect(x + w / 2 - 2, -28, 9, 8);
  } else {
    for (let i = 0; i < 4; i++) {
      const cx = x + 8 + i * ((w - 16) / 3);
      ctx.fillStyle = dk("#d9a35a");
      ctx.beginPath();
      ctx.moveTo(cx - 3.5, -26);
      ctx.lineTo(cx, -14);
      ctx.lineTo(cx + 3.5, -26);
      ctx.fill();
      ctx.fillStyle = dk(["#ff9ab8", "#fff1c4", "#9be0c8", "#c9a0ff"][i]);
      ctx.beginPath();
      ctx.arc(cx, -28, 4.2, 0, 7);
      ctx.fill();
    }
  }
}
export function drawShop(ctx: Ctx, s: Shop, l: Light) {
  const n = l.night,
    snow = l.season === "winter";
  const dim = (c: string) => shade(c, -0.5 * n);
  const { y0, y1, h, look } = s;
  const x1 = FRONTS;
  isoBox(ctx, BACKS, y0, x1, y1, 0, h, {
    top: snow ? dim("#eef2f7") : dim("#8c817a"),
    left: dim(shade(look.wall, -0.2)),
    right: dim(look.wall),
  });
  const W = (y1 - y0) * TILE;
  const lit = n > 0.35;
  const winX = 12,
    winW = W * 0.5;
  const doorX = winX + winW + 12,
    doorW = Math.min(24, W - doorX - 10);
  onWall(ctx, "y", x1, y1, () => {
    // The plinth, and a shadow under the awning.
    ctx.fillStyle = dim(shade(look.trim, -0.25));
    ctx.fillRect(0, -6, W, 6);
    ctx.fillStyle = "rgba(0,0,0,.12)";
    ctx.fillRect(0, -62, W, 12);
    // The shop window: a frame, the glass, what's for sale.
    ctx.fillStyle = dim(look.trim);
    ctx.fillRect(winX - 3, -55, winW + 6, 48);
    if (lit) {
      ctx.fillStyle = `rgb(255,${(208 + 18 * n) | 0},${(132 + 30 * n) | 0})`;
    } else {
      const g = ctx.createLinearGradient(0, -52, 0, -10);
      g.addColorStop(0, shade("#d6ecf6", -0.4 * n));
      g.addColorStop(1, shade("#86b2cc", -0.4 * n));
      ctx.fillStyle = g;
    }
    ctx.fillRect(winX, -52, winW, 42);
    drawGoods(ctx, look.goods, winX, winW, lit ? 0 : n);
    if (!lit) {
      // A shine across the glass.
      ctx.fillStyle = "rgba(255,255,255,.22)";
      ctx.beginPath();
      ctx.moveTo(winX + winW * 0.2, -52);
      ctx.lineTo(winX + winW * 0.42, -52);
      ctx.lineTo(winX + winW * 0.22, -10);
      ctx.lineTo(winX, -10);
      ctx.lineTo(winX, -30);
      ctx.fill();
    }
    // The door, its glass warm at night, a wreath in winter.
    ctx.fillStyle = dim(shade(look.trim, -0.15));
    ctx.fillRect(doorX, -46, doorW, 40);
    ctx.fillStyle = lit ? "rgb(255,214,140)" : dim("#a9cde0");
    ctx.fillRect(doorX + 4, -42, doorW - 8, 18);
    ctx.fillStyle = dim("#f2c14e");
    ctx.fillRect(doorX + doorW - 6, -24, 2.5, 2.5);
    if (snow) {
      ctx.strokeStyle = dim("#2f7a4a");
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(doorX + doorW / 2, -33, 5, 0, 7);
      ctx.stroke();
      ctx.fillStyle = dim("#d94a3a");
      ctx.fillRect(doorX + doorW / 2 - 2, -29, 4, 3);
    }
    // The sign over the awning.
    ctx.fillStyle = dim(look.sign);
    ctx.fillRect(8, -86, W - 16, 20);
    ctx.strokeStyle = dim(shade(look.trim, 0.35));
    ctx.lineWidth = 1.5;
    ctx.strokeRect(9, -85, W - 18, 18);
    ctx.fillStyle = lit ? "#ffe6a6" : dim("#fbf3e2");
    ctx.font = "800 11px 'Barlow Condensed', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(look.text, W / 2, -75.5);
    ctx.textBaseline = "alphabetic";
    // Upper floors: windows (some lit at night) with window boxes.
    for (let z = 96, row = 0; z + 24 <= h - 12; z += 34, row++)
      for (const [i, fx] of [0.16, 0.6].entries()) {
        const x = W * fx,
          ww = W * 0.24;
        ctx.fillStyle = dim("#fbf6ec");
        ctx.fillRect(x - 2, -z - 26, ww + 4, 28);
        const on = hash(s.k * 9 + row * 3 + i) > 0.35;
        ctx.fillStyle =
          lit && on
            ? `rgba(255,${(200 + 20 * n) | 0},120,1)`
            : dim(lit ? "#3a4058" : "#9cc4dc");
        ctx.fillRect(x, -z - 24, ww, 24);
        ctx.fillStyle = "rgba(255,255,255,.18)";
        ctx.fillRect(x + ww / 2 - 0.75, -z - 24, 1.5, 24);
        // The window box: flowers in spring and summer, snow in winter.
        ctx.fillStyle = dim("#8a5a3a");
        ctx.fillRect(x - 3, -z + 1, ww + 6, 5);
        if (l.season !== "winter" && l.season !== "autumn") {
          ctx.fillStyle = dim(["#ff7aa8", "#ffd65b", "#e2453a"][(s.k + i) % 3]);
          for (let k = 0; k < 4; k++) {
            ctx.beginPath();
            ctx.arc(x + 1 + (k * ww) / 3, -z, 2.4, 0, 7);
            ctx.fill();
          }
        } else if (snow) {
          ctx.fillStyle = dim("#f4f7fb");
          ctx.fillRect(x - 3, -z - 1, ww + 6, 2.5);
        }
      }
  });
  // The striped awning over the window and the door, and its scalloped hem.
  const az0 = 62,
    az1 = 47,
    out = 0.55,
    ya = y0 + 0.12,
    yb = y1 - 0.12,
    k = 8;
  const [c0, c1] = look.awning.map((c) => dim(snow ? shade(c, 0.55) : c)) as [
    string,
    string,
  ];
  for (let i = 0; i < k; i++) {
    const a = ya + ((yb - ya) * i) / k,
      b = ya + ((yb - ya) * (i + 1)) / k;
    ctx.fillStyle = i % 2 ? c1 : c0;
    poly(ctx, [
      up(iso(x1, a), az0),
      up(iso(x1, b), az0),
      up(iso(x1 + out, b), az1),
      up(iso(x1 + out, a), az1),
    ]);
    ctx.fill();
    ctx.fillStyle = shade(i % 2 ? c1 : c0, -0.12);
    const p = up(iso(x1 + out, a), az1),
      q = up(iso(x1 + out, b), az1);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.lineTo(q.x, q.y + 5);
    ctx.quadraticCurveTo((p.x + q.x) / 2, (p.y + q.y) / 2 + 11, p.x, p.y + 5);
    ctx.fill();
  }
  // A chimney or a water tank on some roofs.
  if (s.k % 3 === 0)
    isoBox(ctx, BACKS + 0.4, y0 + 0.5, BACKS + 0.8, y0 + 0.9, h, 20, {
      top: dim(snow ? "#f4f7fb" : "#5a3a2a"),
      left: dim("#8a5a40"),
      right: dim("#6e4630"),
    });
  else if (s.k % 3 === 1) {
    const c = iso(BACKS + 0.9, (y0 + y1) / 2);
    ctx.fillStyle = dim("#6a5a50");
    ctx.fillRect(c.x - 12, c.y - h - 30, 3, 30);
    ctx.fillRect(c.x + 9, c.y - h - 30, 3, 30);
    ctx.fillStyle = dim("#9a7a5a");
    ctx.beginPath();
    ctx.roundRect(c.x - 15, c.y - h - 50, 30, 24, 4);
    ctx.fill();
    ctx.fillStyle = dim(snow ? "#f4f7fb" : "#7a5a40");
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - h - 50, 15, 6, 0, 0, 7);
    ctx.fill();
  }
}
/** The warm light of the shops at night (baked with the street). */
export function shopGlows(): Glow[] {
  const out: Glow[] = [];
  for (const s of shops()) {
    const w = iso(FRONTS + 0.35, s.y1 - 0.85);
    out.push([w.x, w.y - 24, 78, "255,200,120", 0.42]);
    const sg = iso(FRONTS + 0.2, (s.y0 + s.y1) / 2);
    out.push([sg.x, sg.y - 76, 46, "255,226,160", 0.22]);
  }
  return out;
}
/** A light: [x, y, radius, rgb, strength] (strength scales with the night). */
export type Glow = [number, number, number, string, number];

/* ───────────── the canal and its bridges ───────────── */

/** Lift of the footbridge's arch over grid y (0 off the bridge). */
export function footLift(gx: number, gy: number): number {
  const c = canal();
  const a = c.y0 - 0.5,
    b = c.y1 + 0.5;
  if (Math.abs(gx - FOOT_X) > 0.5 || gy <= a || gy >= b) return 0;
  return 13 * Math.sin((Math.PI * (gy - a)) / (b - a));
}
export function drawCanal(ctx: Ctx, l: Light) {
  const n = l.night,
    frozen = l.season === "winter";
  const c = canal();
  const stone = lerpRgb([176, 168, 154], [62, 62, 76], n);
  const stoneDark = lerpRgb([128, 120, 110], [42, 42, 56], n);
  const coping = lerpRgb(
    frozen ? [240, 244, 250] : [214, 206, 190],
    [84, 84, 100],
    n,
  );
  // The paths to the footbridge.
  ctx.fillStyle = lerpRgb([214, 204, 186], [78, 76, 90], n);
  quad(ctx, FOOT_X - 0.4, R.rows + 1.6, FOOT_X + 0.4, c.y0);
  ctx.fill();
  quad(ctx, FOOT_X - 0.4, c.y1, FOOT_X + 0.4, R.rows + 16);
  ctx.fill();
  for (const [x0, x1] of [
    [-40, FRONTS - 0.05],
    [WALK + 0.05, 40],
  ]) {
    ctx.save();
    quad(ctx, x0, c.y0, x1, c.y1);
    ctx.clip();
    // Water (or ice), the far bank's face over it.
    ctx.fillStyle = frozen
      ? lerpRgb([214, 230, 242], [70, 84, 112], n)
      : lerpRgb([96, 164, 204], [24, 38, 70], n);
    quad(ctx, x0, c.y0, x1, c.y1);
    ctx.fill();
    // The far bank's stone face, down to the water.
    ctx.fillStyle = stoneDark;
    poly(ctx, [
      iso(x0, c.y0),
      iso(x1, c.y0),
      up(iso(x1, c.y0), -WATER),
      up(iso(x0, c.y0), -WATER),
    ]);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const a = iso(x0, c.y0),
      b = iso(x1, c.y0);
    ctx.moveTo(a.x, a.y + WATER / 2);
    ctx.lineTo(b.x, b.y + WATER / 2);
    ctx.stroke();
    // Ripples catching the light, or cracks in the ice.
    ctx.strokeStyle = frozen
      ? "rgba(255,255,255,.55)"
      : n > 0.5
        ? "rgba(255,220,160,.18)"
        : "rgba(255,255,255,.35)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < 70; i++) {
      const gx = x0 + hash(i + 7100) * (x1 - x0);
      if (gx < -6 || gx > R.cols + 12) continue;
      const gy = c.y0 + 0.35 + hash(i + 7300) * (c.y1 - c.y0 - 0.45);
      const p = iso(gx, gy),
        q = iso(gx + 0.3 + hash(i) * 0.4, gy + (frozen ? 0.2 : 0));
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
    ctx.restore();
    // The copings along both banks.
    ctx.fillStyle = coping;
    quad(ctx, x0, c.y0 - 0.12, x1, c.y0);
    ctx.fill();
    quad(ctx, x0, c.y1, x1, c.y1 + 0.12);
    ctx.fill();
  }
  // The road bridge: the street runs over (the ground pass drew it); its
  // side shows an arch over the water, and low parapets line both edges.
  onWall(ctx, "y", WALK + 0.05, c.y1, () => {
    const w = (c.y1 - c.y0) * TILE;
    ctx.fillStyle = stone;
    ctx.fillRect(0, 0, w, WATER);
    ctx.fillStyle = lerpRgb([40, 60, 80], [12, 16, 30], n);
    ctx.beginPath();
    ctx.ellipse(w / 2, WATER, w * 0.36, WATER * 0.8, 0, Math.PI, 0);
    ctx.fill();
  });
}
/** Things standing on the bridges: their parapets (baked). */
export function bridgeParts(l: Light): { d: number; f: (ctx: Ctx) => void }[] {
  const n = l.night,
    snow = l.season === "winter";
  const c = canal();
  const a = c.y0 - 0.35,
    b = c.y1 + 0.35;
  const stone = {
    top: lerpRgb(snow ? [242, 246, 250] : [214, 206, 190], [84, 84, 100], n),
    left: lerpRgb([150, 142, 130], [52, 52, 66], n),
    right: lerpRgb([176, 168, 154], [62, 62, 76], n),
  };
  const out: { d: number; f: (ctx: Ctx) => void }[] = [];
  for (const [x0, x1] of [
    [FRONTS - 0.02, FRONTS + 0.12],
    [WALK - 0.12, WALK + 0.05],
  ]) {
    out.push({
      d: x1 + (a + b) / 2,
      f: (ctx) => {
        isoBox(ctx, x0, a, x1, b, 0, 12, stone);
        for (const y of [a, b])
          isoBox(ctx, x0 - 0.04, y - 0.1, x1 + 0.04, y + 0.1, 0, 18, stone);
      },
    });
  }
  // The footbridge: its stone side, a plank deck over the arch, the far railing.
  out.push({
    d: FOOT_X + (c.y0 + c.y1) / 2 - 0.6,
    f: (ctx) => drawFootbridge(ctx, l),
  });
  return out;
}
function drawFootbridge(ctx: Ctx, l: Light) {
  const n = l.night,
    snow = l.season === "winter";
  const c = canal();
  const fx0 = FOOT_X - 0.45,
    fx1 = FOOT_X + 0.45,
    ya = c.y0 - 0.5,
    yb = c.y1 + 0.5;
  const N = 12;
  const g = (i: number) => ya + ((yb - ya) * i) / N;
  // The side facing us: from the deck's edge down to the water (or the bank).
  ctx.fillStyle = lerpRgb([186, 176, 160], [64, 64, 78], n);
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const p = up(iso(fx1, g(i)), footLift(FOOT_X, g(i)) || 0);
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  }
  for (let i = N; i >= 0; i--) {
    const gy = g(i);
    const over = gy > c.y0 && gy < c.y1;
    const p = iso(fx1, gy);
    ctx.lineTo(p.x, p.y + (over ? WATER : 0));
  }
  ctx.fill();
  onWall(ctx, "y", fx1, c.y1, () => {
    const w = (c.y1 - c.y0) * TILE;
    ctx.fillStyle = lerpRgb([40, 60, 80], [12, 16, 30], n);
    ctx.beginPath();
    ctx.ellipse(w / 2, WATER, w * 0.4, WATER + 4, 0, Math.PI, 0);
    ctx.fill();
  });
  // The deck: planks over the arch.
  for (let i = 0; i < N; i++) {
    const z0 = footLift(FOOT_X, g(i) + 1e-6),
      z1 = footLift(FOOT_X, g(i + 1) - 1e-6);
    ctx.fillStyle = snow
      ? lerpRgb([240, 244, 250], [86, 90, 110], n)
      : lerpRgb(i % 2 ? [176, 122, 76] : [160, 108, 66], [60, 46, 44], n);
    poly(ctx, [
      up(iso(fx0, g(i)), z0),
      up(iso(fx1, g(i)), z0),
      up(iso(fx1, g(i + 1)), z1),
      up(iso(fx0, g(i + 1)), z1),
    ]);
    ctx.fill();
  }
  railing(ctx, fx0, ya, yb, n, 0, N);
}
/** A wooden railing along grid x = gx over the footbridge, segments i0..i1 of N. */
function railing(
  ctx: Ctx,
  gx: number,
  ya: number,
  yb: number,
  n: number,
  i0: number,
  i1: number,
  N = 12,
) {
  const col = lerpRgb([120, 78, 46], [44, 34, 34], n);
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = i0; i <= i1; i++) {
    const gy = ya + ((yb - ya) * i) / N;
    const p = up(iso(gx, gy), footLift(FOOT_X, gy) + 15);
    if (i === i0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  for (let i = i0; i <= i1; i += 2) {
    const gy = ya + ((yb - ya) * i) / N;
    const p = up(iso(gx, gy), footLift(FOOT_X, gy));
    ctx.fillRect(p.x - 1, p.y - 15, 2, 15);
  }
}
/** The footbridge's near railing, in pieces sorted with the people in front. */
export function nearRailing(l: Light): { d: number; f: (ctx: Ctx) => void }[] {
  const c = canal();
  const ya = c.y0 - 0.5,
    yb = c.y1 + 0.5,
    gx = FOOT_X + 0.45;
  const out: { d: number; f: (ctx: Ctx) => void }[] = [];
  for (let i = 0; i < 12; i += 3) {
    const mid = ya + ((yb - ya) * (i + 1.5)) / 12;
    out.push({
      d: gx + mid,
      f: (ctx) => railing(ctx, gx, ya, yb, l.night, i, i + 3),
    });
  }
  return out;
}

/* ───────────── the square ───────────── */

/** Benches around the fountain: grid spot, along which axis, and which way a sitter faces. */
export function benches(): {
  x: number;
  y: number;
  along: "x" | "y";
  face: Facing;
}[] {
  const P = plaza();
  return [
    { x: P.x - 1.45, y: P.y - 0.15, along: "y", face: "right" },
    { x: P.x - 0.15, y: P.y - 1.45, along: "x", face: "left" },
  ];
}
/** The square's flat parts: lawn, paths, the paved circle, flowerbeds (baked, under everything). */
export function drawSquareGround(ctx: Ctx, l: Light) {
  const n = l.night,
    s = l.season ?? "summer";
  const P = plaza();
  const x0 = R.cols + 2.3,
    x1 = R.cols + 10,
    y0 = -4.5,
    y1 = R.rows + 1.4;
  const lawn: Record<Season, number[]> = {
    spring: [118, 190, 92],
    summer: [100, 172, 78],
    autumn: [150, 166, 86],
    winter: [232, 238, 246],
  };
  ctx.fillStyle = lerpRgb(
    lawn[s],
    s === "winter" ? [70, 78, 104] : [30, 52, 42],
    n,
  );
  quad(ctx, x0, y0, x1, y1);
  ctx.fill();
  // Stone edging around the lawn.
  ctx.strokeStyle = lerpRgb([196, 186, 170], [70, 70, 84], n);
  ctx.lineWidth = 2;
  quad(ctx, x0, y0, x1, y1);
  ctx.stroke();
  // The path in from the sidewalk, and the paved circle.
  const pave = lerpRgb([222, 210, 190], [80, 78, 92], n);
  ctx.fillStyle = pave;
  quad(ctx, R.cols + 1.6, P.y + 1.9, R.cols + 14, P.y + 2.7);
  ctx.fill();
  const c = iso(P.x, P.y);
  const ex = 48 * Math.SQRT2,
    ey = 24 * Math.SQRT2;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, P.r * ex, P.r * ey, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = lerpRgb([196, 182, 160], [64, 62, 76], n);
  ctx.lineWidth = 1.2;
  for (const f of [0.62, 0.84, 1]) {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, P.r * ex * f, P.r * ey * f, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (s === "winter") {
    // Snow pushed to the circle's edge.
    ctx.strokeStyle = lerpRgb([246, 248, 252], [90, 96, 120], n);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, P.r * ex - 2, P.r * ey - 1, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Two flowerbeds by the path: the season's flowers.
  const bloom: Record<Season, string[]> = {
    spring: ["#ff8fb1", "#ffd65b", "#ffffff", "#b49cff"],
    summer: ["#e2453a", "#ff9a5b", "#ffd65b", "#ff7aa8"],
    autumn: ["#e8862e", "#c8442c", "#f2c14e", "#a0522d"],
    winter: [],
  };
  for (const [bx, by] of [
    [P.x - 1.6, P.y + 3.3],
    [P.x + 2.2, P.y + 3.3],
  ]) {
    const b = iso(bx, by);
    ctx.fillStyle = lerpRgb(
      s === "winter" ? [236, 240, 248] : [120, 82, 56],
      s === "winter" ? [76, 84, 112] : [44, 36, 40],
      n,
    );
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, 44, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 26 && bloom[s].length; i++) {
      const a = hash(i + bx * 7) * Math.PI * 2,
        r = Math.sqrt(hash(i + 50 + by)) * 0.85;
      const x = b.x + Math.cos(a) * 40 * r,
        y = b.y + Math.sin(a) * 13 * r;
      ctx.fillStyle = shade("#3f8a45", -0.5 * n);
      ctx.fillRect(x - 0.6, y - 5, 1.2, 5);
      ctx.fillStyle = shade(bloom[s][i % bloom[s].length], -0.5 * n);
      ctx.beginPath();
      ctx.arc(x, y - 6, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
/** The square's standing things (baked): the fountain, benches, lamps. */
export function squareParts(l: Light): { d: number; f: (ctx: Ctx) => void }[] {
  const P = plaza();
  const out: { d: number; f: (ctx: Ctx) => void }[] = [
    { d: P.x + P.y, f: (ctx) => drawFountain(ctx, l) },
  ];
  for (const b of benches())
    out.push({
      d: b.x + b.y,
      f: (ctx) => drawBench(ctx, b.x, b.y, b.along, l),
    });
  for (const [x, y] of squareLamps())
    out.push({ d: x + y, f: (ctx) => drawParkLamp(ctx, x, y, l) });
  return out;
}
export const squareLamps = (): [number, number][] => {
  const P = plaza();
  return [
    [P.x - 2.3, P.y + 1.2],
    [P.x + 1.3, P.y - 2.3],
  ];
};
function drawBench(
  ctx: Ctx,
  bx: number,
  by: number,
  along: "x" | "y",
  l: Light,
) {
  const n = l.night,
    snow = l.season === "winter";
  const wood = {
    top: shade(snow ? "#eef2f7" : "#b0703f", -0.5 * n),
    left: shade("#8a5530", -0.5 * n),
    right: shade("#7a4a28", -0.5 * n),
  };
  const c = iso(bx, by);
  softShadow(ctx, c.x, c.y + 2, 30, 12, 0.22);
  if (along === "y") {
    isoBox(ctx, bx - 0.18, by - 0.55, bx + 0.18, by + 0.55, 12, 4, wood);
    isoBox(ctx, bx - 0.26, by - 0.55, bx - 0.18, by + 0.55, 16, 16, wood);
  } else {
    isoBox(ctx, bx - 0.55, by - 0.18, bx + 0.55, by + 0.18, 12, 4, wood);
    isoBox(ctx, bx - 0.55, by - 0.26, bx + 0.55, by - 0.18, 16, 16, wood);
  }
  // Iron legs.
  ctx.fillStyle = shade("#2d3340", -0.3 * n);
  for (const [dx, dy] of along === "y"
    ? [
        [0, -0.45],
        [0, 0.45],
      ]
    : [
        [-0.45, 0],
        [0.45, 0],
      ]) {
    const p = iso(bx + dx, by + dy);
    ctx.fillRect(p.x - 1.5, p.y - 12, 3, 12);
  }
}
function drawParkLamp(ctx: Ctx, x: number, y: number, l: Light) {
  const c = iso(x, y);
  const on = l.night;
  softShadow(ctx, c.x, c.y + 2, 10, 4, 0.3);
  ctx.fillStyle = "#2d3340";
  ctx.fillRect(c.x - 1.6, c.y - 70, 3.2, 70);
  ctx.fillRect(c.x - 4, c.y - 5, 8, 5);
  ctx.fillStyle =
    on > 0.2
      ? `rgba(255,${(222 + on * 20) | 0},${(160 + on * 40) | 0},1)`
      : "#e6e9ee";
  ctx.beginPath();
  ctx.arc(c.x, c.y - 76, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2d3340";
  ctx.fillRect(c.x - 6, c.y - 85, 12, 3);
}
function drawFountain(ctx: Ctx, l: Light) {
  const n = l.night,
    frozen = l.season === "winter";
  const P = plaza();
  const c = iso(P.x, P.y);
  const rx = 64,
    ry = 32,
    H = 12;
  softShadow(ctx, c.x, c.y + 4, rx + 10, ry + 6, 0.2);
  const stone = lerpRgb([214, 206, 192], [74, 74, 90], n),
    stoneDark = lerpRgb([168, 160, 146], [52, 52, 66], n);
  // The basin's wall (its near half shows).
  ctx.fillStyle = stoneDark;
  ctx.beginPath();
  ctx.moveTo(c.x - rx, c.y - H);
  ctx.lineTo(c.x - rx, c.y);
  ctx.ellipse(c.x, c.y, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(c.x + rx, c.y - H);
  ctx.ellipse(c.x, c.y - H, rx, ry, 0, 0, Math.PI, false);
  ctx.fill();
  ctx.fillStyle = stone;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - H, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  // The water (or ice) in the basin.
  ctx.fillStyle = frozen
    ? lerpRgb([220, 236, 246], [80, 96, 124], n)
    : lerpRgb([110, 182, 220], [30, 52, 90], n);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - H, rx - 7, ry - 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = frozen ? "rgba(255,255,255,.4)" : "rgba(255,255,255,.18)";
  ctx.beginPath();
  ctx.ellipse(c.x - 14, c.y - H - 8, 22, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // The column, the upper bowl and its finial.
  ctx.fillStyle = stoneDark;
  ctx.fillRect(c.x - 5, c.y - H - 30, 10, 30);
  ctx.fillStyle = stone;
  ctx.fillRect(c.x - 2, c.y - H - 30, 4, 30);
  ctx.fillStyle = stoneDark;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - H - 32, 24, 10, 0, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = stone;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - H - 34, 24, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = frozen
    ? lerpRgb([226, 240, 248], [86, 100, 128], n)
    : lerpRgb([120, 190, 228], [34, 58, 96], n);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - H - 34, 19, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = stone;
  ctx.fillRect(c.x - 2.5, c.y - H - 48, 5, 14);
  ctx.beginPath();
  ctx.arc(c.x, c.y - H - 50, 4.5, 0, Math.PI * 2);
  ctx.fill();
  if (frozen) {
    // Icicles from the upper bowl.
    ctx.fillStyle = lerpRgb([236, 246, 252], [100, 116, 140], n);
    for (let i = -3; i <= 3; i++) {
      const x = c.x + i * 6;
      ctx.beginPath();
      ctx.moveTo(x - 2, c.y - H - 31);
      ctx.lineTo(x, c.y - H - 22 + Math.abs(i));
      ctx.lineTo(x + 2, c.y - H - 31);
      ctx.fill();
    }
  }
}
/** The fountain's running water (live): jets, the falling sheet, ripples. */
export function drawFountainWater(ctx: Ctx, l: Light, low: boolean) {
  if (l.season === "winter") return;
  const P = plaza();
  const c = iso(P.x, P.y);
  const t = l.t;
  const a = 0.75 - l.night * 0.3;
  ctx.strokeStyle = `rgba(220,240,255,${a})`;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  // Four little jets from the finial into the bowl.
  for (let i = 0; i < 4; i++) {
    const dir = i < 2 ? -1 : 1,
      far = i % 2 ? 16 : 10;
    ctx.moveTo(c.x, c.y - 66);
    ctx.quadraticCurveTo(
      c.x + dir * far * 0.6,
      c.y - 82,
      c.x + dir * far,
      c.y - 47,
    );
  }
  // The sheet falling from the bowl's rim into the basin.
  for (let i = -4; i <= 4; i++) {
    const x = c.x + i * 5.2;
    const wob = Math.sin(t * 6 + i) * 0.8;
    ctx.moveTo(x, c.y - 44 + Math.abs(i) * 0.6);
    ctx.lineTo(x * 1 + i * 1.6 + wob, c.y - 18);
  }
  ctx.stroke();
  if (low) return;
  // Rings spreading where the water lands.
  for (let k = 0; k < 2; k++) {
    const f = (t * 0.5 + k * 0.5) % 1;
    ctx.strokeStyle = `rgba(255,255,255,${0.35 * (1 - f)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - 14, 18 + f * 32, 6 + f * 13, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/* ───────────── the bus stop ───────────── */

export function drawBusStop(ctx: Ctx, l: Light) {
  const n = l.night,
    snow = l.season === "winter";
  const sy = stopY();
  const x0 = -3.18,
    x1 = -3.02,
    y0 = sy - 0.75,
    y1 = sy + 0.75,
    H = 52;
  const metal = shade("#3a4458", -0.35 * n);
  const c = iso((x0 + x1) / 2, sy);
  softShadow(ctx, c.x, c.y + 3, 50, 18, 0.18);
  // Posts.
  for (const y of [y0, y1]) {
    const p = iso(x1, y);
    ctx.fillStyle = metal;
    ctx.fillRect(p.x - 1.5, p.y - H, 3, H);
  }
  // The back panel (glass with a poster for the bistro), toward the sidewalk.
  onWall(ctx, "y", x1, y1, () => {
    const w = (y1 - y0) * TILE;
    ctx.fillStyle = n > 0.4 ? "rgba(120,140,180,.35)" : "rgba(190,225,240,.45)";
    ctx.fillRect(2, -H + 4, w - 4, H - 12);
    ctx.strokeStyle = metal;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(2, -H + 4, w - 4, H - 12);
    // The poster: lit from inside at night.
    const px = w / 2 - 14;
    ctx.fillStyle = n > 0.35 ? "#fff1cf" : "#f6e3c0";
    ctx.fillRect(px, -H + 8, 28, 34);
    ctx.fillStyle = "#c2322e";
    ctx.fillRect(px, -H + 8, 28, 7);
    ctx.fillStyle = "#3b1f2a";
    ctx.font = "800 5.5px 'Barlow Condensed', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ELEMENT", px + 14, -H + 22);
    ctx.fillText("BISTRO", px + 14, -H + 28);
    ctx.fillStyle = "#f2c14e";
    ctx.beginPath();
    ctx.arc(px + 14, -H + 34, 5, 0, Math.PI);
    ctx.fill();
  });
  // The roof.
  isoBox(ctx, x0 - 0.18, y0 - 0.1, x1 + 0.12, y1 + 0.1, H, 4, {
    top: snow ? shade("#f4f7fb", -0.5 * n) : shade("#5a6478", -0.4 * n),
    left: metal,
    right: shade("#4a5468", -0.35 * n),
  });
  // The stop's sign on its pole.
  const p = iso(x1, y0 - 0.3);
  ctx.fillStyle = metal;
  ctx.fillRect(p.x - 1.5, p.y - 72, 3, 72);
  ctx.fillStyle = shade("#2a9d8f", -0.35 * n);
  ctx.beginPath();
  ctx.arc(p.x, p.y - 76, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 7px 'Barlow Condensed', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("BUS", p.x, p.y - 73.5);
}
export function busStopGlow(): Glow {
  const p = iso(-3.0, stopY());
  return [p.x, p.y - 28, 44, "255,236,190", 0.3];
}

/* ───────────── what moves: people, the bus, birds ───────────── */

/** Paints a creature of the game standing at world (x, y), raised by `lift`. */
export type PaintCreature = (
  char: string,
  face: Facing,
  x: number,
  y: number,
  lift: number,
  alpha: number,
) => void;

export type FolkKind = "walk" | "dog" | "bike" | "sit" | "wait";
export interface Folk {
  char: string;
  kind: FolkKind;
  pts: Pt[];
  i: number;
  x: number;
  y: number;
  /** Tiles a second. */
  speed: number;
  walk: number;
  face: Facing;
  /** Fades in when it appears and out when it goes (sitters, waiters). */
  fade: number;
  /** Seconds left to stay (sitters), or until the bus comes (waiters). */
  stay: number;
  leaving: boolean;
  dog: string;
  seat: number;
}
export interface Bus {
  /** Grid y along the near lane (it drives toward -y). */
  y: number;
  speed: number;
  state: "drive" | "stop" | "away";
  /** Seconds left at the stop, or until the next bus. */
  t: number;
  /** Tests: keep it at the stop. */
  hold?: boolean;
}
export const BUS_LEN = 2.3;
export interface Pigeon {
  x: number;
  y: number;
  /** Where it's walking or flying to, from where. */
  tx: number;
  ty: number;
  fx: number;
  fy: number;
  state: "peck" | "walk" | "fly";
  t: number;
  dur: number;
  sx: number;
}
export interface Duck {
  x: number;
  y: number;
  dir: number;
  ph: number;
}
export interface Street {
  low: boolean;
  pool: string[];
  folk: Folk[];
  bus: Bus;
  pigeons: Pigeon[];
  ducks: Duck[];
  /** Seconds until the next walker may set off. */
  next: number;
  rnd: () => number;
}
/** How many of each on High and on Low graphics. */
export const CROWD = {
  high: { walkers: 7, bikes: 1, sitters: 2, pigeons: 7, ducks: 2 },
  low: { walkers: 3, bikes: 0, sitters: 1, pigeons: 3, ducks: 1 },
} as const;

/** The paths people walk (grid points), with how often each is chosen. */
export function routes(): { w: number; pts: [number, number][] }[] {
  const P = plaza();
  const nx = -2.05,
    nx2 = -2.6,
    fy = R.rows + 0.85,
    fy2 = R.rows + 1.25,
    rx = R.cols + 0.85,
    rx2 = R.cols + 1.2;
  return [
    // Around the block: down the street, along the front, up the side.
    {
      w: 3,
      pts: [
        [nx, -9],
        [nx, fy],
        [rx, fy],
        [rx, -12],
      ],
    },
    // Down the street, past the bus stop, over the bridge.
    {
      w: 2,
      pts: [
        [nx2, -9],
        [nx2, 34],
      ],
    },
    // Past the shops across the road.
    {
      w: 2.5,
      pts: [
        [-6.15, -6],
        [-6.15, 34],
      ],
    },
    // Down the side and over the footbridge.
    {
      w: 1.5,
      pts: [
        [rx2, -12],
        [rx2, fy2],
        [FOOT_X, fy2],
        [FOOT_X, R.rows + 15],
      ],
    },
    // Through the square, in front of the fountain.
    {
      w: 1.5,
      pts: [
        [rx2, -12],
        [rx2, P.y + 2.3],
        [P.x + 10, P.y + 2.3],
      ],
    },
  ];
}
const bikeRoutes = (): [number, number][][] => [
  [
    [ROAD1 - 0.22, 32],
    [ROAD1 - 0.22, -12],
  ],
  [
    [ROAD0 + 0.22, -12],
    [ROAD0 + 0.22, 32],
  ],
];
const DOGS = ["#c98a4a", "#f4efe6", "#3a302c", "#e0b070"];
/** Which way a creature shows walking by (dx, dy): as the bistro's guests. */
export function faceFor(dx: number, dy: number): Facing {
  if (dx < -0.01 || dy < -0.01) return "up";
  return dx > 0 ? "right" : dy > 0 ? "left" : "down";
}
function mkFolk(s: Street, kind: FolkKind, pts: Pt[], at = 0): Folk {
  const f: Folk = {
    char: s.pool[Math.floor(s.rnd() * s.pool.length)] ?? "voltkit",
    kind,
    pts,
    i: 1,
    x: pts[0].x,
    y: pts[0].y,
    speed:
      kind === "bike"
        ? 2 + s.rnd() * 0.6
        : kind === "dog"
          ? 0.85 + s.rnd() * 0.15
          : 0.8 + s.rnd() * 0.35,
    walk: s.rnd() * 10,
    face: "down",
    fade: kind === "sit" || kind === "wait" ? 0 : 1,
    stay: 0,
    leaving: false,
    dog: DOGS[Math.floor(s.rnd() * DOGS.length)],
    seat: -1,
  };
  // Start part way along (the street is already busy when the bistro opens).
  if (at > 0) advance(f, pathLength(pts) * at);
  return f;
}
const pathLength = (pts: Pt[]) => {
  let d = 0;
  for (let i = 1; i < pts.length; i++)
    d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return d;
};
/** Walk `left` tiles along the path; false once at its end. */
function advance(f: Folk, left: number): boolean {
  while (left > 0 && f.i < f.pts.length) {
    const p = f.pts[f.i];
    const dx = p.x - f.x,
      dy = p.y - f.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-4) {
      f.i++;
      continue;
    }
    f.face = faceFor(dx, dy);
    if (d <= left) {
      f.x = p.x;
      f.y = p.y;
      f.i++;
      left -= d;
    } else {
      f.x += (dx / d) * left;
      f.y += (dy / d) * left;
      left = 0;
    }
  }
  return f.i < f.pts.length;
}
function pickRoute(s: Street): Pt[] {
  const rs = routes();
  let r = s.rnd() * rs.reduce((a, b) => a + b.w, 0);
  let pick = rs[0];
  for (const it of rs) {
    r -= it.w;
    if (r <= 0) {
      pick = it;
      break;
    }
  }
  const pts = pick.pts.map(([x, y]) => ({ x, y }));
  return s.rnd() < 0.5 ? pts.reverse() : pts;
}
function spawnWalker(s: Street, at = 0) {
  s.folk.push(mkFolk(s, s.rnd() < 0.25 ? "dog" : "walk", pickRoute(s), at));
}
function spawnBike(s: Street, at = 0) {
  const r = bikeRoutes()[s.rnd() < 0.5 ? 0 : 1].map(([x, y]) => ({ x, y }));
  s.folk.push(mkFolk(s, "bike", r, at));
}
function spawnSitter(s: Street) {
  const taken = new Set(
    s.folk.filter((f) => f.kind === "sit").map((f) => f.seat),
  );
  const free = benches()
    .map((_, i) => i)
    .filter((i) => !taken.has(i));
  if (!free.length) return;
  const seat = free[Math.floor(s.rnd() * free.length)];
  const b = benches()[seat];
  const f = mkFolk(s, "sit", [{ x: b.x, y: b.y }]);
  f.seat = seat;
  f.face = b.face;
  f.stay = 25 + s.rnd() * 35;
  s.folk.push(f);
}
function spawnWaiter(s: Street) {
  const f = mkFolk(s, "wait", [{ x: -2.55, y: stopY() + 0.25 }]);
  f.face = "left";
  f.stay = 1e9;
  s.folk.push(f);
}
const pigeonSpot = (s: Street): Pt => {
  const P = plaza();
  for (;;) {
    const u = -1.4 + s.rnd() * 3.2,
      v = -1.4 + s.rnd() * 3.2;
    // In front of the basin, on the paving.
    if (u + v > 0.9 && Math.hypot(u, v) > 1.25 && Math.hypot(u, v) < P.r)
      return { x: P.x + u, y: P.y + v };
  }
};
function mkPigeon(s: Street): Pigeon {
  const p = pigeonSpot(s);
  return {
    x: p.x,
    y: p.y,
    tx: p.x,
    ty: p.y,
    fx: p.x,
    fy: p.y,
    state: "peck",
    t: s.rnd() * 2,
    dur: 1,
    sx: s.rnd() < 0.5 ? -1 : 1,
  };
}
/** The street as the bistro opens: people already about, a bus at the stop. */
export function makeStreet(
  pool: string[],
  low: boolean,
  rnd: () => number = Math.random,
): Street {
  const n = low ? CROWD.low : CROWD.high;
  const s: Street = {
    low,
    pool: pool.length ? pool : ["voltkit"],
    folk: [],
    bus: { y: stopY(), speed: 0, state: "stop", t: 5 },
    pigeons: [],
    ducks: [],
    next: 2,
    rnd,
  };
  for (let i = 0; i < n.walkers; i++) spawnWalker(s, 0.1 + rnd() * 0.8);
  for (let i = 0; i < n.bikes; i++) spawnBike(s, rnd());
  for (let i = 0; i < n.sitters; i++) spawnSitter(s);
  for (const f of s.folk) if (f.kind === "sit") f.fade = 1;
  for (let i = 0; i < n.pigeons; i++) s.pigeons.push(mkPigeon(s));
  const c = canal();
  for (let i = 0; i < n.ducks; i++)
    s.ducks.push({
      x: FOOT_X + 1.5 + rnd() * 6,
      y: (c.y0 + c.y1) / 2 + (rnd() - 0.5) * 0.5,
      dir: rnd() < 0.5 ? -1 : 1,
      ph: rnd() * 6,
    });
  return s;
}

/** Move everyone along by dt seconds. */
export function updateStreet(s: Street, dt: number) {
  const n = s.low ? CROWD.low : CROWD.high;
  // The bus: in, stops (someone gets on, someone gets off), and away.
  const b = s.bus;
  const sy = stopY();
  if (b.hold) {
    b.y = sy;
    b.state = "stop";
    b.speed = 0;
  } else if (b.state === "away") {
    b.t -= dt;
    if (b.t <= 0) Object.assign(b, { state: "drive", y: 34, speed: 2.6 });
  } else if (b.state === "stop") {
    b.t -= dt;
    if (b.t <= 0) b.state = "drive";
  } else {
    const before = b.y > sy + 0.01;
    if (before) {
      // Slow down for the stop.
      const want = Math.min(2.6, Math.sqrt(2 * 1.3 * (b.y - sy)) + 0.08);
      b.speed = Math.min(want, b.speed + 1.3 * dt);
    } else b.speed = Math.min(2.6, b.speed + 1.1 * dt);
    b.y -= b.speed * dt;
    if (before && b.y <= sy + 0.01) {
      b.y = sy;
      b.speed = 0;
      b.state = "stop";
      b.t = 5;
      // Whoever waited gets on; someone gets off and walks away.
      for (const f of s.folk) if (f.kind === "wait") f.leaving = true;
      if (s.rnd() < 0.7) {
        const f = mkFolk(s, "walk", [
          { x: -2.9, y: sy },
          { x: -2.6, y: sy + 0.2 },
          ...(s.rnd() < 0.5
            ? [{ x: -2.6, y: 34 }]
            : [
                { x: -2.05, y: R.rows + 0.85 },
                { x: R.cols + 0.85, y: R.rows + 0.85 },
                { x: R.cols + 0.85, y: -12 },
              ]),
        ]);
        f.fade = 0;
        s.folk.push(f);
      }
    }
    if (b.y < -30) {
      b.state = "away";
      b.t = 28 + s.rnd() * 20;
    }
  }
  // People.
  for (const f of s.folk) {
    if (f.kind === "sit" || f.kind === "wait") {
      f.stay -= dt;
      if (f.stay <= 0) f.leaving = true;
      f.fade = Math.max(0, Math.min(1, f.fade + (f.leaving ? -dt : dt) * 1.5));
      continue;
    }
    f.fade = Math.min(1, f.fade + dt * 2);
    f.walk += dt;
    if (!advance(f, f.speed * dt)) f.leaving = true;
  }
  s.folk = s.folk.filter(
    (f) =>
      !(
        f.leaving &&
        (f.kind === "sit" || f.kind === "wait" ? f.fade <= 0 : true)
      ),
  );
  const count = (k: FolkKind[]) =>
    s.folk.filter((f) => k.includes(f.kind)).length;
  s.next -= dt;
  if (s.next <= 0 && count(["walk", "dog"]) < n.walkers) {
    spawnWalker(s);
    s.next = 1.5 + s.rnd() * 3;
  }
  if (count(["bike"]) < n.bikes && s.rnd() < dt * 0.08) spawnBike(s);
  if (count(["sit"]) < n.sitters && s.rnd() < dt * 0.05) spawnSitter(s);
  if (!count(["wait"]) && b.state !== "stop" && s.rnd() < dt * 0.1)
    spawnWaiter(s);
  // Pigeons peck, strut and flutter off when someone comes close.
  for (const p of s.pigeons) {
    p.t -= dt;
    if (p.state === "fly" || p.state === "walk") {
      const u = clamp01(1 - p.t / p.dur);
      p.x = p.fx + (p.tx - p.fx) * u;
      p.y = p.fy + (p.ty - p.fy) * u;
    }
    const near = s.folk.some(
      (f) => f.kind !== "sit" && Math.hypot(f.x - p.x, f.y - p.y) < 0.7,
    );
    if (near && p.state !== "fly") {
      fly(s, p);
      continue;
    }
    if (p.t > 0) continue;
    const r = s.rnd();
    if (r < 0.55) {
      p.state = "peck";
      p.t = 0.8 + s.rnd() * 1.6;
    } else if (r < 0.95) {
      const P = plaza();
      const tx = p.x + (s.rnd() - 0.5) * 0.8,
        ty = p.y + (s.rnd() - 0.5) * 0.8;
      const u = tx - P.x,
        v = ty - P.y;
      if (u + v > 0.9 && Math.hypot(u, v) > 1.25 && Math.hypot(u, v) < P.r) {
        Object.assign(p, { state: "walk", fx: p.x, fy: p.y, tx, ty });
        p.dur = p.t = Math.hypot(tx - p.x, ty - p.y) / 0.3;
        p.sx = iso(tx, ty).x > iso(p.x, p.y).x ? 1 : -1;
      } else p.t = 0.5;
    } else fly(s, p);
  }
  for (const d of s.ducks) {
    d.ph += dt;
    d.x += d.dir * 0.16 * dt;
    if (d.x > R.cols + 8 || d.x < FOOT_X + 1) d.dir *= -1;
  }
}
function fly(s: Street, p: Pigeon) {
  const to = pigeonSpot(s);
  Object.assign(p, { state: "fly", fx: p.x, fy: p.y, tx: to.x, ty: to.y });
  p.dur = p.t = 1.1 + s.rnd() * 0.5;
  p.sx = iso(to.x, to.y).x > iso(p.x, p.y).x ? 1 : -1;
}

/** 0 near the horizon (behind the bistro's wall), 1 well below it. */
export const groundFade = (gx: number, gy: number) =>
  clamp01((iso(gx, gy).y - (HORIZON + 50)) / 60);

function drawDog(
  ctx: Ctx,
  x: number,
  y: number,
  sx: number,
  t: number,
  col: string,
  n: number,
) {
  const c = shade(col, -0.45 * n),
    dark = shade(col, -0.35 - 0.3 * n);
  softShadow(ctx, x, y + 1, 11, 4, 0.25);
  const step = Math.sin(t * 14);
  ctx.fillStyle = dark;
  for (const [lx, ph] of [
    [-5, 1],
    [4, -1],
  ])
    ctx.fillRect(x + lx * sx - 1, y - 6, 2.4, 6 + step * ph * 1.2);
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(x, y - 9, 8, 4.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head, ear, nose, a wagging tail.
  ctx.beginPath();
  ctx.arc(x + 8 * sx, y - 14, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(x + 6.5 * sx, y - 15, 1.8, 3.2, 0.3 * sx, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1c1d22";
  ctx.fillRect(x + 11.5 * sx - 1, y - 14.5, 2, 2);
  ctx.strokeStyle = c;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 7 * sx, y - 10);
  ctx.lineTo(x - 11 * sx, y - 15 + Math.sin(t * 18) * 2);
  ctx.stroke();
}
function drawBike(
  ctx: Ctx,
  x: number,
  y: number,
  dir: number,
  t: number,
  n: number,
) {
  // Along grid y: the wheels sit a third of a tile apart on screen.
  const ax = -dir * 9,
    ay = dir * 4.5;
  const metal = shade("#d94a3a", -0.45 * n);
  softShadow(ctx, x, y + 2, 20, 6, 0.25);
  ctx.strokeStyle = "#1c1d22";
  ctx.lineWidth = 1.6;
  const spin = t * 12;
  for (const k of [-1, 1]) {
    const wx = x + ax * k,
      wy = y + ay * k - 6;
    ctx.beginPath();
    ctx.ellipse(wx, wy, 4.4, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(wx + Math.cos(spin) * 4, wy + Math.sin(spin) * 5.4);
    ctx.lineTo(wx - Math.cos(spin) * 4, wy - Math.sin(spin) * 5.4);
    ctx.stroke();
  }
  ctx.strokeStyle = metal;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - ax, y - ay - 6);
  ctx.lineTo(x, y - 14);
  ctx.lineTo(x + ax, y + ay - 6);
  ctx.moveTo(x, y - 14);
  ctx.lineTo(x + ax * 0.8, y + ay * 0.8 - 18);
  ctx.stroke();
}
function drawPigeon(ctx: Ctx, p: Pigeon, l: Light) {
  const n = l.night;
  const c = iso(p.x, p.y);
  const flying = p.state === "fly";
  const hop = flying ? Math.sin(clamp01(1 - p.t / p.dur) * Math.PI) * 34 : 0;
  ctx.fillStyle = "rgba(40,30,30,.18)";
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + 1, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  const x = c.x,
    y = c.y - hop;
  const peck =
    p.state === "peck" ? Math.max(0, Math.sin(l.t * 9 + p.fx * 5)) : 0;
  ctx.fillStyle = shade("#8d93a3", -0.45 * n);
  ctx.beginPath();
  ctx.ellipse(x, y - 5, 5.5, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  if (flying) {
    const flap = Math.sin(l.t * 30) * 5;
    ctx.fillStyle = shade("#6c7282", -0.45 * n);
    ctx.beginPath();
    ctx.moveTo(x - 2, y - 6);
    ctx.lineTo(x - 9, y - 9 - flap);
    ctx.lineTo(x + 1, y - 5);
    ctx.moveTo(x + 2, y - 6);
    ctx.lineTo(x + 9, y - 9 - flap);
    ctx.lineTo(x - 1, y - 5);
    ctx.fill();
  }
  // Head (down while pecking), its green neck, the beak.
  const hx = x + p.sx * 4.5,
    hy = y - 9 + peck * 4;
  ctx.fillStyle = shade("#5f8a7a", -0.45 * n);
  ctx.beginPath();
  ctx.arc(hx - p.sx * 0.8, hy + 2, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade("#7a8090", -0.45 * n);
  ctx.beginPath();
  ctx.arc(hx, hy, 2.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e0a040";
  ctx.fillRect(hx + p.sx * 2 - (p.sx < 0 ? 2 : 0), hy - 0.5, 2, 1.2);
}
function drawDuck(ctx: Ctx, d: Duck, l: Light) {
  const n = l.night;
  const c = iso(d.x, d.y);
  const x = c.x,
    y = c.y + WATER + Math.sin(d.ph * 2) * 0.8;
  const sx = d.dir > 0 ? 1 : -1;
  ctx.strokeStyle = `rgba(255,255,255,${0.35 - n * 0.2})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - sx * 6, y);
  ctx.lineTo(x - sx * 16, y - 3);
  ctx.moveTo(x - sx * 6, y + 1);
  ctx.lineTo(x - sx * 16, y + 4);
  ctx.stroke();
  ctx.fillStyle = shade("#9a7a5a", -0.45 * n);
  ctx.beginPath();
  ctx.ellipse(x, y - 3, 7, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade("#2f7a4a", -0.45 * n);
  ctx.beginPath();
  ctx.arc(x + sx * 5, y - 8, 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f2c14e";
  ctx.fillRect(x + sx * 7.5 - (sx < 0 ? 3 : 0), y - 8, 3, 1.6);
}

/** One drawable person (and their dog or bike), with where they stand for sorting. */
function folkDrawable(
  ctx: Ctx,
  f: Folk,
  l: Light,
  paint: PaintCreature,
): { d: number; f: () => void } | null {
  const fade = groundFade(f.x, f.y) * f.fade;
  if (fade <= 0.01) return null;
  const n = l.night;
  return {
    d: f.x + f.y,
    f: () => {
      const c = iso(f.x, f.y);
      const lift = footLift(f.x, f.y);
      const moving = f.kind !== "sit" && f.kind !== "wait";
      const bob =
        moving && f.kind !== "bike" ? Math.abs(Math.sin(f.walk * 9)) * 4 : 0;
      ctx.save();
      // Never up into the sky past the horizon.
      ctx.beginPath();
      ctx.rect(-FAR, HORIZON, FAR * 2, FAR);
      ctx.clip();
      ctx.globalAlpha = fade;
      if (f.kind === "bike") {
        const dir = f.pts[f.pts.length - 1].y > f.pts[0].y ? 1 : -1;
        drawBike(ctx, c.x, c.y, dir, f.walk, n);
        paint(f.char, f.face, c.x, c.y, 12, fade);
      } else {
        if (f.kind !== "sit") softShadow(ctx, c.x, c.y + 2 - lift, 18, 7, 0.26);
        const sit = f.kind === "sit" ? 14 : 0;
        if (f.kind === "dog") {
          // The dog trots a little ahead on its lead.
          const p = f.pts[Math.min(f.i, f.pts.length - 1)];
          const dx = p.x - f.x,
            dy = p.y - f.y;
          const d = Math.hypot(dx, dy) || 1;
          const gx = f.x + (dx / d) * 0.55,
            gy = f.y + (dy / d) * 0.55;
          const q = iso(gx, gy);
          const sx = q.x >= c.x ? 1 : -1;
          const behind = q.y < c.y;
          const dogAt = () =>
            drawDog(ctx, q.x, q.y - footLift(gx, gy), sx, f.walk, f.dog, n);
          if (behind) dogAt();
          paint(f.char, f.face, c.x, c.y, lift + bob, fade);
          ctx.strokeStyle = `rgba(60,40,30,${0.8 * fade})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(c.x + sx * 8, c.y - lift - 26);
          ctx.quadraticCurveTo(
            (c.x + q.x) / 2,
            (c.y + q.y) / 2 - lift - 6,
            q.x + sx * 6,
            q.y - footLift(gx, gy) - 13,
          );
          ctx.stroke();
          if (!behind) dogAt();
        } else paint(f.char, f.face, c.x, c.y, lift + bob + sit, fade);
      }
      ctx.restore();
    },
  };
}
/** The moving street behind the room (or beside it): people, birds, ducks. */
export function townBehind(
  ctx: Ctx,
  s: Street,
  l: Light,
  paint: PaintCreature,
): { d: number; f: () => void }[] {
  const out: { d: number; f: () => void }[] = [];
  for (const f of s.folk)
    if (!inFront(f.x, f.y)) {
      const it = folkDrawable(ctx, f, l, paint);
      if (it) out.push(it);
    }
  if (l.night < 0.6)
    for (const p of s.pigeons)
      out.push({ d: p.x + p.y, f: () => drawPigeon(ctx, p, l) });
  if (l.season !== "winter")
    for (const d of s.ducks)
      out.push({ d: d.x + d.y - 1, f: () => drawDuck(ctx, d, l) });
  return out;
}
/** People in front of the room's base: sorted with the front trees and lamps. */
export function townFront(
  ctx: Ctx,
  s: Street,
  l: Light,
  paint: PaintCreature,
): { d: number; f: () => void }[] {
  const out: { d: number; f: () => void }[] = [];
  for (const f of s.folk)
    if (inFront(f.x, f.y)) {
      const it = folkDrawable(ctx, f, l, paint);
      if (it) out.push(it);
    }
  for (const r of nearRailing(l)) out.push({ d: r.d, f: () => r.f(ctx) });
  return out;
}

/** The bus: a long box in the near lane, windows lit at night, doors open at the stop. */
export function drawBus(ctx: Ctx, b: Bus, l: Light) {
  if (b.state === "away") return;
  const fade = groundFade(laneOf(-1), b.y - BUS_LEN / 2);
  if (fade <= 0) return;
  const n = l.night;
  const lane = laneOf(-1),
    w = 0.38,
    y0 = b.y - BUS_LEN / 2,
    y1 = b.y + BUS_LEN / 2,
    H = 40;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-FAR, HORIZON, FAR * 2, FAR);
  ctx.clip();
  ctx.globalAlpha = fade;
  const c = iso(lane, b.y);
  softShadow(ctx, c.x, c.y + 4, 80, 30, 0.35);
  const body = shade("#2a9d8f", -0.45 * n);
  ctx.fillStyle = "#1c1d22";
  for (const f of [y0 + 0.4, y1 - 0.45]) {
    const p = iso(lane + w, f);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 4, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  isoBox(ctx, lane - w, y0, lane + w, y1, 4, H, {
    top: shade(body, 0.25),
    left: shade(body, -0.15),
    right: body,
  });
  const lit = n > 0.35;
  const glass = lit ? "rgb(255,226,160)" : shade("#a9d4ea", -0.4 * n);
  onWall(ctx, "y", lane + w, y1, () => {
    const L = BUS_LEN * TILE;
    // A cream stripe and a row of windows; the door near the front.
    ctx.fillStyle = shade("#f4e9cf", -0.45 * n);
    ctx.fillRect(0, -18, L, 4);
    ctx.fillStyle = glass;
    for (let x = 6; x < L - 34; x += 17) ctx.fillRect(x, -38, 13, 15);
    ctx.fillStyle = b.state === "stop" ? "#1c2230" : glass;
    ctx.fillRect(L - 28, -38, 12, 32);
    ctx.fillStyle = glass;
    ctx.fillRect(L - 12, -38, 9, 18);
  });
  onWall(ctx, "x", y1, lane - w, () => {
    // The back: a window, the route number, tail lights.
    const L = 2 * w * TILE;
    ctx.fillStyle = glass;
    ctx.fillRect(4, -38, L - 8, 13);
    ctx.fillStyle = "#ffd65b";
    ctx.font = "800 8px 'Barlow Condensed', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("12", L / 2, -16);
    ctx.fillStyle = n > 0.3 ? "#ff4a3a" : "#c2322e";
    ctx.fillRect(3, -14, 5, 4);
    ctx.fillRect(L - 8, -14, 5, 4);
  });
  ctx.restore();
}
export function busGlows(b: Bus): Glow[] {
  if (b.state === "away") return [];
  const fade = groundFade(laneOf(-1), b.y - BUS_LEN / 2);
  if (fade <= 0) return [];
  const p = iso(laneOf(-1), b.y - BUS_LEN / 2 - 0.9);
  const q = iso(laneOf(-1), b.y);
  return [
    [p.x, p.y - 6, 64, "255,240,200", 0.35 * fade],
    [q.x, q.y - 26, 70, "255,220,150", 0.22 * fade],
  ];
}

/* ───────────── the season's weather (live) ───────────── */

/** Snow falling, autumn leaves drifting, butterflies over the summer flowerbeds. */
export function drawWeather(ctx: Ctx, l: Light, low: boolean) {
  const s = l.season ?? "summer";
  const t = l.t;
  if (s === "winter") {
    const r = viewRect(ctx);
    const W = r.x1 - r.x0,
      H = r.y1 - r.y0;
    const count = low ? 28 : 80;
    ctx.fillStyle = `rgba(255,255,255,${0.85 - l.night * 0.25})`;
    for (let i = 0; i < count; i++) {
      const sp = 22 + hash(i + 31) * 26;
      const x =
        r.x0 +
        ((((hash(i) * W + Math.sin(t * 0.7 + i) * 14 + t * 6) % W) + W) % W);
      const y = r.y0 + ((hash(i + 900) * H + t * sp) % H);
      const z = 1.2 + hash(i + 17) * 1.8;
      ctx.fillRect(x, y, z, z);
    }
  } else if (s === "autumn") {
    const spots: [number, number][] = [
      [R.cols + 6.2, -0.4],
      [R.cols + 2.9, 6.6],
      [3, -3.6],
      [11.5, -3.2],
    ];
    const per = low ? 2 : 5;
    for (const [i, [gx, gy]] of spots.entries()) {
      if (!onGround(gx, gy)) continue;
      const c = iso(gx, gy);
      for (let k = 0; k < per; k++) {
        const f = (t * 0.08 + hash(k + i * 7)) % 1;
        const x =
            c.x +
            (hash(k + 3 + i) - 0.5) * 70 +
            Math.sin(t * 1.6 + k) * 10 +
            f * 20,
          y = c.y - 100 + f * 104;
        ctx.fillStyle = `rgba(${k % 2 ? "226,130,50" : "200,80,44"},${(0.95 - l.night * 0.5) * Math.min(1, (1 - f) * 3)})`;
        ctx.beginPath();
        ctx.ellipse(x, y, 3.4, 1.8, t * 2.4 + k, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (s === "summer" && l.night < 0.4) {
    const P = plaza();
    const n = low ? 1 : 3;
    for (let i = 0; i < n; i++) {
      const b = iso(P.x - 1.6 + i * 1.9, P.y + 3.3);
      const x = b.x + Math.sin(t * 0.9 + i * 2) * 26,
        y = b.y - 14 + Math.sin(t * 1.7 + i) * 8;
      const flap = Math.abs(Math.sin(t * 16 + i)) * 4 + 1;
      ctx.fillStyle = ["#ffd65b", "#ffffff", "#ff9ab8"][i % 3];
      ctx.beginPath();
      ctx.ellipse(x - 2, y, flap, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 2, y, flap, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
