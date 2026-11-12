/**
 * Emberwing as vector art: a fire phoenix with a raptor's head (fierce amber
 * eyes under a heavy brow ridge, a pale throat, a flame crest and a hooked
 * gold beak), feathered wings and a fan of tail plumes. Pure: the pose from
 * the battle's state (`emberPose`), and where each drawn piece goes on screen
 * this frame (`emberPlacements`). boss-vector-ember-rig.ts draws the pieces
 * once into an atlas and moves images to these placements; the briefing
 * diagram draws the same placements onto a canvas.
 *
 * Ported from the approved demo (demos/boss-faces/src/ember-rig.js); the face
 * is built by the shared construction (boss-vector-face.ts, the method in
 * docs/boss-face-drawing.md). It flies and lands: `flight` 1 is the hover,
 * 0 stands on its legs with the wings folded back.
 *
 * Rig units: x right, y up, z towards the camera, from the boss's spot on the
 * floor. Screen = (x, -y + z * 0.65), as the floor (world-art.ts).
 */
import { nextFacing, turnToward, type Phase } from "./boss-vector-grumble";
import {
  drawEye,
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
type V3 = { x: number; y: number; z: number };
export const EMBER_TILT = 0.65;
const project = (p: V3) => ({ x: p.x, y: -p.y + p.z * EMBER_TILT });
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

// ════════════════════════ the face: construction ════════════════════════
// A raptor's head: narrower than it is tall, a heavy brow ridge shading the
// eyes, the cere and a big hooked beak standing out of the profile, the eyes
// on the sides of the skull and angled forward.
const A = 24;
const TOP = -0.88 * A,
  BOT = 0.8 * A;
const MID = (TOP + BOT) / 2,
  HALF = (BOT - TOP) / 2;
const se = (v: number) => {
  const t = clamp(Math.abs((v - MID) / HALF));
  const e = v > MID ? 1.9 : 2.9;
  return Math.pow(1 - Math.pow(t, e), 1 / e);
};
const LINES = { brow: -0.3 * A, eye: -0.07 * A, beak: 0.26 * A };
/** THE CENTRE LINE: the skull, the brow ridge standing over the eye, then the cere. */
export const emberCentre = (v: number) =>
  A *
  (0.8 * se(v) +
    0.1 * gauss((v - LINES.brow) / A, 0.16) * Math.pow(se(v), 0.5) +
    0.2 * gauss((v - LINES.beak) / A, 0.26) * Math.pow(se(v), 0.4));
const taper = (v: number) => 1 - 0.16 * smooth(MID, BOT, v);
/** The drawn outline of a view at height v: [left, right], turned to screen right. */
export function emberSkull(view: FaceView, v: number): [number, number] {
  const s = se(v);
  if (view === "side") return [-0.9 * A * s, emberCentre(v)];
  if (view === "tq")
    return [
      -0.92 * A * s * taper(v),
      lerp(0.82 * A * s * taper(v), emberCentre(v), 0.5),
    ];
  if (view === "backtq")
    return [-0.95 * A * s, lerp(0.84 * A * s, emberCentre(v), 0.3)];
  return [-0.8 * A * s * taper(v), 0.8 * A * s * taper(v)];
}
export type EmberLook = "idle" | "glare" | "wide" | "hurt" | "dizzy" | "closed";
export type EmberMouth = "closed" | "open";
export interface EmberExpr {
  look: EmberLook;
  mouth: EmberMouth;
}
const LOOKS: EmberLook[] = ["idle", "glare", "wide", "hurt", "dizzy", "closed"];
const EYE: Record<EyeView, { hw: number; hh: number }> = {
  front: { hw: 5.0, hh: 4.8 },
  near: { hw: 5.8, hh: 4.9 },
  far: { hw: 3.9, hh: 4.8 },
  side: { hw: 5.2, hh: 4.9 },
};
type BrowKind = "calm" | "angry" | "raised" | "pinch";
const BROW: Record<EmberLook, BrowKind> = {
  idle: "angry",
  glare: "angry",
  wide: "raised",
  hurt: "pinch",
  dizzy: "raised",
  closed: "calm",
};
/** Where the iris sits in each view's eye (the front eye looks straight out). */
const eyeGeom = (v: EyeView, look: EmberLook) => ({
  r: look === "wide" ? 2.6 : 3.2,
  gx: v === "far" ? 0.2 : v === "front" ? 0 : 1.1,
  gy: look === "wide" ? 0.2 : look === "glare" ? 1.4 : 0.9,
});
const litLook = (look: EmberLook) =>
  look === "idle" || look === "glare" || look === "wide";
export const EMBER_SPEC: FaceSpec<EmberExpr> = {
  A,
  top: TOP,
  bot: BOT,
  lines: LINES,
  eyeAz: 52 * DEG,
  eyeOrbit: 0.74 * A,
  lag: 12 * DEG,
  farLift: 6 * DEG,
  nod: 0.42 * A,
  margin: 0.05 * A,
  tuckCap: 0.35,
  bridgeHalf: 0.5,
  eye: EYE,
  centreLine: emberCentre,
  skullEdge: emberSkull,
  headPiece: (view) => "head_" + view,
  eyePiece: (view, e) => `eye_${view}_${e.look}`,
  glint: (view, e) => {
    if (!litLook(e.look)) return null;
    const g = eyeGeom(view, e.look);
    return { piece: "glint", x: g.gx, y: g.gy };
  },
  brow: (view, e) => ({
    piece: `brow_${view}_${BROW[e.look]}`,
    dx: 0.6,
    dy: e.look === "glare" ? 2 : e.look === "wide" ? -1.2 : 1.1,
  }),
  centre: [
    // the beak: under the near eye at three-quarter so its base tucks the far eye's corner
    {
      id: "beak",
      line: LINES.beak,
      sideInset: 1.5,
      layer: (v) => (v === "tq" ? "mid" : "top"),
      piece: (v, e) => `beak_${v}_${e.mouth === "open" ? "open" : "closed"}`,
    },
  ],
};
export const EMBER_FACE = makeFace<EmberExpr>(EMBER_SPEC);

// ════════════════════════ the pose ════════════════════════
export type EmberAttack =
  | "dive-bomb"
  | "ember-rain"
  | "wing-gust"
  | "flame-ring"
  | "scorched-earth"
  | "heat-mark";
export interface EmberCue {
  clock: number;
  phase: number;
  reduced: boolean;
  /** 1 hovering, 0 standing on its legs (eased by the caller). */
  flight: number;
  windKind?: string;
  windup: number;
  castKind?: string;
  castAge: number;
  /** Grounded by the braziers: the heart open. */
  exposed: boolean;
  /** Dizzy (just crashed, or staggered). */
  stagger: boolean;
  /** 0-1, fading after a hit. */
  hurt: number;
  dead: boolean;
  deadAge: number;
  /** Seconds since a new phase began (its screech). */
  roarAge: number;
}
export interface EmberPose {
  t: number;
  flight: number;
  lift: number;
  pitch: number;
  wing: number;
  sweep: number;
  tail: number;
  tuck: number;
  headYaw: number;
  headPitch: number;
  headRoll: number;
  look: EmberLook;
  mouth: EmberMouth;
  blink: boolean;
  eyeGlow: number;
  flare: number;
  alpha: number;
  stars: number;
  drop: number;
  exposed: number;
}
/** The pose for a moment of battle. Reduced motion holds still but windups. */
export function emberPose(c: EmberCue): EmberPose {
  const t = c.reduced ? 0 : c.clock,
    m = c.reduced ? 0 : 1;
  const beat = Math.sin(t * 3.2);
  const fl = clamp(c.flight);
  const P: EmberPose = {
    t,
    flight: fl,
    lift: Math.sin(t * 3.2 - 1) * 5 * m,
    pitch: 0,
    wing: 0.75 + beat * 0.28 * m,
    sweep: 0,
    tail: 0,
    tuck: 0.6,
    headYaw: (Math.sin(t * 0.8) * 0.16 + Math.sin(t * 2.3) * 0.04) * m,
    headPitch: Math.sin(t * 1.5) * 0.06 * m,
    headRoll: Math.sin(t * 1.1 + 1) * 0.05 * m,
    look: "idle",
    mouth: "closed",
    blink: !!m && t % 3.4 > 3.28,
    eyeGlow: 0.2 + (c.phase - 1) * 0.16,
    flare: (c.phase - 1) * 0.3,
    alpha: 1,
    stars: 0,
    drop: 0,
    exposed: 0,
  };
  const w = clamp(c.windup || 0),
    kind = c.windKind,
    age = c.castAge,
    cast = c.reduced ? undefined : c.castKind;
  const hit = (d: number) => after(age, d);
  if (kind) P.look = "glare";
  if (kind === "dive-bomb") {
    P.lift += 26 * w;
    P.wing = lerp(P.wing, 1.25, w);
    P.pitch = 0.25 * w;
    P.headPitch += 0.2 * w;
  } else if (kind === "ember-rain") {
    P.wing = lerp(P.wing, 1.15, w);
    P.headPitch -= 0.3 * w;
    P.mouth = w > 0.5 ? "open" : "closed";
    P.flare = Math.max(P.flare, w);
  } else if (kind === "wing-gust") {
    P.wing = lerp(P.wing, 1.3, w);
    P.sweep = -0.5 * w;
    P.pitch = -0.15 * w;
  } else if (kind === "flame-ring") {
    P.wing = lerp(P.wing, 0.35, w);
    P.flare = Math.max(P.flare, w);
    P.tail = w;
  } else if (kind === "scorched-earth") {
    P.lift -= 18 * w;
    P.wing = lerp(P.wing, 0.3, w);
    P.pitch = 0.2 * w;
    P.headPitch += 0.15 * w;
  } else if (kind === "heat-mark") {
    P.eyeGlow = lerp(P.eyeGlow, 1, w);
    P.headPitch += 0.12 * w;
    P.wing = lerp(P.wing, 0.9, w);
  }
  if (cast === "dive-bomb") {
    const a = hit(0.55);
    P.lift -= 30 * a;
    P.wing = lerp(P.wing, 1.1, a);
    P.sweep = 0.9 * a;
    P.pitch = 0.45 * a;
    P.headPitch += 0.2 * a;
    if (a > 0.05) ((P.look = "glare"), (P.mouth = "open"));
  } else if (cast === "ember-rain") {
    const a = hit(0.8);
    P.wing = lerp(P.wing, 1.2, a);
    P.headPitch -= 0.3 * a;
    P.flare = Math.max(P.flare, a);
    if (a > 0.05) ((P.look = "glare"), (P.mouth = "open"));
  } else if (cast === "wing-gust") {
    const a = hit(0.45);
    if (age < 0.6) P.wing = lerp(1.3, -0.05, clamp(age / 0.2));
    P.sweep = 0.6 * a;
    if (a > 0.05) ((P.look = "glare"), (P.mouth = "open"));
  } else if (cast === "flame-ring") {
    const a = hit(0.7);
    P.wing = lerp(P.wing, 1.1, a);
    P.flare = Math.max(P.flare, a);
    P.tail = a;
    if (a > 0.05) ((P.look = "glare"), (P.mouth = "open"));
  } else if (cast === "scorched-earth") {
    const a = hit(0.7);
    P.lift -= 20 * a;
    P.wing = lerp(P.wing, 0.25, a);
    P.sweep = 0.5 * a;
    P.pitch = 0.25 * a;
    if (a > 0.05) ((P.look = "glare"), (P.mouth = "open"));
  } else if (cast === "heat-mark") {
    const a = hit(0.6);
    P.eyeGlow = Math.max(P.eyeGlow, a);
    if (a > 0.05) P.look = "glare";
  }
  const roar = c.reduced ? 0 : after(c.roarAge, 1.1);
  if (roar > 0.05) {
    P.wing = lerp(P.wing, 1.25, roar);
    P.headPitch -= 0.25 * roar;
    P.look = "glare";
    P.mouth = "open";
    P.flare = Math.max(P.flare, roar);
  }
  if (c.exposed) {
    P.exposed = 1;
    if (!c.stagger) {
      P.look = "wide";
      P.mouth = "open";
      P.wing = Math.min(P.wing, 0.15);
      P.drop = 0.5;
    }
  }
  if (c.stagger) {
    P.look = "dizzy";
    P.mouth = "open";
    P.stars = 1;
    P.headRoll = Math.sin(c.clock * 3) * 0.3 * m + (m ? 0 : 0.2);
    P.headYaw = 0;
    P.wing = 0.05 + Math.sin(c.clock * 5) * 0.06 * m;
    P.drop = 0.75;
    P.blink = false;
  }
  if (c.hurt > 0.3 && !c.dead && !c.reduced) {
    P.look = "hurt";
    P.mouth = "open";
    P.headPitch -= 0.2 * c.hurt;
    P.headRoll += 0.14 * c.hurt;
    P.blink = false;
  }
  if (c.dead) {
    // it falls and fades to grey ash
    const d = c.reduced ? 1 : smooth(0, 0.9, c.deadAge);
    P.drop = d * 1.05;
    P.wing = lerp(P.wing, -0.2, d);
    P.headRoll = 0.3 * d;
    P.headYaw = 0;
    P.headPitch = 0.2 * d;
    P.look = "closed";
    P.mouth = "closed";
    P.blink = false;
    P.lift *= 1 - d;
    P.eyeGlow = 0;
    P.flare = 0;
    P.tuck = 0;
    P.exposed = 0;
    P.stars = 0;
    P.alpha = c.reduced
      ? 0.35
      : Math.max(0.25, 1 - smooth(0.6, 2.4, c.deadAge) * 0.75);
  }
  return P;
}
/** The facing shown (eight ways, with hysteresis) and the turn towards it. */
export function emberTurn(
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

// ════════════════════════ the body ════════════════════════
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
/** A long piece laid from 3D point a towards b: its rotation and stretch. */
function along(a: V3, b: V3, nominal: number, min = 0.5, max = 1.12) {
  const sa = project(a),
    sb = project(b);
  const len = Math.hypot(sb.x - sa.x, sb.y - sa.y),
    rot = Math.atan2(sb.y - sa.y, sb.x - sa.x);
  return {
    rot,
    sx: clamp(len / nominal, min, max),
    sy: Math.cos(rot) < 0 ? -1 : 1,
  };
}
/** Where the body sits above the floor: hovering, or standing on its legs. */
const GROUND_BASE = 60;
export function emberPlacements(
  P: EmberPose,
  yaw: number,
  phase: Phase,
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
    fl = P.flight;
  // landed, it stands on its legs with its wings folded back along the body
  const base = lerp(GROUND_BASE, 82 + P.lift, fl) - P.drop * lerp(18, 52, fl);
  const pitch = P.pitch * fl;
  const pose = (p: V3) => {
    // pitch about the body's centre (nose down is +), then turn
    const c = Math.cos(pitch),
      s = Math.sin(pitch);
    return rotY(
      { x: p.x, y: base + p.y * c - p.z * s, z: p.z * c + p.y * s },
      yaw,
    );
  };
  const body = pose({ x: 0, y: 0, z: 0 });
  add("body", "body", body);
  const coreW = pose({ x: 0, y: 0, z: 17 });
  add("chest", "chest", coreW, { sx: 0.85, sy: 0.85, bias: 4 });
  // Wings: out, up and swept back; the flap is the raise angle. From the side
  // a wing is shown broadside (never squeezed to a sliver): the near wing
  // lies over the body, and the far wing takes the near wing's line, a
  // little more raised, behind the body. Landed, they fold back and down.
  const sinY = Math.sin(yaw),
    sideOn = smooth(0.62, 0.95, Math.abs(sinY));
  // (seen from the camera, "back" rises up the screen: folded wings hang
  // mostly down along the flanks, only a little back)
  const raise = lerp(-1.05, P.wing, fl),
    swing = lerp(0.45, P.sweep, fl);
  const wings = [-1, 1].map((s) => {
    const sh = pose({ x: s * 20, y: 14, z: -3 });
    const r = raise + Math.sin(t * 3.2 + s * 0.2) * 0.02 * fl,
      sw = 0.6 + swing * 0.8;
    const d = {
      x: s * Math.cos(r) * Math.cos(sw),
      y: Math.sin(r),
      z: -Math.cos(r) * Math.sin(sw) - 0.15,
    };
    const tip = pose({
      x: s * 20 + d.x * 112,
      y: 14 + d.y * 112,
      z: -3 + d.z * 112,
    });
    return {
      s,
      sh,
      o: along(sh, tip, 112, lerp(0.5, 0.66, fl), lerp(0.72, 1.05, fl)),
      near: -s * sinY > 0,
    };
  });
  const nearW = wings.find((w) => w.near) ?? wings[0];
  for (const w of wings) {
    let { rot, sx, sy } = w.o,
      bias = -1.5;
    if (sideOn > 0) {
      if (w.near) bias = lerp(-1.5, 5, sideOn);
      else {
        const want = nearW.o.rot + 0.32 * Math.sign(sinY);
        rot += Math.atan2(Math.sin(want - rot), Math.cos(want - rot)) * sideOn;
        sx = lerp(sx, nearW.o.sx * 0.94, sideOn);
        if (sideOn > 0.5) sy = nearW.o.sy;
        bias = lerp(-1.5, -7, sideOn);
      }
    }
    // at three-quarter the far wing would stand straight up behind the head
    // (the camera looks down its length): lean it out to its own side
    if (!w.near) {
      const tq = (1 - sideOn) * smooth(0.2, 0.6, Math.abs(sinY));
      rot += 0.42 * Math.sign(sinY) * tq;
      sx *= 1 - 0.1 * tq;
    }
    add("wing" + w.s, "wing", w.sh, { rot, sx, sy, bias });
  }
  // tail plumes, trailing behind and below
  for (let i = -2; i <= 2; i++) {
    const root = pose({ x: i * 5, y: -12, z: -24 });
    const sway = Math.sin(t * 2.6 + i * 0.8) * 7;
    const tip = pose({
      x: i * (24 + P.tail * 16) + sway,
      y: -12 - 26 + Math.abs(i) * 6 + P.tail * 22 + (1 - fl) * 14,
      z: -24 - 78 + Math.abs(i) * 10,
    });
    add("plume" + i, "plume", root, {
      ...along(root, tip, 82, 0.5, 1.1),
      bias: -3 - Math.abs(i) * 0.1,
    });
  }
  const tuck = P.tuck * fl;
  for (const s of [-1, 1])
    add("leg" + s, "leg", pose({ x: s * 11, y: -20, z: 6 + tuck * 4 }), {
      sx: s * (Math.cos(yaw) < 0 ? -1 : 1),
      sy: 1 - 0.3 * tuck,
      rot: tuck * 0.25 * s,
      bias: 1,
    });
  // the fire around it from phase 2, and while it casts (kept small: an
  // additive glow costs fill on every pixel it covers)
  if (P.flare > 0.02)
    add("aura", "glow_fire", body, {
      glow: true,
      alpha: P.flare * 0.55,
      sx: 3.6,
      sy: 3,
      bias: -12,
    });
  // head
  const headW = pose({ x: 0, y: 36, z: 13 });
  const hs = project(headW),
    hz = depth(headW) + 8;
  const look: EmberLook = P.blink ? "closed" : P.look;
  const built = EMBER_FACE.face(
    {
      x: hs.x,
      y: hs.y,
      z: hz,
      yaw: yaw + P.headYaw,
      pitch: P.headPitch + pitch * 0.4,
      roll: P.headRoll,
      prevView,
    },
    { look, mouth: P.mouth },
  );
  for (const f of built.placements)
    list.push({ ...f, alpha: f.alpha * P.alpha, key: "f-" + f.key });
  // the eyes glow
  if (litLook(look) && P.eyeGlow > 0.01)
    for (const e of built.eyes) {
      const q = built.at(e.u, EMBER_SPEC.lines.eye + built.nod);
      list.push({
        key: "f-eg" + e.id,
        piece: "glow_fire",
        x: q.x,
        y: q.y,
        rot: 0,
        sx: (e.g.hw / EYE.front.hw) * 0.7,
        sy: (e.g.hw / EYE.front.hw) * 0.7,
        alpha: P.eyeGlow * P.alpha,
        z: 0,
        glow: true,
      });
    }
  // stars circling a dizzy head
  if (P.stars)
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + (i * TAU) / 3;
      list.push({
        key: "star" + i,
        piece: "star",
        x: hs.x + Math.cos(a) * 26,
        y: hs.y - A * 1.7 + Math.sin(a) * 7,
        rot: a,
        sx: 1,
        sy: 1,
        alpha: 1,
        z: hz + (Math.sin(a) > 0 ? 1 : -1),
      });
    }
  list.sort((p, q) => p.z - q.z);
  return {
    placements: list,
    view: built.view,
    headScreen: hs,
    coreScreen: project(coreW),
    /** The shadow on the floor: [rx, ry]. */
    shadow: [lerp(64, 56, fl) - P.lift * 0.3 * fl, lerp(18, 15, fl)] as const,
  };
}

// ════════════════════════ the pieces (drawn once) ════════════════════════
type Ctx = CanvasRenderingContext2D;
export interface Piece {
  name: string;
  /** Size in rig units, and the anchor (0-1) its placement point sits on. */
  w: number;
  h: number;
  ox: number;
  oy: number;
  draw: (ctx: Ctx, k: number) => void; // (0,0) at the top-left, k px per unit
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
/** A curved tuft (feather, flame): base at (x, y), tip `len` along `ang`. */
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
type Stop = string | [number, string];
const addStops = (g: CanvasGradient, stops: Stop[]) =>
  stops.forEach((s, i) =>
    Array.isArray(s)
      ? g.addColorStop(s[0], s[1])
      : g.addColorStop(i / (stops.length - 1), s),
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
  addStops(g, stops);
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
  addStops(g, stops);
  return g;
};
interface Plumage {
  edge: string;
  light: string;
  base: string;
  dark: string;
  rim: string;
}
/** Outline, fill, then light a soft shape: rim light on top, strands inside. */
function paintSoft(
  c: Ctx,
  path: Path2D,
  pal: Plumage,
  top: number,
  bot: number,
  o: {
    edge?: number;
    strands?: number;
    x0?: number;
    x1?: number;
    seed?: number;
    keep?: (x: number, y: number) => boolean;
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
  c.globalAlpha = 0.75;
  c.lineWidth = (o.edge ?? 2) + 2.4;
  c.stroke(path);
  if (o.strands) {
    const rnd = rng(o.seed ?? 7);
    for (let i = 0; i < o.strands; i++) {
      const x = lerp(o.x0 ?? 0, o.x1 ?? 0, rnd()),
        y = lerp(top, bot, rnd());
      const a = Math.PI / 2 + (rnd() - 0.5) * 0.9,
        l = 2.5 + rnd() * 3;
      if (o.keep && !o.keep(x, y)) continue;
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
/** A brow: a tapered stroke, inner end at +x. s = [outer y, mid y, inner y, thickness]. */
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
const BROWS: Record<BrowKind, number[]> = {
  calm: [0.5, -0.9, 0.4, 1.0, 0.4],
  angry: [-1.9, -0.5, 1.9, 1.9, 0.9],
  raised: [0.6, -1.9, 0.2, 1.1, 0.6],
  pinch: [1.3, 0.3, -1.5, 1.5, 0.85],
};
export interface EmberPalette extends Plumage {
  cream: [string, string, string];
  tip: string;
  crest: [string, string, string];
  ink: string;
}
export const EMBER: Record<Phase, EmberPalette> = {
  1: {
    light: "#ffb23c",
    base: "#f6781c",
    dark: "#d8431a",
    edge: "#7a1d0b",
    rim: "#ffe07a",
    cream: ["#fffaf0", "#fde8ba", "#f1c88a"],
    tip: "#ffe65a",
    crest: ["#ffe66a", "#ff9a26", "#e2371c"],
    ink: "#2a0d08",
  },
  2: {
    light: "#ffbe3e",
    base: "#fa6a16",
    dark: "#d23614",
    edge: "#701608",
    rim: "#fff08a",
    cream: ["#fffaf0", "#ffe6b0", "#f4c07c"],
    tip: "#fff06a",
    crest: ["#fff27a", "#ff8a1c", "#dc2a14"],
    ink: "#2a0d08",
  },
  3: {
    light: "#ffc94a",
    base: "#ff5a10",
    dark: "#c8220e",
    edge: "#660e06",
    rim: "#fff8a8",
    cream: ["#fffbea", "#ffe0a0", "#f6b468"],
    tip: "#fffa8a",
    crest: ["#fffc9a", "#ff7a14", "#d01c10"],
    ink: "#2a0a06",
  },
};
function headPiece(view: FaceView, pal: EmberPalette) {
  return pieceOf("head_" + view, 3.4 * A, 3.7 * A, 0.5, 0.6, (c) => {
    const faceSide = view === "front" || view === "tq" || view === "side";
    // the flame crest, behind the skull
    const crest = new Path2D();
    const F = (
      x: number,
      y: number,
      deg: number,
      len: number,
      w: number,
      bend: number,
    ) => tuft(crest, x * A, y * A, deg * DEG, len * A, w * A, bend);
    if (view === "front" || view === "back") {
      F(-0.42, -0.72, -112, 0.62, 0.17, -0.25);
      F(-0.18, -0.84, -100, 0.86, 0.2, -0.22);
      F(0.08, -0.88, -86, 1.12, 0.22, 0.25);
      F(0.34, -0.8, -72, 0.74, 0.18, 0.28);
      F(0.56, -0.62, -60, 0.5, 0.15, 0.3);
    } else {
      const k = view === "backtq" ? -1 : 1;
      F(k * 0.2, -0.84, -90 - k * 14, 0.7, 0.18, -k * 0.25);
      F(-k * 0.04, -0.88, -90 - k * 26, 1.05, 0.22, -k * 0.3);
      F(-k * 0.3, -0.84, -90 - k * 42, 0.9, 0.2, -k * 0.3);
      F(-k * 0.56, -0.7, -90 - k * 58, 0.66, 0.17, -k * 0.3);
    }
    c.strokeStyle = pal.edge;
    c.lineWidth = 1.8;
    c.stroke(crest);
    c.fillStyle = grad(c, 0, -2.0 * A, 0, -0.7 * A, pal.crest);
    c.fill(crest);
    // the skull, with its feather fringe and cheek tufts
    const pts: { x: number; y: number }[] = [];
    for (let v = TOP; v <= BOT; v += 1)
      pts.push({ x: emberSkull(view, v)[1], y: v });
    for (let v = BOT; v >= TOP; v -= 1)
      pts.push({ x: emberSkull(view, v)[0], y: v });
    const path = new Path2D();
    furPath(path, pts, {
      seed: 5 + view.length,
      tooth: 5,
      depth: 0.75,
      mask: (x, y) =>
        (view === "side" || view === "tq") && x > 0.3 * A && y > TOP * 0.6
          ? 0.1
          : 1,
    });
    const T = (
      x: number,
      y: number,
      deg: number,
      len: number,
      w: number,
      bend: number,
    ) => tuft(path, x * A, y * A, deg * DEG, len * A, w * A, bend);
    if (view === "front" || view === "back")
      for (const s of [-1, 1]) {
        T(s * 0.92, 0.1, 90 - s * 70, 0.34, 0.13, s * 0.25);
        T(s * 0.9, 0.3, 90 - s * 54, 0.4, 0.14, s * 0.22);
        T(s * 0.76, 0.5, 90 - s * 36, 0.3, 0.12, s * 0.2);
      }
    else if (view === "tq" || view === "backtq") {
      const k = view === "tq" ? -1 : 1;
      T(k * 0.94, 0.1, 90 + k * -72, 0.36, 0.13, k * 0.25);
      T(k * 0.9, 0.32, 90 - k * 54, 0.42, 0.14, k * 0.22);
      T(k * 0.74, 0.52, 90 - k * 34, 0.32, 0.12, k * 0.2);
      T(-k * 0.8, 0.46, 90 + k * 40, 0.2, 0.1, -k * 0.2);
    } else {
      T(-0.6, 0.24, 160, 0.36, 0.14, -0.25);
      T(-0.44, 0.46, 140, 0.4, 0.14, -0.22);
      T(-0.2, 0.62, 118, 0.3, 0.12, -0.2);
    }
    paintSoft(c, path, pal, TOP - 2, BOT + 6, {
      edge: 1.9,
      strands: 60,
      x0: -1.2 * A,
      x1: 1.2 * A,
      seed: 9,
      keep: (_x, y) => !faceSide || y < LINES.eye - 0.1 * A,
      inside: (cc) => {
        if (!faceSide) return;
        // the pale throat: a soft cream patch under the beak
        const tx = view === "front" ? 0 : view === "tq" ? 0.3 * A : 0.32 * A;
        cc.save();
        cc.translate(tx, 0.64 * A);
        cc.scale(1, 0.62);
        cc.fillStyle = radial(cc, 0, 0, 0.1 * A, 0.5 * A, [
          [0, pal.cream[0]],
          [0.6, pal.cream[1]],
          [1, pal.cream[1] + "00"],
        ]);
        cc.beginPath();
        cc.arc(0, 0, 0.5 * A, 0, TAU);
        cc.fill();
        cc.restore();
        // fine chevrons on the throat, as on the chest
        cc.strokeStyle = pal.cream[2];
        cc.lineWidth = 0.7;
        cc.globalAlpha = 0.6;
        for (let r = 0; r < 2; r++)
          for (let i = -1; i <= 1; i++) {
            cc.beginPath();
            cc.arc(
              tx + (i * 0.16 + (r % 2) * 0.08) * A,
              (0.62 + r * 0.1) * A,
              0.06 * A,
              0.3,
              Math.PI - 0.3,
            );
            cc.stroke();
          }
        cc.globalAlpha = 1;
      },
    });
  });
}
function eyePiece(view: EyeView, look: EmberLook, pal: EmberPalette) {
  return pieceOf(`eye_${view}_${look}`, 24, 22, 0.5, 0.5, (c) => {
    const { hw, hh } = EYE[view],
      g = eyeGeom(view, look),
      face = view === "far" ? -1 : 1;
    if (view === "far") c.scale(-1, 1);
    if (look === "hurt") {
      // squeezed shut: a chevron pointing in
      c.strokeStyle = pal.ink;
      c.lineWidth = 2.1;
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
      weight: 2.1,
      look: look === "dizzy" || look === "closed" ? look : "open",
      lid:
        look === "idle"
          ? [-0.82, -0.28]
          : look === "glare"
            ? [-0.66, 0.12]
            : undefined,
      bow: look === "glare" ? 0.6 : 1.2,
      sclera: ["#ffffff", "#fff3d6", "#f7cf8a"],
      shade: "rgba(190,90,20,0.55)",
      spiral: "#b0401a",
      iris: {
        x: g.gx * face,
        y: g.gy,
        r: g.r,
        ring: "#7a2206",
        stops: ["#c4420e", "#f68a1c", "#ffd04a"],
        pupil: "#240a04",
      },
    });
  });
}
/** The beak, anchored where the centre line meets the beak line: a raptor's hook, with a cere at its base. */
function beakPiece(view: "front" | "tq" | "side", open: boolean) {
  return pieceOf(
    `beak_${view}_${open ? "open" : "closed"}`,
    1.7 * A,
    1.5 * A,
    0.4,
    0.3,
    (c) => {
      const gold = (y0: number, y1: number) =>
        grad(c, 0, y0, 0, y1, ["#ffe680", "#f6bd2c", "#c97a0c"]);
      c.strokeStyle = "#6a3a04";
      c.lineWidth = 1.2;
      const part = (pts: () => void, y0: number, y1: number) => {
        c.beginPath();
        pts();
        c.closePath();
        c.fillStyle = gold(y0, y1);
        c.fill();
        c.stroke();
      };
      const mouth = (pts: () => void) => {
        c.beginPath();
        pts();
        c.closePath();
        c.fillStyle = "#8a1c1c";
        c.fill();
        c.stroke();
      };
      const a = A,
        drop = open ? 0.22 * a : 0;
      const cere = (x: number, y: number, w: number, h: number) => {
        c.beginPath();
        c.ellipse(x, y, w, h, 0, 0, TAU);
        c.fillStyle = "#f2a82a";
        c.fill();
        c.stroke();
      };
      if (view === "front") {
        if (open)
          mouth(() => {
            c.moveTo(-0.2 * a, 0.06 * a);
            c.lineTo(0.2 * a, 0.06 * a);
            c.lineTo(0.1 * a, 0.36 * a + drop * 0.6);
            c.lineTo(-0.1 * a, 0.36 * a + drop * 0.6);
          });
        part(
          () => {
            c.moveTo(-0.14 * a, 0.16 * a + drop);
            c.quadraticCurveTo(0, 0.2 * a + drop, 0.14 * a, 0.16 * a + drop);
            c.quadraticCurveTo(0.06 * a, 0.34 * a + drop, 0, 0.36 * a + drop);
            c.quadraticCurveTo(
              -0.06 * a,
              0.34 * a + drop,
              -0.14 * a,
              0.16 * a + drop,
            );
          },
          0.1 * a,
          0.5 * a,
        );
        // the upper mandible: broad at the cere, curving down to a sharp hook
        part(
          () => {
            c.moveTo(-0.26 * a, -0.12 * a);
            c.quadraticCurveTo(0, -0.24 * a, 0.26 * a, -0.12 * a);
            c.quadraticCurveTo(0.2 * a, 0.16 * a, 0.05 * a, 0.36 * a);
            c.lineTo(0, 0.46 * a);
            c.lineTo(-0.05 * a, 0.36 * a);
            c.quadraticCurveTo(-0.2 * a, 0.16 * a, -0.26 * a, -0.12 * a);
          },
          -0.2 * a,
          0.46 * a,
        );
        cere(0, -0.12 * a, 0.2 * a, 0.06 * a);
        c.strokeStyle = "rgba(255,250,210,0.9)";
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(0, -0.08 * a);
        c.lineTo(0, 0.28 * a);
        c.stroke(); // the ridge
        c.fillStyle = "#6a3a04";
        for (const s of [-1, 1]) {
          c.beginPath();
          c.arc(s * 0.09 * a, -0.12 * a, 0.75, 0, TAU);
          c.fill();
        }
        return;
      }
      // three-quarter and profile: the hook, longer in profile
      const L = view === "side" ? 0.7 * a : 0.5 * a,
        b = view === "side" ? -0.08 * a : -0.2 * a;
      if (open)
        mouth(() => {
          c.moveTo(b, 0.02 * a);
          c.lineTo(b + L * 0.78, 0.08 * a);
          c.lineTo(b + L * 0.6, 0.16 * a + drop);
          c.lineTo(b, 0.16 * a + drop * 0.6);
        });
      // lower mandible
      part(
        () => {
          c.moveTo(b, 0.1 * a + drop * 0.5);
          c.quadraticCurveTo(
            b + L * 0.5,
            0.11 * a + drop,
            b + L * 0.7,
            0.15 * a + drop * 1.2,
          );
          c.quadraticCurveTo(
            b + L * 0.5,
            0.27 * a + drop,
            b - 0.02 * a,
            0.24 * a + drop * 0.6,
          );
        },
        0.05 * a,
        0.32 * a + drop,
      );
      // upper mandible: a deep curve over to the hooked tip
      part(
        () => {
          c.moveTo(b, -0.2 * a);
          c.bezierCurveTo(
            b + L * 0.55,
            -0.26 * a,
            b + L * 1.02,
            -0.1 * a,
            b + L * 0.98,
            0.18 * a,
          );
          c.quadraticCurveTo(b + L * 0.96, 0.3 * a, b + L * 0.86, 0.34 * a); // the hook's point
          c.quadraticCurveTo(b + L * 0.86, 0.16 * a, b + L * 0.72, 0.12 * a);
          c.quadraticCurveTo(b + L * 0.4, 0.12 * a, b, 0.12 * a);
        },
        -0.24 * a,
        0.34 * a,
      );
      cere(b + 0.05 * a, -0.12 * a, 0.12 * a, 0.09 * a);
      c.strokeStyle = "rgba(255,250,210,0.9)";
      c.lineWidth = 1.1;
      c.beginPath();
      c.moveTo(b + 0.14 * a, -0.17 * a);
      c.bezierCurveTo(
        b + L * 0.5,
        -0.2 * a,
        b + L * 0.85,
        -0.08 * a,
        b + L * 0.9,
        0.12 * a,
      );
      c.stroke();
      c.fillStyle = "#6a3a04";
      c.beginPath();
      c.arc(b + 0.08 * a, -0.12 * a, 0.85, 0, TAU);
      c.fill(); // nostril in the cere
    },
  );
}
function glowPiece(name: string, rgb: string, size = 44) {
  return pieceOf(name, size, size, 0.5, 0.5, (c) => {
    c.fillStyle = radial(c, 0, 0, 0, size / 2, [
      [0, `rgba(${rgb},0.85)`],
      [0.35, `rgba(${rgb},0.34)`],
      [1, `rgba(${rgb},0)`],
    ]);
    c.fillRect(-size / 2, -size / 2, size, size);
  });
}
/** Every piece the rig draws in a phase. */
export function emberPieces(phase: Phase): Piece[] {
  const pal = EMBER[phase] ?? EMBER[1];
  const list: Piece[] = [];
  for (const v of ["front", "tq", "side", "backtq", "back"] as FaceView[])
    list.push(headPiece(v, pal));
  for (const v of ["front", "near", "far", "side"] as EyeView[]) {
    for (const l of LOOKS) list.push(eyePiece(v, l, pal));
    for (const k of Object.keys(BROWS) as BrowKind[])
      list.push(
        pieceOf(`brow_${v}_${k}`, 18, 12, 0.5, 0.5, (c) => {
          if (v === "far") c.scale(-1, 1);
          const b = BROWS[k],
            s2 = [b[0] * 1.1, b[1] * 1.1, b[2] * 1.15, b[3] * 1.9];
          const L = { front: 12, near: 12, far: 7.6, side: 11 }[v] / 2;
          drawBrow(c, L, s2, pal.edge, Math.min(1, b[4] + 0.35)); // the ridge: dark, heavy
          drawBrow(
            c,
            L - 1,
            [s2[0] - 0.5, s2[1] - 0.6, s2[2] - 0.5, s2[3] * 0.4],
            pal.light,
            0.5,
          ); // lit along its top
        }),
      );
  }
  for (const v of ["front", "tq", "side"] as const)
    list.push(beakPiece(v, false), beakPiece(v, true));
  list.push(
    pieceOf("wing", 190, 150, 0.07, 0.2, (c) => {
      // A wing along +x: the arm on top, then three rows of round feathers
      // overlapping like tiles, the long primaries fanning out at the tip.
      const span = 116;
      const arm = (u: number) => ({
        x: u * span,
        y: -10 * Math.sin(u * Math.PI) - 2 * u,
      });
      const row = (
        n: number,
        u0: number,
        u1: number,
        len: number,
        wid: number,
        a0: number,
        a1: number,
        cols: string[],
      ) => {
        for (let i = n - 1; i >= 0; i--) {
          // from the tip inwards, so each overlaps the one beyond it
          const u = lerp(u0, u1, n === 1 ? 0 : i / (n - 1)),
            p = arm(u),
            ang = lerp(a0, a1, i / Math.max(1, n - 1));
          const L = len * lerp(0.82, 1.18, i / Math.max(1, n - 1));
          const cx = p.x + Math.cos(ang) * L * 0.5,
            cy = p.y + Math.sin(ang) * L * 0.5;
          c.beginPath();
          c.ellipse(cx, cy, L * 0.56, wid, ang, 0, TAU);
          const tx = p.x + Math.cos(ang) * L,
            ty = p.y + Math.sin(ang) * L;
          c.fillStyle = grad(c, p.x, p.y, tx, ty, cols);
          c.fill();
          c.strokeStyle = pal.edge;
          c.lineWidth = 1.1;
          c.stroke();
          c.strokeStyle = "rgba(255,240,170,0.5)"; // the quill
          c.lineWidth = 0.8;
          c.beginPath();
          c.moveTo(
            p.x + Math.cos(ang) * L * 0.2,
            p.y + Math.sin(ang) * L * 0.2,
          );
          c.lineTo(
            p.x + Math.cos(ang) * L * 0.9,
            p.y + Math.sin(ang) * L * 0.9,
          );
          c.stroke();
        }
      };
      row(10, 0.2, 1, 62, 8.4, 1.45, 0.2, [pal.base, pal.light, pal.tip]); // primaries and secondaries
      row(8, 0.1, 0.86, 40, 7.4, 1.4, 0.45, [pal.dark, pal.base, pal.light]); // greater coverts
      row(7, 0.04, 0.7, 24, 6.4, 1.35, 0.6, [pal.dark, pal.dark, pal.base]); // lesser coverts
      const lead = new Path2D(); // the arm
      lead.moveTo(-6, -6);
      for (let i = 0; i <= 20; i++) {
        const p = arm(i / 20);
        lead.lineTo(p.x, p.y - 6 * (1 - i / 26));
      }
      for (let i = 20; i >= 0; i--) {
        const p = arm(i / 20);
        lead.lineTo(p.x, p.y + 7 * (1 - i / 24));
      }
      lead.lineTo(-6, 9);
      lead.closePath();
      c.strokeStyle = pal.edge;
      c.lineWidth = 1.6;
      c.stroke(lead);
      c.fillStyle = grad(c, 0, -16, 0, 8, [pal.light, pal.base, pal.dark]);
      c.fill(lead);
    }),
    pieceOf("plume", 110, 44, 0.07, 0.5, (c) => {
      const p = new Path2D();
      p.moveTo(0, -5);
      p.bezierCurveTo(30, -15, 62, -11, 92, 4);
      p.bezierCurveTo(82, 2, 76, 8, 84, 15);
      p.bezierCurveTo(56, 15, 26, 12, 0, 5);
      p.closePath();
      c.strokeStyle = pal.edge;
      c.lineWidth = 1.5;
      c.stroke(p);
      c.fillStyle = grad(c, 0, 0, 92, 0, [
        pal.dark,
        pal.base,
        pal.light,
        pal.tip,
      ]);
      c.fill(p);
      c.strokeStyle = pal.rim;
      c.globalAlpha = 0.6;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(6, 0);
      c.quadraticCurveTo(46, -5, 82, 5);
      c.stroke();
    }),
    pieceOf("body", 80, 84, 0.5, 0.5, (c) => {
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * TAU;
        pts.push({ x: Math.cos(a) * 27, y: Math.sin(a) * 31 });
      }
      const path = new Path2D();
      furPath(path, pts, {
        seed: 4,
        tooth: 7,
        depth: 2.6,
        mask: (_x, y) => (y > 0 ? 1 : 0.4),
      });
      paintSoft(c, path, pal, -32, 34, {
        edge: 2,
        strands: 50,
        x0: -26,
        x1: 26,
        seed: 6,
      });
    }),
    pieceOf("chest", 52, 56, 0.5, 0.4, (c) => {
      const p = new Path2D(); // the cream heart
      p.moveTo(0, -10);
      p.bezierCurveTo(-8, -24, -26, -16, -20, 2);
      p.bezierCurveTo(-16, 14, -5, 22, 0, 30);
      p.bezierCurveTo(5, 22, 16, 14, 20, 2);
      p.bezierCurveTo(26, -16, 8, -24, 0, -10);
      p.closePath();
      c.strokeStyle = "#c98a4a";
      c.lineWidth = 1.4;
      c.stroke(p);
      c.fillStyle = grad(c, 0, -20, 0, 30, pal.cream);
      c.fill(p);
      c.strokeStyle = "#e8b878";
      c.lineWidth = 0.9;
      c.globalAlpha = 0.8;
      for (let r = 0; r < 3; r++)
        for (let i = -2; i <= 2; i++) {
          const x = i * 6 + (r % 2) * 3,
            y = -6 + r * 8;
          if (Math.abs(x) < 15 - r * 3) {
            c.beginPath();
            c.arc(x, y, 3, 0.2, Math.PI - 0.2);
            c.stroke();
          }
        }
    }),
    pieceOf("leg", 30, 44, 0.5, 0.1, (c) => {
      const th = new Path2D();
      th.ellipse(0, 4, 8, 9, 0, 0, TAU);
      paintSoft(c, th, pal, -6, 14, { edge: 1.6 });
      c.strokeStyle = "#7a4a06";
      c.lineWidth = 5.4;
      c.beginPath();
      c.moveTo(0, 12);
      c.lineTo(0, 26);
      c.stroke();
      c.strokeStyle = "#f2b52a";
      c.lineWidth = 3.4;
      c.stroke();
      for (const dx of [-8, 0, 8]) {
        c.strokeStyle = "#7a4a06";
        c.lineWidth = 4.6;
        c.beginPath();
        c.moveTo(0, 26);
        c.quadraticCurveTo(dx * 0.7, 29, dx, 35);
        c.stroke();
        c.strokeStyle = "#f2b52a";
        c.lineWidth = 2.8;
        c.stroke();
        c.fillStyle = "#4a2a08";
        c.beginPath();
        c.moveTo(dx - 1.4, 34);
        c.lineTo(dx + 0.4, 40);
        c.lineTo(dx + 1.6, 34);
        c.fill();
      }
    }),
    glowPiece("glow_fire", "255,150,60"),
    // the highlight on an iris: one drawing for both eyes, never mirrored
    pieceOf("glint", 9, 9, 0.5, 0.5, (c) => {
      c.scale(0.7, 0.7);
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

// ───────────────────────── the atlas ─────────────────────────
/** Lay out the pieces on shelves (k px per rig unit), each with a 1px gap. */
export function packPieces(phase: Phase, k: number) {
  const list = emberPieces(phase)
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
 * The phoenix as an image URL for the briefing diagrams (drawn once per
 * look) in three-quarter view: hovering, or `exposed`, grounded and dizzy
 * with its heart open. Empty without a canvas (outside a browser).
 */
export function emberGuideImage(exposed = false) {
  const width = 360,
    height = 300,
    k = 0.85,
    cx = 180,
    cy = 270;
  const key = exposed ? "exposed" : "calm";
  const P = emberPose({
    clock: 1.3,
    phase: 1,
    reduced: true,
    flight: exposed ? 0 : 1,
    windup: 0,
    castAge: 99,
    exposed,
    stagger: exposed,
    hurt: 0,
    dead: false,
    deadAge: 0,
    roarAge: 99,
  });
  const placed = emberPlacements(P, 0.7, 1);
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
  // the crop around it (from the pieces' extents), and where the heart sits
  const sizes = new Map(
    emberPieces(1).map((q) => [q.name, Math.max(q.w, q.h)]),
  );
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const q of placed.placements) {
    if (q.glow) continue;
    const r =
      ((sizes.get(q.piece) ?? 0) * Math.max(Math.abs(q.sx), Math.abs(q.sy))) /
      2;
    x0 = Math.min(x0, q.x - r * 0.7);
    x1 = Math.max(x1, q.x + r * 0.7);
    y0 = Math.min(y0, q.y - r * 0.7);
    y1 = Math.max(y1, q.y + r * 0.7);
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
    core: [cx + placed.coreScreen.x * k, cy + placed.coreScreen.y * k] as const,
  };
}
/** Forget the drawn guide pictures (tests). */
export function resetEmberGuide() {
  guideUrls = {};
}
