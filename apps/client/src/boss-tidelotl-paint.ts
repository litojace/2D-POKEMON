/**
 * Tidelotl's painted parts (the axolotl that is Tidewyrm's look). Every
 * painter here is a pure function (ctx, k) for one part in one view; the
 * rig (boss-tidelotl-rig.ts) runs them once into an atlas when the battle
 * loads, so a frame only places images.
 *
 * The build is deliberately simple: a big nearly round head, a soft egg of
 * a body, four stubby legs, a flat fin-edged tail and three frilly gill
 * fronds a side. Views differ by where the face sits, how the gills fan, the
 * legs and the tail, never by the head's outline. Eyes are drawn per view
 * (the far eye narrower and tucked behind the head's curve, never scaled);
 * the mouth is laid on the head's surface so it slips behind the curve by
 * itself.
 */

export type Ctx = CanvasRenderingContext2D;
export interface V3 {
  x: number;
  y: number;
  z: number;
}
export interface Pt {
  x: number;
  y: number;
}
type Ramp = [number, string][];
type RGB = [number, number, number];

// ── maths and the painting view (never used per frame) ──
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const ease = (t: number) => t * t * (3 - 2 * t);
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const norm3 = (x: number, y: number, z: number): V3 => {
  const l = Math.hypot(x, y, z) || 1;
  return { x: x / l, y: y / l, z: z / l };
};
const dot3 = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm2 = (x: number, y: number): Pt => {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
};
const qbez = (a: Pt, b: Pt, c: Pt, t: number): Pt => ({
  x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * b.x + t * t * c.x,
  y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * b.y + t * t * c.y,
});
const qbez3 = (a: V3, b: V3, c: V3, t: number): V3 => ({
  x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * b.x + t * t * c.x,
  y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * b.y + t * t * c.y,
  z: (1 - t) * (1 - t) * a.z + 2 * (1 - t) * t * b.z + t * t * c.z,
});
const PITCH = 14 * DEG,
  CP = Math.cos(PITCH),
  SP = Math.sin(PITCH);
const LIGHT = norm3(-0.58, 0.62, 0.52);
/** The five drawn views; the other three facings are mirrors. */
export const VIEW_YAW = [0, 45 * DEG, 90 * DEG, 135 * DEG, 180 * DEG];
export interface View {
  yaw: number;
  /** Screen point (y down) with depth z (bigger = nearer). */
  P: (p: V3) => V3;
  /** A local direction in camera space. */
  N: (d: V3) => V3;
}
export function makeView(yaw: number): View {
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  const cam = (x: number, y: number, z: number): V3 => {
    const X = x * c + z * s,
      Z = -x * s + z * c;
    return { x: X, y: y * CP - Z * SP, z: Z * CP + y * SP };
  };
  return {
    yaw,
    P: (p) => {
      const r = cam(p.x, p.y, p.z);
      return { x: r.x, y: -r.y, z: r.z };
    },
    N: (d) => cam(d.x, d.y, d.z),
  };
}
void LIGHT;

// ── colour ──
const HEX: Record<string, RGB> = {};
const hex = (h: string): RGB =>
  HEX[h] ||
  (HEX[h] = [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ]);
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const rgba = (c: RGB, a = 1) =>
  `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
function ramp(R: Ramp, t: number): RGB {
  t = clamp(t);
  for (let i = 1; i < R.length; i++)
    if (t <= R[i][0]) {
      const a = R[i - 1],
        b = R[i];
      return mix(hex(a[1]), hex(b[1]), (t - a[0]) / (b[0] - a[0] || 1));
    }
  return hex(R[R.length - 1][1]);
}
const R_BELLY: Ramp = [
  [0, "#9fbcc8"],
  [0.3, "#cfdde6"],
  [0.6, "#efe9f1"],
  [0.85, "#fdf6f4"],
  [1, "#fffdf8"],
];
const R_GILL: Ramp = [
  [0, "#a3245a"],
  [0.25, "#e0457f"],
  [0.5, "#ff74a6"],
  [0.75, "#ffa3c4"],
  [0.9, "#ffcfe0"],
  [1, "#fff2f7"],
];
const R_GILL_LIT: Ramp = [
  [0, "#c21c62"],
  [0.25, "#ff3d8c"],
  [0.5, "#ff6fae"],
  [0.72, "#ffb0d6"],
  [0.88, "#ffe2f0"],
  [1, "#ffffff"],
];
/** The skin deepens each phase, as Tidewyrm's did: teal, deeper teal, ocean blue-teal. */
export const PHASE_SKIN: Record<number, Ramp> = {
  1: [
    [0, "#0d5560"],
    [0.2, "#16808a"],
    [0.42, "#26a9ab"],
    [0.62, "#45c8c2"],
    [0.8, "#7fe2d8"],
    [0.92, "#b5f3ea"],
    [1, "#e4fffa"],
  ],
  2: [
    [0, "#032a38"],
    [0.2, "#064858"],
    [0.42, "#0c6676"],
    [0.62, "#158592"],
    [0.8, "#34abb0"],
    [0.92, "#72d0cf"],
    [1, "#c0f4ef"],
  ],
  3: [
    [0, "#04183a"],
    [0.2, "#082f5c"],
    [0.42, "#0f4a80"],
    [0.62, "#1b6aa0"],
    [0.8, "#3791c2"],
    [0.92, "#76c0e2"],
    [1, "#c2eaff"],
  ],
};
/** Markings per phase: dark specks, pale specks and (phase 3) glowing spots. */
const PHASE_SPOTS: Record<
  number,
  { dark: string; pale: string; darkShare: number; glow: boolean }
> = {
  1: {
    dark: "rgba(8,92,104,0.42)",
    pale: "rgba(214,255,248,0.5)",
    darkShare: 0.72,
    glow: false,
  },
  2: {
    dark: "rgba(4,60,76,0.45)",
    pale: "rgba(190,255,250,0.85)",
    darkShare: 0.5,
    glow: false,
  },
  3: {
    dark: "rgba(2,26,60,0.4)",
    pale: "rgba(150,250,255,0.95)",
    darkShare: 0.38,
    glow: true,
  },
};
/** The phase being painted (set by the atlas builder around skin pieces). */
let phaseNow = 1;
let skin: Ramp = PHASE_SKIN[1];
export function paintingPhase(phase: number) {
  phaseNow = phase;
  skin = PHASE_SKIN[phase] ?? PHASE_SKIN[1];
}
/** Atlas px per rig px of the piece being painted (blur radii are in canvas px). */
let PQ = 1;
export function paintingDensity(q: number) {
  PQ = q;
}

// ── painted marks ──
function leafPath(
  x: number,
  y: number,
  tx: number,
  ty: number,
  w: number,
  bend = 0,
) {
  const dx = tx - x,
    dy = ty - y,
    L = Math.hypot(dx, dy) || 1e-3;
  const ux = dx / L,
    uy = dy / L,
    nx = -uy,
    ny = ux;
  const pt = (a: number, b: number): [number, number] => [
    x + ux * a * L + nx * (b + bend * Math.sin(a * Math.PI) * L),
    y + uy * a * L + ny * (b + bend * Math.sin(a * Math.PI) * L),
  ];
  const p = new Path2D();
  const M = (q: [number, number]) => p.moveTo(q[0], q[1]);
  const B = (a: [number, number], b: [number, number], c: [number, number]) =>
    p.bezierCurveTo(a[0], a[1], b[0], b[1], c[0], c[1]);
  M(pt(0, -w * 0.55));
  B(pt(0.35, -w * 1.05), pt(0.92, -w * 1.0), pt(1, 0));
  B(pt(0.92, w * 1.0), pt(0.35, w * 1.05), pt(0, w * 0.55));
  p.closePath();
  return p;
}
/** Blur a few strokes while painting (radius in rig px). */
let hasFilter: boolean | undefined;
function soft(ctx: Ctx, px: number, fn: () => void) {
  if (hasFilter === undefined) {
    try {
      ctx.save();
      ctx.filter = "blur(2px)";
      hasFilter = ctx.filter === "blur(2px)";
      ctx.restore();
    } catch {
      hasFilter = false;
    }
  }
  ctx.save();
  if (hasFilter) ctx.filter = `blur(${(px * PQ).toFixed(2)}px)`;
  fn();
  ctx.restore();
}

// ── the build (rig px, local axes: x = the boss's left, y up, z forward) ──
export const BODY = { rx: 60, ry: 46, rz: 72 };
export const HEAD = { rx: 92, ry: 78, rz: 76 };
type Ell = typeof BODY;
export const ATTACH: Record<string, V3> = {
  body: { x: 0, y: 0, z: 0 },
  head: { x: 0, y: 42, z: 48 },
  legFL: { x: 44, y: -22, z: 34 },
  legFR: { x: -44, y: -22, z: 34 },
  legBL: { x: 40, y: -20, z: -40 },
  legBR: { x: -40, y: -20, z: -40 },
  tail: { x: 0, y: 4, z: -62 },
};
/** The head turns a little slower than the body (anime ¾ rule): its painted yaw per view. */
export const HEAD_YAW = [0, 38 * DEG, 84 * DEG, 136 * DEG, 180 * DEG];
export const EXPRS = [
  "idle",
  "smug",
  "glare",
  "wide",
  "sad",
  "hurt",
  "dizzy",
  "closed",
] as const;
export type Expr = (typeof EXPRS)[number];
export const MOUTHS = [
  "smile",
  "smirk",
  "grin",
  "o",
  "open",
  "frown",
  "wavy",
] as const;
export type Mouth = (typeof MOUTHS)[number];
export const PEARL_DIR = norm3(0, 0.6, 0.8);
const GILLS = [
  {
    root: norm3(0.8, 0.46, -0.36),
    dir: norm3(0.5, 0.84, -0.22),
    len: 56,
    w: 10.5,
  },
  {
    root: norm3(0.9, 0.08, -0.4),
    dir: norm3(0.95, 0.24, -0.2),
    len: 64,
    w: 11.5,
  },
  {
    root: norm3(0.84, -0.3, -0.42),
    dir: norm3(0.82, -0.5, -0.26),
    len: 50,
    w: 10,
  },
];

function fibo(n: number, seed: number) {
  const r = rng(seed),
    out: (V3 & { r: number })[] = [],
    ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n,
      rad = Math.sqrt(1 - y * y),
      th = ga * i + (r() - 0.5) * 0.5;
    out.push({ x: Math.cos(th) * rad, y, z: Math.sin(th) * rad, r: r() });
  }
  return out;
}
const angBetween = (a: V3, b: V3) => Math.acos(clamp(dot3(a, b), -1, 1));
const onEll = (d: V3, s: Ell): V3 => ({
  x: d.x * s.rx,
  y: d.y * s.ry,
  z: d.z * s.rz,
});
const ellNormal = (p: V3, s: Ell) =>
  norm3(p.x / (s.rx * s.rx), p.y / (s.ry * s.ry), p.z / (s.rz * s.rz));
interface E2 {
  cx: number;
  cy: number;
  hx: number;
  hy: number;
}
function projEllipse(V: View, s: Ell): E2 {
  let minX = 1e9,
    maxX = -1e9,
    minY = 1e9,
    maxY = -1e9;
  for (const d of fibo(500, 3)) {
    const q = V.P(onEll(d, s));
    minX = Math.min(minX, q.x);
    maxX = Math.max(maxX, q.x);
    minY = Math.min(minY, q.y);
    maxY = Math.max(maxY, q.y);
  }
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    hx: (maxX - minX) / 2,
    hy: (maxY - minY) / 2,
  };
}
const ellPath = (E: E2, k = 1) => {
  const p = new Path2D();
  p.ellipse(E.cx, E.cy, E.hx * k, E.hy * k, 0, 0, TAU);
  return p;
};
function spotAt(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rot: number,
  dark: boolean,
) {
  const S = PHASE_SPOTS[phaseNow];
  if (!dark && S.glow)
    soft(ctx, 2.2, () => {
      ctx.fillStyle = "rgba(90,240,255,0.7)";
      ctx.beginPath();
      ctx.ellipse(x, y, rx * 2, ry * 2, rot, 0, TAU);
      ctx.fill();
    });
  ctx.fillStyle = dark ? S.dark : S.pale;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fill();
}
/** A cool water-bounce rim inside the outline, strongest lower right (its own small canvas). */
function rimLight(ctx: Ctx, E: E2, a0: number) {
  if (a0 <= 0) return;
  const { cx, cy, hx, hy } = E;
  const m = ctx.getTransform(),
    c = document.createElement("canvas");
  c.width = ctx.canvas.width;
  c.height = ctx.canvas.height;
  const g = c.getContext("2d");
  if (!g) return;
  g.setTransform(m);
  g.translate(cx, cy);
  g.scale(1, hy / hx);
  const rg = g.createRadialGradient(
    -hx * 0.06,
    -hx * 0.08,
    hx * 0.8,
    -hx * 0.06,
    -hx * 0.08,
    hx * 1.1,
  );
  rg.addColorStop(0, "rgba(190,255,250,0)");
  rg.addColorStop(0.65, `rgba(190,255,250,${a0 * 0.6})`);
  rg.addColorStop(1, `rgba(190,255,250,${a0})`);
  g.fillStyle = rg;
  g.fillRect(-hx * 2, -hx * 2, hx * 4, hx * 4);
  g.setTransform(m);
  g.globalCompositeOperation = "destination-in";
  const lg = g.createLinearGradient(
    cx - hx * 0.2,
    cy - hy * 0.2,
    cx + hx * 0.75,
    cy + hy * 0.85,
  );
  lg.addColorStop(0, "rgba(0,0,0,0)");
  lg.addColorStop(1, "rgba(0,0,0,1)");
  g.fillStyle = lg;
  g.fillRect(cx - hx * 2, cy - hy * 2, hx * 4, hy * 4);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(c, 0, 0);
  ctx.restore();
  c.width = c.height = 0;
}
interface BallOpts {
  seed: number;
  freckles: number;
  cap: { dir: V3; ang: number } | null;
  freckleAt: (d: V3) => boolean;
  ao: { x: number; y: number; r: number; a: number }[];
  gloss?: number;
  rim?: number;
  extra?: (E: E2) => void;
}
/**
 * A smooth, wet, round form, poster style: an airbrushed gradient, a soft
 * pearly cap, freckles placed on the 3D surface (so they turn with the
 * view), key light, occlusion, a cool rim from the water, gloss and glints.
 */
function paintSkinBall(ctx: Ctx, V: View, s: Ell, o: BallOpts) {
  const E = projEllipse(V, s);
  const { cx, cy, hx, hy } = E;
  const body = ellPath(E);
  const g = ctx.createRadialGradient(
    cx - hx * 0.34,
    cy - hy * 0.44,
    hx * 0.04,
    cx + hx * 0.04,
    cy + hy * 0.06,
    hx * 1.1,
  );
  g.addColorStop(0, rgba(ramp(skin, 0.95)));
  g.addColorStop(0.32, rgba(ramp(skin, 0.8)));
  g.addColorStop(0.68, rgba(ramp(skin, 0.6)));
  g.addColorStop(1, rgba(ramp(skin, 0.42)));
  ctx.fillStyle = g;
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  if (o.cap) {
    // the cap as a union of small discs at the visible surface points inside it
    const cap = new Path2D();
    let any = 0;
    for (const d of fibo(1400, 9)) {
      if (angBetween(d, o.cap.dir) > o.cap.ang * DEG) continue;
      const pt = onEll(d, s),
        n = V.N(ellNormal(pt, s));
      if (n.z < 0.02) continue;
      const q = V.P(pt);
      cap.moveTo(q.x + 7, q.y);
      cap.arc(q.x, q.y, 7, 0, TAU);
      any++;
    }
    if (any > 3) {
      const cp = V.P(onEll(o.cap.dir, s));
      const cg = ctx.createRadialGradient(
        cp.x - hx * 0.2,
        cp.y - hy * 0.3,
        2,
        cp.x,
        cp.y,
        hx * 0.95,
      );
      cg.addColorStop(0, rgba(ramp(R_BELLY, 1)));
      cg.addColorStop(0.5, rgba(ramp(R_BELLY, 0.86)));
      cg.addColorStop(1, rgba(ramp(R_BELLY, 0.55)));
      soft(ctx, 2.6, () => {
        ctx.fillStyle = cg;
        ctx.fill(cap);
      });
    }
  }
  const rr = rng(o.seed);
  for (const d of fibo(o.freckles, o.seed + 4)) {
    if (!o.freckleAt(d)) continue;
    const pt = onEll(d, s),
      n = V.N(ellNormal(pt, s));
    if (n.z < 0.22) continue;
    const q = V.P(pt),
      dark = rr() < PHASE_SPOTS[phaseNow].darkShare,
      sz = (dark ? 2.5 : 2) + rr() * 2;
    spotAt(
      ctx,
      q.x,
      q.y,
      sz * (0.45 + 0.55 * n.z),
      sz * (0.55 + (0.45 * Math.abs(n.y + n.z)) / 1.4),
      Math.atan2(n.y, n.x) + Math.PI / 2,
      dark,
    );
  }
  o.extra?.(E);
  ctx.globalCompositeOperation = "source-atop";
  const sh = ctx.createRadialGradient(
    cx - hx * 0.42,
    cy - hy * 0.52,
    0,
    cx - hx * 0.05,
    cy - hy * 0.05,
    hx * 1.55,
  );
  sh.addColorStop(0, "rgba(235,255,250,0.2)");
  sh.addColorStop(0.36, "rgba(235,255,250,0)");
  sh.addColorStop(0.72, "rgba(4,46,60,0.16)");
  sh.addColorStop(1, "rgba(2,34,48,0.5)");
  ctx.fillStyle = sh;
  ctx.fillRect(cx - hx * 2, cy - hy * 2, hx * 4, hy * 4);
  for (const ao of o.ao) {
    const a = ctx.createRadialGradient(ao.x, ao.y, 0, ao.x, ao.y, ao.r);
    a.addColorStop(0, `rgba(3,40,54,${ao.a})`);
    a.addColorStop(1, "rgba(3,40,54,0)");
    ctx.fillStyle = a;
    ctx.fillRect(ao.x - ao.r, ao.y - ao.r, ao.r * 2, ao.r * 2);
  }
  ctx.globalCompositeOperation = "source-over";
  rimLight(ctx, E, 0.55 * (o.rim ?? 1));
  const gl = o.gloss ?? 1;
  if (gl > 0) {
    soft(ctx, 5, () => {
      ctx.fillStyle = `rgba(255,255,255,${0.3 * gl})`;
      ctx.beginPath();
      ctx.ellipse(
        cx - hx * 0.38,
        cy - hy * 0.5,
        hx * 0.36,
        hy * 0.2,
        -0.45,
        0,
        TAU,
      );
      ctx.fill();
    });
    soft(ctx, 0.7, () => {
      ctx.strokeStyle = `rgba(255,255,255,${0.7 * gl})`;
      ctx.lineWidth = Math.max(1.6, hx * 0.028);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.ellipse(
        cx,
        cy,
        hx * 0.9,
        hy * 0.9,
        0,
        Math.PI * 1.08,
        Math.PI * 1.36,
      );
      ctx.stroke();
    });
    ctx.fillStyle = `rgba(255,255,255,${0.92 * gl})`;
    ctx.beginPath();
    ctx.ellipse(
      cx - hx * 0.5,
      cy - hy * 0.36,
      hx * 0.05,
      hy * 0.035,
      -0.6,
      0,
      TAU,
    );
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - hx * 0.38, cy - hy * 0.6, hx * 0.022, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  return E;
}
/** The dorsal crest seen from behind: a raised painted strip along the spine. */
function paintCrestStrip(ctx: Ctx, pts: Pt[], w0: number, w1: number) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const pass = (k: number, col: (t: number) => string, add = 0) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const t = i / (pts.length - 1);
      ctx.strokeStyle = col(t);
      ctx.lineWidth = lerp(w0, w1, t) * k + add;
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
      ctx.stroke();
    }
  };
  pass(1, () => rgba(ramp(skin, 0.22), 0.55), 3);
  pass(1, () => rgba(mix(ramp(skin, 0.55), [255, 150, 195], 0.45)));
  pass(0.42, () => "rgba(255,196,222,0.95)");
  ctx.restore();
}

// ════════════════ head ════════════════
const CHIN = norm3(0, -0.72, 0.7);
export const HEAD_E = HEAD_YAW.map((y) => projEllipse(makeView(y), HEAD));
const faceZone = (d: V3) => d.z > 0.45 && d.y < 0.42;
export function paintHead(ctx: Ctx, k: { v: number }) {
  const V = makeView(HEAD_YAW[k.v]);
  paintSkinBall(ctx, V, HEAD, {
    seed: 21,
    freckles: 110,
    cap: { dir: CHIN, ang: 46 },
    freckleAt: (d) =>
      !faceZone(d) &&
      d.y > -0.15 &&
      !(Math.abs(d.x) > 0.6 && d.z < 0 && d.y < 0.5),
    ao:
      k.v >= 3
        ? [
            { x: 0, y: HEAD.ry * 0.98, r: 34, a: 0.28 },
            { x: 0, y: HEAD.ry * 0.75, r: 70, a: 0.42 },
          ]
        : [{ x: 0, y: HEAD.ry * 0.98, r: 34, a: 0.28 }],
    extra: () => {
      if (k.v >= 3) {
        // the crest starts at the nape
        const pts: Pt[] = [];
        for (let i = 0; i <= 16; i++) {
          const a = lerp(0.35, 1.25, i / 16),
            d = norm3(0, Math.cos(a) * 0.7 + 0.1, -Math.sin(a)),
            p2 = onEll(d, HEAD);
          if (V.N(ellNormal(p2, HEAD)).z > 0.05) pts.push(V.P(p2));
        }
        paintCrestStrip(ctx, pts, 3, 9);
      }
      for (const sx of [-1, 1]) {
        const d = norm3(sx * 0.62, -0.2, 0.76),
          pt = onEll(d, HEAD),
          n = V.N(ellNormal(pt, HEAD));
        if (n.z > 0.12) {
          const q = V.P(pt),
            w = 15 * (0.35 + 0.65 * n.z);
          const bg = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, w);
          bg.addColorStop(0, "rgba(255,120,170,0.55)");
          bg.addColorStop(0.6, "rgba(255,130,175,0.25)");
          bg.addColorStop(1, "rgba(255,130,175,0)");
          ctx.fillStyle = bg;
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, w, 9, 0, 0, TAU);
          ctx.fill();
          ctx.strokeStyle = `rgba(232,80,130,${0.35 * n.z})`;
          ctx.lineWidth = 1.3;
          ctx.lineCap = "round";
          for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(q.x + i * w * 0.32 - 1.5, q.y + 2.5);
            ctx.lineTo(q.x + i * w * 0.32 + 1.5, q.y - 2.5);
            ctx.stroke();
          }
        }
        const dn = norm3(sx * 0.13, -0.08, 0.99),
          pn = onEll(dn, HEAD),
          nn = V.N(ellNormal(pn, HEAD));
        if (nn.z > 0.3) {
          const q = V.P(pn);
          ctx.fillStyle = "rgba(8,70,80,0.5)";
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, 1.6 * nn.z + 0.4, 1.3, 0, 0, TAU);
          ctx.fill();
        }
      }
    },
  });
}

// ── eyes: hand-placed per view, drawn per view, never scaled ──
export interface EyeSpot {
  id: "n" | "f";
  x: number;
  y: number;
  hw: number;
  hh: number;
  s: number;
  clip?: boolean;
  peek?: boolean;
}
export const EYES: EyeSpot[][] = [
  [{ id: "n", x: 39, y: 8, hw: 16.5, hh: 20.5, s: -1 }],
  [
    { id: "n", x: 9, y: 8, hw: 16.5, hh: 20.5, s: 1 },
    { id: "f", x: 69, y: 7, hw: 10, hh: 19.5, s: -1, clip: true },
  ],
  [{ id: "n", x: 52, y: 7, hw: 12.5, hh: 20, s: 1 }],
  [{ id: "n", x: 83, y: 6, hw: 4.5, hh: 15, s: 1, peek: true }],
  [],
];
interface Look {
  lid: number;
  tilt: number;
  brow: number;
  browY: number;
  pupil: number;
  gx: number;
  gy?: number;
  gold?: boolean;
  big?: number;
  tear?: boolean;
}
const LOOK: Record<string, Look> = {
  idle: { lid: 0.06, tilt: 0.02, brow: 0.12, browY: 0, pupil: 0.56, gx: 0.06 },
  smug: {
    lid: 0.46,
    tilt: -0.08,
    brow: -0.22,
    browY: -0.2,
    pupil: 0.58,
    gx: 0.3,
  },
  glare: {
    lid: 0.3,
    tilt: 0.42,
    brow: 0.62,
    browY: 0.15,
    pupil: 0.42,
    gx: 0.1,
    gold: true,
  },
  wide: {
    lid: 0,
    tilt: 0,
    brow: -0.3,
    browY: -0.35,
    pupil: 0.38,
    gx: 0,
    big: 1.07,
  },
  sad: {
    lid: 0.22,
    tilt: -0.34,
    brow: -0.6,
    browY: -0.1,
    pupil: 0.6,
    gx: 0,
    gy: 0.18,
    tear: true,
  },
};
function eyeShape(e: EyeSpot, L: Look) {
  const hh = e.hh * (L.big || 1),
    hw = e.hw * (L.big || 1);
  const lidY = (x: number) =>
    e.y - hh + hh * 2 * L.lid + (L.tilt * hh * ((x - e.x) * e.s)) / hw;
  const p = new Path2D(),
    pts: Pt[] = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * TAU,
      x = e.x + Math.cos(a) * hw,
      y0 = e.y + Math.sin(a) * hh;
    pts.push({ x, y: Math.max(y0, lidY(x)) });
  }
  pts.forEach((q, i) => (i ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y)));
  p.closePath();
  return { p, pts, hw, hh, lidY };
}
export function paintEye(
  ctx: Ctx,
  k: { v: number; id: "n" | "f"; expr: string },
) {
  const e = EYES[k.v].find((q) => q.id === k.id);
  if (!e) return;
  const expr = k.expr;
  ctx.save();
  if (e.clip) ctx.clip(ellPath(HEAD_E[k.v], 0.995));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const brow = (ang: number, dy: number) => {
    const by = e.y - e.hh * 1.42 + dy * e.hh,
      bx = e.x + e.s * e.hw * 0.05;
    const hl = e.hw * 0.95 * 0.62;
    ctx.strokeStyle = "rgba(9,78,90,0.85)";
    ctx.lineWidth = e.hh * 0.17;
    ctx.beginPath();
    ctx.moveTo(bx - e.s * hl, by - Math.sin(-ang) * hl * 0.5);
    ctx.quadraticCurveTo(
      bx,
      by - e.hh * 0.08,
      bx + e.s * hl,
      by + Math.sin(-ang) * hl * 0.5 * -1 + ang * e.hh * 0.32,
    );
    ctx.stroke();
  };
  if (e.peek) {
    if (expr !== "hurt" && expr !== "closed" && expr !== "dizzy") {
      ctx.fillStyle = "#0e2c3e";
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, e.hw, e.hh * 0.9, 0, -Math.PI / 2, Math.PI / 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.ellipse(e.x + 1.2, e.y - e.hh * 0.35, 1.5, 2.6, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "#0a3a46";
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(e.x - 1, e.y - e.hh * 0.85);
      ctx.quadraticCurveTo(
        e.x + e.hw + 2,
        e.y - e.hh * 0.9,
        e.x + e.hw + 4,
        e.y - e.hh * 1.15,
      );
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  if (expr === "hurt") {
    brow(-0.5, -0.05);
    ctx.strokeStyle = "#0b2f40";
    ctx.lineWidth = e.hh * 0.24;
    const w = e.hw * 0.85;
    ctx.beginPath();
    ctx.moveTo(e.x - e.s * w, e.y - e.hh * 0.5);
    ctx.lineTo(e.x + e.s * w * 0.6, e.y);
    ctx.lineTo(e.x - e.s * w, e.y + e.hh * 0.5);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (expr === "closed") {
    brow(0.05, 0.05);
    ctx.strokeStyle = "#0b3442";
    ctx.lineWidth = e.hh * 0.2;
    ctx.beginPath();
    ctx.moveTo(e.x - e.hw * 0.95, e.y + e.hh * 0.05);
    ctx.quadraticCurveTo(
      e.x,
      e.y + e.hh * 0.62,
      e.x + e.hw * 0.95,
      e.y + e.hh * 0.05,
    );
    ctx.stroke();
    ctx.lineWidth = e.hh * 0.12;
    ctx.beginPath();
    ctx.moveTo(e.x - e.s * e.hw * 0.95, e.y + e.hh * 0.05);
    ctx.lineTo(e.x - e.s * e.hw * 1.3, e.y - e.hh * 0.18);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (expr === "dizzy") {
    brow(-0.3, -0.15);
    const { p } = eyeShape(e, LOOK.idle);
    ctx.fillStyle = "#f2fffd";
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    ctx.strokeStyle = "#174a5c";
    ctx.lineWidth = e.hh * 0.13;
    ctx.beginPath();
    const m = Math.min(e.hw, e.hh);
    for (let a = 0; a < TAU * 2.4; a += 0.18) {
      const r = (a / (TAU * 2.4)) * m * 0.95;
      const px = e.x + Math.cos(a * e.s) * r * (e.hw / m) * 0.9,
        py = e.y + Math.sin(a * e.s) * r * (e.hh / m) * 0.9;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = "#0a3a46";
    ctx.lineWidth = e.hh * 0.12;
    ctx.stroke(p);
    ctx.restore();
    return;
  }
  const L = LOOK[expr] || LOOK.idle;
  const { p, pts, hw, hh, lidY } = eyeShape(e, L);
  soft(ctx, 1.4, () => {
    ctx.fillStyle = "rgba(6,60,72,0.35)";
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + 1.2, hw + 2.2, hh + 2.2, 0, 0, TAU);
    ctx.fill();
  });
  ctx.save();
  ctx.clip(p);
  const ig = ctx.createLinearGradient(0, e.y - hh, 0, e.y + hh);
  ig.addColorStop(0, "#081a2a");
  ig.addColorStop(0.45, "#0f3a52");
  ig.addColorStop(0.8, "#1c7590");
  ig.addColorStop(1, "#46c2c6");
  ctx.fillStyle = ig;
  ctx.fillRect(e.x - hw * 1.5, e.y - hh * 1.5, hw * 3, hh * 3);
  const gx = e.x + e.s * hw * L.gx * (e.id === "f" ? 0.4 : 1),
    gy = e.y + hh * (0.08 + (L.gy || 0));
  if (L.gold) {
    const gg = ctx.createRadialGradient(gx, gy, hw * 0.2, gx, gy, hw * 0.95);
    gg.addColorStop(0, "rgba(255,214,90,0)");
    gg.addColorStop(0.45, "rgba(255,206,80,0.95)");
    gg.addColorStop(0.75, "rgba(220,140,30,0.6)");
    gg.addColorStop(1, "rgba(120,70,10,0)");
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.ellipse(gx, gy, hw, hh * 0.92, 0, 0, TAU);
    ctx.fill();
  } else {
    const rg = ctx.createRadialGradient(
      gx,
      gy + hh * 0.5,
      0,
      gx,
      gy + hh * 0.5,
      hh * 0.9,
    );
    rg.addColorStop(0, "rgba(130,250,235,0.75)");
    rg.addColorStop(1, "rgba(130,250,235,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(e.x - hw * 1.5, e.y - hh * 1.5, hw * 3, hh * 3);
  }
  ctx.fillStyle = "#030c15";
  ctx.beginPath();
  ctx.ellipse(
    gx,
    gy,
    hw * L.pupil * (L.gold ? 0.7 : 1),
    hh * L.pupil * 0.95,
    0,
    0,
    TAU,
  );
  ctx.fill();
  const ly = lidY(e.x);
  const lg = ctx.createLinearGradient(0, ly, 0, ly + hh * 0.7);
  lg.addColorStop(0, "rgba(2,14,24,0.65)");
  lg.addColorStop(1, "rgba(2,14,24,0)");
  ctx.fillStyle = lg;
  ctx.fillRect(e.x - hw * 1.5, ly - 2, hw * 3, hh * 1.2);
  ctx.fillStyle = "rgba(255,255,255,0.97)";
  ctx.beginPath();
  ctx.ellipse(
    gx - hw * 0.34,
    Math.max(gy - hh * 0.36, ly + hh * 0.24),
    hw * 0.36,
    hh * 0.27,
    -0.45,
    0,
    TAU,
  );
  ctx.fill();
  ctx.beginPath();
  ctx.arc(gx + hw * 0.36, gy + hh * 0.36, hw * 0.13, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(200,255,250,0.55)";
  ctx.lineWidth = hh * 0.07;
  ctx.beginPath();
  ctx.ellipse(gx, gy, hw * 0.7, hh * 0.72, 0, Math.PI * 0.2, Math.PI * 0.62);
  ctx.stroke();
  if (L.big) {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(gx - hw * 0.05, gy + hh * 0.05, hw * 0.08, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = "#0a3846";
  ctx.lineWidth = hh * 0.15;
  ctx.beginPath();
  const tp = pts.slice(24).concat(pts.slice(0, 1));
  tp.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.stroke();
  const ox = e.x - e.s * hw,
    oy = Math.max(e.y - hh * 0.05, lidY(ox));
  ctx.lineWidth = hh * 0.11;
  ctx.beginPath();
  ctx.moveTo(ox + e.s * hw * 0.15, oy - 1);
  ctx.quadraticCurveTo(
    ox - e.s * hw * 0.25,
    oy - hh * 0.12,
    ox - e.s * hw * 0.42,
    oy - hh * 0.32,
  );
  ctx.stroke();
  ctx.strokeStyle = "rgba(10,70,86,0.4)";
  ctx.lineWidth = hh * 0.07;
  ctx.beginPath();
  ctx.ellipse(
    e.x,
    e.y,
    hw * 0.96,
    hh * 0.97,
    0,
    Math.PI * 0.18,
    Math.PI * 0.82,
  );
  ctx.stroke();
  if (L.tear) {
    const tx = e.x - e.s * hw * 0.55,
      ty = e.y + hh * 0.95;
    ctx.fillStyle = "rgba(190,245,255,0.9)";
    ctx.beginPath();
    ctx.moveTo(tx, ty - 5);
    ctx.quadraticCurveTo(tx + 4.5, ty + 3, tx, ty + 6);
    ctx.quadraticCurveTo(tx - 4.5, ty + 3, tx, ty - 5);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(tx - 1.2, ty + 1.5, 1.1, 0, TAU);
    ctx.fill();
  }
  brow(L.brow, L.browY);
  ctx.restore();
}

// ── the mouth: curves laid on the head's surface ──
interface MouthSpec {
  half?: number;
  top?: (u: number) => number;
  bot?: (u: number) => number;
  ring?: boolean;
  c?: number;
  rx?: number;
  ry?: number;
  tongue?: number;
  dimple?: number;
}
function mouthSpec(type: string): MouthSpec {
  switch (type) {
    case "smirk":
      return {
        half: 0.86,
        top: (u) => -0.31 + 0.04 * u * u + 0.07 * Math.max(0, u) * u,
        dimple: 0.6,
      };
    case "grin":
      return {
        half: 0.78,
        top: (u) => -0.3 + 0.06 * u * u,
        bot: (u) => -0.3 - 0.2 * Math.pow(1 - u * u, 0.75) + 0.06 * u * u,
        tongue: 0.7,
      };
    case "o":
      return { ring: true, c: -0.36, rx: 0.11, ry: 0.11, tongue: 0.4 };
    case "open":
      return { ring: true, c: -0.38, rx: 0.21, ry: 0.19, tongue: 0.8 };
    case "frown":
      return {
        half: 0.5,
        top: (u) => -0.37 + 0.06 * (1 - u * u) + Math.sin(u * 9) * 0.006,
      };
    case "wavy":
      return { half: 0.56, top: (u) => -0.35 + 0.018 * Math.sin(u * 11) };
  }
  return { half: 0.92, top: (u) => -0.31 + 0.075 * u * u, dimple: 1 };
}
function mouthInside(ctx: Ctx, p: Path2D, lower: Pt[], tongue: number) {
  ctx.save();
  ctx.clip(p);
  let maxY = -1e9,
    sx = 0;
  for (const q of lower) {
    maxY = Math.max(maxY, q.y);
    sx += q.x;
  }
  const mx = sx / lower.length;
  ctx.fillStyle = "#3d0d24";
  ctx.fill(p);
  const tg = ctx.createRadialGradient(mx - 3, maxY - 2, 1, mx, maxY + 4, 22);
  tg.addColorStop(0, "#ffb3cb");
  tg.addColorStop(0.6, "#f2638f");
  tg.addColorStop(1, "#a62452");
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.ellipse(mx, maxY + 3, 24 * tongue, 12 * tongue + 3, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}
export function paintMouth(ctx: Ctx, k: { v: number; mouth: string }) {
  const V = makeView(HEAD_YAW[k.v]),
    M = mouthSpec(k.mouth);
  type Q = V3 & { vis: number };
  const at = (u: number, y: number): Q => {
    const a = u * (M.half || 1);
    const pt = onEll(norm3(Math.sin(a), y, Math.cos(a)), HEAD);
    return { ...V.P(pt), vis: V.N(ellNormal(pt, HEAD)).z };
  };
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.save();
  ctx.clip(ellPath(HEAD_E[k.v], 0.99));
  const LINE = "#0a3442";
  if (M.ring) {
    const pts: Q[] = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * TAU;
      const pt = onEll(
        norm3(Math.sin(a) * M.rx!, M.c! + Math.cos(a) * M.ry!, 1),
        HEAD,
      );
      pts.push({ ...V.P(pt), vis: V.N(ellNormal(pt, HEAD)).z });
    }
    if (pts.some((q) => q.vis >= 0.05)) {
      const p = new Path2D();
      pts.forEach((q, i) => (i ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y)));
      p.closePath();
      mouthInside(ctx, p, pts, M.tongue ?? 0.6);
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 2.6;
      ctx.stroke(p);
    }
    ctx.restore();
    return;
  }
  const top = M.top!;
  const us: number[] = [];
  for (let i = 0; i <= 40; i++) {
    const u = -1 + (2 * i) / 40;
    if (at(u, top(u)).vis > 0.04) us.push(u);
  }
  if (us.length >= 2) {
    const tp = us.map((u) => at(u, top(u)));
    if (M.bot) {
      const bot = us.map((u) => at(u, M.bot!(u)));
      const p = new Path2D();
      tp.forEach((q, i) => (i ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y)));
      for (let i = bot.length - 1; i >= 0; i--) p.lineTo(bot[i].x, bot[i].y);
      p.closePath();
      mouthInside(ctx, p, bot, M.tongue ?? 0.6);
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 2.5;
      ctx.stroke(p);
    } else {
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      tp.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.stroke();
    }
    if (M.dimple)
      for (const end of [0, us.length - 1]) {
        if (Math.abs(us[end]) < 0.95) continue;
        const q = tp[end],
          q2 = tp[end === 0 ? 1 : end - 1];
        const dx = q.x - q2.x,
          dy = q.y - q2.y,
          l = Math.hypot(dx, dy) || 1;
        ctx.strokeStyle = LINE;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(q.x, q.y);
        ctx.lineTo(q.x + (dx / l) * 2 - 0.5 * M.dimple, q.y - 4.2 * M.dimple);
        ctx.stroke();
      }
  }
  ctx.restore();
}

// ── the pearl: a glowing jewel on the forehead, in a little shell cup ──
export function paintPearl(ctx: Ctx, k: { v: number }) {
  const V = makeView(HEAD_YAW[k.v]);
  const pt = onEll(PEARL_DIR, HEAD),
    n = V.N(ellNormal(pt, HEAD));
  if (n.z < -0.05) return;
  const q = V.P(pt),
    r = 13;
  ctx.save();
  ctx.translate(q.x, q.y - 3);
  const fx = 0.55 + 0.45 * clamp(n.z);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.05 + (i / 8) * Math.PI * 0.9;
    const x = -Math.cos(a) * r * 1.25 * fx,
      y = Math.sin(a) * r * 0.75 + 4;
    const pg = ctx.createRadialGradient(x - 1, y - 2, 0, x, y, 7);
    pg.addColorStop(0, "#ffd6e4");
    pg.addColorStop(1, "#e2507f");
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(x, y, 5.2 * fx + 0.6, 4.6, a - Math.PI / 2, 0, TAU);
    ctx.fill();
  }
  const g = ctx.createRadialGradient(
    -r * 0.35,
    -r * 0.4,
    r * 0.1,
    0,
    0,
    r * 1.05,
  );
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.45, "#e8fffb");
  g.addColorStop(0.8, "#b9e6f2");
  g.addColorStop(1, "#8fb6d8");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.clip();
  const ir = ctx.createLinearGradient(-r, r, r, -r);
  ir.addColorStop(0, "rgba(255,170,215,0.45)");
  ir.addColorStop(0.5, "rgba(255,255,255,0)");
  ir.addColorStop(1, "rgba(150,255,240,0.35)");
  ctx.fillStyle = ir;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
  ctx.strokeStyle = "rgba(60,110,140,0.6)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(-r * 0.36, -r * 0.42, r * 0.3, r * 0.2, -0.6, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r * 0.38, r * 0.3, r * 0.1, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ── gill fronds: a curved stem with many fine wispy filaments ──
export function gillGeom(v: number, side: "L" | "R", i: number) {
  const V = makeView(HEAD_YAW[v]),
    G = GILLS[i],
    sx = side === "L" ? 1 : -1;
  const root = onEll(norm3(G.root.x * sx, G.root.y, G.root.z), HEAD);
  const d = { x: G.dir.x * sx, y: G.dir.y, z: G.dir.z };
  const ctrl = {
    x: root.x + d.x * G.len * 0.55,
    y: root.y + d.y * G.len * 0.55 + G.len * 0.1,
    z: root.z + d.z * G.len * 0.55,
  };
  const tip = {
    x: root.x + d.x * G.len,
    y: root.y + d.y * G.len + G.len * 0.16,
    z: root.z + d.z * G.len,
  };
  return {
    R: V.P(root),
    C: V.P(ctrl),
    T: V.P(tip),
    z: V.N(ellNormal(root, HEAD)).z,
    G,
  };
}
export function paintGill(
  ctx: Ctx,
  k: { v: number; side: "L" | "R"; i: number; lit: number },
) {
  const { R, C, T, G } = gillGeom(k.v, k.side, k.i);
  const RAMP = k.lit ? R_GILL_LIT : R_GILL;
  ctx.save();
  ctx.translate(-R.x, -R.y);
  ctx.lineCap = "round";
  const pt = (t: number) => qbez(R, C, T, t);
  const tan = (t: number) => {
    const a = pt(Math.max(0, t - 0.02)),
      b = pt(Math.min(1, t + 0.02));
    return norm2(b.x - a.x, b.y - a.y);
  };
  const len =
    Math.hypot(T.x - R.x, T.y - R.y) + Math.hypot(C.x - R.x, C.y - R.y) * 0.2;
  const w = G.w * clamp(0.6 + len / 90, 0.75, 1.1);
  const prof = (t: number) =>
    Math.pow(Math.sin(Math.PI * (0.1 + 0.85 * t)), 0.6);
  const rr = rng(31 + k.i * 7 + (k.side === "L" ? 0 : 3) + k.v);
  interface Fil {
    p: Pt;
    c: Pt;
    e: Pt;
    t: number;
    s: number;
  }
  const fil: Fil[] = [];
  const N = 34;
  for (let s = -1; s <= 1; s += 2)
    for (let j = 0; j < N; j++) {
      const t = 0.08 + (0.9 * j) / (N - 1) + (rr() - 0.5) * 0.02;
      const p = pt(t),
        d = tan(t),
        n = { x: -d.y * s, y: d.x * s };
      const L = w * (0.75 + 0.75 * prof(t)) * (0.8 + rr() * 0.4);
      const a = 0.85 + rr() * 0.25;
      fil.push({
        p,
        c: {
          x: p.x + n.x * L * 0.62 + d.x * L * 0.2,
          y: p.y + n.y * L * 0.62 + d.y * L * 0.2,
        },
        e: {
          x: p.x + n.x * L * 0.78 + d.x * L * a,
          y: p.y + n.y * L * 0.78 + d.y * L * a,
        },
        t,
        s,
      });
    }
  for (let j = 0; j < 7; j++) {
    const a = -0.9 + (1.8 * j) / 6,
      d = tan(1),
      cs = Math.cos(a),
      sn = Math.sin(a);
    const dx = d.x * cs - d.y * sn,
      dy = d.x * sn + d.y * cs,
      L = w * (0.9 + rr() * 0.3);
    fil.push({
      p: pt(0.94),
      c: { x: T.x + dx * L * 0.5, y: T.y + dy * L * 0.5 },
      e: { x: T.x + dx * L, y: T.y + dy * L },
      t: 1,
      s: 0,
    });
  }
  const stroke = (
    f: { p: Pt; c: Pt; e: Pt },
    width: number,
    col: string | CanvasGradient,
  ) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(f.p.x, f.p.y);
    ctx.quadraticCurveTo(f.c.x, f.c.y, f.e.x, f.e.y);
    ctx.stroke();
  };
  // a soft painted volume under the filaments (each blur is one path, one pass)
  const all = new Path2D(),
    outer = new Path2D();
  for (const f of fil) {
    all.moveTo(f.p.x, f.p.y);
    all.quadraticCurveTo(f.c.x, f.c.y, f.e.x, f.e.y);
    if (f.t > 0.3) {
      outer.moveTo(f.p.x, f.p.y);
      outer.quadraticCurveTo(f.c.x, f.c.y, f.e.x, f.e.y);
    }
  }
  soft(ctx, k.lit ? 3.2 : 2.4, () => {
    const vg = ctx.createLinearGradient(R.x, R.y, T.x, T.y);
    vg.addColorStop(0, rgba(ramp(RAMP, 0.3), k.lit ? 0.6 : 0.45));
    vg.addColorStop(1, rgba(ramp(RAMP, 0.55), k.lit ? 0.6 : 0.45));
    ctx.strokeStyle = vg;
    ctx.lineWidth = w * 0.26;
    ctx.stroke(all);
  });
  if (k.lit)
    soft(ctx, 5, () => {
      ctx.strokeStyle = "rgba(255,120,190,0.35)";
      ctx.lineWidth = w * 0.5;
      ctx.stroke(outer);
    });
  fil.sort((a, b) => (a.s === b.s ? a.t - b.t : a.s - b.s));
  for (const f of fil) {
    const g = ctx.createLinearGradient(f.p.x, f.p.y, f.e.x, f.e.y);
    const lo = f.s > 0 ? -0.06 : 0.04;
    g.addColorStop(0, rgba(ramp(RAMP, 0.36 + lo + 0.15 * f.t)));
    g.addColorStop(1, rgba(ramp(RAMP, 0.8 + lo + 0.2 * f.t)));
    stroke(f, 1.5 + 0.9 * (1 - f.t), g);
  }
  for (const f of fil)
    if (rr() < 0.45)
      stroke(
        {
          p: { x: lerp(f.p.x, f.e.x, 0.25), y: lerp(f.p.y, f.e.y, 0.25) },
          c: f.c,
          e: f.e,
        },
        0.7,
        `rgba(255,240,247,${k.lit ? 0.85 : 0.55})`,
      );
  for (let i = 0; i < 14; i++) {
    const t0 = i / 14,
      a = pt(t0),
      b = pt((i + 1) / 14);
    ctx.strokeStyle = rgba(ramp(RAMP, 0.28 + 0.25 * t0));
    ctx.lineWidth = lerp(w * 0.42, w * 0.12, t0);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.strokeStyle = `rgba(255,232,242,${k.lit ? 0.7 : 0.45})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i <= 11; i++) {
    const t = i / 14,
      p = pt(t),
      d = tan(t),
      q = { x: p.x - d.y * w * 0.09, y: p.y + d.x * w * 0.09 };
    if (i === 1) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
  }
  ctx.stroke();
  if (k.lit) {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (const f of fil)
      if (f.t > 0.55 && rr() < 0.3) {
        ctx.beginPath();
        ctx.arc(f.e.x, f.e.y, 0.9, 0, TAU);
        ctx.fill();
      }
  }
  ctx.restore();
}

// ════════════════ body ════════════════
const BELLY = norm3(0, -0.88, 0.48);
export function paintBody(ctx: Ctx, k: { v: number }) {
  const V = makeView(VIEW_YAW[k.v]);
  const hd = V.P(ATTACH.head);
  paintSkinBall(ctx, V, BODY, {
    seed: 11,
    freckles: 90,
    cap: k.v >= 3 ? null : { dir: BELLY, ang: 58 },
    gloss: k.v >= 3 ? 0 : 1,
    rim: k.v >= 3 ? 0.15 : 1,
    freckleAt: (d) => d.y > 0.15,
    ao:
      k.v >= 3
        ? [
            { x: -BODY.rx * 0.95, y: 10, r: 46, a: 0.35 },
            { x: BODY.rx * 0.95, y: 10, r: 46, a: 0.45 },
            { x: 0, y: BODY.ry * 1.1, r: 50, a: 0.4 },
          ]
        : [{ x: hd.x, y: hd.y + 30, r: 60, a: 0.4 }],
  });
  paintDorsal(ctx, V);
}
/** The dorsal fin: a soft membrane along the back; from behind, a raised crest. */
function paintDorsal(ctx: Ctx, V: View) {
  const base: V3[] = [],
    top: V3[] = [];
  for (let i = 0; i <= 24; i++) {
    const z = lerp(14, -BODY.rz * 0.98, i / 24);
    const y = BODY.ry * Math.sqrt(Math.max(0, 1 - (z / BODY.rz) ** 2)) - 1;
    const h =
      4 + 11 * Math.sin(Math.PI * clamp((14 - z) / 70)) ** 0.8 + (i / 24) * 4;
    base.push(V.P({ x: 0, y, z }));
    top.push(V.P({ x: 0, y: y + h, z: z - h * 0.2 }));
  }
  if (V.yaw > 120 * DEG) {
    paintCrestStrip(
      ctx,
      base.map((q, i) => ({
        x: lerp(q.x, top[i].x, 0.5),
        y: lerp(q.y, top[i].y, 0.5),
      })),
      9,
      7,
    );
    return;
  }
  const p = new Path2D();
  top.forEach((q, i) => (i ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y)));
  for (let i = base.length - 1; i >= 0; i--) p.lineTo(base[i].x, base[i].y);
  p.closePath();
  const g = ctx.createLinearGradient(0, base[12].y, 0, top[12].y - 4);
  g.addColorStop(0, rgba(ramp(skin, 0.62)));
  g.addColorStop(0.65, rgba(ramp(skin, 0.82)));
  g.addColorStop(1, "rgba(255,176,206,1)");
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.lineCap = "round";
  ctx.strokeStyle = rgba(ramp(skin, 0.3), 0.8);
  ctx.lineWidth = 4.2;
  ctx.beginPath();
  base.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,170,205,0.95)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  top.forEach((q, i) =>
    i ? ctx.lineTo(q.x, q.y + 1) : ctx.moveTo(q.x, q.y + 1),
  );
  ctx.stroke();
}

// ── legs: stubby, round, four little toes ──
export type LegPose = "stand" | "paddle" | "splay" | "up";
const LEG_POSE: Record<
  LegPose,
  (s: number, front: boolean) => { foot: V3; toe: V3 }
> = {
  stand: (s, front) => ({
    foot: { x: s * 7, y: -26, z: front ? 7 : -1 },
    toe: norm3(s * 0.35, 0, front ? 1 : 0.6),
  }),
  paddle: (s) => ({
    foot: { x: s * 16, y: -12, z: -26 },
    toe: norm3(s * 0.3, 0.1, -1),
  }),
  splay: (s, front) => ({
    foot: { x: s * 40, y: -20, z: front ? 20 : -16 },
    toe: norm3(s, 0, front ? 0.7 : -0.5),
  }),
  up: (s) => ({
    foot: { x: s * 26, y: 26, z: 18 },
    toe: norm3(s * 0.4, 1, 0.4),
  }),
};
export function paintLeg(
  ctx: Ctx,
  k: { v: number; side: "L" | "R"; fb: "F" | "B"; pose: LegPose },
) {
  const V = makeView(VIEW_YAW[k.v]),
    s = k.side === "L" ? 1 : -1,
    front = k.fb === "F";
  const hip = ATTACH["leg" + k.fb + k.side];
  const P = LEG_POSE[k.pose](s, front);
  const H = V.P(hip),
    Fo = V.P({ x: hip.x + P.foot.x, y: hip.y + P.foot.y, z: hip.z + P.foot.z });
  const far = V.N(norm3(s, 0, 0)).z < -0.2;
  ctx.save();
  ctx.translate(-H.x, -H.y);
  const w0 = front ? 17 : 16,
    w1 = front ? 14 : 13;
  const d = norm2(Fo.x - H.x, Fo.y - H.y),
    n = { x: -d.y, y: d.x };
  const p = new Path2D();
  p.moveTo(H.x + n.x * w0, H.y + n.y * w0);
  p.lineTo(Fo.x + n.x * w1, Fo.y + n.y * w1);
  p.arc(Fo.x, Fo.y, w1, Math.atan2(n.y, n.x), Math.atan2(-n.y, -n.x), false);
  p.lineTo(H.x - n.x * w0, H.y - n.y * w0);
  p.arc(H.x, H.y, w0, Math.atan2(-n.y, -n.x), Math.atan2(n.y, n.x), false);
  p.closePath();
  const sg = n.x < 0 ? 1 : -1;
  const lg = ctx.createLinearGradient(
    H.x + n.x * w0 * sg,
    H.y - w0,
    H.x - n.x * w0 * sg,
    H.y + w0,
  );
  lg.addColorStop(0, rgba(ramp(skin, 0.86)));
  lg.addColorStop(0.55, rgba(ramp(skin, 0.62)));
  lg.addColorStop(1, rgba(ramp(skin, 0.4)));
  ctx.fillStyle = lg;
  ctx.fill(p);
  const td = V.N(P.toe),
    tdl = Math.hypot(td.x, td.y) || 1;
  const tx = td.x / tdl,
    ty = -td.y / tdl,
    reach = w1 * 0.75 + 3 * tdl;
  const toes: Pt[] = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.atan2(ty, tx) + (i - 1.5) * 0.5;
    toes.push({
      x: Fo.x + Math.cos(a) * reach,
      y: Fo.y + Math.sin(a) * reach * 0.75 + 2.5,
    });
  }
  toes.sort((a, b) => a.y - b.y);
  for (const q of toes) {
    const tg = ctx.createRadialGradient(q.x - 1.2, q.y - 1.8, 0, q.x, q.y, 6.5);
    tg.addColorStop(0, "#fff0f5");
    tg.addColorStop(0.55, "#ffadc7");
    tg.addColorStop(1, "#e06d98");
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.arc(q.x, q.y, 5.2, 0, TAU);
    ctx.fill();
  }
  const fg = ctx.createRadialGradient(
    Fo.x - w1 * 0.4,
    Fo.y - w1 * 0.5,
    1,
    Fo.x,
    Fo.y,
    w1 * 1.2,
  );
  fg.addColorStop(0, rgba(ramp(skin, 0.86)));
  fg.addColorStop(1, rgba(ramp(skin, 0.5)));
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.ellipse(Fo.x, Fo.y + 1, w1, w1 * 0.82, 0, 0, TAU);
  ctx.fill();
  if (far) {
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = "rgba(3,40,54,0.28)";
    ctx.fillRect(
      Math.min(H.x, Fo.x) - 30,
      Math.min(H.y, Fo.y) - 30,
      Math.abs(Fo.x - H.x) + 60,
      Math.abs(Fo.y - H.y) + 60,
    );
  }
  ctx.restore();
}

// ── the tail: laterally flat, a fleshy core inside a wide soft fin ──
export const TAIL_POSE: Record<string, [V3, V3, V3]> = {
  rest: [
    { x: 0, y: 0, z: 0 },
    { x: 16, y: 0, z: -58 },
    { x: 54, y: -6, z: -96 },
  ],
  up: [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 40, z: -50 },
    { x: 0, y: 98, z: -36 },
  ],
  out: [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 3, z: -72 },
    { x: 0, y: 6, z: -146 },
  ],
  curl: [
    { x: 0, y: 0, z: 0 },
    { x: 34, y: 2, z: -52 },
    { x: 86, y: 6, z: -40 },
  ],
  flop: [
    { x: 0, y: 0, z: 0 },
    { x: 26, y: -26, z: -50 },
    { x: 74, y: -34, z: -48 },
  ],
  // the back views' own resting tail: straight back and drooping, edge-on
  restB: [
    { x: 0, y: 0, z: 0 },
    { x: 4, y: -12, z: -52 },
    { x: 10, y: -30, z: -96 },
  ],
};
export function paintTail(ctx: Ctx, k: { v: number; pose: string }) {
  const V = makeView(VIEW_YAW[k.v]),
    [A, B, C] = TAIL_POSE[k.pose],
    root = ATTACH.tail;
  const finK = k.v >= 3 ? 0.5 : 1;
  const N = 28,
    top: V3[] = [],
    bot: V3[] = [],
    ctop: V3[] = [],
    cbot: V3[] = [],
    spine: V3[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N,
      p = qbez3(A, B, C, t),
      p2 = qbez3(A, B, C, Math.min(1, t + 0.02)),
      p1 = qbez3(A, B, C, Math.max(0, t - 0.02));
    const d = norm3(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
    let up = { x: -d.y * d.x, y: 1 - d.y * d.y, z: -d.y * d.z };
    if (Math.hypot(up.x, up.y, up.z) < 0.2) up = { x: 0, y: 0, z: -1 };
    up = norm3(up.x, up.y, up.z);
    const core = lerp(19, 3.5, Math.pow(t, 0.85));
    const tipRound =
      t > 0.86 ? Math.sqrt(Math.max(0, 1 - ((t - 0.86) / 0.14) ** 2)) : 1;
    const tipK = t > 0.86 ? tipRound * 0.85 + 0.15 : 1;
    const finT =
      (core + 17 * Math.pow(Math.sin(Math.PI * clamp(t * 1.05)), 0.7)) * tipK;
    const finB =
      (core + 12 * Math.pow(Math.sin(Math.PI * clamp(t * 1.1 - 0.05)), 0.8)) *
      tipK;
    const w = { x: root.x + p.x, y: root.y + p.y, z: root.z + p.z };
    const at = (h: number) =>
      V.P({ x: w.x + up.x * h, y: w.y + up.y * h, z: w.z + up.z * h });
    top.push(at(core + (finT - core) * finK));
    bot.push(at(-(core + (finB - core) * finK)));
    ctop.push(at(core));
    cbot.push(at(-core * 0.9));
    spine.push(V.P(w));
  }
  const R0 = V.P(root);
  ctx.save();
  ctx.translate(-R0.x, -R0.y);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const ribbon = (a: V3[], b: V3[]) => {
    const p = new Path2D();
    a.forEach((q, i) => (i ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y)));
    for (let i = b.length - 1; i >= 0; i--) p.lineTo(b[i].x, b[i].y);
    p.closePath();
    return p;
  };
  const fin = ribbon(top, bot);
  const tip = spine[N];
  const fg = ctx.createLinearGradient(R0.x, R0.y, tip.x, tip.y);
  fg.addColorStop(0, rgba(ramp(skin, 0.55)));
  fg.addColorStop(0.6, rgba(mix(ramp(skin, 0.72), [255, 190, 214], 0.2)));
  fg.addColorStop(1, rgba(mix(ramp(skin, 0.7), [255, 170, 205], 0.6)));
  ctx.fillStyle = fg;
  ctx.fill(fin);
  ctx.save();
  ctx.clip(fin);
  soft(ctx, 3, () => {
    ctx.strokeStyle = "rgba(255,150,195,0.7)";
    ctx.lineWidth = 7;
    ctx.stroke(fin);
  });
  ctx.strokeStyle = "rgba(255,255,255,0.32)";
  ctx.lineWidth = 0.9;
  for (let i = 3; i < N; i += 2) {
    ctx.beginPath();
    ctx.moveTo(ctop[i].x, ctop[i].y);
    ctx.lineTo(
      lerp(ctop[i].x, top[i].x, 0.92),
      lerp(ctop[i].y, top[i].y, 0.92),
    );
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cbot[i].x, cbot[i].y);
    ctx.lineTo(lerp(cbot[i].x, bot[i].x, 0.9), lerp(cbot[i].y, bot[i].y, 0.9));
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(214,98,150,0.6)";
  ctx.lineWidth = 1.1;
  ctx.stroke(fin);
  const core = ribbon(ctop, cbot);
  const cg = ctx.createLinearGradient(
    0,
    Math.min(...ctop.map((q) => q.y)),
    0,
    Math.max(...cbot.map((q) => q.y)),
  );
  cg.addColorStop(0, rgba(ramp(skin, 0.85)));
  cg.addColorStop(0.5, rgba(ramp(skin, 0.62)));
  cg.addColorStop(1, rgba(ramp(skin, 0.42)));
  ctx.fillStyle = cg;
  ctx.fill(core);
  ctx.save();
  ctx.clip(core);
  const rr = rng(8);
  for (let i = 2; i < N - 3; i += 2) {
    const q = {
      x: lerp(ctop[i].x, cbot[i].x, 0.25 + rr() * 0.4),
      y: lerp(ctop[i].y, cbot[i].y, 0.25 + rr() * 0.4),
    };
    const r0 = 1.6 + rr() * 1.6;
    spotAt(ctx, q.x, q.y, r0, r0, 0, rr() < PHASE_SPOTS[phaseNow].darkShare);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 1; i < N - 4; i++) {
    const q = {
      x: lerp(ctop[i].x, cbot[i].x, 0.2),
      y: lerp(ctop[i].y, cbot[i].y, 0.2),
    };
    if (i === 1) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
  }
  ctx.stroke();
  ctx.restore();
  // what runs away from the camera falls into shade: the tail tapers off behind
  const away = clamp((spine[0].z - spine[N].z) / 90);
  if (away > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    const dg = ctx.createLinearGradient(spine[0].x, spine[0].y, tip.x, tip.y);
    dg.addColorStop(0, "rgba(2,30,46,0)");
    dg.addColorStop(1, `rgba(2,30,46,${0.45 * away})`);
    ctx.fillStyle = dg;
    ctx.fillRect(-400, -400, 800, 800);
    ctx.restore();
  }
  ctx.restore();
}

// ════════════════ effect sprites for the rig ════════════════
/** Lace foam where the body meets the water: the far half (behind) or the near half (in front). */
export function paintFoam(ctx: Ctx, k: { front: number }) {
  const r = rng(k.front ? 17 : 19),
    a0 = k.front ? 0 : Math.PI,
    a1 = a0 + Math.PI;
  ctx.lineCap = "round";
  ctx.strokeStyle = `rgba(255,255,255,${k.front ? 0.3 : 0.22})`;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.ellipse(0, 0, 60, 22, 0, a0, a1);
  ctx.stroke();
  for (let i = 0; i < 120; i++) {
    const a = a0 + r() * Math.PI,
      kk = 1 + (r() - 0.45) * 0.16;
    ctx.fillStyle = `rgba(255,255,255,${0.45 + r() * 0.5})`;
    ctx.beginPath();
    ctx.arc(
      Math.cos(a) * 60 * kk,
      Math.sin(a) * 22 * kk,
      0.8 + r() * 2.4,
      0,
      TAU,
    );
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 58, 21, 0, a0 + 0.08, a1 - 0.08);
  ctx.stroke();
}
/** The soft fade where gill tips, chin and tail meet the water. */
export function paintFade(ctx: Ctx) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(-110, -10, 220, 50);
  ctx.clip();
  ctx.scale(1, 0.28);
  const g = ctx.createRadialGradient(0, 0, 60, 0, 0, 100);
  g.addColorStop(0, "rgba(62,184,198,0)");
  g.addColorStop(0.72, "rgba(62,184,198,0.55)");
  g.addColorStop(0.92, "rgba(70,190,204,0.9)");
  g.addColorStop(1, "rgba(70,190,204,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 100, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.globalCompositeOperation = "destination-in";
  const v = ctx.createLinearGradient(0, -10, 0, 6);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = v;
  ctx.fillRect(-110, -10, 220, 50);
}
/** A curved streak of swirling water (phases 2 and 3, and the spin smear). */
export function paintSwirl(ctx: Ctx) {
  const L: Pt[] = [],
    R: Pt[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20,
      a = -0.9 + t * 1.8,
      x = Math.sin(a) * 50,
      y = (1 - Math.cos(a)) * -14,
      w = Math.sin(Math.PI * t) * 4.5 + 0.3;
    L.push({ x, y: y - w });
    R.push({ x, y: y + w });
  }
  ctx.beginPath();
  L.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i].x, R[i].y);
  ctx.closePath();
  const g = ctx.createLinearGradient(-50, 0, 50, 0);
  g.addColorStop(0, "rgba(160,250,245,0)");
  g.addColorStop(0.6, "rgba(200,255,250,0.8)");
  g.addColorStop(1, "rgba(255,255,255,0.95)");
  ctx.fillStyle = g;
  ctx.fill();
}
export function paintShadow(ctx: Ctx, k: { deep: number }) {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
  const stops: [number, string][] = k.deep
    ? [
        [0, "rgba(4,46,66,0.78)"],
        [0.55, "rgba(6,60,80,0.5)"],
        [1, "rgba(8,70,90,0)"],
      ]
    : [
        [0, "rgba(2,30,40,0.6)"],
        [0.65, "rgba(2,30,40,0.32)"],
        [1, "rgba(2,30,40,0)"],
      ];
  for (const [t, c] of stops) g.addColorStop(t, c);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 60, 24, 0, 0, TAU);
  ctx.fill();
}
