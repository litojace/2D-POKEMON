/**
 * Tidewyrm as vector art: an Eastern water dragon (a long scaly body, antler
 * horns, a beard, gold slit eyes and the pearl on its crown). Pure: the pose
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
  /** An in-between disc's number (1–3) between two segments; none on a segment. */
  mid?: number;
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
function drawEyePiece(ctx: Ctx, k: number, look: EyeLook, pal: TidePalette) {
  // Drawn with the inner corner to the right; brow ridge included.
  const s = { x: 15 * k, y: 15 * k };
  const ew = 10.5 * HS * k,
    eh = 9 * HS * k;
  const anger = look === "squint" ? 0.7 : look === "wide" ? 1 : 0.8;
  const lid = look === "glare" ? 0.25 : look === "wide" ? 0.05 : 0.7;
  if (look === "dizzy") {
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 1.8 * k;
    ctx.beginPath();
    for (let a = 0; a < 9; a += 0.25) {
      const r = a * 0.95 * k;
      const x = s.x + Math.cos(a) * r,
        y = s.y + Math.sin(a) * r * 0.9;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    return;
  }
  if (look === "shut") {
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 2.2 * k;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(s.x - ew, s.y);
    ctx.quadraticCurveTo(s.x, s.y + eh * 0.6, s.x + ew, s.y);
    ctx.stroke();
    return;
  }
  const tilt = -0.28;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(s.x, s.y, ew * 1.1, eh * 0.82, tilt, 0, TAU);
  ctx.fillStyle = "#1a0c06";
  ctx.fill();
  ctx.clip();
  const iris = pal.iris;
  const ig = ctx.createRadialGradient(
    s.x,
    s.y + eh * 0.2,
    0,
    s.x,
    s.y,
    ew * 1.1,
  );
  ig.addColorStop(
    0,
    rgb([(iris[0] + 255) >> 1, (iris[1] + 255) >> 1, (iris[2] + 255) >> 1]),
  );
  ig.addColorStop(1, rgb(iris));
  ctx.fillStyle = ig;
  ctx.beginPath();
  ctx.ellipse(s.x + ew * 0.08, s.y + eh * 0.05, ew * 0.98, eh * 0.9, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#0b0503";
  const slit = clamp(0.32 - anger * 0.14, 0.14, 0.32);
  ctx.beginPath();
  ctx.ellipse(
    s.x + ew * 0.12,
    s.y + eh * 0.05,
    ew * slit,
    eh * 0.78,
    0,
    0,
    TAU,
  );
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(s.x - ew * 0.35, s.y - eh * 0.3, Math.max(1.2, ew * 0.16), 0, TAU);
  ctx.fill();
  const top = s.y - eh - 1,
    lidY = s.y - eh + lid * eh * 2,
    slant = anger * eh * 1.15;
  ctx.fillStyle = pal.mid;
  ctx.beginPath();
  ctx.moveTo(s.x - ew - 2, top);
  ctx.lineTo(s.x + ew + 2, top);
  ctx.lineTo(s.x + ew + 2, lidY + slant);
  ctx.lineTo(s.x - ew - 2, lidY - slant * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = 2 * k;
  ctx.beginPath();
  ctx.moveTo(s.x - ew - 2, lidY - slant * 0.3);
  ctx.lineTo(s.x + ew + 2, lidY + slant);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = 1.8 * k;
  ctx.beginPath();
  ctx.ellipse(s.x, s.y, ew * 1.1, eh * 0.82, tilt, 0, TAU);
  ctx.stroke();
  // the brow ridge, lower at the inner end, with two spikes sweeping back
  const bOut = {
    x: s.x - ew * 1.45,
    y: s.y - eh * 1.25 - (1 - anger) * 2.5 * k,
  };
  const bIn = { x: s.x + ew * 1.0, y: s.y - eh * 0.95 + anger * eh * 0.55 };
  const th = (3.2 + anger * 1.6) * HS * k;
  ctx.fillStyle = pal.dark;
  ctx.lineWidth = 1.4 * k;
  ctx.beginPath();
  ctx.moveTo(bOut.x, bOut.y - th * 0.6);
  ctx.quadraticCurveTo(
    (bOut.x + bIn.x) / 2,
    Math.min(bOut.y, bIn.y) - th * 1.2,
    bIn.x,
    bIn.y - th * 0.4,
  );
  ctx.lineTo(bIn.x, bIn.y + th * 0.5);
  ctx.quadraticCurveTo(
    (bOut.x + bIn.x) / 2,
    Math.min(bOut.y, bIn.y) + th * 0.1,
    bOut.x,
    bOut.y + th * 0.3,
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  for (const [f, l] of [
    [0.05, 1.5],
    [0.35, 1.0],
  ]) {
    const x = lerp(bOut.x, bIn.x, f),
      y = lerp(bOut.y, bIn.y, f) - th * 0.6;
    ctx.beginPath();
    ctx.moveTo(x - ew * 0.18, y + th * 0.3);
    ctx.lineTo(x - ew * 0.75 * l, y - eh * 0.75 * l);
    ctx.lineTo(x + ew * 0.2, y + th * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}
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
  // an antler: a beam with two tines, pointing up, ivory with gold tips
  pieceOf("horn", 26, PIECE.horn + 4, 0.35, 1, (ctx, k) => {
    const b = { x: 9 * k, y: (PIECE.horn + 2) * k };
    const beam = [
      b,
      { x: 10 * k, y: b.y - 16 * k },
      { x: 15 * k, y: b.y - 31 * k },
      { x: 18 * k, y: 3 * k },
    ];
    const tines = [
      [beam[1], { x: 3 * k, y: b.y - 28 * k }],
      [beam[2], { x: 24 * k, y: b.y - 40 * k }],
    ];
    const stroke = (
      pts: { x: number; y: number }[],
      w0: number,
      w1: number,
    ) => {
      for (const pass of [0, 1])
        for (let j = 0; j < pts.length - 1; j++) {
          const wdt = lerp(w0, w1, j / (pts.length - 1)) * k;
          ctx.strokeStyle = pass
            ? j < pts.length - 2
              ? "#f1e2bd"
              : "#ffd27a"
            : pal.line;
          ctx.lineWidth = pass ? wdt : wdt + 3 * k;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(pts[j].x, pts[j].y);
          ctx.lineTo(pts[j + 1].x, pts[j + 1].y);
          ctx.stroke();
        }
    };
    for (const t of tines) stroke(t, 5, 2.5);
    stroke(beam, 9.5, 2.8);
  });
  // the head: two discs, the snout and the jaw (each with an outline piece)
  const skin = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number) => {
    const g = ctx.createLinearGradient(x0, y0, x0 + (x1 - x0) * 0.45, y1);
    g.addColorStop(0, pal.light);
    g.addColorStop(0.5, pal.mid);
    g.addColorStop(1, pal.dark);
    return g;
  };
  const D = PIECE.disc;
  pieceOf("disc", D * 2 + 2, D * 2 + 2, 0.5, 0.5, (ctx, k) => {
    const c = (D + 1) * k;
    ctx.fillStyle = skin(ctx, c - D * k, c - D * k, c + D * k, c + D * k);
    ctx.beginPath();
    ctx.arc(c, c, D * k, 0, TAU);
    ctx.fill();
  });
  pieceOf("disc-line", D * 2 + 6, D * 2 + 6, 0.5, 0.5, (ctx, k) => {
    ctx.fillStyle = pal.line;
    ctx.beginPath();
    ctx.arc((D + 3) * k, (D + 3) * k, (D + 1.8) * k, 0, TAU);
    ctx.fill();
  });
  const sr0 = 15 * HS,
    sr1 = 9 * HS;
  const snoutW = PIECE.snout + sr0 + sr1 + 4,
    snoutH = sr0 * 2 + 4;
  pieceOf("snout", snoutW, snoutH, (sr0 + 2) / snoutW, 0.5, (ctx, k) => {
    wedge(
      ctx,
      k,
      PIECE.snout,
      sr0,
      sr1,
      2,
      skin(ctx, 0, 0, snoutW * k * 0.6, snoutH * k),
    );
    // the scaly ridge down its top
    ctx.strokeStyle = "rgba(10,60,70,0.35)";
    ctx.lineWidth = 1.2 * k;
    for (const f of [0.35, 0.55, 0.75]) {
      ctx.beginPath();
      ctx.arc(
        (sr0 + 2 + PIECE.snout * f) * k,
        (snoutH / 2 - 5) * k,
        4 * HS * k,
        0.15 * Math.PI,
        0.85 * Math.PI,
      );
      ctx.stroke();
    }
  });
  pieceOf(
    "snout-line",
    snoutW + 4,
    snoutH + 4,
    (sr0 + 4) / (snoutW + 4),
    0.5,
    (ctx, k) => wedge(ctx, k, PIECE.snout, sr0 + 1.8, sr1 + 1.8, 2.2, pal.line),
  );
  const jr0 = 14 * HS,
    jr1 = 7.5 * HS;
  const jawW = PIECE.jaw + jr0 + jr1 + 4,
    jawH = jr0 * 2 + 4;
  pieceOf("jaw", jawW, jawH, (jr0 + 2) / jawW, 0.5, (ctx, k) => {
    const g = ctx.createLinearGradient(0, 0, 0, jawH * k);
    g.addColorStop(0, pal.belly);
    g.addColorStop(1, pal.bellyDark);
    wedge(ctx, k, PIECE.jaw, jr0, jr1, 2, g);
  });
  pieceOf(
    "jaw-line",
    jawW + 4,
    jawH + 4,
    (jr0 + 4) / (jawW + 4),
    0.5,
    (ctx, k) => wedge(ctx, k, PIECE.jaw, jr0 + 1.8, jr1 + 1.8, 2.2, pal.line),
  );
  // the inside of the mouth (a dark wedge, opened by scaling it taller)
  pieceOf("mouth", PIECE.jaw, 24, 0, 0.5, (ctx, k) => {
    ctx.fillStyle = "#5a1430";
    ctx.beginPath();
    ctx.moveTo(0, 12 * k);
    ctx.lineTo(PIECE.jaw * k, 0);
    ctx.lineTo(PIECE.jaw * k, 24 * k);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff7aa0";
    ctx.beginPath();
    ctx.ellipse(PIECE.jaw * 0.55 * k, 13 * k, 9 * k, 4.5 * k, 0, 0, TAU);
    ctx.fill();
  });
  for (const look of ["glare", "wide", "squint", "shut", "dizzy"] as EyeLook[])
    pieceOf(
      `eye-${look}`,
      30 * HS,
      26 * HS,
      15 / (30 * HS),
      15 / (26 * HS),
      (ctx, k) => drawEyePiece(ctx, k, look, pal),
    );
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
  pieceOf("fang", 6, 14, 0.5, 0, (ctx, k) => {
    ctx.fillStyle = "#fffaf0";
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 1.1 * k;
    ctx.beginPath();
    ctx.moveTo(0.6 * k, 0.6 * k);
    ctx.lineTo(5.4 * k, 0.6 * k);
    ctx.quadraticCurveTo(4 * k, 8 * k, 3 * k, 13.2 * k);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
  pieceOf("nostril", 8, 6, 0.5, 0.5, (ctx, k) => {
    ctx.fillStyle = pal.line;
    ctx.beginPath();
    ctx.ellipse(4 * k, 3 * k, 3.2 * k, 2 * k, 0, 0, TAU);
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

/** Screen gap between two body discs, in radii, past which an in-between disc fills it. */
export const TIDE_GAP = 0.55;
/** How far the belly may sit off the spine, in radii: its 0.72 r disc stays inside the body. */
const BELLY_ACROSS = 1 - 0.72;

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
    const run = segs.slice(r0, r0 + RUN + 1);
    // Where two discs sit far apart on screen (the neck leaning away from the
    // camera, the thin tail), the outline scallops like a stack of coins: an
    // in-between disc fills the gap.
    for (let n = run.length - 1; n > 0; n--) {
      const a = run[n - 1],
        b = run[n];
      const pa = sp(a.w),
        pb = sp(b.w);
      const gap = Math.hypot(pb.x - pa.x, pb.y - pa.y) / Math.min(a.r, b.r);
      const extra = Math.min(3, Math.ceil(gap / TIDE_GAP) - 1);
      for (let m = extra; m >= 1; m--) {
        const t = m / (extra + 1);
        const right = norm(add(mul(a.right, 1 - t), mul(b.right, t))),
          d = norm(add(mul(a.d, 1 - t), mul(b.d, t)));
        run.splice(n, 0, {
          i: a.i + t,
          w: add(mul(a.w, 1 - t), mul(b.w, t)),
          d,
          r: lerp(a.r, b.r, t),
          right,
          up: norm(cross(right, d)),
          mid: m,
        });
      }
    }
    run.sort((a, b) => a.w.z - b.w.z);
    const runZ = run.reduce((a, s) => a + s.w.z, 0) / run.length;
    // the z steps below were tuned for six discs a run: keep the same span
    const kz = 6 / run.length;
    run.forEach((s, k0) => {
      const k = k0 * kz;
      const wl = water(s.w.x, s.w.z);
      if (wl !== null && s.w.y < wl - s.r * 1.05) return;
      const c = sp(s.w),
        sc = s.r / PIECE.seg;
      const waterY = wl === null ? undefined : sp(v3(s.w.x, wl, s.w.z)).y;
      const dup = s.i === r0 + RUN && !s.mid ? "b" : "";
      const tag = s.mid ? `${Math.floor(s.i)}m${s.mid}` : `${s.i}`;
      out.push({
        key: `line${tag}${dup}`,
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
        key: `seg${tag}${dup}`,
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
      // in-between discs fill the outline; the belly's own discs overlap enough
      if (facing > -0.35 && !s.mid) {
        const o = sp(belly),
          ol = Math.hypot(o.x, o.y) || 1;
        // The belly sits 0.62 r off the disc's centre, past its outline. A
        // neighbouring disc covers what sticks out towards it; anything else
        // would show past the neck as a faint ghost when the serpent turns
        // side-on. So keep the belly (radius 0.72 r) within 0.28 r of the
        // spine between this disc and the neighbour it leans towards.
        const bx = (o.x / ol) * 0.62 * s.r,
          by = (o.y / ol) * 0.62 * s.r;
        let ax = 0,
          ay = 0,
          best = 0;
        for (const j of [s.i - 1, s.i + 1]) {
          if (j < 0 || j >= SEGMENTS) continue;
          const nb = sp(segs[j].w),
            nx = nb.x - c.x,
            ny = nb.y - c.y,
            nl = nx * nx + ny * ny || 1;
          // the nearest point to the belly on the spine towards this neighbour
          const t = clamp((bx * nx + by * ny) / nl);
          if (t * Math.sqrt(nl) > best) {
            best = t * Math.sqrt(nl);
            ax = nx * t;
            ay = ny * t;
          }
        }
        const px = bx - ax,
          py = by - ay,
          pl = Math.hypot(px, py),
          keep = pl > BELLY_ACROSS * s.r ? (BELLY_ACROSS * s.r) / pl : 1;
        out.push({
          key: `belly${tag}${dup}`,
          piece: "belly",
          x: c.x + ax + px * keep,
          y: c.y + ay + py * keep,
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
          key: `mark${tag}${dup}`,
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
        add(base, mul(dir, (50 - Math.abs(k) * 12) * HS)),
        PIECE.mane,
        1,
        maneBehind ? backZ + j * 0.001 : frontZ + j * 0.001,
      );
    });
    [-1, 1].forEach((k) => {
      const base = at(-2, k * 11, 16);
      const tip = add(
        base,
        mul(add(add(mul(F, -45), mul(U, 30)), mul(R, k * 16)), HS),
      );
      finAt(
        `horn${k}`,
        "horn",
        base,
        tip,
        PIECE.horn,
        HS * k,
        maneBehind ? backZ + 0.01 : frontZ + 0.01,
      );
    });
    [-1, 1].forEach((k) => {
      const base = at(-4, k * 18, -5);
      const tip = add(
        base,
        mul(
          norm(
            add(
              add(mul(F, -0.8), mul(R, k * 0.75)),
              mul(U, -0.15 + Math.sin(P.clock * 2 + k) * 0.08),
            ),
          ),
          30 * HS,
        ),
      );
      finAt(
        `frill${k}`,
        "frill",
        base,
        tip,
        PIECE.frill,
        HS,
        behind(tip) ? backZ + 0.02 : frontZ - 0.25,
      );
    });
    // outlines first, then the mouth, the jaw and the head over them
    const disc = (key: string, w: V3, r: number, z: number, piece = "disc") => {
      const c = sp(w);
      out.push({
        key,
        piece,
        x: c.x,
        y: c.y,
        rot: 0,
        sx: r / PIECE.disc,
        sy: r / PIECE.disc,
        alpha: 1,
        z,
      });
    };
    const bar = (
      key: string,
      piece: string,
      from: V3,
      dir: V3,
      length: number,
      z: number,
      sy = 1,
    ) => {
      const a = sp(from),
        b = sp(add(from, mul(dir, length)));
      out.push({
        key,
        piece,
        x: a.x,
        y: a.y,
        rot: Math.atan2(b.y - a.y, b.x - a.x),
        sx: Math.max(0.02, Math.hypot(b.x - a.x, b.y - a.y) / length),
        sy,
        alpha: 1,
        z,
      });
    };
    const cran = at(-6, 0, 4),
      brow = at(12, 0, 9),
      snoutBase = at(14, 0, 4);
    disc("cran-line", cran, 22 * HS, hz - 0.3, "disc-line");
    disc("brow-line", brow, 19 * HS, hz - 0.3, "disc-line");
    bar("snout-line", "snout-line", snoutBase, F, PIECE.snout, hz - 0.3);
    bar("jaw-line", "jaw-line", head.hinge, head.jawDir, PIECE.jaw, hz - 0.3);
    if (P.jaw > 0.05)
      bar(
        "mouth",
        "mouth",
        head.hinge,
        norm(add(F, head.jawDir)),
        PIECE.jaw,
        hz - 0.2,
        clamp(P.jaw * 1.4, 0.2, 1.2),
      );
    bar("jaw", "jaw", head.hinge, head.jawDir, PIECE.jaw, hz - 0.15);
    disc("cran", cran, 22 * HS, hz - 0.1);
    disc("brow", brow, 19 * HS, hz - 0.1);
    bar("snout", "snout", snoutBase, F, PIECE.snout, hz - 0.09);
    // eyes (only the side facing us), with the brow ridge
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
    const mid = sp(at(14, 0, 9));
    const eyes = [-1, 1].map((k) => {
      const w = at(14, k * 13, 9);
      return {
        k,
        w,
        s: sp(w),
        facing: dot(norm(add(mul(F, 0.55), mul(R, k * 0.85))), VIEW),
      };
    });
    for (const e of eyes) {
      if (e.facing <= -0.15) continue;
      const other = eyes.find((o) => o !== e)!;
      const inward =
        other.facing > -0.15
          ? Math.sign(other.s.x - e.s.x) || 1
          : Math.sign(mid.x - e.s.x) || 1;
      const sq = clamp(0.35 + 0.65 * e.facing, 0.3, 1);
      out.push({
        key: `eye${e.k}`,
        piece: `eye-${look}`,
        x: e.s.x,
        y: e.s.y,
        rot: 0,
        sx: sq * inward,
        sy: 1,
        alpha: 1,
        z: hz + 0.05,
      });
      if (look !== "shut" && look !== "dizzy")
        out.push({
          key: `eyeglow${e.k}`,
          piece: "glow",
          x: e.s.x,
          y: e.s.y,
          rot: 0,
          sx: 0.5,
          sy: 0.5,
          alpha: phase === 3 ? 0.55 : 0.2 + P.anger * 0.1,
          z: 0,
          glow: true,
          tint: (pal.iris[0] << 16) | (pal.iris[1] << 8) | pal.iris[2],
        });
    }
    // fangs over the lip, and nostrils on the nose
    const down = sp(mul(U, -1)),
      upS = sp(U);
    const fangRot = (d: { x: number; y: number }) => Math.atan2(-d.x, d.y);
    for (const k of [-1, 1]) {
      if (dot(norm(add(mul(F, 0.4), mul(R, k))), VIEW) < 0.12) continue; // the near side only
      const L = (9 + P.anger * 3) * HS;
      for (const [f, r, u, l, dir] of [
        [39.5, 9.5, -6, L, down],
        [28.5, 11.2, -7, L * 0.5, down],
        [46.5, 7.5, -8, L * 0.55, upS],
      ] as [number, number, number, number, { x: number; y: number }][]) {
        const p = sp(at(f, k * r, u));
        out.push({
          key: `fang${k}${f}`,
          piece: "fang",
          x: p.x,
          y: p.y,
          rot: fangRot(dir),
          sx: HS,
          sy: l / 14,
          alpha: 1,
          z: hz + 0.06,
        });
      }
    }
    if (faceN > -0.2)
      for (const k of [-1, 1]) {
        const n = sp(at(56, k * 5, 9));
        out.push({
          key: `nostril${k}`,
          piece: "nostril",
          x: n.x,
          y: n.y,
          rot: k * 0.5,
          sx: HS,
          sy: HS,
          alpha: clamp(faceN + 0.3),
          z: hz + 0.06,
        });
      }
    // the pearl on its crown (the weak point), and its glow
    if (dot(norm(add(mul(F, 0.4), mul(U, 0.9))), VIEW) > -0.45) {
      const p = sp(head.pearl);
      out.push({
        key: "pearl",
        piece: "pearl",
        x: p.x,
        y: p.y,
        rot: 0,
        sx: 1,
        sy: 1,
        alpha: 1,
        z: hz + 0.08,
      });
      const g = P.pearl + P.exposed * 0.8;
      out.push({
        key: "pearlglow",
        piece: "glow",
        x: p.x,
        y: p.y,
        rot: 0,
        sx: 0.55 + g * 0.4,
        sy: 0.55 + g * 0.4,
        alpha: clamp(0.25 + g * 0.45),
        z: 0,
        glow: true,
        tint: pal.glow,
      });
    }
    // whiskers from the nose, a beard under the chin, the mouth's snarl
    for (const k of [-1, 1]) {
      const b = at(50, k * 7, -1);
      const pts = [sp(b)];
      for (let j = 1; j <= 9; j++) {
        const f = j / 9;
        pts.push(
          sp(
            add(
              b,
              add(
                mul(F, (-f * 46 + 8) * HS),
                add(
                  mul(R, k * (8 + f * 40) * HS),
                  mul(
                    U,
                    (-f * 26 +
                      Math.sin(P.clock * 2.2 + f * 5 + k) * 9 * f +
                      Math.sin(f * 7) * 6 * f) *
                      HS,
                  ),
                ),
              ),
            ),
          ),
        );
      }
      lines.push({
        pts,
        width: 2,
        color: "rgba(255,240,220,0.85)",
        front: !behind(add(b, mul(R, k * 30))),
      });
    }
    if (faceN > -0.5) {
      const ch = at(22, 0, -13);
      for (const k of [-1, 0, 1]) {
        const a = add(ch, mul(R, k * 5 * HS));
        const end = add(
          add(ch, mul(R, k * 9 * HS)),
          add(mul(U, -18 * HS), mul(F, -26 * HS)),
        );
        const sway = Math.sin(P.clock * 2.3 + k) * 4;
        const mA = sp(a),
          mE = sp(end);
        const pts = [
          mA,
          { x: mA.x + sway, y: (mA.y + mE.y) / 2 },
          { x: mE.x + sway, y: mE.y },
        ];
        lines.push({ pts, width: 5.5, color: pal.line, front: true });
        lines.push({
          pts,
          width: 3.4,
          color: k ? pal.belly : pal.bellyDark,
          front: true,
        });
      }
    }
    if (P.jaw < 0.1)
      for (const k of [-1, 1]) {
        if (dot(norm(add(mul(F, 0.2), mul(R, k))), VIEW) < -0.1) continue;
        lines.push({
          pts: [
            sp(at(54, k * 5, -5)),
            sp(at(30, k * 11, -6)),
            sp(at(4, k * 15, -10 - P.anger * 2)),
          ],
          width: 1.8,
          color: pal.line,
          front: true,
        });
      }
  }
  return {
    placements: out,
    lines,
    segs,
    head,
    headScreen: sp(head.w),
    pearlScreen: sp(head.pearl),
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
