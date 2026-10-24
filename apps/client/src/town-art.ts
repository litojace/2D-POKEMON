import { CHARACTERS } from "@arena/shared";
import {
  TOWN,
  TOWN_BUILDINGS,
  TOWN_DUMMIES,
  TOWN_POND,
  TOWN_ROADS,
  TOWN_STALLS,
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
/** A soft round shadow on the ground. */
export function softShadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, a = 0.32) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, `rgba(20,28,12,${a})`);
  g.addColorStop(0.6, `rgba(20,28,12,${a * 0.6})`);
  g.addColorStop(1, "rgba(20,28,12,0)");
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.translate(-x, -y);
  ctx.fillStyle = g;
  ellipse(ctx, x, y, rx, rx);
  ctx.fill();
  ctx.restore();
}

// ─────────────────────────── Ground ───────────────────────────

const distToSegment = (x: number, y: number, [x1, y1, x2, y2]: readonly number[]) => {
  const dx = x2 - x1,
    dy = y2 - y1,
    t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (x1 + dx * t), y - (y1 + dy * t));
};

/** Cobbles packed along a road: rows of rounded stones across its width. */
function cobbleRoad(ctx: Ctx, road: readonly number[], width: number, seed: number) {
  const [x1, y1, x2, y2] = road,
    len = Math.hypot(x2 - x1, y2 - y1),
    ux = (x2 - x1) / len,
    uy = (y2 - y1) / len;
  ctx.lineCap = "round";
  // Packed dirt edge, then the mortar bed.
  ctx.strokeStyle = "#7d6d52";
  ctx.lineWidth = width + 22;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = "#857a66";
  ctx.lineWidth = width;
  ctx.stroke();
  const tones = ["#a99d86", "#9d917a", "#b3a78f", "#a1957d", "#bcb09a"];
  for (let d = 0, row = 0; d < len; d += 15, row++) {
    for (let k = -width / 2 + 9 + (row % 2) * 8; k < width / 2 - 6; k += 17) {
      const i = seed * 1000 + row * 13 + k;
      const cx = x1 + ux * d - uy * k + (rnd(i) - 0.5) * 3,
        cy = y1 + uy * d + ux * k * 0.8 + (rnd(i + 1) - 0.5) * 3;
      ctx.fillStyle = tones[Math.floor(rnd(i + 2) * tones.length)];
      roundRect(ctx, cx - 7, cy - 5, 14 + rnd(i + 3) * 3, 10, 4);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      roundRect(ctx, cx - 6, cy - 5, 9, 3, 2);
      ctx.fill();
    }
  }
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
  softShadow(ctx, x, y + 14, r + 40, (r + 40) * 0.78, 0.25);
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
  const elements = Object.values(CHARACTERS).map((c) => hex(c.color));
  ctx.fillStyle = "#d9cfb8";
  ellipse(ctx, x, y, 158, 124);
  ctx.fill();
  elements.forEach((c, i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    ctx.fillStyle = c;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 156, y + Math.sin(a) * 156 * 0.78);
    ctx.lineTo(x + Math.cos(a + 0.13) * 134, y + Math.sin(a + 0.13) * 134 * 0.78);
    ctx.lineTo(x + Math.cos(a - 0.13) * 134, y + Math.sin(a - 0.13) * 134 * 0.78);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  });
  ctx.strokeStyle = "rgba(90,78,58,0.45)";
  ctx.lineWidth = 3;
  ellipse(ctx, x, y, 158, 124);
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
  softShadow(ctx, 1600, 700, 560, 60, 0.3);
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
    ctx.fillStyle = "rgba(0,0,0,0.25)";
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
function kerbs(ctx: Ctx, road: readonly number[], width: number, seed: number) {
  const [x1, y1, x2, y2] = road,
    len = Math.hypot(x2 - x1, y2 - y1),
    ux = (x2 - x1) / len,
    uy = (y2 - y1) / len,
    a = Math.atan2(uy, ux);
  for (const side of [-1, 1])
    for (let d = 0; d < len; d += 24) {
      const off = side * (width / 2 + 4),
        x = x1 + ux * d - uy * off,
        y = y1 + uy * d + ux * off * 0.8,
        i = seed * 977 + d + side;
      // Worn, bare earth where people step off the road.
      if (rnd(i * 1.3) < 0.35) {
        ctx.fillStyle = "rgba(120,96,64,0.35)";
        ellipse(ctx, x - uy * side * 14, y + ux * side * 11, 10 + rnd(i) * 12, 4 + rnd(i * 2) * 4);
        ctx.fill();
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = "#6f6656";
      roundRect(ctx, -11, -4, 22, 8, 2);
      ctx.fill();
      ctx.fillStyle = rnd(i * 3) > 0.5 ? "#a49880" : "#968a73";
      roundRect(ctx, -11, -5, 21, 6, 2);
      ctx.fill();
      ctx.restore();
    }
}

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
      if (TOWN_ROADS.some((r, k) => distToSegment(x, y, r) < (k < 5 ? 112 : 84) / 2 + 10)) return;
      ctx.fillStyle = "rgba(0,0,0,0.22)";
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

export function paintGround(ctx: Ctx) {
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
  TOWN_ROADS.forEach((r, i) => cobbleRoad(ctx, r, i < 5 ? 112 : 84, i + 1));
  TOWN_ROADS.forEach((r, i) => kerbs(ctx, r, i < 5 ? 112 : 84, i + 1));
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
      softShadow(ctx, b.x + 20, y + 6, COLISEUM.rx + 50, COLISEUM.ry + 30, 0.35);
    }
  marbleTerrace(ctx);
  trainingYard(ctx);
  marketSquare(ctx);
  // A small paved court in front of the Notice Board.
  ctx.fillStyle = "#9d917a";
  ellipse(ctx, 1600, 1725, 190, 70);
  ctx.fill();
  pond(ctx);
  // Shadows of everything tall (they fall down and to the right).
  for (const b of TOWN_BUILDINGS) softShadow(ctx, b.x + b.w * 0.12, b.y + 6, b.w * 0.62, 46, 0.38);
  for (const t of TOWN_TREES) softShadow(ctx, t.x + 16, t.y + 8, 52, 20, 0.34);
  for (const s of TOWN_STALLS) softShadow(ctx, s.x + 10, s.y + 30, 100, 22, 0.3);
  for (const d of TOWN_DUMMIES) softShadow(ctx, d.x + 6, d.y + 4, 22, 8, 0.3);
  // Grass tufts over the road edges keep them from looking stamped on.
  for (let i = 0; i < 1600; i++) {
    const x = rnd(i * 4.7) * W,
      y = rnd(i * 6.1) * H,
      d = Math.min(...TOWN_ROADS.map((r, k) => Math.abs(distToSegment(x, y, r) - (k < 5 ? 62 : 48))));
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

/** Raid Hall: a columned temple with a purple roof and glowing doors. */
function temple(b: TownBuilding): Sprite {
  const W = b.w + 60,
    H = 430;
  return {
    w: W,
    h: H,
    ax: W / 2,
    ay: H - 4,
    draw(ctx) {
      const cx = W / 2,
        base = H - 4,
        hw = b.w / 2;
      // Steps.
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = k % 2 ? "#cfc8de" : "#b9b1cc";
        ctx.fillRect(cx - hw - 20 + k * 8, base - 14 - k * 12, b.w + 40 - k * 16, 14);
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.fillRect(cx - hw - 20 + k * 8, base - 2 - k * 12, b.w + 40 - k * 16, 2);
      }
      const floor = base - 50;
      // Back wall in shade, then the glowing doorway.
      ctx.fillStyle = "#4b4266";
      ctx.fillRect(cx - hw + 20, floor - 200, b.w - 40, 200);
      const door = ctx.createRadialGradient(cx, floor - 60, 10, cx, floor - 70, 120);
      door.addColorStop(0, "#f2e7ff");
      door.addColorStop(0.3, "#b59bff");
      door.addColorStop(1, "#2a1f4a");
      ctx.fillStyle = door;
      roundRect(ctx, cx - 60, floor - 170, 120, 170, 60);
      ctx.fill();
      // Columns with fluting and shading.
      const n = 8;
      for (let k = 0; k < n; k++) {
        const px = cx - hw + 30 + (k * (b.w - 60)) / (n - 1);
        if (Math.abs(px - cx) < 70) continue;
        const g = ctx.createLinearGradient(px - 16, 0, px + 16, 0);
        g.addColorStop(0, "#a69ebf");
        g.addColorStop(0.4, "#f1edf9");
        g.addColorStop(1, "#8f87ab");
        ctx.fillStyle = g;
        ctx.fillRect(px - 16, floor - 200, 32, 200);
        ctx.strokeStyle = "rgba(90,80,120,0.25)";
        ctx.lineWidth = 1;
        for (let f = -10; f <= 10; f += 5) {
          ctx.beginPath();
          ctx.moveTo(px + f, floor - 196);
          ctx.lineTo(px + f, floor - 4);
          ctx.stroke();
        }
        ctx.fillStyle = "#d8d2ea";
        ctx.fillRect(px - 20, floor - 12, 40, 12);
        ctx.fillRect(px - 20, floor - 208, 40, 12);
        // Hanging banners between some columns.
        if (k === 1 || k === n - 2) {
          ctx.fillStyle = "#6c4fb0";
          ctx.beginPath();
          ctx.moveTo(px + 26, floor - 190);
          ctx.lineTo(px + 66, floor - 190);
          ctx.lineTo(px + 66, floor - 80);
          ctx.lineTo(px + 46, floor - 96);
          ctx.lineTo(px + 26, floor - 80);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#e2c25b";
          ctx.fillRect(px + 26, floor - 190, 40, 6);
          ctx.beginPath();
          ctx.arc(px + 46, floor - 150, 9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Entablature and pediment.
      const ent = floor - 236;
      ctx.fillStyle = "#d8d2ea";
      ctx.fillRect(cx - hw, ent, b.w, 30);
      ctx.fillStyle = "#b9b1cc";
      for (let tx = cx - hw + 10; tx < cx + hw - 10; tx += 34) ctx.fillRect(tx, ent + 8, 14, 14);
      ctx.fillStyle = "#e9c25a";
      ctx.fillRect(cx - hw, ent + 28, b.w, 4);
      const roof = ctx.createLinearGradient(0, ent - 120, 0, ent);
      roof.addColorStop(0, "#8a6fd6");
      roof.addColorStop(1, "#4f3c8f");
      ctx.fillStyle = roof;
      ctx.beginPath();
      ctx.moveTo(cx - hw - 24, ent + 2);
      ctx.lineTo(cx, ent - 120);
      ctx.lineTo(cx + hw + 24, ent + 2);
      ctx.closePath();
      ctx.fill();
      // Roof tiles.
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 2;
      for (let k = 1; k < 7; k++) {
        const t = k / 7;
        ctx.beginPath();
        ctx.moveTo(cx - (hw + 24) * t, ent - 120 + 122 * t);
        ctx.lineTo(cx + (hw + 24) * t, ent - 120 + 122 * t);
        ctx.stroke();
      }
      // Pediment emblem: a raid crest disc.
      ctx.fillStyle = "#2a1f4a";
      ellipse(ctx, cx, ent - 44, 34, 30);
      ctx.fill();
      ctx.strokeStyle = "#e9c25a";
      ctx.lineWidth = 4;
      ellipse(ctx, cx, ent - 44, 34, 30);
      ctx.stroke();
      ctx.fillStyle = "#e9c25a";
      ctx.beginPath();
      ctx.moveTo(cx, ent - 66);
      ctx.lineTo(cx + 14, ent - 44);
      ctx.lineTo(cx, ent - 22);
      ctx.lineTo(cx - 14, ent - 44);
      ctx.closePath();
      ctx.fill();
    },
  };
}

/** Boss Rush tower: round stone keep, crenellations, a red banner, a brazier on top. */
function tower(b: TownBuilding): Sprite {
  const W = b.w + 60,
    H = 440;
  return {
    w: W,
    h: H,
    ax: W / 2,
    ay: H - 4,
    draw(ctx) {
      const cx = W / 2,
        base = H - 4,
        hw = b.w / 2,
        top = base - 330;
      const g = ctx.createLinearGradient(cx - hw, 0, cx + hw, 0);
      g.addColorStop(0, "#5d5246");
      g.addColorStop(0.35, "#9a8c78");
      g.addColorStop(1, "#4c4237");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - hw, base - 16);
      ctx.lineTo(cx - hw + 12, top);
      ctx.lineTo(cx + hw - 12, top);
      ctx.lineTo(cx + hw, base - 16);
      ctx.ellipse(cx, base - 16, hw, 18, 0, 0, Math.PI);
      ctx.fill();
      // Brick rows following the curve.
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 1;
      for (let y = top + 16, row = 0; y < base - 16; y += 16, row++) {
        ctx.beginPath();
        ctx.ellipse(cx, y, hw - 12 + ((y - top) / (base - top)) * 12, 8, 0, 0.1, Math.PI - 0.1);
        ctx.stroke();
        for (let k = -3; k <= 3; k++) {
          const px = cx + Math.sin((k + (row % 2) * 0.5) * 0.42) * (hw - 10);
          ctx.beginPath();
          ctx.moveTo(px, y + 2);
          ctx.lineTo(px, y + 14);
          ctx.stroke();
        }
      }
      // Crenellations and the top ring.
      ctx.fillStyle = "#857866";
      ellipse(ctx, cx, top, hw + 4, 18);
      ctx.fill();
      ctx.fillStyle = "#3a3229";
      ellipse(ctx, cx, top - 2, hw - 8, 12);
      ctx.fill();
      for (let k = -2; k <= 2; k++) {
        const px = cx + k * (hw / 2.6);
        ctx.fillStyle = "#9a8c78";
        ctx.fillRect(px - 10, top - 4, 20, 26);
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.fillRect(px + 4, top - 4, 6, 26);
      }
      // Brazier bowl (the flame is animated).
      ctx.fillStyle = "#3a2a20";
      ctx.beginPath();
      ctx.moveTo(cx - 24, top - 30);
      ctx.lineTo(cx + 24, top - 30);
      ctx.lineTo(cx + 12, top - 8);
      ctx.lineTo(cx - 12, top - 8);
      ctx.closePath();
      ctx.fill();
      // Window and door glow.
      const win = ctx.createRadialGradient(cx, top + 90, 2, cx, top + 90, 30);
      win.addColorStop(0, "#ffe2a0");
      win.addColorStop(1, "#c4521f");
      ctx.fillStyle = win;
      roundRect(ctx, cx - 12, top + 70, 24, 40, 12);
      ctx.fill();
      ctx.fillStyle = "#2a1c14";
      roundRect(ctx, cx - 26, base - 86, 52, 72, 26);
      ctx.fill();
      ctx.fillStyle = "#ff7a4f";
      ctx.globalAlpha = 0.5;
      roundRect(ctx, cx - 20, base - 78, 40, 60, 20);
      ctx.fill();
      ctx.globalAlpha = 1;
      // Hanging red banner.
      ctx.fillStyle = "#c43c2a";
      ctx.beginPath();
      ctx.moveTo(cx + 22, top + 140);
      ctx.lineTo(cx + 58, top + 140);
      ctx.lineTo(cx + 58, top + 230);
      ctx.lineTo(cx + 40, top + 214);
      ctx.lineTo(cx + 22, top + 230);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffd65b";
      ctx.fillRect(cx + 22, top + 140, 36, 5);
    },
  };
}

/** Windmill body; its sails are a separate spinning picture. */
function windmill(b: TownBuilding): Sprite {
  const W = b.w + 40,
    H = 340;
  return {
    w: W,
    h: H,
    ax: W / 2,
    ay: H - 4,
    draw(ctx) {
      const cx = W / 2,
        base = H - 4,
        hw = b.w / 2;
      const g = ctx.createLinearGradient(cx - hw, 0, cx + hw, 0);
      g.addColorStop(0, "#d8cdb8");
      g.addColorStop(0.4, "#fbf6ea");
      g.addColorStop(1, "#bfb39c");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - hw, base - 10);
      ctx.lineTo(cx - hw * 0.62, base - 230);
      ctx.lineTo(cx + hw * 0.62, base - 230);
      ctx.lineTo(cx + hw, base - 10);
      ctx.closePath();
      ctx.fill();
      // Timber bands, door, window.
      ctx.fillStyle = "#7a5a3a";
      for (const y of [base - 90, base - 170]) ctx.fillRect(cx - hw * (1 - (base - y) / 600) + 4, y, b.w * (1 - (base - y) / 600) - 8, 6);
      ctx.fillStyle = "#5a3e28";
      roundRect(ctx, cx - 18, base - 60, 36, 50, 18);
      ctx.fill();
      ctx.fillStyle = "#ffe2a0";
      roundRect(ctx, cx - 10, base - 150, 20, 26, 8);
      ctx.fill();
      // Cap roof.
      ctx.fillStyle = "#a8453a";
      ctx.beginPath();
      ctx.moveTo(cx - hw * 0.75, base - 226);
      ctx.quadraticCurveTo(cx, base - 320, cx + hw * 0.75, base - 226);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.beginPath();
      ctx.moveTo(cx - hw * 0.6, base - 230);
      ctx.quadraticCurveTo(cx - 20, base - 300, cx, base - 296);
      ctx.lineTo(cx - 10, base - 236);
      ctx.closePath();
      ctx.fill();
    },
  };
}
/** Where the sails' hub sits, relative to the windmill's ground anchor. */
export const WINDMILL_HUB = { dx: 0, dy: -250 };
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

const ROOFS = ["#b24a3a", "#3f6fa8", "#4f8a4a"];
const WALLS = ["#f2e6cf", "#efe2d0", "#f5ecd9"];
/** A cosy house: timber-framed walls, a tiled gable roof, lit windows, a chimney. */
function house(b: TownBuilding): Sprite {
  const v = (b.variant ?? 0) % 3,
    W = b.w + 50,
    H = 300;
  return {
    w: W,
    h: H,
    ax: W / 2,
    ay: H - 4,
    draw(ctx) {
      const cx = W / 2,
        base = H - 4,
        hw = b.w / 2,
        wallTop = base - 120;
      // Side wall (in shade) for depth.
      ctx.fillStyle = shade(WALLS[v], -0.22);
      ctx.beginPath();
      ctx.moveTo(cx + hw, base);
      ctx.lineTo(cx + hw + 18, base - 26);
      ctx.lineTo(cx + hw + 18, wallTop - 26);
      ctx.lineTo(cx + hw, wallTop);
      ctx.closePath();
      ctx.fill();
      // Front wall with stone footing and timber frame.
      ctx.fillStyle = WALLS[v];
      ctx.fillRect(cx - hw, wallTop, b.w, 120);
      stoneWall(ctx, cx - hw, base - 22, b.w, 22, "#8f846f", v * 100);
      ctx.fillStyle = "#6e4f30";
      ctx.fillRect(cx - hw, wallTop, b.w, 7);
      ctx.fillRect(cx - hw, wallTop, 7, 100);
      ctx.fillRect(cx + hw - 7, wallTop, 7, 100);
      ctx.fillRect(cx - 4, wallTop, 7, 100);
      // Windows with warm light and flower boxes.
      for (const wx of [cx - hw * 0.55, cx + hw * 0.55]) {
        ctx.fillStyle = "#5a3e28";
        ctx.fillRect(wx - 22, wallTop + 26, 44, 40);
        const glow = ctx.createLinearGradient(0, wallTop + 30, 0, wallTop + 62);
        glow.addColorStop(0, "#ffefb8");
        glow.addColorStop(1, "#f2b93b");
        ctx.fillStyle = glow;
        ctx.fillRect(wx - 18, wallTop + 30, 36, 32);
        ctx.fillStyle = "#5a3e28";
        ctx.fillRect(wx - 1.5, wallTop + 30, 3, 32);
        ctx.fillRect(wx - 18, wallTop + 44, 36, 3);
        ctx.fillStyle = "#7a5a3a";
        ctx.fillRect(wx - 24, wallTop + 66, 48, 8);
        for (let k = 0; k < 6; k++) {
          ctx.fillStyle = ["#ff7a9b", "#ffd65b", "#ffffff"][(k + v) % 3];
          ellipse(ctx, wx - 18 + k * 7, wallTop + 64, 3.5, 3.5);
          ctx.fill();
        }
      }
      // Door.
      ctx.fillStyle = "#5a3e28";
      roundRect(ctx, cx - 18 + hw * 0.0 + 24, base - 70, 34, 52, 14);
      ctx.fill();
      ctx.fillStyle = "#e9c25a";
      ellipse(ctx, cx + 34, base - 42, 2.5, 2.5);
      ctx.fill();
      // Roof: a tiled gable with an overhang.
      const roof = ROOFS[v],
        peak = wallTop - 110;
      ctx.fillStyle = shade(roof, -0.3);
      ctx.beginPath();
      ctx.moveTo(cx + 6, peak);
      ctx.lineTo(cx + hw + 34, wallTop - 20);
      ctx.lineTo(cx + hw + 22, wallTop + 4);
      ctx.lineTo(cx, peak + 22);
      ctx.closePath();
      ctx.fill();
      const rg = ctx.createLinearGradient(0, peak, 0, wallTop + 6);
      rg.addColorStop(0, shade(roof, 0.12));
      rg.addColorStop(1, shade(roof, -0.12));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(cx - hw - 20, wallTop + 6);
      ctx.lineTo(cx, peak);
      ctx.lineTo(cx + hw + 20, wallTop + 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.16)";
      ctx.lineWidth = 2;
      for (let k = 1; k < 6; k++) {
        const t = k / 6;
        ctx.beginPath();
        ctx.moveTo(cx - (hw + 20) * t, peak + 116 * t);
        ctx.lineTo(cx + (hw + 20) * t, peak + 116 * t);
        ctx.stroke();
      }
      // Chimney (smoke is animated).
      ctx.fillStyle = "#8f5a44";
      ctx.fillRect(cx + hw * 0.45, peak + 18, 22, 44);
      ctx.fillStyle = "#6e4334";
      ctx.fillRect(cx + hw * 0.45 - 3, peak + 14, 28, 8);
    },
  };
}
/** Where each house's chimney top is, relative to its ground anchor. */
export const chimneyOf = (b: TownBuilding) => ({ dx: b.w * 0.225 + 11, dy: -216 });

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
        softShadow(ctx, 40, 42, 34, 9, 0.35);
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
      softShadow(ctx, 46, 52, 36, 10, 0.35);
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
      softShadow(ctx, W / 2 + 6, H - 6, 16, 5, 0.4);
      ctx.fillStyle = "#5a3e28";
      ctx.fillRect(W / 2 - 4, 30, 8, H - 34);
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

/** Small props, each anchored where it meets the ground. */
export function propSprite(kind: string): Sprite {
  switch (kind) {
    case "lamp":
      return {
        w: 40,
        h: 130,
        ax: 20,
        ay: 126,
        draw(ctx) {
          ctx.fillStyle = "#2c2a2e";
          ctx.fillRect(16, 30, 8, 92);
          ctx.fillRect(10, 118, 20, 8);
          ctx.fillStyle = "#3a383e";
          ctx.beginPath();
          ctx.moveTo(8, 30);
          ctx.lineTo(32, 30);
          ctx.lineTo(26, 6);
          ctx.lineTo(14, 6);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#ffe7a8";
          ctx.fillRect(13, 10, 14, 18);
          ctx.fillStyle = "#2c2a2e";
          ctx.fillRect(12, 2, 16, 5);
        },
      };
    case "crates":
      return {
        w: 80,
        h: 70,
        ax: 40,
        ay: 64,
        draw(ctx) {
          const crate = (x: number, y: number, s: number) => {
            ctx.fillStyle = "#a87a4c";
            ctx.fillRect(x, y, s, s);
            ctx.strokeStyle = "#6e4f30";
            ctx.lineWidth = 3;
            ctx.strokeRect(x + 1.5, y + 1.5, s - 3, s - 3);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + s, y + s);
            ctx.stroke();
          };
          crate(6, 30, 34);
          crate(40, 34, 30);
          crate(20, 2, 30);
          ctx.fillStyle = "#7a4a2a";
          ellipse(ctx, 66, 30, 9, 13);
          ctx.fill();
        },
      };
    case "well":
      return {
        w: 100,
        h: 130,
        ax: 50,
        ay: 122,
        draw(ctx) {
          stoneWall(ctx, 14, 82, 72, 40, "#8f846f", 7);
          ctx.fillStyle = "#2a3a4a";
          ellipse(ctx, 50, 82, 36, 12);
          ctx.fill();
          ctx.fillStyle = "#5a3e28";
          ctx.fillRect(16, 26, 6, 60);
          ctx.fillRect(78, 26, 6, 60);
          ctx.fillStyle = "#a8453a";
          ctx.beginPath();
          ctx.moveTo(4, 32);
          ctx.lineTo(50, 4);
          ctx.lineTo(96, 32);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#7a5a3a";
          ctx.fillRect(40, 40, 20, 14);
        },
      };
    case "dummy":
      return {
        w: 60,
        h: 100,
        ax: 30,
        ay: 94,
        draw(ctx) {
          ctx.fillStyle = "#6e4f30";
          ctx.fillRect(27, 40, 6, 56);
          ctx.fillRect(6, 44, 48, 6);
          ctx.fillStyle = "#d8b878";
          ellipse(ctx, 30, 58, 16, 22);
          ctx.fill();
          ctx.fillStyle = "#c9a35c";
          ellipse(ctx, 30, 24, 13, 14);
          ctx.fill();
          ctx.strokeStyle = "#8a6a3a";
          ctx.lineWidth = 2;
          for (const y of [50, 62, 72]) {
            ctx.beginPath();
            ctx.moveTo(16, y);
            ctx.lineTo(44, y);
            ctx.stroke();
          }
          ctx.fillStyle = "#c43c2a";
          ellipse(ctx, 30, 58, 6, 6);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ellipse(ctx, 30, 58, 2.5, 2.5);
          ctx.fill();
        },
      };
    case "mirror":
      return {
        w: 80,
        h: 160,
        ax: 40,
        ay: 154,
        draw(ctx) {
          ctx.fillStyle = "#6e4f30";
          ctx.fillRect(22, 140, 36, 14);
          const frame = ctx.createLinearGradient(0, 0, 80, 0);
          frame.addColorStop(0, "#b8862a");
          frame.addColorStop(0.5, "#ffe08a");
          frame.addColorStop(1, "#a8761f");
          ctx.fillStyle = frame;
          ellipse(ctx, 40, 72, 34, 66);
          ctx.fill();
          const glass = ctx.createLinearGradient(10, 10, 70, 130);
          glass.addColorStop(0, "#e8fbff");
          glass.addColorStop(0.45, "#8fd0ec");
          glass.addColorStop(0.55, "#bfefff");
          glass.addColorStop(1, "#5aa9d6");
          ctx.fillStyle = glass;
          ellipse(ctx, 40, 72, 26, 57);
          ctx.fill();
          ctx.fillStyle = "#ffe08a";
          ellipse(ctx, 40, 8, 8, 8);
          ctx.fill();
        },
      };
    case "obelisk":
      return {
        w: 100,
        h: 300,
        ax: 50,
        ay: 292,
        draw(ctx) {
          stoneWall(ctx, 12, 256, 76, 36, "#7d7360", 3);
          const g = ctx.createLinearGradient(26, 0, 74, 0);
          g.addColorStop(0, "#5a5470");
          g.addColorStop(0.45, "#a29cbc");
          g.addColorStop(1, "#4a4460");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(28, 258);
          ctx.lineTo(36, 40);
          ctx.lineTo(50, 14);
          ctx.lineTo(64, 40);
          ctx.lineTo(72, 258);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#ffe08a";
          ctx.beginPath();
          ctx.moveTo(36, 40);
          ctx.lineTo(50, 14);
          ctx.lineTo(64, 40);
          ctx.closePath();
          ctx.fill();
          // Engraved names.
          ctx.fillStyle = "rgba(255,224,138,0.5)";
          for (let k = 0; k < 7; k++) ctx.fillRect(40, 80 + k * 22, 20 - (k % 3) * 4, 3);
          ctx.fillStyle = "#ffe08a";
          ctx.beginPath();
          ctx.arc(50, 62, 7, 0, Math.PI * 2);
          ctx.fill();
        },
      };
    case "board":
      return {
        w: 320,
        h: 200,
        ax: 160,
        ay: 194,
        draw(ctx) {
          ctx.fillStyle = "#5a3e28";
          ctx.fillRect(24, 40, 12, 156);
          ctx.fillRect(284, 40, 12, 156);
          ctx.fillStyle = "#8a6a44";
          ctx.fillRect(20, 50, 280, 110);
          ctx.strokeStyle = "#5a3e28";
          ctx.lineWidth = 6;
          ctx.strokeRect(20, 50, 280, 110);
          // A little roof.
          ctx.fillStyle = "#4f8a4a";
          ctx.beginPath();
          ctx.moveTo(6, 52);
          ctx.lineTo(160, 10);
          ctx.lineTo(314, 52);
          ctx.closePath();
          ctx.fill();
          // Pinned notes.
          const notes = ["#fff6dc", "#e5ffd6", "#fff1b8", "#e6ecff", "#ffe4ec"];
          for (let k = 0; k < 7; k++) {
            ctx.save();
            ctx.translate(44 + k * 36, 66 + (k % 2) * 30);
            ctx.rotate((rnd(k) - 0.5) * 0.2);
            ctx.fillStyle = notes[k % notes.length];
            ctx.fillRect(0, 0, 30, 36);
            ctx.fillStyle = "rgba(60,40,20,0.4)";
            for (let l = 0; l < 4; l++) ctx.fillRect(4, 8 + l * 6, 22 - (l % 2) * 6, 2);
            ctx.fillStyle = "#c43c2a";
            ellipse(ctx, 15, 3, 3, 3);
            ctx.fill();
            ctx.restore();
          }
        },
      };
    case "pedestal":
      return {
        w: 90,
        h: 60,
        ax: 45,
        ay: 54,
        draw(ctx) {
          stoneWall(ctx, 12, 16, 66, 38, "#8f8aa2", 9);
          ctx.fillStyle = "#b4aec8";
          ctx.fillRect(6, 8, 78, 10);
          ctx.fillStyle = "#e9c25a";
          ctx.fillRect(30, 30, 30, 10);
        },
      };
    case "stone":
      return {
        w: 40,
        h: 50,
        ax: 20,
        ay: 46,
        draw(ctx) {
          ctx.fillStyle = "#6e6657";
          roundRect(ctx, 6, 4, 28, 40, 6);
          ctx.fill();
          ctx.fillStyle = "#857c6c";
          roundRect(ctx, 6, 4, 12, 40, 6);
          ctx.fill();
        },
      };
  }
  throw new Error(`No prop ${kind}`);
}

/** A market stall with a striped awning in its colour. */
export function stallSprite(color: string, goods: number): Sprite {
  return {
    w: 200,
    h: 170,
    ax: 100,
    ay: 160,
    draw(ctx) {
      ctx.fillStyle = "#5a3e28";
      ctx.fillRect(18, 40, 8, 120);
      ctx.fillRect(174, 40, 8, 120);
      // Counter.
      ctx.fillStyle = "#8a6a44";
      ctx.fillRect(14, 100, 172, 56);
      ctx.fillStyle = "#a87a4c";
      ctx.fillRect(10, 94, 180, 10);
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.fillRect(14 + k * 36, 104, 2, 52);
      }
      // Goods on the counter.
      const palette = ["#ff7a9b", "#7fe7ff", "#ffd65b", "#b59bff", "#9be07a", "#ff9b6a"];
      for (let k = 0; k < 8; k++) {
        ctx.fillStyle = palette[(k + goods) % palette.length];
        const x = 24 + k * 20;
        if (goods % 3 === 0) {
          ellipse(ctx, x + 6, 86, 8, 9);
          ctx.fill();
        } else if (goods % 3 === 1) {
          ctx.fillRect(x, 76, 14, 18);
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.fillRect(x + 2, 78, 4, 14);
        } else {
          ctx.beginPath();
          ctx.moveTo(x + 7, 72);
          ctx.lineTo(x + 15, 94);
          ctx.lineTo(x - 1, 94);
          ctx.closePath();
          ctx.fill();
        }
      }
      // Striped awning with a scalloped edge.
      for (let k = 0; k < 8; k++) {
        ctx.fillStyle = k % 2 ? "#fff6e8" : color;
        ctx.beginPath();
        ctx.moveTo(8 + k * 23, 18);
        ctx.lineTo(8 + (k + 1) * 23, 18);
        ctx.lineTo(4 + (k + 1) * 24, 52);
        ctx.lineTo(4 + k * 24, 52);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(4 + k * 24 + 12, 52, 12, 0, Math.PI);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(8, 16, 184, 4);
    },
  };
}

/**
 * The fountain, in two pictures so falling water can pass between them:
 * the basin (stone wall, rim and pool) and the column with its two bowls.
 * Both are anchored at the basin's centre; FOUNTAIN gives the shape in
 * world units from that centre, so the animated water lines up.
 */
export const FOUNTAIN = {
  basin: { rx: 114, ry: 64, wall: 22, rim: 13 },
  pool: { rx: 99, ry: 53, dy: 3 },
  mid: { dy: -78, rx: 56, ry: 19, depth: 22 },
  top: { dy: -134, rx: 25, ry: 8.5, depth: 12 },
  spout: { dy: -156 },
};
const STONE = { light: "#e4dac4", mid: "#c9bda3", dark: "#9a8e76", deep: "#6f6553", line: "rgba(80,68,48,0.35)" };

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
      softShadow(ctx, cx + 8, cy + wall + 6, rx + 30, ry + 22, 0.32);
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
