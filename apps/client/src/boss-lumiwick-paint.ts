/**
 * Lumiwick's painters: each part is a pure function (ctx, k) drawn once per
 * view into one atlas when the battle scene is created (boss-lumiwick-rig.ts).
 * Every piece gets a soft darker outline and paper grain, is trimmed to its
 * pixels and shelf-packed. At runtime a piece is one image.
 *
 * The density (atlas px per rig unit) is fixed per part and never follows
 * the device pixel ratio, so the atlas stays near 5 MB on every screen.
 */
import {
  ARM_POSE_NAMES,
  ARM_POSES,
  EXPRS,
  IRIS_R,
  L_BOT,
  L_R,
  L_TOP,
  MOUTHS,
  PUPIL_R,
  SPITCH,
  TAU,
  VIEW_YAW,
  armModel,
  armStates,
  clamp,
  eyeLayout,
  lanternR,
  lerp,
  makeView,
  mouthLayout,
  norm2,
  surf,
  surfVisible,
  yS,
  type Eye,
  type P2,
  type View,
} from "./boss-lumiwick-shape";

type Ctx = CanvasRenderingContext2D;
type RGB = [number, number, number];
type Ramp = [number, string][];
/** Atlas px per rig unit of the piece being painted (blur radii are in canvas px). */
let PQ = 1;
/**
 * Paint into canvases the CPU rasterises (the briefing's picture, which is
 * read back into a PNG anyway): its blurs and soft outlines cost a fraction
 * of the GPU path where the GPU is emulated, and the picture looks the same.
 * The battle atlas keeps the default canvases.
 */
let SOFT = false;
const ctx2d = (c: HTMLCanvasElement) =>
  c.getContext("2d", SOFT ? { willReadFrequently: true } : undefined)!;
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
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
const R_PAPER: Ramp = [
  [0, "#9c4f22"],
  [0.35, "#dc9350"],
  [0.7, "#ffd7a0"],
  [1, "#fff4dc"],
];
const R_TRIM: Ramp = [
  [0, "#6a1606"],
  [0.45, "#c43614"],
  [0.8, "#f2602a"],
  [1, "#ff9a5a"],
];
const C_INK = "#2c0a04";
const qbez = (a: P2, b: P2, c: P2, t: number): P2 => ({
  x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * b.x + t * t * c.x,
  y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * b.y + t * t * c.y,
});
/** A flame tongue along a curved spine a → b → c: round base, tapering curling tip. */
function flamePath(a: P2, b: P2, c: P2, w: number, wave = 0, phase = 0) {
  const N = 14,
    L: P2[] = [],
    R: P2[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = qbez(a, b, c, t);
    const q = qbez(a, b, c, Math.min(1, t + 0.02)),
      o = qbez(a, b, c, Math.max(0, t - 0.02));
    const d = norm2(q.x - o.x, q.y - o.y),
      n = { x: -d.y, y: d.x };
    const prof =
      Math.pow(Math.sin(Math.PI * (0.18 + 0.82 * t)), 0.75) *
      Math.pow(1 - t, 0.35) *
      (1 + 0.25 * (1 - t));
    const lick = wave * w * Math.sin(t * 7 + phase) * t;
    const hw = w * prof;
    L.push({ x: p.x + n.x * (hw + lick), y: p.y + n.y * (hw + lick) });
    R.push({ x: p.x - n.x * (hw - lick), y: p.y - n.y * (hw - lick) });
  }
  const pts = L.concat(R.reverse());
  const path = new Path2D();
  const m0 = {
    x: (pts[0].x + pts[pts.length - 1].x) / 2,
    y: (pts[0].y + pts[pts.length - 1].y) / 2,
  };
  const back = norm2(a.x - b.x, a.y - b.y);
  path.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2,
      my = (pts[i].y + pts[i + 1].y) / 2;
    path.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  path.quadraticCurveTo(
    m0.x + back.x * w * 0.9,
    m0.y + back.y * w * 0.9,
    pts[0].x,
    pts[0].y,
  );
  path.closePath();
  return path;
}
const grains: { gpu?: HTMLCanvasElement; cpu?: HTMLCanvasElement } = {};
/** The grain tile, on the same kind of canvas as the piece it textures. */
function grainCanvas() {
  const kind = SOFT ? "cpu" : "gpu",
    known = grains[kind];
  if (known) return known;
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const g = ctx2d(c),
    r = rng(77);
  for (let i = 0; i < 520; i++) {
    g.fillStyle =
      r() < 0.5
        ? `rgba(70,20,6,${0.03 + r() * 0.05})`
        : `rgba(255,236,196,${0.03 + r() * 0.04})`;
    g.fillRect(r() * 96, r() * 96, 1 + r() * 1.6, 1 + r() * 1.2);
  }
  return (grains[kind] = c);
}
const hasFilter = () => {
  try {
    const c = document.createElement("canvas").getContext("2d")!;
    c.filter = "blur(2px)";
    return c.filter === "blur(2px)";
  } catch {
    return false;
  }
};
let FILTER: boolean | null = null;
/** Blur a few strokes while painting (radius in rig units); a no-op where canvas filters are missing. */
function soft(ctx: Ctx, px: number, fn: () => void) {
  ctx.save();
  if ((FILTER ??= hasFilter())) ctx.filter = `blur(${(px * PQ).toFixed(2)}px)`;
  fn();
  ctx.restore();
}
/** A light or shade cast inward from the outline, optionally shifted to one side. */
function innerGlow(
  ctx: Ctx,
  path: Path2D,
  color: string,
  blur: number,
  dx = 0,
  dy = 0,
) {
  const c = document.createElement("canvas");
  c.width = ctx.canvas.width;
  c.height = ctx.canvas.height;
  const g = ctx2d(c);
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
/** Front arc of the ring at height y (the near half, seen from a little above). */
function frontArc(
  path: Path2D,
  y: number,
  out = 0,
  from = -Math.PI / 2,
  to = Math.PI / 2,
  move = true,
) {
  const r = lanternR(y) + out;
  for (let i = 0; i <= 40; i++) {
    const a = from + ((to - from) * i) / 40;
    const x = r * Math.sin(a),
      sy = yS(y) + r * Math.cos(a) * SPITCH;
    if (i === 0 && move) path.moveTo(x, sy);
    else path.lineTo(x, sy);
  }
  return path;
}
/** The outline: the union of every horizontal ring (the same in all views). */
export function silPath() {
  const p = new Path2D();
  for (let i = 0; i <= 120; i++) {
    const y = L_BOT + ((L_TOP - L_BOT) * i) / 120,
      r = lanternR(y);
    if (r < 0.5) continue;
    p.moveTo(r, yS(y));
    p.ellipse(0, yS(y), r, r * SPITCH, 0, 0, TAU);
  }
  return p;
}

// ════════════════ body ════════════════
const RIBS = [Math.PI / 4, -Math.PI / 4, (3 * Math.PI) / 4, (-3 * Math.PI) / 4];
function meridian(
  V: View,
  phi: number,
  y0: number,
  y1: number,
  wantVisible: boolean,
  out = 0.6,
) {
  const runs: P2[][] = [];
  let cur: P2[] | null = null;
  for (let i = 0; i <= 60; i++) {
    const y = y0 + ((y1 - y0) * i) / 60,
      vis = surfVisible(V, phi, y);
    if (vis === wantVisible) {
      const q = V.P(surf(phi, y, out));
      if (!cur) runs.push((cur = []));
      cur.push(q);
    } else cur = null;
  }
  return runs;
}
function strokeRuns(ctx: Ctx, runs: P2[][]) {
  ctx.beginPath();
  for (const r of runs)
    r.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.stroke();
}
/** The paper lantern in one view. lit: glowing from inside (1) or the flame out (0). */
function paintBody(ctx: Ctx, k: { v: number; lit: number }) {
  const yaw = VIEW_YAW[k.v],
    V = makeView(yaw),
    lit = k.lit;
  const sil = silPath();
  const top = yS(L_TOP),
    bot = yS(L_BOT) + lanternR(L_BOT) * SPITCH;
  const fillAll = () =>
    ctx.fillRect(-L_R - 20, top - 20, 2 * L_R + 40, bot - top + 40);
  ctx.save();
  ctx.clip(sil);
  const g = ctx.createLinearGradient(0, top, 0, bot);
  if (lit) {
    g.addColorStop(0, "#d8602a");
    g.addColorStop(0.3, "#f58a3c");
    g.addColorStop(0.68, "#ffc070");
    g.addColorStop(1, "#ffe0a0");
  } else {
    g.addColorStop(0, "#a8927a");
    g.addColorStop(0.5, "#c2ad90");
    g.addColorStop(1, "#a48c70");
  }
  ctx.fillStyle = g;
  fillAll();
  if (lit) {
    const cg = ctx.createRadialGradient(0, yS(-36), 4, 0, yS(-18), 104);
    cg.addColorStop(0, "rgba(255,254,236,1)");
    cg.addColorStop(0.28, "rgba(255,240,178,0.86)");
    cg.addColorStop(0.6, "rgba(255,190,96,0.3)");
    cg.addColorStop(1, "rgba(255,160,70,0)");
    ctx.fillStyle = cg;
    fillAll();
    soft(ctx, 1.6, () => {
      ctx.strokeStyle = "rgba(170,60,16,0.2)";
      ctx.lineWidth = 3.2;
      for (const phi of RIBS)
        strokeRuns(ctx, meridian(V, phi, L_BOT + 4, L_TOP - 8, false, -1));
    });
  } else {
    const kg = ctx.createRadialGradient(-34, yS(52), 4, -20, yS(34), 120);
    kg.addColorStop(0, "rgba(255,244,226,0.45)");
    kg.addColorStop(0.5, "rgba(255,240,220,0.12)");
    kg.addColorStop(1, "rgba(255,246,228,0)");
    ctx.fillStyle = kg;
    fillAll();
  }
  // washi fibres
  const r = rng(40 + k.v);
  ctx.lineCap = "round";
  for (let i = 0; i < 70; i++) {
    const x = (r() - 0.5) * 2 * L_R,
      y = top + r() * (bot - top),
      a = r() * TAU,
      l = 3 + r() * 7;
    ctx.strokeStyle =
      r() < 0.6
        ? `rgba(255,250,230,${lit ? 0.16 : 0.22})`
        : `rgba(140,70,30,${lit ? 0.1 : 0.12})`;
    ctx.lineWidth = 0.6 + r() * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + Math.cos(a) * l * 0.5 + 1.5,
      y + Math.sin(a) * l * 0.5,
      x + Math.cos(a) * l,
      y + Math.sin(a) * l,
    );
    ctx.stroke();
  }
  // front ribs: a shadow line with a lit lip
  for (const phi of RIBS) {
    const runs = meridian(V, phi, L_BOT + 4, L_TOP - 7, true);
    ctx.strokeStyle = lit ? "rgba(156,50,12,0.6)" : "rgba(118,84,54,0.7)";
    ctx.lineWidth = 2.6;
    strokeRuns(ctx, runs);
    ctx.save();
    ctx.translate(-1.1, 0);
    ctx.strokeStyle = lit ? "rgba(255,246,214,0.45)" : "rgba(255,250,236,0.6)";
    ctx.lineWidth = 1;
    strokeRuns(ctx, runs);
    ctx.restore();
  }
  // the back seam
  {
    const a = meridian(V, Math.PI - 0.035, L_BOT + 4, L_TOP - 7, true),
      b = meridian(V, Math.PI + 0.035, L_BOT + 4, L_TOP - 7, true);
    if (a.length && b.length) {
      ctx.strokeStyle = lit ? "rgba(170,64,18,0.4)" : "rgba(120,86,56,0.5)";
      ctx.lineWidth = 1.2;
      strokeRuns(ctx, a);
      strokeRuns(ctx, b);
      ctx.strokeStyle = lit ? "rgba(190,80,24,0.16)" : "rgba(120,86,56,0.16)";
      ctx.lineWidth = 5;
      strokeRuns(ctx, meridian(V, Math.PI, L_BOT + 4, L_TOP - 7, true));
    }
  }
  // on the back: a gold good-luck charm, a flame in a ring
  {
    const c = Math.cos(Math.PI + yaw);
    if (c > 0.2) {
      const q = V.P(surf(Math.PI, 18, 0.6));
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.scale(Math.max(0.3, c), 1);
      ctx.strokeStyle = lit ? "#ffd86e" : "#c9a050";
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, 19, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = lit ? "#ffd86e" : "#c9a050";
      ctx.fill(
        flamePath({ x: 0, y: 9 }, { x: -3, y: -1 }, { x: 2, y: -12 }, 6.5),
      );
      ctx.fillStyle = lit ? "#d8401a" : "#a8341a";
      ctx.fill(flamePath({ x: 0, y: 8 }, { x: -1, y: 2 }, { x: 1, y: -4 }, 3));
      ctx.restore();
    }
  }
  // pleats where the paper gathers at the crown
  ctx.strokeStyle = lit ? "rgba(150,52,14,0.32)" : "rgba(110,80,50,0.4)";
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 12; i++)
    strokeRuns(
      ctx,
      meridian(
        V,
        (i / 12) * TAU + 0.13,
        L_TOP - 22 - (i % 2) * 6,
        L_TOP - 3,
        true,
        0.3,
      ),
    );
  // the red hem band, gold edges and gold motifs
  {
    const p = new Path2D();
    frontArc(p, -42, 0.4, -Math.PI / 2, Math.PI / 2, true);
    frontArc(p, -58, 0.4, Math.PI / 2, -Math.PI / 2, false);
    p.closePath();
    const bg = ctx.createLinearGradient(-L_R, 0, L_R, 0);
    const c0 = ramp(R_TRIM, lit ? 0.62 : 0.45),
      c1 = ramp(R_TRIM, lit ? 0.95 : 0.6);
    bg.addColorStop(0, rgba(c0));
    bg.addColorStop(0.4, rgba(c1));
    bg.addColorStop(1, rgba(c0));
    ctx.fillStyle = bg;
    ctx.fill(p);
    ctx.strokeStyle = lit ? "#ffd76e" : "#c9a050";
    ctx.lineWidth = 1.7;
    ctx.stroke(frontArc(new Path2D(), -42, 0.6));
    ctx.stroke(frontArc(new Path2D(), -58, 0.6));
  }
  for (let i = 0; i < 16; i++) {
    const phi = (i / 16) * TAU,
      c = Math.cos(phi + yaw);
    if (c < 0.12) continue;
    const q = V.P(surf(phi, -50, 0.8));
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.scale(Math.max(0.25, c), 1);
    ctx.fillStyle = lit ? "#ffd86e" : "#cfa654";
    if (i % 2 === 0) {
      ctx.beginPath();
      ctx.moveTo(0, -5.2);
      ctx.quadraticCurveTo(3.6, -1, 0, 4.2);
      ctx.quadraticCurveTo(-3.6, -1, 0, -5.2);
      ctx.fill();
      ctx.fillStyle = lit ? "#fff6c8" : "#e8d39a";
      ctx.beginPath();
      ctx.arc(0, 0.8, 1.2, 0, TAU);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, 1.9, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  // edges: glowing paper goes deep orange-red at the edges; dim paper shades
  if (lit) {
    innerGlow(ctx, sil, "rgba(206,50,12,1)", 30);
    innerGlow(ctx, sil, "rgba(196,44,10,0.9)", 14);
    innerGlow(ctx, sil, "rgba(150,28,6,0.75)", 5);
    innerGlow(ctx, sil, "rgba(255,240,170,0.95)", 5, -3.2, 0);
    innerGlow(ctx, sil, "rgba(255,250,214,0.8)", 7, 0, -4.5);
  } else {
    innerGlow(ctx, sil, "rgba(90,62,40,0.55)", 16);
    innerGlow(ctx, sil, "rgba(90,62,40,0.45)", 14, -10, 0);
    innerGlow(ctx, sil, "rgba(255,248,230,0.6)", 4, 3, 2);
  }
  soft(ctx, 6, () => {
    ctx.fillStyle = `rgba(255,252,240,${lit ? 0.32 : 0.4})`;
    ctx.beginPath();
    ctx.ellipse(-40, yS(48), 14, 26, 0.28, 0, TAU);
    ctx.fill();
  });
  ctx.restore();
  // the bamboo hoop at the open hem
  const hoop = frontArc(
    new Path2D(),
    L_BOT + 1,
    2.2,
    -Math.PI / 2 - 0.08,
    Math.PI / 2 + 0.08,
  );
  ctx.lineCap = "round";
  ctx.strokeStyle = "#5e3410";
  ctx.lineWidth = 7.4;
  ctx.stroke(hoop);
  ctx.strokeStyle = lit ? "#c98a44" : "#a77b48";
  ctx.lineWidth = 4.4;
  ctx.stroke(hoop);
  ctx.save();
  ctx.translate(0, -1.3);
  ctx.strokeStyle = lit ? "#ffd998" : "#e2c08a";
  ctx.lineWidth = 1.3;
  ctx.stroke(hoop);
  ctx.restore();
  ctx.strokeStyle = "#6a3a12";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 9; i++) {
    const phi = (i / 9) * TAU + 0.2;
    if (Math.cos(phi + yaw) < 0.15) continue;
    const q = V.P(surf(phi, L_BOT + 1, 2.2));
    ctx.beginPath();
    ctx.moveTo(q.x, q.y - 3);
    ctx.lineTo(q.x, q.y + 3);
    ctx.stroke();
  }
}
function paintHeat(ctx: Ctx) {
  ctx.save();
  ctx.clip(silPath());
  const g = ctx.createRadialGradient(0, yS(-40), 4, 0, yS(-20), 120);
  g.addColorStop(0, "rgba(255,226,140,1)");
  g.addColorStop(0.45, "rgba(255,150,60,0.55)");
  g.addColorStop(1, "rgba(255,90,30,0)");
  ctx.fillStyle = g;
  ctx.fillRect(-100, -110, 200, 220);
  ctx.restore();
}
function paintHalo(ctx: Ctx) {
  const g = ctx.createRadialGradient(0, 10, 10, 0, 0, 108);
  g.addColorStop(0, "rgba(255,190,90,0.7)");
  g.addColorStop(0.55, "rgba(255,130,40,0.25)");
  g.addColorStop(1, "rgba(255,90,20,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 108, 116, 0, 0, TAU);
  ctx.fill();
}

// ════════════════ face ════════════════
function cubicPt(c: P2[], t: number): P2 {
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
/** The eye opening (upright): a rounded almond, or a profile wedge. */
function eyeOpening(e: Eye) {
  const { x, y, hw, hh, inner: n, kind } = e;
  const p = new Path2D();
  if (kind === "side") {
    const A = { x: x + n * hw * 0.62, y: y - hh * 0.84 },
      B = { x: x + n * hw * 0.5, y: y + hh * 0.82 },
      O = { x: x - n * hw, y: y - hh * 0.12 };
    const c1 = { x: x - n * hw * 0.55, y: y - hh * 0.78 },
      c2 = { x: x + n * hw * 0.1, y: y - hh * 0.98 };
    p.moveTo(O.x, O.y);
    p.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, A.x, A.y);
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
      y + hh * 0.95,
      x - n * hw * 0.6,
      y + hh * 0.55,
      O.x,
      O.y,
    );
    p.closePath();
    return { p, top: (t: number) => cubicPt([O, c1, c2, A], t) };
  }
  const lift = kind === "far" ? hh * 0.14 : hh * 0.06;
  const I = { x: x + n * hw, y: y + hh * 0.12 },
    O = { x: x - n * hw, y: y - lift };
  const c1 = { x: x + n * hw * 0.72, y: y - hh * 1.04 },
    c2 = { x: x - n * hw * 0.8, y: y - hh * 1.02 - lift * 0.4 };
  p.moveTo(I.x, I.y);
  p.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, O.x, O.y);
  p.bezierCurveTo(
    x - n * hw * 0.8,
    y + hh * 1.02,
    x + n * hw * 0.72,
    y + hh * 1.04,
    I.x,
    I.y,
  );
  p.closePath();
  return { p, top: (t: number) => cubicPt([O, c2, c1, I], t) };
}
const LIDS: Record<string, [number, number]> = {
  idle: [0.36, 0.5],
  glare: [-0.1, 0.5],
  wide: [2, 2],
};
function paintEye(ctx: Ctx, e: Eye, expr: string) {
  const { x, y, hw, hh, inner: n, kind } = e;
  const flickDir = -n;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (expr === "hurt") {
    const w = kind === "side" ? hw * 0.9 : hw * 0.85;
    ctx.strokeStyle = C_INK;
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(x - n * w, y - hh * 0.45);
    ctx.lineTo(x + n * w * 0.6, y);
    ctx.lineTo(x - n * w, y + hh * 0.4);
    ctx.stroke();
    return;
  }
  if (expr === "dizzy") {
    const R =
      Math.min(hw, hh) * (kind === "front" || kind === "near" ? 0.95 : 0.9);
    ctx.strokeStyle = C_INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * TAU * 2.4,
        r = (i / 64) * R;
      const px = x + Math.cos(a) * r,
        py = y + Math.sin(a) * r;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.stroke();
    return;
  }
  if (expr === "closed") {
    const fx = x + n * hw * (kind === "side" ? 0.7 : 0.95),
      ox = x - n * hw;
    ctx.strokeStyle = C_INK;
    ctx.lineWidth = 3.8;
    ctx.beginPath();
    ctx.moveTo(fx, y + 1);
    ctx.quadraticCurveTo(x, y + hh * 0.45, ox, y - 1);
    ctx.lineTo(ox + flickDir * 6, y - 5.5);
    ctx.stroke();
    return;
  }
  const O = eyeOpening(e);
  const [li, lo] = LIDS[expr] || LIDS.idle;
  const lidY = (px: number) => {
    const t = clamp((px - (x - n * hw)) / (2 * n * hw));
    return (
      y -
      hh * lerp(lo, li, t) -
      (li < 1.5 ? hh * 0.12 * Math.sin(Math.PI * t) : 0)
    );
  };
  ctx.save();
  ctx.clip(O.p);
  const lid = new Path2D();
  for (let i = 0; i <= 24; i++) {
    const px = x - hw * 1.6 + (hw * 3.2 * i) / 24;
    if (i) lid.lineTo(px, lidY(px));
    else lid.moveTo(px, lidY(px));
  }
  lid.lineTo(x + hw * 1.6, y + hh * 2);
  lid.lineTo(x - hw * 1.6, y + hh * 2);
  lid.closePath();
  ctx.clip(lid);
  ctx.fillStyle = "#3a0c05";
  ctx.fillRect(x - hw * 2, y - hh * 2, hw * 4, hh * 4);
  // the iris: always the same circle
  const front = kind === "side" ? n * hw * 0.05 - e.look : 0;
  const ix = x + front + e.look,
    iy = y + hh * 0.12;
  const ig = ctx.createLinearGradient(0, iy - IRIS_R, 0, iy + IRIS_R);
  if (expr === "glare") {
    ig.addColorStop(0, "#7a1006");
    ig.addColorStop(0.45, "#ff5a1a");
    ig.addColorStop(0.85, "#ffd04a");
    ig.addColorStop(1, "#fff2a0");
  } else {
    ig.addColorStop(0, "#4a0e06");
    ig.addColorStop(0.45, "#c43a16");
    ig.addColorStop(0.82, "#ff9a2e");
    ig.addColorStop(1, "#ffd774");
  }
  ctx.fillStyle = ig;
  ctx.beginPath();
  ctx.arc(ix, iy, IRIS_R, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(40,6,2,0.55)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  const pr =
    expr === "glare"
      ? PUPIL_R * 0.6
      : expr === "wide"
        ? PUPIL_R * 0.7
        : PUPIL_R;
  ctx.fillStyle = "#1c0402";
  ctx.beginPath();
  ctx.arc(ix, iy - 0.5, pr, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,236,150,0.75)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(ix, iy, IRIS_R * 0.74, 0.3 * Math.PI, 0.7 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = "#fffdf4";
  ctx.beginPath();
  ctx.arc(ix - 4.2, iy - 5, 4.2, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ix + 4.4, iy + 4.6, 1.9, 0, TAU);
  ctx.fill();
  ctx.restore();
  // lash along the visible top edge, thick at the outer corner, tapering inward
  const pts: P2[] = [];
  for (let i = 0; i <= 24; i++) {
    const q = O.top(i / 24);
    pts.push({ x: q.x, y: Math.max(q.y, Math.min(lidY(q.x), y + hh * 0.6)) });
  }
  const taper = (t: number) => Math.pow(1 - t, 0.6);
  ctx.fillStyle = C_INK;
  ctx.beginPath();
  pts.forEach((q, i) => {
    const w = 0.15 + 3.3 * taper(i / 24);
    if (i) ctx.lineTo(q.x, q.y - w);
    else ctx.moveTo(q.x, q.y - w);
  });
  for (let i = 24; i >= 0; i--)
    ctx.lineTo(pts[i].x, pts[i].y + 0.1 + 1.7 * taper(i / 24));
  ctx.closePath();
  ctx.fill();
  const o = pts[0];
  ctx.beginPath();
  ctx.moveTo(o.x + n * 3, o.y - 3.2);
  ctx.quadraticCurveTo(
    o.x + flickDir * 4,
    o.y - 4.5,
    o.x + flickDir * 8,
    o.y - 8.5,
  );
  ctx.quadraticCurveTo(o.x + flickDir * 3.5, o.y + 0.2, o.x + n * 2, o.y + 1.8);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip(O.p);
  ctx.strokeStyle = "rgba(60,14,6,0.7)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x - n * hw * 0.95, y + hh * 0.2);
  ctx.quadraticCurveTo(
    x - n * hw * 0.5,
    y + hh * 0.98,
    x + n * hw * 0.05,
    y + hh * 0.98,
  );
  ctx.stroke();
  ctx.restore();
}
function paintBrow(ctx: Ctx, e: Eye, expr: string) {
  if (expr === "dizzy") return;
  const { x, y, hw, hh, inner: n, left, kind } = e;
  const sly = left ? 4 : 0;
  const B: Record<string, [number, number]> = {
    idle: [5 + sly, 9 + sly],
    glare: [-2, 9],
    wide: [12, 12],
    hurt: [12, 5],
    closed: [6, 7],
  };
  const [hi, ho] = B[expr] || [6, 8];
  const by = y - hh;
  const x0 = x + n * hw * (kind === "side" ? 0.9 : 0.65),
    x1 = x - n * hw * (kind === "side" ? 0.7 : 0.85);
  ctx.strokeStyle = "#6e200a";
  ctx.lineWidth = 3.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x0, by - hi);
  ctx.quadraticCurveTo((x0 + x1) / 2, by - Math.max(hi, ho) - 2.5, x1, by - ho);
  ctx.stroke();
}
function paintEyes(ctx: Ctx, k: { v: number; expr: string }) {
  const E = eyeLayout(k.v);
  for (const e of E) {
    if (k.expr === "dizzy") continue;
    const bw = e.kind === "far" ? 5 : e.kind === "side" ? 6 : 8.5;
    const bx = e.x - e.inner * e.hw * (e.kind === "side" ? 0.2 : 0.35),
      by = e.y + e.hh + 6;
    soft(ctx, 2.6, () => {
      ctx.strokeStyle = "rgba(255,84,96,0.5)";
      ctx.lineWidth = 9;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(bx - bw, by);
      ctx.lineTo(bx + bw, by);
      ctx.stroke();
    });
    ctx.strokeStyle = "rgba(255,236,230,0.7)";
    ctx.lineWidth = 1.1;
    ctx.lineCap = "round";
    const n = e.kind === "far" ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const sx = bx - (n - 1) * 2.4 + i * 4.8;
      ctx.beginPath();
      ctx.moveTo(sx + 1.6, by - 2.4);
      ctx.lineTo(sx - 1.2, by + 2.2);
      ctx.stroke();
    }
  }
  for (const e of E) {
    paintEye(ctx, e, k.expr);
    paintBrow(ctx, e, k.expr);
  }
}
function paintMouth(ctx: Ctx, k: { v: number; m: string }) {
  const M = mouthLayout(k.v);
  const { x, y, wn, wf } = M;
  const X = (u: number) => x + (u < 0 ? u * wn : u * wf);
  ctx.strokeStyle = C_INK;
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const fang = (fx: number, fy: number) => {
    ctx.fillStyle = "#fffaf0";
    ctx.beginPath();
    ctx.moveTo(fx - 2.6, fy);
    ctx.lineTo(fx + 2.6, fy);
    ctx.lineTo(fx + 0.3, fy + 5);
    ctx.closePath();
    ctx.fill();
  };
  if (k.m === "smirk") {
    ctx.beginPath();
    ctx.moveTo(X(-1), y - 1.4);
    ctx.quadraticCurveTo(X(-0.5), y + 5.4, X(0), y + 1);
    ctx.quadraticCurveTo(X(0.5), y + 5.6, X(1), y - 3);
    ctx.stroke();
    if (M.kind !== "side") {
      fang(X(0.42), y + 2.6);
      ctx.beginPath();
      ctx.moveTo(X(1), y - 3);
      ctx.lineTo(X(1) + 2.2, y - 5);
      ctx.stroke();
    } else fang(X(-0.45), y + 2.6);
  } else if (k.m === "grin") {
    const p = new Path2D();
    p.moveTo(X(-1), y - 2);
    p.quadraticCurveTo(X(0), y + 1.8, X(1), y - 4);
    p.quadraticCurveTo(X(0.7), y + 13, X(0), y + 13);
    p.quadraticCurveTo(X(-0.8), y + 12.5, X(-1), y - 2);
    p.closePath();
    ctx.fillStyle = "#5a0c06";
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    ctx.fillStyle = "#ff6a5a";
    ctx.beginPath();
    ctx.arc(X(0) + 1, y + 15, 6.5, 0, TAU);
    ctx.fill();
    ctx.restore();
    fang(X(-0.55), y - 0.6);
    if (M.kind !== "side") fang(X(0.5), y - 1.6);
    ctx.stroke(p);
  } else if (k.m === "o") {
    const r = M.kind === "side" ? 5 : 6;
    const cx = M.kind === "side" ? X(-0.3) : X(0);
    const p = new Path2D();
    p.arc(cx, y + 4, r, 0, TAU);
    ctx.fillStyle = "#5a0c06";
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    ctx.fillStyle = "#ff6a5a";
    ctx.beginPath();
    ctx.arc(cx, y + 10, 4.5, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.stroke(p);
  } else if (k.m === "wavy") {
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const u = -1 + (2 * i) / 24,
        yy = Math.sin(((u + 1) / 2) * TAU * 2) * 2.3 + 1;
      if (i) ctx.lineTo(X(u), y + yy);
      else ctx.moveTo(X(u), y + yy);
    }
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(X(-0.8), y + 2);
    ctx.quadraticCurveTo(X(0), y - 0.8, X(0.8), y + 2);
    ctx.stroke();
  }
}

// ════════════════ ribbon arms ════════════════
function paintArm(
  ctx: Ctx,
  k: { v: number; side: "L" | "R"; pose: string; st: number },
) {
  const V = makeView(VIEW_YAW[k.v]),
    P = ARM_POSES[k.pose],
    st = k.st || 0;
  const M = armModel(k.pose, k.side, st);
  const C0 = M.map((q) => V.P(q.p));
  const ph = st * Math.PI;
  const C = C0.map((q, i) => {
    const a = C0[Math.max(0, i - 1)],
      b = C0[Math.min(C0.length - 1, i + 1)];
    const d = norm2(b.x - a.x, b.y - a.y),
      s = M[i].s,
      w = P.wave * Math.sin(s * TAU * 1.15 + ph) * Math.min(1, s * 3);
    return { x: q.x - d.y * w, y: q.y + d.x * w, z: q.z };
  });
  const END = 0.9;
  const L: P2[] = [],
    R: P2[] = [],
    up: boolean[] = [],
    D: P2[] = [];
  for (let i = 0; i < C.length; i++) {
    const a = C[Math.max(0, i - 1)],
      b = C[Math.min(C.length - 1, i + 1)];
    const d = norm2(b.x - a.x, b.y - a.y);
    D.push(d);
    const s = M[i].s,
      c = Math.cos(P.tw * Math.sin(Math.PI * s * 1.6 + 0.3));
    const hw =
      (s < 0.08
        ? lerp(5, 8.6, s / 0.08)
        : lerp(8.6, 5.8, (s - 0.08) / (END - 0.08))) *
      (0.5 + 0.5 * Math.abs(c));
    L.push({ x: C[i].x - d.y * hw, y: C[i].y + d.x * hw });
    R.push({ x: C[i].x + d.y * hw, y: C[i].y - d.x * hw });
    up.push(c >= 0);
  }
  const last = Math.round(END * (C.length - 1));
  const order: number[] = [];
  for (let i = 0; i < last; i++) order.push(i);
  order.sort((a, b) => C[a].z - C[b].z);
  for (const i of order) {
    const s = M[i].s,
      l = clamp(
        0.62 + 0.25 * Math.sin(s * 9 + st) + (C[i].z > 0 ? 0.08 : -0.06),
      );
    const col = up[i]
      ? ramp(R_TRIM, 0.5 + 0.45 * l)
      : ramp(
          [
            [0, "#d27040"],
            [0.5, "#ffb070"],
            [1, "#ffe2b8"],
          ],
          l,
        );
    ctx.fillStyle = ctx.strokeStyle = rgba(col);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(L[i].x, L[i].y);
    ctx.lineTo(L[i + 1].x, L[i + 1].y);
    ctx.lineTo(R[i + 1].x, R[i + 1].y);
    ctx.lineTo(R[i].x, R[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const inset = (E: P2[], k2: number) =>
    E.map((q, i) => ({ x: lerp(q.x, C[i].x, k2), y: lerp(q.y, C[i].y, k2) }));
  for (const E of [inset(L, 0.22), inset(R, 0.22)]) {
    ctx.strokeStyle = "#ffd36a";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    let on = false;
    for (let i = 0; i <= last; i++) {
      if (up[i]) {
        if (on) ctx.lineTo(E[i].x, E[i].y);
        else ctx.moveTo(E[i].x, E[i].y);
        on = true;
      } else on = false;
    }
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,236,200,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 2; i < last; i++)
    i === 2 ? ctx.moveTo(C[i].x, C[i].y) : ctx.lineTo(C[i].x, C[i].y);
  ctx.stroke();
  const r0 = C[0];
  ctx.fillStyle = "#c98a24";
  for (let j = 0; j < 5; j++) {
    const a = (j / 5) * TAU;
    ctx.beginPath();
    ctx.ellipse(
      r0.x + Math.cos(a) * 3.6,
      r0.y + Math.sin(a) * 3.6,
      3.2,
      2.2,
      a,
      0,
      TAU,
    );
    ctx.fill();
  }
  const kg = ctx.createRadialGradient(r0.x - 1, r0.y - 1, 0.5, r0.x, r0.y, 4);
  kg.addColorStop(0, "#fff4c0");
  kg.addColorStop(1, "#e2a034");
  ctx.fillStyle = kg;
  ctx.beginPath();
  ctx.arc(r0.x, r0.y, 3.4, 0, TAU);
  ctx.fill();
  // the tassel: a gold bead and a flame-shaped bundle of red paper strands
  const e = C[last],
    dir = D[last];
  const bx = e.x + dir.x * 3,
    by = e.y + dir.y * 3;
  const hd = norm2(dir.x * 0.65, dir.y * 0.65 + 0.35);
  const len = 24,
    sgn = st ? -1 : 1,
    tip = { x: bx + hd.x * len, y: by + hd.y * len },
    mid = {
      x: bx + hd.x * len * 0.5 + hd.y * 2.5 * sgn,
      y: by + hd.y * len * 0.5 - hd.x * 2.5 * sgn,
    };
  const tg = ctx.createLinearGradient(bx, by, tip.x, tip.y);
  tg.addColorStop(0, "#ff8a3a");
  tg.addColorStop(0.55, "#e2401a");
  tg.addColorStop(1, "#ffb84a");
  ctx.fillStyle = tg;
  ctx.fill(flamePath({ x: bx, y: by }, mid, tip, 7.4, 0.1, st * 2));
  ctx.strokeStyle = "rgba(255,214,110,0.75)";
  ctx.lineWidth = 0.8;
  for (const o of [-2.6, 0, 2.6]) {
    ctx.beginPath();
    ctx.moveTo(bx - hd.y * o * 0.6, by + hd.x * o * 0.6);
    ctx.quadraticCurveTo(
      mid.x - hd.y * o,
      mid.y + hd.x * o,
      tip.x - hd.y * o * 0.4 - hd.x * 3,
      tip.y + hd.x * o * 0.4 - hd.y * 3,
    );
    ctx.stroke();
  }
  const bg = ctx.createRadialGradient(bx - 1.2, by - 1.2, 0.4, bx, by, 4.6);
  bg.addColorStop(0, "#fff6c8");
  bg.addColorStop(0.55, "#f0b23a");
  bg.addColorStop(1, "#8a4c0c");
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(bx, by, 5, 0, TAU);
  ctx.fill();
}

// ════════════════ crown curl, wick, flame heart, scorch, crumple, small sprites ════════════════
function paintCurl(ctx: Ctx, k: { v: number }) {
  const V = makeView(VIEW_YAW[k.v]);
  const a = V.P({ x: 0, y: 0, z: 0 }),
    b = V.P({ x: 0, y: 17, z: -6 }),
    c = V.P({ x: 0, y: 30, z: 13 });
  const p = flamePath(a, b, c, 8.5, 0.05);
  const g = ctx.createLinearGradient(a.x, a.y, c.x, c.y);
  g.addColorStop(0, "#ffe2a0");
  g.addColorStop(0.45, "#ff9c3e");
  g.addColorStop(1, "#d8401a");
  ctx.save();
  ctx.shadowColor = "rgba(90,20,4,0.35)";
  ctx.shadowBlur = 3 * PQ;
  ctx.shadowOffsetY = 1.5 * PQ;
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.restore();
  ctx.save();
  ctx.clip(p);
  ctx.strokeStyle = "rgba(255,248,220,0.6)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(a.x - 1.5, a.y - 2);
  ctx.quadraticCurveTo(b.x - 2, b.y, c.x, c.y);
  ctx.stroke();
  ctx.restore();
  const kg = ctx.createLinearGradient(-9, a.y - 3, 9, a.y + 3);
  kg.addColorStop(0, "#fff0b0");
  kg.addColorStop(0.5, "#e8a630");
  kg.addColorStop(1, "#8a4a0a");
  ctx.fillStyle = kg;
  ctx.beginPath();
  ctx.ellipse(a.x, a.y + 1, 9.5, 4.4, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#6a3606";
  ctx.lineWidth = 1;
  ctx.stroke();
}
function paintWick(ctx: Ctx, k: { seed: number }) {
  const r = rng(k.seed);
  const bend = (r() - 0.5) * 12,
    tip = (r() - 0.5) * 16;
  const p = flamePath(
    { x: 0, y: 2 },
    { x: bend, y: 20 },
    { x: tip + bend * 0.5, y: 42 + r() * 6 },
    13.5,
    0.12,
    r() * 6,
  );
  const g = ctx.createLinearGradient(0, 0, 0, 50);
  g.addColorStop(0, "rgba(255,250,214,1)");
  g.addColorStop(0.25, "rgba(255,206,90,0.98)");
  g.addColorStop(0.6, "rgba(255,120,34,0.92)");
  g.addColorStop(1, "rgba(214,46,14,0.4)");
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.fillStyle = "rgba(255,252,226,0.9)";
  ctx.fill(
    flamePath(
      { x: 0, y: 1 },
      { x: bend * 0.5, y: 10 },
      { x: bend * 0.6, y: 22 },
      4.6,
    ),
  );
  const cg = ctx.createRadialGradient(-1.2, -1.2, 0.5, 0, 0, 6.5);
  cg.addColorStop(0, "#fffbe6");
  cg.addColorStop(0.55, "#ffcc4a");
  cg.addColorStop(1, "#d2541a");
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(0, 0, 6.2, 0, TAU);
  ctx.fill();
}
function paintHeart(ctx: Ctx) {
  const heart = new Path2D();
  heart.moveTo(0, 22);
  heart.bezierCurveTo(-8, 15, -26, 4, -24, -10);
  heart.bezierCurveTo(-22, -24, -6, -26, 0, -13);
  heart.bezierCurveTo(6, -26, 22, -24, 24, -10);
  heart.bezierCurveTo(26, 4, 8, 15, 0, 22);
  heart.closePath();
  ctx.fillStyle = "rgba(255,140,40,0.9)";
  ctx.fill(
    flamePath({ x: -12, y: -16 }, { x: -15, y: -28 }, { x: -9, y: -40 }, 6),
  );
  ctx.fill(
    flamePath({ x: 12, y: -16 }, { x: 15, y: -27 }, { x: 10, y: -37 }, 5.5),
  );
  const g = ctx.createRadialGradient(-4, -6, 2, 0, 0, 28);
  g.addColorStop(0, "#fffef0");
  g.addColorStop(0.35, "#ffe27a");
  g.addColorStop(0.7, "#ff8a2a");
  g.addColorStop(1, "#d23a14");
  ctx.fillStyle = g;
  ctx.fill(heart);
  ctx.strokeStyle = "rgba(255,250,220,0.85)";
  ctx.lineWidth = 1.6;
  ctx.stroke(heart);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.ellipse(-11, -11, 5, 3, -0.6, 0, TAU);
  ctx.fill();
}
function paintBurn(ctx: Ctx, k: { seed: number; s?: number; hole?: boolean }) {
  const r = rng(k.seed),
    n = 11,
    s = k.s || 1,
    pts: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU,
      rr = s * (8 + r() * 6);
    pts.push({ x: Math.cos(a) * rr * 1.1, y: Math.sin(a) * rr * 0.85 });
  }
  const p = new Path2D();
  pts.forEach((q, i) => {
    const nq = pts[(i + 1) % n];
    const mx = (q.x + nq.x) / 2,
      my = (q.y + nq.y) / 2;
    if (i) p.quadraticCurveTo(q.x, q.y, mx, my);
    else p.moveTo(mx, my);
  });
  p.quadraticCurveTo(
    pts[0].x,
    pts[0].y,
    (pts[0].x + pts[1].x) / 2,
    (pts[0].y + pts[1].y) / 2,
  );
  soft(ctx, 1.4, () => {
    ctx.fillStyle = "rgba(150,50,10,0.45)";
    ctx.save();
    ctx.scale(1.25, 1.25);
    ctx.fill(p);
    ctx.restore();
  });
  const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 14 * s);
  g.addColorStop(0, "rgba(46,12,4,0.95)");
  g.addColorStop(0.6, "rgba(90,26,6,0.85)");
  g.addColorStop(1, "rgba(130,44,10,0.6)");
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.strokeStyle = "rgba(255,150,50,0.9)";
  ctx.lineWidth = 1.3;
  ctx.stroke(p);
  if (k.hole) {
    const h = new Path2D();
    h.ellipse(0.5, 0.5, 5.5 * s, 4.4 * s, 0.3, 0, TAU);
    const hg = ctx.createRadialGradient(0, 0, 0, 0, 0, 6 * s);
    hg.addColorStop(0, "#fffbe0");
    hg.addColorStop(0.6, "#ffd060");
    hg.addColorStop(1, "#ff8a2a");
    ctx.fillStyle = hg;
    ctx.fill(h);
  }
}
function paintCrumple(ctx: Ctx) {
  const pts = [
    [-82, 0],
    [-74, -22],
    [-52, -40],
    [-26, -50],
    [4, -46],
    [30, -54],
    [56, -38],
    [74, -20],
    [82, 0],
  ];
  const p = new Path2D();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++)
    p.quadraticCurveTo(
      pts[i][0],
      pts[i][1],
      (pts[i][0] + pts[i + 1][0]) / 2,
      (pts[i][1] + pts[i + 1][1]) / 2,
    );
  p.lineTo(82, 0);
  p.quadraticCurveTo(0, 10, -82, 0);
  p.closePath();
  const g = ctx.createLinearGradient(-40, -54, 30, 8);
  g.addColorStop(0, "#d8c6a6");
  g.addColorStop(0.55, "#c0a684");
  g.addColorStop(1, "#8c7254");
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  ctx.fillStyle = "#b23a1c";
  ctx.beginPath();
  ctx.moveTo(-90, -8);
  ctx.bezierCurveTo(-50, -22, -20, -4, 10, -16);
  ctx.bezierCurveTo(40, -28, 60, -10, 90, -18);
  ctx.lineTo(90, -6);
  ctx.bezierCurveTo(60, 2, 40, -16, 10, -4);
  ctx.bezierCurveTo(-20, 8, -50, -10, -90, 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#d9b45c";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  for (const [x0, y0, x1, y1] of [
    [-58, -30, -40, -12],
    [-30, -46, -14, -24],
    [8, -42, 22, -24],
    [34, -46, 50, -30],
    [60, -30, 70, -14],
  ]) {
    ctx.strokeStyle = "rgba(96,68,44,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2 + 4, (y0 + y1) / 2, x1, y1);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,248,232,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0 + 1.6, y0 + 0.4);
    ctx.quadraticCurveTo(
      (x0 + x1) / 2 + 5.6,
      (y0 + y1) / 2 + 0.4,
      x1 + 1.6,
      y1 + 0.4,
    );
    ctx.stroke();
  }
  innerGlow(ctx, p, "rgba(70,40,20,0.55)", 12, -4, 0);
  innerGlow(ctx, p, "rgba(255,246,226,0.5)", 4, 2, 2);
  ctx.restore();
  ctx.lineCap = "round";
  ctx.strokeStyle = "#5e3410";
  ctx.lineWidth = 5.6;
  ctx.beginPath();
  ctx.ellipse(6, -1, 62, 11, 0.04, 0.08 * Math.PI, 0.94 * Math.PI);
  ctx.stroke();
  ctx.strokeStyle = "#b98a50";
  ctx.lineWidth = 2.8;
  ctx.stroke();
  [
    [-44, -30],
    [36, -36],
    [-6, -40],
  ].forEach(([bx, by], i) => {
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(0.6, 0.6);
    paintBurn(ctx, { seed: 90 + i });
    ctx.restore();
  });
}
function paintFlame(ctx: Ctx, k: { seed: number }) {
  const r = rng(k.seed);
  const b = { x: (r() - 0.5) * 8, y: -22 },
    t = { x: (r() - 0.5) * 10, y: -46 - r() * 8 };
  const g = ctx.createLinearGradient(0, 4, 0, -50);
  g.addColorStop(0, "rgba(200,40,10,0.9)");
  g.addColorStop(0.35, "rgba(255,110,30,0.95)");
  g.addColorStop(0.8, "rgba(255,200,80,0.9)");
  g.addColorStop(1, "rgba(255,240,180,0.6)");
  ctx.fillStyle = g;
  ctx.fill(flamePath({ x: 0, y: 0 }, b, t, 11, 0.15));
  ctx.fillStyle = "rgba(255,240,170,0.85)";
  ctx.fill(
    flamePath(
      { x: 0, y: -4 },
      { x: b.x * 0.6, y: -18 },
      { x: t.x * 0.5, y: -34 },
      4.5,
    ),
  );
}
function paintStar(ctx: Ctx) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5,
      r = i % 2 ? 4 : 10;
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

// ════════════════ the piece list and the atlas ════════════════
/** Atlas px per rig unit, by part. Fixed: it never follows devicePixelRatio. */
const QUAL = {
  body: 1.45,
  dim: 0.9,
  face: 1.85,
  mouth: 2.4,
  arm: 0.8,
  curl: 1.6,
  wick: 1.4,
  heart: 1.5,
  mark: 1.5,
  crumple: 1.0,
  heat: 0.5,
  fx: 0.9,
};
export const LUMI_ATLAS_BUDGET = 8 * 1024 * 1024;
const BODY_BOX: [number, number, number, number] = [
  -L_R - 14,
  yS(L_TOP) - 12,
  L_R + 14,
  yS(L_BOT) + 34,
];
export interface PieceSpec {
  name: string;
  /** [x0, y0, x1, y1] in rig units (generous). */
  box: [number, number, number, number];
  q: number;
  paint: (ctx: Ctx) => void;
  outline?: boolean;
  grain?: boolean;
  line?: number;
  lineColor?: string;
}
/** Every piece Lumiwick is drawn from (names are what the pose places). */
export function lumiwickPieces(): PieceSpec[] {
  const L: PieceSpec[] = [];
  const LINE = "rgba(110,30,8,0.92)";
  const add = (s: PieceSpec) => L.push(s);
  for (let v = 0; v < 5; v++) {
    add({
      name: `body_${v}`,
      box: BODY_BOX,
      q: QUAL.body,
      paint: (c) => paintBody(c, { v, lit: 1 }),
      line: 1.9,
      lineColor: LINE,
    });
    add({
      name: `dim_${v}`,
      box: BODY_BOX,
      q: QUAL.dim,
      paint: (c) => paintBody(c, { v, lit: 0 }),
      line: 1.9,
      lineColor: "rgba(70,46,30,0.9)",
    });
    add({
      name: `curl_${v}`,
      box: [-30, -46, 30, 12],
      q: QUAL.curl,
      paint: (c) => paintCurl(c, { v }),
      line: 1.3,
      lineColor: LINE,
    });
    for (const side of ["L", "R"] as const) {
      if ((v === 0 || v === 4) && side === "R") continue;
      for (const pose of ARM_POSE_NAMES)
        for (let st = 0; st < armStates(pose); st++)
          add({
            name: `arm_${v}_${side}_${pose}_${st}`,
            box: [-150, -150, 150, 150],
            q: QUAL.arm,
            paint: (c) => paintArm(c, { v, side, pose, st }),
            line: 1.1,
            lineColor: LINE,
          });
    }
  }
  for (let v = 0; v < 3; v++) {
    for (const e of EXPRS)
      add({
        name: `eyes_${v}_${e}`,
        box: [-80, -52, 80, 62],
        q: QUAL.face,
        paint: (c) => paintEyes(c, { v, expr: e }),
        outline: false,
      });
    for (const m of MOUTHS)
      add({
        name: `mouth_${v}_${m}`,
        box: [-80, 14, 80, 72],
        q: QUAL.mouth,
        paint: (c) => paintMouth(c, { v, m }),
        outline: false,
      });
  }
  add({
    name: "heat",
    box: BODY_BOX,
    q: QUAL.heat,
    paint: paintHeat,
    outline: false,
  });
  add({
    name: "halo",
    box: [-110, -120, 110, 110],
    q: QUAL.heat,
    paint: paintHalo,
    outline: false,
  });
  add({
    name: "crumple",
    box: [-90, -70, 90, 14],
    q: QUAL.crumple,
    paint: paintCrumple,
    line: 1.6,
    lineColor: "rgba(60,40,26,0.9)",
  });
  for (let i = 0; i < 3; i++)
    add({
      name: `wick_${i}`,
      box: [-24, -10, 24, 60],
      q: QUAL.wick,
      paint: (c) => paintWick(c, { seed: 3 + i * 17 }),
      outline: false,
    });
  for (let i = 0; i < 3; i++)
    add({
      name: `flame_${i}`,
      box: [-20, -64, 20, 10],
      q: QUAL.fx,
      paint: (c) => paintFlame(c, { seed: 5 + i * 13 }),
      outline: false,
    });
  add({
    name: "heart",
    box: [-34, -46, 34, 28],
    q: QUAL.heart,
    paint: paintHeart,
    line: 1.2,
    lineColor: "rgba(150,40,6,0.9)",
  });
  for (let i = 0; i < 3; i++)
    add({
      name: `burn_${i}`,
      box: [-22, -18, 22, 18],
      q: QUAL.mark,
      paint: (c) => paintBurn(c, { seed: 21 + i * 7, s: 1 - i * 0.15 }),
      outline: false,
      grain: false,
    });
  add({
    name: "hole",
    box: [-22, -18, 22, 18],
    q: QUAL.mark,
    paint: (c) => paintBurn(c, { seed: 44, s: 1.1, hole: true }),
    outline: false,
  });
  add({
    name: "star",
    box: [-12, -12, 12, 12],
    q: QUAL.fx * 1.5,
    paint: paintStar,
    outline: false,
  });
  return L;
}
export interface AtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Atlas px per rig unit. */
  q: number;
  /** The piece's origin (its local 0,0) inside the frame, as a 0-1 fraction. */
  ox: number;
  oy: number;
}
export interface LumiAtlas {
  canvas: HTMLCanvasElement;
  frames: Record<string, AtlasFrame>;
  bytes: number;
}
/** One piece painted, outlined and grained into its own canvas: its whole box plus a pad. */
export interface LumiPiece {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  /** Canvas px per rig unit. */
  q: number;
  /** The piece's origin (its local 0,0) in canvas px. */
  ox: number;
  oy: number;
}
/**
 * Pieces painted lately, held weakly: the briefing's picture and the battle
 * atlas reuse each other's pieces while they are still in memory, and add
 * nothing to keep when neither is open.
 */
const lately = new Map<
  string,
  {
    ref: WeakRef<HTMLCanvasElement>;
    w: number;
    h: number;
    q: number;
    ox: number;
    oy: number;
  }
>();
/** Paint one piece at `density` (no pixel is read back). */
export function paintLumiwickPiece(
  base: PieceSpec,
  density = 1,
  soft = false,
): LumiPiece {
  const key = `${base.name}@${density}`,
    known = lately.get(key),
    kept = known?.ref.deref();
  if (known && kept && kept.width === known.w)
    return { ...known, canvas: kept };
  const pad = 6;
  const s = { ...base, q: base.q * density };
  const w = Math.ceil((s.box[2] - s.box[0]) * s.q) + pad * 2,
    h = Math.ceil((s.box[3] - s.box[1]) * s.q) + pad * 2;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  SOFT = soft;
  const g = ctx2d(c);
  PQ = s.q;
  g.translate(pad - s.box[0] * s.q, pad - s.box[1] * s.q);
  g.scale(s.q, s.q);
  g.lineJoin = "round";
  s.paint(g);
  let src = c;
  if (s.outline !== false) {
    const d = document.createElement("canvas");
    d.width = w;
    d.height = h;
    const dg = ctx2d(d);
    dg.shadowColor = s.lineColor || "rgba(74,18,6,0.95)";
    dg.shadowBlur = (s.line || 1.6) * s.q;
    dg.drawImage(c, 0, 0);
    dg.shadowBlur = (s.line || 1.6) * s.q * 0.45;
    dg.drawImage(c, 0, 0);
    dg.shadowColor = "transparent";
    dg.drawImage(c, 0, 0);
    if (s.grain !== false) {
      dg.globalCompositeOperation = "source-atop";
      dg.fillStyle = dg.createPattern(grainCanvas(), "repeat")!;
      dg.fillRect(0, 0, w, h);
    }
    src = d;
  }
  SOFT = false;
  const out = {
    w,
    h,
    q: s.q,
    ox: pad - s.box[0] * s.q,
    oy: pad - s.box[1] * s.q,
  };
  lately.set(key, { ...out, ref: new WeakRef(src) });
  return { ...out, canvas: src };
}
/** The last battle atlas: its canvas held weakly (the battle's texture keeps it), its small frame table not. */
let lastAtlas:
  | {
      ref: WeakRef<HTMLCanvasElement>;
      frames: Record<string, AtlasFrame>;
      bytes: number;
    }
  | undefined;
/** The battle atlas, if one was painted and is still in memory (the briefing reuses it). */
export function paintedLumiwickAtlas(): LumiAtlas | undefined {
  const canvas = lastAtlas?.ref.deref();
  return canvas && canvas.width > 0 && lastAtlas
    ? { canvas, frames: lastAtlas.frames, bytes: lastAtlas.bytes }
    : undefined;
}
/**
 * Paint every piece once, trim it, shelf-pack the lot into one canvas.
 * Runs at scene creation.
 */
export function paintLumiwickAtlas(density = 1): LumiAtlas {
  const done: {
    name: string;
    img: HTMLCanvasElement;
    q: number;
    ox: number;
    oy: number;
  }[] = [];
  for (const base of lumiwickPieces()) {
    // density > 1 only for posters (the splash art); battle keeps 1
    const { canvas: src, w, h, q, ox, oy } = paintLumiwickPiece(base, density);
    const data = src.getContext("2d")!.getImageData(0, 0, w, h).data;
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
    if (x1 < 0) continue;
    x0 = Math.max(0, x0 - 1);
    y0 = Math.max(0, y0 - 1);
    x1 = Math.min(w - 1, x1 + 1);
    y1 = Math.min(h - 1, y1 + 1);
    const tw = x1 - x0 + 1,
      th = y1 - y0 + 1;
    const img = document.createElement("canvas");
    img.width = tw;
    img.height = th;
    img.getContext("2d")!.drawImage(src, x0, y0, tw, th, 0, 0, tw, th);
    done.push({ name: base.name, img, q, ox: ox - x0, oy: oy - y0 });
  }
  done.sort((a, b) => b.img.height - a.img.height);
  const W = 2048;
  let px = 0,
    py = 0,
    shelf = 0;
  const spots: { d: (typeof done)[number]; x: number; y: number }[] = [];
  for (const d of done) {
    if (px + d.img.width > W) {
      px = 0;
      py += shelf + 2;
      shelf = 0;
    }
    spots.push({ d, x: px, y: py });
    px += d.img.width + 2;
    shelf = Math.max(shelf, d.img.height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = Math.max(1, py + shelf + 1);
  const ctx = canvas.getContext("2d")!;
  const frames: Record<string, AtlasFrame> = {};
  for (const s of spots) {
    ctx.drawImage(s.d.img, s.x, s.y);
    frames[s.d.name] = {
      x: s.x,
      y: s.y,
      w: s.d.img.width,
      h: s.d.img.height,
      q: s.d.q,
      ox: s.d.ox / s.d.img.width,
      oy: s.d.oy / s.d.img.height,
    };
  }
  const bytes = canvas.width * canvas.height * 4;
  if (density === 1) lastAtlas = { ref: new WeakRef(canvas), frames, bytes };
  return { canvas, frames, bytes };
}
