/**
 * Somnara, the dream whale, as a 2.5D vector rig (the approved design in
 * demos/boss-faces/src/somnara-rig.js): a sleepy purple whale in a nightcap
 * with a lit cottage on its back. Pure: the pose comes from the battle's
 * state, the body is laid out in 3D, and each drawn piece gets a placement;
 * boss-vector-somnara-rig.ts shows the placements in the battle scene, and the
 * pieces are drawn once per phase into one atlas.
 *
 * The front of the whale is its head. The eyes sit far round on its sides,
 * so the front view shows two narrow eyes near the outline, the side view one
 * full eye, and at three-quarter the far eye is a sliver held against the far
 * outline (the whale's own outline hides its inner corner). The face is built
 * by the shared construction (boss-vector-face.ts, docs/boss-face-drawing.md).
 *
 * Rig units: x right, y up, z towards the camera, from the floor under the
 * boss. Screen = (x, -y + z * 0.65). Yaw 0 faces the camera.
 */
import { nextFacing, turnToward, type Phase } from "./boss-vector-grumble";
import {
  makeFace,
  type EyeView,
  type FaceSpec,
  type FaceView,
} from "./boss-vector-face";

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const gauss = (x: number, s: number) => Math.exp(-(x * x) / (s * s));
interface V3 {
  x: number;
  y: number;
  z: number;
}
export const SOM_TILT = 0.65;
const project = (p: V3) => ({ x: p.x, y: -p.y + p.z * SOM_TILT });
const rotY = (p: V3, a: number): V3 => {
  const c = Math.cos(a),
    s = Math.sin(a);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
};
/** Sort depth of a rig point: nearer the camera, and higher, is in front. */
const depth = (p: V3) => p.z * 0.84 + p.y * 0.3;
/** 0 → 1 → 0 over `dur` seconds after a cast. */
const after = (age: number, dur: number) =>
  age < 0 || age > dur ? 0 : Math.sin((age / dur) * Math.PI);
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ───────────────────────── the face: construction ─────────────────────────
/** Half the whale's width: the unit of the constants below. */
export const SOM_A = 66;
const A = SOM_A;
const TOP = -0.88 * A,
  BOT = 0.86 * A;
const se = (v: number) => {
  const t = clamp(Math.abs((v + 0.01 * A) / (0.87 * A)));
  return Math.pow(1 - Math.pow(t, 2.3), 1 / 2.3);
};
/** The profile: a blunt, rounded brow over a lower jaw that tucks back a little. */
const skull = (v: number) =>
  1.04 * A * se(v) - 0.05 * A * smooth(0.1 * A, 0.7 * A, v);
/** The rounded forehead (the melon) standing out ahead of the skull. */
const melon = (v: number) =>
  0.36 * A * gauss(v + 0.16 * A, 0.5 * A) * se(v * 0.6);
export const somCentre = (v: number) => skull(v) + melon(v);
/**
 * Side on, a whale's head is long: the melon out ahead of the round skull,
 * and the head running back into the body (the back of the side drawing
 * fades into the body under it). At three-quarter the forehead shows a little.
 */
const SIDE_BACK = 1.3 * A;
export function somSkull(view: FaceView, v: number): [number, number] {
  const w = 0.99 * A * se(v);
  if (view === "side") return [-SIDE_BACK * se(v), somCentre(v)];
  if (view === "tq") return [-w, 1.0 * A * se(v) + 0.35 * melon(v)];
  return [-w, w];
}
const LINES = { eye: -0.06 * A, mouth: 0.17 * A };
const EYE: Record<EyeView, { hw: number; hh: number }> = {
  front: { hw: 5.6, hh: 7 },
  near: { hw: 8, hh: 7 },
  far: { hw: 3.3, hh: 6.6 },
  side: { hw: 8.4, hh: 7 },
};
export type SomLook = "idle" | "glare" | "wide" | "hurt" | "dizzy" | "closed";
export type SomMouth = "smile" | "open" | "o" | "grit" | "flat";
export const SOM_LOOKS: SomLook[] = [
  "idle",
  "glare",
  "wide",
  "hurt",
  "dizzy",
  "closed",
];
export const SOM_MOUTHS: SomMouth[] = ["smile", "open", "o", "grit", "flat"];
export interface SomExpr {
  look: SomLook;
  mouth: SomMouth;
  blink: boolean;
}
/** Where the iris sits in an eye drawing (and the highlight on it). */
const eyeGeom = (v: EyeView, look: SomLook) => ({
  r: look === "wide" ? 3 : 3.6,
  gx: v === "far" ? 0.2 : v === "front" ? 0.6 : 1.4,
  gy: look === "wide" ? 0.3 : 1.5,
});
const lookOf = (e: SomExpr): SomLook => (e.blink ? "closed" : e.look);
export const SOM_SPEC: FaceSpec<SomExpr> = {
  A,
  top: TOP,
  bot: BOT,
  lines: LINES,
  eyeAz: 70 * DEG,
  eyeOrbit: 0.9 * A,
  lag: 10 * DEG,
  farLift: 4 * DEG,
  nod: 0.3 * A,
  margin: 0.035 * A,
  eye: EYE,
  centreLine: somCentre,
  skullEdge: somSkull,
  headPiece: (view) => "head_" + view,
  eyePiece: (view, e) => `eye_${view}_${lookOf(e)}`,
  // a highlight on an open (awake) eye only; asleep, the eyes are lines
  glint: (view, e) => {
    const look = lookOf(e);
    if (look !== "glare" && look !== "wide") return null;
    const g = eyeGeom(view, look);
    return { piece: "glint", x: view === "front" ? 0 : g.gx, y: g.gy };
  },
  centre: [
    {
      id: "mouth",
      line: LINES.mouth,
      sideInset: 0.08 * A,
      hw: { front: 0.74 * A, tq: 0.3 * A },
      vspan: [-9, 8],
      piece: (view, e) => `mouth_${view}_${e.mouth}`,
    },
  ],
};
export const SOM_FACE = makeFace<SomExpr>(SOM_SPEC);

// ───────────────────────── the pose ─────────────────────────
export type SomAttack =
  | "lullaby"
  | "tail-splash"
  | "dream-bubbles"
  | "falling-stars"
  | "whale-song"
  | "dream-sequence";
/** What the battle tells the whale this frame. */
export interface SomCue {
  clock: number;
  phase: number;
  reduced: boolean;
  /** The attack being wound up (its warning) and how far (0-1). */
  windKind?: string;
  windup: number;
  /** The last attack cast and how long ago (seconds). */
  castKind?: string;
  castAge?: number;
  /** Seconds since it yawned into a new phase. */
  roarAge?: number;
  /** Woken: the star-heart on its throat is open. */
  exposed: boolean;
  stagger: boolean;
  /** 1 just hit, fading to 0. */
  hurt: number;
  dead: boolean;
  /** Seconds since it was beaten. */
  deadAge?: number;
}
export interface SomPose {
  t: number;
  lift: number;
  pitch: number;
  sway: number;
  roll: number;
  nod: number;
  tail: number;
  flap: number;
  puff: number;
  look: SomLook;
  mouth: SomMouth;
  blink: boolean;
  glow: number;
  bobble: number;
  notes: number;
  bubbles: number;
  alpha: number;
  stars: number;
  sink: number;
  exposed: number;
}
export function somnaraPose(c: SomCue): SomPose {
  const t = c.reduced ? 0 : c.clock,
    m = c.reduced ? 0 : 1;
  const P: SomPose = {
    t,
    lift: Math.sin(t * 1.3) * 5 * m,
    pitch: Math.sin(t * 0.9) * 0.03 * m,
    sway: Math.sin(t * 0.6) * 0.1 * m,
    roll: Math.sin(t * 0.8 + 1) * 0.035 * m,
    nod: 0,
    tail: Math.sin(t * 1.3 - 1) * 0.12 * m,
    flap: Math.sin(t * 1.3) * 0.2 * m,
    puff: 1 + Math.sin(t * 1.3 + 0.5) * 0.012 * m,
    look: "idle",
    mouth: "smile",
    blink: false,
    glow: 0.12 + (clamp(c.phase, 1, 3) - 1) * 0.14,
    bobble: 0,
    notes: 0,
    bubbles: 0,
    alpha: 1,
    stars: 0,
    sink: 0,
    exposed: 0,
  };
  const w = clamp(c.windup || 0),
    kind = c.windKind,
    cast = c.reduced ? undefined : c.castKind,
    age = c.castAge ?? 99;
  const hit = (d: number) => after(age, d);
  // the windup: each attack its own way
  if (kind === "lullaby") {
    P.mouth = w > 0.3 ? "o" : "smile";
    P.notes = w;
    P.roll += Math.sin(t * 3) * 0.05 * w;
  } else if (kind === "tail-splash") {
    P.tail = lerp(P.tail, 0.9, w);
    P.pitch -= 0.1 * w;
    P.look = "glare";
  } else if (kind === "dream-bubbles") {
    P.puff *= 1 + 0.06 * w;
    P.look = "glare";
    P.mouth = w > 0.5 ? "o" : "smile";
    P.bubbles = w * 0.5;
  } else if (kind === "falling-stars") {
    P.pitch += 0.22 * w;
    P.nod = -0.3 * w;
    P.look = w > 0.4 ? "wide" : "glare";
    P.bobble = w;
  } else if (kind === "whale-song") {
    P.pitch += 0.16 * w;
    P.look = "glare";
    P.mouth = w > 0.6 ? "open" : "smile";
    P.puff *= 1 + 0.05 * w;
  } else if (kind === "dream-sequence") {
    P.look = "glare";
    P.bobble = w;
    P.glow = lerp(P.glow, 0.8, w);
    P.roll += 0.06 * w;
  }
  // the cast's follow-through (none with reduced motion)
  if (cast === "lullaby") {
    const a = hit(0.9);
    P.notes = Math.max(P.notes, a);
    if (a > 0.05) P.mouth = "o";
  } else if (cast === "tail-splash") {
    const a = hit(0.5);
    if (age < 0.6) P.tail = lerp(0.9, -0.7, clamp(age / 0.2));
    P.pitch += 0.1 * a;
    if (a > 0.05) {
      P.look = "glare";
      P.mouth = "grit";
    }
  } else if (cast === "dream-bubbles") {
    const a = hit(0.8);
    P.bubbles = Math.max(P.bubbles, a);
    if (a > 0.05) {
      P.look = "closed";
      P.mouth = "o";
    }
  } else if (cast === "falling-stars") {
    const a = hit(0.7);
    P.pitch += 0.2 * a;
    P.nod = -0.3 * a;
    P.bobble = Math.max(P.bobble, a);
    if (a > 0.05) {
      P.look = "wide";
      P.mouth = "o";
    }
  } else if (cast === "whale-song") {
    const a = hit(0.9);
    P.pitch += 0.14 * a;
    P.notes = Math.max(P.notes, a);
    P.puff *= 1 + 0.04 * a;
    if (a > 0.05) {
      P.look = "glare";
      P.mouth = "open";
    }
  }
  if (P.look === "glare" || P.look === "wide") P.blink = !!m && t % 3.1 > 3.0;
  // a great yawn into a new phase
  const roar = c.reduced ? 0 : after(c.roarAge ?? 99, 1.1);
  if (roar > 0.05) {
    P.pitch += 0.2 * roar;
    P.look = "glare";
    P.mouth = "open";
    P.blink = false;
  }
  if (c.exposed && !c.stagger) {
    P.look = "wide";
    P.mouth = "o";
    P.blink = false;
  }
  if (c.exposed || c.stagger) P.exposed = 1;
  if (c.stagger) {
    P.look = "dizzy";
    P.mouth = "flat";
    P.stars = 1;
    P.roll = Math.sin(t * 2.6) * 0.16 * m + (m ? 0 : 0.1);
    P.sway = 0;
    P.sink = 0.35;
    P.blink = false;
  }
  if ((c.hurt || 0) > 0.3 && !c.dead && !c.reduced) {
    P.look = "hurt";
    P.mouth = "grit";
    P.roll += 0.08 * c.hurt;
    P.pitch -= 0.08 * c.hurt;
    P.blink = false;
  }
  if (c.dead) {
    // it sinks into a deep sleep (it stays whole: fading would show its
    // overlapping pieces through each other)
    const d = c.reduced ? 1 : smooth(0, 1, c.deadAge ?? 9);
    P.sink = d;
    P.roll = 0.14 * d;
    P.sway = 0;
    P.pitch = -0.04 * d;
    P.look = "closed";
    P.mouth = "flat";
    P.blink = false;
    P.lift *= 1 - d;
    P.tail = -0.3 * d;
    P.flap = -0.5 * d;
    P.glow = 0.03;
    P.notes = 0;
    P.bubbles = 0;
    P.stars = 0;
    P.exposed = 0;
  }
  return P;
}

/** The facing shown (eight ways, with hysteresis) and the turn towards it. */
export function somTurn(
  angle: number,
  previous: number | undefined,
  yaw: number,
  dt: number,
  snap: boolean,
) {
  const facing = nextFacing(angle, previous);
  const target = (facing * Math.PI) / 4;
  return { facing, yaw: snap ? target : turnToward(yaw, target, dt, 9) };
}

// ───────────────────────── where each piece goes ─────────────────────────
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
}
// The body behind the head: its profile as [z, lift, radius] in units of A,
// sampled closely so the discs melt into one smooth shape.
const PROFILE = [
  [-0.3, 0, 0.97],
  [-0.9, 0.01, 0.92],
  [-1.5, 0.07, 0.78],
  [-2.0, 0.2, 0.58],
  [-2.4, 0.36, 0.4],
  [-2.75, 0.54, 0.27],
];
const SPINE: number[][] = [];
for (let i = 0; i < 18; i++) {
  const f = (i / 17) * (PROFILE.length - 1),
    k = Math.min(PROFILE.length - 2, Math.floor(f)),
    u = f - k;
  SPINE.push(PROFILE[k].map((a, j) => a + (PROFILE[k + 1][j] - a) * u));
}
export const SOM_SPINE = SPINE.length;

/**
 * Every piece's placement for a pose and a yaw (radians, 0 faces the camera).
 * `prevView` is the head view shown last frame (it holds a view near a line).
 */
export function somnaraPlacements(
  P: SomPose,
  yaw: number,
  prevView?: FaceView,
) {
  const list: Placement[] = [];
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
    } = {},
  ) => {
    const s = project(w);
    list.push({
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
    });
  };
  const t = P.t,
    by = yaw + P.sway;
  const base = 1.12 * A + P.lift - P.sink * 0.42 * A;
  const pose = (p: V3) => {
    // pitch about the whale's middle, then turn
    const z0 = -1.1 * A,
      dz = p.z - z0,
      dy = p.y;
    const c = Math.cos(P.pitch),
      s = Math.sin(P.pitch);
    return rotY(
      { x: p.x, y: base + dz * s + dy * c, z: z0 + dz * c - dy * s },
      by,
    );
  };
  const headW = pose({ x: 0, y: 0, z: 0.1 * A });
  const hs = project(headW),
    hz = depth(headW);
  const pts = SPINE.map(([z, up, r]) => ({
    w: pose({
      x: 0,
      y: up * A + Math.max(0, -z - 1.6) * P.tail * 0.5 * A,
      z: z * A,
    }),
    r: r * A * P.puff,
  }));
  const back = Math.min(hz, ...pts.map((p) => depth(p.w))) - 2;
  // The belly shows along the whole body only side-on, as one band drawn over
  // every back; otherwise only the first of the spine carries it.
  const sideOn = Math.abs(Math.sin(by)) > 0.8;
  const front = Math.max(...pts.map((p) => depth(p.w))) + 0.2;
  pts.forEach((p, i) => {
    const k = p.r / (0.95 * A),
      o = { sx: k, sy: k * 0.9 };
    add("spine" + i, "ball", p.w, o);
    // one outline round the whole body: every edge sits behind every back
    add("spine" + i + "e", "ball_e", p.w, { ...o, bias: back - depth(p.w) });
    // light along the top and shade underneath, laid over all the backs at once
    const hi = { ...p.w, y: p.w.y + p.r * 0.5 },
      lo = { ...p.w, y: p.w.y - p.r * 0.42 };
    add("spine" + i + "h", "back_hi", hi, {
      sx: k,
      sy: k * 0.62,
      bias: front - depth(hi),
    });
    add("spine" + i + "s", "back_lo", lo, {
      sx: k,
      sy: k * 0.6,
      bias: front - 0.05 - depth(lo),
    });
    if (sideOn) {
      // side-on, the belly is one band: each disc's cut is turned along the
      // body, so the cuts join into one smooth line
      const a = project(pts[Math.max(0, i - 1)].w),
        b = project(pts[Math.min(pts.length - 1, i + 1)].w);
      let rot = Math.atan2(b.y - a.y, b.x - a.x);
      if (Math.cos(rot) < 0) rot += Math.PI;
      add("belly" + i, "belly", p.w, {
        ...o,
        rot: Math.atan2(Math.sin(rot), Math.cos(rot)),
        bias: front + 0.1 - depth(p.w),
      });
    } else if (i < 3) add("belly" + i, "belly", p.w, { ...o, bias: 0.05 });
  });
  // the fluke, on the last of the spine
  const a = pts[pts.length - 2].w,
    b = pts[pts.length - 1].w;
  const tip = {
    x: b.x + (b.x - a.x) * 0.9,
    y: b.y + (b.y - a.y) * 0.9 + 0.1 * A + P.tail * 0.25 * A,
    z: b.z + (b.z - a.z) * 0.9,
  };
  const sa = project(b),
    sb = project(tip);
  const side = Math.sin(by);
  add("fluke", "fluke", tip, {
    rot:
      Math.atan2(sb.y - sa.y, sb.x - sa.x) +
      Math.PI / 2 +
      P.tail * 0.3 * (side < 0 ? -1 : 1),
    sx: 0.55 + 0.45 * Math.abs(Math.cos(by)),
    bias: -1,
  });
  // flippers
  for (const s of [-1, 1]) {
    const w = pose({ x: s * 0.86 * A, y: -0.42 * A, z: -0.45 * A });
    const facing = s * Math.cos(by) + 0.0001;
    add("flip" + s, "flipper", w, {
      rot:
        (facing > 0 ? 1 : -1) * (0.5 + P.flap * 0.5) +
        (Math.abs(side) > 0.5 ? -side * 0.9 : 0),
      sx: facing > 0 ? 1 : -1,
      bias: 1.5,
    });
  }
  // cottage and cap on its back (they ride on top of the body's light and shade)
  const flop = side < -0.05 ? -1 : 1;
  const onTop = (w: V3, least: number) =>
    Math.max(least, front + 0.6 - depth(w));
  const cot = pose({ x: 0, y: 0.84 * A, z: -1.05 * A }),
    capW = pose({ x: 0, y: 0.8 * A, z: -0.05 * A });
  add("cottage", "cottage", cot, { sx: flop, bias: onTop(cot, 1) });
  add("cap", "cap", capW, {
    sx: flop,
    rot: -flop * 0.12 * P.bobble + Math.sin(t * 1.6) * 0.03,
    bias: onTop(capW, 14) + (Math.cos(by) > 0 ? 1 : 0),
  });
  if (P.bobble > 0.02)
    add(
      "bobble",
      "glow_gold",
      pose({ x: flop * Math.cos(by) * 0.72 * A, y: 1.02 * A, z: 0.1 * A }),
      { glow: true, alpha: P.bobble, bias: 16 },
    );
  // the star-heart on its throat (the weak point), open when it is woken
  const coreW = pose({ x: 0, y: -0.5 * A, z: 0.55 * A });
  const core = project(coreW);
  if (P.exposed > 0.02) {
    add("core", "core", coreW, { alpha: P.exposed, bias: 40 });
    add("coreglow", "glow_gold", coreW, {
      glow: true,
      alpha: P.exposed * (0.7 + 0.3 * Math.sin(t * 6)),
      sx: 1.3,
      sy: 1.3,
    });
  }
  // the head and face
  const face = SOM_FACE.face(
    {
      x: hs.x,
      y: hs.y,
      yaw: by,
      pitch: -P.pitch * 1.4 + P.nod,
      roll: P.roll,
      z: sideOn ? Math.max(hz + 6, front + 0.3) : hz + 6,
      prevView,
    },
    { look: P.look, mouth: P.mouth, blink: P.blink },
  );
  for (const f of face.placements) {
    const q: Placement = { ...f, alpha: f.alpha * P.alpha };
    if (q.piece.startsWith("head_")) {
      q.sx *= P.puff;
      q.sy *= P.puff;
      // the head's outline sits behind every back, like the body's
      list.push({ ...q, key: "heade", piece: q.piece + "_e", z: back - 0.1 });
    }
    list.push(q);
  }
  // notes and bubbles drift up from the mouth
  const mouth = face.feats.mouth;
  if (mouth)
    for (const [n, piece, count] of [
      [P.notes, "note", 4],
      [P.bubbles, "bubble", 5],
    ] as const)
      if (n > 0.02)
        for (let i = 0; i < count; i++) {
          const u = (t * 0.5 + i / count) % 1;
          list.push({
            key: piece + i,
            piece,
            x:
              hs.x +
              mouth.u * face.side * 1.05 +
              Math.sin(t * 2 + i * 2) * 10 +
              face.side * u * 40,
            y: hs.y + mouth.v - u * 80,
            rot: Math.sin(t * 3 + i) * 0.3,
            sx: 0.7 + u * 0.6,
            sy: 0.7 + u * 0.6,
            alpha: n * Math.sin(u * Math.PI) * P.alpha,
            z: hz + 30,
          });
        }
  if (P.glow > 0.02)
    list.push({
      key: "aura",
      piece: "glow_dream",
      x: hs.x,
      y: hs.y,
      rot: 0,
      sx: 5,
      sy: 4,
      alpha: P.glow * 0.8 * P.alpha,
      z: back - 3,
      glow: true,
    });
  // three stars circling a dizzy head
  if (P.stars)
    for (let i = 0; i < 3; i++) {
      const ang = t * 4 + (i * TAU) / 3;
      list.push({
        key: "star" + i,
        piece: "star",
        x: hs.x + Math.cos(ang) * 44,
        y: hs.y - A * 1.5 + Math.sin(ang) * 7,
        rot: ang,
        sx: 1,
        sy: 1,
        alpha: 1,
        z: hz + 20 + (Math.sin(ang) > 0 ? 1 : -1),
      });
    }
  list.sort((p, q) => p.z - q.z);
  return { placements: list, head: hs, view: face.view, core };
}

// ───────────────────────── the drawn pieces ─────────────────────────
type Ctx = CanvasRenderingContext2D;
export interface Piece {
  name: string;
  /** Size in rig units, and the anchor (0-1) its placement point sits on. */
  w: number;
  h: number;
  ox: number;
  oy: number;
  draw: (ctx: Ctx, k: number) => void; // drawn with (0,0) at the top-left, k px per unit
}
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
const grad = (
  c: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: Stop[],
) => {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((s, i) =>
    Array.isArray(s)
      ? g.addColorStop(s[0], s[1])
      : g.addColorStop(i / (stops.length - 1), s),
  );
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
  stops.forEach((s, i) =>
    Array.isArray(s)
      ? g.addColorStop(s[0], s[1])
      : g.addColorStop(i / (stops.length - 1), s),
  );
  return g;
};
const glowPiece = (name: string, rgb: string, size = 44) =>
  pieceOf(name, size, size, 0.5, 0.5, (c) => {
    c.fillStyle = radial(c, 0, 0, 0, size / 2, [
      [0, `rgba(${rgb},0.85)`],
      [0.35, `rgba(${rgb},0.34)`],
      [1, `rgba(${rgb},0)`],
    ]);
    c.fillRect(-size / 2, -size / 2, size, size);
  });
const softPiece = (name: string, color: string, alpha: number, size = 44) =>
  pieceOf(name, size, size, 0.5, 0.5, (c) => {
    c.globalAlpha = alpha;
    c.fillStyle = radial(c, 0, 0, 0, size * 0.45, [color, color + "00"]);
    c.beginPath();
    c.arc(0, 0, size * 0.45, 0, TAU);
    c.fill();
  });

interface SomPalette {
  light: string;
  base: string;
  dark: string;
  edge: string;
  spot: string;
  belly: [string, string, string];
  pleat: string;
  ink: string;
  iris: string;
}
export const SOM_PAL: Record<Phase, SomPalette> = {
  1: {
    light: "#9c86e6",
    base: "#7a63cf",
    dark: "#5a45ad",
    edge: "#33246e",
    spot: "#b9a8f2",
    belly: ["#ffffff", "#efe6ff", "#c9b8ee"],
    pleat: "#b7a3e0",
    ink: "#2a1a55",
    iris: "#e09a2c",
  },
  2: {
    light: "#8f86ee",
    base: "#6c62d6",
    dark: "#4c44b0",
    edge: "#2a2470",
    spot: "#b5b0f8",
    belly: ["#ffffff", "#e8e8ff", "#bcbcf0"],
    pleat: "#a6a6e4",
    ink: "#221c58",
    iris: "#e8a630",
  },
  3: {
    light: "#a070de",
    base: "#7c4ec4",
    dark: "#5a339c",
    edge: "#30175e",
    spot: "#c79cf2",
    belly: ["#fff8ff", "#f0dcff", "#cfa8ea"],
    pleat: "#b990dc",
    ink: "#2a1250",
    iris: "#f08a24",
  },
};
/** Side on, the back of the head melts into the body drawn under it. */
function sideFade(c: Ctx) {
  c.save();
  c.globalCompositeOperation = "destination-in";
  c.fillStyle = grad(c, -1.28 * A, 0, -0.5 * A, 0, ["#ffffff00", "#ffffffff"]);
  c.fillRect(-1.6 * A, TOP - 12, 3.2 * A, BOT - TOP + 24);
  c.restore();
}
/** Purple back over a pale pleated belly, split along the jaw line. */
function whaleSkin(
  c: Ctx,
  path: Path2D,
  pal: SomPalette,
  view: FaceView,
  seed: number,
  part?: "back" | "belly",
) {
  if (part === "back") {
    // one flat colour: the light and shade are laid over the whole body
    c.fillStyle = pal.base;
    c.fill(path);
    return;
  }
  if (part === "belly") {
    // the body's belly: one flat colour below the jaw line, so its discs join
    c.save();
    c.clip(path);
    c.beginPath();
    c.moveTo(1.3 * A, LINES.mouth - 2);
    c.quadraticCurveTo(0.2 * A, LINES.mouth + 9, -1.3 * A, LINES.mouth - 3);
    c.lineTo(-1.3 * A, BOT + 8);
    c.lineTo(1.3 * A, BOT + 8);
    c.closePath();
    c.fillStyle = pal.belly[1];
    c.fill();
    c.restore();
    return;
  }
  c.fillStyle = grad(c, 0, LINES.mouth, 0, BOT, pal.belly);
  c.fill(path);
  c.save();
  c.clip(path);
  // pleats: they fan from the chin from the front, and run back along the belly from the side
  for (let i = -5; i <= 5; i++) {
    c.strokeStyle = pal.pleat;
    c.lineWidth = 1;
    c.globalAlpha = 0.75;
    c.beginPath();
    if (view === "side") {
      const y = LINES.mouth + 8 + (i + 5) * 5;
      c.moveTo(A * 1.4, y - 8);
      c.quadraticCurveTo(0.1 * A, y + 5, -A * 1.4, y - 2);
    } else {
      const k = view === "tq" ? 0.3 * A : 0;
      c.moveTo(k + i * 0.19 * A, LINES.mouth);
      c.quadraticCurveTo(k + i * 0.15 * A, 0.5 * A, k + i * 0.05 * A, BOT + 4);
    }
    c.stroke();
  }
  c.globalAlpha = 1;
  // the purple back, down to the jaw line (which smiles up at the sides)
  c.beginPath();
  c.moveTo(-1.6 * A, TOP - 8);
  c.lineTo(1.6 * A, TOP - 8);
  if (view === "side") {
    // side on, the jaw line runs from the melon's chin back along the head
    c.lineTo(1.6 * A, LINES.mouth - 4);
    c.quadraticCurveTo(0.3 * A, LINES.mouth + 9, -1.6 * A, LINES.mouth - 3);
  } else {
    c.lineTo(1.3 * A, LINES.mouth - 10);
    c.quadraticCurveTo(
      view === "tq" ? 0.4 * A : 0,
      LINES.mouth + 16,
      -1.3 * A,
      LINES.mouth - 10,
    );
  }
  c.closePath();
  c.fillStyle = grad(c, 0, TOP, 0, LINES.mouth + 10, [
    pal.light,
    pal.base,
    pal.dark,
  ]);
  c.fill();
  c.save();
  c.clip();
  const rnd = rng(seed);
  c.fillStyle = pal.spot;
  for (let i = 0; i < 16; i++) {
    const x = (rnd() - 0.5) * 2 * A,
      y = lerp(TOP + 6, LINES.mouth - 4, rnd());
    // keep the eyes' ground clear
    if (
      view !== "back" &&
      view !== "backtq" &&
      Math.abs(y - LINES.eye) < 16 &&
      Math.abs(x) > 0.2 * A &&
      x > -A
    )
      continue;
    c.globalAlpha = 0.5;
    c.beginPath();
    c.ellipse(x, y, 2.5 + rnd() * 3.5, 2 + rnd() * 2.5, 0, 0, TAU);
    c.fill();
  }
  c.restore();
  c.globalAlpha = 0.6; // moonlight along the back
  c.strokeStyle = grad(c, 0, TOP, 0, TOP + 0.5 * A, ["#ffffff", "#ffffff00"]);
  c.lineWidth = 6;
  c.stroke(path);
  c.restore();
  c.globalAlpha = 1;
  if (view === "side") sideFade(c);
}
const outline = (view: FaceView) => {
  const path = new Path2D();
  for (let v = TOP; v <= BOT; v += 1) path.lineTo(somSkull(view, v)[1], v);
  for (let v = BOT; v >= TOP; v -= 1) path.lineTo(somSkull(view, v)[0], v);
  path.closePath();
  return path;
};
function headPieces(view: FaceView, pal: SomPalette) {
  const W = 3.0 * A,
    Hh = 2.05 * A;
  return [
    pieceOf("head_" + view, W, Hh, 0.5, 0.5, (c) =>
      whaleSkin(c, outline(view), pal, view, 3 + view.length),
    ),
    pieceOf("head_" + view + "_e", W, Hh, 0.5, 0.5, (c) => {
      const p = outline(view);
      c.strokeStyle = c.fillStyle = pal.edge;
      c.lineWidth = 4.4;
      c.stroke(p);
      c.fill(p);
      if (view === "side") sideFade(c);
    }),
  ];
}
function eyePiece(view: EyeView, look: SomLook, pal: SomPalette) {
  return pieceOf(`eye_${view}_${look}`, 26, 24, 0.5, 0.5, (c) => {
    const { hw, hh } = EYE[view];
    const face = view === "far" ? -1 : 1;
    if (view === "far") c.scale(-1, 1);
    c.strokeStyle = c.fillStyle = pal.ink;
    c.lineWidth = 2.2;
    const lashes = (x: number, y: number) => {
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x - 2.4, y - 1.6);
      c.moveTo(x + 0.8, y + 1.6);
      c.lineTo(x - 1.4, y + 2.8);
      c.stroke();
    };
    if (look === "idle") {
      // asleep, content
      c.beginPath();
      c.moveTo(-hw * 0.95, -1.4);
      c.quadraticCurveTo(0, hh * 0.85, hw * 0.95, -1.4);
      c.stroke();
      lashes(-hw * 0.95, -1.4);
      return;
    }
    if (look === "closed") {
      c.beginPath();
      c.moveTo(-hw * 0.95, 0.4);
      c.quadraticCurveTo(0, 2.4, hw * 0.95, 1.4);
      c.stroke();
      return;
    }
    if (look === "hurt") {
      c.beginPath();
      c.moveTo(-hw * 0.8, -hh * 0.6);
      c.lineTo(hw * 0.7, 0.2);
      c.lineTo(-hw * 0.8, hh * 0.65);
      c.stroke();
      return;
    }
    const eye = () => {
      c.beginPath();
      c.ellipse(0, 0, hw, hh, 0, 0, TAU);
    };
    if (look === "dizzy") {
      eye();
      c.fillStyle = "#fff6dc";
      c.fill();
      c.lineWidth = 1.2;
      c.stroke();
      c.strokeStyle = "#8a4a16";
      c.lineWidth = 1.3;
      c.beginPath();
      for (let i = 0; i <= 50; i++) {
        const a = (i / 50) * TAU * 2.1,
          r = (i / 50) * 0.72;
        if (i) c.lineTo(Math.cos(a) * r * hw, Math.sin(a) * r * hh);
        else c.moveTo(0, 0);
      }
      c.stroke();
      return;
    }
    // open: half-lidded and drowsy (glare), or startled wide awake
    const lid = look === "wide" ? -hh * 1.3 : -hh * 0.12,
      slope = look === "wide" ? 0 : 0.1;
    const g = eyeGeom(view, look);
    c.save();
    eye();
    c.clip();
    c.fillStyle = "#fff6dc";
    c.fillRect(-13, -12, 26, 24);
    c.fillStyle = pal.iris;
    c.beginPath();
    c.arc(g.gx * face, g.gy, g.r * 1.25, 0, TAU);
    c.fill();
    c.fillStyle = "#3a1a08";
    c.beginPath();
    c.arc(g.gx * face, g.gy, g.r * 0.62, 0, TAU);
    c.fill();
    if (look !== "wide") {
      // the heavy lid
      c.fillStyle = pal.dark;
      c.beginPath();
      c.moveTo(-hw - 2, -hh - 2);
      c.lineTo(hw + 2, -hh - 2);
      c.lineTo(hw + 2, lid + slope * hw);
      c.lineTo(-hw - 2, lid - slope * hw);
      c.closePath();
      c.fill();
    }
    c.restore();
    c.lineWidth = 1.1;
    eye();
    c.stroke();
    c.lineWidth = 2.2;
    if (look === "wide") {
      c.beginPath();
      c.ellipse(0, 0, hw, hh, 0, Math.PI * 1.05, Math.PI * 1.95);
      c.stroke();
    } else {
      c.save();
      c.beginPath();
      c.ellipse(0, 0, hw + 1, hh + 1, 0, 0, TAU);
      c.clip();
      c.beginPath();
      c.moveTo(-hw - 2, lid - slope * (hw + 2));
      c.lineTo(hw + 2, lid + slope * (hw + 2));
      c.stroke();
      c.restore();
      lashes(-hw * 0.98, lid - slope * hw);
    }
  });
}
/**
 * The mouth: one line round the head, drawn from the same control points in
 * every view. The points are replotted (far side shorter at three-quarter,
 * only the near side in profile); the stroke keeps its weight.
 */
function mouthPiece(
  view: "front" | "tq" | "side",
  kind: SomMouth,
  pal: SomPalette,
) {
  const W = 0.74 * A;
  return pieceOf(`mouth_${view}_${kind}`, 2.9 * A, 1.1 * A, 0.62, 0.2, (c) => {
    // side on: from the chin back to just under the eye
    const fx = (x: number) =>
      view === "tq"
        ? x > 0
          ? x * 0.36
          : x * 1.5
        : view === "side"
          ? x > 0
            ? 0
            : x * 1.4
          : x;
    const M = (x: number, y: number) => c.moveTo(fx(x), y),
      Q = (a: number, b: number, x: number, y: number) =>
        c.quadraticCurveTo(fx(a), b, fx(x), y);
    c.strokeStyle = pal.ink;
    c.lineWidth = 1.8;
    const lip = () => {
      M(-W, -9);
      Q(-W * 0.9, 2, -W * 0.45, 5);
      Q(-W * 0.2, 7.6, 0, 7.4);
      if (view !== "side") {
        Q(W * 0.2, 7.6, W * 0.45, 5);
        Q(W * 0.9, 2, W, -9);
      }
    };
    const inside = () => {
      c.fillStyle = grad(c, 0, 0, 0, 0.6 * A, [
        "#f3b2c6",
        "#d77f9f",
        "#a8527a",
      ]);
      c.fill();
      c.stroke();
    };
    c.beginPath();
    if (kind === "smile") {
      lip();
      c.stroke();
    } else if (kind === "flat") {
      M(-W * 0.8, 2);
      Q(-W * 0.4, 6, 0, 4);
      if (view !== "side") Q(W * 0.4, 2, W * 0.8, 4);
      c.stroke();
    } else if (kind === "o") {
      const ox = fx(view === "front" ? 0 : -6);
      c.ellipse(ox, 9, view === "front" ? 10 : 7, 11, 0, 0, TAU);
      inside();
      c.fillStyle = "#7a3058";
      c.beginPath();
      c.ellipse(ox, 10, view === "front" ? 5.5 : 4, 6.5, 0, 0, TAU);
      c.fill();
    } else if (kind === "grit") {
      M(-W * 0.8, -2);
      Q(0, 9, W * 0.8, -2);
      Q(W * 0.8, 6, W * 0.7, 9);
      Q(0, 19, -W * 0.7, 9);
      Q(-W * 0.8, 6, -W * 0.8, -2);
      c.closePath();
      c.fillStyle = "#fffaf2";
      c.fill();
      c.stroke();
      c.lineWidth = 0.9;
      c.beginPath();
      for (let i = -4; i <= 4; i++) {
        M(i * W * 0.17, 1 + (1 - Math.abs(i) / 5) * 4);
        c.lineTo(fx(i * W * 0.17), 9 + (1 - Math.abs(i) / 5) * 7);
      }
      c.stroke();
    } else if (view === "side") {
      // open, side on: the lower jaw drops from its hinge at the mouth's back corner
      const L = W * 1.4;
      c.moveTo(2, 4);
      c.quadraticCurveTo(-L * 0.5, 9, -L, -9);
      c.quadraticCurveTo(-L * 0.62, 0.4 * A, -0.1 * A, 0.56 * A);
      c.quadraticCurveTo(5, 0.36 * A, 2, 4);
      c.closePath();
      inside();
      c.save();
      c.clip();
      c.fillStyle = "#7a3058";
      c.beginPath();
      c.ellipse(-L * 0.55, 0.2 * A, L * 0.32, 0.1 * A, 0.35, 0, TAU);
      c.fill();
      c.fillStyle = "#f7a9bd";
      c.beginPath();
      c.ellipse(-L * 0.32, 0.48 * A, L * 0.34, 0.12 * A, -0.3, 0, TAU);
      c.fill();
      c.restore();
    } else {
      // open: a great yawn, the jaw dropped over the belly
      M(-W, -9);
      Q(-W * 0.9, 2, -W * 0.45, 5);
      Q(0, 9, W * 0.45, 5);
      Q(W * 0.9, 2, W, -9);
      Q(W * 0.95, 0.42 * A, 0, 0.62 * A);
      Q(-W * 0.95, 0.42 * A, -W, -9);
      c.closePath();
      inside();
      c.save();
      c.clip();
      c.fillStyle = "#7a3058";
      c.beginPath();
      c.ellipse(
        fx(0),
        0.24 * A,
        Math.abs(fx(-W * 0.42)) * 0.75 + 4,
        0.12 * A,
        0,
        0,
        TAU,
      );
      c.fill();
      c.fillStyle = "#f7a9bd";
      c.beginPath();
      c.ellipse(
        fx(0),
        0.56 * A,
        Math.abs(fx(-W * 0.5)) * 0.8 + 4,
        0.14 * A,
        0,
        0,
        TAU,
      );
      c.fill();
      c.restore();
    }
  });
}
/** Every piece the rig draws in a phase. */
export function somnaraPieces(phase: Phase): Piece[] {
  const pal = SOM_PAL[phase] ?? SOM_PAL[1];
  const list: Piece[] = [];
  for (const v of ["front", "tq", "side", "backtq", "back"] as FaceView[])
    list.push(...headPieces(v, pal));
  for (const v of ["front", "near", "far", "side"] as EyeView[])
    for (const l of SOM_LOOKS) list.push(eyePiece(v, l, pal));
  for (const v of ["front", "tq", "side"] as const)
    for (const m of SOM_MOUTHS) list.push(mouthPiece(v, m, pal));
  const R = 0.95 * A;
  const disc = () => {
    const p = new Path2D();
    p.ellipse(0, 0, R, R, 0, 0, TAU);
    return p;
  };
  list.push(
    pieceOf("ball", 2.2 * R, 2.2 * R, 0.5, 0.5, (c) =>
      whaleSkin(c, disc(), pal, "back", 21, "back"),
    ),
    pieceOf("belly", 2.2 * R, 2.2 * R, 0.5, 0.5, (c) =>
      whaleSkin(c, disc(), pal, "side", 21, "belly"),
    ),
    pieceOf("ball_e", 2.3 * R, 2.3 * R, 0.5, 0.5, (c) => {
      c.fillStyle = pal.edge;
      c.beginPath();
      c.arc(0, 0, R + 2.2, 0, TAU);
      c.fill();
    }),
    softPiece("back_hi", pal.light, 0.5, 2 * R),
    softPiece("back_lo", pal.dark, 0.5, 2 * R),
    pieceOf("fluke", 2.0 * A, 1.0 * A, 0.5, 0.88, (c) => {
      const p = new Path2D();
      p.moveTo(-7, 6);
      p.bezierCurveTo(
        -0.3 * A,
        0.02 * A,
        -0.72 * A,
        -0.2 * A,
        -0.9 * A,
        -0.64 * A,
      );
      p.bezierCurveTo(-0.52 * A, -0.56 * A, -0.2 * A, -0.5 * A, 0, -0.3 * A);
      p.bezierCurveTo(
        0.2 * A,
        -0.5 * A,
        0.52 * A,
        -0.56 * A,
        0.9 * A,
        -0.64 * A,
      );
      p.bezierCurveTo(0.72 * A, -0.2 * A, 0.3 * A, 0.02 * A, 7, 6);
      p.closePath();
      c.strokeStyle = pal.edge;
      c.lineWidth = 2.2;
      c.stroke(p);
      c.fillStyle = grad(c, 0, -0.64 * A, 0, 6, [
        pal.spot,
        pal.light,
        pal.base,
      ]);
      c.fill(p);
      c.save();
      c.clip(p);
      c.fillStyle = "#ffffff";
      c.globalAlpha = 0.4;
      for (const [x, y, r] of [
        [-22, -16, 3],
        [-38, -26, 2.4],
        [22, -15, 2.8],
        [36, -27, 2.2],
        [-9, -8, 2],
        [10, -6, 1.8],
      ]) {
        c.beginPath();
        c.arc(x, y, r, 0, TAU);
        c.fill();
      }
      c.restore();
    }),
    pieceOf("flipper", 1.0 * A, 0.7 * A, 0.1, 0.25, (c) => {
      const p = new Path2D();
      p.moveTo(-3, -6);
      p.bezierCurveTo(0.3 * A, -0.2 * A, 0.7 * A, 0.1 * A, 0.82 * A, 0.4 * A);
      p.bezierCurveTo(0.5 * A, 0.42 * A, 0.1 * A, 0.3 * A, -5, 8);
      p.closePath();
      c.strokeStyle = pal.edge;
      c.lineWidth = 2.2;
      c.stroke(p);
      c.fillStyle = grad(c, 0, -0.2 * A, 0, 0.42 * A, [
        pal.light,
        pal.base,
        pal.belly[2],
      ]);
      c.fill(p);
    }),
    pieceOf("cap", 1.25 * A, 0.95 * A, 0.42, 0.9, (c) => {
      // a nightcap: fur brim, a cone flopping forward (+x), a gold bobble
      const cone = new Path2D();
      cone.moveTo(-0.3 * A, -4);
      cone.bezierCurveTo(
        -0.28 * A,
        -0.5 * A,
        0.2 * A,
        -0.66 * A,
        0.6 * A,
        -0.4 * A,
      );
      cone.bezierCurveTo(0.4 * A, -0.36 * A, 0.34 * A, -0.2 * A, 0.3 * A, -4);
      cone.closePath();
      c.strokeStyle = pal.edge;
      c.lineWidth = 2;
      c.stroke(cone);
      c.fillStyle = grad(c, 0, -0.62 * A, 0, 0, [
        "#a98cf0",
        "#6f52c8",
        "#4a3396",
      ]);
      c.fill(cone);
      c.fillStyle = "#fff3a8";
      for (const [x, y, r] of [
        [-6, -22, 2.2],
        [10, -30, 1.6],
        [22, -22, 1.3],
      ]) {
        c.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU - Math.PI / 2,
            rr = i % 2 ? r * 0.45 : r;
          c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        c.fill();
      }
      c.beginPath();
      c.arc(0.64 * A, -0.38 * A, 7, 0, TAU);
      c.fillStyle = radial(c, 0.62 * A, -0.41 * A, 1, 8, [
        "#fff2a6",
        "#f2b62e",
        "#c07c12",
      ]);
      c.fill();
      c.strokeStyle = "#8a560a";
      c.lineWidth = 1.2;
      c.stroke();
      const brim = new Path2D();
      for (let i = 0; i < 6; i++) {
        const x = lerp(-0.32 * A, 0.32 * A, i / 5);
        brim.moveTo(x + 8, -1);
        brim.ellipse(x, -1, 8, 6.5, 0, 0, TAU);
      }
      c.strokeStyle = "#8f86b8";
      c.lineWidth = 1.6;
      c.stroke(brim);
      c.fillStyle = grad(c, 0, -8, 0, 6, ["#ffffff", "#e6e0f6"]);
      c.fill(brim);
    }),
    pieceOf("cottage", 1.3 * A, 1.0 * A, 0.5, 0.86, (c) => {
      c.lineWidth = 1.6;
      c.fillStyle = "#c9a074";
      c.strokeStyle = "#5a3a22";
      c.beginPath();
      c.rect(-16, -30, 34, 26);
      c.fill();
      c.stroke();
      c.beginPath();
      c.rect(8, -52, 7, 12); // chimney
      c.fill();
      c.stroke();
      c.fillStyle = "#6a4fb8";
      c.strokeStyle = "#34226e";
      c.beginPath();
      c.moveTo(-22, -29);
      c.lineTo(-2, -48);
      c.lineTo(24, -44);
      c.lineTo(23, -27);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = "#ffd76a";
      c.strokeStyle = "#7a4a12";
      c.beginPath();
      c.roundRect(-9, -24, 12, 13, 2);
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(-3, -24);
      c.lineTo(-3, -11);
      c.moveTo(-9, -17.5);
      c.lineTo(3, -17.5);
      c.stroke();
      const bush = new Path2D();
      for (const [x, y, r] of [
        [-30, -4, 11],
        [-16, -1, 10],
        [0, 0, 11],
        [16, -1, 10],
        [30, -4, 11],
        [-24, -11, 8],
        [25, -11, 8],
      ]) {
        bush.moveTo(x + r, y);
        bush.arc(x, y, r, 0, TAU);
      }
      c.strokeStyle = "#2f5a22";
      c.lineWidth = 1.8;
      c.stroke(bush);
      c.fillStyle = grad(c, 0, -20, 0, 10, ["#9bd05a", "#5f9a34", "#3d7028"]);
      c.fill(bush);
      c.fillStyle = "#fff6fb";
      for (const [x, y] of [
        [-27, -8],
        [-10, -2],
        [8, -4],
        [24, -9],
        [0, 5],
      ]) {
        c.beginPath();
        c.arc(x, y, 2, 0, TAU);
        c.fill();
      }
    }),
    pieceOf("note", 16, 20, 0.5, 0.5, (c) => {
      c.fillStyle = c.strokeStyle = "#ffe9a8";
      c.lineWidth = 1.6;
      c.beginPath();
      c.ellipse(-2, 5, 3.6, 2.8, -0.4, 0, TAU);
      c.fill();
      c.beginPath();
      c.moveTo(1.2, 4.4);
      c.lineTo(1.2, -7);
      c.quadraticCurveTo(5, -6, 6, -2);
      c.stroke();
    }),
    pieceOf("bubble", 18, 18, 0.5, 0.5, (c) => {
      c.fillStyle = "rgba(190,220,255,0.25)";
      c.strokeStyle = "rgba(230,240,255,0.9)";
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(0, 0, 7, 0, TAU);
      c.fill();
      c.stroke();
      c.strokeStyle = "#fff";
      c.beginPath();
      c.arc(0, 0, 4.6, Math.PI * 1.1, Math.PI * 1.5);
      c.stroke();
    }),
    // the star-heart on its throat: a gold star in a pale halo
    pieceOf("core", 30, 30, 0.5, 0.5, (c) => {
      c.fillStyle = "rgba(255,241,194,0.35)";
      c.beginPath();
      c.arc(0, 0, 13, 0, TAU);
      c.fill();
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU - Math.PI / 2,
          r = i % 2 ? 4.6 : 10.5;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath();
      c.fillStyle = radial(c, -2, -3, 0.5, 11, [
        "#fffbe0",
        "#ffdf8d",
        "#e0a432",
      ]);
      c.fill();
      c.strokeStyle = "#a8701a";
      c.lineWidth = 1.2;
      c.stroke();
    }),
    glowPiece("glow_dream", "190,160,255"),
    glowPiece("glow_gold", "255,214,110"),
    // the highlight on an open eye: one drawing, never mirrored
    pieceOf("glint", 9, 9, 0.5, 0.5, (c) => {
      c.fillStyle = "#fff";
      c.beginPath();
      c.arc(-1.1, -1.4, 1, 0, TAU);
      c.fill();
      c.globalAlpha = 0.85;
      c.beginPath();
      c.arc(1.25, 1.2, 0.45, 0, TAU);
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

// ───────────────────────── the atlas ─────────────────────────
/** Lay the pieces out on shelves of one canvas `k` px per unit wide. */
export function packPieces(phase: Phase, k: number) {
  const list = somnaraPieces(phase)
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

// ───────────────────────── a whole picture (briefing diagrams) ─────────────────────────
let guideUrls: Partial<Record<"calm" | "exposed", string>> = {};
/**
 * The whale as an image URL for the briefing diagrams (drawn once per look),
 * at three-quarter; `exposed` shows it woken with its star-heart open. Empty
 * without a canvas (outside a browser).
 */
export function somnaraGuideImage(exposed = false) {
  const width = 420,
    height = 300,
    k = 0.85,
    cx = 210,
    cy = 262;
  const key = exposed ? "exposed" : "calm";
  const P = somnaraPose({
    clock: 0,
    phase: 1,
    reduced: true,
    windup: 0,
    exposed,
    stagger: false,
    hurt: 0,
    dead: false,
  });
  const placed = somnaraPlacements(P, 0.95);
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
  // the crop around it (from the pieces' extents), and where the star-heart sits
  const size = new Map(
    somnaraPieces(1).map((q) => [q.name, Math.max(q.w, q.h)]),
  );
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const q of placed.placements) {
    if (q.glow || q.piece.startsWith("head_")) continue;
    const r =
      ((size.get(q.piece) ?? 0) * Math.max(Math.abs(q.sx), Math.abs(q.sy))) / 2;
    x0 = Math.min(x0, q.x - r);
    x1 = Math.max(x1, q.x + r);
    y0 = Math.min(y0, q.y - r);
    y1 = Math.max(y1, q.y + r);
  }
  // the head drawings are wide canvases: take the head's own outline instead
  const hx = placed.head.x,
    hy = placed.head.y;
  x0 = Math.min(x0, hx - 1.3 * A);
  x1 = Math.max(x1, hx + 1.4 * A);
  y0 = Math.min(y0, hy + TOP);
  y1 = Math.max(y1, hy + BOT);
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
    core: [cx + placed.core.x * k, cy + placed.core.y * k] as const,
  };
}
/** Forget the drawn guide pictures (tests). */
export function resetSomnaraGuide() {
  guideUrls = {};
}
