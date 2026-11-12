/**
 * The Storm Twins as vector art: two jellyfish-clouds. Fizz is gold and
 * laughs; Crackle is blue and grumbles. Pure: a twin's pose from the battle's
 * state, and where each drawn piece goes on screen this frame
 * (`twinPlacements`). boss-vector-twins-rig.ts draws the pieces once into an
 * atlas and moves images to these placements; the briefing diagram draws the
 * same placements onto a canvas. Ported from the approved demo rig
 * (demos/boss-faces/src/twins-rig.js).
 *
 * A twin's bell is its head: the face is built on the bell by the shared
 * construction (boss-vector-face.ts; docs/boss-face-drawing.md). There is no
 * muzzle or beak, so the far eye's occluder is the bell's own outline.
 *
 * Rig units: x right, y up, z towards the camera, from the floor under the
 * twin. Like the floor, depth is drawn at 0.65 (world-art.ts).
 */
import { nextFacing, turnToward, type Phase } from "./boss-vector-grumble";
import {
  makeFace,
  type FacePlacement,
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
/** A swell that rises and falls over `dur` seconds after a moment (0 outside). */
const after = (age: number, dur: number) =>
  age < 0 || age > dur ? 0 : Math.sin((age / dur) * Math.PI);
export const TWINS_TILT = 0.65;
const project = (p: { x: number; y: number; z: number }) => ({
  x: p.x,
  y: -p.y + p.z * TWINS_TILT,
});
/** Sort depth of a rig point: nearer the camera, and higher, is in front. */
const depth = (p: { x: number; y: number; z: number }) =>
  p.z * 0.84 + p.y * 0.3;

export type TwinIndex = 0 | 1;
/** Piece name prefixes: Fizz (gold) and Crackle (blue). */
export const TWIN_PRE = ["fz", "ck"] as const;
export const TWIN_NAMES = ["Fizz", "Crackle"] as const;

// ───────────────────────── the face: construction ─────────────────────────
/** The bell's half-width at its rim. */
export const TWIN_A = 40;
const A = TWIN_A;
const RIM = 0.45 * A, // the rim's height below the bell's centre
  H = 1.25 * A; // crown to rim
/** How high the bell's centre floats over the floor. */
export const TWIN_FLOAT = 98;
/** The bell's half-width at height v: a dome, widest at the rim. */
export const twinBell = (v: number) =>
  v > RIM
    ? A * (1 - 0.5 * clamp((v - RIM) / (0.16 * A)))
    : A * Math.pow(clamp(1 - Math.pow(clamp((RIM - v) / H), 2.2)), 1 / 2.2);
const centreLine = (v: number) => 0.96 * twinBell(Math.min(v, RIM));
const skullEdge = (_view: FaceView, v: number): [number, number] => [
  -twinBell(v),
  twinBell(v),
];
export const TWIN_LOOKS = [
  "idle",
  "glare",
  "wide",
  "hurt",
  "dizzy",
  "closed",
] as const;
export type TwinLook = (typeof TWIN_LOOKS)[number];
export const TWIN_MOUTHS = ["smile", "open", "o", "grit", "flat"] as const;
export type TwinMouth = (typeof TWIN_MOUTHS)[number];
export interface TwinExpr {
  look: TwinLook;
  mouth: TwinMouth;
  blink?: boolean;
}
const EYE = {
  front: { hw: 6.6, hh: 5.6 },
  near: { hw: 6.6, hh: 5.6 },
  far: { hw: 4.3, hh: 5.5 },
  side: { hw: 3.6, hh: 5.5 },
};
const lookOf = (e: TwinExpr): TwinLook => (e.blink ? "closed" : e.look);
/** Where an open eye's iris sits (for its highlight). */
const irisOf = (pre: string, view: string, look: TwinLook) => ({
  r: look === "wide" ? 3.2 : 3.6,
  gx: view === "front" ? 0.5 : 0.9,
  gy: pre === "ck" && look !== "wide" ? 1.6 : 0.4,
});
const specFor = (i: TwinIndex) => {
  const pre = TWIN_PRE[i];
  return {
    A,
    top: RIM - H,
    bot: RIM + 0.16 * A,
    lines: { eye: 0.04 * A, mouth: 0.3 * A },
    eyeAz: 30 * DEG,
    eyeOrbit: 0.8 * A,
    lag: 10 * DEG,
    farLift: 5 * DEG,
    nod: 0.4 * A,
    margin: 0.05 * A,
    eye: EYE,
    centreLine,
    skullEdge,
    // a bell looks the same from every side
    headPiece: () => `${pre}_bell`,
    eyePiece: (v: string, e: TwinExpr) => `${pre}_eye_${v}_${lookOf(e)}`,
    // open eyes carry a highlight: Fizz's when it stares, Crackle's whenever open
    glint: (v: string, e: TwinExpr) => {
      const look = lookOf(e);
      const lit =
        look === "wide" ||
        look === "glare" ||
        (pre === "ck" && look === "idle");
      if (!lit) return null;
      const g = irisOf(pre, v, look);
      return { piece: "glint", x: g.gx - 1.3, y: g.gy - 1.6 };
    },
    centre: [
      {
        id: "mouth",
        line: 0.3 * A,
        hw: { front: 5, tq: 4 },
        vspan: [-2, 4] as [number, number],
        sideInset: 2.2,
        piece: (v: FaceView, e: TwinExpr) => `${pre}_mouth_${v}_${e.mouth}`,
      },
    ],
  };
};
export const TWIN_FACES = [makeFace(specFor(0)), makeFace(specFor(1))] as const;

// ───────────────────────── the pose ─────────────────────────
export type TwinAttack =
  | "link-beam"
  | "chain-lightning"
  | "static-field"
  | "twin-rush"
  | "polarity"
  | "thunderclap";
export interface TwinCue {
  twin: TwinIndex;
  clock: number;
  phase: number;
  reduced: boolean;
  /** This twin's attack being wound up (0-1) and its kind. */
  windKind?: string;
  windup: number;
  /** This twin's last cast and how long ago. */
  castKind?: string;
  castAge: number;
  /** Seconds since the last new phase (its roar). */
  roarAge: number;
  exposed: boolean;
  stagger: boolean;
  hurt: number;
  /** This twin is down, waiting to be revived (seconds since it fell). */
  down: boolean;
  downAge: number;
  /** Both beaten (the raid won), and since when. */
  dead: boolean;
  deadAge: number;
}
export interface TwinPose {
  clock: number;
  dx: number;
  dy: number;
  dz: number;
  yaw: number;
  pitch: number;
  roll: number;
  squash: number;
  spread: number;
  droop: number;
  look: TwinLook;
  mouth: TwinMouth;
  blink: boolean;
  glow: number;
  spark: number;
  alpha: number;
  stars: boolean;
  exposed: number;
}
/** A twin's pose at rest: bobbing, its bell breathing, its face its own. */
export function twinIdle(
  twin: TwinIndex,
  clock = 0,
  phase = 1,
  reduced = false,
): TwinPose {
  const t = reduced ? 0 : clock,
    m = reduced ? 0 : 1,
    i = twin;
  return {
    clock: t,
    dx: 0,
    dy: Math.sin(t * 2 + i * 2.1) * 5 * m,
    dz: 0,
    yaw:
      (Math.sin(t * 0.8 + i * 1.7) * 0.14 + Math.sin(t * 2.1 + i) * 0.04) * m,
    pitch: Math.sin(t * 1.4 + i) * 0.06 * m,
    roll: Math.sin(t * 1.1 + i * 2) * 0.06 * m,
    squash: 1 + Math.sin(t * 2 + i * 2.1 + 1.2) * 0.03 * m,
    spread: 0,
    droop: 0,
    look: "idle",
    mouth: "smile",
    blink: i === 1 && !!m && (t + 0.8) % 4.3 > 4.18,
    glow: 0.22 + (phase - 1) * 0.16,
    spark: phase === 3 ? 0.5 : 0,
    alpha: 1,
    stars: false,
    exposed: 0,
  };
}
/** The battle's state in, one twin's pose out. */
export function twinPose(c: TwinCue): TwinPose {
  const q = twinIdle(c.twin, c.clock, c.phase, c.reduced);
  const i = c.twin,
    fizz = i === 0;
  const m = c.reduced ? 0 : 1;
  const w = clamp(c.windup || 0),
    kind = c.windKind;
  if (kind) {
    q.look = "glare";
    q.glow = lerp(q.glow, 0.9, w);
  }
  if (kind === "link-beam") {
    q.roll += (fizz ? 0.22 : -0.22) * w;
    q.dx += (fizz ? 8 : -8) * w;
  } else if (kind === "chain-lightning") {
    if (fizz) {
      q.dy += Math.abs(Math.sin(c.clock * 9)) * 6 * w * m;
      q.look = "idle";
    } else {
      q.dy += 12 * w;
      q.spark = Math.max(q.spark, w);
    }
  } else if (kind === "static-field") {
    q.spread = w;
    q.spark = Math.max(q.spark, w);
  } else if (kind === "twin-rush") {
    q.pitch += 0.3 * w;
    q.dz -= 14 * w;
    q.squash *= 1 - 0.08 * w;
  } else if (kind === "polarity") {
    q.roll += Math.sin(c.clock * 14 + i * 3) * 0.14 * w * m;
    q.look = "wide";
    q.mouth = "o";
  } else if (kind === "thunderclap") {
    q.dy += 26 * w;
    q.spread = 0.6 * w;
  }
  // the follow-through (none with reduced motion)
  const cast = c.reduced ? undefined : c.castKind,
    age = c.castAge;
  const hit = (dur: number) => after(age, dur);
  if (cast === "link-beam") {
    const a = hit(0.8);
    q.glow = Math.max(q.glow, a);
    if (a > 0.05) {
      q.mouth = "open";
      if (!fizz) q.look = "glare";
    }
  } else if (cast === "chain-lightning") {
    const a = hit(0.6);
    if (!fizz) {
      q.spark = Math.max(q.spark, a);
      q.dy += 8 * a;
    }
    if (a > 0.05) {
      q.mouth = "open";
      if (!fizz) q.look = "glare";
    }
  } else if (cast === "static-field") {
    const a = hit(0.7);
    q.spread = Math.max(q.spread, a);
    q.spark = Math.max(q.spark, a);
    q.squash *= 1 + 0.1 * a;
    if (a > 0.05) {
      if (fizz) q.mouth = "open";
      else q.look = "glare";
    }
  } else if (cast === "twin-rush") {
    const a = hit(0.55);
    q.dz += 34 * a;
    q.pitch += 0.25 * a;
    q.droop = -a;
    if (a > 0.05) {
      q.look = "glare";
      q.mouth = fizz ? "open" : "grit";
    }
  } else if (cast === "polarity") {
    const a = hit(0.6);
    q.glow = Math.max(q.glow, a);
    if (a > 0.05) {
      q.look = "wide";
      q.mouth = "o";
    }
  } else if (cast === "thunderclap") {
    const a = hit(0.5);
    q.dy -= 16 * a;
    q.squash *= 1 + 0.16 * a;
    q.spark = Math.max(q.spark, a);
    if (a > 0.05) {
      q.look = "glare";
      q.mouth = "open";
    }
  }
  const roar = c.reduced ? 0 : after(c.roarAge, 1.1);
  if (roar > 0.05) {
    q.dy += 10 * roar;
    q.spread = Math.max(q.spread, roar);
    q.spark = Math.max(q.spark, roar);
    q.look = "glare";
    q.mouth = "open";
  }
  if (c.exposed && !c.stagger) {
    q.look = "wide";
    q.mouth = "o";
    q.droop = 0.5;
  }
  if (c.exposed || c.stagger) q.exposed = 1;
  if (c.stagger) {
    q.look = "dizzy";
    q.mouth = "flat";
    q.roll = Math.sin(c.clock * 3 + i * 2) * 0.3 * m + (m ? 0 : 0.2);
    q.yaw = 0;
    q.dy -= 12;
    q.droop = 0.8;
    q.stars = true;
  }
  if ((c.hurt || 0) > 0.3 && !c.dead && !c.down && !c.reduced) {
    q.look = "hurt";
    q.mouth = fizz ? "o" : "grit";
    q.roll += 0.14 * c.hurt * (fizz ? 1 : -1);
    q.squash *= 1 - 0.08 * c.hurt;
  }
  // down (waiting to be revived) or beaten: it sinks, eyes shut, glow out
  if (c.dead || c.down) {
    const d = c.reduced ? 1 : smooth(0, 0.9, c.dead ? c.deadAge : c.downAge);
    q.dy = (c.dead ? -62 : -40) * d;
    q.roll = (fizz ? 0.3 : -0.3) * d;
    q.yaw = 0;
    q.pitch = 0.1 * d;
    q.look = "closed";
    q.mouth = "flat";
    q.blink = false;
    q.droop = d;
    q.glow = 0.05;
    q.spark = 0;
    q.squash = 1 + 0.08 * d;
    q.exposed = 0;
    q.stars = false;
    if (c.down && !c.dead) q.alpha = lerp(1, 0.5, d);
  }
  return q;
}

/** The facing shown (eight ways, with hysteresis) and the turn towards it. */
export function twinTurn(
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

// ───────────────────────── the body ─────────────────────────
export interface TwinPlacement extends FacePlacement {
  glow?: boolean;
}
/**
 * One twin's pieces this frame, around the floor under it: the aura, six
 * tentacles round the rim, the bell with its face, the cloud curl on its
 * crown, sparks and dizzy stars. Also where its head (the bell's centre) and
 * its core are, for effects and the weak point's ring.
 */
export function twinPlacements(
  q: TwinPose,
  yaw: number,
  twin: TwinIndex,
  prevView?: FaceView,
) {
  const pre = TWIN_PRE[twin];
  const list: TwinPlacement[] = [];
  const t = q.clock;
  const rot = (x: number, z: number, a: number) => ({
    x: x * Math.cos(a) + z * Math.sin(a),
    z: -x * Math.sin(a) + z * Math.cos(a),
  });
  const fwd = rot(0, q.dz, yaw);
  const centre = { x: q.dx + fwd.x, y: TWIN_FLOAT + q.dy, z: fwd.z };
  const hs = project(centre),
    hz = depth(centre) + 4;
  const hy = yaw + q.yaw;
  const cr = Math.cos(q.roll),
    sr = Math.sin(q.roll);
  const local = (u: number, v: number) => ({
    x: hs.x + u * cr - v * sr,
    y: hs.y + u * sr + v * cr,
  });
  const raw = (
    key: string,
    piece: string,
    u: number,
    v: number,
    o: {
      rot?: number;
      sx?: number;
      sy?: number;
      alpha?: number;
      dz?: number;
      glow?: boolean;
    } = {},
  ) => {
    const s = local(u, v);
    list.push({
      key,
      piece,
      x: s.x,
      y: s.y,
      rot: q.roll + (o.rot ?? 0),
      sx: (o.sx ?? 1) * q.squash,
      sy: (o.sy ?? 1) / q.squash,
      alpha: (o.alpha ?? 1) * q.alpha,
      z: hz + (o.dz ?? 0),
      glow: !!o.glow,
    });
  };
  raw("aura", `${pre}_glow`, 0, 0, {
    glow: true,
    alpha: q.glow,
    sx: 3.2,
    sy: 3.2,
    dz: -9,
  });
  // tentacles: six round the rim, hanging under the bell, curling outward
  for (let j = 0; j < 6; j++) {
    const a = (j / 6) * TAU + 0.3 + hy;
    const rx = Math.sin(a) * 0.62 * A,
      rz = Math.cos(a);
    const sway = Math.sin(t * 2.4 + j * 1.3 + twin) * 0.16;
    const out = Math.sign(rx) || 1;
    raw(`tent${j}`, `${pre}_tent`, rx, RIM + 2 + rz * 3, {
      rot:
        -out * (0.1 + q.spread * 0.7 + (Math.abs(rx) / A) * 0.35) +
        sway +
        q.droop * out * 0.18,
      sx: out * (0.86 + 0.14 * Math.abs(Math.sin(a))),
      sy: 1 - 0.18 * Math.max(0, q.droop) + 0.12 * Math.max(0, -q.droop),
      dz: -3 + rz * 0.5,
    });
  }
  const face = TWIN_FACES[twin].face(
    {
      x: hs.x,
      y: hs.y,
      yaw: hy,
      pitch: q.pitch,
      roll: q.roll,
      z: hz,
      prevView,
    },
    { look: q.look, mouth: q.mouth, blink: q.blink },
  );
  for (const f of face.placements) {
    const p: TwinPlacement = { ...f, alpha: f.alpha * q.alpha };
    if (f.key === "head") {
      p.sx = (f.sx < 0 ? -1 : 1) * q.squash;
      p.sy = 1 / q.squash;
    }
    list.push(p);
  }
  // the cloud curl on the crown leans the way the twin faces
  const lean = Math.sin(hy);
  raw("curl", `${pre}_curl`, lean * 5, RIM - H + 5, {
    sx: lean < -0.05 ? -1 : 1,
    rot: Math.sin(t * 1.7 + twin) * 0.06,
    dz: 0.5,
  });
  if (q.spark > 0.02)
    for (let j = 0; j < 5; j++) {
      const a = t * 3 + j * 1.26 + twin,
        r = A * (1.25 + 0.2 * Math.sin(t * 7 + j));
      raw(`spark${j}`, `${pre}_spark`, Math.cos(a) * r, Math.sin(a) * r * 0.8, {
        rot: a + Math.PI / 2,
        alpha: q.spark * (0.5 + 0.5 * Math.sin(t * 23 + j * 2)),
        glow: true,
        dz: Math.sin(a) > 0 ? 2 : -8,
      });
    }
  if (q.stars)
    for (let j = 0; j < 3; j++) {
      const a = t * 4 + (j * TAU) / 3;
      list.push({
        key: `star${j}`,
        piece: "star",
        x: hs.x + Math.cos(a) * 26,
        y: hs.y - A * 1.75 + Math.sin(a) * 7,
        rot: a,
        sx: 1,
        sy: 1,
        alpha: 1,
        z: hz + (Math.sin(a) > 0 ? 1 : -1),
      });
    }
  list.sort((a, b) => a.z - b.z);
  return {
    placements: list,
    view: face.view,
    head: { x: hs.x, y: hs.y },
    // the weak point: the heart of the bell, low in it, clear of the face
    core: local(0, 0.5 * A),
    z: hz,
  };
}

// ───────────────────────── the pieces (drawn once per phase) ─────────────────────────
type Ctx = CanvasRenderingContext2D;
export interface TwinPiece {
  name: string;
  /** Size in rig units, and the anchor (0-1) its placement point sits on. */
  w: number;
  h: number;
  ox: number;
  oy: number;
  /** Drawn with (0,0) at the top-left, k px per unit. */
  draw: (ctx: Ctx, k: number) => void;
}
const pieceOf = (
  name: string,
  w: number,
  h: number,
  ox: number,
  oy: number,
  fn: (c: Ctx) => void,
): TwinPiece => ({
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
const stopsOn = (g: CanvasGradient, stops: Stop[]) => {
  stops.forEach((s, i) =>
    Array.isArray(s)
      ? g.addColorStop(s[0], s[1])
      : g.addColorStop(i / (stops.length - 1), s),
  );
  return g;
};
const grad = (
  c: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  s: Stop[],
) => stopsOn(c.createLinearGradient(x0, y0, x1, y1), s);
const radial = (
  c: Ctx,
  x: number,
  y: number,
  r0: number,
  r1: number,
  s: Stop[],
) => stopsOn(c.createRadialGradient(x, y, r0, x, y, r1), s);

export interface TwinPalette {
  light: string;
  base: string;
  dark: string;
  edge: string;
  rim: string;
  ink: string;
  /** "r,g,b" of its glow. */
  glow: string;
  blush?: string;
  iris?: string;
}
export const TWIN_PAL: Record<"fz" | "ck", TwinPalette> = {
  fz: {
    light: "#fff6c4",
    base: "#ffd65e",
    dark: "#f3a62a",
    edge: "#b06c08",
    rim: "#fffbe6",
    ink: "#5a2c0a",
    glow: "255,214,96",
    blush: "rgba(255,120,90,0.5)",
  },
  ck: {
    light: "#eef9ff",
    base: "#a9d6ff",
    dark: "#5f9eea",
    edge: "#2c5fae",
    rim: "#ffffff",
    ink: "#16306e",
    glow: "120,190,255",
    iris: "#2f6fe0",
  },
};
/** Its colours this phase: deeper, more electric in the last. */
export function twinPalette(pre: "fz" | "ck", phase: Phase): TwinPalette {
  const pal = TWIN_PAL[pre];
  return phase === 3
    ? { ...pal, dark: pre === "fz" ? "#f08a1c" : "#4a86e0" }
    : pal;
}

function bellPiece(pre: string, pal: TwinPalette) {
  return pieceOf(`${pre}_bell`, 2.5 * A, 2 * A, 0.5, 0.56, (c) => {
    const path = new Path2D();
    for (let v = RIM - H; v <= RIM; v += 0.5) path.lineTo(twinBell(v), v);
    for (let v = RIM; v >= RIM - H; v -= 0.5) path.lineTo(-twinBell(v), v);
    path.closePath();
    // the scalloped rim
    for (let j = 0; j < 5; j++) {
      const x = lerp(-0.78 * A, 0.78 * A, j / 4);
      path.moveTo(x + 0.23 * A, RIM + 1);
      path.ellipse(x, RIM + 1, 0.23 * A, 0.15 * A, 0, 0, TAU);
    }
    c.strokeStyle = pal.edge;
    c.lineWidth = 2;
    c.stroke(path);
    c.fillStyle = radial(c, -0.25 * A, -0.35 * A, 2, 1.5 * A, [
      [0, pal.light],
      [0.45, pal.base],
      [1, pal.dark],
    ]);
    c.fill(path);
    c.save();
    c.clip(path);
    // light through the jelly
    c.fillStyle = radial(c, 0, RIM + 6, 2, A, [
      [0, pal.rim + "aa"],
      [1, pal.rim + "00"],
    ]);
    c.fillRect(-A, -A, 2 * A, 2 * A);
    // the shine on the crown
    c.strokeStyle = pal.rim;
    c.globalAlpha = 0.85;
    c.lineWidth = 3;
    c.beginPath();
    c.arc(0, 0.2 * A, 0.86 * A, Math.PI * 1.18, Math.PI * 1.42);
    c.stroke();
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 0.2 * A, 0.86 * A, Math.PI * 1.46, Math.PI * 1.5);
    c.stroke();
    c.restore();
  });
}
function curlPiece(pre: string, pal: TwinPalette) {
  return pieceOf(`${pre}_curl`, 44, 44, 0.5, 0.86, (c) => {
    const path = new Path2D();
    for (const [x, y, rx, ry] of [
      [0, -2, 15, 9],
      [-1, -13, 11, 8.5],
      [5, -23, 8.5, 8],
    ]) {
      path.moveTo(x + rx, y);
      path.ellipse(x, y, rx, ry, 0, 0, TAU);
    }
    c.strokeStyle = pal.edge;
    c.lineWidth = 2;
    c.stroke(path);
    c.fillStyle = grad(c, 0, -32, 0, 6, [pal.light, pal.base, pal.dark]);
    c.fill(path);
    // the swirl
    c.strokeStyle = pal.edge;
    c.lineWidth = 1.3;
    c.globalAlpha = 0.7;
    c.beginPath();
    c.arc(5, -23, 4.2, Math.PI * 0.3, Math.PI * 1.9);
    c.moveTo(-11, -9);
    c.quadraticCurveTo(-2, -5, 9, -11);
    c.moveTo(-9, -19);
    c.quadraticCurveTo(-3, -16, 1, -18);
    c.stroke();
    c.globalAlpha = 0.9;
    c.strokeStyle = pal.rim;
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(-2, -13, 7, Math.PI * 1.1, Math.PI * 1.45);
    c.stroke();
  });
}
function tentPiece(pre: string, pal: TwinPalette) {
  return pieceOf(`${pre}_tent`, 40, 74, 0.3, 0.04, (c) => {
    const run = () => {
      c.beginPath();
      c.moveTo(0, 0);
      c.bezierCurveTo(-4, 18, 5, 30, 2, 44);
      // the curl at the tip, turning outward (+x)
      c.bezierCurveTo(0, 58, 18, 62, 20, 50);
      c.bezierCurveTo(21, 42, 11, 41, 11, 48);
    };
    for (const [w, col, a] of [
      [11, pal.edge, 1],
      [8, pal.base, 1],
      [3.2, pal.light, 0.8],
    ] as [number, string, number][]) {
      c.strokeStyle = col;
      c.globalAlpha = a;
      c.lineWidth = w;
      run();
      c.stroke();
    }
  });
}
function sparkPiece(pre: string, pal: TwinPalette) {
  return pieceOf(`${pre}_spark`, 16, 26, 0.5, 0.5, (c) => {
    c.strokeStyle = `rgb(${pal.glow})`;
    c.lineWidth = 2.6;
    c.beginPath();
    c.moveTo(2, -11);
    c.lineTo(-3, -2);
    c.lineTo(3, 1);
    c.lineTo(-2, 11);
    c.stroke();
    c.strokeStyle = "#fff";
    c.lineWidth = 1;
    c.stroke();
  });
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
/** One twin's eye in one view and look. Drawn with the inner corner at +x. */
function eyePiece(pre: string, view: string, look: TwinLook, pal: TwinPalette) {
  return pieceOf(`${pre}_eye_${view}_${look}`, 24, 22, 0.5, 0.5, (c) => {
    const { hw, hh } = EYE[view as keyof typeof EYE];
    if (view === "far") c.scale(-1, 1);
    const face = view === "far" ? -1 : 1; // +x on the drawing is this way on the head
    const ink = pal.ink;
    c.strokeStyle = ink;
    c.fillStyle = ink;
    c.lineWidth = 2;
    if (
      pre === "fz" &&
      (view === "front" || view === "near") &&
      look !== "dizzy"
    ) {
      // the blush under the outer corner
      c.fillStyle = pal.blush!;
      c.beginPath();
      c.ellipse(-hw * 0.5, hh + 2.6, 3.6, 1.9, 0, 0, TAU);
      c.fill();
      c.fillStyle = ink;
    }
    if (look === "hurt") {
      c.beginPath();
      c.moveTo(-hw * 0.8, -hh * 0.6);
      c.lineTo(hw * 0.7, 0.2);
      c.lineTo(-hw * 0.8, hh * 0.7);
      c.stroke();
      return;
    }
    if (look === "dizzy") {
      c.lineWidth = 1.4;
      c.beginPath();
      for (let i = 0; i <= 50; i++) {
        const a = (i / 50) * TAU * 2.1,
          r = (i / 50) * 0.95;
        if (i) c.lineTo(Math.cos(a) * r * hw, Math.sin(a) * r * hh);
        else c.moveTo(0, 0);
      }
      c.stroke();
      return;
    }
    if (look === "closed") {
      c.beginPath();
      if (pre === "fz") {
        // asleep, still smiling
        c.moveTo(-hw * 0.9, -0.5);
        c.quadraticCurveTo(0, hh * 0.9, hw * 0.9, -0.5);
      } else {
        // a flat line
        c.moveTo(-hw * 0.9, 0.6);
        c.lineTo(hw * 0.9, 1.2);
      }
      c.stroke();
      return;
    }
    if (pre === "fz" && look === "idle") {
      // laughing: an arch
      c.lineWidth = 2.3;
      c.beginPath();
      c.moveTo(-hw * 0.92, hh * 0.5);
      c.quadraticCurveTo(0, -hh * 1.05, hw * 0.92, hh * 0.5);
      c.stroke();
      return;
    }
    const g = irisOf(pre, view, look);
    if (pre === "fz") {
      // open and bright: a round dark eye
      const r = look === "wide" ? hh * 0.98 : hh * 0.9;
      c.beginPath();
      c.ellipse(0, 0, Math.min(hw, r), r, 0, 0, TAU);
      c.fill();
      if (look === "wide") {
        c.fillStyle = "#fff8e0";
        c.beginPath();
        c.ellipse(0, 0, Math.min(hw, r) - 1.3, r - 1.3, 0, 0, TAU);
        c.fill();
        c.fillStyle = ink;
        c.beginPath();
        c.arc(g.gx * face, 0.4, g.r * 0.62, 0, TAU);
        c.fill();
      } else {
        // a cheeky lash
        c.strokeStyle = ink;
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(-hw - 0.5, -hh * 0.9);
        c.lineTo(-hw * 0.2, -hh * 1.25);
        c.stroke();
      }
      return;
    }
    // Crackle: a white eye under a flat lid; the lid drops to the inner corner when it glares
    const lidY =
      look === "wide" ? -hh * 1.2 : look === "glare" ? -hh * 0.2 : -hh * 0.05;
    const slope = look === "glare" ? 0.42 : 0.04;
    const iy = look === "wide" ? 0.4 : 1.6;
    c.save();
    c.beginPath();
    c.ellipse(0, 0, hw, hh, 0, 0, TAU);
    c.clip();
    c.beginPath();
    c.moveTo(-hw - 2, lidY - slope * hw);
    c.lineTo(hw + 2, lidY + slope * hw);
    c.lineTo(hw + 2, hh + 2);
    c.lineTo(-hw - 2, hh + 2);
    c.closePath();
    c.clip();
    c.fillStyle = "#f7fcff";
    c.fillRect(-12, -11, 24, 22);
    c.fillStyle = pal.iris!;
    c.beginPath();
    c.arc(g.gx * face, iy, g.r, 0, TAU);
    c.fill();
    c.fillStyle = ink;
    c.beginPath();
    c.arc(g.gx * face, iy, g.r * 0.5, 0, TAU);
    c.fill();
    c.restore();
    c.lineWidth = 1;
    c.save();
    c.beginPath();
    c.rect(-12, lidY - slope * hw - 0.5, 24, 24);
    c.clip();
    c.beginPath();
    c.ellipse(0, 0, hw, hh, 0, 0, TAU);
    c.stroke();
    c.restore();
    if (look !== "wide") {
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(-hw - 1, lidY - slope * (hw + 1));
      c.lineTo(hw + 0.6, lidY + slope * (hw + 0.6));
      c.stroke();
    } else {
      c.lineWidth = 1.8;
      c.beginPath();
      c.ellipse(0, 0, hw, hh, 0, Math.PI * 1.05, Math.PI * 1.95);
      c.stroke();
    }
  });
}
function mouthPiece(
  pre: string,
  view: string,
  kind: TwinMouth,
  pal: TwinPalette,
) {
  return pieceOf(`${pre}_mouth_${view}_${kind}`, 22, 18, 0.5, 0.35, (c) => {
    const ink = pal.ink,
      fz = pre === "fz";
    c.strokeStyle = ink;
    c.lineWidth = 1.5;
    // the far half is shorter in three-quarter; in profile only the near half shows
    const fx = (x: number) =>
      view === "tq" && x > 0
        ? x * 0.55
        : view === "side"
          ? x > 0
            ? x * 0.15
            : x * 0.75
          : x;
    const M = (x: number, y: number) => c.moveTo(fx(x), y),
      Q = (a: number, b: number, x: number, y: number) =>
        c.quadraticCurveTo(fx(a), b, fx(x), y);
    const inside = () => {
      c.fillStyle = fz ? "#c2452c" : "#274a9a";
      c.fill();
      c.stroke();
    };
    c.beginPath();
    if (kind === "smile") {
      if (fz) {
        M(-4.6, 0);
        Q(0, 0.8, 4.6, 0);
        Q(3.6, 6.4, 0, 6.4);
        Q(-3.6, 6.4, -4.6, 0);
        c.closePath();
        inside();
        c.fillStyle = "#ff8f7a";
        c.beginPath();
        c.ellipse(fx(0), 4.8, Math.abs(fx(2.2)) || 1, 1.3, 0, 0, TAU);
        c.fill();
      } else {
        // a small frown
        M(-3.4, 2.6);
        Q(0, 0.2, 3.4, 2.6);
        c.stroke();
      }
    } else if (kind === "open") {
      M(-5.6, -0.4);
      Q(0, fz ? 1.2 : -1.6, 5.6, -0.4);
      Q(5, 8, 0, 8);
      Q(-5, 8, -5.6, -0.4);
      c.closePath();
      inside();
      c.fillStyle = fz ? "#ff8f7a" : "#7fb0ff";
      c.beginPath();
      c.ellipse(fx(0), 6, Math.abs(fx(2.6)) || 1, 1.5, 0, 0, TAU);
      c.fill();
    } else if (kind === "o") {
      c.ellipse(fx(0), 2.6, view === "front" ? 2.4 : 1.7, 2.9, 0, 0, TAU);
      inside();
    } else if (kind === "grit") {
      M(-4.8, 0.4);
      Q(0, -0.2, 4.8, 0.4);
      Q(5, 2.6, 4.6, 4.6);
      Q(0, 5.2, -4.6, 4.6);
      Q(-5, 2.6, -4.8, 0.4);
      c.closePath();
      c.fillStyle = "#fff";
      c.fill();
      c.stroke();
      c.lineWidth = 0.7;
      c.beginPath();
      for (const x of [-2.4, 0, 2.4]) {
        M(x, 0.2);
        c.lineTo(fx(x), 4.9);
      }
      c.stroke();
    } else {
      // flat, wobbling
      M(-3.6, 2);
      Q(-1.6, fz ? 3.4 : 0.8, 0, 2);
      Q(1.6, fz ? 0.8 : 3.2, 3.6, 2);
      c.stroke();
    }
  });
}
function starPiece() {
  return pieceOf("star", 12, 12, 0.5, 0.5, (c) => {
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
  });
}
/** Every piece both twins draw in a phase (one atlas holds both). */
export function twinsPieces(phase: Phase): TwinPiece[] {
  const list: TwinPiece[] = [starPiece()];
  for (const pre of TWIN_PRE) {
    const pal = twinPalette(pre, phase);
    list.push(
      bellPiece(pre, pal),
      curlPiece(pre, pal),
      tentPiece(pre, pal),
      sparkPiece(pre, pal),
      glowPiece(`${pre}_glow`, pal.glow),
    );
    for (const v of ["front", "near", "far", "side"])
      for (const l of TWIN_LOOKS) list.push(eyePiece(pre, v, l, pal));
    for (const v of ["front", "tq", "side"])
      for (const m of TWIN_MOUTHS) list.push(mouthPiece(pre, v, m, pal));
  }
  list.push(
    pieceOf("glint", 9, 9, 0.5, 0.5, (c) => {
      c.fillStyle = "#fff";
      c.beginPath();
      c.arc(0, 0, 1.2, 0, TAU);
      c.fill();
    }),
  );
  return list;
}

// ───────────────────────── the atlas ─────────────────────────
/** Lay the pieces out on one sheet (shelves), returning each piece's spot. */
export function packTwinPieces(phase: Phase, k: number) {
  const list = twinsPieces(phase)
    .map((p) => ({ p, w: Math.ceil(p.w * k + 2), h: Math.ceil(p.h * k + 2) }))
    .sort((a, b) => b.h - a.h);
  const width = 1024,
    gap = 2;
  let x = 0,
    y = 0,
    shelf = 0;
  const spots: {
    piece: TwinPiece;
    x: number;
    y: number;
    w: number;
    h: number;
  }[] = [];
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
export function paintTwinPieces(
  ctx: Ctx,
  spots: ReturnType<typeof packTwinPieces>["spots"],
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
 * Both twins as an image URL for the briefing diagrams (drawn once per look),
 * side by side and turned a little towards each other; `exposed` shows them
 * startled with their cores open. Empty without a canvas (outside a browser).
 */
export function twinsGuideImage(exposed = false) {
  const width = 360,
    height = 260,
    k = 0.95,
    cy = 236,
    xs = [118, 242];
  const key = exposed ? "exposed" : "calm";
  const placed = ([0, 1] as TwinIndex[]).map((i) => {
    const q = twinIdle(i, 1.3, 1, true);
    if (exposed) Object.assign(q, { look: "wide", mouth: "o", droop: 0.5 });
    return twinPlacements(q, i ? -0.5 : 0.5, i);
  });
  if (
    !guideUrls[key] &&
    typeof document !== "undefined" &&
    typeof document.createElement === "function"
  ) {
    try {
      const pk = 2;
      const packed = packTwinPieces(1, pk);
      const sheet = document.createElement("canvas");
      sheet.width = packed.width;
      sheet.height = Math.max(1, packed.height);
      const sctx = sheet.getContext("2d");
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (sctx && ctx) {
        paintTwinPieces(sctx, packed.spots, pk);
        const spot = new Map(packed.spots.map((s) => [s.piece.name, s]));
        placed.forEach((pl, i) => {
          for (const p of pl.placements) {
            if (p.glow) continue;
            const s = spot.get(p.piece);
            if (!s) continue;
            const pw = s.piece.w * pk,
              ph = s.piece.h * pk;
            ctx.save();
            ctx.globalAlpha = clamp(p.alpha);
            ctx.translate(xs[i] + p.x * k, cy + p.y * k);
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
        });
        guideUrls[key] = canvas.toDataURL("image/png");
      }
    } catch {
      /* No drawing surface: the diagram shows no picture. */
    }
  }
  // the crop around them (from the pieces' extents), and where the cores sit
  const size = new Map(twinsPieces(1).map((q) => [q.name, Math.max(q.w, q.h)]));
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  placed.forEach((pl, i) => {
    for (const q of pl.placements) {
      if (q.glow) continue;
      const r =
        ((size.get(q.piece) ?? 0) * Math.max(Math.abs(q.sx), Math.abs(q.sy))) /
        2;
      x0 = Math.min(x0, xs[i] + (q.x - r) * k);
      x1 = Math.max(x1, xs[i] + (q.x + r) * k);
      y0 = Math.min(y0, cy + (q.y - r) * k);
      y1 = Math.max(y1, cy + (q.y + r) * k);
    }
  });
  const cl = (v: number, hi: number) => Math.max(0, Math.min(hi, v));
  const left = cl(x0 - 4, width),
    top = cl(y0 - 4, height);
  const cores = placed.map(
    (pl, i) => [xs[i] + pl.core.x * k, cy + pl.core.y * k] as const,
  );
  return {
    url: guideUrls[key] ?? "",
    width,
    height,
    crop: [
      left,
      top,
      cl(x1 + 4, width) - left,
      cl(y1 + 4, height) - top,
    ] as const,
    core: cores[0],
    cores,
  };
}
/** Forget the drawn guide pictures (tests). */
export function resetTwinsGuide() {
  guideUrls = {};
}
