/**
 * Grumblecrag, the living mountain, drawn as vector art in the champions'
 * style (soft three-stop gradients, a dark outline, a white highlight, light
 * from the upper left) instead of painted atlases.
 *
 * The boss is a 2.5D rig: every rock, crystal, eye and the core has a place in
 * 3D (x right, y up, z towards the camera), posed by joint angles and seen
 * from the game's camera (ground circles 0.65 as tall as wide, upright actors
 * unsquashed, see world-art.ts). Any pose and facing is computed, so attacks
 * get their own poses without new drawings. This module has no Phaser: it
 * builds the parts for a pose and draws each part on a 2D canvas, both to bake
 * the battle textures (boss-vector-rig.ts) and for the briefing diagrams.
 */
export type Vec3 = { x: number; y: number; z: number };
const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const add = (a: Vec3, b: Vec3) => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: Vec3, b: Vec3) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a: Vec3, s: number) => v3(a.x * s, a.y * s, a.z * s);
const rotX = (p: Vec3, a: number) => {
  const c = Math.cos(a),
    s = Math.sin(a);
  return v3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
};
const rotY = (p: Vec3, a: number) => {
  const c = Math.cos(a),
    s = Math.sin(a);
  return v3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
};
const rotZ = (p: Vec3, a: number) => {
  const c = Math.cos(a),
    s = Math.sin(a);
  return v3(p.x * c - p.y * s, p.x * s + p.y * c, p.z);
};
const TAU = Math.PI * 2;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The game's camera: depth moves things on the floor down the screen by this much. */
export const GROUND_TILT = 0.65;
/**
 * Depth inside the body moves a part much less: the champions are flat
 * sprites, so the boss reads as one too, while its parts still sort front to
 * back.
 */
export const BODY_TILT = 0.3;

export interface ArmPose {
  /** Out to the side (radians). */
  raise: number;
  /** Forward (radians; π is straight up). */
  swing: number;
  /** Elbow bend (radians). */
  bend: number;
}
export interface GrumblePose {
  bob: number;
  crouch: number;
  lean: number;
  twist: number;
  headPitch: number;
  headYaw: number;
  jaw: number;
  armL: ArmPose;
  armR: ArmPose;
  legL: number;
  legR: number;
  liftL: number;
  liftR: number;
  /** Crystal glow (0 idle, 1+ gathering power). */
  glow: number;
  fistGlow: number;
  /** Core shell pulled open (0..1). */
  expose: number;
  /** A rock held in the right fist (0..1). */
  hold: number;
  mouthGlow: number;
}
export const IDLE_ARM: Readonly<ArmPose> = {
  raise: 0.36,
  swing: 0.12,
  bend: 0.5,
};
export function grumbleIdle(breath = 0): GrumblePose {
  return {
    bob: breath * 2.2,
    crouch: 0,
    lean: 0.05,
    twist: 0,
    headPitch: 0.05 + breath * 0.02,
    headYaw: 0,
    jaw: 0,
    armL: { ...IDLE_ARM, raise: IDLE_ARM.raise + breath * 0.02 },
    armR: { ...IDLE_ARM, raise: IDLE_ARM.raise + breath * 0.02 },
    legL: 0,
    legR: 0,
    liftL: 0,
    liftR: 0,
    glow: 0.2,
    fistGlow: 0,
    expose: 0,
    hold: 0,
    mouthGlow: 0,
  };
}

export type GrumblePart =
  | {
      kind: "rock";
      id: string;
      w: Vec3;
      rx: number;
      ry: number;
      seed: number;
      fist?: boolean;
      /** Rests lowest (the feet sort behind what stands on them). */
      low?: boolean;
    }
  | {
      kind: "crystal";
      id: string;
      base: Vec3;
      tip: Vec3;
      width: number;
      small?: boolean;
    }
  | {
      kind: "eye";
      id: string;
      w: Vec3;
      facing: number;
      headZ: number;
      dir: number;
    }
  | { kind: "mouth"; id: string; w: Vec3; facing: number }
  | { kind: "core"; id: string; w: Vec3; facing: number };

export function partDepth(p: GrumblePart) {
  if (p.kind === "crystal") return Math.max(p.base.z, p.tip.z) - 2;
  return p.w.z - (p.kind === "rock" && p.low ? 8 : 0);
}

/**
 * Every part of the boss for a pose, facing `yaw` (0 towards the camera, π/2
 * screen right), relative to the point between its feet on the ground.
 */
export function grumbleParts(P: GrumblePose, yaw: number) {
  const pelvisY = 74 - P.crouch + P.bob * 0.6;
  const P0 = v3(0, pelvisY, 0);
  // torso space (pelvis at y=74) → boss space: twist, then lean about the pelvis
  const T = (p: Vec3) =>
    add(
      rotX(rotY(sub(p, v3(0, 74, 0)), P.twist), P.lean),
      add(P0, v3(0, P.bob * 0.4, 0)),
    );
  const W = (p: Vec3) => rotY(p, yaw);
  const dirW = (d: Vec3) => rotY(rotX(rotY(d, P.twist), P.lean), yaw);
  const parts: GrumblePart[] = [];
  const rock = (
    id: string,
    p: Vec3,
    rx: number,
    ry: number,
    seed: number,
    extra: { fist?: boolean; low?: boolean } = {},
  ) => parts.push({ kind: "rock", id, w: W(p), rx, ry, seed, ...extra });
  const crystal = (
    id: string,
    base: Vec3,
    tip: Vec3,
    width: number,
    small = false,
  ) =>
    parts.push({
      kind: "crystal",
      id,
      base: W(base),
      tip: W(tip),
      width,
      small,
    });

  for (const side of [-1, 1]) {
    const L = side < 0 ? "L" : "R";
    const swing = side < 0 ? P.legL : P.legR,
      lift = side < 0 ? P.liftL : P.liftR;
    const hip = v3(side * 40, pelvisY - 6, 0);
    const foot = v3(side * 44, 20 + lift, Math.sin(swing) * 42);
    const thigh = v3(
      lerp(hip.x, foot.x, 0.45),
      lerp(hip.y, foot.y, 0.45) + 4,
      lerp(hip.z, foot.z, 0.45),
    );
    rock("thigh" + L, thigh, 34, 33, side < 0 ? 11 : 12);
    rock("foot" + L, foot, 37, 24, side < 0 ? 13 : 14, { low: true });
  }
  rock("pelvis", T(v3(0, 82, -2)), 50, 30, 21);
  rock("hump", T(v3(0, 154, -32)), 66, 54, 22);
  rock("torso", T(v3(0, 124, 0)), 76, 62, 23);
  rock("belly", T(v3(0, 98, 32)), 40, 26, 24);
  rock("chestL", T(v3(-34, 142, 38)), 33, 27, 25);
  rock("chestR", T(v3(34, 142, 38)), 33, 27, 26);
  // a ridge of crystals down the spine, pointing up so they read as spikes from behind
  crystal("spine1", T(v3(0, 186, -48)), T(v3(0, 232, -66)), 15);
  crystal("spine2", T(v3(0, 160, -66)), T(v3(0, 200, -88)), 12);
  crystal("spine3", T(v3(0, 132, -72)), T(v3(0, 164, -96)), 10);
  crystal("bladeL", T(v3(-44, 172, -44)), T(v3(-64, 208, -60)), 10);
  crystal("bladeR", T(v3(44, 172, -44)), T(v3(64, 208, -60)), 10);

  const neck = v3(0, 168, 34);
  const H = (p: Vec3) => T(add(neck, rotY(rotX(p, -P.headPitch), P.headYaw)));
  const headN = dirW(rotY(rotX(v3(0, 0, 1), -P.headPitch), P.headYaw));
  const headW = W(H(v3(0, 20, 14)));
  rock("head", H(v3(0, 20, 14)), 45, 38, 31);
  rock("jaw", H(v3(0, -6 - P.jaw * 14, 30 + P.jaw * 6)), 33, 15, 33);
  for (const x of [-16, 16])
    parts.push({
      kind: "eye",
      id: x < 0 ? "eyeL" : "eyeR",
      w: W(H(v3(x, 24, 50))),
      facing: headN.z,
      headZ: headW.z,
      dir: Math.sign(x),
    });
  parts.push({
    kind: "mouth",
    id: "mouth",
    w: W(H(v3(0, 4, 50))),
    facing: headN.z,
  });
  crystal("hornL", H(v3(-22, 48, 8)), H(v3(-40, 94, -6)), 14);
  crystal("hornR", H(v3(22, 48, 8)), H(v3(40, 94, -6)), 14);

  const fists: Vec3[] = [];
  for (const side of [-1, 1]) {
    const L = side < 0 ? "L" : "R",
      A = side < 0 ? P.armL : P.armR;
    const sh = v3(side * 94, 146, 4);
    const down = v3(0, -1, 0);
    const du = rotZ(rotX(down, -A.swing), side * A.raise);
    const df = rotZ(rotX(down, -(A.swing + A.bend)), side * (A.raise * 0.7));
    const elbow = add(sh, mul(du, 54));
    const fist = add(elbow, mul(df, 60));
    rock(
      "shoulder" + L,
      T(add(sh, v3(side * 2, 8, 0))),
      43,
      37,
      side < 0 ? 41 : 42,
    );
    rock("upper" + L, T(add(sh, mul(du, 27))), 28, 28, side < 0 ? 43 : 44);
    rock("fore" + L, T(add(elbow, mul(df, 22))), 31, 29, side < 0 ? 45 : 46);
    rock("fist" + L, T(fist), 39, 35, side < 0 ? 47 : 48, { fist: true });
    crystal(
      "knuckle" + L,
      T(add(fist, mul(df, -4))),
      T(add(fist, add(mul(df, 20), v3(side * 10, 0, 0)))),
      6,
      true,
    );
    fists.push(W(T(fist)));
  }
  if (P.hold > 0.01)
    parts.push({
      kind: "rock",
      id: "held",
      w: add(fists[1], v3(0, 26, 0)),
      rx: 18 * P.hold,
      ry: 17 * P.hold,
      seed: 77,
    });
  const coreN = dirW(v3(0, 0, 1));
  parts.push({
    kind: "core",
    id: "core",
    w: W(T(v3(0, 114, 66))),
    facing: coreN.z,
  });
  return { parts, fists, head: headW };
}

/** Screen offset (rig units) of a rig point from the point between the feet. */
export function project(p: Vec3) {
  return { x: p.x, y: -p.y + p.z * BODY_TILT };
}
/**
 * The angle the body is drawn at for a facing: as a 2D artist draws a side
 * view, the profile turns about 30° towards the camera, so the far arm, the
 * face and the boss's width still show. Front and back stay as they are.
 */
export const viewYaw = (yaw: number) => yaw - 0.5 * Math.sin(yaw);

// ───────────────────────── palettes ─────────────────────────
export type Phase = 1 | 2 | 3;
export const ROCK: Record<
  Phase,
  { light: string; mid: string; dark: string; line: string; top: string }
> = {
  1: {
    light: "#c2b29c",
    mid: "#6f6258",
    dark: "#1f1916",
    line: "#120d0b",
    top: "rgba(255,240,215,0.16)",
  },
  2: {
    light: "#bba890",
    mid: "#665649",
    dark: "#1c1411",
    line: "#110a08",
    top: "rgba(255,225,190,0.14)",
  },
  3: {
    light: "#c99a82",
    mid: "#6e4438",
    dark: "#1d0d0a",
    line: "#100504",
    top: "rgba(255,200,160,0.14)",
  },
};
export const CRYSTAL: Record<
  Phase,
  { light: string; mid: string; dark: string; line: string; glow: number }
> = {
  1: {
    light: "#fff3c2",
    mid: "#f6b53f",
    dark: "#a8501a",
    line: "#4d2309",
    glow: 0xffbe50,
  },
  2: {
    light: "#ffe7ad",
    mid: "#ff9a33",
    dark: "#9a3c12",
    line: "#4a1c07",
    glow: 0xff963c,
  },
  3: {
    light: "#ffe2bc",
    mid: "#ff6b2c",
    dark: "#8a1b0c",
    line: "#3f0b04",
    glow: 0xff6e28,
  },
};
export const EYE: Record<Phase, number> = {
  1: 0xffcd5a,
  2: 0xffb446,
  3: 0xffecaa,
};
const CRACK: Record<Phase, { outer: string; core: string } | null> = {
  1: null,
  2: { outer: "rgba(255,128,40,0.6)", core: "#ffcf70" },
  3: { outer: "rgba(255,170,70,0.8)", core: "#fff1c4" },
};
const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

/** Deterministic random numbers (the same cracks every visit). */
function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}
function cracks(seed: number) {
  const r = rng(seed * 7 + 3);
  const out: [number, number][][] = [];
  const n = 2 + Math.floor(r() * 2);
  for (let k = 0; k < n; k++) {
    const a = r() * TAU,
      d = r() * 0.25;
    let x = Math.cos(a) * d,
      y = Math.sin(a) * d;
    const pts: [number, number][] = [[x, y]];
    const dir = a + (r() - 0.5);
    for (let i = 0; i < 4; i++) {
      const step = 0.16 + r() * 0.14,
        turn = dir + (r() - 0.5) * 1.1;
      x += Math.cos(turn) * step;
      y += Math.sin(turn) * step;
      pts.push([x, y]);
    }
    out.push(pts);
  }
  return out;
}

// ───────────────────────── drawing a part on a canvas ─────────────────────────
type Ctx = CanvasRenderingContext2D;
function rockPath(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  seed: number,
) {
  const N = 7,
    pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU + seed;
    const k =
      1 +
      0.12 * Math.sin(3 * a + seed * 1.3) +
      0.07 * Math.sin(5 * a + seed * 1.9);
    pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]);
  }
  const m = (p: [number, number], q: [number, number]) => [
    (p[0] + q[0]) / 2,
    (p[1] + q[1]) / 2,
  ];
  ctx.beginPath();
  const s0 = m(pts[N - 1], pts[0]);
  ctx.moveTo(s0[0], s0[1]);
  for (let i = 0; i < N; i++) {
    const p = pts[i],
      e = m(p, pts[(i + 1) % N]);
    ctx.quadraticCurveTo(p[0], p[1], e[0], e[1]);
  }
  ctx.closePath();
}
/** Room a rock needs around its radii (its bumps and outline). */
export const ROCK_PAD = 1.3;

/** One rock, centred on (x, y), radii already in canvas pixels; `k` is pixels per rig unit. */
export function drawRock(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  seed: number,
  phase: Phase,
  k: number,
) {
  const pal = ROCK[phase];
  rockPath(ctx, x, y, rx, ry, seed);
  const g = ctx.createRadialGradient(
    x - rx * 0.38,
    y - ry * 0.5,
    0,
    x - rx * 0.18,
    y - ry * 0.25,
    Math.max(rx, ry) * 1.45,
  );
  g.addColorStop(0, pal.light);
  g.addColorStop(0.5, pal.mid);
  g.addColorStop(1, pal.dark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // a lit top plane and a shaded underside: carved facets
  ctx.fillStyle = pal.top;
  ctx.beginPath();
  ctx.moveTo(x - rx * 1.1, y - ry * 0.05);
  ctx.lineTo(x - rx * 0.2, y - ry * 0.32);
  ctx.lineTo(x + rx * 0.75, y - ry * 0.12);
  ctx.lineTo(x + rx * 1.1, y - ry * 1.2);
  ctx.lineTo(x - rx * 1.1, y - ry * 1.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.moveTo(x - rx * 1.1, y + ry * 0.45);
  ctx.lineTo(x + rx * 0.1, y + ry * 0.62);
  ctx.lineTo(x + rx * 1.1, y + ry * 0.3);
  ctx.lineTo(x + rx * 1.1, y + ry * 1.2);
  ctx.lineTo(x - rx * 1.1, y + ry * 1.2);
  ctx.closePath();
  ctx.fill();
  const glow = CRACK[phase];
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const c of cracks(seed)) {
    ctx.beginPath();
    c.forEach(([u, v], i) =>
      i
        ? ctx.lineTo(x + u * rx, y + v * ry)
        : ctx.moveTo(x + u * rx, y + v * ry),
    );
    if (glow) {
      ctx.strokeStyle = glow.outer;
      ctx.lineWidth = Math.max(2, 5.5 * k);
      ctx.shadowColor = "rgba(255,120,40,0.9)";
      ctx.shadowBlur = 8 * k;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = glow.core;
      ctx.lineWidth = Math.max(1, 1.7 * k);
      ctx.stroke();
    } else {
      ctx.strokeStyle = "rgba(25,15,10,0.5)";
      ctx.lineWidth = Math.max(1, 1.4 * k);
      ctx.stroke();
    }
  }
  ctx.restore();
  rockPath(ctx, x, y, rx, ry, seed);
  ctx.lineWidth = Math.max(1.4, 2.6 * k);
  ctx.lineJoin = "round";
  ctx.strokeStyle = pal.line;
  ctx.stroke();
  // the champions' soft white highlight
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.36, y - ry * 0.44, rx * 0.3, ry * 0.15, -0.45, 0, TAU);
  ctx.fill();
}

/** One crystal shard from base (bx, by) to tip (tx, ty); `w` its half-width in pixels. */
export function drawCrystal(
  ctx: Ctx,
  bx: number,
  by: number,
  tx: number,
  ty: number,
  w: number,
  phase: Phase,
  k: number,
) {
  const dx = tx - bx,
    dy = ty - by,
    len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len,
    ny = dx / len;
  const pal = CRYSTAL[phase];
  const mx = bx + dx * 0.62,
    my = by + dy * 0.62;
  ctx.beginPath();
  ctx.moveTo(bx + nx * w * 0.8, by + ny * w * 0.8);
  ctx.lineTo(mx + nx * w, my + ny * w);
  ctx.lineTo(tx, ty);
  ctx.lineTo(mx - nx * w, my - ny * w);
  ctx.lineTo(bx - nx * w * 0.8, by - ny * w * 0.8);
  ctx.closePath();
  const g = ctx.createLinearGradient(
    bx - nx * w,
    by - ny * w,
    bx + nx * w,
    by + ny * w,
  );
  g.addColorStop(0, pal.dark);
  g.addColorStop(0.45, pal.mid);
  g.addColorStop(0.7, pal.light);
  g.addColorStop(1, pal.mid);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(1, 1.6 * k);
  ctx.lineJoin = "round";
  ctx.strokeStyle = pal.line;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = Math.max(0.8, 1.1 * k);
  ctx.beginPath();
  ctx.moveTo(bx + nx * w * 0.15, by + ny * w * 0.15);
  ctx.lineTo(tx, ty);
  ctx.stroke();
}

/** A right eye under its brow, centred on (x, y) (mirror it for the left). */
export function drawEye(
  ctx: Ctx,
  x: number,
  y: number,
  phase: Phase,
  k: number,
) {
  const ew = 12.5 * k,
    eh = 6 * k;
  const pal = ROCK[phase];
  ctx.save();
  ctx.translate(x, y);
  // angry: slanting down towards the nose
  ctx.rotate(-0.3);
  ctx.scale(-1, 1);
  ctx.fillStyle = "rgba(10,6,4,0.55)";
  ctx.beginPath();
  ctx.ellipse(0, eh * 0.2, ew * 1.35, eh * 2.1, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = pal.mid;
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = Math.max(1.4, 2.2 * k);
  ctx.beginPath();
  ctx.moveTo(-ew * 1.6, -eh * 2.6);
  ctx.quadraticCurveTo(0, -eh * 2.9, ew * 1.5, -eh * 1.2);
  ctx.lineTo(ew * 1.25, -eh * 0.55);
  ctx.quadraticCurveTo(0, -eh * 1.5, -ew * 1.45, -eh * 1.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-ew, 0);
  ctx.quadraticCurveTo(0, -eh * 1.5, ew, 0);
  ctx.quadraticCurveTo(0, eh * 0.9, -ew, 0);
  ctx.closePath();
  ctx.fillStyle = "#1a0e08";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-ew * 0.78, 0);
  ctx.quadraticCurveTo(0, -eh * 1.05, ew * 0.78, 0);
  ctx.quadraticCurveTo(0, eh * 0.55, -ew * 0.78, 0);
  ctx.closePath();
  ctx.fillStyle = hex(EYE[phase]);
  ctx.fill();
  ctx.restore();
}

/** The core gem, centred on (x, y). */
export function drawCore(
  ctx: Ctx,
  x: number,
  y: number,
  phase: Phase,
  k: number,
) {
  const pal = CRYSTAL[phase];
  const h = 21 * k,
    w = 14 * k;
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.lineTo(x + w, y - h * 0.35);
  ctx.lineTo(x + w * 0.8, y + h * 0.5);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x - w * 0.8, y + h * 0.5);
  ctx.lineTo(x - w, y - h * 0.35);
  ctx.closePath();
  const g = ctx.createLinearGradient(x - w, y - h, x + w, y + h);
  g.addColorStop(0, pal.light);
  g.addColorStop(0.5, pal.mid);
  g.addColorStop(1, pal.dark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(1, 1.6 * k);
  ctx.strokeStyle = pal.line;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y - h * 0.3);
  ctx.lineTo(x, y - h * 0.8);
  ctx.lineTo(x - w * 0.1, y - h * 0.1);
  ctx.closePath();
  ctx.fill();
}

/** The dark hollow the core sits in once its armour opens. */
export function drawCavity(ctx: Ctx, x: number, y: number, k: number) {
  const r = 24 * k;
  ctx.fillStyle = "#170905";
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 1.1, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,170,70,0.75)";
  ctx.lineWidth = 3 * k;
  ctx.stroke();
}

/** A soft white glow (tinted and added on top in battle). */
export function drawGlow(ctx: Ctx, size: number) {
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, "rgba(255,255,255,0.85)");
  g.addColorStop(0.35, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
}

/**
 * The whole boss in one picture (briefing diagrams): front three-quarter
 * view, standing; `exposed` opens the core.
 */
export function drawGrumble(
  ctx: Ctx,
  cx: number,
  groundY: number,
  k: number,
  phase: Phase,
  exposed = false,
) {
  const P = grumbleIdle();
  P.expose = exposed ? 1 : 0;
  const { parts } = grumbleParts(P, Math.PI / 8);
  const glowAt = (
    x: number,
    y: number,
    r: number,
    color: number,
    a: number,
  ) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const c = `${(color >> 16) & 255},${(color >> 8) & 255},${color & 255}`;
    g.addColorStop(0, `rgba(${c},${a})`);
    g.addColorStop(1, `rgba(${c},0)`);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  };
  const at = (p: Vec3) => {
    const s = project(p);
    return { x: cx + s.x * k, y: groundY + s.y * k };
  };
  for (const part of [...parts].sort((a, b) => partDepth(a) - partDepth(b))) {
    if (part.kind === "rock") {
      const s = at(part.w);
      drawRock(ctx, s.x, s.y, part.rx * k, part.ry * k, part.seed, phase, k);
    } else if (part.kind === "crystal") {
      const b = at(part.base),
        t = at(part.tip);
      drawCrystal(ctx, b.x, b.y, t.x, t.y, part.width * k, phase, k);
      glowAt(
        lerp(b.x, t.x, 0.65),
        lerp(b.y, t.y, 0.65),
        (part.small ? 14 : 26) * k,
        CRYSTAL[phase].glow,
        0.35,
      );
    } else if (part.kind === "eye") {
      if (part.facing < -0.25 || part.w.z < part.headZ + 3) continue;
      const s = at(part.w);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(part.dir < 0 ? -1 : 1, 1);
      drawEye(ctx, 0, 0, phase, k);
      ctx.restore();
      glowAt(s.x, s.y, 22 * k, EYE[phase], 0.6);
    } else if (part.kind === "core" && part.facing > 0.05) {
      const s = at(part.w);
      if (exposed) drawCavity(ctx, s.x, s.y, k);
      drawCore(ctx, s.x, s.y, phase, k * (exposed ? 1.3 : 1));
      glowAt(
        s.x,
        s.y,
        (exposed ? 80 : 40) * k,
        CRYSTAL[phase].glow,
        exposed ? 0.85 : 0.5,
      );
    }
  }
}

let guideUrls: Partial<Record<string, string>> = {};
/** Where the standing boss reaches in the guide picture (pixels). */
function guideBounds(k: number, cx: number, groundY: number) {
  const { parts } = grumbleParts(grumbleIdle(), Math.PI / 8);
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  const grow = (x: number, y: number, rx = 0, ry = 0) => {
    x0 = Math.min(x0, x - rx);
    x1 = Math.max(x1, x + rx);
    y0 = Math.min(y0, y - ry);
    y1 = Math.max(y1, y + ry);
  };
  let core: [number, number] = [cx, groundY];
  for (const p of parts) {
    if (p.kind === "rock") {
      const s = project(p.w);
      grow(cx + s.x * k, groundY + s.y * k, p.rx * k * 1.15, p.ry * k * 1.15);
    } else if (p.kind === "crystal") {
      const t = project(p.tip);
      grow(cx + t.x * k, groundY + t.y * k);
    } else if (p.kind === "core") {
      const s = project(p.w);
      core = [cx + s.x * k, groundY + s.y * k];
    }
  }
  const pad = 4;
  return {
    crop: [x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2] as [
      number,
      number,
      number,
      number,
    ],
    core,
  };
}
/**
 * The boss as an image URL for the briefing diagrams (drawn once per look),
 * with the crop around it and where its core sits. The URL is empty without
 * a canvas (outside a browser).
 */
export function grumbleGuideImage(exposed = false) {
  const width = 360,
    height = 340,
    k = 0.92,
    groundY = 300;
  const key = exposed ? "exposed" : "calm";
  if (
    !guideUrls[key] &&
    typeof document !== "undefined" &&
    typeof document.createElement === "function"
  ) {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        drawGrumble(ctx, width / 2, groundY, k, 1, exposed);
        guideUrls[key] = canvas.toDataURL("image/png");
      }
    } catch {
      /* No drawing surface: the diagram shows no picture. */
    }
  }
  return {
    url: guideUrls[key] ?? "",
    width,
    height,
    ...guideBounds(k, width / 2, groundY),
  };
}
/** Forget the drawn guide pictures (tests). */
export function resetGrumbleGuide() {
  guideUrls = {};
}

// ───────────────────────── from the game's state to a pose ─────────────────────────
/** What the battle tells the rig each frame (all cosmetic, from the snapshot). */
export interface GrumbleCue {
  /** Seconds since the encounter's poses started (breathing, pounding). */
  time: number;
  breath: number;
  /** Phase 1–3. */
  phase: number;
  reduced: boolean;
  /** Mountain Charge: windup (0..1) and the run itself. */
  charge: number;
  charging: boolean;
  /** Ground Slam: fists rising (0..1), then the hit fading (1..0). */
  slam: number;
  impact: number;
  /** Falling Debris: the boss pounds and roars (0..1). */
  debris: number;
  /** A new phase: a roar (1..0). */
  transform: number;
  /** The attack being wound up (a server warning) and how far (0..1). */
  windKind?: string;
  windup: number;
  /** The attack just cast and how long ago (seconds). */
  castKind?: string;
  castAge: number;
  stagger: boolean;
  exposed: boolean;
  /** Hit flinch (1..0). */
  hurt: number;
  dead: boolean;
  /** Walk cycle (radians) and ground speed (world px/s). */
  stride: number;
  speed: number;
  /** Where the head turns (radians from the body's facing). */
  look: number;
}

const easeIO = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
function walkLegs(P: GrumblePose, phase: number, amp: number) {
  P.legL = amp * Math.sin(phase);
  P.legR = -P.legL;
  P.liftL = Math.max(0, Math.cos(phase)) * 13;
  P.liftR = Math.max(0, -Math.cos(phase)) * 13;
  P.bob = 3.5 * Math.abs(Math.cos(phase)) - 2;
  P.twist = 0.11 * Math.sin(phase);
  P.armL.swing = IDLE_ARM.swing - 0.42 * Math.sin(phase);
  P.armR.swing = IDLE_ARM.swing + 0.42 * Math.sin(phase);
}
const both = (P: GrumblePose, f: (a: ArmPose) => void) => {
  f(P.armL);
  f(P.armR);
};

/** The rig's pose for this moment of the fight. */
export function grumblePose(c: GrumbleCue): GrumblePose {
  const t = c.reduced ? 0 : c.time;
  const P = grumbleIdle(c.reduced ? 0 : c.breath);
  P.headYaw = clamp(c.look, -0.35, 0.35);
  P.glow = 0.2 + 0.06 * Math.sin(t * 2.3) + (c.phase - 1) * 0.15;

  if (c.charging) {
    walkLegs(P, c.stride, c.reduced ? 0 : 0.6);
    P.lean = 0.45;
    P.headPitch = 0.3;
    both(P, (a) => {
      a.swing = -0.85;
      a.raise = 0.6;
    });
  } else if (c.speed > 12 && !c.dead && !c.stagger)
    walkLegs(P, c.stride, c.reduced ? 0 : 0.45);

  if (c.charge > 0 && !c.charging) {
    // lowered head, arms back, pawing the ground
    const k = clamp(c.charge);
    P.lean = lerp(0.05, -0.22, k);
    P.crouch = 12 * k;
    P.headPitch = lerp(0.05, 0.2, k);
    both(P, (a) => {
      a.swing = lerp(IDLE_ARM.swing, -0.55, k);
      a.raise = lerp(IDLE_ARM.raise, 0.55, k);
    });
    P.legR = Math.sin(t * 18) * 0.35 * k;
    P.liftR = Math.max(0, Math.sin(t * 18)) * 10 * k;
    P.glow += 0.6 * k;
  }

  if (c.slam > 0) {
    // both fists high overhead, crystals and fists burning brighter
    const s = easeIO(clamp(c.slam * 1.4));
    both(P, (a) => {
      a.swing = lerp(IDLE_ARM.swing, 2.75, s);
      a.raise = lerp(IDLE_ARM.raise, 0.22, s);
      a.bend = lerp(IDLE_ARM.bend, 0.7, s);
    });
    P.lean = lerp(P.lean, -0.2, s);
    P.headPitch = lerp(P.headPitch, -0.25, s);
    P.glow += s;
    P.fistGlow = s;
  }
  if (c.impact > 0 && !c.reduced) {
    // fists driven into the ground in front (a follow-through that fades: not
    // with reduced motion, where the warning and the floor show the hit)
    const i = clamp(c.impact);
    both(P, (a) => {
      a.swing = lerp(a.swing, 1.05, i);
      a.bend = lerp(a.bend, 0.15, i);
      a.raise = lerp(a.raise, 0.2, i);
    });
    P.lean = lerp(P.lean, 0.4, i);
    P.crouch = Math.max(P.crouch, 24 * i);
    P.headPitch = lerp(P.headPitch, 0.25, i);
    P.fistGlow = Math.max(P.fistGlow, i * 0.6);
  }
  if (c.debris > 0) {
    // roaring at the sky, fists pounding: the ceiling comes down
    const d = clamp(c.debris);
    P.headPitch = lerp(P.headPitch, -0.45, d);
    P.jaw = 0.8 * d;
    P.mouthGlow = P.jaw;
    const beat = Math.sin(t * 16);
    P.armL.swing = lerp(P.armL.swing, 2.2 + 0.35 * beat, d);
    P.armR.swing = lerp(P.armR.swing, 2.2 - 0.35 * beat, d);
    both(P, (a) => (a.raise = lerp(a.raise, 1.0, d)));
    P.glow += d;
  }

  const w = clamp(c.windup);
  if (w > 0 && c.windKind === "volley") {
    P.armR.swing = lerp(IDLE_ARM.swing, -1.15, w);
    P.armR.raise = lerp(IDLE_ARM.raise, 0.95, w);
    P.armR.bend = lerp(IDLE_ARM.bend, 1.3, w);
    P.armL.swing = lerp(IDLE_ARM.swing, 0.9, w);
    P.twist = -0.5 * w;
    P.hold = w;
  } else if (w > 0 && c.windKind === "eruption") {
    P.armR.swing = lerp(IDLE_ARM.swing, 2.3, w);
    P.armR.bend = lerp(IDLE_ARM.bend, 0.8, w);
    P.armL.raise = lerp(IDLE_ARM.raise, 0.75, w);
    P.fistGlow = Math.max(P.fistGlow, w);
    P.crouch = Math.max(P.crouch, 8 * w);
  } else if (w > 0 && c.windKind === "share") {
    both(P, (a) => {
      a.swing = lerp(IDLE_ARM.swing, 2.95, w);
      a.raise = lerp(IDLE_ARM.raise, 0.3, w);
      a.bend = lerp(IDLE_ARM.bend, 0.1, w);
    });
    P.headPitch = lerp(P.headPitch, -0.5, w);
    P.lean = lerp(P.lean, -0.22, w);
    P.glow += 1.2 * w;
  }
  if (c.castKind && c.castAge < 0.5) {
    const u = clamp(1 - c.castAge / 0.5);
    if (c.castKind === "volley") {
      P.armR.swing = lerp(IDLE_ARM.swing, 1.55, u);
      P.armR.raise = lerp(IDLE_ARM.raise, 0.35, u);
      P.armR.bend = lerp(IDLE_ARM.bend, 0.15, u);
      P.twist = 0.45 * u;
      P.lean = lerp(P.lean, 0.22, u);
      P.hold = 0;
    } else if (c.castKind === "eruption") {
      P.armR.swing = lerp(IDLE_ARM.swing, 0.75, u);
      P.armR.bend = lerp(IDLE_ARM.bend, 0.05, u);
      P.crouch = Math.max(P.crouch, 30 * u);
      P.lean = lerp(P.lean, 0.48, u);
      P.headPitch = lerp(P.headPitch, 0.3, u);
    } else if (c.castKind === "share") {
      both(P, (a) => {
        a.swing = lerp(IDLE_ARM.swing, 1.2, u);
        a.bend = lerp(IDLE_ARM.bend, 0.2, u);
      });
      P.lean = lerp(P.lean, 0.3, u);
    }
  }

  // Reduced motion: no flourishes that play out over time (the phase roar, a
  // flinch, a slam's follow-through); windups stay, as the fight needs them read.
  if (c.transform > 0 && !c.reduced) {
    // a new phase: a roar with the arms thrown wide
    const f = clamp(c.transform);
    P.jaw = Math.max(P.jaw, f);
    P.mouthGlow = P.jaw;
    P.headPitch = lerp(P.headPitch, -0.45, f);
    P.lean = lerp(P.lean, -0.2, f);
    both(P, (a) => {
      a.raise = lerp(a.raise, 1.25, f);
      a.swing = lerp(a.swing, 0.35, f);
      a.bend = lerp(a.bend, 0.6, f);
    });
    P.glow += 1.5 * f;
  }

  if (c.stagger) {
    // dropped to a knee, head swimming, the core laid bare
    P.crouch = 38;
    P.lean = 0.34;
    P.headPitch = 0.5;
    P.headYaw = c.reduced ? 0 : Math.sin(t * 2.4) * 0.35;
    P.legL = 0.55;
    P.legR = -0.35;
    P.liftL = P.liftR = 0;
    both(P, (a) => {
      a.swing = 0.5;
      a.raise = 0.22;
      a.bend = 0.1;
    });
    P.expose = 1;
  }
  if (c.exposed) P.expose = 1;
  if (c.hurt > 0 && !c.dead && !c.reduced) {
    P.lean -= 0.2 * c.hurt;
    P.headPitch -= 0.3 * c.hurt;
  }
  if (c.dead) {
    P.lean = 0.3;
    P.crouch = 20;
    P.headPitch = 0.5;
    P.jaw = 0;
    P.mouthGlow = 0;
    P.glow = 0;
    P.fistGlow = 0;
    P.expose = 0;
    both(P, (a) => {
      a.swing = 0.3;
      a.raise = 0.25;
      a.bend = 0.1;
    });
  }
  return P;
}

/** The eight ways the boss faces: index 0 towards the camera, 2 screen right. */
export const FACINGS = 8;
const STEP = TAU / FACINGS;
/** The body's facing (radians, 0 towards the camera) for a screen angle. */
export const yawFor = (angle: number) => Math.PI / 2 - angle;
const wrap = (a: number) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
/**
 * Which of the eight facings to show: the nearest, but a facing already shown
 * holds until the boss has turned well past the halfway mark (no flicker
 * between two facings as it tracks someone).
 */
export function nextFacing(angle: number, previous?: number) {
  const yaw = yawFor(angle);
  const nearest = ((Math.round(yaw / STEP) % FACINGS) + FACINGS) % FACINGS;
  if (previous === undefined) return nearest;
  return Math.abs(wrap(yaw - previous * STEP)) > STEP * 0.65
    ? nearest
    : previous;
}
/** Turn `from` towards `to` (radians) by `rate` per second, the short way round. */
export function turnToward(from: number, to: number, dt: number, rate = 16) {
  const d = wrap(to - from);
  return from + d * Math.min(1, dt * rate);
}
/** Radians from `bodyYaw` to where the boss looks (screen direction x, y). */
export function lookFrom(bodyYaw: number, x: number, y: number) {
  if (!x && !y) return 0;
  return wrap(Math.atan2(x, y) - bodyYaw);
}
