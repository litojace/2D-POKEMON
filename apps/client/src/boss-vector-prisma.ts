/**
 * Prismatail as vector art: a crystal peacock with a swan's neck and head, a
 * gold crown, a cream body with a crystal heart on its breast and a fan of
 * crystal shards. Pure: the pose from the battle's state, the body in 3D, and
 * where each drawn piece goes on screen this frame (`prismaPlacements`).
 * boss-vector-prisma-rig.ts draws the pieces once into an atlas and moves
 * images to these placements; the briefing diagram draws the same placements
 * onto a canvas.
 *
 * Ported from the approved face demo (demos/boss-faces/src/prisma-rig.js).
 * The face is built by the shared construction (boss-vector-face.ts, the
 * method in docs/boss-face-drawing.md): a small swan's head, small teal almond
 * eyes set towards the beak, a short hooked beak whose base tucks the far eye
 * at three-quarter.
 *
 * Rig units: x right, y up, z towards the camera, from the boss's feet on the
 * floor. Like the floor, depth is drawn at 0.65 (world-art.ts).
 */
import { nextFacing, turnToward, type Phase } from "./boss-vector-grumble";
import {
  drawEye,
  makeFace,
  type EyeView,
  type FaceView,
} from "./boss-vector-face";
import { PRISM_COLORS } from "../../../packages/shared/src/raid-prismatail";

export type V3 = { x: number; y: number; z: number };
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const gauss = (x: number, s: number) => Math.exp(-(x * x) / (s * s));
export const PRISMA_TILT = 0.65;
/** Screen position (rig units) of a rig point. */
export const prismaProject = (p: V3) => ({
  x: p.x,
  y: -p.y + p.z * PRISMA_TILT,
});
const rotY = (p: V3, a: number): V3 => {
  const c = Math.cos(a),
    s = Math.sin(a);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
};
/** Sort depth of a rig point: nearer the camera, and higher, is in front. */
const depth = (p: V3) => p.z * 0.84 + p.y * 0.3;
/** A pulse over `dur` seconds after an event `age` seconds ago (0 outside it). */
const after = (age: number, dur: number) =>
  age < 0 || age > dur ? 0 : Math.sin((age / dur) * Math.PI);

// ───────────────────────── the face: construction ─────────────────────────
// A swan's head: small, longer than it is tall, the crown rounding down the
// back into the neck and the brow sloping forward into the beak. From the
// front it is narrow, the eyes on its sides (a bird's, not an owl's).
const A = 17;
const TOP = -0.74 * A,
  BOT = 0.56 * A;
const MID = (TOP + BOT) / 2,
  HALF = (BOT - TOP) / 2;
const se = (v: number) => {
  const t = clamp(Math.abs((v - MID) / HALF));
  const e = v > MID ? 1.7 : 2.3;
  return Math.pow(1 - Math.pow(t, e), 1 / e);
};
/** THE CENTRE LINE: a sloping brow, then the beak's base standing out below the eye. */
export const prismaCentre = (v: number) =>
  A *
  (0.78 * se(v) + 0.3 * gauss((v - 0.08 * A) / A, 0.3) * Math.pow(se(v), 0.4));
const taper = (v: number) => 1 - 0.18 * smooth(MID, BOT, v); // the narrow chin
/** The drawn outline of a view at height v: [left, right], turned to screen right. */
export function prismaSkull(view: FaceView, v: number): [number, number] {
  const s = se(v);
  if (view === "side") return [-0.8 * A * s, prismaCentre(v)];
  if (view === "tq")
    return [-0.9 * A * s, lerp(0.8 * A * s, prismaCentre(v), 0.55)];
  if (view === "backtq")
    return [-0.9 * A * s, lerp(0.76 * A * s, prismaCentre(v), 0.3)];
  return [-0.58 * A * s * taper(v), 0.58 * A * s * taper(v)];
}
const LINES = { brow: -0.36 * A, eye: -0.1 * A, beak: 0.12 * A };
// the front eye is seen across the cheek: drawn narrower, never squeezed
const EYE: Record<EyeView, { hw: number; hh: number }> = {
  front: { hw: 2.3, hh: 2.5 },
  near: { hw: 3.5, hh: 2.6 },
  far: { hw: 2.3, hh: 2.5 },
  side: { hw: 3.6, hh: 2.6 },
};
export type PrismaLook =
  "idle" | "glare" | "wide" | "hurt" | "dizzy" | "closed";
export const PRISMA_LOOKS: PrismaLook[] = [
  "idle",
  "glare",
  "wide",
  "hurt",
  "dizzy",
  "closed",
];
type BrowKind = "calm" | "angry" | "raised" | "pinch";
const BROW: Record<PrismaLook, BrowKind> = {
  idle: "calm",
  glare: "angry",
  wide: "raised",
  hurt: "pinch",
  dizzy: "raised",
  closed: "calm",
};
/** A brow: [outer y, mid y, inner y, thickness, opacity]. */
const BROWS: Record<BrowKind, [number, number, number, number, number]> = {
  calm: [0.5, -0.9, 0.4, 1.0, 0.4],
  angry: [-1.9, -0.5, 1.9, 1.9, 0.9],
  raised: [0.6, -1.9, 0.2, 1.1, 0.6],
  pinch: [1.3, 0.3, -1.5, 1.5, 0.85],
};
/** Where the iris sits in each eye drawing. */
const eyeGeom = (v: EyeView, look: PrismaLook) => ({
  r: look === "wide" ? 1.6 : 1.85,
  gx: v === "far" ? 0.1 : v === "front" ? -0.35 : 0.7,
  gy: look === "wide" ? 0.1 : look === "glare" ? 0.7 : 0.4,
});
export interface PrismaExpr {
  look: PrismaLook;
  mouth: "closed" | "open";
}
const lit = (look: PrismaLook) =>
  look === "idle" || look === "glare" || look === "wide";
export const PRISMA_SPEC = {
  A,
  top: TOP,
  bot: BOT,
  lines: LINES,
  eyeAz: 38 * DEG,
  eyeOrbit: 0.78 * A,
  lag: 12 * DEG,
  farLift: 6 * DEG,
  nod: 0.4 * A,
  margin: 0.02 * A,
  tuckCap: 0.35,
  bridgeHalf: 0.4,
  eye: EYE,
  centreLine: prismaCentre,
  skullEdge: prismaSkull,
  headPiece: (view: FaceView) => `head_${view}`,
  eyePiece: (view: EyeView, e: PrismaExpr) => `eye_${view}_${e.look}`,
  glint: (view: EyeView, e: PrismaExpr) => {
    if (!lit(e.look)) return null;
    const g = eyeGeom(view, e.look);
    return { piece: "glint", x: view === "far" ? -g.gx : g.gx, y: g.gy - 0.3 };
  },
  brow: (view: EyeView, e: PrismaExpr) => ({
    piece: `brow_${view}_${BROW[e.look]}`,
    dx: 0.4,
    dy: e.look === "glare" ? 1.3 : e.look === "wide" ? -1 : 0.3,
  }),
  centre: [
    {
      id: "beak",
      line: LINES.beak,
      sideInset: 1.2,
      // at three-quarter the beak's base tucks the far eye's inner corner
      layer: (view: FaceView) =>
        view === "tq" ? ("mid" as const) : ("top" as const),
      piece: (view: FaceView, e: PrismaExpr) =>
        view === "front" || view === "tq" || view === "side"
          ? `beak_${view}_${e.mouth}`
          : null,
    },
  ],
};
/** The face: a head pose and an expression in, piece placements out. */
export const PRISMA_FACE = makeFace<PrismaExpr>(PRISMA_SPEC);

// ───────────────────────── the pose ─────────────────────────
export type PrismaAttack =
  | "prism-lance"
  | "fan-display"
  | "glare"
  | "refraction"
  | "halo-crush"
  | "light-relay";
export interface PrismaCue {
  clock: number;
  phase: number;
  reduced: boolean;
  /** The attack being wound up (its warning) and how far (0-1). */
  windKind?: string;
  windup: number;
  /** The last attack cast and how long ago (seconds). */
  castKind?: string;
  castAge: number;
  /** Seconds since a new phase began (a cry with its fan up). */
  roarAge: number;
  /** The heart opened by a light relay; staggered; hit (0-1); beaten. */
  exposed: boolean;
  stagger: boolean;
  hurt: number;
  dead: boolean;
  /** Seconds since it was beaten. */
  deadAge: number;
  /** Walking (0-1): a stately strut. */
  walk?: number;
  /** Fan Display: which of the six colours is the safe one (lit in the train). */
  prismHot?: number;
}
export interface PrismaPose {
  clock: number;
  motion: number;
  bob: number;
  fan: number;
  wing: number;
  neckFwd: number;
  neckUp: number;
  rear: number;
  headYaw: number;
  headPitch: number;
  headRoll: number;
  look: PrismaLook;
  mouth: "closed" | "open";
  blink: boolean;
  eyeGlow: number;
  shine: number;
  crown: number;
  alpha: number;
  stars: boolean;
  sink: number;
  walk: number;
  exposed: number;
  dead: boolean;
  prismHot: number;
}
/** The pose at rest, for a moment and a phase. */
export function prismaIdle(clock = 0, phase = 1, reduced = false): PrismaPose {
  const t = reduced ? 0 : clock,
    m = reduced ? 0 : 1;
  return {
    clock: t,
    motion: m,
    bob: Math.sin(t * 1.8) * 1.5 * m,
    fan: 0.74 + Math.sin(t * 0.9) * 0.03 * m,
    wing: 0,
    neckFwd: 0,
    neckUp: 0,
    rear: 0,
    headYaw: (Math.sin(t * 0.7) * 0.2 + Math.sin(t * 1.9) * 0.05) * m,
    headPitch: Math.sin(t * 1.2) * 0.06 * m,
    headRoll: Math.sin(t * 0.9 + 1) * 0.06 * m,
    look: "idle",
    mouth: "closed",
    blink: !!m && t % 3.9 > 3.78,
    eyeGlow: 0,
    shine: 0.15 + (phase - 1) * 0.2,
    crown: (phase - 1) * 0.25,
    alpha: 1,
    stars: false,
    sink: 0,
    walk: 0,
    exposed: 0,
    dead: false,
    prismHot: -1,
  };
}
/** The pose for the battle's state: windups, casts, a cry, the open heart, a fall. */
export function prismaPose(c: PrismaCue): PrismaPose {
  const P = prismaIdle(c.clock, c.phase, c.reduced);
  const m = P.motion;
  const w = clamp(c.windup || 0),
    kind = c.windKind,
    age = c.castAge;
  // with reduced motion a cast's follow-through is skipped (windups stay)
  const cast = c.reduced ? undefined : c.castKind;
  const hit = (d: number) => after(age, d);
  P.walk = c.reduced ? 0 : clamp(c.walk ?? 0);
  if (kind) P.look = "glare";
  if (kind === "prism-lance") {
    P.neckFwd = -10 * w;
    P.neckUp = 6 * w;
    P.headPitch += 0.1 * w;
    P.fan = lerp(P.fan, 0.5, w);
  } else if (kind === "fan-display") {
    P.fan = lerp(P.fan, 1.05, w);
    P.wing = 0.5 * w;
    P.neckUp = 8 * w;
    P.headPitch -= 0.15 * w;
    P.look = "idle";
    P.shine = Math.max(P.shine, w);
    P.prismHot = c.prismHot ?? -1;
  } else if (kind === "glare") {
    P.eyeGlow = w;
    P.neckFwd = 8 * w;
    P.headPitch += 0.18 * w;
  } else if (kind === "refraction") {
    P.shine = Math.max(P.shine, w);
    P.headRoll += 0.2 * w;
    P.fan = lerp(P.fan, 0.95, w);
  } else if (kind === "halo-crush") {
    P.crown = Math.max(P.crown, w);
    P.rear = 0.5 * w;
    P.neckUp = 10 * w;
    P.headPitch -= 0.2 * w;
    P.wing = 0.4 * w;
  } else if (kind === "light-relay") {
    P.wing = 0.8 * w;
    P.headYaw += 0.25 * w * m;
    P.shine = Math.max(P.shine, 0.6 * w);
  }
  if (cast === "prism-lance") {
    const a = hit(0.5);
    P.neckFwd = 26 * a;
    P.neckUp = -8 * a;
    P.headPitch += 0.15 * a;
    if (a > 0.05) {
      P.look = "glare";
      P.mouth = "open";
    }
  } else if (cast === "fan-display") {
    const a = hit(0.9);
    P.fan = lerp(P.fan, 1.1, a);
    P.wing = 0.7 * a;
    P.shine = Math.max(P.shine, a);
    if (a > 0.05) {
      P.look = "closed";
      P.mouth = "open";
    }
  } else if (cast === "glare") {
    const a = hit(0.7);
    P.eyeGlow = Math.max(P.eyeGlow, a);
    P.neckFwd = 10 * a;
    if (a > 0.05) P.look = "glare";
  } else if (cast === "refraction") {
    const a = hit(0.7);
    P.shine = Math.max(P.shine, a);
    P.fan = lerp(P.fan, 1, a);
    if (a > 0.05) P.look = "glare";
  } else if (cast === "halo-crush") {
    const a = hit(0.5);
    P.crown = Math.max(P.crown, a);
    P.neckFwd = 14 * a;
    P.neckUp = -12 * a;
    P.headPitch += 0.3 * a;
    if (a > 0.05) {
      P.look = "glare";
      P.mouth = "open";
    }
  } else if (cast === "light-relay") {
    const a = hit(0.7);
    P.wing = 0.9 * a;
    P.shine = Math.max(P.shine, a);
    if (a > 0.05) {
      P.look = "glare";
      P.mouth = "open";
    }
  }
  const roar = c.reduced ? 0 : after(c.roarAge, 1.1);
  if (roar > 0.05) {
    P.fan = lerp(P.fan, 1.1, roar);
    P.wing = 0.7 * roar;
    P.neckUp = 8 * roar;
    P.headPitch -= 0.22 * roar;
    P.look = "glare";
    P.mouth = "open";
  }
  if (c.exposed && !c.stagger && !c.dead) {
    // the heart open: startled, the fan down
    P.look = "wide";
    P.mouth = "open";
    P.fan = 0.3;
    P.neckUp = -6;
    P.exposed = 1;
  }
  if (c.stagger && !c.dead) {
    P.look = "dizzy";
    P.mouth = "open";
    P.stars = true;
    P.headRoll = m ? Math.sin(c.clock * 3) * 0.32 : 0.2;
    P.headYaw = 0;
    P.neckUp = -12;
    P.neckFwd = 6;
    P.fan = 0.3;
    P.blink = false;
    P.exposed = 1;
  }
  if (c.hurt > 0.3 && !c.dead && !c.reduced) {
    P.look = "hurt";
    P.mouth = "open";
    P.neckFwd -= 8 * c.hurt;
    P.headRoll += 0.16 * c.hurt;
    P.blink = false;
  }
  if (c.dead) {
    const d = c.reduced ? 1 : smooth(0, 0.9, c.deadAge);
    P.dead = true;
    P.sink = d;
    P.fan = lerp(P.fan, 0.15, d);
    P.neckUp = -40 * d;
    P.neckFwd = 16 * d;
    P.headRoll = 0.4 * d;
    P.headYaw = 0;
    P.headPitch = 0.25 * d;
    P.look = "closed";
    P.mouth = "closed";
    P.blink = false;
    P.shine = 0.03;
    P.crown = 0;
    P.bob = 0;
    P.walk = 0;
    P.wing = 0;
    P.eyeGlow = 0;
    P.exposed = 0;
    // it fades to a dim crystal husk
    P.alpha = c.reduced
      ? 0.25
      : Math.max(0.25, 1 - Math.max(0, c.deadAge - 0.9) * 0.35);
  }
  return P;
}

/** The facing shown (eight ways, with hysteresis) and the turn towards it. */
export function prismaTurn(
  angle: number,
  previous: number | undefined,
  yaw: number,
  dt: number,
  snap: boolean,
) {
  const facing = nextFacing(angle, previous);
  const target = (facing * Math.PI) / 4;
  return { facing, yaw: snap ? target : turnToward(yaw, target, dt) };
}

// ───────────────────────── palettes ─────────────────────────
interface Soft {
  edge: string;
  light: string;
  base: string;
  dark: string;
  rim: string;
}
export interface PrismaPalette {
  cream: Soft;
  teal: [string, string, string];
  tealEdge: string;
  gold: [string, string, string];
  ink: string;
  iris: [string, string, string];
  brow: string;
}
export const PRISMA: Record<Phase, PrismaPalette> = {
  1: {
    cream: {
      edge: "#8a6a3a",
      light: "#fffdf2",
      base: "#fbedcc",
      dark: "#e6c994",
      rim: "#ffffff",
    },
    teal: ["#7fe6d6", "#22b3a6", "#0f7f86"],
    tealEdge: "#0b4f5c",
    gold: ["#fff0a0", "#f4c234", "#c98a14"],
    ink: "#101826",
    iris: ["#0f8f8f", "#2fd0c4", "#a8fff0"],
    brow: "#0f6f76",
  },
  2: {
    cream: {
      edge: "#8a6a3a",
      light: "#ffffff",
      base: "#fdf1d6",
      dark: "#ecd2a0",
      rim: "#ffffff",
    },
    teal: ["#8ff0e6", "#22c0c0", "#0d8292"],
    tealEdge: "#0a4a60",
    gold: ["#fff4b0", "#f8cc40", "#d09218"],
    ink: "#101826",
    iris: ["#0f9aa0", "#40dcd4", "#c0fff6"],
    brow: "#0d6a7a",
  },
  3: {
    cream: {
      edge: "#8a6a3a",
      light: "#ffffff",
      base: "#fff2dc",
      dark: "#f0d4a8",
      rim: "#ffffff",
    },
    teal: ["#a0f6f0", "#28c8d4", "#0e80a0"],
    tealEdge: "#0a4468",
    gold: ["#fff8c0", "#ffd650", "#d89a1c"],
    ink: "#101826",
    iris: ["#10a0b0", "#50e6e0", "#d6fffa"],
    brow: "#0c6480",
  },
};
/** The train's shine, in Fan Display's colours when it lights one. */
const SHINE = 0xaae1ff;

// ───────────────────────── the drawn pieces ─────────────────────────
type Ctx = CanvasRenderingContext2D;
export interface Piece {
  name: string;
  /** Size in rig units, and the anchor (0–1) its placement point sits on. */
  w: number;
  h: number;
  ox: number;
  oy: number;
  draw: (ctx: Ctx, k: number) => void; // drawn with (0,0) at the top-left, k px per unit
}
/** A piece drawn about its anchor, in rig units. */
const pieceOf = (
  name: string,
  w: number,
  h: number,
  ox: number,
  oy: number,
  fn: (c: Ctx) => void,
): Piece => ({
  name,
  w,
  h,
  ox,
  oy,
  draw: (ctx, k) => {
    ctx.save();
    ctx.scale(k, k);
    ctx.translate(ox * w, oy * h);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    fn(ctx);
    ctx.restore();
  },
});
type Stop = string | [number, string];
const stopsOn = (g: CanvasGradient, stops: Stop[]) =>
  stops.forEach((s, i) =>
    Array.isArray(s)
      ? g.addColorStop(s[0], s[1])
      : g.addColorStop(i / Math.max(1, stops.length - 1), s),
  );
const grad = (
  c: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: Stop[],
) => {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  stopsOn(g, stops);
  return g;
};
const radial = (
  c: Ctx,
  x: number,
  y: number,
  r0: number,
  r1: number,
  stops: Stop[],
) => {
  const g = c.createRadialGradient(x, y, r0, x, y, r1);
  stopsOn(g, stops);
  return g;
};
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
/** A curved tuft (feather): base at (x, y), tip `len` along `ang`. */
function tuft(
  path: Path2D,
  x: number,
  y: number,
  ang: number,
  len: number,
  w: number,
  bend = 0.25,
) {
  const dx = Math.cos(ang),
    dy = Math.sin(ang),
    nx = -dy,
    ny = dx;
  const tx = x + dx * len + nx * len * bend,
    ty = y + dy * len + ny * len * bend;
  path.moveTo(x - nx * w, y - ny * w);
  path.quadraticCurveTo(
    x + dx * len * 0.55 - nx * w * 0.9,
    y + dy * len * 0.55 - ny * w * 0.9,
    tx,
    ty,
  );
  path.quadraticCurveTo(
    x + dx * len * 0.5 + nx * w * 1.1,
    y + dy * len * 0.5 + ny * w * 1.1,
    x + nx * w,
    y + ny * w,
  );
  path.closePath();
}
/** A closed outline with a fringe of little points along it (down, feathers). */
function furPath(
  path: Path2D,
  pts: { x: number; y: number }[],
  o: {
    seed: number;
    tooth: number;
    depth: number;
    mask?: (x: number, y: number) => number;
  },
) {
  const rnd = rng(o.seed);
  const out: { x: number; y: number }[] = [];
  const step = 0.3;
  let acc = 0,
    tooth = 0,
    amp = 1;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i],
      b = pts[(i + 1) % pts.length];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const nx = (b.y - a.y) / (d || 1),
      ny = -(b.x - a.x) / (d || 1);
    for (let s = 0; s < d; s += step) {
      const x = a.x + ((b.x - a.x) * s) / d,
        y = a.y + ((b.y - a.y) * s) / d;
      acc += step;
      if (acc > tooth) {
        acc = 0;
        tooth = o.tooth * (0.7 + rnd() * 0.7);
        amp = 0.5 + rnd() * 0.7;
      }
      const f = acc / tooth;
      const prof = f < 0.72 ? f / 0.72 : (1 - f) / 0.28;
      const m = o.mask ? o.mask(x, y) : 1;
      const off = o.depth * amp * m * (prof - 0.45);
      out.push({ x: x + nx * off, y: y + ny * off });
    }
  }
  out.forEach((p, i) => (i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y)));
  path.closePath();
}
/** Outline, fill, then light a soft shape from above; optional strands inside. */
function paintSoft(
  c: Ctx,
  path: Path2D,
  pal: Soft,
  top: number,
  bot: number,
  o: {
    edge?: number;
    rimAlpha?: number;
    strands?: number;
    x0?: number;
    x1?: number;
    seed?: number;
    inside?: (c: Ctx) => void;
  } = {},
) {
  c.strokeStyle = pal.edge;
  c.lineWidth = o.edge ?? 2;
  c.stroke(path);
  c.fillStyle = grad(c, 0, top, 0, bot, [
    [0, pal.light],
    [0.42, pal.base],
    [1, pal.dark],
  ]);
  c.fill(path);
  c.save();
  c.clip(path);
  const h = bot - top;
  c.strokeStyle = grad(c, 0, top, 0, top + h * 0.45, [pal.rim, pal.rim + "00"]);
  c.globalAlpha = o.rimAlpha ?? 0.75;
  c.lineWidth = (o.edge ?? 2) + 2.4;
  c.stroke(path);
  if (o.strands) {
    const rnd = rng(o.seed ?? 7);
    for (let i = 0; i < o.strands; i++) {
      const x = lerp(o.x0 ?? -10, o.x1 ?? 10, rnd()),
        y = lerp(top, bot, rnd());
      const a = Math.PI / 2 + (rnd() - 0.5) * 0.9,
        l = 2.5 + rnd() * 3;
      c.strokeStyle = (y - top) / h < 0.45 ? pal.light : pal.dark;
      c.globalAlpha = 0.35;
      c.lineWidth = 0.7;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(
        x + Math.cos(a) * l * 0.5 + 0.8,
        y + Math.sin(a) * l * 0.5,
        x + Math.cos(a) * l,
        y + Math.sin(a) * l,
      );
      c.stroke();
    }
  }
  if (o.inside) {
    c.globalAlpha = 1;
    o.inside(c);
  }
  c.restore();
  c.globalAlpha = 1;
}
/** A brow: a tapered stroke, inner end at +x. */
function drawBrow(
  c: Ctx,
  L: number,
  s: number[],
  color: string,
  alpha: number,
) {
  c.globalAlpha = alpha;
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(-L, s[0]);
  c.quadraticCurveTo(0, s[1] - s[3] * 0.5, L, s[2] - s[3] * 0.4);
  c.lineTo(L, s[2] + s[3] * 0.5);
  c.quadraticCurveTo(0, s[1] + s[3] * 0.6, -L, s[0] + 0.25);
  c.closePath();
  c.fill();
  c.globalAlpha = 1;
}
export const PIECE = { glow: 44, leg: 20, wing: 56, shard: 100, neck: 7.6 };

function headPiece(view: FaceView, pal: PrismaPalette) {
  return pieceOf(`head_${view}`, 3.4 * A, 3.2 * A, 0.5, 0.56, (c) => {
    const faceSide = view === "front" || view === "tq" || view === "side";
    // a short teal crest swept back from the nape, behind the skull
    const crest = new Path2D();
    const F = (
      x: number,
      y: number,
      deg: number,
      len: number,
      w: number,
      bend: number,
    ) => tuft(crest, x * A, y * A, deg * DEG, len * A, w * A, bend);
    if (view === "front" || view === "back")
      for (const s of [-1, 1])
        F(s * 0.3, -0.7, -90 - s * 34, 0.34, 0.1, -s * 0.2);
    else {
      F(-0.5, -0.6, 205, 0.58, 0.13, 0.22);
      F(-0.72, -0.32, 190, 0.5, 0.12, 0.2);
      F(-0.8, 0.0, 178, 0.36, 0.1, 0.18);
    }
    c.strokeStyle = pal.tealEdge;
    c.lineWidth = 1.3;
    c.stroke(crest);
    c.fillStyle = grad(c, 0, -1.2 * A, 0, 0.4 * A, pal.teal);
    c.fill(crest);
    const pts: { x: number; y: number }[] = [];
    for (let v = TOP; v <= BOT; v += 0.5)
      pts.push({ x: prismaSkull(view, v)[1], y: v });
    for (let v = BOT; v >= TOP; v -= 0.5)
      pts.push({ x: prismaSkull(view, v)[0], y: v });
    const path = new Path2D();
    // smooth feathers: only the faintest fringe, none along the brow and beak base
    furPath(path, pts, {
      seed: 3 + view.length,
      tooth: 4,
      depth: 0.25,
      mask: (x) => ((view === "side" || view === "tq") && x > 0 ? 0 : 1),
    });
    paintSoft(c, path, pal.cream, TOP - 2, BOT + 4, {
      edge: 1.4,
      rimAlpha: 0.5,
      inside: (cc) => {
        // the teal cap over the crown, running down the back of the head into the neck
        const cap = (x: number, y: number, rx: number, ry: number) => {
          cc.save();
          cc.translate(x, y);
          cc.fillStyle = radial(cc, 0, 0, 0, rx, [
            [0, pal.teal[0]],
            [0.72, pal.teal[1]],
            [1, pal.teal[1] + "00"],
          ]);
          cc.scale(1, ry / rx);
          cc.beginPath();
          cc.arc(0, 0, rx, 0, TAU);
          cc.fill();
          cc.restore();
        };
        if (!faceSide) {
          cap(0, -0.3 * A, 1.0 * A, 1.1 * A);
          return;
        }
        if (view === "front") cap(0, -0.96 * A, 0.95 * A, 0.6 * A);
        else if (view === "tq") {
          cap(-0.36 * A, -0.92 * A, 0.95 * A, 0.6 * A);
          cap(-1.0 * A, -0.1 * A, 0.55 * A, 0.95 * A);
        } else {
          cap(-0.42 * A, -0.92 * A, 0.95 * A, 0.6 * A);
          cap(-0.95 * A, -0.1 * A, 0.6 * A, 1.0 * A);
        }
        // a fine liner of feathers from the eye back towards the nape (as in the art)
        if (view !== "front") {
          cc.strokeStyle = pal.teal[2];
          cc.globalAlpha = 0.5;
          cc.lineWidth = 0.8;
          cc.beginPath();
          cc.moveTo(-0.1 * A, LINES.eye + 0.5);
          cc.quadraticCurveTo(
            -0.45 * A,
            LINES.eye - 0.5,
            -0.7 * A,
            LINES.eye + 1.5,
          );
          cc.stroke();
          cc.globalAlpha = 1;
        }
      },
    });
  });
}
function eyePiece(view: EyeView, look: PrismaLook, pal: PrismaPalette) {
  return pieceOf(`eye_${view}_${look}`, 20, 18, 0.5, 0.5, (c) => {
    const { hw, hh } = EYE[view],
      g = eyeGeom(view, look),
      face = view === "far" ? -1 : 1;
    // drawn with the inner corner at +x; the far eye's inner corner faces the beak
    if (view === "far") c.scale(-1, 1);
    if (look === "hurt") {
      c.strokeStyle = pal.ink;
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(-hw * 0.8, -hh * 0.6);
      c.lineTo(hw * 0.72, 0.3);
      c.lineTo(-hw * 0.8, hh * 0.64);
      c.stroke();
      return;
    }
    drawEye(c, {
      hw,
      hh,
      ink: pal.ink,
      weight: 1.5,
      look: look === "dizzy" || look === "closed" ? look : "open",
      lid:
        look === "idle"
          ? [-0.55, -0.25]
          : look === "glare"
            ? [-0.45, 0.2]
            : undefined,
      bow: look === "glare" ? 0.35 : 0.7,
      sclera: ["#ffffff", "#f2fbff", "#cfe6ee"],
      shade: "rgba(20,90,110,0.45)",
      spiral: "#0f7f86",
      iris: {
        x: g.gx * face,
        y: g.gy,
        r: g.r,
        ring: "#0a4a56",
        stops: pal.iris,
        pupil: "#06181e",
      },
    });
  });
}
function beakPiece(view: "front" | "tq" | "side", open: boolean) {
  return pieceOf(
    `beak_${view}_${open ? "open" : "closed"}`,
    1.8 * A,
    1.5 * A,
    0.36,
    0.3,
    (c) => {
      const a = A,
        drop = open ? 0.2 * a : 0;
      c.strokeStyle = "#7a4a06";
      c.lineWidth = 0.95;
      const part = (pts: () => void) => {
        c.beginPath();
        pts();
        c.closePath();
        c.fillStyle = grad(c, 0, -0.2 * a, 0, 0.4 * a, [
          "#ffe39a",
          "#f6a92e",
          "#d0701a",
        ]);
        c.fill();
        c.stroke();
      };
      const mouth = (pts: () => void) => {
        c.beginPath();
        pts();
        c.closePath();
        c.fillStyle = "#a02c3c";
        c.fill();
        c.stroke();
      };
      if (view === "front") {
        if (open)
          mouth(() => {
            c.moveTo(-0.15 * a, 0);
            c.lineTo(0.15 * a, 0);
            c.lineTo(0.07 * a, 0.42 * a);
            c.lineTo(-0.07 * a, 0.42 * a);
          });
        part(() => {
          c.moveTo(-0.1 * a, 0.18 * a + drop);
          c.quadraticCurveTo(0, 0.22 * a + drop, 0.1 * a, 0.18 * a + drop);
          c.quadraticCurveTo(0.04 * a, 0.3 * a + drop, 0, 0.32 * a + drop);
          c.quadraticCurveTo(
            -0.04 * a,
            0.3 * a + drop,
            -0.1 * a,
            0.18 * a + drop,
          );
        });
        part(() => {
          c.moveTo(-0.17 * a, -0.14 * a);
          c.quadraticCurveTo(0, -0.24 * a, 0.17 * a, -0.14 * a);
          c.quadraticCurveTo(0.12 * a, 0.16 * a, 0, 0.36 * a);
          c.quadraticCurveTo(-0.12 * a, 0.16 * a, -0.17 * a, -0.14 * a);
        });
        c.strokeStyle = "rgba(255,252,220,0.9)";
        c.beginPath();
        c.moveTo(0, -0.14 * a);
        c.lineTo(0, 0.2 * a);
        c.stroke();
        return;
      }
      // short and strong, the upper mandible arching over into a small hook
      const L = view === "side" ? 0.62 * a : 0.46 * a,
        b = view === "side" ? -0.06 * a : -0.16 * a,
        d = 0.17 * a;
      if (open)
        mouth(() => {
          c.moveTo(b, 0.02 * a);
          c.lineTo(b + L * 0.8, 0.12 * a);
          c.lineTo(b + L * 0.6, 0.18 * a + drop);
          c.lineTo(b, 0.16 * a + drop * 0.6);
        });
      part(() => {
        c.moveTo(b, 0.1 * a + drop * 0.5);
        c.quadraticCurveTo(
          b + L * 0.45,
          0.13 * a + drop,
          b + L * 0.7,
          0.16 * a + drop * 1.1,
        );
        c.quadraticCurveTo(
          b + L * 0.4,
          0.24 * a + drop,
          b - 0.02 * a,
          0.22 * a + drop * 0.6,
        );
      });
      part(() => {
        c.moveTo(b, -0.16 * a);
        c.bezierCurveTo(
          b + L * 0.5,
          -0.2 * a,
          b + L * 0.95,
          -0.08 * a,
          b + L,
          d,
        );
        c.quadraticCurveTo(b + L * 0.86, d * 0.82, b + L * 0.78, 0.12 * a);
        c.quadraticCurveTo(b + L * 0.4, 0.11 * a, b, 0.11 * a);
      });
      c.strokeStyle = "rgba(255,248,210,0.85)";
      c.beginPath();
      c.moveTo(b + 1.2, -0.11 * a);
      c.quadraticCurveTo(b + L * 0.55, -0.13 * a, b + L * 0.85, -0.01 * a);
      c.stroke();
      c.fillStyle = "#7a4a06";
      c.beginPath();
      c.arc(b + L * 0.28, -0.05 * a, 0.55, 0, TAU);
      c.fill();
    },
  );
}
const SHARD_COLOURS = [
  ["#bff6ff", "#6fb6ff", "#5a7cf2", "#b9a0ff"],
  ["#ffe6fb", "#d7a8ff", "#8f8cf6", "#7fd8ff"],
  ["#fffbd0", "#ffd65a", "#f2a83a", "#ffe9a0"],
];
/** A crystal: a long faceted shard along +x, in a gold setting. */
function shardPiece(i: number) {
  return pieceOf(`shard${i}`, 124, 40, 0.06, 0.5, (c) => {
    const p = new Path2D();
    p.moveTo(0, 0);
    p.lineTo(22, -12);
    p.lineTo(82, -15);
    p.lineTo(108, 0);
    p.lineTo(82, 15);
    p.lineTo(22, 12);
    p.closePath();
    c.strokeStyle = "#b9861a";
    c.lineWidth = 3.2;
    c.stroke(p);
    c.fillStyle = grad(c, 0, 0, 108, 0, SHARD_COLOURS[i]);
    c.fill(p);
    c.save();
    c.clip(p);
    c.fillStyle = "rgba(255,255,255,0.55)"; // facets
    c.beginPath();
    c.moveTo(22, -12);
    c.lineTo(82, -15);
    c.lineTo(108, 0);
    c.lineTo(52, -3);
    c.closePath();
    c.fill();
    c.fillStyle = "rgba(40,40,140,0.18)";
    c.beginPath();
    c.moveTo(22, 12);
    c.lineTo(82, 15);
    c.lineTo(108, 0);
    c.lineTo(52, 3);
    c.closePath();
    c.fill();
    c.strokeStyle = "rgba(255,255,255,0.85)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(4, 0);
    c.lineTo(52, -3);
    c.lineTo(108, 0);
    c.moveTo(52, -3);
    c.lineTo(82, -15);
    c.moveTo(52, 3);
    c.lineTo(82, 15);
    c.moveTo(52, -3);
    c.lineTo(52, 3);
    c.stroke();
    c.restore();
    c.strokeStyle = "#ffe9a0";
    c.lineWidth = 1;
    c.stroke(p);
  });
}
/** Every piece the rig draws in a phase. */
export function prismaPieces(phase: Phase): Piece[] {
  const pal = PRISMA[phase];
  const list: Piece[] = [];
  for (const v of ["front", "tq", "side", "backtq", "back"] as FaceView[])
    list.push(headPiece(v, pal));
  for (const v of ["front", "near", "far", "side"] as EyeView[]) {
    for (const l of PRISMA_LOOKS) list.push(eyePiece(v, l, pal));
    for (const k of Object.keys(BROWS) as BrowKind[])
      list.push(
        pieceOf(`brow_${v}_${k}`, 12, 8, 0.5, 0.5, (c) => {
          if (v === "far") c.scale(-1, 1);
          const s = BROWS[k];
          drawBrow(
            c,
            { front: 5, near: 5, far: 3.4, side: 4.6 }[v] / 2,
            [s[0] * 0.55, s[1] * 0.55, s[2] * 0.5, s[3] * 0.6],
            pal.brow,
            Math.min(0.7, s[4] * 0.8 + 0.1),
          );
        }),
      );
  }
  for (const v of ["front", "tq", "side"] as const)
    list.push(beakPiece(v, false), beakPiece(v, true));
  for (let i = 0; i < 3; i++) list.push(shardPiece(i));
  const disc = (r: number) => {
    const p = new Path2D();
    p.ellipse(0, 0, r, r, 0, 0, TAU);
    return p;
  };
  list.push(
    pieceOf("crown", 34, 34, 0.5, 0.94, (c) => {
      const gem = (x: number, y: number, h: number, w: number) => {
        c.strokeStyle = pal.gold[1];
        c.lineWidth = 2.2;
        c.beginPath();
        c.moveTo(0, -3);
        c.lineTo(x, y + h * 0.4);
        c.stroke();
        c.beginPath();
        c.moveTo(x, y - h);
        c.lineTo(x + w, y);
        c.lineTo(x, y + h * 0.6);
        c.lineTo(x - w, y);
        c.closePath();
        c.fillStyle = grad(c, x - w, y - h, x + w, y + h, [
          "#f2fdff",
          "#8fd0ff",
          "#5a8cf0",
        ]);
        c.fill();
        c.strokeStyle = pal.gold[1];
        c.lineWidth = 1.5;
        c.stroke();
        c.strokeStyle = "rgba(255,255,255,0.9)";
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(x, y - h);
        c.lineTo(x, y + h * 0.6);
        c.stroke();
      };
      gem(-9, -16, 6, 3.4);
      gem(9, -16, 6, 3.4);
      gem(0, -22, 8.5, 4.4);
      c.beginPath();
      c.moveTo(-7, 0);
      c.lineTo(-5.5, -7);
      c.lineTo(0, -4.5);
      c.lineTo(5.5, -7);
      c.lineTo(7, 0);
      c.closePath();
      c.fillStyle = grad(c, 0, -7, 0, 0, pal.gold);
      c.fill();
      c.strokeStyle = "#8a5a0a";
      c.lineWidth = 1;
      c.stroke();
    }),
    pieceOf("neck_f", 20, 20, 0.5, 0.5, (c) => {
      c.fillStyle = pal.cream.base;
      c.fill(disc(PIECE.neck));
    }),
    pieceOf("neck_e", 22, 22, 0.5, 0.5, (c) => {
      c.fillStyle = pal.cream.edge;
      c.fill(disc(9));
    }),
    pieceOf("body", 76, 76, 0.5, 0.5, (c) => {
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * TAU;
        pts.push({ x: Math.cos(a) * 27, y: Math.sin(a) * 28 });
      }
      const path = new Path2D();
      furPath(path, pts, {
        seed: 8,
        tooth: 7,
        depth: 2.2,
        mask: (_x, y) => (y > 0 ? 1 : 0.3),
      });
      paintSoft(c, path, pal.cream, -29, 30, {
        edge: 1.8,
        strands: 40,
        x0: -24,
        x1: 24,
        seed: 12,
      });
    }),
    pieceOf("brooch", 22, 28, 0.5, 0.5, (c) => {
      c.beginPath();
      c.moveTo(0, -11);
      c.lineTo(8, 0);
      c.lineTo(0, 12);
      c.lineTo(-8, 0);
      c.closePath();
      c.fillStyle = grad(c, -8, -11, 8, 12, ["#f2fdff", "#7fc4ff", "#4a7cec"]);
      c.fill();
      c.strokeStyle = pal.gold[1];
      c.lineWidth = 2.4;
      c.stroke();
      c.strokeStyle = "rgba(255,255,255,0.9)";
      c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(0, -11);
      c.lineTo(0, 12);
      c.moveTo(-8, 0);
      c.lineTo(8, 0);
      c.stroke();
    }),
    pieceOf("wing", 78, 56, 0.08, 0.32, (c) => {
      // layered feathers along +x: teal primaries tipped gold, teal secondaries, cream coverts
      const rows: [number, number, string[], string][] = [
        [1, 20, [pal.teal[1], pal.teal[2], pal.gold[1]], pal.tealEdge],
        [0.74, 16, [pal.teal[0], pal.teal[1], pal.teal[2]], pal.tealEdge],
        [
          0.46,
          13,
          [pal.cream.light, pal.cream.base, pal.cream.dark],
          pal.cream.edge,
        ],
      ];
      for (const [reach, len, cols, edge] of rows) {
        const path = new Path2D();
        for (let i = 0; i < 7; i++) {
          const u = (i + 0.5) / 7;
          tuft(
            path,
            u * 56 * reach,
            0,
            lerp(1.2, 0.3, u),
            len * lerp(0.8, 1.2, u),
            len * 0.3,
            0.12,
          );
        }
        path.moveTo(0, -7);
        path.quadraticCurveTo(28 * reach, -10, 56 * reach, 0);
        path.lineTo(0, 6);
        path.closePath();
        c.strokeStyle = edge;
        c.lineWidth = 1.3;
        c.stroke(path);
        c.fillStyle = grad(c, 0, -8, 0, len * 1.2, cols);
        c.fill(path);
      }
    }),
    // a long gold shin, from the hip (anchor) along +x to the foot
    pieceOf("leg", PIECE.leg + 4, 6, 2 / (PIECE.leg + 4), 0.5, (c) => {
      c.strokeStyle = "#7a4a06";
      c.lineWidth = 4.2;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(PIECE.leg, 0);
      c.stroke();
      c.strokeStyle = "#f2b52a";
      c.lineWidth = 2.4;
      c.stroke();
    }),
    pieceOf("foot", 28, 14, 0.5, 0.3, (c) => {
      for (const [dx, dy] of [
        [-10, 5],
        [0, 7],
        [10, 5],
      ]) {
        c.strokeStyle = "#7a4a06";
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(dx, dy);
        c.stroke();
        c.strokeStyle = "#f2b52a";
        c.lineWidth = 2.4;
        c.stroke();
      }
    }),
    // white, so the rig can tint it (the train's shine, Fan Display's colours)
    pieceOf("glow", PIECE.glow, PIECE.glow, 0.5, 0.5, (c) => {
      const s = PIECE.glow;
      c.fillStyle = radial(c, 0, 0, 0, s / 2, [
        [0, "rgba(255,255,255,0.85)"],
        [0.35, "rgba(255,255,255,0.34)"],
        [1, "rgba(255,255,255,0)"],
      ]);
      c.fillRect(-s / 2, -s / 2, s, s);
    }),
    // the highlight on an iris: one drawing for both eyes, never mirrored
    pieceOf("glint", 3, 3, 0.5, 0.5, (c) => {
      c.scale(0.31, 0.31);
      c.fillStyle = "#fff";
      c.beginPath();
      c.arc(-1.4, -1.8, 1.25, 0, TAU);
      c.fill();
      c.globalAlpha = 0.85;
      c.beginPath();
      c.arc(1.6, 1.5, 0.58, 0, TAU);
      c.fill();
    }),
    pieceOf("star", 12, 12, 0.5, 0.5, (c) => {
      c.fillStyle = "#fff1a0";
      c.strokeStyle = "#a8781a";
      c.lineWidth = 0.6;
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU - Math.PI / 2,
          r = i % 2 ? 2 : 4.6;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
      c.stroke();
    }),
  );
  return list;
}

// ───────────────────────── where each piece goes this frame ─────────────────────────
export interface Placement {
  /** One image per key, reused frame to frame. */
  key: string;
  piece: string;
  x: number;
  y: number;
  rot: number;
  sx: number;
  sy: number;
  alpha: number;
  /** Sort order: back to front. */
  z: number;
  /** Additive glow (its own layer). */
  glow?: boolean;
  tint?: number;
}
/** A long piece laid from 3D point a towards b: its rotation and stretch. */
function along(a: V3, b: V3, nominal: number, min = 0.5, max = 1.12) {
  const sa = prismaProject(a),
    sb = prismaProject(b);
  const len = Math.hypot(sb.x - sa.x, sb.y - sa.y),
    rot = Math.atan2(sb.y - sa.y, sb.x - sa.x);
  return {
    rot,
    sx: clamp(len / nominal, min, max),
    sy: Math.cos(rot) < 0 ? -1 : 1,
  };
}
export const SHARDS = 9;
/** Of the train's shards, these carry a shine (kept few: glows are drawn per pixel). */
const SHINES = [0, 2, 4, 6, 8];

/**
 * Where every piece goes this frame for a pose and a body yaw (0 faces the
 * camera). `prevView` is the head drawing shown last frame (it holds a view
 * near a line, so a swaying head never flickers between two).
 */
export function prismaPlacements(
  P: PrismaPose,
  yaw: number,
  phase: Phase,
  prevView?: FaceView,
) {
  void phase;
  const out: Placement[] = [];
  const add = (
    key: string,
    piece: string,
    w: V3,
    o: {
      rot?: number;
      sx?: number;
      sy?: number;
      alpha?: number;
      bias?: number;
      glow?: boolean;
      tint?: number;
    } = {},
  ) => {
    const s = prismaProject(w);
    out.push({
      key,
      piece,
      x: s.x,
      y: s.y,
      rot: o.rot ?? 0,
      sx: o.sx ?? 1,
      sy: o.sy ?? 1,
      alpha: (o.alpha ?? 1) * P.alpha,
      z: depth(w) + (o.bias ?? 0),
      glow: o.glow,
      tint: o.tint,
    });
  };
  const t = P.clock;
  const base = 58 + P.bob - P.sink * 30;
  // rear up about the hips, then turn
  const pose = (p: V3) => {
    const c = Math.cos(P.rear * 0.5),
      s = Math.sin(P.rear * 0.5);
    const dz = p.z + 10,
      dy = p.y + 14;
    return rotY(
      { x: p.x, y: base - 14 + dz * s + dy * c, z: -10 + dz * c - dy * s },
      yaw,
    );
  };
  const body = pose({ x: 0, y: 0, z: 0 });
  add("body", "body", body);
  const heart = pose({ x: 0, y: 2, z: 25 });
  add("brooch", "brooch", heart, { bias: 3 });
  // the fan: shards radiating behind the body, leaning back
  const root = pose({ x: 0, y: 4, z: -20 });
  for (let i = 0; i < SHARDS; i++) {
    const u = i / (SHARDS - 1) - 0.5;
    const a = u * 2 * 104 * DEG * clamp(P.fan, 0.1, 1.15);
    const L = 104 - Math.abs(u) * 30;
    const tip = pose({
      x: Math.sin(a) * L,
      y: 4 + Math.cos(a) * L * 0.92,
      z: -20 - 34 - (1 - P.fan) * 30,
    });
    const o = along(root, tip, PIECE.shard, 0.34, 1.12);
    add(`shard${i}`, `shard${i % 3}`, root, { ...o, bias: -8 - Math.abs(u) });
    if (P.shine > 0.05 && SHINES.includes(i)) {
      // Fan Display lights the safe colour; otherwise a cool shimmer runs along it
      const hot = P.prismHot >= 0;
      const lit = hot && i / 2 === P.prismHot % 5;
      add(
        `shine${i}`,
        "glow",
        {
          x: (root.x + tip.x * 2) / 3,
          y: (root.y + tip.y * 2) / 3,
          z: (root.z + tip.z * 2) / 3,
        },
        {
          glow: true,
          alpha:
            P.shine *
            (hot ? (lit ? 0.95 : 0.3) : 0.4 + 0.3 * Math.sin(t * 5 + i)),
          sx: lit ? 1.6 : 1.3,
          sy: lit ? 1.6 : 1.3,
          bias: -7,
          tint: hot ? PRISM_COLORS[P.prismHot % PRISM_COLORS.length] : SHINE,
        },
      );
    }
  }
  // wings: folded along the flank, or lifted out to the side
  for (const s of [-1, 1]) {
    const sh = pose({ x: s * 20, y: 8, z: 2 });
    const k = P.wing;
    const tip = pose({
      x: s * lerp(27, 84, k),
      y: 8 + lerp(-22, 26, k),
      z: 2 + lerp(-44, -14, k),
    });
    add(`wing${s}`, "wing", sh, {
      ...along(sh, tip, PIECE.wing, 0.5, 1.5),
      bias: 1.2,
    });
  }
  // legs: standing on the floor; a stately strut when it walks
  for (const s of [-1, 1]) {
    const step = Math.sin(t * 7 + (s > 0 ? 0 : Math.PI)) * P.walk;
    const hip = pose({ x: s * 10, y: -18, z: -2 });
    const foot = rotY(
      { x: s * 11, y: Math.max(0, step) * 4, z: 2 + step * 7 },
      yaw,
    );
    add(`leg${s}`, "leg", hip, {
      ...along(hip, foot, PIECE.leg, 0.3, 3),
      sy: 1,
      bias: -3,
    });
    add(`foot${s}`, "foot", foot, {
      sx: Math.cos(yaw) < 0 ? -1 : 1,
      bias: depth(hip) - 2.8 - depth(foot),
    });
  }
  // the neck: an S from the breast up to the head
  const n0 = { y: 14, z: 16 },
    n2 = { y: 66 + P.neckUp, z: 24 + P.neckFwd },
    n1 = { y: 46 + P.neckUp * 0.4, z: 0 + P.neckFwd * 0.2 },
    n15 = { y: 70 + P.neckUp, z: 6 + P.neckFwd * 0.6 };
  const bez = (u: number) => {
    const q = 1 - u;
    const f = (k: "y" | "z") =>
      q * q * q * n0[k] +
      3 * q * q * u * n1[k] +
      3 * q * u * u * n15[k] +
      u * u * u * n2[k];
    return pose({ x: 0, y: f("y"), z: f("z") });
  };
  const neck: V3[] = [];
  for (let i = 0; i <= 9; i++) neck.push(bez(i / 9.6));
  const headW = bez(1);
  const hs = prismaProject(headW),
    hz = depth(headW) + 8;
  const back = Math.min(...neck.map(depth)) - 0.5;
  neck.forEach((w, i) => {
    const k = lerp(1.25, 0.74, Math.pow(i / 9, 1.3));
    add(`neck${i}`, "neck_f", w, {
      sx: k,
      sy: k,
      bias: Math.min(0, hz - 1 - depth(w)),
    });
    add(`necke${i}`, "neck_e", w, { sx: k, sy: k, bias: back - depth(w) });
  });
  const look: PrismaLook = P.blink && P.look === "idle" ? "closed" : P.look;
  const built = PRISMA_FACE.face(
    {
      x: hs.x,
      y: hs.y,
      z: hz,
      yaw: yaw + P.headYaw,
      pitch: P.headPitch,
      roll: P.headRoll,
      prevView,
    },
    { look, mouth: P.mouth },
  );
  for (const f of built.placements)
    out.push({ ...f, alpha: f.alpha * P.alpha });
  // the eyes burn white in a glare
  if (P.eyeGlow > 0.01 && look === "glare")
    for (const e of built.eyes) {
      const q = built.at(e.u, LINES.eye + built.nod);
      out.push({
        key: `eyeglow${e.id}`,
        piece: "glow",
        x: q.x,
        y: q.y,
        rot: 0,
        sx: 0.32,
        sy: 0.32,
        alpha: P.eyeGlow,
        z: 0,
        glow: true,
        tint: 0xfff6d8,
      });
    }
  // the crown, on the crown of the head
  const cr = Math.cos(P.headRoll),
    sr = Math.sin(P.headRoll),
    cv = TOP + 2;
  const lean = Math.sin(yaw + P.headYaw) * -0.14 * A;
  const cx = hs.x + lean * cr - cv * sr,
    cy = hs.y + lean * sr + cv * cr;
  out.push({
    key: "crown",
    piece: "crown",
    x: cx,
    y: cy,
    rot: P.headRoll,
    sx: 0.78,
    sy: 0.78,
    alpha: P.alpha,
    z: hz + 0.5,
  });
  if (P.crown > 0.02)
    out.push({
      key: "crownglow",
      piece: "glow",
      x: cx,
      y: cy - 12,
      rot: 0,
      sx: 1.1,
      sy: 1.1,
      alpha: P.crown,
      z: 0,
      glow: true,
      tint: SHINE,
    });
  if (P.stars)
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + (i * TAU) / 3;
      out.push({
        key: `star${i}`,
        piece: "star",
        x: hs.x + Math.cos(a) * 20,
        y: hs.y - A * 2.3 + Math.sin(a) * 7,
        rot: a,
        sx: 1,
        sy: 1,
        alpha: 1,
        z: hz + (Math.sin(a) > 0 ? 1 : -1),
      });
    }
  out.sort((p, q) => p.z - q.z);
  const hp = prismaProject(heart),
    bp = prismaProject(body);
  return {
    placements: out,
    view: built.view,
    headScreen: hs,
    heartScreen: hp,
    /** The crystal shield over the heart while it is closed: centre and size. */
    shield: { x: bp.x, y: bp.y - 2, w: 74, h: 86 },
  };
}

// ───────────────────────── the atlas ─────────────────────────
/** Draw the pieces into one canvas (the atlas), returning each piece's spot. */
export function packPrisma(phase: Phase, k: number, only?: Set<string>) {
  const list = prismaPieces(phase)
    .filter((p) => !only || only.has(p.name))
    .map((p) => ({ p, w: Math.ceil(p.w * k + 2), h: Math.ceil(p.h * k + 2) }))
    .sort((a, b) => b.h - a.h);
  const width = 1024,
    gap = 2;
  let x = 0,
    y = 0,
    shelf = 0;
  const spots: { piece: Piece; x: number; y: number; w: number; h: number }[] =
    [];
  for (const it of list) {
    if (x + it.w > width) {
      x = 0;
      y += shelf + gap;
      shelf = 0;
    }
    spots.push({ piece: it.p, x, y, w: it.w, h: it.h });
    x += it.w + gap;
    shelf = Math.max(shelf, it.h);
  }
  return { width, height: Math.ceil(y + shelf), spots };
}
export function paintPrisma(
  ctx: Ctx,
  spots: ReturnType<typeof packPrisma>["spots"],
  k: number,
) {
  for (const s of spots) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(s.x, s.y, s.w, s.h);
    ctx.clip();
    ctx.translate(s.x + 1, s.y + 1);
    s.piece.draw(ctx, k);
    ctx.restore();
  }
}

// ───────────────────────── a whole picture (briefing diagrams) ─────────────────────────
let guideUrls: Partial<Record<"calm" | "exposed", string>> = {};
/**
 * The peacock as an image URL for the briefing diagrams (drawn once per look),
 * in three-quarter view with its fan up; `exposed` opens its heart.
 * Empty without a canvas (outside a browser).
 */
export function prismaGuideImage(exposed = false, paint = true) {
  const width = 340,
    height = 280,
    k = 1,
    cx = 170,
    cy = 250;
  const key = exposed ? "exposed" : "calm";
  const P = prismaIdle(1.3, 1, true);
  if (exposed)
    Object.assign(P, {
      look: "wide",
      mouth: "open",
      fan: 0.3,
      neckUp: -6,
      exposed: 1,
    });
  const placed = prismaPlacements(P, 0.6, 1);
  if (
    paint &&
    !guideUrls[key] &&
    typeof document !== "undefined" &&
    typeof document.createElement === "function"
  ) {
    try {
      const pk = 2;
      // only the pieces this pose uses, on CPU canvases (read back into a PNG anyway)
      const packed = packPrisma(
        1,
        pk,
        new Set(placed.placements.map((q) => q.piece)),
      );
      const sheet = document.createElement("canvas");
      sheet.width = packed.width;
      sheet.height = Math.max(1, packed.height);
      const sctx = sheet.getContext("2d", { willReadFrequently: true });
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (sctx && ctx) {
        paintPrisma(sctx, packed.spots, pk);
        const spot = new Map(packed.spots.map((s) => [s.piece.name, s]));
        for (const p of placed.placements) {
          const s = spot.get(p.piece);
          if (!s) continue;
          const pw = s.piece.w * pk,
            ph = s.piece.h * pk;
          ctx.save();
          ctx.globalAlpha = clamp(p.alpha);
          if (p.glow) ctx.globalCompositeOperation = "lighter";
          ctx.translate(cx + p.x * k, cy + p.y * k);
          ctx.rotate(p.rot);
          ctx.scale((p.sx * k) / pk, (p.sy * k) / pk);
          ctx.drawImage(
            sheet,
            s.x + 1,
            s.y + 1,
            pw,
            ph,
            -s.piece.ox * pw,
            -s.piece.oy * ph,
            pw,
            ph,
          );
          ctx.restore();
        }
        guideUrls[key] = canvas.toDataURL("image/png");
      }
    } catch {
      /* No drawing surface: the diagram shows no picture. */
    }
  }
  // the crop around it (from the pieces' extents), and where the heart sits
  const size = new Map(
    prismaPieces(1).map((q) => [q.name, Math.max(q.w, q.h)]),
  );
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const q of placed.placements) {
    if (q.glow) continue;
    const r =
      ((size.get(q.piece) ?? 0) * Math.max(Math.abs(q.sx), Math.abs(q.sy))) / 2;
    x0 = Math.min(x0, q.x - r);
    x1 = Math.max(x1, q.x + r);
    y0 = Math.min(y0, q.y - r);
    y1 = Math.max(y1, q.y + r);
  }
  const cl = (v: number, hi: number) => Math.max(0, Math.min(hi, v));
  const left = cl(cx + x0 * k - 6, width),
    top = cl(cy + y0 * k - 6, height);
  return {
    url: guideUrls[key] ?? "",
    width,
    height,
    crop: [
      left,
      top,
      cl(cx + x1 * k + 6, width) - left,
      cl(cy + y1 * k + 6, height) - top,
    ] as const,
    core: [
      cx + placed.heartScreen.x * k,
      cy + placed.heartScreen.y * k,
    ] as const,
  };
}
/** Forget the drawn guide pictures (tests). */
export function resetPrismaGuide() {
  guideUrls = {};
}
