/**
 * Grumblecrag's five pillars, drawn to match the painted cave (the raid's
 * illustrated floor): dressed limestone with moss, gold grit and amber
 * crystals, a soft shadow along the world's sun, warm light from the
 * crystals, and a low heap of rubble once the boss has charged into one.
 *
 * Every piece is a pure drawer `(ctx, k)` (k = atlas pixels per world unit),
 * drawn ONCE into one atlas when the raid's scene starts
 * (raid-grumble-pillars-rig.ts). Each frame only places, crops, scales,
 * turns and fades images from it. Nothing reads pixels back.
 *
 * World facts (shared with the game, not copied):
 *  - OBSTACLES: each pillar's solid footprint. The stone you see fills it
 *    exactly: the raised top face its back part, the front face its front
 *    BLOCK_H px (arena-courts.ts, stoneBase), so collision and depth sorting
 *    are those of the Coliseum's blocks.
 *  - WORLD_ART.sun and .shadow: the one sun every court block casts by, soft.
 *
 * The PvP Coliseum keeps its own blocks (paintCourtBlock); only the raid
 * uses these.
 */
import { OBSTACLES } from "@arena/shared";
import { WORLD_ART } from "../../../packages/shared/src/world-art";
import { BLOCK_H } from "./arena-courts";

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];
export type Rect = { x: number; y: number; w: number; h: number };

export const PILLARS: readonly Rect[] = OBSTACLES;
const BH = BLOCK_H;
const SUN = WORLD_ART.sun;
const SHADOW = WORLD_ART.shadow;
/** Light direction on screen (toward the light), for faceted rock faces. */
const LD = { x: -0.62, y: -0.42 };
/** The raid-impact ring when the boss breaks a pillar (server: raidRadius 100). */
export const IMPACT_RADIUS = 100;

// ───────────────────────── small helpers ─────────────────────────
let seed = 1;
const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const srand = (s: number) => (seed = Math.max(1, Math.floor(s) % 2147483646));
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
type RGB = [number, number, number];
const hex = (h: string): RGB =>
  [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const rgb = (a: RGB, al = 1) =>
  `rgba(${a.map((v) => Math.round(clamp(v, 0, 255))).join(",")},${al})`;
const mixA = (a: RGB, b: RGB, t: number) =>
  a.map((v, i) => v + (b[i] - v) * t) as RGB;
const shade = (a: RGB, f: number) => a.map((v) => v * f) as RGB;
const ell = (c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) => {
  c.beginPath();
  c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
};
const poly = (c: Ctx, pts: Pt[]) => {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
};
function hull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o: Pt, a: Pt, b: Pt) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Pt[] = [],
    up: Pt[] = [];
  for (const q of p) {
    while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0)
      lo.pop();
    lo.push(q);
  }
  for (const q of [...p].reverse()) {
    while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0)
      up.pop();
    up.push(q);
  }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}
/** Value noise at atlas resolution (cells in world units × k). */
function noise(
  wu: number,
  hu: number,
  k: number,
  scales: [number, number][],
  s0: number,
) {
  const w = Math.max(1, Math.ceil(wu * k)),
    h = Math.max(1, Math.ceil(hu * k));
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const o = out.getContext("2d")!;
  o.fillStyle = "#808080";
  o.fillRect(0, 0, w, h);
  srand(s0);
  for (const [cell, alpha] of scales) {
    const cs = Math.max(1, cell * k);
    const gw = Math.ceil(w / cs) + 2,
      gh = Math.ceil(h / cs) + 2;
    const sm = document.createElement("canvas");
    sm.width = gw;
    sm.height = gh;
    const sc = sm.getContext("2d")!;
    // Seeding small noise is a write (putImageData), never a read-back.
    const img = sc.createImageData(gw, gh);
    for (let i = 0; i < gw * gh; i++) {
      const v = R() * 255;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    sc.putImageData(img, 0, 0);
    o.globalAlpha = alpha;
    o.imageSmoothingEnabled = true;
    o.imageSmoothingQuality = "high";
    o.drawImage(sm, -cs * R(), -cs * R(), gw * cs, gh * cs);
  }
  return out;
}
/** Lay noise over the current clip (overlay: lightens and darkens). */
function texture(
  c: Ctx,
  k: number,
  x: number,
  y: number,
  w: number,
  h: number,
  strength: number,
  s0: number,
  scales: [number, number][],
) {
  const n = noise(w, h, k, scales, s0);
  c.save();
  c.globalCompositeOperation = "overlay";
  c.globalAlpha = strength;
  c.drawImage(n, x, y, w, h);
  c.restore();
}
/** Fill a path blurred (shadowBlur: every browser, no filter). */
function soft(
  c: Ctx,
  k: number,
  blur: number,
  color: string,
  path: (s: Ctx) => void,
) {
  const off = 6000;
  c.save();
  c.shadowColor = color;
  c.shadowBlur = blur * k;
  c.shadowOffsetX = off;
  c.fillStyle = "#000";
  const m = c.getTransform();
  c.setTransform(m.a, m.b, m.c, m.d, m.e - off, m.f);
  path(c);
  c.fill();
  c.restore();
}
/** Grain over what is already drawn (source-atop): stone, not flat paint. */
function speckle(
  c: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  n: number,
  s0: number,
) {
  srand(s0);
  c.save();
  c.globalCompositeOperation = "source-atop";
  for (let i = 0; i < n; i++) {
    const d = R() < 0.55;
    c.fillStyle = d
      ? `rgba(40,30,22,${0.1 + R() * 0.22})`
      : `rgba(255,244,222,${0.08 + R() * 0.2})`;
    const s = 0.4 + R() * 0.9;
    c.fillRect(x + R() * w, y + R() * h, s, s * 0.8);
  }
  c.restore();
}
/** A thin crack: dark line with a lit lip below-right of it. */
function crack(c: Ctx, pts: Pt[], w = 1.1, a = 0.7) {
  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  c.strokeStyle = `rgba(255,244,222,${a * 0.45})`;
  c.lineWidth = w * 0.9;
  c.beginPath();
  pts.forEach(([x, y], i) =>
    i ? c.lineTo(x + 0.7, y + 0.8) : c.moveTo(x + 0.7, y + 0.8),
  );
  c.stroke();
  c.strokeStyle = `rgba(48,34,22,${a})`;
  c.lineWidth = w;
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.stroke();
  c.restore();
}
function walk(
  x: number,
  y: number,
  dx: number,
  dy: number,
  n: number,
  jit: number,
) {
  const pts: Pt[] = [[x, y]];
  for (let i = 0; i < n; i++) {
    x += dx + (R() - 0.5) * jit;
    y += dy + (R() - 0.5) * jit;
    pts.push([x, y]);
  }
  return pts;
}

// Stone palette sampled from the painting's wall blocks and flagstones.
const TOP_A = hex("#e8d8bf"),
  TOP_B = hex("#aa9e95");
const FRONT_A = hex("#a89c90"),
  FRONT_B = hex("#7a706c");
const FRESH = hex("#ddd3c2");
const AMBER = {
  lit: hex("#ffe08a"),
  mid: hex("#f3a93a"),
  dark: hex("#a85a14"),
  deep: hex("#5e2c08"),
};

/** A small amber crystal cluster growing up from (x, y). */
function crystals(c: Ctx, x: number, y: number, size: number, s0: number) {
  srand(s0);
  c.fillStyle = "rgba(40,26,14,0.55)";
  ell(c, x, y + 1, size * 0.75, size * 0.28);
  c.fill();
  // Its little shadow on the stone, along the sun.
  c.fillStyle = "rgba(40,26,14,0.22)";
  poly(c, [
    [x - size * 0.3, y],
    [x + size * 0.4, y],
    [x + size * (0.4 + SUN.x * 2), y + size * SUN.y * 2 + size * 0.15],
    [x + size * 0.4, y + size * 0.5],
  ]);
  c.fill();
  const list: [number, number, number][] = [
    [-0.35, 0.62, -0.32],
    [0.32, 0.72, 0.28],
    [0.02, 1.0, 0.02],
    [-0.12, 0.5, -0.6],
    [0.5, 0.45, 0.65],
  ];
  for (const [ox, len, lean] of list) {
    const bx = x + ox * size,
      by = y;
    const L = size * len * (0.85 + R() * 0.3),
      wd = size * (0.17 + R() * 0.06);
    const ang = lean * 0.7;
    const ux = Math.sin(ang),
      uy = -Math.cos(ang);
    const px = -uy,
      py = ux;
    const tip: Pt = [bx + ux * L, by + uy * L];
    const sh: Pt = [bx + ux * L * 0.72, by + uy * L * 0.72];
    const l0: Pt = [bx - px * wd, by - py * wd],
      r0: Pt = [bx + px * wd, by + py * wd];
    const l1: Pt = [sh[0] - px * wd, sh[1] - py * wd],
      r1: Pt = [sh[0] + px * wd, sh[1] + py * wd];
    const g1 = c.createLinearGradient(l0[0], l0[1], tip[0], tip[1]);
    g1.addColorStop(0, rgb(AMBER.mid));
    g1.addColorStop(1, rgb(AMBER.lit));
    c.fillStyle = g1;
    poly(c, [l0, [bx, by], sh, tip, l1]);
    c.fill();
    const g2 = c.createLinearGradient(r0[0], r0[1], tip[0], tip[1]);
    g2.addColorStop(0, rgb(AMBER.deep));
    g2.addColorStop(1, rgb(AMBER.dark));
    c.fillStyle = g2;
    poly(c, [[bx, by], r0, r1, tip, sh]);
    c.fill();
    c.strokeStyle = "rgba(255,250,215,0.85)";
    c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(bx + ux * L * 0.15, by + uy * L * 0.15);
    c.lineTo(sh[0], sh[1]);
    c.lineTo(tip[0], tip[1]);
    c.stroke();
    c.fillStyle = "rgba(255,200,90,0.35)";
    ell(c, bx + ux * L * 0.3, by + uy * L * 0.3, wd * 0.6, L * 0.15, ang);
    c.fill();
    c.strokeStyle = "rgba(60,26,6,0.5)";
    c.lineWidth = 0.5;
    poly(c, [l0, r0, r1, tip, l1]);
    c.stroke();
  }
}
/** A moss clump with lit tops (light from the upper left). */
function moss(c: Ctx, x: number, y: number, r: number, s0: number) {
  srand(s0);
  const cols = ["#3d5226", "#4f6a2c", "#647f35", "#7f9840"];
  c.fillStyle = "rgba(30,24,10,0.25)";
  ell(c, x + r * 0.25, y + r * 0.2, r * 1.05, r * 0.6);
  c.fill();
  for (let n = 0; n < 26; n++) {
    const a = R() * Math.PI * 2,
      d = Math.sqrt(R()) * r;
    const px = x + Math.cos(a) * d,
      py = y + Math.sin(a) * d * 0.55;
    const s = r * (0.16 + R() * 0.22);
    const lit = clamp(
      0.5 -
        ((Math.cos(a) * d) / r) * 0.3 -
        ((Math.sin(a) * d) / r) * 0.3 +
        R() * 0.3,
      0,
      0.999,
    );
    c.fillStyle = cols[Math.floor(lit * cols.length)];
    ell(c, px, py, s, s * 0.75);
    c.fill();
  }
  c.fillStyle = "rgba(196,214,110,0.75)";
  for (let n = 0; n < 9; n++) {
    ell(
      c,
      x - r * 0.3 + (R() - 0.5) * r,
      y - r * 0.2 + (R() - 0.5) * r * 0.4,
      0.7,
      0.5,
    );
    c.fill();
  }
}
function lichen(c: Ctx, x: number, y: number, r: number, s0: number) {
  srand(s0);
  for (let n = 0; n < 14; n++) {
    const a = R() * Math.PI * 2,
      d = Math.sqrt(R()) * r;
    c.fillStyle = R() > 0.5 ? "rgba(168,150,78,0.32)" : "rgba(196,178,104,0.3)";
    ell(
      c,
      x + Math.cos(a) * d,
      y + Math.sin(a) * d * 0.6,
      1 + R() * 2.2,
      0.8 + R() * 1.5,
    );
    c.fill();
  }
}
/** Golden grit that settles in cracks and joints (the cave floor's sand). */
function grit(c: Ctx, pts: Pt[], n: number, spread: number) {
  for (let i = 0; i < n; i++) {
    const p = pts[Math.floor(R() * pts.length)];
    c.fillStyle = R() > 0.4 ? "rgba(214,160,72,0.55)" : "rgba(250,214,140,0.5)";
    ell(
      c,
      p[0] + (R() - 0.5) * spread,
      p[1] + (R() - 0.5) * spread * 0.6,
      0.5 + R() * 0.8,
      0.4 + R() * 0.5,
    );
    c.fill();
  }
}

/**
 * A broken stone: an irregular top extruded to the ground, every face lit by
 * the light direction, a split across the top and grain over all of it (so
 * it reads as rock, not a flat cut-out).
 */
function rock(
  c: Ctx,
  x: number,
  y: number,
  sz: number,
  h: number,
  tone: RGB,
  s0: number,
) {
  srand(s0);
  const n = 5 + Math.floor(R() * 4),
    pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + R() * 0.6,
      r = sz * (0.6 + R() * 0.5);
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * 0.62 - h]);
  }
  for (let i = 0; i < n; i++) {
    const a = pts[i],
      b = pts[(i + 1) % n];
    const ex = b[0] - a[0],
      ey = b[1] - a[1];
    const nl = Math.hypot(ex, ey) || 1;
    const nx = ey / nl,
      ny = -ex / nl;
    if (ny < -0.05) continue;
    const f = clamp(0.66 + 0.3 * (nx * LD.x + ny * LD.y), 0.5, 0.92);
    const col = shade(tone, f);
    const g = c.createLinearGradient(0, a[1], 0, a[1] + h);
    g.addColorStop(0, rgb(col));
    g.addColorStop(1, rgb(mixA(shade(col, 0.88), [200, 160, 100], 0.18)));
    c.fillStyle = g;
    poly(c, [a, b, [b[0], b[1] + h], [a[0], a[1] + h]]);
    c.fill();
  }
  // Top: two facets split by a ridge, the one facing the light brighter.
  const m = 1 + Math.floor(R() * (n - 2));
  const tg = c.createLinearGradient(
    x - sz,
    y - h - sz * 0.6,
    x + sz,
    y - h + sz * 0.6,
  );
  tg.addColorStop(0, rgb(mixA(tone, [255, 232, 196], 0.3)));
  tg.addColorStop(1, rgb(shade(tone, 0.9)));
  c.fillStyle = tg;
  poly(c, pts);
  c.fill();
  c.fillStyle = "rgba(60,42,26,0.14)";
  poly(c, [pts[0], ...pts.slice(m)]);
  c.fill();
  c.strokeStyle = "rgba(255,248,230,0.28)";
  c.lineWidth = 0.5;
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  c.lineTo(pts[m][0], pts[m][1]);
  c.stroke();
  // Lit edges toward the light; a faint dark seat, no cartoon outline.
  c.strokeStyle = "rgba(255,226,180,0.4)";
  c.lineWidth = 0.6;
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const a = pts[i],
      b = pts[(i + 1) % n];
    const ex = b[0] - a[0],
      ey = b[1] - a[1],
      l = Math.hypot(ex, ey) || 1;
    if (ey / l < -0.2 || ex < -0.2 * l) {
      c.moveTo(a[0], a[1]);
      c.lineTo(b[0], b[1]);
    }
  }
  c.stroke();
  const base = pts.map(([px, py]) => [px, py + h] as Pt);
  c.strokeStyle = "rgba(38,24,12,0.14)";
  c.lineWidth = 0.5;
  poly(c, hull([...pts, ...base]));
  c.stroke();
}

// ───────────────────────── pillar pieces ─────────────────────────
/** Room around a footprint in the pillar picture (moss and crystal tips). */
const PAD = 14;
export const frameBlock = (o: Rect): Rect => ({
  x: o.x - PAD,
  y: o.y - PAD,
  w: o.w + PAD * 2,
  h: o.h + PAD * 2,
});
/** Where each pillar's crystal cluster grows on its top (fractions of the top face), and its size. */
const CRYSTAL: ([number, number, number] | null)[] = [
  [0.72, 0.66, 16],
  [0.3, 0.72, 13],
  [0.27, 0.62, 15],
  [0.7, 0.7, 13],
  null,
];
/** The centre pillar's gem: the middle of its front face. */
export const gemAt = (o: Rect) => ({
  x: o.x + o.w / 2,
  y: o.y + o.h - BH / 2 - 2,
});
export const crystalAt = (o: Rect, i: number) => {
  const c = CRYSTAL[i];
  if (!c) return null;
  const topH = o.h - BH;
  return { x: o.x + o.w * c[0], y: o.y + topH * c[1], s: c[2] };
};
/** Where a glint shows on pillar i (a crystal tip, or the gem). */
export function glintSpot(o: Rect, i: number) {
  const cr = crystalAt(o, i);
  if (cr) return { x: cr.x, y: cr.y - cr.s * 0.9 };
  const g = gemAt(o);
  return { x: g.x - 2.5, y: g.y - 2.5 };
}

/** The silhouette: the footprint with a few chipped corners. */
function outline(c: Ctx, o: Rect, s0: number) {
  srand(s0);
  const L = o.x,
    T = o.y,
    Rr = o.x + o.w,
    B = o.y + o.h,
    F = o.y + o.h - BH;
  const a = 2 + R() * 3,
    b = 2 + R() * 2,
    d = 3 + R() * 4;
  poly(c, [
    [L + a, T],
    [Rr - b, T],
    [Rr, T + b + 1],
    [Rr, F - 2],
    [Rr - 2.5, F + 1],
    [Rr - 1, F + 5],
    [Rr, F + 6],
    [Rr, B - 2],
    [Rr - 2, B],
    [L + d, B],
    [L, B - 2],
    [L, T + a],
  ]);
}
/** How strongly the painting's warm sun reaches a spot (bright toward the upper left). */
const sunAt = (x: number, y: number) =>
  clamp(1.15 - Math.hypot(x - 180, (y - 60) * 1.3) / 1250, 0.35, 1);
/**
 * A dressed stone in the front face: worn edges lit softly from above-left,
 * shade low, pits and chips, and a weathered tone of its own. Its joint is
 * a hairline, so the courses read as one cut wall rather than bricks.
 */
function ashlar(
  c: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  tone: RGB,
  warm: number,
  s0: number,
) {
  srand(s0);
  const r = Math.min(2.2, h * 0.14);
  const rr = (inset: number) => {
    c.beginPath();
    c.roundRect(
      x + inset,
      y + inset,
      w - inset * 2,
      h - inset * 2,
      Math.max(0.4, r - inset * 0.5),
    );
  };
  const g = c.createLinearGradient(x, y, x + w * 0.3, y + h);
  g.addColorStop(0, rgb(mixA(tone, [255, 214, 160], 0.14 * warm)));
  g.addColorStop(1, rgb(shade(tone, 0.86)));
  c.fillStyle = g;
  rr(0.3);
  c.fill();
  c.save();
  rr(0.3);
  c.clip();
  // Weather: a broad blotch of its own, darker toward the base.
  c.fillStyle = `rgba(${R() > 0.5 ? "70,58,50" : "160,150,150"},${0.06 + R() * 0.1})`;
  ell(
    c,
    x + w * (0.2 + R() * 0.6),
    y + h * (0.3 + R() * 0.5),
    w * (0.25 + R() * 0.3),
    h * (0.3 + R() * 0.3),
  );
  c.fill();
  c.strokeStyle = `rgba(255,214,160,${0.3 * warm})`;
  c.lineWidth = 0.9;
  c.beginPath();
  c.moveTo(x + 0.8, y + h - 2);
  c.lineTo(x + 0.9, y + 0.9);
  c.lineTo(x + w - 2, y + 0.9);
  c.stroke();
  const sg = c.createLinearGradient(0, y + h * 0.55, 0, y + h);
  sg.addColorStop(0, "rgba(28,18,12,0)");
  sg.addColorStop(1, "rgba(28,18,12,0.24)");
  c.fillStyle = sg;
  c.fillRect(x, y, w, h);
  for (let q = 0; q < 7; q++) {
    const px = x + 2 + R() * (w - 4),
      py = y + 2 + R() * (h - 4);
    c.fillStyle = "rgba(34,24,16,0.3)";
    c.fillRect(px, py, 0.9, 0.7);
    c.fillStyle = "rgba(255,226,180,0.25)";
    c.fillRect(px + 0.6, py + 0.8, 0.7, 0.5);
  }
  if (R() > 0.45) {
    const cx = x + 3 + R() * (w - 6),
      s = 1.4 + R() * 2;
    c.fillStyle = "rgba(40,28,18,0.5)";
    poly(c, [
      [cx - s, y + 0.3],
      [cx + s, y + 0.3],
      [cx + s * 0.3, y + s * 1.1],
    ]);
    c.fill();
    c.fillStyle = "rgba(255,226,180,0.35)";
    poly(c, [
      [cx + s * 0.3, y + s * 1.1],
      [cx + s, y + 0.3],
      [cx + s * 0.8, y + s * 0.4],
    ]);
    c.fill();
  }
  c.restore();
}
/**
 * The front face's stones: two courses of unequal height with long and short
 * stones, now and then one tall stone through both (broken bond), so it
 * reads as a cut wall, not a brick grid.
 */
function frontCourses(
  c: Ctx,
  o: Rect,
  F: number,
  capH: number,
  plH: number,
  warm: number,
  s0: number,
) {
  const L = o.x,
    Rr = o.x + o.w;
  const space = BH - capH - plH;
  const h0 = Math.round(space * 0.54),
    h1 = space - h0;
  const y0 = F + capH,
    y1 = y0 + h0;
  srand(s0 + 3);
  const tone = () =>
    mixA(
      mixA(FRONT_A, FRONT_B, 0.22 + R() * 0.32),
      [150, 136, 150],
      R() * 0.22,
    );
  const tall: [number, number][] = [];
  let x = L - R() * 14;
  while (x < Rr) {
    const sw = 26 + R() * 26;
    const through = R() < 0.22 && x > L + 6 && x + sw * 0.7 < Rr - 6;
    const w = through ? sw * 0.6 : sw;
    ashlar(
      c,
      x,
      y0,
      w,
      through ? space : h0,
      tone(),
      warm,
      s0 + Math.floor(x * 7),
    );
    if (through) tall.push([x, x + w]);
    x += w;
  }
  x = L - 8 - R() * 16;
  while (x < Rr) {
    const sw = 22 + R() * 30;
    const block = tall.find(([a, b]) => x < b && x + sw > a);
    if (block && x >= block[0]) {
      x = block[1];
      continue;
    }
    const w = block ? block[0] - x : sw;
    if (w > 1)
      ashlar(c, x, y1, w, h1, tone(), warm, s0 + Math.floor(x * 7) + 101);
    x += Math.max(1, w);
  }
  srand(s0 + 9);
  x = L - R() * 8;
  while (x < Rr) {
    const sw = 30 + R() * 26;
    ashlar(
      c,
      x,
      o.y + o.h - plH,
      sw,
      plH,
      mixA(FRONT_A, [188, 160, 120], 0.25),
      warm,
      s0 + Math.floor(x * 5) + 7,
    );
    x += sw;
  }
}

/** One pillar, intact. Picture top-left = frameBlock(o). */
function pillar(c: Ctx, k: number, o: Rect, i: number) {
  c.save();
  c.scale(k, k);
  const fr = frameBlock(o);
  c.translate(-fr.x, -fr.y);
  const L = o.x,
    T = o.y,
    W = o.w,
    Rr = o.x + o.w,
    B = o.y + o.h;
  const topH = o.h - BH,
    F = T + topH;
  const s0 = (i + 1) * 911;
  const warm = sunAt(L + W / 2, T + o.h / 2);

  c.save();
  outline(c, o, s0);
  c.clip();
  // ── Front face: hairline joints, then the dressed stones ──
  c.fillStyle = "#5c4c40";
  c.fillRect(L, F, W, BH);
  const capH = 11,
    plH = 10;
  frontCourses(c, o, F, capH, plH, warm, s0);
  // Capstone band: the slab's edge, thicker and brighter than the shaft.
  const cg = c.createLinearGradient(0, F, 0, F + capH);
  cg.addColorStop(0, rgb(mixA(TOP_B, [255, 226, 180], 0.3 * warm)));
  cg.addColorStop(0.55, rgb(shade(TOP_B, 0.88)));
  cg.addColorStop(1, rgb(shade(TOP_B, 0.66)));
  c.fillStyle = cg;
  c.fillRect(L, F, W, capH);
  texture(c, k, L, F, W, capH, 0.45, s0 + 5, [
    [5, 1],
    [1.5, 0.6],
  ]);
  c.fillStyle = "rgba(24,16,10,0.6)";
  c.fillRect(L, F + capH - 1, W, 1.2);
  texture(c, k, L, F + capH, W, BH - capH, 0.42, s0 + 11, [
    [8, 1],
    [2.5, 0.6],
    [1, 0.5],
  ]);
  // Weathering streaks running down from the capstone, across the joints.
  srand(s0 + 13);
  for (let q = 0; q < 6; q++) {
    const x = L + 4 + R() * (W - 8),
      len = 12 + R() * 26;
    const g = c.createLinearGradient(0, F + capH, 0, F + capH + len);
    g.addColorStop(0, "rgba(40,28,18,0.3)");
    g.addColorStop(1, "rgba(40,28,18,0)");
    c.fillStyle = g;
    c.fillRect(x, F + capH, 1.4 + R() * 3, len);
  }
  // Warm light bouncing up off the sunlit floor, and contact darkening.
  const bl = c.createLinearGradient(0, B - 22, 0, B);
  bl.addColorStop(0, "rgba(240,170,80,0)");
  bl.addColorStop(0.8, `rgba(240,170,80,${0.2 * warm})`);
  bl.addColorStop(1, `rgba(240,170,80,${0.06 * warm})`);
  c.fillStyle = bl;
  c.fillRect(L, B - 22, W, 22);
  c.fillStyle = "rgba(20,12,6,0.55)";
  c.fillRect(L, B - 1.4, W, 1.4);
  // Lit west arris, shaded east arris.
  let sg = c.createLinearGradient(L, 0, L + 7, 0);
  sg.addColorStop(0, `rgba(255,214,150,${0.4 * warm})`);
  sg.addColorStop(1, "rgba(255,214,150,0)");
  c.fillStyle = sg;
  c.fillRect(L, F, 7, BH);
  sg = c.createLinearGradient(Rr - 12, 0, Rr, 0);
  sg.addColorStop(0, "rgba(20,12,8,0)");
  sg.addColorStop(1, "rgba(20,12,8,0.45)");
  c.fillStyle = sg;
  c.fillRect(Rr - 12, F, 12, BH);

  // ── Top face: the capstone, facing the sky ──
  const tg = c.createLinearGradient(L, T, Rr, F + 10);
  tg.addColorStop(0, rgb(mixA(TOP_A, [255, 222, 168], 0.35 * warm)));
  tg.addColorStop(0.6, rgb(mixA(TOP_A, TOP_B, 0.55)));
  tg.addColorStop(1, rgb(TOP_B));
  c.fillStyle = tg;
  c.fillRect(L, T, W, topH);
  texture(c, k, L, T, W, topH, 0.55, s0 + 21, [
    [16, 1],
    [6, 0.8],
    [2, 0.6],
    [0.8, 0.45],
  ]);
  srand(s0 + 22);
  for (let q = 0; q < 10; q++) {
    c.fillStyle = `rgba(120,112,128,${0.08 + R() * 0.1})`;
    ell(c, L + R() * W, T + R() * topH, 4 + R() * 9, 2.5 + R() * 6, R() * 3);
    c.fill();
  }
  srand(s0 + 23);
  for (let q = 0; q < 160; q++) {
    const x = L + R() * W,
      y = T + R() * topH,
      d = R() > 0.55;
    c.fillStyle = d
      ? `rgba(76,60,46,${0.15 + R() * 0.25})`
      : `rgba(255,246,226,${0.2 + R() * 0.3})`;
    c.fillRect(x, y, 0.6 + R() * 0.9, 0.5 + R() * 0.6);
  }
  // Two slabs with a bevelled joint.
  const jy = T + topH * (0.44 + R() * 0.12);
  c.fillStyle = "rgba(36,24,14,0.6)";
  c.fillRect(L, jy - 0.8, W, 1.5);
  c.fillStyle = `rgba(255,230,186,${0.5 * warm + 0.1})`;
  c.fillRect(L, jy + 0.8, W, 1);
  c.fillStyle = "rgba(36,24,14,0.18)";
  c.fillRect(L, jy - 4, W, 3.2);
  grit(
    c,
    Array.from({ length: 12 }, (_, q) => [L + (W * q) / 11, jy] as Pt),
    30,
    2,
  );
  // Rounded rim: bright along the back and west edges, dark along the east edge.
  const rim = 5;
  let g = c.createLinearGradient(0, T, 0, T + rim);
  g.addColorStop(0, `rgba(255,236,196,${0.55 + 0.3 * warm})`);
  g.addColorStop(1, "rgba(255,236,196,0)");
  c.fillStyle = g;
  c.fillRect(L, T, W, rim);
  g = c.createLinearGradient(L, 0, L + rim, 0);
  g.addColorStop(0, `rgba(255,236,196,${0.5 + 0.3 * warm})`);
  g.addColorStop(1, "rgba(255,236,196,0)");
  c.fillStyle = g;
  c.fillRect(L, T, rim, topH);
  g = c.createLinearGradient(Rr - rim - 3, 0, Rr, 0);
  g.addColorStop(0, "rgba(34,22,14,0)");
  g.addColorStop(1, "rgba(34,22,14,0.5)");
  c.fillStyle = g;
  c.fillRect(Rr - rim - 3, T, rim + 3, topH);
  g = c.createLinearGradient(0, F - 6, 0, F);
  g.addColorStop(0, "rgba(34,22,14,0)");
  g.addColorStop(1, "rgba(34,22,14,0.28)");
  c.fillStyle = g;
  c.fillRect(L, F - 6, W, 6);
  c.fillStyle = `rgba(255,232,190,${0.55 + 0.3 * warm})`;
  c.fillRect(L, F - 1.3, W, 1.3);
  // Short cracks running in from the edges, with grit settled in them.
  srand(s0 + 31);
  const c1 = walk(L + W * (0.3 + R() * 0.4), T + 0.5, 1.6, 3.4, 6, 3.2);
  crack(c, c1, 1.1, 0.8);
  crack(c, walk(c1[3][0], c1[3][1], 3, 1.2, 3, 2.4), 0.7, 0.6);
  grit(c, c1, 16, 2);
  const c2 = walk(Rr - 0.5, T + topH * (0.62 + R() * 0.2), -3.2, 0.8, 4, 2.4);
  crack(c, c2, 0.9, 0.7);
  lichen(c, L + 10 + R() * 20, T + 8 + R() * 10, 8, s0 + 41);
  lichen(c, Rr - 14 - R() * 10, jy + 10, 6, s0 + 43);
  const mx = i % 2 ? Rr - 9 : L + 9,
    my = i % 2 ? T + topH - 7 : T + 7;
  moss(c, mx, my, 7 + (i % 3), s0 + 49);
  moss(c, L + 10 + ((i * 23) % (W - 24)), B - 3, 5, s0 + 51);
  moss(c, Rr - 12, B - 2, 3.5, s0 + 53);
  grit(
    c,
    Array.from({ length: 10 }, (_, q) => [L + (W * q) / 9, B - 1] as Pt),
    30,
    3,
  );
  // The sun's warmth over the whole stone, stronger toward the lit corner of the cave.
  const wash = c.createLinearGradient(L, T, Rr, B);
  wash.addColorStop(0, `rgba(255,168,72,${0.22 * warm})`);
  wash.addColorStop(1, "rgba(255,168,72,0)");
  c.save();
  c.globalCompositeOperation = "soft-light";
  c.fillStyle = wash;
  c.fillRect(L, T, W, o.h);
  c.restore();
  c.restore();
  // Silhouette line: keeps the pillar crisp against the painted floor.
  c.save();
  c.strokeStyle = "rgba(30,18,10,0.6)";
  c.lineWidth = 1.1;
  outline(c, o, s0);
  c.stroke();
  c.restore();
  // A corner knocked off the front-right arris.
  c.save();
  outline(c, o, s0);
  c.clip();
  c.fillStyle = rgb(shade(FRONT_B, 0.6));
  poly(c, [
    [Rr - 2.5, F + 1],
    [Rr - 9, F + 0.5],
    [Rr - 4, F + 6],
    [Rr - 1, F + 5],
  ]);
  c.fill();
  c.fillStyle = rgb(FRESH, 0.8);
  poly(c, [
    [Rr - 2.5, F - 0.5],
    [Rr - 9, F - 0.5],
    [Rr - 9, F + 0.5],
    [Rr - 2.5, F + 1],
  ]);
  c.fill();
  c.restore();
  // Upright details that may cross the footprint's back edge a little.
  const cr = crystalAt(o, i);
  if (cr) crystals(c, cr.x, cr.y, cr.s, s0 + 61);
  if (i === 4) gem(c, gemAt(o).x, gemAt(o).y, 1);
  c.restore();
}

/** The centre pillar's amber gem in a bronze collar. */
function gem(c: Ctx, x: number, y: number, power: number) {
  c.fillStyle = "rgba(30,20,12,0.65)";
  ell(c, x, y, 12, 12);
  c.fill();
  const ring = c.createLinearGradient(x - 11, y - 11, x + 11, y + 11);
  ring.addColorStop(0, "#f1cf7a");
  ring.addColorStop(0.45, "#a9792e");
  ring.addColorStop(1, "#4a3110");
  c.strokeStyle = ring;
  c.lineWidth = 3;
  ell(c, x, y, 10, 10);
  c.stroke();
  c.strokeStyle = "rgba(30,18,6,0.6)";
  c.lineWidth = 0.7;
  ell(c, x, y, 11.6, 11.6);
  c.stroke();
  ell(c, x, y, 8.4, 8.4);
  c.stroke();
  for (const a of [0.4, 2.2, 3.6, 5.1]) {
    c.fillStyle = "rgba(94,150,120,0.55)";
    ell(c, x + Math.cos(a) * 10, y + Math.sin(a) * 10, 1.2, 0.9);
    c.fill();
  }
  const r = 7.6,
    n = 8;
  for (let q = 0; q < n; q++) {
    const a0 = (q / n) * Math.PI * 2 - Math.PI / 8,
      a1 = ((q + 1) / n) * Math.PI * 2 - Math.PI / 8;
    const am = (a0 + a1) / 2;
    const f = 0.55 + 0.45 * -(Math.cos(am) * 0.7 + Math.sin(am) * 0.7);
    c.fillStyle = rgb(mixA(AMBER.dark, AMBER.lit, clamp(f) * power));
    poly(c, [
      [x, y],
      [x + Math.cos(a0) * r, y + Math.sin(a0) * r],
      [x + Math.cos(a1) * r, y + Math.sin(a1) * r],
    ]);
    c.fill();
  }
  c.fillStyle = rgb(mixA(AMBER.mid, AMBER.lit, 0.4 * power));
  poly(
    c,
    Array.from(
      { length: 8 },
      (_, q) =>
        [
          x + Math.cos((q / 8) * Math.PI * 2) * 3.6,
          y + Math.sin((q / 8) * Math.PI * 2) * 3.6,
        ] as Pt,
    ),
  );
  c.fill();
  c.fillStyle = "rgba(255,255,240,0.95)";
  ell(c, x - 2.4, y - 2.6, 1.6, 1.1, -0.6);
  c.fill();
}

/**
 * The pillar's shadow on the floor: its base swept along WORLD_ART.sun by its
 * height (as every court block casts it, arena-courts.ts blockShadow), blurred
 * by WORLD_ART.shadow, so pillars and fighters share one sun. Plus a soft
 * contact line at its foot. Picture: frameShadow(o).
 */
export const SHADOW_PAD = SHADOW.blur + 4;
export const frameShadow = (o: Rect): Rect => ({
  x: o.x - SHADOW_PAD,
  y: o.y + BH - SHADOW_PAD,
  w: o.w + SUN.x * BH + SHADOW_PAD * 2,
  h: o.h - BH + SUN.y * BH + SHADOW_PAD * 2,
});
/** The shadow's outline: the base, swept by the sun (world points). */
export function shadowOutline(o: Rect): Pt[] {
  const base: Pt[] = [
    [o.x, o.y + BH],
    [o.x + o.w, o.y + BH],
    [o.x + o.w, o.y + o.h],
    [o.x, o.y + o.h],
  ];
  return hull([
    ...base,
    ...base.map(([x, y]) => [x + SUN.x * BH, y + SUN.y * BH] as Pt),
  ]);
}
function pillarShadow(c: Ctx, k: number, o: Rect) {
  c.save();
  c.scale(k, k);
  const fr = frameShadow(o);
  c.translate(-fr.x, -fr.y);
  soft(c, k, SHADOW.blur, `rgba(20,24,12,${SHADOW.alpha})`, (s) =>
    poly(s, shadowOutline(o)),
  );
  soft(c, k, 3, "rgba(18,10,4,0.4)", (s) =>
    s.rect(o.x - 1, o.y + o.h - 3, o.w + 2, 4),
  );
  c.restore();
}

/** Additive light from the pillar's crystals (or gem): a halo and a pool on the floor. */
export const frameLight = (o: Rect): Rect => ({
  x: o.x - 30,
  y: o.y - 30,
  w: o.w + 60,
  h: o.h + 70,
});
/** Where the broken crystal (or the gem) lies in the heap. */
export const rubbleShard = (o: Rect, i: number) => ({
  x: o.x + o.w * (i === 4 ? 0.5 : 0.3 + (i % 2) * 0.42),
  y: o.y + o.h + 10 - (i === 4 ? 0 : 4),
});
function pillarLight(c: Ctx, k: number, o: Rect, i: number, broken = false) {
  c.save();
  c.scale(k, k);
  const fr = frameLight(o);
  c.translate(-fr.x, -fr.y);
  const halo = (x: number, y: number, r: number, a: number) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,196,96,${a})`);
    g.addColorStop(0.35, `rgba(255,150,50,${a * 0.35})`);
    g.addColorStop(1, "rgba(255,120,30,0)");
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  };
  const pool = (x: number, y: number, rx: number, ry: number, a: number) => {
    c.save();
    c.translate(x, y);
    c.scale(1, ry / rx);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(255,170,70,${a})`);
    g.addColorStop(0.5, `rgba(255,140,50,${a * 0.4})`);
    g.addColorStop(1, "rgba(255,120,40,0)");
    c.fillStyle = g;
    c.fillRect(-rx, -rx, rx * 2, rx * 2);
    c.restore();
  };
  c.globalCompositeOperation = "lighter";
  if (broken) {
    const p = rubbleShard(o, i);
    halo(p.x, p.y, 16, 0.32);
    pool(p.x, p.y + 4, 30, 11, 0.12);
  } else if (i === 4) {
    const src = gemAt(o);
    halo(src.x, src.y, 22, 0.5);
    pool(src.x, o.y + o.h + 6, 46, 15, 0.22);
  } else {
    const src = crystalAt(o, i)!;
    halo(src.x, src.y - src.s * 0.45, 20, 0.42);
    pool(src.x, o.y + o.h + 8, 40, 13, 0.14);
  }
  c.restore();
}

/** Cracks that race over a pillar as the boss hits it. Picture: frameBlock(o). */
function pillarCracks(c: Ctx, k: number, o: Rect, i: number) {
  c.save();
  c.scale(k, k);
  const fr = frameBlock(o);
  c.translate(-fr.x, -fr.y);
  outline(c, o, (i + 1) * 911);
  c.clip();
  srand(i * 37 + 5);
  const F = o.y + o.h - BH;
  const from: Pt = [o.x + o.w * (0.35 + R() * 0.3), F + 6];
  for (let q = 0; q < 7; q++) {
    const a = -Math.PI / 2 + (q - 3) * 0.55 + (R() - 0.5) * 0.3;
    const pts = walk(
      from[0],
      from[1],
      Math.cos(a) * 7,
      Math.sin(a) * 7 * (a < 0 ? 1.1 : 0.9),
      6 + Math.floor(R() * 4),
      4,
    );
    crack(c, pts, 1.6, 0.85);
    c.fillStyle = "rgba(240,226,196,0.35)";
    const e = pts[pts.length - 1];
    ell(c, e[0], e[1], 2.5, 1.6);
    c.fill();
  }
  for (let q = 0; q < 4; q++) {
    const y = F + 12 + q * 11;
    crack(c, walk(o.x + R() * 10, y, 8, (R() - 0.5) * 4, 8, 3), 1.3, 0.75);
  }
  c.restore();
}

// ───────────────────────── rubble ─────────────────────────
export const frameRubble = (o: Rect): Rect => ({
  x: o.x - 34,
  y: o.y + 18,
  w: o.w + 34 + 58,
  h: o.h - 18 + 40,
});
/** Rubble stones take on the cave's warm dust. */
const warmT = (t: RGB) => mixA(t, [176, 146, 112], 0.22);
function rubble(c: Ctx, k: number, o: Rect, i: number) {
  c.save();
  c.scale(k, k);
  const fr = frameRubble(o);
  c.translate(-fr.x, -fr.y);
  const s0 = (i + 3) * 577;
  srand(s0);
  const L = o.x,
    Rr = o.x + o.w,
    B = o.y + o.h,
    W2 = o.w - 4;
  const stH = 12;
  const sT0 = o.y + BH - stH,
    sF = B - stH;
  const sT = sT0 + (sF - sT0) * 0.42;
  type Stone = [number, number, number, number, RGB, number, number];
  const chunks: Stone[] = [];
  for (let q = 0; q < 16; q++) {
    const a = Math.PI * (0.05 + R() * 0.9) + (R() > 0.75 ? Math.PI : 0);
    const d = 0.55 + Math.sqrt(R()) * 0.65;
    const x = o.x + o.w / 2 + Math.cos(a) * d * o.w * 0.62;
    const y = B - 6 + Math.sin(a) * d * 26;
    const fresh = R() > 0.45;
    const big = R() < 0.25;
    chunks.push([
      x,
      y,
      (big ? 7 : 3.5) + R() * (big ? 6 : 5),
      2 + R() * (big ? 5 : 3.5),
      warmT(
        fresh ? mixA(FRESH, TOP_B, R() * 0.5) : mixA(FRONT_A, TOP_B, R() * 0.6),
      ),
      s0 + q * 13,
      0,
    ]);
  }
  chunks.sort((a, b) => a[1] - b[1]);
  const heap: Stone[] = [];
  for (let q = 0; q < 22; q++) {
    const u = R(),
      v = Math.pow(R(), 0.8);
    const x = L + 4 + u * (o.w - 8),
      y = o.y + BH - 26 + v * (o.h - BH + 20);
    const fresh = R() > 0.4;
    const z = y - stH > sT + 3 ? stH : 0;
    heap.push([
      x,
      y,
      4 + R() * 8 * (1 - Math.abs(u - 0.5)),
      2 + R() * 4,
      warmT(
        fresh
          ? mixA(FRESH, TOP_B, R() * 0.55)
          : mixA(FRONT_A, TOP_A, R() * 0.5),
      ),
      s0 + 500 + q * 17,
      z,
    ]);
  }
  heap.sort((a, b) => a[1] - b[1]);
  // Settled dust: a pale fan over the floor.
  c.save();
  c.translate(o.x + o.w / 2 + 6, B + 2);
  c.scale(1, 0.36);
  let g = c.createRadialGradient(0, 0, 0, 0, 0, o.w * 0.95);
  g.addColorStop(0, "rgba(232,214,178,0.45)");
  g.addColorStop(0.6, "rgba(226,204,160,0.2)");
  g.addColorStop(1, "rgba(226,204,160,0)");
  c.fillStyle = g;
  c.fillRect(-o.w, -o.w, o.w * 2, o.w * 2);
  c.restore();
  // Shadows: the stump's and each stone's, soft, along the sun.
  const sb: Pt[] = [
    [L + 3, sT + stH],
    [Rr - 3, sT + stH],
    [Rr - 3, B],
    [L + 3, B],
  ];
  soft(c, k, 5, "rgba(26,16,6,0.34)", (s) =>
    poly(
      s,
      hull([
        ...sb,
        ...sb.map(
          ([x, y]) => [x + SUN.x * stH * 1.4, y + SUN.y * stH * 1.4] as Pt,
        ),
      ]),
    ),
  );
  const stoneShadows = (
    list: Stone[],
    onStump: boolean,
    blur: number,
    a: number,
  ) =>
    soft(c, k, blur, `rgba(26,16,6,${a})`, (s) => {
      for (const [x, y, sz, h, , , z] of list) {
        if (!!z !== onStump) continue;
        const cx = x + SUN.x * h * 1.3,
          cy = y - z + SUN.y * h + 1;
        s.moveTo(cx + sz * 1.05, cy);
        s.ellipse(cx, cy, sz * 1.05, sz * 0.6, 0, 0, Math.PI * 2);
      }
    });
  stoneShadows(chunks, false, 3, 0.32);
  stoneShadows(heap, false, 3, 0.3);
  for (const [x, y, sz, h, tone, s, z] of heap)
    if (!z) rock(c, x, y, sz, h, tone, s);
  // Stump front: the foot course and plinth that survived.
  c.save();
  srand(s0 + 5);
  const lip: Pt[] = [
    [L + 2, B],
    [L + 2, sF + 2],
  ];
  for (let q = 0; q <= 10; q++)
    lip.push([L + 2 + (W2 * q) / 10, sF - R() * 5 + (q % 3 === 0 ? 2 : 0)]);
  lip.push([Rr - 2, B]);
  poly(c, lip);
  c.clip();
  const fg = c.createLinearGradient(0, sF - 5, 0, B);
  fg.addColorStop(0, rgb(FRONT_A));
  fg.addColorStop(1, rgb(mixA(FRONT_B, [200, 150, 80], 0.2)));
  c.fillStyle = fg;
  c.fillRect(L, sF - 6, o.w, stH + 6);
  c.fillStyle = "rgba(28,18,10,0.3)";
  c.fillRect(L, B - 10, o.w, 0.9);
  srand(s0 + 7);
  for (let x = L + 14 + R() * 18; x < Rr - 6; x += 26 + R() * 24)
    c.fillRect(x, sF - 6, 0.8, stH + 6);
  texture(c, k, L, sF - 6, o.w, stH + 6, 0.45, s0 + 9, [
    [7, 1],
    [2, 0.6],
  ]);
  c.fillStyle = "rgba(24,16,8,0.45)";
  c.fillRect(L, B - 1.5, o.w, 1.5);
  c.restore();
  // Stump top: fresh, paler fractured stone in facets, lit from the upper left.
  srand(s0 + 11);
  const cols = 5,
    rows = 3;
  const grid: Pt[][] = [];
  for (let r = 0; r <= rows; r++) {
    const row: Pt[] = [];
    for (let q = 0; q <= cols; q++) {
      const x =
        L + 2 + (W2 * q) / cols + (q > 0 && q < cols ? (R() - 0.5) * 8 : 0);
      const y =
        sT +
        ((sF - sT) * r) / rows +
        (r > 0 && r < rows ? (R() - 0.5) * 3 : 0) +
        (r === 0 ? (R() - 0.5) * 9 : 0);
      row.push([x, y]);
    }
    grid.push(row);
  }
  for (let r = 0; r < rows; r++)
    for (let q = 0; q < cols; q++) {
      const a = grid[r][q],
        b = grid[r][q + 1],
        cc = grid[r + 1][q + 1],
        d = grid[r + 1][q];
      const tilt = (R() - 0.5) * 2;
      const col = mixA(FRESH, [176, 160, 136], 0.25 + R() * 0.35);
      c.fillStyle = rgb(shade(col, 0.82 + 0.18 * tilt));
      poly(c, [a, b, cc, d]);
      c.fill();
      c.strokeStyle =
        tilt > 0 ? "rgba(255,250,236,0.35)" : "rgba(60,44,28,0.3)";
      c.lineWidth = 0.6;
      c.beginPath();
      c.moveTo(a[0], a[1]);
      c.lineTo(b[0], b[1]);
      c.stroke();
    }
  c.save();
  poly(c, [...grid[0], ...[...grid[rows]].reverse()]);
  c.clip();
  texture(c, k, L, sT - 6, o.w, sF - sT + 8, 0.35, s0 + 13, [
    [6, 1],
    [2, 0.6],
    [1, 0.4],
  ]);
  crack(c, walk(L + o.w * 0.4, sT + 3, 3, (sF - sT) / 6, 6, 4), 1, 0.6);
  c.restore();
  c.strokeStyle = "rgba(255,250,234,0.55)";
  c.lineWidth = 1;
  c.beginPath();
  grid[0].forEach(([x, y], q) =>
    q ? c.lineTo(x, y + 0.5) : c.moveTo(x, y + 0.5),
  );
  c.stroke();
  c.strokeStyle = "rgba(40,28,16,0.45)";
  c.beginPath();
  grid[rows].forEach(([x, y], q) => (q ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.stroke();
  stoneShadows(heap, true, 2.5, 0.4);
  for (const [x, y, sz, h, tone, s, z] of heap)
    if (z) rock(c, x, y - z, sz, h, tone, s);
  moss(c, L + 10 + ((i * 17) % (o.w - 20)), B - 2, 4.5, s0 + 19);
  for (const [x, y, sz, h, tone, s] of chunks) rock(c, x, y, sz, h, tone, s);
  // Grain over every stone: weathered rock, not flat paint.
  speckle(c, fr.x, fr.y, fr.w, fr.h, 2200, s0 + 27);
  const sh = rubbleShard(o, i);
  if (i === 4) {
    c.save();
    c.translate(sh.x, sh.y - 4);
    c.scale(1, 0.75);
    gem(c, 0, 0, 0.8);
    c.restore();
  } else {
    c.save();
    c.translate(sh.x, sh.y);
    c.rotate(i % 2 ? 1.25 : -1.2);
    crystals(c, 0, 0, 8, s0 + 23);
    c.restore();
  }
  // Gravel and dust specks.
  srand(s0 + 29);
  for (let q = 0; q < 70; q++) {
    const a = R() * Math.PI * 2,
      d = Math.sqrt(R());
    const x = o.x + o.w / 2 + Math.cos(a) * d * o.w * 0.85,
      y = q < 30 ? o.y + BH - 30 + R() * 40 : B + 2 + Math.sin(a) * d * 30;
    const r = 0.6 + R() * 1.6;
    c.fillStyle = "rgba(30,20,10,0.3)";
    ell(c, x + r * 0.5, y + r * 0.4, r, r * 0.6);
    c.fill();
    c.fillStyle = rgb(mixA(FRESH, FRONT_B, R() * 0.6));
    ell(c, x, y, r, r * 0.68);
    c.fill();
    c.fillStyle = "rgba(255,250,236,0.45)";
    ell(c, x - r * 0.3, y - r * 0.3, r * 0.35, r * 0.25);
    c.fill();
  }
  c.restore();
}

// ───────────────────────── shared FX pieces ─────────────────────────
/** A billow of dust (64×64 units, centred). */
function dust(c: Ctx, k: number) {
  c.save();
  c.scale(k, k);
  srand(77);
  for (let q = 0; q < 9; q++) {
    const a = (q / 9) * Math.PI * 2,
      d = q ? 11 + R() * 6 : 0;
    const x = 32 + Math.cos(a) * d,
      y = 34 + Math.sin(a) * d * 0.7,
      r = 14 + R() * 6;
    const g = c.createRadialGradient(x - r * 0.25, y - r * 0.3, 0, x, y, r);
    g.addColorStop(0, "rgba(246,234,210,0.55)");
    g.addColorStop(0.5, "rgba(214,196,160,0.3)");
    g.addColorStop(1, "rgba(180,160,124,0)");
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  c.restore();
}
/** A thrown stone (20×20 units, centred). */
function chunk(c: Ctx, k: number, v: number) {
  c.save();
  c.scale(k, k);
  const tone = [
    FRESH,
    mixA(FRONT_A, TOP_B, 0.5),
    mixA(TOP_A, TOP_B, 0.6),
    FRONT_A,
  ][v];
  rock(c, 10, 13, 5.5 + (v % 2), 3.5, tone, 300 + v * 41);
  speckle(c, 0, 0, 20, 20, 60, 400 + v);
  c.restore();
}
/** The impact ring: same radius, colour, stroke and fill as the game's raid-impact ring. */
function ring(c: Ctx, k: number) {
  c.save();
  c.scale(k, k);
  const r = IMPACT_RADIUS,
    m = r + 12;
  c.translate(m, m);
  const g = c.createRadialGradient(0, 0, r - 6, 0, 0, r + 10);
  g.addColorStop(0, "rgba(255,214,91,0)");
  g.addColorStop(0.45, "rgba(255,224,140,0.28)");
  g.addColorStop(1, "rgba(255,214,91,0)");
  c.fillStyle = g;
  c.fillRect(-m, -m, m * 2, m * 2);
  c.fillStyle = "rgba(255,214,91,0.12)";
  ell(c, 0, 0, r, r);
  c.fill();
  c.strokeStyle = "rgba(255,214,91,0.9)";
  c.lineWidth = 4;
  ell(c, 0, 0, r, r);
  c.stroke();
  c.strokeStyle = "rgba(255,248,214,0.7)";
  c.lineWidth = 1.2;
  ell(c, 0, 0, r - 0.6, r - 0.6);
  c.stroke();
  c.restore();
}
/** A four-point glint for crystals (additive, 16×16 units). */
function glint(c: Ctx, k: number) {
  c.save();
  c.scale(k, k);
  c.translate(8, 8);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, 7);
  g.addColorStop(0, "rgba(255,246,210,0.9)");
  g.addColorStop(1, "rgba(255,200,100,0)");
  c.fillStyle = g;
  poly(c, [
    [0, -8],
    [1, -1],
    [8, 0],
    [1, 1],
    [0, 8],
    [-1, 1],
    [-8, 0],
    [-1, -1],
  ]);
  c.fill();
  c.restore();
}

// ───────────────────────── the atlas ─────────────────────────
export interface PillarPiece extends Rect {
  name: string;
  /** Stored at this share of the atlas density (soft pieces: less memory). */
  res: number;
  draw: (c: Ctx, k: number) => void;
}
/** Every piece: name, place and size in world units, drawer. */
export function pillarPieces(): PillarPiece[] {
  const list: PillarPiece[] = [];
  const add = (name: string, r: Rect, draw: PillarPiece["draw"], res = 1) =>
    list.push({ name, ...r, res, draw });
  PILLARS.forEach((o, i) => {
    add(`block${i}`, frameBlock(o), (c, k) => pillar(c, k, o, i));
    add(`cracks${i}`, frameBlock(o), (c, k) => pillarCracks(c, k, o, i), 0.75);
    add(`shadow${i}`, frameShadow(o), (c, k) => pillarShadow(c, k, o), 0.4);
    add(`light${i}`, frameLight(o), (c, k) => pillarLight(c, k, o, i), 0.4);
    add(
      `rlight${i}`,
      frameLight(o),
      (c, k) => pillarLight(c, k, o, i, true),
      0.4,
    );
    add(`rubble${i}`, frameRubble(o), (c, k) => rubble(c, k, o, i));
  });
  add("dust", { x: -32, y: -32, w: 64, h: 64 }, dust, 0.5);
  for (let v = 0; v < 4; v++)
    add(`chunk${v}`, { x: -10, y: -10, w: 20, h: 20 }, (c, k) =>
      chunk(c, k, v),
    );
  const m = IMPACT_RADIUS + 12;
  add("ring", { x: -m, y: -m, w: m * 2, h: m * 2 }, ring, 0.75);
  add("glint", { x: -8, y: -8, w: 16, h: 16 }, glint);
  return list;
}
export interface Spot {
  piece: PillarPiece;
  x: number;
  y: number;
  w: number;
  h: number;
}
/** Shelf-pack the pieces at k atlas pixels per world unit (1 px gutter each side). */
export function packPillars(k: number, width = 1024) {
  const list = pillarPieces()
    .map((p) => ({
      p,
      w: Math.ceil(p.w * k * p.res) + 2,
      h: Math.ceil(p.h * k * p.res) + 2,
    }))
    .sort((a, b) => b.h - a.h);
  let x = 0,
    y = 0,
    shelf = 0;
  const spots: Spot[] = [];
  for (const it of list) {
    if (x + it.w > width) {
      x = 0;
      y += shelf;
      shelf = 0;
    }
    spots.push({ piece: it.p, x, y, w: it.w, h: it.h });
    x += it.w;
    shelf = Math.max(shelf, it.h);
  }
  return { width, height: Math.ceil(y + shelf), spots };
}
export function paintPillars(ctx: Ctx, spots: Spot[], k: number) {
  for (const s of spots) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(s.x, s.y, s.w, s.h);
    ctx.clip();
    ctx.translate(s.x + 1, s.y + 1);
    s.piece.draw(ctx, k * s.piece.res);
    ctx.restore();
  }
}

// ───────────────────────── the look each frame (pure) ─────────────────────────
export type PillarEventKind = "crumble" | "rise";
/** How one pillar shows this frame, `e` ms into its last change. */
export interface PillarLook {
  block: boolean;
  rubble: number;
  /** Shudder and sink offsets (world px), the block's alpha, and how much of its bottom is cut away at the floor. */
  bx: number;
  by: number;
  ba: number;
  crop: number;
  cracks: number;
  shadow: number;
  light: number;
  rlight: number;
}
/** Phaser's eases, as the old crumble and rise tweens used them. */
export const quadIn = (t: number) => t * t;
export const quadOut = (t: number) => 1 - (1 - t) * (1 - t);
export const backOut = (t: number) => {
  const s = 1.70158;
  t -= 1;
  return t * t * ((s + 1) * t + s) + 1;
};
export const CRUMBLE_MS = 600;
export const RISE_MS = 460;
/**
 * The pillar's look: standing, crumbling (it shudders, cracks race over it,
 * it sinks into its heap, cut at the floor, while the rubble shows through),
 * a heap, or rising back out of the floor with a little overshoot. With
 * reduced motion a change is instant.
 */
export function pillarLook(
  broken: boolean,
  kind: PillarEventKind | undefined,
  e: number,
  reduced = false,
): PillarLook {
  const L: PillarLook = {
    block: !broken,
    rubble: broken ? 1 : 0,
    bx: 0,
    by: 0,
    ba: 1,
    crop: 0,
    cracks: 0,
    shadow: broken ? 0 : 1,
    light: broken ? 0 : 1,
    rlight: broken ? 1 : 0,
  };
  if (!kind || reduced) return L;
  if (kind === "crumble" && broken && e < CRUMBLE_MS) {
    L.block = true;
    L.cracks = clamp(e / 90);
    if (e < 240) {
      const leg = Math.floor(e / 40),
        w = (e % 40) / 40,
        amp = 3 * (1 - e / 300);
      L.bx = amp * (leg % 2 ? 1 - w : w) * (leg % 4 < 2 ? 1 : -1);
      L.by = (leg % 2) * 0.8;
    }
    if (e >= 220) {
      const q = quadIn(clamp((e - 220) / 380));
      L.by = 36 * q;
      L.crop = L.by > 0.2 ? L.by + 13 : 0;
      L.ba = 1 - clamp((q - 0.45) / 0.55);
      L.shadow = 1 - q;
      L.light = 1 - q;
    }
    L.rubble = e < 140 ? 0 : clamp((e - 140) / 300);
    L.rlight = L.rubble;
  } else if (kind === "rise" && !broken && e < RISE_MS) {
    const b = backOut(clamp(e / RISE_MS));
    L.by = 36 * (1 - b);
    L.crop = L.by > 0.2 ? L.by + 13 : 0;
    L.ba = clamp(e / 120);
    L.shadow = clamp(b);
    L.light = clamp(e / 300);
    L.rubble = 1 - clamp(e / 300);
    L.rlight = L.rubble;
  }
  return L;
}
/** Is pillar i's change still playing out (its event can be forgotten after)? */
export const eventDone = (kind: PillarEventKind, e: number) =>
  e > (kind === "crumble" ? 1800 : 1400);

export interface Puff {
  x: number;
  y: number;
  dx: number;
  dy: number;
  delay: number;
  d: number;
  s0: number;
  s1: number;
  flat: number;
}
export interface Thrown {
  v: number;
  gx: number;
  gy: number;
  lx: number;
  ly: number;
  z0: number;
  vz: number;
  s: number;
  rot: number;
  spin: number;
  fd: number;
  delay: number;
}
/**
 * The dust and stones of one change: puffs rolling out along the ground and
 * from the cracks, stones thrown off the top that land around the
 * footprint. Fewer on Low; reduced motion keeps three ground puffs and no
 * stones.
 */
export function eventBits(
  o: Rect,
  kind: PillarEventKind,
  rnd: () => number,
  opts: { low?: boolean; reduced?: boolean } = {},
) {
  const foot = o.y + o.h;
  const many = kind === "crumble" ? 8 : 6;
  const nPuffs = opts.reduced ? 3 : opts.low ? Math.ceil(many / 2) : many;
  const puffs: Puff[] = Array.from({ length: nPuffs }, (_, k) => {
    const ground =
      opts.reduced || kind === "rise" || k < Math.ceil(nPuffs * 0.62);
    const side = k % 2 ? 1 : -1;
    return ground
      ? {
          x: o.x + o.w * (0.15 + 0.7 * rnd()),
          y: foot - 2,
          dx: side * (40 + rnd() * 70),
          dy: 6 + rnd() * 14,
          delay: (kind === "crumble" ? 200 : 40) + rnd() * 160,
          d: 850 + rnd() * 350,
          s0: 0.45,
          s1: 1.9 + rnd() * 0.8,
          flat: 0.55,
        }
      : {
          x: o.x + o.w * (0.25 + 0.5 * rnd()),
          y: o.y + o.h - BH + 8 + rnd() * 30,
          dx: (rnd() - 0.5) * 40,
          dy: -18 - rnd() * 18,
          delay: 40 + rnd() * 80,
          d: 700 + rnd() * 200,
          s0: 0.3,
          s1: 1.2,
          flat: 0.85,
        };
  });
  const nStones = kind !== "crumble" || opts.reduced ? 0 : opts.low ? 6 : 12;
  const stones: Thrown[] = Array.from({ length: nStones }, (_, k) => {
    const gx = o.x + 6 + rnd() * (o.w - 12),
      gy = o.y + BH + rnd() * (o.h - BH);
    const ang = rnd() * Math.PI * 2,
      dist = 30 + rnd() * 70;
    return {
      v: k % 4,
      gx,
      gy,
      lx: gx + Math.cos(ang) * dist * 1.1,
      ly: Math.max(
        gy + 4,
        foot - 4 + Math.abs(Math.sin(ang)) * 34 * (rnd() > 0.3 ? 1 : -0.4),
      ),
      z0: BH - 2,
      vz: 140 + rnd() * 160,
      s: 0.7 + rnd() * 0.6,
      rot: rnd() * 6,
      spin: (rnd() - 0.5) * 14,
      fd: 900 + rnd() * 400,
      delay: 140 + rnd() * 120,
    };
  });
  return { puffs, stones };
}
/** Where a puff is `e` ms into its change (undefined: not showing). */
export function puffAt(f: Puff, e: number) {
  const t = e - f.delay;
  if (t < 0 || t > f.d) return undefined;
  const q = quadOut(t / f.d);
  const s = f.s0 + (f.s1 - f.s0) * q;
  return {
    x: f.x + f.dx * q,
    y: f.y + f.dy * q,
    sx: s,
    sy: s * f.flat,
    alpha: 0.95 * (1 - q) * Math.min(1, t / 80),
  };
}
/**
 * Where a thrown stone is `e` ms into the crumble: thrown up, falls under
 * gravity, one small bounce, then fades. `gy` is its ground spot (it sorts by
 * that), `y` where it is drawn (lifted by its height).
 */
export function stoneAt(s: Thrown, e: number) {
  const t = (e - s.delay) / 1000;
  if (t < 0 || e > s.fd + 400) return undefined;
  const g = 1500;
  let z = s.z0 + s.vz * t - 0.5 * g * t * t;
  const tl = (s.vz + Math.sqrt(s.vz * s.vz + 2 * g * s.z0)) / g;
  const u = Math.min(1, t / tl);
  if (t > tl) {
    const tb = t - tl,
      vb = s.vz * 0.28;
    z = Math.max(0, vb * tb - 0.5 * g * tb * tb);
  }
  const gx =
    s.gx + (s.lx - s.gx) * (t > tl ? 1 + Math.min(0.12, (t - tl) * 0.6) : u);
  const gy = s.gy + (s.ly - s.gy) * u;
  return {
    x: gx,
    y: gy - Math.max(0, z),
    gy,
    z: Math.max(0, z),
    rot: s.rot + s.spin * Math.min(t, tl + 0.15),
    alpha: e < s.fd ? 1 : 1 - (e - s.fd) / 400,
  };
}
/** The crystals' warm flicker (1 with reduced motion). */
export const flicker = (t: number, i: number, reduced: boolean) =>
  reduced
    ? 1
    : 0.86 + 0.14 * Math.sin(t * 2.3 + i * 1.7) * Math.sin(t * 3.7 + i * 0.6);
/** One glint at a time on a crystal tip: which pillar, and its strength (t in s). */
export function glintNow(t: number) {
  const gp = Math.floor(t / 1.7),
    gt = (t / 1.7) % 1;
  if (gt >= 0.35) return undefined;
  return { i: (gp * 3) % 5, k: Math.sin((gt / 0.35) * Math.PI), rot: gt * 2 };
}
