import { CHARACTERS } from "@arena/shared";
import {
  TOWN,
  TOWN_BUILDINGS,
  TOWN_DUMMIES,
  TOWN_POND,
  TOWN_ROADS,
  TOWN_PATHS,
  pathPoints,
  TOWN_NEXT_STATUE,
  TOWN_OBSTACLES,
  TOWN_SHRUBS,
  TOWN_SIGNPOSTS,
  TOWN_STALLS,
  TOWN_STATUES,
  TOWN_TREES,
  type TownBuilding,
} from "../../../packages/shared/src/town";

/**
 * Elemental Plaza art, painted once into canvases when the town opens.
 * The ground is one big picture; buildings, trees and props are separate
 * pictures that sort by their foot on screen, so fighters walk behind them.
 * Anything that moves (water, flags, smoke, birds…) lives in town-life.ts.
 */
export type Ctx = CanvasRenderingContext2D;
/** Buildings and props are drawn at this resolution for crisp edges. */
export const ART_RES = 1.5;
/**
 * Phaser draws text into a texture at 1× and the camera then magnifies it
 * (town zoom × device pixel ratio, up to ~4× on phones), which blurs it.
 * Drawing text at the screen's real density keeps it sharp.
 */
export const TEXT_RES = Math.min(4, Math.ceil((typeof devicePixelRatio === "number" ? devicePixelRatio : 1) * 1.6));

/** Deterministic noise so the town looks the same for everyone. */
export const rnd = (i: number) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
const shade = (css: string, k: number) => {
  const n = parseInt(css.slice(1), 16),
    f = (v: number) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};
const ellipse = (ctx: Ctx, x: number, y: number, rx: number, ry: number) => {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
};
const roundRect = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};
// ─────────────────────────── Ground ───────────────────────────

const distToSegment = (x: number, y: number, [x1, y1, x2, y2]: readonly number[]) => {
  const dx = x2 - x1,
    dy = y2 - y1,
    t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (x1 + dx * t), y - (y1 + dy * t));
};

/** Walk a sampled curve every `step` px, giving position and direction. */
function walk(pts: readonly (readonly number[])[], step: number, fn: (x: number, y: number, ux: number, uy: number, d: number) => void) {
  let d = 0,
    next = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1],
      [x2, y2] = pts[i],
      len = Math.hypot(x2 - x1, y2 - y1);
    if (!len) continue;
    const ux = (x2 - x1) / len,
      uy = (y2 - y1) / len;
    while (next <= d + len) {
      const t = next - d;
      fn(x1 + ux * t, y1 + uy * t, ux, uy, next);
      next += step;
    }
    d += len;
  }
}
const strokePath = (ctx: Ctx, pts: readonly (readonly number[])[]) => {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
  ctx.stroke();
};
/** A road's bed: packed dirt edge and mortar (drawn for every road before any cobbles). */
function roadBed(ctx: Ctx, pts: readonly (readonly number[])[], width: number) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#7d6d52";
  ctx.lineWidth = width + (width > 60 ? 22 : 14);
  strokePath(ctx, pts);
  ctx.strokeStyle = "#857a66";
  ctx.lineWidth = width;
  strokePath(ctx, pts);
}
/** Cobbles packed along a road: rows of rounded stones across its width, following its curve. */
function cobbleRoad(ctx: Ctx, pts: readonly (readonly number[])[], width: number, seed: number) {
  const tones = ["#a99d86", "#9d917a", "#b3a78f", "#a1957d", "#bcb09a"];
  // Lanes and footpaths are laid with smaller stones.
  const s = width > 60 ? 1 : 0.75;
  let row = 0;
  walk(pts, 15 * s, (x, y, ux, uy) => {
    for (let k = -width / 2 + 9 * s + (row % 2) * 8 * s; k < width / 2 - 6 * s; k += 17 * s) {
      const i = seed * 1000 + row * 13 + Math.round(k);
      const cx = x - uy * k + (rnd(i) - 0.5) * 3,
        cy = y + ux * k * 0.8 + (rnd(i + 1) - 0.5) * 3;
      ctx.fillStyle = tones[Math.floor(rnd(i + 2) * tones.length)];
      roundRect(ctx, cx - 7 * s, cy - 5 * s, (14 + rnd(i + 3) * 3) * s, 10 * s, 4 * s);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      roundRect(ctx, cx - 6 * s, cy - 5 * s, 9 * s, 3 * s, 2 * s);
      ctx.fill();
    }
    row++;
  });
}

function grass(ctx: Ctx, W: number, H: number) {
  const base = ctx.createLinearGradient(0, 0, W * 0.3, H);
  base.addColorStop(0, "#5f8243");
  base.addColorStop(1, "#4f7036");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  // Large soft light and dark patches (uneven, natural lawn).
  for (let i = 0; i < 160; i++) {
    const x = rnd(i * 3.1) * W,
      y = rnd(i * 5.7) * H,
      r = 80 + rnd(i * 7.3) * 220,
      light = rnd(i * 1.9) > 0.5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, light ? "rgba(140,180,90,0.22)" : "rgba(40,70,30,0.22)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Blades of grass in three tones.
  const blades = ["#6b9150", "#4b6a33", "#77a05a", "#58793d"];
  for (let i = 0; i < 14000; i++) {
    const x = rnd(i * 1.37) * W,
      y = rnd(i * 2.71) * H;
    ctx.fillStyle = blades[i % 4];
    ctx.fillRect(x, y, 2, 4 + rnd(i) * 4);
  }
  // Wildflower clusters.
  const petals = ["#f4d35e", "#ffb3c7", "#ffffff", "#b9a6ff", "#ff9b6a"];
  for (let i = 0; i < 170; i++) {
    const x = rnd(i * 9.1) * W,
      y = rnd(i * 4.3) * H,
      c = petals[i % petals.length];
    for (let k = 0; k < 7; k++) {
      ctx.fillStyle = "#3f6a2c";
      ctx.fillRect(x + (rnd(i * 31 + k) - 0.5) * 34, y + (rnd(i * 17 + k) - 0.5) * 20 + 3, 1.5, 4);
      ctx.fillStyle = c;
      ellipse(ctx, x + (rnd(i * 31 + k) - 0.5) * 34, y + (rnd(i * 17 + k) - 0.5) * 20, 2.6, 2.2);
      ctx.fill();
    }
  }
}

function plaza(ctx: Ctx) {
  const { x, y, r } = TOWN.plaza;
  ctx.fillStyle = "#7d7360";
  ellipse(ctx, x, y, r + 22, (r + 22) * 0.78);
  ctx.fill();
  ctx.fillStyle = "#8f846f";
  ellipse(ctx, x, y, r, r * 0.78);
  ctx.fill();
  // Rings of curved cobbles.
  const tones = ["#b9ad95", "#ada189", "#c2b69e", "#a89c84"];
  for (let ring = 130, n = 0; ring < r - 6; ring += 22, n++)
    for (let a = 0, k = 0; a < Math.PI * 2; a += 20 / ring, k++) {
      const i = n * 997 + k;
      ctx.save();
      ctx.translate(x + Math.cos(a + n * 0.3) * ring, y + Math.sin(a + n * 0.3) * ring * 0.78);
      ctx.rotate(a + n * 0.3 + Math.PI / 2);
      ctx.scale(1, 0.85 + Math.abs(Math.sin(a)) * 0.15);
      ctx.fillStyle = tones[Math.floor(rnd(i) * tones.length)];
      roundRect(ctx, -9, -8, 18, 16, 4);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      roundRect(ctx, -8, -8, 12, 4, 2);
      ctx.fill();
      ctx.restore();
    }
  // A compass star of the eight elements around the fountain.
  const compass = TOWN.plaza.stonesRadius - 17;
  const elements = Object.values(CHARACTERS).map((c) => hex(c.color));
  ctx.fillStyle = "#d9cfb8";
  ellipse(ctx, x, y, compass, compass * 0.78);
  ctx.fill();
  elements.forEach((c, i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    ctx.fillStyle = c;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * (compass - 2), y + Math.sin(a) * (compass - 2) * 0.78);
    ctx.lineTo(x + Math.cos(a + 0.13) * (compass - 24), y + Math.sin(a + 0.13) * (compass - 24) * 0.78);
    ctx.lineTo(x + Math.cos(a - 0.13) * (compass - 24), y + Math.sin(a - 0.13) * (compass - 24) * 0.78);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  });
  ctx.strokeStyle = "rgba(90,78,58,0.45)";
  ctx.lineWidth = 3;
  ellipse(ctx, x, y, compass, compass * 0.78);
  ctx.stroke();
}

function sandArena(ctx: Ctx) {
  const x = 2700,
    y = 1110;
  ctx.fillStyle = "#b69c6c";
  ellipse(ctx, x, y, 360, 220);
  ctx.fill();
  const g = ctx.createRadialGradient(x, y, 20, x, y, 340);
  g.addColorStop(0, "#e2cd9c");
  g.addColorStop(1, "#c9b080");
  ctx.fillStyle = g;
  ellipse(ctx, x, y, 340, 205);
  ctx.fill();
  // Raked lines and pebbles.
  ctx.strokeStyle = "rgba(140,110,70,0.25)";
  ctx.lineWidth = 2;
  for (let k = 0; k < 9; k++) {
    ellipse(ctx, x, y + 40, 80 + k * 30, 40 + k * 17);
    ctx.stroke();
  }
  for (let i = 0; i < 260; i++) {
    const a = rnd(i * 3) * Math.PI * 2,
      d = Math.sqrt(rnd(i * 5)) * 320;
    ctx.fillStyle = i % 2 ? "#9d855a" : "#efe0bb";
    ellipse(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, 2.4, 1.8);
    ctx.fill();
  }
}

function marbleTerrace(ctx: Ctx) {
  const x0 = 1080,
    x1 = 2120,
    y0 = 420,
    y1 = 720;
  ctx.fillStyle = "#7d7594";
  roundRect(ctx, x0 - 10, y0, x1 - x0 + 20, y1 - y0 + 12, 30);
  ctx.fill();
  for (let ty = y0; ty < y1; ty += 40)
    for (let tx = x0; tx < x1; tx += 52) {
      const i = tx * 7 + ty;
      ctx.fillStyle = (Math.floor(tx / 52) + Math.floor(ty / 40)) % 2 ? "#c9c2da" : "#b4acc8";
      ctx.fillRect(tx + 1, ty + 1, 50, 38);
      // Marble veins.
      ctx.strokeStyle = "rgba(120,110,150,0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx + rnd(i) * 50, ty + 2);
      ctx.quadraticCurveTo(tx + rnd(i + 1) * 50, ty + 20, tx + rnd(i + 2) * 50, ty + 38);
      ctx.stroke();
    }
  // A purple runner leading to the hall doors.
  ctx.fillStyle = "#6c4fb0";
  ctx.fillRect(1550, y0, 100, y1 - y0);
  ctx.fillStyle = "#e2c25b";
  ctx.fillRect(1550, y0, 6, y1 - y0);
  ctx.fillRect(1644, y0, 6, y1 - y0);
}

function trainingYard(ctx: Ctx) {
  const x = 640,
    y = 930;
  ctx.fillStyle = "#86694a";
  ellipse(ctx, x, y, 300, 175);
  ctx.fill();
  const g = ctx.createRadialGradient(x, y, 30, x, y, 290);
  g.addColorStop(0, "#b49268");
  g.addColorStop(1, "#9c7c55");
  ctx.fillStyle = g;
  ellipse(ctx, x, y, 285, 162);
  ctx.fill();
  // Scuffs and footprints.
  for (let i = 0; i < 140; i++) {
    const a = rnd(i * 11) * Math.PI * 2,
      d = Math.sqrt(rnd(i * 13)) * 260;
    ctx.fillStyle = "rgba(90,66,40,0.35)";
    ellipse(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, 5, 2.5);
    ctx.fill();
  }
  // A low wooden fence, open toward the plaza road.
  for (let a = 0; a < Math.PI * 2; a += 0.11) {
    if (a > -0.6 + Math.PI * 2 * 0 && a < 0.55) continue; // gap to the east
    const px = x + Math.cos(a) * 300,
      py = y + Math.sin(a) * 177;
    ctx.fillStyle = `rgba(20,28,12,${SUN.alpha})`;
    ctx.fillRect(px - 2, py + 2, 6, 4);
    ctx.fillStyle = "#6e4f30";
    ctx.fillRect(px - 3, py - 16, 6, 18);
    ctx.fillStyle = "#8c6a44";
    ctx.fillRect(px - 3, py - 16, 2, 18);
  }
  ctx.strokeStyle = "#7b5a38";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(x, y - 9, 300, 177, 0, 0.55, Math.PI * 2 - 0.6);
  ctx.stroke();
}

function marketSquare(ctx: Ctx) {
  const x = 740,
    y = 1590;
  ctx.fillStyle = "#857a66";
  ellipse(ctx, x, y, 330, 180);
  ctx.fill();
  const tones = ["#c4ab8a", "#b89e7d", "#cdb595", "#b29776"];
  for (let ty = y - 170; ty < y + 170; ty += 16)
    for (let tx = x - 330; tx < x + 330; tx += 22) {
      const ox = (Math.floor(ty / 16) % 2) * 11;
      if (Math.hypot((tx + ox - x) / 318, (ty - y) / 170) > 1) continue;
      ctx.fillStyle = tones[Math.floor(rnd(tx * 3 + ty) * 4)];
      roundRect(ctx, tx + ox, ty, 20, 14, 3);
      ctx.fill();
    }
}

/** A small cobbled square in front of the Notice Board, where its roads meet. */
function noticeCourt(ctx: Ctx) {
  const x = 1600,
    y = 1740,
    rx = 220,
    ry = 92;
  ctx.fillStyle = "#7d6d52";
  ellipse(ctx, x, y, rx + 10, ry + 8);
  ctx.fill();
  ctx.fillStyle = "#857a66";
  ellipse(ctx, x, y, rx, ry);
  ctx.fill();
  const tones = ["#b3a78f", "#a99d86", "#bcb09a", "#a1957d"];
  for (let ty = y - ry; ty < y + ry; ty += 14)
    for (let tx = x - rx; tx < x + rx; tx += 19) {
      const ox = (Math.floor(ty / 14) % 2) * 9;
      if (Math.hypot((tx + ox + 8 - x) / (rx - 8), (ty + 6 - y) / (ry - 6)) > 1) continue;
      ctx.fillStyle = tones[Math.floor(rnd(tx * 5 + ty) * 4)];
      roundRect(ctx, tx + ox, ty, 17, 12, 4);
      ctx.fill();
    }
  // Kerb ring.
  ctx.strokeStyle = "#a49880";
  ctx.lineWidth = 5;
  ellipse(ctx, x, y, rx, ry);
  ctx.stroke();
  ctx.strokeStyle = "rgba(60,50,36,0.35)";
  ctx.lineWidth = 1.5;
  ellipse(ctx, x, y + 2, rx + 2, ry + 2);
  ctx.stroke();
}

function pond(ctx: Ctx) {
  const { x, y, rx, ry } = TOWN_POND;
  ctx.fillStyle = "#c9b58a";
  ellipse(ctx, x, y + 4, rx + 22, ry + 16);
  ctx.fill();
  ctx.fillStyle = "#7a6a4a";
  ellipse(ctx, x, y + 2, rx + 6, ry + 5);
  ctx.fill();
  const g = ctx.createRadialGradient(x - 40, y - 20, 10, x, y, rx);
  g.addColorStop(0, "#5ec0d8");
  g.addColorStop(0.7, "#2f8aa8");
  g.addColorStop(1, "#1f5f7a");
  ctx.fillStyle = g;
  ellipse(ctx, x, y, rx, ry);
  ctx.fill();
  // Lily pads and reeds.
  for (let i = 0; i < 9; i++) {
    const a = rnd(i * 5) * Math.PI * 2,
      d = 0.35 + rnd(i * 7) * 0.5,
      px = x + Math.cos(a) * rx * d,
      py = y + Math.sin(a) * ry * d;
    ctx.fillStyle = "#4f9a4a";
    ctx.beginPath();
    ctx.ellipse(px, py, 13, 8, 0, 0.3, Math.PI * 2);
    ctx.lineTo(px, py);
    ctx.fill();
    if (i % 3 === 0) {
      ctx.fillStyle = "#ffc6dc";
      ellipse(ctx, px + 3, py - 2, 4, 3);
      ctx.fill();
    }
  }
  for (let i = 0; i < 26; i++) {
    const a = Math.PI * (0.9 + rnd(i * 3) * 1.2),
      px = x + Math.cos(a) * (rx + 2),
      py = y + Math.sin(a) * (ry + 2);
    ctx.strokeStyle = i % 2 ? "#4f7a35" : "#6a9446";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + 3, py - 14, px + (rnd(i) - 0.5) * 8, py - 26);
    ctx.stroke();
    if (i % 4 === 0) {
      ctx.fillStyle = "#6a4a2a";
      ellipse(ctx, px + (rnd(i) - 0.5) * 8, py - 26, 2.5, 6);
      ctx.fill();
    }
  }
}

/** Ground: lawn, roads, district floors, the pond and every static shadow. */
/** Kerb stones along both edges of a road, and worn earth just beyond them. */
function kerbs(ctx: Ctx, pts: readonly (readonly number[])[], width: number, seed: number, own: number) {
  // No kerb across another road (where a lane joins, the kerb opens).
  const onOtherRoad = (x: number, y: number) =>
    TOWN_PATHS.some((p, j) => j !== own && PATH_PIECES[j].some((r) => distToSegment(x, y, r) < p.width / 2 + 3));
  const small = width <= 60;
  for (const side of [-1, 1]) {
    let n = 0;
    walk(pts, small ? 18 : 24, (cx, cy, ux, uy) => {
      const off = side * (width / 2 + 4),
        x = cx - uy * off,
        y = cy + ux * off * 0.8,
        i = seed * 977 + n++ * 7 + side;
      if (onOtherRoad(x, y)) return;
      // Worn, bare earth where people step off the road.
      if (rnd(i * 1.3) < 0.35) {
        ctx.fillStyle = "rgba(120,96,64,0.35)";
        ellipse(ctx, x - uy * side * 14, y + ux * side * 11, 10 + rnd(i) * 12, 4 + rnd(i * 2) * 4);
        ctx.fill();
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(uy * 0.8, ux));
      const w = small ? 16 : 22;
      ctx.fillStyle = "#6f6656";
      roundRect(ctx, -w / 2, -4, w, 8, 2);
      ctx.fill();
      ctx.fillStyle = rnd(i * 3) > 0.5 ? "#a49880" : "#968a73";
      roundRect(ctx, -w / 2, -5, w - 1, 6, 2);
      ctx.fill();
      ctx.restore();
    });
  }
}
/** Each path's curve, sampled once. */
const PATH_POINTS = TOWN_PATHS.map(pathPoints);
const PATH_PIECES = PATH_POINTS.map((pts) => pts.slice(1).map(([x, y], i) => [pts[i][0], pts[i][1], x, y] as const));

/** Fenced front yards and flower beds for the houses. */
function yards(ctx: Ctx) {
  for (const b of TOWN_BUILDINGS) {
    if (b.kind !== "house") continue;
    const left = b.x - b.w / 2 - 12,
      right = b.x + b.w / 2 + 12,
      back = b.y - 26,
      front = b.y + 70;
    // A slightly lusher lawn inside the fence.
    ctx.fillStyle = "rgba(120,170,80,0.18)";
    ctx.fillRect(left, back, right - left, front - back);
    // Flower beds under the windows.
    for (const fx of [b.x - b.w * 0.28, b.x + b.w * 0.36]) {
      ctx.fillStyle = "#5a4330";
      ellipse(ctx, fx, b.y + 10, 30, 8);
      ctx.fill();
      for (let k = 0; k < 9; k++) {
        ctx.fillStyle = "#3f6a2c";
        ellipse(ctx, fx - 24 + k * 6, b.y + 7 + (k % 2) * 3, 3, 2.4);
        ctx.fill();
        ctx.fillStyle = ["#ff7a9b", "#ffd65b", "#ffffff", "#b59bff"][(k + b.w) % 4];
        ellipse(ctx, fx - 24 + k * 6, b.y + 4 + (k % 2) * 3, 2.6, 2.6);
        ctx.fill();
      }
    }
    // White picket fence: sides and front, with a gate gap in the middle.
    const picket = (x: number, y: number) => {
      // The fence stops where a road comes through.
      if (TOWN_ROADS.some((r) => distToSegment(x, y, r) < r[4] / 2 + 10)) return;
      ctx.fillStyle = `rgba(20,28,12,${SUN.alpha})`;
      ctx.fillRect(x - 1, y + 1, 5, 3);
      ctx.fillStyle = "#f2ede2";
      ctx.beginPath();
      ctx.moveTo(x - 2, y);
      ctx.lineTo(x - 2, y - 14);
      ctx.lineTo(x, y - 17);
      ctx.lineTo(x + 2, y - 14);
      ctx.lineTo(x + 2, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#c9c2b2";
      ctx.fillRect(x + 1, y - 14, 1, 14);
    };
    for (let y = back; y <= front; y += 10) {
      picket(left, y);
      picket(right, y);
    }
    for (let x = left; x <= right; x += 10) if (Math.abs(x - b.x) > 40) picket(x, front);
  }
}

export function paintGround(ground: Ctx) {
  let ctx = ground;
  const { width: W, height: H } = TOWN;
  grass(ctx, W, H);
  // Patches of bare earth in the lawn.
  for (let i = 0; i < 26; i++) {
    const x = rnd(i * 17.3) * W,
      y = rnd(i * 23.9) * H,
      g = ctx.createRadialGradient(x, y, 0, x, y, 40 + rnd(i) * 40);
    g.addColorStop(0, "rgba(130,104,70,0.4)");
    g.addColorStop(1, "rgba(130,104,70,0)");
    ctx.fillStyle = g;
    ellipse(ctx, x, y, 80, 46);
    ctx.fill();
  }
  // Beds for every road first, then cobbles narrowest-first so wider roads
  // pave over the ends of the lanes that join them, then the kerbs.
  const order = TOWN_PATHS.map((p, i) => i).sort((a, b) => TOWN_PATHS[a].width - TOWN_PATHS[b].width);
  for (const i of order) roadBed(ctx, PATH_POINTS[i], TOWN_PATHS[i].width);
  for (const i of order) cobbleRoad(ctx, PATH_POINTS[i], TOWN_PATHS[i].width, i + 1);
  for (const i of order) kerbs(ctx, PATH_POINTS[i], TOWN_PATHS[i].width, i + 1, i);
  yards(ctx);
  plaza(ctx);
  // Moss in the joints of the plaza's older stones.
  for (let i = 0; i < 700; i++) {
    const a = rnd(i * 3.7) * Math.PI * 2,
      d = 160 + rnd(i * 5.3) * (TOWN.plaza.r - 160);
    ctx.fillStyle = `rgba(80,110,50,${0.18 + rnd(i) * 0.2})`;
    ellipse(ctx, TOWN.plaza.x + Math.cos(a) * d, TOWN.plaza.y + Math.sin(a) * d * 0.78, 2 + rnd(i * 2) * 2, 1.2);
    ctx.fill();
  }
  sandArena(ctx);
  // Paving all round the coliseum's podium, so it stands on stone.
  for (const b of TOWN_BUILDINGS)
    if (b.kind === "coliseum") {
      const y = b.y + COLISEUM.footY + 14;
      ctx.fillStyle = "#8a7f69";
      ellipse(ctx, b.x, y, COLISEUM.rx + 70, COLISEUM.ry + 40);
      ctx.fill();
      ctx.fillStyle = "#a3977f";
      ellipse(ctx, b.x, y - 2, COLISEUM.rx + 62, COLISEUM.ry + 36);
      ctx.fill();
    }
  marbleTerrace(ctx);
  trainingYard(ctx);
  marketSquare(ctx);
  noticeCourt(ctx);
  pond(ctx);
  // Shadows of everything tall (they fall down and to the right), drawn
  // solid into one layer, then blurred onto the ground once (see SUN).
  const layer = document.createElement("canvas");
  layer.width = W;
  layer.height = H;
  const lit = ctx;
  ctx = layer.getContext("2d")!;
  ctx.fillStyle = "#000";
  for (const b of TOWN_BUILDINGS) castShadow(ctx, b);
  {
    const f = TOWN_OBSTACLES.find((o) => o.kind === "fountain")!;
    sunShadow(ctx, f.x, f.y + 24, 112, 62, 40);
  }
  // Trees: trunk at the base, crown shadow further out.
  for (const t of TOWN_TREES) {
    const pine = t.variant === 3;
    sunShadow(ctx, t.x, t.y + 2, 8, 4, 60);
    sunShadow(ctx, t.x + 24, t.y + 6, pine ? 22 : 34, pine ? 9 : 14, pine ? 140 : 90, pine ? 0.8 : 1.15);
  }
  for (const st of TOWN_STALLS) sunShadow(ctx, st.x, st.y + 26, 86, 18, 140);
  for (const d of TOWN_DUMMIES) sunShadow(ctx, d.x, d.y + 4, 14, 6, 90);
  for (const sh of TOWN_SHRUBS) sunShadow(ctx, sh.x, sh.y + 4, sh.kind === "rock" ? 18 : 24, sh.kind === "rock" ? 7 : 9, sh.kind === "rock" ? 24 : 34);
  for (const sp of TOWN_SIGNPOSTS) sunShadow(ctx, sp.x, sp.y + 2, 6, 3, 100);
  for (const st of [...TOWN_STATUES, TOWN_NEXT_STATUE]) sunShadow(ctx, st.x, st.y + 6, 40, 12, 140);
  for (const o of TOWN_OBSTACLES)
    if (o.shape === "round" && o.kind === "lamp") sunShadow(ctx, o.x, o.y + 2, 6, 3, 120);
    else if (o.shape === "round" && o.kind === "obelisk") sunShadow(ctx, o.x, o.y + 4, 30, 10, 280);
    else if (o.shape === "round" && o.kind === "well") sunShadow(ctx, o.x, o.y + 4, 34, 12, 110);
    else if (o.shape === "round" && o.kind === "mirror") sunShadow(ctx, o.x, o.y + 2, 20, 6, 150);
    else if (o.shape === "box" && o.kind === "board") sunShadow(ctx, o.x, o.y + 8, 130, 14, 180);
    else if (o.shape === "box" && o.kind === "crates") sunShadow(ctx, o.x, o.y + 6, 32, 12, 60);
  lit.save();
  lit.shadowColor = `rgba(20,28,12,${SUN.alpha})`;
  lit.shadowBlur = SUN.blur;
  lit.shadowOffsetX = W + 100;
  lit.drawImage(layer, -(W + 100), 0);
  lit.restore();
  layer.width = layer.height = 0;
  ctx = lit;
  // Grass tufts over the road edges keep them from looking stamped on.
  for (let i = 0; i < 1600; i++) {
    const x = rnd(i * 4.7) * W,
      y = rnd(i * 6.1) * H,
      d = Math.min(...TOWN_ROADS.map((r) => Math.abs(distToSegment(x, y, r) - (r[4] / 2 + 6))));
    if (d > 6) continue;
    ctx.fillStyle = i % 2 ? "#5d8443" : "#6f9a52";
    ctx.fillRect(x, y - 3, 2, 6);
    ctx.fillRect(x + 3, y - 1, 2, 5);
  }
}

// ─────────────────────────── Buildings ───────────────────────────

/** A picture to place in the world: drawn in local coordinates around an anchor. */
export interface Sprite {
  w: number;
  h: number;
  /** The anchor (where the object meets the ground), from the top-left. */
  ax: number;
  ay: number;
  draw: (ctx: Ctx) => void;
}

const stoneWall = (ctx: Ctx, x: number, y: number, w: number, h: number, base: string, seed: number) => {
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  for (let ty = y, row = 0; ty < y + h; ty += 14, row++)
    for (let tx = x - (row % 2) * 14; tx < x + w; tx += 28) {
      const i = seed + row * 31 + tx;
      ctx.fillStyle = `rgba(${rnd(i) > 0.5 ? "255,255,255" : "0,0,0"},${0.04 + rnd(i + 1) * 0.06})`;
      ctx.fillRect(Math.max(x, tx + 1), ty + 1, Math.min(26, x + w - tx - 1), 12);
    }
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 1;
  for (let ty = y + 14; ty < y + h; ty += 14) {
    ctx.beginPath();
    ctx.moveTo(x, ty);
    ctx.lineTo(x + w, ty);
    ctx.stroke();
  }
};

/**
 * Elemental Coliseum: a round arena building seen from above at a slant.
 * It stands on a two-step stone podium; three tiers of arches wrap the
 * wall (the ground tier opens all the way down to the podium), a glowing
 * gate sits at the front, and through the open top you see the far stands.
 * COLISEUM gives its shape in world units from the building's anchor
 * (front of the podium), so the animated parts line up.
 */
export const COLISEUM = {
  rx: 260,
  ry: 80,
  /** Centre of the wall's foot ellipse, and of its top rim. */
  footY: -96,
  topY: -306,
  podium: 16,
  /** The gate's centre line and top, and its torches. */
  gateTop: -150,
  torches: [-92, 92].map((dx) => ({ dx, dy: -98 })),
  /** Masts along the rim, as angles round the top ellipse. */
  masts: [Math.PI + 0.32, Math.PI + 0.95, Math.PI * 1.5, Math.PI * 2 - 0.95, Math.PI * 2 - 0.32, 0.5, Math.PI - 0.5],
};
const SAND = { light: "#ead7aa", mid: "#d6bd8a", dark: "#a98a5a", deep: "#7d6440", line: "rgba(110,84,50,0.45)" };

function coliseum(b: TownBuilding): Sprite {
  const W = b.w + 140,
    H = 420;
  return {
    w: W,
    h: H,
    ax: W / 2,
    ay: H - 8,
    draw(ctx) {
      const cx = W / 2,
        G = H - 8,
        { rx, ry } = COLISEUM,
        footY = G + COLISEUM.footY,
        topY = G + COLISEUM.topY,
        wallH = footY - topY;
      // ── Podium: two stone steps, each a ring with a lit top and a shaded riser.
      for (const [grow, drop] of [
        [36, 16],
        [18, 8],
      ]) {
        ctx.fillStyle = "#6f6553";
        ellipse(ctx, cx, footY + drop + 8, rx + grow, ry + grow * 0.34);
        ctx.fill();
        const g = ctx.createLinearGradient(0, footY - ry, 0, footY + ry + drop);
        g.addColorStop(0, "#cfc3a8");
        g.addColorStop(1, "#b3a68b");
        ctx.fillStyle = g;
        ellipse(ctx, cx, footY + drop, rx + grow, ry + grow * 0.34);
        ctx.fill();
        // Joints in the step.
        ctx.strokeStyle = "rgba(80,68,48,0.25)";
        ctx.lineWidth = 1;
        for (let k = 1; k < 24; k++) {
          const a = (k / 24) * Math.PI;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * (rx + grow), footY + drop + Math.sin(a) * (ry + grow * 0.34));
          ctx.lineTo(cx + Math.cos(a) * (rx + grow), footY + drop + 8 + Math.sin(a) * (ry + grow * 0.34));
          ctx.stroke();
        }
      }
      // Ambient shadow where the wall meets the podium.
      const ao = ctx.createRadialGradient(cx, footY, rx * 0.8, cx, footY, rx + 26);
      ao.addColorStop(0, "rgba(40,30,18,0.55)");
      ao.addColorStop(1, "rgba(40,30,18,0)");
      ctx.save();
      ctx.translate(cx, footY);
      ctx.scale(1, (ry + 10) / (rx + 26));
      ctx.translate(-cx, -footY);
      ctx.fillStyle = ao;
      ellipse(ctx, cx, footY, rx + 26, rx + 26);
      ctx.fill();
      ctx.restore();

      // ── Through the open top: the far stands, the crowd and the arena floor.
      ctx.save();
      ellipse(ctx, cx, topY, rx - 18, ry - 8);
      ctx.clip();
      ctx.fillStyle = SAND.deep;
      ctx.fillRect(cx - rx, topY - ry, rx * 2, ry * 2);
      for (let k = 0; k < 9; k++) {
        const t = k / 9;
        ctx.fillStyle = k % 2 ? SAND.mid : SAND.dark;
        ellipse(ctx, cx, topY + 6 + k * 7, (rx - 18) * (1 - t * 0.62), (ry - 8) * (1 - t * 0.5));
        ctx.fill();
      }
      const colors = ["#ff7a4f", "#ffd65b", "#7fe7ff", "#b59bff", "#9be07a", "#f4efe2", "#ff8ad0"];
      for (let i = 0; i < 520; i++) {
        const a = Math.PI + rnd(i * 3.1) * Math.PI,
          t = rnd(i * 7.7) * 0.85;
        ctx.fillStyle = colors[i % colors.length];
        ellipse(ctx, cx + Math.cos(a) * (rx - 26) * (1 - t * 0.62), topY + 8 + t * 60 + Math.sin(a) * (ry - 12) * (1 - t * 0.5), 2.3, 2.6);
        ctx.fill();
      }
      ctx.fillStyle = SAND.light;
      ellipse(ctx, cx, topY + 70, rx * 0.34, ry * 0.36);
      ctx.fill();
      ctx.restore();

      // ── The outer wall: a cylinder lit from the upper left.
      const wall = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
      wall.addColorStop(0, SAND.dark);
      wall.addColorStop(0.28, SAND.light);
      wall.addColorStop(0.62, SAND.mid);
      wall.addColorStop(1, SAND.deep);
      ctx.fillStyle = wall;
      ctx.beginPath();
      ctx.ellipse(cx, topY, rx, ry, 0, 0, Math.PI);
      ctx.lineTo(cx - rx, footY);
      ctx.ellipse(cx, footY, rx, ry, 0, Math.PI, 0, true);
      ctx.closePath();
      ctx.fill();
      // The rim's top face.
      ctx.strokeStyle = SAND.light;
      ctx.lineWidth = 10;
      ellipse(ctx, cx, topY, rx - 5, ry - 3);
      ctx.stroke();
      ctx.strokeStyle = SAND.line;
      ctx.lineWidth = 1.2;
      ellipse(ctx, cx, topY, rx - 10, ry - 6);
      ctx.stroke();

      // ── Tiers: [top, height] from the rim downward; the ground tier reaches the foot.
      const tiers: [number, number, "attic" | "arch" | "ground"][] = [
        [0, 40, "attic"],
        [40, 74, "arch"],
        [114, wallH - 114, "ground"],
      ];
      const N = 18,
        step = Math.PI / N;
      for (const [off, th, kind] of tiers) {
        for (let k = 0; k < N; k++) {
          const a = (k + 0.5) * step,
            sin = Math.sin(a),
            x = cx + Math.cos(a) * rx,
            y = topY + sin * ry + off,
            w = rx * step * sin;
          if (kind === "ground" && Math.abs(a - Math.PI / 2) < step * 1.6) continue; // the gate
          const light = 0.35 + 0.65 * Math.max(0, Math.cos(a - Math.PI * 0.7));
          if (kind === "attic") {
            // Small square windows between pilasters.
            ctx.fillStyle = `rgba(60,42,22,${0.55 + 0.25 * (1 - light)})`;
            ctx.fillRect(x - w * 0.22, y + 12, w * 0.44, 14);
          } else {
            const aw = w * 0.62,
              top = y + 8,
              bot = y + th - (kind === "ground" ? 2 : 10);
            ctx.fillStyle = "#3a2a18";
            ctx.beginPath();
            ctx.moveTo(x - aw / 2, bot);
            ctx.lineTo(x - aw / 2, top + aw / 2);
            ctx.arc(x, top + aw / 2, aw / 2, Math.PI, 0);
            ctx.lineTo(x + aw / 2, bot);
            ctx.closePath();
            ctx.fill();
            // Light falling on the inside of each arch.
            ctx.fillStyle = `rgba(255,214,150,${0.08 + 0.1 * light})`;
            ctx.fillRect(x - aw / 2 + 1, bot - Math.min(18, th * 0.25), aw * 0.45, Math.min(18, th * 0.25));
          }
          // Pilaster between bays.
          const px = cx + Math.cos(a + step / 2) * rx,
            pw = Math.max(1.5, 5 * Math.sin(a + step / 2));
          ctx.fillStyle = `rgba(255,248,225,${0.1 + 0.25 * light})`;
          ctx.fillRect(px - pw / 2, topY + Math.sin(a + step / 2) * ry + off + 2, pw, th - 4);
        }
        // A cornice under each tier.
        if (kind !== "ground") {
          const y = topY + off + th;
          ctx.strokeStyle = SAND.deep;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.ellipse(cx, y, rx + 1, ry, 0, 0.02, Math.PI - 0.02);
          ctx.stroke();
          ctx.strokeStyle = "rgba(255,244,214,0.55)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(cx, y - 3, rx + 1, ry, 0, 0.02, Math.PI - 0.02);
          ctx.stroke();
        }
      }
      // A plinth course along the foot of the wall.
      ctx.strokeStyle = SAND.deep;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.ellipse(cx, footY - 4, rx, ry, 0, 0.01, Math.PI - 0.01);
      ctx.stroke();

      // ── The gate: a tall arch reaching the podium, gilded, glowing within.
      const gateFoot = footY + ry,
        gateTop = G + COLISEUM.gateTop,
        gw = 112;
      ctx.fillStyle = SAND.dark;
      roundRect(ctx, cx - gw / 2 - 16, gateTop - 16, gw + 32, gateFoot - gateTop + 16, 66);
      ctx.fill();
      const glow = ctx.createRadialGradient(cx, gateFoot - 30, 8, cx, gateFoot - 50, 120);
      glow.addColorStop(0, "#fff3c4");
      glow.addColorStop(0.35, "#ffd65b");
      glow.addColorStop(0.75, "#a8641a");
      glow.addColorStop(1, "#3a2410");
      ctx.fillStyle = glow;
      roundRect(ctx, cx - gw / 2, gateTop, gw, gateFoot - gateTop, 56);
      ctx.fill();
      ctx.strokeStyle = "#e9c25a";
      ctx.lineWidth = 5;
      roundRect(ctx, cx - gw / 2 - 4, gateTop - 4, gw + 8, gateFoot - gateTop + 4, 60);
      ctx.stroke();
      ctx.fillStyle = "#e9c25a";
      ctx.beginPath();
      ctx.moveTo(cx, gateTop - 30);
      ctx.lineTo(cx + 16, gateTop - 10);
      ctx.lineTo(cx, gateTop + 6);
      ctx.lineTo(cx - 16, gateTop - 10);
      ctx.closePath();
      ctx.fill();
      // Torch brackets either side of the gate (the flames are animated).
      for (const t of COLISEUM.torches) {
        ctx.fillStyle = "#3a2a18";
        ctx.fillRect(cx + t.dx - 3, G + t.dy, 6, 22);
        ctx.fillStyle = "#5a4024";
        ctx.beginPath();
        ctx.moveTo(cx + t.dx - 10, G + t.dy);
        ctx.lineTo(cx + t.dx + 10, G + t.dy);
        ctx.lineTo(cx + t.dx + 5, G + t.dy + 8);
        ctx.lineTo(cx + t.dx - 5, G + t.dy + 8);
        ctx.closePath();
        ctx.fill();
      }
      // Steps down from the gate across the podium to the ground.
      for (let k = 0; k < 4; k++) {
        const y = gateFoot + k * 6;
        ctx.fillStyle = "#8f846f";
        roundRect(ctx, cx - gw / 2 - 10 - k * 6, y + 2, gw + 20 + k * 12, 6, 2);
        ctx.fill();
        ctx.fillStyle = k % 2 ? "#d8cdb2" : "#cbbfa3";
        roundRect(ctx, cx - gw / 2 - 10 - k * 6, y - 2, gw + 20 + k * 12, 5, 2);
        ctx.fill();
      }
    },
  };
}

// Every building below is drawn in the same ¾ view as the coliseum: the
// front stands upright on its foundation, the roof is seen from above so
// it has depth, an eave or cornice throws shade on the wall, the base
// darkens where it meets the ground, and the ground carries the building's
// cast shadow (see castShadow). Geometry the animated parts need (flags,
// smoke, sails, the brazier) is exported per kind.

/** Shade under eaves and at the foot of walls. */
function bandShade(ctx: Ctx, x0: number, x1: number, y: number, h: number, a: number) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, `rgba(25,18,10,${a})`);
  g.addColorStop(1, "rgba(25,18,10,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x0, y, x1 - x0, h);
}
/** Darkening on the ground right along a building's front edge. */
function footShade(ctx: Ctx, x0: number, x1: number, y: number) {
  const g = ctx.createLinearGradient(0, y - 3, 0, y + 9);
  // Same tint as every cast shadow; light, since the cast shadow is under it too.
  g.addColorStop(0, `rgba(20,28,12,${SUN.alpha * 0.6})`);
  g.addColorStop(1, "rgba(20,28,12,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x0 - 4, y - 3, x1 - x0 + 8, 12);
}
/** A stepped ring (plinth) around a round building's foot. */
function ringSteps(ctx: Ctx, cx: number, footY: number, rx: number, ry: number, steps: [number, number][], top: string, side: string) {
  for (const [grow, drop] of steps) {
    ctx.fillStyle = side;
    ellipse(ctx, cx, footY + drop + 7, rx + grow, ry + grow * 0.4);
    ctx.fill();
    ctx.fillStyle = top;
    ellipse(ctx, cx, footY + drop, rx + grow, ry + grow * 0.4);
    ctx.fill();
  }
}
/** Contact shadow where a round wall meets its plinth. */
function ringShade(ctx: Ctx, cx: number, footY: number, rx: number, ry: number) {
  ctx.save();
  ctx.translate(cx, footY);
  ctx.scale(1, (ry + 6) / (rx + 14));
  const g = ctx.createRadialGradient(0, 0, rx * 0.75, 0, 0, rx + 14);
  g.addColorStop(0, `rgba(20,28,12,${SUN.alpha})`);
  g.addColorStop(1, "rgba(20,28,12,0)");
  ctx.fillStyle = g;
  ellipse(ctx, 0, 0, rx + 14, rx + 14);
  ctx.fill();
  ctx.restore();
}
/** A round wall from its foot ellipse up to its top ellipse, lit from the upper left. */
function cylinder(ctx: Ctx, cx: number, footY: number, topY: number, rFoot: number, rTop: number, ratio: number, stops: string[]) {
  const g = ctx.createLinearGradient(cx - rFoot, 0, cx + rFoot, 0);
  stops.forEach((c, k) => g.addColorStop(k / (stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, topY, rTop, rTop * ratio, 0, 0, Math.PI);
  ctx.lineTo(cx - rFoot, footY);
  ctx.ellipse(cx, footY, rFoot, rFoot * ratio, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
}

// ── Raid Hall ──
export const TEMPLE = {
  /** Top of the entablature's front, the pediment apex, and how far the roof runs back. */
  entTop: -292,
  apex: -362,
  back: 64,
};
/** Raid Hall: a columned temple on a stepped base, its roof running back. */
function temple(b: TownBuilding): Sprite {
  const W = b.w + 140,
    H = 450;
  return {
    w: W,
    h: H,
    ax: W / 2,
    ay: H - 8,
    draw(ctx) {
      const cx = W / 2,
        G = H - 8,
        hw = b.w / 2;
      // ── Stepped base: three steps, each with a lit tread and a shaded riser.
      footShade(ctx, cx - hw - 40, cx + hw + 40, G);
      for (let k = 0; k < 3; k++) {
        const half = hw + 40 - k * 12,
          riserTop = G - 12 * (k + 1) - 8 * k;
        ctx.fillStyle = "#8f87ab";
        ctx.fillRect(cx - half, riserTop, half * 2, 12);
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.fillRect(cx - half, riserTop + 10, half * 2, 2);
        ctx.fillStyle = k % 2 ? "#ddd8ea" : "#cfc8de";
        ctx.fillRect(cx - half, riserTop - 8, half * 2, 8);
      }
      const floor = G - 12 * 3 - 8 * 3 + 8; // top tread
      const colTop = floor - 196;
      // ── The cella wall behind the columns, with the glowing doorway.
      ctx.fillStyle = "#3f3760";
      ctx.fillRect(cx - hw + 24, colTop, b.w - 48, floor - colTop);
      bandShade(ctx, cx - hw + 24, cx + hw - 24, colTop, 50, 0.5);
      const door = ctx.createRadialGradient(cx, floor - 50, 8, cx, floor - 70, 120);
      door.addColorStop(0, "#f2e7ff");
      door.addColorStop(0.3, "#b59bff");
      door.addColorStop(1, "#2a1f4a");
      ctx.fillStyle = door;
      roundRect(ctx, cx - 56, floor - 160, 112, 160, 56);
      ctx.fill();
      // Light from the door spilling onto the floor.
      const spill = ctx.createRadialGradient(cx, floor + 2, 4, cx, floor + 2, 120);
      spill.addColorStop(0, "rgba(220,200,255,0.5)");
      spill.addColorStop(1, "rgba(220,200,255,0)");
      ctx.fillStyle = spill;
      ctx.fillRect(cx - 120, floor - 8, 240, 30);
      // ── Columns, each with a base, fluting, a capital and shade at its foot.
      const n = 8;
      for (let k = 0; k < n; k++) {
        const px = cx - hw + 30 + (k * (b.w - 60)) / (n - 1);
        if (Math.abs(px - cx) < 70) continue;
        ctx.fillStyle = "rgba(40,30,70,0.35)";
        ellipse(ctx, px + 6, floor + 1, 26, 6);
        ctx.fill();
        const g = ctx.createLinearGradient(px - 16, 0, px + 16, 0);
        g.addColorStop(0, "#a69ebf");
        g.addColorStop(0.35, "#f4f1fa");
        g.addColorStop(1, "#8a82a6");
        ctx.fillStyle = g;
        ctx.fillRect(px - 15, colTop + 10, 30, floor - colTop - 20);
        ctx.strokeStyle = "rgba(90,80,120,0.22)";
        ctx.lineWidth = 1;
        for (let f = -9; f <= 9; f += 4.5) {
          ctx.beginPath();
          ctx.moveTo(px + f, colTop + 14);
          ctx.lineTo(px + f, floor - 12);
          ctx.stroke();
        }
        // Base (torus) and capital, each with a top face.
        for (const [y, hgt] of [
          [floor - 12, 12],
          [colTop, 12],
        ]) {
          ctx.fillStyle = "#b9b1cc";
          ctx.fillRect(px - 20, y, 40, hgt);
          ctx.fillStyle = "#e4e0ee";
          ctx.fillRect(px - 20, y, 40, 4);
        }
        if (k === 1 || k === n - 2) {
          // Banners hung between the outer columns.
          const bx = px + 22;
          ctx.fillStyle = "#6c4fb0";
          ctx.beginPath();
          ctx.moveTo(bx, colTop + 20);
          ctx.lineTo(bx + 40, colTop + 20);
          ctx.lineTo(bx + 40, colTop + 120);
          ctx.lineTo(bx + 20, colTop + 104);
          ctx.lineTo(bx, colTop + 120);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#e2c25b";
          ctx.fillRect(bx, colTop + 20, 40, 5);
          ctx.beginPath();
          ctx.arc(bx + 20, colTop + 60, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // ── Entablature: a front face and a lit top face going back.
      const entY = colTop - 30,
        eh = hw + 6;
      ctx.fillStyle = "#ece8f4";
      ctx.beginPath();
      ctx.moveTo(cx - eh, entY);
      ctx.lineTo(cx - eh + 10, entY - TEMPLE.back * 0.35);
      ctx.lineTo(cx + eh - 10, entY - TEMPLE.back * 0.35);
      ctx.lineTo(cx + eh, entY);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#d8d2ea";
      ctx.fillRect(cx - eh, entY, eh * 2, 30);
      ctx.fillStyle = "#b9b1cc";
      for (let tx = cx - eh + 10; tx < cx + eh - 10; tx += 34) ctx.fillRect(tx, entY + 9, 14, 13);
      ctx.fillStyle = "#e9c25a";
      ctx.fillRect(cx - eh, entY + 27, eh * 2, 3);
      bandShade(ctx, cx - hw + 24, cx + hw - 24, entY + 30, 26, 0.45);
      // ── Roof: two slopes running back from the pediment to the ridge.
      const apexY = entY - 70,
        back = TEMPLE.back;
      ctx.fillStyle = "#6a54b8";
      ctx.beginPath();
      ctx.moveTo(cx - eh - 14, entY + 2);
      ctx.lineTo(cx, apexY);
      ctx.lineTo(cx, apexY - back);
      ctx.lineTo(cx - eh - 4, entY - back * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#4a3a8a";
      ctx.beginPath();
      ctx.moveTo(cx + eh + 14, entY + 2);
      ctx.lineTo(cx, apexY);
      ctx.lineTo(cx, apexY - back);
      ctx.lineTo(cx + eh + 4, entY - back * 0.6);
      ctx.closePath();
      ctx.fill();
      // Tile rows on both slopes.
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 2;
      for (let k = 1; k < 6; k++) {
        const t = k / 6;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx + side * (eh + 14) * (1 - t), entY + 2 + (apexY - entY - 2) * t);
          ctx.lineTo(cx + side * (eh + 4) * (1 - t), entY - back * 0.6 + (apexY - back - entY + back * 0.6) * t);
          ctx.stroke();
        }
      }
      ctx.strokeStyle = "#e9c25a";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx, apexY);
      ctx.lineTo(cx, apexY - back);
      ctx.stroke();
      // ── The pediment: a gable on the front with a recessed tympanum.
      ctx.fillStyle = "#e4e0ee";
      ctx.beginPath();
      ctx.moveTo(cx - eh - 16, entY + 2);
      ctx.lineTo(cx, apexY - 4);
      ctx.lineTo(cx + eh + 16, entY + 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#b4acc8";
      ctx.beginPath();
      ctx.moveTo(cx - eh + 18, entY - 4);
      ctx.lineTo(cx, apexY + 12);
      ctx.lineTo(cx + eh - 18, entY - 4);
      ctx.closePath();
      ctx.fill();
      bandShade(ctx, cx - eh + 30, cx + eh - 30, apexY + 14, 30, 0.25);
      ctx.fillStyle = "#2a1f4a";
      ellipse(ctx, cx, entY - 26, 22, 18);
      ctx.fill();
      ctx.strokeStyle = "#e9c25a";
      ctx.lineWidth = 3;
      ellipse(ctx, cx, entY - 26, 22, 18);
      ctx.stroke();
      ctx.fillStyle = "#e9c25a";
      ctx.beginPath();
      ctx.moveTo(cx, entY - 40);
      ctx.lineTo(cx + 9, entY - 26);
      ctx.lineTo(cx, entY - 12);
      ctx.lineTo(cx - 9, entY - 26);
      ctx.closePath();
      ctx.fill();
    },
  };
}

// ── Boss Rush tower ──
export const TOWER = { top: -320, brazier: -352, flag: { dx: -44, dy: -342 } };
/** Boss Rush tower: a round stone keep on a plinth, with a crenellated top. */
function tower(b: TownBuilding): Sprite {
  const W = b.w + 90,
    H = 450;
  return {
    w: W,
    h: H,
    ax: W / 2,
    ay: H - 8,
    draw(ctx) {
      const cx = W / 2,
        G = H - 8,
        rx = b.w / 2,
        ratio = 0.38,
        ry = rx * ratio,
        footY = G - ry - 12,
        topY = G + TOWER.top;
      ringSteps(ctx, cx, footY, rx, ry, [[18, 10], [8, 4]], "#a59a86", "#6f6553");
      ringShade(ctx, cx, footY, rx, ry);
      cylinder(ctx, cx, footY, topY, rx, rx - 8, ratio, ["#4f463c", "#a3957f", "#857866", "#3f362d"]);
      // Brick courses that follow the curve.
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.lineWidth = 1;
      for (let y = topY + 14, row = 0; y < footY; y += 15, row++) {
        const r = rx - 8 + ((y - topY) / (footY - topY)) * 8;
        ctx.beginPath();
        ctx.ellipse(cx, y, r, r * ratio, 0, 0.08, Math.PI - 0.08);
        ctx.stroke();
        for (let k = -3; k <= 3; k++) {
          const a = Math.PI / 2 + (k + (row % 2) * 0.5) * 0.36,
            x = cx + Math.cos(a) * r,
            yy = y + Math.sin(a) * r * ratio;
          ctx.beginPath();
          ctx.moveTo(x, yy + 1);
          ctx.lineTo(x, yy + 13);
          ctx.stroke();
        }
      }
      // Arrow-slit windows glowing from inside, and the door with a step.
      for (const [dx, y] of [
        [-22, topY + 70],
        [24, topY + 150],
      ]) {
        ctx.fillStyle = "#2a1c14";
        roundRect(ctx, cx + dx - 6, y, 12, 30, 6);
        ctx.fill();
        ctx.fillStyle = "rgba(255,170,80,0.75)";
        roundRect(ctx, cx + dx - 3, y + 4, 6, 22, 3);
        ctx.fill();
      }
      const doorY = footY + ry - 2;
      ctx.fillStyle = "#3a2a1e";
      roundRect(ctx, cx - 27, doorY - 76, 54, 76, 27);
      ctx.fill();
      ctx.fillStyle = "#5a3e28";
      roundRect(ctx, cx - 21, doorY - 70, 42, 70, 21);
      ctx.fill();
      ctx.strokeStyle = "#2a1c14";
      ctx.lineWidth = 2;
      for (const dx of [-8, 8]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx, doorY - 62);
        ctx.lineTo(cx + dx, doorY);
        ctx.stroke();
      }
      ctx.fillStyle = "#e9c25a";
      ellipse(ctx, cx + 12, doorY - 32, 2.5, 2.5);
      ctx.fill();
      ctx.fillStyle = "#b8ad97";
      ctx.fillRect(cx - 34, doorY, 68, 6);
      ctx.fillStyle = "#7d7360";
      ctx.fillRect(cx - 34, doorY + 6, 68, 5);
      // Banner.
      ctx.fillStyle = "#c43c2a";
      ctx.beginPath();
      ctx.moveTo(cx + 30, topY + 60);
      ctx.lineTo(cx + 62, topY + 56);
      ctx.lineTo(cx + 62, topY + 150);
      ctx.lineTo(cx + 46, topY + 136);
      ctx.lineTo(cx + 30, topY + 152);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffd65b";
      ctx.fillRect(cx + 30, topY + 58, 32, 5);
      // The top: a walkway floor inside a crenellated parapet.
      const pr = rx - 2;
      ctx.fillStyle = "#6f6553";
      ellipse(ctx, cx, topY, pr + 6, (pr + 6) * ratio);
      ctx.fill();
      ctx.fillStyle = "#3d342b";
      ellipse(ctx, cx, topY - 2, pr - 6, (pr - 6) * ratio);
      ctx.fill();
      // Back merlons, then the brazier, then front merlons.
      const merlon = (a: number) => {
        const x = cx + Math.cos(a) * pr,
          y = topY + Math.sin(a) * pr * ratio,
          w = 14 * Math.max(0.45, Math.abs(Math.sin(a)) * 0.6 + 0.4);
        ctx.fillStyle = "#9a8c78";
        ctx.fillRect(x - w / 2, y - 20, w, 20);
        ctx.fillStyle = "#b8ad97";
        ctx.fillRect(x - w / 2, y - 22, w, 4);
      };
      for (let k = 0; k < 7; k++) merlon(Math.PI + 0.25 + k * 0.45);
      ctx.fillStyle = "#3a2a20";
      ctx.beginPath();
      ctx.moveTo(cx - 20, topY - 28);
      ctx.lineTo(cx + 20, topY - 28);
      ctx.lineTo(cx + 10, topY - 8);
      ctx.lineTo(cx - 10, topY - 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#2a1c14";
      ctx.fillRect(cx - 3, topY - 10, 6, 10);
      for (let k = 0; k < 7; k++) merlon(0.25 + k * 0.45);
    },
  };
}

// ── Windmill ──
/** Where the sails' hub sits, relative to the windmill's ground anchor. */
export const WINDMILL_HUB = { dx: 0, dy: -262 };
/** Windmill body: a tapered tower on a stone base; the sails spin separately. */
function windmill(b: TownBuilding): Sprite {
  const W = b.w + 90,
    H = 350;
  return {
    w: W,
    h: H,
    ax: W / 2,
    ay: H - 8,
    draw(ctx) {
      const cx = W / 2,
        G = H - 8,
        rx = b.w / 2,
        ratio = 0.38,
        ry = rx * ratio,
        footY = G - ry - 10,
        topY = G + WINDMILL_HUB.dy + 34;
      ringSteps(ctx, cx, footY, rx, ry, [[12, 8]], "#a59a86", "#6f6553");
      ringShade(ctx, cx, footY, rx, ry);
      // Stone base course, then white weatherboarded walls tapering up.
      cylinder(ctx, cx, footY, footY - 36, rx, rx - 3, ratio, ["#6f6553", "#b8ad97", "#9a8e76", "#5d5446"]);
      cylinder(ctx, cx, footY - 34, topY, rx - 3, rx * 0.6, ratio, ["#cfc5b0", "#fbf7ee", "#e2d8c4", "#b0a690"]);
      ctx.strokeStyle = "rgba(120,100,70,0.22)";
      ctx.lineWidth = 1;
      for (let y = topY + 10; y < footY - 36; y += 9) {
        const t = (y - topY) / (footY - 36 - topY),
          r = rx * 0.6 + (rx - 3 - rx * 0.6) * t;
        ctx.beginPath();
        ctx.ellipse(cx, y, r, r * ratio, 0, 0.1, Math.PI - 0.1);
        ctx.stroke();
      }
      // Gallery band, window and door with a step.
      ctx.strokeStyle = "#6e4f30";
      ctx.lineWidth = 6;
      const gy = topY + (footY - topY) * 0.45,
        gr = rx * 0.6 + (rx - 3 - rx * 0.6) * 0.45;
      ctx.beginPath();
      ctx.ellipse(cx, gy, gr + 6, (gr + 6) * ratio, 0, 0.05, Math.PI - 0.05);
      ctx.stroke();
      ctx.fillStyle = "#ffe2a0";
      roundRect(ctx, cx - 10, gy - 52, 20, 26, 8);
      ctx.fill();
      ctx.fillStyle = "#5a3e28";
      ctx.fillRect(cx - 12, gy - 54, 24, 3);
      const doorY = footY + ry - 2;
      ctx.fillStyle = "#4a3220";
      roundRect(ctx, cx - 19, doorY - 54, 38, 54, 18);
      ctx.fill();
      ctx.fillStyle = "#6e4f30";
      roundRect(ctx, cx - 15, doorY - 50, 30, 50, 15);
      ctx.fill();
      ctx.fillStyle = "#b8ad97";
      ctx.fillRect(cx - 24, doorY, 48, 5);
      ctx.fillStyle = "#7d7360";
      ctx.fillRect(cx - 24, doorY + 5, 48, 4);
      // The cap: a rounded wooden roof seen from above, its eave shading the wall.
      const capR = rx * 0.6 + 10;
      bandShade(ctx, cx - capR, cx + capR, topY + 2, 18, 0.35);
      const cap = ctx.createLinearGradient(cx - capR, 0, cx + capR, 0);
      cap.addColorStop(0, "#c25a48");
      cap.addColorStop(0.4, "#d8735e");
      cap.addColorStop(1, "#8a3a2e");
      ctx.fillStyle = cap;
      ctx.beginPath();
      ctx.ellipse(cx, topY, capR, capR * ratio, 0, 0, Math.PI);
      ctx.quadraticCurveTo(cx - capR, topY - 70, cx, topY - 74);
      ctx.quadraticCurveTo(cx + capR, topY - 70, cx + capR, topY);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 2;
      for (const dx of [-0.5, 0, 0.5]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx * capR * 0.9, topY + capR * ratio * Math.sqrt(1 - dx * dx) - 2);
        ctx.quadraticCurveTo(cx + dx * capR * 0.7, topY - 50, cx, topY - 72);
        ctx.stroke();
      }
      ctx.fillStyle = "#6e4f30";
      ellipse(ctx, cx, topY - 74, 5, 4);
      ctx.fill();
    },
  };
}
export function windmillSails(): Sprite {
  const S = 320;
  return {
    w: S,
    h: S,
    ax: S / 2,
    ay: S / 2,
    draw(ctx) {
      const c = S / 2;
      for (let k = 0; k < 4; k++) {
        ctx.save();
        ctx.translate(c, c);
        ctx.rotate((k * Math.PI) / 2);
        ctx.fillStyle = "#6e4f30";
        ctx.fillRect(-4, -150, 8, 150);
        ctx.fillStyle = "rgba(250,244,230,0.92)";
        ctx.fillRect(4, -146, 34, 110);
        ctx.strokeStyle = "#8a6a44";
        ctx.lineWidth = 2;
        for (let y = -146; y < -36; y += 18) {
          ctx.beginPath();
          ctx.moveTo(4, y);
          ctx.lineTo(38, y);
          ctx.stroke();
        }
        ctx.strokeRect(4, -146, 34, 110);
        ctx.restore();
      }
      ctx.fillStyle = "#4a3624";
      ellipse(ctx, c, c, 14, 14);
      ctx.fill();
    },
  };
}

// ── Houses ──
const ROOFS = ["#b24a3a", "#3f6fa8", "#4f8a4a"];
const WALLS = ["#f2e6cf", "#efe2d0", "#f5ecd9"];
const HOUSE = { found: 14, wall: 98, roof: 96, overhang: 16, hip: 34 };
/** A cosy house in ¾ view: a stone foundation, a timber-framed front, and a tiled hip roof seen from above. */
function house(b: TownBuilding): Sprite {
  const v = (b.variant ?? 0) % 3,
    W = b.w + 80,
    H = 270;
  return {
    w: W,
    h: H,
    ax: W / 2,
    ay: H - 8,
    draw(ctx) {
      const cx = W / 2,
        G = H - 8,
        x0 = cx - b.w / 2,
        x1 = cx + b.w / 2,
        wallBottom = G - HOUSE.found,
        wallTop = wallBottom - HOUSE.wall;
      footShade(ctx, x0, x1, G);
      // Foundation: a stone course, slightly proud of the wall.
      stoneWall(ctx, x0 - 4, wallBottom, b.w + 8, HOUSE.found, "#8f846f", v * 100);
      ctx.fillStyle = "#b8ad97";
      ctx.fillRect(x0 - 4, wallBottom, b.w + 8, 3);
      // The front wall, lit from the left.
      const wall = ctx.createLinearGradient(x0, 0, x1, 0);
      wall.addColorStop(0, shade(WALLS[v], -0.04));
      wall.addColorStop(0.3, WALLS[v]);
      wall.addColorStop(1, shade(WALLS[v], -0.16));
      ctx.fillStyle = wall;
      ctx.fillRect(x0, wallTop, b.w, HOUSE.wall);
      // Timber frame.
      ctx.fillStyle = "#6e4f30";
      ctx.fillRect(x0, wallTop, 7, HOUSE.wall);
      ctx.fillRect(x1 - 7, wallTop, 7, HOUSE.wall);
      ctx.fillRect(x0, wallBottom - 7, b.w, 7);
      ctx.fillRect(cx - 3, wallTop, 7, HOUSE.wall);
      // Windows with warm light, frames, sills and flower boxes.
      for (const wx of [x0 + b.w * 0.24, x1 - b.w * 0.26]) {
        const wy = wallTop + 26;
        ctx.fillStyle = "#4a3220";
        ctx.fillRect(wx - 23, wy - 3, 46, 42);
        const glow = ctx.createLinearGradient(0, wy, 0, wy + 36);
        glow.addColorStop(0, "#ffefb8");
        glow.addColorStop(1, "#f2b93b");
        ctx.fillStyle = glow;
        ctx.fillRect(wx - 19, wy, 38, 34);
        ctx.fillStyle = "#4a3220";
        ctx.fillRect(wx - 1.5, wy, 3, 34);
        ctx.fillRect(wx - 19, wy + 15, 38, 3);
        ctx.fillStyle = "#8a6a44";
        ctx.fillRect(wx - 26, wy + 36, 52, 7);
        for (let k = 0; k < 7; k++) {
          ctx.fillStyle = ["#ff7a9b", "#ffd65b", "#ffffff"][(k + v) % 3];
          ellipse(ctx, wx - 21 + k * 7, wy + 35, 3.5, 3.5);
          ctx.fill();
        }
      }
      // Door with a stone step that sits on the ground.
      const dx = cx + b.w * 0.08;
      ctx.fillStyle = "#3f2a1a";
      roundRect(ctx, dx - 20, wallBottom - 62, 40, 62, 16);
      ctx.fill();
      ctx.fillStyle = "#6b4a2e";
      roundRect(ctx, dx - 16, wallBottom - 58, 32, 58, 13);
      ctx.fill();
      ctx.fillStyle = "#e9c25a";
      ellipse(ctx, dx + 9, wallBottom - 28, 2.5, 2.5);
      ctx.fill();
      ctx.fillStyle = "#c2b79f";
      ctx.fillRect(dx - 26, G - 6, 52, 5);
      ctx.fillStyle = "#857a66";
      ctx.fillRect(dx - 26, G - 1, 52, 4);
      // Shade the eave throws on the wall.
      bandShade(ctx, x0, x1, wallTop, 26, 0.42);
      // ── Hip roof seen from above: the front slope runs from the eave up to
      // the ridge; its ends slope back so the ridge is shorter than the eave.
      const o = HOUSE.overhang,
        eaveY = wallTop + 4,
        ridgeY = eaveY - HOUSE.roof,
        r0 = x0 + HOUSE.hip,
        r1 = x1 - HOUSE.hip,
        roof = ROOFS[v];
      // Fascia (the eave's edge) and its underside.
      ctx.fillStyle = shade(roof, -0.45);
      ctx.fillRect(x0 - o, eaveY - 2, b.w + o * 2, 7);
      // Hip ends: the left one catches light, the right one is in shade.
      ctx.fillStyle = shade(roof, 0.12);
      ctx.beginPath();
      ctx.moveTo(x0 - o, eaveY - 1);
      ctx.lineTo(r0, ridgeY);
      ctx.lineTo(r0 + 12, eaveY - 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade(roof, -0.32);
      ctx.beginPath();
      ctx.moveTo(x1 + o, eaveY - 1);
      ctx.lineTo(r1, ridgeY);
      ctx.lineTo(r1 - 12, eaveY - 1);
      ctx.closePath();
      ctx.fill();
      // The main slope.
      const slope = ctx.createLinearGradient(0, ridgeY, 0, eaveY);
      slope.addColorStop(0, shade(roof, 0.05));
      slope.addColorStop(1, shade(roof, -0.12));
      ctx.fillStyle = slope;
      ctx.beginPath();
      ctx.moveTo(r0 + 10, eaveY - 1);
      ctx.lineTo(r0, ridgeY);
      ctx.lineTo(r1, ridgeY);
      ctx.lineTo(r1 - 10, eaveY - 1);
      ctx.closePath();
      ctx.fill();
      // Tile courses across the whole roof, joints staggered.
      for (let k = 1; k < 8; k++) {
        const t = k / 8,
          y = eaveY - 1 + (ridgeY - eaveY + 1) * t,
          xl = x0 - o + (r0 - x0 + o) * t,
          xr = x1 + o - (x1 + o - r1) * t;
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(xl, y);
        ctx.lineTo(xr, y);
        ctx.stroke();
        ctx.strokeStyle = "rgba(0,0,0,0.12)";
        ctx.lineWidth = 1;
        for (let x = xl + (k % 2) * 8; x < xr; x += 16) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + (eaveY - ridgeY) / 8);
          ctx.stroke();
        }
      }
      // Hip and ridge lines with a cap.
      ctx.strokeStyle = shade(roof, -0.4);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x0 - o, eaveY - 1);
      ctx.lineTo(r0, ridgeY);
      ctx.lineTo(r1, ridgeY);
      ctx.lineTo(x1 + o, eaveY - 1);
      ctx.stroke();
      ctx.strokeStyle = shade(roof, 0.25);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(r0, ridgeY - 1.5);
      ctx.lineTo(r1, ridgeY - 1.5);
      ctx.stroke();
      // Chimney standing on the slope (smoke is animated).
      const chx = x1 - HOUSE.hip - 30,
        chBase = ridgeY + 30;
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(chx + 4, chBase - 4, 26, 10);
      ctx.fillStyle = "#8f5a44";
      ctx.fillRect(chx - 11, chBase - 46, 22, 46);
      ctx.fillStyle = "#6e4334";
      ctx.fillRect(chx + 4, chBase - 46, 7, 46);
      ctx.fillStyle = "#a86a52";
      ctx.fillRect(chx - 14, chBase - 52, 28, 8);
      ctx.fillStyle = "#3a2018";
      ctx.fillRect(chx - 9, chBase - 52, 18, 4);
    },
  };
}
/** Where each house's chimney top is, relative to its ground anchor. */
export const chimneyOf = (b: TownBuilding) => ({
  dx: b.w / 2 - HOUSE.hip - 30,
  dy: -HOUSE.found - HOUSE.wall + 4 - HOUSE.roof + 30 - 54,
});

/**
 * A building's shadow on the ground. The sun is high in the upper left, so
 * shadows fall to the right and a little toward the viewer. Drawn soft,
 * into the ground picture, before the building stands on it.
 */
/** One sun for the whole town: every shadow uses this tone, blur and direction. */
export const SUN = { alpha: 0.34, blur: 14, dx: 0.42, dy: 0.08 };
/*
 * Every shadow in town is drawn as a solid shape into one shadow layer,
 * which is then blurred and laid on the ground once at SUN.alpha. So all
 * shadows have exactly the same darkness, and where two overlap (a tree's
 * shadow across a house's) they merge instead of getting darker, as real
 * shadows do.
 */

/**
 * The shadow of anything standing at (x, y): its footprint (rx × ry),
 * stretched away from the sun in proportion to its height h. Trees, lamps,
 * stalls, statues and buildings all use it, so they read as one scene.
 * `top` widens the far end for things with a crown (trees).
 */
export function sunShadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, h: number, top = 1) {
  const steps = Math.max(4, Math.round(h / 12));
  ctx.beginPath();
  for (let k = 0; k <= steps; k++) {
    const t = k / steps,
      // A crown's shadow is widest near its far end.
      w = rx * (1 + (top - 1) * Math.sin(t * Math.PI * 0.9)),
      cx = x + h * SUN.dx * t,
      cy = y + h * SUN.dy * t;
    ctx.moveTo(cx + Math.max(1, w), cy);
    ctx.ellipse(cx, cy, Math.max(1, w), Math.max(1, ry * (w / rx)), 0, 0, Math.PI * 2);
  }
  ctx.fill("nonzero");
}
export function castShadow(ctx: Ctx, b: TownBuilding) {
  const box = (x0: number, x1: number, front: number, depth: number, h: number) => {
    const sx = h * SUN.dx,
      sy = h * SUN.dy;
    ctx.beginPath();
    ctx.moveTo(x0, front - depth);
    ctx.lineTo(x0, front);
    ctx.lineTo(x0 + sx * 0.5, front + sy);
    ctx.lineTo(x1 + sx, front + sy);
    ctx.lineTo(x1 + sx, front - depth + sy);
    ctx.lineTo(x1, front - depth);
    ctx.closePath();
    ctx.fill();
  };
  const round = (cx: number, footY: number, rx: number, ry: number, h: number) => {
    ctx.beginPath();
    for (let k = 0; k <= 10; k++) {
      const t = k / 10,
        x = cx + h * SUN.dx * t,
        y = footY + h * SUN.dy * t,
        w = rx * (1 - t * 0.25);
      ctx.moveTo(x + w, y);
      ctx.ellipse(x, y, w, ry * (1 - t * 0.2), 0, 0, Math.PI * 2);
    }
    ctx.fill("nonzero");
  };
  if (b.kind === "house") box(b.x - b.w / 2, b.x + b.w / 2, b.y, b.d * 0.7, 200);
  else if (b.kind === "temple") box(b.x - b.w / 2 - 30, b.x + b.w / 2 + 30, b.y - 50, 120, 330);
  else if (b.kind === "tower") round(b.x, b.y - 40, b.w / 2, (b.w / 2) * 0.38, 400);
  else if (b.kind === "windmill") round(b.x, b.y - 36, b.w / 2, (b.w / 2) * 0.38, 260);
  else round(b.x, b.y - 96, 280, 100, 300);
}

export function buildingSprite(b: TownBuilding): Sprite {
  if (b.kind === "coliseum") return coliseum(b);
  if (b.kind === "temple") return temple(b);
  if (b.kind === "tower") return tower(b);
  if (b.kind === "windmill") return windmill(b);
  return house(b);
}

// ─────────────────────────── Trees and props ───────────────────────────

const LEAVES = [
  ["#2f4d26", "#3f6430", "#55803d", "#76a556"],
  ["#2c4a2e", "#3a6340", "#4f8655", "#72ad72"],
  ["#3d4a1f", "#57682b", "#78913a", "#a3bd5a"],
];
/** Tree kinds by variant: 0–2 leafy, 3 pine, 4 birch. */
export function treeTrunk(variant = 0): Sprite {
  const birch = variant === 4;
  return {
    w: 30,
    h: 50,
    ax: 15,
    ay: 46,
    draw(ctx) {
      const g = ctx.createLinearGradient(6, 0, 24, 0);
      g.addColorStop(0, birch ? "#b9b3a6" : "#4a3220");
      g.addColorStop(0.5, birch ? "#f4f1ea" : "#7a5638");
      g.addColorStop(1, birch ? "#a39d90" : "#3f2a1a");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(8, 46);
      ctx.lineTo(11, 0);
      ctx.lineTo(19, 0);
      ctx.lineTo(22, 46);
      ctx.quadraticCurveTo(15, 50, 8, 46);
      ctx.fill();
      // Bark: dark birch marks, or furrows.
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = birch ? "#2c2a28" : "rgba(30,18,10,0.35)";
        ctx.fillRect(11 + rnd(k * 3 + variant) * 6, 4 + k * 7, birch ? 4 : 1.5, birch ? 2 : 6);
      }
    },
  };
}
/** A pine: stacked boughs, darker and cooler than the leafy trees. */
function pineCanopy(): Sprite {
  const W = 110,
    H = 180;
  return {
    w: W,
    h: H,
    ax: W / 2,
    ay: H - 20,
    draw(ctx) {
      const tiers = 5;
      for (let k = 0; k < tiers; k++) {
        const t = k / (tiers - 1),
          y = H - 14 - k * 30,
          hw = 50 - t * 34;
        for (const [dx, col] of [
          [2, "#1d3a24"],
          [0, "#2a5232"],
        ] as const) {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(W / 2 - hw + dx, y);
          ctx.quadraticCurveTo(W / 2 + dx, y + 8, W / 2 + hw + dx, y);
          ctx.lineTo(W / 2 + dx, y - 46);
          ctx.closePath();
          ctx.fill();
        }
        // Lit left side of each bough.
        ctx.fillStyle = "#3f7046";
        ctx.beginPath();
        ctx.moveTo(W / 2 - hw + 4, y - 2);
        ctx.lineTo(W / 2 - 2, y - 42);
        ctx.lineTo(W / 2 - hw * 0.35, y - 4);
        ctx.closePath();
        ctx.fill();
      }
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = i % 2 ? "#5a8a5c" : "#244a2c";
        ellipse(ctx, W / 2 + (rnd(i * 7) - 0.5) * 60 * (rnd(i * 3) + 0.3), 30 + rnd(i * 11) * 130, 2.5, 1.5);
        ctx.fill();
      }
    },
  };
}
/** A birch crown: small, airy and yellow-green. */
function birchCanopy(): Sprite {
  const W = 100,
    H = 120;
  return {
    w: W,
    h: H,
    ax: W / 2,
    ay: H - 4,
    draw(ctx) {
      const pal = ["#6f8a3a", "#8fae4a", "#b8d06a", "#d9e88f"];
      for (let i = 0; i < 26; i++) {
        const a = rnd(i * 5.1) * Math.PI * 2,
          d = rnd(i * 2.3) * 30;
        ctx.fillStyle = pal[i % 3];
        ellipse(ctx, W / 2 + Math.cos(a) * d, 58 + Math.sin(a) * d * 1.2, 13 + rnd(i) * 5, 11 + rnd(i * 4) * 4);
        ctx.fill();
      }
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = pal[3];
        ellipse(ctx, W / 2 - 10 + (rnd(i * 9) - 0.5) * 50, 40 + rnd(i * 13) * 50, 2.5, 2);
        ctx.fill();
      }
      // Branches showing through.
      ctx.strokeStyle = "#e9e4d8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W / 2, H - 4);
      ctx.lineTo(W / 2 - 12, 60);
      ctx.moveTo(W / 2, H - 20);
      ctx.lineTo(W / 2 + 14, 70);
      ctx.stroke();
    },
  };
}
/** A leafy canopy, lit from the top left, anchored at its bottom centre. */
export function treeCanopy(variant: number): Sprite {
  if (variant === 3) return pineCanopy();
  if (variant === 4) return birchCanopy();
  const W = 120,
    H = 120,
    pal = LEAVES[variant % 3];
  return {
    w: W,
    h: H,
    ax: W / 2,
    ay: H - 6,
    draw(ctx) {
      const blobs: [number, number, number][] = [];
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + variant,
          d = 18 + rnd(i * 3 + variant * 17) * 12;
        blobs.push([W / 2 + Math.cos(a) * d, 64 + Math.sin(a) * d * 0.8, 22 + rnd(i * 5 + variant) * 8]);
      }
      blobs.push([W / 2, 60, 30]);
      // Dark base, then mid, then lit top-left.
      for (const [k, dx, dy, s] of [
        [0, 2, 6, 1],
        [1, 0, 0, 0.95],
        [2, -4, -6, 0.75],
      ] as const)
        for (const [x, y, r] of blobs) {
          ctx.fillStyle = pal[k];
          ellipse(ctx, x + dx, y + dy, r * s, r * s);
          ctx.fill();
        }
      // Leaf speckle highlights.
      for (let i = 0; i < 70; i++) {
        const a = rnd(i * 7 + variant) * Math.PI * 2,
          d = rnd(i * 11 + variant) * 40;
        const x = W / 2 + Math.cos(a) * d - 6,
          y = 56 + Math.sin(a) * d * 0.8 - 6;
        ctx.fillStyle = i % 3 ? pal[3] : pal[2];
        ellipse(ctx, x, y, 3.5, 2.5);
        ctx.fill();
      }
      // A little fruit or blossom on some trees.
      if (variant === 1)
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = "#ff8a6a";
          ellipse(ctx, W / 2 + (rnd(i * 13) - 0.5) * 70, 50 + (rnd(i * 17) - 0.5) * 50, 3.5, 3.5);
          ctx.fill();
        }
    },
  };
}

/** A leafy bush (variant 1 flowers) or a mossy boulder. */
export function shrubSprite(kind: "bush" | "rock", variant: number): Sprite {
  if (kind === "rock")
    return {
      w: 70,
      h: 50,
      ax: 35,
      ay: 42,
      draw(ctx) {
        const s = 0.8 + (variant % 3) * 0.15;
        ctx.save();
        ctx.translate(35, 42);
        ctx.scale(s, s);
        ctx.fillStyle = "#6f6a60";
        ctx.beginPath();
        ctx.moveTo(-26, 0);
        ctx.lineTo(-22, -18);
        ctx.lineTo(-6, -30);
        ctx.lineTo(14, -26);
        ctx.lineTo(26, -10);
        ctx.lineTo(24, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#9a948a";
        ctx.beginPath();
        ctx.moveTo(-22, -18);
        ctx.lineTo(-6, -30);
        ctx.lineTo(6, -16);
        ctx.lineTo(-14, -8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#5d7a3a";
        ellipse(ctx, -2, -24, 9, 4);
        ctx.fill();
        ctx.restore();
      },
    };
  const pal = [
    ["#2f5226", "#43703a", "#5f9150"],
    ["#2f5226", "#43703a", "#5f9150"],
    ["#3a4f22", "#56702f", "#7b9a45"],
  ][variant % 3];
  return {
    w: 80,
    h: 60,
    ax: 40,
    ay: 52,
    draw(ctx) {
      const blobs: [number, number, number][] = [
        [26, 38, 16],
        [54, 38, 16],
        [40, 30, 19],
        [32, 24, 12],
        [50, 24, 12],
      ];
      for (const [k, dx, dy] of [
        [0, 1, 3],
        [1, 0, 0],
        [2, -3, -4],
      ] as const)
        for (const [x, y, r] of blobs) {
          ctx.fillStyle = pal[k];
          ellipse(ctx, x + dx, y + dy, r * (1 - k * 0.18), r * (1 - k * 0.18) * 0.9);
          ctx.fill();
        }
      if (variant % 3 === 1)
        for (let i = 0; i < 9; i++) {
          ctx.fillStyle = ["#ffb3c7", "#ffffff", "#ffd65b"][i % 3];
          ellipse(ctx, 18 + rnd(i * 7) * 44, 16 + rnd(i * 5) * 28, 2.6, 2.6);
          ctx.fill();
        }
    },
  };
}

/** A wooden signpost with one arrow board naming the district down the road. */
export function signpostSprite(label: string, color: string, left: boolean): Sprite {
  // Wide enough for the longest name on either side of the post.
  const W = 380,
    H = 120;
  return {
    w: W,
    h: H,
    ax: W / 2,
    ay: H - 6,
    draw(ctx) {
      // A small stone footing so the post stands in the ground.
      const fx = W / 2,
        fy = H - 6;
      ctx.fillStyle = "#8f846f";
      ellipse(ctx, fx, fy - 1, 11, 4);
      ctx.fill();
      ctx.fillRect(fx - 11, fy - 5, 22, 4);
      ctx.fillStyle = "#c4b89c";
      ellipse(ctx, fx, fy - 5, 11, 4);
      ctx.fill();
      ctx.fillStyle = "#5a3e28";
      ctx.fillRect(W / 2 - 4, 30, 8, H - 39);
      ctx.fillStyle = "#7a5638";
      ctx.fillRect(W / 2 - 4, 30, 3, H - 34);
      ctx.font = "700 15px 'Barlow Condensed', 'Arial Narrow', sans-serif";
      const tw = ctx.measureText(label.toUpperCase()).width + 36,
        x0 = left ? W / 2 + 10 - tw : W / 2 - 10,
        y0 = 26;
      // The board, with its pointed end toward the district.
      ctx.fillStyle = "#a87a4c";
      ctx.beginPath();
      if (left) {
        ctx.moveTo(x0 + tw, y0);
        ctx.lineTo(x0 + 12, y0);
        ctx.lineTo(x0, y0 + 13);
        ctx.lineTo(x0 + 12, y0 + 26);
        ctx.lineTo(x0 + tw, y0 + 26);
      } else {
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + tw - 12, y0);
        ctx.lineTo(x0 + tw, y0 + 13);
        ctx.lineTo(x0 + tw - 12, y0 + 26);
        ctx.lineTo(x0, y0 + 26);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#6e4f30";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = color;
      ellipse(ctx, left ? x0 + tw - 10 : x0 + 10, y0 + 13, 4, 4);
      ctx.fill();
      ctx.fillStyle = "#2a1c10";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(label.toUpperCase(), x0 + tw / 2 + (left ? 3 : -3), y0 + 14);
      // A cap on the post.
      ctx.fillStyle = "#4a3220";
      ctx.fillRect(W / 2 - 6, 20, 12, 6);
    },
  };
}

/**
 * A statue plinth for the Raid Hall: a stepped base, a tall dado with a
 * bronze plaque bearing the boss's name, a moulded cap the statue stands
 * on, and an inlaid gem in the boss's colour. Anchored at the front of the
 * bottom step; the statue's feet go STATUE_TOP above that.
 */
export const STATUE_TOP = 58;
export function statuePlinth(name: string | null, color: string): Sprite {
  const W = 120,
    H = 80;
  return {
    w: W,
    h: H,
    ax: W / 2,
    ay: H - 6,
    draw(ctx) {
      const cx = W / 2,
        G = H - 6;
      // A round pedestal in the same ¾ view as the tower and fountain: a
      // stepped foot, a drum lit from the left, and a cap whose top you see.
      const R = 0.3,
        lit = ["#d6d1e4", "#b4aec8", "#8a84a0", "#6a647e"];
      // Foot step.
      cylinder(ctx, cx, G - 46 * R, G - 46 * R - 8, 46, 46, R, lit);
      ctx.fillStyle = "#c8c2d8";
      ellipse(ctx, cx, G - 46 * R - 8, 46, 46 * R);
      ctx.fill();
      // Drum.
      const drumFoot = G - 46 * R - 8,
        capY = G - STATUE_TOP;
      cylinder(ctx, cx, drumFoot, capY + 6, 33, 33, R, ["#e4e0ee", "#c4bed6", "#9690ac", "#6f6a86"]);
      // A band in the boss's colour near the foot of the drum.
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(cx, drumFoot - 5, 33, 33 * R, 0, 0.08, Math.PI - 0.08);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // Cap: a disc a little wider than the drum, its top face in light.
      cylinder(ctx, cx, capY + 6, capY, 40, 40, R, lit);
      ctx.fillStyle = "#ebe7f3";
      ellipse(ctx, cx, capY, 40, 40 * R);
      ctx.fill();
      ctx.strokeStyle = "rgba(90,80,120,0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();
      // The statue's contact shade on the cap.
      ctx.fillStyle = "rgba(50,40,70,0.3)";
      ellipse(ctx, cx + 3, capY + 1, 26, 26 * R * 0.8);
      ctx.fill();
      // The bronze plaque with the name engraved.
      const plaque = ctx.createLinearGradient(0, G - 44, 0, G - 26);
      plaque.addColorStop(0, "#f2d27a");
      plaque.addColorStop(1, "#b88a2e");
      ctx.fillStyle = "#5a4520";
      roundRect(ctx, cx - 28, G - 45, 56, 19, 3);
      ctx.fill();
      ctx.fillStyle = plaque;
      roundRect(ctx, cx - 27, G - 44, 54, 17, 3);
      ctx.fill();
      if (name) {
        ctx.fillStyle = "#3a2a10";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        let size = 11;
        do ctx.font = `700 ${size}px 'Barlow Condensed', 'Arial Narrow', sans-serif`;
        while (ctx.measureText(name.toUpperCase()).width > 48 && --size > 6);
        ctx.fillText(name.toUpperCase(), cx, G - 35);
      }
    },
  };
}

/**
 * Turns a coloured boss picture into a carved-stone statue: colours become
 * shades of pale stone (dark lines stay as carved grooves), lit from above,
 * with a little grain. Returns the trimmed canvas (no empty margins) so
 * the statue's feet sit right on its plinth.
 */
export function carveStatue(src: CanvasImageSource, size: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(src, 0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size),
    d = img.data;
  let minX = size,
    minY = size,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4,
        a = d[i + 3];
      if (a < 8) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      // Luminance with contrast eased so flat colours keep some shape.
      const lum = (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255,
        // Dark colours become mid stone; near-black lines stay as grooves.
        tone = lum < 0.12 ? 0.38 : 0.66 + Math.pow(lum, 0.8) * 0.48,
        light = 1.08 - (y / size) * 0.28 - (x / size) * 0.1,
        grain = 1 + (rnd(i * 0.37) - 0.5) * 0.08,
        k = Math.min(1.15, tone * light * grain);
      // Pale lavender-grey stone, like the Raid Hall's marble.
      d[i] = Math.min(255, 196 * k);
      d[i + 1] = Math.min(255, 190 * k);
      d[i + 2] = Math.min(255, 210 * k);
    }
  ctx.putImageData(img, 0, 0);
  if (maxX < 0) return c;
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext("2d")!.drawImage(c, -minX, -minY);
  return out;
}

/** A plinth waiting for the next boss: its statue is under a draped cloth. */
export function veiledStatue(): Sprite {
  const W = 110,
    H = 110;
  return {
    w: W,
    h: H,
    ax: W / 2,
    ay: H,
    draw(ctx) {
      const cx = W / 2,
        G = H;
      const cloth = ctx.createLinearGradient(cx - 40, 0, cx + 40, 0);
      cloth.addColorStop(0, "#4b3a7a");
      cloth.addColorStop(0.4, "#8a6fd6");
      cloth.addColorStop(1, "#3f3068");
      ctx.fillStyle = cloth;
      ctx.beginPath();
      ctx.moveTo(cx - 40, G);
      ctx.quadraticCurveTo(cx - 44, G - 60, cx - 18, G - 92);
      ctx.quadraticCurveTo(cx, G - 104, cx + 18, G - 92);
      ctx.quadraticCurveTo(cx + 44, G - 60, cx + 40, G);
      // A hem with gentle folds.
      for (let k = 4; k >= 0; k--) ctx.quadraticCurveTo(cx - 40 + k * 16 + 8, G + 4, cx - 40 + k * 16, G);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(20,10,40,0.35)";
      ctx.lineWidth = 2;
      for (const dx of [-18, 2, 20]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx * 0.4, G - 88);
        ctx.quadraticCurveTo(cx + dx * 0.8, G - 50, cx + dx, G - 2);
        ctx.stroke();
      }
      ctx.fillStyle = "#e9c25a";
      ctx.fillRect(cx - 40, G - 8, 80, 3);
      ctx.font = "700 30px 'Barlow Condensed', 'Arial Narrow', sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,240,200,0.85)";
      ctx.fillText("?", cx, G - 44);
    },
  };
}

/** Small props, each anchored where it meets the ground. */
/**
 * The fountain, in two pictures so falling water can pass between them:
 * the basin (stone wall, rim and pool) and the column with its two bowls.
 * Both are anchored at the basin's centre; FOUNTAIN gives the shape in
 * world units from that centre, so the animated water lines up.
 */
export const FOUNTAIN = {
  basin: { rx: 114, ry: 51, wall: 25, rim: 13 },
  pool: { rx: 97, ry: 38, dy: 0 },
  mid: { dy: -78, rx: 55, ry: 19, depth: 30 },
  top: { dy: -126, rx: 34, ry: 11, depth: 20 },
  spout: { dy: -160 },
  crystal: { dy: -186, rx: 17, ry: 26 },
};
/** The two passes use identical source pixels and placement. Only the upper
 * pass is masked, so rear streams disappear behind the column and bowls. */
export function paintedFountain(source: CanvasImageSource, upper: boolean): Sprite {
  const scale = 114 / 470;
  return {
    w: 1322 * scale, h: 1190 * scale,
    ax: 660 * scale, ay: 766 * scale,
    draw(ctx) {
      ctx.save();
      ctx.scale(scale, scale);
      if (upper) {
        ctx.beginPath();
        const contour = [[425,90],[895,90],[895,585],[711,585],[711,746],[754,772],[754,809],[697,832],[623,832],[569,809],[569,772],[611,746],[611,585],[425,585]];
        contour.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
        ctx.closePath();
        ctx.clip();
      }
      ctx.drawImage(source, 0, 0, 1322, 1190);
      ctx.restore();
    },
  };
}

const STONE = { light: "#e4dac4", mid: "#c9bda3", dark: "#9a8e76", deep: "#6f6553", line: "rgba(80,68,48,0.35)" };

/** Mineral grain and shallow veins, painted once into each stone surface. */
function fountainStone(ctx: Ctx, x: number, y: number, rx: number, ry: number, seed: number, height = 0) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, Math.PI, 0);
  ctx.lineTo(x + rx, y + height);
  ctx.ellipse(x, y + height, rx, ry, 0, 0, Math.PI);
  ctx.closePath();
  ctx.clip();
  for (let k = 0; k < rx * 6; k++) {
    const px = x + (rnd(seed + k * 3.7) * 2 - 1) * rx;
    const py = y - ry + rnd(seed + k * 8.1) * (ry * 2 + height);
    ctx.fillStyle = k % 4 ? "rgba(72,62,47,0.10)" : "rgba(255,248,222,0.23)";
    ctx.fillRect(px, py, 0.45 + rnd(k * 2.3) * 1.1, 0.35 + rnd(k) * 0.65);
  }
  ctx.lineWidth = 0.45;
  ctx.strokeStyle = "rgba(88,77,58,0.13)";
  for (let k = 0; k < 8; k++) {
    const px = x - rx + rnd(seed + k * 17) * rx * 2;
    const py = y - ry + rnd(seed + k * 11) * (ry * 2 + height);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.bezierCurveTo(px + 6, py + 1, px + 9, py - 2, px + 17, py + 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Ashlar blocks on a curved wall seen from the front (only the near half shows). */
function curvedBlocks(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, h: number, rows: number) {
  ctx.strokeStyle = STONE.line;
  ctx.lineWidth = 1;
  for (let r = 1; r < rows; r++) {
    ctx.beginPath();
    ctx.ellipse(cx, cy + (h * r) / rows, rx, ry, 0, 0.02, Math.PI - 0.02);
    ctx.stroke();
  }
  for (let r = 0; r < rows; r++)
    for (let k = 0; k < 14; k++) {
      const a = ((k + (r % 2) * 0.5) / 14) * Math.PI;
      if (a < 0.05 || a > Math.PI - 0.05) continue;
      const x = cx + Math.cos(a) * rx,
        y = cy + Math.sin(a) * ry + (h * r) / rows;
      ctx.beginPath();
      ctx.moveTo(x, y + 1);
      ctx.lineTo(x, y + h / rows - 1);
      ctx.stroke();
    }
}

export function fountainBase(): Sprite {
  const W = 280,
    H = 190,
    cx = 140,
    cy = 80;
  const { rx, ry, wall, rim } = FOUNTAIN.basin;
  return {
    w: W,
    h: H,
    ax: cx,
    ay: cy,
    draw(ctx) {
      // Wet, darker paving and a soft contact shadow around the basin.
      ctx.fillStyle = "rgba(70,90,100,0.18)";
      ellipse(ctx, cx, cy + wall, rx + 16, ry + 12);
      ctx.fill();
      // The basin's outer wall: a cylinder, lit from the upper left.
      const side = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
      side.addColorStop(0, STONE.dark);
      side.addColorStop(0.3, STONE.light);
      side.addColorStop(0.65, STONE.mid);
      side.addColorStop(1, STONE.deep);
      ctx.fillStyle = side;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI);
      ctx.lineTo(cx - rx, cy + wall);
      ctx.ellipse(cx, cy + wall, rx, ry, 0, Math.PI, 0, true);
      ctx.closePath();
      ctx.fill();
      curvedBlocks(ctx, cx, cy, rx, ry, wall, 2);
      // A plinth course along the foot.
      ctx.fillStyle = "rgba(60,52,40,0.35)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + wall - 3, rx + 1, ry + 1, 0, 0.05, Math.PI - 0.05);
      ctx.ellipse(cx, cy + wall + 1, rx + 1, ry + 1, 0, Math.PI - 0.05, 0.05, true);
      ctx.fill();
      // The rim: a broad coping stone with a rounded lit edge.
      ctx.fillStyle = STONE.mid;
      ellipse(ctx, cx, cy, rx, ry);
      ctx.fill();
      const top = ctx.createLinearGradient(0, cy - ry, 0, cy + ry);
      top.addColorStop(0, STONE.light);
      top.addColorStop(1, STONE.mid);
      ctx.fillStyle = top;
      ellipse(ctx, cx, cy - 2, rx - 1, ry - 1.5);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 2, rx - 2, ry - 2.5, 0, Math.PI * 1.05, Math.PI * 1.75);
      ctx.stroke();
      // Coping joints.
      ctx.strokeStyle = STONE.line;
      ctx.lineWidth = 1.2;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * (rx - rim - 1), cy - 2 + Math.sin(a) * (ry - rim * 0.56 - 1));
        ctx.lineTo(cx + Math.cos(a) * (rx - 1), cy - 2 + Math.sin(a) * (ry - 1.5));
        ctx.stroke();
      }
      fountainStone(ctx, cx, cy, rx - 1, ry - 1, 19, wall);
      // Inner wall (in shade) down to the water.
      const { rx: px, ry: py, dy } = FOUNTAIN.pool;
      ctx.fillStyle = STONE.deep;
      ellipse(ctx, cx, cy - 1, px + 1, py + 1);
      ctx.fill();
      // The pool: deep at the edges, bright in the middle, sky reflected on the far side.
      const water = ctx.createRadialGradient(cx - 20, cy + dy - 12, 6, cx, cy + dy, px);
      water.addColorStop(0, "#8fe3f4");
      water.addColorStop(0.45, "#4fb4d4");
      water.addColorStop(0.85, "#2a7ea4");
      water.addColorStop(1, "#1d5f80");
      ctx.fillStyle = water;
      ellipse(ctx, cx, cy + dy, px - 1, py - 4);
      ctx.fill();
      // Refracted light on the submerged mosaic, softened by water depth.
      ctx.save();
      ellipse(ctx, cx, cy + dy, px - 2, py - 5);
      ctx.clip();
      ctx.strokeStyle = "rgba(178,239,228,0.17)";
      ctx.lineWidth = 0.8;
      for (let k = -5; k <= 5; k++) {
        ctx.beginPath();
        ctx.moveTo(cx - px, cy + dy + k * 9);
        ctx.bezierCurveTo(cx - 28, cy + dy + k * 7 - 6, cx + 38, cy + dy + k * 8 + 7, cx + px, cy + dy + k * 9 - 2);
        ctx.stroke();
      }
      // The column casts a soft, tapered reflection into the basin.
      const reflection = ctx.createLinearGradient(0, cy + dy - 6, 0, cy + dy + 43);
      reflection.addColorStop(0, "rgba(29,66,73,0.34)");
      reflection.addColorStop(1, "rgba(29,66,73,0)");
      ctx.fillStyle = reflection;
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy + dy - 6);
      ctx.lineTo(cx + 16, cy + dy - 6);
      ctx.lineTo(cx + 33, cy + dy + 43);
      ctx.lineTo(cx + 9, cy + dy + 43);
      ctx.fill();
      ctx.restore();
      // Rim reflection on the water's far side and a coin-strewn floor glint.
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + dy - 2, px - 6, py - 10, 0, Math.PI * 1.08, Math.PI * 1.92);
      ctx.ellipse(cx, cy + dy + 2, px - 14, py - 16, 0, Math.PI * 1.92, Math.PI * 1.08, true);
      ctx.fill();
      for (let k = 0; k < 14; k++) {
        const a = rnd(k * 7) * Math.PI * 2,
          d = 0.25 + rnd(k * 11) * 0.55;
        ctx.fillStyle = k % 3 ? "rgba(255,214,120,0.55)" : "rgba(220,230,235,0.5)";
        ellipse(ctx, cx + Math.cos(a) * px * d, cy + dy + Math.sin(a) * py * d * 0.8 + 4, 2.4, 1.3);
        ctx.fill();
      }
      // The column's foot standing in the water.
      ctx.fillStyle = STONE.dark;
      ellipse(ctx, cx, cy + dy + 2, 30, 11);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + dy + 2, 34, 13, 0, 0.1, Math.PI - 0.1);
      ctx.stroke();
    },
  };
}

export function fountainTop(): Sprite {
  const W = 160,
    H = 210,
    cx = 80,
    cy = 190;
  const { mid, top, spout } = FOUNTAIN;
  const bowl = (y: number, rx: number, ry: number, depth: number) => {
    // Underside: a shallow cup, darker toward the bottom.
    const under = (ctx: Ctx) => {
      const g = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
      g.addColorStop(0, STONE.dark);
      g.addColorStop(0.35, STONE.light);
      g.addColorStop(1, STONE.deep);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, cy + y, rx, ry, 0, 0, Math.PI);
      ctx.quadraticCurveTo(cx - rx * 0.6, cy + y + depth * 1.4, cx, cy + y + depth);
      ctx.quadraticCurveTo(cx + rx * 0.6, cy + y + depth * 1.4, cx + rx, cy + y);
      ctx.fill();
      fountainStone(ctx, cx, cy + y, rx, ry, 37 + rx, depth);
      // Scalloped lip.
      ctx.fillStyle = STONE.mid;
      for (let k = 0; k <= 10; k++) {
        const a = (k / 10) * Math.PI;
        ellipse(ctx, cx + Math.cos(a) * rx, cy + y + Math.sin(a) * ry + 2, rx / 9, 3.5);
        ctx.fill();
      }
      ctx.fillStyle = STONE.light;
      ellipse(ctx, cx, cy + y, rx, ry);
      ctx.fill();
      fountainStone(ctx, cx, cy + y, rx, ry, 53 + rx);
      ctx.strokeStyle = "rgba(255,249,223,0.7)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(cx, cy + y - 0.5, rx - 1.5, ry - 1, 0, Math.PI * 1.08, Math.PI * 1.78);
      ctx.stroke();
      ctx.fillStyle = STONE.deep;
      ellipse(ctx, cx, cy + y + 1, rx - 5, ry - 3);
      ctx.fill();
      const w = ctx.createRadialGradient(cx - rx * 0.3, cy + y - 2, 1, cx, cy + y + 1, rx);
      w.addColorStop(0, "#a6f0ff");
      w.addColorStop(1, "#3c9cc4");
      ctx.fillStyle = w;
      ellipse(ctx, cx, cy + y + 2, rx - 7, ry - 4.5);
      ctx.fill();
    };
    return under;
  };
  const column = (ctx: Ctx, y0: number, y1: number, r0: number, r1: number) => {
    const g = ctx.createLinearGradient(cx - r0, 0, cx + r0, 0);
    g.addColorStop(0, STONE.dark);
    g.addColorStop(0.35, STONE.light);
    g.addColorStop(0.7, STONE.mid);
    g.addColorStop(1, STONE.deep);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - r0, cy + y0);
    ctx.lineTo(cx - r1, cy + y1);
    ctx.lineTo(cx + r1, cy + y1);
    ctx.lineTo(cx + r0, cy + y0);
    ctx.closePath();
    ctx.fill();
    // A wet shade at the column's foot and warm reflected light at the left.
    const wet = ctx.createLinearGradient(0, cy + y1, 0, cy + y0);
    wet.addColorStop(0, "rgba(29,63,58,0)");
    wet.addColorStop(0.8, "rgba(29,63,58,0.07)");
    wet.addColorStop(1, "rgba(29,63,58,0.24)");
    ctx.fillStyle = wet;
    ctx.fill();
    // Fluting.
    ctx.strokeStyle = "rgba(90,78,58,0.25)";
    ctx.lineWidth = 1;
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(cx + k * r0 * 0.36, cy + y0 - 2);
      ctx.lineTo(cx + k * r1 * 0.36, cy + y1 + 2);
      ctx.stroke();
    }
  };
  const ring = (ctx: Ctx, y: number, rx: number) => {
    ctx.fillStyle = STONE.mid;
    ellipse(ctx, cx, cy + y, rx, rx * 0.34);
    ctx.fill();
    ctx.fillStyle = STONE.light;
    ellipse(ctx, cx, cy + y - 2, rx - 1, rx * 0.3);
    ctx.fill();
  };
  return {
    w: W,
    h: H,
    ax: cx,
    ay: cy,
    draw(ctx) {
      // Lower column: a carved shaft with a moulded base.
      ring(ctx, FOUNTAIN.pool.dy - 2, 24);
      column(ctx, FOUNTAIN.pool.dy - 6, mid.dy + 6, 17, 12);
      ring(ctx, mid.dy + 14, 16);
      bowl(mid.dy, mid.rx, mid.ry, mid.depth)(ctx);
      // Bronze collar: the elemental monument's restrained metal accent.
      ctx.strokeStyle = "#a48c50";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy + mid.dy + 16, 15, 4.5, 0, 0, Math.PI);
      ctx.stroke();
      // Upper column and the small bowl.
      column(ctx, mid.dy + 2, top.dy + 4, 9, 6);
      ring(ctx, mid.dy, 12);
      bowl(top.dy, top.rx, top.ry, top.depth)(ctx);
      // The finial the spout rises from.
      ctx.fillStyle = STONE.mid;
      ctx.fillRect(cx - 3, cy + spout.dy, 6, top.dy - spout.dy + 2);
      ctx.fillStyle = STONE.light;
      ellipse(ctx, cx, cy + spout.dy, 5, 4);
      ctx.fill();
    },
  };
}

/** A soft blob used for cloud shadows, glows and puffs. */
export function softBlob(color = "255,255,255"): Sprite {
  const S = 128;
  return {
    w: S,
    h: S,
    ax: S / 2,
    ay: S / 2,
    draw(ctx) {
      const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      g.addColorStop(0, `rgba(${color},1)`);
      g.addColorStop(0.5, `rgba(${color},0.5)`);
      g.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
    },
  };
}
