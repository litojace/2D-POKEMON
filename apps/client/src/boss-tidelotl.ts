/**
 * Tidelotl, the axolotl that is Tidewyrm's look: the pieces it is drawn
 * from, the pose for each battle state, and where every piece goes in a
 * frame. Pure (no Phaser): boss-tidelotl-rig.ts paints the pieces once into
 * an atlas and places images from tidelotlPlacements every frame.
 *
 * Eight facings come from five drawn views (front, front-¾, side, back-¾,
 * back) and three mirrors. A spin (the Undertow, the tail sweep) turns
 * through the facings smoothly: the facing it is leaving is drawn whole and
 * the next fades in over it.
 */
import {
  ATTACH,
  EYES,
  EXPRS,
  HEAD,
  HEAD_YAW,
  MOUTHS,
  MOUTHS as MOUTH_LIST,
  PEARL_DIR,
  TAIL_POSE,
  VIEW_YAW,
  clamp,
  ease,
  gillGeom,
  lerp,
  makeView,
  norm3,
  paintBody,
  paintEye,
  paintFade,
  paintFoam,
  paintGill,
  paintHead,
  paintLeg,
  paintMouth,
  paintPearl,
  paintShadow,
  paintSwirl,
  paintTail,
  type Ctx,
  type Expr,
  type LegPose,
  type Mouth,
  paintingDensity,
  paintingPhase,
} from "./boss-tidelotl-paint";

void MOUTH_LIST;
/** Rig px → world px. */
export const LOTL_SCALE = 0.86;
/** Facing 0..7 (45° steps, 0 = towards the camera, 2 = screen right) → drawn view + mirror. */
export const FACING = [
  { v: 0, m: false },
  { v: 1, m: false },
  { v: 2, m: false },
  { v: 3, m: false },
  { v: 4, m: false },
  { v: 3, m: true },
  { v: 2, m: true },
  { v: 1, m: true },
];

// ── the pieces ──
export interface LotlPiece {
  name: string;
  /** Rig-px box the painter draws in, around the piece's origin. */
  box: [number, number, number, number];
  /** Atlas px per rig px: fixed, never following the device's pixel ratio. */
  q: number;
  /** Its colours follow the phase (head, body, legs, tail). */
  skin: boolean;
  outline: boolean;
  line: number;
  lineColor?: string;
  paint: (ctx: Ctx) => void;
}
/**
 * Atlas px per rig px by part. At LOTL_SCALE on a 2× screen one rig px is
 * about 1.5 device px when the camera is close: the face sits above that,
 * the head about at it, gills, body and tail a little below it.
 */
const QUAL = {
  head: 1.45,
  eye: 2.0,
  mouth: 1.8,
  pearl: 2.0,
  gill: 1.25,
  body: 1.2,
  leg: 1.35,
  tail: 1.0,
  fx: 1.0,
};
const LEGS_F: LegPose[] = ["stand", "paddle", "splay", "up"];
const LEGS_B: LegPose[] = ["stand", "paddle", "splay"];
/** Every piece, main and skin. */
export function tidelotlPieces(): LotlPiece[] {
  const out: LotlPiece[] = [];
  const add = (
    p: Omit<LotlPiece, "outline" | "line" | "skin"> & Partial<LotlPiece>,
  ) => out.push({ outline: true, line: 1.6, skin: false, ...p });
  for (let v = 0; v < 5; v++) {
    add({
      name: `body_${v}`,
      box: [-110, -95, 110, 95],
      q: QUAL.body,
      skin: true,
      line: 1.8,
      paint: (c) => paintBody(c, { v }),
    });
    add({
      name: `head_${v}`,
      box: [-110, -100, 110, 100],
      q: QUAL.head,
      skin: true,
      line: 2,
      paint: (c) => paintHead(c, { v }),
    });
    for (const e of EYES[v])
      for (const x of e.peek ? (["idle"] as Expr[]) : EXPRS)
        add({
          name: `eye_${v}_${e.id}_${x}`,
          box: [-105, -60, 105, 60],
          q: QUAL.eye,
          outline: false,
          paint: (c) => paintEye(c, { v, id: e.id, expr: x }),
        });
    if (v < 4)
      for (const m of MOUTHS)
        add({
          name: `mouth_${v}_${m}`,
          box: [-105, -10, 105, 90],
          q: QUAL.mouth,
          outline: false,
          paint: (c) => paintMouth(c, { v, mouth: m }),
        });
    if (v < 3)
      add({
        name: `pearl_${v}`,
        box: [-100, -100, 100, 100],
        q: QUAL.pearl,
        line: 1,
        lineColor: "rgba(120,40,80,0.6)",
        paint: (c) => paintPearl(c, { v }),
      });
    for (const side of ["L", "R"] as const) {
      if ((v === 0 || v === 4) && side === "R") continue;
      for (let i = 0; i < 3; i++)
        for (const lit of [0, 1])
          add({
            name: `gill_${v}_${side}_${i}_${lit}`,
            box: [-120, -120, 120, 120],
            q: QUAL.gill,
            outline: false,
            paint: (c) => paintGill(c, { v, side, i, lit }),
          });
      for (const fb of ["F", "B"] as const)
        for (const pose of fb === "F" ? LEGS_F : LEGS_B)
          add({
            name: `leg_${v}_${side}_${fb}_${pose}`,
            box: [-70, -70, 70, 70],
            q: QUAL.leg,
            skin: true,
            line: 1.4,
            paint: (c) => paintLeg(c, { v, side, fb, pose }),
          });
    }
    for (const pose of Object.keys(TAIL_POSE))
      if (pose !== "restB" || v >= 3)
        add({
          name: `tail_${v}_${pose}`,
          box: [-200, -150, 200, 150],
          q: QUAL.tail,
          skin: true,
          line: 1.4,
          lineColor: "rgba(10,70,84,0.8)",
          paint: (c) => paintTail(c, { v, pose }),
        });
  }
  add({
    name: "foamBack",
    box: [-66, -28, 66, 4],
    q: 1.1,
    outline: false,
    paint: (c) => paintFoam(c, { front: 0 }),
  });
  add({
    name: "foamFront",
    box: [-66, -4, 66, 34],
    q: 1.1,
    outline: false,
    paint: (c) => paintFoam(c, { front: 1 }),
  });
  add({
    name: "fade",
    box: [-110, -12, 110, 30],
    q: QUAL.fx,
    outline: false,
    paint: (c) => paintFade(c),
  });
  add({
    name: "swirl",
    box: [-54, -30, 54, 8],
    q: QUAL.fx,
    outline: false,
    paint: (c) => paintSwirl(c),
  });
  add({
    name: "shadow",
    box: [-62, -26, 62, 26],
    q: 0.8,
    outline: false,
    paint: (c) => paintShadow(c, { deep: 0 }),
  });
  add({
    name: "deep",
    box: [-62, -26, 62, 26],
    q: 0.8,
    outline: false,
    paint: (c) => paintShadow(c, { deep: 1 }),
  });
  return out;
}

// ── where things sit in each view ──
export const ATT = VIEW_YAW.map((yaw) => {
  const V = makeView(yaw),
    o: Record<string, { x: number; y: number; z: number }> = {};
  for (const k in ATTACH) o[k] = V.P(ATTACH[k]);
  return o;
});
const GILL_AT = HEAD_YAW.map((_, v) => {
  const o: Record<
    string,
    { x: number; y: number; z: number; tx: number; ty: number }
  > = {};
  for (const side of ["L", "R"] as const)
    for (let i = 0; i < 3; i++) {
      const g = gillGeom(v, side, i);
      o[side + i] = {
        x: g.R.x,
        y: g.R.y,
        z: g.z,
        tx: g.T.x - g.R.x,
        ty: g.T.y - g.R.y,
      };
    }
  return o;
});
const onHead = (d: { x: number; y: number; z: number }) => ({
  x: d.x * HEAD.rx,
  y: d.y * HEAD.ry,
  z: d.z * HEAD.rz,
});
const headPoint = (dir: { x: number; y: number; z: number }) =>
  HEAD_YAW.map((y) => {
    const V = makeView(y),
      pt = onHead(dir),
      n = V.N(
        norm3(pt.x / HEAD.rx ** 2, pt.y / HEAD.ry ** 2, pt.z / HEAD.rz ** 2),
      );
    return { ...V.P(pt), vis: n.z };
  });
const PEARL_AT = headPoint(PEARL_DIR);
const MOUTH_AT = headPoint(norm3(0, -0.34, 0.94));
const VIEW_LEN = [0.95, 1.18, 1.4, 1.18, 0.95];

// ── the pose for a battle state ──
export interface LotlCue {
  clock: number;
  phase: number;
  reduced: boolean;
  /** The attack being wound up (its warning), 0–1 through the windup. */
  windKind?: string;
  windup: number;
  /** The last attack cast, and seconds since. */
  castKind?: string;
  castAge: number;
  stranded: boolean;
  stagger: boolean;
  hurt: number;
  dead: boolean;
  /** 0–1 out of the water after surfacing. */
  rise: number;
  /** 0–1 sunk after dying. */
  deathSink: number;
  /** Seconds since a new phase began, large when long past. */
  roarAge: number;
}
export interface LotlPose {
  /** Body centre above the water or the sand (rig px). */
  h: number;
  sx: number;
  sy: number;
  lean: number;
  brot: number;
  hrot: number;
  hdy: number;
  legF: LegPose;
  legB: LegPose;
  tail: string;
  trot: number;
  expr: Expr;
  mouth: Mouth;
  puff: number;
  flare: number;
  droop: number;
  gillAmp: number;
  pearl: number;
  exposed: number;
  stars: number;
  alpha: number;
  /** Seconds, for the gills' wave and the bob. */
  clock: number;
}
const after = (age: number, dur: number) =>
  age < 0 || age > dur ? 0 : Math.sin((age / dur) * Math.PI);
const NUM = [
  "h",
  "sx",
  "sy",
  "lean",
  "brot",
  "hrot",
  "hdy",
  "trot",
  "puff",
  "flare",
  "droop",
  "gillAmp",
  "pearl",
  "exposed",
  "stars",
] as const;
/** Ease the numbers of P towards o by t; names switch once t passes `at`. */
function toward(P: LotlPose, o: Partial<LotlPose>, t: number, at = 0.35) {
  if (t <= 0) return;
  for (const k of NUM)
    if (o[k] !== undefined) P[k] = lerp(P[k], o[k] as number, t);
  if (t >= at) {
    if (o.legF) P.legF = o.legF;
    if (o.legB) P.legB = o.legB;
    if (o.tail) P.tail = o.tail;
    if (o.expr) P.expr = o.expr;
    if (o.mouth) P.mouth = o.mouth;
  }
}
export function tidelotlIdle(clock = 0, reduced = false): LotlPose {
  return {
    h: 20,
    sx: 1,
    sy: 1,
    lean: 0,
    brot: 0,
    hrot: 0,
    hdy: 0,
    legF: "paddle",
    legB: "paddle",
    tail: "rest",
    trot: 0,
    expr: "idle",
    mouth: "smile",
    puff: 0,
    flare: 0,
    droop: 0,
    gillAmp: 1,
    pearl: 0.35,
    exposed: 0,
    stars: 0,
    alpha: 1,
    clock: reduced ? 0.3 : clock,
  };
}
export function tidelotlPose(c: LotlCue): LotlPose {
  const m = c.reduced ? 0 : 1,
    clock = c.reduced ? 0.3 : c.clock;
  const P = tidelotlIdle(clock, c.reduced);
  const w = clamp(c.windup),
    k = c.windKind;
  if (k === "wave")
    toward(
      P,
      {
        h: 52,
        sy: 1.12,
        sx: 0.92,
        flare: 1,
        hdy: -8,
        legF: "up",
        tail: "up",
        expr: "smug",
        mouth: w > 0.7 ? "open" : "grin",
      },
      w,
      0.15,
    );
  else if (k === "bubbles")
    toward(
      P,
      { puff: 1.2, hdy: -6, h: 26, sy: 1.06, expr: "smug", mouth: "o" },
      w,
      0.1,
    );
  else if (k === "hightide")
    toward(
      P,
      {
        h: 58,
        sy: 1.14,
        sx: 0.92,
        flare: 1,
        hdy: -12,
        pearl: 1,
        legF: "up",
        tail: "up",
        expr: w < 0.3 ? "closed" : "glare",
        mouth: "open",
      },
      w,
      0.15,
    );
  else if (k === "undertow")
    toward(
      P,
      {
        h: 14,
        flare: 0.5,
        gillAmp: 2,
        tail: "out",
        expr: "glare",
        mouth: "open",
      },
      w,
      0.2,
    );
  else if (k === "prison")
    toward(
      P,
      { puff: 1.3, h: 28, hdy: -4, sy: 1.08, expr: "smug", mouth: "o" },
      w,
      0.1,
    );
  if (k && k !== "slam") P.pearl = Math.max(P.pearl, 0.35 + 0.4 * w);
  // the follow-through of a cast (skipped with reduced motion)
  if (!c.reduced && c.castKind) {
    const a = c.castAge;
    if (c.castKind === "wave" || c.castKind === "hightide") {
      const s = after(a, 0.5);
      toward(
        P,
        {
          h: 22,
          sy: 0.82,
          sx: 1.18,
          trot: 0.3,
          hdy: 6,
          expr: "glare",
          mouth: "grin",
        },
        s,
        0.05,
      );
      if (c.castKind === "hightide" && a > 0.5 && a < 5)
        toward(P, { h: 34, expr: "smug", mouth: "smirk", flare: 0.3 }, 1);
    } else if (c.castKind === "bubbles" && a < 1.4) {
      toward(
        P,
        { puff: 0.5 * Math.max(0, Math.sin(a * 11)), mouth: "o", expr: "smug" },
        1,
      );
    } else if (c.castKind === "prison" && a < 5.5) {
      toward(P, { expr: "smug", mouth: a < 0.4 ? "grin" : "open" }, 1);
    } else if (c.castKind === "undertow" && a < 3) {
      toward(
        P,
        { h: 14, gillAmp: 2, tail: "out", expr: "glare", mouth: "open" },
        1,
      );
    }
  }
  // surfacing: it bursts up claws-first
  if (c.rise < 1 && !c.dead) {
    const r = ease(clamp(c.rise));
    toward(
      P,
      {
        h: lerp(-170, 64, r),
        sy: 1.2,
        sx: 0.86,
        legF: "up",
        tail: "up",
        expr: "glare",
        mouth: "open",
        flare: 1,
      },
      1,
    );
  }
  // a new phase: it curls up, then bursts up roaring, gills flared
  if (!c.reduced && c.roarAge >= 0 && c.roarAge < 1.6 && !c.dead) {
    const a = c.roarAge;
    if (a < 0.4)
      toward(
        P,
        {
          h: 14,
          sy: 0.84,
          sx: 1.14,
          puff: 1,
          droop: 0.4,
          hdy: 6,
          expr: "closed",
          mouth: "frown",
        },
        ease(a / 0.4),
      );
    else
      toward(
        P,
        {
          h: 60,
          sy: 1.18,
          sx: 0.88,
          flare: 1.2,
          hdy: -12,
          pearl: 1,
          legF: "up",
          tail: "up",
          expr: "glare",
          mouth: "open",
        },
        Math.sin(((a - 0.4) / 1.2) * Math.PI),
        0.05,
      );
  }
  // stranded on an island: belly-flat, legs splayed, flopping, dizzy, the pearl open
  if (c.stranded && !c.dead) {
    Object.assign(P, {
      h: 36,
      sy: 0.74,
      sx: 1.2,
      legF: "splay",
      legB: "splay",
      tail: "flop",
      hdy: 34,
      expr: "dizzy",
      mouth: "wavy",
      stars: 1,
      exposed: 1,
      pearl: 1,
      droop: 1,
      gillAmp: 0.6,
    });
    if (k === "slam") {
      // the tail sweep winds up: it pushes up, glaring, tail stretched out
      toward(
        P,
        {
          h: 50,
          sy: 1,
          sx: 1,
          hdy: 0,
          droop: 0,
          stars: 0,
          legF: "stand",
          legB: "stand",
          tail: "out",
          expr: "glare",
          mouth: "grin",
        },
        ease(w),
        0.4,
      );
    } else if (m) {
      const cc = (clock % 0.7) / 0.7,
        hop = Math.sin(Math.min(1, cc / 0.55) * Math.PI),
        land = cc > 0.55 ? Math.sin(((cc - 0.55) / 0.45) * Math.PI) : 0;
      P.h += hop * 14;
      P.sy *= 1 + hop * 0.08 - land * 0.1;
      P.sx *= 1 - hop * 0.05 + land * 0.08;
      P.brot += Math.sin(clock * 4.5) * 0.08;
      P.trot += Math.sin(clock * 9) * 0.25;
      P.hrot += Math.sin(clock * 3.3) * 0.1;
    }
  }
  if (c.castKind === "slam" && c.castAge < 0.7 && !c.dead)
    toward(
      P,
      {
        h: 50,
        sy: 1,
        sx: 1,
        hdy: 0,
        droop: 0,
        stars: 0,
        exposed: 0,
        legF: "stand",
        legB: "stand",
        tail: "out",
        expr: "glare",
        mouth: "grin",
        flare: 0.8,
      },
      1,
    );
  if (c.stranded || c.stagger) P.exposed = 1;
  if (c.stagger && !c.stranded && !c.dead)
    Object.assign(P, {
      expr: "dizzy",
      mouth: "wavy",
      stars: 1,
      droop: 0.8,
      h: 14,
      pearl: 1,
      hdy: 6,
    });
  if (c.hurt > 0 && !c.dead && !c.reduced)
    toward(
      P,
      {
        sy: 0.84,
        sx: 1.14,
        hrot: -0.16,
        hdy: 4,
        droop: 0.6,
        lean: -0.06,
        expr: "hurt",
        mouth: "frown",
      },
      c.hurt,
      0.3,
    );
  if (c.dead) {
    const s = clamp(c.deathSink);
    Object.assign(P, {
      expr: s > 0.55 ? "closed" : "sad",
      mouth: "frown",
      droop: 1,
      hdy: 8,
      hrot: 0.08,
      pearl: 0.15 * (1 - s),
      gillAmp: 0.4,
      exposed: 0,
      stars: 0,
      h: lerp(14, -200, Math.pow(s, 1.3)),
    });
  }
  // the living layer: bob, gills, tail swish, blink
  P.h += Math.sin(clock * 1.9) * 2.4 * m;
  P.hdy += Math.sin(clock * 1.9 - 0.7) * 1.4 * m;
  P.hrot += Math.sin(clock * 0.9) * 0.025 * m;
  P.trot += Math.sin(clock * 1.7) * 0.07 * m;
  if (
    m &&
    (P.expr === "idle" || P.expr === "smug" || P.expr === "glare") &&
    clock % 3.4 > 3.27
  )
    P.expr = "closed";
  if (P.stars > 0.5) {
    P.hrot += Math.sin(clock * 3) * 0.12 * m;
    P.lean += Math.sin(clock * 2.1) * 0.05 * m;
  }
  return P;
}

/** The facing shown (eight ways, with a little hysteresis) for a screen angle (0 = right, π/2 = down). */
export function lotlFacing(angle: number, previous?: number) {
  // facing 0 looks at the camera (down the screen), 2 to the right
  const c =
    (Math.atan2(Math.cos(angle), Math.sin(angle)) / (Math.PI / 4) + 16) % 8;
  if (previous !== undefined) {
    let d = c - previous;
    d -= Math.round(d / 8) * 8;
    if (Math.abs(d) < 0.62) return previous;
  }
  return Math.round(c) % 8;
}

// ── placing the pieces ──
type M = [number, number, number, number, number, number];
const mul = (A: M, B: M): M => [
  A[0] * B[0] + A[2] * B[1],
  A[1] * B[0] + A[3] * B[1],
  A[0] * B[2] + A[2] * B[3],
  A[1] * B[2] + A[3] * B[3],
  A[0] * B[4] + A[2] * B[5] + A[4],
  A[1] * B[4] + A[3] * B[5] + A[5],
];
const T = (x: number, y: number): M => [1, 0, 0, 1, x, y];
const R = (a: number): M => [
  Math.cos(a),
  Math.sin(a),
  -Math.sin(a),
  Math.cos(a),
  0,
  0,
];
const S = (x: number, y = x): M => [x, 0, 0, y, 0, 0];
export interface LotlPlacement {
  /** Stable key for the image showing it (a second key set for the fading-in facing). */
  key: string;
  piece: string;
  x: number;
  y: number;
  rot: number;
  sx: number;
  sy: number;
  alpha: number;
  /** Cut at the waterline (y = 0 in the rig's frame) when in water. */
  water: boolean;
}
export interface LotlLayout {
  placements: LotlPlacement[];
  head: { x: number; y: number };
  top: { x: number; y: number };
  pearl: { x: number; y: number };
  pearlVisible: boolean;
  mouth: { x: number; y: number };
  gillTip: { x: number; y: number };
}
const place = (
  key: string,
  piece: string,
  m: M,
  alpha: number,
  water: boolean,
): LotlPlacement => {
  const sx = Math.hypot(m[0], m[1]),
    rot = Math.atan2(m[1], m[0]),
    sy = (m[0] * m[3] - m[1] * m[2]) / (sx || 1);
  return { key, piece, x: m[4], y: m[5], rot, sx, sy, alpha, water };
};
/** One whole axolotl at one facing (keys prefixed with `pre`). */
function oneBoss(
  P: LotlPose,
  facing: number,
  phase: number,
  pre: string,
  alpha: number,
  legs: boolean,
  out: LotlPlacement[],
  wet: boolean,
) {
  const F = FACING[facing],
    v = F.v,
    A = ATT[v],
    lit = phase >= 2 ? 1 : 0;
  let root: M = mul(R(P.lean), S(LOTL_SCALE * P.sx, LOTL_SCALE * P.sy));
  root = mul(root, T(0, -P.h));
  if (F.m) root = mul(root, S(-1, 1));
  if (P.brot) root = mul(root, R(P.brot));
  const items: { z: number; f: () => void }[] = [];
  const put = (key: string, piece: string, m: M) =>
    out.push(place(pre + key, piece, m, alpha * P.alpha, wet));
  const tail = P.tail === "rest" && v >= 3 ? "restB" : P.tail;
  items.push({
    z: A.tail.z - 30,
    f: () =>
      put(
        "tail",
        `tail_${v}_${tail}`,
        mul(
          root,
          mul(
            T(A.tail.x, A.tail.y),
            R(P.trot * (v === 0 || v === 4 ? 0.6 : 1)),
          ),
        ),
      ),
  });
  if (legs)
    for (const fb of ["F", "B"] as const)
      for (const side of ["L", "R"] as const) {
        const hp = A["leg" + fb + side],
          mirror = (v === 0 || v === 4) && side === "R";
        const pose = fb === "F" ? P.legF : P.legB === "up" ? "stand" : P.legB;
        items.push({
          z: hp.z - 4,
          f: () =>
            put(
              `leg${fb}${side}`,
              `leg_${v}_${mirror ? "L" : side}_${fb}_${pose}`,
              mul(root, mul(T(hp.x, hp.y), S(mirror ? -1 : 1, 1))),
            ),
        });
      }
  items.push({ z: 0, f: () => put("body", `body_${v}`, root) });
  const head = { x: 0, y: 0 },
    top = { x: 0, y: 0 },
    pearl = { x: 0, y: 0 },
    mouth = { x: 0, y: 0 },
    gillTip = { x: 0, y: 0 };
  const HF = F,
    hv = HF.v;
  items.push({
    z: A.head.z,
    f: () => {
      const hm = mul(root, mul(T(A.head.x, A.head.y + P.hdy), R(P.hrot)));
      const G = GILL_AT[hv];
      const gill = (side: "L" | "R", i: number) => {
        const g = G[side + i],
          mirror = (hv === 0 || hv === 4) && side === "R";
        const wave =
          Math.sin(
            P.clock * (1.9 + P.gillAmp * 0.6) +
              i * 1.1 +
              (side === "L" ? 0 : 2.2),
          ) *
          0.07 *
          P.gillAmp;
        const sg = Math.sign(g.tx || 1) * (mirror ? -1 : 1);
        const rot =
          wave +
          P.droop * 0.45 * sg -
          P.flare * 0.12 * sg * (i === 0 ? 1 : i === 2 ? -1 : 0);
        const sc = 1 + P.flare * 0.14;
        put(
          `gill${side}${i}`,
          `gill_${hv}_${mirror ? "L" : side}_${i}_${lit}`,
          mul(hm, mul(T(g.x, g.y), mul(R(rot), S(mirror ? -sc : sc, sc)))),
        );
      };
      const order: { side: "L" | "R"; i: number; z: number }[] = [];
      for (const side of ["L", "R"] as const)
        for (let i = 0; i < 3; i++) order.push({ side, i, z: G[side + i].z });
      order.sort((a, b) => a.z - b.z);
      for (const o of order) if (o.z <= 0.02) gill(o.side, o.i);
      const puff = S(1 + P.puff * 0.075, 1 + P.puff * 0.03);
      put("head", `head_${hv}`, mul(hm, puff));
      for (const e of EYES[hv]) {
        const ex = e.peek ? "idle" : P.expr;
        put(`eye${e.id}`, `eye_${hv}_${e.id}_${ex}`, mul(hm, puff));
        if (hv === 0)
          put("eyef", `eye_${hv}_${e.id}_${ex}`, mul(hm, mul(S(-1, 1), puff)));
      }
      if (hv < 4) put("mouth", `mouth_${hv}_${P.mouth}`, mul(hm, puff));
      if (hv < 3) put("pearl", `pearl_${hv}`, mul(hm, puff));
      for (const o of order) if (o.z > 0.02) gill(o.side, o.i);
      const at = (x: number, y: number, o: { x: number; y: number }) => {
        o.x = hm[0] * x + hm[2] * y + hm[4];
        o.y = hm[1] * x + hm[3] * y + hm[5];
      };
      at(0, 0, head);
      at(0, -HEAD.ry, top);
      const pm = mul(hm, puff);
      pearl.x = pm[0] * PEARL_AT[hv].x + pm[2] * (PEARL_AT[hv].y - 3) + pm[4];
      pearl.y = pm[1] * PEARL_AT[hv].x + pm[3] * (PEARL_AT[hv].y - 3) + pm[5];
      at(MOUTH_AT[hv].x, MOUTH_AT[hv].y, mouth);
      const g0 = G.L0;
      at(g0.x + g0.tx, g0.y + g0.ty, gillTip);
    },
  });
  items.sort((a, b) => a.z - b.z);
  for (const it of items) it.f();
  return {
    head,
    top,
    pearl,
    pearlVisible: PEARL_AT[hv].vis > 0,
    mouth,
    gillTip,
  };
}
/**
 * Every image for a frame, in the rig's frame (origin = the boss on the
 * floor or the water's surface). `facing` may be fractional while it spins:
 * then the next facing fades in over the one it is leaving.
 */
export function tidelotlPlacements(
  P: LotlPose,
  facing: number,
  phase: number,
  wet: boolean,
): LotlLayout {
  const out: LotlPlacement[] = [];
  const f0 = ((Math.floor(facing) % 8) + 8) % 8,
    k = Number.isInteger(facing)
      ? 0
      : clamp((facing - Math.floor(facing) - 0.35) / 0.65),
    v = FACING[f0].v,
    L = VIEW_LEN[v];
  const above = P.h > -60,
    foam = wet && above && P.h < 100 ? clamp(1 - Math.abs(P.h - 20) / 90) : 0,
    fw = 0.86 * L * P.sx;
  if (wet) {
    if (above)
      out.push(
        place(
          "deep",
          "deep",
          mul(T(0, 6), S(1.15 * L, 1.1)),
          0.55 * P.alpha,
          false,
        ),
      );
    if (foam > 0)
      out.push(
        place("foamBack", "foamBack", S(fw, 0.86), 0.8 * foam * P.alpha, false),
      );
  } else {
    const sh = clamp(1.15 - P.h / 260, 0.45, 1);
    out.push(
      place(
        "shadow",
        "shadow",
        mul(T(0, 6), S(1.25 * L * sh, 1.25 * sh)),
        0.85 * P.alpha,
        false,
      ),
    );
  }
  const legs = !wet || P.h > 36;
  const pts = oneBoss(P, f0, phase, "", 1, legs, out, wet);
  if (k > 0.03) {
    oneBoss(P, (f0 + 1) % 8, phase, "b:", ease(k), false, out, wet);
    for (let i = 0; i < 2; i++) {
      const a = facing * (Math.PI / 4) * 1.6 + i * Math.PI,
        h = (40 + i * 30) * LOTL_SCALE;
      out.push(
        place(
          `smear${i}`,
          "swirl",
          mul(
            T(Math.cos(a) * 70, -h + Math.sin(a) * 22),
            mul(R(a + Math.PI / 2), S(1.1, 0.7)),
          ),
          0.75,
          false,
        ),
      );
    }
  }
  if (wet && above)
    out.push(place("fade", "fade", S(1.5, 0.93), 0.9 * P.alpha, false));
  if (foam > 0)
    out.push(
      place("foamFront", "foamFront", S(fw, 0.86), 0.9 * foam * P.alpha, false),
    );
  // phases 2 and 3: water swirls round it
  if (phase >= 2 && P.h > -30 && P.h < 90 && P.alpha > 0.5) {
    const n = phase >= 3 ? 3 : 2,
      Rr = phase >= 3 ? 92 : 80;
    for (let i = 0; i < n; i++) {
      const a = P.clock * 2.2 + (i * Math.PI * 2) / n;
      out.push(
        place(
          `swirl${i}`,
          "swirl",
          mul(
            T(Math.cos(a) * Rr, Math.sin(a) * Rr * 0.38 - 6),
            mul(R(a + Math.PI / 2), S(0.9, 0.6)),
          ),
          Math.sin(a) > 0 ? 0.8 : 0.35,
          false,
        ),
      );
    }
  }
  return { placements: out, ...pts };
}

// ── painting pieces (the rig's atlases and the briefing picture) ──
const PAD = 6,
  PAGE_W = 2048;
export interface LotlSlot {
  sx: number;
  sy: number;
  w: number;
  h: number;
  q: number;
  /** The piece's origin inside its frame (0–1). */
  ox: number;
  oy: number;
}
export interface Painted {
  canvas: HTMLCanvasElement;
  q: number;
  /** The origin in the trimmed canvas, in its px. */
  ox: number;
  oy: number;
}
/** Paint one piece: its own canvas, a soft darker outline, trimmed to its pixels. */
export function paintPiece(p: LotlPiece, phase: number): Painted | null {
  const w = Math.ceil((p.box[2] - p.box[0]) * p.q) + PAD * 2,
    h = Math.ceil((p.box[3] - p.box[1]) * p.q) + PAD * 2;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) return null;
  paintingDensity(p.q);
  paintingPhase(phase);
  g.translate(PAD - p.box[0] * p.q, PAD - p.box[1] * p.q);
  g.scale(p.q, p.q);
  g.lineJoin = "round";
  p.paint(g);
  let src = c;
  if (p.outline) {
    const d = document.createElement("canvas");
    d.width = w;
    d.height = h;
    const dg = d.getContext("2d", { willReadFrequently: true })!;
    dg.shadowColor = p.lineColor ?? "rgba(8,58,70,0.95)";
    dg.shadowBlur = p.line * p.q;
    dg.drawImage(c, 0, 0);
    dg.shadowBlur = p.line * p.q * 0.45;
    dg.drawImage(c, 0, 0);
    dg.shadowColor = "transparent";
    dg.drawImage(c, 0, 0);
    c.width = c.height = 0;
    src = d;
  }
  const data = src.getContext("2d")!.getImageData(0, 0, w, h).data;
  let x0 = w,
    y0 = h,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++)
      if (data[row + x * 4 + 3] > 3) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - 1);
  y0 = Math.max(0, y0 - 1);
  x1 = Math.min(w - 1, x1 + 1);
  y1 = Math.min(h - 1, y1 + 1);
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out
    .getContext("2d")!
    .drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  src.width = src.height = 0;
  return {
    canvas: out,
    q: p.q,
    ox: PAD - p.box[0] * p.q - x0,
    oy: PAD - p.box[1] * p.q - y0,
  };
}
/** Shelf-pack painted pieces (tallest first) into one page at its exact height. */
export function pack(list: { name: string; p: Painted }[]) {
  list.sort((a, b) => b.p.canvas.height - a.p.canvas.height);
  const slots = new Map<string, LotlSlot>();
  let x = 0,
    y = 0,
    shelf = 0,
    used = 0;
  for (const { name, p } of list) {
    const w = p.canvas.width,
      h = p.canvas.height;
    if (x + w > PAGE_W) {
      x = 0;
      y += shelf + 1;
      shelf = 0;
    }
    slots.set(name, { sx: x, sy: y, w, h, q: p.q, ox: p.ox / w, oy: p.oy / h });
    used = Math.max(used, y + h);
    x += w + 1;
    shelf = Math.max(shelf, h);
  }
  const page = document.createElement("canvas");
  page.width = PAGE_W;
  page.height = Math.max(1, used + 1);
  const g = page.getContext("2d")!;
  for (const { name, p } of list) {
    const s = slots.get(name)!;
    g.drawImage(p.canvas, s.sx, s.sy);
    p.canvas.width = p.canvas.height = 0;
  }
  return { page, slots };
}

let guideUrls: Partial<Record<"calm" | "exposed", string>> = {};
/**
 * Tidelotl as an image URL for the briefing diagrams (drawn once per look):
 * standing at three-quarter view, or (`exposed`) stranded belly-flat with its
 * pearl open. Empty without a canvas (outside a browser).
 */
export function tidelotlGuideImage(exposed = false) {
  const width = 360,
    height = 300,
    k = 0.8,
    cx = 180,
    cy = 236;
  const key = exposed ? "exposed" : "calm";
  const P = tidelotlPose({
    clock: 0.3,
    phase: 1,
    reduced: true,
    windup: 0,
    castAge: 99,
    stranded: exposed,
    stagger: false,
    hurt: 0,
    dead: false,
    rise: 1,
    deathSink: 0,
    roarAge: 99,
  });
  if (!exposed)
    Object.assign(P, {
      h: 54,
      legF: "stand",
      legB: "stand",
      expr: "smug",
      mouth: "smirk",
    });
  const layout = tidelotlPlacements(P, 1, 1, false);
  let crop: [number, number, number, number] = [60, 40, 240, 210];
  const core: [number, number] = [
    cx + layout.pearl.x * k,
    cy + layout.pearl.y * k,
  ];
  if (
    !guideUrls[key] &&
    typeof document !== "undefined" &&
    typeof document.createElement === "function"
  ) {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        const byName = new Map(tidelotlPieces().map((p) => [p.name, p]));
        const painted = new Map<string, Painted | null>();
        for (const pl of layout.placements) {
          const pc = byName.get(pl.piece);
          if (!pc) continue;
          if (!painted.has(pl.piece)) painted.set(pl.piece, paintPiece(pc, 1));
          const im = painted.get(pl.piece);
          if (!im) continue;
          ctx.save();
          ctx.globalAlpha = Math.min(1, pl.alpha);
          ctx.translate(cx + pl.x * k, cy + pl.y * k);
          ctx.rotate(pl.rot);
          ctx.scale((pl.sx * k) / im.q, (pl.sy * k) / im.q);
          ctx.drawImage(im.canvas, -im.ox, -im.oy);
          ctx.restore();
        }
        const d = ctx.getImageData(0, 0, width, height).data;
        let x0 = width,
          y0 = height,
          x1 = 0,
          y1 = 0;
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++)
            if (d[(y * width + x) * 4 + 3] > 12) {
              x0 = Math.min(x0, x);
              x1 = Math.max(x1, x);
              y0 = Math.min(y0, y);
              y1 = Math.max(y1, y);
            }
        if (x1 > x0) crop = [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
        guideUrls[key] = canvas.toDataURL("image/png");
        guideCrops[key] = crop;
      }
    } catch {
      /* No drawing surface: the diagram shows no picture. */
    }
  }
  return {
    url: guideUrls[key] ?? "",
    width,
    height,
    crop: guideCrops[key] ?? crop,
    core,
  };
}
const guideCrops: Partial<
  Record<"calm" | "exposed", [number, number, number, number]>
> = {};
/** Forget the drawn pictures (tests). */
export function resetTidelotlGuide() {
  guideUrls = {};
}
