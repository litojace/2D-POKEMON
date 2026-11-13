/**
 * Lumiwick, the sky-lantern spirit that replaced Emberwing's phoenix look
 * (same element, attacks and mechanics; internal id `emberwing`). Pure: the
 * pose from the battle's state (`lumiwickPose`) and where each atlas piece
 * goes this frame (`lumiwickPlacements`). boss-lumiwick-paint.ts paints the
 * pieces; boss-lumiwick-rig.ts moves images to these placements.
 *
 * Ported from the approved demo: keyframe pose tables per action, sampled at
 * a time read off the attack's warning (its windup) and its cast (the
 * follow-through), 8 facings from 5 drawn views plus mirrors.
 */
import {
  ARM_POSE_NAMES,
  L_BOT,
  L_TOP,
  VIEW_YAW,
  armModel,
  armRoot,
  armStates,
  clamp,
  ease,
  eyeLayout,
  lerp,
  makeView,
  smooth,
  surf,
  yS,
  type P2,
} from "./boss-lumiwick-shape";
import { nextFacing } from "./boss-vector-grumble";

/** World pixels per rig unit: Lumiwick's size in battle. */
export const LUMI_SCALE = 0.86;
/** On the floor (grounded or beaten), the hem rests here (rig units above the floor). */
export const GROUND_H = 70;
/** Facing 0..7 (0 towards the camera, 2 screen right) → drawn view and mirror. */
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
/** How much a forward tip shows as a screen rotation per view (front and back squash instead). */
const PITCH_SCREEN = [0, 0.72, 1, 0.72, 0];
type Side = "L" | "R";
/** Which way an arm turns to lift, per view and side. */
const ASIGN = VIEW_YAW.map((yaw) => {
  const V = makeView(yaw),
    o = { L: 1, R: 1 } as Record<Side, number>;
  for (const side of ["L", "R"] as Side[]) {
    const M = armModel("rest", side),
      tip = V.P(M[M.length - 1].p),
      s0 = V.P(M[0].p);
    o[side] = tip.x - s0.x < 0 ? 1 : -1;
  }
  return o;
});
/** Depth of each drawn arm (along it) per view, side and pose: sets the draw order. */
const AZ = VIEW_YAW.map((yaw) => {
  const V = makeView(yaw),
    o: Record<string, number> = {};
  for (const side of ["L", "R"] as Side[]) {
    const sh = armRoot(side);
    for (const pose of ARM_POSE_NAMES) {
      const M = armModel(pose, side),
        m = M[Math.round(M.length * 0.6)].p;
      o[side + pose] = V.P({ x: sh.x + m.x, y: sh.y + m.y, z: sh.z + m.z }).z;
    }
  }
  return o;
});
/** Scorch marks that appear as it heats up: angle, height, drawing, size. */
const MARKS = [
  { ph: 2, phi: -1.25, y: 44, n: "burn_0", s: 1 },
  { ph: 2, phi: 1.55, y: -30, n: "burn_1", s: 1 },
  { ph: 2, phi: 2.6, y: 20, n: "burn_2", s: 1 },
  { ph: 2, phi: -2.3, y: -22, n: "burn_0", s: 0.9 },
  { ph: 2, phi: 0.8, y: 54, n: "burn_2", s: 0.75 },
  { ph: 3, phi: -1.55, y: -8, n: "hole", s: 0.9 },
  { ph: 3, phi: 2.0, y: 48, n: "hole", s: 1 },
  { ph: 3, phi: -1.9, y: 10, n: "burn_1", s: 1.1 },
  { ph: 3, phi: 3.0, y: -36, n: "hole", s: 0.9 },
  { ph: 3, phi: 1.15, y: 14, n: "burn_0", s: 0.85 },
  { ph: 3, phi: -0.4, y: 60, n: "burn_1", s: 0.8 },
];
const MARKP = VIEW_YAW.map((yaw) => {
  const V = makeView(yaw);
  return MARKS.map((m) => ({
    ...m,
    q: V.P(surf(m.phi, m.y, 0.4)),
    c: Math.cos(m.phi + yaw),
  }));
});
const EYEP = [0, 1, 2].map((v) => eyeLayout(v));
const ATT = VIEW_YAW.map((yaw) => {
  const V = makeView(yaw);
  return {
    shL: V.P(armRoot("L")),
    shR: V.P(armRoot("R")),
    crown: V.P({ x: 0, y: L_TOP - 2, z: 0 }),
    hem: V.P({ x: 0, y: L_BOT - 2, z: 0 }),
    heart: V.P({ x: 0, y: L_BOT + 4, z: 0 }),
    curlTip: V.P({ x: 0, y: 30, z: 13 }),
  };
});
/** Every arm drawing the atlas holds (front and back views mirror one side). */
export const ARM_PIECES = VIEW_YAW.flatMap((_, v) =>
  (["L", "R"] as Side[]).flatMap((side) =>
    (v === 0 || v === 4) && side === "R"
      ? []
      : ARM_POSE_NAMES.flatMap((pose) =>
          Array.from(
            { length: armStates(pose) },
            (_, st) => `arm_${v}_${side}_${pose}_${st}`,
          ),
        ),
  ),
);

// ════════════════════════ keyframe pose tables ════════════════════════
// Numbers ease between keys; names (arm poses, expression, mouth) switch at
// their key. Missing fields carry over from the key before.
//   h: hover (axis above the floor) · pitch: tip forward · lean/brot: tilt ·
//   bdy: bob · sx/sy: squash about the hem · al/ar: arm drawings · lift: arm
//   raise · fl: wick flame size · flare: flame burst · heat: inner glow ·
//   glow: eye glow · heart: flame heart shown · dim: flame out · crumple
export interface Keys {
  t: number;
  h: number;
  pitch: number;
  lean: number;
  bdy: number;
  brot: number;
  sx: number;
  sy: number;
  al: string;
  ar: string;
  lift: number;
  liftL: number;
  liftR: number;
  expr: string;
  mouth: string;
  fl: number;
  flare: number;
  heat: number;
  glow: number;
  heart: number;
  dim: number;
  crumple: number;
  alpha: number;
  stars: number;
}
type Key = Partial<Keys> & { t: number };
const BASE: Keys = {
  t: 0,
  h: 150,
  pitch: 0,
  lean: 0,
  bdy: 0,
  brot: 0,
  sx: 1,
  sy: 1,
  al: "rest",
  ar: "rest",
  lift: 0,
  liftL: 0,
  liftR: 0,
  expr: "idle",
  mouth: "smirk",
  fl: 1,
  flare: 0,
  heat: 0,
  glow: 0,
  heart: 0,
  dim: 0,
  crumple: 0,
  alpha: 1,
  stars: 0,
};
const ON_FLOOR: Partial<Keys> = {
  h: GROUND_H,
  sy: 0.87,
  sx: 1.08,
  fl: 0.4,
  dim: 0.3,
  lift: 0,
  al: "slump",
  ar: "slump",
};
export interface Action {
  dur: number;
  /** The reduced-motion pose time. */
  key: number;
  keys: Keys[];
  /** [start, end] of the windup in the table (the warning's span maps onto it). */
  wind?: [number, number];
  dizzy?: boolean;
}
function action(
  dur: number,
  key: number,
  keys: Key[],
  o: Partial<Action> = {},
  from: Partial<Keys> = {},
): Action {
  let prev: Keys = { ...BASE, ...from };
  return { dur, key, keys: keys.map((k) => (prev = { ...prev, ...k })), ...o };
}
export const ACTIONS: Record<string, Action> = {
  idle: action(4, 0.9, [{ t: 0 }]),
  // tips over crown-first and plummets along the lane, wick streaming like a comet
  "dive-bomb": action(
    3.2,
    1.35,
    [
      { t: 0 },
      {
        t: 0.25,
        al: "up",
        ar: "up",
        lift: 0.12,
        h: 172,
        expr: "glare",
        mouth: "grin",
        sy: 1.07,
        sx: 0.95,
        fl: 1.4,
      },
      { t: 0.8, lift: 0.24, h: 184, sy: 1.11, sx: 0.92, flare: 0.5, heat: 0.6 },
      {
        t: 1.05,
        al: "rest",
        ar: "rest",
        lift: -0.35,
        sy: 1.12,
        sx: 0.9,
        fl: 2.6,
        flare: 0.3,
        h: 150,
      },
      { t: 1.15, h: 130 },
      { t: 1.5, h: 74 },
      {
        t: 1.55,
        al: "up",
        ar: "up",
        lift: 0.32,
        h: 84,
        sy: 0.86,
        sx: 1.12,
        fl: 1.2,
        flare: 0,
        pitch: -0.25,
      },
      {
        t: 1.9,
        al: "rest",
        ar: "rest",
        lift: 0,
        h: 140,
        sy: 1,
        sx: 1,
        pitch: 0,
        heat: 0,
        mouth: "smirk",
      },
      { t: 3.0, h: 150, expr: "idle" },
    ],
    { wind: [0, 1.15] },
  ),
  // rises, swells and flares: sparks pour out of the open hem
  "ember-rain": action(
    3,
    0.95,
    [
      { t: 0 },
      {
        t: 0.3,
        h: 194,
        al: "up",
        ar: "up",
        lift: 0.05,
        expr: "glare",
        mouth: "grin",
        sy: 1.05,
        sx: 0.97,
        heat: 0.4,
        fl: 1.4,
      },
      {
        t: 0.85,
        h: 206,
        lift: 0.32,
        flare: 1,
        fl: 2.4,
        sy: 1.12,
        sx: 0.92,
        heat: 1,
      },
      {
        t: 1.1,
        al: "sweep",
        ar: "sweep",
        lift: 0.12,
        sy: 0.95,
        sx: 1.04,
        fl: 1.8,
      },
      { t: 1.4, al: "up", ar: "up", lift: 0.26, sy: 1.04 },
      { t: 1.7, al: "sweep", ar: "sweep", lift: 0.06 },
      {
        t: 2.1,
        al: "rest",
        ar: "rest",
        lift: 0,
        h: 160,
        flare: 0,
        fl: 1,
        sy: 1,
        sx: 1,
        heat: 0,
        mouth: "smirk",
      },
      { t: 2.8, h: 150, expr: "idle" },
    ],
    { wind: [0, 1.2] },
  ),
  // ribbons drawn back and up, then fanned forward with a puff of hot air
  "wing-gust": action(
    2.6,
    1.18,
    [
      { t: 0 },
      {
        t: 0.3,
        al: "up",
        ar: "up",
        lift: 0.32,
        pitch: -0.24,
        h: 165,
        expr: "glare",
        mouth: "smirk",
        sy: 1.06,
        sx: 0.96,
      },
      { t: 1.0, lift: 0.44, pitch: -0.32, h: 170, sy: 1.12, sx: 0.92 },
      {
        t: 1.1,
        al: "sweep",
        ar: "sweep",
        lift: 0.05,
        pitch: 0.22,
        sy: 0.88,
        sx: 1.1,
        mouth: "o",
        fl: 1.6,
      },
      { t: 1.2, lift: -0.12, pitch: 0.3 },
      { t: 1.55, lift: -0.06, pitch: 0.18, sy: 0.97, sx: 1.02, fl: 1.1 },
      {
        t: 1.9,
        al: "rest",
        ar: "rest",
        lift: 0,
        pitch: 0,
        h: 150,
        sy: 1,
        sx: 1,
        mouth: "smirk",
        fl: 1,
      },
      { t: 2.4, expr: "idle" },
    ],
    { wind: [0, 1.1] },
  ),
  // hugs itself and glows, then bursts tall: the flame flares out as a ring
  "flame-ring": action(
    3.4,
    1.05,
    [
      { t: 0 },
      {
        t: 0.2,
        al: "wrap",
        ar: "wrap",
        h: 134,
        sy: 0.88,
        sx: 1.08,
        expr: "closed",
        mouth: "flat",
        glow: 0.4,
        heat: 0.6,
        fl: 0.7,
      },
      {
        t: 0.75,
        h: 128,
        sy: 0.84,
        sx: 1.11,
        glow: 1,
        expr: "glare",
        heat: 1,
        fl: 0.5,
      },
      {
        t: 1.0,
        al: "up",
        ar: "up",
        lift: 0.36,
        h: 164,
        sy: 1.15,
        sx: 0.91,
        mouth: "grin",
        flare: 1,
        fl: 2.8,
      },
      { t: 1.5, lift: 0.26, glow: 0.4, sy: 1.04, sx: 0.98, fl: 1.8 },
      {
        t: 2.1,
        al: "rest",
        ar: "rest",
        lift: 0,
        h: 150,
        sy: 1,
        sx: 1,
        flare: 0,
        glow: 0,
        heat: 0,
        fl: 1,
        mouth: "smirk",
      },
      { t: 3.0, expr: "idle" },
    ],
    { wind: [0, 1.0] },
  ),
  // tips toward the raiders and shakes out drops of burning wax
  "scorched-earth": action(
    3.2,
    1.25,
    [
      { t: 0 },
      {
        t: 0.35,
        al: "sweep",
        ar: "sweep",
        lift: 0.18,
        h: 130,
        pitch: 0.3,
        expr: "glare",
        mouth: "smirk",
      },
      { t: 1.0, pitch: 0.36, h: 126 },
      { t: 1.05, sy: 0.9, sx: 1.07, fl: 1.9, mouth: "grin", lift: 0.05 },
      { t: 1.2, sy: 1.03, sx: 0.99, fl: 1.1, lift: 0.18 },
      { t: 1.26, sy: 0.9, sx: 1.07, fl: 1.9, lift: 0.05 },
      { t: 1.42, sy: 1.03, sx: 0.99, fl: 1.1, lift: 0.18 },
      { t: 1.47, sy: 0.9, sx: 1.07, fl: 1.9, lift: 0.05 },
      { t: 1.63, sy: 1.03, sx: 0.99, fl: 1.1, lift: 0.18 },
      { t: 1.86, sy: 1, sx: 1, fl: 1, mouth: "smirk" },
      { t: 2.2, al: "rest", ar: "rest", lift: 0, h: 150, pitch: 0 },
      { t: 2.9, expr: "idle" },
    ],
    { wind: [0, 1.05] },
  ),
  // eyes glare, the far ribbon points at the raider while the brand hunts
  "heat-mark": action(
    3.9,
    0.9,
    [
      { t: 0 },
      { t: 0.2, expr: "glare", glow: 1, mouth: "smirk" },
      { t: 0.3, al: "up", liftL: 0.2, lean: -0.04 },
      { t: 0.5, al: "point", liftL: 0, lean: 0.06, pitch: 0.12, mouth: "grin" },
      { t: 1.3, lean: 0.05, mouth: "smirk", glow: 0.7 },
      { t: 3.3, al: "rest", lean: 0, pitch: 0, glow: 0.3 },
      { t: 3.45, glow: 0, mouth: "grin" },
      { t: 3.8, expr: "idle", mouth: "smirk" },
    ],
    { wind: [0.45, 3.45] },
  ),
  hurt: action(0.9, 0.1, [
    { t: 0 },
    {
      t: 0.06,
      expr: "hurt",
      mouth: "o",
      al: "up",
      ar: "up",
      lift: 0.25,
      brot: -0.14,
      h: 158,
      lean: -0.05,
      sy: 0.88,
      sx: 1.1,
    },
    { t: 0.28, lift: 0.1, brot: -0.06, h: 152, sy: 1.04, sx: 0.97 },
    {
      t: 0.5,
      al: "rest",
      ar: "rest",
      lift: 0,
      brot: 0,
      lean: 0,
      sy: 1,
      sx: 1,
      mouth: "smirk",
    },
  ]),
  stagger: action(
    3.4,
    1.2,
    [
      { t: 0 },
      {
        t: 0.25,
        expr: "dizzy",
        mouth: "wavy",
        lift: -0.35,
        h: 112,
        stars: 1,
        fl: 0.6,
        sy: 0.95,
        sx: 1.04,
      },
      { t: 2.9, h: 108, stars: 1 },
    ],
    { dizzy: true },
  ),
  // the braziers bring it down: it drops, deflates, the flame shrinks and the heart shows
  grounded: action(7.2, 3.0, [
    { t: 0 },
    {
      t: 0.15,
      expr: "wide",
      mouth: "o",
      h: 160,
      al: "up",
      ar: "up",
      lift: 0.3,
    },
    { t: 0.85, h: 122, brot: 0.25, fl: 0.7 },
    { t: 1.1, brot: -0.2, h: 84 },
    {
      t: 1.35,
      h: GROUND_H,
      sy: 0.78,
      sx: 1.15,
      brot: 0.08,
      expr: "dizzy",
      mouth: "wavy",
      stars: 1,
      al: "slump",
      ar: "slump",
      lift: 0,
      fl: 0.4,
      dim: 0.3,
    },
    { t: 1.6, sy: 0.9, sx: 1.06, brot: 0 },
    { t: 1.9, heart: 1, sy: 0.87, sx: 1.08 },
    { t: 3.2, expr: "wide", mouth: "flat", stars: 0, brot: 0.04 },
    { t: 4.4, brot: -0.04 },
    { t: 6.6, brot: 0 },
  ]),
  takeoff: action(
    2.4,
    0.62,
    [
      { t: 0, expr: "glare", mouth: "flat" },
      { t: 0.4, h: 66, sy: 0.8, sx: 1.13, al: "up", ar: "up", lift: 0.3 },
      { t: 0.6, h: 98, sy: 1.15, sx: 0.91, fl: 1.9, dim: 0, mouth: "grin" },
      { t: 0.85, h: 126, sy: 1, sx: 1, al: "rest", ar: "rest", lift: 0, fl: 1 },
      { t: 1.6, h: 150, expr: "idle", mouth: "smirk" },
    ],
    {},
    ON_FLOOR,
  ),
  roar: action(2.4, 0.75, [
    { t: 0 },
    {
      t: 0.3,
      al: "wrap",
      ar: "wrap",
      sy: 0.86,
      sx: 1.1,
      expr: "closed",
      mouth: "flat",
      heat: 0.6,
      h: 140,
    },
    {
      t: 0.6,
      al: "up",
      ar: "up",
      lift: 0.42,
      sy: 1.17,
      sx: 0.91,
      expr: "glare",
      mouth: "grin",
      flare: 1,
      fl: 3,
      heat: 1,
      h: 172,
    },
    { t: 1.5, lift: 0.3, sy: 1.08, sx: 0.96, fl: 2 },
    {
      t: 1.9,
      al: "rest",
      ar: "rest",
      lift: 0,
      sy: 1,
      sx: 1,
      flare: 0,
      fl: 1,
      heat: 0,
      h: 150,
      mouth: "smirk",
    },
    { t: 2.3, expr: "idle" },
  ]),
  // the flame gutters out, the paper goes pale, it drifts down and crumples
  defeat: action(5.2, 3.6, [
    { t: 0 },
    {
      t: 0.08,
      expr: "hurt",
      mouth: "o",
      al: "up",
      ar: "up",
      lift: 0.3,
      brot: -0.18,
      h: 160,
      sy: 0.9,
      sx: 1.08,
    },
    {
      t: 0.5,
      al: "rest",
      ar: "rest",
      lift: -0.2,
      brot: 0.1,
      sy: 1,
      sx: 1,
      fl: 0.5,
      expr: "wide",
    },
    {
      t: 1.1,
      fl: 0.15,
      dim: 0.6,
      expr: "closed",
      mouth: "wavy",
      h: 132,
      brot: -0.12,
      lift: -0.4,
    },
    { t: 1.5, fl: 0, dim: 1, h: 112, brot: 0.15 },
    { t: 2.2, h: 88, brot: -0.13 },
    {
      t: 2.8,
      h: GROUND_H,
      brot: 0.05,
      sy: 0.94,
      sx: 1.04,
      al: "slump",
      ar: "slump",
      lift: 0,
    },
    { t: 3.05, sy: 0.74, sx: 1.12 },
    { t: 3.5, crumple: 1, sy: 0.7 },
  ]),
};
const DISCRETE = new Set(["al", "ar", "expr", "mouth", "stars"]);
export function sampleKeys(keys: Keys[], t: number): Keys {
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t <= t) i++;
  const a = keys[i],
    b = keys[Math.min(i + 1, keys.length - 1)];
  if (a === b || t <= a.t) return { ...a };
  const u = ease(clamp((t - a.t) / (b.t - a.t)));
  const o = { ...a } as Record<string, number | string>;
  for (const f in a) {
    const va = (a as unknown as Record<string, number | string>)[f],
      vb = (b as unknown as Record<string, number | string>)[f];
    if (!DISCRETE.has(f) && typeof va === "number" && typeof vb === "number")
      o[f] = lerp(va, vb, u);
  }
  return o as unknown as Keys;
}

// ════════════════════════ the pose from the battle ════════════════════════
export interface LumiCue {
  clock: number;
  phase: number;
  reduced: boolean;
  /** 1 airborne, 0 not flown up yet (it floats low over the floor); eased by the caller. */
  flight: number;
  windKind?: string;
  /** 0-1: how far its warning has run. */
  windup: number;
  castKind?: string;
  castAge: number;
  /** Grounded by the braziers: the heart open. */
  exposed: boolean;
  /** Seconds since it was grounded / took off again. */
  groundAge: number;
  takeoffAge: number;
  stagger: boolean;
  /** 0-1, fading after a hit. */
  hurt: number;
  dead: boolean;
  deadAge: number;
  /** Seconds since a new phase began (its flare). */
  roarAge: number;
}
export interface LumiPose extends Keys {
  action: string;
  clock: number;
  phase: number;
  /** 0-1: tipped crown-first along the dive. */
  dive: number;
  floatL: number;
  floatR: number;
  flutL: number;
  flutR: number;
  curlRot: number;
  wickRot: number;
  wickF: number;
  flick: number;
}
/** Which table and time a moment of battle reads (most important first). */
export function lumiwickAction(c: LumiCue): { id: string; t: number } {
  if (c.dead)
    return { id: "defeat", t: c.reduced ? ACTIONS.defeat.key : c.deadAge };
  if (c.exposed)
    return {
      id: "grounded",
      t: c.reduced ? ACTIONS.grounded.key : Math.min(6.6, 1.35 + c.groundAge),
    };
  if (c.takeoffAge < 1.6)
    return {
      id: "takeoff",
      t: c.reduced ? ACTIONS.takeoff.key : 0.4 + c.takeoffAge,
    };
  if (c.roarAge < 2.3)
    return { id: "roar", t: c.reduced ? ACTIONS.roar.key : c.roarAge };
  if (c.windKind && ACTIONS[c.windKind]?.wind) {
    const [a, b] = ACTIONS[c.windKind].wind!;
    return { id: c.windKind, t: lerp(a, b, clamp(c.windup)) };
  }
  if (c.castKind && ACTIONS[c.castKind]?.wind) {
    const A = ACTIONS[c.castKind];
    if (c.castAge < A.dur - A.wind![1])
      return { id: c.castKind, t: c.reduced ? A.key : A.wind![1] + c.castAge };
  }
  if (c.stagger)
    return { id: "stagger", t: c.reduced ? 1.2 : 1.2 + (c.clock % 1.6) };
  return { id: "idle", t: 0 };
}
/** The full pose: the table, the battle's overlays, and the living layer unless motion is reduced. */
export function lumiwickPose(c: LumiCue): LumiPose {
  const { id, t } = lumiwickAction(c);
  const K = sampleKeys(ACTIONS[id].keys, t);
  const live = c.reduced ? 0 : 1,
    clock = c.reduced ? 0.3 : c.clock;
  const P: LumiPose = {
    ...K,
    action: id,
    clock,
    phase: clamp(Math.round(c.phase), 1, 3),
    dive: 0,
    floatL: 0,
    floatR: 0,
    flutL: 0,
    flutR: 0,
    curlRot: 0,
    wickRot: 0,
    wickF: 0,
    flick: 1,
  };
  // before its first takeoff (and between flights) it floats low over the terrace
  if (id !== "grounded" && id !== "defeat" && id !== "takeoff")
    P.h = GROUND_H + (P.h - GROUND_H) * (0.35 + 0.65 * clamp(c.flight));
  const air = smooth(84, 124, P.h);
  P.bdy += Math.sin(clock * 1.7) * 3.4 * live * air;
  P.brot += Math.sin(clock * 1.05) * 0.035 * live * air;
  P.floatL = Math.sin(clock * 2.2) * 0.05 * live;
  P.floatR = Math.sin(clock * 2.2 + 1.9) * 0.05 * live;
  P.flutL = live ? smooth(-0.3, 0.3, Math.sin(clock * 2.6)) : 0;
  P.flutR = live ? smooth(-0.3, 0.3, Math.sin(clock * 2.6 + 2.2)) : 0;
  P.curlRot = Math.sin(clock * 2.6) * 0.08 * live;
  P.wickRot = Math.sin(clock * 3.3) * 0.08 * live;
  P.wickF = clock * 11;
  P.flick = 1 + 0.07 * Math.sin(clock * 17) * live;
  if (id === "defeat" && K.fl < 0.6)
    P.fl *= live ? 0.55 + 0.45 * Math.abs(Math.sin(clock * 23)) : 1;
  // the dive: tipped crown-first through the streak (the cast's first 0.4 s)
  if (c.castKind === "dive-bomb" && !c.dead && !c.exposed && !c.reduced)
    P.dive =
      smooth(-0.05, 0.05, c.castAge) * (1 - smooth(0.4, 0.62, c.castAge));
  else if (c.windKind === "dive-bomb" && !c.reduced)
    P.dive = smooth(0.92, 1, c.windup);
  // stagger on top of an attack pose: dizzy face and stars
  if (c.stagger && id !== "stagger" && !c.dead) {
    P.expr = "dizzy";
    P.mouth = "wavy";
    P.stars = 1;
  }
  if (P.stars) {
    P.brot += Math.sin(clock * 3.2) * 0.1 * live;
    P.lean += Math.sin(clock * 2.1) * 0.05 * live;
  }
  // a hit: a flinch on top of whatever it is doing
  if (c.hurt > 0.3 && !c.dead && !c.reduced) {
    P.expr = "hurt";
    P.mouth = "o";
    P.sy *= 1 - 0.1 * c.hurt;
    P.sx *= 1 + 0.08 * c.hurt;
    P.brot -= 0.1 * c.hurt;
  }
  if (live && (P.expr === "idle" || P.expr === "glare") && clock % 3.3 > 3.18)
    P.expr = "closed";
  return P;
}
/** The facing shown (eight ways, with hysteresis), from where it faces on screen. */
export const lumiwickFacing = (angle: number, previous?: number) =>
  nextFacing(angle, previous);

// ════════════════════════ placements ════════════════════════
export interface Placement {
  /** One image per key, reused frame to frame. */
  key: string;
  piece: string;
  /** World offset from the boss's floor spot (px). */
  x: number;
  y: number;
  rot: number;
  /** Scale in rig units (the rig divides by the piece's atlas density). */
  sx: number;
  sy: number;
  alpha: number;
  /** Additive blend (the warm halo and heat). */
  add?: boolean;
}
type M6 = [number, number, number, number, number, number];
const mul = (m: M6, n: M6): M6 => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const T = (x: number, y: number): M6 => [1, 0, 0, 1, x, y];
const R = (a: number): M6 => [
  Math.cos(a),
  Math.sin(a),
  -Math.sin(a),
  Math.cos(a),
  0,
  0,
];
const S = (x: number, y = x): M6 => [x, 0, 0, y, 0, 0];
const pt = (m: M6, x: number, y: number): P2 => ({
  x: m[0] * x + m[2] * y + m[4],
  y: m[1] * x + m[3] * y + m[5],
});
export interface LumiFrame {
  placements: Placement[];
  /** World offsets from the floor spot. */
  head: P2;
  crest: P2;
  hem: P2;
  heart: P2 & { open: number };
  eyes: P2[];
  flame: number;
  view: number;
  mirror: boolean;
}
const HEAT_BY_PHASE = [0, 0, 0.28, 0.55];
const WICK_BY_PHASE = [1, 1, 1.25, 1.55];
/**
 * Where every piece goes this frame (back to front), in world pixels from
 * the boss's floor spot. dir: the screen direction of a dive.
 */
export function lumiwickPlacements(
  P: LumiPose,
  facing: number,
  dir?: P2,
): LumiFrame {
  const F = FACING[((facing % 8) + 8) % 8],
    v = F.v,
    A = ATT[v],
    phase = P.phase;
  const out: Placement[] = [];
  const items: { z: number; f: () => void }[] = [];
  let m: M6 = T(0, -P.h * LUMI_SCALE);
  m = mul(m, R(P.lean));
  m = mul(m, S(LUMI_SCALE));
  if (F.m) m = mul(m, S(-1, 1));
  if (P.dive > 0.001 && dir) {
    const a = Math.atan2(dir.y, Math.abs(dir.x));
    m = mul(m, R((a + Math.PI / 2) * P.dive));
  }
  m = mul(m, T(0, P.bdy));
  m = mul(m, R(P.pitch * PITCH_SCREEN[v] + P.brot));
  const fwd = P.pitch * (1 - PITCH_SCREEN[v]);
  const hemY = yS(L_BOT),
    sx = P.sx,
    sy = P.sy * (1 - Math.abs(fwd) * 0.14);
  const sq = (q: P2) => ({ x: q.x * sx, y: hemY + (q.y - hemY) * sy });
  const live = 1 - P.crumple;
  const body = mul(m, mul(T(0, hemY), mul(S(sx, sy), T(0, -hemY))));
  const place = (
    key: string,
    piece: string,
    base: M6,
    x: number,
    y: number,
    rot: number,
    alpha: number,
    ksx = 1,
    ksy = ksx,
    add = false,
  ) => {
    if (alpha <= 0.01) return;
    const n = mul(base, mul(T(x, y), mul(R(rot), S(ksx, ksy))));
    const scx = Math.hypot(n[0], n[1]),
      det = n[0] * n[3] - n[1] * n[2];
    out.push({
      key,
      piece,
      x: n[4],
      y: n[5],
      rot: Math.atan2(n[1], n[0]),
      sx: scx,
      sy: det / (scx || 1),
      alpha: clamp(alpha),
      add,
    });
  };
  const res = {} as Omit<LumiFrame, "placements" | "view" | "mirror">;
  res.eyes = [];
  // arms
  for (const side of ["L", "R"] as Side[]) {
    const pose = side === "L" ? P.al : P.ar,
      sh = sq(side === "L" ? A.shL : A.shR);
    const mirrorPiece = (v === 0 || v === 4) && side === "R";
    const rot =
      ((P.lift + (side === "L" ? P.liftL : P.liftR)) * 0.5 +
        (side === "L" ? P.floatL : P.floatR)) *
      ASIGN[v][side];
    const k = armStates(pose) > 1 ? (side === "L" ? P.flutL : P.flutR) : 0;
    const nm = (st: number) =>
      `arm_${v}_${mirrorPiece ? "L" : side}_${pose}_${st}`;
    items.push({
      z: AZ[v][side + pose],
      f: () => {
        if (k < 0.02)
          place(
            `arm${side}`,
            nm(0),
            m,
            sh.x,
            sh.y,
            rot,
            live,
            mirrorPiece ? -1 : 1,
            1,
          );
        else if (k > 0.98)
          place(
            `arm${side}`,
            nm(1),
            m,
            sh.x,
            sh.y,
            rot,
            live,
            mirrorPiece ? -1 : 1,
            1,
          );
        else {
          place(
            `arm${side}`,
            nm(0),
            m,
            sh.x,
            sh.y,
            rot,
            live * clamp(2 - 2 * k),
            mirrorPiece ? -1 : 1,
            1,
          );
          place(
            `arm${side}b`,
            nm(1),
            m,
            sh.x,
            sh.y,
            rot,
            live * clamp(2 * k),
            mirrorPiece ? -1 : 1,
            1,
          );
        }
      },
    });
  }
  // the wick flame under the hem, behind the hoop
  items.push({
    z: -0.5,
    f: () => {
      const hm = sq(A.hem);
      const s =
        P.fl * WICK_BY_PHASE[phase] * (1 + P.flare * 0.5) * P.flick * live;
      if (s > 0.04) {
        const f = P.wickF,
          i = Math.floor(f) % 3,
          k = f - Math.floor(f);
        const sxw = Math.min(1.6, 0.75 + s * 0.25);
        place(
          "wick",
          `wick_${i}`,
          m,
          hm.x,
          hm.y,
          P.wickRot,
          1 - k * 0.6,
          sxw,
          s,
        );
        place(
          "wickb",
          `wick_${(i + 1) % 3}`,
          m,
          hm.x,
          hm.y,
          P.wickRot,
          k,
          sxw,
          s,
        );
      }
      res.hem = pt(m, hm.x, hm.y);
      res.flame = s;
    },
  });
  // the warm halo behind it
  items.push({
    z: -0.9,
    f: () => {
      const k = (1 - P.dim) * live;
      place(
        "halo",
        "halo",
        m,
        0,
        yS(10) * sy + hemY * (1 - sy),
        0,
        (0.32 + 0.1 * phase + 0.3 * P.flare + 0.2 * P.heat) * k,
        1 + 0.05 * phase + P.flare * 0.15,
        1 + 0.05 * phase + P.flare * 0.15,
        true,
      );
    },
  });
  // the body group: paper, warmth, scorch marks, face
  items.push({
    z: 0,
    f: () => {
      if (live > 0.01) {
        if (P.dim < 0.99) place("body", `body_${v}`, body, 0, 0, 0, live);
        if (P.dim > 0.01) place("dim", `dim_${v}`, body, 0, 0, 0, P.dim * live);
        const heat =
          (HEAT_BY_PHASE[phase] + P.heat * 0.45 + P.flare * 0.25) *
          (1 - P.dim) *
          live;
        place("heat", "heat", body, 0, 0, 0, heat, 1, 1, true);
        MARKP[v].forEach((mk, i) => {
          if (phase >= mk.ph && mk.c > 0.2)
            place(
              `mark${i}`,
              mk.n,
              body,
              mk.q.x,
              mk.q.y,
              0,
              live,
              mk.s * Math.pow(mk.c, 0.8),
              mk.s,
            );
        });
        if (v <= 2) {
          place("eyes", `eyes_${v}_${P.expr}`, body, 0, 0, 0, live);
          place("mouth", `mouth_${v}_${P.mouth}`, body, 0, 0, 0, live);
        }
      }
      res.eyes = v <= 2 ? EYEP[v].map((e) => pt(body, e.x, e.y)) : [];
      res.head = pt(body, 0, yS(30));
      if (P.crumple > 0.01)
        place(
          "crumple",
          "crumple",
          m,
          0,
          hemY + 5,
          0,
          P.crumple,
          0.95 + 0.05 * P.crumple,
          0.6 + 0.4 * P.crumple,
        );
    },
  });
  // the crown curl, lit from phase 2
  items.push({
    z: v <= 2 ? 0.6 : -0.6,
    f: () => {
      const c = sq(A.crown);
      place("curl", `curl_${v}`, m, c.x, c.y, P.curlRot, live);
      const ca = Math.cos(P.curlRot),
        sa = Math.sin(P.curlRot);
      const tx = c.x + A.curlTip.x * ca - A.curlTip.y * sa,
        ty = c.y + A.curlTip.x * sa + A.curlTip.y * ca;
      res.crest = pt(m, tx, ty);
      if (phase >= 2 && live > 0.5 && P.dim < 0.5) {
        const s = phase >= 3 ? 0.5 : 0.36;
        place(
          "curlFlame",
          `flame_${Math.floor(P.wickF) % 3}`,
          m,
          tx,
          ty + 4,
          0,
          0.95,
          s,
          s * P.flick,
          true,
        );
      }
    },
  });
  // the flame heart, shown when grounded
  items.push({
    z: v <= 2 ? 0.8 : -0.8,
    f: () => {
      const h = sq(A.heart);
      if (P.heart > 0.01) {
        const pulse = 1 + Math.sin(P.clock * 5) * 0.06;
        place(
          "heart",
          "heart",
          m,
          h.x,
          h.y,
          0,
          P.heart,
          pulse * lerp(0.7, 1.25, P.heart),
        );
      }
      res.heart = { ...pt(m, h.x, h.y), open: P.heart };
    },
  });
  items.sort((a, b) => a.z - b.z);
  for (const it of items) it.f();
  // dizzy stars circle its head
  if (P.stars > 0.5)
    for (let i = 0; i < 3; i++) {
      const a = P.clock * 3 + (i * Math.PI * 2) / 3;
      out.push({
        key: `star${i}`,
        piece: "star",
        x: res.head.x + Math.cos(a) * 40,
        y: res.head.y - 46 + Math.sin(a) * 9,
        rot: a,
        sx: 0.85,
        sy: 0.85,
        alpha: 1,
      });
    }
  return { placements: out, ...res, view: v, mirror: F.m };
}
