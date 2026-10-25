import { OBSTACLES, RULES } from "@arena/shared";

/**
 * The duel court inside the town's coliseum: raked sand, an arena wall along
 * the top edge, and the five stone blocks standing on their collision
 * footprints. Painted once into canvases (no per-frame cost).
 *
 * One camera and one sun for everything:
 *  - K: the camera's squash of the ground (a ground circle of radius r is
 *    drawn r wide and r·K tall), the same as the town's plaza.
 *  - A point at height z is drawn z px above its ground spot.
 *  - SUNV: a point at height z casts its shadow z·SUNV from its foot
 *    (light from the upper left, as in town).
 * The court's walkable area reaches RULES.radius from every edge, so the wall
 * stands just beyond it and nothing walkable is painted as solid.
 */
type Ctx = CanvasRenderingContext2D;
type Rect = { x: number; y: number; w: number; h: number };
const W = RULES.width,
  H = RULES.height;
/** How tall the stone blocks stand (px). */
export const BLOCK_H = 58;
const K = 0.78;
const SUNV = { x: 0.55, y: 0.12 };
const SHADOW = { alpha: 0.34, blur: 14 };
/** The arena wall's foot: just above the walkable area, so fighters stand in front of it. */
const WALL_FOOT = RULES.radius - 2;
/** Where duelists start (see the server's Arena.add), marked with plates. */
const SPAWNS: [number, string][] = [
  [260, "#e9b53a"],
  [1340, "#3f9fd9"],
];

let seed = 1;
const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const ell = (c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) => {
  c.beginPath();
  c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
};
const gEll = (c: Ctx, x: number, y: number, r: number) => ell(c, x, y, r, r * K);
const mix = (a: string, b: string, t: number) => {
  const p = (h: string) =>
    h.startsWith("rgb")
      ? h.match(/\d+/g)!.slice(0, 3).map(Number)
      : [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a),
    B = p(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`;
};
function hull(pts: [number, number][]) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: [number, number][] = [],
    up: [number, number][] = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  for (const q of [...p].reverse()) {
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}
function fillPoly(s: Ctx, pts: [number, number][]) {
  s.beginPath();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  s.fill();
}
/** Soft value noise: blotches at several scales, for natural variation. */
function noiseCanvas(w: number, h: number, scales: [number, number][], s0: number) {
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const o = out.getContext("2d")!;
  seed = s0;
  for (const [cell, alpha] of scales) {
    const gw = Math.ceil(w / cell) + 2,
      gh = Math.ceil(h / cell) + 2;
    const small = document.createElement("canvas");
    small.width = gw;
    small.height = gh;
    const sc = small.getContext("2d")!;
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
    o.drawImage(small, 0, 0, gw * cell, gh * cell);
  }
  return out;
}
function grain(c: Ctx, x: number, y: number, w: number, h: number, strength: number, s0: number, scales: [number, number][]) {
  const n = noiseCanvas(Math.ceil(w), Math.ceil(h), scales, s0);
  c.save();
  c.globalCompositeOperation = "overlay";
  c.globalAlpha = strength;
  c.drawImage(n, x, y);
  c.restore();
}
/**
 * Every shadow is drawn solid into one layer, then blurred and laid on the
 * ground once, so overlaps never stack darker (as in town). Works at any
 * bake scale: the shadow offset and blur are in device pixels.
 */
function shadows(c: Ctx, draw: (s: Ctx) => void) {
  const cw = c.canvas.width,
    ch = c.canvas.height,
    k = cw / W;
  const layer = document.createElement("canvas");
  layer.width = cw;
  layer.height = ch;
  const s = layer.getContext("2d")!;
  s.scale(k, k);
  s.fillStyle = "#000";
  draw(s);
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.shadowColor = `rgba(20,24,12,${SHADOW.alpha})`;
  c.shadowBlur = SHADOW.blur * k;
  c.shadowOffsetX = cw + 100;
  c.drawImage(layer, -(cw + 100), 0);
  c.restore();
}
/** A block's shadow: its footprint swept along the sun by its height. */
function blockShadow(s: Ctx, o: Rect) {
  const dx = SUNV.x * BLOCK_H,
    dy = SUNV.y * BLOCK_H;
  const foot: [number, number][] = [
    [o.x, o.y],
    [o.x + o.w, o.y],
    [o.x + o.w, o.y + o.h],
    [o.x, o.y + o.h],
  ];
  fillPoly(s, hull([...foot, ...foot.map(([x, y]) => [x + dx, y + dy] as [number, number])]));
}
/** The ground darkens right where something stands on it. */
function contact(c: Ctx, x: number, y: number, w: number, depth: number, a: number) {
  const g = c.createLinearGradient(0, y, 0, y + depth);
  g.addColorStop(0, `rgba(25,20,10,${a})`);
  g.addColorStop(1, "rgba(25,20,10,0)");
  c.fillStyle = g;
  c.fillRect(x - 6, y, w + 12, depth);
}
/** Warm light from a flame: brightness falls off roughly with distance squared. */
function lightPool(c: Ctx, x: number, y: number, r: number, a: number) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  for (const [t, f] of [
    [0, 1],
    [0.25, 0.42],
    [0.5, 0.16],
    [0.75, 0.05],
    [1, 0],
  ] as const)
    g.addColorStop(t, `rgba(255,190,110,${a * f})`);
  c.save();
  c.globalCompositeOperation = "screen";
  c.fillStyle = g;
  gEll(c, x, y, r);
  c.fill();
  c.restore();
}

/** The court: sand, the arena wall, spawn plates and every shadow. Blocks are separate (see paintColiseumBlock). */
export function paintColiseumFloor(c: Ctx) {
  // ── Sand: base colour, natural variation, rake lines, scuffs, footprints, pebbles.
  const sand = c.createLinearGradient(0, 0, 0, H);
  sand.addColorStop(0, "#d4bc8c");
  sand.addColorStop(1, "#cdb283");
  c.fillStyle = sand;
  c.fillRect(0, 0, W, H);
  grain(c, 0, 0, W, H, 0.55, 3, [
    [140, 1],
    [40, 0.6],
    [6, 0.35],
    [2, 0.3],
  ]);
  c.lineWidth = 1.6;
  for (let k = 1; k < 13; k++) {
    c.strokeStyle = k % 2 ? "rgba(120,92,52,0.18)" : "rgba(255,244,214,0.16)";
    c.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.02) {
      const r = k * 64 + Math.sin(a * 7 + k) * 2;
      const x = 800 + Math.cos(a) * r,
        y = 450 + Math.sin(a) * r * K;
      if (a === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  for (const [x, y] of [
    [SPAWNS[0][0], 450],
    [SPAWNS[1][0], 450],
    [800, 450],
  ] as const) {
    const g = c.createRadialGradient(x, y, 0, x, y, 170);
    g.addColorStop(0, "rgba(150,118,72,0.3)");
    g.addColorStop(1, "rgba(150,118,72,0)");
    c.fillStyle = g;
    gEll(c, x, y, 170);
    c.fill();
  }
  seed = 55;
  for (let i = 0; i < 70; i++) {
    const x = 240 + R() * 1120,
      y = 120 + R() * 660,
      a = R() * 6.28;
    c.fillStyle = "rgba(110,84,48,0.26)";
    ell(c, x, y, 5, 2.6, a);
    c.fill();
    ell(c, x + Math.cos(a + 1.57) * 7, y + Math.sin(a + 1.57) * 7, 5, 2.6, a);
    c.fill();
  }
  for (let i = 0; i < 260; i++) {
    const x = R() * W,
      y = 40 + R() * (H - 60),
      r = 1.2 + R() * 2.6;
    c.fillStyle = "rgba(60,44,24,0.35)";
    ell(c, x + SUNV.x * r * 1.6, y + SUNV.y * r * 1.6, r, r * K);
    c.fill();
    c.fillStyle = mix("#bfae8a", "#8d7d62", R());
    ell(c, x, y, r, r * 0.7);
    c.fill();
    c.fillStyle = "rgba(255,255,240,0.5)";
    ell(c, x - r * 0.3, y - r * 0.3, r * 0.35, r * 0.25);
    c.fill();
  }
  // The coliseum's crest, worn into the centre of the sand.
  c.strokeStyle = "rgba(255,246,224,0.45)";
  c.lineWidth = 5;
  gEll(c, 800, 450, 150);
  c.stroke();
  c.strokeStyle = "rgba(255,246,224,0.3)";
  c.lineWidth = 2;
  gEll(c, 800, 450, 200);
  c.stroke();
  // Spawn plates: inset stone discs with an inlay in each side's colour.
  for (const [x, col] of SPAWNS) {
    c.fillStyle = "#8a7c60";
    gEll(c, x, 456, 74);
    c.fill();
    c.fillStyle = "#cbbd9e";
    gEll(c, x, 453, 70);
    c.fill();
    grain(c, x - 70, 453 - 70 * K, 140, 140 * K, 0.35, x, [
      [12, 1],
      [3, 0.5],
    ]);
    c.strokeStyle = col;
    c.globalAlpha = 0.7;
    c.lineWidth = 3;
    gEll(c, x, 453, 58);
    c.stroke();
    c.globalAlpha = 1;
  }
  // Low kerbs down the sides and along the front (ground level, so they never hide anyone).
  for (const [x, y, w, h] of [
    [0, 0, 16, H],
    [W - 16, 0, 16, H],
    [0, H - 16, W, 16],
  ] as const) {
    c.fillStyle = "#a89a7c";
    c.fillRect(x, y, w, h);
    c.fillStyle = "#ddd2bb";
    c.fillRect(x, y, w, 4);
    grain(c, x, y, w, h, 0.4, x + y + 5, [
      [10, 1],
      [3, 0.5],
    ]);
  }
  // ── Shadows: the blocks and the arena wall, from one sun.
  const wallHeight = 48;
  shadows(c, (s) => {
    for (const o of OBSTACLES) blockShadow(s, o);
    s.fillRect(0, 0, W, WALL_FOOT + SUNV.y * wallHeight + 2);
  });
  // Contact shade: soft and darkest right at the block's front edge.
  for (const o of OBSTACLES) {
    const cx = o.x + o.w / 2,
      cy = o.y + o.h + 1;
    c.save();
    c.translate(cx, cy);
    c.scale(1, 0.18);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, o.w * 0.62);
    g.addColorStop(0, "rgba(25,20,10,0.42)");
    g.addColorStop(0.7, "rgba(25,20,10,0.18)");
    g.addColorStop(1, "rgba(25,20,10,0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, o.w * 0.62, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  // ── The arena wall along the back: only its lower face is in view (it
  // rises out of frame toward the stands), with torches in sconces.
  const face = c.createLinearGradient(0, 0, 0, WALL_FOOT);
  face.addColorStop(0, "#9d8d6e");
  face.addColorStop(1, "#7f705a");
  c.fillStyle = face;
  c.fillRect(0, 0, W, WALL_FOOT);
  seed = 9;
  for (let row = 0; row < 2; row++)
    for (let x = row * -20; x < W; ) {
      const w = 40 + R() * 30;
      c.fillStyle = mix("#b6a585", "#8f7f62", R());
      c.fillRect(x + 1, row * 11 + 1, w - 2, 10);
      c.fillStyle = "rgba(255,248,230,0.25)";
      c.fillRect(x + 1, row * 11 + 1, w - 2, 2);
      x += w;
    }
  c.fillStyle = "rgba(30,22,12,0.45)";
  c.fillRect(0, WALL_FOOT - 3, W, 3);
  contact(c, 0, WALL_FOOT, W, 30, 0.35);
  // Banner tails and torches on the wall face, and the light they throw.
  for (const [x, col] of [
    [150, "#d9a52a"],
    [560, "#c9482e"],
    [1040, "#2f8fc9"],
    [1450, "#4f9a3e"],
  ] as const) {
    const g = c.createLinearGradient(x - 20, 0, x + 20, 0);
    g.addColorStop(0, mix(col, "#000000", 0.25));
    g.addColorStop(0.45, mix(col, "#ffffff", 0.15));
    g.addColorStop(1, mix(col, "#000000", 0.3));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x - 20, 0);
    c.lineTo(x + 20, 0);
    c.lineTo(x + 20, WALL_FOOT - 4);
    c.lineTo(x, WALL_FOOT - 10);
    c.lineTo(x - 20, WALL_FOOT - 4);
    c.closePath();
    c.fill();
  }
  for (const x of [355, 800, 1245]) {
    c.fillStyle = "#2a2e36";
    c.fillRect(x - 6, 8, 12, 5);
    const f = c.createRadialGradient(x, 6, 0, x, 6, 10);
    f.addColorStop(0, "#fff2a8");
    f.addColorStop(0.5, "#ffa02a");
    f.addColorStop(1, "rgba(255,90,30,0)");
    c.fillStyle = f;
    ell(c, x, 5, 8, 9);
    c.fill();
    lightPool(c, x, WALL_FOOT + 18, 170, 0.32);
  }
  // Warm light from the upper left and a soft vignette.
  const l = c.createLinearGradient(0, 0, W, H);
  l.addColorStop(0, "rgba(255,230,180,0.16)");
  l.addColorStop(0.6, "rgba(255,230,180,0)");
  l.addColorStop(1, "rgba(30,40,70,0.12)");
  c.save();
  c.globalCompositeOperation = "soft-light";
  c.fillStyle = l;
  c.fillRect(0, 0, W, H);
  c.restore();
  const v = c.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(10,8,4,0.3)");
  c.fillStyle = v;
  c.fillRect(0, 0, W, H);
}

/** How much room a block's picture has around its footprint (for chips and the gem's glow). */
export const BLOCK_PAD = 14;
/**
 * One stone block, drawn in world coordinates translated so that the
 * picture's top-left is (o.x − BLOCK_PAD, o.y − BLOCK_H − BLOCK_PAD).
 * Its top face is the footprint raised by BLOCK_H; its front face stands on
 * the footprint's front edge, which is what it sorts by.
 */
export function paintColiseumBlock(c: Ctx, o: Rect, index: number) {
  c.save();
  c.translate(-(o.x - BLOCK_PAD), -(o.y - BLOCK_H - BLOCK_PAD));
  seed = (index + 1) * 97 + 13;
  const top = o.y - BLOCK_H,
    front = o.y + o.h - BLOCK_H;
  // Front: courses of ashlar, each stone its own tone. The face is side-on
  // to the sun, so it's evenly lit, darkening toward the ground.
  const courses = 3,
    ch = BLOCK_H / courses;
  for (let r = 0; r < courses; r++) {
    let x = o.x;
    const y = front + r * ch;
    while (x < o.x + o.w - 1) {
      const sw = Math.min(o.x + o.w - x, 26 + R() * 30);
      c.fillStyle = mix(mix("#b9ab8f", "#8b7e64", 0.25), R() > 0.5 ? "#c9bd9f" : "#a5977b", 0.25);
      c.fillRect(x, y, sw, ch);
      c.fillStyle = "rgba(255,248,230,0.32)";
      c.fillRect(x + 1, y + 1, sw - 2, 2);
      c.fillStyle = "rgba(40,30,18,0.35)";
      c.fillRect(x, y + ch - 2, sw, 2);
      c.fillStyle = "rgba(40,30,18,0.28)";
      c.fillRect(x + sw - 1.5, y, 1.5, ch);
      x += sw;
    }
  }
  const ao = c.createLinearGradient(0, front, 0, front + BLOCK_H);
  ao.addColorStop(0, "rgba(0,0,0,0)");
  ao.addColorStop(1, "rgba(30,20,10,0.32)");
  c.fillStyle = ao;
  c.fillRect(o.x, front, o.w, BLOCK_H);
  // Top slab: faces the sky, so it's the brightest surface.
  const tg = c.createLinearGradient(o.x, top, o.x + o.w, top + o.h);
  tg.addColorStop(0, "#f2eada");
  tg.addColorStop(1, "#ddd2bb");
  c.fillStyle = tg;
  c.fillRect(o.x, top, o.w, o.h);
  grain(c, o.x, top, o.w, o.h, 0.35, index * 7 + 1, [
    [24, 1],
    [6, 0.6],
    [2, 0.4],
  ]);
  c.strokeStyle = "rgba(80,64,40,0.35)";
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(o.x, top + o.h * 0.48);
  c.lineTo(o.x + o.w, top + o.h * 0.5);
  c.stroke();
  c.fillStyle = "rgba(255,250,236,0.6)";
  c.fillRect(o.x, top, o.w, 3);
  c.fillRect(o.x, top, 3, o.h);
  c.fillStyle = "rgba(70,56,36,0.35)";
  c.fillRect(o.x + o.w - 3, top, 3, o.h);
  c.fillStyle = "#f4ecda";
  c.fillRect(o.x, front - 2, o.w, 3);
  c.fillStyle = "rgba(40,30,18,0.35)";
  c.fillRect(o.x, front + 1, o.w, 2);
  // Chips, a crack, moss and a vine.
  c.fillStyle = "#b0a283";
  c.beginPath();
  c.moveTo(o.x + o.w, front - 1);
  c.lineTo(o.x + o.w - 9, front - 1);
  c.lineTo(o.x + o.w, front + 8);
  c.closePath();
  c.fill();
  c.strokeStyle = "rgba(70,54,32,0.55)";
  c.lineWidth = 1.3;
  c.beginPath();
  const cx = o.x + o.w * (0.3 + R() * 0.3);
  c.moveTo(cx, top + 4);
  c.lineTo(cx + 6, top + o.h * 0.25);
  c.lineTo(cx + 1, top + o.h * 0.42);
  c.lineTo(cx + 9, top + o.h * 0.6);
  c.stroke();
  const moss = (x: number, y: number, r: number) => {
    for (let k = 0; k < 6; k++) {
      c.fillStyle = ["#4f7a34", "#638f3f", "#7aa64c", "#3f6a2c"][k % 4];
      ell(c, x + (R() - 0.5) * r * 1.6, y + (R() - 0.5) * r * 0.6, r * (0.35 + R() * 0.4), r * (0.25 + R() * 0.25));
      c.fill();
    }
  };
  moss(o.x + 8 + R() * 14, top + 6 + R() * 10, 12);
  moss(o.x + o.w * 0.6, top + o.h - 6, 8);
  for (let k = 0; k < 4; k++) moss(o.x + R() * o.w, o.y + o.h - 4, 6 + R() * 4);
  c.strokeStyle = "#4f7a34";
  c.lineWidth = 2;
  const vx = o.x + 10 + R() * 18;
  c.beginPath();
  c.moveTo(vx, front);
  c.bezierCurveTo(vx + 6, front + 14, vx - 4, front + 28, vx + 3, front + 40);
  c.stroke();
  for (let k = 0; k < 5; k++) {
    c.fillStyle = "#6f9a48";
    ell(c, vx + (k % 2 ? 5 : -3), front + 6 + k * 8, 3.4, 2, k % 2 ? 0.6 : -0.6);
    c.fill();
  }
  // The centre block carries the coliseum's gold gem.
  if (index === 4) {
    const gx = o.x + o.w / 2,
      gy = front + BLOCK_H / 2;
    c.fillStyle = "#2c2638";
    ell(c, gx, gy, 10, 10);
    c.fill();
    const g = c.createRadialGradient(gx - 3, gy - 3, 1, gx, gy, 8);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.35, "#ffcf4a");
    g.addColorStop(1, "#99781e");
    c.fillStyle = g;
    ell(c, gx, gy, 7.5, 7.5);
    c.fill();
  }
  c.restore();
}
/** A block's picture size (world px) and where its top-left sits. */
export function coliseumBlockFrame(o: Rect) {
  return {
    x: o.x - BLOCK_PAD,
    y: o.y - BLOCK_H - BLOCK_PAD,
    w: o.w + BLOCK_PAD * 2,
    h: o.h + BLOCK_H + BLOCK_PAD * 2,
  };
}
