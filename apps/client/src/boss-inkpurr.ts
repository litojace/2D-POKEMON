/**
 * Inkpurr, the ink sprite (Gloomshade's look): a round blob of living ink
 * with cat ears, sly amber eyes, a gold gem on its brow, two little ink paws
 * and a crescent-moon tail. It floats over its own glossy ink puddle.
 *
 * Pure: the pose from the battle's state (`inkPose`), and every image's
 * placement this frame (`inkPlacements`). The pieces are painted once into
 * one atlas (boss-inkpurr-paint.ts, `buildInkAtlas`); boss-inkpurr-rig.ts
 * moves Phaser images to the placements, and the briefing diagram draws the
 * same placements onto a canvas (`inkGuideImage`).
 *
 * Five views are drawn (front, ¾ front, side, ¾ back, back); the other three
 * facings are mirrors. The face is never squashed: when the body squashes
 * and stretches, the face only moves with it, as one group.
 */
import { nextFacing, turnToward } from "./boss-vector-grumble";
import {
  ARM_POSES,
  ASIGN,
  ATT,
  AZ,
  B_BOT,
  DRIP_FRAMES,
  DRIP_L,
  EYE_LINE,
  EYEP,
  FACING,
  GEMP,
  MOON_JOIN,
  MOON_S,
  MOUTHP,
  PITCH_SCREEN,
  SH,
  TSIGN,
  armStates,
  buildInkAtlas,
  makeView,
  VIEWS,
  yS,
} from "./boss-inkpurr-paint";

const TAU = Math.PI * 2;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** 0 → 1 → 0 over `dur` seconds after an event. */
const after = (age: number, dur: number) =>
  age < 0 || age > dur ? 0 : Math.sin((age / dur) * Math.PI);

/** World pixels per rig unit: Inkpurr's size in battle. */
export const INK_SCALE = 0.64;

// ════════════════════════ the pose ════════════════════════
/** What the battle tells the rig each frame (all cosmetic). */
export interface InkCue {
  clock: number;
  phase: number;
  reduced: boolean;
  windKind?: string;
  windup: number;
  castKind?: string;
  castAge: number;
  stagger: boolean;
  exposed: boolean;
  hurt: number;
  dead: boolean;
  deadAge: number;
  roarAge: number;
  /** Only the real one's moon flickers. */
  flicker: boolean;
}
export type InkPaw = keyof typeof ARM_POSES;
export type InkLook = "idle" | "glare" | "wide" | "hurt" | "dizzy" | "closed";
export type InkMouth = "smirk" | "grin" | "o" | "wavy" | "flat";
export type InkPose = ReturnType<typeof inkPose>;

/** The hover (rig units from the floor to the blob's axis) when idle. */
const HOVER = 94;
const MOON_BY_PHASE = [0, 0.55, 0.78, 1];
const DEEP_BY_PHASE = [0, 0, 0.42, 0.72];

export function inkPose(c: InkCue) {
  const t = c.reduced ? 0.3 : c.clock;
  const m = c.reduced ? 0 : 1;
  const P = {
    t,
    h: HOVER,
    pitch: 0,
    lean: 0,
    brot: 0,
    bdy: Math.sin(t * 1.8) * 3.2 * m,
    sx: 1,
    sy: 1,
    al: "rest" as InkPaw,
    ar: "rest" as InkPaw,
    lift: 0,
    liftL: 0,
    liftR: 0,
    look: "idle" as InkLook,
    mouth: "smirk" as InkMouth,
    tail: 0,
    moon: 0,
    gem: 0,
    core: 0,
    melt: 0,
    alpha: 1,
    stars: 0,
    shake: 0,
    wob: 1,
    floatL: Math.sin(t * 2.2) * 0.06 * m,
    floatR: Math.sin(t * 2.2 + 1.9) * 0.06 * m,
    flutL: m && Math.sin(t * 2.4) > 0 ? 1 : 0,
    flutR: m && Math.sin(t * 2.4 + 2.2) > 0 ? 1 : 0,
    moonFlick:
      c.flicker && !c.reduced
        ? 0.3 + 0.7 * Math.abs(Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1))
        : 1,
    blink: !!m && t % 3.6 > 3.47,
  };
  P.brot += Math.sin(t * 1.1) * 0.03 * m;
  const w = clamp(c.windup || 0),
    kind = c.windKind,
    cast = c.castKind,
    age = c.castAge;
  // the wind-up of the attack being warned
  if (kind === "lunge") {
    // it sinks low into its puddle and hugs itself, glaring
    P.h -= 14 * w;
    P.sy -= 0.2 * w;
    P.sx += 0.14 * w;
    P.pitch += 0.24 * w;
    P.tail = 0.3 * w;
    if (w > 0.1) ((P.al = "wrap"), (P.ar = "wrap"), (P.look = "glare"));
  } else if (kind === "hands") {
    // it rears up tall, both paws high
    P.h += 26 * w;
    P.sy += 0.14 * w;
    P.sx -= 0.09 * w;
    P.lift = 0.4 * w;
    if (w > 0.1) ((P.al = "up"), (P.ar = "up"), (P.look = "glare"));
    if (w > 0.55) P.mouth = "grin";
  } else if (kind === "snuff") {
    // it looks up at the lantern and reaches a tendril toward it
    P.pitch -= 0.12 * w;
    P.sy += 0.09 * w;
    P.sx -= 0.05 * w;
    P.liftL = 0.2 * w;
    if (w > 0.1) P.al = "sweep";
    if (w > 0.5) P.look = "wide";
    if (w > 0.35) P.mouth = "o";
  } else if (kind === "curse") {
    P.gem = w;
    P.tail = 0.6 * w;
    P.pitch += 0.16 * w;
    if (w > 0.1) ((P.al = "point"), (P.look = "glare"));
  } else if (kind === "split") {
    // it shivers and wobbles before the ink divides
    P.shake = w * m;
    P.wob = 1 + 3 * w;
    P.sy += 0.1 * w;
    P.sx += 0.1 * w;
    P.look = "wide";
    P.mouth = "o";
    if (w > 0.1) ((P.al = "up"), (P.ar = "up"));
    P.alpha = 1 - 0.3 * w * m * (0.5 + 0.5 * Math.sin(c.clock * 31));
  } else if (kind === "pulse") {
    // eyes closed, the moon lifted high: gathering
    P.tail = w;
    P.moon = w;
    P.h -= 8 * w;
    P.sy -= 0.12 * w;
    P.sx += 0.08 * w;
    P.look = "closed";
    P.mouth = "flat";
    if (w > 0.1) ((P.al = "wrap"), (P.ar = "wrap"));
  }
  // the follow-through (none with reduced motion)
  if (!c.reduced) {
    if (cast === "lunge") {
      const k = after(age, 0.55);
      if (k > 0.05) {
        P.h += 6 * k;
        P.sy += 0.12 * k;
        P.sx -= 0.08 * k;
        P.pitch += 0.34 * k;
        P.al = "sweep";
        P.ar = "up";
        P.look = "glare";
        P.mouth = "grin";
      }
    } else if (cast === "hands") {
      const k = after(age, 0.45);
      if (k > 0.05) {
        P.h -= 10 * k;
        P.sy -= 0.2 * k;
        P.sx += 0.16 * k;
        P.al = P.ar = "slump";
        P.look = "glare";
        P.mouth = "grin";
      }
    } else if (cast === "snuff") {
      const k = after(age, 0.6);
      if (k > 0.05) {
        // it blows the lantern out
        P.pitch += 0.12 * k;
        P.sy -= 0.06 * k;
        P.look = "closed";
        P.mouth = "o";
      }
    } else if (cast === "curse") {
      const k = after(age, 0.7);
      P.gem = Math.max(P.gem, k);
      P.tail = Math.max(P.tail, 0.6 * k);
      if (k > 0.05) ((P.look = "glare"), (P.mouth = "grin"));
    } else if (cast === "split") {
      const k = after(age, 0.5);
      P.sy -= 0.18 * k;
      P.sx += 0.18 * k;
      if (k > 0.05) ((P.look = "glare"), (P.mouth = "grin"));
    } else if (cast === "pulse") {
      const k = after(age, 0.6);
      P.moon = Math.max(P.moon, 1.2 * k);
      P.tail = Math.max(P.tail, k);
      P.h += 18 * k;
      P.sy += 0.14 * k;
      if (k > 0.05) {
        P.look = "wide";
        P.mouth = "grin";
        P.al = P.ar = "up";
        P.lift = 0.3 * k;
      }
    }
    const roar = after(c.roarAge, 1.1);
    if (roar > 0.05) {
      // the night deepens: it surges up tall, the moon flares
      P.h += 26 * roar;
      P.sy += 0.2 * roar;
      P.sx -= 0.12 * roar;
      P.lift = 0.4 * roar;
      P.moon = Math.max(P.moon, 1.2 * roar);
      P.gem = Math.max(P.gem, roar);
      P.tail = Math.max(P.tail, 0.8 * roar);
      P.al = P.ar = "up";
      P.look = "glare";
      P.mouth = "grin";
    }
  }
  if (c.exposed && !c.stagger) {
    P.look = "wide";
    P.mouth = "o";
    P.core = 1;
    P.al = P.ar = "up";
    P.lift = 0.2;
    P.h -= 2;
  }
  if (c.stagger) {
    P.look = "dizzy";
    P.mouth = "wavy";
    P.core = 1;
    P.stars = 1;
    P.al = P.ar = "slump";
    P.h = 80;
    P.sy = 0.88;
    P.sx = 1.08;
    P.brot += c.reduced ? 0.06 : Math.sin(c.clock * 3.2) * 0.1;
    P.lean += c.reduced ? 0 : Math.sin(c.clock * 2.1) * 0.05;
  }
  if (c.hurt > 0.3 && !c.dead && !c.reduced) {
    P.look = "hurt";
    P.mouth = "o";
    P.brot -= 0.12 * c.hurt;
    P.sy -= 0.16 * c.hurt;
    P.sx += 0.14 * c.hurt;
    P.shake = Math.max(P.shake, 0.6 * c.hurt);
  }
  if (c.dead) {
    // dawn: it sighs, melts into a puddle and the puddle fades
    const a = c.reduced ? 3 : c.deadAge;
    P.melt = smooth(0.2, 2.2, a);
    P.alpha = 1 - smooth(2.6, 3.4, a);
    P.look = "closed";
    P.mouth = "wavy";
    P.al = P.ar = "slump";
    P.h = lerp(HOVER, 78, smooth(0, 1, a));
    P.core = 0;
    P.stars = 0;
    P.moonFlick = 1;
    P.blink = false;
  }
  // the jelly: squash and stretch out of phase, livelier each phase
  const wob = (0.022 + 0.008 * (c.phase - 1)) * P.wob * m * (1 - P.melt);
  P.sx += Math.sin(t * 3.3) * wob;
  P.sy -= Math.sin(t * 3.3) * wob;
  if (P.shake) P.brot += Math.sin(t * 41) * 0.05 * P.shake;
  if (P.blink && (P.look === "idle" || P.look === "glare")) P.look = "closed";
  return P;
}

/** The facing shown (eight ways, with hysteresis) and the turn towards it. */
export function inkTurn(
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

// ════════════════════════ placing the images ════════════════════════
export interface Placement {
  key: string;
  piece: string;
  x: number;
  y: number;
  rot: number;
  /** Scale in rig units per atlas pixel already divided out: world px per piece rig unit. */
  sx: number;
  sy: number;
  alpha: number;
  z: number;
  glow?: boolean;
}
type Mat = [number, number, number, number, number, number];
const I: Mat = [1, 0, 0, 1, 0, 0];
const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const T = (x: number, y: number): Mat => [1, 0, 0, 1, x, y];
const R = (a: number): Mat => [
  Math.cos(a),
  Math.sin(a),
  -Math.sin(a),
  Math.cos(a),
  0,
  0,
];
const S = (x: number, y = x): Mat => [x, 0, 0, y, 0, 0];
const pt = (m: Mat, x: number, y: number) => ({
  x: m[0] * x + m[2] * y + m[4],
  y: m[1] * x + m[3] * y + m[5],
});

export interface InkLookOpts {
  facing: number;
  phase: number;
  clock: number;
  /** A copy: no idle drips (it must still look exactly alike otherwise). */
  cheap?: boolean;
  /** The real one in light: the floor direction away from the light, and how strong. */
  shadow?: { dx: number; dy: number; alpha: number };
}
/**
 * Pose → every image's placement (world px, from the floor under the body),
 * and where its head, gem, eyes, mouth, moon and core are.
 */
export function inkPlacements(P: InkPose, o: InkLookOpts) {
  const list: Placement[] = [];
  const F = FACING[o.facing] as { v: number; m: boolean },
    v = F.v,
    A = ATT[v];
  const phase = clamp(Math.round(o.phase), 1, 3);
  let order = 0;
  /** Place piece `name` with the matrix m, then translate/rotate/scale it. */
  const put = (
    key: string,
    name: string,
    m: Mat,
    x: number,
    y: number,
    z: number,
    opt: {
      rot?: number;
      sx?: number;
      sy?: number;
      alpha?: number;
      glow?: boolean;
      flip?: boolean;
    } = {},
  ) => {
    const alpha = (opt.alpha ?? 1) * P.alpha;
    if (alpha <= 0.01) return;
    const f = mul(
      mul(mul(m, T(x, y)), R(opt.rot ?? 0)),
      S((opt.flip ? -1 : 1) * (opt.sx ?? 1), opt.sy ?? 1),
    );
    const sx = Math.hypot(f[0], f[1]);
    list.push({
      key,
      piece: name,
      x: f[4],
      y: f[5],
      rot: Math.atan2(f[1], f[0]),
      sx,
      sy: (f[0] * f[3] - f[1] * f[2]) / (sx || 1),
      alpha: clamp(alpha),
      z: z + order++ * 1e-4,
      glow: opt.glow,
    });
  };
  const W = S(INK_SCALE);
  // ── the floor: the puddle (every body), the melt, and the real one's shadow in lantern light ──
  const ps = (0.82 + 0.1 * phase) * (1 + 0.9 * P.melt) * (P.sx * 0.5 + 0.5);
  put("puddle", "puddle", W, 0, 0, -100, {
    sx: ps / 0.85,
    sy: ps / 0.85,
    alpha: 0.9 * (1 - 0.6 * smooth(0.3, 1, P.melt)),
  });
  const mm = P.melt,
    tri = (a: number, b: number, c: number) =>
      mm <= a || mm >= c ? 0 : mm < b ? smooth(a, b, mm) : 1 - smooth(b, c, mm);
  put("melt1", "melt_1", W, 0, 5, -99, {
    sx: 1,
    sy: 1,
    alpha: tri(0.3, 0.42, 0.72),
  });
  put("melt2", "melt_2", W, 0, 5, -98.9, {
    sx: 1,
    sy: 1,
    alpha: tri(0.5, 0.72, 0.95),
  });
  put("melt", "melt", W, 0, 3, -98.8, {
    sx: 1.06,
    sy: 1.06,
    alpha: smooth(0.82, 1, mm),
  });
  if (o.shadow && o.shadow.alpha > 0.01) {
    // cast along the floor away from the light (the floor is seen at 0.62)
    const a = Math.atan2(o.shadow.dy / 0.62, o.shadow.dx);
    const k = Math.hypot(Math.cos(a), 0.62 * Math.sin(a));
    put("shadow", "castShadow", W, 0, 6, -99.5, {
      rot: Math.atan2(0.62 * Math.sin(a), Math.cos(a)),
      sx: 1.25 * k,
      sy: (0.62 / k) * 1.1,
      alpha: o.shadow.alpha * (1 - P.melt),
    });
  }
  // ── the body's frame: up to its hover, leaning, mirrored for the far facings ──
  let m = mul(T(0, -P.h * INK_SCALE), R(P.lean));
  m = mul(m, S(INK_SCALE));
  if (F.m) m = mul(m, S(-1, 1));
  m = mul(m, T(0, P.bdy));
  m = mul(m, R(P.pitch * PITCH_SCREEN[v] + P.brot));
  const fwd = P.pitch * (1 - PITCH_SCREEN[v]);
  const melt = P.melt,
    sm = Math.min(melt, 0.45);
  const baseY = yS(B_BOT);
  const sx = P.sx * (1 + 0.5 * sm),
    sy = P.sy * (1 - Math.abs(fwd) * 0.14) * (1 - 0.6 * sm);
  const sq = (q: { x: number; y: number }) => ({
    x: q.x * sx,
    y: baseY + (q.y - baseY) * sy,
  });
  const solid = clamp(1 - smooth(0.3, 0.42, melt));
  const out: {
    head: { x: number; y: number };
    body: { x: number; y: number };
    base: { x: number; y: number };
    core: { x: number; y: number };
    moon: { x: number; y: number };
    gem?: { x: number; y: number };
    mouth?: { x: number; y: number };
    eyes: { x: number; y: number }[];
    moonGlow: number;
  } = {
    head: pt(m, 0, yS(40)),
    body: pt(m, 0, 0),
    base: pt(m, A.base.x, A.base.y),
    core: pt(m, 0, 0),
    moon: pt(m, 0, 0),
    eyes: [],
    moonGlow: 0,
  };
  // the tail with its crescent, and the crescent's own light (it flickers on the real one only)
  const tr =
    (P.tail * 0.42 +
      Math.sin(P.t * 1.6) * 0.07 * (P.melt ? 0 : 1) -
      0.95 * melt) *
    TSIGN[v];
  const tp = sq(A.tail),
    te = { x: A.tailEnd.x - A.tail.x, y: A.tailEnd.y - A.tail.y };
  const ca = Math.cos(tr),
    sa = Math.sin(tr);
  const moonAt = {
    x: tp.x + te.x * ca - te.y * sa,
    y: tp.y + te.x * sa + te.y * ca,
  };
  const tz = v === 2 ? -999 : Math.min(A.tailZ, A.moonZ);
  put("tail", `tail_${v}`, m, tp.x, tp.y, tz, { rot: tr, alpha: solid });
  const hot = (MOON_BY_PHASE[phase] + 0.4 * P.moon) * P.moonFlick * solid;
  put("moon", "moonHot", m, moonAt.x, moonAt.y, tz + 0.01, {
    rot: tr,
    sx: MOON_S,
    sy: MOON_S,
    alpha: Math.min(1, hot),
    glow: true,
  });
  const cj = { x: -MOON_JOIN.x * MOON_S, y: -MOON_JOIN.y * MOON_S };
  out.moon = pt(
    m,
    moonAt.x + cj.x * ca - cj.y * sa,
    moonAt.y + cj.x * sa + cj.y * ca,
  );
  out.moonGlow = hot;
  // the paws
  for (const side of ["L", "R"] as const) {
    const pose = side === "L" ? P.al : P.ar,
      sh = sq(side === "L" ? A.shL : A.shR);
    const mirror = (v === 0 || v === 4) && side === "R";
    // from the side, a raised paw lifting further would swing across the face
    const rot =
      ((P.lift + (side === "L" ? P.liftL : P.liftR)) * (v === 2 ? 0.1 : 0.6) +
        (side === "L" ? P.floatL : P.floatR)) *
      (ASIGN[v] as Record<string, number>)[side];
    const st =
      armStates(pose) > 1 && (side === "L" ? P.flutL : P.flutR) ? 1 : 0;
    put(
      "paw" + side,
      `arm_${v}_${mirror ? "L" : side}_${pose}_${st}`,
      m,
      sh.x,
      sh.y,
      (AZ[v] as Record<string, number>)[side + pose],
      { rot, flip: mirror, alpha: solid },
    );
  }
  // the body (ears, gloss and rim baked in), the phase's dark, the hanging drips as one strip
  const bm = mul(mul(mul(m, T(0, baseY)), S(sx, sy)), T(0, -baseY));
  put("body", `body_${v}`, bm, 0, 0, 0, { alpha: solid });
  const deep = DEEP_BY_PHASE[phase];
  if (deep > 0.01)
    put("deep", `deep_${v}`, bm, 0, 0, 0.001, { alpha: deep * solid });
  if (!o.cheap)
    put("hangs", `hangs_${v}_${phase}`, bm, 0, 0, 0.002, { alpha: solid });
  out.base = pt(bm, A.base.x, A.base.y);
  out.body = pt(bm, 0, 0);
  out.head = pt(bm, 0, yS(40));
  // the face: one rigid group (eyes with blush and gem, and the mouth), moved with the squash, never squashed
  if (v <= 2 && solid > 0.05) {
    const dy = sq({ x: 0, y: EYE_LINE }).y - EYE_LINE;
    put("eyes", `eyes_${v}_${P.look}`, m, 0, dy, 1, { alpha: solid });
    put("mouth", `mouth_${v}_${P.mouth}`, m, 0, dy, 1.01, { alpha: solid });
    out.eyes = EYEP[v].map((e: { x: number; y: number }) =>
      pt(m, e.x, e.y + dy),
    );
    out.gem = pt(m, GEMP[v].x, GEMP[v].y + dy);
    out.mouth = pt(m, MOUTHP[v].x, MOUTHP[v].y + 4 + dy);
  }
  // the core, found or staggered: a gleam low on the belly
  const cc = sq(A.core);
  out.core = pt(m, cc.x, cc.y);
  if (P.core > 0.02) {
    const f = P.core < 0.4 ? 0 : P.core < 0.8 ? 1 : 2;
    const pulse = 0.6 * (1 + Math.sin(P.t * 5) * 0.04);
    put("core", `core_${f}`, m, cc.x, cc.y, 1.2, {
      alpha: Math.min(1, P.core * 1.6) * solid,
      sx: pulse,
      sy: pulse,
    });
  }
  // falling drips: one looping frame stretched to the gap (the real one only)
  if (!o.cheap && !P.melt && P.alpha > 0.3) {
    const n = [2, 2, 3, 5][phase];
    const f = Math.floor(o.clock * 0.75 * DRIP_FRAMES) % DRIP_FRAMES;
    const top = out.base.y + 4 * INK_SCALE,
      gap = Math.max(4, -2 - top);
    put(
      "drips",
      `drips_${n}_${f}`,
      W,
      out.base.x / INK_SCALE,
      top / INK_SCALE,
      0.5,
      {
        sy: gap / (DRIP_L * INK_SCALE),
      },
    );
  }
  // glows (additive): the moon, the gem while casting, the open core
  put(
    "moonGlow",
    "glow_gold",
    W,
    out.moon.x / INK_SCALE,
    out.moon.y / INK_SCALE,
    2,
    {
      sx: (18 + 14 * hot) / 32 / 0.85,
      sy: (18 + 14 * hot) / 32 / 0.85,
      alpha: 0.5 * Math.min(1, hot),
      glow: true,
    },
  );
  if (P.gem > 0.05 && out.gem)
    put(
      "gemGlow",
      "glow_amber",
      W,
      out.gem.x / INK_SCALE,
      out.gem.y / INK_SCALE,
      2,
      {
        sx: 17 / 32 / 0.85,
        sy: 17 / 32 / 0.85,
        alpha: P.gem * 0.9,
        glow: true,
      },
    );
  if (P.core > 0.05)
    put(
      "coreGlow",
      "glow_gold",
      W,
      out.core.x / INK_SCALE,
      out.core.y / INK_SCALE,
      2,
      {
        sx: 22 / 32 / 0.85,
        sy: 22 / 32 / 0.85,
        alpha: P.core * 0.6,
        glow: true,
      },
    );
  if (P.stars > 0.5)
    for (let i = 0; i < 3; i++) {
      const a = P.t * 3 + (i * TAU) / 3;
      put(
        "star" + i,
        "star",
        W,
        out.head.x / INK_SCALE + Math.cos(a) * 54,
        out.head.y / INK_SCALE - 68 + Math.sin(a) * 12,
        3,
        { rot: a },
      );
    }
  return { placements: list, ...out, view: v, mirrored: F.m };
}

// ════════════════════════ the atlas ════════════════════════
export interface InkFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  q: number;
  ox: number;
  oy: number;
}
export interface InkAtlas {
  canvas: HTMLCanvasElement;
  frames: Record<string, InkFrame>;
  bytes: number;
}
/** Paint every piece into one canvas (fixed density: it never follows the screen's pixel ratio). */
export function paintInkAtlas(): InkAtlas {
  return buildInkAtlas(1) as InkAtlas;
}

/** Draw placements onto a canvas (the briefing diagram, the splash art). */
export function drawPlacements(
  ctx: CanvasRenderingContext2D,
  atlas: InkAtlas,
  placements: Placement[],
  x: number,
  y: number,
  k = 1,
) {
  for (const p of [...placements].sort((a, b) => a.z - b.z)) {
    const f = atlas.frames[p.piece];
    if (!f) continue;
    ctx.save();
    ctx.globalAlpha = clamp(p.alpha);
    if (p.glow) ctx.globalCompositeOperation = "lighter";
    ctx.translate(x + p.x * k, y + p.y * k);
    ctx.rotate(p.rot);
    ctx.scale((p.sx * k) / f.q, (p.sy * k) / f.q);
    ctx.drawImage(
      atlas.canvas,
      f.x,
      f.y,
      f.w,
      f.h,
      -f.ox * f.q,
      -f.oy * f.q,
      f.w,
      f.h,
    );
    ctx.restore();
  }
}

let guideAtlas: InkAtlas | undefined;
let guideUrls: Partial<Record<"calm" | "exposed", string>> = {};
const guideCue = (exposed: boolean): InkCue => ({
  clock: 0,
  phase: 1,
  reduced: true,
  windup: 0,
  castAge: 99,
  stagger: false,
  exposed,
  hurt: 0,
  dead: false,
  deadAge: 0,
  roarAge: 99,
  flicker: false,
});
/**
 * Inkpurr as an image URL for the briefing diagrams (drawn once per look),
 * at three-quarter; `exposed` opens its core. Empty outside a browser.
 */
export function inkGuideImage(exposed = false) {
  const width = 300,
    height = 260,
    k = 1.35,
    cx = 150,
    cy = 236;
  const key = exposed ? "exposed" : "calm";
  const placed = inkPlacements(inkPose(guideCue(exposed)), {
    facing: 1,
    phase: 1,
    clock: 0,
  });
  if (
    !guideUrls[key] &&
    typeof document !== "undefined" &&
    typeof document.createElement === "function"
  ) {
    try {
      guideAtlas ??= paintInkAtlas();
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        drawPlacements(ctx, guideAtlas, placed.placements, cx, cy, k);
        guideUrls[key] = canvas.toDataURL("image/png");
      }
    } catch {
      /* No drawing surface: the diagram shows no picture. */
    }
  }
  // the crop around it, and where the core sits
  const top = cy + (placed.moon.y - 30) * k,
    bottom = cy + 14 * k;
  const left = cx - 112 * k * INK_SCALE * 1.3,
    right = cx + 112 * k * INK_SCALE * 1.3;
  const cl = (val: number, hi: number) => Math.max(0, Math.min(hi, val));
  return {
    url: guideUrls[key] ?? "",
    width,
    height,
    crop: [
      cl(left, width),
      cl(top, height),
      cl(right, width) - cl(left, width),
      cl(bottom, height) - cl(top, height),
    ] as const,
    core: [cx + placed.core.x * k, cy + placed.core.y * k] as const,
  };
}
/** Forget the drawn guide pictures (tests). */
export function resetInkGuide() {
  guideUrls = {};
}
/** Which drawn view and mirror a facing uses (tests). */
export const inkView = (facing: number) =>
  FACING[facing] as { v: number; m: boolean };
export const INK_VIEWS = VIEWS.length;
export { makeView, SH };
