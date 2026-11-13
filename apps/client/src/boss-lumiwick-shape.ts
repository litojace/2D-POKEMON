/**
 * Lumiwick's shape: the 3D build of the sky lantern that both the painters
 * (boss-lumiwick-paint.ts, run once into the atlas) and the pose
 * (boss-lumiwick.ts, run every frame) read. Pure maths, no drawing.
 *
 * Rig units: about one arena pixel each at LUMI_SCALE. Local axes: x = the
 * lantern's left, y = up, z = forward (the way its face points). A view is a
 * yaw about y and a fixed 14° camera pitch. Screen = (x, -y), depth = z.
 */
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const ease = (t: number) => t * t * (3 - 2 * t);
export type V3 = { x: number; y: number; z: number };
export type P2 = { x: number; y: number };
export type SP = { x: number; y: number; z: number };
export const norm3 = (x: number, y: number, z: number): V3 => {
  const l = Math.hypot(x, y, z) || 1;
  return { x: x / l, y: y / l, z: z / l };
};
export const norm2 = (x: number, y: number): P2 => {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
};
export const PITCH = 14 * DEG;
export const CP = Math.cos(PITCH);
export const SPITCH = Math.sin(PITCH);
/** Key light in camera space (x right, y up, z to camera): warm, top-left, front. */
export const LIGHT = norm3(-0.58, 0.62, 0.52);
/** The five drawn views; the other three facings are mirrors. */
export const VIEW_YAW = [0, 45 * DEG, 90 * DEG, 135 * DEG, 180 * DEG];
export interface View {
  yaw: number;
  /** Screen point (y down) with depth z (bigger = nearer). */
  P: (p: V3) => SP;
  /** A local direction in camera space. */
  N: (d: V3) => V3;
}
export function makeView(yaw: number): View {
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  const cam = (x: number, y: number, z: number): V3 => {
    const X = x * c + z * s,
      Z = -x * s + z * c;
    return { x: X, y: y * CP - Z * SPITCH, z: Z * CP + y * SPITCH };
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

// ── the lantern body: a surface of revolution (the same outline from every side) ──
export const L_TOP = 98,
  L_BOT = -68,
  L_R = 79;
/** Radius at height y: a soft gumdrop (round top, slight taper, the hem tucked in). */
export function lanternR(y: number) {
  const t = clamp((L_TOP - y) / (L_TOP - L_BOT));
  let r: number;
  if (t < 0.44) {
    const u = (0.44 - t) / 0.44;
    r = Math.pow(Math.max(0, 1 - Math.pow(u, 2.1)), 1 / 2.1);
  } else r = 1 - 0.22 * Math.pow(smooth(0.44, 1, t), 1.15);
  r -= 0.045 * smooth(0.93, 1, t);
  return L_R * r;
}
/** A point on the paper at angle phi round the axis (0 = its face, + = its left). */
export function surf(phi: number, y: number, out = 0): V3 {
  const r = lanternR(y) + out;
  return { x: r * Math.sin(phi), y, z: r * Math.cos(phi) };
}
export function surfVisible(V: View, phi: number, y: number) {
  const d = (lanternR(y + 1) - lanternR(y - 1)) / 2;
  return V.N(norm3(Math.sin(phi), -d, Math.cos(phi))).z > 0.02;
}
/** Screen y of the axis at height y. */
export const yS = (y: number) => -y * CP;

// ── the face: placed by the surface, drawn upright per view ──
/** The face turns a little further toward the camera than the body (an anime cheat). */
export const FACE_YAW = [0, 36 * DEG, 66 * DEG];
export const faceYawOf = (bodyYaw: number) =>
  bodyYaw <= 45 * DEG
    ? bodyYaw * 0.8
    : 36 * DEG + (bodyYaw - 45 * DEG) * (30 / 45);
export const EYE_PHI = 0.35,
  EYE_Y = 5,
  MOUTH_Y = -33;
export const EYE_HH = 20,
  EYE_HW = 15,
  EYE_HW_FAR = 10.5,
  EYE_HW_SIDE = 11.5,
  IRIS_R = 11.5,
  PUPIL_R = 5.2;
export const EXPRS = [
  "idle",
  "glare",
  "wide",
  "hurt",
  "dizzy",
  "closed",
] as const;
export type Expr = (typeof EXPRS)[number];
export const MOUTHS = ["smirk", "grin", "o", "wavy", "flat"] as const;
export type Mouth = (typeof MOUTHS)[number];
const PROFILE_AT = 60 * DEG;
export type EyeKind = "front" | "near" | "far" | "side";
export interface Eye {
  x: number;
  y: number;
  hw: number;
  hh: number;
  /** Screen direction toward the nose (+1 right, -1 left); a side eye: its front. */
  inner: number;
  kind: EyeKind;
  /** The iris offset both eyes share (they look the same way). */
  look: number;
  left: boolean;
}
/**
 * Where each eye sits in a face view and which drawing it gets: a front
 * pair; at ¾ a near eye and a narrower far eye tucked toward the far edge;
 * at the side one profile eye, well inside the outline.
 */
export function eyeLayout(vOrYaw: number, isYaw = false): Eye[] {
  const fy = isYaw ? vOrYaw : FACE_YAW[vOrYaw],
    V = makeView(fy),
    out: Eye[] = [];
  const fc = V.P(surf(0, EYE_Y));
  const rr = lanternR(EYE_Y);
  const look = fy < 4 * DEG ? -1.6 : 2.4;
  // one eye line in every view: the height the eyes have from the front
  const eyeLine = yS(EYE_Y) + rr * Math.cos(EYE_PHI) * SPITCH;
  for (const phi of [EYE_PHI, -EYE_PHI]) {
    const a = phi + fy,
      c = Math.cos(a);
    const q = V.P(surf(phi, EYE_Y));
    let kind: EyeKind;
    if (fy < 4 * DEG) kind = "front";
    else if (fy >= PROFILE_AT) {
      if (phi > 0) continue;
      kind = "side";
    } else kind = phi < 0 ? "near" : "far";
    if (kind === "far" && c < 0.3) continue;
    const hw =
      kind === "far" ? EYE_HW_FAR : kind === "side" ? EYE_HW_SIDE : EYE_HW;
    const lim = rr - hw - (kind === "far" ? 8 : 6);
    // profile cheat: the side eye sits well inside the outline
    const x =
      kind === "side" ? Math.sign(q.x || 1) * rr * 0.4 : clamp(q.x, -lim, lim);
    out.push({
      x,
      y: eyeLine,
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
    if (gap < 9) near.x -= 9 - gap;
  }
  return out;
}
export interface MouthSpot {
  x: number;
  y: number;
  kind: "front" | "q" | "side";
  /** Half-widths toward the near and the far side (the far half is drawn shorter, not squashed). */
  wn: number;
  wf: number;
}
export function mouthLayout(vOrYaw: number, isYaw = false): MouthSpot {
  const fy = isYaw ? vOrYaw : FACE_YAW[vOrYaw],
    V = makeView(fy);
  const q = V.P(surf(0, MOUTH_Y)),
    mouthLine = yS(MOUTH_Y) + lanternR(MOUTH_Y) * SPITCH;
  const kind = fy < 4 * DEG ? "front" : fy >= PROFILE_AT ? "side" : "q";
  const [wn, wf] =
    kind === "front" ? [11, 11] : kind === "q" ? [11, 6.5] : [10, 3];
  const lim = lanternR(MOUTH_Y) - wf - 6;
  const x =
    kind === "side"
      ? Math.sign(q.x || 1) * lanternR(MOUTH_Y) * 0.5
      : clamp(q.x, -lim, lim);
  return { x, y: Math.min(q.y, mouthLine - 2), kind, wn, wf };
}

// ── arms: two paper ribbons tied to the hem band, ending in tassels ──
export const ARM_PHI = Math.PI / 2 + 0.45,
  ARM_Y = -51,
  ARM_OUT = 1.5;
type C4 = [number, number, number][];
export interface ArmPose {
  /** Cubic control points per drawn flutter state (boss's left ribbon). */
  s: C4[];
  /** Turns showing the pale underside, and a ripple. */
  tw: number;
  wave: number;
}
export const ARM_POSES: Record<string, ArmPose> = {
  rest: {
    s: [
      [
        [0, 0, 0],
        [30, 18, -10],
        [62, 8, -36],
        [80, 38, -56],
      ],
      [
        [0, 0, 0],
        [32, 14, -8],
        [64, 18, -30],
        [76, 48, -52],
      ],
    ],
    tw: 1.6,
    wave: 3.4,
  },
  up: {
    s: [
      [
        [0, 0, 0],
        [34, 6, -24],
        [44, 58, -64],
        [20, 104, -82],
      ],
      [
        [0, 0, 0],
        [36, 8, -20],
        [52, 54, -54],
        [30, 102, -94],
      ],
    ],
    tw: -1.6,
    wave: 3.4,
  },
  sweep: {
    s: [
      [
        [0, 0, 0],
        [20, -24, 8],
        [66, -14, 70],
        [98, 4, 120],
      ],
      [
        [0, 0, 0],
        [22, -22, 12],
        [62, -6, 76],
        [104, -4, 112],
      ],
    ],
    tw: 1.2,
    wave: 2.6,
  },
  point: {
    s: [
      [
        [0, 0, 0],
        [14, -26, 14],
        [50, -16, 74],
        [76, 6, 132],
      ],
      [
        [0, 0, 0],
        [16, -26, 16],
        [54, -20, 70],
        [78, 0, 128],
      ],
    ],
    tw: 0.9,
    wave: 1.6,
  },
  wrap: {
    s: [
      [
        [0, 0, 0],
        [16, -14, 30],
        [0, -8, 104],
        [-54, 8, 114],
      ],
      [
        [0, 0, 0],
        [18, -16, 28],
        [6, -12, 100],
        [-50, 2, 116],
      ],
    ],
    tw: 1.6,
    wave: 2,
  },
  slump: {
    s: [
      [
        [0, 0, 0],
        [18, -10, -4],
        [42, -18, 10],
        [68, -17, 26],
      ],
    ],
    tw: 1.4,
    wave: 2.4,
  },
};
export const ARM_POSE_NAMES = Object.keys(ARM_POSES);
export const armStates = (pose: string) => ARM_POSES[pose].s.length;
const cub = (c: C4, t: number): V3 => {
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
/** The ribbon's spine in 3D (relative to its knot on the band). */
export function armModel(pose: string, side: "L" | "R", st = 0) {
  const P = ARM_POSES[pose],
    sx = side === "L" ? 1 : -1;
  const c = P.s[Math.min(st, P.s.length - 1)].map(
    (q) => [q[0] * sx, q[1], q[2]] as [number, number, number],
  );
  const N = 40,
    pts: { p: V3; s: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    pts.push({ p: cub(c, s), s });
  }
  return pts;
}
export const armRoot = (side: "L" | "R") =>
  surf((side === "L" ? 1 : -1) * ARM_PHI, ARM_Y, ARM_OUT);
