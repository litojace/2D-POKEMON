// @ts-nocheck
/**
 * Inkpurr's painters, ported from the approved demo (scratchpad hd-ink):
 * pure canvas drawing (ctx, k) for every piece, in every one of the five
 * drawn views, plus the small 3D build used only while painting. Nothing
 * here runs per frame: boss-inkpurr-rig.ts draws all of it once into one
 * atlas at scene creation (buildInkAtlas) and then only places images.
 *
 * Plain canvas drawing code without types, like the farm painters
 * (farm-gfx.ts); the typed API is boss-inkpurr.ts.
 *
 * Rig units: x = its left, y = up, z = forward; a view is a yaw about y with
 * a fixed 14 degree camera pitch. Screen = (x, -y).
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

function norm2(x, y) {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
}
const qbez = (a, b, c, t) => ({
  x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * b.x + t * t * c.x,
  y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * b.y + t * t * c.y,
});
/** Atlas px per rig px of the piece being painted (blur radii and shadows are in canvas px). */
let PQ = 1;
// ── paper grain (one small pattern, laid over every painted piece) ──
let GRAIN = null;
function grainCanvas() {
  if (GRAIN) return GRAIN;
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const g = c.getContext("2d"),
    r = rng(77);
  for (let i = 0; i < 520; i++) {
    const v = r();
    g.fillStyle =
      v < 0.5
        ? `rgba(8,4,24,${0.04 + r() * 0.06})`
        : `rgba(200,190,255,${0.025 + r() * 0.035})`;
    g.fillRect(r() * 96, r() * 96, 1 + r() * 1.6, 1 + r() * 1.2);
  }
  g.lineCap = "round";
  for (let i = 0; i < 26; i++) {
    const x = r() * 96,
      y = r() * 96,
      a = -0.7 + r() * 0.3,
      l = 5 + r() * 12;
    g.strokeStyle = r() < 0.5 ? "rgba(200,190,255,0.05)" : "rgba(8,4,24,0.06)";
    g.lineWidth = 0.8 + r();
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  return (GRAIN = c);
}

const B_TOP = 80,
  B_BOT = -56,
  B_R = 80;
/** Radius of the blob at height y: a round dome, a full belly, a soft wide base that sits on its puddle. */
function blobR(y) {
  const t = clamp((B_TOP - y) / (B_TOP - B_BOT));
  let r;
  if (t < 0.56) {
    const u = (0.56 - t) / 0.56;
    r = Math.pow(Math.max(0, 1 - Math.pow(u, 2.3)), 1 / 2.3);
  } else
    r =
      1 +
      0.05 * Math.sin(Math.PI * smooth(0.56, 0.9, t)) -
      0.2 * Math.pow(smooth(0.82, 1, t), 1.7);
  return B_R * r;
}
/** A point on the surface at angle phi round the axis (0 = the way it faces, + = its left), height y, pushed out by `out`. */
function surf(phi, y, out = 0) {
  const r = blobR(y) + out;
  return { x: r * Math.sin(phi), y, z: r * Math.cos(phi) };
}
function surfVisible(V, phi, y) {
  const d = (blobR(y + 1) - blobR(y - 1)) / 2;
  return V.N(norm3(Math.sin(phi), -d, Math.cos(phi))).z > 0.02;
}
const yS = (y) => -y * CP; // screen y of the axis at height y
/** Front arc of the ring at height y (the near half, seen from a little above). */
function frontArc(
  path,
  y,
  out = 0,
  from = -Math.PI / 2,
  to = Math.PI / 2,
  move = true,
) {
  const r = blobR(y) + out,
    n = 40;
  for (let i = 0; i <= n; i++) {
    const a = from + ((to - from) * i) / n;
    const x = r * Math.sin(a),
      sy = yS(y) + r * Math.cos(a) * SP;
    if (i === 0 && move) path.moveTo(x, sy);
    else path.lineTo(x, sy);
  }
  return path;
}
/** The blob's outline: the union of every horizontal ring (the same in all views). */
function silPath() {
  const p = new Path2D();
  for (let i = 0; i <= 120; i++) {
    const y = B_BOT + ((B_TOP - B_BOT) * i) / 120,
      r = blobR(y);
    if (r < 0.5) continue;
    p.moveTo(r, yS(y));
    p.ellipse(0, yS(y), r, r * SP, 0, 0, TAU);
  }
  return p;
}
/** Soft lobes round the base: the ink sagging into little hanging drops (they make the wobbly edge). */
const LOBES = Array.from({ length: 9 }, (_, i) => ({
  phi: (i / 9) * TAU + 0.21,
  w: 14 + ((i * 5) % 4) * 1.6,
  len: 4 + ((i * 7) % 5) * 1.3,
}));
function lobePath(p, V, L, grow = 0) {
  const q = V.P(surf(L.phi, B_BOT + 7, -4));
  const w = L.w,
    len = L.len + grow,
    x = q.x,
    y = q.y;
  p.moveTo(x - w, y - 10);
  p.bezierCurveTo(x - w, y + len * 0.45, x - w * 0.62, y + len, x, y + len);
  p.bezierCurveTo(x + w * 0.62, y + len, x + w, y + len * 0.45, x + w, y - 10);
  p.bezierCurveTo(x + w * 0.5, y - 16, x - w * 0.5, y - 16, x - w, y - 10);
  p.closePath();
}
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
  const g = c.getContext("2d");
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

// ── palette: deep indigo-violet ink, a cool moonlit rim, gold and amber accents ──
const C_INK = "#07030f";
const INK_TOP = "#3e3082",
  INK_MID = "#2a1f62",
  INK_BOT = "#130b30";
const RIM = "rgba(176,198,255,0.95)";

// ════════════════ ears ════════════════
const EAR_PHI = 0.6,
  EAR_Y = 54;
/** One cat ear in a view: screen outline, inner ear, depth and how much of its front shows. side +1 = its left. */
function earGeom(V, side) {
  const phi = side * EAR_PHI;
  const c = surf(phi, EAR_Y, -5);
  const tan = { x: Math.cos(phi), y: 0, z: -Math.sin(phi) };
  const tip = { x: c.x + side * 17, y: c.y + 46, z: c.z - 3 };
  const P1 = V.P({ x: c.x + tan.x * 22, y: c.y, z: c.z + tan.z * 22 }),
    P2 = V.P({ x: c.x - tan.x * 22, y: c.y, z: c.z - tan.z * 22 }),
    T = V.P(tip);
  // an ear is a soft cone, not a sheet of paper: seen edge-on it keeps some width
  const half = Math.abs(P1.x - P2.x) / 2,
    minHalf = 13;
  if (half < minHalf) {
    const mx = (P1.x + P2.x) / 2,
      s = P1.x >= P2.x ? 1 : -1;
    P1.x = mx + s * minHalf;
    P2.x = mx - s * minHalf;
  }
  const front = V.N(norm3(Math.sin(phi) * 0.35, 0.25, Math.cos(phi))).z;
  return { P1, P2, T, z: V.P(c).z, front };
}
/** A rounded ear shape through base corners a, b and tip t: convex sides, a round tip, a base sunk into the head. */
function earShape(a, b, t, bulge = 4.5, sink = 7) {
  const cx = (a.x + b.x + t.x) / 3,
    cy = (a.y + b.y + t.y) / 3;
  const bul = (m) => {
    const d = norm2(m.x - cx, m.y - cy);
    return { x: m.x + d.x * bulge, y: m.y + d.y * bulge };
  };
  const A1 = { x: lerp(a.x, t.x, 0.84), y: lerp(a.y, t.y, 0.84) },
    A2 = { x: lerp(b.x, t.x, 0.84), y: lerp(b.y, t.y, 0.84) };
  const m1 = bul({ x: (a.x + A1.x) / 2, y: (a.y + A1.y) / 2 }),
    m2 = bul({ x: (b.x + A2.x) / 2, y: (b.y + A2.y) / 2 });
  const p = new Path2D();
  p.moveTo(a.x, a.y);
  p.quadraticCurveTo(m1.x, m1.y, A1.x, A1.y);
  p.quadraticCurveTo(t.x, t.y, A2.x, A2.y);
  p.quadraticCurveTo(m2.x, m2.y, b.x, b.y);
  p.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + sink, a.x, a.y);
  p.closePath();
  return p;
}
function paintEar(ctx, E) {
  const p = earShape(E.P1, E.P2, E.T);
  const mid = { x: (E.P1.x + E.P2.x) / 2, y: (E.P1.y + E.P2.y) / 2 };
  const g = ctx.createLinearGradient(mid.x, mid.y, E.T.x, E.T.y);
  g.addColorStop(0, INK_TOP);
  g.addColorStop(1, "#2c2168");
  ctx.fillStyle = g;
  ctx.fill(p);
  // inner ear: a violet-pink hollow, shown as much as the ear's front faces us
  const f = smooth(0.0, 0.55, E.front);
  if (f > 0.02) {
    const k = 0.34;
    const a = { x: lerp(E.P1.x, mid.x, k), y: lerp(E.P1.y, mid.y, k) - 2 },
      b = { x: lerp(E.P2.x, mid.x, k), y: lerp(E.P2.y, mid.y, k) - 2 };
    const t = { x: lerp(E.T.x, mid.x, 0.2), y: lerp(E.T.y, mid.y, 0.2) };
    const ip = earShape(a, b, t, 2.5, 3);
    const ig = ctx.createLinearGradient(mid.x, mid.y, t.x, t.y);
    ig.addColorStop(0, `rgba(150,96,226,${0.9 * f})`);
    ig.addColorStop(1, `rgba(222,150,255,${0.95 * f})`);
    ctx.fillStyle = ig;
    ctx.fill(ip);
    ctx.save();
    ctx.clip(ip);
    soft(ctx, 2, () => {
      ctx.strokeStyle = `rgba(40,16,80,${0.5 * f})`;
      ctx.lineWidth = 5;
      ctx.stroke(ip);
    });
    ctx.restore();
  }
  // moonlit rim on the right edge, shade on the left
  ctx.save();
  ctx.clip(p);
  soft(ctx, 1.4, () => {
    ctx.strokeStyle = "rgba(186,206,255,0.85)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    const r = E.P1.x > E.P2.x ? E.P1 : E.P2;
    ctx.moveTo(r.x, r.y);
    ctx.quadraticCurveTo(
      (r.x + E.T.x) / 2 + 3,
      (r.y + E.T.y) / 2,
      E.T.x,
      E.T.y,
    );
    ctx.stroke();
  });
  ctx.restore();
}

// ════════════════ body ════════════════
function bodyPath(V, ears) {
  const p = silPath();
  for (const L of LOBES) lobePath(p, V, L);
  if (ears)
    for (const s of [1, -1]) {
      const E = earGeom(V, s);
      p.addPath(earShape(E.P1, E.P2, E.T));
    }
  return p;
}
/** The ink body in view k.v (or k.yaw): glossy deep indigo, moonlit rim, a violet depth glow, the far ear behind and the near ear in front. */
function paintBody(ctx, k) {
  const yaw = k.yaw != null ? k.yaw : VIEWS[k.v].yaw,
    V = makeView(yaw);
  const sil = silPath();
  for (const L of LOBES) lobePath(sil, V, L);
  const top = yS(B_TOP),
    bot = yS(B_BOT) + 30;
  const ears = [1, -1].map((s) => earGeom(V, s)).sort((a, b) => a.z - b.z);
  for (const E of ears) if (E.z < 0) paintEar(ctx, E);
  ctx.save();
  ctx.clip(sil);
  const W = B_R + 30;
  const g = ctx.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, INK_TOP);
  g.addColorStop(0.45, INK_MID);
  g.addColorStop(1, INK_BOT);
  ctx.fillStyle = g;
  ctx.fillRect(-W, top - 20, 2 * W, bot - top + 40);
  // key light from the upper left
  const kg = ctx.createRadialGradient(-30, yS(46), 4, -18, yS(30), 110);
  kg.addColorStop(0, "rgba(140,118,240,0.45)");
  kg.addColorStop(0.55, "rgba(110,90,210,0.12)");
  kg.addColorStop(1, "rgba(100,80,200,0)");
  ctx.fillStyle = kg;
  ctx.fillRect(-W, top - 20, 2 * W, bot - top + 40);
  // depth: a violet glow deep in the ink, low and a little behind the face
  const dg = ctx.createRadialGradient(8, yS(-18), 2, 0, yS(-14), 70);
  dg.addColorStop(0, "rgba(150,80,230,0.32)");
  dg.addColorStop(1, "rgba(120,60,210,0)");
  ctx.fillStyle = dg;
  ctx.fillRect(-W, top - 20, 2 * W, bot - top + 40);
  // slow swirls in the ink: soft latitude arcs, turned with the view
  soft(ctx, 2.2, () => {
    ctx.lineCap = "round";
    const sw = [
      [20, 0.9, 1.1],
      [-6, -0.4, 1.4],
      [-34, 1.9, 0.9],
    ];
    for (const [y, a0, len] of sw) {
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const phi = a0 + (i / 24) * len;
        if (!surfVisible(V, phi + 0, y)) {
          pts.push(null);
          continue;
        }
        pts.push(V.P(surf(phi, y, 0.5)));
      }
      ctx.strokeStyle = "rgba(150,130,255,0.16)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      let on = false;
      for (const q of pts) {
        if (!q) {
          on = false;
          continue;
        }
        on ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
        on = true;
      }
      ctx.stroke();
    }
  });
  // edges: deep ink at the outline, a cool moonlit rim (right and top), violet bounce below
  innerGlow(ctx, sil, "rgba(6,3,20,0.95)", 16);
  innerGlow(ctx, sil, "rgba(6,3,20,0.7)", 10, 6, -2);
  innerGlow(ctx, sil, RIM, 4.5, -3.4, 2.4);
  innerGlow(ctx, sil, "rgba(150,110,255,0.55)", 8, 0, -4.5);
  // gloss: a big soft sheen up and to the left, a sharp glint and a lower reflected band
  soft(ctx, 5, () => {
    ctx.fillStyle = "rgba(214,206,255,0.34)";
    ctx.beginPath();
    ctx.ellipse(-38, yS(50), 15, 26, 0.55, 0, TAU);
    ctx.fill();
  });
  ctx.fillStyle = "rgba(246,244,255,0.9)";
  ctx.beginPath();
  ctx.ellipse(-44, yS(56), 4.2, 7.6, 0.55, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-34, yS(66), 2.2, 0, TAU);
  ctx.fill();
  soft(ctx, 1.6, () => {
    ctx.strokeStyle = "rgba(190,200,255,0.4)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(-6, yS(4), 72, 0.18 * Math.PI, 0.42 * Math.PI);
    ctx.stroke();
  });
  ctx.restore();
  for (const E of ears) if (E.z >= 0) paintEar(ctx, E);
}
/** Phase 2–3: the ink gets darker and more liquid (an overlay; the gloss and rim stay on top in the body). */
function paintDeep(ctx, k) {
  const V = makeView(VIEWS[k.v].yaw);
  const p = bodyPath(V, true);
  ctx.save();
  ctx.clip(p);
  const g = ctx.createRadialGradient(-30, yS(44), 6, -10, yS(20), 130);
  g.addColorStop(0, "rgba(10,4,26,0)");
  g.addColorStop(0.35, "rgba(10,4,26,0.35)");
  g.addColorStop(1, "rgba(4,1,12,0.95)");
  ctx.fillStyle = g;
  ctx.fillRect(-120, -140, 240, 260);
  // the moonlit rim survives the dark
  innerGlow(ctx, p, "rgba(186,170,255,0.9)", 3.5, -3, 2);
  ctx.restore();
}

// ════════════════ face: each eye its own drawing per view ════════════════
// A front pair; at ¾ a near eye (full width) and a far eye (a narrower
// opening tucked toward the far edge, outer corner lifted); at the side one
// profile eye, fully inside the outline. The iris, pupil and glints are
// always the same circles, clipped by the opening and curved lids. The face
// is never squashed with the body: the rig only moves it.
const FACE_YAW = [0, 36 * DEG, 66 * DEG];
const faceYawOf = (bodyYaw) =>
  bodyYaw <= 45 * DEG
    ? bodyYaw * 0.8
    : 36 * DEG + (bodyYaw - 45 * DEG) * (30 / 45);
const EYE_PHI = 0.36,
  EYE_Y = 8,
  MOUTH_Y = -22,
  GEM_Y = 40;
const EYE_HH = 19,
  EYE_HW = 15.5,
  EYE_HW_FAR = 10.5,
  EYE_HW_SIDE = 11.5,
  IRIS_R = 12.5,
  PUPIL_R = 4.6;
const EXPRS = ["idle", "glare", "wide", "hurt", "dizzy", "closed"];
const MOUTHS = ["smirk", "grin", "o", "wavy", "flat"];
const PROFILE_AT = 60 * DEG;
const EYE_LINE = yS(EYE_Y) + blobR(EYE_Y) * Math.cos(EYE_PHI) * SP;
const MOUTH_LINE = yS(MOUTH_Y) + blobR(MOUTH_Y) * SP;
/** Gem and mouth keep the front view's heights in every view, so gem · eyes · mouth spacing never changes with the turn. */
const GEM_LINE = yS(GEM_Y) + (blobR(GEM_Y) + 1) * SP;
function eyeLayout(vOrYaw, isYaw = false) {
  const fy = isYaw ? vOrYaw : FACE_YAW[vOrYaw],
    V = makeView(fy),
    out = [];
  const fc = V.P(surf(0, EYE_Y));
  const rr = blobR(EYE_Y);
  const look = fy < 4 * DEG ? -1.8 : 2.6; // the sly sideways glance; at a turn, toward where it faces
  for (const phi of [EYE_PHI, -EYE_PHI]) {
    const a = phi + fy,
      c = Math.cos(a);
    const q = V.P(surf(phi, EYE_Y));
    let kind;
    if (fy < 4 * DEG) kind = "front";
    else if (fy >= PROFILE_AT) {
      if (phi > 0) continue;
      kind = "side";
    } else kind = phi < 0 ? "near" : "far";
    if (kind === "far" && c < 0.3) continue;
    const hw =
      kind === "far" ? EYE_HW_FAR : kind === "side" ? EYE_HW_SIDE : EYE_HW;
    // keep the whole eye, its flick included, inside the outline with a margin
    const lim = rr - hw - (kind === "far" ? 12 : 9);
    const x =
      kind === "side" ? Math.sign(q.x || 1) * rr * 0.34 : clamp(q.x, -lim, lim);
    out.push({
      x,
      y: EYE_LINE,
      hw,
      hh: EYE_HH,
      inner: fc.x - q.x >= 0 ? 1 : -1,
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
    if (gap < 10) near.x -= 10 - gap;
  }
  return out;
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
/** The eye opening (upright, screen space): a rounded almond, or a profile shape with a curved front. */
function eyeOpening(e) {
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
    return { p, top: (t) => cubicPt([O, c1, c2, A], t) };
  }
  const lift = kind === "far" ? hh * 0.16 : hh * 0.08;
  const I = { x: x + n * hw, y: y + hh * 0.14 },
    O = { x: x - n * hw, y: y - lift };
  const c1 = { x: x + n * hw * 0.72, y: y - hh * 1.04 },
    c2 = { x: x - n * hw * 0.8, y: y - hh * 1.02 - lift * 0.4 };
  p.moveTo(I.x, I.y);
  p.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, O.x, O.y);
  p.bezierCurveTo(
    x - n * hw * 0.8,
    y + hh * 1.04,
    x + n * hw * 0.72,
    y + hh * 1.06,
    I.x,
    I.y,
  );
  p.closePath();
  return { p, top: (t) => cubicPt([O, c2, c1, I], t) };
}
/** Lid height (fraction of hh above the centre) at the inner and outer ends: sly is heavy-lidded toward the nose. */
const LIDS = { idle: [0.08, 0.5], glare: [-0.28, 0.32], wide: [2, 2] };
function paintEye(ctx, e, expr) {
  const { x, y, hw, hh, inner: n, kind } = e;
  const flickDir = -n;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (expr === "hurt") {
    // a squeezed curved chevron pointing at the nose
    const w = kind === "side" ? hw * 0.9 : hw * 0.85;
    ctx.strokeStyle = "#ffd36a";
    ctx.lineWidth = 4.4;
    ctx.beginPath();
    ctx.moveTo(x - n * w, y - hh * 0.45);
    ctx.quadraticCurveTo(x, y - hh * 0.25, x + n * w * 0.6, y);
    ctx.quadraticCurveTo(x, y + hh * 0.22, x - n * w, y + hh * 0.4);
    ctx.stroke();
    return;
  }
  if (expr === "dizzy") {
    const R =
      Math.min(hw, hh) * (kind === "front" || kind === "near" ? 0.95 : 0.9);
    ctx.strokeStyle = "#ffd36a";
    ctx.lineWidth = 2.6;
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
    // a contented closed lid (a smile-curve), amber light leaking under it, the flick at the outer end
    const fx = x + n * hw * (kind === "side" ? 0.7 : 0.95),
      ox = x - n * hw;
    soft(ctx, 2, () => {
      ctx.strokeStyle = "rgba(255,184,60,0.55)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(fx, y + 3);
      ctx.quadraticCurveTo(x, y + hh * 0.5, ox, y + 1);
      ctx.stroke();
    });
    ctx.strokeStyle = C_INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(fx, y + 1);
    ctx.quadraticCurveTo(x, y + hh * 0.45, ox, y - 1);
    ctx.quadraticCurveTo(ox + flickDir * 3, y - 3, ox + flickDir * 6.5, y - 6);
    ctx.stroke();
    return;
  }
  const O = eyeOpening(e);
  const [li, lo] = LIDS[expr] || LIDS.idle;
  // the lid: a curve from the inner (front) end to the outer end, always arched (no straight cut)
  const lidY = (px) => {
    const t = clamp((px - (x - n * hw)) / (2 * n * hw));
    return (
      y -
      hh * lerp(lo, li, t) -
      (li < 1.5 ? hh * 0.24 * Math.sin(Math.PI * t) : 0)
    );
  };
  // a soft amber glow round the opening, so the eye reads on dark ink
  soft(ctx, 4, () => {
    ctx.fillStyle = "rgba(255,170,40,0.32)";
    ctx.fill(O.p);
  });
  ctx.save();
  ctx.clip(O.p);
  const lid = new Path2D();
  for (let i = 0; i <= 24; i++) {
    const px = x - hw * 1.6 + (hw * 3.2 * i) / 24;
    i ? lid.lineTo(px, lidY(px)) : lid.moveTo(px, lidY(px));
  }
  lid.lineTo(x + hw * 1.6, y + hh * 2);
  lid.lineTo(x - hw * 1.6, y + hh * 2);
  lid.closePath();
  // above the lid: the lid itself, deep ink with a faint violet sheen
  ctx.fillStyle = "#1a1040";
  ctx.fillRect(x - hw * 2, y - hh * 2, hw * 4, hh * 4);
  ctx.clip(lid);
  ctx.fillStyle = "#1c0a12";
  ctx.fillRect(x - hw * 2, y - hh * 2, hw * 4, hh * 4);
  // the iris: a glowing amber circle, the same circle in every view
  const front = kind === "side" ? n * hw * 0.05 - e.look : 0;
  const ix = x + front + e.look,
    iy = y + hh * 0.14;
  const ig = ctx.createLinearGradient(0, iy - IRIS_R, 0, iy + IRIS_R);
  if (expr === "glare") {
    ig.addColorStop(0, "#8a2a04");
    ig.addColorStop(0.45, "#ff8a12");
    ig.addColorStop(0.85, "#ffd84a");
    ig.addColorStop(1, "#fff4b0");
  } else {
    ig.addColorStop(0, "#6a3006");
    ig.addColorStop(0.42, "#e8920e");
    ig.addColorStop(0.8, "#ffc93a");
    ig.addColorStop(1, "#fff0a0");
  }
  ctx.fillStyle = ig;
  ctx.beginPath();
  ctx.arc(ix, iy, IRIS_R, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(60,20,0,0.6)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  const pr =
    expr === "glare"
      ? PUPIL_R * 0.62
      : expr === "wide"
        ? PUPIL_R * 0.75
        : PUPIL_R;
  ctx.fillStyle = "#170606";
  ctx.beginPath();
  ctx.arc(ix, iy - 0.5, pr, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,246,190,0.7)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(ix, iy, IRIS_R * 0.74, 0.3 * Math.PI, 0.7 * Math.PI);
  ctx.stroke();
  // the lid's shadow across the top of the iris
  soft(ctx, 2.4, () => {
    ctx.strokeStyle = "rgba(20,6,10,0.55)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const px = x - hw * 1.2 + (hw * 2.4 * i) / 24;
      i ? ctx.lineTo(px, lidY(px) + 2) : ctx.moveTo(px, lidY(px) + 2);
    }
    ctx.stroke();
  });
  ctx.fillStyle = "#fffdf4";
  ctx.beginPath();
  ctx.arc(ix - 4.4, iy - 4.4, 4.2, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ix + 4.6, iy + 4.6, 1.9, 0, TAU);
  ctx.fill();
  ctx.restore();
  // the lash band along the visible top edge (lid or opening, whichever is lower), thick at the outer end
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const q = O.top(i / 24);
    pts.push({ x: q.x, y: Math.max(q.y, Math.min(lidY(q.x), y + hh * 0.6)) });
  }
  const taper = (t) => Math.pow(1 - t, 0.6);
  const band = new Path2D();
  pts.forEach((q, i) => {
    const t = i / 24,
      w = 0.2 + 3.4 * taper(t);
    i ? band.lineTo(q.x, q.y - w) : band.moveTo(q.x, q.y - w);
  });
  for (let i = 24; i >= 0; i--) {
    const t = i / 24,
      w = 0.2 + 1.6 * taper(t);
    band.lineTo(pts[i].x, pts[i].y + w);
  }
  band.closePath();
  const o = pts[0];
  band.moveTo(o.x + n * 3, o.y - 3.2);
  band.quadraticCurveTo(
    o.x + flickDir * 4,
    o.y - 4.5,
    o.x + flickDir * 8,
    o.y - 8.5,
  );
  band.quadraticCurveTo(
    o.x + flickDir * 3.5,
    o.y + 0.2,
    o.x + n * 2,
    o.y + 1.8,
  );
  band.closePath();
  ctx.fillStyle = C_INK;
  ctx.fill(band);
  // a fine lavender edge above the lash, so the lid line reads against the ink
  ctx.save();
  ctx.translate(0, -1.4);
  ctx.strokeStyle = "rgba(196,180,255,0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  pts.forEach((q, i) => {
    const t = i / 24,
      w = 0.2 + 3.4 * taper(t);
    i ? ctx.lineTo(q.x, q.y - w) : ctx.moveTo(q.x, q.y - w);
  });
  ctx.stroke();
  ctx.restore();
  // a light lower rim on the outer half
  ctx.save();
  ctx.clip(O.p);
  ctx.strokeStyle = "rgba(255,200,110,0.45)";
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
function paintEyes(ctx, k) {
  const E = k.fy != null ? eyeLayout(k.fy, true) : eyeLayout(k.v);
  for (const e of E) {
    if (k.expr === "dizzy") continue;
    const bw = e.kind === "far" ? 4.5 : e.kind === "side" ? 5.5 : 7.5;
    const bx = e.x - e.inner * e.hw * (e.kind === "side" ? 0.25 : 0.42),
      by = e.y + e.hh * 0.86 + 3;
    soft(ctx, 2.6, () => {
      ctx.strokeStyle = "rgba(255,92,190,0.5)";
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(bx - bw, by);
      ctx.lineTo(bx + bw, by);
      ctx.stroke();
    });
  }
  for (const e of E) paintEye(ctx, e, k.expr);
  paintGem(ctx, { v: k.v, fy: k.fy });
}
/** Mouth placement and kind (front, ¾ or side), from the surface; drawn upright. */
function mouthLayout(vOrYaw, isYaw = false) {
  const fy = isYaw ? vOrYaw : FACE_YAW[vOrYaw],
    V = makeView(fy);
  const q = V.P(surf(0, MOUTH_Y));
  const kind = fy < 4 * DEG ? "front" : fy >= PROFILE_AT ? "side" : "q";
  const [wn, wf] =
    kind === "front" ? [9.5, 9.5] : kind === "q" ? [9.5, 5.5] : [8, 2.5];
  const lim = blobR(MOUTH_Y) - wf - 10;
  const mx =
    kind === "side"
      ? Math.sign(q.x || 1) * blobR(MOUTH_Y) * 0.6
      : clamp(q.x, -lim, lim);
  return { x: mx, y: MOUTH_LINE - 2, kind, wn, wf };
}
function paintMouth(ctx, k) {
  const M = k.fy != null ? mouthLayout(k.fy, true) : mouthLayout(k.v);
  const { x, y, wn, wf } = M;
  const X = (u) => x + (u < 0 ? u * wn : u * wf);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const line = (draw) => {
    // a dark line with a faint lavender lip under it, so it reads on the ink
    ctx.save();
    ctx.translate(0, 1.3);
    ctx.strokeStyle = "rgba(190,170,255,0.5)";
    ctx.lineWidth = 2.2;
    draw();
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = C_INK;
    ctx.lineWidth = 2.6;
    draw();
    ctx.stroke();
  };
  const fang = (fx, fy, s = 1) => {
    ctx.fillStyle = "#fffaf4";
    ctx.beginPath();
    ctx.moveTo(fx - 2.4 * s, fy);
    ctx.quadraticCurveTo(fx, fy - 0.6, fx + 2.4 * s, fy);
    ctx.quadraticCurveTo(fx + 1.2 * s, fy + 3 * s, fx + 0.3 * s, fy + 4.6 * s);
    ctx.quadraticCurveTo(fx - 1.2 * s, fy + 3 * s, fx - 2.4 * s, fy);
    ctx.fill();
  };
  if (k.m === "smirk") {
    // a sly cat ":3", the far corner hooked up, one little fang
    line(() => {
      ctx.beginPath();
      ctx.moveTo(X(-1), y - 1.6);
      ctx.quadraticCurveTo(X(-0.5), y + 5, X(0), y + 0.8);
      ctx.quadraticCurveTo(X(0.5), y + 5.4, X(1), y - 3);
    });
    if (M.kind !== "side") fang(X(0.42), y + 2.4);
    else fang(X(-0.45), y + 2.4);
  } else if (k.m === "grin") {
    const p = new Path2D();
    p.moveTo(X(-1), y - 2);
    p.quadraticCurveTo(X(0), y + 1.8, X(1), y - 4);
    p.quadraticCurveTo(X(0.7), y + 13, X(0), y + 13);
    p.quadraticCurveTo(X(-0.8), y + 12.5, X(-1), y - 2);
    p.closePath();
    ctx.fillStyle = "#16061e";
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    ctx.fillStyle = "#ff6fa6";
    ctx.beginPath();
    ctx.arc(X(0) + 1, y + 15, 6.5, 0, TAU);
    ctx.fill();
    ctx.restore();
    fang(X(-0.55), y - 0.6);
    if (M.kind !== "side") fang(X(0.5), y - 1.6);
    ctx.strokeStyle = C_INK;
    ctx.lineWidth = 2.4;
    ctx.stroke(p);
  } else if (k.m === "o") {
    const r = M.kind === "side" ? 4.6 : 5.6,
      cx = M.kind === "side" ? X(-0.3) : X(0);
    const p = new Path2D();
    p.arc(cx, y + 4, r, 0, TAU);
    ctx.fillStyle = "#16061e";
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    ctx.fillStyle = "#ff6fa6";
    ctx.beginPath();
    ctx.arc(cx, y + 10, 4.5, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = C_INK;
    ctx.lineWidth = 2.4;
    ctx.stroke(p);
    ctx.strokeStyle = "rgba(190,170,255,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, y + 4, r + 1.8, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  } else if (k.m === "wavy") {
    line(() => {
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const u = -1 + (2 * i) / 24,
          yy = Math.sin(((u + 1) / 2) * TAU * 2) * 2.3 + 1;
        i ? ctx.lineTo(X(u), y + yy) : ctx.moveTo(X(u), y + yy);
      }
    });
  } else {
    line(() => {
      ctx.beginPath();
      ctx.moveTo(X(-0.8), y + 2);
      ctx.quadraticCurveTo(X(0), y - 0.8, X(0.8), y + 2);
    });
  }
}
/** The gold gem on the brow (a jewel on the surface: it turns with it). */
function gemLayout(v, fyIn) {
  const fy = fyIn != null ? fyIn : FACE_YAW[v],
    V = makeView(fy),
    q = V.P(surf(0, GEM_Y, 1));
  // on the face's centre line; in profile it takes the same inward cheat as the mouth, so the two stay lined up
  const x = fy >= PROFILE_AT ? Math.sign(q.x || 1) * blobR(GEM_Y) * 0.66 : q.x;
  return { x, y: GEM_LINE, c: Math.max(0.42, Math.cos(fy)) };
}
function paintGem(ctx, k) {
  const G = gemLayout(k.v, k.fy);
  ctx.save();
  ctx.translate(G.x, G.y);
  ctx.scale(G.c, 1);
  // gold setting
  const set = new Path2D();
  set.moveTo(0, -10.5);
  set.quadraticCurveTo(7.5, -6, 8.4, 0);
  set.quadraticCurveTo(7.5, 6, 0, 10.5);
  set.quadraticCurveTo(-7.5, 6, -8.4, 0);
  set.quadraticCurveTo(-7.5, -6, 0, -10.5);
  set.closePath();
  const sg = ctx.createLinearGradient(-8, -10, 8, 10);
  sg.addColorStop(0, "#fff2b8");
  sg.addColorStop(0.45, "#e0a42c");
  sg.addColorStop(1, "#7a4a0a");
  ctx.fillStyle = sg;
  ctx.fill(set);
  ctx.strokeStyle = "rgba(40,16,4,0.8)";
  ctx.lineWidth = 1;
  ctx.stroke(set);
  // the stone: an amber teardrop, facets as curves
  const st = new Path2D();
  st.moveTo(0, -7);
  st.quadraticCurveTo(5, -3.6, 5.4, 0.4);
  st.quadraticCurveTo(5, 5, 0, 7);
  st.quadraticCurveTo(-5, 5, -5.4, 0.4);
  st.quadraticCurveTo(-5, -3.6, 0, -7);
  st.closePath();
  const gg = ctx.createRadialGradient(-1.6, -2.4, 0.4, 0, 0, 7.5);
  gg.addColorStop(0, "#fffbe0");
  gg.addColorStop(0.35, "#ffd04a");
  gg.addColorStop(0.8, "#e07a10");
  gg.addColorStop(1, "#8a3a06");
  ctx.fillStyle = gg;
  ctx.fill(st);
  ctx.strokeStyle = "rgba(255,240,190,0.55)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-3.6, -2.4);
  ctx.quadraticCurveTo(0, -0.8, 3.6, -2.4);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-1.8, -3, 1.3, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Fade a limb's root into nothing, so it grows out of the body instead of sitting on it. */
function fadeRoot(ctx, x, y, r) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(0.5, "rgba(0,0,0,0.9)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ════════════════ arms: two little ink paws on stretchy tendrils ════════════════
const ARM_PHI = 1.45,
  ARM_Y = -28,
  ARM_OUT = -4;
const ARM_POSES = {
  rest: {
    s: [
      [
        [0, 0, 0],
        [10, -4, 6],
        [16, -11, 11],
        [18, -16, 14],
      ],
      [
        [0, 0, 0],
        [10, -3, 5],
        [17, -9, 10],
        [20, -14, 12],
      ],
    ],
    wave: 0.6,
  },
  up: {
    s: [
      [
        [0, 0, 0],
        [16, 10, -8],
        [26, 32, -18],
        [24, 52, -26],
      ],
      [
        [0, 0, 0],
        [17, 8, -7],
        [28, 30, -17],
        [28, 50, -27],
      ],
    ],
    wave: 1.4,
  },
  sweep: {
    s: [
      [
        [0, 0, 0],
        [16, 2, 20],
        [24, 4, 50],
        [26, 6, 82],
      ],
      [
        [0, 0, 0],
        [17, 0, 22],
        [26, 8, 50],
        [24, 4, 84],
      ],
    ],
    wave: 2.4,
  },
  point: {
    s: [
      [
        [0, 0, 0],
        [14, 4, 16],
        [30, 10, 38],
        [46, 14, 58],
      ],
      [
        [0, 0, 0],
        [15, 2, 18],
        [32, 8, 38],
        [48, 12, 56],
      ],
    ],
    wave: 1.4,
  },
  wrap: {
    s: [
      [
        [0, 0, 0],
        [8, -4, 20],
        [-2, -8, 40],
        [-20, -10, 46],
      ],
      [
        [0, 0, 0],
        [8, -3, 21],
        [0, -7, 40],
        [-18, -9, 47],
      ],
    ],
    wave: 0.6,
  },
  slump: {
    s: [
      [
        [0, 0, 0],
        [14, -6, 4],
        [26, -14, 8],
        [36, -18, 10],
      ],
    ],
    wave: 0.8,
  },
};
const ARM_POSE_NAMES = Object.keys(ARM_POSES);
const armStates = (pose) => ARM_POSES[pose].s.length;
const cub = (c, t) => {
  const u = 1 - t,
    a = u * u * u,
    b = 3 * u * u * t,
    d = 3 * u * t * t,
    e = t * t * t;
  return {
    x: a * c[0][0] + b * c[1][0] + d * c[2][0] + e * c[3][0],
    y: a * c[0][1] + b * c[1][1] + d * c[2][1] + e * c[3][1],
    z: a * c[0][2] + b * c[1][2] + d * c[2][2] + e * c[3][2],
  };
};
function armModel(pose, side, st = 0) {
  const P = ARM_POSES[pose],
    sx = side === "L" ? 1 : -1;
  const c = P.s[Math.min(st, P.s.length - 1)].map((q) => [
    q[0] * sx,
    q[1],
    q[2],
  ]);
  const pts = [];
  for (let i = 0; i <= 30; i++) {
    const s = i / 30;
    pts.push({ p: cub(c, s), s });
  }
  return pts;
}
/** One tendril with its paw, painted per view: a tapering tube, lit from the upper left, rimmed on the right. */
function paintArm(ctx, k) {
  const V = makeView(VIEWS[k.v].yaw),
    P = ARM_POSES[k.pose],
    st = k.st || 0;
  const M = armModel(k.pose, k.side, st);
  const C0 = M.map((q) => V.P(q.p));
  const C = C0.map((q, i) => {
    const a = C0[Math.max(0, i - 1)],
      b = C0[Math.min(C0.length - 1, i + 1)];
    const d = norm2(b.x - a.x, b.y - a.y),
      s = M[i].s,
      w = P.wave * Math.sin(s * TAU * 0.9 + st * Math.PI) * Math.min(1, s * 3);
    return { x: q.x - d.y * w, y: q.y + d.x * w };
  });
  // one soft outline: a limb that narrows a little, then swells into a round paw; round caps at both ends (no seams, no stacked circles)
  const hwAt = (s) =>
    s < 0.62 ? lerp(12, 8.5, s / 0.62) : lerp(8.5, 12.5, smooth(0.62, 1, s));
  const L = [],
    R = [],
    D = [];
  for (let i = 0; i < C.length; i++) {
    const a = C[Math.max(0, i - 2)],
      b = C[Math.min(C.length - 1, i + 2)];
    const d = norm2(b.x - a.x, b.y - a.y),
      hw = hwAt(M[i].s);
    D.push(d);
    L.push({ x: C[i].x - d.y * hw, y: C[i].y + d.x * hw });
    R.push({ x: C[i].x + d.y * hw, y: C[i].y - d.x * hw });
  }
  const shape = new Path2D();
  const through = (pts) => {
    for (let i = 1; i < pts.length - 1; i++)
      shape.quadraticCurveTo(
        pts[i].x,
        pts[i].y,
        (pts[i].x + pts[i + 1].x) / 2,
        (pts[i].y + pts[i + 1].y) / 2,
      );
    shape.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  };
  const n = C.length - 1,
    aN = Math.atan2(D[n].x, -D[n].y),
    a0 = Math.atan2(D[0].x, -D[0].y);
  shape.moveTo(L[0].x, L[0].y);
  through(L);
  shape.arc(C[n].x, C[n].y, hwAt(1), aN, aN - Math.PI, true);
  through(R.slice().reverse());
  shape.arc(C[0].x, C[0].y, hwAt(0), a0 + Math.PI, a0, true);
  shape.closePath();
  const e = C[n],
    dir = D[n],
    nx = -dir.y,
    ny = dir.x;
  const paw = { x: e.x, y: e.y };
  const g = ctx.createRadialGradient(paw.x - 5, paw.y - 6, 1, paw.x, paw.y, 44);
  g.addColorStop(0, "#4a3a9a");
  g.addColorStop(0.35, "#30246e");
  g.addColorStop(1, INK_MID);
  ctx.fillStyle = g;
  ctx.fill(shape);
  ctx.save();
  ctx.clip(shape);
  innerGlow(ctx, shape, "rgba(6,3,20,0.75)", 7, 3, 3.5);
  innerGlow(ctx, shape, "rgba(176,198,255,0.8)", 3, -2.4, 1.6);
  ctx.fillStyle = "rgba(240,236,255,0.8)";
  ctx.beginPath();
  ctx.ellipse(paw.x - 4.2, paw.y - 4.4, 2.4, 1.6, -0.6, 0, TAU);
  ctx.fill();
  ctx.restore();
  // two soft toe creases on the paw's far edge (short curves)
  ctx.strokeStyle = "rgba(6,3,18,0.55)";
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  for (const o of [-1, 1]) {
    const ex = paw.x + dir.x * 11.5 + nx * o * 4,
      ey = paw.y + dir.y * 11.5 + ny * o * 4;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.quadraticCurveTo(
      ex - dir.x * 2.5 + nx * o * 0.8,
      ey - dir.y * 2.5 + ny * o * 0.8,
      ex - dir.x * 4.5,
      ey - dir.y * 4.5,
    );
    ctx.stroke();
  }
  fadeRoot(ctx, C[0].x, C[0].y, 16);
}

// ════════════════ the crescent-moon tail ════════════════
// the tail leaves the back on its right side, swings out wide beyond the outline and curls up beside the head
const TAIL_ROOT = surf(Math.PI + 1.2, -26, -5);
const TAIL_END = { x: -84, y: 96, z: -44 };
const TAIL_C = [
  [TAIL_ROOT.x, TAIL_ROOT.y, TAIL_ROOT.z],
  [TAIL_ROOT.x - 40, TAIL_ROOT.y - 8, TAIL_ROOT.z - 22],
  [-132, 32, -66],
  [TAIL_END.x, TAIL_END.y, TAIL_END.z],
];
/** The crescent is drawn a little larger than painted: it is a tell, it must read at a glance. */
const MOON_S = 1.3;
/** The tail in view k.v, drawn about its root: a tapering ink tube curling up behind its right side. */
function paintTail(ctx, k) {
  const V = makeView(VIEWS[k.v].yaw),
    r0 = V.P(TAIL_ROOT);
  const C = [];
  for (let i = 0; i <= 30; i++) {
    const q = V.P(cub(TAIL_C, i / 30));
    C.push({ x: q.x - r0.x, y: q.y - r0.y });
  }
  const L = [],
    R = [];
  for (let i = 0; i < C.length; i++) {
    const a = C[Math.max(0, i - 1)],
      b = C[Math.min(C.length - 1, i + 1)];
    const d = norm2(b.x - a.x, b.y - a.y),
      s = i / 30,
      hw = lerp(14, 6, Math.pow(s, 0.8));
    L.push({ x: C[i].x - d.y * hw, y: C[i].y + d.x * hw });
    R.push({ x: C[i].x + d.y * hw, y: C[i].y - d.x * hw });
  }
  const p = new Path2D();
  p.moveTo(L[0].x, L[0].y);
  for (let i = 1; i < L.length - 1; i++)
    p.quadraticCurveTo(
      L[i].x,
      L[i].y,
      (L[i].x + L[i + 1].x) / 2,
      (L[i].y + L[i + 1].y) / 2,
    );
  const e = C[C.length - 1];
  p.lineTo(L[L.length - 1].x, L[L.length - 1].y);
  p.quadraticCurveTo(
    e.x + (e.x - C[C.length - 2].x) * 1.2,
    e.y + (e.y - C[C.length - 2].y) * 1.2,
    R[R.length - 1].x,
    R[R.length - 1].y,
  );
  for (let i = R.length - 2; i > 0; i--)
    p.quadraticCurveTo(
      R[i].x,
      R[i].y,
      (R[i].x + R[i - 1].x) / 2,
      (R[i].y + R[i - 1].y) / 2,
    );
  p.lineTo(R[0].x, R[0].y);
  p.closePath();
  const g = ctx.createLinearGradient(0, 0, e.x, e.y);
  g.addColorStop(0, INK_BOT);
  g.addColorStop(1, "#3a2c7e");
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  innerGlow(ctx, p, "rgba(176,198,255,0.8)", 3, -2.4, 1.6);
  ctx.restore();
  fadeRoot(ctx, 0, 0, 18);
  // the crescent, baked onto the tail's tip (only its inner light is a separate, flickering image)
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.scale(MOON_S, MOON_S);
  paintMoon(ctx, {});
  ctx.restore();
}
/** The crescent: drawn upright (a moon is a moon from every side). Origin = where the tail joins it. */
const MOON_JOIN = { x: -1, y: 15.5 };
function moonPath() {
  // outer circle (0,0) r17 minus inner circle (6.5,-6.5) r14: the outer arc the long way round, the inner arc back
  const p = new Path2D();
  p.arc(0, 0, 17, 0.181, 4.53, false);
  p.arc(6.5, -6.5, 14, 3.961, 0.752, true);
  p.closePath();
  return p;
}
function paintMoon(ctx, k) {
  ctx.translate(-MOON_JOIN.x, -MOON_JOIN.y);
  const p = moonPath();
  if (k.hot) {
    // the inner light, drawn additively: what flickers on the real one
    soft(ctx, 2.2, () => {
      ctx.fillStyle = "rgba(255,236,150,0.95)";
      ctx.fill(p);
    });
    ctx.fillStyle = "rgba(255,255,236,0.9)";
    ctx.save();
    ctx.clip(p);
    ctx.beginPath();
    ctx.arc(-6, 6, 7, 0, TAU);
    ctx.fill();
    ctx.restore();
    return;
  }
  const g = ctx.createLinearGradient(-16, -14, 12, 16);
  g.addColorStop(0, "#fff6c8");
  g.addColorStop(0.4, "#ffd65b");
  g.addColorStop(1, "#c4851c");
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  soft(ctx, 1.4, () => {
    ctx.strokeStyle = "rgba(120,64,6,0.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(6.5, -6.5, 14.5, 0, TAU);
    ctx.stroke();
  });
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.ellipse(-10, 2, 1.8, 4.2, 0.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ════════════════ core, drips, puddle, melt ════════════════
/** Found: the ink parts over its middle and a gold core of moonlight shows. k.open 0..1 (frames). */
function paintCore(ctx, k) {
  const o = k.open;
  const lens = new Path2D();
  lens.moveTo(0, -24 * (0.5 + 0.5 * o));
  lens.bezierCurveTo(16 * o + 3, -14, 16 * o + 3, 14, 0, 24 * (0.5 + 0.5 * o));
  lens.bezierCurveTo(
    -16 * o - 3,
    14,
    -16 * o - 3,
    -14,
    0,
    -24 * (0.5 + 0.5 * o),
  );
  lens.closePath();
  soft(ctx, 3, () => {
    ctx.fillStyle = "rgba(190,150,255,0.6)";
    ctx.fill(lens);
  });
  ctx.fillStyle = "#140a2e";
  ctx.fill(lens);
  ctx.save();
  ctx.clip(lens);
  const g = ctx.createRadialGradient(-2, -3, 1, 0, 0, 15);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.3, "#fff0a0");
  g.addColorStop(0.7, "#ffc23a");
  g.addColorStop(1, "rgba(255,150,30,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 15 * (0.4 + 0.6 * o), 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(210,190,255,0.85)";
  ctx.lineWidth = 1.6;
  ctx.stroke(lens);
}
/** A hanging drip (on the base, more each phase): a thin neck of ink stretching down to a round bead. */
function paintHang(ctx, k) {
  const len = k.len,
    bead = 4.6 + len * 0.06;
  const p = new Path2D();
  p.moveTo(-6, -6);
  p.bezierCurveTo(-5, 0, -2, len * 0.3, -1.8, len - bead * 1.6);
  p.bezierCurveTo(
    -bead * 1.1,
    len - bead * 0.9,
    -bead,
    len + bead * 0.9,
    0,
    len + bead,
  );
  p.bezierCurveTo(
    bead,
    len + bead * 0.9,
    bead * 1.1,
    len - bead * 0.9,
    1.8,
    len - bead * 1.6,
  );
  p.bezierCurveTo(2, len * 0.3, 5, 0, 6, -6);
  p.closePath();
  const g = ctx.createLinearGradient(0, -6, 0, len + bead);
  g.addColorStop(0, INK_BOT);
  g.addColorStop(1, "#30247a");
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  innerGlow(ctx, p, "rgba(176,198,255,0.75)", 2.2, -1.4, 0);
  ctx.restore();
  ctx.fillStyle = "rgba(235,230,255,0.9)";
  ctx.beginPath();
  ctx.arc(-1.6, len - 0.4, 1.3, 0, TAU);
  ctx.fill();
}
/** A falling drop of ink. */
function paintDrop(ctx) {
  const p = new Path2D();
  p.moveTo(0, -9);
  p.bezierCurveTo(2.5, -4, 5, -1, 5, 2.5);
  p.arc(0, 2.5, 5, 0, Math.PI);
  p.bezierCurveTo(-5, -1, -2.5, -4, 0, -9);
  p.closePath();
  const g = ctx.createRadialGradient(-1.4, 1, 0.5, 0, 2, 6);
  g.addColorStop(0, "#5a48b0");
  g.addColorStop(1, "#160d36");
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.strokeStyle = "rgba(170,160,255,0.6)";
  ctx.lineWidth = 0.8;
  ctx.stroke(p);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(-1.6, 1.4, 1.2, 0, TAU);
  ctx.fill();
}
/** The glossy ink puddle under it: part of the creature (it oozes), the same under every copy. Not a shadow. */
function paintPuddle(ctx) {
  const p = new Path2D();
  const r = rng(9);
  const pts = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU,
      rr = 1 + (r() - 0.5) * 0.16;
    pts.push({ x: Math.cos(a) * 56 * rr, y: Math.sin(a) * 18 * rr });
  }
  pts.forEach((q, i) => {
    const nq = pts[(i + 1) % pts.length],
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
  // wet ink: deep in the middle, a violet sheen toward the rim, a moonlit reflection and two specular dots
  const g = ctx.createRadialGradient(4, 2, 2, 0, 0, 58);
  g.addColorStop(0, "rgba(12,6,34,0.96)");
  g.addColorStop(0.6, "rgba(34,22,84,0.95)");
  g.addColorStop(1, "rgba(76,56,160,0.92)");
  ctx.save();
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.clip(p);
  soft(ctx, 2.4, () => {
    ctx.strokeStyle = "rgba(210,200,255,0.6)";
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.ellipse(-6, -1, 40, 10, 0, 1.08 * Math.PI, 1.62 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = "rgba(140,110,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(18, 6, 22, 5, 0, 0, TAU);
    ctx.fill();
  });
  ctx.fillStyle = "rgba(245,242,255,0.9)";
  ctx.beginPath();
  ctx.ellipse(-30, -6, 4, 1.6, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-20, -9, 1.8, 0.9, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(170,150,255,0.7)";
  ctx.lineWidth = 1.4;
  ctx.stroke(p);
}
/**
 * The real one's shadow, cast along the floor away from the lantern: its
 * outline with the two ears and the crescent tail, soft at the far end.
 * Local x runs away from the light (0 = under it), drawn flat, squashed onto the floor by the rig.
 */
function paintCastShadow(ctx) {
  const p = new Path2D();
  p.ellipse(70, 0, 66, 40, 0, 0, TAU);
  const ear = (s) => {
    p.moveTo(118, s * 12);
    p.quadraticCurveTo(150, s * 18, 152, s * 30);
    p.quadraticCurveTo(136, s * 34, 122, s * 30);
    p.closePath();
  };
  ear(1);
  ear(-1);
  p.moveTo(80, -38);
  p.quadraticCurveTo(110, -62, 150, -58);
  p.arc(156, -56, 9, Math.PI, 0.2 * Math.PI, false);
  p.quadraticCurveTo(116, -52, 84, -32);
  p.closePath();
  const g = ctx.createLinearGradient(0, 0, 170, 0);
  g.addColorStop(0, "rgba(7,9,20,0.95)");
  g.addColorStop(0.6, "rgba(7,9,20,0.75)");
  g.addColorStop(1, "rgba(7,9,20,0.25)");
  soft(ctx, 3.5, () => {
    ctx.fillStyle = g;
    ctx.fill(p);
  });
}
/** The melted puddle left at dawn, with its little moon lying in it. */
function paintMelt(ctx) {
  ctx.save();
  ctx.scale(1.6, 1.25);
  paintPuddle(ctx);
  ctx.restore();
  ctx.save();
  ctx.translate(40, -6);
  ctx.rotate(1.2);
  ctx.scale(0.7, 0.7);
  paintMoon(ctx, {});
  ctx.restore();
  for (const [x, y, r] of [
    [-62, -4, 5],
    [-50, 8, 3.5],
    [76, 10, 4],
  ]) {
    ctx.fillStyle = "rgba(14,8,40,0.9)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(220,214,255,0.7)";
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, TAU);
    ctx.fill();
  }
}

/** All the hanging drips of a view for a phase, as one strip (one image instead of up to nine). */
function paintHangs(ctx, k) {
  const V = makeView(VIEWS[k.v].yaw),
    yaw = VIEWS[k.v].yaw;
  for (const h of HANGS) {
    if (k.ph < h.ph || Math.cos(h.phi + yaw) <= 0.05) continue;
    const q = V.P(surf(h.phi, B_BOT + 6, -3));
    ctx.save();
    ctx.translate(q.x, q.y);
    paintHang(ctx, { len: h.len });
    ctx.restore();
  }
}
const DRIP_FRAMES = 6,
  DRIP_L = 36;
/** One frame of the falling drips: n drops at staggered heights down a DRIP_L column, a ripple where one lands. Stretched to fit at runtime. */
function paintDrips(ctx, k) {
  const n = k.n;
  for (let i = 0; i < n; i++) {
    const u = (k.f / DRIP_FRAMES + i / n + 0.13 * i) % 1,
      ox = Math.sin(i * 2.7) * 30;
    if (u < 0.82) {
      ctx.save();
      ctx.translate(ox, DRIP_L * (u / 0.82) ** 2);
      ctx.scale(0.8, 0.8 + 0.3 * (u / 0.82));
      paintDrop(ctx);
      ctx.restore();
    } else {
      const r = (u - 0.82) / 0.18;
      ctx.strokeStyle = `rgba(170,150,255,${0.7 * (1 - r)})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(ox, DRIP_L, 4 + r * 13, (4 + r * 13) * 0.35, 0, 0, TAU);
      ctx.stroke();
    }
  }
}

const QUAL = {
  body: 1.45,
  deep: 0.5,
  face: 1.85,
  mouth: 2.4,
  gem: 2.4,
  arm: 0.85,
  tail: 1.2,
  moon: 2.2,
  core: 1.6,
  hang: 1.6,
  melt: 1.0,
  fx: 0.75,
};
const BODY_BOX = [-112, -130, 112, 104];
const HANGS = [
  { ph: 1, phi: 0.75, len: 18 },
  { ph: 1, phi: -1.6, len: 15 },
  { ph: 2, phi: -0.35, len: 20 },
  { ph: 2, phi: 1.7, len: 22 },
  { ph: 2, phi: -2.5, len: 18 },
  { ph: 3, phi: 0.2, len: 26 },
  { ph: 3, phi: -1.05, len: 24 },
  { ph: 3, phi: 1.2, len: 22 },
  { ph: 3, phi: 3.1, len: 24 },
];

/** Every piece the battle uses, drawn into one canvas (DPR-independent). */
export function buildInkAtlas(qScale = 1) {
  return packPieces(
    inkPieceSpecs(qScale)
      .map((p) => paintPiece(p.name, p.box, p.q, p.draw, p.opt))
      .filter(Boolean),
  );
}
/** The list of pieces (name, box in rig units, atlas px per rig unit, painter, options). */
export function inkPieceSpecs(qScale = 1) {
  const pieces = [];
  const piece = (name, box, q, draw, opt = {}) =>
    pieces.push({ name, box, q, draw, opt });
  const Q = (k) => QUAL[k] * qScale;
  const LINE = "rgba(4,2,12,0.95)";
  for (let v = 0; v < 5; v++) {
    piece(`body_${v}`, BODY_BOX, Q("body"), paintBody, {
      k: { v },
      line: 2,
      lineColor: LINE,
    });
    piece(`deep_${v}`, BODY_BOX, Q("deep"), paintDeep, {
      k: { v },
      outline: false,
    });
    piece(`tail_${v}`, [-160, -170, 160, 90], Q("tail"), paintTail, {
      k: { v },
      line: 1.4,
      lineColor: LINE,
    });
    for (const side of ["L", "R"]) {
      if ((v === 0 || v === 4) && side === "R") continue; // front and back: the right paw is the left one mirrored
      for (const pose of ARM_POSE_NAMES)
        for (let st = 0; st < armStates(pose); st++)
          piece(
            `arm_${v}_${side}_${pose}_${st}`,
            [-110, -110, 110, 110],
            Q("arm"),
            paintArm,
            { k: { v, side, pose, st }, line: 1.3, lineColor: LINE },
          );
    }
    for (let ph = 1; ph <= 3; ph++)
      piece(`hangs_${v}_${ph}`, [-100, 30, 100, 110], Q("hang"), paintHangs, {
        k: { v, ph },
        line: 1,
        lineColor: LINE,
        grain: false,
      });
  }
  for (let v = 0; v < 3; v++) {
    for (const e of EXPRS)
      piece(`eyes_${v}_${e}`, [-80, -40, 80, 50], Q("face"), paintEyes, {
        k: { v, expr: e },
        outline: false,
      });
    for (const m of MOUTHS)
      piece(`mouth_${v}_${m}`, [-60, 20, 60, 64], Q("mouth"), paintMouth, {
        k: { v, m },
        outline: false,
      });
  }
  piece("moonHot", [-30, -40, 30, 10], Q("moon") * 0.6, paintMoon, {
    k: { hot: true },
    outline: false,
  });
  for (let i = 0; i < 3; i++)
    piece(`core_${i}`, [-26, -28, 26, 28], Q("core"), paintCore, {
      k: { open: [0.3, 0.65, 1][i] },
      outline: false,
    });
  for (const n of [2, 3, 5])
    for (let f = 0; f < DRIP_FRAMES; f++)
      piece(`drips_${n}_${f}`, [-44, -12, 44, 46], 1.3, paintDrips, {
        k: { n, f },
        outline: false,
      });
  for (const f of [1, 2])
    piece(`melt_${f}`, [-120, -100, 124, 16], Q("melt"), paintMeltFrame, {
      k: { f },
      line: 1.6,
      lineColor: LINE,
    });
  piece("melt", [-130, -40, 130, 40], Q("melt"), paintMelt, { outline: false });
  piece("puddle", [-64, -24, 64, 24], 1.2, paintPuddle, { outline: false });
  piece("castShadow", [-10, -80, 180, 50], 0.7, paintCastShadow, {
    outline: false,
  });
  const fq = Q("fx");
  piece("glow_gold", [-34, -34, 34, 34], fq, paintGlow, {
    outline: false,
    k: {
      stops: [
        [0, "rgba(255,250,220,1)"],
        [0.28, "rgba(255,214,91,0.7)"],
        [1, "rgba(255,170,40,0)"],
      ],
    },
  });
  piece("glow_amber", [-34, -34, 34, 34], fq, paintGlow, {
    outline: false,
    k: {
      stops: [
        [0, "rgba(255,226,140,1)"],
        [0.3, "rgba(255,160,40,0.6)"],
        [1, "rgba(255,110,20,0)"],
      ],
    },
  });
  piece("star", [-12, -12, 12, 12], fq * 1.5, paintStar, { outline: false });
  return pieces;
}
/** Paint one piece in its own canvas, outline and grain it, trim it to its pixels. */
function paintPiece(name, box, q, draw, opt) {
  const pad = 6;
  const w = Math.ceil((box[2] - box[0]) * q) + pad * 2,
    h = Math.ceil((box[3] - box[1]) * q) + pad * 2;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) return null;
  PQ = q;
  g.translate(pad - box[0] * q, pad - box[1] * q);
  g.scale(q, q);
  g.lineJoin = "round";
  draw(g, opt.k || {});
  let src = c;
  if (opt.outline !== false) {
    const d = document.createElement("canvas");
    d.width = w;
    d.height = h;
    const dg = d.getContext("2d");
    dg.shadowColor = opt.lineColor || "rgba(4,2,12,0.95)";
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
  const data = src.getContext("2d").getImageData(0, 0, w, h).data;
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
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - 1);
  y0 = Math.max(0, y0 - 1);
  x1 = Math.min(w - 1, x1 + 1);
  y1 = Math.min(h - 1, y1 + 1);
  return {
    name,
    src,
    sx: x0,
    sy: y0,
    w: x1 - x0 + 1,
    h: y1 - y0 + 1,
    q,
    ox: (pad - box[0] * q - x0) / q,
    oy: (pad - box[1] * q - y0) / q,
  };
}
/** Shelf-pack the pieces (tallest first) into one canvas. */
function packPieces(list) {
  const W = 2048;
  list.sort((a, b) => b.h - a.h);
  let x = 0,
    y = 0,
    shelf = 0;
  const frames = {};
  for (const p of list) {
    if (x + p.w > W) {
      x = 0;
      y += shelf + 1;
      shelf = 0;
    }
    frames[p.name] = { x, y, w: p.w, h: p.h, q: p.q, ox: p.ox, oy: p.oy };
    x += p.w + 1;
    shelf = Math.max(shelf, p.h);
  }
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = Math.max(1, y + shelf);
  const ctx = canvas.getContext("2d");
  if (ctx)
    for (const p of list) {
      const f = frames[p.name];
      ctx.drawImage(p.src, p.sx, p.sy, p.w, p.h, f.x, f.y, p.w, p.h);
    }
  return { canvas, frames, bytes: canvas.width * canvas.height * 4 };
}
/** Screen offsets of the attach points in each view (from the same 3D build). */
const ATT = VIEWS.map((vw) => {
  const V = makeView(vw.yaw);
  const C = [];
  for (let i = 0; i <= 30; i++) C.push(V.P(cub(TAIL_C, i / 30)));
  return {
    shL: V.P(surf(ARM_PHI, ARM_Y, ARM_OUT)),
    shR: V.P(surf(-ARM_PHI, ARM_Y, ARM_OUT)),
    tail: V.P(TAIL_ROOT),
    tailEnd: V.P(TAIL_END),
    tailZ: C[18].z,
    moonZ: V.P(TAIL_END).z,
    base: { x: 0, y: yS(B_BOT) + blobR(B_BOT) * SP * 0.6 },
    // the core opens low on the belly, under the mouth, on the side it faces (centred from behind)
    core:
      VIEWS.indexOf(vw) <= 2
        ? makeView(
            FACE_YAW[VIEWS.indexOf(vw)] * [0.3, 0.3, 0][VIEWS.indexOf(vw)],
          ).P(surf(0, -45, -2))
        : { x: 0, y: yS(-47) + blobR(-47) * SP },
  };
});
/** Facing 0..7 (45° steps, 0 = towards the camera, 2 = screen right) → drawn view + mirror. */
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
/** How much a forward tip shows as a screen rotation in each view (front and back show it as a squash). */
const PITCH_SCREEN = [0, 0.72, 1, 0.72, 0];
const SH = (side) => surf((side === "L" ? 1 : -1) * ARM_PHI, ARM_Y, ARM_OUT);
/** Which way a paw turns to lift, per view and side. */
const ASIGN = VIEWS.map((vw) => {
  const V = makeView(vw.yaw),
    o = {};
  for (const side of ["L", "R"]) {
    const M = armModel("rest", side),
      tip = V.P(M[M.length - 1].p),
      s0 = V.P(M[0].p);
    o[side] = tip.x - s0.x < 0 ? 1 : -1;
  }
  return o;
});
/** Depth of each drawn paw per view, side and pose: sets the draw order. */
const AZ = VIEWS.map((vw) => {
  const V = makeView(vw.yaw),
    o = {};
  for (const side of ["L", "R"]) {
    const sh = SH(side);
    for (const pose of ARM_POSE_NAMES) {
      const M = armModel(pose, side),
        m = M[Math.round(M.length * 0.7)].p;
      o[side + pose] = V.P({ x: sh.x + m.x, y: sh.y + m.y, z: sh.z + m.z }).z;
    }
  }
  return o;
});
/** Which way the tail turns to rise, per view (the tip goes up). */
const TSIGN = ATT.map((a) => (a.tailEnd.x - a.tail.x < 0 ? 1 : -1));
const EYEP = [0, 1, 2].map((v) => eyeLayout(v));
const GEMP = [0, 1, 2].map((v) => gemLayout(v));
const MOUTHP = [0, 1, 2].map((v) => mouthLayout(v));

/** The melt, in two drawn steps: k.f 1 = a sagging mound with drooping ears and sleepy eyes; 2 = a low lump, ear tips and the moon sinking. Origin = the floor. */
function paintMeltFrame(ctx, k) {
  const f = k.f,
    p = new Path2D();
  if (f === 1) {
    p.moveTo(-86, 0);
    p.bezierCurveTo(-90, -30, -64, -78, -20, -84);
    p.bezierCurveTo(20, -90, 70, -70, 84, -34);
    p.bezierCurveTo(92, -12, 96, -2, 100, 0);
    p.bezierCurveTo(60, 12, -50, 12, -86, 0);
    p.closePath();
  } else {
    p.moveTo(-108, 0);
    p.bezierCurveTo(-100, -20, -60, -40, -10, -42);
    p.bezierCurveTo(40, -44, 84, -30, 104, -10);
    p.bezierCurveTo(112, -4, 116, 0, 112, 2);
    p.bezierCurveTo(60, 14, -60, 14, -108, 0);
    p.closePath();
  }
  // drooping ears (f1) or just their tips (f2)
  const ear = (x, y, ang, s) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(s, s);
    const e = earShape({ x: -16, y: 0 }, { x: 16, y: 0 }, { x: 4, y: -34 });
    ctx.fillStyle = INK_MID;
    ctx.fill(e);
    ctx.fillStyle = "rgba(170,110,240,0.8)";
    ctx.fill(
      earShape({ x: -8, y: -3 }, { x: 9, y: -3 }, { x: 3, y: -24 }, 2, 2),
    );
    ctx.restore();
  };
  if (f === 1) {
    ear(-42, -70, -0.9, 0.9);
    ear(36, -74, 0.85, 0.9);
  } else {
    ear(-50, -34, -1.25, 0.6);
    ear(46, -36, 1.2, 0.6);
  }
  const g = ctx.createLinearGradient(0, f === 1 ? -88 : -44, 0, 6);
  g.addColorStop(0, INK_TOP);
  g.addColorStop(0.5, INK_MID);
  g.addColorStop(1, INK_BOT);
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  innerGlow(ctx, p, "rgba(6,3,20,0.9)", 12);
  innerGlow(ctx, p, RIM, 4, -3, 2.4);
  ctx.fillStyle = "rgba(240,236,255,0.85)";
  ctx.beginPath();
  ctx.ellipse(-40, f === 1 ? -60 : -30, 4, 7, 0.9, 0, TAU);
  ctx.fill();
  ctx.restore();
  // the face, melting with it: sleepy closed eyes, a wavy little mouth (f1 only)
  if (f === 1) {
    ctx.lineCap = "round";
    ctx.strokeStyle = C_INK;
    ctx.lineWidth = 3.6;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 34 - 11, -40);
      ctx.quadraticCurveTo(s * 34, -33, s * 34 + 11, -40);
      ctx.stroke();
    }
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const x = -8 + i,
        y = -24 + Math.sin(i * 0.8) * 1.6;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.save();
    ctx.translate(-70, -62);
    ctx.rotate(-0.6);
    ctx.scale(1.1, 1.1);
    paintMoon(ctx, {});
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(-86, -18);
    ctx.rotate(-1.1);
    ctx.scale(0.95, 0.95);
    paintMoon(ctx, {});
    ctx.restore();
  }
}

function paintGlow(ctx, k) {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 32);
  for (const [t, c] of k.stops) g.addColorStop(t, c);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 32, 0, TAU);
  ctx.fill();
}

function paintStar(ctx) {
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

export {
  VIEWS,
  CP,
  SP,
  yS,
  blobR,
  surf,
  makeView,
  B_BOT,
  EYE_LINE,
  MOUTH_LINE,
  MOON_S,
  MOON_JOIN,
  DRIP_FRAMES,
  DRIP_L,
  ARM_POSES,
  ARM_POSE_NAMES,
  armStates,
  armModel,
  ATT,
  FACING,
  PITCH_SCREEN,
  ASIGN,
  AZ,
  TSIGN,
  EYEP,
  GEMP,
  MOUTHP,
  EXPRS,
  MOUTHS,
  SH,
  faceYawOf,
  FACE_YAW,
};
