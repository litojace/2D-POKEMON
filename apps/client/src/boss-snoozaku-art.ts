// @ts-nocheck -- canvas painters, checked by eye (the face sheet) and by tests/unit/boss-snoozaku*.test.ts
/**
 * Snoozaku, the dream-eating baku (Somnara's raid), drawn in code: the part
 * painters `(ctx, k)` for its five drawn views, and the atlas they are
 * painted into once, when the raid's scene starts. Nothing here runs per
 * frame: boss-snoozaku.ts poses the pieces, boss-snoozaku-rig.ts places them
 * as images.
 *
 * Units are rig px. Body-local axes: x = the baku's left, y = up, z =
 * forward; origin = the floor under the middle of its body. Head-local axes
 * are the same, from the middle of the head. The three other facings are
 * mirrors of the five drawn views.
 *
 * Everything is round: the body is an ellipsoid with a cream saddle band,
 * the head a sphere, the trunk and the nightcap tubes of circles along a
 * curve, the legs capsules. Each eye is its own drawing per view (front,
 * three-quarter near and far, profile): never squeezed, the iris always a
 * circle, the lids always curves.
 *
 * Every piece's size is worked out from its geometry before it is painted,
 * so the atlas is packed first and painted straight into place: no pixel is
 * ever read back.
 */
const TAU = Math.PI * 2,
  DEG = Math.PI / 180;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const norm3 = (x, y, z) => {
  const l = Math.hypot(x, y, z) || 1;
  return { x: x / l, y: y / l, z: z / l };
};
const PITCH = 14 * DEG,
  CP = Math.cos(PITCH),
  SP = Math.sin(PITCH);
/** The five drawn views. The other three facings are mirrors. */
const VIEWS = [0, 45, 90, 135, 180].map((d) => d * DEG);
/** The head (and so the face, ears, trunk and cap) is drawn at these yaws. */
const FACE_YAW = [0, 40, 90, 135, 180].map((d) => d * DEG);
/** A view for painting: local point → screen (y down) with depth z (bigger = nearer). */
function makeView(yaw) {
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  const P = (p) => {
    const X = p.x * c + p.z * s,
      Z = -p.x * s + p.z * c;
    return { x: X, y: -p.y * CP + Z * SP, z: Z * CP + p.y * SP };
  };
  /** A local direction's depth component (toward the camera). */
  const facing = (n) => (-n.x * s + n.z * c) * CP + n.y * SP;
  return { yaw, c, s, P, facing };
}
/** Screen height of a body-local height, ignoring depth (the level lines). */
const yS = (y) => -y * CP;

// ── colour ──
const C = {
  ink: "rgba(36,24,84,0.95)",
  body: ["#c0b6f6", "#8579da", "#5d50b9", "#3f348c"],
  leg: ["#7a6fd0", "#5a4eb0", "#40358a"],
  band: ["#fff6e4", "#f6e6c8", "#dcc6a6"],
  muzzle: "#c9c1fa",
  tip: "#e7b8dc",
  nostril: "#5b3f86",
  earIn: "#f2b2d0",
  earRim: "#fff1dc",
  cap: ["#6a64c8", "#433d9a", "#2b2770", "#1d1a52"],
  brim: ["#fffaf0", "#f3e6cf", "#d6c3a6"],
  gold: "#ffd977",
  goldHot: "#fff3c2",
  lash: "#21174a",
  irisTop: "#2e2378",
  irisBot: "#8e74f2",
  pupil: "#150d38",
  blush: "rgba(255,150,196,",
  mouth: "#4a2453",
  tongue: "#ff9bbd",
  toe: "#fff3df",
};
/** Atlas px per rig px of the piece being painted (shadow sizes are in canvas px). */
let PQ = 1;

// ── painted marks ──
const HAS_FILTER = (() => {
  try {
    const c = document.createElement("canvas").getContext("2d");
    return !!c && "filter" in c;
  } catch {
    return false;
  }
})();
/**
 * A light or shade cast inward from a shape's edge (an inner shadow). The
 * shape may be a union of overlapping circles: the frame round it is cut
 * out by compositing (nothing is read back). dx, dy: rig px.
 */
let FRAME = null;
function innerGlow(ctx, path, color, blur, dx = 0, dy = 0) {
  const W = ctx.canvas.width,
    H = ctx.canvas.height;
  if (!W || !H) return;
  if (!FRAME) FRAME = document.createElement("canvas");
  if (FRAME.width < W || FRAME.height < H) {
    FRAME.width = Math.max(FRAME.width, W);
    FRAME.height = Math.max(FRAME.height, H);
  }
  const f = FRAME.getContext("2d");
  f.setTransform(1, 0, 0, 1, 0, 0);
  f.globalCompositeOperation = "source-over";
  f.clearRect(0, 0, FRAME.width, FRAME.height);
  f.fillStyle = "#000";
  f.fillRect(0, 0, W, H);
  f.globalCompositeOperation = "destination-out";
  f.setTransform(ctx.getTransform());
  f.fill(path);
  ctx.save();
  ctx.clip(path);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.shadowColor = color;
  ctx.shadowBlur = blur * PQ;
  ctx.shadowOffsetX = dx * PQ;
  ctx.shadowOffsetY = dy * PQ;
  ctx.drawImage(FRAME, 0, 0, W, H, 0, 0, W, H);
  ctx.restore();
}
/** A soft round spot of colour. */
function spot(ctx, x, y, r, color, a0, a1 = 0) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color + a0 + ")");
  g.addColorStop(1, color + a1 + ")");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}
const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};
/**
 * The painted look on a filled shape: a soft light from the top left, the
 * shade rolling round the bottom right, a thin rim of light.
 */
function paintedShade(ctx, path, o) {
  const { cx, cy, r } = o;
  ctx.save();
  ctx.clip(path);
  const hl = ctx.createRadialGradient(
    cx - r * 0.38,
    cy - r * 0.45,
    r * 0.05,
    cx - r * 0.2,
    cy - r * 0.25,
    r * 1.05,
  );
  hl.addColorStop(0, `rgba(255,255,255,${o.light ?? 0.34})`);
  hl.addColorStop(0.55, "rgba(255,255,255,0.06)");
  hl.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hl;
  ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
  const lo = ctx.createLinearGradient(0, cy - r * 0.1, 0, cy + r);
  lo.addColorStop(0, "rgba(40,24,100,0)");
  lo.addColorStop(1, `rgba(40,24,100,${o.under ?? 0.22})`);
  ctx.fillStyle = lo;
  ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
  ctx.restore();
  innerGlow(
    ctx,
    path,
    o.shade ?? "rgba(44,26,110,0.5)",
    r * 0.32,
    -r * 0.12,
    -r * 0.14,
  );
  innerGlow(ctx, path, o.rim ?? "rgba(255,250,255,0.55)", 3, 2, 2.4);
}
/** A five-point star with rounded (curved) sides. */
function puffyStar(ctx, x, y, r, rot = -Math.PI / 2, pts = 5, inner = 0.5) {
  ctx.beginPath();
  for (let i = 0; i <= pts * 2; i++) {
    const a = rot + (i * Math.PI) / pts,
      rr = i % 2 ? r * inner : r;
    const px = x + Math.cos(a) * rr,
      py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else {
      const am = rot + ((i - 0.5) * Math.PI) / pts,
        rm = r * (inner * 0.9 + 0.12);
      ctx.quadraticCurveTo(
        x + Math.cos(am) * rm,
        y + Math.sin(am) * rm,
        px,
        py,
      );
    }
  }
  ctx.closePath();
}
/** A four-point sparkle (curved sides). */
function sparkle(ctx, x, y, r, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = rot + (i * Math.PI) / 2,
      b = a + Math.PI / 2;
    const px = x + Math.cos(a) * r,
      py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    ctx.quadraticCurveTo(
      x + Math.cos(a + Math.PI / 4) * r * 0.16,
      y + Math.sin(a + Math.PI / 4) * r * 0.16,
      x + Math.cos(b) * r,
      y + Math.sin(b) * r,
    );
  }
  ctx.closePath();
}
/** Points along a Catmull-Rom curve through `pts` (with radius r), n samples. */
function spline(pts, n) {
  const out = [];
  const P = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let k = 0; k <= n; k++) {
    const t = (k / n) * (pts.length - 1),
      i = Math.min(pts.length - 2, Math.floor(t)),
      u = t - i;
    const p0 = P(i - 1),
      p1 = P(i),
      p2 = P(i + 1),
      p3 = P(i + 2);
    const f = (a, b, c2, d) =>
      0.5 *
      (2 * b +
        (-a + c2) * u +
        (2 * a - 5 * b + 4 * c2 - d) * u * u +
        (-a + 3 * b - 3 * c2 + d) * u * u * u);
    out.push({
      x: f(p0.x, p1.x, p2.x, p3.x),
      y: f(p0.y, p1.y, p2.y, p3.y),
      z: f(p0.z, p1.z, p2.z, p3.z),
      r: lerp(p1.r, p2.r, u),
    });
  }
  return out;
}
/** Projected discs of a tube, a path of their union, and their screen bounds. */
function tubeDiscs(V, pts) {
  return pts.map((p) => ({ ...V.P(p), r: p.r }));
}
function unionPath(discs) {
  const path = new Path2D();
  for (const d of discs) {
    path.moveTo(d.x + d.r, d.y);
    path.arc(d.x, d.y, d.r, 0, TAU);
  }
  return path;
}
/** An oriented disc (centre p, normal n, radius r) as a screen polygon, smooth. */
function discPoly(V, p, n, r, steps = 40) {
  const a = Math.abs(n.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const u = norm3(
    a.y * n.z - a.z * n.y,
    a.z * n.x - a.x * n.z,
    a.x * n.y - a.y * n.x,
  );
  const w = {
    x: n.y * u.z - n.z * u.y,
    y: n.z * u.x - n.x * u.z,
    z: n.x * u.y - n.y * u.x,
  };
  const out = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * TAU,
      cs = Math.cos(t) * r,
      sn = Math.sin(t) * r;
    out.push(
      V.P({
        x: p.x + u.x * cs + w.x * sn,
        y: p.y + u.y * cs + w.y * sn,
        z: p.z + u.z * cs + w.z * sn,
      }),
    );
  }
  return out;
}
function polyPath(pts) {
  // a smooth closed curve through the points (midpoint quadratics)
  const path = new Path2D(),
    n = pts.length;
  const m = (i) => {
    const a = pts[i % n],
      b = pts[(i + 1) % n];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  const s = m(n - 1);
  path.moveTo(s.x, s.y);
  for (let i = 0; i < n; i++) {
    const e = m(i);
    path.quadraticCurveTo(pts[i].x, pts[i].y, e.x, e.y);
  }
  path.closePath();
  return path;
}

// ── the build (used only while painting) ──
/** Body: an ellipsoid. */
const BODY_C = { x: 0, y: 58, z: -12 },
  BRX = 72,
  BRY = 50,
  BRZ = 86;
/** The cream saddle band runs round the body between these body-local z. */
const BAND = [-50, 0];
/** Head: a sphere, high on the front of the body (a big chibi head). */
const HEAD_C = { x: 0, y: 122, z: 60 },
  HR = 58;
/** Hips (body-local) and the leg length to the floor. */
const HIPS = {
  FL: { x: 42, y: 34, z: 38 },
  FR: { x: -42, y: 34, z: 38 },
  BL: { x: 42, y: 34, z: -60 },
  BR: { x: -42, y: 34, z: -60 },
};
const LEG_L = 34,
  LEG_R = 16;
/** The weak point: a star-heart on the chest, under the head. */
const HEART = { x: 0, y: 40, z: 76 };
/** The little tail tuft (body-local). */
const TAIL = { x: 0, y: 74, z: -96 };
/** The head is anchored at this screen height in every view, so the eye line is level. */
const HEAD_Y = yS(HEAD_C.y);

/** Projected ellipse of an ellipsoid (centre c, radii a b cz) in view V: centre, axes and angle. */
function ellipsoidOutline(V, c, a, b, cz) {
  const M = [
    [V.c, 0, V.s],
    [-V.s * SP, -CP, V.c * SP],
  ];
  const D = [a * a, b * b, cz * cz];
  const S = [
    [0, 0],
    [0, 0],
  ];
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++)
      for (let k = 0; k < 3; k++) S[i][j] += M[i][k] * D[k] * M[j][k];
  const tr = S[0][0] + S[1][1],
    det = S[0][0] * S[1][1] - S[0][1] * S[0][1];
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l1 = tr / 2 + disc,
    l2 = tr / 2 - disc;
  const ang = Math.atan2(l1 - S[0][0], S[0][1] || 1e-9);
  const ctr = V.P(c);
  return {
    x: ctr.x,
    y: ctr.y,
    rx: Math.sqrt(l1),
    ry: Math.sqrt(Math.max(1, l2)),
    rot:
      Math.abs(S[0][1]) < 1e-6 ? (S[0][0] >= S[1][1] ? 0 : Math.PI / 2) : ang,
  };
}
function ellipsePath(e) {
  const p = new Path2D();
  p.ellipse(e.x, e.y, e.rx, e.ry, e.rot, 0, TAU);
  return p;
}

// ── body ──
/** The body with its saddle band and tail; `low` sinks it (asleep, the legs folded). */
function paintBody(ctx, k) {
  const V = makeView(VIEWS[k.v]);
  const e = ellipsoidOutline(V, BODY_C, BRX, BRY, BRZ);
  const path = ellipsePath(e);
  // the tail behind, in front views
  const tail = V.P(TAIL);
  const tailFirst = tail.z < V.P(BODY_C).z;
  if (tailFirst) paintTail(ctx, V);
  ctx.fillStyle = C.body[1];
  ctx.fill(path);
  // the saddle band: surface patches between the two planes, facing the camera
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = C.band[1];
  ctx.strokeStyle = C.band[1];
  ctx.lineWidth = 1.2;
  const NT = 96,
    NZ = 6;
  const pt = (th, z) => {
    const r = Math.sqrt(Math.max(0, 1 - (z / BRZ) ** 2));
    return {
      x: BODY_C.x + BRX * r * Math.cos(th),
      y: BODY_C.y + BRY * r * Math.sin(th),
      z: BODY_C.z + z,
    };
  };
  for (let i = 0; i < NT; i++)
    for (let j = 0; j < NZ; j++) {
      const t0 = (i / NT) * TAU,
        t1 = ((i + 1) / NT) * TAU;
      const tm = (t0 + t1) / 2;
      const b0 = BAND[0] - 5 * Math.sin(tm) + 3 * Math.sin(tm * 3),
        b1 = BAND[1] + 6 * Math.sin(tm) + 2.5 * Math.sin(tm * 3 + 1);
      const z0 = lerp(b0, b1, j / NZ),
        z1 = lerp(b0, b1, (j + 1) / NZ);
      const q = [pt(t0, z0), pt(t1, z0), pt(t1, z1), pt(t0, z1)];
      const m = pt((t0 + t1) / 2, (z0 + z1) / 2);
      const n = norm3(
        (m.x - BODY_C.x) / (BRX * BRX),
        (m.y - BODY_C.y) / (BRY * BRY),
        (m.z - BODY_C.z) / (BRZ * BRZ),
      );
      if (V.facing(n) < -0.08) continue;
      const s = q.map(V.P);
      ctx.beginPath();
      ctx.moveTo(s[0].x, s[0].y);
      for (let w = 1; w < 4; w++) ctx.lineTo(s[w].x, s[w].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  // a soft lavender shadow along the band's edges, so it reads as painted cloth-soft fur
  ctx.restore();
  const r = Math.max(e.rx, e.ry);
  paintedShade(ctx, path, { cx: e.x, cy: e.y, r, light: 0.3, under: 0.26 });
  if (!tailFirst) paintTail(ctx, V);
}
function paintTail(ctx, V) {
  const t = V.P(TAIL);
  const p = new Path2D();
  p.arc(t.x, t.y, 11, 0, TAU);
  ctx.fillStyle = C.body[2];
  ctx.fill(p);
  paintedShade(ctx, p, { cx: t.x, cy: t.y, r: 11, light: 0.3 });
}
const BODY_BOX = (v) => {
  const V = makeView(VIEWS[v]);
  const e = ellipsoidOutline(V, BODY_C, BRX, BRY, BRZ);
  const t = V.P(TAIL);
  const ex = Math.hypot(e.rx * Math.cos(e.rot), e.ry * Math.sin(e.rot)),
    ey = Math.hypot(e.rx * Math.sin(e.rot), e.ry * Math.cos(e.rot));
  return [
    Math.min(e.x - ex, t.x - 12) - 3,
    Math.min(e.y - ey, t.y - 12) - 3,
    Math.max(e.x + ex, t.x + 12) + 3,
    Math.max(e.y + ey, t.y + 12) + 3,
  ];
};

/** Phases 2-3: star patterns on the body (one picture per view and phase). */
const BODY_STARS = (() => {
  const out = [];
  // a fixed golden-angle spread over the upper body, phase 2 first
  for (let i = 0; i < 22; i++) {
    const y = 0.95 - (i / 21) * 1.15,
      r = Math.sqrt(Math.max(0, 1 - y * y)),
      a = i * 2.39996 + 0.7;
    out.push({
      d: norm3(Math.cos(a) * r, y, Math.sin(a) * r),
      ph: i % 3 === 0 ? 2 : 3,
      s: 0.7 + ((i * 37) % 10) / 16,
      kind: i % 4 === 1 ? "dot" : i % 2 ? "sparkle" : "star",
    });
  }
  return out;
})();
function onBody(d, out = 0) {
  return {
    p: {
      x: BODY_C.x + d.x * (BRX + out),
      y: BODY_C.y + d.y * (BRY + out),
      z: BODY_C.z + d.z * (BRZ + out),
    },
    n: norm3(d.x / BRX, d.y / BRY, d.z / BRZ),
  };
}
function paintOverlay(ctx, k) {
  const V = makeView(VIEWS[k.v]);
  const e = ellipsoidOutline(V, BODY_C, BRX, BRY, BRZ);
  const path = ellipsePath(e);
  ctx.save();
  ctx.clip(path);
  const shown = [];
  for (const s of BODY_STARS) {
    if (s.ph > k.ph) continue;
    const b = onBody(s.d);
    const f = V.facing(b.n);
    if (f < 0.12) continue;
    // the band region keeps its cream: stars there are gold, elsewhere pale gold
    shown.push({ ...V.P(b.p), f, s });
  }
  if (k.ph >= 3) {
    // faint curved constellation threads between neighbours
    ctx.strokeStyle = "rgba(255,240,190,0.45)";
    ctx.lineWidth = 1.1;
    for (let i = 0; i + 1 < shown.length; i += 2) {
      const a = shown[i],
        b = shown[i + 1];
      if (Math.hypot(a.x - b.x, a.y - b.y) > 70) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(
        (a.x + b.x) / 2 + (b.y - a.y) * 0.15,
        (a.y + b.y) / 2 - (b.x - a.x) * 0.15,
        b.x,
        b.y,
      );
      ctx.stroke();
    }
  }
  for (const p of shown) {
    const r = (k.ph >= 3 ? 6.5 : 5.5) * p.s.s * (0.55 + 0.45 * p.f);
    if (k.ph >= 3) spot(ctx, p.x, p.y, r * 2.4, "rgba(255,230,150,", 0.45);
    ctx.fillStyle = k.ph >= 3 ? C.goldHot : C.gold;
    if (p.s.kind === "dot") {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 0.35, 0, TAU);
      ctx.fill();
    } else if (p.s.kind === "sparkle") {
      sparkle(ctx, p.x, p.y, r, 0.2);
      ctx.fill();
    } else {
      puffyStar(ctx, p.x, p.y, r * 0.9);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ── legs ──
/** One stubby leg (hip at 0,0, the sole at y = LEG_L). far: in shade. */
function paintLeg(ctx, k) {
  const v = k.v;
  const w = LEG_R;
  const p = new Path2D();
  p.moveTo(-w, 0);
  p.lineTo(-w, LEG_L - w * 0.7);
  p.bezierCurveTo(-w, LEG_L + 2, w, LEG_L + 2, w, LEG_L - w * 0.7);
  p.lineTo(w, 0);
  p.arc(0, 0, w, 0, Math.PI, true);
  p.closePath();
  ctx.fillStyle = k.far ? C.leg[2] : C.leg[1];
  ctx.fill(p);
  paintedShade(ctx, p, {
    cx: 0,
    cy: LEG_L * 0.4,
    r: LEG_L * 0.7,
    light: k.far ? 0.12 : 0.26,
  });
  // three cream toes, where the front of the foot shows
  const front = v <= 2;
  if (front) {
    ctx.fillStyle = k.far ? "#d9ccb6" : C.toe;
    const sx = v === 2 ? 0.5 : 1,
      ox = v === 2 ? 6 : v === 1 ? 2 : 0;
    for (const t of [-1, 0, 1]) {
      ctx.beginPath();
      ctx.ellipse(ox + t * 6.5 * sx, LEG_L - 3, 3.4 * sx, 2.6, 0, 0, TAU);
      ctx.fill();
    }
  }
}
/** All four legs standing, in one image (still, it draws one picture for its legs). */
function paintLegs4(ctx, k) {
  const V = makeView(VIEWS[k.v]);
  const order = Object.entries(HIPS)
    .map(([key, h]) => ({ key, h, q: V.P(h) }))
    .sort((a, b) => a.q.z - b.q.z);
  const bz = V.P(BODY_C).z;
  for (const o of order) {
    ctx.save();
    ctx.translate(o.q.x, o.q.y);
    paintLeg(ctx, { v: k.v, far: o.q.z < bz - 5 ? 1 : 0 });
    ctx.restore();
  }
}
const LEGS_BOX = (v) => {
  const V = makeView(VIEWS[v]);
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1e9,
    y1 = -1e9;
  for (const h of Object.values(HIPS)) {
    const q = V.P(h);
    x0 = Math.min(x0, q.x - LEG_R - 2);
    x1 = Math.max(x1, q.x + LEG_R + 2);
    y0 = Math.min(y0, q.y - LEG_R - 2);
    y1 = Math.max(y1, q.y + LEG_L + 4);
  }
  return [x0, y0, x1, y1];
};
/** Asleep and curled: the front paws tucked forward under the chin. */
function paintPaws(ctx, k) {
  const V = makeView(VIEWS[k.v]);
  const ps = [
    { x: 40, y: 8, z: 74 },
    { x: -40, y: 8, z: 74 },
  ]
    .map((p) => V.P(p))
    .sort((a, b) => a.z - b.z);
  for (const q of ps) {
    const p = new Path2D();
    p.ellipse(q.x, q.y, 17, 11, 0, 0, TAU);
    ctx.fillStyle = C.leg[1];
    ctx.fill(p);
    paintedShade(ctx, p, { cx: q.x, cy: q.y, r: 17, light: 0.3 });
    if (k.v <= 2) {
      ctx.fillStyle = C.toe;
      for (const t of [-1, 0, 1]) {
        ctx.beginPath();
        ctx.ellipse(q.x + t * 6, q.y + 6, 3, 2.3, 0, 0, TAU);
        ctx.fill();
      }
    }
  }
}
const PAWS_BOX = (v) => {
  const V = makeView(VIEWS[v]);
  const a = V.P({ x: 40, y: 8, z: 74 }),
    b = V.P({ x: -40, y: 8, z: 74 });
  return [
    Math.min(a.x, b.x) - 20,
    Math.min(a.y, b.y) - 14,
    Math.max(a.x, b.x) + 20,
    Math.max(a.y, b.y) + 14,
  ];
};

// ── the head: a sphere with ears and a soft muzzle (head-local, at the face's yaw) ──
const EAR_AZ = 96 * DEG,
  EAR_EL = 14 * DEG,
  EAR_R = 15;
function earAt(sx) {
  const d = norm3(
    sx * Math.sin(EAR_AZ) * Math.cos(EAR_EL),
    Math.sin(EAR_EL) + 0.12,
    Math.cos(EAR_AZ) * Math.cos(EAR_EL) - 0.2,
  );
  return {
    p: { x: d.x * (HR + 2), y: d.y * (HR + 2), z: d.z * (HR + 2) },
    n: norm3(d.x * 0.8, 0.35, d.z * 0.8 + 0.45),
  };
}
function paintEar(ctx, V, sx) {
  const E = earAt(sx);
  const f = V.facing(E.n);
  const outer = discPoly(V, E.p, E.n, EAR_R);
  const op = polyPath(outer);
  ctx.fillStyle = f > 0 ? C.earRim : C.body[2];
  ctx.fill(op);
  if (f > 0.05) {
    const inner = discPoly(
      V,
      { x: E.p.x + E.n.x, y: E.p.y + E.n.y, z: E.p.z + E.n.z },
      E.n,
      EAR_R * 0.66,
    );
    const ip = polyPath(inner);
    ctx.fillStyle = C.body[2];
    ctx.fill(ip);
    ctx.save();
    ctx.clip(ip);
    const c = V.P(E.p);
    spot(ctx, c.x, c.y + 2, EAR_R * 0.6, C.blush, 0.75, 0.15);
    ctx.restore();
  }
  const c = V.P(E.p);
  paintedShade(ctx, op, { cx: c.x, cy: c.y, r: EAR_R, light: 0.25 });
}
/** The trunk's root on the face: below the eye line, on the centre line. */
const TRUNK_EL = -10 * DEG;
const headView = (yaw) => makeView(yaw);
function headPath() {
  const p = new Path2D();
  p.arc(0, 0, HR, 0, TAU);
  return p;
}
function paintHead(ctx, k) {
  const v = k.v,
    V = headView(FACE_YAW[v]);
  const ears = [1, -1]
    .map((sx) => ({ sx, z: V.P(earAt(sx).p).z, f: V.facing(earAt(sx).n) }))
    .sort((a, b) => a.z - b.z);
  // ears whose base is behind the head's middle go behind it
  for (const e of ears) if (e.z < -4) paintEar(ctx, V, e.sx);
  const path = headPath();
  ctx.fillStyle = C.body[1];
  ctx.fill(path);
  if (v <= 3) {
    // the muzzle: a soft lighter patch round the trunk's root
    const m = V.P({
      x: 0,
      y: Math.sin(TRUNK_EL - 0.2) * HR,
      z: Math.cos(TRUNK_EL - 0.2) * HR,
    });
    ctx.save();
    ctx.clip(path);
    spot(ctx, m.x, m.y, HR * 0.62, "rgba(200,190,255,", 0.75, 0);
    ctx.restore();
  }
  paintedShade(ctx, path, { cx: 0, cy: 0, r: HR, light: 0.36, under: 0.2 });
  if (v <= 2) {
    // blush, under the outer corner of each eye
    for (const sx of [1, -1]) {
      const d = {
        x: sx * Math.sin(42 * DEG) * Math.cos(-18 * DEG),
        y: Math.sin(-18 * DEG),
        z: Math.cos(42 * DEG) * Math.cos(-18 * DEG),
      };
      if (V.facing(d) < 0.25) continue;
      const q = V.P({ x: d.x * HR, y: d.y * HR, z: d.z * HR });
      ctx.save();
      ctx.clip(path);
      ctx.translate(q.x, q.y);
      ctx.scale(1, 0.62);
      spot(ctx, 0, 0, 13, C.blush, 0.55, 0);
      ctx.restore();
    }
  }
  for (const e of ears) if (e.z >= -4) paintEar(ctx, V, e.sx);
}
const HEAD_BOX = [-HR - 26, -HR - 18, HR + 26, HR + 6];

// ── the face construction: one centre line, one eye line, per-view eye drawings ──
const EYE_AZ = 31 * DEG,
  EYE_EL = 11 * DEG,
  EYE_ORBIT = 0.8 * HR;
/** The eye line (head-local screen y): where the eyes sit from the front, used by every view. */
const EYE_LINE =
  -EYE_ORBIT * Math.sin(EYE_EL) * CP + HR * Math.cos(EYE_EL) * SP * 0.8;
/** The mouth hangs under the trunk, on the centre line, near the chin. */
const MOUTH_EL = -32 * DEG;
const MOUTH_LINE = -HR * Math.sin(MOUTH_EL) * CP + HR * Math.cos(MOUTH_EL) * SP;
const EYE_SIZE = {
  front: { hw: 11, hh: 12 },
  near: { hw: 10.5, hh: 12 },
  far: { hw: 7, hh: 11.5 },
  side: { hw: 8.6, hh: 12 },
};
const EXPRS = ["idle", "glare", "wide", "hurt", "dizzy", "closed"];
const MOUTHS = ["smile", "o", "open", "grit", "flat", "sleep"];
const TRUNKS = ["rest", "up", "slam"];
/** The face's centre line at a height (head-local y) seen at a face yaw: screen x. */
function centreX(yaw, el) {
  return HR * Math.cos(el) * Math.sin(yaw);
}
/**
 * Where the eyes go in a face view (0 front, 1 three-quarter, 2 profile):
 * screen centre, half-size, kind and which side its outer corner is on.
 * Positions come from the eye orbit at the face's yaw; the height is the eye
 * line in every view. At three-quarter the far eye is its own narrower
 * drawing hugging the trunk's root; in profile one eye, inside the outline.
 */
function eyeLayout(v) {
  const yaw = FACE_YAW[v],
    r = EYE_ORBIT * Math.cos(EYE_EL);
  if (v === 0)
    return [-1, 1].map((sx) => ({
      kind: "front",
      x: sx * r * Math.sin(EYE_AZ),
      y: EYE_LINE,
      ...EYE_SIZE.front,
      out: sx,
    }));
  if (v === 1) {
    const near = r * Math.sin(yaw - EYE_AZ),
      far = r * Math.sin(yaw + EYE_AZ);
    return [
      { kind: "far", x: far, y: EYE_LINE, ...EYE_SIZE.far, out: 1 },
      { kind: "near", x: near, y: EYE_LINE, ...EYE_SIZE.near, out: -1 },
    ];
  }
  return [
    {
      kind: "side",
      // the profile eye sits back from the trunk's root, inside the outline
      x: r * Math.sin(yaw - 54 * DEG),
      y: EYE_LINE,
      ...EYE_SIZE.side,
      out: -1,
    },
  ];
}
/** Brow line, above the eye line. */
const BROW_DY = -19;
/** The mouth's half-width per face view (wider than the trunk: its corners show either side). */
const MOUTH_HW = [13, 8.5, 6];
/**
 * The mouth's place in a face view: on the centre line at the mouth line,
 * kept inside the head's outline (in profile the centre line is the outline).
 */
function mouthLayout(v) {
  const yaw = FACE_YAW[v];
  const edge = Math.sqrt(HR * HR - MOUTH_LINE * MOUTH_LINE);
  const x = centreX(yaw, MOUTH_EL);
  return {
    x: Math.min(x, edge - MOUTH_HW[v] - (v === 2 ? 0.5 : 2.5)),
    y: MOUTH_LINE,
  };
}

// ── eyes ──
/**
 * The eye-white outline: an inner and an outer corner joined by two curves.
 * `o` = +1 when the outer corner is to screen right. Shapes per kind (never
 * a scaled copy): the far eye is narrower with its inner side tucked; the
 * profile eye is a rounded wedge, its front edge flatter.
 */
function eyeShape(e, open = 1) {
  const { hw, o } = { hw: e.hw, o: e.out };
  const hh = e.hh * open;
  const p = new Path2D();
  const ix = -o * hw,
    ox = o * hw;
  if (e.kind === "side") {
    // the front (toward the trunk) is at -o; a rounded wedge
    p.moveTo(ix, hh * 0.05);
    p.bezierCurveTo(
      ix + o * hw * 0.15,
      -hh * 1.0,
      ox,
      -hh * 1.15,
      ox,
      -hh * 0.1,
    );
    p.bezierCurveTo(
      ox + o * hw * 0.05,
      hh * 0.9,
      ix + o * hw * 0.25,
      hh * 1.0,
      ix,
      hh * 0.05,
    );
    p.closePath();
    return p;
  }
  const tuck = e.kind === "far" ? 0.75 : 1;
  p.moveTo(ix, hh * 0.12);
  p.bezierCurveTo(
    ix + o * hw * 0.08 * tuck,
    -hh * 1.12,
    ox - o * hw * 0.05,
    -hh * 1.22,
    ox,
    -hh * 0.08,
  );
  p.bezierCurveTo(
    ox - o * hw * 0.02,
    hh * 1.05,
    ix + o * hw * 0.12 * tuck,
    hh * 1.1,
    ix,
    hh * 0.12,
  );
  p.closePath();
  return p;
}
/** Lids per expression: the upper lid's height at the inner and outer corner (× hh, + = down), the lower lid's (× hh, from the bottom up). */
const LIDS = {
  idle: { up: [-0.02, -0.12], sag: 0.22, low: 0.16 },
  glare: { up: [0.1, -0.38], sag: 0.12, low: 0.42 },
  wide: { up: [-1.4, -1.4], sag: 0, low: 0 },
};
function drawIris(ctx, e, look, big) {
  const o = e.out;
  const ri = e.hh * (big ? 0.86 : 0.8) * (e.kind === "far" ? 0.92 : 1);
  // gaze: toward the turn for turned views; a little up when wide
  const gx =
    e.kind === "front"
      ? o * e.hw * 0.04
      : e.kind === "side"
        ? -o * e.hw * 0.22
        : e.kind === "near"
          ? e.hw * 0.18
          : e.hw * 0.28;
  const gy = big ? 0 : e.hh * 0.16;
  const cx = gx,
    cy = gy;
  const g = ctx.createLinearGradient(0, cy - ri, 0, cy + ri);
  g.addColorStop(0, C.irisTop);
  g.addColorStop(0.55, "#5a46c4");
  g.addColorStop(1, C.irisBot);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, ri, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(20,12,60,0.85)";
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.fillStyle = C.pupil;
  ctx.beginPath();
  ctx.arc(cx, cy + ri * 0.06, ri * (big ? 0.38 : 0.46), 0, TAU);
  ctx.fill();
  // a little gold star low in the iris (the dream glint)
  ctx.fillStyle = "rgba(255,222,140,0.95)";
  sparkle(ctx, cx - o * ri * 0.3, cy + ri * 0.48, ri * 0.32, 0.2);
  ctx.fill();
  // highlights: a big one up and out, a small one low and in
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(cx + ri * 0.36, cy - ri * 0.36, ri * 0.3, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - ri * 0.3, cy + ri * 0.2, ri * 0.12, 0, TAU);
  ctx.fill();
}
/** The upper lid's curve from the inner corner to the outer (inside the eye's box). */
function lidCurve(e, L) {
  const o = e.out,
    hw = e.hw,
    hh = e.hh;
  const ix = -o * hw * 1.15,
    ox = o * hw * 1.15;
  const yi = L.up[0] * hh,
    yo = L.up[1] * hh;
  return {
    ix,
    yi,
    ox,
    yo,
    c1: { x: ix + o * hw * 0.7, y: yi + L.sag * hh },
    c2: { x: ox - o * hw * 0.6, y: yo + L.sag * hh },
  };
}
function drawOpenEye(ctx, e, expr) {
  const L = LIDS[expr],
    big = expr === "wide";
  const shape = eyeShape(e, big ? 1.1 : 1);
  ctx.save();
  // the white, softly shaded under the upper lid
  ctx.fillStyle = "#fffdfb";
  ctx.fill(shape);
  ctx.clip(shape);
  drawIris(ctx, e, expr, big);
  const sh = ctx.createLinearGradient(0, -e.hh * 1.2, 0, e.hh * 0.2);
  sh.addColorStop(0, "rgba(70,50,150,0.35)");
  sh.addColorStop(1, "rgba(70,50,150,0)");
  ctx.fillStyle = sh;
  ctx.fillRect(-e.hw * 2, -e.hh * 2, e.hw * 4, e.hh * 4);
  const lid = lidCurve(e, L);
  if (!big) {
    // the drowsy upper lid: skin over the top of the eye, with a soft shadow under it
    const lp = new Path2D();
    lp.moveTo(lid.ix, lid.yi);
    lp.bezierCurveTo(lid.c1.x, lid.c1.y, lid.c2.x, lid.c2.y, lid.ox, lid.yo);
    lp.lineTo(lid.ox, -e.hh * 3);
    lp.lineTo(lid.ix, -e.hh * 3);
    lp.closePath();
    ctx.save();
    ctx.shadowColor = "rgba(60,36,140,0.55)";
    ctx.shadowBlur = 3 * PQ;
    ctx.shadowOffsetY = 1.5 * PQ;
    ctx.fillStyle = "#9b90e6";
    ctx.fill(lp);
    ctx.restore();
    // the lower lid, a smug little lift
    if (L.low > 0) {
      const o = e.out,
        hw = e.hw,
        hh = e.hh;
      const yb = hh * (1.1 - L.low * 1.2);
      const bp = new Path2D();
      bp.moveTo(-o * hw * 1.2, hh * 0.9);
      bp.bezierCurveTo(
        -o * hw * 0.4,
        yb,
        o * hw * 0.4,
        yb,
        o * hw * 1.2,
        hh * 0.7,
      );
      bp.lineTo(o * hw * 1.2, hh * 3);
      bp.lineTo(-o * hw * 1.2, hh * 3);
      bp.closePath();
      ctx.fillStyle = "#a59bec";
      ctx.fill(bp);
    }
  }
  ctx.restore();
  // lash lines: the upper lid (or the top of the open eye), thick, with a flick out
  ctx.strokeStyle = C.lash;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const o = e.out,
    hw = e.hw,
    hh = e.hh;
  if (big) {
    ctx.lineWidth = 2.6;
    ctx.save();
    ctx.clip(rectAbove(e, 0.0));
    ctx.stroke(eyeShape(e, 1.1));
    ctx.restore();
  } else {
    // only the part of the lid curve over the eye
    ctx.save();
    ctx.clip(eyeShapeGrow(e, 1.6));
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(lid.ix, lid.yi);
    ctx.bezierCurveTo(lid.c1.x, lid.c1.y, lid.c2.x, lid.c2.y, lid.ox, lid.yo);
    ctx.stroke();
    ctx.restore();
  }
  // the flick at the outer corner
  const fy = big ? -hh * 0.3 : lidCurve(e, L).yo * 0.9;
  const fx = o * hw * (big ? 0.98 : 1.02);
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.quadraticCurveTo(fx + o * 3.5, fy - 0.5, fx + o * 5.5, fy - 3.5);
  ctx.stroke();
  // a soft lower line
  ctx.strokeStyle = "rgba(40,24,90,0.45)";
  ctx.lineWidth = 1.1;
  ctx.save();
  ctx.clip(rectBelow(e, 0.35));
  ctx.stroke(eyeShape(e, big ? 1.1 : 1));
  ctx.restore();
}
function rectAbove(e, f) {
  const p = new Path2D();
  p.rect(-e.hw * 2, -e.hh * 3, e.hw * 4, e.hh * (3 + f));
  return p;
}
function rectBelow(e, f) {
  const p = new Path2D();
  p.rect(-e.hw * 2, e.hh * f, e.hw * 4, e.hh * 3);
  return p;
}
function eyeShapeGrow(e, k) {
  const p = new Path2D();
  p.ellipse(0, 0, e.hw * 1.04, e.hh * k, 0, 0, TAU);
  return p;
}
/** Eyes shut asleep or blissful: a curve bowed down, lashes at the outer end. */
function drawClosedEye(ctx, e) {
  const o = e.out,
    hw = e.hw * (e.kind === "far" ? 1 : 0.95),
    hh = e.hh;
  ctx.strokeStyle = C.lash;
  ctx.lineCap = "round";
  ctx.lineWidth = 2.7;
  const y0 = hh * 0.12;
  ctx.beginPath();
  ctx.moveTo(-o * hw, y0);
  ctx.bezierCurveTo(
    -o * hw * 0.45,
    y0 + hh * 0.62,
    o * hw * 0.45,
    y0 + hh * 0.62,
    o * hw,
    y0 - hh * 0.05,
  );
  ctx.stroke();
  ctx.lineWidth = 1.8;
  for (const t of [0.75, 1]) {
    const x = o * hw * t,
      y = y0 + (t === 1 ? -hh * 0.05 : hh * 0.24);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + o * 2.2, y + 2.2, x + o * 3.8, y + 4.6);
    ctx.stroke();
  }
}
/** Squeezed shut (hurt): a curved chevron pointing to the face's middle. */
function drawHurtEye(ctx, e) {
  const o = e.out,
    hw = e.hw * 0.9,
    hh = e.hh * 0.62;
  ctx.strokeStyle = C.lash;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.8;
  const tip = { x: -o * hw * 0.75, y: hh * 0.1 };
  ctx.beginPath();
  ctx.moveTo(o * hw, -hh);
  ctx.quadraticCurveTo(o * hw * 0.1, -hh * 0.55, tip.x, tip.y);
  ctx.quadraticCurveTo(o * hw * 0.1, hh * 0.7, o * hw, hh * 1.05);
  ctx.stroke();
}
/** Dizzy: a spiral (a circle growing in steps of its own radius: never squeezed). */
function drawDizzyEye(ctx, e) {
  const r = Math.min(e.hw, e.hh) * 0.95;
  ctx.strokeStyle = C.lash;
  ctx.lineCap = "round";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let i = 0; i <= 60; i++) {
    const t = i / 60,
      a = t * TAU * 2.25 * (e.out || 1),
      rr = r * (0.12 + 0.88 * t);
    const x = Math.cos(a) * rr,
      y = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}
/** A brow: a short soft curved leaf above the eye, set per expression. */
function drawBrow(ctx, e, expr) {
  const o = e.out,
    w = e.hw * (e.kind === "far" ? 0.95 : 0.9);
  const tilt =
    expr === "glare"
      ? 0.32
      : expr === "hurt"
        ? -0.3
        : expr === "wide"
          ? -0.08
          : expr === "dizzy"
            ? -0.2
            : 0.12;
  const lift =
    expr === "wide" ? -6 : expr === "glare" ? 3 : expr === "hurt" ? 1 : 0;
  ctx.save();
  ctx.translate(e.kind === "side" ? -o * 1 : o * 1, BROW_DY + lift);
  ctx.rotate(-o * tilt);
  const p = new Path2D();
  p.moveTo(-o * w, 1.2);
  p.quadraticCurveTo(0, -3.4, o * w, 0.6);
  p.quadraticCurveTo(0, -0.6, -o * w, 1.2);
  p.closePath();
  ctx.fillStyle = C.lash;
  ctx.globalAlpha = 0.85;
  ctx.fill(p);
  ctx.strokeStyle = C.lash;
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.stroke(p);
  ctx.restore();
}
function paintEyes(ctx, k) {
  for (const e of eyeLayout(k.v)) {
    ctx.save();
    ctx.translate(e.x, e.y);
    drawBrow(ctx, e, k.expr);
    if (k.expr === "closed") drawClosedEye(ctx, e);
    else if (k.expr === "hurt") drawHurtEye(ctx, e);
    else if (k.expr === "dizzy") drawDizzyEye(ctx, e);
    else drawOpenEye(ctx, e, k.expr);
    ctx.restore();
  }
}
const EYES_BOX = (v) => {
  const L = eyeLayout(v);
  let x0 = 1e9,
    x1 = -1e9;
  for (const e of L) {
    x0 = Math.min(x0, e.x - e.hw - 8);
    x1 = Math.max(x1, e.x + e.hw + 8);
  }
  return [x0, EYE_LINE + BROW_DY - 12, x1, EYE_LINE + 15];
};

// ── mouth ──
/** The mouth, under the trunk's root: drawn before the trunk, so its middle hides behind it. */
function paintMouth(ctx, k) {
  const v = k.v,
    m = k.m,
    L = mouthLayout(v);
  ctx.save();
  ctx.translate(L.x, L.y);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = C.mouth;
  ctx.lineWidth = 2.3;
  const side = v === 2,
    w = MOUTH_HW[v];
  if (m === "smile" || m === "sleep") {
    const s = m === "sleep" ? 0.8 : 1;
    ctx.beginPath();
    if (side) {
      ctx.moveTo(w * 0.9, -2);
      ctx.quadraticCurveTo(-w * 0.1, 4.2 * s, -w * s, -0.6);
    } else {
      // a smug little smile: a soft "w" under the trunk, one corner a touch higher
      ctx.moveTo(-w * s, -2.2);
      ctx.quadraticCurveTo(-w * 0.55 * s, 4.4 * s, 0, 1.2 * s);
      ctx.quadraticCurveTo(w * 0.55 * s, 4.6 * s, w * s, -3.2 * s);
    }
    ctx.stroke();
    // the cheek dimple at each end
    ctx.lineWidth = 1.6;
    for (const sx of side ? [-1] : [-1, 1]) {
      const x = sx * w * s,
        y = sx < 0 ? -2.2 : -3.2 * s;
      ctx.beginPath();
      ctx.moveTo(x - sx * 1.2, y - 1);
      ctx.quadraticCurveTo(x + sx * 2, y - 0.5, x + sx * 1.5, y - 3.5);
      ctx.stroke();
    }
  } else if (m === "o" || m === "open") {
    const big = m === "open";
    const rx = side ? (big ? 5.5 : 3.6) : big ? w * 0.72 : w * 0.42,
      ry = big ? 9 : 5;
    const p = new Path2D();
    p.ellipse(side ? -1 : 0, ry * 0.5, rx, ry, 0, 0, TAU);
    ctx.fillStyle = C.mouth;
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    ctx.fillStyle = C.tongue;
    ctx.beginPath();
    ctx.ellipse(side ? -1 : 0, ry * 1.35, rx * 0.8, ry * 0.62, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 1.7;
    ctx.stroke(p);
  } else if (m === "grit") {
    const hw = side ? w * 0.8 : w * 0.8;
    const p = new Path2D();
    p.moveTo(-hw, 0);
    p.quadraticCurveTo(0, -2.8, hw, 0);
    p.quadraticCurveTo(hw + 1, 4, hw * 0.6, 5.6);
    p.quadraticCurveTo(0, 7, -hw * 0.6, 5.6);
    p.quadraticCurveTo(-hw - 1, 4, -hw, 0);
    p.closePath();
    ctx.fillStyle = "#fffdf6";
    ctx.fill(p);
    ctx.lineWidth = 1.8;
    ctx.stroke(p);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.85, 2.8);
    for (let i = 1; i <= 4; i++)
      ctx.quadraticCurveTo(
        -hw * 0.85 + ((i - 0.5) * hw * 1.7) / 4,
        i % 2 ? 1.3 : 4.3,
        -hw * 0.85 + (i * hw * 1.7) / 4,
        2.8,
      );
    ctx.stroke();
  } else if (m === "flat") {
    const hw = w * 0.85;
    ctx.beginPath();
    ctx.moveTo(-hw, 1);
    ctx.bezierCurveTo(-hw * 0.5, -1.8, -hw * 0.2, 3.6, 0, 1);
    ctx.bezierCurveTo(hw * 0.2, -1.8, hw * 0.5, 3.6, hw, 1);
    ctx.stroke();
  }
  ctx.restore();
}
const MOUTH_BOX = (v) => {
  const L = mouthLayout(v);
  const w = MOUTH_HW[v] + 5;
  return [L.x - w, L.y - 9, L.x + w, L.y + 21];
};

// ── trunk: a soft tapered tube from the face (head-local, at the face's yaw) ──
const TRUNK_ROOT = {
  x: 0,
  y: Math.sin(TRUNK_EL) * HR * 0.86,
  z: Math.cos(TRUNK_EL) * HR * 0.86,
};
const TS = HR / 54;
const TRUNK_PTS = {
  // a short soft trunk hanging from the face, its tip curling a little forward
  rest: [
    { ...TRUNK_ROOT, r: 11.5 },
    { x: 0, y: -17 * TS, z: 55 * TS, r: 11 },
    { x: 0, y: -24 * TS, z: 57 * TS, r: 10.4 },
    { x: 0, y: -28 * TS, z: 60 * TS, r: 10.2 },
  ],
  // raised and curled forward (humming, blowing, trumpeting)
  up: [
    { ...TRUNK_ROOT, r: 11.5 },
    { x: 0, y: -13 * TS, z: 60 * TS, r: 10.8 },
    { x: 0, y: -7 * TS, z: 68 * TS, r: 10.2 },
    { x: 0, y: 1 * TS, z: 73 * TS, r: 11.2 },
  ],
  // stretched forward and down (the slam)
  slam: [
    { ...TRUNK_ROOT, r: 11.5 },
    { x: 0, y: -24 * TS, z: 62 * TS, r: 11 },
    { x: 0, y: -38 * TS, z: 72 * TS, r: 10.6 },
    { x: 0, y: -47 * TS, z: 86 * TS, r: 12.4 },
  ],
};
function trunkGeom(v, pose) {
  const V = headView(FACE_YAW[v]);
  const pts = spline(TRUNK_PTS[pose], 22);
  const discs = tubeDiscs(V, pts);
  const a = pts[pts.length - 2],
    b = pts[pts.length - 1];
  const dir = norm3(b.x - a.x, b.y - a.y, b.z - a.z);
  return { V, pts, discs, tip: b, dir };
}
function paintTrunk(ctx, k) {
  const { V, pts, discs, tip, dir } = trunkGeom(k.v, k.pose);
  const path = unionPath(discs);
  ctx.fillStyle = C.body[1];
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  // the tip blushes pink
  const t = V.P(tip);
  spot(ctx, t.x, t.y, 15, "rgba(240,180,220,", 0.75, 0);
  // light along the upper side, shade along the lower: strokes along the centre line, offset
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const line = (dx, dy, w, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    discs.forEach((d, i) =>
      i ? ctx.lineTo(d.x + dx, d.y + dy) : ctx.moveTo(d.x + dx, d.y + dy),
    );
    ctx.stroke();
  };
  ctx.save();
  ctx.filter = HAS_FILTER ? `blur(${2.5 * PQ}px)` : "none";
  line(4, 6, 10, "rgba(50,30,120,0.35)");
  line(-3, -4, 5, "rgba(255,255,255,0.35)");
  ctx.restore();
  // soft wrinkles across it: short curved arcs
  ctx.strokeStyle = "rgba(70,48,150,0.45)";
  ctx.lineWidth = 1.3;
  for (const f of [0.35, 0.55, 0.72]) {
    const i = Math.round(f * (discs.length - 1));
    const d = discs[i],
      n = discs[Math.min(discs.length - 1, i + 1)];
    const tx = n.x - d.x,
      ty = n.y - d.y,
      tl = Math.hypot(tx, ty) || 1;
    const px = -ty / tl,
      py = tx / tl;
    const r = d.r * 0.8;
    ctx.beginPath();
    ctx.moveTo(d.x + px * r, d.y + py * r);
    ctx.quadraticCurveTo(
      d.x + (tx / tl) * 3,
      d.y + (ty / tl) * 3,
      d.x - px * r,
      d.y - py * r,
    );
    ctx.stroke();
  }
  ctx.restore();
  // the snout's end: a pink pad with two nostrils, when it faces the camera
  const f = V.facing(dir);
  if (f > 0.15) {
    const pad = discPoly(V, tip, dir, tip.r * 0.78);
    const pp = polyPath(pad);
    ctx.fillStyle = C.tip;
    ctx.fill(pp);
    ctx.strokeStyle = "rgba(120,60,130,0.55)";
    ctx.lineWidth = 1.2;
    ctx.stroke(pp);
    // nostrils: two small round holes on the pad
    const up = norm3(0, 1, 0);
    for (const sx of [-1, 1]) {
      const side = norm3(dir.z * sx, 0, -dir.x * sx);
      const q = V.P({
        x: tip.x + side.x * tip.r * 0.32 + dir.x * 0.5,
        y: tip.y + side.y * tip.r * 0.32 + up.y * 1,
        z: tip.z + side.z * tip.r * 0.32 + dir.z * 0.5,
      });
      ctx.fillStyle = C.nostril;
      ctx.beginPath();
      ctx.ellipse(q.x, q.y, 1.9, 2.5 * Math.max(0.55, f), 0, 0, TAU);
      ctx.fill();
    }
  }
  const mid = discs[Math.floor(discs.length / 2)];
  innerGlow(ctx, path, "rgba(255,250,255,0.45)", 2.5, 1.5, 2);
  innerGlow(ctx, path, "rgba(44,26,110,0.35)", 6, -2, -3);
  void mid;
  void pts;
}
const TRUNK_BOX = (v, pose) => {
  const { discs } = trunkGeom(v, pose);
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1e9,
    y1 = -1e9;
  for (const d of discs) {
    x0 = Math.min(x0, d.x - d.r);
    x1 = Math.max(x1, d.x + d.r);
    y0 = Math.min(y0, d.y - d.r);
    y1 = Math.max(y1, d.y + d.r);
  }
  return [x0 - 3, y0 - 3, x1 + 3, y1 + 3];
};

// ── the nightcap: a floppy starry cone with a fluffy brim and a pompom ──
const CAP_N = norm3(0, Math.cos(25 * DEG), -Math.sin(25 * DEG));
const CAP_T = norm3(0, Math.sin(25 * DEG), Math.cos(25 * DEG));
const BRIM_R = 39,
  BRIM_D = Math.sqrt(HR * HR - BRIM_R * BRIM_R) + 2;
const BRIM_C = {
  x: CAP_N.x * BRIM_D,
  y: CAP_N.y * BRIM_D,
  z: CAP_N.z * BRIM_D,
};
const CAP_PTS = [
  { ...BRIM_C, r: 34 },
  { x: 0, y: BRIM_C.y + 30, z: BRIM_C.z - 12, r: 27 },
  { x: -18, y: BRIM_C.y + 56, z: BRIM_C.z - 26, r: 19 },
  { x: -50, y: BRIM_C.y + 58, z: BRIM_C.z - 34, r: 12 },
  { x: -72, y: BRIM_C.y + 34, z: BRIM_C.z - 30, r: 7 },
  { x: -80, y: BRIM_C.y + 10, z: BRIM_C.z - 24, r: 5 },
];
const POMPOM_R = 12;
function capGeom(v) {
  const V = headView(FACE_YAW[v]);
  const pts = spline(CAP_PTS, 34);
  const discs = tubeDiscs(V, pts);
  const brim = [];
  const u = { x: 1, y: 0, z: 0 };
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU;
    const p = {
      x: BRIM_C.x + (u.x * Math.cos(a) + CAP_T.x * Math.sin(a)) * BRIM_R,
      y: BRIM_C.y + (u.y * Math.cos(a) + CAP_T.y * Math.sin(a)) * BRIM_R,
      z: BRIM_C.z + (u.z * Math.cos(a) + CAP_T.z * Math.sin(a)) * BRIM_R,
      r: 9.5 + (i % 2 ? 1.2 : -0.4),
    };
    brim.push({ ...V.P(p), r: p.r });
  }
  const tip = pts[pts.length - 1];
  return { V, pts, discs, brim, pom: { ...V.P(tip), r: POMPOM_R } };
}
/** Stars printed on the cap: (s along it, angle round it). */
const CAP_STARS = [
  [0.12, 0.6],
  [0.2, 2.6],
  [0.3, -0.9],
  [0.42, 1.4],
  [0.5, -2.4],
  [0.62, 0.2],
  [0.72, 2.2],
  [0.8, -1.2],
  [0.36, 3.6],
  [0.16, -2.2],
];
function paintCap(ctx, k) {
  const { V, pts, discs, brim, pom } = capGeom(k.v);
  // What lies behind the head (the back of the brim, a droop on the far
  // side) is drawn first, then cut away where the head is; the cap is its
  // own picture, so the cut only removes cap pixels. The crown, where the
  // cap sits on the head, always shows.
  const HIDE = -0.45 * HR;
  const cz = V.P(BRIM_C).z;
  // the brim hugs the head: the half behind its middle lies behind the head
  const backBrim = brim.filter((d) => d.z < cz),
    midBrim = [],
    frontBrim = brim.filter((d) => d.z >= cz);
  const hiddenCone = discs.filter((d) => d.z < HIDE);
  const pomBehind = pom.z < HIDE;
  const conePath = unionPath(discs);
  // the cone starts at the brim: clip it to the brim ring and the side of it the cap rises on
  const c0 = V.P(BRIM_C),
    c1 = V.P({
      x: BRIM_C.x + CAP_N.x * 10,
      y: BRIM_C.y + CAP_N.y * 10,
      z: BRIM_C.z + CAP_N.z * 10,
    });
  let nx = c1.x - c0.x,
    ny = c1.y - c0.y;
  const nl = Math.hypot(nx, ny) || 1;
  nx /= nl;
  ny /= nl;
  const ring = brim.map((d) => ({
    x: d.x,
    y: d.y,
    k: (d.x - c0.x) * nx + (d.y - c0.y) * ny,
  }));
  // the run of ring points on the far side of the axis, in order
  let start = ring.findIndex(
    (p, i) => p.k <= 0 && ring[(i + ring.length - 1) % ring.length].k > 0,
  );
  if (start < 0) start = 0;
  const arc = [];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[(start + i) % ring.length];
    if (p.k > 0 && arc.length) break;
    if (p.k <= 0) arc.push(p);
  }
  // (only the base is clipped: the floppy end may hang down past the brim)
  const coneClip = new Path2D();
  if (arc.length >= 2) {
    const a0 = arc[0],
      a1 = arc[arc.length - 1];
    let poly = [
      { x: a0.x + nx * 400, y: a0.y + ny * 400 },
      ...arc,
      { x: a1.x + nx * 400, y: a1.y + ny * 400 },
    ];
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i],
        q = poly[(i + 1) % poly.length];
      area += p.x * q.y - q.x * p.y;
    }
    // the same winding as the discs' arcs, so the union adds up
    if (area < 0) poly = poly.reverse();
    poly.forEach((p, i) =>
      i ? coneClip.lineTo(p.x, p.y) : coneClip.moveTo(p.x, p.y),
    );
    coneClip.closePath();
    coneClip.addPath(unionPath(discs.slice(Math.round(discs.length * 0.45))));
  } else coneClip.rect(-500, -500, 1000, 1000);
  const drawPart = (g, p) => {
    if (p.kind === "brim") {
      const d = p.d;
      const bp = new Path2D();
      bp.arc(d.x, d.y, d.r, 0, TAU);
      g.fillStyle = C.brim[1];
      g.fill(bp);
      const gr = g.createRadialGradient(
        d.x - d.r * 0.4,
        d.y - d.r * 0.5,
        0,
        d.x,
        d.y,
        d.r,
      );
      gr.addColorStop(0, "rgba(255,255,255,0.9)");
      gr.addColorStop(0.6, "rgba(255,255,255,0)");
      gr.addColorStop(1, "rgba(150,120,110,0.35)");
      g.fillStyle = gr;
      g.fill(bp);
    } else if (p.kind === "cone") {
      g.save();
      g.clip(coneClip);
      g.fillStyle = C.cap[1];
      g.fill(conePath);
      g.save();
      g.clip(conePath);
      // stars on the cloth, where they face the camera
      for (const [s, a] of CAP_STARS) {
        const i = Math.round(s * (pts.length - 1));
        const c = pts[i],
          n2 = pts[Math.min(pts.length - 1, i + 1)];
        const t = norm3(n2.x - c.x, n2.y - c.y, n2.z - c.z);
        const ref =
          Math.abs(t.x) < 0.8 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
        const u1 = norm3(
          t.y * ref.z - t.z * ref.y,
          t.z * ref.x - t.x * ref.z,
          t.x * ref.y - t.y * ref.x,
        );
        const w1 = {
          x: t.y * u1.z - t.z * u1.y,
          y: t.z * u1.x - t.x * u1.z,
          z: t.x * u1.y - t.y * u1.x,
        };
        const n = {
          x: u1.x * Math.cos(a) + w1.x * Math.sin(a),
          y: u1.y * Math.cos(a) + w1.y * Math.sin(a),
          z: u1.z * Math.cos(a) + w1.z * Math.sin(a),
        };
        const f = V.facing(n);
        if (f < 0.15) continue;
        const q = V.P({
          x: c.x + n.x * c.r,
          y: c.y + n.y * c.r,
          z: c.z + n.z * c.r,
        });
        g.fillStyle = C.gold;
        puffyStar(g, q.x, q.y, (3 + c.r * 0.12) * (0.6 + 0.4 * f), -1.4 + a);
        g.fill();
      }
      g.restore();
      const c0 = discs[Math.floor(discs.length * 0.3)];
      paintedShade(g, conePath, {
        cx: c0.x,
        cy: c0.y,
        r: 40,
        light: 0.28,
        shade: "rgba(14,8,50,0.6)",
        rim: "rgba(200,190,255,0.5)",
      });
      g.restore();
    } else {
      const d = p.d;
      const pp = new Path2D();
      // a fluffy pompom: a ring of small bumps round a ball
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU;
        const x = d.x + Math.cos(a) * d.r * 0.72,
          y = d.y + Math.sin(a) * d.r * 0.72;
        pp.moveTo(x + d.r * 0.42, y);
        pp.arc(x, y, d.r * 0.42, 0, TAU);
      }
      pp.moveTo(d.x + d.r * 0.8, d.y);
      pp.arc(d.x, d.y, d.r * 0.8, 0, TAU);
      g.fillStyle = C.brim[0];
      g.fill(pp);
      paintedShade(g, pp, {
        cx: d.x,
        cy: d.y,
        r: d.r,
        light: 0.5,
        shade: "rgba(140,110,90,0.45)",
      });
      g.fillStyle = C.gold;
      puffyStar(g, d.x, d.y, d.r * 0.45);
      g.fill();
    }
  };
  for (const d of backBrim) drawPart(ctx, { kind: "brim", d });
  for (const d of midBrim.sort((a, c) => a.z - c.z))
    drawPart(ctx, { kind: "brim", d });
  drawPart(ctx, { kind: "cone" });
  if (pomBehind) drawPart(ctx, { kind: "pom", d: pom });
  const cut = unionPath([
    ...backBrim,
    ...hiddenCone,
    ...(pomBehind ? [pom] : []),
  ]);
  ctx.save();
  const headDisc = new Path2D();
  headDisc.arc(0, 0, HR - 0.5, 0, TAU);
  ctx.clip(headDisc);
  ctx.globalCompositeOperation = "destination-out";
  ctx.fill(cut);
  ctx.restore();
  for (const d of frontBrim.sort((a, c) => a.z - c.z))
    drawPart(ctx, { kind: "brim", d });
  if (!pomBehind) drawPart(ctx, { kind: "pom", d: pom });
}
const CAP_BOX = (v) => {
  const { discs, brim, pom } = capGeom(v);
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1e9,
    y1 = -1e9;
  for (const d of [...discs, ...brim, pom]) {
    x0 = Math.min(x0, d.x - d.r);
    x1 = Math.max(x1, d.x + d.r);
    y0 = Math.min(y0, d.y - d.r);
    y1 = Math.max(y1, d.y + d.r);
  }
  return [x0 - 3, y0 - 3, x1 + 3, y1 + 3];
};
/** Where the cap hangs from (its brim's middle) and its pompom, head-local screen, per view. */
const CAPP = [0, 1, 2, 3, 4].map((v) => {
  const g = capGeom(v);
  return {
    pivot: { x: g.V.P(BRIM_C).x, y: g.V.P(BRIM_C).y },
    pom: { x: g.pom.x, y: g.pom.y },
  };
});

// ── small pieces ──
/** The star-heart: a heart-shaped gem with a star shining inside. */
function paintHeart(ctx) {
  const p = new Path2D();
  p.moveTo(0, 12);
  p.bezierCurveTo(-4, 8, -15, 2, -15, -5);
  p.bezierCurveTo(-15, -12, -6, -15, 0, -8);
  p.bezierCurveTo(6, -15, 15, -12, 15, -5);
  p.bezierCurveTo(15, 2, 4, 8, 0, 12);
  p.closePath();
  const g = ctx.createRadialGradient(-4, -6, 1, 0, 0, 16);
  g.addColorStop(0, "#fff6d8");
  g.addColorStop(0.45, "#ffb9dc");
  g.addColorStop(1, "#c46bd6");
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.strokeStyle = "rgba(90,30,110,0.9)";
  ctx.lineWidth = 1.6;
  ctx.stroke(p);
  ctx.fillStyle = "#fffbe8";
  puffyStar(ctx, 0, -1, 6.5);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.ellipse(-8, -7, 3, 2, -0.6, 0, TAU);
  ctx.fill();
}
/** A dream wisp: a little cloud puff of sleep, a star twinkling in it. */
function paintWisp(ctx, k) {
  const s = k.seed || 0;
  const puffs = s
    ? [
        [-9, 3, 9],
        [1, -3, 11],
        [11, 3, 8],
        [2, 6, 8],
      ]
    : [
        [-8, 2, 8],
        [2, -2, 10],
        [10, 4, 7],
        [-1, 6, 7],
      ];
  const p = new Path2D();
  for (const [x, y, r] of puffs) {
    p.moveTo(x + r, y);
    p.arc(x, y, r, 0, TAU);
  }
  ctx.save();
  ctx.shadowColor = "rgba(200,180,255,0.9)";
  ctx.shadowBlur = 8 * PQ;
  ctx.fillStyle = "rgba(236,228,255,0.9)";
  ctx.fill(p);
  ctx.restore();
  ctx.save();
  ctx.clip(p);
  const g = ctx.createLinearGradient(0, -12, 0, 14);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(1, "rgba(170,150,240,0.7)");
  ctx.fillStyle = g;
  ctx.fillRect(-24, -20, 48, 40);
  ctx.restore();
  ctx.fillStyle = s ? C.goldHot : C.gold;
  sparkle(ctx, 2, 1, 6.5, 0.15);
  ctx.fill();
}
/** A dream bubble: a soap film with a tiny star floating in it. */
function paintBubble(ctx) {
  const g = ctx.createRadialGradient(-5, -6, 1, 0, 0, 16);
  g.addColorStop(0, "rgba(255,255,255,0.55)");
  g.addColorStop(0.7, "rgba(200,185,255,0.25)");
  g.addColorStop(1, "rgba(170,140,255,0.55)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(240,230,255,0.9)";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = C.gold;
  puffyStar(ctx, 1, 2, 5);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.ellipse(-6, -7, 3.6, 2.2, -0.7, 0, TAU);
  ctx.fill();
}
function paintNote(ctx) {
  ctx.fillStyle = "#fff4cf";
  ctx.strokeStyle = "rgba(80,50,140,0.9)";
  ctx.lineWidth = 1.4;
  const p = new Path2D();
  p.ellipse(-3, 6, 5.5, 4, -0.4, 0, TAU);
  p.moveTo(1.6, 5);
  p.lineTo(2.2, -10);
  p.quadraticCurveTo(6, -8, 9, -4);
  p.quadraticCurveTo(6, -6, 3.6, -6.2);
  p.lineTo(3.4, 5.5);
  p.closePath();
  ctx.fill(p);
  ctx.stroke(p);
}
function paintZ(ctx) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(-6, -7);
    ctx.quadraticCurveTo(0, -8.5, 7, -7);
    ctx.quadraticCurveTo(0, -1, -7, 7);
    ctx.quadraticCurveTo(0, 5.5, 7, 7);
  };
  ctx.strokeStyle = "rgba(60,40,130,0.9)";
  ctx.lineWidth = 5.5;
  path();
  ctx.stroke();
  ctx.strokeStyle = "#f4eeff";
  ctx.lineWidth = 3;
  path();
  ctx.stroke();
}
function paintStar(ctx, k) {
  ctx.fillStyle = k.hot ? C.goldHot : C.gold;
  ctx.strokeStyle = "rgba(120,80,30,0.8)";
  ctx.lineWidth = 1.2;
  puffyStar(ctx, 0, 0, 9);
  ctx.fill();
  ctx.stroke();
}
function paintGlow(ctx, k) {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 32);
  for (const [o, c] of k.stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 32, 0, TAU);
  ctx.fill();
}

// ── the atlas ──
/**
 * Atlas px per rig px, by part. Fixed: it never follows the screen's pixel ratio.
 * The baku is drawn at 0.8 on the battle's camera: the face sits above one
 * device px per rig px at DPR 2, the body about at it, the glows below.
 */
const QUAL = {
  body: 1.05,
  legs: 1.1,
  over: 0.75,
  head: 1.7,
  cap: 1.35,
  trunk: 1.8,
  face: 2.3,
  mouth: 2.6,
  small: 1.6,
  fx: 0.8,
};
const ATLAS_BUDGET = 8 * 1024 * 1024;
const PAGE_W = 2048;
const PAD = 6;
/** Every piece: name, box (rig px), quality key, painter, options. */
function pieceSpecs() {
  const LINE = C.ink;
  const out = [];
  const add = (name, box, q, draw, opt = {}) =>
    out.push({ name, box, q: QUAL[q], draw, opt });
  for (let v = 0; v < 5; v++) {
    add(`body_${v}`, BODY_BOX(v), "body", paintBody, {
      k: { v },
      line: 2.2,
      lineColor: LINE,
    });
    for (const ph of [2, 3])
      add(`over_${v}_${ph}`, BODY_BOX(v), "over", paintOverlay, {
        k: { v, ph },
        outline: false,
        grain: false,
      });
    add(`legs4_${v}`, LEGS_BOX(v), "legs", paintLegs4, {
      k: { v },
      line: 1.8,
      lineColor: LINE,
    });
    for (const far of [0, 1])
      add(
        `leg_${v}_${far}`,
        [-LEG_R - 3, -LEG_R - 3, LEG_R + 3, LEG_L + 4],
        "legs",
        paintLeg,
        { k: { v, far }, line: 1.8, lineColor: LINE },
      );
    add(`paws_${v}`, PAWS_BOX(v), "legs", paintPaws, {
      k: { v },
      line: 1.8,
      lineColor: LINE,
    });
    add(`head_${v}`, HEAD_BOX, "head", paintHead, {
      k: { v },
      line: 2,
      lineColor: LINE,
    });
    add(`cap_${v}`, CAP_BOX(v), "cap", paintCap, {
      k: { v },
      line: 2,
      lineColor: LINE,
    });
    if (v <= 3)
      for (const pose of TRUNKS)
        add(`trunk_${v}_${pose}`, TRUNK_BOX(v, pose), "trunk", paintTrunk, {
          k: { v, pose },
          line: 1.8,
          lineColor: LINE,
        });
  }
  for (let v = 0; v < 3; v++) {
    for (const e of EXPRS)
      add(`eyes_${v}_${e}`, EYES_BOX(v), "face", paintEyes, {
        k: { v, expr: e },
        outline: false,
        grain: false,
      });
    for (const m of MOUTHS)
      add(`mouth_${v}_${m}`, MOUTH_BOX(v), "mouth", paintMouth, {
        k: { v, m },
        outline: false,
        grain: false,
      });
  }
  add("heart", [-17, -17, 17, 14], "small", paintHeart, { outline: false });
  for (const seed of [0, 1])
    add(`wisp_${seed}`, [-26, -22, 26, 22], "small", paintWisp, {
      k: { seed },
      outline: false,
      grain: false,
    });
  add("bubble", [-17, -17, 17, 17], "small", paintBubble, {
    outline: false,
    grain: false,
  });
  add("note", [-10, -12, 11, 11], "small", paintNote, {
    outline: false,
    grain: false,
  });
  add("zz", [-10, -11, 10, 11], "small", paintZ, {
    outline: false,
    grain: false,
  });
  for (const hot of [0, 1])
    add(`star_${hot}`, [-11, -11, 11, 11], "small", paintStar, {
      k: { hot },
      outline: false,
      grain: false,
    });
  const glow = (name, stops) =>
    add(name, [-33, -33, 33, 33], "fx", paintGlow, {
      k: { stops },
      outline: false,
      grain: false,
    });
  glow("glow_lilac", [
    [0, "rgba(236,222,255,1)"],
    [0.35, "rgba(170,140,255,0.55)"],
    [1, "rgba(120,90,230,0)"],
  ]);
  glow("glow_gold", [
    [0, "rgba(255,250,225,1)"],
    [0.3, "rgba(255,214,120,0.65)"],
    [1, "rgba(255,170,60,0)"],
  ]);
  glow("glow_rose", [
    [0, "rgba(255,240,250,1)"],
    [0.3, "rgba(255,150,210,0.6)"],
    [1, "rgba(220,90,200,0)"],
  ]);
  return out;
}
/** A piece's canvas size (px) for its box at quality q. */
function pieceCanvasSize(box, q) {
  return {
    w: Math.ceil((box[2] - box[0]) * q) + PAD * 2,
    h: Math.ceil((box[3] - box[1]) * q) + PAD * 2,
  };
}
/** Skyline-pack the pieces (tallest first) into one page: where each sits lowest (4 px columns). */
function pack(specs) {
  const list = specs
    .map((s) => ({ s, ...pieceCanvasSize(s.box, s.q) }))
    .sort((a, b) => b.h * 4096 + b.w - (a.h * 4096 + a.w));
  const CW = 4,
    NC = PAGE_W / CW,
    sky = new Int32Array(NC);
  let used = 0;
  for (const p of list) {
    const nc = Math.ceil((p.w + 1) / CW);
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
    p.x = bestX * CW;
    p.y = bestY;
    for (let k = bestX; k < bestX + nc; k++) sky[k] = bestY + p.h + 1;
    used = Math.max(used, bestY + p.h + 1);
  }
  return { list, height: used };
}
let GRAIN = null;
/** Paper grain: one small pattern, laid over every painted piece. */
function grainCanvas() {
  if (GRAIN) return GRAIN;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  let s = 1234567;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 420; i++) {
    const light = rnd() > 0.5;
    g.fillStyle = light ? "rgba(255,255,255,0.04)" : "rgba(30,10,60,0.035)";
    g.beginPath();
    g.arc(rnd() * 64, rnd() * 64, 0.6 + rnd() * 1.4, 0, TAU);
    g.fill();
  }
  GRAIN = c;
  return c;
}
/**
 * Paint every piece straight into its packed place in one page. Each piece
 * gets a soft darker outline (its own silhouette, blurred, behind it) and
 * paper grain. Nothing is read back.
 */
function buildAtlas(qScale = 1) {
  const specs = pieceSpecs().map((s) => ({ ...s, q: s.q * qScale }));
  const { list, height } = pack(specs);
  const page = document.createElement("canvas");
  page.width = PAGE_W;
  page.height = Math.max(1, height);
  const ctx = page.getContext("2d");
  const pieces = {};
  const tmp = document.createElement("canvas"),
    tmp2 = document.createElement("canvas");
  for (const p of list) {
    const { s } = p;
    tmp.width = p.w;
    tmp.height = p.h;
    const g = tmp.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, p.w, p.h);
    PQ = s.q;
    g.translate(PAD - s.box[0] * s.q, PAD - s.box[1] * s.q);
    g.scale(s.q, s.q);
    g.lineJoin = "round";
    s.draw(g, s.opt.k || {});
    let src = tmp;
    if (s.opt.outline !== false || s.opt.grain !== false) {
      tmp2.width = p.w;
      tmp2.height = p.h;
      const d = tmp2.getContext("2d");
      d.setTransform(1, 0, 0, 1, 0, 0);
      d.clearRect(0, 0, p.w, p.h);
      if (s.opt.outline !== false) {
        d.shadowColor = s.opt.lineColor || C.ink;
        d.shadowBlur = (s.opt.line || 1.6) * s.q;
        d.drawImage(tmp, 0, 0);
        d.shadowBlur = (s.opt.line || 1.6) * s.q * 0.45;
        d.drawImage(tmp, 0, 0);
        d.shadowColor = "transparent";
        d.shadowBlur = 0;
      }
      d.drawImage(tmp, 0, 0);
      if (s.opt.grain !== false) {
        d.globalCompositeOperation = "source-atop";
        d.fillStyle = d.createPattern(grainCanvas(), "repeat");
        d.fillRect(0, 0, p.w, p.h);
        d.globalCompositeOperation = "source-over";
      }
      src = tmp2;
    }
    ctx.drawImage(src, p.x, p.y);
    pieces[s.name] = {
      sx: p.x,
      sy: p.y,
      w: p.w,
      h: p.h,
      q: s.q,
      ox: PAD / s.q - s.box[0],
      oy: PAD / s.q - s.box[1],
    };
  }
  tmp.width = tmp.height = tmp2.width = tmp2.height = 1;
  return {
    pages: [page],
    pieces,
    stats: {
      pieces: list.length,
      bytes: page.width * page.height * 4,
      size: `${page.width}x${page.height}`,
    },
  };
}

// ── attach points for the rig (screen offsets per view, from the same build) ──
const ATT = VIEWS.map((yaw) => {
  const V = makeView(yaw),
    o = {};
  for (const k in HIPS) o[k] = V.P(HIPS[k]);
  o.head = { x: V.P(HEAD_C).x, y: HEAD_Y, z: V.P(HEAD_C).z };
  o.heart = V.P(HEART);
  o.body = V.P(BODY_C);
  o.top = V.P({ x: 0, y: BODY_C.y + BRY, z: BODY_C.z });
  o.tail = V.P(TAIL);
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
/** How much a pitch (nose up/down) shows as a screen turn in each view. */
const PITCH_SCREEN = [0, 0.72, 1, 0.72, 0];
/** The trunk's tip (head-local screen) per view and pose: where notes, bubbles and snores come out. */
const TRUNK_TIP = [0, 1, 2, 3].map((v) => {
  const o = {};
  for (const pose of TRUNKS) {
    const g = trunkGeom(v, pose);
    o[pose] = { x: g.V.P(g.tip).x, y: g.V.P(g.tip).y, z: g.V.P(g.tip).z };
  }
  return o;
});
const EYEP = [0, 1, 2].map((v) => eyeLayout(v));
/** The baku is drawn at this size on the arena (rig px → arena px). */
const BOSS_SCALE = 0.8;

export {
  ATLAS_BUDGET,
  ATT,
  BOSS_SCALE,
  BRIM_C,
  CAPP,
  DEG,
  EXPRS,
  EYE_LINE,
  EYE_SIZE,
  EYEP,
  FACE_YAW,
  FACING,
  HEAD_C,
  HEAD_Y,
  HR,
  LEG_L,
  MOUTH_LINE,
  MOUTHS,
  PITCH_SCREEN,
  TAU,
  TRUNK_EL,
  TRUNK_TIP,
  TRUNKS,
  VIEWS,
  buildAtlas,
  centreX,
  eyeLayout,
  headView,
  makeView,
  mouthLayout,
  pack,
  pieceCanvasSize,
  pieceSpecs,
  paintBody,
  paintCap,
  paintEyes,
  paintHead,
  paintHeart,
  paintLegs4,
  paintMouth,
  paintTrunk,
};

/**
 * The whole baku in one picture (briefing diagrams), drawn straight from the
 * painters (no atlas): the turned front view, standing, scale k, the floor
 * under its middle at (cx, groundY); `exposed` shows the star-heart.
 */
export function paintSnoozakuPicture(ctx, cx, groundY, k, exposed = false) {
  const v = 1,
    A = ATT[v];
  ctx.save();
  ctx.translate(cx, groundY);
  ctx.scale(k, k);
  PQ = k;
  paintLegs4(ctx, { v });
  paintBody(ctx, { v });
  if (exposed) {
    ctx.save();
    ctx.translate(A.heart.x, A.heart.y);
    paintHeart(ctx);
    ctx.restore();
  }
  ctx.save();
  ctx.translate(A.head.x, HEAD_Y);
  paintHead(ctx, { v });
  paintEyes(ctx, { v, expr: exposed ? "wide" : "idle" });
  paintMouth(ctx, { v, m: exposed ? "o" : "smile" });
  paintTrunk(ctx, { v, pose: "rest" });
  paintCap(ctx, { v });
  ctx.restore();
  ctx.restore();
  return { core: { x: cx + A.heart.x * k, y: groundY + A.heart.y * k } };
}
