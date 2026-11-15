// @ts-nocheck -- canvas painters, checked by eye (the face sheet) and by tests/unit/boss-prismell*.test.ts
/**
 * Prismell, the prism-shelled snail (Prismatail's raid), drawn in code: the
 * part painters `(ctx, k)` for its five drawn views and the atlas they are
 * painted into once, when the raid's scene starts. Nothing here runs per
 * frame: boss-prismell.ts poses the pieces and boss-prismell-rig.ts places
 * them as images. The atlas is never read back: every piece is painted into
 * a canvas of its known size (its box), with no trimming.
 *
 * Units are rig px. Body-local axes: x = the snail's left, y = up,
 * z = forward; origin = the floor under the middle of its body. A view is a
 * yaw about y and a 14° camera pitch. The other three facings are mirrors.
 */
export const TAU = Math.PI * 2,
  DEG = Math.PI / 180;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const norm3 = (x, y, z) => {
  const l = Math.hypot(x, y, z) || 1;
  return { x: x / l, y: y / l, z: z / l };
};
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const PITCH = 14 * DEG,
  CP = Math.cos(PITCH),
  SP = Math.sin(PITCH);
/** Key light in camera space (x right, y up, z to the camera): top-left, front. */
const LIGHT = norm3(-0.55, 0.65, 0.52);
/** The five drawn views. */
export const VIEWS = [0, 45, 90, 135, 180].map((d) => ({ yaw: d * DEG }));
/** Facing (0..7, i·45° from towards the camera) → drawn view and mirror. */
export const FACING = [
  { v: 0, m: false },
  { v: 1, m: false },
  { v: 2, m: false },
  { v: 3, m: false },
  { v: 4, m: false },
  { v: 3, m: true },
  { v: 2, m: true },
  { v: 1, m: true },
];
export function makeView(yaw) {
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
    /** Screen point (y down), z = depth (bigger is nearer). */
    P: (p) => {
      const r = cam(p.x, p.y, p.z);
      return { x: r.x, y: -r.y, z: r.z };
    },
    N: (d) => cam(d.x, d.y, d.z),
  };
}
const lit = (n, amb = 0.3) =>
  clamp(
    amb +
      (1 - amb) * Math.max(0, n.x * LIGHT.x + n.y * LIGHT.y + n.z * LIGHT.z),
  );

// ── colour ──
const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const rgba = (c, a = 1) =>
  `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
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
/** A pastel rainbow hue (degrees) as rgb. */
function hue(h, s = 0.85, l = 0.72) {
  h = (((h % 360) + 360) % 360) / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s,
    p = 2 * l - q;
  const f = (t) => {
    t = (t + 1) % 1;
    return t < 1 / 6
      ? p + (q - p) * 6 * t
      : t < 0.5
        ? q
        : t < 2 / 3
          ? p + (q - p) * (2 / 3 - t) * 6
          : p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
/** The snail's pearly skin: lavender shade → pearl white. */
const R_SKIN = [
  [0, "#6f5f9e"],
  [0.22, "#9886c4"],
  [0.48, "#c4b6e6"],
  [0.74, "#e8def7"],
  [1, "#fffbff"],
];
const R_SKIN_DIM = [
  [0, "#4e4860"],
  [0.4, "#7a7390"],
  [1, "#bdb7cc"],
];
const LINE = "rgba(52,34,92,0.95)";
const C_INK = "#2a1b4d";

// ════════════════════════ the build ════════════════════════
/** The foot and neck: spheres along the spine (z, y, r). */
const SPINE = [
  [-104, 10, 10],
  [-94, 12, 12],
  [-84, 14, 14],
  [-74, 17, 18],
  [-54, 20, 21],
  [-32, 23, 24],
  [-8, 25, 26],
  [16, 28, 28],
  [36, 34, 30],
  [52, 46, 31],
  [60, 60, 30],
];
export const SHELL_C = { x: 0, y: 114, z: -34 };
export const SHELL_R = { x: 68, y: 74, z: 78 };
/** The heart: in the middle of the clear shell, behind its spiral's eye. */
export const CORE_3 = { x: 0, y: SHELL_C.y + 6, z: SHELL_C.z - 6 };
export const HEAD_C = { x: 0, y: 92, z: 66 };
export const HR = 40;
/** Head yaw per drawn view: the face turns a little less than the body. */
export const HEAD_YAW = [0, 30 * DEG, 72 * DEG, 135 * DEG, 180 * DEG];
/** The head's anchor height on screen: the same in every view (a level eye line). */
export const HEAD_Y = -78;
export const yS = (y) => -y * CP;

// ════════════════════════ painting helpers ════════════════════════
let PQ = 1;
/** Convex hull (monotone chain) of 2D points. */
function hull(pts) {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo = [],
    up = [];
  for (const q of p) {
    while (
      lo.length >= 2 &&
      cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0
    )
      lo.pop();
    lo.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (
      up.length >= 2 &&
      cross(up[up.length - 2], up[up.length - 1], q) <= 0
    )
      up.pop();
    up.push(q);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
/** A smooth closed path through points (midpoint quadratics): no corners. */
function smoothClosed(pts) {
  const p = new Path2D();
  const n = pts.length;
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const m0 = mid(pts[n - 1], pts[0]);
  p.moveTo(m0.x, m0.y);
  for (let i = 0; i < n; i++) {
    const a = pts[i],
      b = pts[(i + 1) % n],
      m = mid(a, b);
    p.quadraticCurveTo(a.x, a.y, m.x, m.y);
  }
  p.closePath();
  return p;
}
function smoothOpen(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const m = {
      x: (pts[i].x + pts[i + 1].x) / 2,
      y: (pts[i].y + pts[i + 1].y) / 2,
    };
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
  }
  const l = pts[pts.length - 1];
  ctx.lineTo(l.x, l.y);
}
function sparkle(ctx, x, y, r, color, alpha = 1, rot = 0) {
  // a four-point twinkle with curved (concave) sides
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  for (let i = 1; i <= 4; i++) {
    const a = (i * Math.PI) / 2,
      b = a - Math.PI / 4;
    ctx.quadraticCurveTo(
      Math.cos(b) * r * 0.14,
      Math.sin(b) * r * 0.14,
      Math.cos(a) * r,
      Math.sin(a) * r,
    );
  }
  ctx.fill();
  ctx.restore();
}

// ════════════════════════ the body ════════════════════════
/** The spine sampled every few px: a smooth foot, no scallops. */
const SPINE_FINE = (() => {
  const out = [];
  for (let i = 0; i < SPINE.length - 1; i++) {
    const a = SPINE[i],
      b = SPINE[i + 1],
      n = Math.max(1, Math.round(Math.abs(b[0] - a[0]) / 5));
    for (let j = 0; j < n; j++)
      out.push(a.map((va, k) => va + ((b[k] - va) * j) / n));
  }
  out.push(SPINE[SPINE.length - 1]);
  return out;
})();
function bodySpheres(v, part) {
  const V = makeView(VIEWS[v].yaw);
  return SPINE_FINE.filter(
    ([z]) => part === "all" || (part === "neck" ? z >= 30 : z <= -50),
  ).flatMap(([z, y, r]) =>
    // three spheres side by side: a foot wider than it is tall
    [-1, 0, 1].map((s) => {
      const c = V.P({ x: s * r * 0.34, y: s ? y - r * 0.1 : y, z });
      return { x: c.x, y: c.y, z: c.z, r: s ? r * 0.86 : r };
    }),
  );
}
function unionPath(spheres) {
  const p = new Path2D();
  for (const s of spheres) {
    p.moveTo(s.x + s.r, s.y);
    p.arc(s.x, s.y, s.r, 0, TAU);
  }
  return p;
}
/**
 * The foot and neck. part "all" is the whole body; "neck" and "tail" are the
 * same paint clipped to a few spheres (laid over the shell where the body is
 * nearer the camera than the shell).
 */
export function paintBody(ctx, k) {
  const v = k.v,
    part = k.part || "all",
    dim = !!k.dim;
  const all = bodySpheres(v, "all");
  const full = unionPath(all);
  const mine = part === "all" ? full : unionPath(bodySpheres(v, part));
  const R = dim ? R_SKIN_DIM : R_SKIN;
  let top = Infinity,
    bot = -Infinity;
  for (const s of all) {
    top = Math.min(top, s.y - s.r);
    bot = Math.max(bot, s.y + s.r);
  }
  ctx.save();
  ctx.clip(mine);
  const g = ctx.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, rgba(ramp(R, 0.95)));
  g.addColorStop(0.45, rgba(ramp(R, 0.72)));
  g.addColorStop(1, rgba(ramp(R, 0.36)));
  ctx.fillStyle = g;
  ctx.fill(full);
  // soft round form: each sphere lit from the top left (all of them, for one seamless paint)
  for (const s of all.filter((_, i) => i % 9 === 1).sort((a, b) => a.z - b.z)) {
    const hg = ctx.createRadialGradient(
      s.x - s.r * 0.35,
      s.y - s.r * 0.45,
      s.r * 0.05,
      s.x - s.r * 0.2,
      s.y - s.r * 0.25,
      s.r * 1.05,
    );
    hg.addColorStop(0, `rgba(255,252,255,${dim ? 0.12 : 0.42})`);
    hg.addColorStop(0.6, "rgba(255,250,255,0)");
    ctx.fillStyle = hg;
    ctx.fill(full);
  }
  // a pearly sheen along the back: pink → cyan
  if (!dim) {
    const sg = ctx.createLinearGradient(-110, top, 110, top + 30);
    sg.addColorStop(0, "rgba(255,190,226,0.22)");
    sg.addColorStop(0.5, "rgba(206,236,255,0.24)");
    sg.addColorStop(1, "rgba(255,226,190,0.2)");
    ctx.fillStyle = sg;
    ctx.fill(full);
  }
  // the foot's soft frill along the floor: a lighter wavy band
  ctx.beginPath();
  const fy = -3;
  ctx.moveTo(-200, 40);
  ctx.lineTo(-200, fy);
  for (let x = -200; x <= 200; x += 12)
    ctx.quadraticCurveTo(x + 6, fy - 5, x + 12, fy);
  ctx.lineTo(200, 40);
  ctx.closePath();
  ctx.fillStyle = dim ? "rgba(150,144,170,0.5)" : "rgba(238,226,255,0.55)";
  ctx.fill();
  // under-shade where it meets the floor
  const ug = ctx.createLinearGradient(0, -14, 0, 4);
  ug.addColorStop(0, "rgba(60,40,110,0)");
  ug.addColorStop(1, "rgba(60,40,110,0.32)");
  ctx.fillStyle = ug;
  ctx.fill(full);
  // pearl freckles on the back
  if (!dim) {
    const r = rng(11 + v);
    for (const s of all.filter((_, i) => i % 15 === 4).slice(1, 7)) {
      const a = -2.2 + r() * 1.2;
      const x = s.x + Math.cos(a) * s.r * 0.55,
        y = s.y + Math.sin(a) * s.r * 0.6;
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.arc(x, y, 1.3 + r() * 1.3, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ════════════════════════ the shell ════════════════════════
/** A point on the shell's side surface (side sx = ±1) from spiral coords (u fwd, v up). */
function shellSide(u, v, sx) {
  const q = 1 - (u / SHELL_R.z) ** 2 - (v / SHELL_R.y) ** 2;
  const x = sx * SHELL_R.x * Math.sqrt(Math.max(0, q)) ** 0.8;
  return { x, y: SHELL_C.y + v, z: SHELL_C.z + u };
}
const shellNormal = (p) =>
  norm3(
    (p.x - SHELL_C.x) / SHELL_R.x ** 2,
    (p.y - SHELL_C.y) / SHELL_R.y ** 2,
    (p.z - SHELL_C.z) / SHELL_R.z ** 2,
  );
/** The spiral, in the shell's plane: the eye a little up and back. */
export const SPIRAL = { cu: -6, cv: 6, r0: 2.6, b: 0.205, turns: 2.6 };
const spiralR = (t) => SPIRAL.r0 * Math.exp(SPIRAL.b * t);
/** The rim (in the plane) along a direction: where the spiral may grow to. */
function rimR(a) {
  // ray from the spiral's eye to the ellipse u²/Rz² + v²/Ry² = 0.97²
  const c = Math.cos(a),
    s = Math.sin(a),
    A = (c / SHELL_R.z) ** 2 + (s / SHELL_R.y) ** 2,
    B =
      2 * ((SPIRAL.cu * c) / SHELL_R.z ** 2 + (SPIRAL.cv * s) / SHELL_R.y ** 2),
    C = (SPIRAL.cu / SHELL_R.z) ** 2 + (SPIRAL.cv / SHELL_R.y) ** 2 - 1.0;
  return (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);
}
const spiralUV = (t, out = 0) => {
  // the spiral turns backwards over the top (a snail shell's coil)
  const a = -t + 0.6;
  const r = Math.min(spiralR(t) + out, rimR(a));
  return { u: SPIRAL.cu + Math.cos(a) * r, v: SPIRAL.cv + Math.sin(a) * r, a };
};
/** Shell silhouette in a view, local to the projected centre. */
function shellOutline(V, o) {
  const pts = [];
  for (let i = 0; i < 28; i++)
    for (let j = 0; j <= 14; j++) {
      const th = (i / 28) * TAU,
        ph = (j / 14) * Math.PI - Math.PI / 2;
      const x = SHELL_C.x + SHELL_R.x * Math.cos(ph) * Math.cos(th),
        z = SHELL_C.z + SHELL_R.z * Math.cos(ph) * Math.sin(th),
        y = SHELL_C.y + SHELL_R.y * Math.sin(ph);
      const p = V.P({ x, y, z });
      pts.push({ x: p.x - o.x, y: p.y - o.y });
    }
  return hull(pts);
}
export const SHELL_FACETS = [0, 34, 26, 19];
export const SHELL_GLINTS = [0, 3, 5, 7];
/**
 * The crystal shell, centred on its projected middle: a clear lavender
 * crystal coiled in a spiral of facets, rainbow light on their edges, the
 * heart's warm light shining through from inside. Phases add facets, colour
 * and glints; `dim` is the beaten, lightless shell.
 */
export function paintShell(ctx, k) {
  const v = k.v,
    ph = k.ph || 1,
    dim = !!k.dim;
  const V = makeView(VIEWS[v].yaw);
  const o = V.P(SHELL_C);
  const L = (p) => {
    const q = V.P(p);
    return { x: q.x - o.x, y: q.y - o.y, z: q.z };
  };
  const out = smoothClosed(shellOutline(V, o));
  const rainbow = dim ? 0 : [0, 0.5, 0.75, 1][ph];
  // body of the crystal
  const bg = ctx.createRadialGradient(-26, -34, 6, 0, 0, 96);
  if (dim) {
    bg.addColorStop(0, "#cfcbd9");
    bg.addColorStop(0.6, "#8f89a6");
    bg.addColorStop(1, "#5a5470");
  } else {
    bg.addColorStop(0, "#f4efff");
    bg.addColorStop(0.45, "#cfc3f6");
    bg.addColorStop(0.8, "#a99ee6");
    bg.addColorStop(1, "#7f73c6");
  }
  ctx.fillStyle = bg;
  ctx.fill(out);
  ctx.save();
  ctx.clip(out);
  // the heart's light through the crystal
  const c = L(CORE_3);
  if (!dim) {
    const cg = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 44);
    cg.addColorStop(0, "rgba(255,240,200,0.6)");
    cg.addColorStop(0.35, "rgba(255,196,226,0.22)");
    cg.addColorStop(1, "rgba(255,196,226,0)");
    ctx.fillStyle = cg;
    ctx.fill(out);
  }
  // the facets: chambers between one whorl and the next
  const step = SHELL_FACETS[ph] * DEG;
  const T1 = SPIRAL.turns * TAU;
  const facets = [];
  for (const sx of [-1, 1]) {
    for (let t = 0.5; t < T1; t += step) {
      const t2 = Math.min(T1, t + step);
      const split = ph === 3 && t > TAU ? 2 : 1;
      for (let s = 0; s < split; s++) {
        const f0 = s / split,
          f1 = (s + 1) / split;
        const ring = (tt, f) => {
          const inner = spiralUV(tt),
            outer = spiralUV(tt + TAU),
            u = lerp(inner.u, outer.u, f),
            vv = lerp(inner.v, outer.v, f);
          return shellSide(u, vv, sx);
        };
        const poly = [];
        for (let i = 0; i <= 3; i++) poly.push(ring(lerp(t, t2, i / 3), f0));
        for (let i = 0; i <= 3; i++) poly.push(ring(lerp(t2, t, i / 3), f1));
        const mid = ring((t + t2) / 2, (f0 + f1) / 2);
        const n = V.N(shellNormal(mid));
        if (n.z < 0.02) continue;
        facets.push({ poly: poly.map(L), n, t, sx, z: L(mid).z, mid: L(mid) });
      }
    }
  }
  facets.sort((a, b) => a.z - b.z);
  const r = rng(5 + v * 7 + ph);
  for (const f of facets) {
    const p = new Path2D();
    p.moveTo(f.poly[0].x, f.poly[0].y);
    for (let i = 1; i < f.poly.length; i++) {
      // gently curved edges: facets of a polished gem, never ruled lines
      const a = f.poly[i - 1],
        b = f.poly[i];
      p.quadraticCurveTo(
        (a.x + b.x) / 2 + (f.mid.x - (a.x + b.x) / 2) * 0.04,
        (a.y + b.y) / 2 + (f.mid.y - (a.y + b.y) / 2) * 0.04,
        b.x,
        b.y,
      );
    }
    p.closePath();
    const l = lit(f.n, 0.25);
    const j = (r() - 0.5) * 0.12;
    const base = dim
      ? mix(hex("#5d5874"), hex("#c9c4d6"), clamp(l + j))
      : mix(hex("#8c7fd3"), hex("#fbf8ff"), clamp(l + j));
    const tint = hue(f.t * 38 + f.sx * 50 + v * 20, 0.8, 0.74);
    const col = mix(base, tint, dim ? 0 : 0.16 + 0.12 * rainbow);
    const a = f.poly[0],
      b = f.poly[f.poly.length - 1];
    const fg = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    fg.addColorStop(0, rgba(mix(col, [255, 255, 255], 0.35), 0.78));
    fg.addColorStop(1, rgba(mix(col, [70, 50, 140], 0.12), 0.7));
    ctx.fillStyle = fg;
    ctx.fill(p);
    // the facet's edges: white, with a rainbow fringe (light split by the prism)
    ctx.lineJoin = "round";
    if (!dim) {
      ctx.strokeStyle = rgba(
        hue(f.t * 55 + 200 * f.sx, 1, 0.66),
        0.3 + 0.4 * rainbow,
      );
      ctx.lineWidth = 1.6;
      ctx.save();
      ctx.translate(0.7, 0.5);
      ctx.stroke(p);
      ctx.restore();
    }
    ctx.strokeStyle = dim
      ? "rgba(220,216,232,0.35)"
      : `rgba(255,255,255,${0.5 + 0.25 * l})`;
    ctx.lineWidth = 0.9;
    ctx.stroke(p);
  }
  // the spiral's groove: the coil every view reads
  for (const sx of [-1, 1]) {
    const pts = [];
    for (let t = 0.3; t <= T1 - 0.05; t += 0.08) {
      const q = spiralUV(t);
      const P3 = shellSide(q.u, q.v, sx);
      if (V.N(shellNormal(P3)).z < 0.02) {
        if (pts.length > 2) groove(ctx, pts, dim, rainbow);
        pts.length = 0;
        continue;
      }
      pts.push(L(P3));
    }
    if (pts.length > 2) groove(ctx, pts, dim, rainbow);
  }
  // rainbow refraction along the rim, strongest away from the light
  if (!dim) {
    const hullPts = shellOutline(V, o);
    ctx.lineWidth = 4.5;
    for (let i = 0; i < hullPts.length; i++) {
      const a = hullPts[i],
        b = hullPts[(i + 1) % hullPts.length];
      const ang = Math.atan2((a.y + b.y) / 2, (a.x + b.x) / 2);
      const away = 0.5 + 0.5 * Math.cos(ang - 0.7);
      ctx.strokeStyle = rgba(
        hue((ang / TAU) * 360 * 1.5 + 30, 1, 0.68),
        (0.18 + 0.45 * rainbow) * away,
      );
      ctx.beginPath();
      ctx.moveTo(a.x * 0.97, a.y * 0.97);
      ctx.lineTo(b.x * 0.97, b.y * 0.97);
      ctx.stroke();
    }
  }
  // a gloss: two soft curved streaks of white, top left
  ctx.strokeStyle = dim ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.75)";
  ctx.lineCap = "round";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(6, 6, 66, Math.PI * 1.08, Math.PI * 1.36);
  ctx.stroke();
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(6, 6, 56, Math.PI * 1.12, Math.PI * 1.22);
  ctx.stroke();
  // baked glints on facet corners (more each phase)
  if (!dim) {
    const gr = rng(31 + v);
    const n = [0, 2, 4, 7][ph];
    const tips = facets.filter((f) => lit(f.n) > 0.55);
    for (let i = 0; i < n && tips.length; i++) {
      const f = tips[Math.floor(gr() * tips.length)];
      const q = f.poly[Math.floor(gr() * f.poly.length)];
      sparkle(
        ctx,
        q.x,
        q.y,
        3.5 + gr() * 3,
        "rgba(255,255,255,0.95)",
        1,
        gr() * 0.6,
      );
    }
  }
  ctx.restore();
  // a crisp inner rim
  ctx.strokeStyle = dim ? "rgba(230,226,240,0.35)" : "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1.4;
  ctx.save();
  ctx.translate(-0.6, -0.8);
  ctx.scale(0.985, 0.985);
  ctx.stroke(out);
  ctx.restore();
}
function groove(ctx, pts, dim, rainbow) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  smoothOpen(ctx, pts);
  ctx.strokeStyle = dim ? "rgba(60,54,80,0.45)" : "rgba(84,58,168,0.55)";
  ctx.lineWidth = 3.4;
  ctx.stroke();
  smoothOpen(
    ctx,
    pts.map((p) => ({ x: p.x - 0.9, y: p.y - 1.1 })),
  );
  ctx.strokeStyle = dim
    ? "rgba(235,232,245,0.4)"
    : `rgba(255,255,255,${0.75 + 0.2 * rainbow})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// ════════════════════════ the heart, the shield ════════════════════════
function heartPath(s) {
  const p = new Path2D();
  p.moveTo(0, s * 0.95);
  p.bezierCurveTo(-s * 0.35, s * 0.62, -s * 1.05, s * 0.2, -s * 1.0, -s * 0.3);
  p.bezierCurveTo(-s * 0.95, -s * 0.85, -s * 0.25, -s * 1.0, 0, -s * 0.48);
  p.bezierCurveTo(s * 0.25, -s * 1.0, s * 0.95, -s * 0.85, s * 1.0, -s * 0.3);
  p.bezierCurveTo(s * 1.05, s * 0.2, s * 0.35, s * 0.62, 0, s * 0.95);
  p.closePath();
  return p;
}
/** The crystal heart in the spiral's eye: dim behind its shield, or blazing open. */
export function paintHeart(ctx, k) {
  const open = !!k.open,
    s = 12;
  const p = heartPath(s);
  const g = ctx.createRadialGradient(-4, -5, 1, 0, 0, s * 1.3);
  if (open) {
    g.addColorStop(0, "#fffdf2");
    g.addColorStop(0.35, "#ffe9a6");
    g.addColorStop(0.75, "#ff9ec4");
    g.addColorStop(1, "#e566a6");
  } else {
    g.addColorStop(0, "#fff2f8");
    g.addColorStop(0.5, "#f1b9d6");
    g.addColorStop(1, "#b97fb5");
  }
  ctx.fillStyle = g;
  ctx.fill(p);
  // facets: a cut gem
  ctx.save();
  ctx.clip(p);
  ctx.strokeStyle = open ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.55)";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.48);
  ctx.quadraticCurveTo(-1, s * 0.2, 0, s * 0.95);
  ctx.moveTo(-s * 0.95, -s * 0.3);
  ctx.quadraticCurveTo(-s * 0.4, -s * 0.05, 0, s * 0.1);
  ctx.quadraticCurveTo(s * 0.4, -s * 0.05, s * 0.95, -s * 0.3);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = open ? "rgba(180,40,110,0.8)" : "rgba(120,60,120,0.75)";
  ctx.lineWidth = 1.3;
  ctx.stroke(p);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.ellipse(-s * 0.48, -s * 0.42, s * 0.2, s * 0.13, -0.6, 0, TAU);
  ctx.fill();
}
/** The shield over the heart while the light has not reached it: a crystal lens. */
export function paintShield(ctx) {
  const R = 19;
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (i * TAU) / 6 + Math.PI / 6;
    return { x: Math.cos(a) * R, y: Math.sin(a) * R };
  });
  const p = smoothClosed(
    pts.flatMap((q, i) => {
      const n = pts[(i + 1) % 6];
      return [q, { x: (q.x + n.x) * 0.52, y: (q.y + n.y) * 0.52 }];
    }),
  );
  const g = ctx.createRadialGradient(-6, -7, 2, 0, 0, R * 1.2);
  g.addColorStop(0, "rgba(255,255,255,0.75)");
  g.addColorStop(0.5, "rgba(196,236,255,0.42)");
  g.addColorStop(1, "rgba(150,170,255,0.55)");
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 1.6;
  ctx.stroke(p);
  ctx.strokeStyle = "rgba(170,200,255,0.7)";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (let i = 0; i < 6; i += 2) {
    ctx.moveTo(pts[i].x * 0.5, pts[i].y * 0.5);
    ctx.quadraticCurveTo(
      pts[i].x * 0.75,
      pts[i].y * 0.8,
      pts[i].x * 0.92,
      pts[i].y * 0.92,
    );
  }
  ctx.stroke();
}

// ════════════════════════ the head ════════════════════════
/** The round head (no face), lit from the top left. */
export function paintHead(ctx, k) {
  const dim = !!k.dim,
    back = k.v >= 3;
  const R = dim ? R_SKIN_DIM : R_SKIN;
  const g = ctx.createRadialGradient(
    -HR * 0.38,
    -HR * 0.45,
    3,
    -HR * 0.1,
    -HR * 0.1,
    HR * 1.15,
  );
  g.addColorStop(0, rgba(ramp(R, 1)));
  g.addColorStop(0.45, rgba(ramp(R, 0.82)));
  g.addColorStop(0.85, rgba(ramp(R, 0.55)));
  g.addColorStop(1, rgba(ramp(R, 0.42)));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, HR, 0, TAU);
  ctx.fill();
  if (!dim) {
    // pearly rim light (pink → cyan) on the shadow side
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, HR, 0, TAU);
    ctx.clip();
    const rg = ctx.createLinearGradient(HR, HR, -HR * 0.2, -HR * 0.2);
    rg.addColorStop(0, "rgba(196,236,255,0.5)");
    rg.addColorStop(0.18, "rgba(255,200,236,0.25)");
    rg.addColorStop(0.4, "rgba(255,200,236,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(-HR, -HR, HR * 2, HR * 2);
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.ellipse(-HR * 0.42, -HR * 0.5, HR * 0.17, HR * 0.1, -0.7, 0, TAU);
    ctx.fill();
  }
  if (back) {
    // the nape: a soft fold where the head meets the neck
    ctx.strokeStyle = "rgba(90,70,150,0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, HR * 0.95, HR * 0.6, -Math.PI * 0.82, -Math.PI * 0.18);
    ctx.stroke();
  }
}
/** An antenna: a soft stalk up from its root (origin) ending in a crystal bead. */
export const ANT_L = 34;
export function paintAntenna(ctx, k) {
  const dim = !!k.dim;
  const g = ctx.createLinearGradient(-4, 0, 4, 0);
  g.addColorStop(0, dim ? "#a39dbb" : "#efe6fb");
  g.addColorStop(1, dim ? "#6d6788" : "#a896d4");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-4.6, 2);
  ctx.quadraticCurveTo(-3.6, -ANT_L * 0.5, -1.9, -ANT_L);
  ctx.lineTo(1.9, -ANT_L);
  ctx.quadraticCurveTo(3.6, -ANT_L * 0.5, 4.6, 2);
  ctx.closePath();
  ctx.fill();
  // the bead: a little prism crystal ball
  const r = 6.4,
    y = -ANT_L - 3;
  const bg = ctx.createRadialGradient(-2.2, y - 2.4, 0.5, 0, y, r);
  if (dim) {
    bg.addColorStop(0, "#d8d4e2");
    bg.addColorStop(1, "#77708f");
  } else {
    bg.addColorStop(0, "#ffffff");
    bg.addColorStop(0.35, "#ffd6ef");
    bg.addColorStop(0.7, "#b9a8ff");
    bg.addColorStop(1, "#7fd8f0");
  }
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(0, y, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = dim ? "rgba(70,64,90,0.8)" : "rgba(90,60,160,0.75)";
  ctx.lineWidth = 1.1;
  ctx.stroke();
  if (!dim) sparkle(ctx, -2, y - 2.2, 2.8, "rgba(255,255,255,1)");
}

// ════════════════════════ the face ════════════════════════
export const EXPRS = ["idle", "glare", "wide", "hurt", "dizzy", "closed"];
export const MOUTHS = ["smile", "smirk", "open", "o", "wavy", "flat"];
/** Head-local screen heights: the eye line and the mouth (the same in every view). */
export const EYE_LINE = 6;
export const MOUTH_Y = 23;
const EYE_AZ = 25 * DEG;
/** The head's half-width at a height (its outline, head-local). */
export const headHalf = (y) => Math.sqrt(Math.max(0, HR * HR - y * y));
/**
 * Where each eye sits in a face view (head-local screen px), and its own
 * drawing: front (two alike), ¾ (a near eye and a narrower far one tucked
 * inside the far edge) or profile (one eye, fully inside the outline).
 */
export function eyeLayout(v) {
  const f = HEAD_YAW[v],
    R = headHalf(EYE_LINE);
  if (v === 0)
    return [-1, 1].map((s) => ({
      kind: "front",
      side: s,
      x: s * R * Math.sin(EYE_AZ),
      y: EYE_LINE,
      hw: 9.6,
      hh: 11.2,
      gx: s * -0.6,
    }));
  if (v === 1) {
    const nx = R * Math.sin(f - EYE_AZ),
      fx = R * Math.sin(f + EYE_AZ) - 1.6;
    return [
      { kind: "far", side: 1, x: fx, y: EYE_LINE, hw: 5.9, hh: 10.6, gx: 1.6 },
      {
        kind: "near",
        side: -1,
        x: nx,
        y: EYE_LINE,
        hw: 9.2,
        hh: 11.2,
        gx: 1.6,
      },
    ];
  }
  return [
    {
      kind: "side",
      side: 1,
      x: R * Math.sin(f - EYE_AZ) - 2.5,
      y: EYE_LINE,
      hw: 7.2,
      hh: 10.8,
      gx: 2.2,
    },
  ];
}
/** The mouth: on the face's centre line at its height. */
export function mouthLayout(v) {
  return { x: headHalf(MOUTH_Y) * Math.sin(HEAD_YAW[v]), y: MOUTH_Y };
}
/** The eye's opening: curved lids, never a ruled line. */
function eyeOpening(e) {
  const { x, y, hw, hh } = e;
  const p = new Path2D();
  if (e.kind === "side") {
    // a profile eye: rounder at the front (+x), a soft corner at the back
    const bx = x - hw,
      fx = x + hw;
    p.moveTo(bx, y + hh * 0.12);
    p.bezierCurveTo(
      bx + hw * 0.2,
      y - hh * 1.1,
      fx - hw * 0.1,
      y - hh * 1.15,
      fx,
      y - hh * 0.1,
    );
    p.bezierCurveTo(
      fx + hw * 0.08,
      y + hh * 0.8,
      bx + hw * 0.55,
      y + hh * 1.1,
      bx,
      y + hh * 0.12,
    );
    p.closePath();
    return p;
  }
  const t = e.kind === "far" ? 0.82 : 1; // the far eye: its outer side rounds off sooner
  p.moveTo(x - hw, y + hh * 0.05);
  p.bezierCurveTo(
    x - hw * 0.95,
    y - hh * 1.32,
    x + hw * 0.95 * t,
    y - hh * 1.32,
    x + hw,
    y + hh * 0.05,
  );
  p.bezierCurveTo(
    x + hw * 0.98,
    y + hh * 1.28,
    x - hw * 0.98,
    y + hh * 1.28,
    x - hw,
    y + hh * 0.05,
  );
  p.closePath();
  return p;
}
/**
 * The upper lid line for an expression, as a curve across the eye (points
 * left → right, head-local). Returns null when the lid is fully open.
 * `inner` is the side towards the face's middle (+1 right of the eye).
 */
function lidCurve(e, expr) {
  const { x, y, hw, hh } = e;
  const inner = e.kind === "side" ? 1 : -e.side; // towards the centre line
  if (expr === "idle") {
    // proud and a little smug: the lid rests a fifth down, level
    const ly = y - hh * 0.55;
    return [
      { x: x - hw * 1.1, y: ly + hh * 0.05 },
      { x, y: ly - hh * 0.22 },
      { x: x + hw * 1.1, y: ly + hh * 0.05 },
    ];
  }
  if (expr === "glare") {
    // lower and slanted down towards the middle, still a curve
    const ly = y - hh * 0.25;
    const tilt = hh * 0.38;
    return [
      { x: x - hw * 1.1, y: ly - tilt * -inner },
      { x, y: ly - hh * 0.14 },
      { x: x + hw * 1.1, y: ly - tilt * inner },
    ];
  }
  return null;
}
const IRIS = { r: 7.4, pupil: 3.6 };
export function paintEye(ctx, e, expr) {
  const { x, y, hw, hh } = e;
  if (expr === "closed" || expr === "hurt") {
    // closed: a happy curve (∩); hurt: squeezed tight, a curved chevron
    ctx.lineCap = "round";
    ctx.strokeStyle = C_INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    if (expr === "closed") {
      ctx.moveTo(x - hw * 0.95, y + hh * 0.15);
      ctx.quadraticCurveTo(x, y - hh * 0.85, x + hw * 0.95, y + hh * 0.15);
    } else {
      const d = e.kind === "side" ? -1 : e.side; // the point aims at the centre line (in profile: the front)
      const tip = x - d * hw * 0.55;
      ctx.moveTo(x + d * hw * 0.85, y - hh * 0.55);
      ctx.quadraticCurveTo(x + d * hw * 0.1, y - hh * 0.2, tip, y + hh * 0.05);
      ctx.quadraticCurveTo(
        x + d * hw * 0.1,
        y + hh * 0.3,
        x + d * hw * 0.85,
        y + hh * 0.62,
      );
    }
    ctx.stroke();
    // lashes: two small curved flicks at the outer corner
    const oc = e.kind === "side" ? -1 : e.side;
    if (expr === "closed" && e.kind !== "far") {
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      const cx = x + oc * hw * 0.9,
        cy = y + hh * 0.05;
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(cx + oc * 3, cy - 1, cx + oc * 4.5, cy - 4);
      ctx.stroke();
    }
    return;
  }
  const open = eyeOpening(e);
  // a lowered lid: everything above its curve is simply not drawn
  const lid = lidCurve(e, expr);
  let below = null,
    lidPath = null;
  if (lid) {
    const cx = lid[1].x * 2 - (lid[0].x + lid[2].x) / 2,
      cy = lid[1].y * 2 - (lid[0].y + lid[2].y) / 2;
    below = new Path2D();
    below.moveTo(lid[0].x - 4, y + hh * 3);
    below.lineTo(lid[0].x - 4, lid[0].y);
    below.quadraticCurveTo(cx, cy, lid[2].x + 4, lid[2].y);
    below.lineTo(lid[2].x + 4, y + hh * 3);
    below.closePath();
    lidPath = new Path2D();
    lidPath.moveTo(lid[0].x - 4, lid[0].y);
    lidPath.quadraticCurveTo(cx, cy, lid[2].x + 4, lid[2].y);
  }
  ctx.save();
  ctx.clip(open);
  if (below) ctx.clip(below);
  // the white: pearly, shaded under the top lid
  const wg = ctx.createLinearGradient(0, y - hh, 0, y + hh);
  wg.addColorStop(0, "#d9d0f2");
  wg.addColorStop(0.35, "#ffffff");
  wg.addColorStop(1, "#f6f1ff");
  ctx.fillStyle = wg;
  ctx.fill(open);
  if (expr === "dizzy") {
    ctx.strokeStyle = C_INK;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    for (let a = 0; a < TAU * 2.2; a += 0.2) {
      const rr = 0.8 + a * 0.62;
      const px = x + Math.cos(a) * rr * 0.9,
        py = y + Math.sin(a) * rr;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  } else {
    // the iris: always a round circle, clipped by the lids
    const ir = expr === "wide" ? IRIS.r * 0.82 : IRIS.r;
    const ix = x + (e.gx || 0),
      iy = y + (expr === "wide" ? -0.5 : 1.2);
    const ig = ctx.createLinearGradient(ix, iy - ir, ix, iy + ir);
    ig.addColorStop(0, "#3a1d78");
    ig.addColorStop(0.5, "#7a3fc6");
    ig.addColorStop(0.82, "#d06fd8");
    ig.addColorStop(1, "#7fe0f0");
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.arc(ix, iy, ir, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#1a0b38";
    ctx.beginPath();
    ctx.arc(
      ix,
      iy + 0.3,
      expr === "wide" ? IRIS.pupil * 0.75 : IRIS.pupil,
      0,
      TAU,
    );
    ctx.fill();
    // glossy: one big round light, one small, and a prism twinkle
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ix - ir * 0.38, iy - ir * 0.4, ir * 0.36, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ix + ir * 0.4, iy + ir * 0.42, ir * 0.15, 0, TAU);
    ctx.fill();
    sparkle(
      ctx,
      ix + ir * 0.42,
      iy - ir * 0.45,
      ir * 0.36,
      "rgba(255,255,255,0.95)",
    );
  }
  ctx.restore();
  ctx.lineCap = "round";
  ctx.strokeStyle = C_INK;
  if (lidPath) {
    // the lid's lash line, inside the opening (half of a wide stroke shows)
    ctx.save();
    ctx.clip(open);
    ctx.lineWidth = 5.2;
    ctx.stroke(lidPath);
    ctx.restore();
    // the rest of the outline: only below the lid
    ctx.save();
    ctx.clip(below);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(42,27,77,0.8)";
    ctx.stroke(open);
    ctx.restore();
  } else {
    ctx.save();
    // only the upper half of the outline is the thick lash line
    ctx.beginPath();
    ctx.rect(x - hw * 2, y - hh * 2, hw * 4, hh * 2.05);
    ctx.clip();
    ctx.lineWidth = 2.6;
    ctx.stroke(open);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - hw * 2, y + hh * 0.05, hw * 4, hh * 2);
    ctx.clip();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "rgba(42,27,77,0.6)";
    ctx.stroke(open);
    ctx.restore();
  }
  // an outer-corner lash flick (a curve), not on the far eye
  if (e.kind !== "far") {
    const oc = e.kind === "side" ? -1 : e.side;
    const cx = x + oc * hw * (e.kind === "side" ? 1 : 0.98),
      cy = y - hh * (lid ? 0.25 : 0.2);
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.moveTo(cx - oc * 1, cy + 1);
    ctx.quadraticCurveTo(cx + oc * 2.6, cy - 0.6, cx + oc * 4.4, cy - 4.2);
    ctx.stroke();
  }
}
/** Both eyes of a face view with their blush, head-local. */
export function paintEyes(ctx, k) {
  const list = eyeLayout(k.v);
  // blush first, clipped to the head
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, HR - 1, 0, TAU);
  ctx.clip();
  for (const e of list) {
    const bx =
        e.x +
        (e.kind === "side" ? -2 : e.side * 4) * (e.kind === "far" ? 0.4 : 1),
      by = e.y + e.hh + 3.5;
    const w = e.kind === "far" ? 4.5 : 8;
    const g = ctx.createRadialGradient(bx, by, 0.5, bx, by, w);
    g.addColorStop(0, "rgba(255,138,190,0.62)");
    g.addColorStop(1, "rgba(255,138,190,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(bx, by, w, w * 0.6, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  for (const e of list) paintEye(ctx, e, k.expr);
}
/** The mouth: small and on the centre line. */
export function paintMouth(ctx, k) {
  const v = k.v,
    m = k.m,
    { x, y } = mouthLayout(v);
  const side = v === 2;
  const w = side ? 4.2 : v === 1 ? 5.2 : 5.8;
  // in profile the mouth reaches back from the centre line only
  const x0 = side ? x - 1 - w * 1.5 : x - w,
    x1 = side ? x - 1 : x + w;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = C_INK;
  ctx.lineWidth = 2;
  if (m === "smile") {
    ctx.beginPath();
    ctx.moveTo(x0, y - 1);
    ctx.quadraticCurveTo((x0 + x1) / 2, y + 4, x1, y - 1);
    ctx.stroke();
  } else if (m === "smirk") {
    // vain: one corner up (towards the far side), a curve
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.quadraticCurveTo(
      (x0 + x1) / 2 - 1,
      y + 3.2,
      x1 + (side ? 0 : 1),
      y - 3,
    );
    ctx.stroke();
  } else if (m === "open" || m === "o") {
    const p = new Path2D();
    if (m === "o") {
      const r = side ? 3 : 3.6;
      p.ellipse(side ? x - 2.6 : x, y + 1.5, r * 0.85, r, 0, 0, TAU);
    } else {
      p.moveTo(x0, y - 1.5);
      p.quadraticCurveTo((x0 + x1) / 2, y - 0.5, x1, y - 1.5);
      p.quadraticCurveTo(x1 - 0.5, y + 7, (x0 + x1) / 2, y + 7.2);
      p.quadraticCurveTo(x0 + 0.5, y + 7, x0, y - 1.5);
      p.closePath();
    }
    ctx.fillStyle = "#6a1f55";
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    ctx.fillStyle = "#ff8db8";
    ctx.beginPath();
    ctx.ellipse(
      (x0 + x1) / 2 - (m === "o" && side ? 2.6 : 0),
      y + 7,
      5,
      3.4,
      0,
      0,
      TAU,
    );
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 1.7;
    ctx.stroke(p);
  } else if (m === "wavy") {
    ctx.beginPath();
    ctx.moveTo(x0 - 1, y + 1);
    ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.25, y - 2.5, (x0 + x1) / 2, y + 1);
    ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.75, y + 4.5, x1 + 1, y + 1);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x0, y + 1);
    ctx.quadraticCurveTo((x0 + x1) / 2, y + 1.8, x1, y + 1);
    ctx.stroke();
  }
}

// ════════════════════════ small pieces ════════════════════════
export function paintGlow(ctx, k) {
  const r = 32;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  for (const [o, c] of k.stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
}
export function paintSparkle(ctx) {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 8);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, TAU);
  ctx.fill();
  sparkle(ctx, 0, 0, 14, "rgba(255,255,255,1)");
}
/** A long soft ray (the glare's spokes). */
export function paintRay(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, -60);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.quadraticCurveTo(-2.5, -30, 0, -60);
  ctx.quadraticCurveTo(2.5, -30, 5, 0);
  ctx.quadraticCurveTo(0, 4, -5, 0);
  ctx.fill();
}
export function paintStar(ctx) {
  ctx.fillStyle = "#ffe58a";
  ctx.strokeStyle = "#a8742a";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5,
      r = i % 2 ? 3.4 : 8;
    const px = Math.cos(a) * r,
      py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.lineJoin = "round";
  ctx.fill();
  ctx.stroke();
}

// ════════════════════════ attach points ════════════════════════
const ANT_ROOT = { x: 14, y: 33, z: 16 };
const ANT_DIR = norm3(0.42, 0.88, 0.2);
/** Glint spots on the shell surface (directions from its middle). */
const GLINTS = [
  [-0.6, 0.7, 0.4],
  [0.5, 0.8, 0.2],
  [-0.9, 0.1, 0.4],
  [0.2, 0.95, -0.3],
  [-0.4, 0.3, 0.86],
  [0.9, 0.35, -0.2],
  [-0.7, -0.2, -0.7],
  [0.6, -0.1, 0.78],
  [-0.2, 0.6, -0.78],
  [-0.8, 0.55, -0.1],
  [0.75, 0.6, 0.3],
  [-0.5, -0.1, 0.1],
  [0.45, 0.2, -0.85],
  [-0.1, 0.85, 0.5],
];
/** Screen attach points per drawn view (rig px from the floor point). */
export const ATT = VIEWS.map((vw, v) => {
  const V = makeView(vw.yaw);
  const head = V.P(HEAD_C);
  const shell = V.P(SHELL_C);
  const core = V.P(CORE_3);
  const H = makeView(HEAD_YAW[v]);
  const ants = [1, -1].map((s) => {
    const root = { x: ANT_ROOT.x * s, y: ANT_ROOT.y, z: ANT_ROOT.z };
    const tip = {
      x: root.x + ANT_DIR.x * s * ANT_L,
      y: root.y + ANT_DIR.y * ANT_L,
      z: root.z + ANT_DIR.z * ANT_L,
    };
    const a = H.P(root),
      b = H.P(tip);
    return {
      side: s,
      x: a.x,
      y: a.y,
      z: a.z,
      rot: Math.atan2(b.x - a.x, -(b.y - a.y)),
      len: Math.hypot(b.x - a.x, b.y - a.y) / ANT_L,
      tip: { x: b.x, y: b.y },
    };
  });
  const glints = GLINTS.map((d) => {
    const n = norm3(d[0], d[1], d[2]);
    const p = {
      x: SHELL_C.x + n.x * SHELL_R.x * 0.96,
      y: SHELL_C.y + n.y * SHELL_R.y * 0.96,
      z: SHELL_C.z + n.z * SHELL_R.z * 0.96,
    };
    const q = V.P(p);
    return {
      x: q.x - shell.x,
      y: q.y - shell.y,
      seen: V.N(shellNormal(p)).z > 0.1,
    };
  });
  return {
    head: { x: head.x, y: HEAD_Y },
    shell: { x: shell.x, y: shell.y },
    core: { x: core.x, y: core.y },
    /** Shell's top on screen (rig px above its middle). */
    shellTop: -(SHELL_R.y * CP + 4),
    ants,
    glints: glints.filter((g) => g.seen),
    /** Is the head nearer the camera than the shell? */
    headFront: v <= 2,
  };
});

// ════════════════════════ the atlas ════════════════════════
/** Atlas px per rig px by part. Fixed: it never follows the screen's pixel ratio. */
const QUAL = {
  body: 0.95,
  shell: 1.05,
  shellDim: 0.6,
  head: 1.35,
  face: 2.0,
  mouth: 2.4,
  ant: 1.6,
  heart: 2.2,
  fx: 0.8,
};
const PAD = 6;
/** A piece's box from its own geometry (+ margin): the atlas holds no empty space. */
function shellBox(v) {
  const V = makeView(VIEWS[v].yaw),
    o = V.P(SHELL_C),
    h = shellOutline(V, o);
  return [
    Math.min(...h.map((p) => p.x)) - 5,
    Math.min(...h.map((p) => p.y)) - 5,
    Math.max(...h.map((p) => p.x)) + 5,
    Math.max(...h.map((p) => p.y)) + 5,
  ];
}
function bodyBox(v, part) {
  const b = bodySpheres(v, part);
  return [
    Math.min(...b.map((s) => s.x - s.r)) - 3,
    Math.min(...b.map((s) => s.y - s.r)) - 3,
    Math.max(...b.map((s) => s.x + s.r)) + 3,
    Math.max(...b.map((s) => s.y + s.r)) + 3,
  ];
}
const HEAD_BOX = [-46, -46, 46, 46];
const FACE_BOX = [-30, -14, 42, 26];
const FACE_BOX_F = [-34, -14, 34, 26];
const ANT_BOX = [-9, -ANT_L - 12, 9, 6];
/** Every piece: its name, box (rig px), density and painter. */
export function prismellPieceSpecs() {
  const S = [];
  const add = (name, box, q, draw, k = {}, opt = {}) =>
    S.push({ name, box, q, draw, k, ...opt });
  for (let v = 0; v < 5; v++) {
    const BODY_BOX = bodyBox(v, "all"),
      SHELL_BOX = shellBox(v);
    add(`body_${v}`, BODY_BOX, QUAL.body, paintBody, { v }, { line: 2 });
    add(
      `bodyD_${v}`,
      BODY_BOX,
      QUAL.shellDim,
      paintBody,
      { v, dim: 1 },
      { line: 2 },
    );
    if (v <= 2)
      add(
        `neck_${v}`,
        bodyBox(v, "neck"),
        QUAL.body,
        paintBody,
        { v, part: "neck" },
        { outline: false },
      );
    else
      add(
        `tail_${v}`,
        bodyBox(v, "tail"),
        QUAL.body,
        paintBody,
        { v, part: "tail" },
        { outline: false },
      );
    for (const ph of [1, 2, 3])
      add(
        `shell_${v}_${ph}`,
        SHELL_BOX,
        QUAL.shell,
        paintShell,
        { v, ph },
        { line: 2.2 },
      );
    add(
      `shellD_${v}`,
      SHELL_BOX,
      QUAL.shellDim,
      paintShell,
      { v, dim: 1 },
      { line: 2 },
    );
    add(`head_${v}`, HEAD_BOX, QUAL.head, paintHead, { v }, { line: 1.8 });
  }
  add(
    `headD`,
    HEAD_BOX,
    QUAL.shellDim,
    paintHead,
    { v: 0, dim: 1 },
    { line: 1.8 },
  );
  for (let v = 0; v < 3; v++) {
    for (const e of EXPRS)
      add(
        `eyes_${v}_${e}`,
        v === 0 ? FACE_BOX_F : FACE_BOX,
        QUAL.face,
        paintEyes,
        { v, expr: e },
        { outline: false },
      );
    const mx = mouthLayout(v).x;
    for (const m of MOUTHS)
      add(
        `mouth_${v}_${m}`,
        [mx - 13, MOUTH_Y - 9, mx + 9, MOUTH_Y + 11],
        QUAL.mouth,
        paintMouth,
        { v, m },
        { outline: false },
      );
  }
  add("ant", ANT_BOX, QUAL.ant, paintAntenna, {}, { line: 1.4 });
  add("antD", ANT_BOX, QUAL.shellDim, paintAntenna, { dim: 1 }, { line: 1.4 });
  add(
    "heart_open",
    [-16, -16, 16, 16],
    QUAL.heart,
    paintHeart,
    { open: 1 },
    { outline: false },
  );
  add(
    "heart_shut",
    [-16, -16, 16, 16],
    QUAL.heart,
    paintHeart,
    {},
    { outline: false },
  );
  add(
    "shield",
    [-24, -24, 24, 24],
    QUAL.heart,
    paintShield,
    {},
    { outline: false },
  );
  add(
    "glow",
    [-34, -34, 34, 34],
    QUAL.fx,
    paintGlow,
    {
      stops: [
        [0, "rgba(255,255,255,1)"],
        [0.25, "rgba(255,255,255,0.6)"],
        [1, "rgba(255,255,255,0)"],
      ],
    },
    { outline: false },
  );
  add("sparkle", [-16, -16, 16, 16], 1.4, paintSparkle, {}, { outline: false });
  add("ray", [-7, -62, 7, 6], 1, paintRay, {}, { outline: false });
  add("star", [-10, -10, 10, 10], 2, paintStar, {}, { outline: false });
  return S;
}
export const pieceCanvasSize = (box, q) => ({
  w: Math.ceil((box[2] - box[0]) * q) + PAD * 2,
  h: Math.ceil((box[3] - box[1]) * q) + PAD * 2,
});
const PAGE_W = 2048;
/**
 * Paint on CPU-backed canvases. Nothing is ever read back; the hint only
 * keeps a one-off paint of many soft paths off a software-emulated GPU
 * canvas, where it took seconds instead of a few hundred milliseconds.
 */
const CPU = { willReadFrequently: true };
/**
 * Only the named pieces, each painted on its own canvas at density q (the
 * briefing picture: a dozen pieces at its own small scale, never the whole
 * battle atlas). Returns a frame per piece, like the atlas's.
 */
export function paintPrismellPieces(names, q) {
  const want = new Set(names);
  const out = {};
  for (const s of prismellPieceSpecs()) {
    if (!want.has(s.name)) continue;
    const { w, h } = pieceCanvasSize(s.box, q);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d", CPU);
    if (!g) continue;
    g.save();
    g.translate(PAD - s.box[0] * q, PAD - s.box[1] * q);
    g.scale(q, q);
    g.lineJoin = "round";
    s.draw(g, s.k);
    g.restore();
    let canvas = c;
    if (s.outline !== false) {
      const d = document.createElement("canvas");
      d.width = w;
      d.height = h;
      const dg = d.getContext("2d", CPU);
      if (dg) {
        dg.shadowColor = s.lineColor || LINE;
        dg.shadowBlur = (s.line || 1.6) * q;
        dg.drawImage(c, 0, 0);
        dg.shadowColor = "transparent";
        dg.shadowBlur = 0;
        dg.drawImage(c, 0, 0);
        canvas = d;
      }
    }
    out[s.name] = {
      canvas,
      x: 0,
      y: 0,
      w,
      h,
      q,
      ox: (PAD - s.box[0] * q) / q,
      oy: (PAD - s.box[1] * q) / q,
    };
  }
  return out;
}
/**
 * Paint every piece once into one canvas (skyline-packed). Nothing is read
 * back: each piece's frame is its box. frames[name] = {x, y, w, h, q, ox, oy}
 * with (ox, oy) the pivot in rig px from the frame's top-left.
 */
export function buildPrismellAtlas() {
  const specs = prismellPieceSpecs();
  const items = specs.map((s) => ({ s, ...pieceCanvasSize(s.box, s.q) }));
  const order = [...items].sort(
    (a, b) => b.h * 4096 + b.w - (a.h * 4096 + a.w),
  );
  const CW = 4,
    NC = PAGE_W / CW,
    sky = new Int32Array(NC);
  const spots = new Map();
  let H = 0;
  for (const it of order) {
    const nc = Math.ceil((it.w + 1) / CW);
    let bx = 0,
      by = 1e9;
    for (let c = 0; c + nc <= NC; c++) {
      let y = 0;
      for (let j = c; j < c + nc; j++)
        if (sky[j] > y) {
          y = sky[j];
          if (y >= by) break;
        }
      if (y < by) {
        by = y;
        bx = c;
      }
    }
    for (let j = bx; j < bx + nc; j++) sky[j] = by + it.h + 1;
    spots.set(it.s.name, { x: bx * CW, y: by });
    H = Math.max(H, by + it.h + 1);
  }
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_W;
  canvas.height = Math.max(1, H);
  const page = canvas.getContext("2d", CPU);
  const frames = {};
  for (const it of items) {
    const s = it.s,
      at = spots.get(s.name);
    const c = document.createElement("canvas");
    c.width = it.w;
    c.height = it.h;
    const g = c.getContext("2d", CPU);
    if (!g || !page) continue;
    PQ = s.q;
    g.save();
    g.translate(PAD - s.box[0] * s.q, PAD - s.box[1] * s.q);
    g.scale(s.q, s.q);
    g.lineJoin = "round";
    s.draw(g, s.k);
    g.restore();
    if (s.outline !== false) {
      // a soft dark outline: the piece's own silhouette, blurred, behind it
      // (inside the piece's own canvas, so it never bleeds onto a neighbour)
      const d = document.createElement("canvas");
      d.width = it.w;
      d.height = it.h;
      const dg = d.getContext("2d", CPU);
      if (dg) {
        dg.shadowColor = s.lineColor || LINE;
        dg.shadowBlur = (s.line || 1.6) * s.q;
        dg.drawImage(c, 0, 0);
        dg.shadowBlur = (s.line || 1.6) * s.q * 0.45;
        dg.drawImage(c, 0, 0);
        dg.shadowColor = "transparent";
        dg.shadowBlur = 0;
        dg.drawImage(c, 0, 0);
        page.drawImage(d, at.x, at.y);
      }
      d.width = d.height = 1;
    } else page.drawImage(c, at.x, at.y);
    c.width = c.height = 1;
    frames[s.name] = {
      x: at.x,
      y: at.y,
      w: it.w,
      h: it.h,
      q: s.q,
      ox: (PAD - s.box[0] * s.q) / s.q,
      oy: (PAD - s.box[1] * s.q) / s.q,
    };
  }
  return { canvas, frames, bytes: canvas.width * canvas.height * 4 };
}
