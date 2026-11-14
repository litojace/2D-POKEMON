// @ts-nocheck -- ported art code: canvas painters, checked by eye and by tests/unit/boss-cragmuff.test.ts
/**
 * Cragmuff, the crystal-horned mountain ram (Grumblecrag's raid), drawn in
 * code: the part painters `(ctx, k)` for its five drawn views, and the atlas
 * they are painted into once, when the raid's scene starts. Nothing here
 * runs per frame: boss-cragmuff.ts poses the pieces, boss-cragmuff-rig.ts
 * places them as images.
 *
 * Units are rig px. Body-local axes: x = the ram's left, y = up, z = forward;
 * origin = the floor under the middle of its body. The three other facings
 * are mirrors of the five drawn views.
 */
const TAU = Math.PI * 2,
  DEG = Math.PI / 180;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const ease = (t) => t * t * (3 - 2 * t);
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const norm3 = (x, y, z) => {
  const l = Math.hypot(x, y, z) || 1;
  return { x: x / l, y: y / l, z: z / l };
};
const dot3 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const PITCH = 14 * DEG,
  CP = Math.cos(PITCH),
  SP = Math.sin(PITCH);
/** Key light in camera space (x right, y up, z to camera): warm, top-left, front. */
const LIGHT = norm3(-0.58, 0.62, 0.52);
/** The five drawn views. The other three facings are mirrors. */
const VIEWS = [
  { id: "F", yaw: 0 },
  { id: "FQ", yaw: 45 * DEG },
  { id: "S", yaw: 90 * DEG },
  { id: "BQ", yaw: 135 * DEG },
  { id: "B", yaw: 180 * DEG },
];
/** A view for painting: local point → camera space and screen. */
function makeView(yaw) {
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  const cam = (x, y, z) => {
    const X = x * c + z * s,
      Z = -x * s + z * c;
    return { x: X, y: y * CP - Z * SP, z: Z * CP + y * SP };
  };
  return {
    yaw,
    cam,
    /** Screen point (y down) with depth z (bigger = nearer). */
    P: (p) => {
      const r = cam(p.x, p.y, p.z);
      return { x: r.x, y: -r.y, z: r.z };
    },
    /** A local direction in camera space. */
    N: (d) => cam(d.x, d.y, d.z),
  };
}

// ── colour ──
const HEX = {};
const hex = (h) =>
  HEX[h] ||
  (HEX[h] = [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ]);
const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
function ramp(R, t) {
  t = clamp(t);
  for (let i = 1; i < R.length; i++)
    if (t <= R[i][0]) {
      const a = R[i - 1],
        b = R[i];
      return mix(hex(a[1]), hex(b[1]), (t - a[0]) / (b[0] - a[0] || 1));
    }
  return hex(R[R.length - 1][1]);
}
// Ramps sampled from the painted parts (raid-painted-emberwing.webp).
/** Lighting for a camera-space normal: 0 shadow … 1 lit, with a warm under-glow. */
function lit(n, amb = 0.26) {
  const d = n.x * LIGHT.x + n.y * LIGHT.y + n.z * LIGHT.z;
  return clamp(amb + (1 - amb) * Math.max(0, d) + 0.08 * Math.max(0, -n.y));
}

// ── painted marks ──
/** A leaf-like mark from root (x,y) to tip (tx,ty), half-width w. */
function leafPath(x, y, tx, ty, w, shape = "leaf", bend = 0) {
  const dx = tx - x,
    dy = ty - y,
    L = Math.hypot(dx, dy) || 1e-3;
  const ux = dx / L,
    uy = dy / L,
    nx = -uy,
    ny = ux;
  const pt = (a, b) => [
    x + ux * a * L + nx * (b + bend * Math.sin(a * Math.PI) * L),
    y + uy * a * L + ny * (b + bend * Math.sin(a * Math.PI) * L),
  ];
  const p = new Path2D();
  const M = (q) => p.moveTo(q[0], q[1]);
  const B = (a, b, c) => p.bezierCurveTo(a[0], a[1], b[0], b[1], c[0], c[1]);
  if (shape === "flight") {
    // a flight feather: long, slightly asymmetric, with a soft rounded point
    M(pt(0, -w * 0.4));
    B(pt(0.3, -w * 0.95), pt(0.82, -w * 1.0), pt(0.96, -w * 0.35));
    B(pt(1.02, -w * 0.05), pt(1.0, w * 0.2), pt(0.95, w * 0.45));
    B(pt(0.8, w * 1.05), pt(0.3, w * 1.0), pt(0, w * 0.4));
    p.closePath();
  } else if (shape === "quill") {
    // a long primary: tapering to a fine, slightly curved point
    M(pt(0, -w * 0.4));
    B(pt(0.25, -w * 0.95), pt(0.7, -w * 0.85), pt(1, -w * 0.05));
    B(pt(0.72, w * 0.9), pt(0.3, w * 1.05), pt(0, w * 0.4));
    p.closePath();
  } else if (shape === "round") {
    M(pt(0, -w * 0.55));
    B(pt(0.35, -w * 1.05), pt(0.92, -w * 1.0), pt(1, 0));
    B(pt(0.92, w * 1.0), pt(0.35, w * 1.05), pt(0, w * 0.55));
    p.closePath();
  } else if (shape === "blade") {
    M(pt(0, -w * 0.35));
    B(pt(0.3, -w * 0.75), pt(0.85, -w * 0.55), pt(1, w * 0.1));
    B(pt(0.85, w * 1.0), pt(0.3, w * 1.15), pt(0, w * 0.45));
    p.closePath();
  } else if (shape === "plume") {
    M(pt(0, -w * 0.3));
    B(pt(0.25, -w * 1.1), pt(0.7, -w * 1.15), pt(1, 0));
    B(pt(0.7, w * 1.15), pt(0.25, w * 1.1), pt(0, w * 0.3));
    p.closePath();
  } else {
    M(pt(0, 0));
    B(pt(0.18, -w * 1.05), pt(0.62, -w * 1.0), pt(1, 0));
    B(pt(0.62, w * 1.0), pt(0.18, w * 1.05), pt(0, 0));
    p.closePath();
  }
  return p;
}
/** Atlas px per rig px of the piece being painted (blur radii and shadows are in canvas px). */
let PQ = 1;
/**
 * Paint helper canvases the CPU rasterises: set while painting the briefing's
 * picture (read back into a PNG) and each atlas piece (read back to trim it):
 * their blurs cost a fraction of the GPU path where the GPU is emulated.
 */
let SOFT = false;
function norm2(x, y) {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
}
const qbez = (a, b, c, t) => ({
  x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * b.x + t * t * c.x,
  y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * b.y + t * t * c.y,
});
// ── paper grain (one small pattern, laid over every painted piece) ──
let GRAIN = null;
function grainCanvas() {
  if (GRAIN) return GRAIN;
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const g = c.getContext("2d", { willReadFrequently: true }),
    r = rng(77);
  for (let i = 0; i < 520; i++) {
    const v = r();
    g.fillStyle =
      v < 0.5
        ? `rgba(70,20,6,${0.03 + r() * 0.05})`
        : `rgba(255,236,196,${0.03 + r() * 0.04})`;
    g.fillRect(r() * 96, r() * 96, 1 + r() * 1.6, 1 + r() * 1.2);
  }
  g.lineCap = "round";
  for (let i = 0; i < 26; i++) {
    const x = r() * 96,
      y = r() * 96,
      a = -0.7 + r() * 0.3,
      l = 5 + r() * 12;
    g.strokeStyle = r() < 0.5 ? "rgba(255,235,190,0.06)" : "rgba(70,18,6,0.06)";
    g.lineWidth = 0.8 + r();
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  return (GRAIN = c);
}

// ── the atlas ──
// Every piece is painted once, at load, by a pure function (ctx, k) in its
// own local frame (origin = the part's pivot, units = rig px). It is given a
// soft darker outline and paper grain, trimmed to its pixels and shelf-packed
// into atlas pages. At runtime a piece is one drawImage.
let ATLAS: any = { pages: [], pieces: {}, stats: { pieces: 0, px: 0 } };
const PAGE_W = 2048;
let packX = 0,
  packY = 0,
  shelfH = 0,
  curPage = null,
  curCtx = null;
let pageBuf: any[] = [];
const PENDING: any[] = [];
function newPage() {
  curPage = document.createElement("canvas");
  curPage.width = PAGE_W;
  curPage.height = 2048;
  curCtx = curPage.getContext("2d", { willReadFrequently: true });
  pageBuf.push({ c: curPage, used: 0 });
  packX = packY = shelfH = 0;
}
/** Paint one piece. box = [x0, y0, x1, y1] in rig px (generous); q = atlas px per rig px. */
function piece(name, box, q, draw, opt = {}) {
  const pad = 6;
  const w = Math.ceil((box[2] - box[0]) * q) + pad * 2,
    h = Math.ceil((box[3] - box[1]) * q) + pad * 2;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  // CPU canvases: every piece is read back below to trim it, and their blurs
  // cost a fraction of the GPU path where the GPU is emulated
  const g = c.getContext("2d", { willReadFrequently: true });
  PQ = q;
  g.translate(pad - box[0] * q, pad - box[1] * q);
  g.scale(q, q);
  g.lineJoin = "round";
  SOFT = true;
  draw(g, opt.k || {});
  SOFT = false;
  let src = c;
  if (opt.outline !== false) {
    // soft outline: the piece's own silhouette, dark and blurred, behind it
    const d = document.createElement("canvas");
    d.width = w;
    d.height = h;
    const dg = d.getContext("2d", { willReadFrequently: true });
    dg.shadowColor = opt.lineColor || "rgba(74,18,6,0.95)";
    dg.shadowBlur = (opt.line || 1.6) * q;
    dg.drawImage(c, 0, 0);
    dg.shadowBlur = (opt.line || 1.6) * q * 0.45;
    dg.drawImage(c, 0, 0);
    dg.shadowColor = "transparent";
    dg.drawImage(c, 0, 0);
    if (opt.grain !== false) {
      dg.globalCompositeOperation = "source-atop";
      dg.fillStyle = dg.createPattern(grainCanvas(), "repeat");
      dg.fillRect(0, 0, w, h);
    }
    src = d;
  }
  // trim
  const data = src
    .getContext("2d", { willReadFrequently: true })
    .getImageData(0, 0, w, h).data;
  let x0 = w,
    y0 = h,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++)
      if (data[row + x * 4 + 3] > 3) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  }
  if (x1 < 0) {
    ATLAS.pieces[name] = null;
    return;
  }
  x0 = Math.max(0, x0 - 1);
  y0 = Math.max(0, y0 - 1);
  x1 = Math.min(w - 1, x1 + 1);
  y1 = Math.min(h - 1, y1 + 1);
  const tw = x1 - x0 + 1,
    th = y1 - y0 + 1;
  const img = document.createElement("canvas");
  img.width = tw;
  img.height = th;
  img
    .getContext("2d", { willReadFrequently: true })
    .drawImage(src, x0, y0, tw, th, 0, 0, tw, th);
  PENDING.push({
    name,
    img,
    q,
    ox: (pad - box[0] * q - x0) / q,
    oy: (pad - box[1] * q - y0) / q,
  });
  ATLAS.stats.pieces++;
  ATLAS.stats.px += tw * th;
}
/** Skyline-pack every piece (tallest first) into one page: each goes where it sits lowest (4 px columns). */
function finishAtlas() {
  PENDING.sort(
    (a, b) =>
      b.img.height * 4096 + b.img.width - (a.img.height * 4096 + a.img.width),
  );
  const CW = 4,
    NC = PAGE_W / CW,
    sky = new Int32Array(NC);
  newPage();
  for (const p of PENDING) {
    const tw = p.img.width,
      th = p.img.height,
      nc = Math.ceil((tw + 1) / CW);
    let bestX = 0,
      bestY = 1e9;
    for (let c = 0; c + nc <= NC; c++) {
      let y = 0;
      for (let k = c; k < c + nc; k++)
        if (sky[k] > y) {
          y = sky[k];
          if (y >= bestY) break;
        }
      if (y < bestY) {
        bestY = y;
        bestX = c;
      }
    }
    if (bestY + th > curPage.height) {
      const big = document.createElement("canvas");
      big.width = PAGE_W;
      big.height = Math.max(curPage.height * 2, bestY + th + 1);
      big
        .getContext("2d", { willReadFrequently: true })
        .drawImage(curPage, 0, 0);
      curPage.width = curPage.height = 1;
      curPage = big;
      curCtx = big.getContext("2d", { willReadFrequently: true });
      pageBuf[0].c = big;
    }
    const px = bestX * CW,
      py = bestY;
    curCtx.drawImage(p.img, px, py);
    for (let k = bestX; k < bestX + nc; k++) sky[k] = py + th + 1;
    ATLAS.pieces[p.name] = {
      page: 0,
      sx: px,
      sy: py,
      w: tw,
      h: th,
      q: p.q,
      ox: p.ox,
      oy: p.oy,
    };
    pageBuf[0].used = Math.max(pageBuf[0].used, py + th);
  }
  PENDING.length = 0;
  ATLAS.pages = pageBuf.map((p) => {
    const c = document.createElement("canvas");
    c.width = PAGE_W;
    c.height = Math.max(1, p.used + 1);
    c.getContext("2d", { willReadFrequently: true }).drawImage(p.c, 0, 0);
    p.c.width = p.c.height = 1;
    return c;
  });
  ATLAS.stats.bytes = ATLAS.pages.reduce(
    (s, c) => s + c.width * c.height * 4,
    0,
  );
  ATLAS.stats.pageSizes = ATLAS.pages.map((c) => c.width + "x" + c.height);
}

// p2 · the crystal-horned mountain ram: its 3D build (used only while
// painting), the part painters (ctx, k) drawn once per view into the atlas,
// and the list of pieces. Units = rig px. Body-local axes: x = the ram's
// left, y = up, z = forward; origin = the floor under the middle of its body.
//
// Everything is round: the fleece is a cloud of spheres (each projects to a
// circle in any view), the head is a sphere with a sphere muzzle, the legs
// are capsules and the horns are a tapering tube along a spiral. Five views
// are painted; the other three facings are mirrors.

// ── the build ──
const BODY_C = { x: 0, y: 98, z: -8 },
  BRX = 78,
  BRY = 60,
  BRZ = 90;
/** Head centre (body-local), its radius, and the muzzle sphere (head-local). */
const HEAD_C = { x: 0, y: 132, z: 92 },
  HR = 43;
const MUZ = { x: 0, y: -17, z: 25, r: 23 };
/**
 * The head's own view. In the face views (front, ¾, side) a feature's height
 * on screen comes from the head's own forward depth, not the camera's, so
 * brow, eyes, nose and mouth keep the same vertical spacing in every view
 * (the eye-line rule, carried to the whole face). The back views are plain.
 */
function headView(fy) {
  const V = makeView(fy);
  if (Math.cos(fy) < -0.05) return V;
  return {
    ...V,
    P: (p) => {
      const r = V.P(p);
      return { x: r.x, y: -p.y * CP + p.z * SP, z: r.z };
    },
  };
}
/** Hips (body-local): front and back, left (+x) and right. Legs reach the floor. */
const HIPS = {
  FL: { x: 31, y: 46, z: 42 },
  FR: { x: -31, y: 46, z: 42 },
  BL: { x: 31, y: 46, z: -56 },
  BR: { x: -31, y: 46, z: -56 },
};
const LEG_L = 46;
/** The weak point: a crystal core on the chest, under the head. */
const GEM = { x: 0, y: 66, z: 80 };
const yS = (y) => -y * CP; // screen y of a point on the axis at height y

const HAS_FILTER = (() => {
  try {
    const c = document.createElement("canvas").getContext("2d");
    c.filter = "blur(2px)";
    return c.filter === "blur(2px)";
  } catch (e) {
    return false;
  }
})();
/** Blur a few strokes while painting (radius in rig px); a no-op where canvas filters are missing. */
function soft(ctx, px, fn) {
  ctx.save();
  if (HAS_FILTER) ctx.filter = `blur(${(px * PQ).toFixed(2)}px)`;
  fn();
  ctx.restore();
}
/** A light or shade cast inward from the outline (an inner shadow), optionally shifted to one side. */
function innerGlow(ctx, path, color, blur, dx = 0, dy = 0) {
  const c = document.createElement("canvas");
  c.width = ctx.canvas.width;
  c.height = ctx.canvas.height;
  const g = c.getContext("2d", SOFT ? { willReadFrequently: true } : undefined);
  g.fillStyle = "#000";
  g.fillRect(0, 0, c.width, c.height);
  g.setTransform(ctx.getTransform());
  g.globalCompositeOperation = "destination-out";
  g.fill(path);
  ctx.save();
  ctx.clip(path);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.shadowColor = color;
  ctx.shadowBlur = blur * PQ;
  ctx.shadowOffsetX = dx * PQ;
  ctx.shadowOffsetY = dy * PQ;
  ctx.drawImage(c, 0, 0);
  ctx.restore();
}

// ── palette: mossy grey-beige stone wool, cocoa face, amber crystal ──
const R_WOOL = [
  [0, "#47412f"],
  [0.22, "#646048"],
  [0.45, "#878066"],
  [0.66, "#a99f84"],
  [0.84, "#c8bea2"],
  [1, "#e8e0c8"],
];
const R_SKIN = [
  [0, "#46342a"],
  [0.35, "#6a5244"],
  [0.65, "#8d725f"],
  [0.88, "#b0947c"],
  [1, "#d0b49a"],
];
const R_MUZ = [
  [0, "#8c745e"],
  [0.45, "#bba183"],
  [0.8, "#dcc6a8"],
  [1, "#f2e4cc"],
];
const R_AMBER = [
  [0, "#6a2a05"],
  [0.25, "#a9500b"],
  [0.5, "#e2861a"],
  [0.72, "#ffb93c"],
  [0.88, "#ffe07e"],
  [1, "#fff8d6"],
];
const R_DIMAMB = [
  [0, "#3a2c22"],
  [0.35, "#5e4a3a"],
  [0.65, "#87725c"],
  [1, "#b8a68c"],
];
const C_INK = "#24160f";
const MOSS = "rgba(104,136,62,";

// ── fleece: a cloud of spheres on an ellipsoid ──
/** Body lobes (body-local centre, radius, normal), from a fixed Fibonacci spread. */
const LOBES = (() => {
  // eleven big soft lobes round the outline: a ring of eight just above the middle, three over the top
  const out = [],
    r = rng(9);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2,
      d = norm3(Math.sin(a), 0.12 + (i % 2) * 0.12, Math.cos(a));
    out.push({ d, r: 42 + r() * 6, k: 0.62 });
  }
  for (const [x, y, z] of [
    [0, 1, 0.45],
    [0.3, 1, -0.35],
    [-0.3, 1, -0.35],
  ])
    out.push({ d: norm3(x, y, z), r: 40 + r() * 5, k: 0.6 });
  for (const [x, y, z] of [
    [0.75, -0.7, 0.25],
    [-0.75, -0.7, 0.25],
    [0, -0.7, -0.8],
    [0, -0.7, 0.85],
    [0.6, -0.7, -0.5],
    [-0.6, -0.7, -0.5],
  ])
    out.push({ d: norm3(x, y, z), r: 34, k: 0.72 });
  const res = out.map((o, i) => ({
    p: {
      x: BODY_C.x + o.d.x * BRX * o.k,
      y: BODY_C.y + o.d.y * BRY * o.k,
      z: BODY_C.z + o.d.z * BRZ * o.k,
    },
    r: o.r,
    n: norm3(o.d.x / BRX, o.d.y / BRY, o.d.z / BRZ),
    seed: i,
  }));
  // a little puff of a tail
  res.push({
    p: { x: 0, y: 120, z: -96 },
    r: 17,
    n: norm3(0, 0.3, -1),
    seed: 90,
  });
  return res;
})();
/** Moss lives in a few soft patches on the upper fleece (body-local spots). */
const MOSS_SPOTS = [
  [0.5, 0.75, 0.3, 20],
  [-0.6, 0.6, -0.4, 22],
  [0.1, 0.9, -0.5, 18],
  [0.85, 0.2, -0.45, 16],
  [-0.8, 0.25, 0.4, 15],
];
/** A few big inner spheres fill the cloud so no gap shows between lobes. */
const CORE_BALLS = [
  { p: BODY_C, r: 64 },
  { p: { x: 0, y: 98, z: 34 }, r: 58 },
  { p: { x: 0, y: 98, z: -50 }, r: 58 },
  { p: { x: 28, y: 94, z: -8 }, r: 52 },
  { p: { x: -28, y: 94, z: -8 }, r: 52 },
];
/** Is a point on the body surface with this normal facing the camera? */
const faces = (V, n, lim = 0.05) => V.N(n).z > lim;
/** Paint one woolly lobe: a soft painted sphere with an overlap shadow and a few curls. */
function paintLobe(ctx, x, y, r, l, o = {}) {
  const R = o.ramp || R_WOOL;
  ctx.save();
  if (o.shadow !== false) {
    ctx.shadowColor = "rgba(38,30,20,0.32)";
    ctx.shadowBlur = 8 * PQ;
    ctx.shadowOffsetX = 1.2 * PQ;
    ctx.shadowOffsetY = 3 * PQ;
  }
  const c = o.contrast ?? 0.2;
  const g = ctx.createRadialGradient(
    x - r * 0.36,
    y - r * 0.42,
    r * 0.08,
    x + r * 0.1,
    y + r * 0.1,
    r * 1.05,
  );
  g.addColorStop(0, rgba(ramp(R, l + c)));
  g.addColorStop(0.55, rgba(ramp(R, l)));
  g.addColorStop(1, rgba(ramp(R, l - c)));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.restore();
  if (o.curls === false) return;
  // curls: little open loops, light on the lit side, a darker crease under
  const rnd = rng(o.seed || 3),
    n = o.curls || (r > 20 ? 3 : 2);
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU,
      d = r * (0.25 + rnd() * 0.42),
      cx = x + Math.cos(a) * d,
      cy = y + Math.sin(a) * d * 0.8,
      cr = 2.6 + rnd() * 2.6;
    ctx.strokeStyle = `rgba(255,250,232,${0.22 + 0.2 * l})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(
      cx,
      cy,
      cr,
      Math.PI * (0.9 + rnd() * 0.3),
      Math.PI * (2.2 + rnd() * 0.3),
    );
    ctx.stroke();
    ctx.strokeStyle = "rgba(58,48,34,0.22)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(cx + 0.6, cy + 1.2, cr, Math.PI * 0.1, Math.PI * 0.85);
    ctx.stroke();
  }
  if (o.moss) {
    const mg = ctx.createRadialGradient(
      x - r * 0.15,
      y - r * 0.5,
      0,
      x - r * 0.15,
      y - r * 0.4,
      r * 0.7,
    );
    mg.addColorStop(0, MOSS + "0.5)");
    mg.addColorStop(1, MOSS + "0)");
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
}
/** The rearing pose: the body tips nose-up about the hind hips (a drawn pose, painted per view). */
const REAR_A = 0.6,
  REAR_PIV = { x: 0, y: 46, z: -56 };
function rotR(p, on) {
  if (!on) return p;
  const c = Math.cos(REAR_A),
    s = Math.sin(REAR_A),
    dy = p.y - REAR_PIV.y,
    dz = p.z - REAR_PIV.z;
  return {
    x: p.x,
    y: REAR_PIV.y + dy * c + dz * s,
    z: REAR_PIV.z + dz * c - dy * s,
  };
}
function rotN(n, on) {
  if (!on) return n;
  const c = Math.cos(REAR_A),
    s = Math.sin(REAR_A);
  return { x: n.x, y: n.y * c + n.z * s, z: n.z * c - n.y * s };
}
/** The fleece's outline in a view: the inner balls and the big lobes, as one path of circles. */
function fleecePath(V, rear = false) {
  const p = new Path2D();
  for (const b of CORE_BALLS.concat(LOBES)) {
    const q = V.P(rotR(b.p, rear));
    p.moveTo(q.x + b.r, q.y);
    p.arc(q.x, q.y, b.r, 0, TAU);
  }
  return p;
}
/** Lobe tone: the key light on the big body form, a little ambient. */
const lobeLight = (V, n) => clamp(0.08 + 0.72 * lit(V.N(n), 0.24));
/** One leg placed in a painter (hip at q, turned by rot, folded by fold), far legs in shade. */
function legAt(ctx, v, q, rot, fold, far) {
  ctx.save();
  ctx.translate(q.x, q.y);
  ctx.rotate(rot);
  ctx.scale(1, 1 - 0.62 * fold);
  paintLeg(ctx, { v, far });
  ctx.restore();
}
const legFar = (v, key, V) =>
  v === 0
    ? key[0] === "F"
      ? 0
      : 1
    : v === 4
      ? key[0] === "F"
        ? 1
        : 0
      : V.P(HIPS[key]).z < V.P(BODY_C).z
        ? 1
        : 0;
/** All four legs standing, in one image (the idle pose draws one picture for its legs). */
function paintLegs4(ctx, k) {
  const V = makeView(VIEWS[k.v].yaw);
  Object.keys(HIPS)
    .map((key) => ({ key, q: V.P(HIPS[key]) }))
    .sort((a, b) => a.q.z - b.q.z)
    .forEach(({ key, q }) => legAt(ctx, k.v, q, 0, 0, legFar(k.v, key, V)));
}
/**
 * The fleece in view k.v (k.rear: the rearing pose, legs included): one big
 * soft form with a scalloped outline of a dozen lobes, painted shading, moss,
 * a few curls, the seam of light where the core sleeps, a tail puff.
 */
function paintBody(ctx, k) {
  const V = makeView(VIEWS[k.v].yaw),
    rear = !!k.rear;
  const sil = fleecePath(V, rear);
  if (rear) {
    // hind legs planted; forelegs lifted, folded and pawing the air
    const fwd = k.v === 0 || k.v === 4 ? 0 : 1;
    const legs = Object.keys(HIPS)
      .map((key) => ({ key, q: V.P(rotR(HIPS[key], key[0] === "F")) }))
      .sort((a, b) => a.q.z - b.q.z);
    for (const { key, q } of legs) {
      const F = key[0] === "F";
      legAt(
        ctx,
        k.v,
        q,
        F ? -0.95 * fwd + (key === "FL" ? 0.12 : -0.12) * fwd : 0.05 * fwd,
        F ? 0.55 : 0,
        legFar(k.v, key, V),
      );
    }
  }
  // 1 the under-fleece, then the inner form, softly shaded
  ctx.fillStyle = rgba(ramp(R_WOOL, 0.32));
  ctx.fill(sil);
  for (const b of CORE_BALLS) {
    const q = V.P(rotR(b.p, rear));
    paintLobe(ctx, q.x, q.y, b.r, 0.36, {
      curls: false,
      shadow: false,
      contrast: 0.1,
    });
  }
  // 2 the big lobes, far to near, low contrast so they read as one cloud
  const list = LOBES.map((b) => ({
    b,
    q: V.P(rotR(b.p, rear)),
    n: rotN(b.n, rear),
  })).sort((a, c) => a.q.z - c.q.z);
  for (const { b, q, n } of list)
    paintLobe(ctx, q.x, q.y, b.r, lobeLight(V, n), {
      seed: b.seed,
      contrast: 0.14,
      curls: 2,
    });
  // 3 the big form painted over the lobes: light from the upper left, shade low right; moss in soft patches
  ctx.save();
  ctx.clip(sil);
  const c = V.P(rotR(BODY_C, rear));
  const fg = ctx.createRadialGradient(c.x - 50, c.y - 60, 10, c.x, c.y, 150);
  fg.addColorStop(0, "rgba(255,250,234,0.16)");
  fg.addColorStop(0.5, "rgba(255,250,234,0)");
  fg.addColorStop(0.75, "rgba(40,30,18,0.1)");
  fg.addColorStop(1, "rgba(40,30,18,0.38)");
  ctx.fillStyle = fg;
  ctx.fill(sil);
  for (const [x, y, z, r] of MOSS_SPOTS) {
    const d = norm3(x, y, z),
      n = rotN(norm3(d.x / BRX, d.y / BRY, d.z / BRZ), rear),
      cz = V.N(n).z;
    if (cz < 0.15) continue;
    const q = V.P(
      rotR(
        {
          x: BODY_C.x + d.x * (BRX + 10),
          y: BODY_C.y + d.y * (BRY + 10),
          z: BODY_C.z + d.z * (BRZ + 10),
        },
        rear,
      ),
    );
    const mg = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 1.4);
    mg.addColorStop(0, MOSS + (0.6 * cz).toFixed(2) + ")");
    mg.addColorStop(1, MOSS + "0)");
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(q.x, q.y, r * 1.4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  innerGlow(ctx, sil, "rgba(48,38,26,0.5)", 22, 0, -12);
  innerGlow(ctx, sil, "rgba(48,38,26,0.3)", 18, 10, 0);
  innerGlow(ctx, sil, "rgba(255,226,170,0.9)", 4, -3, 0); // rim light, right
  innerGlow(ctx, sil, "rgba(255,244,222,0.5)", 7, 2.5, 3); // sky light, upper left
  // 4 the seam of light over the sleeping core (front and turned views)
  const gn = rotN(norm3(0, -0.3, 1), rear);
  if (V.N(gn).z > 0.2) {
    const g = V.P(rotR(GEM, rear));
    ctx.save();
    ctx.translate(g.x, g.y);
    paintSeam(ctx);
    ctx.restore();
  }
}
/** Cracks of light across the fleece (phases 2 and 3): curves on the body surface, only the visible runs. */
const CRACKS = (() => {
  const out = [],
    r = rng(55);
  for (let i = 0; i < 9; i++) {
    let th = r() * TAU,
      ph = -0.1 + r() * 0.9; // round the body, up the side
    const dth = (r() - 0.5) * 0.5,
      dph = (r() - 0.5) * 0.35,
      pts = [];
    for (let j = 0; j < 9; j++) {
      th += dth * 0.4 + (r() - 0.5) * 0.25;
      ph += dph * 0.3 + (r() - 0.5) * 0.18;
      const cp = Math.cos(ph);
      const d = { x: Math.sin(th) * cp, y: Math.sin(ph), z: Math.cos(th) * cp };
      pts.push({
        p: {
          x: BODY_C.x + d.x * (BRX + 18),
          y: BODY_C.y + d.y * (BRY + 14),
          z: BODY_C.z + d.z * (BRZ + 18),
        },
        n: norm3(d.x / BRX, d.y / BRY, d.z / BRZ),
      });
    }
    out.push({ pts, ph: i < 5 ? 2 : 3, w: 1 + r() * 0.8 });
  }
  return out;
})();
/** Phases 2-3 in one picture per view: cracks of light in the fleece and crystal clusters breaking out. */
function paintOverlay(ctx, k) {
  const V = makeView(VIEWS[k.v].yaw),
    sil = fleecePath(V);
  ctx.save();
  ctx.clip(sil);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const runs = [];
  for (const c of CRACKS) {
    if (c.ph > k.ph) continue;
    let cur = null;
    for (const pt of c.pts) {
      if (faces(V, pt.n, 0.12)) {
        const q = V.P(pt.p);
        (cur || (cur = runs[runs.length] = { w: c.w, q: [] })).q.push(q);
      } else cur = null;
    }
  }
  const path = (q) => {
    ctx.beginPath();
    q.forEach((p, i) => {
      if (!i) ctx.moveTo(p.x, p.y);
      else {
        const m = q[i - 1];
        ctx.quadraticCurveTo(m.x, m.y, (m.x + p.x) / 2, (m.y + p.y) / 2);
      }
    });
    ctx.lineTo(q[q.length - 1].x, q[q.length - 1].y);
  };
  soft(ctx, 3, () => {
    for (const r of runs)
      if (r.q.length > 1) {
        ctx.strokeStyle = "rgba(255,150,40,0.85)";
        ctx.lineWidth = 9 * r.w;
        path(r.q);
        ctx.stroke();
      }
  });
  for (const r of runs)
    if (r.q.length > 1) {
      ctx.strokeStyle = "rgba(255,196,80,1)";
      ctx.lineWidth = 3.2 * r.w;
      path(r.q);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,250,214,1)";
      ctx.lineWidth = 1.2 * r.w;
      path(r.q);
      ctx.stroke();
    }
  ctx.restore();
  for (const cl of CLUSTERS) {
    if (cl.ph > k.ph) continue;
    const b = onBody(cl.d, 6),
      cz = V.N(b.n).z;
    if (cz < 0.12) continue;
    const q = V.P(b.p);
    ctx.save();
    ctx.translate(q.x, q.y);
    const sc = cl.s * (0.75 + 0.25 * Math.min(1, cz * 1.6));
    ctx.scale(sc, sc);
    paintShardCluster(ctx, { seed: 11 + cl.n * 9 });
    ctx.restore();
  }
}

// ── legs: short sturdy capsules with dark cloven hooves ──
/** One leg in a view (pivot = hip at 0,0; the hoof sole at y = LEG_L). far: in shade. */
function paintLeg(ctx, k) {
  const far = k.far,
    side = k.v === 2;
  const w = 11.5,
    top = -6,
    bot = LEG_L - 10;
  const p = new Path2D();
  p.moveTo(-w, top);
  p.lineTo(-w * 0.92, bot - 2);
  p.quadraticCurveTo(0, bot + 4, w * 0.92, bot - 2);
  p.lineTo(w, top);
  p.arc(0, top, w, 0, Math.PI, true);
  p.closePath();
  const g = ctx.createLinearGradient(-w, 0, w, 0);
  const l = far ? 0.32 : 0.62;
  g.addColorStop(0, rgba(ramp(R_SKIN, l + 0.2)));
  g.addColorStop(0.45, rgba(ramp(R_SKIN, l)));
  g.addColorStop(1, rgba(ramp(R_SKIN, l - 0.3)));
  ctx.fillStyle = g;
  ctx.fill(p);
  // a woolly cuff where the leg meets the fleece
  for (let i = -1; i <= 1; i++)
    paintLobe(ctx, i * 7.5, top + 4 + Math.abs(i) * 2, 9, far ? 0.4 : 0.66, {
      curls: false,
      shadow: false,
    });
  // the hoof: dark, glossy, a soft cleft from the front, a rounded wedge from the side
  const h = new Path2D();
  const y0 = bot - 4,
    y1 = LEG_L;
  if (side) {
    h.moveTo(-w * 1.02, y0);
    h.quadraticCurveTo(-w * 1.15, y1 - 1, -w * 0.6, y1);
    h.quadraticCurveTo(w * 0.5, y1 + 0.6, w * 1.45, y1 - 0.5);
    h.quadraticCurveTo(w * 1.3, y0 + 1, w * 0.95, y0);
    h.quadraticCurveTo(0, y0 - 2.5, -w * 1.02, y0);
  } else {
    h.moveTo(-w * 1.06, y0);
    h.quadraticCurveTo(-w * 1.2, y1, -w * 0.4, y1);
    h.quadraticCurveTo(0, y1 - 3, w * 0.4, y1);
    h.quadraticCurveTo(w * 1.2, y1, w * 1.06, y0);
    h.quadraticCurveTo(0, y0 - 2.5, -w * 1.06, y0);
  }
  const hg = ctx.createLinearGradient(0, y0, 0, y1);
  hg.addColorStop(0, far ? "#2a201c" : "#3c302a");
  hg.addColorStop(1, far ? "#120c0a" : "#1a120f");
  ctx.fillStyle = hg;
  ctx.fill(h);
  ctx.strokeStyle = far ? "rgba(255,240,220,0.12)" : "rgba(255,240,220,0.3)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-w * 0.7, y0 + 1.6);
  ctx.quadraticCurveTo(-w * 0.2, y0 + 0.4, w * 0.3, y0 + 1.4);
  ctx.stroke();
  if (!side) {
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(0, y0 + 2);
    ctx.quadraticCurveTo(0.6, y0 + 5, 0, y1 - 2.6);
    ctx.stroke();
  }
}

// ── the head (painted at the face's yaw): skin, muzzle, nose, ears, a fleece hood ──
/** The face turns a little further toward the camera than the body (a usual cheat); the back views do not. */
const FACE_YAW = [0, 33 * DEG, 78 * DEG, 135 * DEG, 180 * DEG];
const faceYawOf = (bodyYaw) =>
  bodyYaw <= 45 * DEG
    ? bodyYaw * (33 / 45)
    : bodyYaw <= 90 * DEG
      ? 33 * DEG + (bodyYaw - 45 * DEG) * (45 / 45)
      : bodyYaw;
/** Fleece on the head (head-local): a crown tuft between the horns, a fringe, a hood behind. */
const HOOD = [
  { p: { x: 0, y: 33, z: -8 }, r: 18 },
  { p: { x: 16, y: 29, z: -14 }, r: 15 },
  { p: { x: -16, y: 29, z: -14 }, r: 15 },
  { p: { x: 0, y: 22, z: -30 }, r: 19 },
  { p: { x: 26, y: 11, z: -27 }, r: 17 },
  { p: { x: -26, y: 11, z: -27 }, r: 17 },
  { p: { x: 0, y: 3, z: -38 }, r: 20 },
  { p: { x: 30, y: -8, z: -30 }, r: 16 },
  { p: { x: -30, y: -8, z: -30 }, r: 16 },
  { p: { x: 0, y: 37, z: 9 }, r: 13 },
  { p: { x: 11, y: 35, z: 4 }, r: 12 },
  { p: { x: -11, y: 35, z: 4 }, r: 12 },
];
HOOD.push(
  { p: { x: 0, y: 42, z: -4 }, r: 12, crown: true },
  { p: { x: 15, y: 41, z: 1 }, r: 10, crown: true },
  { p: { x: -15, y: 41, z: 1 }, r: 10, crown: true },
);
/** The crown tuft and fringe: drawn over the horn roots, so the horns grow out of the fleece. */
function paintCrown(ctx, k) {
  const fy = k.fy != null ? k.fy : FACE_YAW[k.v],
    V = headView(fy);
  HOOD.filter((b) => b.crown)
    .map((b) => ({ b, q: V.P(b.p) }))
    .sort((a, c) => a.q.z - c.q.z)
    .forEach(({ b, q }) =>
      paintLobe(
        ctx,
        q.x,
        q.y,
        b.r,
        clamp(0.25 + 0.75 * lit(V.N(norm3(b.p.x, b.p.y, b.p.z)), 0.3)),
        { seed: (30 + b.r) | 0 },
      ),
    );
}
const EAR = { base: { x: 36, y: 2, z: -6 }, tip: { x: 60, y: -10, z: 3 } };
function headPath(V) {
  const p = new Path2D(),
    c = V.P({ x: 0, y: 0, z: 0 }),
    m = V.P(MUZ);
  p.moveTo(c.x + HR, c.y);
  p.arc(c.x, c.y, HR, 0, TAU);
  p.moveTo(m.x + MUZ.r, m.y);
  p.arc(m.x, m.y, MUZ.r, 0, TAU);
  return p;
}
function paintEar(ctx, V, sx) {
  const b = V.P({ ...EAR.base, x: EAR.base.x * sx }),
    t = V.P({ ...EAR.tip, x: EAR.tip.x * sx });
  const len = Math.hypot(t.x - b.x, t.y - b.y);
  if (len < 4) return;
  const w = 10;
  const p = leafPath(b.x, b.y, t.x, t.y, w, "round", 0.05 * sx);
  const g = ctx.createLinearGradient(b.x, b.y, t.x, t.y);
  g.addColorStop(0, rgba(ramp(R_SKIN, 0.45)));
  g.addColorStop(1, rgba(ramp(R_SKIN, 0.7)));
  ctx.save();
  ctx.shadowColor = "rgba(30,20,14,0.35)";
  ctx.shadowBlur = 3 * PQ;
  ctx.shadowOffsetY = 1.5 * PQ;
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.restore();
  // the pink inner ear shows when the ear's front faces us
  if (V.N({ x: 0.35 * sx, y: 0.2, z: 0.9 }).z > 0.1) {
    const mx = lerp(b.x, t.x, 0.12),
      my = lerp(b.y, t.y, 0.12);
    ctx.fillStyle = "rgba(232,150,140,0.85)";
    ctx.fill(
      leafPath(
        mx,
        my,
        lerp(b.x, t.x, 0.86),
        lerp(b.y, t.y, 0.86),
        w * 0.48,
        "round",
        0.05 * sx,
      ),
    );
  }
  ctx.strokeStyle = "rgba(40,24,18,0.55)";
  ctx.lineWidth = 1;
  ctx.stroke(p);
}
function paintHead(ctx, k) {
  const fy = k.fy != null ? k.fy : FACE_YAW[k.v],
    V = headView(fy);
  const items = [];
  const hp = headPath(V),
    c = V.P({ x: 0, y: 0, z: 0 }),
    m = V.P(MUZ);
  for (const b of HOOD) {
    const q = V.P(b.p),
      n = norm3(b.p.x, b.p.y, b.p.z);
    items.push({
      z: q.z,
      f: () =>
        paintLobe(ctx, q.x, q.y, b.r, clamp(0.25 + 0.75 * lit(V.N(n), 0.3)), {
          seed: (30 + b.r) | 0,
        }),
    });
  }
  for (const sx of [1, -1]) {
    const q = V.P({ ...EAR.base, x: EAR.base.x * sx });
    items.push({ z: q.z - 4, f: () => paintEar(ctx, V, sx) });
  }
  // the skull and muzzle as one soft form
  items.push({
    z: 0,
    f: () => {
      const g = ctx.createRadialGradient(
        c.x - HR * 0.38,
        c.y - HR * 0.45,
        2,
        c.x,
        c.y,
        HR * 1.15,
      );
      g.addColorStop(0, rgba(ramp(R_SKIN, 0.98)));
      g.addColorStop(0.5, rgba(ramp(R_SKIN, 0.68)));
      g.addColorStop(1, rgba(ramp(R_SKIN, 0.3)));
      ctx.fillStyle = g;
      ctx.fill(hp);
      {
        const mz = V.N(norm3(MUZ.x, MUZ.y, MUZ.z)).z;
        if (mz > -0.3) {
          const mg = ctx.createRadialGradient(
            m.x - MUZ.r * 0.3,
            m.y - MUZ.r * 0.45,
            1,
            m.x,
            m.y,
            MUZ.r * 1.1,
          );
          mg.addColorStop(0, rgba(ramp(R_MUZ, 1)));
          mg.addColorStop(0.6, rgba(ramp(R_MUZ, 0.7)));
          mg.addColorStop(1, rgba(ramp(R_MUZ, 0.35)));
          ctx.save();
          ctx.globalAlpha = clamp((mz + 0.3) * 2);
          ctx.fillStyle = mg;
          ctx.beginPath();
          ctx.arc(m.x, m.y, MUZ.r, 0, TAU);
          ctx.fill();
          // the muzzle melts into the face above
          soft(ctx, 4, () => {
            ctx.fillStyle = rgba(ramp(R_MUZ, 0.75), 0.6);
            ctx.beginPath();
            ctx.arc(m.x, m.y - MUZ.r * 0.55, MUZ.r * 0.7, 0, TAU);
            ctx.fill();
          });
          ctx.restore();
        }
      }
      innerGlow(ctx, hp, "rgba(40,26,18,0.55)", 9, 3, -2);
      innerGlow(ctx, hp, "rgba(255,226,180,0.75)", 3, -2.4, 0);
      // the nose: two soft comma nostrils and a little curve, on the muzzle front
      const nz = V.N({ x: 0, y: 0.15, z: 1 }).z;
      if (nz > 0.05) {
        const np = V.P({ x: 0, y: MUZ.y + 5, z: MUZ.z + MUZ.r * 0.92 });
        const side = fy > 60 * DEG;
        ctx.fillStyle = "#3a2620";
        ctx.strokeStyle = "#3a2620";
        ctx.lineCap = "round";
        const nost = (x, y, dir) => {
          ctx.beginPath();
          ctx.ellipse(x, y, 3, 2, dir * 0.5, 0, TAU);
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x + dir * 2, y + 0.8);
          ctx.quadraticCurveTo(x + dir * 4.2, y + 3.2, x + dir * 2.2, y + 5.4);
          ctx.stroke();
        };
        if (side) nost(np.x + 2, np.y, 1);
        else {
          const s = Math.cos(fy),
            dx = 6.6 * s;
          nost(np.x - dx, np.y, -1);
          nost(np.x + dx, np.y, 1);
        }
        ctx.fillStyle = "rgba(255,248,236,0.55)";
        ctx.beginPath();
        ctx.ellipse(np.x - 3, np.y - 4.5, 2.6, 1.4, -0.3, 0, TAU);
        ctx.fill();
      }
    },
  });
  items.sort((a, b) => a.z - b.z);
  for (const it of items) it.f();
}

// ── horns: a tapering crystal tube along a spiral that curls back, down and forward ──
/** Horn centreline (head-local) for side sx (+1 = its left), phase size g, at s in 0..1. */
function hornPt(s, sx, g) {
  const th = (72 + s * 300) * DEG,
    R0 = 36 * g,
    r = R0 * (1 - 0.52 * s);
  const u = -6 - (g - 1) * 26 + r * Math.cos(th),
    v = 11 + r * Math.sin(th);
  // a helix, not a flat coil: it steps out past the head as it sweeps back, then keeps flaring out to the tip
  return { x: hornX(s, g) * sx, y: v, z: u };
}
/** How far out from the head's middle the horn runs at s. */
const hornX = (s, g) =>
  (17 + 30 * smooth(0, 0.42, s) + 12 * s) * (0.9 + 0.1 * g);
const hornW = (s, g) =>
  (0.55 + 0.45 * smooth(0, 0.09, s)) *
    14 *
    (0.9 + 0.1 * g) *
    (1 - 0.74 * Math.pow(s, 0.9)) +
  0.6;
const HORN_G = [1, 1, 1.13, 1.27];
/** Crystal sprouts along the horn's outer edge per phase (s, size). */
const SPROUTS = [
  [],
  [],
  [
    [0.36, 1],
    [0.62, 0.8],
  ],
  [
    [0.24, 0.9],
    [0.4, 1.15],
    [0.6, 1],
    [0.8, 0.75],
  ],
];
function paintHorn(ctx, k) {
  const fy = k.fy != null ? k.fy : FACE_YAW[k.v],
    V = headView(fy),
    sx = k.side === "L" ? 1 : -1,
    g = HORN_G[k.ph],
    dim = k.dim;
  const R = dim ? R_DIMAMB : R_AMBER;
  const N = 64,
    C = [],
    W = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    C.push(V.P(hornPt(s, sx, g)));
    W.push(hornW(s, g));
  }
  const L = [],
    Rr = [],
    D = [];
  for (let i = 0; i <= N; i++) {
    const a = C[Math.max(0, i - 1)],
      b = C[Math.min(N, i + 1)],
      d = norm2(b.x - a.x, b.y - a.y);
    D.push(d);
    L.push({ x: C[i].x - d.y * W[i], y: C[i].y + d.x * W[i] });
    Rr.push({ x: C[i].x + d.y * W[i], y: C[i].y - d.x * W[i] });
  }
  // front and back views: split the horn where it passes behind the head; turned views: the near horn
  // is wholly in front, the far one wholly behind (no cut ever shows, the crown tuft hides the roots)
  const sym = Math.abs(Math.sin(fy)) < 0.05,
    near = sx * -Math.sin(fy) > 0;
  const want = (i) =>
    sym
      ? k.part === "back"
        ? (C[i].z + C[i + 1].z) / 2 < 0
        : (C[i].z + C[i + 1].z) / 2 >= 0
      : (k.part === "front") === near;
  const idx = [];
  for (let i = 0; i < N; i++) if (want(i)) idx.push(i);
  if (!idx.length) return;
  idx.sort((a, b) => C[a].z - C[b].z);
  const quad = (i, e, kL, kR) => {
    const l0 = { x: lerp(C[i].x, L[i].x, kL), y: lerp(C[i].y, L[i].y, kL) },
      l1 = {
        x: lerp(C[i + 1].x, L[i + 1].x, kL),
        y: lerp(C[i + 1].y, L[i + 1].y, kL),
      };
    const r0 = { x: lerp(C[i].x, Rr[i].x, kR), y: lerp(C[i].y, Rr[i].y, kR) },
      r1 = {
        x: lerp(C[i + 1].x, Rr[i + 1].x, kR),
        y: lerp(C[i + 1].y, Rr[i + 1].y, kR),
      };
    const ox = D[i].y * e,
      oy = -D[i].x * e; // widen sideways only (no caps: seamless where back and front meet)
    ctx.beginPath();
    ctx.moveTo(l0.x - ox, l0.y - oy);
    ctx.lineTo(l1.x - ox, l1.y - oy);
    ctx.lineTo(r1.x + ox, r1.y + oy);
    ctx.lineTo(r0.x + ox, r0.y + oy);
    ctx.closePath();
    ctx.fill();
  };
  // which edge is lit: the one toward the upper left
  const litSide = (i) => (-D[i].y * -0.6 + D[i].x * -0.8 > 0 ? "L" : "R");
  // 0 a round root (it never ends in a straight cut, even where the fleece does not hide it)
  if (want(0)) {
    ctx.fillStyle = dim ? "#2a1e16" : "#5a2206";
    ctx.beginPath();
    ctx.arc(C[0].x, C[0].y, W[0] + 1.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgba(ramp(R, 0.5));
    ctx.beginPath();
    ctx.arc(C[0].x, C[0].y, W[0], 0, TAU);
    ctx.fill();
  }
  // 1 dark edge
  ctx.fillStyle = dim ? "#2a1e16" : "#5a2206";
  for (const i of idx) quad(i, 1.5, 1, 1);
  // 2 body, segment by segment: deeper at the root, brighter toward the tip, a facet shimmer
  for (const i of idx) {
    const s = i / N,
      l = 0.42 + 0.22 * s + 0.07 * Math.sin(s * 26);
    ctx.fillStyle = rgba(ramp(R, l));
    quad(i, 0.35, 1, 1);
  }
  // 3 the lit half, then a hot inner core (the crystal glows from inside), then a specular streak
  for (const i of idx) {
    const s = i / N,
      ls = litSide(i);
    ctx.fillStyle = rgba(ramp(R, 0.68 + 0.18 * s));
    quad(i, 0.3, ls === "L" ? 0.95 : -0.1, ls === "R" ? 0.95 : -0.1);
  }
  for (const i of idx) {
    const s = i / N;
    ctx.fillStyle = dim
      ? "rgba(200,180,150,0.25)"
      : `rgba(255,236,150,${0.35 + 0.25 * s})`;
    quad(i, 0.2, 0.28, 0.28);
  }
  for (const i of idx) {
    const ls = litSide(i);
    ctx.fillStyle = dim ? "rgba(240,230,210,0.35)" : "rgba(255,252,230,0.85)";
    quad(i, 0.15, ls === "L" ? 0.78 : -0.55, ls === "R" ? 0.78 : -0.55);
  }
  // 4 ridges: curved bands across the tube, like a ram's horn, catching light
  ctx.lineCap = "round";
  for (let i = 3; i < N - 3; i += 5) {
    if (!want(i)) continue;
    const s = i / N,
      d = D[i],
      w = W[i] * 0.92,
      bow = W[i] * 0.35;
    const a = { x: C[i].x - d.y * w, y: C[i].y + d.x * w },
      b = { x: C[i].x + d.y * w, y: C[i].y - d.x * w };
    ctx.strokeStyle = dim
      ? "rgba(40,30,22,0.5)"
      : `rgba(150,60,8,${0.55 - 0.3 * s})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(C[i].x + d.x * bow, C[i].y + d.y * bow, b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = dim ? "rgba(230,220,200,0.25)" : "rgba(255,246,200,0.55)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(a.x + d.x * 1.6, a.y + d.y * 1.6);
    ctx.quadraticCurveTo(
      C[i].x + d.x * (bow + 1.6),
      C[i].y + d.y * (bow + 1.6),
      b.x + d.x * 1.6,
      b.y + d.y * 1.6,
    );
    ctx.stroke();
  }
  // 5 the round tip: a crystal point with a glint
  if (want(N - 1)) {
    const t = C[N],
      d = D[N],
      w = W[N];
    ctx.fillStyle = dim ? rgba(ramp(R, 0.7)) : "#fff0b0";
    ctx.beginPath();
    ctx.moveTo(t.x - d.y * w * 1.4, t.y + d.x * w * 1.4);
    ctx.quadraticCurveTo(
      t.x + d.x * w * 4.5,
      t.y + d.y * w * 4.5,
      t.x + d.y * w * 1.4,
      t.y - d.x * w * 1.4,
    );
    ctx.closePath();
    ctx.fill();
  }
  // 6 sprouts: little crystal points standing off the outer curve (phases 2-3)
  for (const [s, sz] of SPROUTS[k.ph]) {
    const i = Math.round(s * N);
    if (!want(Math.min(N - 1, i))) continue;
    const d = D[i],
      o = { x: C[i].x, y: C[i].y };
    // out from the coil's centre
    const cc = V.P({ x: hornX(s, g) * sx, y: 11, z: -6 - (g - 1) * 26 });
    const out = norm2(o.x - cc.x, o.y - cc.y),
      base = W[i] * 0.8,
      len = 16 * sz * (dim ? 0.9 : 1);
    const b0 = { x: o.x + out.x * base, y: o.y + out.y * base };
    for (const [ang, f] of [
      [-0.4, 0.68],
      [0.12, 1],
      [0.6, 0.6],
    ]) {
      const ca = Math.cos(ang),
        sa = Math.sin(ang);
      crystalPoint(
        ctx,
        b0,
        { x: out.x * ca - out.y * sa, y: out.x * sa + out.y * ca },
        len * f,
        4.2 * sz * f,
        R,
        dim ? "#2a1e16" : "#6a2a06",
      );
    }
  }
}

/** A faceted crystal point from base b along unit d: two flat facets (light and shade), a ridge, a glint. */
function crystalPoint(ctx, b, d, len, w, R, dark) {
  const nx = -d.y,
    ny = d.x,
    sh = { x: b.x + d.x * len * 0.62, y: b.y + d.y * len * 0.62 },
    tip = { x: b.x + d.x * len, y: b.y + d.y * len };
  const L0 = { x: b.x + nx * w, y: b.y + ny * w },
    L1 = { x: sh.x + nx * w * 0.92, y: sh.y + ny * w * 0.92 };
  const R0 = { x: b.x - nx * w, y: b.y - ny * w },
    R1 = { x: sh.x - nx * w * 0.92, y: sh.y - ny * w * 0.92 };
  const poly = (pts) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  };
  ctx.lineJoin = "round";
  poly([L0, L1, tip, R1, R0]);
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  const lit = nx * -0.6 + ny * -0.8 > 0; // the facet toward the upper left catches the light
  poly([L0, L1, tip, b]);
  ctx.fillStyle = rgba(ramp(R, lit ? 0.92 : 0.55));
  ctx.fill();
  poly([R0, R1, tip, b]);
  ctx.fillStyle = rgba(ramp(R, lit ? 0.55 : 0.92));
  ctx.fill();
  ctx.strokeStyle = rgba(ramp(R, 1), 0.9);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(b.x + d.x * len * 0.15, b.y + d.y * len * 0.15);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
}

/** Both horns' back (or front) parts in one image, for a view and phase. */
function paintHornSet(ctx, k) {
  paintHorn(ctx, { ...k, side: "L" });
  paintHorn(ctx, { ...k, side: "R" });
}
// ── face: eyes, brows, blush, mouth (per face view; the anime ¾ rules) ──
// Each eye is its own drawing per view: a front pair; at ¾ a near eye (full
// width) and a far eye (a narrower opening tucked toward the far edge); at
// the side one profile eye well inside the outline. Nothing is scaled or
// skewed: the iris, pupil and glints are always the same circles, clipped by
// the opening and the curved lids. The eye line is the same in every view.
const EYE_PHI = 0.43,
  EYE_Y = 6;
const EYE_HH = 15,
  EYE_HW = 13,
  EYE_HW_FAR = 7.6,
  EYE_HW_SIDE = 10.6,
  IRIS_R = 10.4,
  PUPIL_R = 4.4;
const EXPRS = ["idle", "glare", "wide", "hurt", "dizzy", "closed"];
const MOUTHS = ["pout", "grit", "roar", "wavy", "flat"];
const PROFILE_AT = 60 * DEG;
/** The eye line (head-local screen y): where the eyes sit from the front, used by every view. */
const EYE_LINE = yS(EYE_Y) + HR * Math.cos(EYE_PHI) * SP;
function eyeLayout(vOrYaw, isYaw = false) {
  const fy = isYaw ? vOrYaw : FACE_YAW[vOrYaw],
    V = headView(fy),
    out = [];
  const front = V.P({ x: 0, y: EYE_Y, z: HR });
  const look = fy < 4 * DEG ? 0 : 1.6;
  for (const phi of [EYE_PHI, -EYE_PHI]) {
    const a = phi + fy,
      c = Math.cos(a);
    const q = V.P({ x: HR * Math.sin(phi), y: EYE_Y, z: HR * Math.cos(phi) });
    let kind;
    if (fy < 4 * DEG) kind = "front";
    else if (fy >= PROFILE_AT) {
      if (phi > 0) continue;
      kind = "side";
    } else kind = phi < 0 ? "near" : "far";
    if (kind === "far" && c < 0.25) continue;
    const hw =
      kind === "far" ? EYE_HW_FAR : kind === "side" ? EYE_HW_SIDE : EYE_HW;
    // keep the whole eye, its lash flick included, inside the head's outline
    const lim = HR - hw - (kind === "far" ? 4.5 : 6); // the far eye's flick is short: it stays inside
    const x =
      kind === "side" ? Math.sign(q.x || 1) * HR * 0.44 : clamp(q.x, -lim, lim);
    out.push({
      x,
      y: EYE_LINE,
      hw,
      hh: EYE_HH,
      inner: front.x - q.x >= 0 ? 1 : -1,
      kind,
      look,
      left: phi > 0,
    });
  }
  for (const e of out) if (e.kind === "side") e.inner = 1;
  if (out.length === 2 && out[0].kind === "far") {
    const far = out[0],
      near = out[1],
      gap = far.x - far.hw - (near.x + near.hw);
    if (gap < 6) near.x -= 6 - gap;
  }
  return out;
}
function eyeOpening(e) {
  const { x, y, hw, hh, inner: n, kind } = e;
  const p = new Path2D();
  if (kind === "side") {
    const A = { x: x + n * hw * 0.62, y: y - hh * 0.84 },
      B = { x: x + n * hw * 0.5, y: y + hh * 0.82 },
      O = { x: x - n * hw, y: y - hh * 0.1 };
    p.moveTo(O.x, O.y);
    p.bezierCurveTo(
      x - n * hw * 0.55,
      y - hh * 0.8,
      x + n * hw * 0.1,
      y - hh * 1.0,
      A.x,
      A.y,
    );
    p.bezierCurveTo(
      x + n * hw * 1.42,
      y - hh * 0.52,
      x + n * hw * 1.36,
      y + hh * 0.58,
      B.x,
      B.y,
    );
    p.bezierCurveTo(
      x + n * hw * 0.1,
      y + hh * 0.98,
      x - n * hw * 0.6,
      y + hh * 0.58,
      O.x,
      O.y,
    );
    p.closePath();
    return {
      p,
      top: (t) =>
        cubicPt(
          [
            O,
            { x: x - n * hw * 0.55, y: y - hh * 0.8 },
            { x: x + n * hw * 0.1, y: y - hh * 1.0 },
            A,
          ],
          t,
        ),
    };
  }
  const lift = kind === "far" ? hh * 0.12 : hh * 0.04;
  const I = { x: x + n * hw, y: y + hh * 0.1 },
    O = { x: x - n * hw, y: y - lift };
  const c1 = { x: x + n * hw * 0.74, y: y - hh * 1.06 },
    c2 = { x: x - n * hw * 0.8, y: y - hh * 1.04 - lift * 0.4 };
  p.moveTo(I.x, I.y);
  p.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, O.x, O.y);
  p.bezierCurveTo(
    x - n * hw * 0.84,
    y + hh * 1.06,
    x + n * hw * 0.76,
    y + hh * 1.08,
    I.x,
    I.y,
  );
  p.closePath();
  return { p, top: (t) => cubicPt([O, c2, c1, I], t) };
}
function cubicPt(c, t) {
  const u = 1 - t;
  return {
    x:
      u * u * u * c[0].x +
      3 * u * u * t * c[1].x +
      3 * u * t * t * c[2].x +
      t * t * t * c[3].x,
    y:
      u * u * u * c[0].y +
      3 * u * u * t * c[1].y +
      3 * u * t * t * c[2].y +
      t * t * t * c[3].y,
  };
}
/** Lid height (fraction of hh above the eye centre) at the inner and outer ends: grumpy half-lids by default. */
const LIDS = { idle: [0.26, 0.4], glare: [-0.2, 0.46], wide: [2, 2] };
function paintEye(ctx, e, expr) {
  const { x, y, hw, hh, inner: n, kind } = e;
  const flickDir = -n;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (expr === "hurt") {
    // a squeezed chevron of two curves pointing at the nose
    const w = hw * 0.85;
    ctx.strokeStyle = C_INK;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(x - n * w, y - hh * 0.5);
    ctx.quadraticCurveTo(x + n * w * 0.05, y - hh * 0.32, x + n * w * 0.6, y);
    ctx.quadraticCurveTo(
      x + n * w * 0.05,
      y + hh * 0.3,
      x - n * w,
      y + hh * 0.42,
    );
    ctx.stroke();
    return;
  }
  if (expr === "dizzy") {
    const R = Math.min(hw, hh) * (kind === "far" ? 0.82 : 0.92);
    ctx.strokeStyle = C_INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * TAU * 2.4,
        r = (i / 64) * R;
      const px = x + Math.cos(a) * r,
        py = y + Math.sin(a) * r;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke();
    return;
  }
  if (expr === "closed") {
    // a heavy, sulky closed lid curving down, the flick at the outer end
    const fx = x + n * hw * (kind === "side" ? 0.7 : 0.95),
      ox = x - n * hw;
    ctx.strokeStyle = C_INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(fx, y + 1);
    ctx.quadraticCurveTo(x, y + hh * 0.5, ox, y - 0.5);
    ctx.quadraticCurveTo(
      ox + flickDir * 2.5,
      y - 2.5,
      ox + flickDir * 4.5,
      y - 4.5,
    );
    ctx.stroke();
    return;
  }
  const O = eyeOpening(e);
  const [li, lo] = LIDS[expr] || LIDS.idle;
  // the lid: always a curve (it bows up in the middle), never a straight cut
  const lidY = (px) => {
    const t = clamp((px - (x - n * hw)) / (2 * n * hw));
    return (
      y -
      hh * lerp(lo, li, t) -
      (li < 1.5 ? hh * 0.16 * Math.sin(Math.PI * t) : 0)
    );
  };
  ctx.save();
  ctx.clip(O.p);
  ctx.fillStyle = "#fff9ee";
  ctx.fillRect(x - hw * 2, y - hh * 2, hw * 4, hh * 4);
  // a soft shade under the upper lid on the white
  ctx.fillStyle = "rgba(120,90,70,0.28)";
  ctx.fillRect(x - hw * 2, y - hh * 2, hw * 4, hh * 1.4);
  const lid = new Path2D();
  for (let i = 0; i <= 24; i++) {
    const px = x - hw * 1.6 + (hw * 3.2 * i) / 24;
    i ? lid.lineTo(px, lidY(px)) : lid.moveTo(px, lidY(px));
  }
  lid.lineTo(x + hw * 1.6, y + hh * 2);
  lid.lineTo(x - hw * 1.6, y + hh * 2);
  lid.closePath();
  ctx.clip(lid);
  ctx.fillStyle = "#fffaf0";
  ctx.fillRect(x - hw * 2, y - hh * 2, hw * 4, hh * 4);
  const front = kind === "side" ? n * hw * 0.12 : 0;
  const ix = x + front + e.look * (kind === "side" ? 0 : 1),
    iy = y + hh * 0.14;
  const ig = ctx.createLinearGradient(0, iy - IRIS_R, 0, iy + IRIS_R);
  if (expr === "glare") {
    ig.addColorStop(0, "#6a2604");
    ig.addColorStop(0.45, "#e2780e");
    ig.addColorStop(0.85, "#ffd04a");
    ig.addColorStop(1, "#fff2a0");
  } else {
    ig.addColorStop(0, "#3c1c08");
    ig.addColorStop(0.45, "#a8560e");
    ig.addColorStop(0.82, "#f4a52a");
    ig.addColorStop(1, "#ffd774");
  }
  ctx.fillStyle = ig;
  ctx.beginPath();
  ctx.arc(ix, iy, IRIS_R, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(40,16,4,0.6)";
  ctx.lineWidth = 1;
  ctx.stroke();
  const pr =
    expr === "glare"
      ? PUPIL_R * 0.62
      : expr === "wide"
        ? PUPIL_R * 0.72
        : PUPIL_R;
  ctx.fillStyle = "#1a0a04";
  ctx.beginPath();
  ctx.arc(ix, iy - 0.3, pr, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,236,150,0.75)";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(ix, iy, IRIS_R * 0.72, 0.3 * Math.PI, 0.7 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(ix - 3.6, iy - 4.2, 3.5, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ix + 3.8, iy + 3.8, 1.6, 0, TAU);
  ctx.fill();
  ctx.restore();
  // the upper lash: a band along the visible top edge, thick at the outer end
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const q = O.top(i / 24);
    pts.push({ x: q.x, y: Math.max(q.y, Math.min(lidY(q.x), y + hh * 0.6)) });
  }
  const taper = (t) => Math.pow(1 - t, 0.6);
  ctx.fillStyle = C_INK;
  ctx.beginPath();
  pts.forEach((q, i) => {
    const t = i / 24,
      w = 0.2 + 3.1 * taper(t);
    i ? ctx.lineTo(q.x, q.y - w) : ctx.moveTo(q.x, q.y - w);
  });
  for (let i = 24; i >= 0; i--) {
    const t = i / 24,
      w = 0.2 + 1.5 * taper(t);
    ctx.lineTo(pts[i].x, pts[i].y + w);
  }
  ctx.closePath();
  ctx.fill();
  const o = pts[0];
  ctx.beginPath();
  ctx.moveTo(o.x + n * 2.2, o.y - 2.4);
  const fl = kind === "far" ? 0.45 : 1;
  ctx.quadraticCurveTo(
    o.x + flickDir * 3.6 * fl,
    o.y - 4 * fl,
    o.x + flickDir * 6.8 * fl,
    o.y - 7.2 * fl,
  );
  ctx.quadraticCurveTo(
    o.x + flickDir * 2.6 * fl,
    o.y + 0.2,
    o.x + n * 1.6,
    o.y + 1.4,
  );
  ctx.closePath();
  ctx.fill();
  // the eye's outline, soft, and a light lower lash
  ctx.strokeStyle = "rgba(50,24,14,0.55)";
  ctx.lineWidth = 1;
  ctx.stroke(O.p);
}
/** Bushy cream fleece brows: the grump lives here. */
function paintBrow(ctx, e, expr) {
  if (expr === "dizzy") return;
  const { x, y, hw, hh, inner: n, kind } = e;
  const [hi, ho] = {
    idle: [1.5, 8],
    glare: [-4.5, 9],
    wide: [11, 11],
    hurt: [11, 3.5],
    closed: [3.5, 6.5],
  }[expr] || [2, 7];
  const by = y - hh - 1.5;
  const x0 = x + n * hw * (kind === "side" ? 0.95 : 0.8),
    x1 = x - n * hw * (kind === "side" ? 0.75 : 0.95);
  const a = { x: x0, y: by - hi },
    b = { x: x1, y: by - ho },
    mid = { x: (x0 + x1) / 2, y: by - Math.max(hi, ho) - 3 };
  const th = kind === "far" ? 4 : 5;
  const p = new Path2D();
  p.moveTo(a.x, a.y + th * 0.5);
  p.quadraticCurveTo(mid.x, mid.y - th * 0.8, b.x, b.y - th * 0.2);
  p.quadraticCurveTo(b.x - n * 2.2, b.y + th * 0.4, b.x, b.y + th * 0.6);
  p.quadraticCurveTo(mid.x, mid.y + th * 0.9, a.x, a.y + th * 1.3);
  p.quadraticCurveTo(a.x + n * 2.4, a.y + th * 0.9, a.x, a.y + th * 0.5);
  p.closePath();
  ctx.fillStyle = "#3a2a1e";
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = "#3a2a1e";
  ctx.stroke(p);
  const g = ctx.createLinearGradient(0, mid.y - th, 0, mid.y + th * 2);
  g.addColorStop(0, "#fbf4e2");
  g.addColorStop(1, "#cbbf9f");
  ctx.fillStyle = g;
  ctx.fill(p);
}
function paintEyes(ctx, k) {
  const E = k.fy != null ? eyeLayout(k.fy, true) : eyeLayout(k.v);
  for (const e of E) {
    if (k.expr === "dizzy") continue;
    const bw = e.kind === "far" ? 3.5 : e.kind === "side" ? 5 : 6.5;
    const bx = e.x - e.inner * e.hw * (e.kind === "side" ? 0.15 : 0.3),
      by = e.y + e.hh + 5.5;
    soft(ctx, 2.4, () => {
      ctx.strokeStyle = "rgba(255,110,110,0.5)";
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(bx - bw, by);
      ctx.quadraticCurveTo(bx, by + 0.8, bx + bw, by);
      ctx.stroke();
    });
  }
  for (const e of E) {
    paintEye(ctx, e, k.expr);
    paintBrow(ctx, e, k.expr);
  }
}
/** Mouth placement on the muzzle (front, ¾ or side), drawn upright. */
function mouthLayout(vOrYaw, isYaw = false) {
  const fy = isYaw ? vOrYaw : FACE_YAW[vOrYaw],
    V = headView(fy);
  const q = V.P({ x: 0, y: MUZ.y - 7, z: MUZ.z + MUZ.r * 0.8 });
  const kind = fy < 4 * DEG ? "front" : fy >= PROFILE_AT ? "side" : "q";
  const [wn, wf] =
    kind === "front" ? [8.5, 8.5] : kind === "q" ? [8.5, 5.5] : [8, 2.5];
  const m = V.P(MUZ);
  const lim = MUZ.r - wf - 3;
  const mx =
    kind === "side"
      ? m.x + Math.sign(q.x - m.x || 1) * MUZ.r * 0.42
      : clamp(q.x, m.x - lim, m.x + lim);
  return { x: mx, y: q.y, kind, wn, wf };
}
function paintMouth(ctx, k) {
  const M = k.fy != null ? mouthLayout(k.fy, true) : mouthLayout(k.v);
  const { x, y, wn, wf } = M;
  const X = (u) => x + (u < 0 ? u * wn : u * wf);
  ctx.strokeStyle = C_INK;
  ctx.lineWidth = 2.1;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (k.m === "pout") {
    // the grump: a small frown with a pushed-out lower lip
    ctx.beginPath();
    ctx.moveTo(X(-1), y + 2.6);
    ctx.quadraticCurveTo(X(0), y - 2.2, X(1), y + 2.6);
    ctx.stroke();
    ctx.strokeStyle = "rgba(60,30,20,0.5)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(X(-0.45), y + 3.6);
    ctx.quadraticCurveTo(X(0), y + 5.2, X(0.45), y + 3.6);
    ctx.stroke();
  } else if (k.m === "grit") {
    // gritted teeth: a rounded bar of teeth, curved seams
    const p = new Path2D();
    p.moveTo(X(-1), y);
    p.quadraticCurveTo(X(0), y - 3.4, X(1), y);
    p.quadraticCurveTo(X(1) + 0.8, y + 4.4, X(0.6), y + 5);
    p.quadraticCurveTo(X(0), y + 6.6, X(-0.6), y + 5);
    p.quadraticCurveTo(X(-1) - 0.8, y + 4.4, X(-1), y);
    p.closePath();
    ctx.fillStyle = "#fffaf0";
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    ctx.strokeStyle = "rgba(90,60,40,0.7)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(X(-1), y + 2.4);
    ctx.quadraticCurveTo(X(0), y + 1.4, X(1), y + 2.4);
    ctx.stroke();
    for (const u of [-0.5, 0, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(X(u), y - 2);
      ctx.quadraticCurveTo(X(u) + 0.6, y + 2, X(u), y + 6);
      ctx.stroke();
    }
    ctx.restore();
    ctx.lineWidth = 1.8;
    ctx.stroke(p);
  } else if (k.m === "roar") {
    const p = new Path2D();
    p.moveTo(X(-1), y - 1);
    p.quadraticCurveTo(X(0), y - 3, X(1), y - 1);
    p.quadraticCurveTo(X(1) + 1, y + 9, X(0), y + 11);
    p.quadraticCurveTo(X(-1) - 1, y + 9, X(-1), y - 1);
    p.closePath();
    ctx.fillStyle = "#4a1810";
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    ctx.fillStyle = "#e86a62";
    ctx.beginPath();
    ctx.arc(X(0) + 0.5, y + 12, 5.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#fffaf0";
    ctx.beginPath();
    ctx.moveTo(X(-0.8), y - 2);
    ctx.quadraticCurveTo(X(0), y + 1.6, X(0.8), y - 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.stroke(p);
  } else if (k.m === "wavy") {
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const u = -1 + (2 * i) / 24,
        yy = Math.sin(((u + 1) / 2) * TAU * 2) * 1.6 + 1.5;
      i ? ctx.lineTo(X(u), y + yy) : ctx.moveTo(X(u), y + yy);
    }
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(X(-0.8), y + 2);
    ctx.quadraticCurveTo(X(0), y + 0.8, X(0.8), y + 2);
    ctx.stroke();
  }
}

// ── the chest core and the fleece that covers it ──
function paintGem(ctx, k) {
  // a rounded, faceted amber gem: curved facets, a hot heart
  const R = 15,
    n = 8,
    pts = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / n) * TAU;
    pts.push({ x: Math.cos(a) * R, y: Math.sin(a) * R * 1.12 });
  }
  const p = new Path2D();
  pts.forEach((q, i) => {
    const nq = pts[(i + 1) % n],
      mx = ((q.x + nq.x) / 2) * 1.08,
      my = ((q.y + nq.y) / 2) * 1.08;
    i
      ? p.quadraticCurveTo(mx, my, nq.x, nq.y)
      : (p.moveTo(q.x, q.y), p.quadraticCurveTo(mx, my, nq.x, nq.y));
  });
  p.closePath();
  const g = ctx.createRadialGradient(-3, -4, 1, 0, 0, R * 1.2);
  if (k.open) {
    g.addColorStop(0, "#fffbe8");
    g.addColorStop(0.35, "#ffe27a");
    g.addColorStop(0.75, "#ff9a24");
    g.addColorStop(1, "#b8500a");
  } else {
    g.addColorStop(0, "#ffe7a0");
    g.addColorStop(0.5, "#e88a1e");
    g.addColorStop(1, "#7a3606");
  }
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.strokeStyle = "rgba(255,248,214,0.75)";
  ctx.lineWidth = 1;
  for (const q of pts) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(q.x * 0.45 + 1, q.y * 0.45, q.x * 0.92, q.y * 0.92);
    ctx.stroke();
  }
  ctx.strokeStyle = "#6a2a06";
  ctx.lineWidth = 2;
  ctx.stroke(p);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.ellipse(-5, -7, 3.6, 2, -0.5, 0, TAU);
  ctx.fill();
}
/** Closed: just a warm seam of light between two lobes where the core sleeps. */
function paintSeam(ctx) {
  soft(ctx, 2.5, () => {
    ctx.strokeStyle = "rgba(255,170,60,0.9)";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-1, -10);
    ctx.quadraticCurveTo(3, 0, -1, 10);
    ctx.stroke();
  });
  ctx.strokeStyle = "#ffd36a";
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-1, -9);
  ctx.quadraticCurveTo(3, 0, -1, 9);
  ctx.stroke();
  ctx.strokeStyle = "#fff6d0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-0.6, -6);
  ctx.quadraticCurveTo(2.2, 0, -0.6, 6);
  ctx.stroke();
}
/** The fleece curtain over the core: a left and a right lobe pair in the body's own tone (they slide apart to open it). */
function paintFlap(ctx, k) {
  const V = makeView(VIEWS[k.v].yaw),
    sg = k.which === "L" ? -1 : 1;
  const l = lobeLight(V, norm3(0.25 * sg, -0.25, 1));
  paintLobe(ctx, sg * 4, -8, 13, l + 0.04, { seed: 70 + sg });
  paintLobe(ctx, sg * 2, 8, 14, l - 0.04, { seed: 72 + sg });
}
/** Small crystal clusters breaking out of the fleece (phases 2-3), three drawings. */
function paintShardCluster(ctx, k) {
  const r = rng(k.seed);
  for (const [i, ang, L, w] of [
    [0, -0.6, 15, 4.6],
    [2, 0.55, 14, 4.4],
    [1, -0.05, 23, 6],
  ]) {
    const a = -Math.PI / 2 + ang + (r() - 0.5) * 0.15;
    crystalPoint(
      ctx,
      { x: (i - 1) * 5, y: 2 },
      { x: Math.cos(a), y: Math.sin(a) },
      L * (0.9 + r() * 0.2),
      w,
      R_AMBER,
      "#6a2a06",
    );
  }
  for (let i = 0; i < 3; i++)
    paintLobe(ctx, -8 + i * 8, 6 + (i % 2) * 1.5, 7, 0.55, {
      curls: false,
      shadow: false,
    });
}
// ════════════════ effect sprites ════════════════
function paintGlow(ctx, k) {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 32);
  for (const [t, c] of k.stops) g.addColorStop(t, c);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 32, 0, TAU);
  ctx.fill();
}
function paintShadow(ctx) {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
  g.addColorStop(0, "rgba(30,20,10,0.8)");
  g.addColorStop(0.6, "rgba(30,20,10,0.45)");
  g.addColorStop(1, "rgba(30,20,10,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 60, 24, 0, 0, TAU);
  ctx.fill();
}
/** A stone with moss and an amber fleck (rocks shaken out of the fleece, debris, chips). */
function paintRock(ctx, k) {
  const r = rng(k.seed),
    n = 9,
    pts = [],
    R = k.s || 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU,
      rr = R * (0.78 + r() * 0.3);
    pts.push({ x: Math.cos(a) * rr * 1.1, y: Math.sin(a) * rr * 0.9 });
  }
  const p = new Path2D();
  pts.forEach((q, i) => {
    const nq = pts[(i + 1) % n],
      mx = (q.x + nq.x) / 2,
      my = (q.y + nq.y) / 2;
    i ? p.quadraticCurveTo(q.x, q.y, mx, my) : p.moveTo(mx, my);
  });
  p.quadraticCurveTo(
    pts[0].x,
    pts[0].y,
    (pts[0].x + pts[1].x) / 2,
    (pts[0].y + pts[1].y) / 2,
  );
  p.closePath();
  const g = ctx.createRadialGradient(-R * 0.35, -R * 0.4, 1, 0, 0, R * 1.2);
  g.addColorStop(0, "#e6dcc6");
  g.addColorStop(0.5, "#a89b84");
  g.addColorStop(1, "#5e5444");
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  const mg = ctx.createRadialGradient(
    -R * 0.2,
    -R * 0.7,
    0,
    -R * 0.2,
    -R * 0.6,
    R * 0.7,
  );
  mg.addColorStop(0, MOSS + "0.6)");
  mg.addColorStop(1, MOSS + "0)");
  ctx.fillStyle = mg;
  ctx.fill(p);
  ctx.strokeStyle = "rgba(60,48,34,0.45)";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-R * 0.5, R * 0.1);
  ctx.quadraticCurveTo(0, -R * 0.1, R * 0.4, R * 0.35);
  ctx.stroke();
  ctx.restore();
  if (k.amber) {
    ctx.fillStyle = "#ffbf48";
    ctx.beginPath();
    ctx.ellipse(R * 0.3, -R * 0.15, R * 0.2, R * 0.14, 0.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#fff6cc";
    ctx.beginPath();
    ctx.arc(R * 0.26, -R * 0.2, R * 0.06, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(48,38,26,0.85)";
  ctx.lineWidth = 1.6;
  ctx.stroke(p);
}
/** An amber shard: a curved crystal splinter. */
function paintShard(ctx, k) {
  const L = 14 * (k.s || 1),
    w = 4.2 * (k.s || 1);
  const p = new Path2D();
  p.moveTo(0, -L);
  p.quadraticCurveTo(w * 1.3, -L * 0.2, w * 0.6, L * 0.6);
  p.quadraticCurveTo(0, L * 0.9, -w * 0.6, L * 0.6);
  p.quadraticCurveTo(-w * 1.3, -L * 0.2, 0, -L);
  p.closePath();
  const g = ctx.createLinearGradient(-w, 0, w, 0);
  g.addColorStop(0, "#fff4c4");
  g.addColorStop(0.5, "#ffb43a");
  g.addColorStop(1, "#a44e08");
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.strokeStyle = "#5a2206";
  ctx.lineWidth = 1.2;
  ctx.stroke(p);
}
/** Crystal spikes bursting from the floor (the eruption): a cluster on a heap of broken stone. */
function paintSpikes(ctx, k) {
  const r = rng(k.seed);
  const spikes = [
    [-22, 0.62, -0.42],
    [-9, 1, -0.12],
    [6, 0.86, 0.18],
    [20, 0.58, 0.46],
    [-1, 0.5, 0.02],
  ];
  for (const [x, f, a] of spikes) {
    const len = 72 * f * (0.9 + r() * 0.2),
      w = 12 * (0.6 + f * 0.5);
    const dx = Math.sin(a),
      dy = -Math.cos(a),
      b = { x, y: 0 },
      tip = { x: x + dx * len, y: dy * len };
    const p = new Path2D();
    p.moveTo(b.x - w, b.y + 2);
    p.quadraticCurveTo(
      b.x - w * 0.95 + dx * len * 0.55,
      b.y + dy * len * 0.55,
      tip.x,
      tip.y,
    );
    p.quadraticCurveTo(
      b.x + w * 0.95 + dx * len * 0.55,
      b.y + dy * len * 0.55,
      b.x + w,
      b.y + 2,
    );
    p.closePath();
    ctx.strokeStyle = "#5a2206";
    ctx.lineWidth = 3;
    ctx.stroke(p);
    const g = ctx.createLinearGradient(b.x - w, 0, b.x + w, 0);
    g.addColorStop(0, "#fff3c0");
    g.addColorStop(0.35, "#ffc24a");
    g.addColorStop(0.7, "#e07c16");
    g.addColorStop(1, "#9a4608");
    ctx.fillStyle = g;
    ctx.fill(p);
    ctx.strokeStyle = "rgba(255,252,230,0.9)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(b.x - w * 0.3, b.y);
    ctx.quadraticCurveTo(
      b.x - w * 0.35 + dx * len * 0.5,
      dy * len * 0.5,
      tip.x,
      tip.y,
    );
    ctx.stroke();
  }
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.translate(-30 + i * 12 + (r() - 0.5) * 6, 4 + (i % 2) * 3);
    paintRock(ctx, { seed: k.seed * 7 + i, s: 6 + r() * 4, amber: false });
    ctx.restore();
  }
}
/** The meteor: a big amber crystal boulder wrapped in stone. */
function paintMeteor(ctx) {
  paintRock(ctx, { seed: 404, s: 34, amber: false });
  ctx.save();
  ctx.translate(4, -6);
  paintShardCluster(ctx, { seed: 8 });
  ctx.restore();
  ctx.save();
  ctx.translate(-14, 8);
  ctx.rotate(-0.9);
  paintShard(ctx, { s: 1.3 });
  ctx.restore();
  ctx.save();
  ctx.translate(18, 10);
  ctx.rotate(1.1);
  paintShard(ctx, { s: 1.1 });
  ctx.restore();
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 34);
  g.addColorStop(0, "rgba(255,210,110,0.5)");
  g.addColorStop(1, "rgba(255,150,40,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, TAU);
  ctx.fill();
}
/** A floor crack: dark jagged-but-rounded veins with amber light in them. */
function paintCrack(ctx, k) {
  const r = rng(k.seed);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const branches = [];
  for (let i = 0; i < 7; i++) {
    let a = (i / 7) * TAU + r() * 0.5,
      x = 0,
      y = 0;
    const pts = [{ x, y }];
    const n = 4 + ((r() * 3) | 0);
    for (let j = 0; j < n; j++) {
      a += (r() - 0.5) * 0.9;
      const st = 9 + r() * 9;
      x += Math.cos(a) * st;
      y += Math.sin(a) * st * 0.62;
      pts.push({ x, y });
    }
    branches.push(pts);
  }
  const path = (pts) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  };
  for (const pts of branches) {
    ctx.strokeStyle = "rgba(30,20,12,0.85)";
    ctx.lineWidth = 5;
    path(pts);
    ctx.stroke();
  }
  if (k.hot)
    for (const pts of branches) {
      ctx.strokeStyle = "rgba(255,170,60,0.95)";
      ctx.lineWidth = 2;
      path(pts);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,246,200,0.9)";
      ctx.lineWidth = 0.8;
      path(pts);
      ctx.stroke();
    }
}
function paintDust(ctx) {
  const r = rng(31);
  for (let i = 0; i < 7; i++) {
    const x = (r() - 0.5) * 24,
      y = (r() - 0.5) * 14,
      rr = 13 + r() * 9;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, "rgba(176,156,124,0.6)");
    g.addColorStop(1, "rgba(176,156,124,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, TAU);
    ctx.fill();
  }
}
function paintTuft(ctx) {
  for (let i = 0; i < 3; i++)
    paintLobe(ctx, -5 + i * 5, (i % 2) * 2, 5.5, 0.7, {
      curls: false,
      shadow: false,
    });
}
function paintStar(ctx) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5,
      r = i % 2 ? 4.2 : 10;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(-2, -3, 1, 0, 0, 10);
  g.addColorStop(0, "#fffbe0");
  g.addColorStop(1, "#ffc93a");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "#a8620a";
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

/** Pooled sprites: several stones, chips or tufts in one image (fewer images per hit). */
function paintRocks3(ctx, k) {
  const r = rng(k.seed);
  for (const [x, y, s] of [
    [-16, 4, 10],
    [6, -6, 12],
    [18, 8, 8],
  ]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(r() * 6);
    paintRock(ctx, { seed: k.seed + x, s, amber: r() < 0.5 });
    ctx.restore();
  }
}
function paintChips(ctx) {
  const r = rng(77);
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.translate(-22 + i * 9 + (r() - 0.5) * 4, (r() - 0.5) * 18);
    paintRock(ctx, { seed: 60 + i, s: 4 + r() * 3 });
    ctx.restore();
  }
}
function paintTufts(ctx) {
  for (const [x, y] of [
    [-14, 2],
    [0, -4],
    [13, 3],
  ]) {
    ctx.save();
    ctx.translate(x, y);
    paintTuft(ctx);
    ctx.restore();
  }
}
/** A dust ring rolling out along the floor (one image instead of a ring of puffs). */
function paintDustRing(ctx) {
  const r = rng(5);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU,
      x = Math.cos(a) * 66,
      y = Math.sin(a) * 26,
      rr = 16 + r() * 8;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, "rgba(176,156,124,0.55)");
    g.addColorStop(1, "rgba(176,156,124,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, TAU);
    ctx.fill();
  }
}
/** A short row of crystal spikes for the closing ring (a few of these stand along it). */
function paintRingSpikes(ctx) {
  const r = rng(21);
  for (let i = 0; i < 6; i++) {
    const x = -90 + i * 36 + (r() - 0.5) * 8,
      L = 22 + r() * 14,
      a = -Math.PI / 2 + (r() - 0.5) * 0.5;
    crystalPoint(
      ctx,
      { x, y: 4 },
      { x: Math.cos(a), y: Math.sin(a) },
      L,
      6 + r() * 2,
      R_AMBER,
      "#6a2a06",
    );
  }
}

// ════════════════ build the atlas ════════════════
/**
 * Atlas px per rig px, by part. Fixed: it never follows devicePixelRatio.
 * The ram is drawn at 0.7 on a 1.5× camera, so at DPR 2 on a ~900 px stage
 * one rig px is ~1.2 device px: the face sits above that, the fleece about at
 * it, the dim horns, cracks and glows below it.
 */
const QUAL = {
  body: 0.9,
  legs: 1.0,
  head: 1.5,
  face: 1.8,
  mouth: 2.2,
  horn: 1.1,
  hornDim: 0.45,
  leg: 1.3,
  gem: 2,
  flap: 1.4,
  over: 0.72,
  fx: 0.8,
};
const ATLAS_BUDGET = 8 * 1024 * 1024;
const BODY_BOX = [-150, -200, 150, 40],
  REAR_BOX = [-170, -270, 170, 60];
function buildAtlas(qScale = 1) {
  ATLAS = { pages: [], pieces: {}, stats: { pieces: 0, px: 0 } };
  pageBuf = [];
  PENDING.length = 0;
  const Q = (k) => QUAL[k] * qScale;
  const LINE = "rgba(44,34,24,0.95)";
  for (let v = 0; v < 5; v++) {
    piece(`body_${v}`, BODY_BOX, Q("body"), paintBody, {
      k: { v },
      line: 2.2,
      lineColor: LINE,
    });
    piece(`bodyR_${v}`, REAR_BOX, Q("body"), paintBody, {
      k: { v, rear: 1 },
      line: 2.2,
      lineColor: LINE,
    });
    piece(`legs4_${v}`, [-140, -50, 140, 70], Q("legs"), paintLegs4, {
      k: { v },
      line: 1.6,
      lineColor: LINE,
    });
    for (const ph of [2, 3])
      piece(`over_${v}_${ph}`, BODY_BOX, Q("over"), paintOverlay, {
        k: { v, ph },
        outline: false,
      });
    piece(`head_${v}`, [-90, -95, 90, 70], Q("head"), paintHead, {
      k: { v },
      line: 1.8,
      lineColor: LINE,
    });
    for (const far of [0, 1])
      piece(`leg_${v}_${far}`, [-20, -20, 20, LEG_L + 4], Q("leg"), paintLeg, {
        k: { v, far },
        line: 1.6,
        lineColor: LINE,
      });
    for (const ph of [1, 2, 3])
      for (const part of ["back", "front"]) {
        const P = part === "back" ? "B" : "F";
        piece(
          `horns${P}_${v}_${ph}`,
          [-115, -115, 115, 95],
          Q("horn"),
          paintHornSet,
          { k: { v, ph, part }, outline: false },
        );
        piece(
          `horns${P}d_${v}_${ph}`,
          [-115, -115, 115, 95],
          Q("hornDim"),
          paintHornSet,
          { k: { v, ph, part, dim: 1 }, outline: false },
        );
      }
    if (v <= 2)
      for (const which of ["L", "R"])
        piece(`flap_${v}_${which}`, [-30, -30, 30, 30], Q("flap"), paintFlap, {
          k: { v, which },
          line: 1.6,
          lineColor: LINE,
        });
  }
  for (let v = 0; v < 3; v++) {
    for (const e of EXPRS)
      piece(`eyes_${v}_${e}`, [-60, -50, 60, 36], Q("face"), paintEyes, {
        k: { v, expr: e },
        outline: false,
      });
    for (const m of MOUTHS)
      piece(`mouth_${v}_${m}`, [-60, -10, 60, 60], Q("mouth"), paintMouth, {
        k: { v, m },
        outline: false,
      });
  }
  piece("gem_open", [-20, -20, 20, 20], Q("gem"), paintGem, {
    k: { open: 1 },
    outline: false,
  });
  const fq = Q("fx");
  piece("glow_amber", [-34, -34, 34, 34], fq, paintGlow, {
    outline: false,
    k: {
      stops: [
        [0, "rgba(255,226,140,1)"],
        [0.3, "rgba(255,160,50,0.6)"],
        [1, "rgba(255,100,20,0)"],
      ],
    },
  });
  piece("glow_hot", [-34, -34, 34, 34], fq, paintGlow, {
    outline: false,
    k: {
      stops: [
        [0, "rgba(255,255,235,1)"],
        [0.25, "rgba(255,220,120,0.75)"],
        [1, "rgba(255,140,30,0)"],
      ],
    },
  });
  for (let i = 0; i < 4; i++)
    piece(`rock_${i}`, [-18, -16, 18, 16], 1.3, paintRock, {
      k: { seed: 7 + i * 13, s: 12, amber: i % 2 === 0 },
      outline: false,
    });
  piece("star", [-12, -12, 12, 12], fq * 1.6, paintStar, { outline: false });
  finishAtlas();
  return ATLAS;
}
/** Screen offsets of attach points in each view (body-local, from the same 3D build). */
const ATT = VIEWS.map((vw) => {
  const V = makeView(vw.yaw),
    o = {};
  for (const k in HIPS) o[k] = V.P(HIPS[k]);
  o.head = V.P(HEAD_C);
  o.gem = V.P(GEM);
  o.top = V.P({ x: 0, y: BODY_C.y + BRY + 20, z: BODY_C.z });
  o.body = V.P(BODY_C);
  // the rearing pose: the head rides up with the chest (same eye-line cheat as standing)
  const hr = V.P(rotR(HEAD_C, true));
  o.headR = { x: hr.x, y: hr.y + (yS(HEAD_C.y) - o.head.y) };
  o.gemR = V.P(rotR(GEM, true));
  o.topR = V.P(rotR({ x: 0, y: BODY_C.y + BRY + 20, z: BODY_C.z }, true));
  return o;
});
const FACING = [
  { v: 0, m: false },
  { v: 1, m: false },
  { v: 2, m: false },
  { v: 3, m: false },
  { v: 4, m: false },
  { v: 3, m: true },
  { v: 2, m: true },
  { v: 1, m: true },
];
/** How much a pitch (nose up/down) shows as a screen rotation in each view (front and back show it as a lift). */
const PITCH_SCREEN = [0, 0.72, 1, 0.72, 0];
/** Fleece crystals that break out as it powers up: phase, surface direction, drawing, size. */
const CLUSTERS = [
  { ph: 2, d: [0.55, 0.75, -0.2], n: 0, s: 1 },
  { ph: 2, d: [-0.5, 0.78, -0.3], n: 1, s: 0.95 },
  { ph: 3, d: [0.1, 0.95, -0.55], n: 2, s: 1.15 },
  { ph: 3, d: [0.85, 0.35, -0.5], n: 0, s: 0.85 },
  { ph: 3, d: [-0.85, 0.4, -0.45], n: 1, s: 0.85 },
  { ph: 3, d: [0.0, 0.7, 0.55], n: 2, s: 0.8 },
];
/** Rocks lodged in the fleece (shown while the volley winds up). */
const LODGED = [
  [0.7, 0.2, 0.55, 0],
  [-0.75, 0.25, 0.5, 1],
  [0.9, -0.1, -0.3, 2],
  [-0.9, -0.05, -0.2, 3],
  [0.2, 0.6, 0.75, 1],
  [-0.3, 0.65, 0.65, 0],
];
const onBody = (d, out = 2) => {
  const n = norm3(d[0], d[1], d[2]);
  return {
    p: {
      x: BODY_C.x + n.x * (BRX + out),
      y: BODY_C.y + n.y * (BRY + out),
      z: BODY_C.z + n.z * (BRZ + out),
    },
    n: norm3(n.x / BRX, n.y / BRY, n.z / BRZ),
  };
};
const LODGEDP = VIEWS.map((vw) => {
  const V = makeView(vw.yaw);
  return LODGED.map((l) => {
    const b = onBody(l, 4);
    return { n: l[3], q: V.P(b.p), c: V.N(b.n).z };
  });
});
/** Horn coil centres (head-local screen) per view, side and phase, for the crystal glows. */
const HORNC = VIEWS.map((vw, v) => {
  const V = headView(FACE_YAW[v]);
  return [1, -1].map((sx) =>
    [0, 1, 2, 3].map((ph) => V.P(hornPt(0.55, sx, HORN_G[ph] || 1))),
  );
});
const EYEP = [0, 1, 2].map((v) => eyeLayout(v));
/** The ram is drawn at this size on the arena (rig px → arena px). */
const BOSS_SCALE = 0.68;
/** The head's anchor height on screen: the same in every view, so the eye line is level. */
const HEAD_Y = yS(HEAD_C.y);

export {
  ATT,
  BOSS_SCALE,
  CLUSTERS,
  DEG,
  EXPRS,
  EYE_LINE,
  EYEP,
  FACE_YAW,
  FACING,
  HEAD_C,
  HEAD_Y,
  HIPS,
  HORNC,
  LEG_L,
  LODGEDP,
  MOUTHS,
  PITCH_SCREEN,
  REAR_A,
  TAU,
  VIEWS,
  buildAtlas,
  eyeLayout,
  headView,
  makeView,
  mouthLayout,
  paintEyes,
  paintHead,
  paintHornSet,
  paintMouth,
  paintBody,
  paintLegs4,
  rotR,
};

/**
 * The whole ram in one picture (briefing diagrams), drawn straight from the
 * painters (no atlas): the turned front view, standing, scale k, the floor
 * under its middle at (cx, groundY); `exposed` parts the fleece over the core.
 */
export function paintCragmuffPicture(
  ctx,
  cx,
  groundY,
  k,
  exposed = false,
  phase = 1,
) {
  const v = 1,
    A = ATT[v];
  SOFT = true;
  ctx.save();
  ctx.translate(cx, groundY);
  ctx.scale(k, k);
  PQ = k;
  paintLegs4(ctx, { v });
  paintBody(ctx, { v });
  if (exposed) {
    const g = A.gem;
    ctx.save();
    ctx.translate(g.x, g.y);
    paintGem(ctx, { open: 1 });
    ctx.restore();
    for (const sg of [-1, 1]) {
      ctx.save();
      ctx.translate(g.x + sg * 24, g.y);
      paintFlap(ctx, { v, which: sg < 0 ? "L" : "R" });
      ctx.restore();
    }
  }
  ctx.save();
  ctx.translate(A.head.x, HEAD_Y);
  paintHornSet(ctx, { v, ph: phase, part: "back" });
  paintHead(ctx, { v });
  paintEyes(ctx, { v, expr: "glare" });
  paintMouth(ctx, { v, m: "pout" });
  paintHornSet(ctx, { v, ph: phase, part: "front" });
  ctx.restore();
  ctx.restore();
  SOFT = false;
  return { core: { x: cx + A.gem.x * k, y: groundY + A.gem.y * k } };
}
