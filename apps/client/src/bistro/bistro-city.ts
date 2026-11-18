/*
 * Element Bistro: the buildings around the corner, from data.
 *
 *   - shops across the main road (fronts facing it): a shopfront with a
 *     window full of goods, a door, a fascia sign and a striped awning, one
 *     or two storeys of flats over it, a cornice and a roof with tanks,
 *     chimneys and plants;
 *   - taller blocks behind the shops (their tops show over them);
 *   - terraced houses past the back street (gable roofs, front steps,
 *     shutters, window boxes), and blocks of flats with balconies behind.
 *
 * Storeys at the bistro's scale: a shop's ground floor is 118 px (its door
 * 88, a creature 75), an upper storey 84. Add a look to LOOKS (or HOUSE_LOOKS)
 * to add a kind of building; the rows fill themselves.
 *
 * Buildings are baked with the street (they never move), so none may stand
 * in front of anything that moves: bistro-props.ts checks that (coversMovers)
 * and the rows here start where the road stops showing behind them.
 */
import { R, iso, isoBox, shade, type Light } from "./bistro-art";
import {
  BACKS,
  FRONTS,
  HOUSES,
  TILE,
  canal,
  hash,
  onWall,
  up,
  type Glow,
} from "./bistro-town";
import { poly } from "./bistro-geom";

type Ctx = CanvasRenderingContext2D;

export type Goods = "flowers" | "bread" | "books" | "tea" | "toys" | "ice" | "fruit" | "cafe";
export interface Look {
  wall: string;
  trim: string;
  awning: [string, string];
  sign: string;
  text: string;
  goods: Goods;
  /** Brick facing (else plaster). */
  brick?: boolean;
  /** Shutter colour beside the upper windows. */
  shutters?: string;
}
/** The shops, in order down the street (data: add a look to add a shop). */
export const LOOKS: readonly Look[] = [
  { wall: "#f6d3dc", trim: "#3f7a4e", awning: ["#4f9a62", "#f4f1ea"], sign: "#2f5d3c", text: "FLOWERS", goods: "flowers", shutters: "#5f9a6e" },
  { wall: "#e6b49a", trim: "#8a4b2a", awning: ["#d94a3a", "#fbf3e6"], sign: "#6b3a1e", text: "BAKERY", goods: "bread", brick: true },
  { wall: "#c9d6e8", trim: "#2c3e66", awning: ["#2f4c86", "#e9eef6"], sign: "#1f2d4f", text: "BOOKS", goods: "books" },
  { wall: "#dfe9d0", trim: "#5a7a3a", awning: ["#e2a33a", "#fff6e0"], sign: "#40562a", text: "TEA HOUSE", goods: "tea", shutters: "#b0703f" },
  { wall: "#fde6b8", trim: "#b8452f", awning: ["#7b5ad1", "#fdf6ff"], sign: "#4b2f86", text: "TOYS", goods: "toys" },
  { wall: "#d7f0ee", trim: "#2e8a86", awning: ["#ef7fa6", "#fff4f8"], sign: "#1f6663", text: "GELATO", goods: "ice" },
  { wall: "#c98f72", trim: "#3d5a3a", awning: ["#3d8a4a", "#f6f1e0"], sign: "#2c4a2a", text: "GREENGROCER", goods: "fruit", brick: true },
  { wall: "#efe3cf", trim: "#5a3a2a", awning: ["#5a3a2a", "#e9d8b8"], sign: "#3a2418", text: "CAFÉ", goods: "cafe", shutters: "#3d6a8a" },
];
/** Terraced houses and flats: wall, trim, roof, door. */
const HOUSE_LOOKS: readonly { wall: string; trim: string; roof: string; door: string; brick?: boolean }[] = [
  { wall: "#f3dcc0", trim: "#fbf6ec", roof: "#b5523b", door: "#2f5d8a" },
  { wall: "#c7dbe6", trim: "#ffffff", roof: "#5a6478", door: "#c2322e" },
  { wall: "#d6866a", trim: "#f6efe4", roof: "#7a3a2a", door: "#2f6a4a", brick: true },
  { wall: "#efe7a8", trim: "#ffffff", roof: "#a9553a", door: "#5a3a8a" },
  { wall: "#e8c4d0", trim: "#fdf8fa", roof: "#6e4a5a", door: "#3a6a7a" },
  { wall: "#d9e4c4", trim: "#ffffff", roof: "#8a5a3a", door: "#b8452f" },
];
const FLAT_LOOKS = ["#e9dccb", "#cfd8dc", "#e6cfb8", "#d4c4d8", "#c9d9c4"];

export type Kind = "shop" | "block" | "house" | "flats";
export interface Building {
  kind: Kind;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Wall height (world px); a house's roof rises over it. */
  h: number;
  floors: number;
  k: number;
}
/** Where the rows behind the room start (grid x): the road stops showing behind them there. */
export const HOUSE_X0 = 9,
  FLATS_X0 = 13;
const GF = 118,
  UF = 84,
  HOUSE_GF = 98,
  HOUSE_UF = 80,
  ROOF = 62;
const CORNICE = 14;

/** Every building, far to near is not needed: the scene sorts them. */
export function buildings(): Building[] {
  const out: Building[] = [];
  const c = canal();
  const skip = (a: number, b: number) => b > c.y0 - 1 && a < c.y1 + 1;
  // Shops along the far sidewalk, an alley now and then.
  for (let y = -30, k = 0; y < R.rows + 40; k++) {
    const w = 2.8 + hash(k + 11) * 0.9;
    if (skip(y, y + w)) {
      y = c.y1 + 1;
      continue;
    }
    const floors = 1 + (hash(k + 70) < 0.55 ? 1 : 2);
    out.push({
      kind: "shop",
      x0: BACKS,
      x1: FRONTS,
      y0: y,
      y1: y + w,
      h: GF + floors * UF - UF + CORNICE,
      floors,
      k,
    });
    y += w + (k % 4 === 3 ? 0.9 : 0);
  }
  // Taller blocks behind the shops, over a service alley.
  for (let y = -30, k = 0; y < R.rows + 40; k++) {
    const w = 4 + hash(k + 41) * 1.6;
    if (skip(y, y + w)) {
      y = c.y1 + 1;
      continue;
    }
    const floors = 4 + (hash(k + 90) < 0.4 ? 1 : 0);
    out.push({
      kind: "block",
      x0: BACKS - 6,
      x1: BACKS - 1.3,
      y0: y,
      y1: y + w,
      h: GF + (floors - 1) * UF + CORNICE,
      floors,
      k: k + 50,
    });
    y += w;
  }
  // Terraced houses past the back street.
  for (let x = HOUSE_X0, k = 0; x < R.cols + 30; k++) {
    const w = 3.3 + hash(k + 21) * 0.9;
    const floors = hash(k + 33) < 0.6 ? 2 : 3;
    out.push({
      kind: "house",
      x0: x,
      x1: x + w,
      y0: HOUSES - 3.6,
      y1: HOUSES,
      h: HOUSE_GF + (floors - 1) * HOUSE_UF + 8,
      floors,
      k: k + 100,
    });
    x += w;
  }
  // Flats behind the houses' gardens.
  for (let x = FLATS_X0, k = 0; x < R.cols + 34; k++) {
    const w = 5 + hash(k + 61) * 1.5;
    const floors = 5 + (hash(k + 62) < 0.35 ? 1 : 0);
    out.push({
      kind: "flats",
      x0: x,
      x1: x + w,
      y0: HOUSES - 12.5,
      y1: HOUSES - 6.4,
      h: 100 + (floors - 1) * HOUSE_UF + CORNICE,
      floors,
      k: k + 200,
    });
    x += w + 0.6;
  }
  return out;
}
/** How tall a building reaches, roof included (world px). */
export const topOf = (b: Building) => b.h + (b.kind === "house" ? ROOF + 30 : 46);

/* ───────────── facades ───────────── */

/** A window in a wall (local px: x, the bottom z, width, height). */
function windowAt(
  ctx: Ctx,
  x: number,
  z: number,
  w: number,
  h: number,
  o: {
    n: number;
    lit: boolean;
    on: boolean;
    trim: string;
    shutters?: string;
    box?: string | null;
    snow: boolean;
    curtain?: string;
  },
) {
  const dim = (c: string) => shade(c, -0.5 * o.n);
  // The frame, a lintel over it and a sill under it.
  ctx.fillStyle = dim(o.trim);
  ctx.fillRect(x - 3, -z - h - 3, w + 6, h + 6);
  ctx.fillRect(x - 5, -z - h - 7, w + 10, 4);
  ctx.fillStyle = dim(shade(o.trim, -0.12));
  ctx.fillRect(x - 5, -z, w + 10, 4);
  // Glass: the sky's reflection by day, warm rooms at night.
  if (o.lit && o.on) {
    ctx.fillStyle = "rgb(255,214,140)";
    ctx.fillRect(x, -z - h, w, h);
    if (o.curtain) {
      ctx.fillStyle = shade(o.curtain, -0.1);
      ctx.fillRect(x, -z - h, w * 0.22, h);
      ctx.fillRect(x + w * 0.78, -z - h, w * 0.22, h);
    }
  } else {
    const g = ctx.createLinearGradient(0, -z - h, 0, -z);
    g.addColorStop(0, o.lit ? "#2c3450" : dim("#d4ecf8"));
    g.addColorStop(1, o.lit ? "#1e2438" : dim("#6f9ab8"));
    ctx.fillStyle = g;
    ctx.fillRect(x, -z - h, w, h);
    if (o.curtain) {
      ctx.fillStyle = dim(o.curtain);
      ctx.globalAlpha = 0.75;
      ctx.fillRect(x, -z - h, w * 0.2, h);
      ctx.fillRect(x + w * 0.8, -z - h, w * 0.2, h);
      ctx.globalAlpha = 1;
    }
    if (!o.lit) {
      ctx.fillStyle = "rgba(255,255,255,.3)";
      ctx.beginPath();
      ctx.moveTo(x + w * 0.15, -z - h);
      ctx.lineTo(x + w * 0.42, -z - h);
      ctx.lineTo(x + w * 0.08, -z);
      ctx.lineTo(x, -z);
      ctx.lineTo(x, -z - h * 0.6);
      ctx.fill();
    }
  }
  // Glazing bars.
  ctx.fillStyle = dim(o.trim);
  ctx.fillRect(x + w / 2 - 1, -z - h, 2, h);
  ctx.fillRect(x, -z - h * 0.62, w, 2);
  // Shutters.
  if (o.shutters) {
    ctx.fillStyle = dim(o.shutters);
    for (const sx of [x - 3 - w * 0.36, x + w + 3]) {
      ctx.fillRect(sx, -z - h - 2, w * 0.36, h + 4);
      ctx.fillStyle = dim(shade(o.shutters, -0.2));
      for (let yy = -z - h + 3; yy < -z - 2; yy += 4)
        ctx.fillRect(sx + 2, yy, w * 0.36 - 4, 1.2);
      ctx.fillStyle = dim(o.shutters);
    }
  }
  // A window box with flowers, or snow on the sill.
  if (o.box) {
    ctx.fillStyle = dim("#8a5a3a");
    ctx.fillRect(x - 3, -z + 2, w + 6, 6);
    const cols = ["#ff7aa8", "#ffd65b", "#e2453a", "#ffffff", "#b49cff"];
    ctx.fillStyle = dim("#4f8a45");
    ctx.beginPath();
    for (let k = 0; k <= 4; k++) ctx.arc(x + (k * w) / 4, -z + 1, 3.2, 0, 7);
    ctx.fill();
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = dim(cols[(k + o.box.length) % cols.length]);
      ctx.beginPath();
      ctx.arc(x + 2 + (k * w) / 3.4, -z - 1.5, 2.2, 0, 7);
      ctx.fill();
    }
  } else if (o.snow) {
    ctx.fillStyle = dim("#f6f8fc");
    ctx.fillRect(x - 5, -z - 2, w + 10, 3);
    ctx.fillRect(x - 5, -z - h - 9, w + 10, 3);
  }
}
/** Brick courses or plaster speckle over a wall (local px). */
function wallTexture(ctx: Ctx, W: number, h: number, brick: boolean, k: number) {
  if (brick) {
    ctx.fillStyle = "rgba(90,40,30,.13)";
    for (let y = 6, row = 0; y < h; y += 7, row++) {
      ctx.fillRect(0, -y, W, 1);
      for (let x = (row % 2) * 8; x < W; x += 16) ctx.fillRect(x, -y - 6, 1, 6);
    }
  } else {
    for (let i = 0; i < W * h * 0.004; i++) {
      ctx.fillStyle = hash(i + k) > 0.5 ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.05)";
      ctx.fillRect(hash(i * 3 + k) * W, -hash(i * 7 + k) * h, 2, 2);
    }
  }
}
function drawGoods(ctx: Ctx, g: Goods, x: number, w: number, z: number, n: number) {
  // Local wall coordinates: the window spans x .. x + w from z up.
  const dk = (c: string) => shade(c, -0.35 * n);
  const shelf = (zz: number) => {
    ctx.fillStyle = dk("#8a6a4a");
    ctx.fillRect(x + 2, -z - zz, w - 4, 3);
  };
  const row = (count: number, f: (cx: number, i: number) => void) => {
    for (let i = 0; i < count; i++) f(x + 8 + (i * (w - 16)) / Math.max(1, count - 1), i);
  };
  if (g === "flowers") {
    const cols = ["#ff7aa8", "#ffd65b", "#ffffff", "#b49cff", "#ff9a5b"];
    row(6, (cx, i) => {
      ctx.fillStyle = dk("#b0785a");
      ctx.fillRect(cx - 5, -z - 12, 10, 12);
      ctx.fillStyle = dk("#3f8a45");
      ctx.fillRect(cx - 0.8, -z - 30, 1.6, 18);
      ctx.fillStyle = dk(cols[i % cols.length]);
      ctx.beginPath();
      ctx.arc(cx, -z - 32, 5, 0, 7);
      ctx.arc(cx + 4, -z - 36, 3.6, 0, 7);
      ctx.arc(cx - 4, -z - 36, 3.6, 0, 7);
      ctx.fill();
    });
  } else if (g === "bread") {
    shelf(38);
    shelf(18);
    ctx.fillStyle = dk("#c98a3e");
    row(5, (cx) => {
      ctx.beginPath();
      ctx.ellipse(cx, -z - 43, 7, 4.4, 0, 0, 7);
      ctx.fill();
    });
    row(4, (cx, i) => {
      ctx.fillStyle = dk(i % 2 ? "#f6e7d0" : "#e8b46a");
      ctx.beginPath();
      ctx.arc(cx, -z - 24, 5.5, Math.PI, 0);
      ctx.fill();
    });
  } else if (g === "books") {
    const cols = ["#d94a3a", "#2f4c86", "#f2c14e", "#4f9a62", "#7b5ad1"];
    for (const zz of [10, 32, 54]) {
      shelf(zz - 3);
      for (let i = 0; i * 5 < w - 10; i++) {
        ctx.fillStyle = dk(cols[(i + zz) % cols.length]);
        const bh = 12 + hash(i + zz) * 6;
        ctx.fillRect(x + 5 + i * 5, -z - zz - bh, 4, bh);
      }
    }
  } else if (g === "tea") {
    shelf(34);
    row(4, (cx) => {
      ctx.fillStyle = dk("#fbf6ec");
      ctx.fillRect(cx - 4, -z - 46, 8, 9);
      ctx.fillRect(cx + 4, -z - 44, 3, 3);
    });
    ctx.fillStyle = dk("#4f8a5b");
    ctx.beginPath();
    ctx.ellipse(x + w / 2, -z - 18, 11, 8, 0, 0, 7);
    ctx.fill();
    ctx.fillRect(x + w / 2 + 9, -z - 22, 8, 3);
  } else if (g === "toys") {
    ctx.fillStyle = dk("#f2c14e");
    ctx.beginPath();
    ctx.arc(x + 16, -z - 26, 10, 0, 7);
    ctx.arc(x + 9, -z - 35, 4, 0, 7);
    ctx.arc(x + 23, -z - 35, 4, 0, 7);
    ctx.fill();
    ctx.fillStyle = dk("#3d8fd1");
    ctx.beginPath();
    ctx.arc(x + w - 16, -z - 16, 9, 0, 7);
    ctx.fill();
    ctx.fillStyle = dk("#e2453a");
    ctx.fillRect(x + w / 2 - 8, -z - 22, 14, 14);
    ctx.fillStyle = dk("#4fb36b");
    ctx.fillRect(x + w / 2 - 4, -z - 34, 13, 12);
  } else if (g === "fruit") {
    // Crates out front under the window.
    const cols = ["#e2453a", "#f2c14e", "#4fb36b", "#ff9a5b"];
    row(4, (cx, i) => {
      ctx.fillStyle = dk("#b0844a");
      ctx.fillRect(cx - 9, -z - 12, 18, 12);
      ctx.fillStyle = dk(cols[i]);
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.arc(cx - 6 + k * 4, -z - 14 - (k % 2) * 2, 3, 0, 7);
        ctx.fill();
      }
    });
    shelf(40);
    ctx.fillStyle = dk("#4fb36b");
    row(5, (cx) => {
      ctx.beginPath();
      ctx.arc(cx, -z - 45, 4, 0, 7);
      ctx.fill();
    });
  } else if (g === "cafe") {
    // A counter with an espresso machine and cups; a little table inside.
    ctx.fillStyle = dk("#6b4026");
    ctx.fillRect(x + 4, -z - 26, w * 0.5, 26);
    ctx.fillStyle = dk("#c9ced8");
    ctx.fillRect(x + 10, -z - 42, 18, 16);
    ctx.fillStyle = dk("#fbf6ec");
    for (let k = 0; k < 3; k++) ctx.fillRect(x + 32 + k * 7, -z - 32, 5, 6);
    ctx.fillStyle = dk("#3a2418");
    ctx.beginPath();
    ctx.arc(x + w * 0.78, -z - 22, 9, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x + w * 0.78 - 1, -z - 22, 2, 22);
  } else {
    row(4, (cx, i) => {
      ctx.fillStyle = dk("#d9a35a");
      ctx.beginPath();
      ctx.moveTo(cx - 5, -z - 30);
      ctx.lineTo(cx, -z - 14);
      ctx.lineTo(cx + 5, -z - 30);
      ctx.fill();
      ctx.fillStyle = dk(["#ff9ab8", "#fff1c4", "#9be0c8", "#c9a0ff"][i]);
      ctx.beginPath();
      ctx.arc(cx, -z - 33, 6, 0, 7);
      ctx.fill();
    });
  }
}

/* ───────────── a shop ───────────── */

function drawShop(ctx: Ctx, b: Building, l: Light) {
  const n = l.night,
    snow = l.season === "winter";
  const dim = (c: string) => shade(c, -0.5 * n);
  const look = LOOKS[b.k % LOOKS.length];
  const { x0, x1, y0, y1, h } = b;
  const W = (y1 - y0) * TILE;
  isoBox(ctx, x0, y0, x1, y1, 0, h, {
    top: snow ? dim("#eef2f7") : dim("#9a8f86"),
    left: dim(shade(look.wall, -0.22)),
    right: dim(look.wall),
  });
  const lit = n > 0.35;
  // The side wall (shows at alleys and by the canal): windows upstairs, a drainpipe.
  onWall(ctx, "x", y1, x0, () => {
    const D = (x1 - x0) * TILE;
    wallTexture(ctx, D, h, !!look.brick, b.k + 7);
    for (let f = 1; f < b.floors; f++)
      windowAt(ctx, D * 0.38, GF + (f - 1) * UF + 18, 22, 40, {
        n: n + 0.15,
        lit,
        on: hash(b.k * 5 + f) > 0.4,
        trim: look.trim,
        snow,
      });
    ctx.fillStyle = dim("#6a6f7a");
    ctx.fillRect(D - 8, -h, 3, h);
  });
  onWall(ctx, "y", x1, y1, () => {
    wallTexture(ctx, W, h, !!look.brick, b.k);
    // The plinth and pilasters.
    ctx.fillStyle = dim(shade(look.trim, -0.25));
    ctx.fillRect(0, -8, W, 8);
    ctx.fillStyle = dim(look.trim);
    ctx.fillRect(0, -GF, 7, GF - 8);
    ctx.fillRect(W - 7, -GF, 7, GF - 8);
    // The shop window: frame, glass, goods, glazing bars, a stall board under it.
    const wx = 16,
      ww = W * 0.56,
      wz = 16,
      wh = 64;
    ctx.fillStyle = dim(look.trim);
    ctx.fillRect(wx - 4, -wz - wh - 4, ww + 8, wh + 8);
    if (lit) {
      ctx.fillStyle = `rgb(255,${(212 + 14 * n) | 0},${(140 + 30 * n) | 0})`;
    } else {
      const g = ctx.createLinearGradient(0, -wz - wh, 0, -wz);
      g.addColorStop(0, shade("#dff0f8", -0.4 * n));
      g.addColorStop(1, shade("#86b2cc", -0.4 * n));
      ctx.fillStyle = g;
    }
    ctx.fillRect(wx, -wz - wh, ww, wh);
    drawGoods(ctx, look.goods, wx, ww, wz, lit ? 0 : n);
    if (!lit) {
      ctx.fillStyle = "rgba(255,255,255,.24)";
      ctx.beginPath();
      ctx.moveTo(wx + ww * 0.18, -wz - wh);
      ctx.lineTo(wx + ww * 0.4, -wz - wh);
      ctx.lineTo(wx + ww * 0.2, -wz);
      ctx.lineTo(wx, -wz);
      ctx.lineTo(wx, -wz - wh * 0.5);
      ctx.fill();
    }
    ctx.fillStyle = dim(look.trim);
    for (let x = wx + ww / 3; x < wx + ww - 4; x += ww / 3) ctx.fillRect(x - 1.5, -wz - wh, 3, wh);
    ctx.fillRect(wx, -wz - wh * 0.78, ww, 2.5);
    ctx.fillStyle = dim(shade(look.trim, -0.15));
    ctx.fillRect(wx - 6, -wz, ww + 12, 6);
    // The door: panelled, glass above, a brass handle, a step.
    const dx = wx + ww + 14,
      dw = Math.min(34, W - dx - 12);
    ctx.fillStyle = dim(shade(look.trim, -0.1));
    ctx.fillRect(dx - 3, -96, dw + 6, 96);
    ctx.fillStyle = dim(shade(look.trim, -0.3));
    ctx.fillRect(dx, -90, dw, 82);
    ctx.fillStyle = lit ? "rgb(255,214,140)" : dim("#a9cde0");
    ctx.fillRect(dx + 4, -86, dw - 8, 40);
    ctx.fillStyle = dim(shade(look.trim, -0.12));
    ctx.fillRect(dx + 4, -40, dw - 8, 26);
    ctx.fillStyle = dim("#f2c14e");
    ctx.fillRect(dx + dw - 8, -48, 3, 8);
    ctx.fillStyle = dim("#c9c2b4");
    ctx.fillRect(dx - 6, -6, dw + 12, 6);
    // An OPEN sign on the door by day, a wreath in winter.
    if (snow) {
      ctx.strokeStyle = dim("#2f7a4a");
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(dx + dw / 2, -66, 7, 0, 7);
      ctx.stroke();
      ctx.fillStyle = dim("#d94a3a");
      ctx.fillRect(dx + dw / 2 - 2.5, -61, 5, 4);
    } else {
      ctx.fillStyle = lit ? "#ff5a7a" : dim("#ffffff");
      ctx.fillRect(dx + dw / 2 - 9, -72, 18, 8);
      ctx.fillStyle = lit ? "#ffffff" : dim(look.sign);
      ctx.font = "800 6px 'Barlow Condensed', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("OPEN", dx + dw / 2, -66);
    }
    // The fascia: the shop's name in a framed board.
    ctx.fillStyle = dim(look.sign);
    ctx.fillRect(4, -GF + 2, W - 8, 24);
    ctx.strokeStyle = dim(shade(look.trim, 0.45));
    ctx.lineWidth = 1.5;
    ctx.strokeRect(7, -GF + 5, W - 14, 18);
    ctx.fillStyle = lit ? "#ffe6a6" : dim("#fbf3e2");
    ctx.font = "800 13px 'Barlow Condensed', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(look.text, W / 2, -GF + 14.5);
    ctx.textBaseline = "alphabetic";
    // The string course over the shopfront.
    ctx.fillStyle = dim(shade(look.wall, 0.35));
    ctx.fillRect(0, -GF - 4, W, 5);
    // Upper storeys: two or three windows each.
    const per = W > 170 ? 3 : 2;
    for (let f = 1; f < b.floors; f++) {
      const z = GF + (f - 1) * UF + 20;
      for (let i = 0; i < per; i++) {
        const ww2 = 28,
          x = ((i + 0.5) * W) / per - ww2 / 2;
        windowAt(ctx, x, z, ww2, 46, {
          n,
          lit,
          on: hash(b.k * 9 + f * 3 + i) > 0.35,
          trim: shade(look.wall, 0.55),
          shutters: look.shutters,
          box: l.season === "spring" || l.season === "summer" ? (f + i + b.k) % 3 ? look.text : null : null,
          snow,
          curtain: ["#d94a3a", "#f2c14e", "#7b5ad1", "#4f9a62"][(b.k + f + i) % 4],
        });
      }
      // A little balcony on some.
      if (hash(b.k + f * 13) < 0.3) {
        const bx = W / 2 - 24;
        ctx.fillStyle = dim("#9a9a9a");
        ctx.fillRect(bx, -z + 6, 48, 4);
        ctx.strokeStyle = dim("#3a3e48");
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let x = bx; x <= bx + 48; x += 6) {
          ctx.moveTo(x, -z + 6);
          ctx.lineTo(x, -z - 12);
        }
        ctx.moveTo(bx, -z - 12);
        ctx.lineTo(bx + 48, -z - 12);
        ctx.stroke();
      }
    }
    // The cornice along the top.
    ctx.fillStyle = dim(shade(look.wall, 0.4));
    ctx.fillRect(-2, -h, W + 4, 8);
    ctx.fillStyle = dim(shade(look.wall, -0.25));
    for (let x = 4; x < W - 4; x += 8) ctx.fillRect(x, -h + 8, 4, 4);
    if (snow) {
      ctx.fillStyle = dim("#f6f8fc");
      ctx.fillRect(-2, -h - 3, W + 4, 4);
    }
  });
  // The awning over window and door, with a scalloped hem.
  const az0 = GF - 18,
    az1 = GF - 38,
    out = 0.7,
    ya = y0 + 0.1,
    yb = y1 - 0.1,
    k = 9;
  const [c0, c1] = look.awning.map((c) => dim(snow ? shade(c, 0.55) : c)) as [string, string];
  for (let i = 0; i < k; i++) {
    const a = ya + ((yb - ya) * i) / k,
      bb = ya + ((yb - ya) * (i + 1)) / k;
    ctx.fillStyle = i % 2 ? c1 : c0;
    poly(ctx, [
      up(iso(x1, a), az0),
      up(iso(x1, bb), az0),
      up(iso(x1 + out, bb), az1),
      up(iso(x1 + out, a), az1),
    ]);
    ctx.fill();
    ctx.fillStyle = shade(i % 2 ? c1 : c0, -0.14);
    const p = up(iso(x1 + out, a), az1),
      q = up(iso(x1 + out, bb), az1);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.lineTo(q.x, q.y + 7);
    ctx.quadraticCurveTo((p.x + q.x) / 2, (p.y + q.y) / 2 + 14, p.x, p.y + 7);
    ctx.fill();
  }
  // The awning's end, facing us.
  ctx.fillStyle = shade(c0, -0.22);
  poly(ctx, [up(iso(x1, yb), az0), up(iso(x1 + out, yb), az1), up(iso(x1 + out, yb), az1 - 7), up(iso(x1, yb), az0 - 5)]);
  ctx.fill();
  // A hanging sign at the corner.
  const hs = up(iso(x1 + 0.35, y1 - 0.2), GF + 30);
  ctx.strokeStyle = dim("#3a3e48");
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(up(iso(x1, y1 - 0.2), GF + 34).x, up(iso(x1, y1 - 0.2), GF + 34).y);
  ctx.lineTo(hs.x + 8, hs.y - 2);
  ctx.stroke();
  ctx.fillStyle = dim(look.awning[0]);
  ctx.beginPath();
  ctx.arc(hs.x + 6, hs.y + 8, 8, 0, 7);
  ctx.fill();
  ctx.strokeStyle = dim("#f2c14e");
  ctx.stroke();
  roofStuff(ctx, b, l);
}
/** Tanks, chimneys, aerials, air conditioners and roof gardens. */
function roofStuff(ctx: Ctx, b: Building, l: Light) {
  const n = l.night,
    snow = l.season === "winter";
  const dim = (c: string) => shade(c, -0.5 * n);
  const { x0, x1, y0, y1, h } = b;
  // The parapet: the roof sits a little lower inside it.
  const inset = 0.18;
  ctx.fillStyle = snow ? dim("#e4eaf2") : dim("#7d736c");
  poly(ctx, [
    up(iso(x0 + inset, y0 + inset), h),
    up(iso(x1 - inset, y0 + inset), h),
    up(iso(x1 - inset, y1 - inset), h),
    up(iso(x0 + inset, y1 - inset), h),
  ]);
  ctx.fill();
  const r = hash(b.k + 300);
  const box = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    hh: number,
    col: string,
  ) =>
    isoBox(ctx, ax, ay, bx, by, h, hh, {
      top: snow ? dim("#f4f7fb") : dim(shade(col, 0.2)),
      left: dim(shade(col, -0.2)),
      right: dim(col),
    });
  const mx = (x0 + x1) / 2,
    my = (y0 + y1) / 2;
  if (r < 0.3) {
    // A wooden water tank on legs.
    const c = up(iso(mx - 0.4, my), h);
    ctx.fillStyle = dim("#5a4a40");
    ctx.fillRect(c.x - 14, c.y - 26, 3, 26);
    ctx.fillRect(c.x + 11, c.y - 26, 3, 26);
    ctx.fillRect(c.x - 1.5, c.y - 22, 3, 22);
    ctx.fillStyle = dim("#9a7350");
    ctx.beginPath();
    ctx.roundRect(c.x - 17, c.y - 56, 34, 32, 4);
    ctx.fill();
    ctx.fillStyle = dim("#7a5a3c");
    for (let yy = c.y - 50; yy < c.y - 26; yy += 8) ctx.fillRect(c.x - 17, yy, 34, 2);
    ctx.fillStyle = snow ? dim("#f4f7fb") : dim("#6a4a30");
    ctx.beginPath();
    ctx.moveTo(c.x - 19, c.y - 56);
    ctx.lineTo(c.x, c.y - 68);
    ctx.lineTo(c.x + 19, c.y - 56);
    ctx.fill();
  } else if (r < 0.55) {
    // A rooftop garden: planters and a parasol.
    box(x0 + 0.5, y0 + 0.4, x0 + 0.9, y1 - 0.4, 10, "#8a5a3a");
    ctx.fillStyle = dim(snow ? "#f4f7fb" : "#5fae4f");
    for (let yy = y0 + 0.6; yy < y1 - 0.5; yy += 0.5) {
      const p = up(iso(x0 + 0.7, yy), h + 14);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, 7);
      ctx.fill();
    }
    const p = up(iso(mx + 0.4, my), h);
    ctx.fillStyle = dim("#e8e2d6");
    ctx.fillRect(p.x - 1, p.y - 30, 2, 30);
    ctx.fillStyle = dim(LOOKS[b.k % LOOKS.length].awning[0]);
    ctx.beginPath();
    ctx.moveTo(p.x - 20, p.y - 26);
    ctx.quadraticCurveTo(p.x, p.y - 44, p.x + 20, p.y - 26);
    ctx.fill();
  } else {
    // Air conditioners and a chimney stack.
    box(mx - 0.3, y0 + 0.5, mx + 0.3, y0 + 1.1, 16, "#c9ced8");
    box(mx - 0.3, y0 + 1.3, mx + 0.3, y0 + 1.9, 16, "#c9ced8");
    box(x0 + 0.4, y1 - 0.9, x0 + 0.9, y1 - 0.4, 34, "#8a5a40");
  }
  // An aerial on some.
  if (hash(b.k + 400) < 0.45) {
    const p = up(iso(x1 - 0.5, y0 + 0.5), h);
    ctx.strokeStyle = dim("#4a4e58");
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - 40);
    for (const yy of [-34, -28, -22]) {
      ctx.moveTo(p.x - 9, p.y + yy);
      ctx.lineTo(p.x + 9, p.y + yy);
    }
    ctx.stroke();
  }
}

/* ───────────── blocks behind the shops ───────────── */

function drawBlock(ctx: Ctx, b: Building, l: Light) {
  const n = l.night,
    snow = l.season === "winter";
  const dim = (c: string) => shade(c, -0.5 * n);
  const wall = FLAT_LOOKS[b.k % FLAT_LOOKS.length];
  const { x0, x1, y0, y1, h } = b;
  isoBox(ctx, x0, y0, x1, y1, 0, h, {
    top: snow ? dim("#eef2f7") : dim("#8f857e"),
    left: dim(shade(wall, -0.24)),
    right: dim(wall),
  });
  const lit = n > 0.35;
  const W = (y1 - y0) * TILE,
    D = (x1 - x0) * TILE;
  onWall(ctx, "y", x1, y1, () => {
    wallTexture(ctx, W, h, b.k % 3 === 0, b.k);
    const per = Math.max(2, Math.floor(W / 56));
    for (let f = 1; f < b.floors; f++)
      for (let i = 0; i < per; i++)
        windowAt(ctx, ((i + 0.5) * W) / per - 13, GF + (f - 1) * UF + 18, 26, 44, {
          n,
          lit,
          on: hash(b.k * 7 + f * 5 + i) > 0.45,
          trim: "#f4efe6",
          snow,
          curtain: "#e8d8b8",
        });
    ctx.fillStyle = dim(shade(wall, 0.35));
    ctx.fillRect(-2, -h, W + 4, 8);
  });
  onWall(ctx, "x", y1, x0, () => {
    wallTexture(ctx, D, h, b.k % 3 === 0, b.k + 3);
    const per = Math.max(2, Math.floor(D / 60));
    for (let f = 1; f < b.floors; f++)
      for (let i = 0; i < per; i++)
        windowAt(ctx, ((i + 0.5) * D) / per - 11, GF + (f - 1) * UF + 18, 22, 44, {
          n: n + 0.1,
          lit,
          on: hash(b.k * 3 + f * 11 + i) > 0.5,
          trim: "#f4efe6",
          snow,
        });
  });
  roofStuff(ctx, b, l);
}

/* ───────────── terraced houses ───────────── */

function drawHouse(ctx: Ctx, b: Building, l: Light) {
  const n = l.night,
    snow = l.season === "winter";
  const dim = (c: string) => shade(c, -0.5 * n);
  const look = HOUSE_LOOKS[b.k % HOUSE_LOOKS.length];
  const { x0, x1, y0, y1, h } = b;
  const lit = n > 0.35;
  isoBox(ctx, x0, y0, x1, y1, 0, h, {
    top: dim("#6a5a50"),
    left: dim(shade(look.wall, -0.08)),
    right: dim(look.wall),
  });
  const W = (x1 - x0) * TILE;
  // The front (facing +y, toward the back street).
  onWall(ctx, "x", y1, x0, () => {
    wallTexture(ctx, W, h, !!look.brick, b.k);
    ctx.fillStyle = dim(shade(look.wall, -0.3));
    ctx.fillRect(0, -10, W, 10);
    // The door up two steps, under a little canopy, a lamp beside it.
    const dx = W * 0.14,
      dw = 30;
    ctx.fillStyle = dim("#c9c2b4");
    ctx.fillRect(dx - 8, -6, dw + 16, 6);
    ctx.fillRect(dx - 4, -12, dw + 8, 6);
    ctx.fillStyle = dim(look.trim);
    ctx.fillRect(dx - 4, -100, dw + 8, 88);
    ctx.fillStyle = dim(look.door);
    ctx.fillRect(dx, -96, dw, 84);
    ctx.fillStyle = dim(shade(look.door, -0.2));
    ctx.fillRect(dx + 4, -88, dw - 8, 30);
    ctx.fillRect(dx + 4, -52, dw - 8, 34);
    ctx.fillStyle = lit ? "rgb(255,214,140)" : dim("#a9cde0");
    ctx.beginPath();
    ctx.arc(dx + dw / 2, -96, dw / 2 - 3, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = dim("#f2c14e");
    ctx.beginPath();
    ctx.arc(dx + dw - 7, -54, 2, 0, 7);
    ctx.fill();
    ctx.fillStyle = dim(shade(look.roof, 0.1));
    ctx.fillRect(dx - 10, -110, dw + 20, 6);
    ctx.fillStyle = lit ? "#ffe6a6" : dim("#d8dde4");
    ctx.fillRect(dx + dw + 8, -86, 6, 10);
    // A house number.
    ctx.fillStyle = dim(look.trim);
    ctx.fillRect(dx + dw / 2 - 6, -118, 12, 8);
    ctx.fillStyle = dim("#3a3e48");
    ctx.font = "800 6px 'Barlow Condensed', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(10 + b.k), dx + dw / 2, -112);
    // A bay window on the ground floor.
    const bx = W * 0.48;
    windowAt(ctx, bx, 22, W - bx - 18, 54, {
      n,
      lit,
      on: hash(b.k + 7) > 0.3,
      trim: look.trim,
      box: l.season === "spring" || l.season === "summer" ? "x" : null,
      snow,
      curtain: "#f2e0c0",
    });
    for (let f = 1; f < b.floors; f++) {
      const z = HOUSE_GF + (f - 1) * HOUSE_UF + 14;
      for (const [i, fx] of [0.22, 0.68].entries())
        windowAt(ctx, W * fx - 14, z, 28, 46, {
          n,
          lit,
          on: hash(b.k * 5 + f * 3 + i) > 0.4,
          trim: look.trim,
          shutters: b.k % 2 ? shade(look.door, 0.1) : undefined,
          box: (l.season === "spring" || l.season === "summer") && (i + f) % 2 ? "y" : null,
          snow,
          curtain: ["#d94a3a", "#7b5ad1", "#4f9a62"][(b.k + i) % 3],
        });
    }
    // Gutter.
    ctx.fillStyle = dim("#e8e4dc");
    ctx.fillRect(-4, -h - 2, W + 8, 5);
    ctx.fillRect(W - 6, -h, 3, h - 10);
  });
  // The side toward +x shows only past the last house (a gable end with a window).
  onWall(ctx, "y", x1, y1, () => {
    const D = (y1 - y0) * TILE;
    wallTexture(ctx, D, h, !!look.brick, b.k + 5);
    windowAt(ctx, D / 2 - 11, HOUSE_GF + 14, 22, 40, {
      n: n + 0.15,
      lit,
      on: false,
      trim: look.trim,
      snow,
    });
  });
  // The gable roof: ridge along x, eaves over the front, the gable end at +x.
  const ym = (y0 + y1) / 2,
    over = 0.25,
    ex0 = x0 - 0.05,
    ex1 = x1 + 0.12;
  const roof = snow ? dim("#f4f7fb") : dim(look.roof);
  const slope = [
    up(iso(ex0, y1 + over), h - 6),
    up(iso(ex1, y1 + over), h - 6),
    up(iso(ex1, ym), h + ROOF),
    up(iso(ex0, ym), h + ROOF),
  ];
  ctx.fillStyle = roof;
  poly(ctx, slope);
  ctx.fill();
  // Tile courses.
  ctx.strokeStyle = snow ? "rgba(150,170,200,.35)" : dim(shade(look.roof, -0.25));
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let f = 0.12; f < 1; f += 0.14) {
    const a = up(iso(ex0, y1 + over + (ym - y1 - over) * f), h - 6 + (ROOF + 6) * f),
      c = up(iso(ex1, y1 + over + (ym - y1 - over) * f), h - 6 + (ROOF + 6) * f);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(c.x, c.y);
  }
  ctx.stroke();
  // The gable end: the wall's triangle and the roof's edge.
  ctx.fillStyle = dim(shade(look.wall, -0.16));
  poly(ctx, [up(iso(x1, y1), h), up(iso(x1, y0), h), up(iso(x1, ym), h + ROOF - 4)]);
  ctx.fill();
  ctx.fillStyle = shade(roof, -0.2);
  poly(ctx, [
    up(iso(ex1, y1 + over), h - 6),
    up(iso(ex1, ym), h + ROOF),
    up(iso(ex1, ym), h + ROOF + 7),
    up(iso(ex1, y1 + over), h + 1),
  ]);
  ctx.fill();
  // The back slope's top edge shows as a ridge cap.
  ctx.fillStyle = shade(roof, -0.12);
  poly(ctx, [up(iso(ex0, ym), h + ROOF), up(iso(ex1, ym), h + ROOF), up(iso(ex1, ym - 0.2), h + ROOF - 4), up(iso(ex0, ym - 0.2), h + ROOF - 4)]);
  ctx.fill();
  // A chimney on the ridge, a dormer on some.
  const cx = x0 + (x1 - x0) * (b.k % 2 ? 0.25 : 0.75);
  isoBox(ctx, cx - 0.25, ym - 0.3, cx + 0.25, ym + 0.2, h + ROOF - 10, 40, {
    top: dim("#3a2a22"),
    left: dim(look.brick ? "#a0583a" : "#b8a89a"),
    right: dim(look.brick ? "#8a4a30" : "#a09080"),
  });
  if (hash(b.k + 9) < 0.5 && b.floors < 3) {
    const dxm = (x0 + x1) / 2,
      dy = y1 + over + (ym - y1 - over) * 0.45;
    isoBox(ctx, dxm - 0.45, dy - 0.5, dxm + 0.45, dy + 0.1, h + 20, 34, {
      top: roof,
      left: dim(look.wall),
      right: dim(shade(look.wall, -0.16)),
    });
    onWall(ctx, "x", dy + 0.1, dxm - 0.45, () => {
      windowAt(ctx, 13, h + 26, 22, 22, { n, lit, on: hash(b.k + 3) > 0.5, trim: look.trim, snow });
    });
  }
}

/* ───────────── flats behind the houses ───────────── */

function drawFlats(ctx: Ctx, b: Building, l: Light) {
  const n = l.night,
    snow = l.season === "winter";
  const dim = (c: string) => shade(c, -0.5 * n);
  const wall = FLAT_LOOKS[b.k % FLAT_LOOKS.length];
  const { x0, x1, y0, y1, h } = b;
  const lit = n > 0.35;
  isoBox(ctx, x0, y0, x1, y1, 0, h, {
    top: snow ? dim("#eef2f7") : dim("#8f857e"),
    left: dim(shade(wall, -0.08)),
    right: dim(wall),
  });
  const W = (x1 - x0) * TILE,
    D = (y1 - y0) * TILE;
  onWall(ctx, "x", y1, x0, () => {
    wallTexture(ctx, W, h, b.k % 2 === 0, b.k);
    // The entrance with a canopy.
    ctx.fillStyle = dim("#3a4458");
    ctx.fillRect(W / 2 - 22, -84, 44, 84);
    ctx.fillStyle = lit ? "rgb(255,220,160)" : dim("#9cc4dc");
    ctx.fillRect(W / 2 - 18, -78, 36, 74);
    ctx.fillStyle = dim("#e8e4dc");
    ctx.fillRect(W / 2 - 30, -92, 60, 8);
    for (const sx of [0.16, 0.84])
      windowAt(ctx, W * sx - 18, 24, 36, 50, { n, lit, on: hash(b.k + sx * 9) > 0.4, trim: "#f4efe6", snow });
    const per = Math.max(3, Math.floor(W / 60));
    for (let f = 1; f < b.floors; f++) {
      const z = 100 + (f - 1) * HOUSE_UF + 16;
      for (let i = 0; i < per; i++) {
        const x = ((i + 0.5) * W) / per - 14;
        windowAt(ctx, x, z, 28, 44, {
          n,
          lit,
          on: hash(b.k * 13 + f * 7 + i) > 0.45,
          trim: "#f4efe6",
          snow,
          curtain: ["#d94a3a", "#f2c14e", "#4f9a62", "#3d8fd1"][(b.k + f + i) % 4],
        });
        // Balconies on alternate windows: a slab, railings, a plant.
        if ((i + f + b.k) % 2 === 0) {
          ctx.fillStyle = dim("#d8d4cc");
          ctx.fillRect(x - 8, -z + 4, 44, 6);
          ctx.fillStyle = dim("rgba(80,90,110,.55)");
          ctx.fillRect(x - 8, -z - 14, 44, 18);
          ctx.strokeStyle = dim("#3a3e48");
          ctx.lineWidth = 1.4;
          ctx.strokeRect(x - 8, -z - 14, 44, 18);
          if ((i + b.k) % 3 === 0) {
            ctx.fillStyle = dim(snow ? "#f4f7fb" : "#5fae4f");
            ctx.beginPath();
            ctx.arc(x + 30, -z - 18, 7, 0, 7);
            ctx.fill();
          }
        }
      }
    }
    ctx.fillStyle = dim(shade(wall, 0.35));
    ctx.fillRect(-2, -h, W + 4, 8);
  });
  onWall(ctx, "y", x1, y1, () => {
    wallTexture(ctx, D, h, b.k % 2 === 0, b.k + 2);
    const per = Math.max(2, Math.floor(D / 70));
    for (let f = 1; f < b.floors; f++)
      for (let i = 0; i < per; i++)
        windowAt(ctx, ((i + 0.5) * D) / per - 11, 100 + (f - 1) * HOUSE_UF + 16, 22, 40, {
          n: n + 0.1,
          lit,
          on: hash(b.k * 3 + f + i * 5) > 0.55,
          trim: "#f4efe6",
          snow,
        });
  });
  roofStuff(ctx, b, l);
}

export function drawBuilding(ctx: Ctx, b: Building, l: Light) {
  if (b.kind === "shop") drawShop(ctx, b, l);
  else if (b.kind === "block") drawBlock(ctx, b, l);
  else if (b.kind === "house") drawHouse(ctx, b, l);
  else drawFlats(ctx, b, l);
}
/** The building's shadow on the ground (the sun from the right, high). */
export function buildingShadow(ctx: Ctx, b: Building, a: number) {
  const len = topOf(b) / 260;
  const dx = -0.35 * len,
    dy = 0.6 * len;
  const pts = [
    iso(b.x0, b.y0),
    iso(b.x1, b.y0),
    iso(b.x1, b.y1),
    iso(b.x0, b.y1),
  ];
  const sh = [
    iso(b.x0 + dx, b.y0 + dy),
    iso(b.x1 + dx, b.y0 + dy),
    iso(b.x1 + dx, b.y1 + dy),
    iso(b.x0 + dx, b.y1 + dy),
  ];
  ctx.fillStyle = `rgba(30,30,60,${a})`;
  ctx.beginPath();
  // The footprint and its shadow joined by the swept sides: one path, one fill.
  for (const q of [pts, sh, [pts[0], pts[3], sh[3], sh[0]], [pts[2], pts[3], sh[3], sh[2]], [pts[1], pts[2], sh[2], sh[1]]]) {
    ctx.moveTo(q[0].x, q[0].y);
    for (let i = 1; i < q.length; i++) ctx.lineTo(q[i].x, q[i].y);
    ctx.closePath();
  }
  ctx.fill("nonzero");
}
/** The warm light of shop windows and doors at night (baked with the street). */
export function buildingGlows(): Glow[] {
  const out: Glow[] = [];
  for (const b of buildings()) {
    if (b.kind === "shop") {
      const w = iso(FRONTS + 0.4, b.y1 - (b.y1 - b.y0) * 0.38);
      out.push([w.x, w.y - 40, 90, "255,200,120", 0.4]);
    } else if (b.kind === "house") {
      const d = iso(b.x0 + (b.x1 - b.x0) * 0.2, HOUSES + 0.3);
      out.push([d.x, d.y - 80, 50, "255,214,150", 0.3]);
    }
  }
  return out;
}
