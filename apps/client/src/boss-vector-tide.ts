/**
 * Tidewyrm as vector art: an Eastern water dragon (a long scaly body, antler
 * mane, ear fins, gold slit eyes and the pearl on its brow). Pure: the pose
 * from the battle's state, the body in 3D, and where each drawn piece goes on
 * screen this frame (`tidePlacements`). boss-vector-tide-rig.ts draws the
 * pieces once into an atlas and moves images to these placements; the
 * briefing diagram draws the same placements onto a canvas.
 *
 * Rig units: x right, y up, z towards the camera, from the boss's position on
 * the water. Like the floor, depth is drawn at 0.65 (world-art.ts).
 */
import {
  drawGlow,
  nextFacing,
  turnToward,
  type Phase,
} from "./boss-vector-grumble";
import {
  drawEye,
  makeFace,
  type EyeView,
  type FaceView,
} from "./boss-vector-face";

export type V3 = { x: number; y: number; z: number };
const TAU = Math.PI * 2;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z });
const add = (a: V3, b: V3) => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const mul = (a: V3, s: number) => v3(a.x * s, a.y * s, a.z * s);
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: V3, b: V3) =>
  v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const len = (a: V3) => Math.hypot(a.x, a.y, a.z);
const norm = (a: V3) => {
  const l = len(a) || 1;
  return v3(a.x / l, a.y / l, a.z / l);
};
const rotY = (p: V3, a: number) => {
  const c = Math.cos(a),
    s = Math.sin(a);
  return v3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
};
const UP = v3(0, 1, 0);
/** How far depth shows on screen (the floor's ratio). */
export const TIDE_TILT = 0.65;
/** Towards the camera (for "which side faces us"). */
const VIEW = norm(v3(0, 0.55, 0.84));
/** A rig point on screen (rig units, from the boss's position). */
export const tideProject = (p: V3) => ({ x: p.x, y: -p.y + p.z * TIDE_TILT });

// ───────────────────────── the body ─────────────────────────
/** Body segments, their spacing, and the head's scale. */
export const SEGMENTS = 30;
const SEG = 12.5;
const HS = 1.35;
export function radiusAt(i: number) {
  const f = i / (SEGMENTS - 1);
  if (f < 0.14) return lerp(8, 19, f / 0.14);
  if (f < 0.55) return lerp(19, 30, (f - 0.14) / 0.41);
  return lerp(30, 23, (f - 0.55) / 0.45);
}

export interface TidePose {
  /** How high the neck rises (1 normal). */
  rear: number;
  neckCurl: number;
  /** Neck pitched forwards (+) or back (−). */
  lean: number;
  /** How tightly the body coils on the water. */
  coil: number;
  humps: number;
  sway: number;
  swimPhase: number;
  /** Flopping on dry land. */
  flopK: number;
  flopPhase: number;
  /** 0 rising from the water, 1 lying flat (stranded). */
  flat: number;
  /** Rig units below the surface. */
  sink: number;
  /** Extra turn of the whole body (the undertow's spin). */
  spin: number;
  bob: number;
  headPitch: number;
  headYaw: number;
  headRoll: number;
  jaw: number;
  /** Upper lid: 0 wide open, 1 shut. */
  lid: number;
  anger: number;
  dizzy: number;
  pearl: number;
  exposed: number;
  closed: number;
  /** Seconds, for the neck's slow S and the fins' flutter. */
  clock: number;
}
/** At rest: risen from the water, coiled, glaring. */
export function tideIdle(clock = 0, phase = 1, reduced = false): TidePose {
  const m = reduced ? 0 : 1;
  const b = Math.sin(clock * 1.3) * m;
  return {
    rear: 1,
    neckCurl: 0.8,
    lean: 0,
    coil: 0.55,
    humps: 1,
    sway: 0.5 * m,
    swimPhase: clock * 1.1 * m,
    flopK: 0,
    flopPhase: 0,
    flat: 0,
    sink: 0,
    spin: 0,
    bob: b * 3,
    headPitch: -0.2 + b * 0.04,
    headYaw: Math.sin(clock * 0.4) * 0.22 * m,
    headRoll: 0,
    jaw: 0,
    lid: phase === 1 ? 0.3 : phase === 2 ? 0.2 : 0.12,
    anger: phase === 3 ? 1 : phase === 2 ? 0.8 : 0.6,
    dizzy: 0,
    pearl: 0.45 + 0.15 * Math.sin(clock * 2.2) * m,
    exposed: 0,
    closed: 0,
    clock: clock * m,
  };
}

export interface TideSeg {
  i: number;
  w: V3;
  d: V3;
  r: number;
  right: V3;
  up: V3;
}
export interface TideHead {
  w: V3;
  F: V3;
  R: V3;
  U: V3;
  at: (f: number, r: number, u: number) => V3;
  hinge: V3;
  jawDir: V3;
  pearl: V3;
}
/** The body (tail first) and the head, in rig units, for a pose and facing. */
export function tideBody(P: TidePose, yaw: number) {
  const N = SEGMENTS;
  const base = Math.round(0.55 * (N - 1));
  const hs: number[] = [],
    es: number[] = [];
  let h = 0;
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1);
    const lying = lerp(1 - smooth(0.45, 0.62, f), 1, P.flat);
    h +=
      P.coil * lying * 0.16 +
      P.sway * Math.sin(f * TAU * 1.5 - P.swimPhase) * 0.13 * (0.4 + lying) +
      P.flopK * Math.sin(f * TAU * 1.1 + P.flopPhase) * 0.2 +
      (1 - lying) *
        Math.sin(f * TAU * 1.4 + P.clock * 0.7) *
        0.11 *
        (1 - P.flat);
    hs.push(h);
    const humps =
      P.humps * Math.sin(f * TAU * 2.2 - P.swimPhase * 0.8) * 0.42 * lying;
    const rise = smooth(0.5, 0.7, f) * P.rear * 1.25;
    const curl = smooth(0.78, 1, f) * P.neckCurl * 1.1;
    const leanF = smooth(0.55, 0.72, f) * P.lean;
    const flick = -Math.max(0, 1 - f / 0.12) * 0.9;
    es.push(lerp(humps + rise - curl - leanF + flick, 0, P.flat));
  }
  const h0 = hs[base];
  const local: { p: V3; d: V3 }[] = [];
  let pos = v3(0, 0, 0);
  for (let i = 0; i < N; i++) {
    const hh = hs[i] - h0,
      e = es[i];
    const d = v3(
      Math.sin(hh) * Math.cos(e),
      Math.sin(e),
      Math.cos(hh) * Math.cos(e),
    );
    local.push({ p: pos, d });
    pos = add(pos, mul(d, SEG));
  }
  // The neck's base sits over the boss's position; a curl centres itself.
  let cx = 0,
    cz = 0;
  for (const q of local) {
    cx += q.p.x;
    cz += q.p.z;
  }
  cx /= N;
  cz /= N;
  const b = local[base].p;
  const ox = lerp(b.x, cx, P.flat),
    oz = lerp(b.z - 26, cz, P.flat);
  const restY = lerp(5, 27, P.flat) + P.bob * (1 - P.flat) * 0.6 - P.sink;
  const turn = yaw + P.spin;
  const W = (p: V3) =>
    rotY(v3(p.x - ox, p.y - b.y * (1 - P.flat) + restY, p.z - oz), turn);
  const segs: TideSeg[] = local.map((q, i) => {
    const w = W(q.p),
      d = rotY(q.d, turn);
    const c = cross(d, UP);
    const right = len(c) < 0.15 ? rotY(v3(-1, 0, 0), turn) : norm(c);
    return { i, w, d, r: radiusAt(i), right, up: norm(cross(right, d)) };
  });

  const top = segs[N - 1];
  // The head aims where the boss faces (its attacks' direction), whatever the
  // neck's sway; lying stranded, it follows the body's curl.
  const along = Math.atan2(top.d.x, top.d.z);
  const drift = Math.atan2(Math.sin(along - turn), Math.cos(along - turn));
  const H = turn + lerp(drift * 0.3, drift, P.flat) + P.headYaw;
  const pa = lerp(P.headPitch, 0, P.flat * 0.8);
  const F = norm(
    v3(Math.sin(H) * Math.cos(pa), Math.sin(pa), Math.cos(H) * Math.cos(pa)),
  );
  let R = norm(cross(F, UP));
  let U = norm(cross(R, F));
  if (P.headRoll) {
    const c = Math.cos(P.headRoll),
      s = Math.sin(P.headRoll);
    const R2 = add(mul(R, c), mul(U, s));
    U = add(mul(U, c), mul(R, -s));
    R = R2;
  }
  const C = add(add(top.w, mul(top.d, 10)), add(mul(F, 12), mul(U, 5)));
  const at = (f: number, r: number, u: number) =>
    add(C, add(mul(F, f * HS), add(mul(R, r * HS), mul(U, u * HS))));
  const jawDir = norm(
    add(mul(F, Math.cos(P.jaw * 0.75)), mul(U, -Math.sin(P.jaw * 0.75))),
  );
  const head: TideHead = {
    w: C,
    F,
    R,
    U,
    at,
    hinge: at(4, 0, -6),
    jawDir,
    pearl: at(7, 0, 25),
  };
  return { segs, head };
}

// ───────────────────────── from the battle to a pose ─────────────────────────
export type TideAttack =
  "dive" | "wave" | "bubbles" | "hightide" | "undertow" | "prison";
/** What the battle tells the rig each frame (all cosmetic). */
export interface TideCue {
  clock: number;
  phase: number;
  reduced: boolean;
  /** The attack being wound up (its warning), 0–1 through the windup. */
  windKind?: string;
  windup: number;
  /** The last attack cast, and seconds since. */
  castKind?: string;
  castAge: number;
  /** On dry land and open to attack. */
  stranded: boolean;
  stagger: boolean;
  hurt: number;
  dead: boolean;
  /** 0–1 out of the water after surfacing. */
  rise: number;
  /** 0–1 sunk after dying. */
  deathSink: number;
  /** Seconds since a new phase began (the roar), large when long past. */
  roarAge: number;
}
const ease = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
/** A 0→1→0 bump over `dur` seconds after a cast. */
const after = (age: number, dur: number) =>
  age < 0 || age > dur ? 0 : Math.sin((age / dur) * Math.PI);

export function tidePose(c: TideCue): TidePose {
  const P = tideIdle(c.clock, c.phase, c.reduced);
  const w = clamp(c.windup);
  const k = c.windKind;
  if (k === "dive") {
    P.rear = lerp(P.rear, 1.3, w);
    P.headPitch = lerp(P.headPitch, 0.3, w);
    P.lean = lerp(0, -0.3, w);
    P.jaw = 0.5 * w;
  } else if (k === "wave") {
    P.rear = lerp(P.rear, 1.25, w);
    P.lean = -0.55 * w;
    P.headPitch = lerp(P.headPitch, 0.35, w);
    P.jaw = 0.45 * w;
  } else if (k === "bubbles") {
    P.headPitch = lerp(P.headPitch, 0.15, w);
    P.lean = -0.15 * w;
  } else if (k === "hightide") {
    P.rear = lerp(P.rear, 1.4, w);
    P.headPitch = lerp(P.headPitch, 1.05, w);
    P.lean = -0.3 * w;
    P.jaw = w;
  } else if (k === "undertow") {
    P.coil = lerp(P.coil, 1.5, w);
    P.rear = lerp(P.rear, 0.7, w);
    P.jaw = 0.4 * w;
  } else if (k === "prison") {
    P.headPitch = lerp(P.headPitch, -0.05, w);
    P.jaw = 0.2 * w;
  }
  if (k) {
    P.anger = Math.max(P.anger, 0.4 + 0.6 * w);
    P.lid = Math.min(P.lid, lerp(P.lid, 0.05, w));
  }
  // the follow-through of a cast (skipped with reduced motion)
  if (!c.reduced && c.castKind) {
    const a = c.castAge;
    if (c.castKind === "wave") {
      const s = after(a, 0.9);
      P.lean = Math.max(P.lean, 0.95 * s);
      P.headPitch = lerp(P.headPitch, -0.85, s);
      P.jaw = Math.max(P.jaw, 0.7 * s);
    } else if (c.castKind === "bubbles") {
      const s = after(a, 1.4);
      P.jaw = Math.max(P.jaw, 0.5 * s);
      P.lean = Math.max(P.lean, 0.2 * s);
      P.headPitch = lerp(P.headPitch, -0.25, s);
    } else if (c.castKind === "prison") {
      const s = after(a, 0.8);
      P.jaw = Math.max(P.jaw, 0.7 * s);
      P.headPitch = lerp(P.headPitch, -0.35, s);
    } else if (c.castKind === "hightide") {
      const s = after(a, 1.2);
      P.jaw = Math.max(P.jaw, s);
      P.headPitch = lerp(P.headPitch, 1.0, s);
      P.rear = lerp(P.rear, 1.35, s);
    }
  }
  // a new phase: a roar at the sky
  if (!c.reduced && c.roarAge >= 0 && c.roarAge < 1.6 && !c.dead) {
    const s = Math.sin((c.roarAge / 1.6) * Math.PI);
    P.rear = lerp(P.rear, 1.35, s);
    P.headPitch = lerp(P.headPitch, 0.65, s);
    P.lean = lerp(P.lean, -0.35, s);
    P.jaw = Math.max(P.jaw, s);
    P.anger = 1;
  }
  // stranded on an island: flat, flopping, dizzy, the pearl open
  if (c.stranded && !c.dead) {
    P.flat = 1;
    P.coil = 0.95;
    P.humps = 0;
    P.sway = 0;
    P.rear = 0;
    P.flopK = c.reduced ? 0 : 1;
    P.flopPhase = c.reduced ? 0 : c.clock * 7;
    P.dizzy = 1;
    P.headRoll = 0.55;
    P.jaw = 0.25;
    P.anger = 0;
    P.lid = 0;
  }
  if (c.stranded || c.stagger) P.exposed = 1;
  if (c.stagger && !c.stranded && !c.dead) P.dizzy = 1;
  // a hit: a flinch
  if (c.hurt > 0 && !c.dead && !c.reduced) {
    P.lean -= 0.35 * c.hurt;
    P.headPitch += 0.35 * c.hurt;
    P.lid = Math.max(P.lid, 0.8 * c.hurt);
  }
  // out of the water after a dive
  P.sink = (1 - clamp(c.rise)) * 300;
  if (c.dead) {
    const s = clamp(c.deathSink);
    P.anger = 0;
    P.closed = 1;
    P.dizzy = 0;
    P.exposed = 0;
    P.rear = lerp(1, 0.4, ease(Math.min(1, s * 3)));
    P.headPitch = -0.7;
    P.headRoll = 0.4;
    P.sway = 0.15;
    P.humps = 0.4;
    P.pearl = (1 - s) * 0.6;
    P.sink = s * s * 430;
  }
  return P;
}

/** The facing shown (eight ways, with hysteresis) and the turn towards it. */
export function tideTurn(
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
export interface TidePalette {
  light: string;
  mid: string;
  dark: string;
  line: string;
  belly: string;
  bellyDark: string;
  fin: string;
  finLight: string;
  finDark: string;
  iris: [number, number, number];
  pearl: [number, number, number];
  glow: number;
  /** Glowing back markings (phase 2–3). */
  mark: number | null;
}
export const TIDE: Record<Phase, TidePalette> = {
  1: {
    light: "#a5f6e4",
    mid: "#2fbdb7",
    dark: "#0f6b76",
    line: "#0a3540",
    belly: "#fff3d8",
    bellyDark: "#e2c79e",
    fin: "#ff8fbf",
    finLight: "#ffd6e7",
    finDark: "#d9548f",
    iris: [255, 196, 64],
    pearl: [225, 255, 248],
    glow: 0x78f5e6,
    mark: null,
  },
  2: {
    light: "#93e3f6",
    mid: "#1f93c2",
    dark: "#0b4f7c",
    line: "#072b46",
    belly: "#f1f6ea",
    bellyDark: "#c6d6cc",
    fin: "#ff74b2",
    finLight: "#ffc4de",
    finDark: "#c93f84",
    iris: [255, 170, 52],
    pearl: [215, 250, 255],
    glow: 0x6edcff,
    mark: 0x8cebff,
  },
  3: {
    light: "#6f9ce0",
    mid: "#22448c",
    dark: "#0b1a44",
    line: "#040b22",
    belly: "#c9d8f2",
    bellyDark: "#8ea4cc",
    fin: "#ff4fa6",
    finLight: "#ffb3dc",
    finDark: "#a8216b",
    iris: [255, 236, 120],
    pearl: [200, 250, 255],
    glow: 0x5aebff,
    mark: 0x64f5ff,
  },
};
const rgb = (c: [number, number, number], a = 1) =>
  `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// ───────────────────────── the drawn pieces ─────────────────────────
type Ctx = CanvasRenderingContext2D;
/** Native sizes (rig units) of the pieces, as drawn in the atlas. */
export const PIECE = {
  seg: 30, // a body disc's radius
  fin: 22, // a back fin's height
  ray: 46, // a tail-fin ray's length
  mane: 50,
  frill: 30,
  horn: 46,
  disc: 26, // head discs' radius
  snout: 42 * HS, // snout length (base to nose)
  jaw: 47 * HS,
  glow: 40, // a glow's radius
};
export interface Piece {
  name: string;
  /** Size in rig units, and the anchor (0–1) its placement point sits on. */
  w: number;
  h: number;
  ox: number;
  oy: number;
  draw: (ctx: Ctx, k: number) => void; // drawn with (0,0) at the top-left, k px per unit
}
function finShape(
  ctx: Ctx,
  k: number,
  w: number,
  h: number,
  pal: TidePalette,
  droop = 0,
) {
  // a fin pointing up from (w/2, h): a curved leaf with a light rib
  const bx = (w / 2) * k,
    by = h * k;
  const g = ctx.createLinearGradient(bx, by, bx, 0);
  g.addColorStop(0, pal.finDark);
  g.addColorStop(0.5, pal.fin);
  g.addColorStop(1, pal.finLight);
  ctx.fillStyle = g;
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = 1.5 * k;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(bx - w * 0.38 * k, by - 1 * k);
  ctx.quadraticCurveTo(
    bx - w * 0.45 * k + droop * k,
    by * 0.45,
    bx + droop * k * 0.6,
    2 * k,
  );
  ctx.quadraticCurveTo(
    bx + w * 0.3 * k + droop * k,
    by * 0.5,
    bx + w * 0.38 * k,
    by - 1 * k,
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1 * k;
  ctx.beginPath();
  ctx.moveTo(bx, by - 2 * k);
  ctx.quadraticCurveTo(
    bx - w * 0.1 * k + droop * k * 0.5,
    by * 0.5,
    bx + droop * k * 0.6,
    4 * k,
  );
  ctx.stroke();
}
function wedge(
  ctx: Ctx,
  k: number,
  L: number,
  r0: number,
  r1: number,
  pad: number,
  fill: string | CanvasGradient,
) {
  // a tapered capsule from (r0+pad, mid) to (r0+pad+L, mid)
  const x0 = (r0 + pad) * k,
    y = (r0 + pad) * k,
    x1 = x0 + L * k;
  const a = Math.asin(clamp((r0 - r1) / L, -1, 1));
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x0, y, r0 * k, Math.PI / 2 + a, Math.PI * 1.5 - a);
  ctx.arc(x1, y, r1 * k, -Math.PI / 2 - a, Math.PI / 2 + a);
  ctx.closePath();
  ctx.fill();
}
export type EyeLook = "glare" | "wide" | "squint" | "shut" | "dizzy";
/**
 * THE HEAD. A rounded dragon's head with a short snout, ear fins and the
 * pearl on its brow, drawn once per view. The face on it is built by the
 * shared construction (boss-vector-face.ts; the method is written up in
 * docs/boss-face-drawing.md).
 */
const HA = 30; // half the head's width: the unit of the constants below
const H_TOP = -0.9 * HA,
  H_BOT = 0.84 * HA;
const S_BROW = -0.32 * HA,
  S_NOSE = 0.36 * HA;
const gauss = (x: number, s: number) => Math.exp(-(x * x) / (s * s));
/** The skull's roundness at height v: 1 at its widest, 0 at crown and chin. */
const hse = (v: number) => {
  const t = clamp(Math.abs((v + 0.03 * HA) / (0.87 * HA)));
  const e = v > -0.03 * HA ? 2 : 2.5;
  return Math.pow(1 - Math.pow(t, e), 1 / e);
};
/** The profile (the centre line): brow, a shallow stop, the short snout, the chin. */
export const tideCentre = (v: number) =>
  0.9 * HA * hse(v) +
  0.56 * HA * gauss(v - 0.4 * HA, (v > 0.4 * HA ? 0.3 : 0.2) * HA) -
  0.04 * HA * gauss(v - 0.02 * HA, 0.12 * HA);
/** Half the snout's width where it stands proud of the face. */
const snoutHalf = (v: number) => 0.3 * HA * gauss(v - 0.44 * HA, 0.26 * HA);
const TQ_LAG = (14 * Math.PI) / 180;
/** sin of the face's yaw at the three-quarter facing (45 degrees less the lag). */
const TQ_SIN = Math.sin(Math.PI / 4 - TQ_LAG);
/** The drawn outline of a view at height v: [left, right], turned to screen right. */
export function tideSkull(view: FaceView, v: number): [number, number] {
  const s = hse(v),
    w = 0.99 * HA * s * (1 + 0.05 * smooth(-0.2 * HA, 0.4 * HA, v));
  if (view === "side") return [-1.0 * HA * s, tideCentre(v)];
  if (view === "tq")
    return [-w, Math.max(0.95 * HA * s, tideCentre(v) * TQ_SIN + snoutHalf(v))];
  return [-w, w];
}
export interface TideExpr {
  look: EyeLook;
  brow: "calm" | "angry";
  mouth: "closed" | "half" | "open";
}
const eyeName = (view: EyeView, look: EyeLook) =>
  view === "front" ? `eye-${look}` : `eye-${view}-${look}`;
const lit = (look: EyeLook) => look !== "shut" && look !== "dizzy";
export const TIDE_SPEC = {
  A: HA,
  top: H_TOP,
  bot: H_BOT,
  lines: { pearl: -0.64 * HA, brow: S_BROW, eye: -0.06 * HA, nose: S_NOSE },
  eyeAz: (42 * Math.PI) / 180,
  eyeOrbit: 0.64 * HA,
  lag: TQ_LAG,
  farLift: (6 * Math.PI) / 180,
  nod: 0.4 * HA,
  margin: 0.045 * HA,
  tuckCap: 0.4,
  bridgeHalf: 1,
  eye: {
    front: { hw: 7.4, hh: 7.2 },
    near: { hw: 7.4, hh: 7.2 },
    far: { hw: 5, hh: 7 },
    side: { hw: 6.4, hh: 7.2 },
  },
  centreLine: tideCentre,
  skullEdge: tideSkull,
  headPiece: (view: FaceView) => `head-${view}`,
  eyePiece: (view: EyeView, e: TideExpr) => eyeName(view, e.look),
  glint: (view: EyeView, e: TideExpr) =>
    lit(e.look)
      ? {
          piece: "eye-glint",
          x: -TIDE_FACE_EYE[view] * 0.34,
          y: e.look === "glare" ? -1.6 : -2.6,
        }
      : null,
  brow: (view: EyeView, e: TideExpr) => ({
    piece: `brow-${view}-${e.brow}`,
    dx: 0.5,
    dy: e.brow === "angry" ? 2.4 : 0,
  }),
  // on the centre line, in drawing order within their layer
  centre: [
    {
      id: "muzzle",
      anchor: "snout",
      // between the far and the near eye: its far edge tucks the far eye
      layer: "mid" as const,
      piece: (view: FaceView) => (view === "side" ? null : `muzzle-${view}`),
    },
    {
      id: "pearl",
      line: -0.64 * HA,
      nodK: 0.8,
      hw: { front: 7.5, tq: 7.5 },
      vspan: [-7, 7] as [number, number],
      sideInset: 3.5,
      piece: () => "pearl",
    },
    {
      id: "jaw",
      anchor: "snout",
      piece: (view: FaceView, e: TideExpr) => `mouth-${view}-${e.mouth}`,
    },
    {
      id: "snout",
      line: S_NOSE,
      hw: { front: 9, tq: 6 },
      vspan: [0, 7] as [number, number],
      sideInset: 1,
      piece: (view: FaceView) => `nose-${view}`,
    },
  ],
};
const TIDE_FACE_EYE: Record<EyeView, number> = {
  front: 7.4,
  near: 7.4,
  far: 5,
  side: 6.4,
};
/** The face: a head pose and an expression in, piece placements out. */
export const TIDE_FACE = makeFace<TideExpr>(TIDE_SPEC);
/** Every piece the rig draws in a phase. */
export function tidePieces(phase: Phase): Piece[] {
  const pal = TIDE[phase];
  const S = PIECE.seg;
  const out: Piece[] = [];
  const pieceOf = (
    name: string,
    w: number,
    h: number,
    ox: number,
    oy: number,
    draw: Piece["draw"],
  ) => out.push({ name, w, h, ox, oy, draw });
  // a body disc (lit from the top left, like the champions), its outline, its belly
  pieceOf("seg", S * 2 + 2, S * 2 + 2, 0.5, 0.5, (ctx, k) => {
    const c = (S + 1) * k,
      r = S * k;
    const g = ctx.createLinearGradient(c - r * 0.4, c - r, c + r * 0.4, c + r);
    g.addColorStop(0, pal.light);
    g.addColorStop(0.45, pal.mid);
    g.addColorStop(1, pal.dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(10,60,70,0.3)";
    ctx.lineWidth = 1.3 * k;
    for (const [dx, dy] of [
      [-0.3, -0.35],
      [0.25, -0.2],
    ]) {
      ctx.beginPath();
      ctx.arc(c + dx * r, c + dy * r, r * 0.26, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.ellipse(c - r * 0.35, c - r * 0.5, r * 0.32, r * 0.16, -0.5, 0, TAU);
    ctx.fill();
  });
  pieceOf("seg-line", S * 2 + 6, S * 2 + 6, 0.5, 0.5, (ctx, k) => {
    ctx.fillStyle = pal.line;
    ctx.beginPath();
    ctx.arc((S + 3) * k, (S + 3) * k, (S + 1.6) * k, 0, TAU);
    ctx.fill();
  });
  pieceOf("belly", S * 1.5, S * 1.5, 0.5, 0.5, (ctx, k) => {
    const c = S * 0.75 * k,
      r = S * 0.72 * k;
    const g = ctx.createRadialGradient(c - r * 0.25, c - r * 0.25, 0, c, c, r);
    g.addColorStop(0, pal.belly);
    g.addColorStop(1, pal.bellyDark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, TAU);
    ctx.fill();
  });
  pieceOf("fin", 18, PIECE.fin + 2, 0.5, 1, (ctx, k) =>
    finShape(ctx, k, 18, PIECE.fin + 2, pal, -3),
  );
  pieceOf("ray", 16, PIECE.ray + 2, 0.5, 1, (ctx, k) =>
    finShape(ctx, k, 16, PIECE.ray + 2, pal),
  );
  pieceOf("mane", 18, PIECE.mane + 2, 0.5, 1, (ctx, k) =>
    finShape(ctx, k, 18, PIECE.mane + 2, pal, 4),
  );
  pieceOf("frill", 20, PIECE.frill + 2, 0.5, 1, (ctx, k) =>
    finShape(ctx, k, 20, PIECE.frill + 2, pal, 2),
  );
  // ── the head: one drawing per view, built on tideSkull (the same outline
  // the face is held inside), and the face's own pieces ──
  const A = HA;
  /** A head piece: drawn in rig units about its anchor. */
  const drawn = (
    name: string,
    w: number,
    h: number,
    ox: number,
    oy: number,
    fn: (c: Ctx) => void,
  ) =>
    pieceOf(name, w, h, ox, oy, (ctx, k) => {
      ctx.save();
      ctx.scale(k, k);
      ctx.translate(ox * w, oy * h);
      ctx.lineJoin = ctx.lineCap = "round";
      fn(ctx);
      ctx.restore();
    });
  /** The skin down a head or muzzle: one gradient, so the pieces match. */
  const headSkin = (c: Ctx, dy = 0) => {
    const g = c.createLinearGradient(0, H_TOP - 4 - dy, 0, H_BOT + 6 - dy);
    g.addColorStop(0, pal.light);
    g.addColorStop(0.45, pal.mid);
    g.addColorStop(1, pal.dark);
    return g;
  };
  /** A pink ear fin: three webbed rays fanning from (x, y) towards `deg`. */
  const earFin = (c: Ctx, x: number, y: number, deg: number, len: number) => {
    for (const [d, l] of [
      [-26, 0.8],
      [26, 0.72],
      [0, 1],
    ]) {
      const a = ((deg + d) * Math.PI) / 180,
        ln = len * l;
      const dx = Math.cos(a),
        dy = Math.sin(a);
      c.beginPath();
      c.moveTo(x - dy * 4.5, y + dx * 4.5);
      c.quadraticCurveTo(
        x + dx * ln * 0.55 - dy * 5.5,
        y + dy * ln * 0.55 + dx * 5.5,
        x + dx * ln,
        y + dy * ln,
      );
      c.quadraticCurveTo(
        x + dx * ln * 0.5 + dy * 5.5,
        y + dy * ln * 0.5 - dx * 5.5,
        x + dy * 4.5,
        y - dx * 4.5,
      );
      c.closePath();
      const g = c.createLinearGradient(x, y, x + dx * ln, y + dy * ln);
      g.addColorStop(0, pal.finDark);
      g.addColorStop(0.5, pal.fin);
      g.addColorStop(1, pal.finLight);
      c.fillStyle = g;
      c.strokeStyle = pal.line;
      c.lineWidth = 1.6;
      c.stroke();
      c.fill();
    }
  };
  const VIEWS: FaceView[] = ["front", "tq", "side", "backtq", "back"];
  for (const view of VIEWS)
    drawn(`head-${view}`, 4.2 * A, 3.2 * A, 0.5, 0.5, (c) => {
      const faced = view === "front" || view === "tq" || view === "side";
      // ear fins, behind the skull
      if (view === "front" || view === "back")
        for (const s of [-1, 1])
          earFin(c, s * 0.8 * A, -0.1 * A, 90 - s * 88, 0.78 * A);
      else if (view === "tq") {
        earFin(c, -0.84 * A, -0.08 * A, 186, 0.86 * A);
        earFin(c, 0.5 * A, -0.62 * A, -52, 0.5 * A);
      } else if (view === "side") earFin(c, -0.62 * A, -0.1 * A, 190, 0.9 * A);
      else {
        earFin(c, 0.84 * A, -0.08 * A, -6, 0.86 * A);
        earFin(c, -0.6 * A, -0.5 * A, 212, 0.56 * A);
      }
      const path = new Path2D();
      for (let v = H_TOP; v <= H_BOT; v += 0.5)
        path.lineTo(tideSkull(view, v)[1], v);
      for (let v = H_BOT; v >= H_TOP; v -= 0.5)
        path.lineTo(tideSkull(view, v)[0], v);
      path.closePath();
      c.strokeStyle = pal.line;
      c.lineWidth = 2.2;
      c.stroke(path);
      c.fillStyle = headSkin(c);
      c.fill(path);
      c.save();
      c.clip(path);
      if (faced) {
        // the cream lower jaw and throat
        c.beginPath();
        if (view === "front") {
          c.moveTo(-1.3 * A, 0.5 * A);
          c.quadraticCurveTo(0, 0.82 * A, 1.3 * A, 0.5 * A);
        } else {
          c.moveTo(-1.3 * A, 0.56 * A);
          c.quadraticCurveTo(0.3 * A, 0.7 * A, 1.7 * A, 0.56 * A);
        }
        c.lineTo(1.7 * A, H_BOT + 8);
        c.lineTo(-1.3 * A, H_BOT + 8);
        c.closePath();
        c.fillStyle = pal.belly;
        c.fill();
      }
      // scales on the crown and cheeks; the face itself stays clean
      const cu = view === "front" ? 0 : view === "tq" ? 0.42 * A : 0.62 * A;
      c.strokeStyle = pal.dark;
      c.lineWidth = 1;
      c.globalAlpha = 0.4;
      for (let r = 0; r < 9; r++)
        for (let x = -1.3 * A + (r % 2) * 4.5; x < 1.5 * A; x += 9) {
          const y = H_TOP + 5 + r * 6.5;
          if (y > 0.45 * A) continue;
          if (
            faced &&
            ((x - cu) / (0.86 * A)) ** 2 + ((y - 0.12 * A) / (0.6 * A)) ** 2 < 1
          )
            continue;
          c.beginPath();
          c.arc(x, y, 4.6, 0.12 * Math.PI, 0.88 * Math.PI);
          c.stroke();
        }
      // light along the crown
      c.globalAlpha = 0.55;
      const rim = c.createLinearGradient(0, H_TOP, 0, H_TOP + 0.5 * A);
      rim.addColorStop(0, "#ffffff");
      rim.addColorStop(1, "rgba(255,255,255,0)");
      c.strokeStyle = rim;
      c.lineWidth = 5;
      c.stroke(path);
      c.restore();
    });
  // from behind, the muzzle: a rounded end that may show past the skull
  drawn("snout-back", 30, 26, 0.5, 0.5, (c) => {
    c.beginPath();
    c.ellipse(0, 2, 11, 9, 0, 0, TAU);
    c.strokeStyle = pal.line;
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = headSkin(c, S_NOSE);
    c.fill();
  });
  // the muzzle: a soft, paler pad from the front; at three-quarter the piece
  // whose far edge (the bridge and the side of the snout) tucks the far eye
  drawn("muzzle-front", 44, 40, 0.5, 0.5, (c) => {
    const g = c.createRadialGradient(0, 3, 1, 0, 3, 17);
    g.addColorStop(0, pal.light);
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.globalAlpha = 0.6;
    c.fillStyle = g;
    c.save();
    c.scale(1, 0.72);
    c.beginPath();
    c.arc(0, 4, 17, 0, TAU);
    c.fill();
    c.restore();
  });
  drawn("muzzle-tq", 44, 60, 0.6, 0.62, (c) => {
    const mid = (v: number) => (tideCentre(v) - tideCentre(S_NOSE)) * TQ_SIN;
    const half = (v: number) => 1 + snoutHalf(v);
    const top = S_BROW - 5,
      bot = S_NOSE + 16;
    const edge: { x: number; y: number }[] = [];
    for (let v = top; v <= bot; v += 0.5)
      edge.push({
        x: mid(v) + half(v) * (1 - 0.8 * smooth(S_NOSE + 9, bot, v)),
        y: v - S_NOSE,
      });
    c.beginPath();
    edge.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
    c.lineTo(-24, bot - S_NOSE);
    c.lineTo(-24, top - S_NOSE);
    c.closePath();
    c.fillStyle = headSkin(c, S_NOSE);
    c.fill();
    // melt into the face on the near side, above the brow and under the lip
    c.globalCompositeOperation = "destination-out";
    const fade = (x0: number, y0: number, x1: number, y1: number) => {
      const g = c.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g;
      c.fillRect(-30, -45, 70, 80);
    };
    fade(-22, 0, -11, 0);
    fade(0, top - S_NOSE, 0, S_BROW + 2 - S_NOSE);
    fade(0, 9, 0, 4);
    c.globalCompositeOperation = "source-over";
    // the one drawn line: the far side of the bridge and snout
    const line = c.createLinearGradient(0, S_BROW - 3 - S_NOSE, 0, 9);
    line.addColorStop(0, "rgba(0,0,0,0)");
    line.addColorStop(0.25, pal.line);
    line.addColorStop(0.8, pal.line);
    line.addColorStop(1, "rgba(0,0,0,0)");
    c.strokeStyle = line;
    c.globalAlpha = 0.8;
    c.lineWidth = 1.2;
    c.beginPath();
    edge.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
    c.stroke();
  });
  // nostrils (the piece the battle knows as the snout)
  for (const view of ["front", "tq", "side"] as const)
    drawn(`nose-${view}`, 22, 12, 0.5, 0.5, (c) => {
      c.fillStyle = pal.line;
      const dots: [number, number, number][] =
        view === "front"
          ? [
              [-4.4, 0, 0.5],
              [4.4, 0, -0.5],
            ]
          : view === "tq"
            ? [
                [-3.6, 0.2, 0.45],
                [3.2, -0.2, -0.3],
              ]
            : [[-4.6, -0.6, 0.4]];
      for (const [x, y, tilt] of dots) {
        c.beginPath();
        c.ellipse(x, y, view === "tq" && x > 0 ? 1.5 : 2.3, 1.4, tilt, 0, TAU);
        c.fill();
      }
    });
  // the mouth: a smile, half open, and open with two small fangs
  for (const view of ["front", "tq", "side"] as const)
    for (const [kind, d] of [
      ["closed", 0],
      ["half", 4.5],
      ["open", 9],
    ] as const)
      drawn(`mouth-${view}-${kind}`, 60, 44, 0.6, 0.2, (c) => {
        c.strokeStyle = pal.line;
        c.lineWidth = 1.5;
        // the far half is shorter at three-quarter: replotted, not squeezed
        const fx = (x: number) =>
          view === "tq" && x > 0 ? x * 0.5 : view === "tq" ? x * 1.15 : x;
        const inside = () => {
          c.fillStyle = "#7a1e3a";
          c.fill();
          c.stroke();
        };
        if (view === "side") {
          // in profile the lip starts under the nostril, inside the outline
          c.translate(-5.5, 0);
          if (d) {
            c.beginPath(); // the lower jaw, dropped
            c.moveTo(-22, 6.5);
            c.lineTo(-3.5, 7 + d);
            c.quadraticCurveTo(-1, 9.5 + d, -4.5, 11.5 + d);
            c.quadraticCurveTo(-13, 13 + d * 0.6, -23, 11);
            c.closePath();
            c.fillStyle = pal.belly;
            c.fill();
            c.stroke();
            c.beginPath();
            c.moveTo(-1, 6);
            c.quadraticCurveTo(-10, 7.6, -22, 6.5);
            c.lineTo(-3.5, 7 + d);
            c.quadraticCurveTo(-1.4, 6.6 + d * 0.5, -1, 6);
            c.closePath();
            inside();
            c.fillStyle = "#ff7aa0";
            c.beginPath();
            c.ellipse(-9, 6.9 + d * 0.62, 5.5, 1.2 + d * 0.08, 0.36, 0, TAU);
            c.fill();
            c.fillStyle = "#fffaf0";
            c.beginPath();
            c.moveTo(-3.2, 6.5);
            c.lineTo(-4.4, 6.5 + Math.min(d, 6) * 0.75);
            c.lineTo(-5.8, 6.7);
            c.fill();
          } else {
            c.beginPath();
            c.moveTo(-1, 6);
            c.quadraticCurveTo(-10, 8.2, -20, 6.8);
            c.quadraticCurveTo(-22.6, 6, -23.4, 3.6);
            c.stroke();
          }
          return;
        }
        const lip = () => {
          c.moveTo(fx(-12), 4.6);
          c.quadraticCurveTo(fx(-9), 9.2, fx(-3), 9.4);
          c.quadraticCurveTo(0, 9.6, fx(3), 9.4);
          c.quadraticCurveTo(fx(9), 9.2, fx(12), 4.6);
        };
        c.beginPath();
        lip();
        if (!d) {
          c.stroke();
          c.beginPath(); // the corners turn up
          c.moveTo(fx(-12), 4.6);
          c.quadraticCurveTo(fx(-13), 3.6, fx(-12.8), 2.4);
          c.moveTo(fx(12), 4.6);
          c.quadraticCurveTo(fx(13), 3.6, fx(12.8), 2.4);
          c.stroke();
          return;
        }
        c.quadraticCurveTo(fx(11), 9 + d, 0, 11 + d);
        c.quadraticCurveTo(fx(-11), 9 + d, fx(-12), 4.6);
        c.closePath();
        inside();
        c.save();
        c.clip();
        c.fillStyle = "#ff7aa0";
        c.beginPath();
        c.ellipse(fx(0), 10.5 + d, Math.abs(fx(-6)) * 0.9, 2.6, 0, 0, TAU);
        c.fill();
        c.restore();
        c.fillStyle = "#fffaf0";
        for (const s of [-1, 1]) {
          c.beginPath();
          c.moveTo(fx(s * 5), 8.6);
          c.lineTo(fx(s * 6.4), 8.6 + Math.min(d, 6) * 0.8);
          c.lineTo(fx(s * 7.8), 8.2);
          c.fill();
        }
      });
  // eyes and brows: a drawing for each view (front, near, far, side) and look
  const lighter = (v: number) => (v + 255) >> 1;
  const irisStops = [
    rgb([lighter(pal.iris[0]), lighter(pal.iris[1]), lighter(pal.iris[2])]),
    rgb(pal.iris),
    rgb([lighter(pal.iris[0]), lighter(pal.iris[1]), lighter(pal.iris[2])]),
  ];
  for (const view of ["front", "near", "far", "side"] as EyeView[]) {
    const { hw, hh } = TIDE_SPEC.eye[view];
    for (const look of [
      "glare",
      "wide",
      "squint",
      "shut",
      "dizzy",
    ] as EyeLook[])
      drawn(eyeName(view, look), 26, 26, 0.5, 0.5, (c) => {
        // drawn with the inner corner at +x; the far eye's is on the other side
        const way = view === "far" ? -1 : 1;
        if (view === "far") c.scale(-1, 1);
        drawEye(c, {
          hw,
          hh,
          ink: pal.line,
          weight: 2.1,
          look:
            look === "shut" ? "closed" : look === "dizzy" ? "dizzy" : "open",
          lid:
            look === "glare"
              ? [-0.66, -0.16]
              : look === "squint"
                ? [-0.3, 0.22]
                : undefined,
          bow: look === "squint" ? 0.5 : 1.3,
          sclera: ["#ffffff", "#f1fdff", "#bfe7ee"],
          shade: "rgba(8,60,70,0.4)",
          spiral: pal.dark,
          iris: {
            // the slit looks the way the head faces
            x: (view === "far" ? 0.2 : view === "front" ? 0.6 : 1) * way,
            y: look === "wide" ? 0.2 : 1.1,
            r: look === "wide" ? 3.4 : 4.5,
            ring: pal.dark,
            stops: irisStops,
            slit: look === "wide" ? 0.9 : 1.35,
          },
        });
      });
    const L = { front: 9.4, near: 9.4, far: 6.2, side: 8.2 }[view] / 2;
    for (const [kind, s] of [
      ["calm", [0.5, -0.9, 0.4, 1.7]],
      ["angry", [-2, -0.6, 2.1, 2.4]],
    ] as const)
      drawn(`brow-${view}-${kind}`, 16, 10, 0.5, 0.5, (c) => {
        // the brow ridge: a tapered stroke, inner end at +x
        if (view === "far") c.scale(-1, 1);
        c.beginPath();
        c.moveTo(-L, s[0]);
        c.quadraticCurveTo(0, s[1] - s[3] * 0.5, L, s[2] - s[3] * 0.4);
        c.lineTo(L, s[2] + s[3] * 0.5);
        c.quadraticCurveTo(0, s[1] + s[3] * 0.6, -L, s[0] + 0.25);
        c.closePath();
        c.fillStyle = pal.dark;
        c.fill();
      });
  }
  // the highlight: one drawing for both eyes, never mirrored
  pieceOf("eye-glint", 6, 6, 0.5, 0.5, (ctx, k) => {
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.arc(3 * k, 3 * k, 1.5 * k, 0, TAU);
    ctx.fill();
  });
  pieceOf("pearl", 22 * HS, 18 * HS, 0.5, 0.5, (ctx, k) => {
    const r = 6.8 * HS * k,
      cx = 11 * HS * k,
      cy = 8 * HS * k;
    ctx.fillStyle = "#e7b44a";
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 1.4 * k;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2.5 * k, r * 1.3, r * 0.75, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    const g = ctx.createRadialGradient(
      cx - r * 0.35,
      cy - r * 0.4,
      0,
      cx,
      cy,
      r,
    );
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.6, rgb(pal.pearl));
    g.addColorStop(1, `#${pal.glow.toString(16).padStart(6, "0")}`);
    ctx.fillStyle = g;
    ctx.lineWidth = 1.5 * k;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.25, 0, TAU);
    ctx.fill();
  });
  pieceOf("glow", PIECE.glow * 2, PIECE.glow * 2, 0.5, 0.5, (ctx, k) =>
    drawGlow(ctx, PIECE.glow * 2 * k),
  );
  return out;
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
  /** Screen y below which the piece is under water (rig units), if any. */
  waterY?: number;
}
export interface TideLine {
  pts: { x: number; y: number }[];
  width: number;
  color: string;
  /** In front of the head, or behind it. */
  front: boolean;
}
/** The surface under a rig point: the water's level (0), or null on dry land. */
export type WaterAt = (x: number, z: number) => number | null;

export function tidePlacements(
  P: TidePose,
  yaw: number,
  phase: Phase,
  water: WaterAt,
) {
  const pal = TIDE[phase];
  const { segs, head } = tideBody(P, yaw);
  const out: Placement[] = [];
  const lines: TideLine[] = [];
  const sp = tideProject;
  // body: runs of six, each run's outlines under its fills (one smooth tube)
  const RUN = 5;
  for (let r0 = 0; r0 < SEGMENTS; r0 += RUN) {
    const run = segs.slice(r0, r0 + RUN + 1).sort((a, b) => a.w.z - b.w.z);
    const runZ = run.reduce((a, s) => a + s.w.z, 0) / run.length;
    run.forEach((s, k) => {
      const wl = water(s.w.x, s.w.z);
      if (wl !== null && s.w.y < wl - s.r * 1.05) return;
      const c = sp(s.w),
        sc = s.r / PIECE.seg;
      const waterY = wl === null ? undefined : sp(v3(s.w.x, wl, s.w.z)).y;
      const dup = s.i === r0 + RUN ? "b" : "";
      out.push({
        key: `line${s.i}${dup}`,
        piece: "seg-line",
        x: c.x,
        y: c.y,
        rot: 0,
        sx: sc,
        sy: sc,
        alpha: 1,
        z: runZ - 0.45 + k * 0.01,
        waterY,
      });
      out.push({
        key: `seg${s.i}${dup}`,
        piece: "seg",
        x: c.x,
        y: c.y,
        rot: 0,
        sx: sc,
        sy: sc,
        alpha: 1,
        z: runZ - 0.2 + k * 0.05,
        waterY,
      });
      const belly = mul(s.up, -1),
        facing = dot(belly, VIEW);
      if (facing > -0.35) {
        const o = sp(belly),
          ol = Math.hypot(o.x, o.y) || 1;
        out.push({
          key: `belly${s.i}${dup}`,
          piece: "belly",
          x: c.x + (o.x / ol) * s.r * 0.62,
          y: c.y + (o.y / ol) * s.r * 0.62,
          rot: 0,
          sx: sc,
          sy: sc,
          alpha: clamp((facing + 0.35) * 1.6),
          z: runZ - 0.18 + k * 0.05,
          waterY,
        });
      }
      if (pal.mark && s.i % 2 === 0 && s.i > 3 && dot(s.up, VIEW) > -0.1) {
        const o = sp(s.up),
          ol = Math.hypot(o.x, o.y) || 1;
        out.push({
          key: `mark${s.i}${dup}`,
          piece: "glow",
          x: c.x + (o.x / ol) * s.r * 0.5,
          y: c.y + (o.y / ol) * s.r * 0.5,
          rot: 0,
          sx: 0.22,
          sy: 0.22,
          alpha: 0.5 + 0.3 * Math.sin(P.clock * 3 - s.i * 0.5),
          z: 0,
          glow: true,
          tint: pal.mark,
        });
      }
    });
  }
  // fins along the back
  const finAt = (
    key: string,
    piece: string,
    from: V3,
    to: V3,
    native: number,
    width: number,
    z: number,
  ) => {
    const a = sp(from),
      b = sp(to);
    const dx = b.x - a.x,
      dy = b.y - a.y,
      l = Math.hypot(dx, dy);
    out.push({
      key,
      piece,
      x: a.x,
      y: a.y,
      rot: Math.atan2(dx, -dy),
      sx: width,
      sy: Math.max(0.05, l / native),
      alpha: 1,
      z,
    });
  };
  for (const s of segs) {
    const f = s.i / (SEGMENTS - 1);
    if (f <= 0.25 || f >= 0.97 || s.i % 2 !== 1) continue;
    const size = 18 + 12 * Math.sin(f * Math.PI);
    const base = add(s.w, mul(s.up, s.r * 0.75));
    const wl = water(base.x, base.z);
    if (wl !== null && base.y < wl) continue;
    const tip = add(add(base, mul(s.up, size)), mul(s.d, -size * 0.7));
    const front = dot(s.up, VIEW) > 0.15;
    finAt(
      `fin${s.i}`,
      "fin",
      base,
      tip,
      PIECE.fin,
      size / 18,
      s.w.z + (front ? 0.5 : -0.5),
    );
  }
  // the tail's fan
  const tail = segs[0];
  const tw = water(tail.w.x, tail.w.z);
  if (tw === null || tail.w.y > tw - 6) {
    const sway = Math.sin(P.clock * 3) * 0.25;
    [-1, -0.35, 0.35, 1].forEach((k, j) => {
      const dir = norm(
        add(
          add(mul(tail.d, -1), mul(tail.up, 0.55 + k * 0.5 + sway)),
          mul(tail.right, k * 0.45),
        ),
      );
      finAt(
        `ray${j}`,
        "ray",
        tail.w,
        add(tail.w, mul(dir, 62)),
        PIECE.ray,
        1,
        tail.w.z - 0.3 - j * 0.001,
      );
    });
  }

  // the head
  const { F, R, U, at } = head;
  let pearlScreen = sp(head.pearl);
  const hz = head.w.z;
  const hw = water(head.w.x, head.w.z);
  if (hw === null || head.w.y > hw - 30) {
    const faceN = dot(F, VIEW);
    const behind = (w: V3) => w.z < hz;
    // mane, horns, cheek frills: behind the head or in front of it
    const maneBehind = behind(add(head.w, mul(F, -1)));
    const backZ = hz - 0.6,
      frontZ = hz + 0.3;
    [-1, -0.5, 0, 0.5, 1].forEach((k, j) => {
      const base = at(
        -12 - (1 - Math.abs(k)) * 4,
        k * 17,
        11 - Math.abs(k) * 7,
      );
      const dir = norm(
        add(
          add(
            mul(F, -1),
            mul(
              U,
              0.28 +
                (1 - Math.abs(k)) * 0.32 +
                Math.sin(P.clock * 2.4 + k * 2) * 0.1,
            ),
          ),
          mul(R, k * 0.95),
        ),
      );
      finAt(
        `mane${j}`,
        "mane",
        base,
        add(base, mul(dir, (34 - Math.abs(k) * 8) * HS)),
        PIECE.mane,
        1,
        maneBehind ? backZ + j * 0.001 : frontZ + j * 0.001,
      );
    });
    // The head: one drawing per view, with the face built on it by the shared
    // construction (boss-vector-face.ts). Eyes, brows, nostrils and mouth each
    // have a front, a three-quarter and a profile drawing; nothing is squeezed.
    const look: EyeLook =
      P.dizzy > 0.5
        ? "dizzy"
        : P.closed > 0.5 || P.lid > 0.92
          ? "shut"
          : P.lid > 0.55
            ? "squint"
            : P.anger > 0.9 && P.lid < 0.15
              ? "wide"
              : "glare";
    const headYaw = Math.atan2(F.x, F.z);
    // No face from behind, with one exception: lying stranded, its head rolls
    // onto its side and the dizzy or shut eye still shows, in profile.
    const lying = P.flat > 0.5 && (look === "dizzy" || look === "shut");
    const shown = lying
      ? Math.sign(headYaw || 1) *
        Math.min(Math.abs(headYaw), (100 * Math.PI) / 180)
      : headYaw;
    const hc = sp(at(4, 0, 4));
    const built = TIDE_FACE.face(
      {
        x: hc.x,
        y: hc.y,
        z: hz,
        yaw: shown,
        pitch: -Math.asin(clamp(F.y, -1, 1)) * 0.6,
        roll: (P.headRoll || 0) * Math.cos(headYaw),
      },
      {
        look,
        brow: P.anger > 0.6 ? "angry" : "calm",
        mouth: P.jaw > 0.4 ? "open" : P.jaw > 0.12 ? "half" : "closed",
      },
    );
    const side = built.side;
    // the keys the battle and its tests know the head by
    const names: Record<string, string> = {
      head: "cran",
      eyen: `eye${side}`,
      eyef: `eye${-side}`,
      brown: `brow${side}`,
      browf: `brow${-side}`,
      glintn: `eyeglint${side}`,
      glintf: `eyeglint${-side}`,
    };
    for (const q of built.placements)
      out.push({ ...q, key: names[q.key] ?? q.key });
    const S = TIDE_SPEC;
    const eyeV = S.lines.eye + built.nod;
    if (look !== "shut" && look !== "dizzy")
      for (const e of built.eyes) {
        const q = built.at(e.u, eyeV);
        out.push({
          key: `eyeglow${e.id === "n" ? side : -side}`,
          piece: "glow",
          x: q.x,
          y: q.y,
          rot: 0,
          sx: 0.5,
          sy: 0.5,
          alpha: phase === 3 ? 0.55 : 0.2 + P.anger * 0.1,
          z: 0,
          glow: true,
          tint: (pal.iris[0] << 16) | (pal.iris[1] << 8) | pal.iris[2],
        });
      }
    // the pearl on its brow (the weak point) and its glow: on the centre
    // line when the face shows, on the crown from behind
    let pearlAt = built.feats.pearl
      ? built.at(built.feats.pearl.u, built.feats.pearl.v)
      : null;
    if (!pearlAt) {
      pearlAt = built.at(0, S.lines.pearl + 2);
      out.push({
        key: "pearl",
        piece: "pearl",
        x: pearlAt.x,
        y: pearlAt.y,
        rot: 0,
        sx: 1,
        sy: 1,
        alpha: 1,
        z: hz + 0.04,
      });
      // from behind, the muzzle is the far side of the head: mostly hidden
      const turn = Math.abs(Math.atan2(Math.sin(shown), Math.cos(shown)));
      const m = built.at(
        tideCentre(S.lines.nose) * Math.sin(turn),
        S.lines.nose,
      );
      for (const key of ["snout", "jaw"])
        out.push({
          key,
          piece: "snout-back",
          x: m.x,
          y: m.y,
          rot: 0,
          sx: side,
          sy: 1,
          alpha: 1,
          z: hz - 0.01,
        });
    }
    pearlScreen = pearlAt;
    const g = P.pearl + P.exposed * 0.8;
    out.push({
      key: "pearlglow",
      piece: "glow",
      x: pearlAt.x,
      y: pearlAt.y,
      rot: 0,
      sx: 0.55 + g * 0.4,
      sy: 0.55 + g * 0.4,
      alpha: clamp(0.25 + g * 0.45),
      z: 0,
      glow: true,
      tint: pal.glow,
    });
    // two short barbels from the sides of the muzzle (thin lines), curling
    // down and away from the mouth: both from the front, the near one once
    // the head has turned
    const nose = built.feats.snout;
    if (nose) {
      const front = built.view === "front";
      for (const k of front ? [-1, 1] : [-1]) {
        const pts: { x: number; y: number }[] = [];
        for (let j = 0; j <= 8; j++) {
          const f = j / 8;
          const wave = Math.sin(P.clock * 2.2 + f * 4 + k) * 2.5 * f;
          const out2 = 15 * Math.sin(f * 2.3) + wave,
            down = 4 + 19 * f - 7 * f * f;
          pts.push(
            front
              ? built.at(nose.u + k * (13 + out2), nose.v + down)
              : built.at(nose.u - 11 - out2, nose.v + 1 + down),
          );
        }
        lines.push({ pts, width: 3.2, color: pal.line, front: true });
        lines.push({ pts, width: 1.7, color: pal.finLight, front: true });
      }
    }
  }
  return {
    placements: out,
    lines,
    segs,
    head,
    headScreen: sp(head.w),
    pearlScreen,
  };
}

// ───────────────────────── a whole picture (briefing diagrams) ─────────────────────────
/** Draw the pieces into one canvas (the atlas), returning each piece's spot. */
export function packPieces(phase: Phase, k: number) {
  const list = tidePieces(phase)
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
export function paintPieces(
  ctx: Ctx,
  spots: ReturnType<typeof packPieces>["spots"],
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

let guideUrls: Partial<Record<"calm" | "exposed", string>> = {};
/**
 * The serpent as an image URL for the briefing diagrams (drawn once per look),
 * risen from the water in three-quarter view; `exposed` lays it stranded.
 * Empty without a canvas (outside a browser).
 */
export function tideGuideImage(exposed = false) {
  const width = 360,
    height = 300,
    k = 0.8,
    cx = 180,
    cy = 230;
  const key = exposed ? "exposed" : "calm";
  const P = tideIdle(1.3, 1, true);
  if (exposed)
    Object.assign(P, {
      flat: 1,
      coil: 0.95,
      humps: 0,
      sway: 0,
      rear: 0,
      dizzy: 1,
      headRoll: 0.55,
      exposed: 1,
      anger: 0,
      lid: 0,
    });
  const yaw = 0.6;
  const placed = tidePlacements(P, yaw, 1, () => (exposed ? null : 0));
  if (
    !guideUrls[key] &&
    typeof document !== "undefined" &&
    typeof document.createElement === "function"
  ) {
    try {
      const pk = 2;
      const packed = packPieces(1, pk);
      const sheet = document.createElement("canvas");
      sheet.width = packed.width;
      sheet.height = Math.max(1, packed.height);
      const sctx = sheet.getContext("2d");
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (sctx && ctx) {
        paintPieces(sctx, packed.spots, pk);
        const spot = new Map(packed.spots.map((s) => [s.piece.name, s]));
        drawPlacements(
          ctx,
          placed,
          (name) => spot.get(name),
          sheet,
          pk,
          k,
          cx,
          cy,
        );
        guideUrls[key] = canvas.toDataURL("image/png");
      }
    } catch {
      /* No drawing surface: the diagram shows no picture. */
    }
  }
  // the crop around it (from the pieces' extents), and where the pearl sits
  const size = new Map(tidePieces(1).map((q) => [q.name, Math.max(q.w, q.h)]));
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
      cx + placed.pearlScreen.x * k,
      cy + placed.pearlScreen.y * k,
    ] as const,
  };
}
/** Forget the drawn guide pictures (tests). */
export function resetTideGuide() {
  guideUrls = {};
}
/** Draw placements onto a canvas from a sheet of pieces (the guide picture). */
function drawPlacements(
  ctx: Ctx,
  placed: ReturnType<typeof tidePlacements>,
  spotOf: (
    name: string,
  ) => { piece: Piece; x: number; y: number; w: number; h: number } | undefined,
  sheet: CanvasImageSource,
  pk: number,
  k: number,
  cx: number,
  cy: number,
) {
  const list = placed.placements
    .filter((p) => !p.glow)
    .sort((a, b) => a.z - b.z);
  const lineFront = placed.lines.filter((l) => l.front),
    lineBack = placed.lines.filter((l) => !l.front);
  const strokeLines = (ls: TideLine[]) => {
    for (const l of ls) {
      ctx.strokeStyle = l.color;
      ctx.lineWidth = l.width * k;
      ctx.lineCap = "round";
      ctx.beginPath();
      l.pts.forEach((p, j) =>
        j
          ? ctx.lineTo(cx + p.x * k, cy + p.y * k)
          : ctx.moveTo(cx + p.x * k, cy + p.y * k),
      );
      ctx.stroke();
    }
  };
  const headZ = placed.head.w.z;
  let backDone = false,
    frontDone = false;
  for (const p of list) {
    if (!backDone && p.z > headZ - 0.6) {
      strokeLines(lineBack);
      backDone = true;
    }
    if (!frontDone && p.z > headZ + 0.07) {
      strokeLines(lineFront);
      frontDone = true;
    }
    const s = spotOf(p.piece);
    if (!s) continue;
    const pw = s.piece.w * pk,
      ph = s.piece.h * pk;
    ctx.save();
    if (p.waterY !== undefined) {
      ctx.beginPath();
      ctx.rect(0, 0, ctx.canvas.width, cy + p.waterY * k);
      ctx.clip();
    }
    ctx.globalAlpha = p.alpha;
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
  if (!backDone) strokeLines(lineBack);
  if (!frontDone) strokeLines(lineFront);
}
